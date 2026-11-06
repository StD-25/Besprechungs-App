// Generische PDF-Erzeugung: Kopfbereich + Tabelle mit kleinen Foto-Vorschaubildern.
import { formatDateTime } from './filename.js';

const BLUE = [31, 78, 121];
const LIGHT = [238, 244, 250];

const MARGIN = 12;
const IMG = 17; // Kantenlänge eines Vorschaubilds in mm

/**
 * Ein PDF aus einem Abschnitt (Kopf + Tabelle).
 * @param {object} o
 * @param {string} o.title
 * @param {Array<[string,string]>} o.info       Kopfzeilen [Bezeichnung, Wert]
 * @param {Array<{header:string,width?:number}>} o.columns
 * @param {Array<{cells:string[], images?:Array<{dataURL,w,h}>}>} o.rows
 * @param {number} [o.imageColumn]             Spaltenindex für Bilder
 * @returns {Blob}
 */
export const tablePdf = (section) => sectionsPdf([section]);

// Ein PDF aus mehreren Abschnitten; jeder Abschnitt beginnt auf einer neuen Seite
export function sectionsPdf(sections) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  sections.forEach((section, i) => {
    if (i > 0) doc.addPage();
    drawSection(doc, section);
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(90, 107, 125);
    doc.text(`Erstellt: ${formatDateTime(Date.now())}`, MARGIN, 290);
    doc.text(`Seite ${i} / ${pages}`, 210 - MARGIN, 290, { align: 'right' });
  }
  return doc.output('blob');
}

function drawSection(doc, { title, info = [], columns, rows, imageColumn = -1 }) {
  const margin = MARGIN;
  doc.setFillColor(...BLUE);
  doc.rect(0, 0, 210, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(title, margin, 14);

  doc.setTextColor(30, 40, 50);
  doc.setFontSize(10);
  let y = 30;
  for (const [label, value] of info) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(String(value || '–'), 150);
    doc.text(lines, margin + 32, y);
    y += 5 * lines.length + 1;
  }

  const maxImages = Math.max(0, ...rows.map((r) => (r.images || []).length));
  const imgCols = Math.min(maxImages, 2);

  // Bilder je Tabellenzeile über das Zeilen-Array finden: Bricht eine lange Zeile über das
  // Seitenende, legt autoTable eine Fortsetzungszeile an, deren Index nicht mehr zu `rows` passt.
  const body = rows.map((r) => [...r.cells]);
  const imagesOf = new Map(body.map((cells, i) => [cells, rows[i].images || []]));
  const drawn = new Set(); // Bilder nur einmal zeichnen, nicht erneut in der Fortsetzung

  doc.autoTable({
    startY: y + 2,
    margin: { left: margin, right: margin, bottom: 16 },
    head: [columns.map((c) => c.header)],
    body,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8, valign: 'top', lineColor: [189, 215, 238] },
    headStyles: { fillColor: BLUE, textColor: 255 },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: Object.fromEntries(
      columns.map((c, i) => [i, c.width ? { cellWidth: i === imageColumn ? Math.max(c.width, imgCols * (IMG + 1) + 3) : c.width } : {}])
    ),
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === imageColumn) {
        const imgs = imagesOf.get(data.row.raw) || [];
        if (imgs.length) {
          const lines = Math.ceil(Math.min(imgs.length, 4) / 2);
          data.cell.styles.minCellHeight = lines * (IMG + 1) + 3;
        }
      }
    },
    didDrawCell(data) {
      if (data.section !== 'body' || data.column.index !== imageColumn) return;
      if (drawn.has(data.row.raw)) return;
      drawn.add(data.row.raw);
      const imgs = (imagesOf.get(data.row.raw) || []).slice(0, 4);
      imgs.forEach((img, i) => {
        const scale = IMG / Math.max(img.w, img.h);
        const w = img.w * scale;
        const h = img.h * scale;
        const x = data.cell.x + 1.5 + (i % 2) * (IMG + 1) + (IMG - w) / 2;
        const yy = data.cell.y + 1.5 + Math.floor(i / 2) * (IMG + 1) + (IMG - h) / 2;
        try {
          doc.addImage(img.dataURL, 'JPEG', x, yy, w, h, undefined, 'FAST');
        } catch (err) {
          console.warn('Vorschaubild konnte nicht eingefügt werden', err); // PDF trotzdem erstellen
        }
      });
    },
  });

}
