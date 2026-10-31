// Staze oko City Center One West. Svaka je opis koji Track (track.js) pretvara u igrivu stazu,
// a Renderer crta prema temi i ukrasima. Medalje (sekunde kruga s kaznama) su složene prema krugu
// autopilota s E30: zlato ~5% sporije, srebro ~25%, bronca ~50%. Beskrajna staza je zasebno u endless.js.

const rect = (x0, y0, x1, y1, o = {}) => ({ shape: 'rect', type: 'rect', x0, y0, x1, y1, ...o });
const circle = (x, y, r, o = {}) => ({ shape: 'circle', type: 'circle', x, y, r, ...o });
const pillar = (x, y, s = 0.9, o = {}) => rect(x - s / 2, y - s / 2, x + s / 2, y + s / 2, { kind: 'pillar', penalty: 1, ...o });
const arc = (cx, cy, r, a0, a1, steps) => {
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
};
const range = (a, b, step) => {
  const out = [];
  for (let v = a; v <= b + 1e-6; v += step) out.push(v);
  return out;
};

const OUTDOOR = {
  base: '#577d47', patches: '#4f7341', outside: '#4a6b3c',
  road: '#3a3e44', roadEdge: 'rgba(240, 240, 232, 0.85)', roadCenter: 'rgba(240, 240, 232, 0.45)',
};

// 1. Vanjski parking CCOW: početnička, krug oko centra i velik parking s kolicima.
const parking = {
  id: 'parking',
  medals: { gold: 26, silver: 31, bronze: 38 },
  name: 'Vanjski parking CCOW',
  short: 'Parking',
  desc: 'Početnička. Širok asfalt, otoci, stupovi rasvjete i kolica za kupovinu.',
  difficulty: 1,
  theme: { ...OUTDOOR },
  bounds: { minX: -140, maxX: 210, minY: -45, maxY: 185 },
  base: 'grass',
  route: {
    width: 12,
    points: [
      [0, 0], [80, 0], [140, 10], [170, 50], [165, 100], [130, 125], [95, 115], [70, 90],
      [40, 95], [20, 130], [-20, 145], [-70, 135], [-100, 100], [-105, 50], [-85, 10], [-45, -5],
    ],
  },
  areas: [
    rect(15, 20, 135, 75, { surface: 'asphalt', style: 'parking' }),
    rect(60, 4, 80, 20, { surface: 'asphalt', style: 'parking', over: true }),
    rect(30, 45, 120, 50, { surface: 'grass', style: 'island', over: true }),
  ],
  obstacles: [
    rect(-65, 45, 10, 95, { kind: 'building', label: 'CITY CENTER ONE WEST', glass: [-40, 60, 30, 18], canopy: [10, 62, 3.5, 16] }),
    ...range(36, 116, 16).map((x) => circle(x, 47.5, 0.3, { kind: 'lamp' })),
    rect(124, 58, 132, 61, { kind: 'corral' }),
  ],
  props: [
    [30, 33], [33, 36], [52, 62], [88, 30], [96, 66], [101, 63], [118, 34], [126, 64], [127, 66], [128, 62],
    [45, 68], [70, 36], [110, 52], [20, 55],
  ].map(([x, y]) => ({ kind: 'cart', x, y, angle: (x * 7 + y) % 6 })),
  decor: [
    { t: 'stalls', dir: 'v', x0: 17.5, x1: 132.5, y0: 20, y1: 25, step: 2.5, skip: [58, 82] },
    { t: 'stalls', dir: 'v', x0: 17.5, x1: 132.5, y0: 70, y1: 75, step: 2.5 },
    { t: 'stalls', dir: 'v', x0: 30, x1: 120, y0: 40, y1: 45, step: 2.5 },
    { t: 'stalls', dir: 'v', x0: 30, x1: 120, y0: 50, y1: 55, step: 2.5 },
    { t: 'text', x: 75, y: 32.5, text: 'CCOW PARKING', size: 7, color: 'rgba(240, 240, 232, 0.18)' },
  ],
  trees: { count: 110, seed: 1107, clearance: 12 },
};

// 2. Garaža -2: uski prolazi među stupovima, sklizak epoksidni pod, rampe na krajevima. Stup = kazna.
const garageParked = [
  [38, 26, '#c9ccd1'], [54, 26, '#2c4f7c'], [78, 26, '#7b1e1e'], [94, 26, '#e8e6df'],
  [46, 64, '#3a3d42'], [70, 64, '#5d7a3a'], [86, 64, '#c9ccd1'], [102, 64, '#a2541f'],
  [42, 40, '#1d1f24'], [66, 50, '#b8b2a2'], [90, 40, '#284a8a'], [106, 50, '#8b8f96'],
];
const garage = {
  id: 'garage',
  medals: { gold: 17.5, silver: 21, bronze: 26 },
  name: 'Garaža -2',
  short: 'Garaža',
  desc: 'Tehnička. Uski prolazi među stupovima, sklizak epoksidni pod, rampe. Udarac u stup je kazna.',
  difficulty: 3,
  theme: {
    base: '#4f6670', outside: '#15171a', dark: true, guide: true,
    floorLines: 'rgba(235, 225, 120, 0.55)', wall: '#6d7176',
  },
  bounds: { minX: 0, maxX: 145, minY: 0, maxY: 90 },
  base: 'epoxy',
  wallThickness: 2,
  route: {
    width: 0,
    points: [
      [30, 17], [70, 17], [108, 17], [124, 30], [136, 45], [128, 55], [118, 70], [90, 75], [60, 75],
      [30, 74], [18, 62], [8, 45], [16, 34], [22, 22],
    ],
  },
  areas: [
    circle(128, 45, 12, { surface: 'concrete', style: 'ramp' }),
    circle(16, 45, 12, { surface: 'concrete', style: 'ramp' }),
  ],
  obstacles: [
    // središnji blok parkirnih mjesta: zidić po sredini i stupovi uz rub
    rect(32, 44.6, 112, 45.4, { kind: 'wall' }),
    ...range(32, 112, 8).flatMap((x) => [pillar(x, 31), pillar(x, 59), pillar(x, 45, 1.1)]),
    // stupovi uz vanjske zidove
    ...range(32, 112, 8).flatMap((x) => [pillar(x, 7), pillar(x, 83)]),
    // slalom stupovi u donjem prolazu
    pillar(56, 14, 1.1), pillar(72, 21, 1.1), pillar(88, 14, 1.1),
    // jezgre rampi
    circle(128, 45, 3.5, { kind: 'rampCore', penalty: 1 }),
    circle(16, 45, 3.5, { kind: 'rampCore', penalty: 1 }),
    ...garageParked.map(([x, y, color]) => rect(x - 0.9, y - 2.2, x + 0.9, y + 2.2, { kind: 'parkedCar', color, vertical: true })),
  ],
  decor: [
    { t: 'stalls', dir: 'v', x0: 32, x1: 112, y0: 31, y1: 44.6, step: 4 },
    { t: 'stalls', dir: 'v', x0: 32, x1: 112, y0: 45.4, y1: 59, step: 4 },
    { t: 'stalls', dir: 'v', x0: 32, x1: 112, y0: 2, y1: 7, step: 4 },
    { t: 'stalls', dir: 'v', x0: 32, x1: 112, y0: 83, y1: 88, step: 4 },
    { t: 'line', pts: [[24, 24.5], [118, 24.5]], color: 'rgba(235, 225, 120, 0.5)', width: 0.2, dash: [2, 2] },
    { t: 'line', pts: [[24, 66], [118, 66]], color: 'rgba(235, 225, 120, 0.5)', width: 0.2, dash: [2, 2] },
    { t: 'text', x: 72, y: 38, text: '-2', size: 9, color: 'rgba(235, 225, 120, 0.35)' },
    { t: 'text', x: 72, y: 52, text: 'GARAŽA', size: 4, color: 'rgba(235, 225, 120, 0.3)' },
    { t: 'arrow', x: 60, y: 17, rot: 0, size: 2.5, color: 'rgba(255, 255, 255, 0.35)' },
    { t: 'arrow', x: 80, y: 75, rot: 180, size: 2.5, color: 'rgba(255, 255, 255, 0.35)' },
  ],
  lights: [...range(24, 120, 16).flatMap((x) => [[x, 17], [x, 74]]), [128, 45], [16, 45], ...range(40, 104, 16).map((x) => [x, 38])].map(([x, y]) => ({ x, y, r: 9 })),
};

// 3. Utovarna zona: iza dućana, kamioni na rampama, palete, mokre mrlje i šljunčani rub.
const loading = {
  id: 'loading',
  medals: { gold: 14.5, silver: 17, bronze: 21 },
  name: 'Utovarna zona',
  short: 'Utovar',
  desc: 'Iza dućana. Kamioni, palete i kontejneri; mokar asfalt i šljunčani rub mijenjaju prianjanje.',
  difficulty: 2,
  theme: { base: '#43474d', outside: '#2b2e33', guide: true, wall: '#7c8086' },
  bounds: { minX: 0, maxX: 170, minY: 0, maxY: 112 },
  base: 'asphalt',
  route: {
    width: 0,
    points: [
      [30, 20], [80, 16], [130, 20], [154, 34], [156, 56], [140, 70], [110, 72], [80, 70], [50, 72], [24, 66], [14, 46],
    ],
  },
  areas: [
    rect(0, 0, 170, 7, { surface: 'gravel' }),
    rect(162, 0, 170, 112, { surface: 'gravel' }),
    rect(0, 0, 7, 112, { surface: 'gravel' }),
    circle(100, 19, 9, { surface: 'wet' }),
    circle(112, 23, 6, { surface: 'wet' }),
    circle(28, 60, 7, { surface: 'wet' }),
    rect(70, 64, 92, 76, { surface: 'wet' }),
    rect(150, 40, 162, 60, { surface: 'gravel' }),
  ],
  obstacles: [
    rect(0, 92, 170, 112, { kind: 'building', label: 'CCOW · DOSTAVA', docks: [22, 40, 58, 76, 94, 112] }),
    // kamioni na rampama (prikolica + kabina)
    ...[40, 76, 112].map((x) => rect(x - 1.3, 75, x + 1.3, 92, { kind: 'truck', color: x === 76 ? '#e7e3d8' : '#2f5f9e', cab: 'down' })),
    // red parkiranih prikolica u sredini
    rect(48, 40, 62, 42.6, { kind: 'truck', color: '#c9c3b5', cab: 'right' }),
    rect(68, 40, 82, 42.6, { kind: 'truck', color: '#9e2f2f', cab: 'right' }),
    rect(88, 44, 102, 46.6, { kind: 'truck', color: '#e7e3d8', cab: 'left' }),
    rect(108, 40, 122, 42.6, { kind: 'truck', color: '#2f5f9e', cab: 'left' }),
    rect(60, 50, 62.4, 56, { kind: 'container', color: '#b8462b' }),
    rect(100, 52, 106, 54.4, { kind: 'container', color: '#2f6b8a' }),
    // palete
    ...[[24, 86], [26, 86], [60, 86], [62, 86], [61, 84], [128, 86], [130, 86], [142, 84], [142, 86], [12, 84], [12, 86], [150, 16], [152, 16], [86, 54], [128, 56]]
      .map(([x, y]) => rect(x - 0.6, y - 0.6, x + 0.6, y + 0.6, { kind: 'pallet' })),
    circle(150, 84, 0.6, { kind: 'barrelStatic' }), circle(151.4, 84.3, 0.6, { kind: 'barrelStatic' }),
  ],
  props: [[70, 30], [72, 30.5], [140, 30], [34, 40], [36, 41]].map(([x, y]) => ({ kind: 'barrel', x, y })),
  decor: [
    ...[[60, 30], [96, 30], [40, 56], [124, 62], [140, 46]].map(([x, y]) => ({ t: 'grate', x, y, w: 1.2, h: 0.6 })),
    { t: 'hatch', x0: 10, y0: 88, x1: 160, y1: 92 },
    { t: 'text', x: 85, y: 30, text: 'UTOVAR', size: 6, color: 'rgba(240, 220, 120, 0.25)' },
    { t: 'line', pts: [[10, 34], [160, 34]], color: 'rgba(240, 220, 120, 0.35)', width: 0.2, dash: [3, 3] },
  ],
};

// 4. Obilaznica One West: brze ulice oko centra, dugi zavoji i dva rotora. Za time attack.
const bypassPoints = [
  [-150, -150], [-40, -152],
  ...arc(40, -150, 20, 180, 360, 6),
  [140, -150], [230, -120], [270, -40], [260, 60], [200, 140], [100, 158],
  ...arc(-40, 150, 20, 0, 180, 6),
  [-140, 155], [-230, 130], [-275, 60], [-255, -10], [-285, -70], [-235, -140],
];
const bypass = {
  id: 'bypass',
  medals: { gold: 62, silver: 74, bronze: 90 },
  name: 'Obilaznica One West',
  short: 'Obilaznica',
  desc: 'Brza. Ulice oko centra, dugi zavoji i dva rotora. Za time attack.',
  difficulty: 3,
  theme: { ...OUTDOOR },
  bounds: { minX: -330, maxX: 330, minY: -230, maxY: 230 },
  base: 'grass',
  route: { width: 11, points: bypassPoints },
  areas: [
    { shape: 'ring', x: 40, y: -150, r0: 13, r1: 26, surface: 'asphalt', style: 'roundabout', over: true },
    { shape: 'ring', x: -40, y: 150, r0: 13, r1: 26, surface: 'asphalt', style: 'roundabout', over: true },
    rect(-95, -75, 95, 75, { surface: 'asphalt', style: 'parking' }),
    { shape: 'poly', pts: [[275, -90], [300, -40], [295, 70], [270, 70], [282, -40]], surface: 'gravel' },
  ],
  roads: [
    { pts: [[40, -124], [40, -75]], width: 9 },
    { pts: [[40, -176], [40, -235]], width: 9 },
    { pts: [[-40, 124], [-40, 75]], width: 9 },
    { pts: [[-40, 176], [-40, 235]], width: 9 },
  ],
  obstacles: [
    rect(-60, -35, 60, 35, { kind: 'building', label: 'CITY CENTER ONE WEST', glass: [-20, -10, 40, 20] }),
    circle(40, -150, 5, { kind: 'monument' }),
    circle(-40, 150, 5, { kind: 'monument' }),
    rect(150, -90, 210, -40, { kind: 'building', label: 'OFFICE', plain: true }),
    rect(-210, 40, -150, 95, { kind: 'building', label: 'HOTEL', plain: true }),
    rect(-200, -95, -130, -50, { kind: 'building', label: 'BAUMARKT', plain: true }),
    rect(140, 30, 200, 80, { kind: 'building', label: 'KINO', plain: true }),
    ...range(-80, 80, 20).flatMap((x) => [circle(x, -55, 0.3, { kind: 'lamp' }), circle(x, 55, 0.3, { kind: 'lamp' })]),
  ],
  decor: [
    { t: 'stalls', dir: 'v', x0: -90, x1: 90, y0: -75, y1: -68, step: 2.5 },
    { t: 'stalls', dir: 'v', x0: -90, x1: 90, y0: 68, y1: 75, step: 2.5 },
    { t: 'stalls', dir: 'v', x0: -90, x1: 90, y0: -50, y1: -43, step: 2.5 },
    { t: 'stalls', dir: 'v', x0: -90, x1: 90, y0: 43, y1: 50, step: 2.5 },
  ],
  trees: { count: 320, seed: 77, clearance: 13, spacing: 8 },
};

// 5. Noćna smjena: hodnici centra nakon zatvaranja, uglačane pločice, eskalatori i fontana.
const shopsBottom = ['ELEKTRONIKA', 'PEKARA', 'LJEKARNA', 'CIPELE', 'OPTIKA', 'MODA', 'SPORT'];
const shopsTop = ['KAFIĆ', 'IGRAČKE', 'KNJIŽARA', 'CVJEĆARNA', 'PARFUMI', 'NAKIT', 'TORBE'];
const SIGNS = ['#ff4d6d', '#4dd2ff', '#ffd23f', '#7cff6b', '#c77dff', '#ff9f43', '#5ee6c4'];
const mallShops = [
  ...shopsBottom.map((label, i) => rect(14 + i * 22, 2, 14 + i * 22 + 21, 14, { kind: 'shop', label, sign: SIGNS[i], front: 'up' })),
  ...shopsTop.map((label, i) => rect(14 + i * 22, 106, 14 + i * 22 + 21, 118, { kind: 'shop', label, sign: SIGNS[(i + 3) % 7], front: 'down' })),
  rect(2, 2, 14, 118, { kind: 'shop', label: 'HIPERMARKET', sign: '#4dd2ff', front: 'right', vertical: true }),
  rect(166, 2, 178, 118, { kind: 'shop', label: 'KUHINJE', sign: '#ffd23f', front: 'left', vertical: true }),
  // unutarnji blok
  rect(40, 34, 88, 72, { kind: 'shop', label: 'SAMSUNG', sign: '#4d7dff', front: 'down' }),
  rect(92, 34, 140, 72, { kind: 'shop', label: 'SONY', sign: '#e6e6e6', front: 'down' }),
  // otoci s kioscima
  rect(28, 82, 60, 94, { kind: 'shop', label: 'PHILIPS', sign: '#3d8bff', front: 'down' }),
  rect(120, 82, 152, 94, { kind: 'shop', label: 'KIOSK', sign: '#ff4d6d', front: 'down' }),
];
const night = {
  id: 'night',
  medals: { gold: 28, silver: 33, bronze: 40 },
  name: 'Noćna smjena',
  short: 'Noćna smjena',
  desc: 'Bonus. Hodnici centra nakon zatvaranja. Pločice jako kližu, eskalatori su zidovi, fontana u atriju.',
  difficulty: 4,
  theme: { base: '#8f8a80', outside: '#0d0e12', dark: true, guide: true, tiles: 'rgba(0, 0, 0, 0.12)', wall: '#2a2c33' },
  bounds: { minX: 0, maxX: 180, minY: 0, maxY: 120 },
  base: 'tiles',
  route: {
    width: 0,
    points: [
      [40, 24], [100, 24], [152, 24], [157, 50], [159, 78], [152, 99], [116, 100], [102, 84], [90, 79], [78, 84],
      [64, 100], [24, 98], [21, 78], [24, 50], [24, 27],
    ],
  },
  areas: [circle(90, 89, 9, { surface: 'tiles', style: 'atrium' })],
  obstacles: [
    ...mallShops,
    circle(90, 89, 4.5, { kind: 'fountain' }),
    rect(60, 73, 63.5, 82, { kind: 'escalator', dir: 'up' }),
    rect(116.5, 73, 120, 82, { kind: 'escalator', dir: 'down' }),
    ...[[75, 15.6], [130, 15.6], [164, 64], [16, 64]].map(([x, y]) => rect(x - 1, y - 1, x + 1, y + 1, { kind: 'planter' })),
  ],
  decor: [
    { t: 'text', x: 90, y: 24, text: 'CITY CENTER ONE WEST', size: 3.4, color: 'rgba(255, 255, 255, 0.12)' },
  ],
  lights: [
    ...range(30, 150, 20).map((x) => [x, 24]), ...range(30, 150, 20).map((x) => [x, 100]),
    [26, 50], [26, 75], [154, 50], [154, 75], [90, 89],
  ].map(([x, y]) => ({ x, y, r: 11 })),
};

// 6. Krovni parking: gymkhana s čunjevima, kontejnerima i stupovima za 360°. Drift zone množe bodove.
const coneLine = (x0, x1, y, step) => range(x0, x1, step).map((x) => ({ kind: 'cone', x, y }));
const coneRing = (cx, cy, r, n) => Array.from({ length: n }, (_, i) => ({ kind: 'cone', x: cx + Math.cos((i / n) * Math.PI * 2) * r, y: cy + Math.sin((i / n) * Math.PI * 2) * r }));
const rooftop = {
  id: 'rooftop',
  medals: { gold: 32.5, silver: 39, bronze: 47 },
  name: 'Krovni parking (gymkhana)',
  short: 'Gymkhana',
  desc: 'Precizna. Čunjevi, kontejneri i stupovi za 360°. Drift zone množe bodove, srušen čunj je kazna.',
  difficulty: 4,
  theme: { base: '#8b8e92', outside: '#5e7f9c', guide: true, wall: '#b9bcc0', sky: true },
  bounds: { minX: 0, maxX: 110, minY: 0, maxY: 110 },
  base: 'concrete',
  wallThickness: 1.2,
  route: {
    width: 0,
    points: [
      [14, 14], [40, 13], [66, 14], [90, 16], [100, 32], [96, 52], [90, 66], [89, 76], [83, 84], [75, 83],
      [71, 75], [76, 67], [86, 70], [88, 90], [70, 99], [48, 98], [34, 92], [22, 86], [20, 75], [27, 67],
      [36, 70], [36, 82], [28, 89], [17, 82], [14, 66], [12, 44], [24, 32], [44, 32], [55, 30], [64, 37], [62, 48], [50, 50], [44, 40], [24, 24],
    ],
  },
  zones: [
    circle(80, 75, 13, { mult: 2, label: 'DRIFT x2' }),
    circle(30, 76, 13, { mult: 2, label: 'DRIFT x2' }),
    circle(54, 40, 12, { mult: 3, label: 'PRECIZNO x3' }),
    rect(30, 9, 72, 19, { mult: 2, label: 'SLALOM x2' }),
  ],
  obstacles: [
    circle(80, 75, 1.4, { kind: 'pillarRound', penalty: 1 }),
    circle(30, 76, 1.4, { kind: 'pillarRound', penalty: 1 }),
    circle(54, 40, 1.4, { kind: 'pillarRound', penalty: 1 }),
    rect(4, 96, 10, 106, { kind: 'building', label: 'LIFT', plain: true }),
    rect(70, 46, 76, 48.4, { kind: 'container', color: '#2f7a4f' }),
    rect(96, 86, 98.4, 92, { kind: 'container', color: '#c4502e' }),
    rect(82, 28, 84.4, 34, { kind: 'container', color: '#2f5f9e' }),
  ],
  props: [
    ...coneLine(34, 66, 14, 8),
    ...coneRing(80, 75, 3.2, 8),
    ...coneRing(30, 76, 3.2, 8),
    ...coneRing(54, 40, 3.2, 8),
    { kind: 'cone', x: 98, y: 44 }, { kind: 'cone', x: 92, y: 44 },
    { kind: 'cone', x: 52, y: 101 }, { kind: 'cone', x: 52, y: 95 },
  ],
  decor: [
    ...range(6, 104, 2.6).map((x) => ({ t: 'line', pts: [[x, 104], [x, 108.8]], color: 'rgba(255, 255, 255, 0.35)', width: 0.1 })),
    { t: 'text', x: 55, y: 62, text: 'GYMKHANA', size: 6, color: 'rgba(255, 255, 255, 0.2)' },
    { t: 'circle', x: 55, y: 62, r: 0, fill: 'transparent' },
  ],
};

// 7. Tsukikage Touge: noćni japanski planinski prijevoj s raznolikim zavojima.
const tougeRoute = [
  [-195, 170], [-125, 176], [-55, 160], [5, 178], [75, 156], [140, 132], [180, 100], [194, 62],
  [184, 28], [155, 8], [118, 10], [88, 32], [62, 60], [32, 68], [5, 55], [-8, 32],
  [-2, 8], [25, -8], [60, -2], [82, -18], [86, -43], [70, -62], [40, -68], [12, -58],
  [-18, -40], [-48, -38], [-72, -52], [-78, -78], [-62, -96], [-30, -104], [5, -98], [38, -105],
  [56, -125], [50, -150], [25, -168], [-10, -170], [-45, -156], [-80, -150], [-112, -160], [-150, -176],
  [-183, -168], [-205, -145], [-214, -112], [-205, -82], [-182, -60], [-150, -52], [-122, -36], [-112, -12],
  [-122, 12], [-150, 24], [-182, 35], [-208, 58], [-220, 90], [-218, 125], [-208, 150],
];
const touge = {
  id: 'touge',
  medals: { gold: 78, silver: 95, bronze: 120 },
  name: 'Tsukikage Touge',
  short: 'Touge',
  desc: 'Brutalna noćna planina. Širi asfalt, brzi sweepovi, S-zavoji, šikana i ukosnice u oba smjera.',
  difficulty: 5,
  theme: {
    base: '#142b22', patches: '#0f241c', outside: '#07110d', dark: true,
    road: '#24272c', roadEdge: 'rgba(225, 232, 225, 0.75)', roadCenter: 'rgba(244, 181, 48, 0.58)',
    treeShadow: 'rgba(0, 0, 0, 0.32)', treeDark: '#183d29', treeLight: '#24573a',
  },
  bounds: { minX: -245, maxX: 220, minY: -230, maxY: 210 },
  base: 'grass',
  walls: false,
  route: { width: 12.5, curb: false, points: tougeRoute },
  areas: [
    circle(128, 119, 18, { surface: 'gravel' }),
    rect(-220, 143, -166, 188, { surface: 'gravel' }),
    circle(188, 44, 11, { surface: 'wet', over: true }),
    circle(62, 57, 10, { surface: 'wet', over: true }),
    circle(76, -55, 10, { surface: 'wet', over: true }),
    circle(-76, -72, 11, { surface: 'wet', over: true }),
    circle(-119, 0, 10, { surface: 'wet', over: true }),
  ],
  obstacles: [
    circle(126, 87, 4.8, { kind: 'rock' }), circle(120, 27, 3.8, { kind: 'rock' }),
    circle(20, 30, 3.3, { kind: 'rock' }), circle(-35, -62, 3.5, { kind: 'rock' }),
    circle(-112, -98, 4.5, { kind: 'rock' }), circle(-163, -18, 4.2, { kind: 'rock' }),
    circle(132, -82, 5.8, { kind: 'rock' }), circle(95, -158, 5.0, { kind: 'rock' }),
    circle(-145, 112, 4.0, { kind: 'rock' }),
    circle(-188, 153, 0.3, { kind: 'lamp' }), circle(124, 126, 0.3, { kind: 'lamp' }),
    circle(166, 53, 0.3, { kind: 'lamp' }), circle(66, -67, 0.3, { kind: 'lamp' }),
    circle(-183, -113, 0.3, { kind: 'lamp' }),
  ],
  decor: [
    { t: 'guardrail', pts: [[181, 111], [199, 90], [205, 61], [196, 31], [171, 10]] },
    { t: 'guardrail', pts: [[96, -17], [99, -42], [84, -66], [60, -78]] },
    { t: 'guardrail', pts: [[-161, -187], [-191, -181], [-217, -157], [-226, -120], [-217, -80]] },
    { t: 'guardrail', pts: [[-216, 49], [-233, 80], [-233, 122], [-219, 158]] },
    { t: 'torii', x: 125, y: 112, rot: -18, size: 8 },
    { t: 'text', x: 125, y: 133, text: '月影峠', size: 5.5, color: 'rgba(235, 225, 190, 0.72)', rot: -18 },
    { t: 'text', x: -191, y: 181, text: 'TOUGE START', size: 3.2, color: 'rgba(255, 255, 255, 0.22)' },
    { t: 'arrow', x: -130, y: 173, rot: -4, size: 3, color: 'rgba(244, 181, 48, 0.45)' },
    { t: 'arrow', x: 28, y: 158, rot: -10, size: 3, color: 'rgba(244, 181, 48, 0.45)' },
  ],
  lights: [
    [-188, 153, 13], [124, 126, 16], [166, 53, 12], [66, -67, 11], [-183, -113, 12],
  ].map(([x, y, r]) => ({ x, y, r })),
  trees: { count: 540, seed: 1986, clearance: 7, spacing: 6.2 },
};

export const TRACKS = [parking, loading, garage, bypass, rooftop, night, touge];

export function trackDefById(id) {
  return TRACKS.find((t) => t.id === id);
}
