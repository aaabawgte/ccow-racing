// Razvojni panel za odokativno podešavanje vožnje uživo.
import { CARS, cloneSpec } from './cars.js';

const DEG = 180 / Math.PI;

const SLIDERS = [
  ['Motor'],
  ['Snaga motora', '%', 50, 300, 5, (s) => s.engine.powerMul * 100, (s, v) => (s.engine.powerMul = v / 100)],
  ['Završni prijenos', '', 2.5, 5.5, 0.01, (s) => s.finalDrive, (s, v) => (s.finalDrive = v)],
  ['Najveća vuča', 'm/s²', 4, 20, 0.5, (s) => s.handling.traction, (s, v) => (s.handling.traction = v)],
  ['Grip'],
  ['Bočno prianjanje', 'm/s²', 10, 40, 0.5, (s) => s.handling.grip, (s, v) => (s.handling.grip = v)],
  ['Najbrže okretanje', 'rad/s', 1, 4, 0.05, (s) => s.handling.turnRate, (s, v) => (s.handling.turnRate = v)],
  ['Maks. kut kotača', '°', 20, 65, 1, (s) => s.maxSteer * DEG, (s, v) => (s.maxSteer = v / DEG)],
  ['Brzina volana', '°/s', 100, 600, 10, (s) => s.steerSpeed * DEG, (s, v) => (s.steerSpeed = v / DEG)],
  ['Drift'],
  ['Savijanje putanje u driftu', 'm/s²', 2, 25, 0.5, (s) => s.handling.driftGrip, (s, v) => (s.handling.driftGrip = v)],
  ['Volan steže liniju', 'm/s²', 0, 20, 0.5, (s) => s.handling.driftSteer, (s, v) => (s.handling.driftSteer = v)],
  ['Prebacivanje kontrom', '', 0, 4, 0.1, (s) => s.handling.flick, (s, v) => (s.handling.flick = v)],
  ['Gas širi liniju', 'm/s²', 0, 10, 0.5, (s) => s.handling.throttleSlide, (s, v) => (s.handling.throttleSlide = v)],
  ['Najveći kut drifta', '°', 25, 80, 1, (s) => s.handling.maxAngle, (s, v) => (s.handling.maxAngle = v)],
  ['Odziv kuta', '', 1, 10, 0.1, (s) => s.handling.angleResponse, (s, v) => (s.handling.angleResponse = v)],
  ['Trzaj pri ulasku', 'rad/s', 0, 3, 0.05, (s) => s.handling.entryKick, (s, v) => (s.handling.entryKick = v)],
  ['Najmanja brzina za ulazak', 'km/h', 10, 80, 1, (s) => s.handling.entrySpeed * 3.6, (s, v) => (s.handling.entrySpeed = v / 3.6)],
  ['Zadržavanje brzine', '%', 0, 100, 1, (s) => s.handling.speedKeep * 100, (s, v) => (s.handling.speedKeep = v / 100)],
  ['Kočnice'],
  ['Kočnica', 'm/s²', 4, 20, 0.5, (s) => s.handling.brake, (s, v) => (s.handling.brake = v)],
  ['Prianjanje uz ručnu', 'm/s²', 0.5, 10, 0.5, (s) => s.handling.handbrakeGrip, (s, v) => (s.handling.handbrakeGrip = v)],
];

function fmt(v, step) {
  const decimals = step < 0.1 ? 2 : step < 1 ? 1 : 0;
  return Number(v).toFixed(decimals);
}

export class TuningPanel {
  constructor(root, { settings, getCar, onCarChange }) {
    this.root = root;
    this.settings = settings;
    this.getCar = getCar;
    this.onCarChange = onCarChange;
    this.controls = [];
    this.build();
  }

  toggle() {
    this.root.classList.toggle('open');
    if (this.root.classList.contains('open')) this.sync();
  }

  build() {
    const r = this.root;
    r.innerHTML = '';
    const head = el('div', 'tuning-head');
    head.append(el('h2', '', 'Postavke vožnje'));
    const close = el('button', 'icon', '×');
    close.title = 'Zatvori (P)';
    close.onclick = () => this.toggle();
    head.append(close);
    r.append(head);

    const carSel = this.select('Auto', CARS.map((c) => [c.id, `${c.cls} · ${c.name}`]), () => this.getCar().spec.id, (v) => this.onCarChange(v));
    r.append(carSel);
    r.append(this.check('Automatski mjenjač', 'auto'));
    r.append(this.check('Kamera se okreće s autom', 'rotateCamera'));
    r.append(this.check('Telemetrija', 'telemetry'));

    for (const row of SLIDERS) {
      if (row.length === 1) {
        r.append(el('h3', '', row[0]));
        continue;
      }
      const [label, unit, min, max, step, get, set] = row;
      // Auto s promijenjenim postavkama ne ide na ljestvicu.
      r.append(this.slider(label, unit, min, max, step, () => get(this.getCar().spec), (v) => { set(this.getCar().spec, v); this.getCar().spec.devTuned = true; }));
    }

    const actions = el('div', 'actions');
    const reset = el('button', '', 'Vrati tvorničke');
    reset.onclick = () => {
      const car = this.getCar();
      car.spec = cloneSpec(CARS.find((c) => c.id === car.spec.id));
      this.sync();
    };
    const copy = el('button', '', 'Kopiraj postavke');
    copy.onclick = async () => {
      const json = JSON.stringify(this.getCar().spec, (k, v) => (k.startsWith('_') ? undefined : v), 2);
      try {
        await navigator.clipboard.writeText(json);
        copy.textContent = 'Kopirano';
      } catch {
        console.log(json);
        copy.textContent = 'Ispisano u konzolu';
      }
      setTimeout(() => (copy.textContent = 'Kopiraj postavke'), 1500);
    };
    actions.append(reset, copy);
    r.append(actions);
  }

  select(label, options, get, set) {
    const wrap = el('label', 'field');
    wrap.append(el('span', '', label));
    const sel = el('select');
    for (const [value, text] of options) {
      const o = el('option', '', text);
      o.value = value;
      sel.append(o);
    }
    sel.onchange = () => {
      set(sel.value);
      sel.blur();
      this.sync();
    };
    wrap.append(sel);
    this.controls.push(() => (sel.value = get()));
    return wrap;
  }

  slider(label, unit, min, max, step, get, set) {
    const wrap = el('label', 'slider');
    const top = el('span', 'slider-top');
    const val = el('span', 'val');
    top.append(el('span', '', label), val);
    const input = el('input');
    Object.assign(input, { type: 'range', min, max, step });
    input.oninput = () => {
      set(Number(input.value));
      val.textContent = `${fmt(input.value, step)} ${unit}`;
    };
    input.onchange = () => input.blur();
    wrap.append(top, input);
    this.controls.push(() => {
      const v = get();
      input.value = v;
      val.textContent = `${fmt(v, step)} ${unit}`;
    });
    return wrap;
  }

  check(label, key) {
    const wrap = el('label', 'check');
    const box = el('input');
    box.type = 'checkbox';
    box.onchange = () => {
      this.settings[key] = box.checked;
      box.blur();
    };
    wrap.append(box, el('span', '', label));
    this.controls.push(() => (box.checked = !!this.settings[key]));
    return wrap;
  }

  sync() {
    this.controls.forEach((f) => f());
  }
}

function el(tag, cls = '', textContent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (textContent !== undefined) e.textContent = textContent;
  return e;
}
