// Auswahlfenster mit Mehrfachauswahl im Stil des Android-Systemfensters.
import { esc } from './ui.js';

const sortDe = (list) => [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));

/**
 * Zeigt ein dunkles Auswahlfenster. Löst mit der neuen Auswahl auf (OK)
 * oder mit null (Abbrechen / neben das Fenster getippt).
 * allowAdd: Zeile „＋ Neue …“ zum Ergänzen eines Eintrags.
 */
export function pickMany({ options = [], selected = [], allowAdd = true, addLabel = 'Neue Person', addPlaceholder = 'Name' } = {}) {
  return new Promise((resolve) => {
    let all = sortDe([...options, ...selected]);
    const chosen = new Set(selected);

    const ov = document.createElement('div');
    ov.className = 'picker-overlay';
    ov.innerHTML = `
      <div class="picker-sheet" role="dialog" aria-modal="true">
        ${allowAdd ? `
          <button type="button" class="picker-add">＋ ${esc(addLabel)}…</button>
          <div class="picker-add-form" hidden>
            <input type="text" placeholder="${esc(addPlaceholder)}" autocomplete="off">
            <button type="button" class="picker-btn">Hinzufügen</button>
          </div>` : ''}
        <div class="picker-list"></div>
        <div class="picker-actions">
          <button type="button" class="picker-btn" data-act="cancel">Abbrechen</button>
          <button type="button" class="picker-btn" data-act="ok">OK</button>
        </div>
      </div>`;
    const list = ov.querySelector('.picker-list');

    function renderList() {
      list.innerHTML = all.length
        ? all.map((name) => `
          <button type="button" class="picker-row ${chosen.has(name) ? 'on' : ''}" data-name="${esc(name)}" aria-pressed="${chosen.has(name)}">
            <span>${esc(name)}</span><span class="picker-mark" aria-hidden="true"></span>
          </button>`).join('')
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

    const finish = (result) => {
      ov.remove();
      document.body.style.overflow = '';
      resolve(result);
    };
    ov.querySelector('[data-act="cancel"]').onclick = () => finish(null);
    // Auswahl in der Reihenfolge der Liste zurückgeben
    ov.querySelector('[data-act="ok"]').onclick = () => finish(all.filter((n) => chosen.has(n)));
    ov.addEventListener('click', (e) => { if (e.target === ov) finish(null); });

    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
  });
}
