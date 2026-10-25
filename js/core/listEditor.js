// Bearbeitbare Liste (Einstellungen): umbenennen, sortieren, entfernen, hinzufügen.
import { esc, toast, confirmDialog } from './ui.js';

/**
 * items:    [{ label, ... }] – zusätzliche Felder (z.B. id) bleiben erhalten
 * onSave:   async (items) => void, wird nach jeder Änderung aufgerufen
 * makeItem: (label) => neues Element
 * noun:     Bezeichnung für Meldungen, z.B. „Grund“ oder „Bereich“
 */
export function listEditor(container, { items, onSave, makeItem = (label) => ({ label }), noun = 'Eintrag', addPlaceholder = 'Neuen Eintrag hinzufügen' }) {
  let list = items.map((it) => ({ ...it }));

  async function save(msg) {
    await onSave(list);
    toast(msg);
    render();
  }

  function render() {
    container.innerHTML = `
      ${list.map((it, i) => `
        <div class="reason-row">
          <input type="text" data-edit="${i}" value="${esc(it.label)}" aria-label="${esc(noun)} ${i + 1}">
          <button type="button" class="btn secondary small" data-move="${i}:-1" ${i === 0 ? 'disabled' : ''} aria-label="nach oben">↑</button>
          <button type="button" class="btn secondary small" data-move="${i}:1" ${i === list.length - 1 ? 'disabled' : ''} aria-label="nach unten">↓</button>
          <button type="button" class="btn danger-outline small" data-remove="${i}">Entfernen</button>
        </div>`).join('')}
      <form class="list-add" style="display:flex;gap:8px;margin-top:12px">
        <input type="text" placeholder="${esc(addPlaceholder)}">
        <button class="btn" type="submit">＋</button>
      </form>`;

    const exists = (label, except = -1) =>
      list.some((it, i) => i !== except && it.label.toLowerCase() === label.toLowerCase());

    container.querySelectorAll('[data-edit]').forEach((input) => {
      input.onchange = () => {
        const i = Number(input.dataset.edit);
        const label = input.value.trim();
        if (!label) { toast('Der Name darf nicht leer sein.'); input.value = list[i].label; return; }
        if (exists(label, i)) { toast(`Diesen ${noun} gibt es schon.`); input.value = list[i].label; return; }
        list[i].label = label;
        save(`${noun} gespeichert`);
      };
    });
    container.querySelectorAll('[data-move]').forEach((b) => {
      b.onclick = () => {
        const [i, dir] = b.dataset.move.split(':').map(Number);
        [list[i], list[i + dir]] = [list[i + dir], list[i]];
        save('Reihenfolge gespeichert');
      };
    });
    container.querySelectorAll('[data-remove]').forEach((b) => {
      b.onclick = async () => {
        const i = Number(b.dataset.remove);
        if (await confirmDialog(`${noun} „${list[i].label}“ entfernen?\n\nBestehende Berichte und Punkte behalten ihren Eintrag.`, { ok: 'Entfernen', danger: true })) {
          list.splice(i, 1);
          save(`${noun} entfernt`);
        }
      };
    });
    container.querySelector('.list-add').onsubmit = (e) => {
      e.preventDefault();
      const input = e.target.querySelector('input');
      const label = input.value.trim();
      if (!label) return;
      if (exists(label)) { toast(`Diesen ${noun} gibt es schon.`); return; }
      list.push(makeItem(label));
      save(`${noun} hinzugefügt`);
    };
  }
  render();

  return {
    setItems(next) { list = next.map((it) => ({ ...it })); render(); },
  };
}
