'use strict';
/* Ce se verifică înainte ca aplicația să deschidă portul.
   ============================================================

   Aplicația merge ani de zile pe calculatorul cuiva cu valori de
   dezvoltare, și în ziua în care ajunge pe un domeniu public nimic nu
   scârțâie: pornește la fel de liniștit, doar că sesiunile se pot falsifica
   și creditul e gratis. Nu se vede nicăieri. De-aia verificările stau aici
   și opresc pornirea, nu doar scriu un rând în jurnal pe care nu-l citește
   nimeni.

   Ce înseamnă „public": fie NODE_ENV=production, fie APP_URL arată spre
   altceva decât o adresă locală. A doua condiție e cea care prinde cazul
   adevărat — omul își pune domeniul în .env și uită de restul.

   Pe calculatorul lui, aceleași verificări doar avertizează. Un server de
   dezvoltare trebuie să pornească și cu secretul implicit; altfel prima
   lucrare a zilei începe cu o eroare de configurare. */

const bcrypt = require('bcryptjs');

/* Valorile din .env.example. Sunt publicate în depozit, deci oricine le
   știe: în producție niciuna n-are voie să fie cea adevărată. */
const DIN_EXEMPLU = {
  SESSION_SECRET: ['schimba-ma-cu-un-secret-lung-si-aleatoriu', 'dev-secret-schimba-ma'],
  ADMIN_PASSWORD: ['admin1234']
};

const LUNGIME_MINIMA_SECRET = 32;

function eLocal(url) {
  const u = String(url || '').trim();
  if (!u) return true;                       /* nesetat = încă pe calculatorul cuiva */
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:|\/|$)/i.test(u);
}

/* Un dosar e „în afara" aplicației dacă nu se află sub rădăcina ei. Se
   compară pe bucăți de drum, nu pe text: „/app-date" NU e sub „/app", deși
   textul unuia începe cu al celuilalt. */
function eInAfara(dir, radacina) {
  const buc = d => String(d || '').replace(/\\/g, '/').replace(/\/+$/, '').split('/');
  const a = buc(radacina), b = buc(dir);
  if (b.length < a.length) return true;
  return !a.every((parte, i) => parte === b[i]);
}

function estePublic(env) {
  return env.NODE_ENV === 'production' || !eLocal(env.APP_URL);
}

/* `adminiCuParola` primește o listă de { email, password_hash }. E dat din
   afară ca verificarea să se poată proba fără bază de date. */
function verifica(env, admini) {
  const opriri = [];     /* nu pornim */
  const semne = [];      /* pornim, dar se spune */
  const public_ = estePublic(env);
  const zi = public_ ? opriri : semne;

  /* ---- secretul de sesiune ---- */
  const secret = String(env.SESSION_SECRET || '');
  if (!secret) {
    zi.push('SESSION_SECRET nu e pus. Fără el, sesiunile se semnează cu ' +
            'valoarea scrisă în cod, care e publicată în depozit: oricine o ' +
            'știe își poate face o sesiune de administrator.');
  } else if (DIN_EXEMPLU.SESSION_SECRET.indexOf(secret) !== -1) {
    zi.push('SESSION_SECRET e încă valoarea din .env.example. E publicată ' +
            'în depozit — schimb-o cu un șir lung și aleatoriu.');
  } else if (secret.length < LUNGIME_MINIMA_SECRET) {
    zi.push('SESSION_SECRET are doar ' + secret.length + ' caractere. ' +
            'Pune cel puțin ' + LUNGIME_MINIMA_SECRET + '.');
  }

  /* ---- adresa publică ---- */
  if (public_ && !/^https:\/\//i.test(String(env.APP_URL || ''))) {
    opriri.push('APP_URL nu începe cu https://. Pe http, cookie-ul de ' +
                'sesiune pleacă nesecurizat, iar cine stă pe drum îl poate citi.');
  }

  /* ---- plata ----

     Plata NU mai oprește pornirea. Driverul și cheile Stripe se aleg acum
     din Administrare → Plata, deci aplicația trebuie să fie pornită ca să
     le poți pune — și creditul virtual pe un site public e o alegere
     făcută acolo, pe față, cât timp aplicația se probează. Panoul o arată
     cu roșu; aici doar se spune în jurnalul de pornire. Stripe cu o cheie
     lipsă oprește alimentarea (vezi `stare()` în src/payments.js). */
  const driver = String(env.PAYMENT_DRIVER || 'fake');
  const unde = ' Se pune din Administrare → Plata.';
  if (driver === 'fake') {
    semne.push(public_
      ? 'PAYMENT_DRIVER=fake pe un site public: oricine își pune singur credit virtual, fără card.' + unde
      : 'PAYMENT_DRIVER=fake. Alimentările de credit trec fără să se încaseze nimic.');
  } else if (driver === 'stripe') {
    if (!env.STRIPE_SECRET_KEY) {
      semne.push('PAYMENT_DRIVER=stripe, dar STRIPE_SECRET_KEY lipsește: alimentarea creditului e oprită.' + unde);
    }
    if (!env.STRIPE_WEBHOOK_SECRET) {
      semne.push('PAYMENT_DRIVER=stripe, dar STRIPE_WEBHOOK_SECRET lipsește: fără el nu se poate ' +
                 'verifica cine trimite confirmările de plată, deci alimentarea e oprită.' + unde);
    }
    if (/^[a-z]+_test_/.test(String(env.STRIPE_SECRET_KEY || ''))) {
      /* Un site de probă pe un domeniu adevărat, cu chei de test, e o
         purtare cinstită: plata trece tot prin Stripe. */
      semne.push('Cheia Stripe e una de test (sk_test_). Plățile adevărate nu se încasează.');
    }
  }

  /* ---- unde stă baza de date ----

     Pe un server adevărat, dosarul aplicației se înlocuiește la fiecare
     urcare de versiune. O bază de date lăsată înăuntru pleacă odată cu el,
     în tăcere: aplicația pornește frumos, doar că e goală. Nimeni nu leagă
     paguba de urcare, fiindcă între ele au trecut zile.

     De-aia în producție cerem un dosar dat pe față și aflat ÎN AFARA
     aplicației. */
  if (public_) {
    const dir = String(env.DATA_DIR || '').trim();
    if (!dir) {
      opriri.push('DATA_DIR nu e pus. Baza de date ar rămâne în dosarul ' +
                  'aplicației, iar acela se înlocuiește la fiecare urcare de ' +
                  'versiune: ai pierde comenzile, corpurile și conturile, fără ' +
                  'ca nimic să se plângă. Pune-l pe un disc care rămâne.');
    } else if (!eInAfara(dir, env.APP_ROOT || process.cwd())) {
      opriri.push('DATA_DIR („' + dir + '") e înăuntrul dosarului aplicației. ' +
                  'Acolo baza de date se pierde la următoarea urcare de versiune.');
    }
  }

  /* ---- conturi de administrator cu parola din exemplu ---- */
  (admini || []).forEach(function (u) {
    const potrivire = DIN_EXEMPLU.ADMIN_PASSWORD.some(function (p) {
      try { return bcrypt.compareSync(p, u.password_hash); } catch (e) { return false; }
    });
    if (potrivire) {
      zi.push('Contul de administrator „' + u.email + '" are încă parola din ' +
              '.env.example. Schimb-o, sau ia-i drepturile de administrator.');
    }
  });

  return { public: public_, opriri: opriri, semne: semne };
}

/* Scrie ce a găsit și, dacă e cazul, oprește pornirea. */
function aplica(rezultat, log) {
  const scrie = log || console.error;

  rezultat.semne.forEach(function (s) { scrie('  atenție: ' + s); });

  if (!rezultat.opriri.length) return true;

  scrie('');
  scrie('Aplicația NU pornește. Pe o adresă publică, astea nu sunt opționale:');
  rezultat.opriri.forEach(function (s, i) { scrie('  ' + (i + 1) + '. ' + s); });
  scrie('');
  scrie('Le pui în .env și pornești din nou. Vezi .env.example.');
  return false;
}

module.exports = { verifica, aplica, estePublic, eLocal, eInAfara, LUNGIME_MINIMA_SECRET };
