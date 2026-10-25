import * as model from '../model.js';
import { app, esc, setHeader, setActiveTab, toast, confirmDialog, objectURL, askDoneNote } from '../core/ui.js';
import { formatDateTime } from '../core/filename.js';
import { singlePerson } from '../core/personPicker.js';
import { areaPicker } from '../core/areaPicker.js';

export async function render({ id, pid }) {
  const report = await model.getReport(id);
  if (!report) { location.hash = '#/'; return; }
  const isNew = pid === 'new';
  const point = isNew
    ? { reportId: id, area: '', remark: '', assignee: '', dueDate: '', isTodo: true }
    : await model.getPoint(pid);
  if (!point) { location.hash = `#/report/${id}`; return; }

  const back = `#/report/${id}`;
  setHeader(isNew ? 'Neuer Punkt' : `Punkt #${point.no}`, back);
  setActiveTab('home');

  const existingPhotos = isNew ? [] : await model.getPhotos(pid);
  const removedPhotoIds = [];
  const newFiles = [];
  const persons = [...(await model.listPersons()), ...model.splitNames(report.participants)];

  app().innerHTML = `
    <form id="pointForm">
      <div class="meta">${esc(model.reportTitle(report))} · ${formatDateTime(point.createdAt || Date.now())}</div>

      <label>Bereich${report.reason === 'kurznachricht' ? ' (optional)' : ''}</label>
      <div id="areaPicker"></div>

      <label for="remark">Offener Punkt/Beschreibung</label>
      <textarea id="remark" placeholder="Was ist offen bzw. aufgefallen?">${esc(point.remark)}</textarea>

      <label for="assignee">Zuständigkeit</label>
      <div id="assigneePicker"></div>

      <label for="dueDate">Erledigen bis <span class="meta">(optional)</span></label>
      <input type="date" id="dueDate" value="${esc(point.dueDate || '')}">

      <label>Fotos</label>
      <div class="btn-row">
        <label class="btn secondary" style="margin:0">📷 Foto aufnehmen
          <input type="file" id="camera" accept="image/*" capture="environment" hidden>
        </label>
        <label class="btn secondary" style="margin:0">🖼 Aus Galerie
          <input type="file" id="gallery" accept="image/*" multiple hidden>
        </label>
      </div>
      <div class="photos" id="photos"></div>

      <label class="check" style="margin-top:18px"><input type="checkbox" id="isTodo" ${point.isTodo ? 'checked' : ''}> In Aufgabenliste übernehmen</label>
      ${isNew ? '' : `<label class="check"><input type="checkbox" id="done" ${point.done ? 'checked' : ''}> Erledigt</label>
      <div id="doneNoteWrap" ${point.done ? '' : 'hidden'}>
        <label for="doneNote">Bemerkung zur Erledigung <span class="meta">(optional)</span></label>
        <textarea id="doneNote" placeholder="z.B. was wurde gemacht?" style="min-height:70px">${esc(point.doneNote || '')}</textarea>
      </div>`}

      <div class="action-bar">
        <button type="button" class="btn danger" id="cancel">Abbrechen</button>
        <button type="submit" class="btn" id="save">Speichern</button>
      </div>
      ${isNew ? '' : '<button type="button" class="btn danger-outline block" id="deletePoint" style="margin-top:24px">Punkt löschen</button>'}
    </form>`;

  const form = document.getElementById('pointForm');

  const area = areaPicker(document.getElementById('areaPicker'), { value: point.area, areas: await model.listAreas() });
  const assignee = singlePerson(document.getElementById('assigneePicker'), { value: point.assignee, persons, id: 'assignee' });

  const photosEl = document.getElementById('photos');
  function renderPhotos() {
    const items = [
      ...existingPhotos.filter((p) => !removedPhotoIds.includes(p.id)).map((p) => ({ key: `e:${p.id}`, src: objectURL(p.thumb) })),
      ...newFiles.map((f, i) => ({ key: `n:${i}`, src: objectURL(f) })),
    ];
    photosEl.innerHTML = items.map((it) => `
      <div class="ph"><img class="thumb" src="${it.src}" alt=""><button type="button" data-key="${it.key}" aria-label="Foto entfernen">×</button></div>`).join('');
    photosEl.querySelectorAll('button[data-key]').forEach((b) => {
      b.onclick = () => {
        const [kind, val] = b.dataset.key.split(':');
        if (kind === 'e') removedPhotoIds.push(val);
        else newFiles.splice(Number(val), 1);
        renderPhotos();
      };
    });
  }
  renderPhotos();
  for (const inputId of ['camera', 'gallery']) {
    const input = document.getElementById(inputId);
    input.onchange = () => {
      newFiles.push(...input.files);
      input.value = '';
      renderPhotos();
    };
  }

  // Beim Abhaken nach einer optionalen Bemerkung fragen
  const doneBox = document.getElementById('done');
  if (doneBox) {
    const wrap = document.getElementById('doneNoteWrap');
    const noteEl = document.getElementById('doneNote');
    doneBox.onchange = async () => {
      if (doneBox.checked) {
        const note = await askDoneNote(noteEl.value);
        if (note === null) { doneBox.checked = false; return; }
        noteEl.value = note;
      }
      wrap.hidden = !doneBox.checked;
    };
  }

  document.getElementById('cancel').onclick = () => { location.hash = back; };

  form.onsubmit = async (e) => {
    e.preventDefault();
    if (area.isOtherEmpty()) { toast('Bitte den Bereich eingeben.'); area.focusOther(); return; }
    const areaValue = area.getValue();
    const remark = document.getElementById('remark').value.trim();
    if (!areaValue && report.reason !== 'kurznachricht') { toast('Bitte einen Bereich auswählen.'); return; }
    if (!remark && !newFiles.length && !existingPhotos.length) { toast('Bitte einen offenen Punkt/eine Beschreibung oder ein Foto erfassen.'); return; }
    const saveBtn = document.getElementById('save');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Speichert …';
    point.area = areaValue;
    point.remark = remark;
    point.assignee = assignee.getValue();
    point.dueDate = document.getElementById('dueDate').value;
    point.isTodo = document.getElementById('isTodo').checked;
    const doneEl = document.getElementById('done');
    if (doneEl && doneEl.checked !== !!point.done) {
      point.done = doneEl.checked;
      point.doneAt = doneEl.checked ? Date.now() : null;
    }
    if (doneEl) point.doneNote = point.done ? document.getElementById('doneNote').value.trim() : '';
    try {
      await model.savePoint(point, { newFiles, removedPhotoIds });
      toast('Gespeichert');
      location.hash = back;
    } catch (err) {
      console.error(err);
      toast('Fehler beim Speichern: ' + err.message);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Speichern';
    }
  };

  const delBtn = document.getElementById('deletePoint');
  if (delBtn) delBtn.onclick = async () => {
    if (await confirmDialog('Diesen Punkt mit Fotos löschen?', { ok: 'Löschen', danger: true })) {
      await model.deletePoint(pid);
      toast('Punkt gelöscht');
      location.hash = back;
    }
  };
}
