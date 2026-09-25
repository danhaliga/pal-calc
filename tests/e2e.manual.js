'use strict';
/* Verificare end-to-end a contului, creditului și accesului la corpuri.
   Pornește serverul (npm run dev) și rulează: node tests/e2e.manual.js

   Fluxul comenzilor are propriul fișier: tests/e2e-comenzi.manual.js */

const BASE = process.env.APP_URL || 'http://localhost:3000';

function jar() {
  const cookies = new Map();
  return {
    header() { return Array.from(cookies, ([k, v]) => `${k}=${v}`).join('; '); },
    absorb(res) {
      for (const c of (res.headers.getSetCookie ? res.headers.getSetCookie() : [])) {
        const [pair] = c.split(';');
        const i = pair.indexOf('=');
        cookies.set(pair.slice(0, i), pair.slice(i + 1));
      }
    }
  };
}

async function req(j, path, opts = {}) {
  const res = await fetch(BASE + path, {
    redirect: 'manual', ...opts,
    headers: { cookie: j.header(), ...(opts.headers || {}) }
  });
  j.absorb(res);
  return res;
}

async function csrf(j, path) {
  const html = await (await req(j, path)).text();
  const m = html.match(/name="_csrf"\s+value="([^"]+)"/);
  if (!m) throw new Error(`fără token CSRF pe ${path}`);
  return m[1];
}

const form = o => new URLSearchParams(o).toString();
const FORM = { 'content-type': 'application/x-www-form-urlencoded' };

let failed = 0;
function check(name, cond, extra = '') {
  console.log(`${cond ? '✔' : '✖'} ${name}${cond ? '' : '  <-- ' + extra}`);
  if (!cond) failed++;
}

(async () => {
  const stamp = Date.now();
  const A = jar(), B = jar();
  const emailA = `test${stamp}@local.test`;
  const emailB = `alt${stamp}@local.test`;

  /* --- cont nou --- */
  let token = await csrf(A, '/register');
  let res = await req(A, '/register', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: token, email: emailA, name: 'Test', password: 'parola1234', password2: 'parola1234' })
  });
  check('înregistrare → redirect la /orders', res.status === 302 && res.headers.get('location') === '/orders',
        `${res.status} ${res.headers.get('location')}`);

  /* --- CSRF obligatoriu --- */
  res = await req(A, '/corps', { method: 'POST', headers: FORM, body: form({ model: 'baza-2usi' }) });
  check('POST fără token CSRF → 403', res.status === 403, String(res.status));

  /* --- fără credit nu se creează corpuri --- */
  token = await csrf(A, '/corps/new');
  res = await req(A, '/corps', { method: 'POST', headers: FORM, body: form({ _csrf: token, model: 'baza-2usi' }) });
  check('fără credit → trimis la alimentare',
        res.status === 302 && (res.headers.get('location') || '').includes('insuficient=1'),
        res.headers.get('location'));

  /* --- alimentare și creare corp --- */
  token = await csrf(A, '/credit');
  await req(A, '/credit/topup', { method: 'POST', headers: FORM, body: form({ _csrf: token, amount_cents: 5000 }) });

  token = await csrf(A, '/corps/new');
  res = await req(A, '/corps', { method: 'POST', headers: FORM, body: form({ _csrf: token, model: 'baza-2usi' }) });
  const loc = res.headers.get('location') || '';
  const corpId = Number(loc.split('/').pop());
  check('corp creat după alimentare', res.status === 302 && corpId > 0, loc);

  let html = await (await req(A, '/credit')).text();
  check('creditul a scăzut cu prețul unui corp', html.includes('45.00'), 'sold greșit');

  /* --- salvarea parametrilor --- */
  res = await req(A, `/api/corps/${corpId}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-csrf-token': token },
    body: JSON.stringify({ name: 'Corp test', params: { W: 900, H: 720, D: 560, nUsi: 2 } })
  });
  const saved = await res.json();
  check('PUT params → salvat', res.status === 200 && saved.params.W === 900, JSON.stringify(saved).slice(0, 120));

  res = await req(A, `/api/corps/${corpId}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-csrf-token': token },
    body: JSON.stringify({ params: { W: 5000 } })
  });
  check('PUT cu lățime aberantă → 400', res.status === 400, String(res.status));

  /* --- corpul plătit dă cotele de tăiere --- */
  res = await req(A, `/api/corps/${corpId}/pieces`);
  const piese = await res.json();
  const usa = piese.pieces.find(p => p.nume === 'Ușă');
  check('corp plătit: TL/Tl/c sunt livrate',
        piese.paid === true && usa && usa.TL > 0 && Array.isArray(usa.c),
        JSON.stringify(usa || {}).slice(0, 120));

  res = await req(A, `/corps/${corpId}/export.csv`);
  const csvText = await res.text();
  check('CSV se descarcă', res.status === 200 && csvText.includes('Taiere L'), String(res.status));

  /* --- numele cu diacritice nu strică antetul de descărcare --- */
  await req(A, `/api/corps/${corpId}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-csrf-token': token },
    body: JSON.stringify({ name: 'Corp bucătărie înălțat', params: {} })
  });
  res = await req(A, `/corps/${corpId}/export.csv`);
  check('CSV cu diacritice în nume → 200', res.status === 200, String(res.status));

  /* --- persistență după relogin --- */
  await req(A, '/logout', { method: 'POST', headers: FORM, body: form({ _csrf: await csrf(A, '/corps') }) });
  token = await csrf(A, '/login');
  res = await req(A, '/login', {
    method: 'POST', headers: FORM, body: form({ _csrf: token, email: emailA, password: 'parola1234' })
  });
  check('relogin reușit', res.status === 302, String(res.status));
  const dupa = await (await req(A, `/api/corps/${corpId}/pieces`)).json();
  check('corpul rămâne deblocat după relogin', dupa.paid === true);

  await req(A, '/logout', { method: 'POST', headers: FORM, body: form({ _csrf: await csrf(A, '/corps') }) });
  res = await req(A, '/login', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: await csrf(A, '/login'), email: emailA, password: 'gresita' })
  });
  check('parolă greșită → 401', res.status === 401, String(res.status));

  await req(A, '/login', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: await csrf(A, '/login'), email: emailA, password: 'parola1234' })
  });

  /* --- izolarea între utilizatori --- */
  token = await csrf(B, '/register');
  await req(B, '/register', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: token, email: emailB, password: 'parola1234', password2: 'parola1234' })
  });

  res = await req(B, `/corps/${corpId}`);
  check('alt user: pagina corpului → 404', res.status === 404, String(res.status));
  res = await req(B, `/api/corps/${corpId}/pieces`);
  check('alt user: API piese → 404', res.status === 404, String(res.status));
  res = await req(B, `/corps/${corpId}/export.csv`);
  check('alt user: export CSV → 404', res.status === 404, String(res.status));
  token = await csrf(B, '/credit');
  res = await req(B, `/api/corps/${corpId}`, { method: 'DELETE', headers: { 'x-csrf-token': token } });
  check('alt user: ștergere corp străin → 404', res.status === 404, String(res.status));

  /* --- creditul nu trece dintr-un cont în altul --- */
  html = await (await req(B, '/credit')).text();
  check('userul nou pornește cu sold 0', html.includes('0.00'));

  /* --- admin --- */
  res = await req(B, '/admin');
  check('non-admin pe /admin → 404', res.status === 404, String(res.status));

  /* --- duplicat --- */
  token = await csrf(A, `/corps/${corpId}`);
  res = await req(A, `/corps/${corpId}/duplicate`, { method: 'POST', headers: FORM, body: form({ _csrf: token }) });
  check('duplicarea unui corp reușește', res.status === 302, String(res.status));

  console.log(failed ? `\n${failed} verificări au eșuat` : '\nToate verificările au trecut.');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
