import * as model from '../model.js';
import { app, esc, setHeader, setActiveTab, toast, actionDialog, objectURL } from '../core/ui.js';
import { formatDateTime, formatDue } from '../core/filename.js';
import { download, shareFile } from '../core/share.js';
import { todosPdf } from '../export.js';

const NONE = '__none__';
const STATUS_LABEL = { open: 'Offen', done: 'Erledigt', all: 'Alle' };
const filters = { person: '', status: 'open' }; // bleibt während der Sitzung erhalten

export async function render() {
  setHeader('Aufgaben');
  setActiveTab('todos');
  const all = await model.listTodos(); // neueste oben
  const persons = [...new Set([...(await model.listPersons()), ...all.map((t) => t.assignee).filter(Boolean)])]
    .sort((a, b) => a.localeCompare(b, 'de'));

  const list = all.filter((t) =>
    (filters.status === 'all' || (filters.status === 'done') === !!t.done) &&
    (!filters.person || (filters.person === NONE ? !t.assignee : t.assignee === filters.person)));

  const cards = [];
  for (const t of list) {
    const photo = (await model.getPhotos(t.id))[0];
    cards.push(`
      <div class="card point ${t.done ? 'done' : ''}">
        <label class="check" style="margin:0;align-self:flex-start"><input type="checkbox" data-done="${t.id}" ${t.done ? 'checked' : ''} aria-label="erledigt"></label>
        ${photo ? `<div class="thumbs"><img class="thumb" src="${objectURL(photo.thumb)}" alt=""></div>` : ''}
        <div class="body">
          <div>${t.area ? `<span class="badge">${esc(t.area)}</span>` : ''} <span class="badge ${t.done ? 'done' : 'open'}">${t.done ? 'erledigt' : 'offen'}</span>
            ${t.dueDate ? `<span class="badge ${model.isOverdue(t) ? 'overdue' : ''}">bis ${formatDue(t.dueDate)}</span>` : ''}</div>
          <div class="remark">${esc(t.remark)}</div>
          <div class="meta">${formatDateTime(t.createdAt)} · <a href="#/report/${t.reportId}/point/${t.id}">${esc(model.reportLabel(t.report))}</a></div>
          <select data-assign="${t.id}" style="margin-top:8px">
            <option value="">– nicht zugewiesen –</option>
            ${persons.map((p) => `<option ${p === t.assignee ? 'selected' : ''}>${esc(p)}</option>`).join('')}
          </select>
        </div>
      </div>`);
  }

  app().innerHTML = `
    <div class="filters">
      <select id="fPerson">
        <option value="">Alle Personen</option>
        <option value="${NONE}" ${filters.person === NONE ? 'selected' : ''}>Ohne Zuständigkeit</option>
        ${persons.map((p) => `<option ${p === filters.person ? 'selected' : ''}>${esc(p)}</option>`).join('')}
      </select>
      <select id="fStatus">
        ${Object.entries(STATUS_LABEL).map(([k, v]) => `<option value="${k}" ${k === filters.status ? 'selected' : ''}>${v}</option>`).join('')}
      </select>
    </div>
    <div class="btn-row"><button class="btn" id="pdf" ${list.length ? '' : 'disabled'}>Aufgaben-PDF erstellen (${list.length})</button></div>
    ${cards.length ? cards.join('') : '<p class="empty">Keine Aufgaben für diese Auswahl.</p>'}`;

  document.getElementById('fPerson').onchange = (e) => { filters.person = e.target.value; render(); };
  document.getElementById('fStatus').onchange = (e) => { filters.status = e.target.value; render(); };

  app().querySelectorAll('[data-done]').forEach((cb) => {
    cb.onchange = async () => {
      const p = await model.getPoint(cb.dataset.done);
      await model.setDone(p, cb.checked);
      toast(cb.checked ? 'Als erledigt markiert' : 'Wieder offen');
      render();
    };
  });
  app().querySelectorAll('[data-assign]').forEach((sel) => {
    sel.onchange = async () => {
      const p = await model.getPoint(sel.dataset.assign);
      p.assignee = sel.value;
      await model.savePoint(p);
      toast(sel.value ? `Zugewiesen an ${sel.value}` : 'Zuweisung entfernt');
      render();
    };
  });

  document.getElementById('pdf').onclick = async () => {
    const person = filters.person === NONE ? 'Ohne Zuständigkeit' : filters.person;
    const pdf = await todosPdf(list, { person, status: STATUS_LABEL[filters.status] });
    await actionDialog(`${pdf.filename} (${Math.round(pdf.blob.size / 1024)} KB) wurde erstellt.`, [
      { label: '✉ Per E-Mail senden', run: () => shareFile(pdf.blob, pdf.filename, { title: pdf.title, text: `Anbei die ${pdf.title}.` }) },
      { label: '⤓ PDF speichern', cls: 'secondary', close: false, run: () => download(pdf.blob, pdf.filename) },
      { label: 'Schließen', cls: 'danger-outline' },
    ]);
    location.hash = '#/';
  };
}
