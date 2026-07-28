// Minimal, dependency-free OOXML container writer.
//
// .docx and .xlsx are both ZIP archives of XML parts. Writing them by hand
// avoids adding a dependency — bunfig.toml enforces a 24h supply-chain hold with
// a hand-curated exclude list, so a new package is a decision to bring to the
// user, not a default.
//
// Entries are stored with method 0 (STORE, uncompressed). That drops any need
// for zlib or CompressionStream, so this runs unchanged in Node, Bun, and a
// Cloudflare Worker. The cost is file size, which is irrelevant for a status
// document or a risk spreadsheet.

const enc = new TextEncoder();

/** CRC-32 (IEEE 802.3), required by the ZIP local and central headers. */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  /** Path inside the archive, forward slashes, no leading slash. */
  path: string;
  data: Uint8Array;
}

export function textEntry(path: string, text: string): ZipEntry {
  return { path, data: enc.encode(text) };
}

/**
 * Build a ZIP archive. Entry order is preserved, which matters for OOXML:
 * "[Content_Types].xml" must be the first entry for some consumers.
 *
 * Timestamps are written as a fixed value rather than the current time, so the
 * same input produces byte-identical output. Determinism is what makes these
 * artifacts golden-file testable.
 */
export function zip(entries: ZipEntry[]): Uint8Array {
  // DOS date/time for 1980-01-01 00:00:00 — the earliest the format allows.
  const DOS_TIME = 0;
  const DOS_DATE = 0x0021;

  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBytes = enc.encode(e.path);
    const crc = crc32(e.data);
    const size = e.data.length;

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // local file header signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0, true); // flags
    lv.setUint16(8, 0, true); // method 0 = store
    lv.setUint16(10, DOS_TIME, true);
    lv.setUint16(12, DOS_DATE, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true); // compressed size == size for STORE
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // extra length
    local.set(nameBytes, 30);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); // central directory signature
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, DOS_TIME, true);
    cv.setUint16(14, DOS_DATE, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); // extra
    cv.setUint16(32, 0, true); // comment
    cv.setUint16(34, 0, true); // disk number
    cv.setUint16(36, 0, true); // internal attrs
    cv.setUint32(38, 0, true); // external attrs
    cv.setUint32(42, offset, true); // offset of local header
    central.set(nameBytes, 46);

    locals.push(local, e.data);
    centrals.push(central);
    offset += local.length + size;
  }

  const centralSize = centrals.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); // end of central directory
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true); // comment length

  const total = locals.reduce((n, b) => n + b.length, 0) + centralSize + end.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const b of locals) {
    out.set(b, p);
    p += b.length;
  }
  for (const c of centrals) {
    out.set(c, p);
    p += c.length;
  }
  out.set(end, p);
  return out;
}

/**
 * Escape text for XML content and attribute values.
 *
 * Also strips characters XML 1.0 forbids outright. Notion prose can carry
 * control characters, and a single stray one makes Word or Excel declare the
 * whole file corrupt rather than skipping the cell — so this is load-bearing,
 * not defensive dressing.
 */
export function xml(s: string): string {
  // Matching control characters is the entire point here — these are the
  // codepoints XML 1.0 forbids, and Word/Excel reject the whole file rather
  // than skipping the offending cell. Tab, LF, and CR are legal and kept.
  // eslint-disable-next-line no-control-regex
  const stripped = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  return stripped
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
