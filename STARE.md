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

- **51 de modele** în catalog, **7 categorii**, **30 de limbi**
- **623 de teste**, toate trec: `npm test`
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
| VPS propriu | **https://cutmodul.com** | **live**, cu https, din 29 septembrie. Plata e pe bani virtuali, înadins — vezi 4c |

**Dan a hotărât pe 30 septembrie: se lucrează NUMAI pe cutmodul.com.** Orice
schimbare se pune și se verifică acolo, și numai despre el i se vorbește.
Render mai primește singur fiecare `git push`, dar pentru Dan nu există: două
site-uri cu baze diferite l-au încurcat (a încercat o parolă pe cel greșit).

Conturi pe cutmodul.com: `danhaliga@gmail.com` e administratorul (parola în
`/root/parola-palcalc.txt`, pusă din nou pe 30 septembrie). `123` / `123` e
un cont de PROBĂ, fără drept de administrator, cu 500 lei virtuali — cerut de
Dan ca să nu piardă timp cu autentificarea. Nu-l face administrator: site-ul
e public.

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
PAYMENT_DRIVER=fake               ← rezervă; felul plății se alege din Administrare → Plata
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

### c. Plata — se face din Administrare → Plata, nu din `.env`

Din 29 septembrie (seara) cheile Stripe **nu se mai pun în `.env`**. Se pun
din contul de administrator: **Administrare → Plata**. Acolo:

- se alege felul plății: **bani virtuali** (probă) sau **Stripe**;
- se lipește cheia secretă `sk_live_…`; aplicația o verifică la Stripe
  înainte s-o salveze, și o ține criptată în baza de date (`src/setari.js`,
  tabelul `setari`, cheia de criptare e scoasă din `SESSION_SECRET`);
- secretul webhook-ului (`whsec_…`) îl face aplicația singură în Stripe —
  dar numai dacă `APP_URL` e pe https (vezi mai jos).

Ce e pus în aplicație bate ce e în `.env`; `.env` rămâne rezervă (Render).

**Dan a hotărât pe 29 septembrie: rămâne pe bani virtuali, pentru probe.**
Oricine își face cont își pune singur credit virtual. E voit. Pagina de
plată o arată cu roșu.

Plata nu mai oprește pornirea (`src/pornire.js`): cu cheile în aplicație,
aplicația trebuie să fie pornită ca să le poți pune. Stripe ales cu o cheie
lipsă **oprește alimentarea**, nu cade pe credit gratis.

**Când trece pe Stripe, pe server mai trebuie, o singură dată:**

1. în `/opt/palcalc/.env`: `APP_URL=https://cutmodul.com` și
   `NODE_ENV=production` (altfel Stripe trimite omul înapoi pe localhost
   după plată, și webhook-ul nu se poate face);
2. în Apache, în vhost-ul de 443: `RequestHeader set X-Forwarded-Proto "https"`
   (`a2enmod headers`). Fără el, cu `APP_URL` pe https cookie-ul de sesiune
   devine `secure`, Express crede că cererea e pe http și **nu mai trimite
   cookie-ul — nu mai poate intra nimeni în cont**;
3. `systemctl restart palcalc`, apoi cheile din Administrare → Plata.

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

### Corpul de sub scară se cere din trei cote (29 septembrie, seara)

Dan a cerut: bază, înălțimea din dreapta, înălțimea din stânga. Atât. Până
atunci trebuia să dea patru laturi ȘI patru unghiuri — adică să socotească
singur panta cu Pitagora și cele două unghiuri cu arctangenta.

`PalCalc.conturSubScara(baza, hDreapta, hStanga)` scoate conturul întreg;
`coteSubScara()` îl citește înapoi, ca să se umple casetele din editor din
corpul deschis. În editor: trei casete și un buton, în panoul de contur.
Merge și invers (scara coboară spre stânga) și degenerat (înălțimi egale →
dreptunghi curat).

**Și o eroare care venea de-acolo:** conturul modelului era scris de mână,
cu unghiurile rotunjite la grad (114 și 66 în loc de 113.962 și 66.038). Nu
se închidea — rămâneau 0.2 mm în colț. Pe desen nu se vedea, dar muchia din
stânga ieșea din dreptunghiul de gabarit, `muchiiFrontale` o socotea muchie
de decupat, iar planșa CNC cerea o frezare de 800 mm pe o latură care se
taie drept la panou. Acum conturul se închide sub 0.05 mm la orice potrivire
de cote.

---

## 6b. Ce s-a lucrat pe 29 septembrie, seara (pe server, în sesiunea „server_nou")

- **Administrare → Plata**: cheile Stripe și felul plății se pun din aplicație
  (criptate în baza de date), nu din `.env`. Rămâne pe bani virtuali, voit.
- **Corp bază de cuptor**: motorul știe nișa FĂRĂ uși — sertar jos, cuptor
  deasupra, poliță fixă între ele. Model `baza-cuptor`.
- **Colțurile de jos pe soclu**: L (două bucăți), diagonal (una, cu unghiurile
  scrise pe ea), orb (ca un corp drept).
- **Plinta de aluminiu și picioarele** (răspunsul lui Dan: corp singur → soclu
  din PAL; bucătărie în șir → picioare de plastic + plintă de aluminiu
  cumpărată, o bară lungă, Häfele H100/120/150 în bare de 4 m). Se alege la
  feronerie, pe comandă; corpurile de bucătărie de jos vin cu `picioare: 1`.
- **Vitrina** (răspunsul lui Dan: ramă de aluminiu cumpărată): `usiSticla: 1`
  scoate ușile din debitare și le trece la „de comandat", cu balamale de ramă.
  Modele `sus-vitrina` și `vitrina`.
- Pe server există o cheie de acces la GitHub doar pentru depozitul ăsta
  (`/root/.ssh/github-pal-calc`, pusă de Dan ca „deploy key" cu scriere).
  Copia de lucru pentru modificări e separată de `/opt/palcalc`.

## 6d. Sub scară, preluat pe server (29 septembrie, noaptea)

Dan a oprit sesiunea de pe calculatorul lui să urce lățimile scrise de mână
(„lucrai tu la acele corpuri") și a cerut să le fac eu pe site. Făcute din
nou pe server, după descrierea de mai sus — codul de pe calculatorul lui
NU s-a urcat și **nu trebuie urcat peste**: ar dubla aceleași funcții.
Dacă se vrea ceva de acolo, se ia de mână, peste ce e pe GitHub.

- **Până la 10 corpuri** (cerut de Dan; era 4 în editor și pe server, 8 în
  motor). `PalCalc.SUB_SCARA_MAX = 10`.
- **Lățimile de mână**: casete A…J; primele se scriu, ultima e blocată și
  arată restul. `subScaraDinLatimi()` în `shared/calc.js` (null dacă vreun
  corp e sub `SUB_SCARA_LAT_MIN` = 100 mm sau nu rămâne destul pentru
  ultimul); `randeazaLatimi()` / `potrivesteRestul()` în `public/app.js`;
  ruta primește `latimi` și cade pe bucăți egale dacă nu se potrivesc.

## 6e. Corpul cu coș Jolly (29 septembrie, noaptea)

Modelul „cargo" era un corp cu o ușă: ieșeau balamale care nu se montează,
iar coșul nu apărea nicăieri. Acum param `jolly: 1`: frontul rămâne de tăiat
din PAL (aceeași cotă), dar se cheamă `frontJolly`, cu nota că se prinde pe
cadrul coșului — deci nu primește balamale. La feronerie: „Coș Jolly pentru
corp de {W} mm". Avertismente: lățime la care nu se vând coșuri (150, 200,
300, 400, 500), polițe, mai mult de un front. Modele `baza-jolly` (300),
`baza-jolly-200`, `baza-jolly-150`.

## 6f. Fișe CNC pe piesă pentru corpul de sub scară (29 septembrie, noaptea)

Dan: „la corpul de sub scară să existe desenele cu fiecare piesă 3D pentru
CNC, cu dimensiuni și unghiuri de tăiere clare — foarte important!!".

`shared/fisa-piesa.js` (UMD) face din `PalCalc.calc` câte o fișă pe piesă:
- **laturile îmbinate în unghi** (`panouLatura`): vederea pe față cu lungimea
  pe muchia exterioară și pe cea interioară, cele două capete mărite în
  secțiune cu unghiul de tăiere față de față (jumătate din unghiul colțului,
  luat EXACT din `res.contur.laturi`, nu din nota rotunjită) și înclinarea
  pânzei (90° − unghiul), plus 3D;
- **montantul**: fața înaltă / fața joasă, muchia de sus tăiată înclinat pe
  grosime (unghiul pantei), plus 3D;
- **spatele, ușile, polițele**: conturul cu fiecare latură cotată pe dinafară,
  unghiul din fiecare colț, dreptunghiul din care se taie, plus 3D.
Unghiurile se scriu cu două zecimale. Liniile au grosime fixă
(`vector-effect: non-scaling-stroke`, în `public/print.css`).

Unde se văd: planșa CNC a comenzii (`/orders/:id/print/cnc`, la sfârșit) și
`/corps/:id/fise` (buton „Fișe CNC pe piesă" în editor, numai la corpul
atipic; numai corp plătit). `layout-print.ejs` merge acum și fără comandă.

## 6g. Auditul din 29 septembrie, noaptea

- Probă automată pe toate modelele × 16 feluri de setări, plus sub-scara în
  1–10 bucăți pe patru pereți (872 de cazuri): cote ≤ 0, NaN, texte
  netraduse, desene stricate. **Găsit și reparat:** colțul în L cu brațele mai
  scurte decât adâncimea scotea o ușă de −131 mm (veche, nu de azi).
- Citire de cod (agent separat), reparate toate:
  1. **GRAV — sub scară, piesele dinăuntru nu intrau.** Motorul socotea
     golul ca și cum laturile ar sta călare pe contur (t/2), iar lista și
     fișele le pun înăuntru (cota pe muchia exterioară). Polița ieșea 982 în
     gol de 964, montantul cu ~20 mm prea înalt. Acum golul e
     `conturInterior(contur, t)` — conturul mutat înăuntru pe normala
     fiecărei laturi (sub pantă: t / cos(pantă)). Ușile de la capete ies
     acum mai late decât cele din mijloc (acoperă latura), ca la corpul drept.
  2. Colț intrând (> 180°): fișa scria unghiuri și cote negative; acum spune
     unghiul față de fața interioară și că aceasta e mai LUNGĂ.
  3. `POST /corps/:id/sub-scara` putea face corpuri pe care editorul nu le
     mai primește (> 3000) sau de 30 mm, plătite. Regulă comună
     `PalCalc.subScaraProblema()`, pe server și în editor.
  4. Lipsea textul `corp.subScara` din istoricul de credit.
  5. Soclu cerut dar nepus („peste") lăsa corpul fără picioare și plintă.
  6. „(1/1)" la împărțirea într-un singur corp.
  7. (veche) Ușile glisante primeau balamale; acum „sistem uși glisante".
- Jurnalul de pe server: nicio eroare a aplicației; doar roboți care caută
  WordPress și o autentificare greșită. Erorile „unable to open database file"
  din 15:31 sunt de la punerea serverului, dinainte de permisiuni.

## 6h. Sub scară: laterale pe bază, tavan între ele (30 septembrie)

Hotărât cu Dan: la corpul de sub scară lateralele stau PE bază, tavanul
(panta) stă ÎNTRE laterale, prindere cu eurosurub, fiecare corp cu lateralele
lui. Param `imbinare`: '' = drept la forma de sub scară (4 laturi: bază,
dreapta, pantă, stânga), 'unghi' = rama veche în unghi (rămâne la mansardă și
la celelalte forme). `capatLaterala`: 'drept' (implicit, varianta „a" a lui
Dan — tăiat drept la fața cea mai joasă, treaptă mică spre scară, ascunsă)
sau 'inclinat' („b" — pe pantă, înclinat pe grosime).

Piese: `fund` (baza, W), două `laterala` (polyFata = secțiunea lor),
`tavanPanta` ((W − 2t)/cos(pantă), capete verticale paralele, aceeași lungime
pe ambele fețe). Golul dinăuntru e același ca la rama în unghi, deci polițele,
montanții și ușile nu se schimbă. Secțiunile (`polySectiune: true`) NU sunt
contur de decupat în lista CNC — acolo ies la „tăiere la unghi".
Corpurile de sub scară deja făcute trec singure pe construcția nouă.

Fișele au acum un cuprins sus (pe telefon ușa venea ultima și nu se vedea).

## 6i. Planșele de montaj (30 septembrie)

Dan: „verifică la toate corpurile să existe planșe de montaj". Pagina de
montaj (`/orders/:id/print/montaj`) avea numai tabele și aceiași pași pentru
toți. Acum fiecare corp are:
- **desenul de montaj** (`shared/desen-montaj.js`): corpul desfăcut, în
  proiecție oblică, făcut din aceleași cutii ca vederea 3D, cu numărul
  fiecărei piese — același ca în tabel (1.1, 1.2 …);
- **pașii după corp**: sub scară (laterale pe bază, tavan între ele), rama în
  unghi, montanți, soclu, picioare, nișă, glisante (șine), Jolly, vitrină,
  piesă simplă (numai cant).
Verificat pe o comandă cu toate cele 52 de modele: fiecare are desen și pași.

## 6j. Facturarea (30 septembrie)

Dan are un program de facturare care face facturile și le trimite în SPV.
Aplicația NU face facturi: îi dă un CSV cu plățile și datele clienților.
- **Date de facturare** pe pagina de credit (`/credit#facturare`):
  persoană fizică / juridică, nume sau firmă, CUI, Reg. Com., adresă, oraș,
  județ, telefon (coloane noi în `users`: `tip_facturare`, `reg_com`, `judet`).
  Cu Stripe nu se alimentează fără ele; cu bani virtuali nu se cer.
- La plată, datele se copiază pe plată (`payments.facturare`, JSON).
- **Administrare → Facturare**: TVA (Dan: „da da" → plătitor, 21%), export
  CSV (`;`, virgulă zecimală, BOM) pe perioadă; „doar cele noi" marchează
  `payments.exportat_la` → nu se facturează de două ori. Plățile `fake` nu
  intră niciodată. `src/facturare.js`.
- **De aflat de la Dan:** numele programului de facturare — ca exportul să
  fie exact pe formatul lui de import.

## 6k. 30 septembrie, dimineața: copii, picioare, polițe, pagini legale

- **Copii automate ale bazei** (`scripts/copie-baza.js`, `db.backup` — un `cp
  app.db` pierde ce e încă în `app.db-wal`!). Zilnic la 03:30
  (`palcalc-copie.timer`) și înainte de fiecare actualizare; în
  `/var/palcalc/copii/`, 30 de zile. **Actualizarea se face de acum cu:**
  `cd /opt/palcalc && git pull && npm ci --omit=dev && sudo -u palcalc env DATA_DIR=/var/palcalc TZ=Europe/Bucharest node scripts/copie-baza.js inainte-de-actualizare && systemctl restart palcalc`
  Copiile `app.db.inainte-de-*` din `/var/palcalc` (făcute cu `cp`) pot să nu
  aibă ultimele scrieri. Lipsește încă o copie ÎN AFARA serverului.
- **4 picioare pe corp**, la orice lățime (Dan).
- **Sub scară, polițele** se împart pe toată înălțimea; cele de sub pantă se
  scurtează, cu capătul dinspre pantă tăiat înclinat (Dan, punctul 8).
- **Pagini legale** `/termeni`, `/confidentialitate`, `/cookies` (text în
  română) și subsol cu datele firmei + ANPC/SAL. Firma: **SMS FEEDBACK S.R.L.**,
  RO39565485, J22/1736/2018, Șos. Ungheni nr. 2, Iași — în `src/firma.js`.
  **De la Dan: emailul și telefonul firmei** (câmpurile sunt goale în
  `src/firma.js`). Platforma europeană SOL s-a închis în iulie 2025, deci
  rămâne doar SAL. CAEN-ul principal al firmei e 7320 — de întrebat contabilul.

## 6l. Excel și „Descarcă proiect" (30 septembrie)

- Exporturile ies în **Excel (.xlsx)**, nu CSV: debitarea comenzii
  (`/orders/:id/export.xlsx`), a corpului (`/corps/:id/export.xlsx`) și
  facturarea (`/admin/facturare/export.xlsx`). Fișierul îl scrie
  `src/xlsx.js`, fără bibliotecă; numerele rămân numere. Rutele `.csv` merg
  în continuare, pentru legături vechi, dar nu mai au butoane.
- **Descarcă proiect** (în Comenzile mele, pe pagina comenzii și în bara
  planșelor): `/orders/:id/proiect.zip`, cu numele comenzii. Înăuntru, un
  dosar cu toate planșele (ansamblu, corpuri, debitare, încadrare, montaj,
  CNC cu fișele pe piesă), ca pagini HTML de sine stătătoare (CSS pus în
  pagină, fără scripturi, fără bara de navigare), plus debitarea în Excel.
  Arhiva o face `src/arhiva.js`. Planșele se fac cu `datePrint()`, aceleași
  date ca pagina de print.
- Tot azi: în 3D, piesele cu contur (`polyFata`) se pun doar pe z — conturul
  e deja în coordonatele corpului (lateralele și tavanul de sub scară
  zburau din corp). Spatele decupat după contur nu mai primește cant.

## 6m. Email și prestatori (30 septembrie)

- **Administrare → Email** (`/admin/email`): serverul SMTP (server, port,
  STARTTLS/SSL, utilizator, parolă, expeditor) și titlul/textul propus
  atelierelor, cu câmpuri {comanda} {atelier} {telefon} {email} {prestator}
  {livrare}. Parola stă criptată în `setari` (ca cheile Stripe). La salvare
  se încearcă legătura; buton de email de probă. Cod: `src/email.js`
  (nodemailer).
- **Administrare → Prestatori** (`/admin/prestatori`): lista firmelor la care
  se trimit comenzi (nume, oraș, email — mai multe cu virgulă —, telefon,
  servicii, ce cer, apare/ascuns). Tabelul `prestatori` (migrarea 014).
  Adresa publică HTC Cubbis: office@cubbis.ro (nepusă; o pune Dan).
- **Pe comandă, „Trimite la prestator"**: alegi prestatorul, titlul, textul;
  pleacă arhiva proiectului (`proiectZip`, aceeași ca „Descarcă proiect"),
  Reply-To = atelierul, copie la atelier (bifă). Fiecare încercare în
  `trimiteri`, cu istoric pe comandă. Maximum 20 pe zi pe cont. Atelierul
  nu poate trimite la altă adresă decât a unui prestator din listă.
- Probe: `EMAIL_PROBA=1` în mediu → emailurile nu pleacă, se scriu în
  DATA_DIR/emailuri-proba/*.json.
- Rămâne: furnizorul de email (Dan alege; merge orice SMTP). Pe server
  portul 587 trebuie să fie deschis spre ieșire.

## 6n. Piesa simplă cu mai multe piese (30 septembrie)

- „Piesă simplă" are acum, sub piesa de sus, tabelul „Alte piese în același
  produs" (`params.pieseExtra`: nume, L, l, buc, cant pe 4 muchii, fibră;
  max. 99). Tot produsul se plătește o dată (5 lei), oricâte rânduri are —
  cererea lui Dan: nu 5 lei pe fiecare piesă.
- În calcul rândurile devin piese `piesaSimplaNr` („Piesă {n}", sau numele
  scris); în 3D stau una lângă alta. Schema nu are `.catch` pe listă: o cotă
  greșită e refuzată, nu golește lista. Piesele vechi, fără listă, merg.

## 6o. Design nou (varianta B2) și pagina „Prestatori" (30 septembrie)

- **Aspectul**: Dan a ales varianta B („lemn cald") din machetele de pe
  claude.ai (artifact „PAL Calc – design nou"). În `public/styles.css`
  s-au schimbat doar variabilele de culoare (crem #f4efe6, nuc #2b2520,
  teracotă #b4532a; tema întunecată caldă), literele (Fraunces la titluri,
  Manrope la text, IBM Plex Mono rămâne la cifre) și colțurile. La tipărire
  foaia e albă (`print.css`).
- **Pagina de prezentare**: sus, „filmul" (B2). `src/film.js` calculează 4
  corpuri reale din catalog (baza-2usi, baza-3sertare, dulap-2usi,
  sus-vitrina) cu motorul aplicației; `public/film.js` le desenează
  izometric (fețele spre privitor, ordinea „din spate în față"), le desface
  după `ex` și aprinde pe rând lista de debitare, planșa CNC a lateralei și
  pașii de montaj. Respectă `prefers-reduced-motion`. Prețul arătat e cel din
  aplicație (lei); Dan voia „1 €" — trecerea la euro e o decizie separată
  (plată, credit, facturare).
- **Prestatori publici**: `/prestatori` (listă cu filtre: regiune, CNC,
  Excel, partener Egger, „și cei de verificat") și `/prestatori/:id` (pagina
  firmei + trimiterea comenzii, care face 307 spre `/orders/:id/trimite`).
  Migrarea 015 adaugă câmpurile publice și cele 30 de firme din căutarea din
  30 septembrie (site-uri, registru, lista de distribuitori Egger —
  api.www.egger.com/cpsdis/search). 15 „recomandat", 15 „de verificat".
  Arabesque, debitare-pal.ro și Artepal sunt pe pagină, dar nu primesc
  comenzi (n-au o adresă de comenzi). Totul se schimbă din Administrare →
  Prestatori. Cercetarea brută: scratchpad-ul sesiunii,
  `prestatori-research/*.json`.

## 6p. Planificatorul 3D, etapa 1 (30 septembrie)

- Pagina Ansamblu a comenzii are sus planificatorul 3D (`public/ansamblu.js`,
  rescris). Tragi de un corp: se pune pe peretele cel mai apropiat (A/B/C/D),
  cu fața spre cameră, și se lipește de colțuri și de vecinii de la aceeași
  înălțime (prag 90 mm, altfel din 5 în 5 mm). Se calculează la înălțimea de
  unde a fost apucat (corpurile suspendate nu sar) și păstrează locul apucat.
  Roșu = intră în alt corp sau iese din cameră. Panou: perete, distanța de la
  colț, înălțimea, ◀ ▶, săgeți pe tastatură (Shift = 100 mm).
- Salvare: `POST /api/corps/:id/pozitie` (JSON, x-csrf-token), apoi pagina
  își reia planul, problemele, elevațiile și tabelul (`#anProbleme`,
  `#anSus`, `#anElevatii`, `#anPozitii`) fără să piardă unghiul camerei.
- Culorile decorurilor vin din materialele corpului/comenzii (API-ul trimite
  `culori`); zidul dintre privitor și cameră se ascunde.
- Test fără WebGL: scratchpad `xl/test3d.js` (jsdom + three 0.128 cu un
  renderer fals) — trage un corp și verifică salvarea.
- Pagina publică **/planificator** (în meniu, legată și din pagina de
  prezentare): textul de prezentare și o bucătărie de exemplu
  (`src/demo3d.js`, 9 corpuri din catalog, fără suprapuneri — testat) în
  același planificator, în mod `demo`: se mută, dar nu se salvează nimic și
  nu pleacă nicio cerere la server.
- Etapele următoare propuse: corpuri noi din catalog direct în cameră,
  ferestre/uși pe pereți, blat automat; apoi vedere „din cameră” și poze.

## 7. Ce a rămas nefăcut, din tot proiectul

- **Picioarele pe corp: 4, și 6 peste 1000 mm lățime — NU e măsurat.** E
  valoare de pornire (`PICIOARE` în `shared/feronerie.js`), pusă când s-a
  făcut plinta de aluminiu. De întrebat pe Dan câte pune el.
- **Corpul sub scară n-are poliță.** Una sub pantă nu poate fi întreagă:
  ori se scurtează, ori se taie în unghi. Nici despărțitor n-are. De
  întrebat pe Dan cum le face el.
- **Nu se poate oglindi un corp.** La sub-scară se ocolește dând înălțimile
  invers, dar la corpurile de colț și la cele cu uși pe compartimente alese
  n-are cum.

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
tests/              33 de fișiere, 623 de teste
.lucru/             scripturi de-o dată: traduceri, petice, probe
db/migrations/      schema, se aplică singură la pornire
```

Cifrele de atelier (cantul, pragurile, limitele traverselor) stau în
`shared/calc.js`, fiecare cu un comentariu care spune **de unde vine**. Nu le
schimba fără o măsurătoare.
