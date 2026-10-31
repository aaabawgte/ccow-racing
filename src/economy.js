// Ekonomija: kune, XP i leveli, vlasništvo nad autima i vozačima, medalje i dnevni bonus.
// Profil se za sada sprema u preglednik; kad stignu računi, isti profil ide na server (Cloudflare D1).
import { CHARACTERS, RARITIES, characterById } from './characters.js';
import { carById } from './cars.js';
import { UPGRADES, upgradeCost, swapCost, PAINT_COST, SMOKE_COST } from './upgrades.js';

const STORE_KEY = 'ccow.profile';
export const START_KUNE = 2000;
export const SELL_SHARE = 0.6;
export const MEDALS = {
  bronze: { name: 'Bronca', reward: 500, color: '#c98a4b' },
  silver: { name: 'Srebro', reward: 1000, color: '#c9d1d9' },
  gold: { name: 'Zlato', reward: 2000, color: '#f2c94c' },
};
const MEDAL_ORDER = ['bronze', 'silver', 'gold'];
export const RECORD_BONUS = 200;
export const LAPS_PER_RUN = 3;
export const ENDLESS_PER_KM = 300;
export const ENDLESS_DAILY_FIRST = 1000;

export const kn = (v) => `${Math.round(v).toLocaleString('hr-HR')} kn`;

const today = () => new Date().toISOString().slice(0, 10);

// Ukupni XP potreban za level n (level 1 = 0 XP).
export function xpForLevel(n) {
  return Math.round(1000 * (n - 1) ** 1.5);
}

export function levelFromXp(xp) {
  let n = 1;
  while (xp >= xpForLevel(n + 1)) n++;
  return n;
}

// Tjedni promotor: specijalci se u trgovini rotiraju po ISO tjednu.
export function weeklySpecial(date = new Date()) {
  const specials = CHARACTERS.filter((c) => c.rarity === 'special');
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const week = Math.ceil(((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
  return specials[(d.getUTCFullYear() * 53 + week) % specials.length];
}

// Nagrada za završenu vožnju (3 valjana kruga) ovisi o težini staze.
export function lapReward(difficulty) {
  return 200 + difficulty * 100;
}

export function medalFor(time, medals) {
  if (!medals || time === null) return null;
  if (time <= medals.gold) return 'gold';
  if (time <= medals.silver) return 'silver';
  if (time <= medals.bronze) return 'bronze';
  return null;
}

function fresh() {
  return {
    kune: START_KUNE, xp: 0, cars: [], drivers: [], started: false,
    best: {}, medals: {}, endlessBest: {}, endlessPaidDay: null,
    loginDay: null, streak: 0, earnedTotal: 0, garage: {},
  };
}

export class Profile {
  constructor() {
    this.listeners = [];
    this.adopt(null, null);
  }

  // Preuzmi profil (sa servera ili iz preglednika). key je račun ('u12') ili null za igru bez računa.
  adopt(data, key) {
    this.storeKey = key ? `${STORE_KEY}.${key}` : STORE_KEY;
    this.data = fresh();
    let src = data;
    if (!src) {
      try { src = JSON.parse(localStorage.getItem(this.storeKey)); } catch { src = null; }
    }
    if (src) Object.assign(this.data, structuredClone(src));
    this.saveLocal();
  }

  saveLocal() {
    try { localStorage.setItem(this.storeKey, JSON.stringify(this.data)); } catch { /* bez spremanja */ }
  }

  save() {
    this.saveLocal();
    this.listeners.forEach((f) => f());
  }

  onChange(f) { this.listeners.push(f); }

  reset() {
    this.data = fresh();
    this.save();
  }

  get kune() { return this.data.kune; }
  get xp() { return this.data.xp; }
  get level() { return levelFromXp(this.data.xp); }
  get started() { return this.data.started; }

  ownsCar(id) { return this.data.cars.includes(id); }
  ownsDriver(id) { return this.data.drivers.includes(id); }

  // Zarada: kune i jednako toliko XP-a. Vraća poruke za prikaz (uključujući level-up).
  earn(amount, label) {
    const out = [];
    amount = Math.round(amount);
    if (amount <= 0) return out;
    const before = this.level;
    this.data.kune += amount;
    this.data.xp += amount;
    this.data.earnedTotal += amount;
    out.push({ text: `+${kn(amount)}`, sub: label });
    const after = this.level;
    for (let lv = before + 1; lv <= after; lv++) {
      const bonus = 200 * lv;
      this.data.kune += bonus;
      out.push({ text: `Level ${lv}!`, sub: `+${kn(bonus)}`, big: true });
    }
    this.save();
    return out;
  }

  // Prvi vozač je besplatan (samo common) i dolazi sa svojim autom.
  chooseFirstDriver(id) {
    const ch = characterById(id);
    if (this.data.started || ch.rarity !== 'common') return false;
    this.data.drivers.push(id);
    if (ch.car && !this.ownsCar(ch.car)) this.data.cars.push(ch.car);
    this.data.started = true;
    this.save();
    return true;
  }

  // Može li se vozač kupiti; vraća { ok, reason }.
  driverStatus(id) {
    const ch = characterById(id);
    const r = RARITIES[ch.rarity];
    if (this.ownsDriver(id)) return { ok: false, owned: true };
    const d = this.data;
    const owned = d.drivers.map(characterById);
    const golds = Object.values(d.medals).filter((m) => m === 'gold').length;
    if (ch.rarity === 'rare' && !(this.level >= 5 || owned.filter((o) => o.rarity === 'common').length >= 3)) {
      return { ok: false, reason: 'Promaknuće: level 5 ili 3 otključana commona' };
    }
    if (ch.rarity === 'epic' && golds < 3) return { ok: false, reason: `Promaknuće: zlato na 3 staze (${golds}/3)` };
    if (ch.rarity === 'legendary') {
      // Dok nema ljestvica na serveru, umjesto top 3 traži se zlato na svim stazama.
      const hasEpic = owned.some((o) => o.rarity === 'epic');
      if (!hasEpic || golds < 6) return { ok: false, reason: `Promaknuće: jedan epic i zlato na svih 6 staza (${golds}/6)` };
    }
    if (ch.rarity === 'special' && weeklySpecial().id !== id) return { ok: false, reason: 'Čeka promociju tjedna' };
    if (d.kune < r.price) return { ok: false, reason: `Fali ${kn(r.price - d.kune)}` };
    return { ok: true, price: r.price };
  }

  buyDriver(id) {
    const st = this.driverStatus(id);
    if (!st.ok) return false;
    const ch = characterById(id);
    this.data.kune -= st.price;
    this.data.drivers.push(id);
    if (ch.car && !this.ownsCar(ch.car)) this.data.cars.push(ch.car);
    this.save();
    return true;
  }

  carStatus(id) {
    const spec = carById(id);
    if (this.ownsCar(id)) return { ok: false, owned: true };
    if (spec.cls === 'S') return { ok: false, reason: 'Dolazi s vozačem' };
    if (this.data.kune < spec.price) return { ok: false, reason: `Fali ${kn(spec.price - this.data.kune)}` };
    return { ok: true, price: spec.price };
  }

  buyCar(id) {
    const st = this.carStatus(id);
    if (!st.ok) return false;
    this.data.kune -= st.price;
    this.data.cars.push(id);
    this.save();
    return true;
  }

  // Prodaja vraća 60% cijene auta i pola onoga što je uloženo u nadogradnje.
  sellValue(id) {
    const spec = carById(id);
    return Math.round(spec.price * SELL_SHARE + (this.data.garage[id]?.spent || 0) * 0.5);
  }

  sellCar(id) {
    const spec = carById(id);
    if (!this.ownsCar(id) || spec.cls === 'S' || this.data.cars.length <= 1) return 0;
    const value = this.sellValue(id);
    this.data.cars = this.data.cars.filter((c) => c !== id);
    delete this.data.garage[id];
    this.data.kune += value;
    this.save();
    return value;
  }

  garageEntry(id) {
    const g = this.data.garage;
    if (!g[id]) g[id] = { up: {}, tune: {}, spent: 0 };
    return g[id];
  }

  spend(id, cost) {
    if (!this.ownsCar(id) || this.data.kune < cost) return false;
    this.data.kune -= cost;
    this.garageEntry(id).spent += cost;
    return true;
  }

  // Sljedeći stupanj nadogradnje; vraća { ok, stage, cost, reason }.
  upgradeStatus(carId, upId) {
    const stage = (this.garageEntry(carId).up[upId] || 0) + 1;
    if (stage > 3) return { ok: false, maxed: true };
    if (!this.ownsCar(carId)) return { ok: false, stage, cost: upgradeCost(carById(carId), stage), reason: 'Auto nije tvoj' };
    const cost = upgradeCost(carById(carId), stage);
    if (this.data.kune < cost) return { ok: false, stage, cost, reason: `Fali ${kn(cost - this.data.kune)}` };
    return { ok: true, stage, cost };
  }

  buyUpgrade(carId, upId) {
    const st = this.upgradeStatus(carId, upId);
    if (!st.ok || !UPGRADES.some((u) => u.id === upId)) return false;
    this.spend(carId, st.cost);
    this.garageEntry(carId).up[upId] = st.stage;
    this.save();
    return true;
  }

  buySwap(carId, drivetrain) {
    const e = this.garageEntry(carId);
    const spec = carById(carId);
    if (!this.ownsCar(carId) || (e.drivetrain || spec.drivetrain) === drivetrain) return false;
    // povratak na tvornički pogon je besplatan
    const cost = drivetrain === spec.drivetrain ? 0 : swapCost(spec);
    if (!this.spend(carId, cost)) return false;
    e.drivetrain = drivetrain === spec.drivetrain ? undefined : drivetrain;
    e.tune = {};
    this.save();
    return true;
  }

  setTune(carId, tuneId, value) {
    if (!this.ownsCar(carId)) return;
    const e = this.garageEntry(carId);
    if (value === null) delete e.tune[tuneId];
    else e.tune[tuneId] = value;
    this.save();
  }

  resetTune(carId) {
    this.garageEntry(carId).tune = {};
    this.save();
  }

  buyPaint(carId, color) {
    const e = this.garageEntry(carId);
    if (e.color === color || !this.spend(carId, PAINT_COST)) return false;
    e.color = color;
    this.save();
    return true;
  }

  buySmoke(carId, color) {
    const e = this.garageEntry(carId);
    if ((e.smoke || null) === color || !this.spend(carId, color ? SMOKE_COST : 0)) return false;
    e.smoke = color || undefined;
    this.save();
    return true;
  }

  // Dnevna prijava: 250 kn, niz raste do 1.000 kn. Vraća poruke ili prazno ako je već dano danas.
  dailyLogin() {
    const d = this.data, t = today();
    if (!d.started || d.loginDay === t) return [];
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    d.streak = d.loginDay === yesterday ? d.streak + 1 : 1;
    d.loginDay = t;
    return this.earn(Math.min(1000, 250 + (d.streak - 1) * 125), `Dnevna prijava · niz ${d.streak}`);
  }

  // Valjan krug: osobni rekord i medalje (svaka jednom po stazi); svaki treći krug je završena vožnja.
  lapDone(track, time, lapNumber) {
    const out = [];
    const id = track.id, d = this.data;
    if (lapNumber % LAPS_PER_RUN === 0) out.push(...this.earn(lapReward(track.def.difficulty), `Vožnja završena (${LAPS_PER_RUN} kruga)`));
    const prev = d.best[id];
    if (prev === undefined || time < prev) {
      d.best[id] = time;
      if (prev !== undefined) out.push(...this.earn(RECORD_BONUS, 'Osobni rekord'));
      else this.save();
    }
    const got = medalFor(time, track.def.medals);
    if (got) {
      const had = d.medals[id];
      const from = had ? MEDAL_ORDER.indexOf(had) + 1 : 0;
      const to = MEDAL_ORDER.indexOf(got);
      for (let i = from; i <= to; i++) out.push(...this.earn(MEDALS[MEDAL_ORDER[i]].reward, `Medalja: ${MEDALS[MEDAL_ORDER[i]].name}`));
      if (to >= from) {
        d.medals[id] = got;
        this.save();
      }
    }
    return out;
  }

  driftBanked(points) {
    const k = Math.floor(points / 100);
    return k > 0 ? this.earn(k, 'Drift') : [];
  }

  endlessDone(seedKey, meters) {
    const out = [];
    const d = this.data;
    out.push(...this.earn((meters / 1000) * ENDLESS_PER_KM, `Beskrajna · ${(meters / 1000).toFixed(2)} km`));
    if (d.endlessPaidDay !== seedKey && meters > 100) {
      d.endlessPaidDay = seedKey;
      out.push(...this.earn(ENDLESS_DAILY_FIRST, 'Prva beskrajna danas'));
    }
    if (meters > (d.endlessBest[seedKey] || 0)) {
      d.endlessBest[seedKey] = meters;
      this.save();
    }
    return out;
  }
}
