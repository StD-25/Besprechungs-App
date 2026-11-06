import * as model from '../model.js';
import { app, esc, setHeader, setActiveTab, toast } from '../core/ui.js';
import { archivePdf, archiveZip, archiveEntries, archiveXlsx } from '../export.js';
import { cloudReady, cloudRead, cloudWrite, syncNow } from '../core/sync.js';
import { todayISO } from '../core/filename.js';
import { reportCards, bindReportCards } from './home.js';

const SORTS = {
  newest: { label: 'Neueste zuerst', fn: (a, b) => b.createdAt - a.createdAt },
  oldest: { label: 'Älteste zuerst', fn: (a, b) => a.createdAt - b.createdAt },
  name: { label: 'Name A–Z', fn: (a, b) => model.reportTitle(a).localeCompare(model.reportTitle(b), 'de') || b.createdAt - a.createdAt },
};
const filters = { group: '', sort: 'newest', search: '' }; // bleibt während der Sitzung erhalten

const lower = (text) => String(text || '').toLocaleLowerCase('de');

export async function render() {
  setHeader('Archiv');
  setActiveTab('archive');
  const reports = await model.listReports('archived');
  const groups = [...new Set(reports.map(model.reportGroup))].sort((a, b) => a.localeCompare(b, 'de'));
  if (filters.group && !groups.includes(filters.group)) filters.group = '';

  // Suchtext je Bericht: Name, Teilnehmer und alle „Offener Punkt/Beschreibung“-Texte
  const haystack = new Map();
  for (const r of reports) {
    const points = await model.getPoints(r.id);
    haystack.set(r.id, lower([model.reportTitle(r), r.participants, ...points.flatMap((p) => [p.remark, p.doneNote])].join('\n')));
  }

  app().innerHTML = `
    <div class="filters">
      <select id="fGroup">
        <option value="">Alle Gründe</option>
        ${groups.map((g) => `<option ${g === filters.group ? 'selected' : ''}>${esc(g)}</option>`).join('')}
      </select>
      <select id="fSort">
        ${Object.entries(SORTS).map(([k, s]) => `<option value="${k}" ${k === filters.sort ? 'selected' : ''}>${s.label}</option>`).join('')}
      </select>
    </div>
    <input type="search" id="fSearch" value="${esc(filters.search)}" placeholder="🔍 Bericht, Name oder Punkt suchen" autocomplete="off">
    <h2 id="archiveCount"></h2>
    <div id="archiveList"></div>
    <div class="delete-row">
      <button class="btn secondary small" id="cleanup" ${reports.length ? '' : 'disabled'}>🗄 Archiv aufräumen …</button>
    </div>`;

  // Nur die Liste neu aufbauen, damit das Suchfeld beim Tippen den Fokus behält
  let renderId = 0;
  async function renderList() {
    const id = ++renderId;
    const q = lower(filters.search.trim());
    const list = reports
      .filter((r) => !filters.group || model.reportGroup(r) === filters.group)
      .filter((r) => !q || haystack.get(r.id).includes(q))
      .sort(SORTS[filters.sort].fn);
    const html = await reportCards(list);
    if (id !== renderId) return; // inzwischen weitergetippt
    document.getElementById('archiveCount').textContent = `Archivierte Berichte (${list.length})`;
    const listEl = document.getElementById('archiveList');
    listEl.innerHTML = html;
    bindReportCards(listEl);
  }

  document.getElementById('fGroup').onchange = (e) => { filters.group = e.target.value; renderList(); };
  document.getElementById('fSort').onchange = (e) => { filters.sort = e.target.value; renderList(); };
  document.getElementById('fSearch').oninput = (e) => { filters.search = e.target.value; renderList(); };

  document.getElementById('cleanup').onclick = () => cleanupDialog();

  await renderList();
}

// ---- Archiv aufräumen: Ablage in OneDrive (Archiv/), danach Berichte löschen ----
const FOLDER = 'Archiv';
const ARCHIVE_DATA = `${FOLDER}/archiv.json`;
const ARCHIVE_XLSX = `${FOLDER}/Archiv_Gesamt.xlsx`;

// Archivierte Berichte mit Berichtsdatum bis einschließlich `until` (JJJJ-MM-TT), älteste zuerst
async function reportsUntil(until) {
  const end = new Date(`${until}T23:59:59.999`).getTime();
  return (await model.listReports('archived'))
    .filter((r) => r.createdAt <= end)
    .sort((a, b) => a.createdAt - b.createdAt);
}

async function countFor(reports) {
  let points = 0;
  let photos = 0;
  for (const r of reports) {
    for (const p of await model.getPoints(r.id)) {
      points++;
      photos += (await model.getPhotos(p.id)).length;
    }
  }
  return { reports: reports.length, points, photos };
}

// Gesamt-Daten in OneDrive ergänzen (bei gleichzeitiger Änderung neu lesen und erneut anhängen)
// Jeder Punkt eines Berichts nur einmal (bei Wiederholung zählt der neueste Eintrag)
function uniqueEntries(list) {
  const map = new Map();
  for (const e of list) {
    const key = `${e.reportId}|${e.no}`;
    const prev = map.get(key);
    if (!prev || e.archivedAt >= prev.archivedAt) map.set(key, e);
  }
  return [...map.values()];
}

// Gesamt-Tabelle und Archiv-Daten in OneDrive ergänzen.
// Erst die Excel-Tabelle schreiben (kann scheitern, z.B. wenn sie geöffnet ist), danach die Daten –
// so bleibt bei einem Fehler alles unverändert und es entstehen keine doppelten Zeilen.
async function appendArchive(entries) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const file = await cloudRead(ARCHIVE_DATA);
    const data = file ? JSON.parse(await file.blob.text()) : { app: 'besprechungsprotokoll-archiv', format: 1, entries: [] };
    data.entries = uniqueEntries([...(data.entries || []), ...entries]);
    await cloudWrite(ARCHIVE_XLSX, await archiveXlsx(data.entries), {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    try {
      await cloudWrite(ARCHIVE_DATA, new Blob([JSON.stringify(data)], { type: 'application/json' }), { eTag: file ? file.eTag : '*' });
      return;
    } catch (err) {
      if (err.status !== 412 && err.status !== 409) throw err;
      // Inzwischen von einem anderen Gerät geändert: neu lesen und Tabelle erneut schreiben
    }
  }
  throw new Error('Die Archiv-Daten in OneDrive wurden gleichzeitig geändert – bitte erneut versuchen.');
}

function cleanupDialog() {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `
    <div class="dialog cleanup-dialog" role="dialog">
      <p>Archiv aufräumen</p>
      <div id="cuForm">
        <label for="cuUntil" style="margin-top:0">Archivierte Berichte bis einschließlich (Berichtsdatum)</label>
        <input type="date" id="cuUntil" value="${todayISO()}">
        <p class="meta" id="cuCount" style="margin:10px 0 0"></p>
        <p class="meta" style="margin:10px 0 0">Vorher wird in OneDrive im Ordner „Archiv“ abgelegt: ein PDF mit allen Berichten, die Originalfotos als ZIP und die fortlaufende Tabelle „Archiv_Gesamt.xlsx“. Erst danach wird gelöscht.</p>
      </div>
      <p class="meta" id="cuStatus" hidden></p>
      <div class="action-bar">
        <button class="btn danger-outline" id="cuCancel">Abbrechen</button>
        <button class="btn" id="cuGo" disabled>Ablage erstellen</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const $ = (id) => ov.querySelector(`#${id}`);
  const close = () => ov.remove();
  const status = (text) => { $('cuStatus').hidden = false; $('cuStatus').textContent = text; };
  let selected = [];
  let busy = false;

  async function update() {
    selected = await reportsUntil($('cuUntil').value || todayISO());
    const c = await countFor(selected);
    $('cuCount').innerHTML = c.reports
      ? `<b>${c.reports} Bericht${c.reports === 1 ? '' : 'e'} · ${c.points} Punkte · ${c.photos} Fotos</b>`
      : 'Keine archivierten Berichte bis zu diesem Datum.';
    const ready = cloudReady();
    $('cuGo').disabled = !c.reports || !ready;
    if (!ready) status('Bitte mit Internet und eingerichtetem OneDrive-Abgleich ausführen (Einstellungen → OneDrive-Abgleich).');
  }
  $('cuUntil').onchange = update;
  $('cuCancel').onclick = () => { if (!busy) close(); };
  update();

  $('cuGo').onclick = async () => {
    busy = true;
    $('cuGo').disabled = true;
    $('cuCancel').disabled = true;
    $('cuForm').hidden = true;
    try {
      status('Abgleich mit OneDrive …');
      await syncNow();
      if (!cloudReady()) throw new Error('Keine Verbindung zu OneDrive.');
      selected = await reportsUntil($('cuUntil').value || todayISO());
      if (!selected.length) throw new Error('Keine archivierten Berichte bis zu diesem Datum.');
      const at = Date.now();

      status('PDF mit allen Berichten wird erstellt …');
      const pdf = await archivePdf(selected, at);
      status('Originalfotos werden zusammengestellt …');
      const zip = await archiveZip(selected, at);
      const entries = await archiveEntries(selected, at);

      status('In OneDrive speichern …');
      // Gibt es den Namen schon (zweimal in derselben Minute), _2, _3 … anhängen
      const base = pdf.filename.replace(/\.pdf$/, '');
      for (let n = 1; ; n++) {
        const name = n === 1 ? base : `${base}_${n}`;
        try {
          await cloudWrite(`${FOLDER}/${name}.pdf`, pdf.blob, { eTag: '*', contentType: 'application/pdf' });
          pdf.filename = `${name}.pdf`;
          if (zip) zip.filename = `${name}_Bilder.zip`;
          break;
        } catch (err) {
          if ((err.status !== 412 && err.status !== 409) || n >= 20) throw err;
        }
      }
      if (zip) await cloudWrite(`${FOLDER}/${zip.filename}`, zip.blob, { contentType: 'application/zip' });

      // Rückfrage vor dem Löschen
      const saved = [pdf.filename, zip?.filename, 'Archiv_Gesamt.xlsx'].filter(Boolean).map((f) => `• ${f}`).join('\n');
      ov.querySelector('.dialog').innerHTML = `
        <p>Die Ablage wird in OneDrive im Ordner „Archiv“ gespeichert:\n${esc(saved)}\n\nWollen Sie die ${selected.length} Bericht${selected.length === 1 ? '' : 'e'} jetzt wirklich löschen?</p>
        <div class="action-bar">
          <button class="btn danger-outline" data-r="0">Abbrechen</button>
          <button class="btn danger" data-r="1">Löschen</button>
        </div>`;
      const ok = await new Promise((resolve) => {
        ov.querySelector('[data-r="0"]').onclick = () => resolve(false);
        ov.querySelector('[data-r="1"]').onclick = () => resolve(true);
      });
      if (!ok) {
        close();
        toast('Nicht gelöscht. PDF und Fotos liegen trotzdem im Ordner „Archiv“.', 5000);
        return;
      }
      ov.querySelector('.dialog').innerHTML = '<p class="meta" id="cuStatus"></p>';

      status('Gesamt-Tabelle wird ergänzt …');
      await appendArchive(entries);

      status('Berichte werden gelöscht …');
      for (const r of selected) await model.deleteReport(r.id);
      await syncNow();
      close();
      toast(`${selected.length} Bericht${selected.length === 1 ? '' : 'e'} abgelegt und gelöscht.`, 5000);
      render();
    } catch (err) {
      console.error(err);
      busy = false;
      ov.querySelector('.dialog').innerHTML = `
        <p>Archiv aufräumen nicht möglich</p>
        <p class="meta">${esc(err.status === 423 ? 'Die Tabelle „Archiv_Gesamt.xlsx“ ist gerade geöffnet. Bitte in Excel schließen und erneut versuchen.' : err.message || String(err))}\n\nEs wurde nichts gelöscht.</p>
        <div class="action-bar"><span></span><button class="btn" data-r="1">Schließen</button></div>`;
      ov.querySelector('[data-r="1"]').onclick = close;
    }
  };
}
