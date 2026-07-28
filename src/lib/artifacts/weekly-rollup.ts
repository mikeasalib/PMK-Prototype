// Weekly status rollup: the first artifact renderer.
//
// Pure function of (ProgramModel, options) -> Markdown. No fetching, no dates
// read from the environment, no randomness — so it is golden-file testable and
// two runs over the same model produce identical bytes.
//
// Two rules this renderer follows, and every later renderer should too:
//
//  1. Never present an unsourced section as if it were sourced. Gaps render as
//     an explicit marker, because a confident-looking empty section is worse
//     than a visible hole in a document that goes to the customer.
//  2. Never synthesize prose. Narrative sections are emitted as placeholders
//     for a human to fill in the draft. The tool assembles facts; the human
//     writes the story.

import type { GateReadiness, ProgramModel, WorkItemRecord } from "../program-model";
import { bySeverityThenState } from "../risk-register";
import { HEALTH_LABEL } from "../workstream-updates";

export interface RollupOptions {
  /** End of the reporting window, YYYY-MM-DD. */
  asOf: string;
  /** Length of the window in days. */
  windowDays?: number;
  /** Gate readiness, worst first. Rendered as the "what's coming" section. */
  gates?: GateReadiness[];
}

/** Marker for a section with no wired source. Deliberately conspicuous. */
const GAP = "> **Not yet sourced.**";
/** Marker for prose a human must write. Deliberately conspicuous. */
const TODO = "> _To be written._";

export function renderWeeklyRollup(model: ProgramModel, opts: RollupOptions): string {
  const windowDays = opts.windowDays ?? 7;
  const windowStart = shiftDays(opts.asOf, -windowDays);
  const L: string[] = [];

  // ---- header
  L.push(`# ${model.program.name} — weekly status`);
  L.push("");
  L.push(`**Reporting period:** ${windowStart} to ${opts.asOf} (${windowDays} days)`);
  L.push(`**Client:** ${model.program.client}`);
  L.push(`**Contract:** ${model.program.contractNumber}`);
  L.push(
    `**Launch:** ${model.program.launchDate} ` +
      `(${daysBetween(opts.asOf, model.program.launchDate)} days out)`,
  );
  L.push("");

  // ---- narrative, human-written
  L.push("## Summary");
  L.push("");
  L.push(TODO);
  L.push("");

  // ---- delivery position
  L.push("## Where we are");
  L.push("");
  const active = model.phases.filter((p) => p.state === "in_progress");
  const done = model.phases.filter((p) => p.state === "complete").length;
  if (model.phases.length) {
    L.push(`${done} of ${model.phases.length} phases complete.`);
    L.push("");
    for (const p of active) {
      L.push(`**${p.name}** — ${p.window}`);
      L.push("");
      L.push(`${p.goal}`);
      L.push("");
      if (p.exitCriteria.length) {
        L.push("Exit criteria:");
        for (const c of p.exitCriteria) L.push(`- [ ] ${c}`);
        L.push("");
      }
      if (p.gates.length) {
        L.push(`Gates: ${p.gates.join(" · ")}`);
        L.push("");
      }
    }
  } else {
    L.push(GAP);
    L.push("");
  }

  // ---- what's coming
  L.push("## What's coming");
  L.push("");
  if (opts.gates?.length) {
    L.push("| Gate | Days out | Exit criteria met | Open blockers | Pressure |");
    L.push("| --- | --: | --: | --: | --: |");
    for (const g of opts.gates) {
      L.push(
        `| ${g.phaseName} | ${g.daysRemaining} | ` +
          `${g.exitCriteriaMet}/${g.exitCriteriaTotal} | ${g.blockingWorkItems} | ` +
          `${pressureLabel(g.pressure)} |`,
      );
    }
    L.push("");
    L.push(
      "_Blockers are counted against the phase currently running; work items " +
        "carry no phase association, so future gates show none._",
    );
    L.push("");
  } else {
    L.push(GAP);
    L.push("");
  }

  // ---- milestones in and just past the window
  L.push("## Milestones");
  L.push("");
  const soon = model.milestones.filter((m) => m.date >= windowStart).slice(0, 8);
  if (soon.length) {
    for (const m of soon) {
      const d = daysBetween(opts.asOf, m.date);
      const when = d === 0 ? "today" : d > 0 ? `in ${d}d` : `${-d}d ago`;
      L.push(`- **${m.date}** (${when}) — ${m.label}${m.owner ? ` · ${m.owner}` : ""}`);
    }
    L.push("");
  } else {
    L.push(GAP);
    L.push("");
  }

  // ---- delivery work
  L.push("## Delivery");
  L.push("");
  if (model.workItems.length) {
    const byBucket = countBy(model.workItems, (w) => w.bucket);
    L.push(
      `${model.workItems.length} tracked items — ` +
        Object.entries(byBucket)
          .map(([k, n]) => `${n} ${k.replace("_", " ")}`)
          .join(", "),
    );
    L.push("");
    L.push("| Workstream | Owner | Health | Done | In progress | Open |");
    L.push("| --- | --- | --- | --: | --: | --: |");
    for (const ws of model.workstreams) {
      const items = model.workItems.filter((w) => w.workstream === ws.key);
      L.push(
        `| ${ws.label} | ${ws.owner || "—"} | ` +
          `${ws.health ? HEALTH_LABEL[ws.health] : "not reported"} | ` +
          `${items.filter((i) => i.bucket === "done").length} | ` +
          `${items.filter((i) => i.bucket === "in_progress").length} | ` +
          `${items.filter((i) => i.bucket !== "done" && i.bucket !== "canceled").length} |`,
      );
    }
    L.push("");
  } else {
    L.push(GAP + " No delivery data synced — Linear has not been read.");
    L.push("");
  }

  // ---- risks
  L.push("## Risks and blockers");
  L.push("");
  if (model.risks.length) {
    const open = [...model.risks].filter((r) => r.state !== "resolved").sort(bySeverityThenState);
    const high = open.filter((r) => r.severity === "high");
    L.push(
      `${open.length} open of ${model.risks.length} tracked — ` + `${high.length} high severity.`,
    );
    L.push("");
    L.push("| ID | Severity | Risk | Area | Owner | Next action | Tickets |");
    L.push("| --- | --- | --- | --- | --- | --- | --- |");
    for (const r of open) {
      const sev =
        r.likelihood && r.impact
          ? `${r.severity} (${r.likelihood}×${r.impact})`
          : r.severityNote
            ? `${r.severity} (${r.severityNote})`
            : r.severity;
      L.push(
        `| ${r.id} | ${sev} | ${cell(r.description)} | ${r.area ?? "—"} | ${r.owner ?? "—"} | ` +
          `${cell(r.mitigation)} | ${r.linkedWorkItems.join(", ") || "—"} |`,
      );
    }
    L.push("");
    const noDue = open.filter((r) => r.dueAt === null).length;
    if (noDue) {
      L.push(
        `_${noDue} of ${open.length} open risks carry no scheduled completion date. ` +
          "A POA&M requires one per row — enrich at source._",
      );
      L.push("");
    }
  } else {
    L.push(GAP + " The risk register is not connected yet.");
    L.push("");
  }

  // ---- provenance, the reason this is defensible
  L.push("---");
  L.push("");
  L.push("## Provenance");
  L.push("");
  L.push(`Assembled ${model.meta.assembledAt}.`);
  L.push(
    model.meta.freshestSourceAt
      ? `Most recent source read: ${model.meta.freshestSourceAt}.`
      : "No synced sources contributed to this report.",
  );
  if (model.meta.unsourced.length) {
    L.push("");
    L.push(
      `**Sections without a wired source:** ${model.meta.unsourced.join(", ")}. ` +
        "Treat these as gaps, not as zero.",
    );
  }
  L.push("");
  L.push("_Generated draft — review and edit before sending._");

  return L.join("\n");
}

// ---------------------------------------------------------------- helpers

/** Escape a value for a Markdown table cell. A stray pipe in prose would split
 *  the row and silently corrupt every column after it. */
function cell(v: string | null): string {
  return (v ?? "—").replace(/\|/g, "\\|").replace(/\n+/g, " ");
}

function pressureLabel(p: number): string {
  const pct = Math.round(p * 100);
  if (p >= 0.75) return `${pct}% critical`;
  if (p >= 0.5) return `${pct}% high`;
  if (p >= 0.25) return `${pct}% moderate`;
  return `${pct}% low`;
}

function countBy<T>(xs: T[], key: (x: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of xs) {
    const k = key(x);
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

function shiftDays(iso: string, delta: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`) + delta * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86400000,
  );
}
