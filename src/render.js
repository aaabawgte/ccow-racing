// Crtanje svijeta u čistom vektorskom stilu: podloge, cesta, prepreke, auto, tragovi guma i dim.
// Staza daje temu (boje), površine, ukrase i prepreke; ovdje se samo crta.

const SURF_COLORS = {
  asphalt: '#3a3e44', parking: '#41454b', concrete: '#8b8e92', epoxy: '#4f6670',
  wet: '#2c3238', gravel: '#9b8f7a', tiles: '#8f8a80', grass: '#577d47', curb: '#c8352b',
};
const MARK_RES = 5; // piksela po metru u sloju tragova
const MARK_SIZE = 360; // metara, sloj tragova prati auto

function rand01(x, y, k = 0) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { x: 0, y: 0, zoom: 10, rot: 0 };
    this.particles = [];
    this.lastMark = [null, null, null, null];
    this.smokeAcc = [0, 0, 0, 0];
    this.time = 0;

    this.marks = document.createElement('canvas');
    this.marks.width = this.marks.height = MARK_SIZE * MARK_RES;
    this.mctx = this.marks.getContext('2d');
    this.mctx.lineCap = 'round';
    this.markCenter = { x: 0, y: 0 };
    this.glow = makeGlow();

    this.resize();
    addEventListener('resize', () => this.resize());
  }

  setTrack(track) {
    this.track = track;
    this.road = track.width > 0 && !track.dynamic ? track.roadPath() : null;
    if (this.road) {
      const edge = track.width / 2 - 0.45;
      this.leftEdge = offsetPath(track.samples, edge);
      this.rightEdge = offsetPath(track.samples, -edge);
    }
    this.patches = track.bounds && track.theme.patches ? grassPatches(track.bounds) : null;
    this.roadPaths = (track.roads || []).map((r) => {
      const p = new Path2D();
      r.pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
      return { path: p, width: r.width };
    });
    this.clearMarks(track.start.x, track.start.y);
  }

  resize() {
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.w = innerWidth;
    this.h = innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  clearMarks(cx = this.markCenter.x, cy = this.markCenter.y) {
    this.markCenter = { x: cx, y: cy };
    this.setMarkTransform();
    this.mctx.save();
    this.mctx.setTransform(1, 0, 0, 1, 0, 0);
    this.mctx.clearRect(0, 0, this.marks.width, this.marks.height);
    this.mctx.restore();
    this.lastMark = [null, null, null, null];
    this.particles.length = 0;
  }

  setMarkTransform() {
    const half = MARK_SIZE / 2;
    this.mctx.setTransform(MARK_RES, 0, 0, -MARK_RES, (half - this.markCenter.x) * MARK_RES, (half + this.markCenter.y) * MARK_RES);
  }

  // Sloj tragova je ograničen; kad auto ode daleko od sredine, sadržaj se pomakne.
  recenterMarks(x, y) {
    const dx = x - this.markCenter.x, dy = y - this.markCenter.y;
    if (Math.abs(dx) < MARK_SIZE * 0.3 && Math.abs(dy) < MARK_SIZE * 0.3) return;
    const tmp = document.createElement('canvas');
    tmp.width = this.marks.width;
    tmp.height = this.marks.height;
    tmp.getContext('2d').drawImage(this.marks, 0, 0);
    this.mctx.save();
    this.mctx.setTransform(1, 0, 0, 1, 0, 0);
    this.mctx.clearRect(0, 0, this.marks.width, this.marks.height);
    this.mctx.drawImage(tmp, -dx * MARK_RES, dy * MARK_RES);
    this.mctx.restore();
    this.markCenter = { x, y };
    this.setMarkTransform();
  }

  snapCamera(car) {
    Object.assign(this.cam, { x: car.x, y: car.y, rot: car.heading });
  }

  update(car, dt, settings) {
    this.time += dt;
    const speed = car.speed;
    const k = 1 - Math.exp(-dt * 5);
    this.cam.x += (car.x + car.vx * 0.35 - this.cam.x) * k;
    this.cam.y += (car.y + car.vy * 0.35 - this.cam.y) * k;
    const scale = Math.min(this.w, this.h) / 800;
    const indoor = this.track.theme.dark ? 1.15 : 1;
    const targetZoom = (13 - Math.min(6, speed * 0.12)) * scale * indoor;
    this.cam.zoom += (targetZoom - this.cam.zoom) * (1 - Math.exp(-dt * 2));
    let dr = car.heading - this.cam.rot;
    dr = Math.atan2(Math.sin(dr), Math.cos(dr));
    this.cam.rot += dr * (1 - Math.exp(-dt * (settings.rotateCamera ? 4 : 0)));
    this.recenterMarks(car.x, car.y);
    this.updateEffects(car, dt);
  }

  updateEffects(car, dt) {
    const m = this.mctx;
    car.wheels.forEach((wh, i) => {
      const [ox, oy] = car.wheelOffset(i);
      const [x, y] = car.toWorld(ox, oy);
      const sid = wh.surface.id;
      const dusty = sid === 'grass' || sid === 'gravel';
      const intensity = Math.min(1, Math.max(0, (wh.slip - 1.0) / 1.2)) * Math.min(1, wh.slideSpeed / 3);
      if (intensity > 0.05 && wh.fz > 0) {
        const last = this.lastMark[i];
        if (last) {
          if (Math.hypot(x - last.x, y - last.y) > 0.15) {
            m.strokeStyle = dusty ? `rgba(70, 52, 30, ${0.45 * intensity})` : sid === 'tiles' || sid === 'epoxy' ? `rgba(20, 20, 24, ${0.18 * intensity})` : `rgba(18, 18, 20, ${0.3 * intensity})`;
            m.lineWidth = dusty ? 0.3 : 0.22;
            m.beginPath();
            m.moveTo(last.x, last.y);
            m.lineTo(x, y);
            m.stroke();
            this.lastMark[i] = { x, y };
          }
        } else this.lastMark[i] = { x, y };
      } else this.lastMark[i] = null;

      // Dim na tvrdoj podlozi, prašina na travi i šljunku, prskanje na mokrom.
      const rate = wh.slip > 1.1 && wh.slideSpeed > 3 ? (wh.slideSpeed - 3) * 5 * Math.min(1, wh.slip - 1) : 0;
      this.smokeAcc[i] += rate * dt;
      while (this.smokeAcc[i] >= 1 && this.particles.length < 600) {
        this.smokeAcc[i] -= 1;
        this.particles.push({
          x: x + (Math.random() - 0.5) * 0.4,
          y: y + (Math.random() - 0.5) * 0.4,
          vx: car.vx * 0.15 + (Math.random() - 0.5) * 1.5,
          vy: car.vy * 0.15 + (Math.random() - 0.5) * 1.5,
          age: 0,
          life: 1.4 + Math.random() * 1.4,
          size: 0.5 + Math.random() * 0.4,
          kind: dusty ? 'dust' : sid === 'wet' ? 'spray' : 'smoke',
          rgb: !dusty && sid !== 'wet' && car.spec.smoke ? hexRgb(car.spec.smoke) : null,
        });
      }
      if (this.smokeAcc[i] >= 1) this.smokeAcc[i] = 0;
    });
    for (const p of this.particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - dt * 1.5;
      p.vy *= 1 - dt * 1.5;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
  }

  // Pravokutnik svijeta koji se vidi na ekranu (s rezervom), za preskakanje nevidljivih stvari.
  view() {
    const r = Math.hypot(this.w, this.h) / 2 / this.cam.zoom + 8;
    return { x0: this.cam.x - r, x1: this.cam.x + r, y0: this.cam.y - r, y1: this.cam.y + r };
  }

  draw(car, settings) {
    const ctx = this.ctx, th = this.track.theme;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = th.outside;
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.save();
    ctx.translate(this.w / 2, this.h * (settings.rotateCamera ? 0.62 : 0.5));
    ctx.scale(this.cam.zoom, -this.cam.zoom);
    if (settings.rotateCamera) ctx.rotate(Math.PI / 2 - this.cam.rot);
    ctx.translate(-this.cam.x, -this.cam.y);
    const v = this.view();

    this.drawGround(ctx, v);
    const half = MARK_SIZE / 2;
    ctx.save();
    ctx.translate(this.markCenter.x - half, this.markCenter.y + half);
    ctx.scale(1 / MARK_RES, -1 / MARK_RES);
    ctx.drawImage(this.marks, 0, 0);
    ctx.restore();
    if (th.dark) this.drawHeadlights(ctx, car);
    this.drawSmoke(ctx);
    this.drawProps(ctx, v);
    drawCarBody(ctx, car.spec, car.x, car.y, car.heading, car.steer, car.brake > 0.05 || car.handbrake > 0.05, (i) => car.wheelOffset(i));
    this.drawObstacles(ctx, v);
    ctx.restore();
  }

  drawGround(ctx, v) {
    const t = this.track, th = t.theme, b = t.bounds;
    ctx.fillStyle = th.base;
    if (b) ctx.fillRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
    else ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    if (this.patches) {
      ctx.fillStyle = th.patches;
      ctx.fill(this.patches);
    } else if (th.endless) this.drawEndlessPatches(ctx, v);
    if (th.tiles && b) {
      ctx.strokeStyle = th.tiles;
      ctx.lineWidth = 0.05;
      ctx.beginPath();
      for (let x = Math.max(b.minX, Math.floor(v.x0 / 2) * 2); x <= Math.min(b.maxX, v.x1); x += 2) { ctx.moveTo(x, Math.max(b.minY, v.y0)); ctx.lineTo(x, Math.min(b.maxY, v.y1)); }
      for (let y = Math.max(b.minY, Math.floor(v.y0 / 2) * 2); y <= Math.min(b.maxY, v.y1); y += 2) { ctx.moveTo(Math.max(b.minX, v.x0), y); ctx.lineTo(Math.min(b.maxX, v.x1), y); }
      ctx.stroke();
    }

    for (const a of t.areas) if (!a.over) this.drawArea(ctx, a);
    for (const r of this.roadPaths) {
      ctx.lineCap = 'butt';
      ctx.lineWidth = r.width;
      ctx.strokeStyle = th.road || SURF_COLORS.asphalt;
      ctx.stroke(r.path);
    }
    if (t.width > 0) this.drawRoad(ctx);
    for (const a of t.areas) if (a.over) this.drawArea(ctx, a);
    for (const d of t.decor) this.drawDecor(ctx, d);
    this.drawStart(ctx);
    if (th.guide) this.drawGuide(ctx, v);
    for (const z of t.zones) this.drawZone(ctx, z);
    for (const l of t.lights) {
      if (l.x + l.r < v.x0 || l.x - l.r > v.x1 || l.y + l.r < v.y0 || l.y - l.r > v.y1) continue;
      ctx.drawImage(this.glow, l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
    }
  }

  drawEndlessPatches(ctx, v) {
    ctx.fillStyle = this.track.theme.patches;
    const T = 40;
    for (let gx = Math.floor(v.x0 / T); gx <= Math.ceil(v.x1 / T); gx++) {
      for (let gy = Math.floor(v.y0 / T); gy <= Math.ceil(v.y1 / T); gy++) {
        const r = 3 + rand01(gx, gy, 1) * 9;
        ctx.beginPath();
        ctx.ellipse(gx * T + rand01(gx, gy, 2) * T, gy * T + rand01(gx, gy, 3) * T, r, r * 0.7, rand01(gx, gy, 4) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawArea(ctx, a) {
    const style = a.style || a.surface;
    const path = shapePath(a);
    if (style === 'island') {
      ctx.fillStyle = SURF_COLORS.grass;
      ctx.fill(path);
      ctx.strokeStyle = '#bdb8ad';
      ctx.lineWidth = 0.3;
      ctx.stroke(path);
      return;
    }
    if (style === 'roundabout') {
      // asfalt prstena crta se preko ceste, da rubnici ceste ne presijecaju rotor
      ctx.fillStyle = SURF_COLORS.asphalt;
      ctx.fill(path, 'evenodd');
      ctx.fillStyle = SURF_COLORS.grass;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 0.8;
      ctx.strokeStyle = '#ecebe6';
      ctx.setLineDash([1.5, 1.5]);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }
    if (style === 'ramp') {
      ctx.fillStyle = '#6e7276';
      ctx.fill(path);
      ctx.strokeStyle = 'rgba(235, 225, 120, 0.5)';
      ctx.lineWidth = 0.25;
      ctx.setLineDash([1, 1]);
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r - 0.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 0.15;
      for (let k = 0; k < 16; k++) {
        const an = (k / 16) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(a.x + Math.cos(an) * 4.5, a.y + Math.sin(an) * 4.5);
        ctx.lineTo(a.x + Math.cos(an) * (a.r - 1), a.y + Math.sin(an) * (a.r - 1));
        ctx.stroke();
      }
      return;
    }
    if (style === 'atrium') {
      ctx.fillStyle = '#a7a196';
      ctx.fill(path);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.lineWidth = 0.2;
      ctx.stroke(path);
      return;
    }
    ctx.fillStyle = SURF_COLORS[style] || SURF_COLORS[a.surface] || '#555';
    ctx.fill(path);
    if (a.surface === 'wet') {
      ctx.fillStyle = 'rgba(150, 190, 220, 0.12)';
      ctx.fill(path);
      ctx.strokeStyle = 'rgba(170, 200, 230, 0.2)';
      ctx.lineWidth = 0.15;
      ctx.stroke(path);
    } else if (a.surface === 'gravel') {
      ctx.fillStyle = 'rgba(80, 70, 55, 0.35)';
      const bb = shapeBounds(a);
      const n = Math.min(2500, (bb.x1 - bb.x0) * (bb.y1 - bb.y0) * 0.15);
      for (let i = 0; i < n; i++) {
        const x = bb.x0 + rand01(i, bb.x0, 5) * (bb.x1 - bb.x0), y = bb.y0 + rand01(i, bb.y0, 6) * (bb.y1 - bb.y0);
        ctx.fillRect(x, y, 0.25, 0.25);
      }
    }
  }

  drawRoad(ctx) {
    const t = this.track, th = t.theme;
    ctx.lineJoin = 'round';
    if (t.dynamic) {
      // širina se mijenja, pa se cesta crta u komadima
      const n = t.samples.length;
      const center = new Path2D();
      t.samples.forEach((s, i) => (i ? center.lineTo(s.x, s.y) : center.moveTo(s.x, s.y)));
      for (let i = 0; i < n - 1; i += 20) {
        const seg = new Path2D();
        for (let k = i; k <= Math.min(n - 1, i + 21); k++) {
          if (k === i) seg.moveTo(t.samples[k].x, t.samples[k].y);
          else seg.lineTo(t.samples[k].x, t.samples[k].y);
        }
        const w = t.samples[i].w;
        ctx.lineWidth = w + 2;
        ctx.strokeStyle = SURF_COLORS.curb;
        ctx.stroke(seg);
        ctx.setLineDash([2.5, 2.5]);
        ctx.strokeStyle = '#ecebe6';
        ctx.stroke(seg);
        ctx.setLineDash([]);
      }
      for (let i = 0; i < n - 1; i += 20) {
        const seg = new Path2D();
        for (let k = i; k <= Math.min(n - 1, i + 21); k++) {
          if (k === i) seg.moveTo(t.samples[k].x, t.samples[k].y);
          else seg.lineTo(t.samples[k].x, t.samples[k].y);
        }
        ctx.lineWidth = t.samples[i].w;
        ctx.strokeStyle = th.road;
        ctx.stroke(seg);
      }
      ctx.setLineDash([3, 6]);
      ctx.lineWidth = 0.15;
      ctx.strokeStyle = th.roadCenter;
      ctx.stroke(center);
      ctx.setLineDash([]);
      return;
    }
    if (t.curb) {
      ctx.lineWidth = t.width + 2;
      ctx.strokeStyle = SURF_COLORS.curb;
      ctx.stroke(this.road);
      ctx.setLineDash([2.5, 2.5]);
      ctx.strokeStyle = '#ecebe6';
      ctx.stroke(this.road);
      ctx.setLineDash([]);
    }
    ctx.lineWidth = t.width;
    ctx.strokeStyle = th.road || SURF_COLORS.asphalt;
    ctx.stroke(this.road);
    ctx.lineWidth = 0.15;
    ctx.strokeStyle = th.roadEdge;
    ctx.stroke(this.leftEdge);
    ctx.stroke(this.rightEdge);
    ctx.setLineDash([3, 6]);
    ctx.strokeStyle = th.roadCenter;
    ctx.stroke(this.road);
    ctx.setLineDash([]);
  }

  drawStart(ctx) {
    const t = this.track;
    if (t.mode === 'endless') {
      for (const g of t.gates || []) {
        const s = t.sample(g.idx);
        if (s) this.drawCheckered(ctx, s, s.w, g.passed ? 0.3 : 1);
      }
      return;
    }
    this.drawCheckered(ctx, t.samples[0], t.width || 8, t.width ? 1 : 0.8);
  }

  drawCheckered(ctx, s, width, alpha) {
    const nx = -s.ty, ny = s.tx;
    ctx.globalAlpha = alpha;
    for (let row = 0; row < 2; row++) {
      for (let k = 0; k < width; k++) {
        ctx.fillStyle = (k + row) % 2 ? '#111' : '#f4f4f0';
        const off = -width / 2 + k;
        const ax = s.x + nx * off + s.tx * (row - 1), ay = s.y + ny * off + s.ty * (row - 1);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + nx, ay + ny);
        ctx.lineTo(ax + nx + s.tx, ay + ny + s.ty);
        ctx.lineTo(ax + s.tx, ay + s.ty);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Strelice koje pokazuju smjer kruga na stazama bez ceste.
  drawGuide(ctx, v) {
    const s = this.track.samples;
    ctx.strokeStyle = this.track.theme.dark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    for (let i = 6; i < s.length; i += 12) {
      const p = s[i];
      if (p.x < v.x0 || p.x > v.x1 || p.y < v.y0 || p.y > v.y1) continue;
      const nx = -p.ty, ny = p.tx;
      ctx.moveTo(p.x - p.tx * 0.8 + nx * 1.2, p.y - p.ty * 0.8 + ny * 1.2);
      ctx.lineTo(p.x + p.tx * 0.4, p.y + p.ty * 0.4);
      ctx.lineTo(p.x - p.tx * 0.8 - nx * 1.2, p.y - p.ty * 0.8 - ny * 1.2);
    }
    ctx.stroke();
  }

  drawZone(ctx, z) {
    const path = shapePath(z);
    const strong = z.mult >= 3;
    ctx.fillStyle = strong ? 'rgba(255, 138, 31, 0.1)' : 'rgba(255, 220, 60, 0.07)';
    ctx.fill(path);
    ctx.strokeStyle = strong ? 'rgba(255, 138, 31, 0.6)' : 'rgba(255, 220, 60, 0.5)';
    ctx.lineWidth = 0.25;
    ctx.setLineDash([1.2, 1]);
    ctx.stroke(path);
    ctx.setLineDash([]);
    const bb = shapeBounds(z);
    label(ctx, z.label, (bb.x0 + bb.x1) / 2, bb.y1 - 1.6, 1.6, strong ? 'rgba(255, 160, 60, 0.75)' : 'rgba(255, 225, 90, 0.7)');
  }

  drawDecor(ctx, d) {
    switch (d.t) {
      case 'stalls': {
        ctx.strokeStyle = this.track.theme.floorLines || 'rgba(240, 240, 232, 0.7)';
        ctx.lineWidth = 0.12;
        ctx.beginPath();
        for (let x = d.x0; x <= d.x1 + 0.01; x += d.step) {
          if (d.skip && x > d.skip[0] && x < d.skip[1]) continue;
          ctx.moveTo(x, d.y0);
          ctx.lineTo(x, d.y1);
        }
        ctx.stroke();
        break;
      }
      case 'text':
        label(ctx, d.text, d.x, d.y, d.size, d.color, d.rot);
        break;
      case 'line':
        ctx.strokeStyle = d.color;
        ctx.lineWidth = d.width;
        if (d.dash) ctx.setLineDash(d.dash);
        ctx.beginPath();
        d.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
        ctx.setLineDash([]);
        break;
      case 'arrow': {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate((d.rot * Math.PI) / 180);
        ctx.fillStyle = d.color;
        const s = d.size;
        ctx.beginPath();
        ctx.moveTo(s, 0);
        ctx.lineTo(0, s * 0.6);
        ctx.lineTo(0, s * 0.25);
        ctx.lineTo(-s, s * 0.25);
        ctx.lineTo(-s, -s * 0.25);
        ctx.lineTo(0, -s * 0.25);
        ctx.lineTo(0, -s * 0.6);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'grate':
        ctx.fillStyle = '#25282c';
        ctx.fillRect(d.x - d.w / 2, d.y - d.h / 2, d.w, d.h);
        ctx.strokeStyle = '#5b6066';
        ctx.lineWidth = 0.05;
        ctx.beginPath();
        for (let x = d.x - d.w / 2 + 0.1; x < d.x + d.w / 2; x += 0.15) { ctx.moveTo(x, d.y - d.h / 2); ctx.lineTo(x, d.y + d.h / 2); }
        ctx.stroke();
        break;
      case 'hatch': {
        ctx.save();
        ctx.beginPath();
        ctx.rect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
        ctx.clip();
        ctx.fillStyle = '#e0b81f';
        ctx.fillRect(d.x0, d.y0, d.x1 - d.x0, d.y1 - d.y0);
        ctx.fillStyle = '#1d1d1f';
        const hh = d.y1 - d.y0;
        for (let x = d.x0 - hh; x < d.x1; x += 2) {
          ctx.beginPath();
          ctx.moveTo(x, d.y0);
          ctx.lineTo(x + 1, d.y0);
          ctx.lineTo(x + 1 + hh, d.y1);
          ctx.lineTo(x + hh, d.y1);
          ctx.fill();
        }
        ctx.restore();
        break;
      }
    }
  }

  drawHeadlights(ctx, car) {
    const L = car.spec.length;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.heading);
    ctx.fillStyle = 'rgba(255, 244, 200, 0.13)';
    ctx.beginPath();
    ctx.moveTo(L / 2, car.spec.width * 0.35);
    ctx.lineTo(L / 2 + 18, 6);
    ctx.lineTo(L / 2 + 18, -6);
    ctx.lineTo(L / 2, -car.spec.width * 0.35);
    ctx.fill();
    ctx.restore();
  }

  drawSmoke(ctx) {
    for (const p of this.particles) {
      const k = p.age / p.life;
      const size = p.size + k * (p.kind === 'dust' ? 2 : p.kind === 'spray' ? 1.5 : 3.2);
      ctx.fillStyle = p.kind === 'dust' ? `rgba(130, 110, 75, ${0.35 * (1 - k)})`
        : p.kind === 'spray' ? `rgba(200, 215, 230, ${0.25 * (1 - k)})`
          : p.rgb ? `rgba(${p.rgb}, ${0.42 * (1 - k)})` : `rgba(225, 225, 225, ${0.32 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawProps(ctx, v) {
    for (const p of this.track.props) {
      if (p.x < v.x0 || p.x > v.x1 || p.y < v.y0 || p.y > v.y1) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle || 0);
      if (p.kind === 'cart') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(-0.45, -0.32, 0.95, 0.62);
        ctx.fillStyle = '#b9c0c8';
        ctx.fillRect(-0.5, -0.3, 0.9, 0.6);
        ctx.strokeStyle = '#6d757e';
        ctx.lineWidth = 0.05;
        ctx.beginPath();
        for (let x = -0.4; x < 0.4; x += 0.15) { ctx.moveTo(x, -0.3); ctx.lineTo(x, 0.3); }
        ctx.stroke();
        ctx.fillStyle = '#d8312a';
        ctx.fillRect(0.4, -0.3, 0.12, 0.6);
      } else if (p.kind === 'cone') {
        ctx.fillStyle = p.hit ? '#c25a1c' : '#ff7a1a';
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 0.07;
        ctx.beginPath();
        ctx.arc(0, 0, p.r * 0.55, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'barrel') {
        ctx.fillStyle = '#2f5fa8';
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1d3d70';
        ctx.lineWidth = 0.08;
        ctx.beginPath();
        ctx.arc(0, 0, p.r * 0.7, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawObstacles(ctx, v) {
    const trees = [];
    for (const o of this.track.obstacles) {
      if (o.kind === 'tree') { trees.push(o); continue; }
      const bb = o.type === 'rect' ? o : { x0: o.x - o.r, x1: o.x + o.r, y0: o.y - o.r, y1: o.y + o.r };
      if (bb.x1 < v.x0 || bb.x0 > v.x1 || bb.y1 < v.y0 || bb.y0 > v.y1) continue;
      this.drawObstacle(ctx, o);
    }
    for (const t of trees) {
      if (t.x + t.crown < v.x0 || t.x - t.crown > v.x1 || t.y + t.crown < v.y0 || t.y - t.crown > v.y1) continue;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.beginPath();
      ctx.arc(t.x + 0.8, t.y - 0.8, t.crown, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = t.shade > 0.5 ? '#3c6a37' : '#356031';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.crown, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4b7f43';
      ctx.beginPath();
      ctx.arc(t.x - t.crown * 0.25, t.y + t.crown * 0.25, t.crown * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawObstacle(ctx, o) {
    const th = this.track.theme;
    const w = o.x1 - o.x0, h = o.y1 - o.y0;
    switch (o.kind) {
      case 'wall':
        ctx.fillStyle = th.wall || '#8d939a';
        ctx.fillRect(o.x0, o.y0, w, h);
        break;
      case 'building': drawBuilding(ctx, o); break;
      case 'pillar':
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(o.x0 + 0.15, o.y0 - 0.15, w, h);
        ctx.fillStyle = '#e0b81f';
        ctx.fillRect(o.x0, o.y0, w, h);
        ctx.fillStyle = '#a3a6aa';
        ctx.fillRect(o.x0 + 0.12, o.y0 + 0.12, w - 0.24, h - 0.24);
        break;
      case 'pillarRound':
      case 'rampCore':
      case 'monument': {
        const mon = o.kind === 'monument';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(o.x + 0.2, o.y - 0.2, o.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = mon ? '#cfc8b8' : '#e0b81f';
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = mon ? '#9c9483' : '#a3a6aa';
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r * (mon ? 0.55 : 0.82), 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'lamp':
        ctx.drawImage(this.glow, o.x - 6, o.y - 6, 12, 12);
        ctx.fillStyle = '#2a2c30';
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'truck': drawTruck(ctx, o); break;
      case 'container': {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(o.x0 + 0.3, o.y0 - 0.3, w, h);
        ctx.fillStyle = o.color;
        ctx.fillRect(o.x0, o.y0, w, h);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.lineWidth = 0.08;
        ctx.beginPath();
        const long = w > h;
        for (let k = 0.3; k < (long ? w : h); k += 0.4) {
          if (long) { ctx.moveTo(o.x0 + k, o.y0); ctx.lineTo(o.x0 + k, o.y1); } else { ctx.moveTo(o.x0, o.y0 + k); ctx.lineTo(o.x1, o.y0 + k); }
        }
        ctx.stroke();
        ctx.strokeRect(o.x0, o.y0, w, h);
        break;
      }
      case 'pallet':
        ctx.fillStyle = '#b08a55';
        ctx.fillRect(o.x0, o.y0, w, h);
        ctx.fillStyle = '#c9a26b';
        ctx.fillRect(o.x0 + 0.1, o.y0 + 0.1, w - 0.2, h - 0.2);
        ctx.strokeStyle = 'rgba(90, 60, 30, 0.6)';
        ctx.lineWidth = 0.05;
        ctx.strokeRect(o.x0 + 0.1, o.y0 + 0.1, w - 0.2, h - 0.2);
        ctx.beginPath();
        ctx.moveTo(o.x0 + 0.1, o.y0 + h / 2);
        ctx.lineTo(o.x1 - 0.1, o.y0 + h / 2);
        ctx.stroke();
        break;
      case 'barrelStatic':
        ctx.fillStyle = '#2f5fa8';
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'parkedCar':
        drawCarBody(ctx, { length: h, width: w, color: o.color, style: 'sedan', wear: 0 }, (o.x0 + o.x1) / 2, (o.y0 + o.y1) / 2, Math.PI / 2, 0, false, null);
        break;
      case 'shop': drawShop(ctx, o); break;
      case 'escalator': {
        ctx.fillStyle = '#1f2126';
        ctx.fillRect(o.x0, o.y0, w, h);
        ctx.fillStyle = '#4a4e57';
        ctx.fillRect(o.x0 + 0.4, o.y0 + 0.3, w - 0.8, h - 0.6);
        ctx.strokeStyle = '#2a2d33';
        ctx.lineWidth = 0.08;
        ctx.beginPath();
        for (let y = o.y0 + 0.5; y < o.y1 - 0.3; y += 0.4) { ctx.moveTo(o.x0 + 0.4, y); ctx.lineTo(o.x1 - 0.4, y); }
        ctx.stroke();
        ctx.fillStyle = '#111';
        ctx.fillRect(o.x0, o.y0, 0.3, h);
        ctx.fillRect(o.x1 - 0.3, o.y0, 0.3, h);
        break;
      }
      case 'fountain': {
        ctx.fillStyle = '#cfc8b8';
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3d8fc4';
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r - 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 0.12;
        for (let k = 0; k < 3; k++) {
          const rr = ((this.time * 0.8 + k / 3) % 1) * (o.r - 0.7);
          ctx.beginPath();
          ctx.arc(o.x, o.y, rr, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = '#e6e2d8';
        ctx.beginPath();
        ctx.arc(o.x, o.y, 0.7, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'planter':
        ctx.fillStyle = '#5a5248';
        ctx.fillRect(o.x0, o.y0, w, h);
        ctx.fillStyle = '#3f7a3a';
        ctx.beginPath();
        ctx.arc(o.x0 + w / 2, o.y0 + h / 2, w * 0.45, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'corral':
        ctx.strokeStyle = '#9aa1a8';
        ctx.lineWidth = 0.12;
        ctx.strokeRect(o.x0, o.y0, w, h);
        break;
      default:
        ctx.fillStyle = '#777';
        if (o.type === 'rect') ctx.fillRect(o.x0, o.y0, w, h);
        else { ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2); ctx.fill(); }
    }
  }
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${n >> 16}, ${(n >> 8) & 255}, ${n & 255}`;
}

function makeGlow() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255, 244, 205, 0.26)');
  grad.addColorStop(1, 'rgba(255, 244, 205, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return c;
}

function shapePath(a) {
  const p = new Path2D();
  if (a.shape === 'rect') p.rect(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0);
  else if (a.shape === 'circle') p.arc(a.x, a.y, a.r, 0, Math.PI * 2);
  else if (a.shape === 'ring') { p.arc(a.x, a.y, a.r1, 0, Math.PI * 2); p.moveTo(a.x + a.r0, a.y); p.arc(a.x, a.y, a.r0, 0, Math.PI * 2, true); }
  else if (a.shape === 'poly') { a.pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); }
  return p;
}

function shapeBounds(a) {
  if (a.shape === 'rect') return a;
  if (a.shape === 'circle') return { x0: a.x - a.r, x1: a.x + a.r, y0: a.y - a.r, y1: a.y + a.r };
  if (a.shape === 'ring') return { x0: a.x - a.r1, x1: a.x + a.r1, y0: a.y - a.r1, y1: a.y + a.r1 };
  const xs = a.pts.map((p) => p[0]), ys = a.pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

function label(ctx, text, x, y, size, color, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, -1);
  if (rot) ctx.rotate((-rot * Math.PI) / 180);
  ctx.fillStyle = color;
  ctx.font = `800 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function drawBuilding(ctx, o) {
  const w = o.x1 - o.x0, h = o.y1 - o.y0;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.fillRect(o.x0 + 1.5, o.y0 - 1.5, w, h);
  ctx.fillStyle = o.plain ? '#c9c2b4' : '#d8d2c6';
  ctx.fillRect(o.x0, o.y0, w, h);
  ctx.strokeStyle = '#a19a8c';
  ctx.lineWidth = 0.6;
  ctx.strokeRect(o.x0 + 0.3, o.y0 + 0.3, w - 0.6, h - 0.6);
  // klima uređaji na krovu
  ctx.fillStyle = '#bcb5a8';
  const n = Math.floor((w * h) / 400);
  for (let i = 0; i < n; i++) {
    const ux = o.x0 + 3 + rand01(o.x0, i, 1) * (w - 9), uy = o.y0 + 3 + rand01(o.y0, i, 2) * (h - 7);
    ctx.fillRect(ux, uy, 4, 3);
  }
  if (o.glass) {
    const [gx, gy, gw, gh] = o.glass;
    ctx.fillStyle = '#9fb9cc';
    ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 0.2;
    for (let x = gx + 5; x < gx + gw; x += 5) {
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x, gy + gh);
      ctx.stroke();
    }
  }
  if (o.canopy) {
    ctx.fillStyle = '#9fb9cc';
    ctx.fillRect(...o.canopy);
  }
  if (o.docks) {
    for (const x of o.docks) {
      ctx.fillStyle = '#2c2f34';
      ctx.fillRect(x - 2, o.y0, 4, 0.8);
      ctx.fillStyle = '#e0b81f';
      ctx.fillRect(x - 2.4, o.y0, 0.4, 1.4);
      ctx.fillRect(x + 2, o.y0, 0.4, 1.4);
    }
  }
  const size = Math.min(o.plain ? 6 : 4.2, (w * 0.8) / (o.label.length * 0.62));
  label(ctx, o.label, (o.x0 + o.x1) / 2, o.y1 - Math.min(7, h * 0.3), size, '#5b554b');
}

function drawTruck(ctx, o) {
  const vertical = o.cab === 'down' || o.cab === 'up';
  const w = o.x1 - o.x0, h = o.y1 - o.y0;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.fillRect(o.x0 + 0.4, o.y0 - 0.4, w, h);
  ctx.fillStyle = o.color;
  ctx.fillRect(o.x0, o.y0, w, h);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.lineWidth = 0.08;
  ctx.beginPath();
  if (vertical) for (let y = o.y0 + 1; y < o.y1; y += 1) { ctx.moveTo(o.x0, y); ctx.lineTo(o.x1, y); }
  else for (let x = o.x0 + 1; x < o.x1; x += 1) { ctx.moveTo(x, o.y0); ctx.lineTo(x, o.y1); }
  ctx.stroke();
  // kabina
  const cab = 2.3;
  let c;
  if (o.cab === 'down') c = [o.x0, o.y0, w, cab];
  else if (o.cab === 'up') c = [o.x0, o.y1 - cab, w, cab];
  else if (o.cab === 'left') c = [o.x0, o.y0, cab, h];
  else c = [o.x1 - cab, o.y0, cab, h];
  ctx.fillStyle = '#d9d9d6';
  ctx.fillRect(...c);
  ctx.fillStyle = '#25313d';
  if (o.cab === 'down') ctx.fillRect(c[0] + 0.2, c[1] + 0.2, c[2] - 0.4, 0.5);
  else if (o.cab === 'up') ctx.fillRect(c[0] + 0.2, c[1] + c[3] - 0.7, c[2] - 0.4, 0.5);
  else if (o.cab === 'left') ctx.fillRect(c[0] + 0.2, c[1] + 0.2, 0.5, c[3] - 0.4);
  else ctx.fillRect(c[0] + c[2] - 0.7, c[1] + 0.2, 0.5, c[3] - 0.4);
}

function drawShop(ctx, o) {
  const w = o.x1 - o.x0, h = o.y1 - o.y0;
  ctx.fillStyle = '#24262c';
  ctx.fillRect(o.x0, o.y0, w, h);
  ctx.strokeStyle = '#3a3d45';
  ctx.lineWidth = 0.2;
  ctx.strokeRect(o.x0 + 0.1, o.y0 + 0.1, w - 0.2, h - 0.2);
  // izlog prema hodniku
  ctx.fillStyle = 'rgba(120, 170, 220, 0.35)';
  const d = 0.8;
  let lx, ly, rot = 0;
  if (o.front === 'up') { ctx.fillRect(o.x0 + 0.6, o.y1 - d, w - 1.2, d); lx = (o.x0 + o.x1) / 2; ly = o.y1 - 2.2; }
  else if (o.front === 'down') { ctx.fillRect(o.x0 + 0.6, o.y0, w - 1.2, d); lx = (o.x0 + o.x1) / 2; ly = o.y0 + 2.2; }
  else if (o.front === 'right') { ctx.fillRect(o.x1 - d, o.y0 + 0.6, d, h - 1.2); lx = o.x1 - 2.2; ly = (o.y0 + o.y1) / 2; rot = 90; }
  else { ctx.fillRect(o.x0, o.y0 + 0.6, d, h - 1.2); lx = o.x0 + 2.2; ly = (o.y0 + o.y1) / 2; rot = -90; }
  const len = rot ? h : w;
  const size = Math.min(2.4, (len * 0.85) / (o.label.length * 0.62));
  ctx.save();
  ctx.shadowColor = o.sign;
  ctx.shadowBlur = 8;
  label(ctx, o.label, lx, ly, size, o.sign, rot);
  ctx.restore();
}

// Karoserija po tipu (limuzina, hatchback, karavan, kupe, roadster, SUV, kombi). Koristi se i za parkirane aute.
export function drawCarBody(ctx, s, x, y, heading, steer, braking, wheelOffset) {
  const L = s.length, W = s.width;
  const style = s.style || 'sedan';
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  roundRect(ctx, -L / 2 + 0.2, -W / 2 - 0.25, L, W, 0.5);
  ctx.fill();

  if (wheelOffset) {
    ctx.fillStyle = '#16171a';
    for (let i = 0; i < 4; i++) {
      const [ox, oy] = wheelOffset(i);
      ctx.save();
      ctx.translate(ox, oy + Math.sign(oy) * 0.07);
      if (i < 2) ctx.rotate(steer);
      ctx.fillRect(-0.33, -0.12, 0.66, 0.24);
      ctx.restore();
    }
  }

  const radius = style === 'boxy' || style === 'wagonBoxy' ? 0.18 : style === 'coupe911' ? 0.8 : style === 'van' ? 0.6 : 0.45;
  ctx.fillStyle = s.color;
  roundRect(ctx, -L / 2, -W / 2, L, W, radius);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = 0.05;
  ctx.stroke();

  // kabina i stakla po tipu karoserije: [stražnji kraj krova, prednji kraj krova]
  const roofs = {
    sedan: [-0.3, 0.2], boxy: [-0.3, 0.2], hatch: [-0.42, 0.18], wagon: [-0.46, 0.18], wagonBoxy: [-0.46, 0.18],
    coupe: [-0.22, 0.14], coupe911: [-0.26, 0.1], suv: [-0.42, 0.22], van: [-0.42, 0.34], roadster: [-0.22, 0.05],
  };
  const [r0, r1] = roofs[style] || roofs.sedan;
  if (style === 'roadster') {
    ctx.fillStyle = '#1e1f22';
    roundRect(ctx, L * -0.22, -W * 0.36, L * 0.3, W * 0.72, 0.3);
    ctx.fill();
    ctx.fillStyle = '#3a3b40';
    ctx.fillRect(L * -0.16, -W * 0.3, L * 0.12, W * 0.24);
    ctx.fillRect(L * -0.16, W * 0.06, L * 0.12, W * 0.24);
    ctx.fillStyle = '#25313d';
    ctx.fillRect(L * 0.08, -W * 0.38, L * 0.04, W * 0.76);
  } else {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    roundRect(ctx, L * r0, -W * 0.42, L * (r1 - r0), W * 0.84, 0.3);
    ctx.fill();
    ctx.fillStyle = '#25313d';
    const ws = style === 'van' ? 0.16 : 0.12;
    ctx.beginPath();
    ctx.moveTo(L * r1, -W * 0.4);
    ctx.lineTo(L * r1, W * 0.4);
    ctx.lineTo(L * (r1 - ws), W * 0.36);
    ctx.lineTo(L * (r1 - ws), -W * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(L * r0, -W * 0.38);
    ctx.lineTo(L * r0, W * 0.38);
    ctx.lineTo(L * (r0 + 0.07), W * 0.34);
    ctx.lineTo(L * (r0 + 0.07), -W * 0.34);
    ctx.closePath();
    ctx.fill();
    if (style === 'van') {
      // Multipla: "stepenica" ispod vjetrobrana
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.fillRect(L * 0.34, -W * 0.45, L * 0.05, W * 0.9);
      ctx.fillStyle = '#25313d';
      ctx.fillRect(L * 0.39, -W * 0.3, L * 0.04, W * 0.6);
    }
    if (style === 'wagon' || style === 'wagonBoxy' || style === 'suv') {
      ctx.strokeStyle = 'rgba(30, 30, 30, 0.55)';
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.moveTo(L * (r0 + 0.08), -W * 0.32);
      ctx.lineTo(L * (r1 - 0.14), -W * 0.32);
      ctx.moveTo(L * (r0 + 0.08), W * 0.32);
      ctx.lineTo(L * (r1 - 0.14), W * 0.32);
      ctx.stroke();
    }
    if (style === 'suv') {
      ctx.strokeStyle = 'rgba(20, 20, 20, 0.7)';
      ctx.lineWidth = 0.12;
      roundRect(ctx, -L / 2 + 0.05, -W / 2 + 0.05, L - 0.1, W - 0.1, radius);
      ctx.stroke();
    }
  }

  // istrošenost: hrđa, ogrebotine i vrata druge boje
  if (s.wear > 0) {
    ctx.fillStyle = `rgba(122, 70, 34, ${0.55 * s.wear})`;
    for (let i = 0; i < Math.round(8 * s.wear); i++) {
      const rx = (rand01(i, L, 1) - 0.5) * L * 0.9, ry = (rand01(i, W, 2) - 0.5) * W * 0.9;
      ctx.beginPath();
      ctx.arc(rx, ry, 0.08 + rand01(i, 3, 3) * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
    if (s.wear > 0.6) {
      ctx.fillStyle = 'rgba(160, 165, 150, 0.55)';
      ctx.fillRect(-L * 0.05, W / 2 - 0.12, L * 0.24, 0.12);
    }
    ctx.strokeStyle = `rgba(230, 230, 230, ${0.4 * s.wear})`;
    ctx.lineWidth = 0.03;
    ctx.beginPath();
    ctx.moveTo(-L * 0.3, -W * 0.45);
    ctx.lineTo(L * 0.1, -W * 0.4);
    ctx.stroke();
  }

  // aero: prednja usna, spojler, veliko krilo
  if (s.aero >= 1) {
    ctx.fillStyle = '#1b1c1f';
    ctx.fillRect(L / 2 - 0.06, -W * 0.44, 0.1, W * 0.88);
  }
  if (s.aero >= 2) {
    const big = s.aero >= 3;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(-L / 2 + 0.12, -W * 0.5, big ? 0.42 : 0.24, W);
    ctx.fillStyle = big ? '#1b1c1f' : s.color;
    ctx.fillRect(-L / 2 + 0.08, -W * (big ? 0.52 : 0.44), big ? 0.38 : 0.22, W * (big ? 1.04 : 0.88));
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.lineWidth = 0.04;
    ctx.strokeRect(-L / 2 + 0.08, -W * (big ? 0.52 : 0.44), big ? 0.38 : 0.22, W * (big ? 1.04 : 0.88));
  }

  ctx.fillStyle = '#f6f1d8';
  ctx.fillRect(L / 2 - 0.12, W / 2 - 0.45, 0.1, 0.32);
  ctx.fillRect(L / 2 - 0.12, -W / 2 + 0.13, 0.1, 0.32);
  ctx.fillStyle = braking ? '#ff2a2a' : '#7a1515';
  ctx.fillRect(-L / 2 + 0.02, W / 2 - 0.42, 0.1, 0.3);
  ctx.fillRect(-L / 2 + 0.02, -W / 2 + 0.12, 0.1, 0.3);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function offsetPath(samples, d) {
  const p = new Path2D();
  samples.forEach((s, i) => {
    const x = s.x - s.ty * d, y = s.y + s.tx * d;
    if (i) p.lineTo(x, y);
    else p.moveTo(x, y);
  });
  p.closePath();
  return p;
}

// Nekoliko tamnijih mrlja trave da tlo ne bude jednolično.
function grassPatches(b) {
  const p = new Path2D();
  let seed = 42;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const n = Math.min(600, ((b.maxX - b.minX) * (b.maxY - b.minY)) / 500);
  for (let i = 0; i < n; i++) {
    const x = b.minX + rand() * (b.maxX - b.minX);
    const y = b.minY + rand() * (b.maxY - b.minY);
    const r = 3 + rand() * 9;
    p.moveTo(x + r, y);
    p.ellipse(x, y, r, r * (0.5 + rand() * 0.5), rand() * Math.PI, 0, Math.PI * 2);
  }
  return p;
}
