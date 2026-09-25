'use strict';
/* Fluxul complet: credit → comandă → corpuri → liste de producție.
   Pornește serverul (npm run dev) și rulează: node tests/e2e-comenzi.manual.js */

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
  const email = `com${stamp}@local.test`;

  /* --- cont nou, credit zero --- */
  let t = await csrf(A, '/register');
  await req(A, '/register', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: t, email, password: 'parola1234', password2: 'parola1234' })
  });

  let html = await (await req(A, '/credit')).text();
  check('cont nou: sold 0.00 lei', /0\.00\s*<span>lei/.test(html.replace(/\s+/g, ' ')) || html.includes('>0.00 <span>lei'),
        'nu găsesc soldul');

  /* --- fără credit nu se poate adăuga corp --- */
  t = await csrf(A, '/corps/new');
  let res = await req(A, '/corps', { method: 'POST', headers: FORM, body: form({ _csrf: t, model: 'baza-2usi' }) });
  check('fără credit: trimis la alimentare',
        res.status === 302 && (res.headers.get('location') || '').includes('insuficient=1'),
        res.headers.get('location'));

  /* --- alimentare --- */
  t = await csrf(A, '/credit');
  res = await req(A, '/credit/topup', { method: 'POST', headers: FORM, body: form({ _csrf: t, amount_cents: 10000 }) });
  check('alimentare 100 lei', res.status === 302 && (res.headers.get('location') || '').includes('ok=1'),
        res.headers.get('location'));

  html = await (await req(A, '/credit')).text();
  check('soldul arată 100.00 lei', html.includes('100.00'), 'lipsește soldul');

  res = await req(A, '/credit/topup', { method: 'POST', headers: FORM, body: form({ _csrf: t, amount_cents: 777 }) });
  check('sumă din afara pachetelor → 400', res.status === 400, String(res.status));

  /* --- comandă nouă --- */
  t = await csrf(A, '/orders/new');
  res = await req(A, '/orders', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: t, name: 'Bucătărie Ionescu', brand: 'kronospan', decor: 'K350 Stejar',
                 cant_decor: 'Stejar', pal_mm: 18, cant_gros: 2, cant_subtire: 0.4, adaos_cant: 15, note: '' })
  });
  const orderId = Number((res.headers.get('location') || '').split('/').pop());
  check('comandă creată', res.status === 302 && orderId > 0, res.headers.get('location'));

  html = await (await req(A, `/orders/${orderId}`)).text();
  check('comanda arată materialul ales', html.includes('Kronospan') && html.includes('K350 Stejar'));
  check('comanda arată data', /\d{4}-\d{2}-\d{2}/.test(html));

  /* --- adaug corpuri: creditul scade la fiecare --- */
  t = await csrf(A, `/orders/${orderId}/corp-nou`);
  res = await req(A, `/orders/${orderId}/corps`, {
    method: 'POST', headers: FORM, body: form({ _csrf: t, model: 'baza-2usi' })
  });
  const corp1 = Number((res.headers.get('location') || '').split('/').pop());
  check('corp adăugat în comandă', res.status === 302 && corp1 > 0, res.headers.get('location'));

  html = await (await req(A, '/credit')).text();
  check('creditul a scăzut cu 5 lei', html.includes('95.00'), 'sold greșit');
  check('mișcarea apare în istoric', html.includes('Corp nou'));

  for (const model of ['sus-2usi', 'colt-jos-L', 'baza-3sertare']) {
    t = await csrf(A, `/orders/${orderId}/corp-nou`);
    await req(A, `/orders/${orderId}/corps`, {
      method: 'POST', headers: FORM, body: form({ _csrf: t, model })
    });
  }

  html = await (await req(A, '/credit')).text();
  check('patru corpuri → sold 80.00 lei', html.includes('80.00'), 'sold greșit');

  /* --- corpul preia materialul comenzii --- */
  const piese = await (await req(A, `/api/corps/${corp1}/pieces`)).json();
  check('corpul din comandă e deblocat (are cote de tăiere)', piese.paid === true && piese.pieces[0].TL > 0);

  /* --- pagina comenzii adună totul --- */
  html = await (await req(A, `/orders/${orderId}`)).text();
  check('lista de corpuri are 4 poziții', (html.match(/\/corps\/\d+"/g) || []).length >= 4);
  check('apare necesarul de plăci', /plăci PAL 18/.test(html), 'lipsește necesarul');
  check('apare cantul cu adaos', html.includes('+ 15%'), 'lipsește adaosul la cant');
  check('apare feroneria', html.includes('Balama cupă'), 'lipsește feroneria');
  check('apare lista de piese', html.includes('Piese de debitat'));
  check('piesele de colț sunt marcate CNC', html.includes('chip cnc') || html.includes('>CNC<'));

  /* --- cele patru liste --- */
  for (const [tip, semn] of [['corpuri', 'Necesar de materiale'],
                             ['debitare', 'Cant de comandat'],
                             ['montaj', 'Ordinea de montaj'],
                             ['cnc', 'Planșe']]) {
    const r = await req(A, `/orders/${orderId}/print/${tip}`);
    const h = await r.text();
    check(`lista „${tip}” se deschide`, r.status === 200 && h.includes(semn), `${r.status}`);
  }

  const cnc = await (await req(A, `/orders/${orderId}/print/cnc`)).text();
  check('planșa CNC conține desenul piesei', cnc.includes('cnc-piesa') && cnc.includes('<svg'));
  check('planșa CNC dă cota decupajului', /decupaj \d+ × \d+ mm din colț/.test(cnc));

  const rcsv = await req(A, `/orders/${orderId}/export.csv`);
  const csv = await rcsv.text();
  check('CSV-ul are antet și linii', csv.includes('Taiere L') && csv.split('\n').length > 10,
        `status ${rcsv.status}, ${csv.split('\n').length} linii, început: ${csv.slice(0, 60)}`);

  /* --- izolarea între utilizatori --- */
  t = await csrf(B, '/register');
  await req(B, '/register', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: t, email: `alt${stamp}@local.test`, password: 'parola1234', password2: 'parola1234' })
  });
  for (const cale of [`/orders/${orderId}`, `/orders/${orderId}/print/debitare`, `/orders/${orderId}/export.csv`]) {
    const r = await req(B, cale);
    check(`alt user pe ${cale} → 404`, r.status === 404, String(r.status));
  }
  t = await csrf(B, '/credit');
  res = await req(B, `/orders/${orderId}/corps`, { method: 'POST', headers: FORM, body: form({ _csrf: t, model: 'baza-2usi' }) });
  check('alt user nu poate adăuga în comanda străină', res.status === 404, String(res.status));

  /* --- creditul nu se poate depăși --- */
  const soldB = await (await req(B, '/credit')).text();
  check('userul nou are sold 0', soldB.includes('0.00'));

  console.log(failed ? `\n${failed} verificări au eșuat` : '\nToate verificările au trecut.');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
