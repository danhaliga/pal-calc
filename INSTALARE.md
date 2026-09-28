# Punerea aplicației online

Aplicația e scrisă în Node.js. Găzduirea de la cyber_Folks (pachet cyber_IN)
e făcută pentru PHP — pe pagina lor oficială de specificații tehnice, ediția
2026, cuvântul „Node" nu apare nicăieri, în niciuna din cele nouă categorii
de servicii. Tot ce e listat e despre PHP.

Deci aplicația merge în altă parte, iar `cutmodul.com` rămâne al tău și arată
spre ea. Găzduirea plătită nu se pierde: pagina de prezentare poate sta acolo.

**Serviciul ales: Render.** Motivul e simplu — nu are panou de umblat, nu are
fișiere de urcat, nu are parole de ținut minte. Se leagă o dată de depozitul
de cod și de-atunci se actualizează singur. Costă în jur de 7 € pe lună.

---

## Ce am pregătit deja

Fișierul **`render.yaml`** din depozit. Render îl citește și face singur tot:
instalează, pornește, dă bazei de date un disc care rămâne, și generează
secretul de sesiune. Nu e nimic de completat prin formulare.

**Verificarea de pornire** (`src/pornire.js`) nu lasă aplicația să pornească
dacă ceva e pus greșit, și scrie ce anume. Dacă vezi un mesaj de forma
„Aplicația NU pornește", nu e o defecțiune — e plasa de siguranță.

---

## Pasul 1: codul pe GitHub

Render ia codul dintr-un depozit. Deocamdată codul e doar pe calculatorul tău.

Îți faci cont pe **github.com** (gratuit), faci un depozit nou și **privat**
numit `pal-calc`, iar eu urc codul acolo. Îmi spui doar când e gata contul.

*De ce privat:* codul conține felul în care se calculează debitarea, adică
munca ta. Nu e nevoie să-l vadă lumea.

---

## Pasul 2: contul pe Render

Pe **render.com**, „Get Started" → te legi cu contul de GitHub. Nu-ți cere
altă parolă.

Apoi: **New → Blueprint** → alegi depozitul `pal-calc`.

Render citește `render.yaml` și-ți arată ce va face. Îți cere patru lucruri
de completat, fiindcă alea nu pot sta în cod:

| Ce-ți cere | Ce pui |
|---|---|
| `APP_URL` | `https://cutmodul.com` |
| `STRIPE_SECRET_KEY` | din contul tău Stripe |
| `STRIPE_WEBHOOK_SECRET` | din contul tău Stripe |

Dacă n-ai încă cont Stripe, pui chei de test (`sk_test_...`) și aplicația
pornește — doar că plățile nu încasează bani. Se schimbă oricând.

Apeși „Apply". În câteva minute aplicația e sus, la o adresă de forma
`palcalc.onrender.com`.

---

## Pasul 3: domeniul

În Render, la aplicație → **Settings → Custom Domain** → adaugi
`cutmodul.com`. Îți dă două rânduri de text (niște adrese).

Alea se pun în **zona DNS** a domeniului, la cyber_Folks. Acolo chiar e mai
simplu să-i rogi pe ei: le trimiți rândurile și spui „vă rog să le puneți în
zona DNS pentru cutmodul.com". E treaba lor și o fac în câteva minute.

Certificatul https îl face Render singur, pe gratis.

---

## Pasul 4: contul de administrator

O singură dată, din Render → **Shell**:

```
npm run seed
```

Îți face contul de administrator cu adresa și parola pe care le pui în
`ADMIN_EMAIL` și `ADMIN_PASSWORD`. Parola trebuie să fie a ta, nu cea din
`.env.example` — aplicația verifică și refuză să pornească altfel.

---

## De știut, nu de făcut

**Baza de date e un singur fișier.** Toate comenzile, corpurile și conturile
stau în `app.db`, pe discul montat la `/var/date`. Discul ăla **rămâne** între
actualizări — de-aia e declarat în `render.yaml`. Fără el, fiecare actualizare
ar șterge tot, în tăcere: aplicația ar porni frumos, doar că goală.

**Copie de siguranță.** Render face copii ale discului pe planurile plătite,
dar merită să-ți iei și tu una din când în când. E singurul lucru care nu se
poate reface din cod.

**Actualizările.** Când schimb ceva în cod și urc pe GitHub, Render pornește
singur versiunea nouă. Nu ai nimic de făcut.

**Webhook-ul Stripe.** În panoul Stripe, adaugi
`https://cutmodul.com/webhooks/stripe` ca destinație. Fără el, plățile se fac
dar creditul nu se adaugă în cont.

---

## Dacă totuși cyber_Folks are Node

Dacă îi întrebi și-ți spun că pachetul permite aplicații Node.js, atunci se
poate și acolo, și scapi de cei 7 € lunar.

În cPanel ar fi: **Setup Node.js App** → aplicație nouă, fișier de pornire
`server.js`, apoi `npm ci --omit=dev` și un fișier `.env` (ți-am pregătit
conținutul în `.lucru/env-productie.txt`). Atenție la același lucru: `DATA_DIR`
trebuie să arate în afara dosarului aplicației.

Spune-mi dacă ajungem acolo și-ți scriu pașii pe îndelete.
