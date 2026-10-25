// Bereichsauswahl: eine aufklappbare Liste + „Sonstiges“ mit freiem Text.
import { AREAS, AREA_OTHER } from '../config.js';
import { esc } from './ui.js';

let counter = 0;

export function areaPicker(container, { value = '' } = {}) {
  const name = `area${++counter}`;
  const isOther = !!value && !AREAS.includes(value);
  const choice = isOther ? AREA_OTHER : value;
  container.innerHTML = `
    <div class="selected-area" ${value ? '' : 'hidden'}>${esc(value)}</div>
    <details class="area-group">
      <summary>Bereich auswählen</summary>
      <div class="radio-group">
        ${[...AREAS, AREA_OTHER].map((a) => `<label class="choice"><input type="radio" name="${name}" value="${esc(a)}" ${a === choice ? 'checked' : ''}> ${esc(a)}</label>`).join('')}
      </div>
    </details>
    <input type="text" class="area-other" value="${isOther ? esc(value) : ''}" placeholder="Bereich eingeben" ${isOther ? '' : 'hidden'}>`;

  const chip = container.querySelector('.selected-area');
  const details = container.querySelector('details');
  const other = container.querySelector('.area-other');

  // Auswahl → Liste schließt sich, gewählter Bereich wird angezeigt
  container.querySelectorAll(`input[name="${name}"]`).forEach((r) => {
    r.onchange = () => {
      details.open = false;
      chip.textContent = r.value;
      chip.hidden = false;
      other.hidden = r.value !== AREA_OTHER;
      if (!other.hidden) other.focus();
    };
  });

  const selected = () => container.querySelector(`input[name="${name}"]:checked`)?.value || '';

  return {
    getValue: () => (selected() === AREA_OTHER ? other.value.trim() : selected()),
    // „Sonstiges“ gewählt, aber kein Text eingetragen
    isOtherEmpty: () => selected() === AREA_OTHER && !other.value.trim(),
    focusOther: () => other.focus(),
    reset() {
      container.querySelectorAll(`input[name="${name}"]`).forEach((r) => { r.checked = false; });
      chip.hidden = true;
      other.value = '';
      other.hidden = true;
      details.open = false;
    },
  };
}
