// Minimal WordprocessingML (.docx) builder on top of the ooxml ZIP writer.
//
// Covers what a program document actually needs: headings, body text, bullets,
// key/value lines, and bordered tables. Deliberately not a general Word library.
//
// Bullets are rendered as an indented paragraph with a literal bullet glyph
// rather than a real numbering definition. A proper list needs numbering.xml
// plus abstract/concrete numbering ids, and buys nothing here — the output is a
// draft a human edits, and it looks identical on the page.

import { XML_DECL, textEntry, xml, zip, type ZipEntry } from "./ooxml";

export type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "para"; text: string; italic?: boolean; bold?: boolean }
  | { kind: "bullet"; text: string; checkbox?: boolean }
  | { kind: "kv"; label: string; value: string }
  | { kind: "table"; header: string[]; rows: string[][]; widths?: number[] }
  | { kind: "spacer" };

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function run(text: string, opts: { bold?: boolean; italic?: boolean } = {}): string {
  const props =
    opts.bold || opts.italic
      ? `<w:rPr>${opts.bold ? "<w:b/>" : ""}${opts.italic ? "<w:i/>" : ""}</w:rPr>`
      : "";
  // xml:space="preserve" keeps leading/trailing spaces, which Word otherwise drops.
  return `<w:r>${props}<w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
}

function para(inner: string, style?: string, extraPr = ""): string {
  const pPr =
    style || extraPr
      ? `<w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ""}${extraPr}</w:pPr>`
      : "";
  return `<w:p>${pPr}${inner}</w:p>`;
}

function cell(text: string, opts: { bold?: boolean; width?: number } = {}): string {
  const w = opts.width ? `<w:tcW w:w="${opts.width}" w:type="dxa"/>` : "";
  return `<w:tc><w:tcPr>${w}</w:tcPr>${para(run(text, { bold: opts.bold }))}</w:tc>`;
}

function blockXml(b: Block): string {
  switch (b.kind) {
    case "heading":
      return para(run(b.text), `Heading${b.level}`);
    case "para":
      return para(run(b.text, { bold: b.bold, italic: b.italic }));
    case "bullet":
      return para(run(`${b.checkbox ? "☐" : "•"}  ${b.text}`), undefined, '<w:ind w:left="360"/>');
    case "kv":
      return para(run(`${b.label}: `, { bold: true }) + run(b.value));
    case "spacer":
      return para("");
    case "table": {
      const head = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${b.header
        .map((h, i) => cell(h, { bold: true, width: b.widths?.[i] }))
        .join("")}</w:tr>`;
      const body = b.rows
        .map(
          (r) =>
            `<w:tr>${b.header
              .map((_, i) => cell(r[i] ?? "", { width: b.widths?.[i] }))
              .join("")}</w:tr>`,
        )
        .join("");
      return (
        `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/>` +
        `<w:tblW w:w="0" w:type="auto"/><w:tblLayout w:type="fixed"/></w:tblPr>` +
        head +
        body +
        `</w:tbl>` +
        para("")
      );
    }
  }
}

const STYLES = `${XML_DECL}
<w:styles xmlns:w="${W}">
  <w:docDefaults><w:rPrDefault><w:rPr>
    <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/>
  </w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:pPr><w:spacing w:after="120"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="1F3D2B"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="1F3D2B"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/><w:basedOn w:val="Normal"/>
    <w:pPr><w:spacing w:before="160" w:after="60"/><w:outlineLvl w:val="2"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="table" w:styleId="TableGrid">
    <w:name w:val="Table Grid"/>
    <w:tblPr><w:tblBorders>
      <w:top w:val="single" w:sz="4" w:color="BFBFBF"/>
      <w:left w:val="single" w:sz="4" w:color="BFBFBF"/>
      <w:bottom w:val="single" w:sz="4" w:color="BFBFBF"/>
      <w:right w:val="single" w:sz="4" w:color="BFBFBF"/>
      <w:insideH w:val="single" w:sz="4" w:color="BFBFBF"/>
      <w:insideV w:val="single" w:sz="4" w:color="BFBFBF"/>
    </w:tblBorders></w:tblPr>
    <w:tcPr><w:vAlign w:val="top"/></w:tcPr>
  </w:style>
</w:styles>`;

const CONTENT_TYPES = `${XML_DECL}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const ROOT_RELS = `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOC_RELS = `${XML_DECL}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

/** Render blocks into a .docx byte array. Deterministic for identical input. */
export function buildDocx(blocks: Block[]): Uint8Array {
  const body = blocks.map(blockXml).join("");
  // Letter portrait, 1in margins. Twips: 12240 x 15840, margin 1440.
  const sect =
    `<w:sectPr><w:pgSz w:w="12240" w:h="15840"/>` +
    `<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>` +
    `</w:sectPr>`;
  const document = `${XML_DECL}
<w:document xmlns:w="${W}"><w:body>${body}${sect}</w:body></w:document>`;

  const entries: ZipEntry[] = [
    textEntry("[Content_Types].xml", CONTENT_TYPES),
    textEntry("_rels/.rels", ROOT_RELS),
    textEntry("word/document.xml", document),
    textEntry("word/_rels/document.xml.rels", DOC_RELS),
    textEntry("word/styles.xml", STYLES),
  ];
  return zip(entries);
}
