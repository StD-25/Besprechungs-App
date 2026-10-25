# Besprechungsprotokoll – Hinweise für Claude

Web-App (PWA) zum Erfassen offener Punkte bei Rundgängen und Besprechungen (Safety Walk, Poolmanager Besprechung, Reko Produktion, Sonstige) mit Fotos, Zuständigkeiten, Aufgabenliste, Archiv, PDF-Berichten und Kurznachricht.

- Repository: `StD-25/Besprechungs-App` · Online: https://std-25.github.io/Besprechungs-App/ (Kurznachricht: `/kurz/`)
- Datenbank `besprechungsprotokoll`, Cache-Präfix `besprechungsprotokoll-`
- Schwester-App **OPL-Maschine** (`StD-25/OPL-Anlagen`) ist eine Kopie dieser App mit eigener Datenhaltung. Änderungen hier gelten **nicht** automatisch dort.
## Technik
- Reines HTML/CSS/JavaScript (ES-Module), **kein Build-Schritt**. Läuft direkt über GitHub Pages (Branch `main`, Ordner `/`).
- PWA für **Android/Chrome**: `manifest.webmanifest`, `service-worker.js` (offline), Icons in `icons/`.
- Daten **nur lokal auf dem Handy** in IndexedDB (`js/core/db.js`), Stores: `reports`, `points`, `photos` (Fotos getrennt), `persons`, `settings`.
- Bibliotheken liegen lokal in `vendor/` (jsPDF + autotable, JSZip, PDF.js 3.11) – keine CDNs (offline).
- Aufbau:
  - `js/config.js`: Name, Version, Standardwerte
  - `js/model.js`: Fachlogik
  - `js/export.js`: PDFs, Bilder-ZIP
  - `js/views/*`: Ansichten mit Hash-Router in `js/app.js`
  - `js/core/*`: wiederverwendbare Bausteine (`db`, `pdf`, `pdfPreview`, `picker`, `areaPicker`, `personPicker`, `listEditor`, `share`, `image`, `filename`, `swUpdate`, `ui`)
  - `kurz/`: Kurznachricht-App mit eigenem Manifest und Icon; nutzt dieselbe Datenbank

## Pflicht bei jeder Änderung
1. **Version erhöhen**, sonst kommt das Update nicht auf dem Handy an:
   - `APP_VERSION` in `js/config.js` (Format `JJJJ-MM-TT.n`)
   - **und** die Nummer in `CACHE` in `service-worker.js`
2. Neue JS-Dateien in die `FILES`-Liste von `service-worker.js` aufnehmen.
3. **Mehrere Apps teilen sich `std-25.github.io`** (gleiche Herkunft = gemeinsame IndexedDB, Caches, sessionStorage). Daher:
   - eigener `DB_NAME` je App (`js/core/db.js`)
   - Cache-Namen nur mit eigenem `PREFIX`; im Service Worker nur Caches mit eigenem Präfix löschen
   - sessionStorage-Schlüssel mit App-Präfix (`js/core/swUpdate.js`)
4. **Testen** mit Playwright im Handy-Format (`devices['Pixel 7']`, `locale: 'de-DE'`), lokaler Server `python3 -m http.server`. Chromium ist vorinstalliert, Playwright global (`npm root -g`); nicht `playwright install` ausführen. PDFs mit `pdftotext`/`pdftoppm` prüfen. Auf Konsolenfehler achten.
5. Danach committen und auf `main` pushen (der Nutzer möchte, dass Änderungen direkt online gehen), Pages-Deployment abwarten (`gh api repos/<owner>/<repo>/actions/runs`).
6. Dem Nutzer Screenshots (`SendUserFile`) schicken und auf Deutsch, in einfachen Worten berichten. Der Nutzer ist kein Entwickler.

## Vorgaben des Nutzers (Gestaltung und Bedienung)
- Sprache **Deutsch**, Mobile-first, große Touch-Flächen.
- Farben: **Blautöne**; Abbrechen/Löschen in **harmonischem Rot**. Speichern/Abbrechen **weit auseinander** (`.action-bar`).
- Löschen immer mit Rückfrage („Wollen Sie … wirklich löschen?“), Löschen-Buttons klein.
- Auswahl aus Listen über das **dunkle Auswahlfenster** (`js/core/picker.js`): `pickOne` (Einfachauswahl, 9 Zeilen, schließt beim Antippen), `pickMany` (Mehrfachauswahl mit OK, „＋ Neue Person…“). Kein `<datalist>` (geht auf Android schlecht), kein `<select multiple>`.
- Listen: **neueste oben**. Einstellungs-Abschnitte **aufklappbar** (`<details>`, Zustand bleibt offen).
- Bezeichnungen: „Neuer Punkt“, „Offener Punkt/Beschreibung“, „Zuständigkeit“, „Erledigen bis“.
- Personen, Gründe der Besprechung und Bereiche sind in den Einstellungen pflegbar; jemals eingetragene Personen sind auswählbar.
- Beim Erledigen eines Punkts: Fenster mit optionaler Bemerkung; diese steht im PDF in der Spalte **Status**.
- PDF:
  - klein halten, Fotos nur als Vorschaubilder (240 px); Originalfotos separat als ZIP
  - Dateiname `Grund_JJJJ-MM-TT_HH-MM_Vxx.pdf` (Version zweistellig, steigt nur bei geänderten Inhalten)
  - nach dem Erstellen Vorschau (PDF.js), dann E-Mail (Teilen-Dialog) / Speichern; Schließen → Startseite
- Nach dem Speichern eines Berichts oder einer Kurznachricht springt die App sinnvoll zurück; Updates werden automatisch übernommen (Hinweis „App wurde aktualisiert“).
