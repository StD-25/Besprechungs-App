// Personenauswahl ohne <datalist> (funktioniert zuverlässig in Chrome auf Android).
import { esc } from './ui.js';
import { pickMany } from './picker.js';

const NEW = '__new__';

const uniqueSorted = (names) =>
  [...new Set(names.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));

// Einzelauswahl: Auswahlliste + „Neue Person eintragen…“
export function singlePerson(container, { value = '', persons = [], id = 'person' } = {}) {
  const list = uniqueSorted([...persons, value]);
  container.innerHTML = `
    <select id="${id}">
      <option value="">– bitte wählen –</option>
      ${list.map((p) => `<option ${p === value ? 'selected' : ''}>${esc(p)}</option>`).join('')}
      <option value="${NEW}">＋ Neue Person eintragen…</option>
    </select>
    <input type="text" id="${id}New" placeholder="Name der neuen Person" hidden style="margin-top:8px">`;
  const select = container.querySelector('select');
  const input = container.querySelector('input');
  select.onchange = () => {
    input.hidden = select.value !== NEW;
    if (!input.hidden) input.focus();
  };
  return {
    getValue: () => (select.value === NEW ? input.value.trim() : select.value),
    reset() { select.value = ''; input.value = ''; input.hidden = true; },
  };
}

// Mehrfachauswahl: Feld wie ein Auswahlfeld, Antippen öffnet das dunkle Auswahlfenster
export function multiPerson(container, { value = '', persons = [], disabled = false, onChange } = {}) {
  const split = (text) => String(text || '').split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  let selected = split(value);
  let all = uniqueSorted([...persons, ...selected]);

  container.innerHTML = `<button type="button" class="picker-field" ${disabled ? 'disabled' : ''}></button>`;
  const field = container.querySelector('.picker-field');

  function render() {
    field.innerHTML = selected.length
      ? `<span>${esc(selected.join(', '))}</span>`
      : '<span class="placeholder">Teilnehmer auswählen</span>';
  }
  render();

  field.onclick = async () => {
    const result = await pickMany({ options: all, selected, addLabel: 'Neue Person', addPlaceholder: 'Name der neuen Person' });
    if (!result) return;
    selected = result;
    all = uniqueSorted([...all, ...result]);
    render();
    onChange?.();
  };

  return {
    getValue: () => selected.join(', '),
  };
}
