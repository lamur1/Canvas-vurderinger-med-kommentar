'use strict';

// ── Element-cache ─────────────────────────────────────────────────────────
// Fylt inn når siden lastes og oppdatert når SpeedGrader bytter elev.

let _cache = {};

function oppdaterCache() {
  _cache.kommentarKnapp = document.querySelector('[data-testid="submit-comment-button"]');
  _cache.vurderingInput = document.querySelector('input[data-testid="pass-fail-select"]');
  _cache.statusInput    = document.querySelector('input[data-testid="assignment-submission-status-select"]');
}

// SpeedGrader bytter elev via hash-endringer (ingen full sidereload)
window.addEventListener('hashchange', oppdaterCache);
oppdaterCache();

// ── Meldingslytter ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === 'kjor-start') {
    kjorStart(msg.sendKommentar).then(sendResponse);
    return true; // hold kanalen åpen for async svar
  }
  if (msg.action === 'kjor-avslutt') {
    kjorAvslutt(msg.erNQ).then(sendResponse);
    return true;
  }
});

// ── Hovudsekvens ──────────────────────────────────────────────────────────

async function kjorStart(sendKommentar) {
  oppdaterCache(); // siste oppdatering rett før vi kjørar

  if (sendKommentar) {
    await sendKommentarSmart();
  }

  const erNQ = !!document.querySelector(
    'input[data-automation="sdk-grading-edit-score-input"]'
  );
  return { erNQ };
}

async function kjorAvslutt(erNQ) {
  oppdaterCache();
  if (!erNQ) await settVurdering();
  await settStatus();
  return { ok: true };
}

// ── Kommentar — smart venting ─────────────────────────────────────────────
// Klikkar Send, og går vidare straks Canvas tømar tekstfeltet.
// Fallback: maks 3 sekund.

function sendKommentarSmart() {
  return new Promise(resolve => {
    const btn = _cache.kommentarKnapp ||
                document.querySelector('[data-testid="submit-comment-button"]');

    if (!btn || btn.disabled || btn.getAttribute('aria-disabled') === 'true') {
      return resolve(false);
    }

    // Finn tekstfeltet: søk oppover frå knappen
    let textarea = null;
    let el = btn.parentElement;
    for (let i = 0; i < 8 && el; i++, el = el.parentElement) {
      textarea = el.querySelector('textarea');
      if (textarea) break;
    }

    btn.click();

    if (textarea) {
      // Poll til feltet er tømt — typisk < 300 ms
      const poll = setInterval(() => {
        if (textarea.value.trim() === '') {
          clearInterval(poll);
          clearTimeout(fallback);
          resolve(true);
        }
      }, 80);
      var fallback = setTimeout(() => { clearInterval(poll); resolve(true); }, 3000);
    } else {
      // Ingen textarea funnet — vent 1 sekund
      setTimeout(resolve, 1000);
    }
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

      const observer = new MutationObserver(() => {
        if (['Fullfort', 'Fullført', 'Complete'].includes(input.value)) {
          observer.disconnect();
          resolve(true);
        }
      });
      observer.observe(input, { attributes: true, attributeFilter: ['value'] });

      input.click();
      setTimeout(() => {
        const options = Array.from(document.querySelectorAll('[role="option"]'));
        const valgt = options.find(o =>
          ['Fullført', 'Complete', 'Complet', 'Completado', 'Completo'].includes(o.textContent.trim())
        );
        if (valgt) {
          valgt.click();
        } else {
          observer.disconnect();
          setTimeout(() => forsok(nr + 1), 400);
        }
        setTimeout(() => { observer.disconnect(); resolve(false); }, 3000);
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

      const observer = new MutationObserver(() => {
        if (['Ingen', 'None'].includes(input.value)) {
          observer.disconnect();
          resolve(true);
        }
      });
      observer.observe(input, { attributes: true, attributeFilter: ['value'] });

      input.click();
      setTimeout(() => {
        const options = Array.from(document.querySelectorAll('[role="option"]'));
        const valgt = options.find(o =>
          ['Ingen', 'None', 'Aucun', 'Ninguno', 'Keiner', 'Nessuno', 'Geen'].includes(o.textContent.trim())
        );
        if (valgt) {
          valgt.click();
        } else {
          observer.disconnect();
          setTimeout(() => forsok(nr + 1), 400);
        }
        setTimeout(() => { observer.disconnect(); resolve(false); }, 3000);
      }, 350);
    };
    forsok(0);
  });
}
