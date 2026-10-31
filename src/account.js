// Račun igrača: prijava, odjava, igra bez računa i spremanje profila na server.
// Prijavljen igrač ima profil na serveru (D1); lokalna kopija služi samo kao međuspremnik.
import { api } from './api.js';

const OFFLINE_KEY = 'ccow.offline';
const SYNC_DELAY = 1500;

export class Account {
  constructor(profile) {
    this.profile = profile;
    this.user = null;
    this.status = '';
    try { this.offline = localStorage.getItem(OFFLINE_KEY) === '1'; } catch { this.offline = false; }
    this.timer = null;
    this.listeners = [];
    profile.onChange(() => this.queueSync());
  }

  // Igra smije krenuti kad je igrač prijavljen ili je izabrao igru bez računa.
  get ready() { return !!this.user || this.offline; }

  onChange(f) { this.listeners.push(f); }
  emit() { this.listeners.forEach((f) => f()); }

  // Pri pokretanju: ako postoji token, učitaj račun i profil sa servera.
  async init() {
    if (!api.hasToken()) return;
    try {
      const out = await api.me();
      this.signedIn(out);
    } catch (e) {
      this.status = e.message;
    }
    this.emit();
  }

  async login(email, password) {
    this.signedIn(await api.login(email, password));
    this.emit();
  }

  async register(email, password, name) {
    this.signedIn(await api.register(email, password, name));
    this.emit();
  }

  async logout() {
    await this.flush();
    try { await api.logout(); } catch { /* token je ionako obrisan */ }
    this.user = null;
    this.profile.adopt(null, null);
    this.emit();
  }

  playOffline() {
    this.offline = true;
    try { localStorage.setItem(OFFLINE_KEY, '1'); } catch { /* bez spremanja */ }
    this.emit();
  }

  // Serverski profil ima prednost. Novi račun bez profila preuzima napredak igre bez računa.
  signedIn({ user, profile }) {
    this.user = user;
    this.offline = false;
    try { localStorage.removeItem(OFFLINE_KEY); } catch { /* bez spremanja */ }
    if (profile?.data) {
      this.profile.adopt(profile.data, `u${user.id}`);
    } else {
      const local = this.profile.data.started ? this.profile.data : null;
      this.profile.adopt(local, `u${user.id}`);
      this.queueSync(0);
    }
    this.status = 'Prijavljen';
  }

  queueSync(delay = SYNC_DELAY) {
    if (!this.user) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), delay);
  }

  async flush() {
    if (!this.user || !this.timer) return;
    clearTimeout(this.timer);
    this.timer = null;
    try {
      await api.saveProfile(this.profile.data);
      this.status = 'Spremljeno na server';
    } catch (e) {
      this.status = `Nije spremljeno: ${e.message}`;
      this.timer = setTimeout(() => this.flush(), 15000);
    }
    this.emit();
  }

  // Ljestvice: krug i beskrajna vožnja šalju se samo kad je igrač prijavljen.
  async submitLap(lap) {
    if (!this.user) return;
    try { await api.submitLap(lap); } catch (e) { this.status = `Krug nije poslan: ${e.message}`; this.emit(); }
  }

  async submitEndless(run) {
    if (!this.user) return;
    try { await api.submitEndless(run); } catch (e) { this.status = `Vožnja nije poslana: ${e.message}`; this.emit(); }
  }
}
