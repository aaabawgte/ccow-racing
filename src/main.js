import { Car, resolveCollisions, updateProps } from './physics.js';
import { carById } from './cars.js';
import { characterById, CHARACTERS } from './characters.js';
import { buildSpec, performanceIndex, piClass } from './upgrades.js';
import { Track } from './track.js';
import { trackDefById } from './tracks.js';
import { EndlessTrack } from './endless.js';
import { Renderer } from './render.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { LapTimer, DriftScore, EndlessRun } from './game.js';
import { TuningPanel } from './tuning.js';
import { Menu } from './menu.js';
import { Profile } from './economy.js';
import { Account } from './account.js';

// Fizika se vrti fiksnim korakom od 1 ms, neovisno o broju sličica.
const PHYS_DT = 1 / 1000;
const IDLE_INPUT = { throttle: 0, brake: 0, steer: 0, handbrake: 0, shiftUp: false, shiftDown: false };

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const hud = new Hud();
const input = new Input();
const settings = { auto: true, rotateCamera: false, telemetry: false };
const profile = new Profile();
const account = new Account(profile);

const trackCache = new Map();
function buildTrack(id) {
  if (id === 'endless') return new EndlessTrack();
  if (!trackCache.has(id)) trackCache.set(id, new Track(trackDefById(id)));
  return trackCache.get(id);
}

let car, track, laps, run, drift, driver;
let time = 0;
let racing = false;
let penaltyCooldown = 0;
let propHitsSeen = 0;

function spawn() {
  if (track.mode === 'endless') {
    track = buildTrack('endless');
    renderer.setTrack(track);
  }
  car.reset(track.start.x, track.start.y, track.start.heading);
  track.resetProps();
  car.propHits = 0;
  propHitsSeen = 0;
  laps = track.mode === 'laps' ? new LapTimer(track, time) : null;
  run = track.mode === 'endless' ? new EndlessRun(track) : null;
  drift = new DriftScore();
  // Zarada samo u pravoj vožnji, ne u pozadini izbornika.
  const pay = (items) => { if (racing) { hud.toast(items); menu.toast(items); } };
  // Ljestvica: klasa po PI-ju auta s nadogradnjama; vožnja s postavkama iz panela P se ne šalje.
  const board = () => racing && !car.spec.devTuned;
  const who = () => ({ car: car.spec.id, driver: driver.id });
  if (laps) laps.onLap = (t) => {
    pay(profile.lapDone(track, t, laps.lap));
    if (board()) account.submitLap({ track: track.id, cls: piClass(performanceIndex(car.spec)).id, time: +t.toFixed(3), ...who() });
  };
  if (run) run.onOver = (m) => {
    pay(profile.endlessDone(track.seedKey, m));
    if (board()) account.submitEndless({ seed: track.seedKey, meters: Math.round(m), ...who() });
  };
  drift.onBank = (pts) => pay(profile.driftBanked(pts));
  renderer.clearMarks(track.start.x, track.start.y);
  renderer.snapCamera(car);
}

// Auto iz garaže: tvornički spec s nadogradnjama, podešavanjem i bojom. Potpisni auto ima boju vlasnika.
function makeCar(carId) {
  const entry = profile.data.garage[carId] || {};
  const owner = CHARACTERS.find((c) => c.car === carId);
  const spec = buildSpec(carById(carId), { ...entry, color: entry.color || owner?.carColor });
  return new Car(spec);
}

function startRace(sel) {
  driver = characterById(sel.driver);
  car = makeCar(sel.car);
  track = buildTrack(sel.track);
  renderer.setTrack(track);
  spawn();
  panel.sync();
  racing = true;
  menu.hide();
}

const panel = new TuningPanel(document.getElementById('tuning'), {
  settings,
  getCar: () => car,
  onCarChange: (id) => {
    car = makeCar(id);
    spawn();
    panel.sync();
  },
});

const menu = new Menu(document.getElementById('menu'), {
  profile,
  account,
  buildTrack,
  onStart: startRace,
});

// Iza izbornika stoji odabrani auto na odabranoj stazi, da pozadina nije prazna.
const first = menu.selection;
driver = characterById(first.driver);
car = makeCar(first.car);
track = buildTrack(first.track === 'endless' ? 'parking' : first.track);
renderer.setTrack(track);
spawn();
panel.sync();
menu.toast(profile.dailyLogin());
menu.show();
// Dnevni bonus i za profil koji stigne sa servera (dailyLogin ne daje dvaput isti dan).
account.onChange(() => { if (account.user) menu.toast(profile.dailyLogin()); });
account.init();

canvas.addEventListener('pointerdown', () => document.activeElement?.blur());

// Za testiranje iz konzole preglednika.
window.ccow = {
  get car() { return car; }, get track() { return track; }, get run() { return run; }, get laps() { return laps; },
  settings, startRace, profile, account,
};

let last = performance.now();
let acc = 0;

function frame(now) {
  // Prvi rAF zna dati vrijeme malo prije učitavanja skripte, pa dt ne smije biti negativan.
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  // Zakazano odmah, da jedna greška u crtanju ne zaustavi igru.
  requestAnimationFrame(frame);

  if (menu.open) {
    if (input.consume('Enter')) menu.start();
    if (input.consume('Escape') && racing) menu.hide();
  } else {
    if (input.consume('Escape')) menu.show();
    if (input.consume('KeyR') || input.padPressed(8)) spawn();
    if (input.consume('KeyM')) { settings.auto = !settings.auto; panel.sync(); }
    if (input.consume('KeyC')) { settings.rotateCamera = !settings.rotateCamera; panel.sync(); }
    if (input.consume('KeyT')) { settings.telemetry = !settings.telemetry; panel.sync(); }
    if (input.consume('KeyP')) panel.toggle();
  }

  const driving = racing && !menu.open && !run?.over;
  const inp = driving ? input.read(dt) : { ...IDLE_INPUT };
  inp.auto = settings.auto;
  // Neiskorišteni pritisci (npr. iz izbornika) ne smiju čekati za kasnije.
  input.pressed.clear();

  acc += dt;
  let impact = 0;
  while (acc >= PHYS_DT) {
    car.step(PHYS_DT, inp, track);
    impact = Math.max(impact, resolveCollisions(car, track));
    updateProps(track, PHYS_DT);
    inp.shiftUp = inp.shiftDown = false;
    acc -= PHYS_DT;
  }
  time += dt;

  // Kazne: udarac u stup i srušen čunj.
  penaltyCooldown = Math.max(0, penaltyCooldown - dt);
  if (car.hit) {
    if (car.hit.ob.penalty && penaltyCooldown === 0 && laps) {
      laps.addPenalty(car.hit.ob.penalty, `Stup! +${car.hit.ob.penalty} s`);
      penaltyCooldown = 0.8;
    }
    car.hit = null;
  }
  if ((car.propHits || 0) > propHitsSeen) {
    laps?.addPenalty(0.5 * (car.propHits - propHitsSeen), 'Čunj! +0.5 s');
    propHitsSeen = car.propHits;
  }

  if (laps) laps.update(car, time);
  if (run) run.update(car, dt);
  drift.update(car, dt, impact, track.zoneAt(car.x, car.y));
  hud.record(car, drift, dt);
  renderer.update(car, dt, settings);
  renderer.draw(car, settings);
  if (!menu.open) hud.draw(renderer.ctx, renderer.w, renderer.h, { car, laps, run, drift, settings, track, driver });
}
requestAnimationFrame(frame);
