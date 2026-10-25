// Kurznachricht: schnell einen offenen Punkt erfassen.
// Nutzt dieselbe Datenbank wie das Besprechungsprotokoll (gleiche Herkunft).
import * as model from '../js/model.js';
import { toast, objectURL, releaseObjectURLs } from '../js/core/ui.js';
import { formatDateTime } from '../js/core/filename.js';
import { singlePerson } from '../js/core/personPicker.js';
import { areaPicker } from '../js/core/areaPicker.js';
import { registerServiceWorker } from '../js/core/swUpdate.js';

const $ = (id) => document.getElementById(id);
let assignee;
const area = areaPicker($('areaPicker'), { areas: await model.listAreas() });
let files = [];

async function fill() {
  $('stamp').textContent = formatDateTime(Date.now());
  const current = assignee?.getValue() || '';
  assignee = singlePerson($('assigneePicker'), { value: current, persons: await model.listPersons(), id: 'assignee' });
  if (!$('author').value) $('author').value = await model.getSetting('myName');
}

function renderPhotos() {
  releaseObjectURLs();
  $('photos').innerHTML = files.map((f, i) => `
    <div class="ph"><img class="thumb" src="${objectURL(f)}" alt=""><button type="button" data-i="${i}" aria-label="Foto entfernen">×</button></div>`).join('');
  $('photos').querySelectorAll('button[data-i]').forEach((b) => {
    b.onclick = () => { files.splice(Number(b.dataset.i), 1); renderPhotos(); };
  });
}

for (const id of ['camera', 'gallery']) {
  $(id).onchange = () => {
    files.push(...$(id).files);
    $(id).value = '';
    renderPhotos();
  };
}

function reset() {
  $('text').value = '';
  $('dueDate').value = '';
  area.reset();
  assignee.reset();
  files = [];
  renderPhotos();
  fill();
}

$('cancel').onclick = () => {
  reset();
  toast('Verworfen');
};

$('quickForm').onsubmit = async (e) => {
  e.preventDefault();
  const text = $('text').value.trim();
  if (!text) {
    toast('Bitte einen offenen Punkt/eine Beschreibung eingeben.');
    $('text').focus();
    return;
  }
  if (area.isOtherEmpty()) {
    toast('Bitte den Bereich eingeben.');
    area.focusOther();
    return;
  }
  const author = $('author').value.trim();
  $('save').disabled = true;
  $('save').textContent = 'Speichert …';
  try {
    await model.addQuickMessage({
      author,
      text,
      area: area.getValue(),
      assignee: assignee.getValue(),
      dueDate: $('dueDate').value,
      files,
    });
    // Ersten eingegebenen Namen als „Mein Name“ merken
    if (author && !(await model.getSetting('myName'))) await model.setSetting('myName', author);
    toast('Gespeichert – als offene Aufgabe übernommen');
    reset();
  } catch (err) {
    console.error(err);
    toast('Fehler beim Speichern: ' + err.message, 4000);
  } finally {
    $('save').disabled = false;
    $('save').textContent = 'Speichern';
  }
};

// Uhrzeit aktuell halten, solange das Fenster offen ist
setInterval(() => { $('stamp').textContent = formatDateTime(Date.now()); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) fill(); });

fill();
navigator.storage?.persist?.();
registerServiceWorker('../service-worker.js', '../');
