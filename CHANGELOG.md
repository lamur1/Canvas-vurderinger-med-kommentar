# Endringslogg

## v3.6 – 2026-06-06

### 🎨 Design
- Nytt ikon: grøn sirkel med kvit hake — lesbart i alle storleikar (16×16 og 48×48)

---

## v3.5 – 2026-06-06

### ⚡ Ytelsesforbetringer
- **Smart kommentar-venting** — ventar no på at Canvas tømer tekstfeltet i staden for fast 1 500 ms pause. Typisk 100–400 ms i praksis
- **Persistent content script** — element-referansar lastast inn når SpeedGrader opnar og oppdaterast ved elevbytte (`hashchange`). Ingen ny DOM-søking når snarveien triggar
- **Færre `executeScript`-kall** — hovudramme-operasjonar (kommentar, vurdering, status) køyrer no direkte i content scriptet via `sendMessage`. Berre NQ-iframe-arbeidet brukar framleis `executeScript`

### 🔧 Tekniske endringer
- `content.js` er no eit fullverdig content script med element-cache, meldingslyttar og all hovudramme-logikk
- `background.js` forenkla: les innstilling, sender to meldingar til content script, eitt `executeScript` for NQ-iframe
- `manifest.json`: content script registrert med `matches` på SpeedGrader-URL og `run_at: document_idle`

### 📝 Bakgrunn
Den faste 1 500 ms ventinga etter kommentar-innsending var den største flaskehalsen. Med event-driven venting er sekvensen 1,3–1,6 sekund raskare for ei NQ-innlevering med kommentar.

---

## v3.4 – 2026-06-05

### ✨ Nye funksjoner
- **Toggle for kommentarutsendelse**
  - Pill-bryter i popup lar læreren slå kommentarutsendelse av eller på
  - Innstillingen lagres mellom øktene (`chrome.storage.local`)
  - Standard: på
- **Nytt navn:** Canvas – Vurdering med kommentar

### 🔧 Tekniske endringer
- Lagt til `"storage"`-tillatelse i manifest
- `background.js` leser `sendKommentar`-innstillingen og hopper over steg 1 hvis den er av
- `popup.js` synkroniserer toggle mot lagret innstilling ved oppstart

### 📝 Bakgrunn
Mange i kollegiet brukte allerede den eldre utvidelsen uten kommentarfunksjon. I stedet for to separate utvidelser samles alt i én, der læreren selv velger om kommentaren skal sendes.

---

## v3.3 – 2026-03-27

### ✨ Nye funksjoner
- **Hopper over essay med maks 0 poeng**
  - Essay laget med 0/0-poeng forblir urørt
  - Kun essay med maks > 0 får fylt inn 1 poeng
  - Detekterer "/ 0", "av 0", "of 0" og variantar nær score-inputet

### 🔧 Tekniske endringer
- Ny `harPoenggivende()` funksjon
- Sjekkar tekst i næraste foreldreelement (opp til 10 nivå)
- Søker i direkte barn for å unngå at eiga verdi (0) forvirrar søket

### 📝 Bakgrunn
Nokre quiz-sett har essay-oppgåver med 0 maks-poeng (0/0). Desse skal ikkje endrast, men "Oppdater"-knappen krev at minst eitt poengfelt er redigert. Utvidelsen fyller no berre dei som faktisk tel.

---

## v3.2 – 2026-03-18

### ✨ Nye funksjoner
- **Smart venting på "Oppdatert resultater"** Canvas-meldingen
  - Venter til Canvas registrerer dataene på serveren
  - Returnerer umiddelbart når boksen vises
  - 15 sekunders timeout (sikkerhet)
- Læreren kan navigere trygt til neste elev etter return

### 🔧 Tekniske endringer
- Ny `venteOppOpdatertResultater()` funksjon
- Poll-basert deteksjon hver 200ms
- Søker etter teksten "Oppdatert resultater" i både DOM og iFrames
- Async/await støtte for venting

### 📝 Fordeler
- ✅ Trygt å navigere bort etter utvidelsen returnerer
- ✅ Canvas jobber videre på serveren uavhengig
- ✅ Robust mot variabel prosesserings-tid
- ✅ Ingen unødvendig ventetid på UI-oppdateringer

---

## v3.1 – 2026-03-18

### ✨ Nye funksjoner
- Søk i iFrames for poengfelt
- Bedre kompatibilitet med Canvas' struktur

### 🐛 Bugfiks
- Poengfelt i iFrames ble nå funnet

---

## v3.0 – 2026-03-18

### ✨ Nye funksjoner
- Essayfiltrering basert på teksteditor-størrelse
- Ignorerer MC (radio/checkbox)
- Ignorerer "Fyll inn de blanke feltene"

### 🔧 Tekniske endringer
- Ny `erEssaySporsmal()` funksjon
- Sjekker tekstEditor-høyde (> 80px = Essay)
- Sikker fallback-logikk

---

## v2.0 – (utgangspunkt)

- Innledende funksjonell versjon
- Fyller alle tomme poengfelt
- Status og vurderingshandling
