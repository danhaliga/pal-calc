'use strict';
/* Facturarea: datele clientului și exportul plăților.
   ============================================================

   Dan are un program de facturare care face facturile și le trimite în SPV
   (RO e-Factura). Aplicația nu face facturi: îi dă programului lista
   plăților, cu datele de facturare ale fiecărui client, într-un CSV pe care
   îl importă.

   Trei reguli:
   1. Nu se alimentează credit fără date de facturare complete — altfel n-ar
      avea din ce face factura.
   2. Datele se COPIAZĂ pe plată în clipa plății: factura iese cu ce era
      atunci, nu cu ce și-a pus omul în cont luna următoare.
   3. O plată exportată se ține minte, ca să nu fie facturată de două ori.
      Plățile de probă (bani virtuali) nu intră niciodată: nu sunt bani.
   ============================================================ */

const { db } = require('./db');
const setari = require('./setari');

const TIPURI = ['pf', 'pj'];
const LUNGIMI = { name: 80, firma: 120, cui: 40, reg_com: 40, adresa: 200, oras: 80, judet: 60, telefon: 40 };

/* Cota standard de TVA în România din 1 august 2025. Se schimbă din
   Administrare → Facturare, nu de aici. */
const COTA_IMPLICITA = 21;

/* Datele de facturare ale unui utilizator, cum stau în cont. */
function dinCont(u) {
  u = u || {};
  return {
    tip: TIPURI.indexOf(u.tip_facturare) !== -1 ? u.tip_facturare : '',
    nume: u.name || '',
    firma: u.firma || '',
    cui: u.cui || '',
    regCom: u.reg_com || '',
    adresa: u.adresa || '',
    oras: u.oras || '',
    judet: u.judet || '',
    tara: u.tara || '',
    email: u.email || '',
    telefon: u.telefon || ''
  };
}

/* Ce lipsește ca să se poată face factura. Listă de chei de câmp. */
function lipsuri(d) {
  const out = [];
  if (!d || TIPURI.indexOf(d.tip) === -1) return ['tip'];
  if (d.tip === 'pj') {
    if (!String(d.firma).trim()) out.push('firma');
    if (!cuiBun(d.cui)) out.push('cui');
  } else if (!String(d.nume).trim()) {
    out.push('nume');
  }
  if (!String(d.adresa).trim()) out.push('adresa');
  if (!String(d.oras).trim()) out.push('oras');
  return out;
}

/* CUI: cifre, eventual cu „RO" în față (plătitorii de TVA). Nu se verifică
   cifra de control: un CUI străin arată altfel, iar programul de facturare
   îl verifică oricum la ANAF. */
function cuiBun(cui) {
  return /^(RO)?\s*\d{2,10}$/i.test(String(cui || '').trim());
}

/* Salvează în cont datele trimise din formular. Întoarce lista lipsurilor. */
function salveaza(userId, body) {
  const t = k => String((body || {})[k] || '').trim().slice(0, LUNGIMI[k] || 200);
  const tip = TIPURI.indexOf(body && body.tip_facturare) !== -1 ? body.tip_facturare : '';
  db.prepare(
    'UPDATE users SET tip_facturare = ?, name = ?, firma = ?, cui = ?, reg_com = ?, ' +
    'adresa = ?, oras = ?, judet = ?, telefon = ? WHERE id = ?'
  ).run(tip, t('name') || null, t('firma') || null, t('cui').toUpperCase().replace(/\s+/g, '') || null,
        t('reg_com') || null, t('adresa') || null, t('oras') || null, t('judet') || null,
        t('telefon') || null, userId);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  return lipsuri(dinCont(u));
}

/* ---------- setările de TVA ---------- */

function tva() {
  const platitor = setari.citeste('FACTURARE_TVA');
  const cota = Number(setari.citeste('FACTURARE_COTA'));
  return {
    platitor: platitor === '' ? true : platitor === '1',
    cota: Number.isFinite(cota) && cota > 0 && cota < 100 ? cota : COTA_IMPLICITA
  };
}

/* ---------- exportul ---------- */

/* Plățile de exportat: plătite, prin Stripe (bani adevărați), între două
   zile, eventual numai cele neexportate încă. */
function platiDeExportat(o) {
  const unde = ["p.status = 'paid'", "p.provider <> 'fake'"];
  const arg = [];
  if (o.de) { unde.push("date(p.created_at) >= date(?)"); arg.push(o.de); }
  if (o.pana) { unde.push("date(p.created_at) <= date(?)"); arg.push(o.pana); }
  if (o.doarNoi) unde.push('p.exportat_la IS NULL');
  return db.prepare(
    'SELECT p.*, u.email AS u_email, u.name AS u_name, u.firma AS u_firma, u.cui AS u_cui, ' +
    'u.reg_com AS u_reg_com, u.adresa AS u_adresa, u.oras AS u_oras, u.judet AS u_judet, ' +
    'u.tara AS u_tara, u.telefon AS u_telefon, u.tip_facturare AS u_tip ' +
    'FROM payments p JOIN users u ON u.id = p.user_id WHERE ' + unde.join(' AND ') +
    ' ORDER BY p.created_at, p.id'
  ).all(...arg);
}

/* Datele de facturare ale unei plăți: cele copiate pe ea la plată, altfel
   (plățile de dinainte) cele de acum din cont. */
function datelePlatii(p) {
  if (p.facturare) {
    try { return Object.assign(dinCont({}), JSON.parse(p.facturare)); } catch (e) { /* cade pe cont */ }
  }
  return dinCont({
    tip_facturare: p.u_tip, name: p.u_name, firma: p.u_firma, cui: p.u_cui, reg_com: p.u_reg_com,
    adresa: p.u_adresa, oras: p.u_oras, judet: p.u_judet, tara: p.u_tara, email: p.u_email, telefon: p.u_telefon
  });
}

/* Tabelul pentru programul de facturare: primul rând e capul de tabel.
   Sumele sunt numere în lei (82.64), ca Excel să le poată aduna. */
function tabel(plati, t) {
  const tv = tva();
  const cap = ['colData', 'colNrPlata', 'colReferinta', 'colTipClient', 'colNume', 'colCui', 'colRegCom',
               'colAdresa', 'colOras', 'colJudet', 'colTara', 'colEmail', 'colTelefon', 'colProdus',
               'colCantitate', 'colUm', 'colPretFaraTva', 'colCotaTva', 'colValoareTva', 'colTotal', 'colMoneda']
    .map(k => t('factura.' + k));
  const lei = c => Math.round(c) / 100;
  return [cap].concat(plati.map(p => {
    const d = datelePlatii(p);
    const total = +p.amount_cents || 0;
    const baza = tv.platitor ? Math.round(total / (1 + tv.cota / 100)) : total;
    return [
      String(p.created_at || '').slice(0, 10), p.id, p.provider_ref || '',
      t(d.tip === 'pj' ? 'factura.tipPj' : 'factura.tipPf'),
      d.tip === 'pj' ? d.firma : d.nume, d.tip === 'pj' ? d.cui : '', d.tip === 'pj' ? d.regCom : '',
      d.adresa, d.oras, d.judet, d.tara, d.email, d.telefon,
      t('factura.produs'), 1, t('factura.um'),
      lei(baza), tv.platitor ? tv.cota : 0, lei(total - baza), lei(total),
      String(p.currency || 'ron').toUpperCase()
    ];
  }));
}

/* CSV cu „;", cum îl deschide Excel în română, cu BOM pentru diacritice.
   Sumele cu virgulă. Rămâne pentru legăturile vechi; exportul e în Excel. */
function csv(plati, t) {
  const cel = v => {
    const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v == null ? '' : v);
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const r = tabel(plati, t);
  /* sumele (ultimele coloane) cu două zecimale, cum stau pe factură */
  const bani = [16, 18, 19];
  return '\ufeff' + r.map((rand, i) => rand.map((v, j) =>
    cel(i && bani.indexOf(j) !== -1 ? v.toFixed(2).replace('.', ',') : v)).join(';')).join('\r\n') + '\r\n';
}

const marcheazaExportate = db.transaction(ids => {
  const st = db.prepare("UPDATE payments SET exportat_la = datetime('now') WHERE id = ? AND exportat_la IS NULL");
  ids.forEach(id => st.run(id));
});

module.exports = {
  TIPURI, LUNGIMI, COTA_IMPLICITA, dinCont, lipsuri, cuiBun, salveaza, tva,
  platiDeExportat, datelePlatii, tabel, csv, marcheazaExportate
};
