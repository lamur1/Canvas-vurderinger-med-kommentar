const toggle = document.getElementById('toggleKommentar');

// Last lagret innstilling (standard: på)
chrome.storage.local.get({ sendKommentar: true }, ({ sendKommentar }) => {
  toggle.checked = sendKommentar;
});

// Lagre når brukeren endrer
toggle.addEventListener('change', () => {
  chrome.storage.local.set({ sendKommentar: toggle.checked });
});

document.getElementById('kjor').addEventListener('click', async () => {
  const status = document.getElementById('status');
  status.textContent = 'Kjører...';
  status.className = '';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url.includes('speed_grader')) {
    status.textContent = 'Åpne Speed Grader først.';
    status.className = 'feil';
    return;
  }

  chrome.runtime.sendMessage({ action: 'kjor-godkjenn' }, (result) => {
    if (!result) {
      status.textContent = 'Noe gikk galt.';
      status.className = 'feil';
      return;
    }
    if (result && result.ok) {
      status.textContent = '✓ Ferdig';
      status.className = 'ok';
    } else {
      status.textContent = 'Ferdig (sjekk konsoll for detaljer).';
      status.className = 'ok';
    }
  });
});
