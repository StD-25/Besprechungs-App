// Berichts-PDF, Aufgaben-PDF und Bilder-Export.
import * as model from './model.js';
import { tablePdf, sectionsPdf } from './core/pdf.js';
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

// Tabelle eines Berichts (Berichts-PDF und Archiv-PDF)
const REPORT_COLUMNS = [
  { header: 'Nr.', width: 9 },
  { header: 'Datum / Zeit', width: 20 },
  { header: 'Bereich', width: 20 },
  { header: 'Offener Punkt/Beschreibung' },
  { header: 'Zuständig', width: 24 },
  { header: 'Status', width: 30 },
  { header: 'Foto', width: 22 },
];

async function reportRows(points) {
  const rows = [];
  for (const p of points) {
    rows.push({
      cells: [String(p.no), formatDateTime(p.createdAt), p.area || '', p.remark || '', p.assignee || '', statusText(p), ''],
      images: await thumbsFor(p.id),
    });
  }
  return rows;
}

const sortedPoints = async (report) => (await model.getPoints(report.id)).sort((a, b) => a.no - b.no);
const countText = (points) =>
  `${points.length} (offen: ${points.filter((p) => p.isTodo && !p.done).length}, erledigt: ${points.filter((p) => p.isTodo && p.done).length})`;

export async function reportPdf(report) {
  const points = await sortedPoints(report);
  const rows = await reportRows(points);
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
    columns: REPORT_COLUMNS,
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

// ---- Archiv-Ablage: alle ausgewählten Berichte in einem PDF, Originalfotos als ZIP,
// fortlaufende Gesamt-Tabelle (ein Blatt) ----

// Archiv-PDF: Deckblatt mit Übersicht, danach jeder Bericht auf eigener Seite
export async function archivePdf(reports, at) {
  const overview = [];
  const sections = [];
  let total = 0;
  for (const [i, r] of reports.entries()) {
    const points = await sortedPoints(r);
    total += points.length;
    overview.push({ cells: [String(i + 1), model.reportTitle(r), formatDateTime(r.createdAt), r.participants || '', countText(points)] });
    sections.push({
      title: model.reportTitle(r),
      info: [
        ['Datum', formatDateTime(r.createdAt)],
        ['Teilnehmer', r.participants],
        ['Punkte', countText(points)],
      ],
      columns: REPORT_COLUMNS,
      rows: await reportRows(points),
      imageColumn: 6,
    });
  }
  const dates = reports.map((r) => r.createdAt);
  const cover = {
    title: `Archiv – Stand ${formatDate(at)}`,
    info: [
      ['Berichte', String(reports.length)],
      ['Punkte', String(total)],
      ['Zeitraum', dates.length ? `${formatDate(Math.min(...dates))} – ${formatDate(Math.max(...dates))}` : '–'],
    ],
    columns: [
      { header: 'Nr.', width: 10 },
      { header: 'Bericht', width: 50 },
      { header: 'Datum', width: 28 },
      { header: 'Teilnehmer' },
      { header: 'Punkte', width: 42 },
    ],
    rows: overview,
  };
  return { blob: sectionsPdf([cover, ...sections]), filename: `Archiv_${stamp(at)}.pdf` };
}

// Originalfotos aller Berichte; je Bericht ein Ordner im ZIP
export async function archiveZip(reports, at) {
  const entries = [];
  for (const r of reports) {
    const folder = `${sanitize(model.reportTitle(r))}_${stamp(r.createdAt)}`;
    for (const p of await sortedPoints(r)) {
      const photos = (await model.getPhotos(p.id)).filter((ph) => ph.full instanceof Blob && ph.full.size);
      photos.forEach((ph, i) => entries.push({
        name: `${folder}/Punkt${String(p.no).padStart(2, '0')}_${sanitize(p.area || 'ohne Bereich')}_${i + 1}.jpg`,
        blob: ph.full,
      }));
    }
  }
  if (!entries.length) return null;
  return { blob: await makeZip(entries), filename: `Archiv_${stamp(at)}_Bilder.zip`, count: entries.length };
}

// Zeilen für die Gesamt-Tabelle (werden in OneDrive Archiv/archiv.json gesammelt)
export async function archiveEntries(reports, at) {
  const out = [];
  for (const r of reports) {
    for (const p of await sortedPoints(r)) {
      out.push({
        archivedAt: at,
        reportId: r.id,
        report: model.reportTitle(r),
        reportDate: r.createdAt,
        participants: r.participants || '',
        no: p.no,
        createdAt: p.createdAt,
        area: p.area || '',
        remark: p.remark || '',
        assignee: p.assignee || '',
        dueDate: p.dueDate || '',
        status: !p.isTodo ? '–' : p.done ? 'erledigt' : 'offen',
        doneAt: p.done ? p.doneAt || null : null,
        doneNote: p.done ? p.doneNote || '' : '',
        author: p.author || '',
      });
    }
  }
  return out;
}

// Gesamt-Tabelle: ein Blatt mit allen archivierten Punkten (älteste Ablage oben)
export async function archiveXlsx(entries) {
  const rows = [...entries]
    .sort((a, b) => a.archivedAt - b.archivedAt || a.reportDate - b.reportDate || a.no - b.no)
    .map((e) => [
      formatDateTime(e.archivedAt), e.report, formatDateTime(e.reportDate), e.participants, String(e.no),
      formatDateTime(e.createdAt), e.area, e.remark, e.assignee, formatDue(e.dueDate), e.status,
      e.doneAt ? formatDate(e.doneAt) : '', e.doneNote, e.author,
    ]);
  return makeXlsx({
    sheetName: 'Archiv',
    columns: [
      { header: 'Archiviert am', width: 17 },
      { header: 'Bericht', width: 24 },
      { header: 'Berichtsdatum', width: 17 },
      { header: 'Teilnehmer', width: 24 },
      { header: 'Nr.', width: 6 },
      { header: 'Erfasst am', width: 17 },
      { header: 'Bereich', width: 14 },
      { header: 'Offener Punkt/Beschreibung', width: 50 },
      { header: 'Zuständig', width: 18 },
      { header: 'Erledigen bis', width: 13 },
      { header: 'Status', width: 10 },
      { header: 'Erledigt am', width: 12 },
      { header: 'Bemerkung (erledigt)', width: 40 },
      { header: 'Erfasst von', width: 18 },
    ],
    rows,
  });
}
