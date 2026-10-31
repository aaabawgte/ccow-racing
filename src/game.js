// Mjerenje krugova (s kaznama), drift bodovanje i beskrajna vožnja.
import { GATE_EVERY } from './endless.js';

export class LapTimer {
  constructor(track, time) {
    this.track = track;
    this.idx = track.nearestIndex(track.start.x, track.start.y);
    this.lap = 0;
    this.lapStart = null;
    this.current = 0;
    this.best = null;
    this.last = null;
    this.flags = [false, false, false];
    this.penalty = 0;
    this.message = null;
    this.messageUntil = 0;
    this.time = time;
  }

  // Kazna se dodaje vremenu kruga koji je u tijeku.
  addPenalty(seconds, text) {
    if (this.lapStart === null) return;
    this.penalty += seconds;
    this.say(text, this.time);
  }

  update(car, time) {
    const n = this.track.samples.length;
    const idx = this.track.nearestIndex(car.x, car.y, this.idx);
    [0.25, 0.5, 0.75].forEach((f, i) => {
      if (Math.abs(idx - n * f) < 25) this.flags[i] = true;
    });
    if (this.idx > n * 0.9 && idx < n * 0.1) {
      if (this.lapStart !== null) {
        if (this.flags.every(Boolean)) {
          const t = time - this.lapStart + this.penalty;
          this.last = t;
          this.lap++;
          this.onLap?.(t);
          if (this.best === null || t < this.best) {
            this.best = t;
            this.say('Najbolji krug!', time);
          }
        } else {
          this.say('Krug ne vrijedi', time);
        }
      }
      this.lapStart = time;
      this.penalty = 0;
      this.flags = [false, false, false];
    }
    this.idx = idx;
    this.current = this.lapStart === null ? 0 : time - this.lapStart + this.penalty;
    this.time = time;
  }

  say(text, time) {
    this.message = text;
    this.messageUntil = time + 2;
  }
}

const MIN_ANGLE = 12;

export class DriftScore {
  constructor() {
    this.total = 0;
    this.best = 0;
    this.angle = 0;
    this.message = null;
    this.messageTime = 0;
    this.resetChain();
  }

  resetChain() {
    this.active = false;
    this.zone = null;
    this.pending = 0;
    this.combo = 1;
    this.chainTime = 0;
    this.idle = 0;
  }

  update(car, dt, impact, zone) {
    const v = car.localVelocity();
    const speed = Math.hypot(v.x, v.y);
    this.angle = speed > 1 ? Math.abs(Math.atan2(v.y, Math.abs(v.x))) * (180 / Math.PI) : 0;
    this.messageTime -= dt;
    const offRoad = car.wheels.some((w) => w.surface.id === 'grass');

    if (this.active && (impact > 2.5 || offRoad)) {
      this.say(impact > 2.5 ? 'Udarac! Drift izgubljen' : 'Trava! Drift izgubljen');
      this.resetChain();
      return;
    }
    const drifting = v.x > 0 && speed > 8 && this.angle > MIN_ANGLE && this.angle < 110 && !offRoad;
    if (drifting) {
      this.active = true;
      this.idle = 0;
      this.chainTime += dt;
      this.combo = Math.min(5, 1 + Math.floor(this.chainTime / 2) * 0.5);
      this.zone = zone;
      this.pending += (this.angle - MIN_ANGLE) * speed * dt * 0.25 * (zone?.mult || 1);
    } else if (this.active) {
      this.idle += dt;
      if (this.idle > 1) this.bank();
    }
  }

  bank() {
    const points = Math.round(this.pending * this.combo);
    this.total += points;
    this.best = Math.max(this.best, points);
    if (points > 0) this.say(`+${points.toLocaleString('hr-HR')}`);
    if (points > 0) this.onBank?.(points);
    this.resetChain();
  }

  say(text) {
    this.message = text;
    this.messageTime = 1.8;
  }
}

// Beskrajna vožnja: sat odbrojava, svaka kontrolna točka dodaje vrijeme. Kraj kad vrijeme istekne.
export class EndlessRun {
  constructor(track) {
    this.track = track;
    this.idx = track.startIndex;
    this.startIdx = track.startIndex;
    this.timeLeft = 35;
    this.distance = 0;
    this.over = false;
    this.message = null;
    this.messageUntil = 0;
    this.time = 0;
    this.gates = [];
    track.gates = this.gates;
    this.nextGate = this.startIdx + GATE_EVERY;
    this.gates.push({ idx: this.nextGate, passed: false });
    this.key = `ccow.endless.${track.seedKey}`;
    try { this.best = Number(localStorage.getItem(this.key)) || 0; } catch { this.best = 0; }
  }

  update(car, dt) {
    this.time += dt;
    if (this.over) return;
    const t = this.track;
    const idx = t.nearestIndex(car.x, car.y, this.idx);
    t.update(idx);
    this.idx = idx;
    this.distance = Math.max(this.distance, idx - this.startIdx);
    if (idx >= this.nextGate) {
      const n = Math.round((this.nextGate - this.startIdx) / GATE_EVERY);
      const bonus = Math.max(7, 14 - n * 0.5);
      this.timeLeft += bonus;
      this.gates.find((g) => g.idx === this.nextGate).passed = true;
      this.say(`Kontrolna točka +${bonus.toFixed(1)} s`);
      this.nextGate += GATE_EVERY;
      this.gates.push({ idx: this.nextGate, passed: false });
    }
    for (let i = this.gates.length - 1; i >= 0; i--) if (this.gates[i].idx < t.offset) this.gates.splice(i, 1);
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.over = true;
      this.onOver?.(this.distance);
      if (this.distance > this.best) {
        this.best = this.distance;
        this.newBest = true;
        try { localStorage.setItem(this.key, String(this.best)); } catch { /* bez spremanja */ }
      }
    }
  }

  say(text) {
    this.message = text;
    this.messageUntil = this.time + 2;
  }
}
