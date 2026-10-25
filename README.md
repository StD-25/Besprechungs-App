# Besprechungsprotokoll

Web-App (PWA) zum Erfassen offener Punkte bei Rundgängen und Besprechungen
(Safety Walk, Poolmanager Besprechung, Reko Produktion, Sonstige) – mit Fotos,
Zuständigkeiten, Aufgabenliste, PDF-Bericht und Versand per E-Mail.
Alle Daten bleiben lokal auf dem Handy (offline nutzbar).

## Funktionen
- Neuer Bericht: Grund auswählen (bei „Sonstige“ eigener Name), Teilnehmer eintragen
- Neuer Punkt: Datum/Uhrzeit automatisch, Bereich aus einer Liste (Halle 1–8, VB 1–17, Station 1–4,
  Außenbereich, Parkplatz oder „Sonstiges“ mit freiem Text), Offener Punkt/Beschreibung, Zuständigkeit, Erledigen bis (optional),
  Fotos (Kamera oder Galerie)
- Neueste Punkte stehen oben; Berichte bleiben offen, bis sie archiviert werden
- Bericht abschließen → PDF mit Tabelle und kleinen Vorschaubildern (geringe Dateigröße)
  - Dateiname: `SafetyWalk_JJJJ-MM-TT_HH-MM.pdf`
  - Originalfotos separat: `SafetyWalk_JJJJ-MM-TT_HH-MM_Bilder.zip`
  - „Per E-Mail senden“ öffnet den Android-Teilen-Dialog (Gmail, Outlook …) mit PDF als Anhang
- Aufgabenliste: Filter nach Person oder alle, offen/erledigt, Zuweisung ändern, abhaken, PDF
- Teilnehmer und Zuständigkeit werden aus allen jemals eingetragenen Personen ausgewählt
  (neue Namen kommen automatisch in die Liste)
- Archiv, Einstellungen: „Mein Name“, Gründe der Besprechung und Bereiche (umbenennen, sortieren, hinzufügen,
  entfernen), Personenverwaltung, Datensicherung (Backup speichern/laden)

## Kurznachricht (zweites Icon mit „K“)
Kleines Fenster zum schnellen Erfassen: Datum/Uhrzeit automatisch, Name (aus „Mein Name“),
Bereich (optional), Offener Punkt/Beschreibung (Pflicht), Zuständigkeit, Erledigen bis (optional),
Fotos (optional).
Jede Kurznachricht wird automatisch als offene Aufgabe in den Bericht
„Kurznachricht TT.MM.JJJJ“ des jeweiligen Tages übernommen.

## Veröffentlichen über GitHub Pages
1. Repository: https://github.com/StD-25/Besprechungs-App
2. Den Inhalt dieses Ordners hochladen bzw. pushen:
   ```
   git remote add origin https://github.com/StD-25/Besprechungs-App.git
   git push -u origin main
   ```
3. Im Repository: **Settings → Pages → Source: „Deploy from a branch“, Branch `main`, Ordner `/ (root)`** → Speichern.
4. Nach ca. 1 Minute ist die App erreichbar unter https://std-25.github.io/Besprechungs-App/.

## Auf dem Android-Handy als Icon installieren
1. Die Adresse in **Chrome** öffnen.
2. Menü (⋮) → **„App installieren“** bzw. **„Zum Startbildschirm hinzufügen“**.
3. Die App startet nun über das Icon „Protokoll“ – auch ohne Internet.
4. Für die Kurznachricht zusätzlich https://std-25.github.io/Besprechungs-App/kurz/ öffnen
   und ebenfalls ⋮ → „App installieren“ wählen. Es erscheint ein zweites Icon mit „K“.

## Hinweise
- Daten liegen nur im Browser-Speicher dieses Geräts. Nicht die Website-Daten von Chrome
  löschen und regelmäßig unter **Einstellungen → Sicherung speichern** sichern.
- Bilder-ZIP und PDFs landen im Ordner „Downloads“ und können von dort mit der
  Dateien-App in einen beliebigen Ordner verschoben werden.
- Nach Änderungen am Code in `service-worker.js` die Versionsnummer (`CACHE`) erhöhen.

## Als Grundlage für weitere Programme
- `js/config.js` – Besprechungsgründe, Bereiche, Bildgrößen
- `js/core/` – wiederverwendbare Bausteine: Datenbank (`db.js`), PDF-Tabelle (`pdf.js`),
  Bildverkleinerung (`image.js`), Teilen/Download/ZIP (`share.js`), Dateinamen (`filename.js`), UI (`ui.js`)
- `js/model.js`, `js/export.js`, `js/views/` – App-spezifische Logik und Ansichten
