// Minimal SpreadsheetML (.xlsx) builder on top of the ooxml ZIP writer.
//
// Enough for a POA&M: one sheet, a styled header row, frozen header, explicit
// column widths, and inline strings.
//
// Uses inline strings (t="inlineStr") rather than a shared string table. A
// shared table saves bytes on repetitive data; a POA&M is mostly unique prose,
// and inline strings remove a whole part and its index bookkeeping — one fewer
// thing to get subtly wrong.

import { XML_DECL, textEntry, xml, zip, type ZipEntry } from "./ooxml";

export interface Sheet {
  name: string;
  /** Column widths in character units. */
  widths: number[];
  header: string[];
  rows: string[][];
}

/** A1-style reference for a zero-indexed row/column. */
export function cellRef(row: number, col: number): string {
  let c = "";
  let n = col;
  do {
    c = String.fromCharCode(65 + (n % 26)) + c;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `${c}${row + 1}`;
}

function cellXml(row: number, col: number, value: string, styleId: number): string {
  const ref = cellRef(row, col);
  if (value === "") return `<c r="${ref}" s="${styleId}"/>`;
  return `<c r="${ref}" s="${styleId}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}

function sheetXml(sheet: Sheet): string {
  const cols = sheet.widths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join("");

  const headerRow =
    `<row r="1" ht="30" customHeight="1">` +
    sheet.header.map((h, i) => cellXml(0, i, h, 1)).join("") +
    `</row>`;

  const bodyRows = sheet.rows
    .map(
      (r, ri) =>
        `<row r="${ri + 2}">` +
        sheet.header.map((_, ci) => cellXml(ri + 1, ci, r[ci] ?? "", 2)).join("") +
        `</row>`,
    )
    .join("");

  const lastCol = cellRef(0, Math.max(0, sheet.header.length - 1)).replace(/\d+$/, "");
  const dim = `A1:${lastCol}${sheet.rows.length + 1}`;

  return `${XML_DECL}
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${dim}"/>
  <sheetViews><sheetView workbookViewId="0">
    <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
  </sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${cols}</cols>
  <sheetData>${headerRow}${bodyRows}</sheetData>
  <autoFilter ref="${dim}"/>
</worksheet>`;
}

// Style 0 = default, 1 = header (bold, white on green, wrapped), 2 = body (wrapped, top).
const STYLES = `${XML_DECL}
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><sz val="10"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1F3D2B"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFBFBFBF"/></left>
      <right style="thin"><color rgb="FFBFBFBF"/></right>
      <top style="thin"><color rgb="FFBFBFBF"/></top>
      <bottom style="thin"><color rgb="FFBFBFBF"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment vertical="top" wrapText="1"/>
    </xf>
  </cellXfs>
</styleSheet>`;

const CONTENT_TYPES = `${XML_DECL}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

const ROOT_RELS = `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WB_RELS = `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

/** Build a single-sheet .xlsx. Deterministic for identical input. */
export function buildXlsx(sheet: Sheet): Uint8Array {
  // Excel rejects sheet names over 31 chars or containing : \ / ? * [ ]
  const safeName = sheet.name.replace(/[:\\/?*[\]]/g, "-").slice(0, 31);

  const workbook = `${XML_DECL}
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${xml(safeName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

  const entries: ZipEntry[] = [
    textEntry("[Content_Types].xml", CONTENT_TYPES),
    textEntry("_rels/.rels", ROOT_RELS),
    textEntry("xl/workbook.xml", workbook),
    textEntry("xl/_rels/workbook.xml.rels", WB_RELS),
    textEntry("xl/worksheets/sheet1.xml", sheetXml(sheet)),
    textEntry("xl/styles.xml", STYLES),
  ];
  return zip(entries);
}
