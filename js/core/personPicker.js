// Personenauswahl ohne <datalist> (funktioniert zuverlässig in Chrome auf Android).
import { esc } from './ui.js';
import { pickOne, pickMany } from './picker.js';

const uniqueSorted = (names) =>
  [...new Set(names.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));

// Einzelauswahl: Feld wie ein Auswahlfeld, Antippen öffnet das dunkle Auswahlfenster
// (mit „– nicht zugewiesen –“ und „＋ Neue Person…“)
export function singlePerson(container, { value = '', persons = [], id = 'person' } = {}) {
  let current = value;
  let all = uniqueSorted([...persons, value]);

  container.innerHTML = `<button type="button" class="picker-field" id="${id}"></button>`;
  const field = container.querySelector('.picker-field');

  function render() {
    field.innerHTML = current ? `<span>${esc(current)}</span>` : '<span class="placeholder">Person auswählen</span>';
  }
  render();

  field.onclick = async () => {
    const picked = await pickOne({
      options: all,
      selected: current,
      emptyLabel: '– nicht zugewiesen –',
      allowAdd: true,
      addLabel: 'Neue Person',
      addPlaceholder: 'Name der neuen Person',
    });
    if (picked === null) return;
    current = picked;
    all = uniqueSorted([...all, picked]);
    render();
  };

  return {
    getValue: () => current,
    reset() { current = ''; render(); },
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
