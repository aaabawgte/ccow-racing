// Nadogradnje (kupuju se u stupnjevima ulični / sportski / trkaći), besplatno podešavanje koje dijelovi
// otključavaju, indeks performansi (PI) s klasom te boje auta i dima.
import { makeHandling } from './cars.js';

export const STAGES = ['Ulični', 'Sportski', 'Trkaći'];

// Svaka kategorija: nazivi dijelova po stupnju i učinak na spec (stage = 1..3).
export const UPGRADES = [
  {
    id: 'engine', name: 'Motor', parts: ['Usis i ispuh', 'Remap i bregaste', 'Turbo i intercooler'],
    apply: (s, n) => { s.engine.powerMul *= [1, 1.1, 1.22, 1.4][n]; },
  },
  {
    id: 'gearbox', name: 'Mjenjač', parts: ['Kraći omjeri', 'Lakši zamašnjak i kvačilo', 'Sekvencijalni'],
    apply: (s, n) => { s.shiftTime *= [1, 0.8, 0.6, 0.3][n]; },
  },
  {
    id: 'diff', name: 'Diferencijal', parts: ['LSD 1-way', 'LSD 2-way', 'Zavareni'],
    apply: (s, n) => {
      const h = s.handling;
      h.throttleSlide += [0, 0.8, 1.5, 2.5][n];
      h.driftSteer += [0, 0.5, 1, 1.5][n];
      if (n === 3) { h.entryKick += 0.2; h.grip -= 1; }
    },
  },
  {
    id: 'suspension', name: 'Ovjes', parts: ['Coilover', 'Stabilizatori i čahure', 'Angle kit'],
    apply: (s, n) => {
      const h = s.handling;
      h.grip += [0, 1, 2, 2.5][n];
      h.angleResponse += [0, 0.3, 0.6, 0.8][n];
      h.maxAngle += [0, 2, 4, 12][n];
      if (n === 3) s.maxSteer += 0.1;
    },
  },
  {
    id: 'brakes', name: 'Kočnice', parts: ['Sportski diskovi', 'Hidraulična ručna', 'Trkaće čeljusti'],
    apply: (s, n) => {
      const h = s.handling;
      h.brake += [0, 1, 1.5, 3][n];
      if (n >= 2) h.handbrakeGrip -= 0.5;
    },
  },
  {
    id: 'tires', name: 'Gume', parts: ['Sportska smjesa', 'Šire gume', 'Semi-slick'],
    apply: (s, n) => {
      const h = s.handling;
      h.grip += [0, 1.5, 2.5, 4][n];
      h.driftGrip += [0, 1, 1.5, 3][n];
      h.traction += [0, 0.5, 1, 2][n];
    },
  },
  {
    id: 'weight', name: 'Težina', parts: ['Bez stražnjih sjedala', 'Karbonski poklopci', 'Kavez i školjke'],
    apply: (s, n) => {
      const k = [1, 0.95, 0.9, 0.85][n];
      s.mass = Math.round(s.mass * k);
      s.inertia = Math.round(s.inertia * k);
    },
  },
  {
    id: 'aero', name: 'Aero', parts: ['Prednja usna', 'Spojler', 'Difuzor i krilo'],
    apply: (s, n) => {
      s.handling.grip += [0, 0.5, 1.2, 2][n];
      s.cdA *= [1, 1.01, 1.03, 1.05][n];
      s.aero = n;
    },
  },
];

const STAGE_COST = [0.05, 0.1, 0.15];
const SWAP_COST = 0.4;
const MIN_COST = 300;

// Potpisni auti nemaju cijenu, pa se nadogradnje računaju od zamišljene vrijednosti.
export function carValue(spec) {
  return spec.price || 15000;
}

export function upgradeCost(spec, stage) {
  return Math.max(MIN_COST, Math.round((carValue(spec) * STAGE_COST[stage - 1]) / 50) * 50);
}

export function swapCost(spec) {
  return Math.max(1000, Math.round((carValue(spec) * SWAP_COST) / 100) * 100);
}

// Podešavanje: raspon ovisi o dijelovima. Svaki klizač vraća { min, max } ili null ako je zaključan.
export const TUNING = [
  {
    id: 'finalDrive', name: 'Završni prijenos', unit: '', step: 0.05, needs: 'gearbox',
    base: (s) => s.finalDrive,
    range: (s, up) => (up.gearbox ? { min: s.finalDrive - [0, 0.3, 0.5, 0.8][up.gearbox], max: s.finalDrive + [0, 0.3, 0.5, 0.8][up.gearbox] } : null),
    apply: (s, v) => { s.finalDrive = v; },
    hint: 'Kraći = brže ubrzanje, duži = veća najveća brzina.',
  },
  {
    id: 'boost', name: 'Tlak turba', unit: '%', step: 5, needs: 'engine',
    base: () => 100,
    range: (s, up) => (up.engine >= 3 ? { min: 70, max: 110 } : null),
    apply: (s, v) => { s.engine.powerMul *= 1 + (v - 100) / 100 * 0.4; },
    hint: 'Traži turbo (Motor 3).',
  },
  {
    id: 'lock', name: 'Zaključavanje diferencijala', unit: '', step: 0.1, needs: 'diff',
    base: (s) => s.handling.throttleSlide,
    range: (s, up) => (up.diff ? { min: s.handling.throttleSlide - 1.5, max: s.handling.throttleSlide + 1.5 } : null),
    apply: (s, v) => { s.handling.throttleSlide = Math.max(0, v); },
    hint: 'Više = gas lakše izbacuje stražnji kraj.',
  },
  {
    id: 'balance', name: 'Prianjanje u driftu', unit: '', step: 0.25, needs: 'suspension',
    base: (s) => s.handling.driftGrip,
    range: (s, up) => (up.suspension ? { min: s.handling.driftGrip - 2.5, max: s.handling.driftGrip + 2.5 } : null),
    apply: (s, v) => { s.handling.driftGrip = v; },
    hint: 'Više = uža linija u driftu, manje = širi klizni drift.',
  },
  {
    id: 'response', name: 'Odziv kuta', unit: '', step: 0.1, needs: 'suspension',
    base: (s) => s.handling.angleResponse,
    range: (s, up) => (up.suspension >= 2 ? { min: s.handling.angleResponse - 0.8, max: s.handling.angleResponse + 1 } : null),
    apply: (s, v) => { s.handling.angleResponse = v; },
    hint: 'Traži Ovjes 2. Više = auto brže mijenja kut.',
  },
  {
    id: 'angle', name: 'Najveći kut drifta', unit: '°', step: 1, needs: 'suspension',
    base: (s) => s.handling.maxAngle,
    range: (s, up) => (up.suspension ? { min: s.handling.maxAngle - 12, max: s.handling.maxAngle } : null),
    apply: (s, v) => { s.handling.maxAngle = v; },
    hint: 'Angle kit (Ovjes 3) diže gornju granicu.',
  },
  {
    id: 'handbrake', name: 'Ručna kočnica', unit: '', step: 0.25, needs: 'brakes',
    base: (s) => s.handling.handbrakeGrip,
    range: (s, up) => (up.brakes >= 2 ? { min: 0.75, max: 5 } : null),
    apply: (s, v) => { s.handling.handbrakeGrip = v; },
    hint: 'Traži hidrauličnu ručnu (Kočnice 2). Manje = ručna jače izbacuje.',
  },
];

export const PAINTS = [
  '#f2f2ef', '#141516', '#9aa0a6', '#c8102e', '#e86a10', '#f5c400', '#3f9b5a', '#2e7d5b',
  '#2a5db0', '#1846a8', '#7a3fb0', '#f29bc1', '#5a3b24', '#d0d3d8', '#3ad1c4', '#b5ff3a',
];
export const SMOKES = [null, '#ff4d6d', '#4dd2ff', '#ffd23f', '#7cff6b', '#c77dff', '#ff9f43', '#f2f2f2'];
export const PAINT_COST = 500;
export const SMOKE_COST = 1000;

// Indeks performansi iz snage po masi, prianjanja, vuče i kočnica; klasa slijedi iz PI-ja.
export function performanceIndex(s) {
  const h = s.handling;
  const pw = (s.kw * s.engine.powerMul) / s.mass;
  const pi = 120 + 1900 * pw + 12 * (h.grip - 20) + 8 * (h.traction - 8) + 6 * (h.brake - 10);
  return Math.max(100, Math.min(999, Math.round(pi)));
}

export function piClass(pi) {
  if (pi >= 900) return { id: 'A+', color: '#ff3d71' };
  if (pi >= 700) return { id: 'A', color: '#c8452e' };
  if (pi >= 520) return { id: 'B', color: '#2f78c4' };
  if (pi >= 350) return { id: 'C', color: '#3f9b5a' };
  return { id: 'D', color: '#8d8a80' };
}

// Gotov spec za vožnju: tvornički auto + zamjena pogona + nadogradnje + podešavanje + boje.
export function buildSpec(base, entry = {}) {
  const s = structuredClone(base);
  const up = entry.up || {};
  if (entry.drivetrain && entry.drivetrain !== s.drivetrain) {
    s.drivetrain = entry.drivetrain;
    s.handling = makeHandling(s.cls, s.drivetrain, s.handlingOverrides);
  }
  for (const u of UPGRADES) if (up[u.id]) u.apply(s, up[u.id]);
  for (const t of TUNING) {
    const v = entry.tune?.[t.id];
    const r = t.range(s, up);
    if (v !== undefined && r) t.apply(s, Math.max(r.min, Math.min(r.max, v)));
  }
  if (entry.color) s.color = entry.color;
  if (entry.smoke) s.smoke = entry.smoke;
  return s;
}
