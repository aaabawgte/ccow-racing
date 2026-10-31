// HUD i telemetrija, crtano u pikselima ekrana.
import { drawPortrait } from './portrait.js';
import { RARITIES } from './characters.js';

const ACCENT = '#ff8a1f';
const PANEL = 'rgba(14, 16, 20, 0.72)';
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function formatTime(t) {
  if (t === null || t === undefined) return '–:––.–––';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PANEL;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
}

function text(ctx, str, x, y, size, color = '#fff', align = 'left', weight = 600) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(str, x, y);
}

function slipColor(s) {
  if (s < 0.8) return '#4cc26a';
  if (s < 1.15) return '#f2c94c';
  return '#eb4d3d';
}

export class Hud {
  constructor() {
    this.history = [];
    this.sampleAcc = 0;
    this.toasts = [];
    this.clock = 0;
  }

  // Obavijesti o zaradi (kune, medalje, level) koje se slažu jedna ispod druge.
  toast(items) {
    for (const it of items) this.toasts.push({ ...it, until: this.clock + (it.big ? 4 : 3) });
  }

  drawToasts(ctx, w) {
    this.toasts = this.toasts.filter((t) => t.until > this.clock);
    let y = 150;
    for (const t of this.toasts.slice(-6)) {
      const a = Math.min(1, (t.until - this.clock) * 2);
      ctx.globalAlpha = a;
      panel(ctx, w - 246, y, 230, t.sub ? 46 : 32);
      text(ctx, t.text, w - 232, y + 21, t.big ? 17 : 15, t.big ? ACCENT : '#7ee08f', 'left', 800);
      if (t.sub) text(ctx, t.sub, w - 232, y + 38, 11, '#aab');
      ctx.globalAlpha = 1;
      y += (t.sub ? 46 : 32) + 6;
    }
  }

  record(car, drift, dt) {
    this.clock += dt;
    this.sampleAcc += dt;
    while (this.sampleAcc >= 1 / 30) {
      this.sampleAcc -= 1 / 30;
      this.history.push({ v: car.speed * 3.6, a: drift.angle, t: car.throttle, b: car.brake });
      if (this.history.length > 300) this.history.shift();
    }
  }

  draw(ctx, w, h, { car, laps, run, drift, settings, track, driver }) {
    ctx.textBaseline = 'alphabetic';
    const timer = run || laps;
    if (run) this.drawRun(ctx, run);
    else this.drawLaps(ctx, laps);
    this.drawDrift(ctx, w, drift, timer);
    this.drawInfo(ctx, w, car, track, settings, driver);
    this.drawSpeed(ctx, w, h, car, settings);
    this.drawInputs(ctx, h, car, drift);
    if (settings.telemetry) this.drawTelemetry(ctx, w, h);
    this.drawToasts(ctx, w);
    if (run?.over) this.drawRunOver(ctx, w, h, run);
  }

  drawRun(ctx, run) {
    panel(ctx, 16, 16, 210, 104);
    text(ctx, 'Beskrajna · preostalo', 30, 40, 13, '#aab');
    text(ctx, `${run.timeLeft.toFixed(1)} s`, 30, 70, 28, run.timeLeft < 8 ? '#ff6b5b' : '#fff', 'left', 700);
    text(ctx, `Udaljenost  ${(run.distance / 1000).toFixed(2)} km`, 30, 92, 13, ACCENT);
    text(ctx, `Rekord danas  ${(run.best / 1000).toFixed(2)} km`, 30, 110, 13, '#ccd');
  }

  drawRunOver(ctx, w, h, run) {
    const pw = 360, ph = 150, x = w / 2 - pw / 2, y = h / 2 - ph / 2;
    panel(ctx, x, y, pw, ph);
    text(ctx, 'Vrijeme je isteklo', w / 2, y + 40, 20, '#fff', 'center', 800);
    text(ctx, `${(run.distance / 1000).toFixed(2)} km`, w / 2, y + 84, 36, ACCENT, 'center', 800);
    text(ctx, run.newBest ? 'Novi rekord dana!' : `Rekord dana: ${(run.best / 1000).toFixed(2)} km`, w / 2, y + 110, 13, run.newBest ? '#7ee08f' : '#ccd', 'center');
    text(ctx, 'R za novu vožnju · Esc za izbornik', w / 2, y + 134, 12, '#aab', 'center');
  }

  drawLaps(ctx, laps) {
    panel(ctx, 16, 16, 210, 104);
    text(ctx, laps.lapStart === null ? 'Prođi start' : `Krug ${laps.lap + 1}`, 30, 40, 13, '#aab');
    text(ctx, formatTime(laps.current), 30, 70, 28, '#fff', 'left', 700);
    text(ctx, `Najbolji  ${formatTime(laps.best)}`, 30, 92, 13, ACCENT);
    text(ctx, `Zadnji    ${formatTime(laps.last)}`, 30, 110, 13, '#ccd');
    if (laps.penalty > 0) text(ctx, `+${laps.penalty} s`, 212, 70, 14, '#ff6b5b', 'right', 700);
  }

  drawDrift(ctx, w, drift, laps) {
    const cx = w / 2;
    if (drift.active) {
      const pts = Math.round(drift.pending * drift.combo).toLocaleString('hr-HR');
      text(ctx, 'DRIFT', cx, 44, 14, ACCENT, 'center', 800);
      text(ctx, pts, cx, 82, 38, '#fff', 'center', 800);
      text(ctx, `x${drift.combo.toFixed(1)}${drift.zone ? `  ·  ${drift.zone.label}` : ''}`, cx, 104, 16, ACCENT, 'center', 700);
    } else if (drift.message && drift.messageTime > 0) {
      const lost = drift.message.includes('izgubljen');
      text(ctx, drift.message, cx, 70, lost ? 22 : 34, lost ? '#ff6b5b' : '#7ee08f', 'center', 800);
    }
    if (laps.message && laps.time < laps.messageUntil) text(ctx, laps.message, cx, 140, 20, '#fff', 'center', 700);
    text(ctx, `Drift bodovi  ${drift.total.toLocaleString('hr-HR')}`, cx, 24, 12, '#dde', 'center', 600);
  }

  drawInfo(ctx, w, car, track, settings, driver) {
    const x = w - 330;
    panel(ctx, x, 16, 314, 96);
    let tx = x + 14;
    if (driver) {
      ctx.save();
      ctx.translate(x + 12, 24);
      ctx.beginPath();
      ctx.roundRect(0, 0, 64, 64, 8);
      ctx.clip();
      drawPortrait(ctx, driver.look, 64, RARITIES[driver.rarity].color);
      ctx.restore();
      tx = x + 88;
      text(ctx, driver.name, tx, 38, 14, '#fff', 'left', 700);
    }
    text(ctx, `${car.spec.name} · ${car.spec.drivetrain}`, tx, driver ? 56 : 40, 12, '#dde');
    text(ctx, track.name, tx, driver ? 72 : 58, 12, '#aab');
    text(ctx, `P postavke · T telemetrija · C kamera · M mjenjač (${settings.auto ? 'auto' : 'Q/E'})`, x + 14, 104, 10.5, '#889');
  }

  drawSpeed(ctx, w, h, car, settings) {
    const x = w - 246, y = h - 136;
    panel(ctx, x, y, 230, 120);
    text(ctx, String(Math.round(car.speed * 3.6)), x + 16, y + 58, 48, '#fff', 'left', 800);
    text(ctx, 'km/h', x + 18, y + 76, 12, '#aab');
    const gear = car.gear === -1 ? 'R' : car.gear === 0 ? 'N' : String(car.gear);
    text(ctx, gear, x + 214, y + 58, 48, ACCENT, 'right', 800);
    text(ctx, settings.auto ? 'AUTO' : 'RUČNI', x + 214, y + 76, 11, '#aab', 'right');

    const e = car.spec.engine;
    const bx = x + 16, by = y + 90, bw = 198, bh = 10;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(bx, by, bw, bh);
    const ratio = Math.min(1, car.rpm / e.limiter);
    ctx.fillStyle = car.rpm > e.redline ? '#eb4d3d' : car.rpm > e.redline * 0.85 ? ACCENT : '#e8e8ec';
    ctx.fillRect(bx, by, bw * ratio, bh);
    ctx.fillStyle = '#eb4d3d';
    ctx.fillRect(bx + bw * (e.redline / e.limiter), by - 2, 2, bh + 4);
    text(ctx, `${Math.round(car.rpm)} o/min`, bx, by + 24, 11, '#aab');
  }

  drawInputs(ctx, h, car, drift) {
    const x = 16, y = h - 136;
    panel(ctx, x, y, 260, 120);
    const bars = [
      ['G', car.throttle, '#4cc26a'],
      ['K', car.brake, '#eb4d3d'],
      ['R', car.handbrake, '#f2c94c'],
    ];
    bars.forEach(([label, v, color], i) => {
      const bx = x + 16 + i * 22, by = y + 14, bh = 76;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(bx, by, 12, bh);
      ctx.fillStyle = color;
      ctx.fillRect(bx, by + bh * (1 - v), 12, bh * v);
      text(ctx, label, bx + 6, by + bh + 16, 11, '#aab', 'center');
    });

    // volan
    const sx = x + 92, sy = y + 22, sw = 80;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(sx, sy, sw, 8);
    const st = car.steer / car.spec.maxSteer;
    ctx.fillStyle = '#e8e8ec';
    ctx.fillRect(sx + sw / 2, sy, (-st * sw) / 2, 8);
    text(ctx, `Kut ${Math.round(drift.angle)}°`, sx, sy + 34, 16, '#fff', 'left', 700);
    text(ctx, car.wheels[2].surface.name, sx, sy + 54, 12, '#aab');
    text(ctx, `${Math.round(car.steer * 57.3)}° kotači`, sx, sy + 72, 12, '#aab');

    // klizanje po kotaču (pogled odozgo, prednji kotači gore)
    const cx = x + 210, cy = y + 60;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cx - 16, cy - 34, 32, 68, 8);
    ctx.stroke();
    const pos = [[-22, -24], [22, -24], [-22, 24], [22, 24]];
    car.wheels.forEach((wh, i) => {
      ctx.fillStyle = slipColor(wh.slip);
      ctx.fillRect(cx + pos[i][0] - 5, cy + pos[i][1] - 10, 10, 20);
    });
  }

  drawTelemetry(ctx, w, h) {
    const pw = 440, ph = 140, x = w / 2 - pw / 2, y = h - ph - 16;
    panel(ctx, x, y, pw, ph);
    const gx = x + 12, gy = y + 26, gw = pw - 24, gh = ph - 40;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(gx, gy + (gh * i) / 4);
      ctx.lineTo(gx + gw, gy + (gh * i) / 4);
      ctx.stroke();
    }
    const series = [
      ['brzina (0–250)', '#ffffff', (p) => p.v / 250],
      ['kut (0–90°)', ACCENT, (p) => p.a / 90],
      ['gas', '#4cc26a', (p) => p.t],
      ['kočnica', '#eb4d3d', (p) => p.b],
    ];
    series.forEach(([label, color, f], k) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = k < 2 ? 2 : 1.2;
      ctx.beginPath();
      this.history.forEach((p, i) => {
        const px = gx + (i / 299) * gw;
        const py = gy + gh * (1 - Math.min(1, Math.max(0, f(p))));
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      });
      ctx.stroke();
      text(ctx, label, gx + k * 105, y + 17, 11, color, 'left', 600);
    });
  }
}
