// Personenauswahl ohne <datalist> (funktioniert zuverlässig in Chrome auf Android).
import { esc } from './ui.js';

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

// Mehrfachauswahl über <select multiple>: Auf Android öffnet sich das Auswahlfenster
// des Systems (scrollbare Liste mit Häkchen), am PC eine Liste mit 5 Zeilen.
export function multiPerson(container, { value = '', persons = [], disabled = false, onChange } = {}) {
  const split = (text) => String(text || '').split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  const selected = new Set(split(value));
  let all = uniqueSorted([...persons, ...selected]);

  container.innerHTML = `
    <select multiple size="5" class="person-select" ${disabled ? 'disabled' : ''}></select>
    <div class="meta person-selected"></div>
    ${disabled ? '' : `
    <div class="add-person">
      <input type="text" placeholder="Neue Person eintragen">
      <button type="button" class="btn secondary">Hinzufügen</button>
    </div>`}`;
  const select = container.querySelector('select');
  const info = container.querySelector('.person-selected');

  function render() {
    select.innerHTML = all.length
      ? all.map((p) => `<option ${selected.has(p) ? 'selected' : ''}>${esc(p)}</option>`).join('')
      : '<option disabled>Noch keine Personen – unten eintragen</option>';
    info.textContent = selected.size ? `Ausgewählt: ${[...selected].join(', ')}` : 'Noch niemand ausgewählt';
  }
  render();

  select.onchange = () => {
    selected.clear();
    [...select.selectedOptions].forEach((o) => selected.add(o.value));
    render();
    onChange?.();
  };

  const input = container.querySelector('.add-person input');
  if (input) {
    const add = () => {
      const name = input.value.trim();
      if (!name) return;
      selected.add(name);
      all = uniqueSorted([...all, name]);
      input.value = '';
      render();
      onChange?.();
    };
    container.querySelector('.add-person button').onclick = add;
    input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
  }

  return {
    // Ein noch nicht per „Hinzufügen“ übernommener Name wird mitgenommen
    getValue: () => [...selected, input?.value.trim()].filter(Boolean).join(', '),
  };
}
