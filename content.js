'use strict';

// ── Element-cache ─────────────────────────────────────────────────────────

let _cache = {};

function oppdaterCache() {
  _cache.kommentarKnapp = document.querySelector('[data-testid="submit-comment-button"]');
  _cache.vurderingInput = document.querySelector('input[data-testid="pass-fail-select"]');
  _cache.statusInput    = document.querySelector('input[data-testid="assignment-submission-status-select"]');
}

window.addEventListener('hashchange', oppdaterCache);
oppdaterCache();

// ── Meldingslytter ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'kjor-start') {
    kjorStart(msg.sendKommentar).then(sendResponse);
    return true;
  }
  if (msg.action === 'kjor-avslutt') {
    kjorAvslutt(msg.erNQ).then(sendResponse);
    return true;
  }
  if (msg.action === 'kjor-parallell') {
    kjorParallell(msg.sendKommentar).then(sendResponse);
    return true;
  }
});

// ── NQ-kompatibel sekvens ─────────────────────────────────────────────────

async function kjorStart(sendKommentar) {
  oppdaterCache();
  if (sendKommentar) await sendKommentarSmart();
  return { ok: true };
}

async function kjorAvslutt(erNQ) {
  oppdaterCache();
  if (!erNQ) await settVurdering();
  await settStatus();
  return { ok: true };
}

// ── Parallell sekvens (ikkje-NQ) ──────────────────────────────────────────

async function kjorParallell(sendKommentar) {
  oppdaterCache();

  // Kommentar og vurdering startar samtidig
  await Promise.all([
    sendKommentar ? sendKommentarOgVentPaBekreftelse() : Promise.resolve(false),
    settVurdering()
  ]);

  // Status settast alltid sist — etter at Canvas har prosessert kommentaren
  await settStatus();
  return { ok: true };
}

// ── Kommentar (NQ-fallback, rask) ────────────────────────────────────────

function sendKommentarSmart() {
  return new Promise(resolve => {
    const btn = _cache.kommentarKnapp ||
                document.querySelector('[data-testid="submit-comment-button"]');

    if (!btn || btn.disabled || btn.getAttribute('aria-disabled') === 'true') {
      return resolve(false);
    }

    let textarea = null;
    let el = btn.parentElement;
    for (let i = 0; i < 8 && el; i++, el = el.parentElement) {
      textarea = el.querySelector('textarea');
      if (textarea) break;
    }

    btn.click();

    if (textarea) {
      const poll = setInterval(() => {
        if (textarea.value.trim() === '') {
          clearInterval(poll);
          clearTimeout(fallback);
          resolve(true);
        }
      }, 80);
      var fallback = setTimeout(() => { clearInterval(poll); resolve(true); }, 3000);
    } else {
      setTimeout(resolve, 1000);
    }
  });
}

// ── Kommentar med API-bekreftelse (ikkje-NQ) ─────────────────────────────
//
// Lyttar på knappeattributtar for å vite nøyaktig når Canvas har fått svar
// frå API-et og re-rendert. Berre då er det trygt å setje status → Ingen.
//
// Primær:   MutationObserver på knappen (deaktivert under kall → aktiv etter svar)
// Sekundær: Textarea tømmes + 2.5s buffer (om Canvas ikkje deaktiverer knappen)
// Fallback: 8s hard grense

function sendKommentarOgVentPaBekreftelse() {
  return new Promise(resolve => {
    const btn = _cache.kommentarKnapp ||
                document.querySelector('[data-testid="submit-comment-button"]');

    if (!btn || btn.disabled || btn.getAttribute('aria-disabled') === 'true') {
      return resolve(false);
    }

    let resolved = false;
    const done = () => {
      if (resolved) return;
      resolved = true;
      btnObserver.disconnect();
      clearTimeout(hardFallback);
      resolve(true);
    };

    // Primær: knapp deaktiveres under API-kall, aktiveres etter svar
    let harVaertDeaktivert = false;
    const btnObserver = new MutationObserver(() => {
      const erDeaktivert = btn.disabled || btn.getAttribute('aria-disabled') === 'true';
      if (erDeaktivert) {
        harVaertDeaktivert = true;
      } else if (harVaertDeaktivert) {
        done();
      }
    });
    btnObserver.observe(btn, { attributes: true });

    // Sekundær: textarea tømmes + 2.5s buffer
    let textarea = null;
    let el = btn.parentElement;
    for (let i = 0; i < 8 && el; i++, el = el.parentElement) {
      textarea = el.querySelector('textarea');
      if (textarea) break;
    }

    if (textarea) {
      const poll = setInterval(() => {
        if (resolved) { clearInterval(poll); return; }
        if (textarea.value.trim() === '') {
          clearInterval(poll);
          setTimeout(done, 2500);
        }
      }, 80);
    }

    // Hard fallback
    var hardFallback = setTimeout(done, 8000);

    btn.click();
  });
}

// ── Vurdering → Fullført ──────────────────────────────────────────────────

function settVurdering() {
  return new Promise(resolve => {
    const forsok = (nr) => {
      if (nr > 5) return resolve(false);

      const input = _cache.vurderingInput ||
                    document.querySelector('input[data-testid="pass-fail-select"]');
      if (!input) return setTimeout(() => forsok(nr + 1), 400);
      if (['Fullfort', 'Fullført', 'Complete'].includes(input.value)) return resolve(true);

      input.click();

      setTimeout(() => {
        const valgt = Array.from(document.querySelectorAll('[role="option"]')).find(o =>
          ['Fullført', 'Complete', 'Complet', 'Completado', 'Completo'].includes(o.textContent.trim())
        );
        if (valgt) {
          valgt.click();
          resolve(true);
        } else {
          setTimeout(() => forsok(nr + 1), 400);
        }
      }, 350);
    };
    forsok(0);
  });
}

// ── Status → Ingen ────────────────────────────────────────────────────────

function settStatus() {
  return new Promise(resolve => {
    const forsok = (nr) => {
      if (nr > 5) return resolve(false);

      const input = _cache.statusInput ||
                    document.querySelector('input[data-testid="assignment-submission-status-select"]');
      if (!input) return setTimeout(() => forsok(nr + 1), 400);
      if (['Ingen', 'None'].includes(input.value)) return resolve(true);

      input.click();

      setTimeout(() => {
        const valgt = Array.from(document.querySelectorAll('[role="option"]')).find(o =>
          ['Ingen', 'None', 'Aucun', 'Ninguno', 'Keiner', 'Nessuno', 'Geen'].includes(o.textContent.trim())
        );
        if (valgt) {
          valgt.click();
          resolve(true);
        } else {
          setTimeout(() => forsok(nr + 1), 400);
        }
      }, 350);
    };
    forsok(0);
  });
}
