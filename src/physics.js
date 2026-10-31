// Fizika auta napravljena za zabavan drift, ne za simulaciju.
// Auto ima dva stanja: GRIP (ide kud su kotači okrenuti) i DRIFT (nos se okreće slobodnije od smjera
// kretanja, a bočno prianjanje polako vraća auto u ravninu). Igrač u driftu kut drži volanom i gasom.
// Koordinate auta: x naprijed, y lijevo. Svijet: x desno, y gore, kutovi u radijanima (CCW).

export const G = 9.81;
const AIR_DENSITY = 1.225;
const RPM_PER_RAD_S = 60 / (2 * Math.PI);
const DEG = Math.PI / 180;

// grip: množi bočno prianjanje i vuču. drag: dodatno usporavanje u m/s².
export const SURFACES = {
  asphalt: { id: 'asphalt', name: 'Asfalt', grip: 1.0, drag: 0 },
  curb: { id: 'curb', name: 'Rubnik', grip: 0.92, drag: 0.4 },
  grass: { id: 'grass', name: 'Trava', grip: 0.6, drag: 3.5 },
  concrete: { id: 'concrete', name: 'Beton', grip: 0.95, drag: 0.1 },
  epoxy: { id: 'epoxy', name: 'Epoksidni pod', grip: 0.78, drag: 0.05 },
  wet: { id: 'wet', name: 'Mokri asfalt', grip: 0.72, drag: 0.2 },
  gravel: { id: 'gravel', name: 'Šljunak', grip: 0.62, drag: 2.2 },
  tiles: { id: 'tiles', name: 'Uglačane pločice', grip: 0.58, drag: 0.05 },
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function torqueAt(engine, rpm) {
  const curve = engine.torque;
  let t = curve[curve.length - 1][1];
  if (rpm <= curve[0][0]) t = curve[0][1];
  else {
    for (let i = 1; i < curve.length; i++) {
      if (rpm <= curve[i][0]) {
        const [r0, t0] = curve[i - 1];
        const [r1, t1] = curve[i];
        t = t0 + ((t1 - t0) * (rpm - r0)) / (r1 - r0);
        break;
      }
    }
  }
  return t * engine.powerMul;
}

export class Car {
  constructor(spec) {
    this.spec = spec;
    this.reset(0, 0, 0);
  }

  reset(x, y, heading) {
    Object.assign(this, {
      x, y, heading,
      vx: 0, vy: 0, yawRate: 0,
      steer: 0, gear: 1, rpm: this.spec.engine.idle,
      shiftTimer: 0, reverseTimer: 0,
      throttle: 0, brake: 0, handbrake: 0,
      drifting: false, driftDir: 1, driftExit: 0, entryTimer: 0, prevVelAngle: undefined, lastImpact: 0,
    });
    this.wheels = [0, 1, 2, 3].map((i) => ({
      front: i < 2, fz: 0, slip: 0, slideSpeed: 0, surface: SURFACES.asphalt,
    }));
  }

  wheelOffset(i) {
    const s = this.spec;
    const a = s.wheelbase * 0.5;
    return [i < 2 ? a : -a, i % 2 === 0 ? s.trackWidth / 2 : -s.trackWidth / 2];
  }

  toWorld(lx, ly) {
    const c = Math.cos(this.heading), s = Math.sin(this.heading);
    return [this.x + c * lx - s * ly, this.y + s * lx + c * ly];
  }

  localVelocity() {
    const c = Math.cos(this.heading), s = Math.sin(this.heading);
    return { x: c * this.vx + s * this.vy, y: -s * this.vx + c * this.vy };
  }

  get speed() {
    return Math.hypot(this.vx, this.vy);
  }

  // Kut drifta: smjer kretanja u odnosu na nos (pozitivno = auto klizi ulijevo, nos gleda desno).
  get slideAngle() {
    const v = this.localVelocity();
    return this.speed > 1 && v.x > 0 ? Math.atan2(v.y, v.x) : 0;
  }

  gearRatio() {
    const s = this.spec;
    if (this.gear > 0) return s.gears[this.gear - 1] * s.finalDrive;
    if (this.gear < 0) return s.reverse * s.finalDrive;
    return 0;
  }

  shift(gear) {
    this.gear = gear;
    this.shiftTimer = this.spec.shiftTime;
  }

  updateGearbox(dt, input, fwd) {
    const s = this.spec, e = s.engine, n = s.gears.length;
    const rpmIn = (g) => (Math.abs(fwd) / s.wheelRadius) * s.gears[g - 1] * s.finalDrive * RPM_PER_RAD_S;
    if (input.auto) {
      if (this.gear >= 1 && this.shiftTimer === 0) {
        if (rpmIn(this.gear) > e.redline && this.gear < n && input.throttle > 0.1) this.shift(this.gear + 1);
        else if (this.gear > 1 && rpmIn(this.gear) < e.redline * 0.4 && rpmIn(this.gear - 1) < e.redline * 0.8) this.shift(this.gear - 1);
      }
      // Rikverc: drži kočnicu u mjestu. Natrag u prvu: gas u mjestu.
      const stopped = Math.abs(fwd) < 0.5;
      if (this.gear >= 1 && stopped && input.brake > 0.5 && input.throttle < 0.1) {
        this.reverseTimer += dt;
        if (this.reverseTimer > 0.3) { this.gear = -1; this.reverseTimer = 0; }
      } else if (this.gear === -1 && stopped && input.throttle > 0.5) {
        this.gear = 1;
      } else this.reverseTimer = 0;
    } else {
      if (input.shiftUp && this.gear < n) this.shift(this.gear === -1 ? 0 : this.gear + 1);
      if (input.shiftDown && this.gear > -1) this.shift(this.gear - 1);
    }
  }

  step(dt, input, world) {
    const s = this.spec, h = s.handling, e = s.engine;
    const cosH = Math.cos(this.heading), sinH = Math.sin(this.heading);
    let fwd = cosH * this.vx + sinH * this.vy;
    let lat = -sinH * this.vx + cosH * this.vy;
    const speed = Math.hypot(fwd, lat);

    // Podloga ispod svakog kotača.
    let grip = 0, drag = 0;
    for (let i = 0; i < 4; i++) {
      const [ox, oy] = this.wheelOffset(i);
      const sf = world ? world.surfaceAt(this.x + cosH * ox - sinH * oy, this.y + sinH * ox + cosH * oy) : SURFACES.asphalt;
      this.wheels[i].surface = sf;
      grip += sf.grip / 4;
      drag += sf.drag / 4;
    }

    this.updateGearbox(dt, input, fwd);
    let throttle = input.throttle, brake = input.brake;
    // U automatskom mjenjaču u rikvercu tipka za kočnicu služi kao gas.
    if (input.auto && this.gear === -1) { throttle = input.brake; brake = input.throttle; }
    this.throttle = throttle;
    this.brake = brake;
    this.handbrake = input.handbrake;

    // Volan: kotači se okreću konačnom brzinom, pri brzini malo manje da auto ne bude nervozan.
    const steerLimit = s.maxSteer / (1 + (speed / 32) ** 2);
    const steerTarget = input.steer * steerLimit;
    this.steer += clamp(steerTarget - this.steer, -s.steerSpeed * dt, s.steerSpeed * dt);
    const steerIn = clamp(input.steer, -1, 1);

    const beta = speed > 1 && fwd > 0 ? Math.atan2(lat, fwd) : 0;
    const absBeta = Math.abs(beta);
    const speedFactor = clamp(speed / 12, 0, 1);

    // Brzina kojom se okreće smjer kretanja (iz prošlog koraka).
    const velAngle = Math.atan2(this.vy, this.vx);
    const velRate = speed > 2 && this.prevVelAngle !== undefined ? wrap(velAngle - this.prevVelAngle) / dt : 0;
    this.prevVelAngle = velAngle;

    // Ulazak u drift: ručna, pun volan uz gas ili kočnicu pri brzini, ili auto već klizi.
    if (!this.drifting && fwd > 0) {
      // Pun volan mora biti držan neko vrijeme uz gas ili kočnicu, da kratke korekcije ne bace auto u drift.
      const hardSteer = Math.abs(steerIn) > 0.9 && speed > h.entrySpeed && (throttle > 0.5 || brake > 0.3);
      this.entryTimer = hardSteer ? this.entryTimer + dt : 0;
      const kick = (input.handbrake > 0.3 && speed > 5) || this.entryTimer > 0.25;
      if (kick || absBeta > 18 * DEG) {
        this.drifting = true;
        this.driftExit = 0;
        this.driftDir = absBeta > 5 * DEG ? -Math.sign(beta) : Math.sign(steerIn) || Math.sign(this.yawRate) || 1;
        if (kick) this.yawRate += this.driftDir * h.entryKick * speedFactor;
      }
    }

    // Okretanje auta.
    let latGrip = 0, turnAccel = 0;
    if (!this.drifting) {
      // Grip: auto ide kud su kotači okrenuti (bicikl model), ali ne brže nego što gume mogu držati.
      const cap = Math.min(h.turnRate, (h.grip * grip * 1.05) / Math.max(speed, 1));
      const target = clamp((fwd * Math.tan(this.steer)) / s.wheelbase, -cap, cap);
      this.yawRate += (target - this.yawRate) * Math.min(1, dt * 7);
      latGrip = h.grip;
    } else {
      // Drift: igrač bira kut. Volan u zavoj = dublje i uže, pušten volan s gasom = srednji kut,
      // bez gasa = auto se ispravlja. Kontra prebacuje auto preko sredine u drift na drugu stranu.
      if (absBeta > 5 * DEG) this.driftDir = -Math.sign(beta);
      const dir = this.driftDir;
      const into = steerIn * dir;
      const hb = input.handbrake > 0.3 ? 1 : 0;
      const depth = into >= 0
        ? clamp(0.6 * throttle + 0.4 * into + 0.3 * hb, 0, 1)
        : clamp(0.6 * throttle * (1 + into) + 0.55 * into, -1, 1);
      const targetAngle = -dir * depth * h.maxAngle * DEG;
      // beta se mijenja brzinom (velRate - yawRate), pa yawRate biramo da beta ide prema cilju.
      const response = h.angleResponse * (into < 0 ? 1 + h.flick * -into : 1);
      const target = velRate - response * (targetAngle - beta);
      this.yawRate += (target - this.yawRate) * Math.min(1, dt * 10);
      // Koliko jako se putanja savija u smjeru drifta: volan u zavoj steže liniju, kontra je ravna,
      // a gas je malo širi (stražnji kotači proklizavaju).
      // Iznad ~65 km/h volan steže jače, da se i brzi drift može provući kroz zavoj.
      const steerBoost = into > 0 ? 1 + clamp((speed - 18) / 12, 0, 1.8) : 1;
      turnAccel = hb ? h.handbrakeGrip : h.driftGrip + h.driftSteer * steerBoost * into - h.throttleSlide * throttle;
      turnAccel = clamp(turnAccel, -h.driftGrip, h.driftGrip + h.driftSteer * 2.8) * dir;
    }

    if (!this.drifting) {
      // Grip: bočno prianjanje gasi bočnu brzinu, pa auto ide kud gleda nos.
      const latLoss = Math.min(Math.abs(lat), latGrip * grip * dt);
      lat -= Math.sign(lat) * latLoss;
    } else if (speed > 0.5) {
      // Drift: gume savijaju putanju u smjeru drifta, neovisno o kutu nosa. Klizanje bočno jede
      // malo brzine, ali auto zadržava većinu (speedKeep), pa drift ne staje.
      let ang = Math.atan2(lat, fwd);
      ang += ((turnAccel * grip) / Math.max(speed, 3)) * dt;
      const scrub = Math.abs(turnAccel) * grip * Math.abs(Math.sin(ang)) * (1 - h.speedKeep) * dt;
      const v = Math.max(0, speed - scrub);
      fwd = v * Math.cos(ang);
      lat = v * Math.sin(ang);
    }

    // Motor.
    const ratio = this.gearRatio();
    let accel = 0;
    const wheelRpm = (Math.abs(fwd) / s.wheelRadius) * ratio * RPM_PER_RAD_S;
    if (this.shiftTimer > 0) {
      this.shiftTimer = Math.max(0, this.shiftTimer - dt);
      this.rpm += (clamp(wheelRpm, e.idle, e.limiter) - this.rpm) * Math.min(1, dt * 15);
    } else if (ratio === 0) {
      this.rpm += (e.idle + throttle * (e.limiter - e.idle) - this.rpm) * Math.min(1, dt * 8);
    } else {
      // Ispod okretaja polaska kvačilo proklizava, pa motor vuče punim momentom od starta.
      const launch = e.idle + throttle * (e.launchRpm - e.idle);
      this.rpm = Math.max(wheelRpm, launch, e.idle);
      // U driftu kotači proklizavaju: motor vrti više, a do ceste stiže manje vuče.
      if (this.drifting && throttle > 0) this.rpm = Math.min(e.limiter, this.rpm + throttle * 900);
      const torque = wheelRpm >= e.limiter ? 0 : throttle * torqueAt(e, Math.min(this.rpm, e.limiter));
      accel = (torque * ratio * s.efficiency) / (s.wheelRadius * s.mass);
      accel = Math.min(accel, h.traction * grip) * (this.drifting ? 0.75 : 1);
      if (this.gear === -1) accel = -accel;
      // Kočenje motorom kad nema gasa.
      if (throttle < 0.05) accel -= Math.sign(fwd) * h.engineBrake * (this.rpm / e.redline);
    }

    // Kočnice, ručna, otpor zraka i podloge. Ne smiju same pokrenuti auto unatrag.
    let decel = brake * h.brake + input.handbrake * h.handbrakeBrake + drag;
    decel += (0.5 * AIR_DENSITY * s.cdA * speed * speed) / s.mass + 0.12;
    fwd += accel * dt;
    const stop = Math.min(Math.abs(fwd), decel * dt);
    fwd -= Math.sign(fwd) * stop;

    // Izlazak iz drifta: kut je mali kratko vrijeme ili je auto skoro stao.
    if (this.drifting) {
      // Dok igrač prebacuje drift na drugu stranu, prolazak kroz sredinu nije izlazak.
      const switching = Math.abs(steerIn) > 0.5 && throttle > 0.3;
      const small = absBeta < 6 * DEG && input.handbrake < 0.3 && !switching;
      this.driftExit = small ? this.driftExit + dt : 0;
      if (this.driftExit > 0.2 || speed < 3) this.drifting = false;
    }

    this.vx = cosH * fwd - sinH * lat;
    this.vy = sinH * fwd + cosH * lat;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.heading += this.yawRate * dt;

    // Podaci o kotačima za tragove guma, dim i HUD. slip > 1 znači da guma kliže.
    const spin = this.drifting && throttle > 0.3 && s.drivetrain !== 'FWD' ? throttle * 6 : 0;
    for (let i = 0; i < 4; i++) {
      const wh = this.wheels[i];
      const [ox, oy] = this.wheelOffset(i);
      const wx = fwd - this.yawRate * oy, wy = lat + this.yawRate * ox;
      const delta = wh.front ? this.steer : 0;
      const side = Math.abs(-wx * Math.sin(delta) + wy * Math.cos(delta));
      const driven = s.drivetrain === 'AWD' || (s.drivetrain === 'FWD') === wh.front;
      const lock = input.handbrake > 0.3 && !wh.front ? Math.abs(fwd) : 0;
      wh.slideSpeed = side + (driven ? spin : 0) + lock;
      wh.slip = wh.slideSpeed < 1.5 ? wh.slideSpeed / 1.5 : 1 + (wh.slideSpeed - 1.5) / 4;
      wh.fz = (s.mass * G) / 4;
    }
  }
}

function applyContact(car, nx, ny, depth, px, py) {
  const s = car.spec;
  const rx = px - car.x, ry = py - car.y;
  car.x += nx * depth;
  car.y += ny * depth;
  const vpx = car.vx - car.yawRate * ry;
  const vpy = car.vy + car.yawRate * rx;
  const vn = vpx * nx + vpy * ny;
  if (vn >= 0) return 0;
  const rn = rx * ny - ry * nx;
  const jn = (-(1 + 0.25) * vn) / (1 / s.mass + (rn * rn) / s.inertia);
  const tx = -ny, ty = nx;
  const vt = vpx * tx + vpy * ty;
  const rt = rx * ty - ry * tx;
  const jt = clamp(-vt / (1 / s.mass + (rt * rt) / s.inertia), -0.4 * jn, 0.4 * jn);
  car.vx += (jn * nx + jt * tx) / s.mass;
  car.vy += (jn * ny + jt * ty) / s.mass;
  car.yawRate += (rn * jn + rt * jt) / s.inertia;
  return -vn;
}

const CORNERS = [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];

// Kontakt auta s krugom (stup, drvo, čunj). Vraća normalu prema autu, dubinu i točku dodira, ili null.
function circleContact(car, cx, cy, r) {
  const hl = car.spec.length / 2, hw = car.spec.width / 2;
  const dx = cx - car.x, dy = cy - car.y;
  if (dx * dx + dy * dy > (hl + hw + r) ** 2) return null;
  const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  const lx = cosH * dx + sinH * dy, ly = -sinH * dx + cosH * dy;
  const qx = clamp(lx, -hl, hl), qy = clamp(ly, -hw, hw);
  let nlx = qx - lx, nly = qy - ly;
  let depth;
  const d = Math.hypot(nlx, nly);
  if (d > 1e-6) {
    if (d >= r) return null;
    nlx /= d; nly /= d;
    depth = r - d;
  } else {
    const ox = hl - Math.abs(lx), oy = hw - Math.abs(ly);
    if (ox < oy) { nlx = -(Math.sign(lx) || 1); nly = 0; depth = ox + r; }
    else { nlx = 0; nly = -(Math.sign(ly) || 1); depth = oy + r; }
  }
  return {
    nx: cosH * nlx - sinH * nly, ny: sinH * nlx + cosH * nly, depth,
    px: car.x + cosH * qx - sinH * qy, py: car.y + sinH * qx + cosH * qy,
  };
}

// Udarac u pokretni predmet (kolica, čunj): impuls se dijeli prema masama.
function hitProp(car, prop, c) {
  const s = car.spec;
  const share = prop.m / (prop.m + s.mass);
  car.x += c.nx * c.depth * share;
  car.y += c.ny * c.depth * share;
  prop.x -= c.nx * c.depth * (1 - share);
  prop.y -= c.ny * c.depth * (1 - share);
  const rx = c.px - car.x, ry = c.py - car.y;
  const vpx = car.vx - car.yawRate * ry - prop.vx;
  const vpy = car.vy + car.yawRate * rx - prop.vy;
  const vn = vpx * c.nx + vpy * c.ny;
  if (vn >= 0) return 0;
  const rn = rx * c.ny - ry * c.nx;
  const jn = (-(1 + 0.4) * vn) / (1 / s.mass + (rn * rn) / s.inertia + 1 / prop.m);
  car.vx += (jn * c.nx) / s.mass;
  car.vy += (jn * c.ny) / s.mass;
  car.yawRate += (rn * jn) / s.inertia;
  prop.vx -= (jn * c.nx) / prop.m;
  prop.vy -= (jn * c.ny) / prop.m;
  prop.spin = (prop.spin || 0) + (Math.random() - 0.5) * 8;
  prop.hit = true;
  return jn / s.mass;
}

// Sudari s pravokutnicima (zgrade, zidovi), krugovima (stupovi, drveće) i pokretnim predmetima.
// Vraća brzinu udarca; car.hit pamti u što je auto zadnje udario (za kazne).
export function resolveCollisions(car, world) {
  const hl = car.spec.length / 2, hw = car.spec.width / 2;
  let impact = 0, hitOb = null;
  const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  const reach = hl + hw;
  for (const ob of world.obstacles) {
    let v = 0;
    if (ob.type === 'rect') {
      if (car.x + reach < ob.x0 || car.x - reach > ob.x1 || car.y + reach < ob.y0 || car.y - reach > ob.y1) continue;
      for (const [cx, cy] of CORNERS) {
        const lx = cx * hl, ly = cy * hw;
        const px = car.x + cosH * lx - sinH * ly, py = car.y + sinH * lx + cosH * ly;
        if (px <= ob.x0 || px >= ob.x1 || py <= ob.y0 || py >= ob.y1) continue;
        const d = [px - ob.x0, ob.x1 - px, py - ob.y0, ob.y1 - py];
        const k = d.indexOf(Math.min(...d));
        const n = [[-1, 0], [1, 0], [0, -1], [0, 1]][k];
        v = Math.max(v, applyContact(car, n[0], n[1], d[k], px, py));
      }
    } else {
      const c = circleContact(car, ob.x, ob.y, ob.r);
      if (c) v = applyContact(car, c.nx, c.ny, c.depth, c.px, c.py);
    }
    if (v > impact) { impact = v; hitOb = ob; }
  }
  for (const prop of world.props || []) {
    const c = circleContact(car, prop.x, prop.y, prop.r);
    if (!c) continue;
    const first = !prop.hit;
    const v = hitProp(car, prop, c);
    if (first && prop.penalty) car.propHits = (car.propHits || 0) + 1;
    impact = Math.max(impact, v);
  }
  car.lastImpact = impact;
  if (hitOb && impact > 1) car.hit = { ob: hitOb, impact };
  return impact;
}

// Pokretni predmeti klize, usporavaju i odbijaju se od zidova i stupova.
export function updateProps(world, dt) {
  for (const p of world.props || []) {
    const sp = Math.hypot(p.vx, p.vy);
    if (sp < 0.01 && !p.spin) continue;
    const dec = Math.min(sp, p.friction * dt);
    if (sp > 0) { p.vx -= (p.vx / sp) * dec; p.vy -= (p.vy / sp) * dec; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.angle = (p.angle || 0) + (p.spin || 0) * dt;
    p.spin = (p.spin || 0) * (1 - Math.min(1, dt * 2));
    if (Math.abs(p.spin) < 0.05) p.spin = 0;
    for (const ob of world.obstacles) {
      if (ob.type === 'rect') {
        const qx = clamp(p.x, ob.x0, ob.x1), qy = clamp(p.y, ob.y0, ob.y1);
        const dx = p.x - qx, dy = p.y - qy, d = Math.hypot(dx, dy);
        if (d >= p.r || d < 1e-6) continue;
        const nx = dx / d, ny = dy / d;
        p.x += nx * (p.r - d);
        p.y += ny * (p.r - d);
        const vn = p.vx * nx + p.vy * ny;
        if (vn < 0) { p.vx -= 1.5 * vn * nx; p.vy -= 1.5 * vn * ny; }
      } else {
        const dx = p.x - ob.x, dy = p.y - ob.y, d = Math.hypot(dx, dy), min = p.r + ob.r;
        if (d >= min || d < 1e-6) continue;
        const nx = dx / d, ny = dy / d;
        p.x += nx * (min - d);
        p.y += ny * (min - d);
        const vn = p.vx * nx + p.vy * ny;
        if (vn < 0) { p.vx -= 1.5 * vn * nx; p.vy -= 1.5 * vn * ny; }
      }
    }
  }
}
