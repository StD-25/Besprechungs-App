import * as model from '../model.js';
import { app, esc, setHeader, setActiveTab } from '../core/ui.js';
import { reportCards, bindReportCards } from './home.js';

const SORTS = {
  newest: { label: 'Neueste zuerst', fn: (a, b) => b.createdAt - a.createdAt },
  oldest: { label: 'Älteste zuerst', fn: (a, b) => a.createdAt - b.createdAt },
  name: { label: 'Name A–Z', fn: (a, b) => model.reportTitle(a).localeCompare(model.reportTitle(b), 'de') || b.createdAt - a.createdAt },
};
const filters = { group: '', sort: 'newest', search: '' }; // bleibt während der Sitzung erhalten

const lower = (text) => String(text || '').toLocaleLowerCase('de');

export async function render() {
  setHeader('Archiv');
  setActiveTab('archive');
  const reports = await model.listReports('archived');
  const groups = [...new Set(reports.map(model.reportGroup))].sort((a, b) => a.localeCompare(b, 'de'));
  if (filters.group && !groups.includes(filters.group)) filters.group = '';

  // Suchtext je Bericht: Name, Teilnehmer und alle „Offener Punkt/Beschreibung“-Texte
  const haystack = new Map();
  for (const r of reports) {
    const points = await model.getPoints(r.id);
    haystack.set(r.id, lower([model.reportTitle(r), r.participants, ...points.flatMap((p) => [p.remark, p.doneNote])].join('\n')));
  }

  app().innerHTML = `
    <div class="filters">
      <select id="fGroup">
        <option value="">Alle Gründe</option>
        ${groups.map((g) => `<option ${g === filters.group ? 'selected' : ''}>${esc(g)}</option>`).join('')}
      </select>
      <select id="fSort">
        ${Object.entries(SORTS).map(([k, s]) => `<option value="${k}" ${k === filters.sort ? 'selected' : ''}>${s.label}</option>`).join('')}
      </select>
    </div>
    <input type="search" id="fSearch" value="${esc(filters.search)}" placeholder="🔍 Bericht, Name oder Punkt suchen" autocomplete="off">
    <h2 id="archiveCount"></h2>
    <div id="archiveList"></div>`;

  // Nur die Liste neu aufbauen, damit das Suchfeld beim Tippen den Fokus behält
  let renderId = 0;
  async function renderList() {
    const id = ++renderId;
    const q = lower(filters.search.trim());
    const list = reports
      .filter((r) => !filters.group || model.reportGroup(r) === filters.group)
      .filter((r) => !q || haystack.get(r.id).includes(q))
      .sort(SORTS[filters.sort].fn);
    const html = await reportCards(list);
    if (id !== renderId) return; // inzwischen weitergetippt
    document.getElementById('archiveCount').textContent = `Archivierte Berichte (${list.length})`;
    const listEl = document.getElementById('archiveList');
    listEl.innerHTML = html;
    bindReportCards(listEl);
  }

  document.getElementById('fGroup').onchange = (e) => { filters.group = e.target.value; renderList(); };
  document.getElementById('fSort').onchange = (e) => { filters.sort = e.target.value; renderList(); };
  document.getElementById('fSearch').oninput = (e) => { filters.search = e.target.value; renderList(); };

  await renderList();
}
