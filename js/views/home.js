import * as model from '../model.js';
import { REASONS } from '../config.js';
import { app, esc, setHeader, setActiveTab, toast } from '../core/ui.js';
import { formatDateTime } from '../core/filename.js';

export async function reportCards(reports) {
  if (!reports.length) return '<p class="empty">Keine Berichte vorhanden.</p>';
  const cards = [];
  for (const r of reports) {
    const points = await model.getPoints(r.id);
    const open = points.filter((p) => p.isTodo && !p.done).length;
    cards.push(`
      <div class="card clickable" data-report="${r.id}">
        <div class="title">${esc(model.reportTitle(r))}</div>
        <div class="meta">${formatDateTime(r.createdAt)} · ${points.length} Punkte
          ${open ? `· <span class="badge open">${open} offen</span>` : points.length ? '· <span class="badge done">alles erledigt</span>' : ''}</div>
        ${r.participants ? `<div class="meta">Teilnehmer: ${esc(r.participants)}</div>` : ''}
      </div>`);
  }
  return cards.join('');
}

export function bindReportCards(root) {
  root.querySelectorAll('[data-report]').forEach((el) => {
    el.onclick = () => { location.hash = `#/report/${el.dataset.report}`; };
  });
}

export async function render() {
  setHeader('Besprechungsprotokoll');
  setActiveTab('home');
  const reports = await model.listReports('open');
  app().innerHTML = `
    <div class="card">
      <h2 style="margin-top:0">Neuer Bericht</h2>
      <form id="newReport">
        <label>Grund der Besprechung</label>
        <div class="radio-group">
          ${REASONS.filter((r) => !r.hidden).map((r, i) => `
            <label class="choice"><input type="radio" name="reason" value="${r.id}" ${i === 0 ? 'checked' : ''}> ${esc(r.label)}</label>`).join('')}
        </div>
        <div id="customWrap" hidden>
          <label for="customName">Name der Besprechung</label>
          <input type="text" id="customName" placeholder="z.B. Abteilungsrunde">
        </div>
        <label for="participants">Teilnehmer</label>
        <input type="text" id="participants" placeholder="Namen, durch Komma getrennt" list="personsList" autocomplete="off">
        <datalist id="personsList"></datalist>
        <button class="btn block" style="margin-top:16px" type="submit">Bericht starten</button>
      </form>
    </div>
    <a class="btn secondary block link-btn" href="kurz/">✉ Kurznachricht erfassen</a>
    <h2>Offene Berichte</h2>
    <div id="reports">${await reportCards(reports)}</div>`;

  const persons = await model.listPersons();
  document.getElementById('personsList').innerHTML = persons.map((p) => `<option value="${esc(p)}">`).join('');

  const form = document.getElementById('newReport');
  const customWrap = document.getElementById('customWrap');
  form.addEventListener('change', () => {
    customWrap.hidden = form.reason.value !== 'sonstige';
  });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const reason = form.reason.value;
    const customName = document.getElementById('customName').value.trim();
    if (reason === 'sonstige' && !customName) {
      toast('Bitte einen Namen für die Besprechung eintragen.');
      return;
    }
    const report = await model.createReport({
      reason,
      customName,
      participants: document.getElementById('participants').value.trim(),
    });
    location.hash = `#/report/${report.id}`;
  };
  bindReportCards(app());
}
