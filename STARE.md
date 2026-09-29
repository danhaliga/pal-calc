# Unde suntem

Scris pe 29 septembrie 2026. Documentul ăsta se dă unui Claude nou ca să
poată prelua lucrul fără să întrebe de la capăt — pe calculatorul lui Dan sau
direct pe server.

Dacă citești asta și ești Claude: citește-l tot înainte să atingi ceva.
Jumătățile de context au costat deja timp în sesiunea de dinainte.

---

## 1. Ce e aplicația

**PAL Calc** — din cotele unui corp de mobilă scoate lista de debitare: ce
piese se taie, la ce cotă finită și la ce cotă de tăiere, cu ce cant pe
fiecare muchie, plus feroneria, croirea în coli și fișa de montaj.

- **46 de modele** în catalog, **7 categorii**, **30 de limbi**
- **491 de teste**, toate trec: `npm test`
- Node ≥ 20, Express 4, EJS, better-sqlite3, zod, bcryptjs
- Motorul de calcul (`shared/*.js`) e UMD: **același fișier rulează și pe
  server, și în browser**. Nu-l rupe în două.

Omul pentru care e scrisă: **Dan Haliga, producător de mobilă, nu
programator.** Vezi capitolul 8 înainte să-i scrii ceva.

---

## 2. Unde rulează, în trei locuri

| unde | ce e | stare |
|---|---|---|
| calculatorul lui Dan | `C:\Users\Dan.Haliga\Documents\corpuri-mobila\pal-calc` | se pornește cu `porneste.bat`, merge pe `localhost:3000` |
| GitHub | `github.com/danhaliga/pal-calc` (public) | ramura `main`, de aici se ia peste tot |
| Render | `palcalc.onrender.com` | **merge**, se actualizează singur la fiecare `git push` |
| VPS propriu | **https://cutmodul.com** | **live**, cu https, din 29 septembrie. Plata e încă „fake" — vezi 4c |

Render și VPS-ul rulează amândouă în paralel, cu baze de date separate.
Nu s-a hotărât încă dacă Render se oprește.

---

## 3. Serverul propriu — cum e făcut

Ubuntu 22.04, container Virtuozzo, 8 GB RAM, 85 GB liberi. Nume: `server.cutmodul.com`.
Serverul era **gol** — `arlechinromania.ro` are alt IP (91.200.122.99), numele
invers de pe IP e doar o rămășiță.

```
/opt/palcalc          codul (git clone), al lui root, aplicația nu poate scrie în el
/var/palcalc          baza de date — RĂMÂNE la actualizări de versiune
/opt/palcalc/.env     setările, root:palcalc 640
/etc/systemd/system/palcalc.service
/etc/apache2/sites-available/palcalc.conf
/root/parola-palcalc.txt   parola contului de administrator
```

- **Node 22.23.3** de la NodeSource
- Utilizatorul de sistem **`palcalc`**, fără shell. Serviciul rulează sub el,
  nu sub root, și poate scrie doar în `/var/palcalc`.
- **systemd** îl pornește la boot și îl ridică dacă pică (`Restart=always`)
- **Apache** stă în față ca proxy invers spre `127.0.0.1:3000`. Era deja
  instalat și ținea portul 80; n-are rost nginx pe lângă el.
- Pe **IP** răspunde pagina implicită Ubuntu, nu aplicația — înadins, ca să
  n-o găsească nimeni cât timp plata e pe „fake".

### Ce e în `.env` acum

```
PORT=3000
APP_URL=http://localhost:3000     ← de schimbat când intră domeniul
DATA_DIR=/var/palcalc
PAYMENT_DRIVER=fake               ← de schimbat pe stripe
PRICE_PER_CORP_CENTS=500
CURRENCY=ron
SESSION_SECRET=...                ← făcut pe server cu openssl, nu-l trece prin chat
```

`APP_URL` pe `localhost` e o punte, nu o scăpare: `src/pornire.js` consideră
aplicația „publică" dacă `NODE_ENV=production` **sau** dacă `APP_URL` nu e
local, iar atunci refuză să pornească fără https și fără cheile Stripe. Cu
`localhost` pornește și merge prin Apache. Se schimbă la pasul cu certificatul.

---

## 4. Ce a mai rămas de făcut, în ordine

### a. DNS-ul — FĂCUT pe 29 septembrie

Nameserverele domeniului sunt `ns1-ns4.cyberfolks.ro`. Suportul lor a mutat
înregistrarea A de la `93.119.153.225` pe `188.212.156.158`. Subdomeniul cu
prefix urmează singur, fiindcă e legat de domeniul principal.

**MX-ul:** arăta spre chiar `cutmodul.com`, adică spre adresa care se mută.
Dan a confirmat pe 29 septembrie că **nu are nicio căsuță de mail pe domeniu**,
deci nu e nimic de reparat acolo. Dacă își face vreodată, MX-ul trebuie mutat
pe `mail.cutmodul.com` (există deja, arată spre serverul cyberFolks).

### b. Certificatul https — FĂCUT pe 29 septembrie

Let's Encrypt, valabil până pe 28 decembrie 2026, acoperă amândouă numele.
`http` întoarce 301 spre `https`. Reînnoirea e pe `certbot.timer`, singură.
Comanda cu care s-a făcut, dacă e nevoie vreodată din nou:

```bash
apt-get install -y certbot python3-certbot-apache
DOM=cutmodul.com; W=w; W="$W$W$W"
certbot --apache -d "$DOM" -d "$W.$DOM" --agree-tos -m danhaliga@gmail.com --redirect -n
```

Se reînnoiește singur, systemd are deja `certbot.timer`.

### c. Trecerea în producție — SINGURUL LUCRU RĂMAS

După certificat, în `/opt/palcalc/.env`:

```
APP_URL=https://cutmodul.com
NODE_ENV=production
PAYMENT_DRIVER=stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

apoi `systemctl restart palcalc`.

**Cheile Stripe lipsesc încă.** Până intră, plata e pe „fake": oricine ajunge
pe site își face cont și își pune singur credit. Nu e pagubă în bani — creditul
ăla nu e bani adevărați — dar înseamnă corpuri calculate gratis. Site-ul e
deja public, deci ăsta e singurul lucru care mai stă între el și o comandă
adevărată.

### d. De curățat, oricând

- `admin@local.test` are încă parola din `.env.example`. De șters contul sau
  de schimbat parola. (Asta e pe baza LOCALĂ a lui Dan, nu pe server.)
- Pe server e root cu parolă pe portul 22. De pus cheie SSH și de oprit
  autentificarea cu parolă.

---

## 5. Cum se actualizează aplicația pe server

Când s-a împins cod nou pe `main`:

```bash
cd /opt/palcalc && git pull && npm ci --omit=dev && systemctl restart palcalc && sleep 3 && systemctl is-active palcalc
```

Baza de date nu se atinge: stă în `/var/palcalc`, în afara dosarului care se
înlocuiește. Migrațiile din `db/migrations/` se aplică singure la pornire.

### Dacă nu pornește

```bash
journalctl -u palcalc -n 30 --no-pager
```

`src/pornire.js` scrie în românește ce anume lipsește. Un mesaj „Aplicația NU
pornește" nu e o defecțiune, e plasa de siguranță.

---

## 6. Ce s-a lucrat pe 29 septembrie 2026

Șaisprezece comituri. Ce contează:

**Corpuri și feronerie**
- **Soclul** — corpul care stă pe podea fără picioare, cu bucata din față.
  Se poate ține minte ca setare și vine singur la corpurile de pe podea,
  ridicând `H` cu el.
- **Traverse în loc de blat** — corpul de bază n-are capac întreg. Reglabile
  40–100, standard 60. La un corp de 800: 2 × 764×58.5 în loc de 764×556,
  adică 64 % mai puțin PAL pe partea de sus.
- **Nișa** — gol între zonele cu uși: coloana de cuptor (ușă jos, gol, ușă sus)
  și cea de frigider (gol de la fund).
- **Uși glisante** — alt fel de ușă, cu suprapunere și șine.
- **Sertarele se pot pune jos**, cu ușile deasupra — corpul de cuptor cu
  sertar dedesubt.
- **Mânerul** — se pune sau nu, orizontal sau vertical, la mijloc/stânga/
  dreapta/sus/jos, cu lungime în milimetri. Se vede și în vederea 3D, ca bară
  de metal, cu grupă proprie de stins.
- **Comandă fără fronturi** — se livrează doar corpul. Cotele fronturilor nu
  se pierd: intră în avertisment, cote finite.
- **Unsprezece modele noi** plus corpul îngust pentru cargo. 46 în total.

**Comenzi**
- **Două decoruri la deschiderea comenzii**: carcase și fronturi, fiecare cu
  producătorul, grosimea și cantul lui. Plus întrebarea de unde se fac cutiile
  de sertar.
- Panoul de feronerie stă **strâns** pe pagina comenzii.

**Erori găsite și reparate pe drum** (astea sunt cele care contau)
1. **Ușa intra peste frontul de sertar.** La un corp cu nișă, înălțimea ușii
   se măsura până în tavan fără să scadă fronturile de sertar. Ieșeau două
   uși de 512 ȘI un front de 150 peste aceiași 150 mm — două piese tăiate
   pentru același loc. Mergea de când există nișa.
2. **Mânerul ieșea din front** când era pus „sus" pe un front scurt.
3. **Mânerele se numărau cu `nUsi + nSer`** — la coloana de cuptor ieșeau două
   canaturi dar se comanda un singur mâner.
4. **Butonul „Șterge" nu ștergea**: `window.confirm()` nu răspunde în panoul
   din aplicație. Înlocuit cu un `<dialog>` al paginii.

**Anulat la cererea lui Dan:** unitățile în țoli. S-au scos cu `git revert`.

---

## 7. Ce a rămas nefăcut, din tot proiectul

- **Plinta aplicată** pentru corpurile pe picioare. Nu e modelată deloc.
  Întrebarea la care Dan n-a răspuns încă: se taie o bucată lungă pe
  bucătărie, sau una pe corp? Fără răspuns, se face piesă la nivel de comandă,
  cu lungimea însumată din corpurile pe picioare.
- **Vitrina** — cere ușă pe cadru, cu sticlă la mijloc.
- **Corp bază de cuptor** — cuptor sub blat cu sertar dedesubt. A devenit
  posibil acum, după ce sertarele se pot pune jos; mai trebuie modelul.
- **Corpurile de colț pe soclu** — ramura de colț din `calc.js` își taie
  piesele ei și nu știe de soclu.
- **Desenul de pe card nu știe de setările omului.** Cardul din catalog
  desenează modelul curat; corpul creat vine cu soclul din setări, deci poza
  minte. Dan a fost întrebat, a zis „m-am prins" — dar gaura a rămas.

---

## 8. Cum se lucrează cu Dan

Trei lucruri, toate învățate pe pielea mea:

**Mergi până la capăt fără să întrebi.** Dan e producător de mobilă, nu
programator. Odată ce a cerut ceva, se duce până la rezultat — scris, testat,
comis, urcat — fără opriri de forma „vrei să...?" și fără alegeri tehnice pe
care n-are cum să le judece. Urcarea pe `palcalc.onrender.com` e aprobată din
oficiu.

**Măsurat bate presupus.** Constantele de atelier se măsoară din lucrări
reale, nu se iau din cărți. `reducereCant()` e măsurată pe 96 de piese din
patru lucrări; comentariul de deasupra ei spune de unde vine fiecare cifră.
Când nu există măsurători pentru ceva, se construiește măsurătoarea, nu se
inventează constanta.

**Nu se intră pe conturile lui.** Parolele lui nu se folosesc: nici în panouri
de găzduire, nici prin SSH pe server. Când e nevoie de ceva acolo, se scrie o
singură lipire pe care o dă el, fără nimic de completat și fără nimic de ales,
și care se verifică singură la final. A funcționat: serverul e pus în
întregime așa.

Pentru probe în browser pe aplicație: se pornește un server propriu pe alt
port, cu `DATA_DIR` în altă parte. Baza lui nu se atinge. S-a greșit de trei
ori altfel, o dată cu 15 lei de credit adevărat pierduți.

---

## 9. Capcane care au costat timp

**Textul care trece prin chat se strică.** Orice arată a adresă web — mai ales
cu prefixul de trei litere — se transformă în legătură cu paranteze drepte.
Ne-a costat trei runde pe o configurație Apache care de fapt era corectă:
fișierul de pe server era curat, doar copierea din terminal aici îl strica.
**Cum se ocolește:** nu scrie adresa întreagă în comandă. Pune-o într-o
variabilă și compune restul — `DOM=cutmodul.com`, `W=w; W="$W$W$W"`, apoi
`"$W.$DOM"`. Și când vrei să vezi ce scrie chiar în fișier, scoate punctele:
`... | tr '.' ' '`.

**Windows: CRLF vs LF.** `shared/calc.js`, `views/`, `public/app.js` sunt CRLF
în copia de lucru. Peticele cu text pe mai multe rânduri trebuie să suporte
amândouă, altfel nu se potrivesc. `.bat` TREBUIE să fie CRLF — vezi
`.gitattributes`.

**Scriptul de traduceri amestecă pe UN SINGUR NIVEL.** Rulat cu un fișier care
are spațiul `modele`, a șters tot catalogul din toate cele 30 de limbi, tăcut.
S-a reparat și s-a pus o oprire în `.lucru/cont-traduceri.js`. Pentru modele
există `.lucru/pune-modele.js`, care amestecă pe două niveluri.

**`window.confirm()` nu răspunde** în panoul din aplicație. Folosește
`<dialog>`-ul din `views/layout.ejs`.

**Heredoc-urile din bash crapă** pe accente grave și ghilimele din JavaScript.
Pentru fișiere cu cod, scrie-le cu unealta de scris fișiere, nu cu `cat <<EOF`.

---

## 10. Unde sunt lucrurile

```
shared/calc.js      motorul: cote, piese, cant, geometrie 3D
shared/models.js    catalogul de modele, schița SVG de pe card, rezumatul
shared/raport.js    raportul comenzii: materiale, feronerie, croire, CNC
shared/feronerie.js cifrele sistemelor de feronerie (Blum, Häfele)
shared/i18n.js      cele 30 de limbi
src/                rutele Express, baza de date, conturile, plata
views/              paginile EJS
public/app.js       editorul de corp: formular, tabel, vederea 3D
locales/*.json      textele, 30 de fișiere
tests/              22 de fișiere, 491 de teste
.lucru/             scripturi de-o dată: traduceri, petice, probe
db/migrations/      schema, se aplică singură la pornire
```

Cifrele de atelier (cantul, pragurile, limitele traverselor) stau în
`shared/calc.js`, fiecare cu un comentariu care spune **de unde vine**. Nu le
schimba fără o măsurătoare.
