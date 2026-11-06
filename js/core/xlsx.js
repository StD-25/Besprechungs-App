// Einfache Excel-Datei (.xlsx) mit einer Tabelle, erzeugt mit dem vorhandenen JSZip.
// Kopfzeile fett und fixiert, Filter in der Kopfzeile, Zeilenumbrüche in den Zellen.

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Für XML ungültige Steuerzeichen entfernen und Sonderzeichen maskieren
const xml = (value) => String(value ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Spaltenbuchstabe: 0 → A, 25 → Z, 26 → AA
function colName(i) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// Zahlen als echte Zahlen (sonst zeigt Excel „Zahl als Text gespeichert“), alles andere als Text
const cell = (ref, value, style) => (typeof value === 'number' && Number.isFinite(value)
  ? `<c r="${ref}" s="${style}"><v>${value}</v></c>`
  : `<c r="${ref}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xml(value)}</t></is></c>`);

/**
 * Einzelnes Blatt: makeXlsx({ sheetName, columns, rows }); mehrere: makeXlsx({ sheets: [{ name, columns, rows }] }).
 * columns: [{ header, width }] (Breite in Zeichen), rows: [[Text, …]]
 * @returns {Promise<Blob>}
 */
export async function makeXlsx({ sheets, sheetName = 'Tabelle1', columns, rows }) {
  const list = (sheets || [{ name: sheetName, columns, rows }]).map((sh) => ({ ...sh, name: String(sh.name).slice(0, 31) }));

  const sheetXml = ({ columns: cols, rows: data }) => {
    const last = colName(cols.length - 1);
    const header = `<row r="1">${cols.map((c, i) => cell(`${colName(i)}1`, c.header, 1)).join('')}</row>`;
    const body = data.map((r, ri) =>
      `<row r="${ri + 2}">${r.map((v, ci) => cell(`${colName(ci)}${ri + 2}`, v, 2)).join('')}</row>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 18}" customWidth="1"/>`).join('')}</cols>
<sheetData>${header}${body}</sheetData>
${data.length ? `<autoFilter ref="A1:${last}${data.length + 1}"/>` : ''}
</worksheet>`;
  };

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  const zip = new window.JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${list.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  const filters = list.map((sh, i) => (sh.rows.length
    ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xml(sh.name)}'!$A$1:$${colName(sh.columns.length - 1)}$${sh.rows.length + 1}</definedName>`
    : '')).join('');
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${list.map((sh, i) => `<sheet name="${xml(sh.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
${filters ? `<definedNames>${filters}</definedNames>` : ''}
</workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${list.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${list.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
  list.forEach((sh, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(sh)));
  zip.file('xl/styles.xml', styles);
  return zip.generateAsync({ type: 'blob', mimeType: XLSX_TYPE, compression: 'DEFLATE' });
}
