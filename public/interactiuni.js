/* Interacțiuni mărunte, pe toate paginile.

   Politica de securitate a paginii (CSP) nu permite scripturi inline, deci
   atributele de tip onclick nu se execută niciodată. Tot ce era acolo se scrie
   aici, prin atribute de date:

     data-comuta="idElement"   arată sau ascunde elementul
     data-confirma="întrebare" cere confirmare înainte de trimiterea formularului
     data-trimite-la-schimbare trimite formularul când se schimbă valoarea
     data-tipareste            deschide fereastra de tipărire
*/
(function () {
'use strict';

/* ============================================================
   Întrebarea de confirmare.

   NU se folosește `window.confirm`. Arăta bine și mergea la mine, dar e o
   fereastră a browserului, nu a paginii, iar browserul are voie s-o
   oprească — și o oprește: în panourile de browser din aplicații, în
   webview-uri, după câteva dialoguri la rând, sau dacă omul a bifat „nu mai
   arăta ferestre de pe pagina asta".

   Când o oprește, `confirm()` întoarce false fără să întrebe pe nimeni. Adică
   butonul de ștergere nu face NIMIC, tăcut, și omul crede că e stricată
   aplicația. Exact așa s-a întâmplat.

   Fereastra de aici e a paginii: un <dialog> scris de server, tradus, pe
   care nu-l poate opri nimeni.
   ============================================================ */

var F = null;             /* fereastra, căutată o singură dată */
var deFacut = null;       /* ce se face dacă omul zice da */
var etichetaVeche = null; /* scrisul de pe butonul „da", ca să se pună la loc */

/* Ascultătorii se pun O SINGURĂ DATĂ, iar răspunsul așteptat stă într-o
   variabilă. Prima variantă îi punea și-i scotea la fiecare întrebare, și
   aia era o capcană: două întrebări deschise una peste alta ar fi lăsat doi
   ascultători pe același buton, iar o apăsare pe „Șterge" ar fi șters două
   lucruri. Așa nu se poate întâmpla — există un singur răspuns așteptat. */
function pregateste() {
  if (F !== null) return F;
  F = document.getElementById('intreaba') || false;
  if (!F || !F.showModal) return F;

  var bDa = F.querySelector('[data-da]');
  var bNu = F.querySelector('[data-nu]');
  if (!bDa || !bNu || !F.querySelector('[data-intrebare]')) { F = false; return F; }

  bDa.addEventListener('click', function () { inchide(true); });
  bNu.addEventListener('click', function () { inchide(false); });
  /* Esc închide fereastra fără să treacă prin butoane. */
  F.addEventListener('close', function () { inchide(false); });
  return F;
}

function inchide(da) {
  var ce = deFacut;
  deFacut = null;                       /* întâi se uită, apoi se face: dacă
                                           `ce` deschide altă întrebare, n-o
                                           găsește pe asta încă în drum */
  if (etichetaVeche !== null) {
    F.querySelector('[data-da]').textContent = etichetaVeche;
    etichetaVeche = null;
  }
  if (F.open) F.close();
  if (da && ce) ce();
}

/* Întreabă, și cheamă `laDa` numai dacă omul zice da.
   `etichetaDa` schimbă scrisul de pe butonul de confirmare, pentru cazurile
   care nu sunt ștergeri. */
function intreaba(text, laDa, etichetaDa) {
  var f = pregateste();

  /* Fără fereastră în pagină — o pagină de tipar, de pildă — rămâne
     întrebarea browserului. Acolo nu există butoane de ștergere, deci nu se
     pierde nimic; iar dacă apare vreunul, măcar întreabă. */
  if (!f) {
    if (window.confirm(text)) laDa();
    return;
  }

  /* O întrebare deschisă nu se calcă peste: a doua se pierde, prima rămâne.
     Altfel omul ar vedea textul celei de-a doua peste butonul celei dintâi. */
  if (f.open) return;

  var bDa = f.querySelector('[data-da]');
  f.querySelector('[data-intrebare]').textContent = text;
  if (etichetaDa) { etichetaVeche = bDa.textContent; bDa.textContent = etichetaDa; }

  deFacut = laDa;
  f.showModal();
  /* Mâna stă pe „Anulează", nu pe „Șterge": o apăsare de Enter din greșeală
     n-are voie să șteargă o comandă. */
  f.querySelector('[data-nu]').focus();
}

window.PalIntreaba = intreaba;

/* Trimite formularul din nou, după ce omul a confirmat.

   `requestSubmit(buton)` păstrează numele și valoarea butonului apăsat —
   două ștergeri din aplicație trimit `sterge=1` chiar prin buton, iar un
   `form.submit()` simplu le-ar pierde și ar salva în loc să șteargă. */
function trimiteDinNou(buton) {
  var form = buton.form || (buton.closest ? buton.closest('form') : null);
  if (!form) { return; }

  if (form.requestSubmit) { form.requestSubmit(buton); return; }

  if (buton.name) {
    var ascuns = document.createElement('input');
    ascuns.type = 'hidden';
    ascuns.name = buton.name;
    ascuns.value = buton.value;
    form.appendChild(ascuns);
  }
  form.submit();
}

document.addEventListener('click', function (e) {
  var comuta = e.target.closest('[data-comuta]');
  if (comuta) {
    var tinta = document.getElementById(comuta.dataset.comuta);
    if (tinta) {
      tinta.classList.toggle('hidden');
      if (!tinta.classList.contains('hidden')) {
        var primul = tinta.querySelector('input, select, textarea');
        if (primul) primul.focus();
      }
    }
    return;
  }

  var tipar = e.target.closest('[data-tipareste]');
  if (tipar) { window.print(); return; }

  var cere = e.target.closest('[data-confirma]');
  if (cere) {
    /* Trimiterea se oprește MEREU aici, fiindcă răspunsul vine mai târziu,
       nu în clipa asta. Se reia numai după „da". */
    e.preventDefault();
    e.stopPropagation();
    intreaba(cere.dataset.confirma, function () {
      trimiteDinNou(cere);
    }, cere.dataset.confirmaButon);
  }
});

document.addEventListener('change', function (e) {
  var camp = e.target.closest('[data-trimite-la-schimbare]');
  if (camp && camp.form) camp.form.submit();
});
})();
