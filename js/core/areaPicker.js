// Bereichsauswahl: Feld öffnet das dunkle Auswahlfenster, „Sonstiges“ mit freiem Text.
import { AREA_OTHER } from '../config.js';
import { esc } from './ui.js';
import { pickOne } from './picker.js';

export function areaPicker(container, { value = '', areas = [] } = {}) {
  const isOther = !!value && !areas.includes(value);
  let choice = isOther ? AREA_OTHER : value;

  container.innerHTML = `
    <button type="button" class="picker-field area-field"></button>
    <input type="text" class="area-other" value="${isOther ? esc(value) : ''}" placeholder="Bereich eingeben" ${isOther ? '' : 'hidden'}>`;
  const field = container.querySelector('.area-field');
  const other = container.querySelector('.area-other');

  function render() {
    field.innerHTML = choice ? `<span>${esc(choice)}</span>` : '<span class="placeholder">Bereich auswählen</span>';
    other.hidden = choice !== AREA_OTHER;
  }
  render();

  field.onclick = async () => {
    const picked = await pickOne({ options: [...areas, AREA_OTHER], selected: choice, rows: 9 });
    if (picked === null) return;
    choice = picked;
    render();
    if (choice === AREA_OTHER) other.focus();
  };

  return {
    getValue: () => (choice === AREA_OTHER ? other.value.trim() : choice),
    // „Sonstiges“ gewählt, aber kein Text eingetragen
    isOtherEmpty: () => choice === AREA_OTHER && !other.value.trim(),
    focusOther: () => other.focus(),
    reset() {
      choice = '';
      other.value = '';
      render();
    },
  };
}
