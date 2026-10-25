import * as model from '../model.js';
import { app, esc, setHeader, setActiveTab, toast, confirmDialog, objectURL } from '../core/ui.js';
import { showPdfPreview } from '../core/pdfPreview.js';
import { formatDateTime, formatDue } from '../core/filename.js';
import { multiPerson } from '../core/personPicker.js';
import { download, shareFile } from '../core/share.js';
import { reportPdf, reportImagesZip } from '../export.js';

async function pointCard(p) {
  const photos = await model.getPhotos(p.id);
  return `
    <div class="card clickable point ${p.done ? 'done' : ''}" data-point="${p.id}">
      ${photos.length ? `<div class="thumbs">${photos.slice(0, 2).map((ph) => `<img class="thumb" src="${objectURL(ph.thumb)}" alt="">`).join('')}</div>` : ''}
      <div class="body">
        <div><span class="badge">#${p.no}</span> ${p.area ? `<span class="badge">${esc(p.area)}</span>` : ''}
          ${p.isTodo ? `<span class="badge ${p.done ? 'done' : 'open'}">${p.done ? 'erledigt' : 'offen'}</span>` : ''}
          ${p.dueDate ? `<span class="badge ${model.isOverdue(p) ? 'overdue' : ''}">bis ${formatDue(p.dueDate)}</span>` : ''}</div>
        <div class="remark">${esc(p.remark || '')}</div>
        ${p.done && p.doneNote ? `<div class="done-note">✓ Bemerkung: ${esc(p.doneNote)}</div>` : ''}
        <div class="meta">${formatDateTime(p.createdAt)}${p.author ? ` · von ${esc(p.author)}` : ''}${p.assignee ? ` · Zuständig: <b>${esc(p.assignee)}</b>` : ''}${photos.length > 2 ? ` · ${photos.length} Fotos` : ''}</div>
      </div>
    </div>`;
}

export async function render({ id }) {
  const report = await model.getReport(id);
  if (!report) { location.hash = '#/'; return; }
  const archived = report.status === 'archived';
  const title = model.reportTitle(report);
  setHeader(title, archived ? '#/archive' : '#/');
  setActiveTab(archived ? 'archive' : 'home');

  const points = await model.getPoints(id); // neueste oben
  const openCount = points.filter((p) => p.isTodo && !p.done).length;

  app().innerHTML = `
    <div class="card">
      <div class="meta">${formatDateTime(report.createdAt)}${archived ? ' · <span class="badge">archiviert</span>' : ''}</div>
      <label>Teilnehmer</label>
      <div id="participants"></div>
    </div>
    ${archived ? '' : '<a class="btn block" href="#/report/' + id + '/point/new">＋ Neuer Punkt</a>'}
    <h2>Punkte (${points.length}${openCount ? `, ${openCount} offen` : ''})</h2>
    <div id="points">${points.length ? (await Promise.all(points.map(pointCard))).join('') : '<p class="empty">Noch keine Punkte erfasst.</p>'}</div>
    <h2>Bericht</h2>
    <button class="btn block" id="finish">${report.pdfVersion ? 'Bericht aktualisieren / PDF' : archived ? 'PDF erstellen' : 'Bericht abschließen / PDF'}</button>
    ${report.pdfVersion ? `<div class="meta" style="margin-top:6px">Letzte Version: ${model.versionLabel(report.pdfVersion)} vom ${formatDateTime(report.pdfAt)}</div>` : ''}
    <div class="btn-row">
      ${archived
        ? '<button class="btn secondary" id="reactivate">Wieder öffnen</button>'
        : '<button class="btn secondary" id="archive">Ins Archiv</button>'}
    </div>
    <div class="delete-row">
      <button class="btn danger-outline small" id="delete">Bericht löschen</button>
    </div>`;

  const part = multiPerson(document.getElementById('participants'), {
    value: report.participants,
    persons: await model.listPersons(),
    disabled: archived,
    onChange: () => saveParticipants(),
  });
  async function saveParticipants() {
    report.participants = part.getValue();
    await model.saveReport(report);
    await model.addPersons(model.splitNames(report.participants));
    toast('Teilnehmer gespeichert');
  }

  app().querySelectorAll('[data-point]').forEach((el) => {
    el.onclick = () => { location.hash = `#/report/${id}/point/${el.dataset.point}`; };
  });

  document.getElementById('finish').onclick = async () => {
    toast('PDF wird erstellt …', 1500);
    report.finishedAt = Date.now();
    await model.saveReport(report);
    const pdf = await reportPdf(report);
    const zip = await reportImagesZip(report);
    await showPdfPreview({ blob: pdf.blob, filename: pdf.filename, actions: [
      { label: '✉ Per E-Mail senden', run: () => shareFile(pdf.blob, pdf.filename, { title: `${pdf.title} ${formatDateTime(report.createdAt)}`, text: `Anbei das Protokoll "${pdf.title}" vom ${formatDateTime(report.createdAt)}.` }) },
      { label: '⤓ PDF speichern', cls: 'secondary', close: false, run: () => download(pdf.blob, pdf.filename) },
      ...(zip ? [{ label: `⤓ Bilder speichern (${zip.count}, ZIP)`, cls: 'secondary', close: false, run: () => download(zip.blob, zip.filename) }] : []),
      { label: 'Schließen', cls: 'danger-outline' },
    ] });
    location.hash = '#/';
  };

  document.getElementById('delete').onclick = async () => {
    if (await confirmDialog(`Wollen Sie den Bericht wirklich löschen?\n\n„${title}“ (${formatDateTime(report.createdAt)}) wird mit allen Punkten und Fotos endgültig entfernt.`, { ok: 'Löschen', danger: true })) {
      await model.deleteReport(id);
      toast('Bericht gelöscht');
      location.hash = archived ? '#/archive' : '#/';
    }
  };

  const archiveBtn = document.getElementById('archive');
  if (archiveBtn) archiveBtn.onclick = async () => {
    if (openCount && !(await confirmDialog(`Es sind noch ${openCount} Aufgaben offen. Trotzdem archivieren?`, { ok: 'Archivieren' }))) return;
    report.status = 'archived';
    report.archivedAt = Date.now();
    await model.saveReport(report);
    toast('Bericht archiviert');
    location.hash = '#/archive';
  };

  const reactivate = document.getElementById('reactivate');
  if (reactivate) reactivate.onclick = async () => {
    report.status = 'open';
    report.archivedAt = null;
    await model.saveReport(report);
    toast('Bericht wieder geöffnet');
    render({ id });
  };
}
