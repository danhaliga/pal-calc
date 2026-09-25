'use strict';
/* Verificare end-to-end pe serverul pornit local (nu face parte din `npm test`).
   Pornește serverul (npm run dev) și rulează: node tests/e2e.manual.js */

const BASE = process.env.APP_URL || 'http://localhost:3000';

function jar() {
  const cookies = new Map();
  return {
    header() { return Array.from(cookies, ([k, v]) => `${k}=${v}`).join('; '); },
    absorb(res) {
      const list = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      for (const c of list) {
        const [pair] = c.split(';');
        const i = pair.indexOf('=');
        cookies.set(pair.slice(0, i), pair.slice(i + 1));
      }
    }
  };
}

async function req(j, path, opts = {}) {
  const res = await fetch(BASE + path, {
    redirect: 'manual',
    ...opts,
    headers: { cookie: j.header(), ...(opts.headers || {}) }
  });
  j.absorb(res);
  return res;
}

async function csrf(j, path) {
  const res = await req(j, path);
  const html = await res.text();
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

  /* --- 1. cont nou --- */
  let token = await csrf(A, '/register');
  let res = await req(A, '/register', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: token, email: emailA, name: 'Test', password: 'parola1234', password2: 'parola1234' })
  });
  check('înregistrare → redirect la /corps', res.status === 302 && res.headers.get('location') === '/corps',
        `${res.status} ${res.headers.get('location')}`);

  /* --- 2. CSRF obligatoriu --- */
  res = await req(A, '/corps', { method: 'POST', headers: FORM, body: form({ name: 'Fără token' }) });
  check('POST fără token CSRF → 403', res.status === 403, String(res.status));

  /* --- 3. corp nou --- */
  token = await csrf(A, '/corps');
  res = await req(A, '/corps', { method: 'POST', headers: FORM, body: form({ _csrf: token, name: 'Corp test' }) });
  const loc = res.headers.get('location') || '';
  const corpId = Number(loc.split('/').pop());
  check('corp creat → redirect la editor', res.status === 302 && corpId > 0, loc);

  /* --- 4. salvare parametri --- */
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

  /* --- 5. corp draft: fără câmpuri plătite --- */
  res = await req(A, `/api/corps/${corpId}/pieces`);
  const draft = await res.json();
  const leaked = draft.pieces.filter(p => 'TL' in p || 'Tl' in p || 'c' in p);
  check('draft: răspunsul NU conține TL/Tl/c', draft.paid === false && leaked.length === 0,
        JSON.stringify(leaked[0] || {}).slice(0, 120));
  check('draft: cotele finite și 3D sunt livrate',
        draft.pieces.length > 0 && draft.pieces[0].L > 0 && draft.pieces[0].boxes.length > 0);

  res = await req(A, `/corps/${corpId}/export.csv`);
  check('draft: export CSV → 402', res.status === 402, String(res.status));

  /* --- 6. plată fake --- */
  token = await csrf(A, `/corps/${corpId}`);
  res = await req(A, `/corps/${corpId}/pay`, { method: 'POST', headers: FORM, body: form({ _csrf: token }) });
  check('plată fake → redirect cu ?paid=1',
        res.status === 302 && (res.headers.get('location') || '').includes('paid=1'),
        res.headers.get('location'));

  res = await req(A, `/api/corps/${corpId}/pieces`);
  const paidRes = await res.json();
  const usa = paidRes.pieces.find(p => p.nume === 'Ușă');
  check('plătit: TL/Tl/c apar în răspuns',
        paidRes.paid === true && usa && usa.TL > 0 && Array.isArray(usa.c), JSON.stringify(usa || {}).slice(0, 120));

  res = await req(A, `/corps/${corpId}/export.csv`);
  const csvText = await res.text();
  check('plătit: CSV se descarcă',
        res.status === 200 && csvText.includes('Taiere L') && csvText.split('\n').length > 3,
        `${res.status} ${csvText.slice(0, 60)}`);

  /* --- 7. persistență după relogin --- */
  await req(A, '/logout', { method: 'POST', headers: FORM, body: form({ _csrf: await csrf(A, '/corps') }) });
  token = await csrf(A, '/login');
  res = await req(A, '/login', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: token, email: emailA, password: 'parola1234' })
  });
  check('relogin reușit', res.status === 302, String(res.status));
  res = await req(A, `/api/corps/${corpId}/pieces`);
  const again = await res.json();
  check('starea „plătit” persistă după relogin', again.paid === true);

  /* deconectare, ca /login sa randeze din nou formularul */
  await req(A, '/logout', { method: 'POST', headers: FORM, body: form({ _csrf: await csrf(A, '/corps') }) });
  res = await req(A, '/login', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: await csrf(A, '/login'), email: emailA, password: 'gresita' })
  });
  check('parolă greșită → 401', res.status === 401, String(res.status));

  /* reintrare pentru restul verificarilor */
  await req(A, '/login', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: await csrf(A, '/login'), email: emailA, password: 'parola1234' })
  });

  /* --- 8. izolarea între utilizatori --- */
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
  token = await csrf(B, '/corps');
  res = await req(B, `/corps/${corpId}/pay`, { method: 'POST', headers: FORM, body: form({ _csrf: token }) });
  check('alt user: plată pe corp străin → 404', res.status === 404, String(res.status));
  res = await req(B, `/api/corps/${corpId}`, {
    method: 'DELETE', headers: { 'x-csrf-token': token }
  });
  check('alt user: ștergere corp străin → 404', res.status === 404, String(res.status));

  /* --- 9. admin --- */
  res = await req(B, '/admin');
  check('non-admin pe /admin → 404', res.status === 404, String(res.status));

  /* --- 10. duplicat --- */
  token = await csrf(A, `/corps/${corpId}`);
  res = await req(A, `/corps/${corpId}/duplicate`, { method: 'POST', headers: FORM, body: form({ _csrf: token }) });
  const dupId = Number((res.headers.get('location') || '').split('/').pop());
  res = await req(A, `/api/corps/${dupId}/pieces`);
  const dup = await res.json();
  check('duplicatul este draft (necesită plată separată)', dup.paid === false);

  console.log(failed ? `\n${failed} verificări au eșuat` : '\nToate verificările au trecut.');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
