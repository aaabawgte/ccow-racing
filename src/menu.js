// Izbornik prije vožnje: vozač, auto, staza. Prikazuje kune i level, a vozači i auti se ovdje kupuju.
// Prvi vozač (Prodajni savjetnik) je besplatan i dolazi sa svojim autom.
import { CHARACTERS, RARITIES, characterById } from './characters.js';
import { CARS, CLASSES, carById } from './cars.js';
import { TRACKS } from './tracks.js';
import { drawPortrait } from './portrait.js';
import { drawCarBody } from './render.js';
import { kn, MEDALS, xpForLevel, weeklySpecial, lapReward } from './economy.js';
import { formatTime } from './hud.js';
import { renderGarage } from './garage.js';
import { buildSpec, performanceIndex, piClass } from './upgrades.js';
import { api } from './api.js';
import { dailySeed } from './endless.js';

const STORE_KEY = 'ccow.selection';
const DEFAULT = { driver: 'bruno', car: 'p208', track: 'parking' };

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function loadSelection() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && characterById(s.driver) && carById(s.car) && (s.track === 'endless' || TRACKS.some((t) => t.id === s.track))) return s;
  } catch { /* prazno */ }
  return { ...DEFAULT };
}

export class Menu {
  constructor(root, { profile, account, buildTrack, onStart }) {
    this.root = root;
    this.profile = profile;
    this.account = account;
    this.lbClass = '';
    account.onChange(() => { if (this.open) { this.keepScroll = true; this.render(); } });
    this.buildTrack = buildTrack;
    this.onStart = onStart;
    this.selection = loadSelection();
    this.tab = 'driver';
    this.open = false;
    this.focus = null; // vozač ili auto koji je kliknut, za kupnju i prodaju
    this.toasts = [];
    this.build();
    profile.onChange(() => { if (this.open) this.renderHeader(); });
  }

  // Odabir mora biti nešto što igrač posjeduje.
  validate() {
    const p = this.profile, s = this.selection;
    if (!p.started) return;
    if (!p.ownsDriver(s.driver)) s.driver = p.data.drivers[0];
    if (!p.ownsCar(s.car)) s.car = p.data.cars[0];
  }

  show() {
    this.open = true;
    this.root.classList.remove('hidden');
    this.validate();
    this.render();
  }

  hide() {
    this.open = false;
    this.root.classList.add('hidden');
  }

  toast(items) {
    for (const it of items) this.toasts.push(it);
    if (this.open) this.renderHeader();
  }

  start() {
    if (!this.account.ready) return;
    if (!this.profile.started) {
      this.setDetail('Prvo odaberi svog prvog vozača.');
      return;
    }
    this.validate();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(this.selection)); } catch { /* bez spremanja */ }
    this.onStart({ ...this.selection });
  }

  build() {
    const r = this.root;
    r.innerHTML = '';
    const card = el('div', 'menu-card');
    const head = el('div', 'menu-head');
    head.append(el('h1', '', 'CCOW <span>RACING</span>'));
    this.wallet = el('div', 'wallet');
    head.append(this.wallet);
    card.append(head);
    this.summary = el('div', 'menu-summary');
    card.append(this.summary);

    const tabs = el('div', 'menu-tabs');
    this.tabsEl = tabs;
    this.tabButtons = {};
    for (const [id, label] of [['driver', '1 · Vozač'], ['car', '2 · Auto'], ['garage', '3 · Garaža'], ['track', '4 · Staza'], ['help', 'Kontrole i pravila']]) {
      const b = el('button', 'tab', label);
      b.onclick = () => { this.tab = id; this.focus = null; this.render(); };
      this.tabButtons[id] = b;
      tabs.append(b);
    }
    card.append(tabs);
    this.body = el('div', 'menu-body');
    card.append(this.body);

    const foot = el('div', 'menu-foot');
    this.detail = el('div', 'menu-detail');
    foot.append(this.detail);
    const go = el('button', 'start', 'Vozi (Enter)');
    go.onclick = () => this.start();
    this.goButton = go;
    foot.append(go);
    card.append(foot);
    r.append(card);
  }

  renderHeader() {
    const p = this.profile;
    const lv = p.level, lo = xpForLevel(lv), hi = xpForLevel(lv + 1);
    const pct = Math.round(((p.xp - lo) / (hi - lo)) * 100);
    const a = this.account;
    this.wallet.innerHTML = a.ready ? `<span class="kune">${kn(p.kune)}</span>
      <span class="level">Level ${lv}<i style="--p:${pct}%"></i></span>` : '';
    const who = el('span', 'who');
    if (a.user) {
      who.innerHTML = `${escapeHtml(a.user.name)} <small>${escapeHtml(a.status)}</small> `;
      const out = el('button', 'link', 'Odjava');
      out.onclick = () => a.logout();
      who.append(out);
    } else if (a.offline) {
      who.innerHTML = 'Bez računa ';
      const inn = el('button', 'link', 'Prijavi se');
      inn.onclick = () => { a.offline = false; this.render(); };
      who.append(inn);
    }
    this.wallet.append(who);
    if (this.toasts.length) {
      const t = this.toasts.map((x) => `<b>${x.text}</b> ${x.sub || ''}`).join(' · ');
      this.wallet.insertAdjacentHTML('beforeend', `<span class="earned">${t}</span>`);
      this.toasts = [];
    }
  }

  render() {
    this.renderHeader();
    if (!this.account.ready) {
      this.tabsEl.style.display = 'none';
      this.summary.innerHTML = 'Prijavi se da ti se napredak sprema na server i da budeš na ljestvicama kolega.';
      this.body.innerHTML = '';
      this.renderAccount();
      this.goButton.disabled = true;
      this.setDetail('');
      return;
    }
    this.tabsEl.style.display = '';
    this.validate();
    for (const [id, b] of Object.entries(this.tabButtons)) b.classList.toggle('active', id === this.tab);
    const p = this.profile, s = this.selection;
    if (p.started) {
      const d = characterById(s.driver), c = carById(s.car);
      const t = s.track === 'endless' ? 'Beskrajna staza' : TRACKS.find((x) => x.id === s.track).name;
      this.summary.textContent = `${d.name} · ${c.name} · ${t}`;
    } else {
      this.summary.innerHTML = '<b>Dobrodošao!</b> Odaberi svog prvog vozača. Prodajni savjetnik je besplatan i dolazi sa svojim autom, a dobivaš i 2.000 kn za početak.';
    }
    this.goButton.disabled = !p.started;
    const scroll = this.body.scrollTop;
    this.body.innerHTML = '';
    if (this.tab === 'driver') this.renderDrivers();
    else if (this.tab === 'car') this.renderCars();
    else if (this.tab === 'garage') renderGarage(this, drawCarPreview);
    else if (this.tab === 'track') this.renderTracks();
    else this.renderHelp();
    this.body.scrollTop = this.keepScroll ? scroll : 0;
    this.keepScroll = false;
    this.renderDetail();
  }

  setDetail(html, action) {
    this.detail.innerHTML = '';
    this.detail.append(el('span', '', html));
    if (action) {
      const b = el('button', action.primary ? 'buy' : 'sell', action.label);
      b.disabled = !!action.disabled;
      b.onclick = action.run;
      this.detail.append(b);
    }
  }

  renderDetail() {
    const p = this.profile, f = this.focus;
    if (!f) {
      this.setDetail(p.started ? 'Esc vraća u izbornik tijekom vožnje.' : 'Klikni Prodajnog savjetnika da ga uzmeš besplatno.');
      return;
    }
    if (f.type === 'driver') {
      const ch = characterById(f.id), st = p.driverStatus(f.id);
      if (st.ok) this.setDetail(`${ch.name} · ${RARITIES[ch.rarity].name}`, { label: `Kupi za ${kn(st.price)}`, primary: true, run: () => this.buyDriver(f.id) });
      else this.setDetail(`${ch.name}: ${st.reason}`, { label: `Kupi za ${kn(RARITIES[ch.rarity].price)}`, primary: true, disabled: true });
    } else {
      const spec = carById(f.id);
      if (p.ownsCar(f.id)) {
        const canSell = spec.cls !== 'S' && p.data.cars.length > 1;
        this.setDetail(`${spec.name} je u tvojoj garaži. Nadogradnje i boje su u kartici Garaža.`, canSell ? { label: `Prodaj za ${kn(p.sellValue(f.id))}`, run: () => this.sellCar(f.id) } : null);
      } else {
        const st = p.carStatus(f.id);
        if (st.ok) this.setDetail(spec.name, { label: `Kupi za ${kn(st.price)}`, primary: true, run: () => this.buyCar(f.id) });
        else this.setDetail(`${spec.name}: ${st.reason}`, spec.cls === 'S' ? null : { label: `Kupi za ${kn(spec.price)}`, primary: true, disabled: true });
      }
    }
  }

  buyDriver(id) {
    if (!this.profile.buyDriver(id)) return;
    this.selection.driver = id;
    const ch = characterById(id);
    if (ch.car) this.selection.car = ch.car;
    this.focus = null;
    this.keepScroll = true;
    this.toast([{ text: `${ch.name} je tvoj!` }]);
    this.render();
  }

  buyCar(id) {
    if (!this.profile.buyCar(id)) return;
    this.selection.car = id;
    this.focus = null;
    this.keepScroll = true;
    this.toast([{ text: `${carById(id).name} je u garaži!` }]);
    this.render();
  }

  sellCar(id) {
    const v = this.profile.sellCar(id);
    if (!v) return;
    if (this.selection.car === id) this.selection.car = this.profile.data.cars[0];
    this.focus = null;
    this.keepScroll = true;
    this.toast([{ text: `Prodano za ${kn(v)}` }]);
    this.render();
  }

  clickDriver(ch) {
    const p = this.profile;
    if (!p.started) {
      if (ch.rarity !== 'common') {
        this.setDetail('Za početak možeš uzeti samo Prodajnog savjetnika.');
        return;
      }
      p.chooseFirstDriver(ch.id);
      this.selection.driver = ch.id;
      this.selection.car = ch.car;
      this.tab = 'car';
      this.toast([{ text: `${ch.name} je tvoj vozač!`, sub: `${carById(ch.car).name} je u garaži` }]);
      this.toast(p.dailyLogin());
      this.render();
      return;
    }
    if (p.ownsDriver(ch.id)) {
      this.selection.driver = ch.id;
      this.focus = null;
      this.tab = 'car';
    } else {
      this.focus = { type: 'driver', id: ch.id };
      this.keepScroll = true;
    }
    this.render();
  }

  clickCar(spec) {
    if (this.profile.ownsCar(spec.id)) {
      if (this.selection.car === spec.id && this.focus?.id === spec.id) {
        this.focus = null;
        this.tab = 'track';
      } else {
        this.selection.car = spec.id;
        this.focus = { type: 'car', id: spec.id };
        this.keepScroll = true;
      }
    } else {
      this.focus = { type: 'car', id: spec.id };
      this.keepScroll = true;
    }
    this.render();
  }

  renderAccount() {
    const wrap = el('div', 'account');
    const mode = this.accountMode || 'login';
    const switcher = el('div', 'swap');
    for (const [id, label] of [['login', 'Prijava'], ['register', 'Novi račun']]) {
      const b = el('button', `tab${id === mode ? ' active' : ''}`, label);
      b.onclick = () => { this.accountMode = id; this.render(); };
      switcher.append(b);
    }
    wrap.append(switcher);
    const form = el('form', 'account-form');
    form.innerHTML = `
      ${mode === 'register' ? '<label>Ime u igri<input name="name" maxlength="24" autocomplete="nickname" required></label>' : ''}
      <label>Email<input name="email" type="email" autocomplete="email" required></label>
      <label>Lozinka${mode === 'register' ? ' (barem 8 znakova)' : ''}<input name="password" type="password" minlength="${mode === 'register' ? 8 : 1}" autocomplete="${mode === 'register' ? 'new-password' : 'current-password'}" required></label>
      <button class="start" type="submit">${mode === 'register' ? 'Napravi račun' : 'Prijavi se'}</button>
      <p class="error"></p>`;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const err = form.querySelector('.error');
      const btn = form.querySelector('button');
      btn.disabled = true;
      err.textContent = '';
      try {
        if (mode === 'register') await this.account.register(f.get('email'), f.get('password'), f.get('name'));
        else await this.account.login(f.get('email'), f.get('password'));
        this.tab = 'driver';
        this.toast(this.profile.dailyLogin());
      } catch (ex) {
        err.textContent = ex.message;
        btn.disabled = false;
      }
    };
    wrap.append(form);
    const off = el('button', 'link', 'Igraj bez računa (napredak ostaje samo u ovom pregledniku)');
    off.onclick = () => this.account.playOffline();
    wrap.append(off);
    this.body.append(wrap);
  }

  // Ljestvica za odabranu stazu; puni se kad server odgovori.
  renderLeaderboard() {
    const id = this.selection.track;
    const box = el('div', 'board');
    const title = id === 'endless' ? 'Ljestvica · Beskrajna danas' : `Ljestvica · ${TRACKS.find((t) => t.id === id).name}`;
    const head = el('div', 'board-head', `<strong>${title}</strong>`);
    if (id !== 'endless') {
      const filters = el('div', 'swap');
      for (const c of ['', 'D', 'C', 'B', 'A', 'A+']) {
        const b = el('button', `tab${c === this.lbClass ? ' active' : ''}`, c || 'Sve klase');
        b.onclick = () => { this.lbClass = c; this.keepScroll = true; this.render(); };
        filters.append(b);
      }
      head.append(filters);
    }
    box.append(head);
    const list = el('ol', 'board-list', '<li class="muted">Učitavam…</li>');
    box.append(list);
    if (!this.account.user) list.innerHTML = '<li class="muted">Prijavi se da tvoja vremena idu na ljestvicu.</li>';
    const extra = id === 'endless' ? `&seed=${dailySeed().key}` : this.lbClass ? `&cls=${encodeURIComponent(this.lbClass)}` : '';
    api.leaderboard(id, extra).then((out) => {
      if (!out.rows.length) { list.innerHTML = '<li class="muted">Još nitko. Budi prvi!</li>'; return; }
      list.innerHTML = out.rows.map((r) => {
        const me = this.account.user && r.name === this.account.user.name ? ' class="me"' : '';
        const score = id === 'endless' ? `${(r.meters / 1000).toFixed(2)} km` : formatTime(r.time);
        const cls = r.cls ? `<span class="pi" style="--c:${piClassColor(r.cls)}">${r.cls}</span> ` : '';
        return `<li${me}><b>${escapeHtml(r.name)}</b><span>${cls}${carById(r.car)?.name || ''} · ${characterById(r.driver)?.name || ''}</span><em>${score}</em></li>`;
      }).join('');
    }).catch((e) => { list.innerHTML = `<li class="muted">${escapeHtml(e.message)}</li>`; });
    this.body.append(box);
  }

  renderDrivers() {
    const p = this.profile;
    const special = weeklySpecial();
    for (const rarity of Object.keys(RARITIES)) {
      const info = RARITIES[rarity];
      const list = CHARACTERS.filter((c) => c.rarity === rarity);
      const extra = rarity === 'special' ? ` · promocija tjedna: ${special.name}` : '';
      this.body.append(el('h3', '', `<span style="color:${info.color}">${info.name}</span> · ${info.role}${extra}`));
      const grid = el('div', 'grid drivers');
      for (const ch of list) {
        const owned = p.ownsDriver(ch.id);
        const b = el('button', 'pick driver');
        if (owned && ch.id === this.selection.driver && p.started) b.classList.add('selected');
        if (this.focus?.id === ch.id) b.classList.add('focused');
        if (!owned) b.classList.add(p.started || rarity !== 'common' ? 'locked' : 'free');
        b.style.setProperty('--rar', info.color);
        const cv = el('canvas');
        cv.width = cv.height = 192;
        drawPortrait(cv.getContext('2d'), ch.look, 192, info.color);
        b.append(cv);
        b.append(el('strong', '', ch.name));
        b.append(el('small', '', ch.car ? carById(ch.car).name : `Promotor · ${ch.dept}`));
        const tag = owned ? 'Tvoj vozač' : !p.started && rarity === 'common' ? 'Besplatno' : kn(info.price);
        b.append(el('em', owned ? 'owned' : '', tag));
        b.onclick = () => this.clickDriver(ch);
        grid.append(b);
      }
      this.body.append(grid);
    }
  }

  renderCars() {
    const p = this.profile;
    const d = characterById(this.selection.driver);
    const groups = [['G', 'Tvoja garaža', CARS.filter((c) => p.ownsCar(c.id))]];
    for (const cls of ['D', 'C', 'B', 'A']) groups.push([cls, `${CLASSES[cls].name} · ${CLASSES[cls].sub}`, CARS.filter((c) => c.cls === cls && !p.ownsCar(c.id))]);
    for (const [cls, title, list] of groups) {
      if (!list.length) continue;
      const color = cls === 'G' ? '#ff8a1f' : CLASSES[cls].color;
      this.body.append(el('h3', '', `<span style="color:${color}">${title}</span>`));
      const grid = el('div', 'grid cars');
      for (const spec of list) {
        const owned = p.ownsCar(spec.id);
        const b = el('button', 'pick car');
        if (owned && spec.id === this.selection.car) b.classList.add('selected');
        if (this.focus?.id === spec.id) b.classList.add('focused');
        if (!owned) b.classList.add(p.kune >= spec.price ? 'affordable' : 'locked');
        b.style.setProperty('--rar', CLASSES[spec.cls].color);
        const cv = el('canvas');
        cv.width = 320;
        cv.height = 150;
        const owner = CHARACTERS.find((c) => c.car === spec.id);
        const g = p.data.garage[spec.id];
        drawCarPreview(cv, { ...spec, color: g?.color || (owner ? owner.carColor : spec.color), aero: g?.up?.aero || 0 });
        b.append(cv);
        b.append(el('strong', '', spec.name));
        const built = buildSpec(spec, p.data.garage[spec.id] || {});
        const pi = performanceIndex(built), pc = piClass(pi);
        b.append(el('small', '', `<span class="pi" style="--c:${pc.color}">${pc.id} ${pi}</span> ${built.drivetrain} · ${Math.round(spec.kw * 1.36)} KS · ${built.mass} kg`));
        b.append(el('em', owned ? 'owned' : '', owned ? (d.car === spec.id ? 'Potpisni auto' : 'U garaži') : kn(spec.price)));
        if (spec.desc) b.title = spec.desc;
        b.onclick = () => this.clickCar(spec);
        grid.append(b);
      }
      this.body.append(grid);
    }
  }

  renderTracks() {
    const p = this.profile;
    this.renderLeaderboard();
    const grid = el('div', 'grid tracks');
    const items = [...TRACKS.map((t) => ({ ...t })),
      { id: 'endless', name: 'Beskrajna staza', desc: 'Cesta se gradi ispred tebe. Kontrolne točke dodaju vrijeme. Današnji seed je isti za sve kolege.', difficulty: 3 }];
    for (const it of items) {
      const b = el('button', 'pick track');
      if (it.id === this.selection.track) b.classList.add('selected');
      const cv = el('canvas');
      cv.width = 360;
      cv.height = 220;
      drawTrackPreview(cv, it.id === 'endless' ? null : this.buildTrack(it.id));
      b.append(cv);
      b.append(el('strong', '', it.name));
      b.append(el('small', '', it.desc));
      if (it.medals) {
        const won = p.data.medals[it.id];
        const best = p.data.best[it.id];
        const m = it.medals;
        b.append(el('div', 'medals', ['gold', 'silver', 'bronze'].map((k) => {
          const have = won && ['bronze', 'silver', 'gold'].indexOf(won) >= ['bronze', 'silver', 'gold'].indexOf(k);
          return `<span class="${have ? 'won' : ''}" style="--m:${MEDALS[k].color}">${m[k]} s</span>`;
        }).join('')));
        b.append(el('em', '', `${'★'.repeat(it.difficulty)}${'☆'.repeat(5 - it.difficulty)} · vožnja ${kn(lapReward(it.difficulty))} · rekord ${best ? formatTime(best) : '–'}`));
      } else {
        const best = p.data.endlessBest[new Date().toISOString().slice(0, 10)];
        b.append(el('em', '', `★★★☆☆ · 300 kn po km · danas ${best ? (best / 1000).toFixed(2) + ' km' : '–'}`));
      }
      b.onclick = () => { this.selection.track = it.id; this.keepScroll = true; this.render(); };
      b.ondblclick = () => { this.selection.track = it.id; this.start(); };
      grid.append(b);
    }
    this.body.append(grid);
  }

  renderHelp() {
    const help = el('div', 'help', `
      <dl class="keys">
        <dt>W / ↑</dt><dd>Gas</dd>
        <dt>S / ↓</dt><dd>Kočnica (držanjem u mjestu: rikverc)</dd>
        <dt>A D / ← →</dt><dd>Volan</dd>
        <dt>Razmaknica</dt><dd>Ručna kočnica</dd>
        <dt>M</dt><dd>Automatski / ručni mjenjač (Q / E)</dd>
        <dt>P</dt><dd>Postavke vožnje</dd>
        <dt>T · C · R</dt><dd>Telemetrija · Kamera · Reset</dd>
        <dt>Esc</dt><dd>Izbornik</dd>
      </dl>
      <p><b>Drift:</b> pun volan + gas pri brzini (ili ručna). Volan u zavoj = dublje, pušten volan = srednji kut, pusti gas ili kontra = izlaz.</p>
      <p><b>Kune:</b> završena vožnja od 3 valjana kruga 300–700 kn (po težini staze), 1 kn na 100 drift bodova, medalje 500 / 1.000 / 2.000 kn jednom po stazi, novi osobni rekord +200 kn, beskrajna 300 kn po km i +1.000 kn za prvu vožnju dana, dnevna prijava 250 kn (niz raste do 1.000 kn). XP raste s kunama, a svaki level daje bonus.</p>
      <p><b>Garaža:</b> svaka nadogradnja ima tri stupnja (ulični, sportski, trkaći) po 5 / 10 / 15% cijene auta. Dijelovi otključavaju besplatno podešavanje. Zamjena pogona stoji 40% cijene, boja 500 kn, dim u boji 1.000 kn. PI raste s nadogradnjama i određuje klasu (D, C, B, A, A+).</p>
      <p><b>Promaknuća:</b> Rare traži level 5 ili 3 commona, Epic zlato na 3 staze, Legendary jednog epica i zlato na 6 staza (dok ne stignu ljestvice). Specijalci se kupuju samo kad su promocija tjedna. Prodani auto vraća 60% cijene.</p>
      <p><b>Kazne:</b> u garaži i na gymkhani udarac u stup je +1 s, srušen čunj +0,5 s. Drift zone množe bodove.</p>
      <p class="hint">Prijavljenom igraču napredak se sprema na server, a vremena idu na ljestvice. Bez računa sve ostaje u ovom pregledniku. Vožnja s promijenjenim postavkama iz panela P ne ide na ljestvicu.</p>`);
    const reset = el('button', 'sell', 'Obriši napredak');
    reset.onclick = () => {
      if (!confirm('Obrisati sav napredak (kune, aute, vozače, medalje)?')) return;
      this.profile.reset();
      this.selection = { ...DEFAULT };
      this.tab = 'driver';
      this.render();
    };
    help.append(reset);
    this.body.append(help);
  }
}

function escapeHtml(t) {
  return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function piClassColor(id) {
  return { D: '#8d8a80', C: '#3f9b5a', B: '#2f78c4', A: '#c8452e', 'A+': '#ff3d71' }[id] || '#666';
}

function drawCarPreview(cv, spec) {
  const g = cv.getContext('2d');
  g.fillStyle = '#2a2d33';
  g.fillRect(0, 0, cv.width, cv.height);
  const k = Math.min((cv.width * 0.8) / spec.length, (cv.height * 0.75) / spec.width) * 0.75;
  g.save();
  g.translate(cv.width / 2, cv.height / 2);
  g.scale(k, -k);
  const wb = spec.wheelbase, tw = spec.trackWidth;
  drawCarBody(g, spec, 0, 0, 0.12, 0.2, false, (i) => [i < 2 ? wb / 2 : -wb / 2, i % 2 === 0 ? tw / 2 : -tw / 2]);
  g.restore();
}

function drawTrackPreview(cv, track) {
  const g = cv.getContext('2d');
  if (!track) {
    g.fillStyle = '#577d47';
    g.fillRect(0, 0, cv.width, cv.height);
    g.strokeStyle = '#3a3e44';
    g.lineWidth = 16;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cv.width * 0.5, cv.height + 10);
    g.bezierCurveTo(cv.width * 0.1, cv.height * 0.7, cv.width * 0.9, cv.height * 0.45, cv.width * 0.45, -10);
    g.stroke();
    g.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    g.lineWidth = 1.5;
    g.setLineDash([6, 8]);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = 'rgba(255, 255, 255, 0.85)';
    g.font = '800 36px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText('∞', cv.width * 0.82, cv.height * 0.28);
    return;
  }
  const b = track.bounds, th = track.theme;
  g.fillStyle = th.outside;
  g.fillRect(0, 0, cv.width, cv.height);
  const k = Math.min((cv.width - 20) / (b.maxX - b.minX), (cv.height - 20) / (b.maxY - b.minY));
  g.save();
  g.translate(cv.width / 2, cv.height / 2);
  g.scale(k, -k);
  g.translate(-(b.minX + b.maxX) / 2, -(b.minY + b.maxY) / 2);
  g.fillStyle = th.base;
  g.fillRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);
  const colors = { asphalt: '#41454b', concrete: '#7c8084', epoxy: '#5a7480', wet: '#2c3238', gravel: '#9b8f7a', tiles: '#a7a196', grass: '#577d47' };
  for (const a of track.areas) {
    g.fillStyle = a.style === 'island' ? '#577d47' : colors[a.surface] || '#666';
    g.beginPath();
    if (a.shape === 'rect') g.rect(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0);
    else if (a.shape === 'circle') g.arc(a.x, a.y, a.r, 0, Math.PI * 2);
    else if (a.shape === 'ring') g.arc(a.x, a.y, a.r1, 0, Math.PI * 2);
    else if (a.shape === 'poly') a.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.fill();
  }
  for (const r of track.roads) {
    g.strokeStyle = '#3a3e44';
    g.lineWidth = r.width;
    g.beginPath();
    r.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.stroke();
  }
  const path = new Path2D();
  track.samples.forEach((s, i) => (i ? path.lineTo(s.x, s.y) : path.moveTo(s.x, s.y)));
  path.closePath();
  if (track.width > 0) {
    g.lineJoin = 'round';
    g.strokeStyle = '#c8352b';
    g.lineWidth = track.width + 2;
    g.stroke(path);
    g.strokeStyle = '#3a3e44';
    g.lineWidth = track.width;
    g.stroke(path);
  }
  for (const o of track.obstacles) {
    if (o.kind === 'tree') { g.fillStyle = '#3c6a37'; g.beginPath(); g.arc(o.x, o.y, o.crown, 0, Math.PI * 2); g.fill(); continue; }
    g.fillStyle = o.kind === 'building' ? '#d8d2c6' : o.kind === 'shop' ? '#2a2c33' : o.kind === 'wall' ? (th.wall || '#8d939a') : o.color || '#c9a24a';
    if (o.type === 'rect') g.fillRect(o.x0, o.y0, o.x1 - o.x0, o.y1 - o.y0);
    else { g.beginPath(); g.arc(o.x, o.y, Math.max(o.r, 1), 0, Math.PI * 2); g.fill(); }
  }
  g.strokeStyle = track.width > 0 ? 'rgba(255, 255, 255, 0.5)' : '#ff8a1f';
  g.lineWidth = (track.width > 0 ? 1 : 2) / k;
  g.setLineDash([6 / k, 5 / k]);
  g.stroke(path);
  g.setLineDash([]);
  g.restore();
}
