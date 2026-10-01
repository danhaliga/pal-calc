/* ============================================================
   Sistemele de feronerie: ce se alege la deschiderea comenzii.

   Aici stau doar cifrele — cotele de găurire și câte bucăți intră pe
   îmbinare. Numele și explicațiile stau în locales/, sub „fero.*”, ca să
   poată fi citite în oricare din limbile aplicației.

   Cotele și codurile sunt din catalogul Häfele; când articolul
   cumpărat diferă, se schimbă aici, într-un singur loc.
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PalFeronerie = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- asamblarea carcasei ---------- */

  var ASAMBLARE = {
    'minifix': {
      id: 'minifix',
      /* ce intră pe o îmbinare între două piese */
      pePiesa: [
        { art: 'excentricMinifix', buc: 1 },
        { art: 'boltMinifix', buc: 1 },
        { art: 'cepLemn', buc: 2 }
      ],
      gauri: {
        excentric: { d: 15, adancime: 12.5, adancime18: 13.5, deLaMuchie: 34 },
        bolt: { d: 8, adancime: 25 },
        cep: { d: 8, adancimeFata: 14, adancimeCant: 26 }
      }
    },
    'confirmat': {
      id: 'confirmat',
      pePiesa: [
        { art: 'confirmat', buc: 3 },
        { art: 'dibluLemn', buc: 2 },
        { art: 'capacConfirmat', buc: 3 }
      ],
      gauri: {
        confirmat: { d: 7, adancimeFata: 13, dCant: 5, adancimeCant: 45, deLaMuchie: 32 },
        cep: { d: 8, adancimeFata: 14, adancimeCant: 26 }
      }
    },
    'cepuri-suruburi': {
      id: 'cepuri-suruburi',
      pePiesa: [
        { art: 'cepLemn', buc: 2 },
        { art: 'surub445', buc: 3 }
      ],
      gauri: {
        surub: { d: 4.5, adancime: 45, deLaMuchie: 32 },
        cep: { d: 8, adancimeFata: 14, adancimeCant: 26 }
      }
    }
  };

  /* ---------- balamale ----------

     Numai Häfele (Dan, 1 octombrie 2026: „scoatem Blum"). Codurile sunt pe
     cot — 0 aplicată, 9 semi-aplicată, 18 încastrată — și sunt cele văzute
     pe paginile produselor la distribuitori (hafele.ro nu se lasă citit).
     Cupa Ø35 cu șuruburi la 48/6; placa în cruce la 37 mm de muchie, cu
     șuruburile la 32 mm. Unde un cod n-a putut fi confirmat, nu-l scriem:
     în listă iese balamaua fără cod, iar codul se cere la furnizor. */
  var BALAMALE = {
    'hafele-m310': {
      id: 'hafele-m310',
      cupa: { d: 35, adancime: 12, deLaMuchieLaCentru: 22.5 },
      suruburiCupa: { intre: 48, inSpateleAxei: 6, d: 2.5 },
      placa: { deLaMuchieFata: 37, pas: 32, d: 5 },
      deLaCapatUsii: 100,
      coduri: { '0': '311.04.249', '9': '311.04.252', '18': '311.04.255' },
      placaCod: '311.70.610',
      consumabile: [{ art: 'eurosurub', peBalama: 4 }]
    },
    'hafele-m510': {
      id: 'hafele-m510',
      cupa: { d: 35, adancime: 12, deLaMuchieLaCentru: 22.5 },
      suruburiCupa: { intre: 48, inSpateleAxei: 6, d: 2.5 },
      placa: { deLaMuchieFata: 37, pas: 32, d: 5 },
      deLaCapatUsii: 100,
      coduri: { '0': '329.14.300', '9': '329.14.301' },
      placaCod: '329.87.000',
      consumabile: [{ art: 'eurosurub', peBalama: 4 }]
    },
    'fara': { id: 'fara' }
  };

  /* ---------- glisiere ----------

     Matrix BB S30: cu bilă, extragere totală, cu amortizare, 45 mm înaltă,
     13 mm lată (atâta joc pe fiecare parte), cod pe lungime. Matrix UM S30:
     ascunsă sub cutie, cu amortizare, pentru laterale de cutie de 18–19 mm;
     jocul pe parte de 21 mm e cel obișnuit la glisierele de sub cutie și
     trebuie verificat în fișa Häfele. */
  var GLISIERE = {
    'hafele-bb': {
      id: 'hafele-bb',
      jocPeParte: 13,
      suruburiPeSet: 8,
      gauri: { d: 4, adancime: 12, deLaFata: 37, inaltimeDeLaFundCutie: 0 },
      coduri: { 300: '494.02.181', 350: '494.02.182', 400: '494.02.183', 450: '494.02.184',
                500: '494.02.185', 550: '494.02.186', 600: '494.02.187' }
    },
    'hafele-um': {
      id: 'hafele-um',
      jocPeParte: 21,
      suruburiPeSet: 8,
      gauri: { d: 5, adancime: 13, deLaFata: 37 },
      coduri: { 350: '433.07.113', 400: '433.07.114', 450: '433.07.115', 500: '433.07.116' }
    },
    'fara': { id: 'fara' }
  };

  /* ---------- mânere ----------

     Codul se ia după distanța dintre găuri (interaxul), care e lungimea
     mânerului scrisă pe corp. Unde Häfele n-are cod confirmat la interaxul
     cerut, iese mânerul fără cod. */
  var MANERE = {
    'hafele-gesico-negru': { id: 'hafele-gesico-negru', coduri: { 160: '110.34.306', 192: '110.34.307' } },
    'hafele-gesico-alb':   { id: 'hafele-gesico-alb', coduri: { 160: '110.34.706' } },
    'hafele-alu':          { id: 'hafele-alu', coduri: { 128: '155.00.970' } },
    'oarecare':            { id: 'oarecare', coduri: {} }
  };

  /* Comenzile făcute cu Blum trec pe echivalentul Häfele. */
  var VECHI = { 'blum-clip': 'hafele-m310', 'universal': 'hafele-m310', 'bila': 'hafele-bb', 'tandem': 'hafele-um' };

  /* ---------- suspensii de perete ---------- */

  var SUSPENSII = {
    id: 'standard',
    peCorp: 2,
    portantaPePereche: 130,
    gauri: { d: 5, adancime: 12, numar: 4, deLaSpate: 37, deLaSus: 32 },
    consumabile: [
      { art: 'sinaPerete', peMetru: 1 },
      { art: 'dibluPerete', peSuspensie: 2 }
    ]
  };

  /* ---------- plinta aplicată și picioarele ----------

     Corpurile de bucătărie puse în șir stau pe picioare de plastic, iar în
     față se prinde o plintă cumpărată, nu tăiată: se clipsează pe
     picioare. Un corp singur pe podea se face cu soclu din PAL — ăla e în
     calc.js, nu aici.

     Înălțimile sunt cele din catalogul Häfele (100, 120, 150). Bara de 4000
     e lungimea plintei Häfele cu garnitură (P-01549881); distribuitorii
     vând și bare de 2 m, tăiate din ea.

     Câte picioare pe corp: 4, la orice lățime — spus de Dan pe 30
     septembrie („la picioare 4"). Înainte era o valoare de pornire (6 peste
     1000 mm), nemăsurată. Clemele de plintă merg pe picioarele din față,
     deci câte o clemă pentru fiecare picior din față. */
  var PICIOARE = { peCorp: 4, peCorpLat: 4, latDeLa: 1000 };

  var PLINTE = {
    'alu-100': { id: 'alu-100', h: 100, bara: 4000 },
    'alu-120': { id: 'alu-120', h: 120, bara: 4000 },
    'alu-150': { id: 'alu-150', h: 150, bara: 4000 },
    'fara':    { id: 'fara' }
  };

  function implicit() {
    return { asamblare: 'minifix', balama: 'hafele-m310', glisiere: 'hafele-bb', suspensii: true,
             plinta: 'alu-100', maner: 'hafele-gesico-negru' };
  }

  function citeste(valoare) {
    var v = valoare;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
    v = v || {};
    return {
      asamblare: ASAMBLARE[v.asamblare] ? v.asamblare : 'minifix',
      balama: BALAMALE[VECHI[v.balama] || v.balama] ? (VECHI[v.balama] || v.balama) : 'hafele-m310',
      glisiere: GLISIERE[VECHI[v.glisiere] || v.glisiere] ? (VECHI[v.glisiere] || v.glisiere) : 'hafele-bb',
      suspensii: v.suspensii === undefined ? true : !!v.suspensii,
      plinta: PLINTE[v.plinta] ? v.plinta : 'alu-100',
      maner: MANERE[v.maner] ? v.maner : 'hafele-gesico-negru'
    };
  }

  /* Când primește un traducător, pune și numele citibile pe fiecare intrare;
     fără el, rămân doar cifrele și id-urile. */
  function cuNume(grup, intrare, t) {
    if (!intrare) return intrare;
    if (!t) return intrare;
    var baza = 'fero.' + grup + '.' + intrare.id;
    return Object.assign({}, intrare, {
      nume: t(baza + '.nume'),
      descriere: t(baza + '.descriere')
    });
  }

  function sistem(alegeri, t) {
    var a = citeste(alegeri);
    var susp = a.suspensii ? SUSPENSII : null;
    if (susp && t) {
      susp = Object.assign({}, susp, {
        nume: t('fero.suspensii.nume'), descriere: t('fero.suspensii.descriere')
      });
    }
    return {
      alegeri: a,
      asamblare: cuNume('asamblare', ASAMBLARE[a.asamblare], t),
      balama: cuNume('balama', BALAMALE[a.balama], t),
      glisiere: cuNume('glisiere', GLISIERE[a.glisiere], t),
      suspensii: susp,
      plinta: cuNume('plinta', PLINTE[a.plinta], t),
      maner: cuNume('maner', MANERE[a.maner], t),
      picioare: PICIOARE
    };
  }

  function optiuni(t) {
    var lista = function (grup, obiect) {
      return Object.keys(obiect).map(function (k) { return cuNume(grup, obiect[k], t); });
    };
    var susp = SUSPENSII;
    if (t) {
      susp = Object.assign({}, SUSPENSII, {
        nume: t('fero.suspensii.nume'), descriere: t('fero.suspensii.descriere')
      });
    }
    return {
      asamblare: lista('asamblare', ASAMBLARE),
      balama: lista('balama', BALAMALE),
      glisiere: lista('glisiere', GLISIERE),
      plinta: lista('plinta', PLINTE),
      maner: lista('maner', MANERE),
      suspensii: susp
    };
  }

  return {
    ASAMBLARE: ASAMBLARE, BALAMALE: BALAMALE, GLISIERE: GLISIERE, SUSPENSII: SUSPENSII,
    PLINTE: PLINTE, PICIOARE: PICIOARE, MANERE: MANERE,
    implicit: implicit, citeste: citeste, sistem: sistem, optiuni: optiuni
  };
});
