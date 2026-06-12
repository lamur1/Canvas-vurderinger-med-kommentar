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
});

// ── Hovudsekvens ──────────────────────────────────────────────────────────

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

// ── Kommentar ─────────────────────────────────────────────────────────────

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
