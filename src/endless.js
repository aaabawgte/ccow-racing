// Beskrajna staza: cesta se generira ispred auta i briše iza. Seed je današnji datum, pa svi kolege
// isti dan voze istu cestu. Cesta se s udaljenošću sužava i zavoji postaju oštriji.
import { SURFACES } from './physics.js';
import { SampleHash, mulberry32 } from './track.js';

const AHEAD = 700;
const BEHIND = 350;
export const GATE_EVERY = 400;

export function dailySeed(date = new Date()) {
  const key = date.toISOString().slice(0, 10);
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return { key, seed: h >>> 0 };
}

export class EndlessTrack {
  constructor(date = new Date()) {
    const { key, seed } = dailySeed(date);
    this.id = 'endless';
    this.name = `Beskrajna (${key.split('-').reverse().join('.')})`;
    this.mode = 'endless';
    this.dynamic = true;
    this.seedKey = key;
    this.theme = { base: '#577d47', patches: '#4f7341', outside: '#577d47', road: '#3a3e44', roadEdge: 'rgba(240, 240, 232, 0.85)', roadCenter: 'rgba(240, 240, 232, 0.45)', endless: true };
    this.base = SURFACES.grass;
    this.curb = true;
    this.zones = [];
    this.decor = [];
    this.lights = [];
    this.areas = [];
    this.props = [];
    this.rand = mulberry32(seed);
    this.samples = [];
    this.offset = 0;
    this.hash = new SampleHash();
    this.obstacles = [];
    this.gen = { x: 0, y: 0, heading: Math.PI / 2, curv: 0, target: 0, until: 60 };
    this.width = 14;
    this.extend(AHEAD);
    const s = this.samples[20];
    this.start = { x: s.x, y: s.y, heading: Math.atan2(s.ty, s.tx) };
    this.startIndex = 20;
  }

  get bounds() {
    return null;
  }

  sample(i) {
    return this.samples[i - this.offset];
  }

  get end() {
    return this.offset + this.samples.length;
  }

  widthAt(i) {
    return Math.max(9, 14 - (i / 5000) * 5);
  }

  extend(count) {
    const g = this.gen, r = this.rand;
    for (let k = 0; k < count; k++) {
      const i = this.end;
      if (i >= g.until) {
        // Nova dionica: što dalje, to oštriji zavoji. Smjer se vuče natrag prema sjeveru da se cesta ne zavrti u krug.
        const hard = Math.min(1, i / 6000);
        const maxK = 0.006 + hard * 0.016;
        const drift = g.heading - Math.PI / 2;
        g.target = (r() * 2 - 1) * maxK - drift * 0.012;
        if (r() < 0.15 + hard * 0.2) g.target = 0;
        g.until = i + 40 + r() * (120 - hard * 60);
      }
      g.curv += (g.target - g.curv) * 0.04;
      g.heading += g.curv;
      g.x += Math.cos(g.heading);
      g.y += Math.sin(g.heading);
      const s = { x: g.x, y: g.y, tx: Math.cos(g.heading), ty: Math.sin(g.heading), w: this.widthAt(i) };
      this.samples.push(s);
      this.hash.add(i, s);
      // drveće uz cestu
      if (i % 9 === 0) {
        for (const side of [-1, 1]) {
          if (r() < 0.55) {
            const d = s.w / 2 + 6 + r() * 26;
            this.obstacles.push({ type: 'circle', kind: 'tree', x: s.x - s.ty * d * side, y: s.y + s.tx * d * side, r: 0.45, crown: 2.4 + r() * 2, shade: r(), idx: i });
          }
        }
      }
    }
  }

  trim(count) {
    for (let k = 0; k < count && this.samples.length > 10; k++) {
      this.hash.remove(this.offset, this.samples[0]);
      this.samples.shift();
      this.offset++;
    }
    this.obstacles = this.obstacles.filter((o) => o.idx >= this.offset - 20);
  }

  update(idx) {
    if (idx + AHEAD > this.end) this.extend(idx + AHEAD - this.end);
    if (idx - BEHIND > this.offset) this.trim(idx - BEHIND - this.offset);
  }

  surfaceAt(x, y) {
    const hit = this.hash.nearest(null, x, y, (i) => this.sample(i));
    if (!hit) return this.base;
    const s = this.sample(hit[0]);
    const d = Math.sqrt(hit[1]);
    if (d <= s.w / 2) return SURFACES.asphalt;
    if (d <= s.w / 2 + 1) return SURFACES.curb;
    return this.base;
  }

  zoneAt() {
    return null;
  }

  nearestIndex(x, y, hint) {
    let best = hint, bestD = Infinity;
    const lo = Math.max(this.offset, hint - 60), hi = Math.min(this.end - 1, hint + 60);
    for (let i = lo; i <= hi; i++) {
      const s = this.sample(i);
      const d = (s.x - x) ** 2 + (s.y - y) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    if (bestD > 20 * 20) {
      const hit = this.hash.nearest(null, x, y, (i) => this.sample(i));
      if (hit && hit[1] < bestD) best = hit[0];
    }
    return best;
  }

  resetProps() {}
}
