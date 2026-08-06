// Sprint status rollup: a task-oriented, checkbox-driven view of the current
// sprint window (or current phase, on phase-based programs). Modelled on the
// strategist's hand-maintained Notion doc — grouped by workstream, uses `[x]`
// / `[ ]` so it pastes cleanly into Notion, and includes a waiting-on table
// plus an "in flight, not gating" watch list.
//
// Same read-only-spine rules as weekly-rollup.ts: nothing is fabricated;
// human-authored context sections render as `> _To be written._` placeholders
// rather than as invented narrative. The tool assembles items and citations;
// the human writes the story.
//
// Pure function of (ProgramModel, options) -> Markdown. No randomness, no
// wall-clock reads: two runs against the same inputs produce identical bytes.

import type { ProgramModel, WorkItemRecord } from "../program-model";
import type { ProgramConfig } from "../program.config";
import { derivePhaseState, lifecyclePhasesFor } from "../program-model.adapters";
import { summarizeTask, tidySection } from "../task-summary";

export interface SprintRollupOptions {
  /** Reporting date, YYYY-MM-DD. Determines which sprint/phase is "current". */
  asOf: string;
  /**
   * The active program's config. Sprint windows and workstream labels live
   * here rather than in the ProgramModel, so pass it explicitly rather than
   * re-reading from PROGRAM (which is only the landing default).
   */
  program: ProgramConfig;
  /**
   * Checkbox tasks off the program's Notion tracker, if it keeps one.
   *
   * These are the reason the rollup was under-reporting: on the VA program the
   * tracker holds ~42 open items against 26 open Linear issues, so a status doc
   * built off the board alone described a third of the work. Undefined means no
   * tracker is configured; an empty array means one was read and is fully
   * ticked — different facts, rendered differently.
   */
  trackerTasks?: TrackerTask[];
}

/** One hand-maintained checkbox task. Mirrors NotionTask without importing the
 *  server module into this pure renderer. */
export interface TrackerTask {
  text: string;
  checked: boolean;
  section: string | null;
  ticketRefs: string[];
}

interface WindowMeta {
  /** Which axis this program uses — determines the header wording. */
  axis: "sprint" | "phase";
  /** Human name of the window: "Sprint 5", "Live Customer Handoff". */
  label: string;
  /** Inclusive YYYY-MM-DD bounds. */
  start: string;
  end: string;
  /** Number of calendar days remaining, inclusive of asOf. Non-negative if
   *  the window is still open; negative if it has passed. */
  daysRemaining: number;
}

const TODO = "> _To be written._";

export function renderSprintRollup(model: ProgramModel, opts: SprintRollupOptions): string {
  const window = pickWindow(opts.program, opts.asOf);
  const L: string[] = [];

  // ---- Header
  const axisWord = window.axis === "sprint" ? "sprint" : "phase";
  L.push(`# ${model.program.name} — ${window.label} status`);
  L.push("");
  L.push(
    `**Window:** ${window.start} to ${window.end} · ` +
      (window.daysRemaining > 0
        ? `${window.daysRemaining} days remaining as of ${opts.asOf}`
        : window.daysRemaining === 0
          ? `today is the last day (${opts.asOf})`
          : `closed ${-window.daysRemaining} days ago`),
  );
  L.push(`**Client:** ${model.program.client}`);
  if (model.program.contractNumber) L.push(`**Contract:** ${model.program.contractNumber}`);
  L.push(
    `**Launch:** ${model.program.launchDate} (${daysBetween(opts.asOf, model.program.launchDate)} days out)`,
  );
  L.push("");

  // ---- Critical path (human-authored)
  L.push(`## Critical path inside the ${axisWord}`);
  L.push("");
  L.push(TODO);
  L.push(
    "_The tool lists open tickets and follow-ups below; the story of which of them are on the critical path — and which decisions depend on which — is a human read._",
  );
  L.push("");

  // ---- Sprint tasks by workstream
  // Every open ticket is grouped by workstream classifier. In-progress at the
  // top, todo below, then any done items that closed inside the window (so a
  // reader sees what actually shipped this sprint alongside what's still
  // open). Backlog items are excluded — they are not sprint-scope tasks.
  L.push(`## Tasks by workstream`);
  L.push("");
  const items = model.workItems;
  const inWindowDone = items.filter(
    (w) =>
      w.bucket === "done" &&
      w.updatedAt !== null &&
      w.updatedAt >= window.start &&
      w.updatedAt <= window.end,
  );
  const openItems = items.filter(
    (w) => w.bucket === "in_progress" || w.bucket === "todo",
  );

  const wsKeys = model.workstreams.map((w) => w.key);
  let totalOpen = 0;
  let totalClosedThisWindow = 0;

  for (const ws of model.workstreams) {
    const wsOpen = openItems.filter((w) => w.workstream === ws.key);
    const wsClosed = inWindowDone.filter((w) => w.workstream === ws.key);
    if (wsOpen.length === 0 && wsClosed.length === 0) continue;
    totalOpen += wsOpen.length;
    totalClosedThisWindow += wsClosed.length;
    L.push(`### ${ws.label} (${wsOpen.length} open, ${wsClosed.length} closed this ${axisWord})`);
    for (const item of sortForList(wsOpen)) {
      L.push(`- [ ] ${item.title} [${item.identifier}]${assigneeTag(item)}${priorityTag(item)}`);
    }
    for (const item of sortForList(wsClosed)) {
      L.push(`- [x] ${item.title} [${item.identifier}]${assigneeTag(item)}`);
    }
    L.push("");
  }

  // Anything the classifier assigned to a workstream not in the roster —
  // shouldn't happen with a well-defined program, but the "unknown" case is
  // real for a keyword miss, and hiding it would understate the open count.
  const orphaned = openItems.filter((w) => !wsKeys.includes(w.workstream));
  if (orphaned.length) {
    L.push(`### Uncategorised (${orphaned.length})`);
    for (const item of sortForList(orphaned)) {
      L.push(`- [ ] ${item.title} [${item.identifier}]${assigneeTag(item)}${priorityTag(item)}`);
    }
    L.push("");
  }

  if (totalOpen === 0 && totalClosedThisWindow === 0) {
    L.push("_No open tickets and no closures in this window. Verify the Linear source is wired._");
    L.push("");
  } else {
    L.push(
      `_${totalOpen} open · ${totalClosedThisWindow} closed this ${axisWord}. Attribution: some rows are keyword-classified per the workstream config; tag issues at source to move them off inference._`,
    );
    L.push("");
  }

  // ---- Follow-ups: the sub-issue tasks caught between calls. This section
  //      keeps the doc actionable — the ticket list above is what the team
  //      moves; follow-ups are what the strategist personally chases.
  //      Sourced from the follow-ups snapshot passed in through the model's
  //      unsourced-list is a signal that the follow-ups file isn't wired.
  // ---- Notion tracker tasks. Rendered before Follow-ups because on a program
  //      that keeps a tracker these ARE the working list; the Linear section
  //      above is only the subset that got ticketed.
  const tracker = opts.trackerTasks;
  if (tracker !== undefined) {
    const trackerOpen = tracker.filter((t) => !t.checked);
    const trackerDone = tracker.filter((t) => t.checked);
    L.push("## Tracker tasks");
    L.push("");
    if (tracker.length === 0) {
      L.push("_The tracker page holds no checkbox items._");
      L.push("");
    } else {
      // Section order is first-seen, which is page order — the order the author
      // chose. Re-sorting would discard a real editorial signal.
      const order: string[] = [];
      const bySection = new Map<string, TrackerTask[]>();
      for (const t of tracker) {
        const key = t.section ?? "Ungrouped";
        if (!bySection.has(key)) {
          bySection.set(key, []);
          order.push(key);
        }
        bySection.get(key)!.push(t);
      }
      for (const section of order) {
        const rows = bySection.get(section)!;
        const open = rows.filter((t) => !t.checked);
        const closedRows = rows.filter((t) => t.checked);
        if (open.length === 0 && closedRows.length === 0) continue;
        L.push(`### ${tidySection(section)} (${open.length} open, ${closedRows.length} done)`);
        for (const t of open) emitTracker(L, t, false);
        for (const t of closedRows) emitTracker(L, t, true);
        L.push("");
      }
      L.push(
        `_${trackerOpen.length} open · ${trackerDone.length} done on the Notion tracker. These are hand-maintained checkboxes, most of which never became Linear tickets — the counts here and in the Linear section above are separate populations, not a single total._`,
      );
      L.push("");
    }
  }

  L.push("## Follow-ups");
  L.push("");
  L.push(TODO);
  L.push(
    "_Copy the current open follow-ups from the Follow-ups page into this section. Not auto-included: follow-up curation is browser-local by design (see follow-ups.ts), and pulling it server-side would bind the doc to one person's decisions._",
  );
  L.push("");

  // ---- Waiting on external: from the Notion risk register, whose owner and
  //      mitigation columns are exactly the shape a "waiting on X to do Y"
  //      row wants. Only "open" or "in-flight" risks — resolved ones would
  //      pad the table with noise.
  L.push("## Waiting on external");
  L.push("");
  const openRisks = model.risks.filter(
    (r) => r.state !== "resolved" && r.owner !== null && r.mitigation !== null,
  );
  if (openRisks.length) {
    L.push("| Item | Owner | Severity | Status |");
    L.push("| --- | --- | --- | --- |");
    for (const r of openRisks) {
      L.push(
        `| ${cell(r.mitigation)} | ${cell(r.owner)} | ${r.severity} | ${r.state} |`,
      );
    }
    L.push("");
    L.push("_Rows from the risk register where an owner + mitigation is stated. The register lives in Notion; edits belong there, not here._");
    L.push("");
  } else {
    L.push("> **Not yet sourced.** No risks with a named external owner + mitigation are in the register — or the register isn't wired up.");
    L.push("");
  }

  // ---- In flight, not gating: items outside the window (backlog, or open
  //      with a due-date past the window end). Frames what's next without
  //      cluttering the "must ship this sprint" list.
  L.push(`## In flight, not gating this ${axisWord}`);
  L.push("");
  const outOfWindow = items.filter(
    (w) =>
      (w.bucket === "backlog" || w.bucket === "todo") &&
      w.dueDate !== null &&
      w.dueDate > window.end,
  );
  if (outOfWindow.length) {
    for (const item of sortForList(outOfWindow)) {
      const due = item.dueDate ? ` · due ${item.dueDate}` : "";
      L.push(`- ${item.title} [${item.identifier}]${assigneeTag(item)}${due}`);
    }
    L.push("");
  } else {
    L.push(
      "_No tickets with a due date beyond the window. Anything past this beat lives in the backlog without a scheduled date, so it isn't shown here — add due dates in Linear to surface them._",
    );
    L.push("");
  }

  // ---- Provenance footer
  L.push("---");
  L.push("");
  L.push("## Provenance");
  L.push("");
  L.push(`Refreshed ${opts.asOf} against:`);
  const sourceLine: string[] = [];
  sourceLine.push(`Linear (${items.length} issues, ${totalOpen} open in this ${axisWord})`);
  if (model.risks.length) {
    sourceLine.push(`Notion risk register (${model.risks.length} rows)`);
  }
  sourceLine.push(`${model.milestones.length} milestones`);
  L.push(`- ${sourceLine.join("; ")}.`);
  if (model.meta.freshestSourceAt) {
    L.push(`- Most recent source read: ${model.meta.freshestSourceAt}.`);
  }
  if (model.meta.unsourced.length) {
    L.push(
      `- Sections without a wired source: ${model.meta.unsourced.join(", ")}. Treat as gaps, not zero.`,
    );
  }
  L.push("");
  L.push("_Generated draft — review and edit before sending._");

  return L.join("\n");
}

// -------- window selection --------

/**
 * Which window does "this sprint" mean for the program? Sprint-based programs
 * find the sprint containing today (or, if today is between sprints, the next
 * one that starts). Phase-based programs use the phase currently in progress
 * per the same derivation the command centre uses.
 */
function pickWindow(program: ProgramConfig, asOf: string): WindowMeta {
  if (program.timeAxis === "sprint") {
    const strip = program.sprintStrip;
    const containing = strip.find((s) => s.start <= asOf && asOf <= s.end);
    const win = containing ?? strip.find((s) => s.start > asOf) ?? strip[strip.length - 1];
    return {
      axis: "sprint",
      label: win.label,
      start: win.start,
      end: win.end,
      daysRemaining: daysBetween(asOf, win.end),
    };
  }
  // Phase-based programs use the current lifecycle phase as the window.
  const phases = lifecyclePhasesFor(program);
  const active = phases.find((p) => derivePhaseState(p, asOf) === "in_progress");
  const fallback = active ?? phases[phases.length - 1] ?? {
    id: "unknown",
    name: "no active phase",
    startsOn: asOf,
    endsOn: asOf,
  };
  return {
    axis: "phase",
    label: fallback.name,
    start: fallback.startsOn,
    end: fallback.endsOn,
    daysRemaining: daysBetween(asOf, fallback.endsOn),
  };
}

// -------- helpers --------

/**
 * Order tickets inside a workstream section. Priority first (Urgent > High >
 * Medium > Low > None), then most-recently-updated so freshest activity leads.
 */
function sortForList<T extends WorkItemRecord>(items: T[]): T[] {
  const priRank = (p: number | null) => (p && p > 0 ? p : 99);
  return [...items].sort((a, b) => {
    const pd = priRank(a.priority) - priRank(b.priority);
    if (pd !== 0) return pd;
    const au = a.updatedAt ?? "0000-00-00";
    const bu = b.updatedAt ?? "0000-00-00";
    return bu.localeCompare(au);
  });
}

function assigneeTag(item: WorkItemRecord): string {
  if (!item.assignee) return "";
  // Strip an email host if the assignee is stored as "name@domain". A first
  // name reads better in a rollup than a full email.
  const at = item.assignee.indexOf("@");
  const name = at > 0 ? item.assignee.slice(0, at) : item.assignee;
  return ` · ${name}`;
}

function priorityTag(item: WorkItemRecord): string {
  // Only Urgent and High get a visible chip — a rollup with a "medium" tag on
  // every second line is just noise. The full priority is still in Linear.
  if (item.priority === 1) return " · **urgent**";
  if (item.priority === 2) return " · **high**";
  return "";
}

/**
 * Emit one tracker row as a checkbox line plus, when the author's note ran
 * long, an indented continuation.
 *
 * Two lines rather than one because the tracker writes working notes: a single
 * `- [ ]` carrying three sentences is unreadable in Markdown and unusable when
 * pasted back into Notion, where each checkbox should be one thing. The
 * headline is the thing; the detail sits under it and stays exact.
 *
 * Ticket refs append only when absent from the text — the tracker usually
 * writes them inline ("… on prototype [DEP-1922]"), and appending
 * unconditionally printed the id twice. Refs stay as citations rather than
 * links: hand-typed, and they can point at a closed or renamed issue.
 */
function emitTracker(L: string[], t: TrackerTask, checked: boolean): void {
  const sum = summarizeTask(t.text);
  const missing = t.ticketRefs.filter((r) => !t.text.includes(r));
  const refs = missing.length ? ` [${missing.join(", ")}]` : "";
  L.push(`- [${checked ? "x" : " "}] ${sum.headline}${refs}`);
  // Detail only on open items. A completed line needs to state what shipped,
  // not re-litigate how — and printing it doubles the length of the done half
  // of every section.
  if (sum.detail && !checked) L.push(`  ${sum.detail}`);
}

function cell(v: string | null): string {
  return (v ?? "—").replace(/\|/g, "\\|").replace(/\n+/g, " ");
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86400000,
  );
}
