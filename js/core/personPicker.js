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

// Mehrfachauswahl: Textfeld zum Eintippen + ▾ öffnet Liste zum Anhaken mehrerer Personen
export function multiPerson(container, { value = '', persons = [], disabled = false, onChange } = {}) {
  const split = (text) => String(text || '').split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
  let all = uniqueSorted([...persons, ...split(value)]);

  container.innerHTML = `
    <div class="multi-select">
      <div class="ms-row">
        <input type="text" class="ms-input" value="${esc(split(value).join(', '))}" placeholder="Namen eintragen oder auswählen" autocomplete="off" ${disabled ? 'disabled' : ''}>
        ${disabled ? '' : '<button type="button" class="ms-toggle" aria-label="Personen auswählen">▾</button>'}
      </div>
      <div class="ms-panel" hidden></div>
    </div>`;
  const input = container.querySelector('.ms-input');
  const toggle = container.querySelector('.ms-toggle');
  const panel = container.querySelector('.ms-panel');

  function renderPanel() {
    const chosen = new Set(split(input.value));
    all = uniqueSorted([...all, ...chosen]);
    panel.innerHTML = `
      ${all.length ? all.map((p) => `
        <label class="ms-item"><input type="checkbox" value="${esc(p)}" ${chosen.has(p) ? 'checked' : ''}> ${esc(p)}</label>`).join('')
        : '<p class="meta">Noch keine Personen gespeichert – Namen einfach oben eintippen.</p>'}
      <button type="button" class="btn small ms-done">Fertig</button>`;
    panel.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.onchange = () => {
        const names = split(input.value).filter((n) => n !== cb.value);
        if (cb.checked) names.push(cb.value);
        input.value = names.join(', ');
        onChange?.();
      };
    });
    panel.querySelector('.ms-done').onclick = close;
  }

  function close() {
    panel.hidden = true;
    toggle?.classList.remove('open');
  }

  if (toggle) {
    toggle.onclick = () => {
      if (!panel.hidden) return close();
      renderPanel();
      panel.hidden = false;
      toggle.classList.add('open');
    };
  }
  input.onchange = () => {
    input.value = split(input.value).join(', ');
    if (!panel.hidden) renderPanel();
    onChange?.();
  };

  return {
    getValue: () => split(input.value).join(', '),
  };
}
