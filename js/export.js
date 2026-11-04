// Berichts-PDF, Aufgaben-PDF und Bilder-Export.
import * as model from './model.js';
import { tablePdf } from './core/pdf.js';
import { blobToDataURL } from './core/image.js';
import { buildFilename, formatDate, formatDateTime, formatDue, sanitize, stamp } from './core/filename.js';
import { makeZip } from './core/share.js';
import { makeXlsx } from './core/xlsx.js';

// Vorschaubilder für das PDF; beschädigte oder unvollständige Fotos werden übersprungen,
// damit ein einzelnes Foto nicht das ganze PDF verhindert.
async function thumbsFor(pointId) {
  const photos = await model.getPhotos(pointId);
  const thumbs = [];
  for (const ph of photos) {
    try {
      if (!(ph.thumb instanceof Blob) || !ph.thumb.size) continue;
      const dataURL = await blobToDataURL(ph.thumb);
      if (!dataURL.startsWith('data:image/')) continue;
      thumbs.push({ dataURL, w: ph.thumbW > 0 ? ph.thumbW : 4, h: ph.thumbH > 0 ? ph.thumbH : 3 });
    } catch (err) {
      console.warn('Foto übersprungen', err);
    }
  }
  return thumbs;
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
    photos.filter((ph) => ph.full instanceof Blob && ph.full.size).forEach((ph, i) => {
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

// Aufgaben als Excel-Tabelle (gleiche Auswahl wie im Aufgaben-PDF, ohne Fotos)
export async function todosXlsx(todos, { person }) {
  const who = person || 'Alle';
  const blob = await makeXlsx({
    sheetName: 'Aufgaben',
    columns: [
      { header: 'Erfasst am', width: 17 },
      { header: 'Bericht', width: 26 },
      { header: 'Bereich', width: 14 },
      { header: 'Offener Punkt/Beschreibung', width: 50 },
      { header: 'Zuständig', width: 18 },
      { header: 'Erledigen bis', width: 13 },
      { header: 'Status', width: 10 },
      { header: 'Erledigt am', width: 12 },
      { header: 'Bemerkung (erledigt)', width: 40 },
      { header: 'Erfasst von', width: 18 },
    ],
    rows: todos.map((t) => [
      formatDateTime(t.createdAt),
      model.reportLabel(t.report),
      t.area || '',
      t.remark || '',
      t.assignee || '',
      formatDue(t.dueDate),
      t.done ? 'erledigt' : 'offen',
      t.done && t.doneAt ? formatDate(t.doneAt) : '',
      t.done ? t.doneNote || '' : '',
      t.author || '',
    ]),
  });
  return { blob, filename: `Aufgaben_${sanitize(who)}_${stamp()}.xlsx`, title: `Aufgabenliste – ${who}` };
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
