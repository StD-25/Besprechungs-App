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

// Mehrfachauswahl: Personen als Chips zum Antippen + neuen Namen hinzufügen
export function multiPerson(container, { value = '', persons = [], disabled = false, onChange } = {}) {
  const selected = new Set(String(value).split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean));
  let all = uniqueSorted([...persons, ...selected]);

  function render() {
    container.innerHTML = `
      <div class="radio-group person-chips">
        ${all.length ? all.map((p) => `
          <label class="choice"><input type="checkbox" value="${esc(p)}" ${selected.has(p) ? 'checked' : ''} ${disabled ? 'disabled' : ''}> ${esc(p)}</label>`).join('')
          : '<span class="meta">Noch keine Personen – unten eintragen.</span>'}
      </div>
      ${disabled ? '' : `
      <div class="add-person">
        <input type="text" placeholder="Neuen Namen eintragen">
        <button type="button" class="btn secondary">Hinzufügen</button>
      </div>`}`;
    container.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.onchange = () => {
        if (cb.checked) selected.add(cb.value); else selected.delete(cb.value);
        onChange?.();
      };
    });
    const input = container.querySelector('.add-person input');
    const add = () => {
      const name = input.value.trim();
      if (!name) return;
      selected.add(name);
      all = uniqueSorted([...all, name]);
      render();
      onChange?.();
    };
    if (input) {
      container.querySelector('.add-person button').onclick = add;
      input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
    }
  }
  render();

  return {
    // Ein noch nicht per „Hinzufügen“ übernommener Name wird mitgenommen
    getValue() {
      const pending = container.querySelector('.add-person input')?.value.trim();
      return uniqueSorted([...selected, pending]).join(', ');
    },
  };
}
