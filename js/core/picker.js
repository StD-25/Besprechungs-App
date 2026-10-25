// Auswahlfenster im Stil des Android-Systemfensters (dunkel, Zeilen mit Kreis rechts).
import { esc } from './ui.js';

const sortDe = (list) => [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
const ROW_HEIGHT = 52;

const rowHtml = (name, on) => `
  <button type="button" class="picker-row ${on ? 'on' : ''}" data-name="${esc(name)}" aria-pressed="${on}">
    <span>${esc(name)}</span><span class="picker-mark" aria-hidden="true"></span>
  </button>`;

// Gemeinsames Grundgerüst: Overlay, Fenster, Liste, Schaltflächen unten
function openSheet({ top = '', actions, rows }) {
  const ov = document.createElement('div');
  ov.className = 'picker-overlay';
  ov.innerHTML = `
    <div class="picker-sheet" role="dialog" aria-modal="true">
      ${top}
      <div class="picker-list" style="max-height:min(${ROW_HEIGHT * rows}px, 75vh)"></div>
      <div class="picker-actions">
        ${actions.map((a) => `<button type="button" class="picker-btn" data-act="${a}">${a === 'ok' ? 'OK' : 'Abbrechen'}</button>`).join('')}
      </div>
    </div>`;
  document.body.appendChild(ov);
  document.body.style.overflow = 'hidden';
  const close = () => {
    ov.remove();
    document.body.style.overflow = '';
  };
  return { ov, list: ov.querySelector('.picker-list'), close };
}

/**
 * Einfachauswahl: Antippen wählt und schließt sofort.
 * Löst mit dem gewählten Eintrag auf oder mit null (Abbrechen / daneben getippt).
 */
export function pickOne({ options = [], selected = '', rows = 9 } = {}) {
  return new Promise((resolve) => {
    const { ov, list, close } = openSheet({ actions: ['cancel'], rows });
    list.innerHTML = options.map((o) => rowHtml(o, o === selected)).join('');
    list.querySelector('.picker-row.on')?.scrollIntoView({ block: 'center' });

    const finish = (result) => { close(); resolve(result); };
    list.addEventListener('click', (e) => {
      const row = e.target.closest('.picker-row');
      if (row) finish(row.dataset.name);
    });
    ov.querySelector('[data-act="cancel"]').onclick = () => finish(null);
    ov.addEventListener('click', (e) => { if (e.target === ov) finish(null); });
  });
}

/**
 * Mehrfachauswahl: Antippen kreuzt an/ab, Übernahme mit OK.
 * Löst mit der neuen Auswahl auf (OK) oder mit null (Abbrechen / daneben getippt).
 * allowAdd: Zeile „＋ Neue …“ zum Ergänzen eines Eintrags.
 */
export function pickMany({ options = [], selected = [], allowAdd = true, addLabel = 'Neue Person', addPlaceholder = 'Name', rows = 5.5 } = {}) {
  return new Promise((resolve) => {
    let all = sortDe([...options, ...selected]);
    const chosen = new Set(selected);

    const { ov, list, close } = openSheet({
      rows,
      actions: ['cancel', 'ok'],
      top: allowAdd ? `
        <button type="button" class="picker-add">＋ ${esc(addLabel)}…</button>
        <div class="picker-add-form" hidden>
          <input type="text" placeholder="${esc(addPlaceholder)}" autocomplete="off">
          <button type="button" class="picker-btn">Hinzufügen</button>
        </div>` : '',
    });

    function renderList() {
      list.innerHTML = all.length
        ? all.map((name) => rowHtml(name, chosen.has(name))).join('')
        : '<p class="picker-empty">Noch keine Einträge – oben hinzufügen.</p>';
    }
    renderList();

    list.addEventListener('click', (e) => {
      const row = e.target.closest('.picker-row');
      if (!row) return;
      const name = row.dataset.name;
      if (chosen.has(name)) chosen.delete(name); else chosen.add(name);
      row.classList.toggle('on', chosen.has(name));
      row.setAttribute('aria-pressed', chosen.has(name));
    });

    if (allowAdd) {
      const form = ov.querySelector('.picker-add-form');
      const input = form.querySelector('input');
      ov.querySelector('.picker-add').onclick = () => {
        form.hidden = false;
        input.focus();
      };
      const add = () => {
        const name = input.value.trim();
        if (!name) return;
        chosen.add(name);
        all = sortDe([...all, name]);
        input.value = '';
        form.hidden = true;
        renderList();
        list.querySelector(`[data-name="${CSS.escape(name)}"]`)?.scrollIntoView({ block: 'nearest' });
      };
      form.querySelector('button').onclick = add;
      input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
    }

    const finish = (result) => { close(); resolve(result); };
    ov.querySelector('[data-act="cancel"]').onclick = () => finish(null);
    // Auswahl in der Reihenfolge der Liste zurückgeben
    ov.querySelector('[data-act="ok"]').onclick = () => finish(all.filter((n) => chosen.has(n)));
    ov.addEventListener('click', (e) => { if (e.target === ov) finish(null); });
  });
}
