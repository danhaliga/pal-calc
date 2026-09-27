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

/* valorile de tip listă (ex. formate) se trimit ca intrări repetate */
function form(o) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) {
    if (Array.isArray(v)) v.forEach(x => p.append(k, x));
    else p.append(k, v);
  }
  return p.toString();
}
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
    body: form({ _csrf: t, name: 'Bucătărie Ionescu', brand: 'Kronospan', decor_cod: 'K023 SU',
                 pal_mm: 18, cant_gros: 2, cant_subtire: 0.4, note: '',
                 formate: ['intreaga', 'jum-lat', 'jum-lung', 'sfert'] })
  });
  const orderId = Number((res.headers.get('location') || '').split('/').pop());
  check('comandă creată', res.status === 302 && orderId > 0, res.headers.get('location'));

  /* pagina de listă trebuie să se deschidă în orice stare a comenzii */
  let rLista = await req(A, '/orders');
  const htmlLista = await rLista.text();
  check('lista de comenzi se deschide', rLista.status === 200 && htmlLista.includes('Bucătărie Ionescu'),
        String(rLista.status));

  html = await (await req(A, `/orders/${orderId}`)).text();
  check('comanda arată materialul ales din catalog',
        html.includes('Kronospan') && html.includes('K023 SU') && html.includes('Venato'),
        'lipsește decorul');
  check('comanda arată data', /\d{4}-\d{2}-\d{2}/.test(html));
  check('formatele de coală sunt salvate', html.includes('jumătate 1400×2070'), 'lipsesc formatele');

  /* --- al doilea material, în alt decor, pentru fronturi --- */
  t = await csrf(A, `/orders/${orderId}`);
  res = await req(A, `/orders/${orderId}/materials`, {
    method: 'POST', headers: FORM,
    body: form({ _csrf: t, nume: 'Fronturi stejar', rol: 'front', brand: 'Egger',
                 decor_cod: 'H1180 ST37', pal_mm: 18, cant_gros: 2, cant_subtire: 0.4 })
  });
  check('material nou adăugat', res.status === 302, String(res.status));
  html = await (await req(A, `/orders/${orderId}`)).text();
  check('comanda are două materiale',
        html.includes('Fronturi stejar') && html.includes('Stejar Halifax'), 'lipsește materialul');

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
  check('apare necesarul de coli', html.includes('coli întregi') && html.includes('Echivalent'),
        'lipsește necesarul');
  check('clientul NU vede adaosul la cant', !html.includes('Cu adaos'), 'adaosul nu trebuie arătat aici');
  check('apare cantul în metri liniari', html.includes('Metri liniari'), 'lipsește cantul');
  check('apare feroneria', html.includes('Blum CLIP top'), 'lipsește feroneria');
  check('feroneria se poate alege pe comandă',
        html.includes('name="asamblare"') && html.includes('Cum se asamblează carcasa?'),
        'lipsesc întrebările de feronerie');
  check('sistemul ales apare în lista de feronerie',
        html.includes('Excentric Minifix 15'), 'lipsesc articolele sistemului ales');
  check('apare lista de piese', html.includes('Piese de debitat'));
  check('piesele de colț sunt marcate CNC', html.includes('chip cnc') || html.includes('>CNC<'));

  /* --- listele de producție --- */
  for (const [tip, semn] of [['corpuri', 'Necesar de plăci'],
                             ['debitare', 'Cant de comandat'],
                             ['incadrare', 'Încadrarea pieselor în coli'],
                             ['montaj', 'Ordinea de montaj'],
                             ['cnc', 'Planșe']]) {
    const r = await req(A, `/orders/${orderId}/print/${tip}`);
    const h = await r.text();
    check(`lista „${tip}” se deschide`, r.status === 200 && h.includes(semn), `${r.status}`);
  }

  const cnc = await (await req(A, `/orders/${orderId}/print/cnc`)).text();
  check('planșa CNC conține desenul piesei', cnc.includes('cnc-piesa') && cnc.includes('<svg'));
  check('planșa CNC dă cota decupajului', /decupaj \d+ × \d+ mm din colț/.test(cnc));

  /* corp atipic: contur din laturi și unghiuri, toate piesele la CNC */
  t = await csrf(A, `/orders/${orderId}/corp-nou`);
  res = await req(A, `/orders/${orderId}/corps`, {
    method: 'POST', headers: FORM, body: form({ _csrf: t, model: 'baza-2usi' })
  });
  const corpAtipic = Number((res.headers.get('location') || '').split('/').pop());
  res = await req(A, `/api/corps/${corpAtipic}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-csrf-token': t },
    body: JSON.stringify({
      name: 'Corp sub scară',
      params: {
        tip: 'atipic', D: 560, nUsi: 1, nPol: 0,
        contur: [{ lung: 900, unghi: 90 }, { lung: 400, unghi: 114 },
                 { lung: 985, unghi: 66 }, { lung: 800, unghi: 90 }]
      }
    })
  });
  const salvat = await res.json();
  check('corpul atipic se salvează cu contur cu tot',
        res.status === 200 && salvat.params.contur && salvat.params.contur.length === 4,
        JSON.stringify(salvat).slice(0, 140));

  const pieseAtipic = await (await req(A, `/api/corps/${corpAtipic}/pieces`)).json();
  check('corpul atipic dă un panou pe fiecare latură',
        pieseAtipic.pieces.filter(p => /^Panou/.test(p.nume)).length === 4,
        pieseAtipic.pieces.map(p => p.nume).join(', '));

  const htmlCnc = await (await req(A, `/orders/${orderId}/print/cnc`)).text();
  check('laturile atipice apar ca tăieri la unghi', htmlCnc.includes('Tăiere la unghi'));
  check('spatele atipic apare ca decupare după contur', htmlCnc.includes('Decupare după contur'));

  const inc = await (await req(A, `/orders/${orderId}/print/incadrare`)).text();
  check('încadrarea desenează colile', inc.includes('coala-fond') && inc.includes('coala-piesa'));
  check('încadrarea spune câte coli se cumpără', /De cumpărat/.test(inc));
  check('încadrarea folosește și bucăți de coală',
        /jumătate|sfert/.test(inc), 'nu apare nicio bucată de coală');

  const rcsv = await req(A, `/orders/${orderId}/export.csv`);
  const csv = await rcsv.text();
  check('CSV-ul are antet și linii', csv.includes('Tăiere L') && csv.split('\n').length > 10,
        `status ${rcsv.status}, ${csv.split('\n').length} linii, început: ${csv.slice(0, 60)}`);

  /* Antetul vine din catalog, deci se schimbă cu limba. Înainte era scris de
     mână în română și rămânea românesc în toate cele 30 de limbi. */
  const rcsvDe = await req(A, `/orders/${orderId}/export.csv?lang=de`);
  const csvDe = await rcsvDe.text();
  check('antetul CSV se traduce cu limba',
        csvDe.includes('Zuschnitt L') && !csvDe.includes('Tăiere L'),
        `început: ${csvDe.slice(0, 70)}`);

  /* --- duplicarea costă la fel ca un corp nou și rămâne în comandă --- */
  const soldInainteDeCopie = await (await req(A, '/credit')).text();
  const potrivire = soldInainteDeCopie.match(/class="v">([\d.]+)\s*<span>lei/);
  const inainteCopie = potrivire ? Number(potrivire[1]) : null;

  t = await csrf(A, `/orders/${orderId}`);
  res = await req(A, `/corps/${corp1}/duplicate`, { method: 'POST', headers: FORM, body: form({ _csrf: t }) });
  const copieId = Number((res.headers.get('location') || '').split('/').pop());
  check('duplicarea creează un corp nou', res.status === 302 && copieId > 0, res.headers.get('location'));

  const dupaCopie = (await (await req(A, '/credit')).text()).match(/class="v">([\d.]+)\s*<span>lei/);
  check('copia scade creditul ca un corp nou',
        inainteCopie !== null && dupaCopie && Math.abs((inainteCopie - Number(dupaCopie[1])) - 5) < 0.001,
        `${inainteCopie} → ${dupaCopie && dupaCopie[1]}`);

  html = await (await req(A, `/orders/${orderId}`)).text();
  check('copia rămâne în aceeași comandă', html.includes('/corps/' + copieId));

  const pieseCopie = await (await req(A, `/api/corps/${copieId}/pieces`)).json();
  check('copia e deja plătită, nu draft', pieseCopie.paid === true);

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
