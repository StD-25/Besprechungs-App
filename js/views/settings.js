import * as model from '../model.js';
import * as db from '../core/db.js';
import { app, esc, setHeader, setActiveTab, toast, confirmDialog } from '../core/ui.js';
import { blobToDataURL, dataURLToBlob } from '../core/image.js';
import { download } from '../core/share.js';
import { buildFilename } from '../core/filename.js';

const STORES = ['reports', 'points', 'photos', 'persons', 'settings'];

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
  app().innerHTML = `
    <h2>Mein Name</h2>
    <div class="card">
      <p class="meta">Wird bei Kurznachrichten automatisch eingetragen.</p>
      <form id="myNameForm" style="display:flex;gap:8px">
        <input type="text" id="myName" value="${esc(myName)}" placeholder="Vor- und Nachname">
        <button class="btn" type="submit">Speichern</button>
      </form>
    </div>
    <h2>Gründe der Besprechung</h2>
    <div class="card">
      <p class="meta">Auswahl bei „Neuer Bericht“. Namen direkt im Feld ändern. „Sonstige“ (mit freiem Namen) ist immer verfügbar.</p>
      ${reasons.map((r, i) => `
        <div class="reason-row">
          <input type="text" data-reason="${i}" value="${esc(r.label)}" aria-label="Grund ${i + 1}">
          <button class="btn secondary small" data-move="${i}:-1" ${i === 0 ? 'disabled' : ''} aria-label="nach oben">↑</button>
          <button class="btn secondary small" data-move="${i}:1" ${i === reasons.length - 1 ? 'disabled' : ''} aria-label="nach unten">↓</button>
          <button class="btn danger-outline small" data-remove="${i}">Entfernen</button>
        </div>`).join('')}
      <form id="addReason" style="display:flex;gap:8px;margin-top:12px">
        <input type="text" id="reasonName" placeholder="Neuen Grund hinzufügen">
        <button class="btn" type="submit">＋</button>
      </form>
    </div>

    <h2>Personen</h2>
    <div class="card">
      <form id="addPerson" style="display:flex;gap:8px">
        <input type="text" id="personName" placeholder="Name hinzufügen">
        <button class="btn" type="submit">＋</button>
      </form>
      ${persons.length ? persons.map((p) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--blue-100)">
          <span>${esc(p)}</span><button class="btn danger-outline small" data-del="${esc(p)}">Entfernen</button>
        </div>`).join('') : '<p class="empty">Noch keine Personen.</p>'}
    </div>

    <h2>Datensicherung</h2>
    <div class="card">
      <p class="meta">Alle Daten liegen nur auf diesem Gerät. Regelmäßig sichern, z.B. vor einem Handywechsel.</p>
      <div class="btn-row">
        <button class="btn" id="export">Sicherung speichern</button>
        <label class="btn secondary" style="margin:0">Sicherung laden
          <input type="file" id="import" accept="application/json,.json" hidden>
        </label>
      </div>
      <p class="meta" id="storage"></p>
    </div>`;

  // Gründe: jede Änderung sofort speichern
  const saveReasons = async (list, msg) => {
    await model.saveReasons(list);
    toast(msg);
    render();
  };
  app().querySelectorAll('[data-reason]').forEach((input) => {
    input.onchange = () => {
      const label = input.value.trim();
      if (!label) { toast('Der Name darf nicht leer sein.'); input.value = reasons[input.dataset.reason].label; return; }
      reasons[input.dataset.reason].label = label;
      saveReasons(reasons, 'Grund gespeichert');
    };
  });
  app().querySelectorAll('[data-move]').forEach((b) => {
    b.onclick = () => {
      const [i, dir] = b.dataset.move.split(':').map(Number);
      [reasons[i], reasons[i + dir]] = [reasons[i + dir], reasons[i]];
      saveReasons(reasons, 'Reihenfolge gespeichert');
    };
  });
  app().querySelectorAll('[data-remove]').forEach((b) => {
    b.onclick = async () => {
      const r = reasons[b.dataset.remove];
      if (await confirmDialog(`Grund „${r.label}“ entfernen?\n\nBestehende Berichte behalten ihren Namen.`, { ok: 'Entfernen', danger: true })) {
        reasons.splice(Number(b.dataset.remove), 1);
        saveReasons(reasons, 'Grund entfernt');
      }
    };
  });
  document.getElementById('addReason').onsubmit = (e) => {
    e.preventDefault();
    const label = document.getElementById('reasonName').value.trim();
    if (!label) return;
    if (reasons.some((r) => r.label.toLowerCase() === label.toLowerCase())) { toast('Diesen Grund gibt es schon.'); return; }
    reasons.push({ id: db.uid(), label });
    saveReasons(reasons, 'Grund hinzugefügt');
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
