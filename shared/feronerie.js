/* ============================================================
   Sistemele de feronerie: ce se alege la deschiderea comenzii.

   Alegerea de aici hotărăște și cantitățile din listă, și cotele din
   programul de găurire. Cotele sunt cele standard din cataloage; când
   articolul cumpărat diferă, se schimbă aici, într-un singur loc.
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
      nume: 'Excentric Minifix 15 + cepuri',
      descriere: 'Se demontează oricând. Pe fiecare îmbinare: un excentric și două cepuri.',
      /* pe o îmbinare între două piese */
      pePiesa: [
        { nume: 'Excentric Minifix 15', buc: 1 },
        { nume: 'Bolț Minifix cu filet', buc: 1 },
        { nume: 'Cep lemn 8×30', buc: 2 }
      ],
      gauri: {
        excentric: { d: 15, adancime: 12.5, adancime18: 13.5, deLaMuchie: 34 },
        bolt: { d: 8, adancime: 25 },
        cep: { d: 8, adancimeFata: 14, adancimeCant: 26 }
      }
    },
    'confirmat': {
      id: 'confirmat',
      nume: 'Confirmat + dibluri',
      descriere: 'Îmbinare fixă, mai ieftină. Capul șurubului rămâne vizibil, se maschează cu capac.',
      pePiesa: [
        { nume: 'Confirmat 6.3×50', buc: 3 },
        { nume: 'Diblu lemn 8×30', buc: 2 },
        { nume: 'Capac mascare confirmat', buc: 3 }
      ],
      gauri: {
        confirmat: { d: 7, adancimeFata: 13, dCant: 5, adancimeCant: 45, deLaMuchie: 32 },
        cep: { d: 8, adancimeFata: 14, adancimeCant: 26 }
      }
    },
    'cepuri-suruburi': {
      id: 'cepuri-suruburi',
      nume: 'Cepuri + șuruburi prin lateral',
      descriere: 'Cel mai simplu. Șuruburile se văd pe laterala exterioară, deci numai la corpuri ascunse.',
      pePiesa: [
        { nume: 'Cep lemn 8×30', buc: 2 },
        { nume: 'Șurub 4×45', buc: 3 }
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
      nume: 'Blum CLIP top BLUMOTION',
      descriere: 'Cu amortizare în balama. Cupă Ø35, adâncime 13 mm.',
      cupa: { d: 35, adancime: 13, deLaMuchieLaCentru: 23 },
      suruburiCupa: { intre: 45, inSpateleAxei: 9.5, d: 2.5 },
      placa: { deLaMuchieFata: 37, pas: 32, d: 5 },
      deLaCapatUsii: 100,
      consumabile: [{ nume: 'Euroșurub 6.3×13', peBalama: 4 }]
    },
    'universal': {
      id: 'universal',
      nume: 'Balama universală Ø35',
      descriere: 'Balama obișnuită cu cupă de 35. Amortizorul se pune separat, pe corp.',
      cupa: { d: 35, adancime: 11.5, deLaMuchieLaCentru: 22.5 },
      suruburiCupa: { intre: 45, inSpateleAxei: 9.5, d: 2.5 },
      placa: { deLaMuchieFata: 37, pas: 32, d: 5 },
      deLaCapatUsii: 100,
      consumabile: [
        { nume: 'Șurub 3.5×16 (balamale)', peBalama: 4 },
        { nume: 'Amortizor aplicat pe corp', peBalama: 0.5 }
      ]
    },
    'fara': { id: 'fara', nume: 'Fără balamale', descriere: 'Corpuri deschise sau cu alt sistem de front.' }
  };

  /* ---------- glisiere ---------- */

  var GLISIERE = {
    'bila': {
      id: 'bila',
      nume: 'Glisiere cu bilă, extragere totală',
      descriere: 'Cutie din PAL, glisiera prinsă pe laterala cutiei și pe laterala corpului.',
      jocPeParte: 12.5,
      suruburiPeSet: 8,
      gauri: { d: 4, adancime: 12, deLaFata: 37, inaltimeDeLaFundCutie: 0 }
    },
    'tandem': {
      id: 'tandem',
      nume: 'Blum TANDEM (sub cutie)',
      descriere: 'Glisiera stă sub cutie, nu se vede. Cere decupaj în fundul cutiei.',
      jocPeParte: 21,
      suruburiPeSet: 8,
      gauri: { d: 5, adancime: 13, deLaFata: 37 }
    },
    'fara': { id: 'fara', nume: 'Fără sertare', descriere: 'Comanda nu are sertare.' }
  };

  /* ---------- suspensii de perete ---------- */

  var SUSPENSII = {
    nume: 'Suspensie corp cu siguranță',
    descriere: 'Ascunsă în spatele panoului, reglabilă pe înălțime și adâncime.',
    peCorp: 2,
    portantaPePereche: 130,
    gauri: { d: 5, adancime: 12, numar: 4, deLaSpate: 37, deLaSus: 32 },
    consumabile: [
      { nume: 'Șină de perete pentru suspensii', peMetru: 1 },
      { nume: 'Diblu perete 8×50 + șurub', peSuspensie: 2 }
    ]
  };

  function implicit() {
    return { asamblare: 'minifix', balama: 'blum-clip', glisiere: 'bila', suspensii: true };
  }

  function citeste(valoare) {
    var v = valoare;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { v = null; } }
    v = v || {};
    return {
      asamblare: ASAMBLARE[v.asamblare] ? v.asamblare : 'minifix',
      balama: BALAMALE[v.balama] ? v.balama : 'blum-clip',
      glisiere: GLISIERE[v.glisiere] ? v.glisiere : 'bila',
      suspensii: v.suspensii === undefined ? true : !!v.suspensii
    };
  }

  function sistem(alegeri) {
    var a = citeste(alegeri);
    return {
      alegeri: a,
      asamblare: ASAMBLARE[a.asamblare],
      balama: BALAMALE[a.balama],
      glisiere: GLISIERE[a.glisiere],
      suspensii: a.suspensii ? SUSPENSII : null
    };
  }

  function optiuni() {
    return {
      asamblare: Object.keys(ASAMBLARE).map(function (k) { return ASAMBLARE[k]; }),
      balama: Object.keys(BALAMALE).map(function (k) { return BALAMALE[k]; }),
      glisiere: Object.keys(GLISIERE).map(function (k) { return GLISIERE[k]; }),
      suspensii: SUSPENSII
    };
  }

  return {
    ASAMBLARE: ASAMBLARE, BALAMALE: BALAMALE, GLISIERE: GLISIERE, SUSPENSII: SUSPENSII,
    implicit: implicit, citeste: citeste, sistem: sistem, optiuni: optiuni
  };
});
