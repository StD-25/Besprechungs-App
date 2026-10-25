// Kurznachricht: schnell einen offenen Punkt erfassen.
// Nutzt dieselbe Datenbank wie das Besprechungsprotokoll (gleiche Herkunft).
import * as model from '../js/model.js';
import { esc, toast } from '../js/core/ui.js';
import { formatDateTime } from '../js/core/filename.js';

const $ = (id) => document.getElementById(id);

async function fill() {
  $('stamp').textContent = formatDateTime(Date.now());
  const persons = await model.listPersons();
  $('persons').innerHTML = persons.map((p) => `<option value="${esc(p)}">`).join('');
  if (!$('author').value) $('author').value = await model.getSetting('myName');
}

function reset() {
  $('text').value = '';
  $('assignee').value = '';
  $('dueDate').value = '';
  fill();
  $('text').focus();
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
  const author = $('author').value.trim();
  $('save').disabled = true;
  try {
    await model.addQuickMessage({
      author,
      text,
      assignee: $('assignee').value.trim(),
      dueDate: $('dueDate').value,
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
  }
};

// Uhrzeit aktuell halten, solange das Fenster offen ist
setInterval(() => { $('stamp').textContent = formatDateTime(Date.now()); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) fill(); });

fill();
navigator.storage?.persist?.();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('../service-worker.js', { scope: '../' }).catch(console.error);
}
