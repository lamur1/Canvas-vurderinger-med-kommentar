chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'kjor-godkjenn') await kjorGodkjenn();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'kjor-godkjenn') {
    kjorGodkjenn().then(sendResponse);
    return true;
  }
});

async function kjorGodkjenn() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url.includes('speed_grader')) return { feil: 'Ikke Speed Grader' };

  const { sendKommentar = true } = await chrome.storage.local.get({ sendKommentar: true });

  // STEG 1: Kommentar
  await chrome.tabs.sendMessage(tab.id, { action: 'kjor-start', sendKommentar });

  // NQ-deteksjon: allFrames (NQ-inputar ligg i iframe)
  const nqResultat = await chrome.scripting.executeScript({
    target: { tabId: tab.id, allFrames: true },
    func: () => !!document.querySelector('input[data-automation="sdk-grading-edit-score-input"]')
  });
  const erNQ = nqResultat.some(r => r.result === true);

  if (erNQ) {
    // STEG 2 (NQ): Fyll essaypoeng — må vere ferdig før Canvas frigjer UI-en
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: fyllOgOppdaterMedVenting
    });
    // STEG 3 (NQ): Vurdering + status
    await chrome.tabs.sendMessage(tab.id, { action: 'kjor-avslutt', erNQ: true });
  } else {
    // STEG 2 (ikkje-NQ): Vurdering → Fullført, Status → Ingen
    await chrome.tabs.sendMessage(tab.id, { action: 'kjor-avslutt', erNQ: false });
  }

  return { ok: true };
}

// ── NQ: Fyll essaypoeng og klikk Oppdater ────────────────────────────────

function fyllOgOppdaterMedVenting() {
  const harPoenggivende = function(inputElement) {
    let current = inputElement.parentElement;
    let depth = 0;
    const maxDepth = 10;

    while (current && depth < maxDepth) {
      const barn = Array.from(current.childNodes);
      for (const node of barn) {
        if (node === inputElement || node.contains && node.contains(inputElement)) continue;
        const tekst = (node.textContent || '').trim();
        if (/[\/]\s*0(\s*(pt|pts|poeng|p))?(\s|$)/i.test(tekst) ||
            /\bav\s+0\b/i.test(tekst) ||
            /\bof\s+0\b/i.test(tekst)) {
          return false;
        }
      }
      current = current.parentElement;
      depth++;
    }
    return true;
  };

  const erEssaySporsmal = function(inputElement) {
    let current = inputElement.parentElement;
    let depth = 0;
    const maxDepth = 25;

    while (current && depth < maxDepth) {
      const tekst = current.textContent.toLowerCase();
      if (tekst.includes('essay')) return true;
      if (tekst.includes('flere valgmuligheter') ||
          tekst.includes('fyll inn de blanke') ||
          tekst.includes('sant eller usant') ||
          tekst.includes('matching') ||
          tekst.includes('kategorisering') ||
          tekst.includes('formel') ||
          tekst.includes('numerisk') ||
          tekst.includes('rekkefølge')) return false;
      current = current.parentElement;
      depth++;
    }
    return false;
  };

  const nativeInputSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  ).set;

  let count = 0;

  // Tell opp essay-inputs i dette frame FØR vi startar polling
  const alleTest = document.querySelectorAll(
    'input[data-automation="sdk-grading-edit-score-input"][placeholder="--"]'
  );
  let harInputs = Array.from(alleTest).some(erEssaySporsmal);

  if (!harInputs) {
    document.querySelectorAll('iframe').forEach(iframe => {
      try {
        const d = iframe.contentDocument || iframe.contentWindow.document;
        if (d && Array.from(d.querySelectorAll(
          'input[data-automation="sdk-grading-edit-score-input"][placeholder="--"]'
        )).some(erEssaySporsmal)) harInputs = true;
      } catch (e) {}
    });
  }

  // Ingen essay-inputs i dette frame → ikkje vent på Oppdater-knapp
  if (!harInputs) return { count: 0, clicked: false };

  const alle = document.querySelectorAll(
    'input[data-automation="sdk-grading-edit-score-input"][placeholder="--"]'
  );
  Array.from(alle).filter(erEssaySporsmal).forEach(input => {
    const nyVerdi = harPoenggivende(input) ? '1' : '0';
    nativeInputSetter.call(input, nyVerdi);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    count++;
  });

  document.querySelectorAll('iframe').forEach(iframe => {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      if (!iframeDoc) return;

      const iframeInputSetter = Object.getOwnPropertyDescriptor(
        iframe.contentWindow.HTMLInputElement.prototype, 'value'
      ).set;

      Array.from(iframeDoc.querySelectorAll(
        'input[data-automation="sdk-grading-edit-score-input"][placeholder="--"]'
      )).filter(erEssaySporsmal).forEach(input => {
        const nyVerdi = harPoenggivende(input) ? '1' : '0';
        iframeInputSetter.call(input, nyVerdi);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        count++;
      });
    } catch (e) { /* cross-origin */ }
  });

  const ventOgKlikkOppdater = () => new Promise(resolve => {
    const updateTexts = ['Oppdater', 'Update', 'Uppdatera', 'Opdater'];
    const maxVentetid = 10000;
    const startTid = Date.now();

    const poll = () => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find(b => updateTexts.includes(b.textContent.trim()));
      if (btn && !btn.disabled) { btn.click(); return resolve(true); }
      if (Date.now() - startTid > maxVentetid) return resolve(false);
      setTimeout(poll, 200);
    };
    poll();
  });

  const venteOppOpdatertResultater = () => new Promise(resolve => {
    const maxVentetid = 15000;
    const startTid = Date.now();

    const sjekk = () => {
      if (document.body.innerText.includes('Oppdatert resultater')) return resolve(true);
      document.querySelectorAll('iframe').forEach(iframe => {
        try {
          if (iframe.contentDocument?.body.innerText.includes('Oppdatert resultater'))
            resolve(true);
        } catch (e) {}
      });
      if (Date.now() - startTid > maxVentetid) return resolve(false);
      setTimeout(sjekk, 200);
    };
    sjekk();
  });

  return ventOgKlikkOppdater().then(clicked => {
    if (!clicked) return { count, clicked: false };
    return venteOppOpdatertResultater().then(oppdatertVises => ({ count, clicked: true, oppdatertVises }));
  });
}
