import * as model from '../model.js';
import * as db from '../core/db.js';
import { app, esc, setHeader, setActiveTab, toast, confirmDialog } from '../core/ui.js';
import { blobToDataURL, dataURLToBlob } from '../core/image.js';
import { download } from '../core/share.js';
import { buildFilename } from '../core/filename.js';
import { listEditor } from '../core/listEditor.js';
import { AREAS, APP_VERSION } from '../config.js';

const STORES = ['reports', 'points', 'photos', 'persons', 'settings'];
const openSections = new Set(); // während der Sitzung gemerkt

async function exportBackup() {
  const data = { app: 'besprechungsprotokoll', version: 1, exportedAt: Date.now() };
  for (const s of STORES) data[s] = await db.getAll(s);
  data.photos = await Promise.all(data.photos.map(async (p) => ({
    ...p, full: await blobToDataURL(p.full), thumb: await blobToDataURL(p.thumb),
  })));
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  download(blob, buildFilename('Backup Besprechungsprotokoll', new Date(), 'json'));
}

async function importBackup(file) {
  const data = JSON.parse(await file.text());
  if (data.app !== 'besprechungsprotokoll') throw new Error('Keine gültige Sicherungsdatei');
  for (const s of STORES) {
    for (const item of data[s] || []) {
      if (s === 'photos') {
        item.full = await dataURLToBlob(item.full);
        item.thumb = await dataURLToBlob(item.thumb);
      }
      await db.put(s, item);
    }
  }
}

export async function render() {
  setHeader('Einstellungen');
  setActiveTab('settings');
  const persons = await model.listPersons();
  const myName = await model.getSetting('myName');
  const reasons = await model.listEditableReasons();
  const areas = await model.listAreas();
  app().innerHTML = `
    <h2>Mein Name</h2>
    <div class="card">
      <details id="nameDetails">
        <summary class="settings-summary">${myName ? `Mein Name: ${esc(myName)}` : 'Mein Name eintragen'}</summary>
        <p class="meta">Wird bei Kurznachrichten automatisch eingetragen.</p>
        <form id="myNameForm" style="display:flex;gap:8px">
          <input type="text" id="myName" value="${esc(myName)}" placeholder="Vor- und Nachname">
          <button class="btn" type="submit">Speichern</button>
        </form>
      </details>
    </div>
    <h2>Gründe der Besprechung</h2>
    <div class="card">
      <details id="reasonDetails">
        <summary class="settings-summary">Gründe (${reasons.length}) bearbeiten</summary>
        <p class="meta">Auswahl bei „Neuer Bericht“. Namen direkt im Feld ändern. „Sonstige“ (mit freiem Namen) ist immer verfügbar.</p>
        <div id="reasonEditor"></div>
      </details>
    </div>

    <h2>Bereiche</h2>
    <div class="card">
      <details id="areaDetails">
        <summary class="settings-summary">Bereiche (${areas.length}) bearbeiten</summary>
        <p class="meta">Auswahl bei „Neuer Punkt“ und in der Kurznachricht. „Sonstiges“ (mit freiem Text) ist immer verfügbar.</p>
        <div id="areaEditor"></div>
        <button type="button" class="btn danger-outline small" id="resetAreas" style="margin-top:14px">Auf Standard zurücksetzen</button>
      </details>
    </div>

    <h2>Personen</h2>
    <div class="card">
      <details id="personDetails">
      <summary class="settings-summary">Personen (${persons.length}) bearbeiten</summary>
      <form id="addPerson" style="display:flex;gap:8px;margin-top:8px">
        <input type="text" id="personName" placeholder="Name hinzufügen">
        <button class="btn" type="submit">＋</button>
      </form>
      ${persons.length ? persons.map((p) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--blue-100)">
          <span>${esc(p)}</span><button class="btn danger-outline small" data-del="${esc(p)}">Entfernen</button>
        </div>`).join('') : '<p class="empty">Noch keine Personen.</p>'}
      </details>
    </div>

    <h2>Datensicherung</h2>
    <div class="card">
      <details id="backupDetails">
        <summary class="settings-summary">Sicherung speichern / laden</summary>
        <p class="meta">Alle Daten liegen nur auf diesem Gerät. Regelmäßig sichern, z.B. vor einem Handywechsel.</p>
        <div class="btn-row">
          <button class="btn" id="export">Sicherung speichern</button>
          <label class="btn secondary" style="margin:0">Sicherung laden
            <input type="file" id="import" accept="application/json,.json" hidden>
          </label>
        </div>
        <p class="meta" id="storage"></p>
      </details>
    </div>
    <p class="meta" style="text-align:center">Version ${APP_VERSION}</p>`;

  // Gründe und Bereiche: jede Änderung wird sofort gespeichert
  // Aufgeklappte Abschnitte bleiben nach dem Neuzeichnen offen
  app().querySelectorAll('details[id]').forEach((d) => {
    d.open = openSections.has(d.id);
    d.addEventListener('toggle', () => (d.open ? openSections.add(d.id) : openSections.delete(d.id)));
  });

  const reasonSummary = app().querySelector('#reasonDetails summary');
  listEditor(document.getElementById('reasonEditor'), {
    items: reasons,
    onSave: async (list) => {
      await model.saveReasons(list);
      reasonSummary.textContent = `Gründe (${list.length}) bearbeiten`;
    },
    makeItem: (label) => ({ id: db.uid(), label }),
    noun: 'Grund',
    addPlaceholder: 'Neuen Grund hinzufügen',
  });
  const areaSummary = app().querySelector('#areaDetails summary');
  const areaEditor = listEditor(document.getElementById('areaEditor'), {
    items: areas.map((label) => ({ label })),
    onSave: async (list) => {
      await model.saveAreas(list.map((it) => it.label));
      areaSummary.textContent = `Bereiche (${list.length}) bearbeiten`;
    },
    noun: 'Bereich',
    addPlaceholder: 'Neuen Bereich hinzufügen',
  });
  document.getElementById('resetAreas').onclick = async () => {
    if (await confirmDialog('Bereiche auf die ursprüngliche Liste zurücksetzen?', { ok: 'Zurücksetzen', danger: true })) {
      await model.saveAreas([...AREAS]);
      areaEditor.setItems(AREAS.map((label) => ({ label })));
      areaSummary.textContent = `Bereiche (${AREAS.length}) bearbeiten`;
      toast('Bereiche zurückgesetzt');
    }
  };

  document.getElementById('myNameForm').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('myName').value.trim();
    await model.setSetting('myName', name);
    if (name) await model.addPersons([name]);
    toast('Name gespeichert');
    render();
  };
  document.getElementById('addPerson').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('personName').value.trim();
    if (!name) return;
    await model.addPersons([name]);
    render();
  };
  app().querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = async () => {
      if (await confirmDialog(`"${b.dataset.del}" aus der Personenliste entfernen? Bestehende Zuweisungen bleiben erhalten.`, { ok: 'Entfernen', danger: true })) {
        await model.deletePerson(b.dataset.del);
        render();
      }
    };
  });
  document.getElementById('export').onclick = () => exportBackup().catch((e) => toast(e.message));
  document.getElementById('import').onchange = async (e) => {
    try {
      await importBackup(e.target.files[0]);
      toast('Sicherung geladen');
      render();
    } catch (err) {
      toast('Fehler: ' + err.message);
    }
  };

  if (navigator.storage?.estimate) {
    const { usage } = await navigator.storage.estimate();
    const persisted = await navigator.storage.persisted?.();
    document.getElementById('storage').textContent =
      `Belegter Speicher: ${(usage / 1024 / 1024).toFixed(1)} MB${persisted ? ' · dauerhaft gespeichert' : ''}`;
  }
}
