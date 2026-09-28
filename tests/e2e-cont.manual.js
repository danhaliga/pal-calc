'use strict';
/* Verificare end-to-end a paginii de cont.
   Pornește serverul (npm run dev) și rulează: node tests/e2e-cont.manual.js

   Ce se urmărește: că țara propune unitatea, că alegerea omului bate
   propunerea, că o adresă de site scrisă pe scurt se întregește iar una
   periculoasă e refuzată, și că un formular măsluit nu bagă nimic strâmb
   în tabel. */

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

/* Pagina, FĂRĂ blocurile de date pentru scripturi.
   Pagina își cară catalogul de traduceri într-un <script type="application/json">,
   adică toate textele ei, și pe cele care nu se afișează. Un test care caută
   un text în tot HTML-ul l-ar găsi acolo și ar trece degeaba — exact ce s-a
   întâmplat cu verificarea propunerii de țară. Se taie înainte de citit. */
async function pagina(j, path, headers) {
  const html = await (await req(j, path, { headers: headers || {} })).text();
  return html.replace(/<script type="application\/json"[\s\S]*?<\/script>/g, '');
}

async function csrf(j, path) {
  const html = await pagina(j, path);
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

/* Ce e ales acum în selectorul cu numele dat. Se caută în bucata de HTML a
   selectorului, nu în toată pagina: altfel „selected" de la alt selector ar
   trece drept răspuns. */
function ales(html, nume) {
  const i = html.indexOf(`name="${nume}"`);
  if (i === -1) return null;
  const bucata = html.slice(i, html.indexOf('</select>', i));
  const m = bucata.match(/<option value="([^"]*)"[^>]*\bselected\b/);
  return m ? m[1] : '';
}

function valoarea(html, nume) {
  const re = new RegExp(`name="${nume}"[^>]*value="([^"]*)"`);
  const m = html.match(re);
  return m ? m[1] : null;
}

(async () => {
  const stamp = Date.now();
  const A = jar();
  const email = `cont${stamp}@local.test`;

  /* --- fără cont nu se vede pagina --- */
  let res = await req(jar(), '/cont');
  check('/cont fără autentificare → /login',
        res.status === 302 && res.headers.get('location') === '/login',
        `${res.status} ${res.headers.get('location')}`);

  /* --- cont nou --- */
  let token = await csrf(A, '/register');
  res = await req(A, '/register', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: token, email, password: 'parola1234', password2: 'parola1234' })
  });
  check('înregistrare → /orders', res.status === 302 && res.headers.get('location') === '/orders',
        `${res.status} ${res.headers.get('location')}`);

  /* --- pagina se deschide și e goală --- */
  let html = await pagina(A, '/cont');
  check('/cont se deschide', html.includes('name="tara"') && html.includes('name="unitate"'));
  check('contul nou nu are țară aleasă', ales(html, 'tara') === '', String(ales(html, 'tara')));
  check('contul nou lasă unitatea „după țară”', ales(html, 'unitate') === '', String(ales(html, 'unitate')));
  check('țările sunt în limba paginii (română)', html.includes('>Germania<'));

  /* --- propunerea vine din antetul browserului ---
     Pagina se cere cu `?lang=ro` INADINS, deși antetul zice engleză: țara
     ghicită și limba paginii sunt două lucruri deosebite, iar dacă le-am
     proba împreună n-am ști care din ele merge. */
  html = await pagina(A, '/cont?lang=ro', { 'accept-language': 'en-US,en;q=0.9' });
  check('antetul en-US propune Statele Unite', html.includes('Statele Unite'),
        'nu scrie nicăieri țara propusă');
  check('și propune țoli pentru ea', /Statele Unite[\s\S]{0,80}țoli/.test(html),
        'a propus țara, dar nu unitatea ei');
  html = await pagina(A, '/cont?lang=ro', { 'accept-language': 'ro-RO,ro;q=0.9' });
  check('antetul ro-RO propune România, în milimetri',
        /România[\s\S]{0,80}milimetri/.test(html), 'propunerea nu s-a mutat pe România');

  /* --- țara propune unitatea --- */
  token = await csrf(A, '/cont');
  res = await req(A, '/cont', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: token, tara: 'US', unitate: '', profil: 'atelier', lang: '',
                 name: 'Test Atelier', firma: 'Atelier Test SRL', cui: 'RO123',
                 telefon: '0700111222', oras: 'Cluj', adresa: 'Str. Test 1',
                 site: 'atelierulmeu.ro' })
  });
  check('salvarea → /cont?salvat=1',
        res.status === 302 && res.headers.get('location') === '/cont?salvat=1',
        `${res.status} ${res.headers.get('location')}`);

  html = await pagina(A, '/cont');
  check('țara s-a salvat', ales(html, 'tara') === 'US', String(ales(html, 'tara')));
  check('unitatea rămâne „după țară”', ales(html, 'unitate') === '', String(ales(html, 'unitate')));
  check('„după țară” scrie acum țoli', /După țară \(țoli\)/.test(html),
        'paranteza nu s-a mutat pe țoli');
  check('site-ul s-a întregit cu https', valoarea(html, 'site') === 'https://atelierulmeu.ro',
        String(valoarea(html, 'site')));
  check('telefonul s-a salvat', valoarea(html, 'telefon') === '0700111222', String(valoarea(html, 'telefon')));
  check('profilul s-a salvat', ales(html, 'profil') === 'atelier', String(ales(html, 'profil')));

  /* --- alegerea omului bate propunerea --- */
  token = await csrf(A, '/cont');
  res = await req(A, '/cont', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: token, tara: 'US', unitate: 'mm', profil: 'atelier', lang: '',
                 name: 'Test Atelier', firma: '', cui: '', telefon: '', oras: '', adresa: '', site: '' })
  });
  html = await pagina(A, '/cont');
  check('milimetri aleși explicit rămân, deși țara zice țoli',
        ales(html, 'unitate') === 'mm', String(ales(html, 'unitate')));
  check('un câmp golit se golește', valoarea(html, 'telefon') === '', String(valoarea(html, 'telefon')));

  /* --- ce nu e adresă de web e refuzat --- */
  token = await csrf(A, '/cont');
  res = await req(A, '/cont', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: token, tara: 'US', unitate: 'mm', profil: '', lang: '',
                 name: '', firma: '', cui: '', telefon: '', oras: '', adresa: '',
                 site: 'javascript:alert(1)' })
  });
  check('un „javascript:" în site → 400', res.status === 400, String(res.status));
  html = await pagina(A, '/cont');
  check('și nu s-a salvat nimic din el', (valoarea(html, 'site') || '').indexOf('javascript') === -1,
        String(valoarea(html, 'site')));

  /* --- un formular măsluit nu bagă nimic strâmb --- */
  token = await csrf(A, '/cont');
  res = await req(A, '/cont', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: token, tara: 'XX', unitate: 'coti', profil: 'sef', lang: 'klingon',
                 name: '', firma: '', cui: '', telefon: '', oras: '', adresa: '', site: '' })
  });
  check('valori din afara listelor → tot se salvează, curățate', res.status === 302, String(res.status));
  html = await pagina(A, '/cont');
  check('țara inventată a căzut', ales(html, 'tara') === '', String(ales(html, 'tara')));
  check('unitatea inventată a căzut', ales(html, 'unitate') === '', String(ales(html, 'unitate')));
  check('profilul inventat a căzut', ales(html, 'profil') === '', String(ales(html, 'profil')));

  /* --- fără token nu se salvează --- */
  res = await req(A, '/cont', { method: 'POST', headers: FORM, body: form({ tara: 'DE' }) });
  check('POST fără CSRF → 403', res.status === 403, String(res.status));

  /* --- limba se schimbă de aici --- */
  token = await csrf(A, '/cont');
  await req(A, '/cont', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: token, tara: 'DE', unitate: '', profil: '', lang: 'en',
                 name: '', firma: '', cui: '', telefon: '', oras: '', adresa: '', site: '' })
  });
  html = await pagina(A, '/cont');
  check('limba aleasă schimbă pagina', html.includes('My account'), 'pagina a rămas în română');
  check('și țările se mută în limba nouă', html.includes('>Germany<'), 'numele țărilor au rămas în română');

  /* --- țara se poate alege de la înregistrare ---
     Alt cont, fiindcă primul e deja făcut. Antetul spune en-US, deci
     selectorul trebuie să vină cu Statele Unite bifate fără ca omul să atingă
     nimic; iar contul făcut așa pornește direct în țoli. */
  const B = jar();
  let h = await pagina(B, '/register?lang=ro', { 'accept-language': 'en-US,en;q=0.9' });
  check('formularul de înregistrare are țara', h.includes('name="tara"'));
  check('și vine cu cea ghicită din browser', ales(h, 'tara') === 'US', String(ales(h, 'tara')));

  token = (h.match(/name="_csrf"\s+value="([^"]+)"/) || [])[1];
  res = await req(B, '/register', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: token, email: `us${stamp}@local.test`,
                 password: 'parola1234', password2: 'parola1234', tara: 'US' })
  });
  check('înregistrare cu țară → /orders', res.status === 302, String(res.status));
  h = await pagina(B, '/cont?lang=ro');
  check('contul nou are deja țara din înregistrare', ales(h, 'tara') === 'US', String(ales(h, 'tara')));
  check('și pornește în țoli, fără să fi ales nimeni unitatea',
        /După țară \(țoli\)/.test(h), 'unitatea n-a venit din țară');
  check('nu-i mai propune nimic, că a spus deja',
        !/Browserul spune/.test(h), 'propunerea a rămas după ce omul a ales');

  /* --- o țară inventată la înregistrare nu strică nimic --- */
  const C = jar();
  token = await csrf(C, '/register');
  res = await req(C, '/register', {
    method: 'POST', headers: FORM,
    body: form({ _csrf: token, email: `xx${stamp}@local.test`,
                 password: 'parola1234', password2: 'parola1234', tara: 'ZZ' })
  });
  check('țară inventată la înregistrare → contul se face oricum', res.status === 302, String(res.status));
  h = await pagina(C, '/cont?lang=ro');
  check('și rămâne fără țară', ales(h, 'tara') === '', String(ales(h, 'tara')));

  console.log(failed ? `\n${failed} verificări au picat` : '\ntoate verificările au trecut');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
