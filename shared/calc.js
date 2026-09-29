/* ============================================================
   Motorul de calcul pentru corpuri de mobila din PAL.
   Portat identic (ca logica) din calculator-debitare.html.

   Acelasi fisier ruleaza in doua locuri:
     - pe server  -> require('../shared/calc')            (CommonJS)
     - in browser -> <script src="/shared/calc.js">       (window.PalCalc)

   paramsSchema (zod) exista doar pe server; in browser ramane null,
   pentru ca zod nu se incarca in pagina.
   ============================================================ */
(function (root, factory) {
  var api = factory(
    typeof module === 'object' && module.exports ? require('./i18n') : root.PalI18n
  );
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PalCalc = api;
})(typeof self !== 'undefined' ? self : this, function (PalI18n) {
  'use strict';

  /* Traversa se face intre 40 si 100 mm, iar 60 e cat se pune de obicei.
     Sub 40 nu mai tine coltul in echer si se indoaie cand strangi blatul;
     peste 100 incepi sa tai PAL degeaba, ca doar blatul sta pe ea. */
  var TRAVERSA_MIN = 40, TRAVERSA_MAX = 100, TRAVERSA_STANDARD = 60;

  var NUT_OFF = 10;      /* distanta nutului fata de spatele corpului */
  var NUT_AD = 8;        /* adancimea nutului */
  var PFL_SERTAR = 3;    /* grosimea fundului de sertar */

  var r1 = function (v) { return Math.round(v * 10) / 10; };

  /* Cât se scade din cotă pentru o bandă de cant, la debitare.

     NU e grosimea benzii. Măsurat pe 96 de piese din patru lucrări reale
     (fișier Holzma .saw față de program WoodWOP .mpr, aceeași piesă), plus
     banda de 1 mm, confirmată de atelier:

         bandă 2 mm    ->  scade 1.5 mm     măsurat
         bandă 1 mm    ->  scade 0.5 mm     spus de atelier
         bandă 0.8 mm  ->  scade 0          măsurat
         bandă 0.4 mm  ->  scade 0          măsurat (nu se mai fabrică)

     Banda subțire intră în toleranța ferăstrăului și nimeni n-o scade; de la
     1 mm în sus se scade grosimea minus o jumătate de milimetru, cât se duce
     pe frezarea muchiei și pe linia de clei. De asta „cotă de tăiere = cotă
     finită − grosimea cantului" dă piese mai mici decât trebuie.

     Pragul e 0.8 și nu 1 fiindcă banda de 0.8 nu scade nimic, iar cea de 1 mm
     scade: limita trece exact între ele. Măsurătoarea de 0.4 rămâne scrisă
     aici fiindcă ea a așezat pragul, deși banda aia nu se mai fabrică;
     atelierul lucrează acum cu 0.8, 1 și 2. De 3 mm nu se folosește, deci
     acolo formula n-a fost verificată niciodată pe ceva real.

     PRAG    banda până în el, inclusiv, nu schimbă cota de tăiere
     REZERVA cât absoarbe frezarea și cleiul, peste prag */
  var PRAG_CANT = 0.8;
  var REZERVA_CANT = 0.5;

  function reducereCant(grosime, prag, rezerva) {
    var g = +grosime || 0;
    var p = (prag == null) ? PRAG_CANT : +prag;
    var rz = (rezerva == null) ? REZERVA_CANT : +rezerva;
    if (g <= p) return 0;
    return Math.max(0, g - rz);
  }
  var fmt = function (v) { return Number.isInteger(v) ? String(v) : v.toFixed(1); };

  function defaults(tr) {
    return {
      nume: traducator(tr)('modele.corpImplicit'), W: 800, H: 720, D: 560, constr: 'intre',
      /* Înălțimea soclului. 0 înseamnă corp pe picioare, cum a fost
         dintotdeauna: picioarele sunt feronerie, nu se taie din PAL, deci
         nu apar în listă. Peste 0, lateralele merg până la podea, fundul
         se ridică, iar în față intră o bucată de PAL. */
      soclu: 0,
      /* Corpul stă pe picioare de plastic, cu plintă cumpărată prinsă în
         față — felul corpurilor de bucătărie puse în șir. Nu se taie
         nimic din PAL: picioarele și plinta intră la feronerie (vezi
         shared/raport.js). Cu soclu pus, soclul câștigă. */
      picioare: 0,
      /* Lățimea traverselor de sus. 0 înseamnă blat întreg, adică felul de
         până acum. Peste 0, în locul blatului se pun două traverse — una
         în față, una în spate — fiindcă sub blatul de bucătărie un panou
         pe toată adâncimea e PAL aruncat: îl acoperă blatul oricum. */
      traverse: 0,
      /* Fronturile nu se fac deloc: se comandă doar corpul. Ușile și
         fronturile de sertar vine omul cu ale lui — MDF vopsit, folie,
         sticlă — sau le are deja de la lucrarea de dinainte. 0 înseamnă
         corp cu fronturi, ca până acum. */
      faraFront: 0,
      /* Ușile de vitrină: ramă de aluminiu cu sticlă, cumpărată gata la
         cotă. Nu se taie din PAL, deci ies din lista de debitare și intră
         la „de comandat" — cu balamalele lor, care nu sunt cele de PAL. */
      usiSticla: 0,
      tip: 'drept', W2: 900, orb: 550, contur: [],
      /* piesă simplă: bucăți, cantul pe fiecare muchie, fibra */
      pBuc: 1, pcL1: 'g', pcL2: '-', pcl1: '-', pcl2: '-', pFibra: 'L',
      t: 18, cg: 2, cs: 0.8, spate: 'aplicat', tp: 2.5,
      nUsi: 2, montaj: 'aplicat', balama: '0', rm: 1.5, ri: 3, rinc: 2, hUsi: '', compUsi: '',
      /* Ușile glisante se suprapun una peste alta, ca să nu rămână o fantă
         între ele când sunt închise. 30 mm e cât se pune de obicei. */
      supr: 30,
      /* Cât mănâncă șinele din înălțime, sus și jos la un loc. Depinde de
         sistemul cumpărat — 40 e o valoare de pornire, nu o măsurătoare. */
      hSine: 40,
      /* Nișa: golul dintre zonele cu uși, pentru cuptor sau frigider.
         Cu `hUsi` pus: ușă jos, gol, ușă sus — coloana de cuptor.
         Cu `hUsi` gol: gol de la fund, ușă deasupra — coloana de frigider,
         unde aparatul stă direct pe fundul corpului.
         Fără uși, cu sertare: golul e tot ce rămâne lângă sertare, iar
         `hNisa` e cât cere aparatul — corpul bază de cuptor. */
      hNisa: '',
      nPol: 1, jp: 1, rp: 20, nDsp: 0,
      nSer: 0, hFront: 150, hCutie: 100, jg: 12.5, ts: 18, lg: '',
      /* Mânerul. Se poate scoate cu totul: la push-to-open, la profil gola
         sau la fronturile cu prindere frezată nu se cumpără niciunul și nu
         se găurește nimic. Direcția și locul pe front au fiecare o valoare
         „ca de obicei": vertical pe muchia dinspre mijloc la uși, orizontal
         la mijlocul frontului de sertar — adică felul de până acum. */
      maner: 1, manerDir: 'obisnuit', manerPoz: 'obisnuit',
      /* Lungimea mânerului, în milimetri. 128 e mărimea cea mai obișnuită;
         se cumpără de la 96 până pe la 320, iar la sertarele late se pun
         și de 500. Mai lung decât frontul nu poate fi, deci se scurtează
         singur când nu încape. */
      manerL: 128,
      /* Unde stau sertarele: sus, ca pana acum, sau jos, cu ușile deasupra.
         Jos e felul de-a face corpul de cuptor cu sertar dedesubt, și
         singurul fel în care golul lăsat la fund se umple cu ceva. */
      sertareJos: 0,
      pragCant: PRAG_CANT, rezervaCant: REZERVA_CANT
    };
  }

  /* Care compartimente primesc usi. Omul numara de la 1; gol sau nimic
     valid inseamna toate, adica felul de pana acum. */
  function compartimenteAlese(spec, total) {
    var toate = [];
    for (var i = 0; i < total; i++) toate.push(i);

    var s = String(spec == null ? '' : spec).trim();
    if (!s) return toate;

    var alese = s.split(/[^0-9]+/)
      .filter(function (x) { return x !== ''; })
      .map(function (x) { return parseInt(x, 10) - 1; })
      .filter(function (i) { return i >= 0 && i < total; });

    alese = alese.filter(function (v, i, a) { return a.indexOf(v) === i; })
                 .sort(function (a, b) { return a - b; });
    return alese.length ? alese : toate;
  }

  /* tipurile de corp pe care le stie calculul */
  var TIPURI = ['drept', 'colt-orb', 'colt-L', 'colt-diagonal', 'atipic', 'piesa'];
  function esteColt(tip) { return tip === 'colt-L' || tip === 'colt-diagonal'; }

  /* ---------- conturul unui corp atipic ----------
     Se merge din latura in latura: lungimea laturii, apoi unghiul interior
     din varful unde se intalneste cu urmatoarea. Conturul e bun cand se inchide. */

  /* Fără un traducător dat, textele ies în româna implicită. */
  function traducator(t) {
    if (typeof t === 'function') return t;
    return PalI18n.creeaza(PalI18n.IMPLICITA);
  }

  /* Direcția unei laturi: întoarce cheia și, la laturile înclinate, unghiul.
     Textul se scrie abia la afișare, în limba paginii. */
  function directie(dir) {
    var d = ((dir % 360) + 360) % 360;
    if (Math.abs(d - 0) < 0.5) return { cheie: 'jos' };
    if (Math.abs(d - 90) < 0.5) return { cheie: 'dreapta' };
    if (Math.abs(d - 180) < 0.5) return { cheie: 'sus' };
    if (Math.abs(d - 270) < 0.5) return { cheie: 'stanga' };
    return { cheie: 'inclinata', grade: r1(d) };
  }

  function numeDirectie(dir, t) {
    var d = directie(dir);
    return traducator(t)('directie.' + d.cheie, d.grade != null ? { grade: d.grade } : null);
  }

  function conturGeometrie(contur) {
    var laturi = [], pts = [], x = 0, y = 0, dir = 0;
    contur = (contur || []).filter(function (s) { return +s.lung > 0; });

    for (var i = 0; i < contur.length; i++) {
      var lung = +contur[i].lung;
      var unghi = +contur[i].unghi;
      var rad = dir * Math.PI / 180;
      var x2 = x + lung * Math.cos(rad);
      var y2 = y + lung * Math.sin(rad);

      pts.push([x, y]);
      laturi.push({
        idx: i, lung: r1(lung), dir: dir, directie: directie(dir),
        de_la: [x, y], la: [x2, y2],
        unghiEnd: unghi,
        unghiStart: +contur[(i - 1 + contur.length) % contur.length].unghi
      });

      x = x2; y = y2;
      dir = ((dir + 180 - unghi) % 360 + 360) % 360;
    }

    var eroare = Math.hypot(x, y);
    var sumaUnghiuri = contur.reduce(function (s, l) { return s + (+l.unghi); }, 0);

    /* aducem conturul in coordonate pozitive, cu originea in coltul stanga-jos */
    var minX = 0, minY = 0;
    pts.forEach(function (p) { minX = Math.min(minX, p[0]); minY = Math.min(minY, p[1]); });
    var puncte = pts.map(function (p) { return [r1(p[0] - minX), r1(p[1] - minY)]; });
    laturi.forEach(function (l) {
      l.de_la = [r1(l.de_la[0] - minX), r1(l.de_la[1] - minY)];
      l.la = [r1(l.la[0] - minX), r1(l.la[1] - minY)];
    });

    var maxX = 0, maxY = 0;
    puncte.forEach(function (p) { maxX = Math.max(maxX, p[0]); maxY = Math.max(maxY, p[1]); });

    return {
      puncte: puncte, laturi: laturi,
      inchis: eroare < 1 && contur.length >= 3,
      eroare: r1(eroare),
      sumaUnghiuri: r1(sumaUnghiuri),
      sumaCeruta: contur.length >= 3 ? (contur.length - 2) * 180 : 0,
      W: r1(maxX), H: r1(maxY),
      nrLaturi: contur.length
    };
  }

  /* Corpul de sub scară, din trei cote.

     Până acum omul trebuia să dea patru laturi și patru unghiuri — adică să
     socotească singur panta și cele două unghiuri, cu Pitagora și cu
     arctangenta. Un producător de mobilă are altceva sub ochi: lățimea de
     jos și cele două înălțimi. Din ele iese restul.

         z ┌────╲                    x  = baza
           │     ╲___                y  = înălțimea din dreapta
           │         ╲ y             z  = înălțimea din stânga
           └──────────┘              panta = √(x² + (z−y)²)
                 x

     Unghiul pantei față de orizontală: α = arctg((z−y) / x). Colțul de sus
     din dreapta se deschide cu atât (90 + α), cel din stânga se strânge cu
     atât (90 − α), iar suma rămâne 360 oricât de pieziș ar fi.

     Merge și invers, cu scara coborând spre stânga: atunci `z` e mai mic
     decât `y`, α iese negativ, și unghiurile se schimbă între ele singure.
     Cu `y` egal cu `z` iese un dreptunghi curat, cu 90 peste tot.

     Unghiurile se dau cu trei zecimale înadins. Cu ele rotunjite la grad —
     cum era modelul scris de mână — conturul nu se închidea, rămânea 0.2 mm
     în colț. Nu se vedea pe desen, dar muchia din stânga ieșea cu 0.2 mm în
     afara dreptunghiului de gabarit, iar lista CNC o socotea muchie de
     decupat: cerea o frezare pe o latură care e dreaptă. */
  function conturSubScara(baza, hDreapta, hStanga) {
    var x = Math.max(1, +baza || 0);
    var y = Math.max(1, +hDreapta || 0);
    var z = Math.max(1, +hStanga || 0);
    var dz = z - y;
    var panta = Math.hypot(x, dz);
    var alfa = Math.atan2(dz, x) * 180 / Math.PI;
    var r3 = function (v) { return Math.round(v * 1000) / 1000; };
    return [
      { lung: r1(x),     unghi: 90 },
      { lung: r1(y),     unghi: r3(90 + alfa) },
      { lung: r1(panta), unghi: r3(90 - alfa) },
      { lung: r1(z),     unghi: 90 }
    ];
  }

  /* Cotele unui contur de sub scară, citite înapoi din laturi. Întoarce null
     dacă nu e așa ceva: patru laturi, prima jos, ultima în stânga. */
  function coteSubScara(contur) {
    var l = contur || [];
    if (l.length !== 4) return null;
    var g = conturGeometrie(l);
    if (!g.puncte || g.puncte.length !== 4) return null;
    var p = g.puncte;
    /* jos orizontală, dreapta verticală, stânga verticală */
    if (Math.abs(p[0][1] - p[1][1]) > 0.5) return null;
    if (Math.abs(p[1][0] - p[2][0]) > 0.5) return null;
    if (Math.abs(p[3][0] - p[0][0]) > 0.5) return null;
    return { baza: r1(p[1][0] - p[0][0]), dreapta: r1(p[2][1]), stanga: r1(p[3][1]) };
  }

  function conturImplicit(W, H) {
    return [
      { lung: W, unghi: 90 }, { lung: H, unghi: 90 },
      { lung: W, unghi: 90 }, { lung: H, unghi: 90 }
    ];
  }

  function balamale(h) { return h <= 900 ? 2 : h <= 1600 ? 3 : h <= 2000 ? 4 : 5; }

  /* ---- mânerul ----

     Unde stă pe un front, ca fracții din laturile lui: `fx` de la muchia
     din stânga, `fy` de la muchia de JOS. Fracții, și de jos, fiindcă
     regula asta o citesc două desene care numără invers pe verticală —
     vederea 3D are y în sus, schița SVG îl are în jos. Cine se uită la ea
     nu trebuie să țină minte în care dintre ele e.

     `dirImplicita` e felul în care se pune de obicei pe FELUL ăsta de
     front: vertical la uși, orizontal la fronturile de sertar.
     `spreDreapta` spune dacă muchia dinspre mijlocul corpului e cea din
     dreapta — acolo se prinde mâna.

     Cele două alegeri nu se pot bate cap în cap: fiecare lucrează pe axa
     ei. Un mâner vertical pus „sus" rămâne vertical și urcă. */
  var MANER_MARGINE = 0.12;   /* cât de aproape de muchie, din latura frontului */
  var MANER_GROS = 20;        /* cât de gros se desenează bara, în 3D */
  var MANER_IESIRE = 32;      /* cât iese din front */

  function asezareManer(c, lat, inalt, dirImplicita, spreDreapta) {
    if (+c.faraFront || !+c.maner) return null;
    var dir = (c.manerDir && c.manerDir !== 'obisnuit') ? c.manerDir : dirImplicita;
    var poz = c.manerPoz || 'obisnuit';
    var mg = MANER_MARGINE;
    var cerut = Math.max(0, +c.manerL || 0);
    var vertical = dir === 'vertical';
    /* Pe latura pe care stă. Mai lung decât frontul n-are cum să fie. */
    var latura = vertical ? inalt : lat;
    var lung = Math.min(cerut || latura * 0.32, latura * 0.9);
    if (!(lung > 0)) return null;

    var fx, fy;
    if (vertical) {
      /* „Cum se pune de obicei" tine de FELUL frontului, nu de directia
         ceruta. Un front de sertar are manerul la mijloc, si acolo ramane
         chiar daca omul l-a intors pe verticala: o bara verticala lipita de
         muchia unui sertar lat de 800 n-a pus-o nimeni niciodata. Muchia
         dinspre mijlocul corpului e treaba usilor. */
      fx = poz === 'stanga'  ? mg
         : poz === 'dreapta' ? 1 - mg
         : poz === 'centru'  ? 0.5
         : dirImplicita === 'orizontal' ? 0.5
         : (spreDreapta ? 1 - mg : mg);
      fy = poz === 'sus' ? 0.75 : poz === 'jos' ? 0.25 : 0.5;
    } else {
      fx = poz === 'stanga' ? 0.25 : poz === 'dreapta' ? 0.75 : 0.5;
      fy = poz === 'sus' ? 1 - mg : poz === 'jos' ? mg : 0.5;
    }
    /* Manerul nu are voie sa iasa din front.

       Lungimea e taiata dupa latura pe care sta, dar asta nu ajunge: pus
       „sus" pe un front de sertar de 150, un maner de 128 ii iese in sus cu
       25 de milimetri — atarna in aer deasupra piesei. Se trage inapoi
       inauntru, pe axa pe care se intinde. */
    var intre = function (v, minim, maxim) {
      return v < minim ? minim : v > maxim ? maxim : v;
    };
    var jumatate = (lung / 2) / (vertical ? inalt : lat);
    if (vertical) fy = intre(fy, jumatate, 1 - jumatate);
    else fx = intre(fx, jumatate, 1 - jumatate);

    return { vertical: vertical, fx: fx, fy: fy, lung: r1(lung) };
  }

  /* Rolul unei piese se ia din cheia ei, nu din text: așa rămâne același
     în toate limbile. */
  var ROL = {
    usa: 'front', usaDiagonala: 'front', usaBrat1: 'front', usaBrat2: 'front',
    frontSertar: 'front', frontAtipic: 'front',
    spateAtipic: 'spate', spatePerete1: 'spate', spatePerete2: 'spate',
    spateAplicat: 'spate', spateNut: 'spate',
    sertarLaterala: 'sertar', sertarFataSpate: 'sertar',
    sertarFund: 'pfl'
  };

  function rolPiesa(cheie) { return ROL[cheie] || 'corp'; }

  function calc(c, tr) {
    var t_ = traducator(tr);
    var W = +c.W, H = +c.H, D = +c.D, t = +c.t, cg = +c.cg, cs = +c.cs, tp = +c.tp;
    var rm = +c.rm, ri = +c.ri, rinc = +c.rinc, nUsi = +c.nUsi, nPol = +c.nPol, nSer = +c.nSer;
    var hUsiCerut = +c.hUsi || 0;
    var nDsp = +c.nDsp || 0;                /* montanți (despărțitori) în interior */
    var P = [], warn = [], avertismente = [];
    var aplicat = c.spate === 'aplicat';
    var zb = aplicat ? tp : 0;              /* unde incep piesele corpului pe adancime */
    var Dp = D - zb;                        /* adancimea pieselor corpului */
    var zin = aplicat ? tp : NUT_OFF + tp;  /* fata interioara a spatelui */
    var Dint = D - zin;                     /* adancime interioara utila */
    /* Soclul mănâncă din înălțimea folositoare, fiindcă H rămâne cota de la
       podea. Se poate acolo unde lateralele merg pe toată înălțimea, deci
       ajung singure la podea și au pe ce sta: corpul drept construit
       „între", colțul orb (tot un corp drept, cu o parte acoperită) și
       colțurile în L sau pe diagonală, a căror ramură pune lateralele așa
       oricum. La construcția „peste" lateralele stau PE fund, iar un soclu
       dedesubt n-ar avea de ce se prinde; la cele atipice forma vine din
       contur și n-are laterale drepte. */
    var socluCerut = Math.max(0, +c.soclu || 0);
    var soclu = (socluCerut && (esteColt(c.tip) ||
                 ((c.tip === 'drept' || c.tip === 'colt-orb') && c.constr === 'intre')))
      ? socluCerut : 0;

    /* Traversele se pot pune în aceleași condiții ca soclul: la corpul drept
       construit „între". Acolo lateralele merg pe toată înălțimea, deci
       traversele se prind între ele exact cum s-ar fi prins blatul. */
    var traverseCerut = Math.max(0, +c.traverse || 0);
    var traverse = (traverseCerut && c.tip === 'drept' && c.constr === 'intre') ? traverseCerut : 0;
    /* Adusa in limite. Se SPUNE, nu se face pe tacute: omul a scris un
       numar si are dreptul sa afle ca s-a taiat altul. */
    var traverseInAfara = 0;
    if (traverse > 0 && (traverse < TRAVERSA_MIN || traverse > TRAVERSA_MAX)) {
      traverseInAfara = traverse;
      traverse = Math.min(TRAVERSA_MAX, Math.max(TRAVERSA_MIN, traverse));
    }

    var Wint = W - 2 * t, Hint = H - 2 * t - soclu;
    /* Podeaua interiorului: fața de sus a fundului. Fără soclu e exact `t`,
       ca până acum. Tot ce se așază înăuntru — polițe, montanți, uși — se
       măsoară de aici, nu de la 0. */
    var y0 = soclu + t;
    /* Corpul propriu-zis, fără zona soclului. */
    var Hutil = H - soclu;
    var ev = function (v) { return v === 'g' ? cg : v === 's' ? cs : 0; };
    var red = function (v) { return reducereCant(ev(v), c.pragCant, c.rezervaCant); };

    /* O piesă ține cheia ei (stabilă, pentru potriviri și pentru raport) și
       numele scris în limba cerută. `nota` și `fibra` sunt tot chei. */
    var add = function (cheie, args, buc, L, l, cL1, cL2, cl1, cl2, fibra, nota, boxes) {
      P.push({
        cheie: cheie, args: args || null, rol: rolPiesa(cheie),
        nume: t_('piesa.' + cheie, args || null),
        buc: buc, L: r1(L), l: r1(l), c: [cL1, cL2, cl1, cl2],
        /* cL1/cL2 sunt muchiile paralele cu L, deci banda de pe ele îngroașă
           piesa pe l — și invers. Vezi comentariul de la reducereCant(). */
        TL: r1(L - red(cl1) - red(cl2)), Tl: r1(l - red(cL1) - red(cL2)),
        fibra: fibra, fibraText: t_('fibra.' + fibra),
        notaCheie: nota ? nota[0] : '', notaArgs: nota ? (nota[1] || null) : null,
        nota: nota ? t_('nota.' + nota[0], nota[1] || null) : '',
        boxes: boxes || []
      });
    };

    /* Avertismentele merg tot pe chei: textul se compune la afișare. */
    /* Mânerele nu sunt piese de tăiat, deci nu intră în `P`: stau deoparte,
       ca vederea 3D să le poată arăta și stinge singure. */
    var manere = [];
    var puneManer = function (x, y, lat, inalt, zFront, dirImplicita) {
      /* Muchia dinspre mijlocul corpului: acolo se prinde mâna. */
      var a = asezareManer(c, lat, inalt, dirImplicita, (x + lat / 2) < W / 2);
      if (!a) return;
      var cx = x + a.fx * lat, cy = y + a.fy * inalt;
      var sx = a.vertical ? MANER_GROS : a.lung;
      var sy = a.vertical ? a.lung : MANER_GROS;
      manere.push(bx(cx - sx / 2, cy - sy / 2, zFront + t, sx, sy, MANER_IESIRE,
                     F({ px: 'p', nx: 'p', py: 'p', ny: 'p', pz: 'p', nz: 'p' }),
                     [0, 0, 1.6], 'manere'));
    };

    var avert = function (cheie, args) {
      var text = t_('avert.' + cheie, args || null);
      avertismente.push({ cheie: cheie, args: args || null, text: text });
      warn.push(text);
    };

    /* Soclul cerut, dar nepus. Se spune, nu se trece cu vederea: altfel omul
       scrie 80 în casetă, nu vede nicio bucată în listă și nu știe de ce. */
    if (socluCerut && !soclu) avert('socluNuMerge');
    if (traverseCerut && !traverse) avert('traverseNuMerg');
    if (traverseInAfara) {
      avert('traverseInAfara', { lat: fmt(traverseInAfara), min: TRAVERSA_MIN,
                                 max: TRAVERSA_MAX, pus: fmt(traverse) });
    }
    if (traverse && traverse * 2 >= Dp) {
      /* Două traverse care se ating nu mai sunt traverse, sunt un blat
         prost tăiat. */
      avert('traversePreaLate', { lat: fmt(traverse), incape: fmt(Math.floor(Dp / 2) - 1) });
      traverse = 0;
    }
    if (soclu && Hint < 100) {
      avert('socluPreaInalt', { soclu: fmt(soclu), ramane: fmt(Math.max(0, Hint)) });
    }

    /* ---- comandă fără fronturi: se livrează doar corpul ----

       Carcasa NU se schimbă cu nimic. Ușa aplicată stă oricum în afara
       ei, iar cea încastrată stă în golul care rămâne; sertarele se așază
       mai departe după înălțimile fronturilor, fiindcă fronturile care vin
       pe urmă trebuie să cadă exact pe cutiile astea. De-aia fronturile se
       scot la SFÂRȘIT, nu se sar pe drum: tot calculul rămâne cel al
       corpului întreg, doar lista de tăiat e mai scurtă.

       Se golește și lista de uși, ca să nu se numere balamale și mânere
       pentru niște canaturi care nu se fac. Se SPUNE câte piese au rămas
       afară: cine se uită la o listă de debitare fără uși trebuie să afle
       de ce, altfel pleacă din atelier un corp fără fronturi din greșeală.

       Se cheamă chiar înainte de fiecare `return`, la orice fel de corp. */
    var faraFront = !!(+c.faraFront);
    /* Ce nu se taie, dar se comandă: ușile cu ramă de aluminiu. Cota e cea
       FINITĂ a ușii — rama se face la ea, cu sticla în ea. Cutiile rămân
       și pentru vederea 3D, unde ușa se vede de sticlă. */
    var usiSticla = !!(+c.usiSticla) && !faraFront;
    var deComandat = [], sticla3d = [];
    var CHEI_USA = ['usa', 'usaDiagonala', 'usaBrat1', 'usaBrat2'];
    var scoateFronturile = function (usiLista) {
      if (usiSticla) {
        for (var iS = P.length - 1; iS >= 0; iS--) {
          if (CHEI_USA.indexOf(P[iS].cheie) === -1) continue;
          deComandat.unshift({ fel: 'usaRamaAlu', cheie: P[iS].cheie,
                               H: P[iS].L, L: P[iS].l, buc: P[iS].buc });
          (P[iS].boxes || []).forEach(function (b) { sticla3d.push(b); });
          P.splice(iS, 1);
        }
        return usiLista;
      }
      if (!faraFront) return usiLista;
      var cate = 0, cote = [];
      for (var iF = P.length - 1; iF >= 0; iF--) {
        if (P[iF].rol !== 'front') continue;
        cate += P[iF].buc;
        /* Cota FINITĂ, nu cea de tăiere: fronturile le face altcineva, cu
           cantul lui, iar reducerea de cant e a atelierului ăsta. */
        cote.unshift(fmt(P[iF].L) + '×' + fmt(P[iF].l) +
                     ' (' + P[iF].buc + ' ' + t_('comun.buc') + ')');
        P.splice(iF, 1);
      }
      if (!cate) return usiLista;
      avert('faraFronturi', { cate: cate, cote: cote.join(', ') });
      return [];
    };
    var bx = function (x, y, z, sx, sy, sz, f, ex, grp) {
      return { x: x, y: y, z: z, sx: sx, sy: sy, sz: sz, f: f, ex: ex, grp: grp };
    };
    var F = function (o) {
      return Object.assign({ px: '-', nx: '-', py: '-', ny: '-', pz: '-', nz: '-' }, o);
    };
    /* panou cu contur poligonal in plan (blat/fund/polita de colt), extrudat pe verticala */
    var bp = function (x, y, z, poly, gros, ex, grp) {
      return { x: x, y: y, z: z, sx: 0, sy: gros, sz: 0, poly: poly,
               f: F({ py: 'f', ny: 'f' }), ex: ex, grp: grp };
    };

    /* ============ piesă simplă ============

       Un singur panou, cu cotele și cantul lui. Nu e corp: n-are laterale,
       n-are spate, n-are ce se îmbina. Trece totuși prin tot restul —
       comandă, croire pe coală, CSV, planșe — fiindcă atelierului îi trebuie
       la fel de des un blat, o mască sau o poliță răzleață ca un corp
       întreg. `W` e lungimea, `H` e lățimea; adâncimea n-are ce căuta aici. */
    if (c.tip === 'piesa') {
      var pBuc = Math.max(1, Math.round(+c.pBuc || 1));
      var cant = function (v) { return (v === 'g' || v === 's') ? v : '-'; };
      var muchii = [cant(c.pcL1), cant(c.pcL2), cant(c.pcl1), cant(c.pcl2)];

      if (W < 20 || H < 20) avert('piesaPreaMica');
      if (W < H) avert('piesaLatimeMaiMare', { lung: fmt(W), lat: fmt(H) });

      var fetePiesa = F({
        pz: 'f', nz: 'f',
        px: muchii[2], nx: muchii[3],   /* muchiile scurte, la capetele lungimii */
        py: muchii[0], ny: muchii[1]    /* muchiile lungi */
      });

      add('piesaSimpla', null, pBuc, W, H,
          muchii[0], muchii[1], muchii[2], muchii[3],
          c.pFibra === 'L' || c.pFibra === 'l' ? c.pFibra : '-', null,
          [bx(0, 0, 0, W, H, t, fetePiesa, [0, 0, 0], 'corp')]);

      return { P: P, warn: warn, avertismente: avertismente, usi: [],
               Wint: W, Hint: H, Dint: t, W: W, H: H, D: t };
    }

    /* ============ corp atipic: definit prin conturul văzut din față ============
       Fiecare latură a conturului devine un panou de adâncimea corpului, tăiat
       la unghi la ambele capete. Spatele și frontul se decupează după contur. */
    if (c.tip === 'atipic') {
      var g = conturGeometrie(c.contur && c.contur.length ? c.contur : conturImplicit(W, H));
      var Da = D;
      var FDa = F({ pz: 'f', nz: 'f', px: 'g', nx: 'g', py: 'g', ny: 'g' });
      var usiA = [];

      if (!g.inchis) {
        avert('conturDeschis', { eroare: fmt(g.eroare), suma: fmt(g.sumaUnghiuri),
                                 laturi: g.nrLaturi, ceruta: fmt(g.sumaCeruta) });
      }
      if (g.nrLaturi < 3) {
        avert('conturPreaPutineLaturi');
      }

      /* panourile de pe laturi */
      g.laturi.forEach(function (lat, i) {
        var taiere = ['taiereLaUnghi', { a: fmt(r1(lat.unghiStart / 2)), b: fmt(r1(lat.unghiEnd / 2)) }];
        var mx = (lat.de_la[0] + lat.la[0]) / 2;
        var my = (lat.de_la[1] + lat.la[1]) / 2;

        add('panouLatura', { n: i + 1, latura: numeDirectie(lat.dir, t_) },
            1, lat.lung, Da, 'g', '-', '-', '-',
            'L', taiere,
            [{ x: mx - lat.lung / 2, y: my - t / 2, z: 0,
               sx: lat.lung, sy: t, sz: Da, f: F({ py: 'f', ny: 'f', pz: 'g' }),
               ex: [0, 0, 0], grp: 'corp',
               rz: lat.dir * Math.PI / 180 }]);
      });

      /* spatele și frontul, decupate după contur */
      if (c.spate !== 'fara') {
        add('spateAtipic', { mat: tp >= 8 ? 'PAL' : 'PFL' }, 1, g.W, g.H, '-', '-', '-', '-', '-',
            ['dupaContur'],
            [{ x: 0, y: 0, z: -tp, sx: g.W, sy: g.H, sz: tp,
               polyFata: g.puncte, f: F({ pz: 'p', nz: 'p' }), ex: [0, 0, -1], grp: 'spate' }]);
      }

      if (nUsi > 0) {
        var rmA = rm;
        add('frontAtipic', null, 1, r1(g.W - 2 * rmA), r1(g.H - 2 * rmA), 'g', 'g', 'g', 'g', 'LV',
            ['dupaConturCuRost', { rost: fmt(rmA) }],
            [{ x: 0, y: 0, z: Da, sx: g.W, sy: g.H, sz: t,
               polyFata: g.puncte, f: FDa, ex: [0, 0, 1.6], grp: 'fronturi' }]);
        usiA.push({ L: r1(g.H - 2 * rmA), H: r1(g.H - 2 * rmA) });
      }

      if (nPol > 0) {
        avert('politeAtipic');
      }

      return {
        P: P, warn: warn, avertismente: avertismente, deComandat: deComandat, sticla3d: sticla3d, usi: scoateFronturile(usiA),
        Wint: r1(g.W - 2 * t), Hint: r1(g.H - 2 * t), Dint: r1(Da - tp),
        W: g.W, H: g.H, D: Da,
        contur: g
      };
    }

    /* ============ corpuri de colț (în L sau cu front diagonal) ============
       A = latura pe peretele 1 (W), B = latura pe peretele 2 (W2),
       D = adâncimea brațelor. Blatul, fundul și polițele nu sunt dreptunghiuri:
       se debitează dreptunghiul de gabarit și apoi se decupează colțul. */
    if (esteColt(c.tip)) {
      var dg = c.tip === 'colt-diagonal';
      var A = W, B = +c.W2;
      var bA = r1(A - t), bB = r1(B - t);        /* panoul orizontal, între laterale */
      var brA = r1(bA - D), brB = r1(bB - D);    /* decupajul din colțul opus */
      var diagL = r1(Math.sqrt(brA * brA + brB * brB));
      var aplK = c.montaj === 'aplicat';
      /* Cu soclu, fronturile pornesc de deasupra lui, ca la corpul drept. */
      var uHK = r1(aplK ? Hutil - 2 * rm : Hint - 2 * rinc);
      var yFK = aplK ? soclu + rm : y0 + rinc;
      var FDK = F({ pz: 'f', nz: 'f', px: 'g', nx: 'g', py: 'g', ny: 'g' });
      var jpK = +c.jp;
      var usiK = [];

      if (brA <= 0 || brB <= 0) {
        avert('adancimePreaMare', { d: fmt(D), a: fmt(A), b: fmt(B) });
      }
      if (nSer > 0) {
        avert('sertareColt');
      }

      /* laterale: câte una la capătul fiecărui braț */
      add('laterala', null, 2, H, D, 'g', '-', 's', 's', 'LV',
          ['unaPeBrat'], [
        bx(A - t, 0, 0, t, H, D, F({ px: 'f', nx: 'f', pz: 'g', py: 's', ny: 's' }), [1, 0, 0], 'corp'),
        bx(0, 0, B - t, D, H, t, F({ pz: 'f', nz: 'f', px: 'g', py: 's', ny: 's' }), [0, 0, 1], 'corp')
      ]);

      /* blat și fund: panou în L sau pentagon */
      var polyOr = dg
        ? [[0, 0], [bA, 0], [bA, D], [D, bB], [0, bB]]
        : [[0, 0], [bA, 0], [bA, D], [D, D], [D, bB], [0, bB]];
      var notaPanou = dg
        ? ['panouPentagon', { a: fmt(bA), b: fmt(bB), ca: fmt(brA), cb: fmt(brB), diag: fmt(diagL) }]
        : ['panouL', { a: fmt(bA), b: fmt(bB), ca: fmt(brA), cb: fmt(brB) }];

      add('blat', null, 1, bA, bB, '-', '-', '-', '-', 'L', notaPanou,
        [bp(0, H - t, 0, polyOr, t, [0, 1, 0], 'corp')]);
      add('fund', null, 1, bA, bB, '-', '-', '-', '-', 'L', notaPanou,
        [bp(0, soclu, 0, polyOr, t, [0, -1, 0], 'corp')]);

      /* Soclul, pe linia fronturilor, retras cât grosimea plăcii — ca la
         corpul drept, unde stă în spatele ușilor și sub fund.

         În L sunt două bucăți, una pe fiecare braț. La colțul dinăuntru
         brațul 1 trece peste capătul brațului 2: așa se prind cu un șurub
         prin față, iar fundul are pe ce sta și în colț.

         Pe diagonală e o singură bucată, cu capetele tăiate în unghi ca să
         stea lipite de laterale. Unghiurile se scriu pe piesă: cu brațe
         egale ies 45°, cu brațe diferite nu, și asta nu se ghicește la
         fierăstrău. */
      if (soclu > 0 && brA > 0 && brB > 0) {
        var FSo = F({ pz: 'f', nz: 'f', py: 's', ny: 's' });
        if (dg) {
          var nX = -brB / diagL, nZ = -brA / diagL;          /* spre colțul din spate */
          var u1 = Math.round(Math.atan2(brB, brA) * 180 / Math.PI);
          var u2 = Math.round(Math.atan2(brA, brB) * 180 / Math.PI);
          add('soclu', null, 1, diagL, soclu, 's', '-', '-', '-', 'L',
            ['socluDiagonal', { u1: u1, u2: u2 }],
            [{ x: (bA + D) / 2 + nX * t / 2 - diagL / 2, y: 0,
               z: (D + bB) / 2 + nZ * t / 2 - t / 2,
               sx: diagL, sy: soclu, sz: t, f: FSo, ex: [0, -1, 0], grp: 'corp',
               ry: Math.atan2(-(bB - D), D - bA), rotCenter: true }]);
        } else {
          add('soclu', null, 1, r1(brA + t), soclu, 's', '-', '-', '-', 'L',
            ['socluColtL', { n: 1 }],
            [bx(D - t, 0, D - t, brA + t, soclu, t, FSo, [0, -1, 0], 'corp')]);
          add('soclu', null, 1, brB, soclu, 's', '-', '-', '-', 'L',
            ['socluColtL', { n: 2 }],
            [bx(D - t, 0, D, t, soclu, brB, F({ px: 'f', nx: 'f', py: 's', ny: 's' }), [0, -1, 0], 'corp')]);
        }
      }

      /* spate: câte un panou pe fiecare perete */
      var matSp = { mat: tp >= 8 ? 'PAL' : 'PFL' };
      var FSK = F({ pz: 'p', nz: 'p', px: 'p', nx: 'p', py: 'p', ny: 'p' });
      /* Spatele nu coboară în zona soclului: sub fund nu e corp, e gol. */
      add('spatePerete1', matSp, 1, Hutil - 3, A - 3, '-', '-', '-', '-', '-', ['capsatSprePerete'],
        [bx(1.5, soclu + 1.5, -tp, A - 3, Hutil - 3, tp, FSK, [0, 0, -1], 'spate')]);
      add('spatePerete2', matSp, 1, Hutil - 3, B - tp - 3, '-', '-', '-', '-', '-', ['capsatCealalta'],
        [bx(-tp, soclu + 1.5, 1.5, tp, Hutil - 3, B - tp - 3, FSK, [-1, 0, 0], 'spate')]);

      /* fronturi (nUsi = 0 înseamnă colț deschis) */
      if (nUsi > 0 && dg) {
        var uLK = r1(diagL - 2 * rm);
        var mx = (bA + D) / 2, mz = (D + bB) / 2;     /* mijlocul diagonalei */
        add('usaDiagonala', null, 1, uHK, uLK, 'g', 'g', 'g', 'g', 'LV',
            ['balamaleDiagonala', { n: balamale(uHK), cot: c.balama }],
            [{ x: mx - uLK / 2, y: yFK, z: mz - t / 2,
               sx: uLK, sy: uHK, sz: t, f: FDK, ex: [1.1, 0, 1.1], grp: 'fronturi',
               ry: Math.atan2(-(bB - D), D - bA), rotCenter: true }]);
        usiK.push({ L: uLK, H: uHK });
        if (uLK > 600) avert('usaDiagonalaLata');
      } else if (nUsi > 0) {
        var uL1 = r1(brA - rm - ri / 2), uL2 = r1(brB - rm - ri / 2);
        var yF = yFK;
        add('usaBrat1', null, 1, uHK, uL1, 'g', 'g', 'g', 'g', 'LV',
            ['balamaleBrat1', { n: balamale(uHK), cot: c.balama }],
            [bx(D + rm, yF, D, uL1, uHK, t, FDK, [0, 0, 1.6], 'fronturi')]);
        add('usaBrat2', null, 1, uHK, uL2, 'g', 'g', 'g', 'g', 'LV',
            ['balamaleCot', { n: balamale(uHK), cot: c.balama }],
            [bx(D, yF, D + rm, t, uHK, uL2, FDK, [1.6, 0, 0], 'fronturi')]);
        usiK.push({ L: uL1, H: uHK });
        usiK.push({ L: uL2, H: uHK });
      }

      /* polițe: aceeași formă ca blatul, retrase față de fronturi */
      if (nPol > 0) {
        var pA = r1(bA - jpK), pB = r1(bB - jpK);
        var pD = r1(D - (+c.rp));
        var pbrA = r1(pA - pD), pbrB = r1(pB - pD);
        var polyPol = dg
          ? [[0, 0], [pA, 0], [pA, pD], [pD, pB], [0, pB]]
          : [[0, 0], [pA, 0], [pA, pD], [pD, pD], [pD, pB], [0, pB]];
        var boxesPol = [];
        for (var ip = 1; ip <= nPol; ip++) {
          var ycK = y0 + Hint * ip / (nPol + 1);
          boxesPol.push(bp(jpK / 2, ycK - t / 2, jpK / 2, polyPol, t, [0, 0, 0.6], 'polite'));
        }
        add('polita', null, nPol, pA, pB, '-', '-', '-', '-', 'L',
            [dg ? 'politaPentagon' : 'politaL',
             { a: fmt(pA), b: fmt(pB), ca: fmt(pbrA), cb: fmt(pbrB) }],
            boxesPol);
        if (pA > 800 || pB > 800) avert('politaColtLata');
      }

      return { P: P, warn: warn, avertismente: avertismente, deComandat: deComandat, sticla3d: sticla3d, usi: scoateFronturile(usiK), Wint: bA, Hint: Hint, Dint: D,
               W: A, H: H, D: B, soclu: soclu,
               colt: { A: A, B: B, brA: brA, brB: brB, diag: diagL, dg: dg } };
    }

    /* ---- corp ---- */
    if (c.constr === 'intre') {
      add('laterala', null, 2, H, Dp, 'g', '-', 's', 's', 'LV', null, [
        bx(0, 0, zb, t, H, Dp, F({ px: 'f', nx: 'f', pz: 'g', py: 's', ny: 's' }), [-1, 0, 0], 'corp'),
        bx(W - t, 0, zb, t, H, Dp, F({ px: 'f', nx: 'f', pz: 'g', py: 's', ny: 's' }), [1, 0, 0], 'corp')]);
      if (traverse > 0) {
        /* Două traverse în locul blatului: una în față, una în spate.

           Se cantuiesc amândouă pe muchia din față, deși a celei din spate
           stă ascunsă. Motivul e de atelier, nu de socoteală: așa ies două
           piese la fel, pe care omul le ia din teanc fără să se uite care e
           care. Banda de pe cea ascunsă costă câțiva bani; o traversă pusă
           invers costă o desfacere. */
        add('traversa', null, 2, Wint, traverse, 'g', '-', '-', '-', 'L',
          ['traverseSusInLocDeBlat', { lat: fmt(traverse) }], [
            bx(t, H - t, D - traverse, Wint, t, traverse,
               F({ py: 'f', ny: 'f', pz: 'g' }), [0, 1, 0], 'corp'),
            bx(t, H - t, zb, Wint, t, traverse,
               F({ py: 'f', ny: 'f', pz: 'g' }), [0, 1, 0], 'corp')]);
      } else {
        add('blat', null, 1, Wint, Dp, 'g', '-', '-', '-', 'L', null,
          [bx(t, H - t, zb, Wint, t, Dp, F({ py: 'f', ny: 'f', pz: 'g' }), [0, 1, 0], 'corp')]);
      }
      add('fund', null, 1, Wint, Dp, 'g', '-', '-', '-', 'L', null,
        [bx(t, soclu, zb, Wint, t, Dp, F({ py: 'f', ny: 'f', pz: 'g' }), [0, -1, 0], 'corp')]);

      /* Soclul: o bucată de PAL în față, între laterale, pe care stă fundul.
         Se cantuiește pe muchia de jos, nu pe cea de sus: muchia de sus stă
         ascunsă sub fund, iar cea de jos stă pe pardoseală și trage apă. */
      if (soclu > 0) {
        add('soclu', null, 1, Wint, soclu, 's', '-', '-', '-', 'L', ['socluInFata'],
          [bx(t, 0, D - t, Wint, soclu, t,
              F({ pz: 'f', nz: 'f', py: 's', ny: 's' }), [0, -1, 0], 'corp')]);
      }
    } else {
      add('blat', null, 1, W, Dp, 'g', '-', 's', 's', 'L', null,
        [bx(0, H - t, zb, W, t, Dp, F({ py: 'f', ny: 'f', pz: 'g', px: 's', nx: 's' }), [0, 1, 0], 'corp')]);
      add('fund', null, 1, W, Dp, 'g', '-', 's', 's', 'L', null,
        [bx(0, 0, zb, W, t, Dp, F({ py: 'f', ny: 'f', pz: 'g', px: 's', nx: 's' }), [0, -1, 0], 'corp')]);
      add('laterala', null, 2, Hint, Dp, 'g', '-', '-', '-', 'LV', null, [
        bx(0, t, zb, t, Hint, Dp, F({ px: 'f', nx: 'f', pz: 'g' }), [-1, 0, 0], 'corp'),
        bx(W - t, t, zb, t, Hint, Dp, F({ px: 'f', nx: 'f', pz: 'g' }), [1, 0, 0], 'corp')]);
    }

    /* ---- spate ---- */
    var fs = c.spate === 'pal' ? 'f' : 'p';
    var FS = F({
      px: fs === 'p' ? 'p' : '-', nx: fs === 'p' ? 'p' : '-',
      py: fs === 'p' ? 'p' : '-', ny: fs === 'p' ? 'p' : '-', pz: fs, nz: fs
    });
    if (aplicat) {
      add('spateAplicat', { mat: tp >= 8 ? 'PAL' : 'PFL' }, 1, Hutil - 3, W - 3, '-', '-', '-', '-', '-',
        ['capsatPeSpate'], [bx(1.5, soclu + 1.5, 0, W - 3, Hutil - 3, tp, FS, [0, 0, -1], 'spate')]);
    } else {
      add('spateNut', null, 1, Hint + 2 * (NUT_AD - 1), Wint + 2 * (NUT_AD - 1), '-', '-', '-', '-', '-',
        ['nutSpate', { off: NUT_OFF, ad: NUT_AD }],
        [bx(t - (NUT_AD - 1), y0 - (NUT_AD - 1), NUT_OFF,
            Wint + 2 * (NUT_AD - 1), Hint + 2 * (NUT_AD - 1), tp, FS, [0, 0, -1], 'spate')]);
    }

    /* ---- fronturi: pozitii ---- */
    var apl = c.montaj === 'aplicat';
    var xoff = apl ? rm : t + rinc;
    var yTop = apl ? H - rm : H - t - rinc;
    var yBot = apl ? soclu + rm : y0 + rinc;
    var zF = apl ? D : D - t;
    /* la corpul de colț orb, o parte din front rămâne acoperită de corpul vecin */
    var orb = c.tip === 'colt-orb' ? Math.max(0, +c.orb) : 0;
    var fL = (apl ? W - 2 * rm : Wint - 2 * rinc) - orb;
    if (orb > 0 && fL <= 0) {
      avert('zonaOarbaPreaMare', { orb: fmt(orb) });
    }
    /* Geometria compartimentelor stă aici, înaintea ușilor, fiindcă și ușile
       au nevoie de ea: se pot pune pe compartimente alese, nu doar pe toată
       lățimea. Montanții și polițele o folosesc mai jos. */
    var compartimente = nDsp + 1;
    var Wcomp = (Wint - nDsp * t) / compartimente;             /* lățimea unui compartiment */
    var xComp = function (i) { return t + i * (Wcomp + t); };  /* unde începe compartimentul i */

    var FD = F({ pz: 'f', nz: 'f', px: 'g', nx: 'g', py: 'g', ny: 'g' });
    /* Cât mănâncă sertarele din fața corpului, și DIN CARE CAPĂT.

       `ri` de la urmă e rostul dintre ultimul sertar și ușa de lângă el;
       fără el s-ar atinge. Sertarele de sus se lipesc de tavan, cele de jos
       de fund, iar rostul rămâne întotdeauna spre uși. */
    var sertareJos = !!(+c.sertareJos) && nSer > 0;
    var cereSertare = nSer > 0 ? nSer * (+c.hFront) + nSer * ri : 0;
    var usedTop = sertareJos ? 0 : cereSertare;
    var usedBot = sertareJos ? cereSertare : 0;
    /* Fâșia care rămâne ușilor, între sertare și capetele corpului. Tot ce
       se așază în față se măsoară între astea două, nu între `yBot` și
       `yTop`: alea sunt marginile frontului întreg, sertare cu tot. */
    var yUsiBot = yBot + usedBot;
    var yUsiTop = yTop - usedTop;

    /* ---- usi ----

       Ușile se pun pe ZONE, nu pe tot golul. O zonă e o fâșie pe înălțime în
       care intră `nUsi` canaturi, împărțite pe compartimentele alese.

       Până acum era o singură zonă. Coloana de cuptor cere două: ușă jos,
       GOL la mijloc pentru aparat, ușă sus. Golul ăla nu se putea scrie în
       niciun fel — `hUsi` pune uși numai de jos în sus. */
    var usi = [];
    /* Tot golul pe care pot sta uși, măsurat de la fund în sus. */
    var uHplin = (apl ? Hutil - 2 * rm : Hint - 2 * rinc) - usedTop - usedBot;
    var hNisaCerut = +c.hNisa || 0;
    var usiPartiale = nUsi > 0 && hUsiCerut > 0 && hUsiCerut < uHplin;

    /* Polițele care NU se pot muta: alea care închid o zonă de uși sau
       mărginesc nișa. Pe ele stă aparatul și de ele se prinde canatul, deci
       se pun înaintea celor împărțite egal. */
    var politeFixe = [];
    /* păstrat pentru partea de polițe: linia de sus a ușilor de jos */
    var yLinieUsi = null;
    /* Golul nișei. În el NU se pune nicio poliță: acolo intră aparatul, iar
       o poliță la mijlocul cuptorului n-ar fi o scăpare de desen, ar fi o
       piesă tăiată degeaba și un corp care nu se poate monta. */
    var zonaNisa = null;

    /* Ușile glisante nu se împart pe zone și n-au balamale: se suprapun și
       merg pe șine. Toată socoteala lor stă aici, deoparte. */
    if (nUsi > 0 && c.montaj === 'glisant') {
      var supr = Math.max(0, +c.supr || 0);
      var hSine = Math.max(0, +c.hSine || 0);
      var gH = H - hSine;
      /* Fiecare ușă acoperă partea ei PLUS suprapunerea cu vecina. Suma
         lățimilor e mai mare decât corpul, tocmai cu suprapunerile. */
      var gL = (W + (nUsi - 1) * supr) / nUsi;

      if (nUsi < 2) avert('glisantaSingura');
      if (gH <= 0 || gL <= 0) {
        avert('glisantaNuIncape');
      } else {
        var boxesG = [];
        for (var gi = 0; gi < nUsi; gi++) {
          /* Ușile stau pe două șine, una în fața celeilalte: altfel nu s-ar
             putea trece una pe lângă alta. */
          boxesG.push(bx(gi * (gL - supr), hSine / 2, D + (gi % 2) * t, gL, gH, t,
            FD, [0, 0, 1.6], 'fronturi'));
        }
        add('usa', null, nUsi, gH, gL, 'g', 'g', 'g', 'g', 'LV',
          ['usiGlisante', { n: nUsi, supr: fmt(supr), sine: fmt(hSine) }], boxesG);
        usi.push({ L: gL, H: gH });
        /* O ușă de dulap glisantă de peste 1200 se lasă în timp și sare de
           pe șină; atelierele o fac din două sau pun profil de aluminiu. */
        if (gL > 1200) avert('glisantaLata', { lat: fmt(gL) });
        if (gH > 2600) avert('glisantaInalta', { inalt: fmt(gH) });
      }
      if (hUsiCerut > 0 || hNisaCerut > 0) avert('glisantaFaraZone');
      if (String(c.compUsi || '').trim()) avert('glisantaFaraCompartimente');

    } else if (nUsi > 0) {
      var uH = usiPartiale ? hUsiCerut : uHplin;
      if (hUsiCerut > uHplin) avert('usiPesteInaltime', { cerut: fmt(hUsiCerut), incape: fmt(uHplin) });

      /* Nișa: golul dintre zonele cu uși.

         Cu ușă jos (`hUsi` pus), golul începe deasupra ei: coloana de
         cuptor. Fără ușă jos, golul începe chiar de la fundul corpului și
         aparatul stă pe el: coloana de frigider. */
      var nisa = 0;
      var yNisaJos = usiPartiale ? (apl ? yUsiBot + uH : yUsiBot + uH + t) : yUsiBot;
      /* De unde pornește ușa de deasupra nișei. La ușă aplicată canatul
         acoperă polița; la una încastrată se oprește sub ea. */
      var yUsaSus = 0, hUsaSus = 0;

      if (hNisaCerut > 0) {
        yUsaSus = yNisaJos + hNisaCerut + (apl ? 0 : t);
        /* `yUsiTop`, nu `yTop`: deasupra stau fronturile de sertar. Cu
           `yTop` ieșeau două uși de 512 ȘI un front de 150 peste aceiași
           150 de milimetri — două piese tăiate pentru același loc. */
        hUsaSus = yUsiTop - yUsaSus;
        if (hUsaSus < 50) {
          /* Cât ar încăpea, ca omul să nu ghicească. */
          avert('nisaPreaMare', {
            nisa: fmt(hNisaCerut),
            incape: fmt(Math.max(0, hNisaCerut + hUsaSus - 50))
          });
        } else {
          nisa = hNisaCerut;
        }
      }

      if (usiPartiale) {
        /* La ușă aplicată, canatul acoperă muchia poliței de sus; la una
           încastrată se oprește sub ea. */
        yLinieUsi = apl ? yUsiBot + uH - t / 2 : yUsiBot + uH + t / 2;
        politeFixe.push(yLinieUsi);
      }

      if (uH <= 0) {
        avert('fronturiSertarPreaInalte');
      } else {
        /* Pe ce compartimente stau usile. Gol inseamna toate, adica felul de
           pana acum. Cu montant, se pot alege: stanga cu usa, dreapta
           deschisa. */
        var compCuUsi = compartimenteAlese(c.compUsi, compartimente);
        var alese = compCuUsi.length;
        if (String(c.compUsi || '').trim() && compartimente === 1) {
          avert('usiPeCompartimenteFaraMontant');
        }
        if (nUsi % alese !== 0) avert('usiPesteMontant', { usi: nUsi, comp: alese });

        /* Zona pe care o prinde usa unui compartiment, in cotele corpului.
           La usa aplicata canatul acopera jumatate de montant, ca doua usi
           vecine sa-l imparta, si toata latura la capete. La cea incastrata
           sta in gol, cu rostul lui. */
        var zonaUsa = function (idx) {
          var st, dr;
          if (apl) {
            /* Pe montant, canatul se opreste la jumatatea lui, ca vecinul
               sa-l imparta — minus jumatate de rost de fiecare parte, altfel
               cele doua usi se ating si nu se mai pot deschide. */
            st = idx === 0 ? rm : xComp(idx) - t / 2 + ri / 2;
            dr = idx === compartimente - 1 ? W - rm : xComp(idx) + Wcomp + t / 2 - ri / 2;
          } else {
            st = xComp(idx) + rinc;
            dr = xComp(idx) + Wcomp - rinc;
          }
          /* la coltul orb, ultimul compartiment ramane acoperit de vecin */
          if (idx === compartimente - 1) dr -= orb;
          return { st: st, lat: dr - st };
        };

        /* Usile se impart intre compartimentele alese; ce ramane se pune in
           primele, nu se pierde. */
        var perComp = [], baza = Math.floor(nUsi / alese), rest = nUsi % alese;
        for (var q = 0; q < alese; q++) perComp.push(baza + (q < rest ? 1 : 0));

        /* O zonă de uși: `nUsi` canaturi de la `yDeLa` în sus, înalte `inalt`.
           Se cheamă o dată pentru corpul obișnuit și de două ori când e nișă
           la mijloc. */
        var faZonaDeUsi = function (yDeLa, inalt) {
          if (inalt <= 0) return;
          /* Compartimentele de la capete ies putin mai late decat cele din
             mijloc, fiindca acolo canatul acopera toata latura, nu jumatate
             de montant. Usile se grupeaza dupa latime, ca in lista de piese
             sa nu apara doua randuri identice. */
          var grupe = {}, ordine = [];
          compCuUsi.forEach(function (idx, k) {
            var n = perComp[k];
            if (!n) return;
            var z = zonaUsa(idx);
            var lat = (z.lat - (n - 1) * ri) / n;
            if (lat <= 0) { avert('usaPreaIngusta', { comp: idx + 1 }); return; }
            var cheie = String(r1(lat));
            if (!grupe[cheie]) { grupe[cheie] = { lat: lat, boxes: [] }; ordine.push(cheie); }
            for (var d = 0; d < n; d++) {
              var xUsa = z.st + d * (lat + ri);
              grupe[cheie].boxes.push(bx(xUsa, yDeLa, zF, lat, inalt, t,
                FD, [0, 0, 1.6], 'fronturi'));
              puneManer(xUsa, yDeLa, lat, inalt, zF, 'vertical');
            }
          });

          ordine.forEach(function (cheie) {
            var g = grupe[cheie];
            add('usa', null, g.boxes.length, inalt, g.lat, 'g', 'g', 'g', 'g', 'LV',
              orb > 0
                ? ['balamaleUsaOrb', { n: balamale(inalt), cot: c.balama, orb: fmt(orb) }]
                : ['balamaleUsa', { n: balamale(inalt), cot: c.balama }], g.boxes);
            usi.push({ L: g.lat, H: inalt });
            if (g.lat > 600) avert('usaLata');
            if (inalt > 2000) avert('usaInalta');
          });
        };

        /* Zona de jos. Fără ușă jos (coloana de frigider) e goală, iar
           `faZonaDeUsi` se întoarce singură. */
        if (nisa === 0 || usiPartiale) faZonaDeUsi(yUsiBot, uH);

        /* Gol jos, sertare sus: se poate foarte bine — frigider dedesubt,
           sertar deasupra — dar de cele mai multe ori omul a lăsat golul
           TOCMAI pentru sertare. Se spune, ca să nu afle din desen. */
        if (nisa > 0 && !usiPartiale && nSer > 0 && !sertareJos) {
          avert('sertareSusNisaJos', { nisa: fmt(nisa) });
        }

        if (nisa > 0) {
          /* Polița care închide nișa pe deasupra: pe ea se sprijină corpul
             de sus, iar aparatul intră dedesubt. */
          politeFixe.push(yNisaJos + nisa + t / 2);
          zonaNisa = { jos: yNisaJos, sus: yNisaJos + nisa };
          faZonaDeUsi(yUsaSus, hUsaSus);
        }

        if (usi.length) {
          if (apl && c.balama !== '0' && nUsi === 1) avert('balamaCot0');
          if (!apl && c.balama !== '18') avert('balamaCot18');
        }
      }
    }

    /* ---- nișă fără uși ----

       Corpul bază de cuptor: sertar jos, cuptor deasupra, fără nicio ușă.
       Nișa e tot ce rămâne lângă sertare; `hNisa` spune cât cere aparatul,
       ca să se vadă de pe acum dacă intră, nu la montaj.

       Între sertare și nișă stă o poliță fixă — pe ea se sprijină cuptorul.
       Se pune pe muchia fronturilor de sertar, ca la ușile parțiale: la front
       aplicat frontul îi acoperă cantul, la unul încastrat se oprește sub ea.
       Cu sertarele sus merge la fel, pe dos: nișa dedesubt. */
    var yPolitaNisa = null;
    if (nUsi === 0 && nSer > 0 && hNisaCerut > 0 && c.montaj !== 'glisant') {
      var muchieFront = sertareJos ? yUsiBot - ri : yUsiTop + ri;
      var spreNisa = sertareJos ? 1 : -1;
      yPolitaNisa = apl ? muchieFront - spreNisa * t / 2 : muchieFront + spreNisa * t / 2;
      var golNisa = sertareJos
        ? (y0 + Hint) - (yPolitaNisa + t / 2)
        : (yPolitaNisa - t / 2) - y0;
      if (golNisa + 0.5 < hNisaCerut) {
        avert('nisaLangaSertare', { nisa: fmt(hNisaCerut), incape: fmt(Math.max(0, golNisa)) });
        yPolitaNisa = null;
      } else {
        politeFixe.push(yPolitaNisa);
        zonaNisa = sertareJos
          ? { jos: yPolitaNisa + t / 2, sus: y0 + Hint }
          : { jos: y0, sus: yPolitaNisa - t / 2 };
      }
    }

    /* ---- sertare ---- */
    if (nSer > 0) {
      var jg = +c.jg, ts = +c.ts, hF = +c.hFront, hc = +c.hCutie;
      var lg = +c.lg;
      if (!lg) { lg = Math.floor((Dint - 10) / 50) * 50; }
      if (lg > Dint) avert('glisieraNuIncape', { lg: lg, dint: fmt(Dint) });
      if (hc > hF) avert('cutiePreaInalta');

      /* De unde pornește șirul de sertare. Sus se lipesc de tavan; jos, de
         fund — iar rostul de `ri` rămâne spre uși, nu sub ele. */
      var ySertare = sertareJos ? yBot + usedBot - ri : yTop;

      /* Sertarele se așază de sus în jos. Dacă fronturile nu ajung până la
         fund și nici nu urmează o ușă dedesubt, rămâne un gol pe care omul
         îl vede în desen și nu-și explică de unde vine. Spunem și cât ar
         trebui să aibă fronturile ca să umple corpul. */
      var fataLibera = (apl ? Hutil - 2 * rm : Hint - 2 * rinc);
      var golSertare = fataLibera - (nSer * hF + (nSer - 1) * ri);
      /* Cu nișă cerută golul e voit — nu se spune de două ori, o dată ca
         nișă care nu încape și o dată ca gol. */
      if (nUsi === 0 && golSertare > 20 && !(hNisaCerut > 0)) {
        avert('sertareNuUmplu', {
          gol: fmt(golSertare),
          front: Math.round((fataLibera - (nSer - 1) * ri) / nSer)
        });
      }
      var cut = Wint - 2 * jg;
      var zf = zF - 2, dz = [0, 0, 1.1];
      var fr = [], lat = [], fsp = [], fnd = [];
      for (var k = 0; k < nSer; k++) {
        var yt = ySertare - k * (hF + ri), yb0 = yt - hF;
        var yb = yb0 + Math.max(0, (hF - hc) / 2);
        fr.push(bx(xoff, yb0, zF, fL, hF, t, FD, [0, 0, 1.6], 'fronturi'));
        puneManer(xoff, yb0, fL, hF, zF, 'orizontal');
        lat.push(bx(t + jg, yb, zf - lg, ts, hc, lg,
          F({ px: 'f', nx: 'f', py: 's', ny: 's', pz: 's', nz: 's' }), dz, 'sertare'));
        lat.push(bx(W - t - jg - ts, yb, zf - lg, ts, hc, lg,
          F({ px: 'f', nx: 'f', py: 's', ny: 's', pz: 's', nz: 's' }), dz, 'sertare'));
        fsp.push(bx(t + jg + ts, yb, zf - ts, cut - 2 * ts, hc, ts,
          F({ pz: 'f', nz: 'f', py: 's', ny: 's' }), dz, 'sertare'));
        fsp.push(bx(t + jg + ts, yb, zf - lg, cut - 2 * ts, hc, ts,
          F({ pz: 'f', nz: 'f', py: 's', ny: 's' }), dz, 'sertare'));
        fnd.push(bx(t + jg, yb - PFL_SERTAR, zf - lg, cut, PFL_SERTAR, lg,
          F({ px: 'p', nx: 'p', py: 'p', ny: 'p', pz: 'p', nz: 'p' }), dz, 'sertare'));
      }
      /* Lângă nișă, cutia sertarului stă sub polița aparatului. Dacă e mai
         înaltă decât golul, sertarul nu intră — se spune cât poate avea. */
      if (yPolitaNisa !== null) {
        /* Cutia stă pe mijlocul frontului ei, iar fundul de PFL sub ea. */
        var kLangaNisa = sertareJos ? 0 : nSer - 1;
        var frontJos = ySertare - kLangaNisa * (hF + ri) - hF;
        var hcMax = sertareJos
          ? 2 * ((yPolitaNisa - t / 2) - frontJos) - hF
          : hF - 2 * ((yPolitaNisa + t / 2) + PFL_SERTAR - frontJos);
        if (hc > hcMax + 0.01) {
          avert('cutieSubPolitaNisa', { cutie: fmt(hc), max: fmt(Math.max(0, Math.floor(hcMax))) });
        }
      }
      add('frontSertar', null, nSer, hF, fL, 'g', 'g', 'g', 'g', 'LO',
        ['rostFronturi', { rost: ri }], fr);
      add('sertarLaterala', null, 2 * nSer, lg, hc, 's', 's', 's', 's', 'L',
        ['glisieraDe', { lg: lg }], lat);
      add('sertarFataSpate', null, 2 * nSer, cut - 2 * ts, hc, 's', 's', '-', '-', 'L', null, fsp);
      add('sertarFund', null, nSer, lg, cut, '-', '-', '-', '-', '-', ['subCutie'], fnd);
    }

    /* ---- montanți (despărțitori) ----

       Se prind de blat și de fund exact ca lateralele: aceleași dibluri în
       cant la capete și aceleași excentrice. Împart interiorul în nDsp + 1
       compartimente egale, iar polițele se fac pe compartiment. */
    if (nDsp > 0) {
      var boxesD = [];
      for (var d = 1; d <= nDsp; d++) {
        boxesD.push(bx(xComp(d) - t, y0, zb, t, Hint, Dp,
          F({ px: 'f', nx: 'f', pz: 'g' }), [0, 0, 0], 'corp'));
      }
      /* muchia din față se cantuiește ca la laterale, restul stau ascunse */
      add('montant', null, nDsp, Hint, Dp, 'g', '-', '-', '-', 'LV', null, boxesD);

      if (Wcomp < 100) avert('compartimentIngust', { lat: fmt(Wcomp) });
      if (nSer > 0) avert('sertareCuMontant');
    }

    /* ---- polite ---- */
    /* Polițele se fac și când omul n-a cerut niciuna, dacă zonele de uși sau
       nișa cer polițe fixe: alea țin corpul, nu sunt de pus lucruri pe ele. */
    if (nPol > 0 || politeFixe.length > 0) {
      var jp = +c.jp, pL = Wcomp - jp, pl = Dint - (+c.rp);
      var boxesP = [];

      /* Unde stau polițele pe înălțime. Fără uși parțiale se împart egal pe
         tot golul, ca până acum. Cu uși doar jos, una se fixează pe linia
         ușilor — fără ea canatul n-are de ce se închide sus și corpul
         rămâne fără legătură la mijloc — iar restul se împart între cele
         două goluri, după cât de înalt e fiecare. */
      var inaltimi = [];
      /* Polițele fixe intră întâi: alea închid o zonă de uși sau mărginesc
         nișa, deci nu se pot muta. Restul se împart în golurile rămase,
         fiecare gol primind pe măsura lui — un gol de două ori mai mare
         primește de două ori mai multe polițe. */
      var fixe = politeFixe.slice().sort(function (a, b) { return a - b; });
      var jos = y0 + usedBot, sus = y0 + Hint - usedTop;

      /* Polițele fixe nu sunt opționale: pe ele stă aparatul din nișă și de
         ele se prinde canatul. Dacă omul a cerut mai puține decât atât, tot
         se fac — dar i se spune de ce are mai multe decât a cerut. */
      if (fixe.length > nPol) avert('politeFixeInPlus', { cerut: nPol, fac: fixe.length });

      fixe.forEach(function (y) { inaltimi.push(y); });

      var ramase = Math.max(0, nPol - fixe.length);
      if (ramase > 0) {
        /* Golurile dintre polițele fixe, de jos în sus. */
        var margini = [jos].concat(fixe, [sus]);
        var goluri = [];
        for (var g = 0; g < margini.length - 1; g++) {
          var mij = (margini[g] + margini[g + 1]) / 2;
          /* Golul nișei se sare: acolo intră aparatul. */
          if (zonaNisa && mij > zonaNisa.jos && mij < zonaNisa.sus) continue;
          goluri.push({ de_la: margini[g], la: margini[g + 1],
                        marime: Math.max(0, margini[g + 1] - margini[g]) });
        }
        /* Dacă nișa a înghițit tot golul, polițele cerute n-au unde sta. */
        if (!goluri.length) {
          avert('politeNuIncap', { cate: ramase });
          ramase = 0;
        }
        var total = goluri.reduce(function (a, x) { return a + x.marime; }, 0) || 1;

        /* Împărțeala se face pe rând, scăzând ce s-a dat: altfel rotunjirile
           fiecărui gol se adună și ies cu una mai multe sau mai puține. */
        var deDat = ramase;
        goluri.forEach(function (x, k) {
          var n = (k === goluri.length - 1)
            ? deDat
            : Math.min(deDat, Math.round(ramase * x.marime / total));
          deDat -= n;
          for (var p = 1; p <= n; p++) inaltimi.push(x.de_la + x.marime * p / (n + 1));
        });
      }
      inaltimi.sort(function (a, b) { return a - b; });

      for (var ic = 0; ic < compartimente; ic++) {
        inaltimi.forEach(function (yc) {
          boxesP.push(bx(xComp(ic) + jp / 2, yc - t / 2, zin, pL, t, pl,
            F({ py: 'f', ny: 'f', pz: 'g' }), [0, 0, 0.6], 'polite'));
        });
      }
      add('polita', null, inaltimi.length * compartimente, pL, pl, 'g', '-', '-', '-', 'L', null, boxesP);
      if (pL > 800) avert('politaLunga', { lung: fmt(pL) });
    } else if (yLinieUsi != null) {
      avert('usiJosFaraPolita');
    }

    return { P: P, warn: warn, avertismente: avertismente, manere: manere,
             deComandat: deComandat, sticla3d: sticla3d, usi: scoateFronturile(usi), Wint: Wint, Hint: Hint, Dint: Dint,
             W: W, H: H, D: D, soclu: soclu };
  }

  /* ---- CSV (acelasi format ca in calculatorul original, in limba paginii) ---- */
  var COLOANE_CSV = ['corp', 'piesa', 'buc', 'finitL', 'finitl', 'cantL1', 'cantL2', 'cantl1', 'cantl2',
                     'taiereL', 'taierel', 'fibra', 'nota'];

  function csv(list, tr) {
    var t_ = traducator(tr);
    var head = COLOANE_CSV.map(function (k) { return t_('csv.' + k); });
    var ev = function (c, v) { return v === 'g' ? c.cg : v === 's' ? c.cs : 0; };
    var rows = [head.join(';')];
    list.forEach(function (c) {
      calc(c, t_).P.forEach(function (p) {
        rows.push([c.nume, p.nume, p.buc, p.L, p.l,
                   ev(c, p.c[0]), ev(c, p.c[1]), ev(c, p.c[2]), ev(c, p.c[3]),
                   p.TL, p.Tl, p.fibraText, p.nota || '']
          .map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';'));
      });
    });
    return rows.join('\n');
  }

  /* ---- validare (doar pe server, unde exista zod) ---- */
  var paramsSchema = null;
  if (typeof module === 'object' && module.exports && typeof require === 'function') {
    try {
      var z = require('zod').z;
      var mm = function (min, max) { return z.coerce.number().finite().min(min).max(max); };
      var int = function (min, max) { return z.coerce.number().int().min(min).max(max); };
      /* cantul unei muchii: gros, subțire, sau deloc */
      var cantMuchie = z.enum(['g', 's', '-']).catch('-');
      paramsSchema = z.object({
        nume: z.string().trim().min(1).max(80).catch('Corp'),
        /* 20 mm ca prag, ca sa incapa si o piesa ingusta — o masca, un
           distantier. Corpurile au pragul lor, mai jos: sub 100 mm un
           corp iese cu interior negativ, adica piese cu cote negative
           in lista de debitare. */
        W: mm(20, 3000), H: mm(20, 3000), D: mm(20, 3000),
        tip: z.enum(TIPURI).catch('drept'),
        W2: mm(100, 3000).catch(900),
        orb: mm(0, 2000).catch(0),
        /* Fără `.catch` aici, înadins. Un `.catch([])` pe vector înseamnă că o
           singură latură greșită — sau un câmp lăsat gol în formular — golește
           tot conturul, salvarea reușește, iar corpul atipic devine în tăcere
           un dreptunghi W×H. Se pierde și avertismentul „conturul nu se
           închide", fiindcă nu mai e nimic de închis, deci nimic nu-l prinde.
           Un corp drept nu trece pe aici cu conturul lipsă: defaults() dă
           `contur: []`, iar vectorul gol e valid. */
        contur: z.array(z.object({
          lung: z.coerce.number().min(10).max(4000),
          unghi: z.coerce.number().min(1).max(359)
        })).max(32),
        constr: z.enum(['intre', 'peste']),
        soclu: mm(0, 300).catch(0),
        picioare: int(0, 1).catch(0),
        traverse: mm(0, TRAVERSA_MAX).catch(0),
        /* Un semn, nu o cotă: 0 sau 1. Orice altceva înseamnă corp cu
           fronturi — felul de până acum, adică cel în care nu se pierde
           nimic dacă valoarea vine stricată de undeva. */
        faraFront: int(0, 1).catch(0),
        usiSticla: int(0, 1).catch(0),
        pBuc: int(1, 999).catch(1),
        pcL1: cantMuchie, pcL2: cantMuchie, pcl1: cantMuchie, pcl2: cantMuchie,
        pFibra: z.enum(['L', 'l', '-']).catch('L'),
        t: mm(6, 50), cg: mm(0, 5), cs: mm(0, 5),
        spate: z.enum(['aplicat', 'nut', 'pal']),
        tp: mm(0, 50),
        nUsi: int(0, 6),
        /* Înălțimea zonei cu uși, de la fund în sus. Gol sau 0 înseamnă uși
           pe toată înălțimea, adică felul de până acum. Gol, nu 0: caseta
           trebuie să arate indiciul „toată înălțimea", iar un „0" scris
           acolo nu spune asta nimănui. Ca la lungimea glisierei. */
        hUsi: z.union([z.literal(''), z.coerce.number().min(0).max(3000)]).catch(''),
        hNisa: z.union([z.literal(''), z.coerce.number().min(0).max(3000)]).catch(''),
        /* Compartimentele cu usi, numerotate de la stanga: „1", „1,3". Gol
           inseamna toate. Text, nu numar: e o lista, nu o cota. */
        compUsi: z.string().trim().max(40).catch(''),
        montaj: z.enum(['aplicat', 'incastrat', 'glisant']),
        supr: mm(0, 200).catch(30),
        hSine: mm(0, 300).catch(40),
        balama: z.preprocess(function (v) { return String(v); }, z.enum(['0', '9', '18'])),
        rm: mm(0, 50), ri: mm(0, 50), rinc: mm(0, 50),
        nPol: int(0, 20), jp: mm(0, 50), rp: mm(0, 300),
        /* montanți (despărțitori) — 0 înseamnă corp fără compartimentare */
        nDsp: int(0, 6).catch(0),
        nSer: int(0, 12), hFront: mm(20, 1200), hCutie: mm(20, 1200),
        /* Un semn, nu o cotă: 0 = sertarele sus, ca până acum. */
        sertareJos: int(0, 1).catch(0),
        maner: int(0, 1).catch(1),
        manerDir: z.enum(['obisnuit', 'orizontal', 'vertical']).catch('obisnuit'),
        manerPoz: z.enum(['obisnuit', 'centru', 'stanga', 'dreapta', 'sus', 'jos']).catch('obisnuit'),
        manerL: mm(0, 1200).catch(128),
        jg: mm(0, 50), ts: mm(10, 30),
        /* reglajul de debitare al atelierului; implicit cel măsurat pe
           lucrările reale — vezi reducereCant() */
        pragCant: mm(0, 10).catch(PRAG_CANT),
        rezervaCant: mm(0, 10).catch(REZERVA_CANT),
        lg: z.union([z.literal(''), z.coerce.number().min(0).max(1200)]).catch('')
      }).strict().superRefine(function (v, ctx) {
        /* Pragul de corp. O piesa razleata poate fi ingusta; un corp nu:
           din W = 20 si PAL de 18 ies laterale cu latime negativa. */
        if (v.tip === 'piesa') return;
        ['W', 'H', 'D'].forEach(function (k) {
          if (v[k] < 100) {
            ctx.addIssue({ code: 'too_small', minimum: 100, type: 'number',
                           inclusive: true, path: [k],
                           message: 'un corp nu poate avea ' + k + ' sub 100 mm' });
          }
        });
      });
    } catch (e) {
      /* zod nu e instalat inca (ex. inainte de npm install) */
    }
  }

  return {
    TRAVERSA_MIN: TRAVERSA_MIN,
    TRAVERSA_MAX: TRAVERSA_MAX,
    TRAVERSA_STANDARD: TRAVERSA_STANDARD,
    calc: calc,
    rolPiesa: rolPiesa,
    directie: directie,
    numeDirectie: numeDirectie,
    traducator: traducator,
    defaults: defaults,
    balamale: balamale,
    asezareManer: asezareManer,
    csv: csv,
    conturGeometrie: conturGeometrie,
    conturImplicit: conturImplicit,
    conturSubScara: conturSubScara,
    coteSubScara: coteSubScara,
    reducereCant: reducereCant,
    compartimenteAlese: compartimenteAlese,
    TIPURI: TIPURI,
    paramsSchema: paramsSchema,
    NUT_OFF: NUT_OFF,
    NUT_AD: NUT_AD,
    PFL_SERTAR: PFL_SERTAR
  };
});
