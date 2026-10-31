# CCOW RACING

Top-down 2D drift/racing igra za kolege iz City Center One West. Trenutno: izbornik (vozač, auto, staza), 43 auta, 17 vozača, 6 staza i beskrajna staza. Ekonomija (kune, XP, kupnja auta i vozača, medalje), garaža (nadogradnje, PI i klasa, podešavanje, boja, dim), računi (email + lozinka) i ljestvice po stazi i klasi. Profil prijavljenog igrača sprema se na server (Cloudflare Worker + D1); bez računa ostaje u pregledniku.

## Pokretanje lokalno

Igra je čisti HTML/JS bez build koraka, ali ES moduli trebaju server (ne radi preko `file://`):

```bash
python3 serve.py
```

(`serve.py` je običan statični server koji isključuje keširanje, da se izmjene uvijek vide nakon osvježavanja.)

Zatim otvori http://localhost:8080.

## Kontrole

| Tipka | Radnja |
|---|---|
| W / ↑ | Gas |
| S / ↓ | Kočnica; držanjem u mjestu rikverc (automatski mjenjač) |
| A D / ← → | Volan |
| Razmaknica | Ručna kočnica |
| M | Automatski / ručni mjenjač (Q dolje, E gore) |
| P | Postavke vožnje (podešavanje uživo, "Kopiraj postavke" daje JSON) |
| T | Telemetrija |
| C | Kamera se okreće s autom |
| R | Reset na start |
| Esc | Izbornik (vozač, auto, staza) |

Drift: pun volan uz gas (ili kočnicu) pri brzini, ili ručna. U driftu volan u zavoj produbljuje kut, pušten volan s gasom drži srednji kut, a otpušten gas ili kontra izvlače auto.

Gamepad: lijeva palica volan, RT gas, LT kočnica, A ručna, LB/RB mjenjač.

## Struktura

- `src/main.js`: glavna petlja, izbornik, kazne
- `src/menu.js`: izbornik prije vožnje (vozač, auto, staza, kontrole)
- `src/physics.js`: arkadni model vožnje napravljen za drift (stanja grip i drift, igrač bira kut volanom i gasom), podloge, sudari i pokretni predmeti (kolica, čunjevi, bačve)
- `src/cars.js`: katalog auta po klasama D/C/B/A i potpisni auti vozača
- `src/characters.js`, `src/portrait.js`: vozači (kolege) i njihovi portreti
- `src/track.js`: generička staza (ruta, podloge, prepreke, drift zone)
- `src/tracks.js`: šest staza oko CCOW-a
- `src/endless.js`: beskrajna staza s dnevnim seedom
- `src/render.js`: crtanje svijeta, auta po tipu karoserije, tragova i dima
- `src/hud.js`: HUD i telemetrija
- `src/economy.js`: profil igrača, kune, XP i leveli, kupnja i prodaja, medalje, dnevni bonus, promaknuća vozača
- `src/upgrades.js`, `src/garage.js`: nadogradnje, zamjena pogona, besplatno podešavanje, PI/klasa, boje; kartica Garaža u izborniku
- `src/game.js`: krugovi s kaznama, drift bodovanje i beskrajna vožnja
- `src/tuning.js`: panel za podešavanje vožnje
- `src/input.js`: tipkovnica i gamepad

## Server (računi, profili, ljestvice)

Server je Cloudflare Worker s D1 bazom u mapi `server/`. Lokalno:

```bash
cd server
npm install
npm run db:local
npm run dev
```

Server radi na http://localhost:8787, a igra ga na localhostu sama pronađe (`src/config.js`). Bez servera igra i dalje radi uz "Igraj bez računa".

Lozinke se spremaju kao PBKDF2-SHA256 (100.000 iteracija, sol po korisniku), a sesije kao SHA-256 tokena. Nakon 5 krivih lozinki račun je zaključan na minutu. Krugovi brži od 60% zlatnog vremena se odbijaju; prava provjera (snimka vožnje) dolazi poslije.

### Postavljanje na Cloudflare

1. `cd server && npx wrangler login` (prijava u Cloudflare u pregledniku)
2. `npx wrangler d1 create ccow-racing`, pa ispisani `database_id` upiši u `server/wrangler.toml`
3. `npm run db:remote` (napravi tablice u pravoj bazi)
4. `npm run deploy`, pa ispisanu adresu (`https://ccow-racing.….workers.dev`) upiši u `src/config.js`
5. U `server/wrangler.toml` postavi `ALLOWED_ORIGIN` na adresu igre na GitHub Pagesu i ponovi `npm run deploy`

## Hosting

Frontend ide na GitHub Pages (statične datoteke iz korijena repozitorija). Mapa `server/` se ne objavljuje na Pagesu nego ide na Cloudflare.
