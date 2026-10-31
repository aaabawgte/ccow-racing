// API za CCOW RACING: računi (email + lozinka), sesije, spremanje profila i ljestvice.
// Cloudflare Worker s D1 bazom (binding DB). Podaci o stazama i autima dijele se s igrom.
import { TRACKS } from '../../src/tracks.js';
import { carById } from '../../src/cars.js';
import { characterById } from '../../src/characters.js';

const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100000; // najviše što Workers dopuštaju
const MAX_PROFILE_BYTES = 64 * 1024;
const CLASSES = ['D', 'C', 'B', 'A', 'A+'];
const NAME_RE = /^[\p{L}\p{N} ._-]{2,24}$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const randomHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));

async function hashPassword(password, saltHex) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const salt = new Uint8Array(saltHex.match(/../g).map((h) => parseInt(h, 16)));
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, key, 256);
  return hex(bits);
}

async function sha256(text) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

// Usporedba u konstantnom vremenu, da se iz trajanja ne može pogađati hash.
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(data, status, env) {
  return new Response(data === null ? null : JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    },
  });
}

async function body(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, 'Neispravan zahtjev');
  }
}

async function createSession(env, userId) {
  const token = randomHex(32);
  const expires = Date.now() + SESSION_DAYS * 86400000;
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires) VALUES (?, ?, ?)').bind(await sha256(token), userId, expires).run();
  return token;
}

async function currentUser(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!/^[0-9a-f]{64}$/.test(token)) throw new HttpError(401, 'Nisi prijavljen');
  const row = await env.DB.prepare(
    'SELECT u.id, u.email, u.name, s.expires FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?',
  ).bind(await sha256(token)).first();
  if (!row || row.expires < Date.now()) throw new HttpError(401, 'Prijava je istekla');
  return { id: row.id, email: row.email, name: row.name, tokenHash: await sha256(token) };
}

async function register(request, env) {
  const { email, password, name } = await body(request);
  const mail = String(email || '').trim().toLowerCase();
  const nick = String(name || '').trim();
  if (!EMAIL_RE.test(mail) || mail.length > 120) throw new HttpError(400, 'Neispravan email');
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) throw new HttpError(400, 'Lozinka mora imati barem 8 znakova');
  if (!NAME_RE.test(nick)) throw new HttpError(400, 'Ime mora imati 2 do 24 slova ili broja');
  const exists = await env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(mail).first();
  if (exists) throw new HttpError(409, 'Taj email već ima račun');
  const salt = randomHex(16);
  const passHash = await hashPassword(password, salt);
  const res = await env.DB.prepare('INSERT INTO users (email, name, pass_hash, salt, created) VALUES (?, ?, ?, ?, ?)')
    .bind(mail, nick, passHash, salt, Date.now()).run();
  const id = res.meta.last_row_id;
  return { token: await createSession(env, id), user: { id, email: mail, name: nick }, profile: null };
}

async function login(request, env) {
  const { email, password } = await body(request);
  const mail = String(email || '').trim().toLowerCase();
  const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(mail).first();
  // Ista poruka za krivi email i krivu lozinku, da se ne otkriva tko ima račun.
  const wrong = new HttpError(401, 'Krivi email ili lozinka');
  if (!user || typeof password !== 'string') throw wrong;
  if (user.locked_until > Date.now()) throw new HttpError(429, 'Previše pokušaja, pričekaj minutu');
  const hash = await hashPassword(password, user.salt);
  if (!safeEqual(hash, user.pass_hash)) {
    const failed = user.failed + 1;
    const lock = failed >= 5 ? Date.now() + 60000 : 0;
    await env.DB.prepare('UPDATE users SET failed = ?, locked_until = ? WHERE id = ?').bind(lock ? 0 : failed, lock, user.id).run();
    throw wrong;
  }
  await env.DB.prepare('UPDATE users SET failed = 0, locked_until = 0 WHERE id = ?').bind(user.id).run();
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND expires < ?').bind(user.id, Date.now()).run();
  const profile = await env.DB.prepare('SELECT data, updated FROM profiles WHERE user_id = ?').bind(user.id).first();
  return {
    token: await createSession(env, user.id),
    user: { id: user.id, email: user.email, name: user.name },
    profile: profile ? { data: JSON.parse(profile.data), updated: profile.updated } : null,
  };
}

async function me(request, env) {
  const user = await currentUser(request, env);
  const profile = await env.DB.prepare('SELECT data, updated FROM profiles WHERE user_id = ?').bind(user.id).first();
  return { user: { id: user.id, email: user.email, name: user.name }, profile: profile ? { data: JSON.parse(profile.data), updated: profile.updated } : null };
}

async function logout(request, env) {
  const user = await currentUser(request, env);
  await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(user.tokenHash).run();
  return { ok: true };
}

async function saveProfile(request, env) {
  const user = await currentUser(request, env);
  const text = await request.text();
  if (text.length > MAX_PROFILE_BYTES) throw new HttpError(413, 'Profil je prevelik');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new HttpError(400, 'Neispravan profil'); }
  const data = parsed?.data;
  if (!data || typeof data !== 'object' || typeof data.kune !== 'number') throw new HttpError(400, 'Neispravan profil');
  const now = Date.now();
  await env.DB.prepare('INSERT INTO profiles (user_id, data, updated) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated = excluded.updated')
    .bind(user.id, JSON.stringify(data), now).run();
  return { ok: true, updated: now };
}

// Krug ide na ljestvicu ako je brži od dosadašnjeg za tu stazu i klasu. Prebrzi krugovi se odbijaju.
async function submitLap(request, env) {
  const user = await currentUser(request, env);
  const { track, cls, time, car, driver } = await body(request);
  const def = TRACKS.find((t) => t.id === track);
  if (!def || !CLASSES.includes(cls) || !carById(car) || !characterById(driver)) throw new HttpError(400, 'Neispravan krug');
  if (typeof time !== 'number' || !Number.isFinite(time) || time < def.medals.gold * 0.6 || time > 3600) throw new HttpError(400, 'Nemoguće vrijeme');
  const now = Date.now();
  await env.DB.prepare(`INSERT INTO best_laps (user_id, track, cls, time, car, driver, created) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, track, cls) DO UPDATE SET time = excluded.time, car = excluded.car, driver = excluded.driver, created = excluded.created
    WHERE excluded.time < best_laps.time`).bind(user.id, track, cls, time, car, driver, now).run();
  return { ok: true };
}

async function submitEndless(request, env) {
  const user = await currentUser(request, env);
  const { seed, meters, car, driver } = await body(request);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(seed)) || !carById(car) || !characterById(driver)) throw new HttpError(400, 'Neispravna vožnja');
  if (!Number.isInteger(meters) || meters < 0 || meters > 200000) throw new HttpError(400, 'Nemoguća udaljenost');
  await env.DB.prepare(`INSERT INTO best_endless (user_id, seed, meters, car, driver, created) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, seed) DO UPDATE SET meters = excluded.meters, car = excluded.car, driver = excluded.driver, created = excluded.created
    WHERE excluded.meters > best_endless.meters`).bind(user.id, seed, meters, car, driver, Date.now()).run();
  return { ok: true };
}

async function leaderboard(url, env) {
  const track = url.searchParams.get('track');
  if (track === 'endless') {
    const seed = url.searchParams.get('seed') || '';
    const rows = await env.DB.prepare(`SELECT u.name, b.meters, b.car, b.driver FROM best_endless b JOIN users u ON u.id = b.user_id
      WHERE b.seed = ? ORDER BY b.meters DESC LIMIT 20`).bind(seed).all();
    return { track, seed, rows: rows.results };
  }
  const cls = url.searchParams.get('cls');
  if (!TRACKS.some((t) => t.id === track)) throw new HttpError(400, 'Nepoznata staza');
  const rows = cls && CLASSES.includes(cls)
    ? await env.DB.prepare(`SELECT u.name, b.time, b.cls, b.car, b.driver FROM best_laps b JOIN users u ON u.id = b.user_id
        WHERE b.track = ? AND b.cls = ? ORDER BY b.time LIMIT 20`).bind(track, cls).all()
    : await env.DB.prepare(`SELECT u.name, MIN(b.time) AS time, b.cls, b.car, b.driver FROM best_laps b JOIN users u ON u.id = b.user_id
        WHERE b.track = ? GROUP BY b.user_id ORDER BY time LIMIT 20`).bind(track).all();
  return { track, cls: cls || null, rows: rows.results };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return json(null, 204, env);
    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname}`;
    try {
      let out;
      switch (route) {
        case 'POST /api/register': out = await register(request, env); break;
        case 'POST /api/login': out = await login(request, env); break;
        case 'POST /api/logout': out = await logout(request, env); break;
        case 'GET /api/me': out = await me(request, env); break;
        case 'PUT /api/profile': out = await saveProfile(request, env); break;
        case 'POST /api/lap': out = await submitLap(request, env); break;
        case 'POST /api/endless': out = await submitEndless(request, env); break;
        case 'GET /api/leaderboard': out = await leaderboard(url, env); break;
        case 'GET /api/health': out = { ok: true }; break;
        default: throw new HttpError(404, 'Nema te stranice');
      }
      return json(out, 200, env);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status, env);
      console.error(e);
      return json({ error: 'Greška na serveru' }, 500, env);
    }
  },
};
