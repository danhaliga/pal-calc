# PAL Calc

Site local pentru calculul corpurilor de mobilă din PAL: dai cotele, vezi corpul în 3D și primești
lista de debitare. Corpurile se salvează în cont; lista completă de debitare (cotele de tăiere și
cantul pe fiecare muchie) se deblochează prin plată, per corp.

Motorul de calcul este cel din `calculator-debitare.html`, mutat în `shared/calc.js` și folosit
în ambele locuri: pe server (pentru lista plătită și CSV) și în browser (pentru vederea 3D).

## Cerințe

- Node.js 20 sau mai nou (testat pe Node 24.19 / npm 11.17, Windows 11, fără WSL)
- Nimic altceva: baza de date este un fișier SQLite, iar Three.js se încarcă din CDN

## Instalare și pornire

```bash
npm install
cp .env.example .env      # pe Windows: copy .env.example .env
npm run migrate
npm run seed
npm run dev
```

Apoi deschide <http://localhost:3000>.

`npm run seed` creează contul de administrator din `.env` (implicit `admin@local.test` / `admin1234`)
și patru corpuri exemplu. Schimbă parola din `.env` înainte de orice utilizare reală.

### Conturi de test

Înregistrarea publică cere email valid și parolă de minim 8 caractere. Pentru conturi de test poți
ocoli aceste reguli, direct în baza de date:

```bash
node scripts/create-user.js danh dan --name "Cont de test"
```

Câmpul de login acceptă și un nume simplu, nu doar email (căutarea se face pe egalitate exactă,
fără diferență între majuscule și minuscule). Rulat pe un cont existent, scriptul îi schimbă parola.
**Nu folosi astfel de conturi în producție.**

| Comandă | Ce face |
|---|---|
| `npm run dev` | pornește serverul cu reîncărcare la modificarea fișierelor |
| `npm start` | pornește serverul simplu |
| `npm run migrate` | aplică migrațiile din `db/migrations/` (rulează și la pornire) |
| `npm run seed` | creează contul admin și corpurile exemplu (se poate rula de mai multe ori) |
| `node scripts/create-user.js <utilizator> <parola> [--admin]` | cont creat direct în baza de date, fără regulile formularului |
| `npm test` | testele motorului de calcul |
| `node tests/e2e.manual.js` | verificare end-to-end pe serverul pornit (auth, gating, plată, izolare) |

## Gratuit vs. plătit

| | Corp `draft` | Corp `paid` |
|---|---|---|
| Formular, salvare automată | da | da |
| Vedere 3D, explodare, selecție piesă | da | da |
| Cote finite (L × l), bucăți, fibră | da | da |
| Avertismente (poliță lungă, glisieră etc.) | da | da |
| Cant pe muchii, cote de tăiere | blocat | da |
| Export / copiere CSV | nu | da |

Pentru un corp `draft`, câmpurile `TL`, `Tl` și `c` **nu pleacă de pe server**: endpoint-ul
`GET /api/corps/:id/pieces` le include doar când corpul este plătit. Poți verifica în Network tab.

> Limită cunoscută, asumată de arhitectura cerută: `shared/calc.js` se încarcă și în browser, pentru
> vederea 3D. Un utilizator tehnic poate deci recalcula singur cotele de tăiere în consolă
> (tăiere = finit − cant, cu cantul introdus tot de el). Blocajul este corect la nivel de API și CSV,
> dar nu este un secret criptografic. Dacă asta contează comercial, varianta următoare este să muți
> geometria 3D pe server și să trimiți în browser doar cutiile, fără piesele de calcul.

## Plata

Se configurează din `.env`:

```
PAYMENT_DRIVER=fake      # 'fake' sau 'stripe'
PRICE_PER_CORP_CENTS=1500
CURRENCY=ron
```

**`fake`** (implicit): apăsarea butonului marchează corpul ca plătit pe loc și scrie un rând în
`payments` cu `provider='fake'`. În pagină apare bara „Plată de test”.

**`stripe`**: completezi cheile de test și repornești. Nu trebuie schimbat cod.

```
PAYMENT_DRIVER=stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
APP_URL=http://localhost:3000
```

1. Apasă „Deblochează lista de debitare”: aplicația creează o sesiune Stripe Checkout și te redirectează.
2. Plătește cu cardul de test `4242 4242 4242 4242`, dată viitoare, orice CVC.
3. La întoarcere, `/payments/success` interoghează Stripe (`checkout.sessions.retrieve`) și, doar dacă
   `payment_status === 'paid'` iar sesiunea îți aparține, marchează corpul plătit. **Funcționează și
   fără webhook.** Niciun corp nu devine plătit pe baza unui parametru din URL.
4. Webhook-ul este opțional local, pentru confirmare asincronă:

```bash
stripe listen --forward-to localhost:3000/webhooks/stripe
```

Ambele căi (întoarcerea din Checkout și webhook-ul) sunt idempotente: sesiunea Stripe are index unic
în `payments.provider_ref`, iar marcarea se face o singură dată.

## Structura

```
server.js                bootstrap Express, sesiuni, securitate, layout, erori
src/db.js                SQLite + rularea migrațiilor
src/auth.js              register / login / logout, requireAuth, requireAdmin
src/corps.js             CRUD corpuri, /api/corps/:id/pieces, export CSV
src/payments.js          driver fake / stripe, checkout, success, webhook
src/csrf.js              token CSRF în sesiune (formulare + antet x-csrf-token)
src/admin.js             /admin: utilizatori, corpuri, plăți, total încasat
shared/calc.js           motorul de calcul + paramsSchema (zod, doar pe server)
public/app.js            editorul: formular, 3D (Three.js), listă, salvare automată
public/styles.css        stilurile (aceeași paletă și tipografie ca originalul)
views/                   EJS: layout, landing, auth, corpuri, plăți, admin
db/migrations/001_init.sql
tests/calc.test.js       teste pe motorul de calcul
tests/e2e.manual.js      verificare end-to-end pe serverul pornit
data/app.db              baza de date (ignorată de git)
```

## Rute

| Metodă | Rută | Ce face |
|---|---|---|
| GET | `/` | prezentare; redirect la `/corps` dacă ești logat |
| GET/POST | `/register`, `/login` | conturi (limitare: 10 încercări / 15 min / IP) |
| POST | `/logout` | deconectare |
| GET | `/corps` | lista corpurilor tale |
| POST | `/corps` | corp nou cu valorile implicite |
| GET | `/corps/:id` | editorul |
| PUT | `/api/corps/:id` | salvează parametrii (validați cu `paramsSchema`) |
| POST | `/corps/:id/duplicate` | duplică (rezultatul este `draft`) |
| DELETE | `/api/corps/:id` | șterge |
| GET | `/api/corps/:id/pieces` | piesele; câmpurile plătite doar dacă `status='paid'` |
| GET | `/corps/:id/export.csv` | CSV (doar corp plătit, altfel 402) |
| POST | `/corps/:id/pay` | pornește plata |
| GET | `/payments/success`, `/payments/cancel` | întoarcerea de la Stripe |
| POST | `/webhooks/stripe` | webhook semnat |
| GET | `/admin` | doar administratori |

Orice corp al altui utilizator răspunde **404**, nu 403, ca să nu confirme că există.

## Securitate

- parole cu bcrypt, cost 12 (`bcryptjs` — aceeași funcție, fără compilare nativă pe Windows)
- sesiuni în SQLite, cookie `httpOnly`, `sameSite=lax`; `secure` se activează singur dacă `APP_URL` e https
- CSRF pe toate cererile care schimbă date; webhook-ul Stripe e exceptat și verificat prin semnătură
- `helmet` cu CSP: scripturi doar de pe același origin și cdnjs, fără scripturi inline
- validare `zod` pe toți parametrii (100–3000 mm pe dimensiuni, enum-uri pentru selecții)
- limitare la login și register

## De știut

- `npm install` afișează un avertisment `allow-scripts` pentru `better-sqlite3`. Pachetul include
  binarul precompilat, deci aplicația funcționează; nu e nevoie de `npm approve-scripts`.
- Testele pentru Stripe au fost scrise, dar **nu au fost rulate cu chei reale de test** — nu există
  cont Stripe configurat pe această mașină. Driverul `fake` este verificat complet.
- Toate cotele sunt în mm. Verifică întotdeauna cu serviciul de debitare dacă cere cota finită sau cea brută.
