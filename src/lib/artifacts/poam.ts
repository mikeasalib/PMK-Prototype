// Phase D: the POA&M, as .xlsx against FedRAMP-standard columns.
//
// Pure function of (ProgramModel, options) -> bytes.
//
// The governing rule here is stricter than for the other artifacts: a POA&M is a
// compliance deliverable, so a column that cannot be filled from a source is
// filled with an explicit gap marker and never inferred. The register carries
// dates inside mitigation prose ("remediate before 10/15-16", "formal audit
// ~9/28"); parsing those into Scheduled Completion Date would manufacture
// commitments nobody made.

import type { ProgramModel, RiskRecord } from "../program-model";
import { bySeverityThenState } from "../risk-register";
import { buildXlsx, type Sheet } from "./xlsx";

export interface PoamOptions {
  asOf: string; // YYYY-MM-DD
  /** Include rows already resolved. FedRAMP keeps closed items with a status. */
  includeResolved?: boolean;
}

/** Marker for a required column with no source. Conspicuous on purpose. */
const GAP = "[NOT SOURCED]";

/** FedRAMP POA&M column order. */
export const POAM_COLUMNS = [
  "POA&M Item ID",
  "Controls",
  "Weakness Name",
  "Weakness Description",
  "Weakness Detector Source",
  "Weakness Source Identifier",
  "Asset Identifier",
  "Point of Contact",
  "Resources Required",
  "Overall Remediation Plan",
  "Original Detection Date",
  "Scheduled Completion Date",
  "Planned Milestones",
  "Milestone Changes",
  "Status Date",
  "Vendor Dependency",
  "Last Vendor Check-in Date",
  "Original Risk Rating",
  "Adjusted Risk Rating",
  "Risk Adjustment",
  "False Positive",
  "Operational Requirement",
  "Deviation Rationale",
  "Supporting Documents",
  "Comments",
  "Status",
] as const;

const WIDTHS = [
  12, 14, 34, 60, 20, 22, 16, 22, 16, 60, 16, 18, 30, 16, 12, 14, 18, 14, 14, 12, 12, 14, 24, 26,
  40, 14,
];

/** FedRAMP risk ratings are High/Moderate/Low. The register says medium. */
function riskRating(r: RiskRecord): string {
  switch (r.severity) {
    case "high":
      return "High";
    case "medium":
      return "Moderate";
    case "low":
      return "Low";
  }
}

function status(r: RiskRecord): string {
  switch (r.state) {
    case "resolved":
      return "Completed";
    case "open":
      return "Open";
    case "mitigating":
    case "monitoring":
      return "Ongoing";
  }
}

/** Short weakness name from the first clause of the description. */
function weaknessName(r: RiskRecord): string {
  const first = r.description.split(/[;(]/)[0].trim();
  return first.length > 90 ? `${first.slice(0, 87)}...` : first;
}

function row(r: RiskRecord, model: ProgramModel): string[] {
  const refs = r.origin.kind === "sourced" ? r.origin.refs : [];
  const detector = refs.length ? `${refs[0].system} — ${model.program.name} risk register` : GAP;

  return [
    r.id,
    // Security controls are only meaningful for security findings. This register
    // is delivery risk, so the column is honestly blank rather than guessed at.
    r.control ?? GAP,
    weaknessName(r),
    r.description,
    detector,
    refs[0]?.url ?? refs[0]?.id ?? GAP,
    r.assetId ?? GAP,
    r.owner ?? GAP,
    GAP, // Resources Required — not tracked anywhere yet
    r.mitigation ?? GAP,
    r.openedAt ?? GAP,
    // The single most important gap: FedRAMP requires this per row.
    r.dueAt ?? GAP,
    r.linkedWorkItems.length ? `Tracked in ${r.linkedWorkItems.join(", ")}` : GAP,
    GAP, // Milestone Changes — needs register history, which a table block has none of
    model.meta.assembledAt.slice(0, 10),
    "No",
    "",
    riskRating(r),
    r.likelihood && r.impact ? `${riskRating(r)} (${r.likelihood}x${r.impact})` : riskRating(r),
    r.severityNote === "accepted" ? "Risk Accepted" : "",
    "No",
    r.severityNote === "accepted" ? "Yes" : "No",
    r.severityNote ?? "",
    refs[0]?.url ?? "",
    [r.area ? `Area: ${r.area}` : null, r.workstream ? `Workstream: ${r.workstream}` : null]
      .filter(Boolean)
      .join(" · "),
    status(r),
  ];
}

export interface PoamResult {
  bytes: Uint8Array;
  /** Columns that came out entirely unsourced — worth telling the user. */
  emptyColumns: string[];
  rowCount: number;
}

export function renderPoam(model: ProgramModel, opts: PoamOptions): PoamResult {
  const risks = [...model.risks]
    .filter((r) => (opts.includeResolved ? true : r.state !== "resolved"))
    .sort(bySeverityThenState);

  const rows = risks.map((r) => row(r, model));

  // Report which required columns are wholly unsourced, so the caller can say so
  // instead of the reader discovering it cell by cell.
  const emptyColumns = POAM_COLUMNS.filter((_, i) =>
    rows.length ? rows.every((r) => r[i] === GAP || r[i] === "") : false,
  );

  const sheet: Sheet = {
    name: "POA&M Items",
    widths: WIDTHS,
    header: [...POAM_COLUMNS],
    rows,
  };

  return { bytes: buildXlsx(sheet), emptyColumns: [...emptyColumns], rowCount: rows.length };
}
