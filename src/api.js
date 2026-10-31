// Komunikacija sa serverom: prijava, registracija, profil i ljestvice. Token se čuva u pregledniku.
import { API_URL } from './config.js';

const TOKEN_KEY = 'ccow.token';

export class ApiError extends Error {}

function token() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function setToken(t) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* bez spremanja */ }
}

async function call(method, path, data) {
  let res;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  } catch {
    throw new ApiError('Server nije dostupan');
  }
  const out = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/api/login') setToken(null);
  if (!res.ok) throw new ApiError(out.error || `Greška ${res.status}`);
  return out;
}

export const api = {
  hasToken: () => !!token(),
  async register(email, password, name) {
    const out = await call('POST', '/api/register', { email, password, name });
    setToken(out.token);
    return out;
  },
  async login(email, password) {
    const out = await call('POST', '/api/login', { email, password });
    setToken(out.token);
    return out;
  },
  async logout() {
    try { await call('POST', '/api/logout'); } finally { setToken(null); }
  },
  me: () => call('GET', '/api/me'),
  saveProfile: (data) => call('PUT', '/api/profile', { data }),
  submitLap: (lap) => call('POST', '/api/lap', lap),
  submitEndless: (run) => call('POST', '/api/endless', run),
  leaderboard: (track, extra = '') => call('GET', `/api/leaderboard?track=${encodeURIComponent(track)}${extra}`),
};
