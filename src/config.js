// Adresa servera (Cloudflare Worker). Lokalno se koristi `npm run dev` u mapi server/.
// Nakon `npm run deploy` upiši ovdje adresu koju wrangler ispiše (npr. https://ccow-racing.IME.workers.dev).
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
export const API_URL = LOCAL ? `http://${location.hostname}:8787` : 'https://ccow-racing.UPISI-SVOJ-SUBDOMAIN.workers.dev';
