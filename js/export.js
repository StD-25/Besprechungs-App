// Berichts-PDF, Aufgaben-PDF und Bilder-Export.
import * as model from './model.js';
import { tablePdf } from './core/pdf.js';
import { blobToDataURL } from './core/image.js';
import { buildFilename, formatDate, formatDateTime, formatDue, sanitize, stamp } from './core/filename.js';
import { makeZip } from './core/share.js';

async function thumbsFor(pointId) {
  const photos = await model.getPhotos(pointId);
  return Promise.all(
    photos.map(async (ph) => ({ dataURL: await blobToDataURL(ph.thumb), w: ph.thumbW, h: ph.thumbH }))
  );
}

// Status mit Fälligkeit bzw. Erledigt-Datum und der Bemerkung zur Erledigung
const statusText = (p) => {
  if (!p.isTodo) return '–';
  if (p.done) {
    const done = p.doneAt ? `erledigt am\n${formatDate(p.doneAt)}` : 'erledigt';
    return p.doneNote ? `${done}\n\nBemerkung:\n${p.doneNote}` : done;
  }
  return `offen${p.dueDate ? `\nbis ${formatDue(p.dueDate)}` : ''}`;
};

export async function reportPdf(report) {
  const points = (await model.getPoints(report.id)).sort((a, b) => a.no - b.no);
  const rows = [];
  for (const p of points) {
    rows.push({
      cells: [String(p.no), formatDateTime(p.createdAt), p.area || '', p.remark || '', p.assignee || '', statusText(p), ''],
      images: await thumbsFor(p.id),
    });
  }
  const title = model.reportTitle(report);
  const version = model.versionLabel(await model.nextPdfVersion(report, points));
  const open = points.filter((p) => p.isTodo && !p.done).length;
  const done = points.filter((p) => p.isTodo && p.done).length;
  const blob = tablePdf({
    title,
    info: [
      ['Datum', formatDateTime(report.createdAt)],
      ['Version', `${version} · Stand: ${formatDateTime(report.pdfAt)}`],
      ['Teilnehmer', report.participants],
      ['Punkte', `${points.length} (offen: ${open}, erledigt: ${done})`],
    ],
    columns: [
      { header: 'Nr.', width: 9 },
      { header: 'Datum / Zeit', width: 20 },
      { header: 'Bereich', width: 20 },
      { header: 'Offener Punkt/Beschreibung' },
      { header: 'Zuständig', width: 24 },
      { header: 'Status', width: 30 },
      { header: 'Foto', width: 22 },
    ],
    rows,
    imageColumn: 6,
  });
  return { blob, filename: buildFilename(model.reportFileBase(report), report.createdAt, 'pdf', `_${version}`), title, version };
}

// Originalfotos (separat vom PDF) als ZIP mit gleichem Namensschema.
export async function reportImagesZip(report) {
  const points = await model.getPoints(report.id);
  const entries = [];
  for (const p of points) {
    const photos = await model.getPhotos(p.id);
    photos.forEach((ph, i) => {
      entries.push({
        name: `Punkt${String(p.no).padStart(2, '0')}_${sanitize(p.area)}_${i + 1}.jpg`,
        blob: ph.full,
      });
    });
  }
  if (!entries.length) return null;
  const blob = await makeZip(entries);
  return { blob, filename: buildFilename(model.reportFileBase(report), report.createdAt, 'zip', `_${model.versionLabel(report.pdfVersion || 1)}_Bilder`), count: entries.length };
}

export async function todosPdf(todos, { person, status, search = '' }) {
  const rows = [];
  for (const t of todos) {
    rows.push({
      cells: [
        formatDateTime(t.createdAt),
        model.reportLabel(t.report),
        t.area || '',
        t.remark || '',
        t.assignee || '',
        statusText(t),
        '',
      ],
      images: await thumbsFor(t.id),
    });
  }
  const who = person || 'Alle';
  const blob = tablePdf({
    title: 'Aufgabenliste',
    info: [
      ['Zuständig', who],
      ['Status', status],
      ...(search ? [['Suche', search]] : []),
      ['Anzahl', String(todos.length)],
    ],
    columns: [
      { header: 'Datum / Zeit', width: 20 },
      { header: 'Bericht', width: 26 },
      { header: 'Bereich', width: 19 },
      { header: 'Offener Punkt/Beschreibung' },
      { header: 'Zuständig', width: 22 },
      { header: 'Status', width: 30 },
      { header: 'Foto', width: 22 },
    ],
    rows,
    imageColumn: 6,
  });
  return { blob, filename: `Aufgaben_${sanitize(who)}_${stamp()}.pdf`, title: `Aufgabenliste – ${who}` };
}
