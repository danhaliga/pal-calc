'use strict';
/* Construiește o comandă completă de bucătărie în colț, prin fluxul normal al
   aplicației (autentificare, credit, materiale, corpuri).

   node scripts/demo-bucatarie.js [utilizator] [parola]

   Bucătăria: perete A de 3200 mm, perete B de 2400 mm, colț între ele.
   Jos: 720 înălțime, 560 adâncime. Sus: 720 (sau 360 peste hotă), 320 adâncime.
*/

require('dotenv').config({ quiet: true });

const BASE = process.env.APP_URL || 'http://localhost:3000';
const UTILIZATOR = process.argv[2] || 'danh';
const PAROLA = process.argv[3] || 'dan';

let cookie = '';

async function req(cale, opts = {}) {
  const r = await fetch(BASE + cale, {
    redirect: 'manual', ...opts,
    headers: { cookie, ...(opts.headers || {}) }
  });
  const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
  if (sc.length) cookie = sc.map(c => c.split(';')[0]).join('; ');
  return r;
}

async function token(cale) {
  const html = await (await req(cale)).text();
  const m = html.match(/name="_csrf"\s+value="([^"]+)"/);
  if (!m) throw new Error('fără token CSRF pe ' + cale);
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

async function sold() {
  const html = await (await req('/credit')).text();
  const m = html.match(/class="v">([\d.]+)\s*<span>lei/);
  return m ? Number(m[1]) : 0;
}

/* ---------- planul bucătăriei ---------- */

const PERETE_A = 3200;
const PERETE_B = 2400;

const CORPURI = [
  /* --- pe jos: blat la 900 mm, corpuri de 720 pe soclu de 100 --- */
  { grup: 'jos', perete: 'colț', model: 'colt-jos-L', nume: 'Colț jos în L',
    params: { tip: 'colt-L', W: 900, W2: 900, H: 720, D: 560, nUsi: 2, nPol: 0, nSer: 0 } },
  { grup: 'jos', perete: 'A', model: 'baza-chiuveta', nume: 'Corp chiuvetă',
    params: { tip: 'drept', W: 800, H: 720, D: 560, nUsi: 2, nPol: 0, nSer: 0 } },
  { grup: 'jos', perete: 'A', model: 'baza-3sertare', nume: 'Corp cu 3 sertare',
    params: { tip: 'drept', W: 600, H: 720, D: 560, nUsi: 0, nPol: 0, nSer: 3, hFront: 237, hCutie: 180 } },
  { grup: 'jos', perete: 'A', model: 'baza-2usi', nume: 'Corp bază 2 uși (A)',
    params: { tip: 'drept', W: 900, H: 720, D: 560, nUsi: 2, nPol: 1, nSer: 0 } },
  { grup: 'jos', perete: 'B', model: 'baza-nisa', nume: 'Nișă pentru cuptor',
    params: { tip: 'drept', W: 600, H: 720, D: 560, nUsi: 0, nPol: 0, nSer: 0 } },
  { grup: 'jos', perete: 'B', model: 'baza-2usi', nume: 'Corp bază 2 uși (B)',
    params: { tip: 'drept', W: 900, H: 720, D: 560, nUsi: 2, nPol: 1, nSer: 0 } },

  /* --- suspendate --- */
  { grup: 'sus', perete: 'colț', model: 'colt-sus-L', nume: 'Colț suspendat în L',
    params: { tip: 'colt-L', W: 600, W2: 600, H: 720, D: 320, nUsi: 2, nPol: 2, nSer: 0 } },
  { grup: 'sus', perete: 'A', model: 'sus-2usi', nume: 'Suspendat 800 (A)',
    params: { tip: 'drept', W: 800, H: 720, D: 320, nUsi: 2, nPol: 2, nSer: 0 } },
  { grup: 'sus', perete: 'A', model: 'sus-2usi', nume: 'Suspendat 900 (A1)',
    params: { tip: 'drept', W: 900, H: 720, D: 320, nUsi: 2, nPol: 2, nSer: 0 } },
  { grup: 'sus', perete: 'A', model: 'sus-2usi', nume: 'Suspendat 900 (A2)',
    params: { tip: 'drept', W: 900, H: 720, D: 320, nUsi: 2, nPol: 2, nSer: 0 } },
  { grup: 'sus', perete: 'B', model: 'sus-hota', nume: 'Corp peste hotă',
    params: { tip: 'drept', W: 600, H: 360, D: 320, nUsi: 1, nPol: 0, nSer: 0 } },
  { grup: 'sus', perete: 'B', model: 'sus-2usi', nume: 'Suspendat 600 (B1)',
    params: { tip: 'drept', W: 600, H: 720, D: 320, nUsi: 2, nPol: 2, nSer: 0 } },
  { grup: 'sus', perete: 'B', model: 'sus-2usi', nume: 'Suspendat 600 (B2)',
    params: { tip: 'drept', W: 600, H: 720, D: 320, nUsi: 2, nPol: 2, nSer: 0 } }
];

/* ---------- construcția ---------- */

(async () => {
  /* autentificare */
  let t = await token('/login');
  let r = await req('/login', { method: 'POST', headers: FORM,
    body: form({ _csrf: t, email: UTILIZATOR, password: PAROLA }) });
  if (r.status !== 302) throw new Error('autentificare eșuată pentru ' + UTILIZATOR);
  console.log(`autentificat ca ${UTILIZATOR}`);

  /* credit: fiecare corp costă, inclusiv copiile */
  const pret = Number(process.env.PRICE_PER_CORP_CENTS || 500) / 100;
  const necesar = CORPURI.length * pret;
  let disponibil = await sold();
  console.log(`credit: ${disponibil.toFixed(2)} lei, necesar ${necesar.toFixed(2)} lei ` +
              `(${CORPURI.length} corpuri × ${pret.toFixed(2)})`);

  while (disponibil < necesar) {
    t = await token('/credit');
    await req('/credit/topup', { method: 'POST', headers: FORM,
      body: form({ _csrf: t, amount_cents: 10000 }) });
    disponibil = await sold();
    console.log(`  alimentat, credit acum ${disponibil.toFixed(2)} lei`);
  }

  /* comanda, cu materialul carcasei */
  t = await token('/orders/new');
  r = await req('/orders', { method: 'POST', headers: FORM,
    body: form({
      _csrf: t,
      name: 'Bucătărie colț — completă',
      brand: 'Egger', decor_cod: 'W1000 ST9',      /* Alb Premium */
      pal_mm: 18, cant_gros: 2, cant_subtire: 0.4,
      note: `perete A ${PERETE_A} mm, perete B ${PERETE_B} mm, colț în L`,
      formate: ['intreaga', 'jum-lat', 'jum-lung', 'sfert']
    }) });
  const comanda = Number((r.headers.get('location') || '').split('/').pop());
  if (!comanda) throw new Error('comanda nu a fost creată');
  console.log(`comanda #${comanda} deschisă`);

  /* fronturi în alt decor + cutii de sertar din PAL alb de 16 */
  t = await token(`/orders/${comanda}`);
  await req(`/orders/${comanda}/materials`, { method: 'POST', headers: FORM,
    body: form({ _csrf: t, nume: 'Fronturi stejar', rol: 'front', brand: 'Egger',
                 decor_cod: 'H1180 ST37', pal_mm: 18, cant_gros: 2, cant_subtire: 0.4 }) });
  t = await token(`/orders/${comanda}`);
  await req(`/orders/${comanda}/materials`, { method: 'POST', headers: FORM,
    body: form({ _csrf: t, nume: 'Cutii sertar', rol: 'sertar', brand: 'Egger',
                 decor_cod: 'W1000 ST9', pal_mm: 16, cant_gros: 0.8, cant_subtire: 0.4 }) });
  console.log('materiale: carcasă albă 18, fronturi stejar 18, cutii sertar 16');

  const htmlComanda = await (await req(`/orders/${comanda}`)).text();
  const idMateriale = [...htmlComanda.matchAll(/materials\/(\d+)"/g)].map(m => Number(m[1]));
  const matCarcasa = idMateriale[0], matFronturi = idMateriale[1];

  /* corpurile */
  let lungimeA = 0, lungimeB = 0, lungimeAsus = 0, lungimeBsus = 0;

  for (const c of CORPURI) {
    t = await token(`/orders/${comanda}/corp-nou`);
    r = await req(`/orders/${comanda}/corps`, { method: 'POST', headers: FORM,
      body: form({ _csrf: t, model: c.model }) });
    const corpId = Number((r.headers.get('location') || '').split('/').pop());
    if (!corpId) throw new Error('corpul „' + c.nume + '” nu a fost creat');

    /* cotele exacte */
    r = await req(`/api/corps/${corpId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-csrf-token': t },
      body: JSON.stringify({ name: c.nume, params: c.params })
    });
    if (r.status !== 200) {
      console.log(`  ! ${c.nume}: parametrii nu au trecut validarea (${r.status})`);
    }

    /* fronturile din stejar, unde există uși sau sertare */
    if (matFronturi && ((+c.params.nUsi > 0) || (+c.params.nSer > 0))) {
      t = await token(`/corps/${corpId}`);
      await req(`/corps/${corpId}/material`, { method: 'POST', headers: FORM,
        body: form({ _csrf: t, mat_corp_id: matCarcasa, mat_front_id: matFronturi }) });
    }

    const latime = c.params.tip === 'colt-L' ? c.params.W : c.params.W;
    if (c.grup === 'jos') { if (c.perete === 'A' || c.perete === 'colț') lungimeA += latime;
                            if (c.perete === 'B') lungimeB += latime;
                            if (c.perete === 'colț') lungimeB += c.params.W2; }
    else { if (c.perete === 'A' || c.perete === 'colț') lungimeAsus += latime;
           if (c.perete === 'B') lungimeBsus += latime;
           if (c.perete === 'colț') lungimeBsus += c.params.W2; }

    console.log(`  + ${c.nume} (${c.params.W}${c.params.tip === 'colt-L' ? '×' + c.params.W2 : ''} mm)`);
  }

  console.log(`\nocupare pereți — jos: A ${lungimeA}/${PERETE_A} mm, B ${lungimeB}/${PERETE_B} mm`);
  console.log(`              sus: A ${lungimeAsus}/${PERETE_A} mm, B ${lungimeBsus}/${PERETE_B} mm`);
  console.log(`credit rămas: ${(await sold()).toFixed(2)} lei`);
  console.log(`\ncomanda: ${BASE}/orders/${comanda}`);
})().catch(e => { console.error('\nEROARE:', e.message); process.exit(1); });
