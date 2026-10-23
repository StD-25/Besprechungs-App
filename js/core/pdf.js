// Generische PDF-Erzeugung: Kopfbereich + Tabelle mit kleinen Foto-Vorschaubildern.
import { formatDateTime } from './filename.js';

const BLUE = [31, 78, 121];
const LIGHT = [238, 244, 250];

/**
 * @param {object} o
 * @param {string} o.title
 * @param {Array<[string,string]>} o.info       Kopfzeilen [Bezeichnung, Wert]
 * @param {Array<{header:string,width?:number}>} o.columns
 * @param {Array<{cells:string[], images?:Array<{dataURL,w,h}>}>} o.rows
 * @param {number} [o.imageColumn]             Spaltenindex für Bilder
 * @returns {Blob}
 */
export function tablePdf({ title, info = [], columns, rows, imageColumn = -1 }) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const margin = 12;
  const IMG = 17; // Kantenlänge eines Vorschaubilds in mm

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

  doc.autoTable({
    startY: y + 2,
    margin: { left: margin, right: margin, bottom: 16 },
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => r.cells),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8, valign: 'top', lineColor: [189, 215, 238] },
    headStyles: { fillColor: BLUE, textColor: 255 },
    alternateRowStyles: { fillColor: LIGHT },
    columnStyles: Object.fromEntries(
      columns.map((c, i) => [i, c.width ? { cellWidth: i === imageColumn ? Math.max(c.width, imgCols * (IMG + 1) + 3) : c.width } : {}])
    ),
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === imageColumn) {
        const imgs = rows[data.row.index].images || [];
        if (imgs.length) {
          const lines = Math.ceil(Math.min(imgs.length, 4) / 2);
          data.cell.styles.minCellHeight = lines * (IMG + 1) + 3;
        }
      }
    },
    didDrawCell(data) {
      if (data.section !== 'body' || data.column.index !== imageColumn) return;
      const imgs = (rows[data.row.index].images || []).slice(0, 4);
      imgs.forEach((img, i) => {
        const scale = IMG / Math.max(img.w, img.h);
        const w = img.w * scale;
        const h = img.h * scale;
        const x = data.cell.x + 1.5 + (i % 2) * (IMG + 1) + (IMG - w) / 2;
        const yy = data.cell.y + 1.5 + Math.floor(i / 2) * (IMG + 1) + (IMG - h) / 2;
        doc.addImage(img.dataURL, 'JPEG', x, yy, w, h, undefined, 'FAST');
      });
    },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(90, 107, 125);
    doc.text(`Erstellt: ${formatDateTime(Date.now())}`, margin, 290);
    doc.text(`Seite ${i} / ${pages}`, 210 - margin, 290, { align: 'right' });
  }
  return doc.output('blob');
}
