// Adapters: turn the sources we have into ProgramModel records.
//
// Each adapter is responsible for stamping honest provenance. Nothing here
// invents a SourceRef — if a record was authored in config or a seed file, it
// says so, so a rendered artifact can distinguish a fact we pulled from a fact
// we typed.

import { PROGRAM } from "./program.config";
import { LIFECYCLE, type LifecyclePhase } from "./va-data";
import {
  derivedFrom,
  fromConfig,
  gateReadiness,
  type GateReadiness,
  type MilestoneRecord,
  type PhaseRecord,
  type PhaseState,
  type WorkItemRecord,
} from "./program-model";

/** Today as YYYY-MM-DD. Injectable so renderers stay deterministic in tests. */
export function today(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

/**
 * Phase state from dates rather than a stored flag. Storing it means someone
 * has to remember to move it, which is how a board becomes fiction.
 */
export function derivePhaseState(
  phase: { startsOn: string; endsOn: string },
  asOf: string,
): PhaseState {
  if (asOf > phase.endsOn) return "complete";
  if (asOf < phase.startsOn) return "upcoming";
  return "in_progress";
}

export function phasesFromLifecycle(asOf: string = today()): PhaseRecord[] {
  return LIFECYCLE.map((p: LifecyclePhase) => ({
    id: p.id,
    name: p.name,
    window: p.window,
    state: derivePhaseState(p, asOf),
    goal: p.goal,
    exitCriteria: p.exitCriteria,
    gates: p.gates,
    // Seed content today. Becomes "sourced" once the lifecycle plan is
    // Notion-backed rather than a TS literal.
    origin: derivedFrom("LIFECYCLE seed + date comparison"),
  }));
}

/**
 * Milestones from the config's sprint strip plus the named key dates. Linear
 * project milestones are not synced yet; when they are, they merge in here and
 * arrive with real SourceRefs.
 */
export function milestonesFromConfig(asOf: string = today()): MilestoneRecord[] {
  const out: MilestoneRecord[] = PROGRAM.sprintStrip.map((s) => ({
    id: s.key,
    label: `${s.label} ends`,
    date: s.end,
    state: asOf > s.end ? "complete" : asOf < s.start ? "upcoming" : "in_progress",
    owner: null,
    workstream: null,
    dependsOn: [],
    origin: fromConfig,
  }));

  const named: Array<[string, string, string]> = [
    ["code-freeze", "Code freeze / UAT start", PROGRAM.keyDates.codeFreeze],
    ["launch", "Public launch", PROGRAM.keyDates.launch],
  ];
  for (const [id, label, date] of named) {
    // A named key date and a sprint boundary can land on the same day — the
    // launch date is also the last sprint's end. The named one is the one worth
    // reporting, so it displaces the sprint boundary rather than sitting
    // beside it as an apparent second event.
    const clash = out.findIndex((m) => m.date === date);
    const record: MilestoneRecord = {
      id,
      label,
      date,
      state: asOf > date ? "complete" : "upcoming",
      owner: null,
      workstream: null,
      dependsOn: [],
      origin: fromConfig,
    };
    if (clash >= 0) out[clash] = record;
    else out.push(record);
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Heuristic: does this work item look like it is blocking something? */
export function looksBlocking(item: Pick<WorkItemRecord, "title" | "labels">): boolean {
  if (item.labels.some((l) => /block/i.test(l))) return true;
  return /\bblock(ed|er|ing)?\b/i.test(item.title);
}

/**
 * Gate readiness for every phase that has not closed yet, worst first. This is
 * the "what asteroid is coming at us" list.
 */
export function upcomingGateReadiness(
  phases: PhaseRecord[],
  workItems: WorkItemRecord[],
  opts: { asOf?: string; exitCriteriaMet?: Record<string, number> } = {},
): GateReadiness[] {
  const asOf = opts.asOf ?? today();
  const met = opts.exitCriteriaMet ?? {};

  const openBlockers = workItems.filter(
    (w) => w.bucket !== "done" && w.bucket !== "canceled" && looksBlocking(w),
  ).length;

  return phases
    .filter((p) => p.state !== "complete")
    .map((p) => {
      const phaseEnd = LIFECYCLE.find((l) => l.id === p.id)?.endsOn ?? asOf;
      return gateReadiness(p, {
        daysRemaining: daysBetween(asOf, phaseEnd),
        // Unknown until exit criteria are individually trackable — counts as
        // unmet, which correctly reads as "we cannot show this gate is ready".
        exitCriteriaMet: met[p.id] ?? 0,
        // Work items carry no phase association, so blockers can only be
        // attributed to the phase actually running. Charging them against
        // future phases too would inflate every row by the same amount and
        // read as though each gate had its own blockers.
        blockingWorkItems: p.state === "in_progress" ? openBlockers : 0,
      });
    })
    .sort((a, b) => b.pressure - a.pressure);
}
