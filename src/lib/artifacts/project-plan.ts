// Phase C: the project plan, as .docx.
//
// Pure function of (ProgramModel, options) -> bytes. Same rules as the rollup:
// gaps are marked rather than hidden, and prose is left for a human. What this
// document contributes over the rollup is structure — phases with their
// Definition of Done and stage gates, the milestone schedule, and who owns what.

import type { GateReadiness, ProgramModel } from "../program-model";
import { buildDocx, type Block } from "./docx";

export interface ProjectPlanOptions {
  asOf: string; // YYYY-MM-DD
  gates?: GateReadiness[];
  /** Version label for the document, e.g. "Draft 1". */
  revision?: string;
}

const GAP = "Not yet sourced — treat as a gap, not as zero.";
const TODO = "To be written.";

export function renderProjectPlan(model: ProgramModel, opts: ProjectPlanOptions): Uint8Array {
  const B: Block[] = [];

  // ---- title block
  B.push({ kind: "heading", level: 1, text: `${model.program.name} — Project Plan` });
  B.push({ kind: "kv", label: "Client", value: model.program.client });
  B.push({ kind: "kv", label: "Contract", value: model.program.contractNumber });
  B.push({ kind: "kv", label: "Period of performance", value: model.program.periodLabel });
  B.push({
    kind: "kv",
    label: "Launch",
    value: `${model.program.launchDate} (${daysBetween(opts.asOf, model.program.launchDate)} days from ${opts.asOf})`,
  });
  B.push({ kind: "kv", label: "Document date", value: opts.asOf });
  if (opts.revision) B.push({ kind: "kv", label: "Revision", value: opts.revision });
  B.push({ kind: "spacer" });

  // ---- narrative, human-written
  B.push({ kind: "heading", level: 2, text: "1. Approach" });
  B.push({ kind: "para", text: TODO, italic: true });

  // ---- delivery structure
  B.push({ kind: "heading", level: 2, text: "2. Workstreams" });
  if (model.workstreams.length) {
    B.push({
      kind: "table",
      header: ["Workstream", "Owner", "Health"],
      widths: [4000, 3600, 1800],
      rows: model.workstreams.map((w) => [w.label, w.owner || "—", w.health ?? "not reported"]),
    });
  } else {
    B.push({ kind: "para", text: GAP, italic: true });
  }

  // ---- lifecycle: the spine, with DoD and gates per stage
  B.push({ kind: "heading", level: 2, text: "3. Lifecycle and stage gates" });
  if (model.phases.length) {
    const done = model.phases.filter((p) => p.state === "complete").length;
    B.push({
      kind: "para",
      text: `${done} of ${model.phases.length} phases complete as of ${opts.asOf}. Phase state is derived from the dates below, not tracked separately.`,
    });
    B.push({
      kind: "table",
      header: ["Phase", "Window", "State"],
      widths: [5200, 3000, 1200],
      rows: model.phases.map((p) => [p.name, p.window, p.state.replace("_", " ")]),
    });

    for (const p of model.phases) {
      B.push({ kind: "heading", level: 3, text: `${p.name} — ${p.window}` });
      if (p.goal) B.push({ kind: "para", text: p.goal });
      if (p.exitCriteria.length) {
        B.push({ kind: "para", text: "Definition of Done — exit criteria:", bold: true });
        for (const c of p.exitCriteria) B.push({ kind: "bullet", text: c, checkbox: true });
      }
      if (p.gates.length) {
        B.push({ kind: "para", text: "Stage gates:", bold: true });
        for (const g of p.gates) B.push({ kind: "bullet", text: g });
      }
      B.push({ kind: "spacer" });
    }
  } else {
    B.push({ kind: "para", text: GAP, italic: true });
  }

  // ---- schedule
  B.push({ kind: "heading", level: 2, text: "4. Milestone schedule" });
  if (model.milestones.length) {
    B.push({
      kind: "table",
      header: ["Date", "Milestone", "Owner", "Status"],
      widths: [1600, 5000, 1800, 1000],
      rows: model.milestones.map((m) => [
        m.date,
        m.label,
        m.owner ?? "—",
        m.state.replace("_", " "),
      ]),
    });
  } else {
    B.push({ kind: "para", text: GAP, italic: true });
  }

  // ---- gate readiness
  B.push({ kind: "heading", level: 2, text: "5. Gate readiness" });
  if (opts.gates?.length) {
    B.push({
      kind: "para",
      text:
        "Pressure combines time remaining, unmet exit criteria, and open blockers. " +
        "Blockers are attributed only to the phase currently running, because work " +
        "items carry no phase association.",
    });
    B.push({
      kind: "table",
      header: ["Gate", "Days out", "Exit criteria met", "Open blockers", "Pressure"],
      widths: [4200, 1200, 1800, 1500, 1700],
      rows: opts.gates.map((g) => [
        g.phaseName,
        String(g.daysRemaining),
        `${g.exitCriteriaMet} of ${g.exitCriteriaTotal}`,
        String(g.blockingWorkItems),
        `${Math.round(g.pressure * 100)}%`,
      ]),
    });
  } else {
    B.push({ kind: "para", text: GAP, italic: true });
  }

  // ---- dependencies
  B.push({ kind: "heading", level: 2, text: "6. Cross-workstream dependencies" });
  if (model.dependencies.length) {
    B.push({
      kind: "table",
      header: ["From", "To", "State", "Description"],
      widths: [1400, 1400, 1200, 5400],
      rows: model.dependencies.map((d) => [
        d.fromWorkstream,
        d.toWorkstream,
        d.state,
        d.description,
      ]),
    });
  } else {
    B.push({ kind: "para", text: GAP, italic: true });
  }

  // ---- risks, summarised (the POA&M is the full treatment)
  B.push({ kind: "heading", level: 2, text: "7. Risk summary" });
  if (model.risks.length) {
    const open = model.risks.filter((r) => r.state !== "resolved");
    const high = open.filter((r) => r.severity === "high");
    B.push({
      kind: "para",
      text: `${open.length} open of ${model.risks.length} tracked, ${high.length} at high severity. The POA&M carries the full register.`,
    });
    if (high.length) {
      B.push({
        kind: "table",
        header: ["ID", "Risk", "Owner", "Mitigation"],
        widths: [700, 4200, 1900, 2600],
        rows: high.map((r) => [r.id, r.description, r.owner ?? "—", r.mitigation ?? "—"]),
      });
    }
  } else {
    B.push({ kind: "para", text: GAP, italic: true });
  }

  // ---- provenance
  B.push({ kind: "heading", level: 2, text: "Appendix A — Provenance" });
  B.push({ kind: "kv", label: "Assembled", value: model.meta.assembledAt });
  B.push({
    kind: "kv",
    label: "Most recent source read",
    value: model.meta.freshestSourceAt ?? "no synced sources contributed",
  });
  if (model.meta.unsourced.length) {
    B.push({
      kind: "kv",
      label: "Sections without a wired source",
      value: model.meta.unsourced.join(", "),
    });
  }
  B.push({ kind: "spacer" });
  B.push({
    kind: "para",
    text: "Generated draft. Review and edit before distribution.",
    italic: true,
  });

  return buildDocx(B);
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86400000,
  );
}
