/* ============================================================
   Sistemele de feronerie: ce se alege la deschiderea comenzii.

   Aici stau doar cifrele — cotele de găurire și câte bucăți intră pe
   îmbinare. Numele și explicațiile stau în locales/, sub „fero.*”, ca să
   poată fi citite în oricare din limbile aplicației.

   Cotele sunt cele standard din cataloagele Blum și Häfele; când articolul
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

  /* ---------- balamale ---------- */

  var BALAMALE = {
    'blum-clip': {
      id: 'blum-clip',
      cupa: { d: 35, adancime: 13, deLaMuchieLaCentru: 23 },
      suruburiCupa: { intre: 45, inSpateleAxei: 9.5, d: 2.5 },
      placa: { deLaMuchieFata: 37, pas: 32, d: 5 },
      deLaCapatUsii: 100,
      consumabile: [{ art: 'eurosurub', peBalama: 4 }]
    },
    'universal': {
      id: 'universal',
      cupa: { d: 35, adancime: 11.5, deLaMuchieLaCentru: 22.5 },
      suruburiCupa: { intre: 45, inSpateleAxei: 9.5, d: 2.5 },
      placa: { deLaMuchieFata: 37, pas: 32, d: 5 },
      deLaCapatUsii: 100,
      consumabile: [
        { art: 'surubBalamale', peBalama: 4 },
        { art: 'amortizorAplicat', peBalama: 0.5 }
      ]
    },
    'fara': { id: 'fara' }
  };

  /* ---------- glisiere ---------- */

  var GLISIERE = {
    'bila': {
      id: 'bila',
      jocPeParte: 12.5,
      suruburiPeSet: 8,
      gauri: { d: 4, adancime: 12, deLaFata: 37, inaltimeDeLaFundCutie: 0 }
    },
    'tandem': {
      id: 'tandem',
      jocPeParte: 21,
      suruburiPeSet: 8,
      gauri: { d: 5, adancime: 13, deLaFata: 37 }
    },
    'fara': { id: 'fara' }
  };

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
    return { asamblare: 'minifix', balama: 'blum-clip', glisiere: 'bila', suspensii: true,
             plinta: 'alu-100' };
  }

  function citeste(valoare) {
    var v = valoare;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
    v = v || {};
    return {
      asamblare: ASAMBLARE[v.asamblare] ? v.asamblare : 'minifix',
      balama: BALAMALE[v.balama] ? v.balama : 'blum-clip',
      glisiere: GLISIERE[v.glisiere] ? v.glisiere : 'bila',
      suspensii: v.suspensii === undefined ? true : !!v.suspensii,
      plinta: PLINTE[v.plinta] ? v.plinta : 'alu-100'
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
      suspensii: susp
    };
  }

  return {
    ASAMBLARE: ASAMBLARE, BALAMALE: BALAMALE, GLISIERE: GLISIERE, SUSPENSII: SUSPENSII,
    PLINTE: PLINTE, PICIOARE: PICIOARE,
    implicit: implicit, citeste: citeste, sistem: sistem, optiuni: optiuni
  };
});
