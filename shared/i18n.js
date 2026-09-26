/* ============================================================
   Limbile aplicației.

   O cheie are o singură formă („nav.comenzi”) sau mai multe, după număr
   („coli.n”: { one: …, few: …, other: … }). Categoria se alege cu regulile
   CLDR ale limbii, nu cu „n === 1”: româna are trei forme, poloneza și rusa
   au trei, araba are șase.

   Parametrii se scriu {asa} în text. Numerele se formatează cu Intl, ca să
   iasă „1.234,5” în română și „1,234.5” în engleză.
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PalI18n = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Cele 30 de limbi: cele mai vorbite din lume, plus vecinii europeni
     cu care lucrează un atelier din România. `nume` e endonimul — așa își
     spune limba în ea însăși, ca să fie recunoscută de cine o caută. */
  var LIMBI = [
    { cod: 'ro', nume: 'Română',            eng: 'Romanian',   dir: 'ltr', plural: 'ro' },
    { cod: 'en', nume: 'English',           eng: 'English',    dir: 'ltr', plural: 'en' },
    { cod: 'zh', nume: '中文（简体）',        eng: 'Chinese',    dir: 'ltr', plural: 'none' },
    { cod: 'hi', nume: 'हिन्दी',               eng: 'Hindi',      dir: 'ltr', plural: 'en' },
    { cod: 'es', nume: 'Español',           eng: 'Spanish',    dir: 'ltr', plural: 'en' },
    { cod: 'fr', nume: 'Français',          eng: 'French',     dir: 'ltr', plural: 'fr' },
    { cod: 'ar', nume: 'العربية',             eng: 'Arabic',     dir: 'rtl', plural: 'ar' },
    { cod: 'pt', nume: 'Português',         eng: 'Portuguese', dir: 'ltr', plural: 'en' },
    { cod: 'ru', nume: 'Русский',           eng: 'Russian',    dir: 'ltr', plural: 'sl' },
    { cod: 'de', nume: 'Deutsch',           eng: 'German',     dir: 'ltr', plural: 'en' },
    { cod: 'ja', nume: '日本語',              eng: 'Japanese',   dir: 'ltr', plural: 'none' },
    { cod: 'it', nume: 'Italiano',          eng: 'Italian',    dir: 'ltr', plural: 'en' },
    { cod: 'tr', nume: 'Türkçe',            eng: 'Turkish',    dir: 'ltr', plural: 'en' },
    { cod: 'ko', nume: '한국어',              eng: 'Korean',     dir: 'ltr', plural: 'none' },
    { cod: 'vi', nume: 'Tiếng Việt',        eng: 'Vietnamese', dir: 'ltr', plural: 'none' },
    { cod: 'pl', nume: 'Polski',            eng: 'Polish',     dir: 'ltr', plural: 'pl' },
    { cod: 'uk', nume: 'Українська',        eng: 'Ukrainian',  dir: 'ltr', plural: 'sl' },
    { cod: 'nl', nume: 'Nederlands',        eng: 'Dutch',      dir: 'ltr', plural: 'en' },
    { cod: 'id', nume: 'Bahasa Indonesia',  eng: 'Indonesian', dir: 'ltr', plural: 'none' },
    { cod: 'fa', nume: 'فارسی',              eng: 'Persian',    dir: 'rtl', plural: 'en' },
    { cod: 'th', nume: 'ไทย',                eng: 'Thai',       dir: 'ltr', plural: 'none' },
    { cod: 'el', nume: 'Ελληνικά',          eng: 'Greek',      dir: 'ltr', plural: 'en' },
    { cod: 'cs', nume: 'Čeština',           eng: 'Czech',      dir: 'ltr', plural: 'cs' },
    { cod: 'sk', nume: 'Slovenčina',        eng: 'Slovak',     dir: 'ltr', plural: 'cs' },
    { cod: 'sv', nume: 'Svenska',           eng: 'Swedish',    dir: 'ltr', plural: 'en' },
    { cod: 'hu', nume: 'Magyar',            eng: 'Hungarian',  dir: 'ltr', plural: 'en' },
    { cod: 'bg', nume: 'Български',         eng: 'Bulgarian',  dir: 'ltr', plural: 'en' },
    { cod: 'he', nume: 'עברית',              eng: 'Hebrew',     dir: 'rtl', plural: 'he' },
    { cod: 'sr', nume: 'Srpski',            eng: 'Serbian',    dir: 'ltr', plural: 'sl' },
    { cod: 'hr', nume: 'Hrvatski',          eng: 'Croatian',   dir: 'ltr', plural: 'sl' }
  ];

  var IMPLICITA = 'ro';
  var CODURI = LIMBI.map(function (l) { return l.cod; });
  var DUPA_COD = {};
  LIMBI.forEach(function (l) { DUPA_COD[l.cod] = l; });

  /* ---------- pluralul ---------- */

  /* Regulile CLDR, scrise doar pentru familiile pe care le livrăm. */
  var PLURAL = {
    none: function () { return 'other'; },
    en: function (n) { return n === 1 ? 'one' : 'other'; },
    fr: function (n) { return (n === 0 || n === 1) ? 'one' : 'other'; },
    ro: function (n) {
      if (n === 1) return 'one';
      if (n === 0 || (n % 100 >= 1 && n % 100 <= 19)) return 'few';
      return 'other';
    },
    sl: function (n) {                       /* rusă, ucraineană, sârbă, croată */
      var z = n % 10, s = n % 100;
      if (z === 1 && s !== 11) return 'one';
      if (z >= 2 && z <= 4 && (s < 12 || s > 14)) return 'few';
      return 'many';
    },
    pl: function (n) {
      var z = n % 10, s = n % 100;
      if (n === 1) return 'one';
      if (z >= 2 && z <= 4 && (s < 12 || s > 14)) return 'few';
      return 'many';
    },
    cs: function (n) {                       /* cehă, slovacă */
      if (n === 1) return 'one';
      if (n >= 2 && n <= 4) return 'few';
      return 'many';
    },
    he: function (n) { return n === 1 ? 'one' : n === 2 ? 'two' : 'other'; },
    ar: function (n) {
      var s = n % 100;
      if (n === 0) return 'zero';
      if (n === 1) return 'one';
      if (n === 2) return 'two';
      if (s >= 3 && s <= 10) return 'few';
      if (s >= 11 && s <= 99) return 'many';
      return 'other';
    }
  };

  function categorie(cod, n) {
    var l = DUPA_COD[cod] || DUPA_COD[IMPLICITA];
    var f = PLURAL[l.plural] || PLURAL.en;
    return f(Math.abs(Number(n) || 0));
  }

  /* ---------- catalogul ---------- */

  var CATALOAGE = {};
  var incercate = {};

  function inregistreaza(cod, dict) { CATALOAGE[cod] = dict || {}; }
  function incarcate() { return Object.keys(CATALOAGE); }

  /* Pe server, un catalog necerut încă se citește de pe disc la prima
     folosire, ca să meargă și scripturile care nu pornesc aplicația.
     În browser nu există disc: acolo cataloagele se înregistrează din pagină. */
  function catalog(cod) {
    if (CATALOAGE[cod]) return CATALOAGE[cod];
    if (incercate[cod]) return null;
    incercate[cod] = true;

    if (typeof module === 'object' && module.exports && typeof require === 'function') {
      try {
        var fs = require('fs'), path = require('path');
        var f = path.join(__dirname, '..', 'locales', cod + '.json');
        if (fs.existsSync(f)) CATALOAGE[cod] = JSON.parse(fs.readFileSync(f, 'utf8'));
      } catch (e) { /* mergem mai departe cu cheile brute */ }
    }
    return CATALOAGE[cod] || null;
  }

  /* „a.b.c” într-un obiect imbricat sau într-unul plat — merg amândouă. */
  function cauta(dict, cheie) {
    if (!dict) return undefined;
    if (Object.prototype.hasOwnProperty.call(dict, cheie)) return dict[cheie];
    var parti = cheie.split('.'), v = dict;
    for (var i = 0; i < parti.length; i++) {
      if (v == null || typeof v !== 'object') return undefined;
      v = v[parti[i]];
    }
    return v;
  }

  /* ---------- traducerea ---------- */

  var ALIAS = { iw: 'he', in: 'id', nb: 'sv', cmn: 'zh', mo: 'ro' };

  function normalizeaza(cod) {
    if (!cod) return null;
    var c = String(cod).toLowerCase().replace(/_/g, '-');
    if (DUPA_COD[c]) return c;
    var scurt = c.split('-')[0];
    if (DUPA_COD[scurt]) return scurt;
    return DUPA_COD[ALIAS[scurt]] ? ALIAS[scurt] : null;
  }

  /* „ro-RO,ro;q=0.9,en;q=0.8” → prima limbă pe care o avem */
  function dinAntet(antet) {
    if (!antet) return null;
    var lista = String(antet).split(',').map(function (b, i) {
      var p = b.split(';');
      var q = 1;
      if (p[1]) { var m = /q=([\d.]+)/.exec(p[1]); if (m) q = parseFloat(m[1]); }
      return { cod: p[0].trim(), q: isNaN(q) ? 0 : q, i: i };
    }).sort(function (a, b) { return b.q - a.q || a.i - b.i; });

    for (var i = 0; i < lista.length; i++) {
      var c = normalizeaza(lista[i].cod);
      if (c) return c;
    }
    return null;
  }

  function numar(cod, v, zecimale) {
    var n = Number(v);
    if (!isFinite(n)) return String(v);
    try {
      return new Intl.NumberFormat(cod, zecimale == null
        ? { maximumFractionDigits: 3 }
        : { minimumFractionDigits: zecimale, maximumFractionDigits: zecimale }).format(n);
    } catch (e) {
      return zecimale == null ? String(n) : n.toFixed(zecimale);
    }
  }

  /* Parametrii intră așa cum vin. Cotele de debitare se scriu peste tot cu
     punct zecimal și fără separator de mii: un „1.234,5” local într-o listă
     de tăiere se citește greșit în atelier. Unde chiar trebuie număr local
     — bani, totaluri — se cheamă t.numar(). */
  function interpoleaza(sablon, params) {
    if (!params) return sablon;
    return String(sablon).replace(/\{(\w+)\}/g, function (tot, nume) {
      if (!Object.prototype.hasOwnProperty.call(params, nume)) return tot;
      return String(params[nume]);
    });
  }

  /* Un traducător legat de o limbă. Cade pe română când lipsește ceva,
     ca să nu rămână niciodată un ecran gol sau o cheie brută la vedere. */
  function creeaza(cod) {
    var lang = normalizeaza(cod) || IMPLICITA;
    var info = DUPA_COD[lang];

    function brut(cheie) {
      var v = cauta(catalog(lang), cheie);
      if (v === undefined && lang !== IMPLICITA) v = cauta(catalog(IMPLICITA), cheie);
      return v;
    }

    function t(cheie, params) {
      var v = brut(cheie);

      if (v && typeof v === 'object' && !Array.isArray(v)) {
        var n = params && params.n != null ? Number(params.n) : null;
        if (n == null) return cheie;
        var cat = categorie(lang, n);
        var ales = v[cat];
        if (ales === undefined && lang !== IMPLICITA) {
          var ro = cauta(catalog(IMPLICITA), cheie);
          if (ro && typeof ro === 'object') ales = ro[categorie(IMPLICITA, n)] || ro.other;
        }
        if (ales === undefined) ales = v.other || v.one || v.many || v.few;
        v = ales;
      }

      if (v === undefined || v === null) return cheie;   /* cheia lipsă se vede, nu se ascunde */
      return interpoleaza(v, params);
    }

    t.lang = lang;
    t.dir = info.dir;
    t.numeLimba = info.nume;
    t.are = function (cheie) { return brut(cheie) !== undefined; };
    t.numar = function (v, zecimale) { return numar(lang, v, zecimale); };
    t.limbi = function () { return LIMBI; };
    return t;
  }

  return {
    LIMBI: LIMBI, CODURI: CODURI, IMPLICITA: IMPLICITA,
    info: function (cod) { return DUPA_COD[normalizeaza(cod) || IMPLICITA]; },
    normalizeaza: normalizeaza,
    dinAntet: dinAntet,
    categorie: categorie,
    inregistreaza: inregistreaza,
    catalog: catalog,
    incarcate: incarcate,
    creeaza: creeaza,
    numar: numar
  };
});
