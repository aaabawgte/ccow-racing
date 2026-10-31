// Kartica Garaža u izborniku: nadogradnje, zamjena pogona, besplatno podešavanje, boja i dim.
import { carById } from './cars.js';
import { CHARACTERS } from './characters.js';
import { kn } from './economy.js';
import {
  UPGRADES, STAGES, TUNING, PAINTS, SMOKES, PAINT_COST, SMOKE_COST,
  buildSpec, performanceIndex, piClass, swapCost,
} from './upgrades.js';

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function statBar(label, value, stock, max, unit, fmt = (v) => Math.round(v)) {
  const row = el('div', 'stat');
  const diff = value - stock;
  const delta = Math.abs(diff) > 1e-6 ? `<b class="${diff > 0 ? 'up' : 'down'}">${diff > 0 ? '+' : ''}${fmt(diff)}</b>` : '';
  row.innerHTML = `<span>${label}</span><i style="--w:${Math.min(100, (stock / max) * 100)}%;--v:${Math.min(100, (value / max) * 100)}%"></i><em>${fmt(value)} ${unit} ${delta}</em>`;
  return row;
}

export function renderGarage(menu, drawCarPreview) {
  const p = menu.profile;
  const id = menu.selection.car;
  if (!p.started || !p.ownsCar(id)) {
    menu.body.append(el('p', 'help', 'Garaža je za aute koje imaš. Odaberi ili kupi auto u kartici Auto.'));
    return;
  }
  const base = carById(id);
  const owner = CHARACTERS.find((c) => c.car === id);
  const entry = p.garageEntry(id);
  const spec = buildSpec(base, { ...entry, color: entry.color || owner?.carColor });
  const stock = buildSpec(base, {});
  const up = entry.up;
  const body = menu.body;
  const refresh = () => { menu.keepScroll = true; menu.render(); };

  // Pregled auta i brojke
  const top = el('div', 'garage-top');
  const cv = el('canvas');
  cv.width = 480;
  cv.height = 220;
  drawCarPreview(cv, spec);
  top.append(cv);
  const info = el('div', 'garage-info');
  const pi = performanceIndex(spec), cls = piClass(pi);
  const stockPi = performanceIndex(stock);
  info.append(el('h2', '', `${base.name} <span class="pi" style="--c:${cls.color}">${cls.id} · PI ${pi}</span>`));
  info.append(el('small', '', `${spec.drivetrain}${entry.drivetrain ? ' (zamijenjen)' : ''} · tvornički PI ${stockPi} · uloženo ${kn(entry.spent || 0)}`));
  const h = spec.handling, sh = stock.handling;
  info.append(statBar('Snaga', spec.kw * 1.36 * spec.engine.powerMul / 1.3, stock.kw * 1.36 * stock.engine.powerMul / 1.3, 900, 'KS'));
  info.append(statBar('Masa', spec.mass, stock.mass, 2200, 'kg'));
  info.append(statBar('Prianjanje', h.grip, sh.grip, 36, '', (v) => v.toFixed(1)));
  info.append(statBar('Kočnice', h.brake, sh.brake, 18, '', (v) => v.toFixed(1)));
  info.append(statBar('Kut drifta', h.maxAngle, sh.maxAngle, 85, '°'));
  top.append(info);
  body.append(top);

  // Nadogradnje
  body.append(el('h3', '', 'Nadogradnje · ulični / sportski / trkaći'));
  const grid = el('div', 'grid upgrades');
  for (const u of UPGRADES) {
    const card = el('div', 'upgrade');
    const n = up[u.id] || 0;
    card.append(el('strong', '', u.name));
    card.append(el('div', 'pips', [1, 2, 3].map((k) => `<span class="${k <= n ? 'on' : ''}" title="${STAGES[k - 1]}: ${u.parts[k - 1]}"></span>`).join('')));
    card.append(el('small', '', n ? `${STAGES[n - 1]}: ${u.parts[n - 1]}` : 'Tvornički'));
    const st = p.upgradeStatus(id, u.id);
    const b = el('button', 'buy');
    if (st.maxed) {
      b.textContent = 'Najviši stupanj';
      b.disabled = true;
    } else {
      b.textContent = `${u.parts[st.stage - 1]} · ${kn(st.cost)}`;
      b.disabled = !st.ok;
      if (!st.ok) b.title = st.reason;
      b.onclick = () => { if (p.buyUpgrade(id, u.id)) { menu.toast([{ text: `${u.parts[st.stage - 1]} ugrađen` }]); refresh(); } };
    }
    card.append(b);
    grid.append(card);
  }
  body.append(grid);

  // Zamjena pogona
  body.append(el('h3', '', `Zamjena pogona · ${kn(swapCost(base))} (povratak na tvornički je besplatan)`));
  const swap = el('div', 'swap');
  for (const dt of ['RWD', 'FWD', 'AWD']) {
    const b = el('button', 'tab', dt === base.drivetrain ? `${dt} (tvornički)` : dt);
    if (dt === spec.drivetrain) b.classList.add('active');
    else {
      const cost = dt === base.drivetrain ? 0 : swapCost(base);
      b.disabled = p.kune < cost;
      b.onclick = () => { if (p.buySwap(id, dt)) { menu.toast([{ text: `Pogon: ${dt}` }]); refresh(); } };
    }
    swap.append(b);
  }
  body.append(swap);

  // Besplatno podešavanje
  body.append(el('h3', '', 'Podešavanje · besplatno, koliko dijelovi dopuštaju'));
  const tune = el('div', 'tuning-grid');
  // raspon se računa na autu s nadogradnjama, ali bez podešavanja
  const untuned = buildSpec(base, { ...entry, tune: {} });
  for (const t of TUNING) {
    const r = t.range(untuned, up);
    const row = el('label', `tune${r ? '' : ' locked'}`);
    const def = t.base(untuned);
    const cur = entry.tune[t.id] ?? def;
    const val = el('em', '', r ? `${(+cur).toFixed(t.step < 1 ? 2 : 0)} ${t.unit}` : 'zaključano');
    row.append(el('span', '', t.name), val);
    const input = el('input');
    Object.assign(input, { type: 'range', step: t.step, min: r ? r.min : 0, max: r ? r.max : 1, value: r ? cur : 0, disabled: !r });
    input.oninput = () => { val.textContent = `${(+input.value).toFixed(t.step < 1 ? 2 : 0)} ${t.unit}`; };
    input.onchange = () => { p.setTune(id, t.id, Number(input.value)); refresh(); };
    row.append(input, el('small', '', t.hint));
    tune.append(row);
  }
  body.append(tune);
  const reset = el('button', 'sell', 'Vrati tvorničko podešavanje');
  reset.onclick = () => { p.resetTune(id); refresh(); };
  body.append(reset);

  // Boja i dim
  body.append(el('h3', '', `Boja · ${kn(PAINT_COST)}`));
  const paints = el('div', 'swatches');
  for (const c of PAINTS) {
    const b = el('button', `swatch${spec.color === c ? ' active' : ''}`);
    b.style.background = c;
    b.title = c;
    b.disabled = p.kune < PAINT_COST && spec.color !== c;
    b.onclick = () => { if (p.buyPaint(id, c)) refresh(); };
    paints.append(b);
  }
  body.append(paints);
  body.append(el('h3', '', `Dim guma u boji · ${kn(SMOKE_COST)}`));
  const smokes = el('div', 'swatches');
  for (const c of SMOKES) {
    const b = el('button', `swatch smoke${(spec.smoke || null) === c ? ' active' : ''}`);
    b.style.background = c || 'repeating-linear-gradient(45deg, #ddd 0 4px, #999 4px 8px)';
    b.title = c ? c : 'Obični bijeli dim';
    b.disabled = p.kune < (c ? SMOKE_COST : 0) && (spec.smoke || null) !== c;
    b.onclick = () => { if (p.buySmoke(id, c)) refresh(); };
    smokes.append(b);
  }
  body.append(smokes);
}
