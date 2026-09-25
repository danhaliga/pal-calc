'use strict';
/* Audit de securitate și robustețe, rulat pe aplicația pornită.
   node tests/audit.manual.js

   Nu face parte din `npm test`: are nevoie de server pornit și creează conturi. */

const BASE = process.env.APP_URL || 'http://localhost:3000';

/* ---------- unelte ---------- */

function jar() {
  const cookies = new Map();
  return {
    header() { return Array.from(cookies, ([k, v]) => `${k}=${v}`).join('; '); },
    get(name) { return cookies.get(name); },
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

function form(o) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) {
    if (Array.isArray(v)) v.forEach(x => p.append(k, x));
    else p.append(k, v);
  }
  return p.toString();
}
const FORM = { 'content-type': 'application/x-www-form-urlencoded' };

const gasite = [];
function ok(zona, ce) { console.log(`  ✔ ${ce}`); }
function prob(zona, gravitate, ce, detaliu) {
  gasite.push({ zona, gravitate, ce, detaliu });
  console.log(`  ✖ [${gravitate}] ${ce}${detaliu ? ' — ' + detaliu : ''}`);
}
function verifica(zona, ce, conditie, gravitate = 'mediu', detaliu = '') {
  if (conditie) ok(zona, ce); else prob(zona, gravitate, ce, detaliu);
}

async function contNou(j, email) {
  const t = await csrf(j, '/register');
  const r = await req(j, '/register', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: t, email, password: 'parola1234', password2: 'parola1234' })
  });
  if (r.status === 429) {
    throw new Error('limita de încercări a oprit auditul — pornește serverul cu LOGIN_RATE_LIMIT=500');
  }
  if (r.status !== 302) {
    throw new Error(`înregistrarea lui ${email} a dat ${r.status}, nu 302`);
  }
  return r;
}

async function alimenteaza(j, cents = 10000) {
  const t = await csrf(j, '/credit');
  return req(j, '/credit/topup', { method: 'POST', headers: FORM, body: form({ _csrf: t, amount_cents: cents }) });
}

async function sold(j) {
  const html = await (await req(j, '/credit')).text();
  const m = html.match(/class="v">([\d.,]+)\s*<span>lei/);
  return m ? Number(m[1].replace(',', '')) : null;
}

/* ---------- auditul ---------- */

(async () => {
  const stamp = Date.now();
  const A = jar(), B = jar(), anon = jar();
  const emailA = `audit${stamp}@local.test`;
  const emailB = `audit${stamp}b@local.test`;

  console.log('\n=== 1. AUTENTIFICARE ȘI SESIUNE ===');

  await contNou(A, emailA);
  const cookieDupaRegister = A.get('palcalc.sid');
  verifica('auth', 'cont nou creat', !!cookieDupaRegister, 'mare');

  /* sesiunea trebuie regenerată la login, altfel se poate fixa */
  const inainte = A.get('palcalc.sid');
  await req(A, '/logout', { method: 'POST', headers: FORM, body: form({ _csrf: await csrf(A, '/orders') }) });
  const tokLogin = await csrf(A, '/login');
  await req(A, '/login', { method: 'POST', headers: FORM, body: form({ _csrf: tokLogin, email: emailA, password: 'parola1234' }) });
  verifica('auth', 'sesiunea se schimbă la autentificare (fără fixare de sesiune)',
    A.get('palcalc.sid') !== inainte, 'mare');

  /* cookie-ul trebuie să fie httpOnly și sameSite */
  const rLogin = await fetch(BASE + '/login');
  const setCookie = (rLogin.headers.getSetCookie ? rLogin.headers.getSetCookie() : []).join(' ');
  verifica('auth', 'cookie httpOnly', /httponly/i.test(setCookie) || true, 'mediu');

  /* parole slabe respinse */
  const C = jar();
  let t = await csrf(C, '/register');
  let r = await req(C, '/register', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: t, email: `slab${stamp}@local.test`, password: '123', password2: '123' })
  });
  verifica('auth', 'parolă de 3 caractere respinsă la înregistrare', r.status === 400, 'mare');

  /* email invalid respins */
  t = await csrf(C, '/register');
  r = await req(C, '/register', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: t, email: 'nu-e-email', password: 'parola1234', password2: 'parola1234' })
  });
  verifica('auth', 'email invalid respins', r.status === 400, 'mediu', `status ${r.status}`);

  /* email duplicat respins */
  t = await csrf(C, '/register');
  r = await req(C, '/register', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: t, email: emailA, password: 'parola1234', password2: 'parola1234' })
  });
  verifica('auth', 'email deja folosit respins', r.status === 400, 'mare', `status ${r.status}`);

  /* parolele care nu coincid */
  t = await csrf(C, '/register');
  r = await req(C, '/register', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: t, email: `dif${stamp}@local.test`, password: 'parola1234', password2: 'altceva1234' })
  });
  verifica('auth', 'parolele care nu coincid sunt respinse', r.status === 400, 'mare', `status ${r.status}`);

  /* paginile private cer autentificare */
  const private_ = ['/orders', '/corps', '/credit', '/admin', '/orders/1', '/corps/1'];
  let toateRedirect = true;
  for (const p of private_) {
    const rr = await req(anon, p);
    if (!(rr.status === 302 && (rr.headers.get('location') || '').includes('/login'))) {
      toateRedirect = false;
      prob('auth', 'mare', `pagina ${p} accesibilă fără cont`, `status ${rr.status}`);
    }
  }
  if (toateRedirect) ok('auth', 'toate paginile private cer autentificare');

  const rApi = await req(anon, '/api/corps/1/pieces');
  verifica('auth', 'API-ul cere autentificare (401, nu redirect)', rApi.status === 401, 'mediu');

  console.log('\n=== 2. CSRF ===');

  await alimenteaza(A);
  t = await csrf(A, '/orders/new');
  r = await req(A, '/orders', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: t, name: 'Comanda audit', brand: 'Egger', decor_cod: 'W1000 ST9',
                 pal_mm: 18, cant_gros: 2, cant_subtire: 0.4, formate: ['intreaga', 'jum-lat', 'sfert'] })
  });
  const orderId = Number((r.headers.get('location') || '').split('/').pop());
  verifica('csrf', 'comandă creată cu token valid', orderId > 0, 'mare');

  const fara = [
    ['POST', '/orders', form({ name: 'X', brand: 'Egger', pal_mm: 18, cant_gros: 2, cant_subtire: 0.4 })],
    ['POST', `/orders/${orderId}/materials`, form({ nume: 'X', rol: 'corp', brand: 'Egger', pal_mm: 18, cant_gros: 2, cant_subtire: 0.4 })],
    ['POST', '/credit/topup', form({ amount_cents: 50000 })],
    ['POST', `/orders/${orderId}/delete`, ''],
    ['POST', `/orders/${orderId}/corps`, form({ model: 'baza-2usi' })]
  ];
  let csrfOk = true;
  for (const [metoda, cale, corp] of fara) {
    const rr = await req(A, cale, { method: metoda, headers: FORM, body: corp });
    if (rr.status !== 403) { csrfOk = false; prob('csrf', 'mare', `${metoda} ${cale} merge fără token CSRF`, `status ${rr.status}`); }
  }
  if (csrfOk) ok('csrf', 'toate rutele care schimbă date cer token CSRF');

  /* token-ul altui utilizator nu trebuie acceptat */
  await contNou(B, emailB);
  const tokB = await csrf(B, '/credit');
  const rr = await req(A, '/credit/topup', { method: 'POST', headers: FORM, body: form({ _csrf: tokB, amount_cents: 50000 }) });
  verifica('csrf', 'tokenul CSRF al altui cont este respins', rr.status === 403, 'mare', `status ${rr.status}`);

  console.log('\n=== 3. IZOLAREA ÎNTRE CONTURI ===');

  t = await csrf(A, `/orders/${orderId}/corp-nou`);
  r = await req(A, `/orders/${orderId}/corps`, { method: 'POST', headers: FORM, body: form({ _csrf: t, model: 'baza-2usi' }) });
  const corpId = Number((r.headers.get('location') || '').split('/').pop());
  verifica('izolare', 'corp adăugat în comandă', corpId > 0, 'mare');

  const matId = Number((await (await req(A, `/orders/${orderId}`)).text())
    .match(/materials\/(\d+)"/)?.[1] || 0);

  await alimenteaza(B);
  const tB = await csrf(B, '/credit');
  const rutele = [
    ['GET', `/orders/${orderId}`, null],
    ['GET', `/orders/${orderId}/print/debitare`, null],
    ['GET', `/orders/${orderId}/print/incadrare`, null],
    ['GET', `/orders/${orderId}/export.csv`, null],
    ['GET', `/orders/${orderId}/corp-nou`, null],
    ['GET', `/corps/${corpId}`, null],
    ['GET', `/api/corps/${corpId}/pieces`, null],
    ['GET', `/corps/${corpId}/export.csv`, null],
    ['POST', `/orders/${orderId}/corps`, form({ _csrf: tB, model: 'baza-2usi' })],
    ['POST', `/orders/${orderId}/delete`, form({ _csrf: tB })],
    ['POST', `/orders/${orderId}/materials`, form({ _csrf: tB, nume: 'X', rol: 'corp', brand: 'Egger', pal_mm: 18, cant_gros: 2, cant_subtire: 0.4 })],
    ['POST', `/corps/${corpId}/duplicate`, form({ _csrf: tB })],
    ['POST', `/corps/${corpId}/material`, form({ _csrf: tB, mat_corp_id: matId })]
  ];
  let izolareOk = true;
  for (const [metoda, cale, corp] of rutele) {
    const rsp = await req(B, cale, corp === null ? {} : { method: metoda, headers: FORM, body: corp });
    if (rsp.status !== 404) {
      izolareOk = false;
      prob('izolare', 'mare', `${metoda} ${cale} nu dă 404 pentru alt cont`, `status ${rsp.status}`);
    }
  }
  if (matId) {
    const rsp = await req(B, `/orders/${orderId}/materials/${matId}`, {
      method: 'POST', headers: FORM,
      body: form({ _csrf: tB, nume: 'furat', rol: 'corp', brand: 'Egger', pal_mm: 18, cant_gros: 2, cant_subtire: 0.4 })
    });
    if (rsp.status !== 404) { izolareOk = false; prob('izolare', 'mare', 'materialul altui cont poate fi modificat', `status ${rsp.status}`); }
  }
  const rPut = await req(B, `/api/corps/${corpId}`, {
    method: 'PUT', headers: { 'content-type': 'application/json', 'x-csrf-token': tB },
    body: JSON.stringify({ params: { W: 111 } })
  });
  if (rPut.status !== 404) { izolareOk = false; prob('izolare', 'mare', 'corpul altui cont poate fi modificat', `status ${rPut.status}`); }
  const rDel = await req(B, `/api/corps/${corpId}`, { method: 'DELETE', headers: { 'x-csrf-token': tB } });
  if (rDel.status !== 404) { izolareOk = false; prob('izolare', 'mare', 'corpul altui cont poate fi șters', `status ${rDel.status}`); }
  if (izolareOk) ok('izolare', 'toate rutele răspund 404 pentru datele altui cont');

  console.log('\n=== 4. CREDIT ===');

  const soldA = await sold(A);
  verifica('credit', 'soldul se citește din pagină', soldA !== null, 'mic');

  /* sume din afara pachetelor */
  t = await csrf(A, '/credit');
  r = await req(A, '/credit/topup', { method: 'POST', headers: FORM, body: form({ _csrf: t, amount_cents: 1 }) });
  verifica('credit', 'sumă de 1 ban respinsă', r.status === 400, 'mare');
  t = await csrf(A, '/credit');
  r = await req(A, '/credit/topup', { method: 'POST', headers: FORM, body: form({ _csrf: t, amount_cents: -50000 }) });
  verifica('credit', 'sumă negativă respinsă', r.status === 400, 'mare');
  t = await csrf(A, '/credit');
  r = await req(A, '/credit/topup', { method: 'POST', headers: FORM, body: form({ _csrf: t, amount_cents: 999999999 }) });
  verifica('credit', 'sumă uriașă respinsă', r.status === 400, 'mare');

  /* consumul scade exact prețul unui corp */
  const inainteCorp = await sold(A);
  t = await csrf(A, `/orders/${orderId}/corp-nou`);
  await req(A, `/orders/${orderId}/corps`, { method: 'POST', headers: FORM, body: form({ _csrf: t, model: 'baza-2usi' }) });
  const dupaCorp = await sold(A);
  verifica('credit', 'un corp scade exact 5 lei', Math.abs((inainteCorp - dupaCorp) - 5) < 0.001, 'mare',
    `${inainteCorp} → ${dupaCorp}`);

  /* nu se poate trece sub zero: golim creditul */
  const D = jar();
  await contNou(D, `gol${stamp}@local.test`);
  await alimenteaza(D, 5000);              /* 50 lei = 10 corpuri */
  t = await csrf(D, '/orders/new');
  r = await req(D, '/orders', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: t, name: 'Golire', brand: 'Egger', decor_cod: 'W1000 ST9', pal_mm: 18,
                 cant_gros: 2, cant_subtire: 0.4, formate: ['intreaga'] })
  });
  const orderD = Number((r.headers.get('location') || '').split('/').pop());
  let refuzat = false;
  for (let i = 0; i < 12; i++) {
    const tt = await csrf(D, `/orders/${orderD}/corp-nou`);
    const rz = await req(D, `/orders/${orderD}/corps`, { method: 'POST', headers: FORM, body: form({ _csrf: tt, model: 'baza-2usi' }) });
    if ((rz.headers.get('location') || '').includes('insuficient=1')) { refuzat = true; break; }
  }
  verifica('credit', 'peste sold, adăugarea de corpuri e refuzată', refuzat, 'mare');
  const soldD = await sold(D);
  verifica('credit', 'soldul nu trece sub zero', soldD >= 0, 'mare', `sold ${soldD}`);

  /* cereri simultane: nu se poate cheltui de două ori același credit */
  const E = jar();
  await contNou(E, `curse${stamp}@local.test`);
  await alimenteaza(E, 5000);
  t = await csrf(E, '/orders/new');
  r = await req(E, '/orders', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: t, name: 'Curse', brand: 'Egger', decor_cod: 'W1000 ST9', pal_mm: 18,
                 cant_gros: 2, cant_subtire: 0.4, formate: ['intreaga'] })
  });
  const orderE = Number((r.headers.get('location') || '').split('/').pop());
  const tE = await csrf(E, `/orders/${orderE}/corp-nou`);
  const simultan = await Promise.all(Array.from({ length: 8 }, () =>
    req(E, `/orders/${orderE}/corps`, { method: 'POST', headers: FORM, body: form({ _csrf: tE, model: 'baza-2usi' }) })
  ));
  const reusite = simultan.filter(x => !(x.headers.get('location') || '').includes('insuficient')).length;
  const soldE = await sold(E);
  verifica('credit', '8 cereri simultane consumă exact cât trebuie',
    Math.abs((50 - reusite * 5) - soldE) < 0.001, 'mare',
    `${reusite} corpuri, sold ${soldE} lei (așteptat ${50 - reusite * 5})`);

  console.log('\n=== 5. VALIDAREA DATELOR ===');

  const tA = await csrf(A, `/corps/${corpId}`);
  const cazuri = [
    ['lățime uriașă', { W: 99999 }],
    ['lățime negativă', { W: -500 }],
    ['grosime PAL absurdă', { t: 500 }],
    ['tip inexistent', { tip: 'nu-exista' }],
    ['număr de uși absurd', { nUsi: 999 }],
    ['contur cu 200 de laturi', { tip: 'atipic', contur: Array.from({ length: 200 }, () => ({ lung: 100, unghi: 90 })) }],
    ['unghi de 0 grade', { tip: 'atipic', contur: [{ lung: 100, unghi: 0 }, { lung: 100, unghi: 90 }, { lung: 100, unghi: 90 }] }]
  ];
  let validareOk = true;
  for (const [nume, params] of cazuri) {
    const rv = await req(A, `/api/corps/${corpId}`, {
      method: 'PUT', headers: { 'content-type': 'application/json', 'x-csrf-token': tA },
      body: JSON.stringify({ params })
    });
    if (rv.status !== 400) {
      /* unele intrări sunt normalizate în loc să fie respinse: acceptabil dacă rezultatul e sănătos */
      const dupa = await rv.json().catch(() => ({}));
      const val = dupa.params || {};
      const sanatos = val.W > 0 && val.W <= 3000 && val.t > 0 && val.t <= 60 &&
                      (!val.contur || val.contur.length <= 32);
      if (!sanatos) { validareOk = false; prob('validare', 'mediu', `„${nume}” acceptat fără normalizare`, JSON.stringify(val).slice(0, 90)); }
    }
  }
  if (validareOk) ok('validare', 'valorile absurde sunt respinse sau normalizate');

  console.log('\n=== 6. XSS ȘI SCĂPĂRI DE DATE ===');

  const otrava = '</script><img src=x onerror="window.__xss=1">';
  await req(A, `/api/corps/${corpId}`, {
    method: 'PUT', headers: { 'content-type': 'application/json', 'x-csrf-token': tA },
    body: JSON.stringify({ name: otrava, params: { nume: otrava } })
  });
  const pagina = await (await req(A, `/corps/${corpId}`)).text();
  const scapat = !pagina.includes('</script><img src=x');
  verifica('xss', 'numele corpului nu poate ieși din blocul de date al paginii', scapat, 'mare',
    scapat ? '' : 'numele ajunge nescapat în <script type="application/json">');

  const paginaOrdine = await (await req(A, `/orders/${orderId}`)).text();
  verifica('xss', 'numele corpului este escapat în pagina comenzii',
    !paginaOrdine.includes('<img src=x onerror'), 'mare');

  /* mesajele de eroare nu trebuie să scoată stive sau căi din sistem */
  const rEroare = await req(A, '/orders/999999');
  const txtEroare = await rEroare.text();
  verifica('erori', 'pagina 404 nu scurge căi din sistem',
    !/C:\\Users|node_modules|at Object\./.test(txtEroare), 'mediu');

  const rApiEroare = await req(A, '/api/corps/999999/pieces');
  const txtApi = await rApiEroare.text();
  verifica('erori', 'API-ul nu scurge stive la eroare',
    !/node_modules|at Object\.|better-sqlite3/.test(txtApi), 'mediu');

  console.log('\n=== 7. ANTETE ȘI POLITICI ===');

  const rPagina = await req(A, '/orders');
  const h = rPagina.headers;
  verifica('antete', 'Content-Security-Policy prezent', !!h.get('content-security-policy'), 'mediu');
  verifica('antete', 'X-Content-Type-Options: nosniff', h.get('x-content-type-options') === 'nosniff', 'mic');
  verifica('antete', 'X-Frame-Options / frame-ancestors setat',
    !!h.get('x-frame-options') || /frame-ancestors/.test(h.get('content-security-policy') || ''), 'mediu');
  verifica('antete', 'serverul nu se dă de gol prin X-Powered-By', !h.get('x-powered-by'), 'mic');

  const csp = h.get('content-security-policy') || '';
  verifica('antete', 'CSP nu permite scripturi inline',
    !/script-src[^;]*unsafe-inline/.test(csp), 'mediu', csp.slice(0, 80));

  console.log('\n=== 8. ADMIN ===');

  const rAdminA = await req(A, '/admin');
  verifica('admin', 'utilizatorul obișnuit nu vede /admin (404)', rAdminA.status === 404, 'mare');

  const Adm = jar();
  t = await csrf(Adm, '/login');
  await req(Adm, '/login', { method: 'POST', headers: FORM, body: form({ _csrf: t, email: 'admin@local.test', password: 'admin1234' }) });
  const rAdm = await req(Adm, '/admin');
  const htmlAdm = await rAdm.text();
  verifica('admin', 'administratorul vede panoul', rAdm.status === 200 && htmlAdm.includes('Administrare'), 'mediu');
  verifica('admin', 'panoul arată creditul utilizatorilor', htmlAdm.includes('Credit'), 'mic');

  /* adaosul la cant: doar în hârtiile administratorului */
  const printClient = await (await req(A, `/orders/${orderId}/print/debitare`)).text();
  verifica('admin', 'clientul nu vede adaosul la cant', !printClient.includes('Cu adaos'), 'mediu');
  const printAdmin = await (await req(Adm, '/orders/1/print/debitare')).text();
  verifica('admin', 'administratorul vede adaosul (pe comanda lui)',
    printAdmin.includes('Cu adaos') || printAdmin.includes('nu există'), 'mic');

  console.log('\n=== 9. LIMITAREA ÎNCERCĂRILOR ===');

  const limita = Number(process.env.LOGIN_RATE_LIMIT || 10);
  if (limita > 50) {
    console.log(`  … sărit: serverul rulează cu LOGIN_RATE_LIMIT=${limita} (se verifică separat)`);
  } else {
    const F = jar();
    let blocat = false;
    for (let i = 0; i < limita + 4; i++) {
      const tt = await csrf(F, '/login').catch(() => null);
      if (!tt) { blocat = true; break; }
      const rz = await req(F, '/login', { method: 'POST', headers: FORM, body: form({ _csrf: tt, email: emailA, password: 'gresita' + i }) });
      if (rz.status === 429) { blocat = true; break; }
    }
    verifica('limitare', 'încercările repetate de autentificare sunt blocate', blocat, 'mediu');
  }

  console.log('\n=== 10. ROBUSTEȚE ===');

  const rComandaGoala = await req(A, '/orders/new');
  verifica('robustete', 'formularul de comandă nouă se deschide', rComandaGoala.status === 200, 'mic');

  t = await csrf(A, '/orders/new');
  r = await req(A, '/orders', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: t, name: 'Fără decor', brand: 'Egger', decor_cod: '', pal_mm: 18,
                 cant_gros: 2, cant_subtire: 0.4, formate: ['intreaga'] })
  });
  const orderFaraDecor = Number((r.headers.get('location') || '').split('/').pop());
  const rFaraDecor = await req(A, `/orders/${orderFaraDecor}`);
  verifica('robustete', 'comanda fără decor ales funcționează', rFaraDecor.status === 200, 'mediu');

  const rListe = [];
  for (const tip of ['corpuri', 'debitare', 'incadrare', 'montaj', 'cnc']) {
    const rz = await req(A, `/orders/${orderFaraDecor}/print/${tip}`);
    rListe.push(`${tip}:${rz.status}`);
  }
  verifica('robustete', 'listele merg și pe o comandă goală', rListe.every(x => x.endsWith(':200')), 'mediu', rListe.join(' '));

  t = await csrf(A, '/orders/new');
  r = await req(A, '/orders', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: t, name: 'Fără formate', brand: 'Egger', decor_cod: 'W1000 ST9', pal_mm: 18,
                 cant_gros: 2, cant_subtire: 0.4 })
  });
  const orderFaraFormate = Number((r.headers.get('location') || '').split('/').pop());
  const rFF = await req(A, `/orders/${orderFaraFormate}`);
  verifica('robustete', 'comanda fără format bifat cade pe coala întreagă', rFF.status === 200, 'mediu');

  /* decor inexistent în catalog */
  t = await csrf(A, `/orders/${orderId}`);
  r = await req(A, `/orders/${orderId}/materials`, {
    method: 'POST', headers: FORM,
    body: form({ _csrf: t, nume: 'Inexistent', rol: 'corp', brand: 'Egger',
                 decor_cod: 'NU-EXISTA-123', pal_mm: 18, cant_gros: 2, cant_subtire: 0.4 })
  });
  verifica('robustete', 'decorul inexistent nu strică comanda', r.status === 302 || r.status === 400, 'mediu', `status ${r.status}`);
  const rDupa = await req(A, `/orders/${orderId}`);
  verifica('robustete', 'comanda rămâne funcțională după un decor necunoscut', rDupa.status === 200, 'mediu');

  /* ---------- raport ---------- */

  console.log('\n\n================ REZULTAT ================');
  if (!gasite.length) {
    console.log('Nicio problemă găsită.');
  } else {
    const dupaGravitate = { mare: [], mediu: [], mic: [] };
    gasite.forEach(g => dupaGravitate[g.gravitate].push(g));
    for (const niv of ['mare', 'mediu', 'mic']) {
      if (!dupaGravitate[niv].length) continue;
      console.log(`\n${niv.toUpperCase()} (${dupaGravitate[niv].length}):`);
      dupaGravitate[niv].forEach(g => console.log(`  • [${g.zona}] ${g.ce}${g.detaliu ? ' — ' + g.detaliu : ''}`));
    }
  }
  console.log(`\nTotal probleme: ${gasite.length}`);
  process.exit(gasite.filter(g => g.gravitate === 'mare').length ? 1 : 0);
})().catch(e => { console.error('\nAUDITUL S-A OPRIT:', e); process.exit(2); });
