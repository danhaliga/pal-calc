# Punerea aplicației pe cutmodul.com

Găzduirea e **cPanel pe CloudLinux**, la cyber_Folks. CloudLinux e chiar
componenta care aduce în cPanel unealta de Node.js, deci există o șansă bună
— dar gazda poate s-o aibă oprită, iar pe pagina de prezentare a planului nu
scrie nimic despre Node, doar despre PHP și WordPress.

**Primul pas e o verificare, nu o instalare.** Dacă Node lipsește, pașii de
mai jos nu se pot face deloc și e mai bine să afli asta în cinci minute
decât după două ore de urcat fișiere.

---

## 0. Verificarea care hotărăște totul

În cPanel, caseta de căutare de sus → scrie **`node`**.

| Ce vezi | Ce înseamnă |
|---|---|
| **Setup Node.js App** (secțiunea Software) | se poate, mergi mai departe |
| nimic | găzduirea e doar PHP — vezi *Dacă nu există Node* la final |

Dacă apare, deschide-o și notează **ce versiuni** îți dă în listă. Aplicația
cere Node **18 sau mai nou** (`engines` din `package.json` zice `>=20`; merge
și pe 18, dar nu sub).

Tot în căutare, scrie **`terminal`** și **`ssh`**. Dacă apare **Terminal** sau
**SSH Access**, restul e mult mai ușor.

---

## 1. Ce urci și ce nu

**Nu urca** niciodată:

- `node_modules/` — se instalează pe server, cu binare pentru Linux, nu cele
  de pe Windows. `better-sqlite3` are cod nativ: binarul de pe calculatorul
  tău nu merge acolo.
- `data/` — baza de date locală, cu conturile și corpurile de probă.
- `.env` — secretele de pe calculatorul tău.
- `.lucru/` — fișierele mele de lucru.

**Urci** restul: `server.js`, `src/`, `shared/`, `views/`, `public/`,
`locales/`, `scripts/`, `db/`, `package.json`, `package-lock.json`.

Cel mai simplu: arhivă `.zip` cu ele, urcată prin **File Manager**, apoi
*Extract*. Cu SSH, un `git clone` e mai curat.

---

## 2. Aplicația Node în cPanel

În **Setup Node.js App** → *Create Application*:

| Câmp | Ce pui |
|---|---|
| Node.js version | cea mai mare din listă, minimum 18 |
| Application mode | `Production` |
| Application root | dosarul unde ai urcat (ex. `cutmodul`) |
| Application URL | `cutmodul.com` |
| Application startup file | `server.js` |

Salvezi. cPanel îți face un dosar și îți arată o comandă de forma
`source /home/.../bin/activate` — aia e mediul Node al aplicației.

---

## 3. `.env`

În **File Manager**, în dosarul aplicației, fă un fișier numit **`.env`** și
pune în el conținutul din `.lucru/env-productie.txt`. Are deja un secret de
sesiune generat, lung și numai al tău.

Mai ai de completat două lucruri:

- **`ADMIN_PASSWORD`** — parola contului de administrator al aplicației. Nu
  cea de la găzduire, altă parolă. Dacă o lași pe cea din `.env.example`,
  aplicația refuză să pornească.
- **`STRIPE_SECRET_KEY`** și **`STRIPE_WEBHOOK_SECRET`** — din contul tău
  Stripe. Cu chei de test (`sk_test_...`) aplicația pornește și doar te
  avertizează; pentru bani adevărați îți trebuie chei live.

---

## 4. Instalarea și baza de date

Din **Terminal** (sau din butonul *Run NPM Install* al aplicației):

```
cd ~/cutmodul
npm ci --omit=dev
npm run migrate
npm run seed
```

- `npm ci` instalează exact versiunile din `package-lock.json`.
  `better-sqlite3` încearcă întâi un binar gata compilat pentru Linux; dacă
  nu-l găsește, îl compilează, și atunci are nevoie de unelte de compilare
  pe server. Dacă pică aici, spune-mi ce scrie.
- `npm run migrate` face tabelele.
- `npm run seed` face contul de administrator, o singură dată.

Apoi **Restart** la aplicație, din cPanel.

---

## 5. Dacă nu pornește

Aplicația **refuză înadins** să pornească pe o adresă publică cu configurație
nesigură, și scrie de ce. Dacă în jurnal vezi ceva de forma:

```
Aplicația NU pornește. Pe o adresă publică, astea nu sunt opționale:
  1. SESSION_SECRET ...
```

nu e o defecțiune, e verificarea din `src/pornire.js` care-și face treaba.
Repari ce scrie acolo în `.env` și repornești. Verificările sunt:

- `SESSION_SECRET` pus, nu cel din `.env.example`, minimum 32 de caractere
- `APP_URL` pe **https**
- `PAYMENT_DRIVER` să nu fie `fake`
- cheile Stripe prezente, dacă driverul e `stripe`
- niciun cont de administrator cu parola din `.env.example`

---

## 6. După ce merge

**Certificatul https.** În cPanel → *SSL/TLS Status* → *Run AutoSSL*.
Fără https, aplicația nici nu pornește.

**Contul `admin@local.test`.** Dacă baza de pe server e nouă, nu există — bine.
Dacă vreodată ajunge acolo, ori îi schimbi parola, ori îi iei drepturile de
administrator. Are parola scrisă în `.env.example`, care e publicată.

**Copie de siguranță.** Toată baza de date e un singur fișier: `data/app.db`.
Merită luat periodic. Cu comenzi, corpuri și conturi cu tot, e singurul lucru
de pe server care nu se poate reface din depozit.

**Webhook-ul Stripe.** În panoul Stripe, adaugă
`https://cutmodul.com/webhooks/stripe` ca destinație. Fără el, plățile se fac
dar creditul nu se adaugă.

---

## Dacă nu există Node

Atunci aplicația nu poate sta pe găzduirea asta așa cum e — nu e ceva de
ocolit, e PHP contra Node.

`cutmodul.com` poate rămâne acolo cu o pagină de prezentare statică, iar
aplicația să meargă pe un server mic separat (5–10 € pe lună), cu domeniul
sau un subdomeniu îndreptat spre el. Spune-mi dacă ajungem aici și-ți pun
variantele concrete, cu prețuri.
