// Parser for the Notion risk register table.
//
// The register lives at "VA Program Risk Register", a direct child of the Notion
// hub page the sync already enumerates. It is a *table block*, not a database,
// so cells arrive as plain text and the structure has to be recovered by
// parsing. Keeping that parsing here — as a pure function over rows of strings —
// means it is testable against real captured content without a network call.
//
// Column layout, from the register's header row:
//   id | risk | area | severity | mitigation | owner | linear / status
//
// Anything the parser cannot confidently read becomes null rather than a guess.
// A POA&M row with a wrong owner is worse than one with a visible gap.

import type { Likelihood, RiskRecord, RiskSeverity, RiskState, SourceRef } from "./program-model";

/** Header labels we expect, lowercased. Used to locate columns by name rather
 *  than by fixed position, so inserting a column upstream does not silently
 *  shift every field. */
const COLUMNS = {
  id: ["id"],
  risk: ["risk"],
  area: ["area"],
  severity: ["severity"],
  mitigation: ["mitigation"],
  owner: ["owner"],
  status: ["linear / status", "linear/status", "status"],
} as const;

export interface ColumnMap {
  id: number;
  risk: number;
  area: number;
  severity: number;
  mitigation: number;
  owner: number;
  status: number;
}

/** Locate columns from the header row. Returns null if a required column is
 *  missing, so the caller reports a source-shape problem instead of emitting
 *  silently misaligned rows. */
export function mapColumns(header: string[]): ColumnMap | null {
  const norm = header.map((h) => h.trim().toLowerCase());
  const find = (names: readonly string[]) => norm.findIndex((h) => names.includes(h));
  const out = {
    id: find(COLUMNS.id),
    risk: find(COLUMNS.risk),
    area: find(COLUMNS.area),
    severity: find(COLUMNS.severity),
    mitigation: find(COLUMNS.mitigation),
    owner: find(COLUMNS.owner),
    status: find(COLUMNS.status),
  };
  return Object.values(out).some((i) => i < 0) ? null : out;
}

/** "high (H×H)" -> high, H, H.  "med (accepted)" -> medium, null, null, "accepted". */
export function parseSeverity(cell: string): {
  severity: RiskSeverity;
  likelihood: Likelihood | null;
  impact: Likelihood | null;
  note: string | null;
} {
  const text = cell.trim().toLowerCase();
  const severity: RiskSeverity = text.startsWith("high")
    ? "high"
    : text.startsWith("low")
      ? "low"
      : "medium";

  // The register writes likelihood x impact with a multiplication sign, but a
  // plain "x" is the obvious thing for someone to type instead.
  const li = text.match(/\(\s*([hml])\s*[×x]\s*([hml])\s*\)/i);
  if (li) {
    return {
      severity,
      likelihood: li[1].toUpperCase() as Likelihood,
      impact: li[2].toUpperCase() as Likelihood,
      note: null,
    };
  }

  const paren = text.match(/\(([^)]+)\)/);
  return {
    severity,
    likelihood: null,
    impact: null,
    note: paren ? paren[1].trim() : null,
  };
}

/**
 * "DEP-1932 · open" -> { tickets: ["DEP-1932"], state: "open" }
 * "DEP-1902, DEP-1916 · in progress" -> two tickets, mitigating
 * "monitoring" -> no tickets, monitoring
 */
export function parseStatus(cell: string): { tickets: string[]; state: RiskState } {
  const tickets = Array.from(cell.matchAll(/\b([A-Z]{2,}-\d+)\b/g)).map((m) => m[1]);

  // State is whatever follows the separator, or the whole cell when there is no
  // ticket reference at all.
  const afterSep = cell.includes("·") ? cell.slice(cell.lastIndexOf("·") + 1) : cell;
  const text = afterSep.trim().toLowerCase();

  const state: RiskState = /\bdone\b|\bresolved\b|\bclosed\b/.test(text)
    ? "resolved"
    : /\bmonitor/.test(text)
      ? "monitoring"
      : /\bin progress\b|\bmitigat/.test(text)
        ? "mitigating"
        : "open";

  return { tickets, state };
}

/** Pull a workstream key out of the free-text area cell, e.g. "WS1 / infra". */
export function parseWorkstreamFromArea(area: string): string | null {
  const m = area.match(/\bWS([1-5])\b/i);
  return m ? `WS${m[1]}` : null;
}

export interface ParseResult {
  risks: RiskRecord[];
  /** Rows the parser rejected, with why — surfaced rather than dropped. */
  skipped: Array<{ row: string[]; reason: string }>;
}

/**
 * Parse the register table into RiskRecords.
 *
 * `rows` includes the header row. `ref` is the provenance stamp for the Notion
 * page the table came from — every produced record carries it, which is what
 * makes a generated POA&M traceable.
 */
export function parseRiskRegister(rows: string[][], ref: SourceRef): ParseResult {
  const skipped: Array<{ row: string[]; reason: string }> = [];
  if (!rows.length) return { risks: [], skipped };

  const cols = mapColumns(rows[0]);
  if (!cols) {
    return {
      risks: [],
      skipped: [{ row: rows[0], reason: "header row did not contain the expected columns" }],
    };
  }

  const risks: RiskRecord[] = [];
  for (const row of rows.slice(1)) {
    const cell = (i: number) => (row[i] ?? "").trim();
    const id = cell(cols.id);
    const description = cell(cols.risk);

    if (!id && !description) continue; // blank spacer row
    if (!id) {
      skipped.push({ row, reason: "no id" });
      continue;
    }
    if (!description) {
      skipped.push({ row, reason: `row ${id} has no risk description` });
      continue;
    }

    const sev = parseSeverity(cell(cols.severity));
    const st = parseStatus(cell(cols.status));
    const area = cell(cols.area) || null;

    risks.push({
      id,
      description,
      severity: sev.severity,
      likelihood: sev.likelihood,
      impact: sev.impact,
      severityNote: sev.note,
      state: st.state,
      area,
      workstream: area ? parseWorkstreamFromArea(area) : null,
      owner: cell(cols.owner) || null,
      mitigation: cell(cols.mitigation) || null,
      // The register carries no structured dates or control references. Left
      // null so a POA&M renderer marks the gap instead of inventing a value.
      openedAt: null,
      dueAt: null,
      control: null,
      assetId: null,
      linkedWorkItems: st.tickets,
      origin: { kind: "sourced", refs: [ref] },
    });
  }

  return { risks, skipped };
}

/** Severity ordering for reports: worst first. */
const SEVERITY_RANK: Record<RiskSeverity, number> = { high: 0, medium: 1, low: 2 };
const STATE_RANK: Record<RiskState, number> = {
  open: 0,
  mitigating: 1,
  monitoring: 2,
  resolved: 3,
};

export function bySeverityThenState(a: RiskRecord, b: RiskRecord): number {
  const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
  if (s !== 0) return s;
  const st = STATE_RANK[a.state] - STATE_RANK[b.state];
  return st !== 0 ? st : a.id.localeCompare(b.id, undefined, { numeric: true });
}
