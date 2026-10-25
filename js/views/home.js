import * as model from '../model.js';
import { app, esc, setHeader, setActiveTab, toast } from '../core/ui.js';
import { formatDateTime } from '../core/filename.js';
import { multiPerson } from '../core/personPicker.js';

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
  const reasons = await model.listReasons();
  // Oberer Teil bleibt stehen, nur die Liste der offenen Berichte scrollt
  app().classList.add('split');
  app().innerHTML = `
    <div class="home-top">
    <div class="card">
      <h2 style="margin-top:0">Neuer Bericht</h2>
      <form id="newReport">
        <label for="reason">Grund der Besprechung</label>
        <select id="reason">
          ${reasons.map((r) => `<option value="${esc(r.id)}">${esc(r.label)}</option>`).join('')}
        </select>
        <div id="customWrap" hidden>
          <label for="customName">Name der Besprechung</label>
          <input type="text" id="customName" placeholder="z.B. Abteilungsrunde">
        </div>
        <label>Teilnehmer</label>
        <div id="participants"></div>
        <button class="btn block" style="margin-top:16px" type="submit">Bericht starten</button>
      </form>
    </div>
    <a class="btn secondary block link-btn" href="kurz/">✉ Kurznachricht erfassen</a>
    <h2>Offene Berichte (${reports.length})</h2>
    </div>
    <div class="home-list" id="reports">${await reportCards(reports)}</div>`;

  const participants = multiPerson(document.getElementById('participants'), { persons: await model.listPersons() });

  const form = document.getElementById('newReport');
  const customWrap = document.getElementById('customWrap');
  const reasonSelect = document.getElementById('reason');
  reasonSelect.onchange = () => {
    customWrap.hidden = reasonSelect.value !== 'sonstige';
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const reason = reasonSelect.value;
    const customName = document.getElementById('customName').value.trim();
    if (reason === 'sonstige' && !customName) {
      toast('Bitte einen Namen für die Besprechung eintragen.');
      return;
    }
    const report = await model.createReport({
      reason,
      reasonLabel: reasons.find((r) => r.id === reason)?.label || '',
      customName,
      participants: participants.getValue(),
    });
    location.hash = `#/report/${report.id}`;
  };
  bindReportCards(app());
}
