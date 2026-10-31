// Katalog auta. Motor, masa i dimenzije su po uzoru na prave aute (snaga je u igri pojačana za 30%),
// a ponašanje u vožnji (blok handling) slaže se iz predloška za pogon i klasu.
// Klase: D krševi, C drift starteri, B ozbiljni, A zvijeri, S potpisni auti likova (ne prodaju se).

export const CLASSES = {
  D: { name: 'Klasa D', sub: 'Krševi', color: '#8d8a80' },
  C: { name: 'Klasa C', sub: 'Drift starteri', color: '#3f9b5a' },
  B: { name: 'Klasa B', sub: 'Ozbiljni', color: '#2f78c4' },
  A: { name: 'Klasa A', sub: 'Zvijeri', color: '#c8452e' },
  S: { name: 'Potpisni', sub: 'Auti kolega', color: '#b47be0' },
};

// Ponašanje podešeno vožnjom (E30, Golf 4, STI). Klasa dodaje prianjanje, kočnice i vuču.
export const HANDLING = {
  RWD: {
    grip: 24, driftGrip: 11, driftSteer: 8.5, throttleSlide: 3, handbrakeGrip: 2.5,
    turnRate: 2.4, angleResponse: 2.5, flick: 0.3, entryKick: 0.7, entrySpeed: 9,
    maxAngle: 62, speedKeep: 0.6, traction: 10, brake: 11, handbrakeBrake: 3, engineBrake: 1.2,
  },
  FWD: {
    grip: 25, driftGrip: 12, driftSteer: 7.5, throttleSlide: 1.5, handbrakeGrip: 2.5,
    turnRate: 2.5, angleResponse: 2.5, flick: 0.3, entryKick: 0.9, entrySpeed: 9,
    maxAngle: 50, speedKeep: 0.55, traction: 9, brake: 11, handbrakeBrake: 3, engineBrake: 1.2,
  },
  AWD: {
    grip: 26, driftGrip: 13, driftSteer: 8.5, throttleSlide: 2.5, handbrakeGrip: 3,
    turnRate: 2.4, angleResponse: 2.5, flick: 0.3, entryKick: 0.7, entrySpeed: 9,
    maxAngle: 55, speedKeep: 0.65, traction: 13, brake: 12, handbrakeBrake: 3, engineBrake: 1.3,
  },
};
export const CLASS_MOD = {
  D: { grip: -2, brake: -1.5, traction: -1 },
  C: { grip: 0, brake: 0, traction: 0 },
  B: { grip: 1.5, brake: 1, traction: 1 },
  A: { grip: 3, brake: 2, traction: 2 },
  S: { grip: 0, brake: 0, traction: 0 },
};

const RPM_TO_RAD = (2 * Math.PI) / 60;

// Krivulja momenta iz najvećeg momenta i snage; vrh snage pada blizu crvenog polja.
function torqueCurve(kw, nm, redline) {
  const atRedline = Math.min(nm * 0.95, (kw * 1000) / (redline * RPM_TO_RAD));
  return [
    [800, nm * 0.55],
    [Math.round(redline * 0.35), nm * 0.85],
    [Math.round(redline * 0.55), nm],
    [Math.round(redline * 0.72), nm * 0.97],
    [redline, atRedline],
    [redline + 500, atRedline * 0.85],
  ].map(([r, t]) => [r, Math.round(t)]);
}

// Omjeri tako da najviša brzina u zadnjoj brzini pada na crveno polje, a prva vuče do ~28% vmax.
function gearbox(n, topKmh, redline, wheelRadius) {
  const finalDrive = 3.7;
  const wRed = redline * RPM_TO_RAD;
  const vTop = topKmh / 3.6;
  const top = (wRed * wheelRadius) / vTop / finalDrive;
  const first = (wRed * wheelRadius) / (vTop * 0.28) / finalDrive;
  const gears = [];
  for (let i = 0; i < n; i++) gears.push(+(first * (top / first) ** (i / (n - 1))).toFixed(3));
  return { gears, finalDrive, reverse: +(first * 0.95).toFixed(2) };
}

// Ponašanje auta: predložak za pogon, dodatak za klasu i posebnosti auta.
export function makeHandling(cls, drivetrain, overrides) {
  const hand = { ...HANDLING[drivetrain] };
  const mod = CLASS_MOD[cls];
  hand.grip += mod.grip;
  hand.brake += mod.brake;
  hand.traction += mod.traction;
  return Object.assign(hand, overrides);
}

function car(id, name, cls, drivetrain, o) {
  const wheelRadius = o.wheelRadius ?? (cls === 'A' ? 0.34 : cls === 'D' ? 0.28 : 0.31);
  const redline = o.rpm;
  const hand = makeHandling(cls, drivetrain, o.handling);
  return {
    id, name, cls, drivetrain,
    price: o.price ?? 0,
    color: o.color,
    style: o.style ?? 'sedan',
    wear: o.wear ?? 0,
    desc: o.desc ?? '',
    kw: o.kw,
    mass: o.mass,
    inertia: Math.round((o.mass * (o.len ** 2 + o.wid ** 2)) / 12 * 0.9),
    wheelbase: o.wb, trackWidth: +(o.wid - 0.22).toFixed(2),
    length: o.len, width: o.wid,
    wheelRadius,
    engine: {
      idle: o.idle ?? 850,
      launchRpm: drivetrain === 'AWD' ? Math.min(3500, redline * 0.5) : Math.min(2600, redline * 0.42),
      redline, limiter: redline + 200, powerMul: o.powerMul ?? 1.3,
      torque: torqueCurve(o.kw, o.nm, redline),
    },
    ...gearbox(o.gears, o.top, redline, wheelRadius),
    shiftTime: o.shiftTime ?? 0.2, efficiency: 0.85,
    maxSteer: 0.62, steerSpeed: 3.5,
    cdA: o.cdA ?? (o.style === 'suv' ? 0.95 : o.style === 'van' ? 0.85 : 0.68),
    handling: hand,
    handlingOverrides: o.handling || {},
  };
}

export const CARS = [
  // Klasa D: krševi
  car('yugo45', 'Yugo 45', 'D', 'FWD', { kw: 33, nm: 72, rpm: 6000, mass: 830, len: 3.49, wid: 1.55, wb: 2.15, gears: 4, top: 140, style: 'hatch', color: '#e8e2cf', price: 2000, desc: 'Legenda. Kutija s kotačima.' }),
  car('z101', 'Zastava 101', 'D', 'FWD', { kw: 40, nm: 80, rpm: 6000, mass: 850, len: 3.83, wid: 1.59, wb: 2.45, gears: 4, top: 145, style: 'hatch', color: '#7a9cc0', price: 2500, desc: 'Stojadin. Vozi, ne pita.' }),
  car('lada2107', 'Lada 2107', 'D', 'RWD', { kw: 57, nm: 116, rpm: 5600, mass: 1030, len: 4.13, wid: 1.62, wb: 2.42, gears: 5, top: 150, style: 'boxy', color: '#8a1f1f', price: 3500, desc: 'Stražnji pogon za sitne pare.' }),
  car('kadett', 'Opel Kadett E', 'D', 'FWD', { kw: 55, nm: 120, rpm: 5800, mass: 950, len: 4.0, wid: 1.66, wb: 2.52, gears: 5, top: 170, style: 'hatch', color: '#d8d4c8', price: 4000 }),
  car('golf2', 'VW Golf 2', 'D', 'FWD', { kw: 55, nm: 125, rpm: 5800, mass: 900, len: 3.98, wid: 1.67, wb: 2.47, gears: 5, top: 170, style: 'hatch', color: '#2f5d3a', price: 4500 }),
  car('punto', 'Fiat Punto', 'D', 'FWD', { kw: 59, nm: 114, rpm: 6000, mass: 960, len: 3.8, wid: 1.66, wb: 2.46, gears: 5, top: 175, style: 'hatch', color: '#f2c230', price: 6000 }),
  car('clio2', 'Renault Clio 2', 'D', 'FWD', { kw: 72, nm: 127, rpm: 6200, mass: 980, len: 3.77, wid: 1.64, wb: 2.47, gears: 5, top: 185, style: 'hatch', color: '#3a6fb0', price: 8000 }),

  // Klasa C: drift starteri
  car('volvo240', 'Volvo 240', 'C', 'RWD', { kw: 85, nm: 185, rpm: 5600, mass: 1300, len: 4.79, wid: 1.71, wb: 2.64, gears: 4, top: 180, style: 'wagonBoxy', color: '#5a6e3a', price: 10000, desc: 'Cigla koja drifta.' }),
  car('mx5na', 'Mazda MX-5 NA', 'C', 'RWD', { kw: 85, nm: 136, rpm: 7000, mass: 960, len: 3.97, wid: 1.68, wb: 2.27, gears: 5, top: 195, style: 'roadster', color: '#c41e1e', price: 12000, handling: { maxAngle: 65 } }),
  car('civiceg', 'Honda Civic EG', 'C', 'FWD', { kw: 118, nm: 150, rpm: 8000, mass: 1050, len: 4.07, wid: 1.69, wb: 2.57, gears: 5, top: 215, style: 'hatch', color: '#2b4ea2', price: 14000, desc: 'VTEC je upravo upalio.' }),
  car('merc190e', 'Mercedes 190E', 'C', 'RWD', { kw: 100, nm: 205, rpm: 6000, mass: 1180, len: 4.43, wid: 1.68, wb: 2.66, gears: 5, top: 205, style: 'sedan', color: '#1c2a3a', price: 15000 }),
  car('golf4', 'VW Golf GTI Mk4', 'C', 'FWD', { kw: 110, nm: 210, rpm: 6300, mass: 1290, len: 4.15, wid: 1.73, wb: 2.51, gears: 5, top: 220, style: 'hatch', color: '#b9bec5', price: 16000 }),
  car('e30', 'BMW E30 325i', 'C', 'RWD', { kw: 125, nm: 222, rpm: 6500, mass: 1220, len: 4.33, wid: 1.65, wb: 2.57, gears: 5, top: 220, style: 'sedan', color: '#c8102e', price: 18000 }),
  car('ae86', 'Toyota AE86', 'C', 'RWD', { kw: 96, nm: 149, rpm: 7600, mass: 950, len: 4.2, wid: 1.63, wb: 2.4, gears: 5, top: 200, style: 'hatch', color: '#f4f4f0', price: 22000, desc: 'Dostava tofua.', handling: { maxAngle: 66 } }),
  car('s13', 'Nissan 200SX S13', 'C', 'RWD', { kw: 125, nm: 228, rpm: 6800, mass: 1200, len: 4.52, wid: 1.69, wb: 2.47, gears: 5, top: 225, style: 'coupe', color: '#d9d9d9', price: 25000, handling: { maxAngle: 66 } }),

  // Klasa B: ozbiljni
  car('s4b5', 'Audi S4 B5', 'B', 'AWD', { kw: 195, nm: 400, rpm: 6800, mass: 1620, len: 4.48, wid: 1.73, wb: 2.61, gears: 6, top: 250, style: 'sedan', color: '#4a4f57', price: 45000 }),
  car('z350', 'Nissan 350Z', 'B', 'RWD', { kw: 206, nm: 363, rpm: 6600, mass: 1440, len: 4.31, wid: 1.82, wb: 2.65, gears: 6, top: 250, style: 'coupe', color: '#8a8f98', price: 50000 }),
  car('s15', 'Nissan Silvia S15', 'B', 'RWD', { kw: 184, nm: 275, rpm: 7200, mass: 1240, len: 4.45, wid: 1.7, wb: 2.53, gears: 6, top: 245, style: 'coupe', color: '#e9b100', price: 60000, handling: { maxAngle: 68 } }),
  car('e46m3', 'BMW E46 M3', 'B', 'RWD', { kw: 252, nm: 365, rpm: 7900, mass: 1495, len: 4.49, wid: 1.78, wb: 2.73, gears: 6, top: 250, style: 'coupe', color: '#2e6b9e', price: 70000 }),
  car('sti', 'Subaru Impreza WRX STI', 'B', 'AWD', { kw: 195, nm: 343, rpm: 7000, mass: 1440, len: 4.42, wid: 1.74, wb: 2.525, gears: 6, top: 250, style: 'sedan', color: '#1846a8', price: 75000 }),
  car('evo6', 'Mitsubishi Lancer Evo VI', 'B', 'AWD', { kw: 206, nm: 373, rpm: 7000, mass: 1360, len: 4.35, wid: 1.77, wb: 2.51, gears: 5, top: 245, style: 'sedan', color: '#e6e6e6', price: 80000 }),
  car('rx7fd', 'Mazda RX-7 FD', 'B', 'RWD', { kw: 206, nm: 294, rpm: 8000, mass: 1280, len: 4.29, wid: 1.76, wb: 2.43, gears: 5, top: 255, style: 'coupe', color: '#b5121b', price: 85000, handling: { maxAngle: 66 } }),
  car('supra4', 'Toyota Supra MK4', 'B', 'RWD', { kw: 239, nm: 451, rpm: 6800, mass: 1490, len: 4.52, wid: 1.81, wb: 2.55, gears: 6, top: 260, style: 'coupe', color: '#e86a10', price: 95000 }),

  // Klasa A: zvijeri
  car('mustang', 'Ford Mustang GT', 'A', 'RWD', { kw: 336, nm: 556, rpm: 7500, mass: 1750, len: 4.79, wid: 1.92, wb: 2.72, gears: 6, top: 270, style: 'coupe', color: '#1d3f8f', price: 160000 }),
  car('c63', 'Mercedes C63 AMG', 'A', 'RWD', { kw: 336, nm: 600, rpm: 7200, mass: 1730, len: 4.73, wid: 1.8, wb: 2.76, gears: 7, top: 280, style: 'sedan', color: '#202225', price: 180000 }),
  car('grsupra', 'Toyota GR Supra', 'A', 'RWD', { kw: 285, nm: 500, rpm: 7000, mass: 1540, len: 4.38, wid: 1.85, wb: 2.47, gears: 8, top: 265, style: 'coupe', color: '#d22f27', price: 200000 }),
  car('r34', 'Nissan Skyline R34 GT-R', 'A', 'AWD', { kw: 280, nm: 392, rpm: 7500, mass: 1560, len: 4.6, wid: 1.79, wb: 2.67, gears: 6, top: 270, style: 'coupe', color: '#2a5db0', price: 220000 }),
  car('m4', 'BMW M4', 'A', 'RWD', { kw: 375, nm: 650, rpm: 7200, mass: 1725, len: 4.79, wid: 1.89, wb: 2.86, gears: 8, top: 290, style: 'coupe', color: '#2e7d5b', price: 250000 }),
  car('p911', 'Porsche 911', 'A', 'RWD', { kw: 331, nm: 530, rpm: 7500, mass: 1515, len: 4.52, wid: 1.85, wb: 2.45, gears: 7, top: 305, style: 'coupe911', color: '#f0c000', price: 300000 }),
  car('rs6', 'Audi RS6 Avant', 'A', 'AWD', { kw: 441, nm: 800, rpm: 6800, mass: 2075, len: 5.0, wid: 1.95, wb: 2.93, gears: 8, top: 305, style: 'wagon', color: '#7d8288', price: 350000 }),
  car('r35', 'Nissan GT-R R35', 'A', 'AWD', { kw: 419, nm: 632, rpm: 7100, mass: 1750, len: 4.71, wid: 1.9, wb: 2.78, gears: 6, top: 315, style: 'coupe', color: '#d0d3d8', price: 400000 }),

  // Potpisni auti kolega (dolaze s likom)
  car('cruze', 'Chevrolet Cruze', 'S', 'FWD', { kw: 91, nm: 155, rpm: 6200, mass: 1310, len: 4.6, wid: 1.79, wb: 2.69, gears: 5, top: 190, style: 'sedan', color: '#f2f2ef' }),
  car('p208', 'Peugeot 208', 'S', 'FWD', { kw: 60, nm: 118, rpm: 6000, mass: 1050, len: 3.96, wid: 1.74, wb: 2.54, gears: 5, top: 170, style: 'hatch', color: '#9a9ea3', wear: 0.85, desc: 'Star ko Isusova šlapa.' }),
  car('mazda3', 'Mazda 3', 'S', 'FWD', { kw: 77, nm: 145, rpm: 6000, mass: 1250, len: 4.42, wid: 1.76, wb: 2.64, gears: 5, top: 185, style: 'hatch', color: '#2c5aa0', wear: 0.7, desc: 'Raspada se, ali ide.' }),
  car('octavia', 'Škoda Octavia karavan', 'S', 'FWD', { kw: 110, nm: 250, rpm: 5000, mass: 1430, len: 4.66, wid: 1.81, wb: 2.68, gears: 6, top: 215, style: 'wagon', color: '#2f4f86', idle: 800 }),
  car('multipla', 'Fiat Multipla', 'S', 'FWD', { kw: 76, nm: 145, rpm: 6000, mass: 1300, len: 4.0, wid: 1.87, wb: 2.67, gears: 5, top: 170, style: 'van', color: '#f29bc1', desc: 'Najljepši auto na svijetu.' }),
  car('a4', 'Audi A4', 'S', 'FWD', { kw: 150, nm: 320, rpm: 6200, mass: 1480, len: 4.76, wid: 1.84, wb: 2.82, gears: 7, top: 240, style: 'sedan', color: '#9aa0a6' }),
  car('corsa', 'Opel Corsa', 'S', 'FWD', { kw: 55, nm: 120, rpm: 6000, mass: 1000, len: 3.82, wid: 1.65, wb: 2.49, gears: 5, top: 170, style: 'hatch', color: '#3566b0', wear: 0.4 }),
  car('jaguar', 'Jaguar XF', 'S', 'RWD', { kw: 250, nm: 450, rpm: 6500, mass: 1800, len: 4.96, wid: 1.88, wb: 2.96, gears: 8, top: 250, style: 'sedan', color: '#111214' }),
  car('e36', 'BMW E36', 'S', 'RWD', { kw: 141, nm: 280, rpm: 6500, mass: 1320, len: 4.43, wid: 1.7, wb: 2.7, gears: 5, top: 230, style: 'sedan', color: '#b3161c', wear: 0.3 }),
  car('twingors', 'Renault Twingo RS', 'S', 'FWD', { kw: 98, nm: 160, rpm: 6800, mass: 1050, len: 3.61, wid: 1.69, wb: 2.37, gears: 5, top: 200, style: 'hatch', color: '#f5c400' }),
  car('meganers', 'Renault Megane RS', 'S', 'FWD', { kw: 205, nm: 360, rpm: 6500, mass: 1400, len: 4.3, wid: 1.85, wb: 2.64, gears: 6, top: 255, style: 'hatch', color: '#f4f4f2' }),
  car('vitara', 'Suzuki Vitara', 'S', 'AWD', { kw: 103, nm: 220, rpm: 5800, mass: 1250, len: 4.18, wid: 1.78, wb: 2.5, gears: 6, top: 210, style: 'suv', color: '#141516', powerMul: 1.9, desc: 'Opasna. Nemoj se zezat s njom.' }),
];

export function carById(id) {
  return CARS.find((c) => c.id === id);
}

export function cloneSpec(spec) {
  return structuredClone(spec);
}
