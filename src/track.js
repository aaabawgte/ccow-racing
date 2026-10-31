// Generička staza: središnja linija (krug), podloge, prepreke, pokretni predmeti, drift zone i ukrasi.
// Svaka staza je opis (vidi tracks.js). Jedinice su metri, y raste prema gore.
import { SURFACES } from './physics.js';

const HASH_CELL = 8;

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

// Glatka zatvorena krivulja kroz kontrolne točke, uzorkovana svakih `spacing` metara.
export function sampleLoop(points, spacing, closed = true) {
  const n = points.length;
  const dense = [];
  const at = (i) => (closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let j = 0; j < 40; j++) {
      const t = j / 40;
      dense.push([catmullRom(p0[0], p1[0], p2[0], p3[0], t), catmullRom(p0[1], p1[1], p2[1], p3[1], t)]);
    }
  }
  if (!closed) dense.push(points[n - 1]);
  const out = [dense[0]];
  let prev = dense[0];
  let need = spacing;
  const count = closed ? dense.length + 1 : dense.length;
  for (let i = 1; i < count; i++) {
    const cur = dense[i % dense.length];
    let seg = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
    while (seg >= need) {
      const t = need / seg;
      prev = [prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t];
      out.push(prev);
      seg = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
      need = spacing;
    }
    need -= seg;
    prev = cur;
  }
  if (closed) {
    const last = out[out.length - 1];
    if (Math.hypot(last[0] - out[0][0], last[1] - out[0][1]) < spacing * 0.5) out.pop();
  }
  const m = out.length;
  return out.map((p, i) => {
    const a = closed ? out[(i - 1 + m) % m] : out[Math.max(0, i - 1)];
    const b = closed ? out[(i + 1) % m] : out[Math.min(m - 1, i + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return { x: p[0], y: p[1], tx: (b[0] - a[0]) / len, ty: (b[1] - a[1]) / len };
  });
}

export function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function contains(a, x, y) {
  switch (a.shape) {
    case 'rect': return x >= a.x0 && x <= a.x1 && y >= a.y0 && y <= a.y1;
    case 'circle': return (x - a.x) ** 2 + (y - a.y) ** 2 <= a.r * a.r;
    case 'ring': {
      const d = (x - a.x) ** 2 + (y - a.y) ** 2;
      return d >= a.r0 * a.r0 && d <= a.r1 * a.r1;
    }
    case 'poly': {
      let inside = false;
      const p = a.pts;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        if ((p[i][1] > y) !== (p[j][1] > y) && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) inside = !inside;
      }
      return inside;
    }
    case 'road': return distToPolyline(a.pts, x, y) <= a.width / 2;
  }
  return false;
}

function distToPolyline(pts, x, y) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t));
  }
  return best;
}

// Prostorna mreža uzoraka središnje linije, za brzo traženje najbliže točke.
export class SampleHash {
  constructor() { this.cells = new Map(); }
  key(cx, cy) { return cx * 73856093 ^ cy * 19349663; }
  add(i, s) {
    const k = this.key(Math.floor(s.x / HASH_CELL), Math.floor(s.y / HASH_CELL));
    let c = this.cells.get(k);
    if (!c) this.cells.set(k, (c = []));
    c.push(i);
  }
  remove(i, s) {
    const k = this.key(Math.floor(s.x / HASH_CELL), Math.floor(s.y / HASH_CELL));
    const c = this.cells.get(k);
    if (!c) return;
    const j = c.indexOf(i);
    if (j >= 0) c.splice(j, 1);
    if (!c.length) this.cells.delete(k);
  }
  // Najbliži uzorak u krugu od ~1.5 ćelije; vraća [indeks, udaljenost²] ili null.
  nearest(samples, x, y, getSample = (i) => samples[i]) {
    const cx = Math.floor(x / HASH_CELL), cy = Math.floor(y / HASH_CELL);
    let best = -1, bestD = Infinity;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const c = this.cells.get(this.key(cx + dx, cy + dy));
        if (!c) continue;
        for (const i of c) {
          const s = getSample(i);
          const d = (s.x - x) ** 2 + (s.y - y) ** 2;
          if (d < bestD) { bestD = d; best = i; }
        }
      }
    }
    return best < 0 ? null : [best, bestD];
  }
}

const PROP_TYPES = {
  cart: { r: 0.45, m: 35, friction: 2.5 },
  cone: { r: 0.28, m: 4, friction: 7, penalty: true },
  barrel: { r: 0.4, m: 25, friction: 5 },
};

export class Track {
  constructor(def) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.mode = def.mode || 'laps';
    this.theme = def.theme;
    this.bounds = def.bounds;
    this.base = SURFACES[def.base || 'grass'];
    const r = def.route;
    this.width = r.width || 0;
    this.curb = r.curb !== false && this.width > 0;
    this.samples = sampleLoop(r.points, 1);
    this.hash = new SampleHash();
    this.samples.forEach((s, i) => this.hash.add(i, s));

    this.areas = (def.areas || []).map((a) => ({ ...a, surf: SURFACES[a.surface] }));
    this.roads = (def.roads || []).map((p) => ({ shape: 'road', pts: p.pts, width: p.width, surf: SURFACES.asphalt }));
    this.zones = def.zones || [];
    this.decor = def.decor || [];
    this.lights = def.lights || [];
    this.gateEvery = def.gateEvery || 0;

    const b = this.bounds;
    const t = def.wallThickness ?? 2;
    const walls = def.walls === false ? [] : [
      { type: 'rect', kind: 'wall', x0: b.minX - 6, y0: b.minY - 6, x1: b.minX + t, y1: b.maxY + 6 },
      { type: 'rect', kind: 'wall', x0: b.maxX - t, y0: b.minY - 6, x1: b.maxX + 6, y1: b.maxY + 6 },
      { type: 'rect', kind: 'wall', x0: b.minX - 6, y0: b.minY - 6, x1: b.maxX + 6, y1: b.minY + t },
      { type: 'rect', kind: 'wall', x0: b.minX - 6, y0: b.maxY - t, x1: b.maxX + 6, y1: b.maxY + 6 },
    ];
    this.obstacles = [...walls, ...(def.obstacles || [])];
    if (def.trees) this.obstacles.push(...this.placeTrees(def.trees));
    this.propDefs = def.props || [];
    this.resetProps();

    if (def.start) this.start = def.start;
    else {
      const s = this.samples[this.samples.length - (def.startBack ?? 12)];
      this.start = { x: s.x, y: s.y, heading: Math.atan2(s.ty, s.tx) };
    }
  }

  resetProps() {
    this.props = this.propDefs.map((p) => ({ ...PROP_TYPES[p.kind], ...p, vx: 0, vy: 0, angle: p.angle || 0, spin: 0, hit: false }));
  }

  roadPath() {
    const p = new Path2D();
    this.samples.forEach((s, i) => (i ? p.lineTo(s.x, s.y) : p.moveTo(s.x, s.y)));
    p.closePath();
    return p;
  }

  // Udaljenost od središnje linije (Infinity ako je daleko).
  roadDistance(x, y) {
    const hit = this.hash.nearest(this.samples, x, y);
    return hit ? Math.sqrt(hit[1]) : Infinity;
  }

  surfaceAt(x, y) {
    const areas = this.areas;
    for (let i = areas.length - 1; i >= 0; i--) if (areas[i].over && contains(areas[i], x, y)) return areas[i].surf;
    if (this.width > 0) {
      const d = this.roadDistance(x, y);
      if (d <= this.width / 2) return this.def.roadSurface ? SURFACES[this.def.roadSurface] : SURFACES.asphalt;
      if (this.curb && d <= this.width / 2 + 1) return SURFACES.curb;
    }
    for (const r of this.roads) if (contains(r, x, y)) return r.surf;
    for (let i = areas.length - 1; i >= 0; i--) if (!areas[i].over && contains(areas[i], x, y)) return areas[i].surf;
    return this.base;
  }

  zoneAt(x, y) {
    for (const z of this.zones) if (contains(z, x, y)) return z;
    return null;
  }

  placeTrees(cfg) {
    const rand = mulberry32(cfg.seed || 1107);
    const b = this.bounds;
    const trees = [];
    const blocked = (x, y) => this.obstacles.some((o) => (o.type === 'rect'
      ? x > o.x0 - 4 && x < o.x1 + 4 && y > o.y0 - 4 && y < o.y1 + 4
      : (x - o.x) ** 2 + (y - o.y) ** 2 < (o.r + 4) ** 2));
    for (let tries = 0; tries < cfg.count * 40 && trees.length < cfg.count; tries++) {
      const x = b.minX + 6 + rand() * (b.maxX - b.minX - 12);
      const y = b.minY + 6 + rand() * (b.maxY - b.minY - 12);
      let clear = this.surfaceAt(x, y).id === this.base.id;
      for (let k = 0; k < 12 && clear; k++) {
        const a = (k / 12) * Math.PI * 2;
        if (this.surfaceAt(x + Math.cos(a) * (cfg.clearance || 10), y + Math.sin(a) * (cfg.clearance || 10)).id !== this.base.id) clear = false;
      }
      if (!clear || blocked(x, y)) continue;
      if (trees.some((t) => Math.hypot(t.x - x, t.y - y) < (cfg.spacing || 7))) continue;
      trees.push({ type: 'circle', kind: 'tree', x, y, r: 0.45, crown: 2.4 + rand() * 2, shade: rand() });
    }
    return trees;
  }

  // Najbliža točka središnje linije; traži oko prethodnog indeksa, a ako je auto daleko, po mreži.
  nearestIndex(x, y, hint = 0) {
    const n = this.samples.length;
    let best = hint, bestD = Infinity;
    for (let k = -60; k <= 60; k++) {
      const i = (hint + k + n) % n;
      const s = this.samples[i];
      const d = (s.x - x) ** 2 + (s.y - y) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    if (bestD > 20 * 20) {
      const hit = this.hash.nearest(this.samples, x, y);
      if (hit && hit[1] < bestD) best = hit[0];
    }
    return best;
  }
}
