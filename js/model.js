// Fachlogik: Berichte, Punkte (offene Punkte/Aufgaben), Fotos, Personen, Einstellungen.
import * as db from './core/db.js';
import { REASONS, AREAS, PHOTO_FULL, PHOTO_THUMB } from './config.js';
import { resizeImage } from './core/image.js';
import { formatDate, formatDateTime, todayISO } from './core/filename.js';

// Fest eingebaute Gründe: „Sonstige“ (freier Name) und „Kurznachricht“ (intern)
const FIXED_REASONS = ['sonstige', 'kurznachricht'];

export function reportTitle(report) {
  if (report.reason === 'kurznachricht') return `Kurznachricht ${formatDate(report.createdAt)}`;
  if (report.reason === 'sonstige') return report.customName || 'Sonstige';
  // Name wird beim Anlegen im Bericht gespeichert, damit spätere Änderungen alte Berichte nicht umbenennen
  return report.reasonLabel || REASONS.find((r) => r.id === report.reason)?.label || 'Bericht';
}

// Grund ohne Datum, z.B. für Filter im Archiv
export const reportGroup = (report) => (report.reason === 'kurznachricht' ? 'Kurznachricht' : reportTitle(report));

// Berichtsname mit Datum – bei Kurznachrichten steckt das Datum schon im Titel
export function reportLabel(report) {
  const title = reportTitle(report);
  return report.reason === 'kurznachricht' ? title : `${title} ${formatDateTime(report.createdAt)}`;
}

export const reportFileBase = (report) => (report.reason === 'kurznachricht' ? 'Kurznachricht' : reportTitle(report));

// ---- Gründe der Besprechung (in den Einstellungen änderbar) ----
export async function listEditableReasons() {
  const saved = await getSetting('reasons', null);
  return saved || REASONS.filter((r) => !FIXED_REASONS.includes(r.id)).map(({ id, label }) => ({ id, label }));
}

// Auswahl für „Neuer Bericht“: gepflegte Gründe, „Sonstige“ immer am Ende
export async function listReasons() {
  return [...(await listEditableReasons()), { id: 'sonstige', label: 'Sonstige' }];
}

export const saveReasons = (list) => setSetting('reasons', list);

// ---- Bereiche (in den Einstellungen änderbar; „Sonstiges“ ist immer zusätzlich verfügbar) ----
export async function listAreas() {
  return (await getSetting('areas', null)) || [...AREAS];
}

export const saveAreas = (list) => setSetting('areas', list);

export const newestFirst = (a, b) => b.createdAt - a.createdAt;

// ---- Berichte ----
export async function createReport({ reason, reasonLabel = '', customName, participants }) {
  const report = {
    id: db.uid(),
    reason,
    reasonLabel,
    customName: customName || '',
    participants: participants || '',
    createdAt: Date.now(),
    status: 'open', // open | archived
    finishedAt: null,
    archivedAt: null,
  };
  await db.put('reports', report);
  await addPersons(splitNames(participants));
  return report;
}

export const getReport = (id) => db.get('reports', id);
export const saveReport = (r) => db.put('reports', r);

export async function listReports(status) {
  const all = await db.getAll('reports');
  return all.filter((r) => r.status === status).sort(newestFirst);
}

export async function deleteReport(id) {
  for (const p of await db.getBy('points', 'reportId', id)) await deletePoint(p.id);
  await db.del('reports', id);
}

// ---- Punkte ----
export async function getPoints(reportId) {
  return (await db.getBy('points', 'reportId', reportId)).sort(newestFirst);
}

export const getPoint = (id) => db.get('points', id);

export async function savePoint(point, { newFiles = [], removedPhotoIds = [] } = {}) {
  if (!point.id) {
    const existing = await db.getBy('points', 'reportId', point.reportId);
    point.id = db.uid();
    point.no = existing.reduce((m, p) => Math.max(m, p.no || 0), 0) + 1;
    point.createdAt = Date.now();
    point.done = false;
    point.doneAt = null;
  }
  for (const pid of removedPhotoIds) await db.del('photos', pid);
  for (const file of newFiles) {
    const full = await resizeImage(file, PHOTO_FULL);
    const thumb = await resizeImage(file, PHOTO_THUMB);
    await db.put('photos', {
      id: db.uid(),
      pointId: point.id,
      reportId: point.reportId,
      createdAt: Date.now(),
      full: full.blob,
      thumb: thumb.blob,
      thumbW: thumb.width,
      thumbH: thumb.height,
    });
  }
  await db.put('points', point);
  if (point.assignee) await addPersons([point.assignee]);
  return point;
}

export async function setDone(point, done, note = '') {
  point.doneNote = done ? note : '';
  point.done = done;
  point.doneAt = done ? Date.now() : null;
  return db.put('points', point);
}

export async function deletePoint(id) {
  for (const ph of await db.getBy('photos', 'pointId', id)) await db.del('photos', ph.id);
  await db.del('points', id);
}

export async function getPhotos(pointId) {
  return (await db.getBy('photos', 'pointId', pointId)).sort((a, b) => a.createdAt - b.createdAt);
}

// ---- PDF-Versionen: neue Version nur, wenn sich der Inhalt geändert hat ----
export const versionLabel = (n) => `V${String(n).padStart(2, '0')}`;

export async function nextPdfVersion(report, points) {
  const parts = [report.participants || ''];
  for (const p of [...points].sort((a, b) => a.no - b.no)) {
    const photos = await getPhotos(p.id);
    parts.push([p.no, p.area, p.remark, p.assignee, p.dueDate, p.isTodo, p.done, p.doneNote || '', photos.length].join('|'));
  }
  const signature = parts.join('\n');
  if (!report.pdfVersion || report.pdfSignature !== signature) {
    report.pdfVersion = (report.pdfVersion || 0) + 1;
    report.pdfSignature = signature;
  }
  report.pdfAt = Date.now();
  await saveReport(report);
  return report.pdfVersion;
}

// Offen und Fälligkeitsdatum überschritten
export const isOverdue = (p) => !!(p.isTodo && !p.done && p.dueDate && p.dueDate < todayISO());

// ---- Kurznachricht: ein Bericht pro Tag, jede Nachricht eine offene Aufgabe ----
export async function addQuickMessage({ author, text, area = '', assignee, dueDate, files = [] }) {
  const today = formatDate(Date.now());
  let report = (await listReports('open'))
    .find((r) => r.reason === 'kurznachricht' && formatDate(r.createdAt) === today);
  if (!report) {
    report = await createReport({ reason: 'kurznachricht', participants: author });
  } else if (author && !splitNames(report.participants).includes(author)) {
    report.participants = [report.participants, author].filter(Boolean).join(', ');
    await saveReport(report);
  }
  if (author) await addPersons([author]);
  const point = {
    reportId: report.id,
    area,
    remark: text,
    assignee,
    dueDate: dueDate || '',
    author: author || '',
    isTodo: true,
  };
  return savePoint(point, { newFiles: files });
}

// ---- Einstellungen ----
export async function getSetting(key, fallback = '') {
  const row = await db.get('settings', key);
  return row ? row.value : fallback;
}

export const setSetting = (key, value) => db.put('settings', { key, value });

// ---- Aufgaben ----
export async function listTodos() {
  const [points, reports] = await Promise.all([db.getAll('points'), db.getAll('reports')]);
  const byId = Object.fromEntries(reports.map((r) => [r.id, r]));
  return points
    .filter((p) => p.isTodo && byId[p.reportId])
    .map((p) => ({ ...p, report: byId[p.reportId] }))
    .sort(newestFirst);
}

// ---- Personen ----
export function splitNames(text) {
  return String(text || '').split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
}

export async function addPersons(names) {
  for (const name of names) if (name) await db.put('persons', { name });
}

// Alle jemals eingetragenen Personen: Personenliste + Teilnehmer + Zuständige
export async function listPersons() {
  const [persons, reports, points] = await Promise.all([db.getAll('persons'), db.getAll('reports'), db.getAll('points')]);
  const names = [
    ...persons.map((p) => p.name),
    ...reports.flatMap((r) => splitNames(r.participants)),
    ...points.map((p) => p.assignee),
  ].filter(Boolean);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'de'));
}

export const deletePerson = (name) => db.del('persons', name);
