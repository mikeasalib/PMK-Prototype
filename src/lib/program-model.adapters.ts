// Adapters: turn the sources we have into ProgramModel records.
//
// Each adapter is responsible for stamping honest provenance. Nothing here
// invents a SourceRef — if a record was authored in config or a seed file, it
// says so, so a rendered artifact can distinguish a fact we pulled from a fact
// we typed.

import { PROGRAM, type ProgramConfig } from "./program.config";
import { LIFECYCLE, type LifecyclePhase } from "./va-data";
import { recDeploymentPhases } from "./rec-deployment-lifecycle";
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

/**
 * Lifecycle phases per program.
 *
 * This registry exists specifically to stop VA's seed content leaking into other
 * programs. Before it, phasesFromLifecycle returned LIFECYCLE unconditionally,
 * so Ventura would have rendered the VA program's six phases — with VA exit
 * criteria and VA gates — as if they were its own. A program with no lifecycle
 * seed gets an empty list, and the renderers already mark that as unsourced.
 */
// Ventura's phases are back-calculated from its Jul 13 go-live using the
// playbook's target durations, so the pre-launch dates are approximate — actual
// deployments always run longer. Launch onwards is anchored to the real date.
const PHASES_BY_PROGRAM: Record<string, LifecyclePhase[]> = {
  va: LIFECYCLE,
  ventura: recDeploymentPhases("2026-07-13"),
};

export function phasesFromLifecycle(
  program: ProgramConfig = PROGRAM,
  asOf: string = today(),
): PhaseRecord[] {
  return (PHASES_BY_PROGRAM[program.id] ?? []).map((p: LifecyclePhase) => ({
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
export function milestonesFromConfig(
  program: ProgramConfig = PROGRAM,
  asOf: string = today(),
): MilestoneRecord[] {
  const out: MilestoneRecord[] = program.sprintStrip.map((s) => ({
    id: s.key,
    // A window "ends"; a point-in-time gate does not. Appending unconditionally
    // produced "Itineo sunset ends" and "Gate fees fully Kaizen ends".
    label: s.start === s.end ? s.label : `${s.label} ends`,
    date: s.end,
    state: asOf > s.end ? "complete" : asOf < s.start ? "upcoming" : "in_progress",
    owner: null,
    workstream: null,
    dependsOn: [],
    origin: fromConfig,
  }));

  for (const { id, label, date } of program.namedMilestones) {
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

/**
 * Milestones from Linear, which is the real source. Preferred over
 * milestonesFromConfig wherever both exist — config dates were hand-maintained
 * and are known to disagree with Linear in two places.
 *
 * Undated milestones are dropped from the schedule rather than given a
 * placeholder date, and reported separately so the caller can say how many were
 * left out instead of silently shortening the schedule.
 */
export function milestonesFromLinear(
  rows: Array<{
    source_id: string;
    name: string;
    target_date: string | null;
    progress: number | null;
    url: string | null;
    synced_at: string;
  }>,
  asOf: string = today(),
): { milestones: MilestoneRecord[]; undated: number } {
  const dated = rows.filter((r) => r.target_date);
  const milestones = dated
    .map((r) => ({
      id: r.source_id,
      // Progress arrives as a 0..1 fraction; show it the way Linear does.
      label:
        r.progress !== null && r.progress > 0
          ? `${r.name} (${Math.round(r.progress * 100)}%)`
          : r.name,
      date: r.target_date!,
      state: (asOf > r.target_date! ? "complete" : "upcoming") as MilestoneRecord["state"],
      owner: null,
      workstream: null,
      dependsOn: [],
      origin: {
        kind: "sourced" as const,
        refs: [
          {
            system: "linear" as const,
            id: r.source_id,
            url: r.url ?? undefined,
            fetchedAt: r.synced_at,
          },
        ],
      },
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { milestones, undated: rows.length - dated.length };
}

/** Heuristic: does this work item look like it is blocking something? */
export function looksBlocking(item: Pick<WorkItemRecord, "title" | "labels">): boolean {
  if (item.labels.some((l) => /block/i.test(l))) return true;
  return /\bblock(ed|er|ing)?\b/i.test(item.title);
}

/** The shape deriveHealth reads from an issue — bucket plus the raw signals. */
export interface HealthSignalItem {
  bucket: string;
  title: string;
  labels: string[];
  /** Linear priority: 1 urgent, 2 high, 3 medium, 4 low, 0/none. */
  priority: number | null;
  /** YYYY-MM-DD, or null when the issue carries no due date. */
  dueDate: string | null;
}

/**
 * Health for one workstream, derived from real Linear signals rather than a
 * hand-typed field.
 *
 * The burn-down used to read a health value transcribed by hand into
 * workstream-updates.ts (dated, and absent entirely for any program without that
 * seed — so every Ventura workstream showed a fake "On track"). This computes it
 * from what the board actually says:
 *
 *   blocked   an open item is a blocker or is past its due date
 *   at_risk   open urgent/high work is sitting untouched (none in progress), or
 *             a workstream with several items has finished none
 *   on_track  otherwise
 *
 * Returns null for a workstream with no work — "on track" would overstate an
 * empty column, so the row shows a dash instead.
 */
export function deriveHealth(
  items: HealthSignalItem[],
  asOf: string = today(),
): "on_track" | "at_risk" | "blocked" | null {
  if (items.length === 0) return null;

  const open = items.filter((i) => i.bucket !== "done" && i.bucket !== "canceled");
  const anyBlockedOrOverdue = open.some(
    (i) => looksBlocking(i) || (i.dueDate !== null && i.dueDate < asOf),
  );
  if (anyBlockedOrOverdue) return "blocked";

  const openHighPri = open.filter((i) => i.priority === 1 || i.priority === 2);
  const inProgress = open.filter((i) => i.bucket === "in_progress");
  const done = items.filter((i) => i.bucket === "done");

  // High-priority work that nobody has started, or a sizable workstream with
  // nothing finished yet, is at risk without being outright blocked.
  if (openHighPri.length > 0 && inProgress.length === 0) return "at_risk";
  if (done.length === 0 && items.length >= 3 && open.length > 0) return "at_risk";

  return "on_track";
}

/**
 * Gate readiness for every phase that has not closed yet, worst first. This is
 * the "what asteroid is coming at us" list.
 */
export function upcomingGateReadiness(
  phases: PhaseRecord[],
  // Only the fields the blocker heuristic needs, so a route can pass Linear rows
  // directly without first building full WorkItemRecords. WorkItemRecord[] still
  // satisfies this structurally, so the server caller is unchanged.
  workItems: Array<Pick<WorkItemRecord, "bucket" | "title" | "labels">>,
  opts: {
    asOf?: string;
    exitCriteriaMet?: Record<string, number>;
    program?: ProgramConfig;
  } = {},
): GateReadiness[] {
  const prog = opts.program ?? PROGRAM;
  const asOf = opts.asOf ?? today();
  const met = opts.exitCriteriaMet ?? {};

  const openBlockers = workItems.filter(
    (w) => w.bucket !== "done" && w.bucket !== "canceled" && looksBlocking(w),
  ).length;

  return phases
    .filter((p) => p.state !== "complete")
    .map((p) => {
      const phaseEnd =
        (PHASES_BY_PROGRAM[prog.id] ?? []).find((l) => l.id === p.id)?.endsOn ?? asOf;
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

/**
 * "Sitting untouched" — in-progress items whose last source update is older
 * than the aging threshold. Answers the strategist's daily question of what
 * is technically on the board but not actually moving.
 *
 * Signal is `source_updated_at` from Linear, not started_at — anyone editing
 * the description, changing state, or leaving a comment resets the counter,
 * which matches the intuition of "someone is still touching this." An issue
 * with no updatedAt at all is excluded rather than counted as maximally
 * stalled: absent metadata is not the same as absent activity.
 *
 * Buckets are chosen for a typical sprint cadence, not tuned per program.
 * They are on-screen labels; a reader can compare across engagements.
 */
export type AgingSeverity = "aging" | "stalled" | "cold";
export const AGING_THRESHOLD_DAYS = 7;

export interface AgingCandidate {
  identifier: string;
  title: string;
  /** Must be the normalised bucket, i.e. "in_progress" for a stalled item. */
  bucket: string;
  updatedAt: string | null;
  assignee: string | null;
  priority: number | null;
  workstream: string;
  url: string | null;
}

export interface StalledItem extends AgingCandidate {
  daysSinceUpdate: number;
  severity: AgingSeverity;
}

export function agingSeverity(days: number): AgingSeverity {
  if (days >= 30) return "cold";
  if (days >= 14) return "stalled";
  return "aging";
}

/**
 * Filter to in-progress items with an updatedAt older than the threshold,
 * annotate with days-since and severity, sort oldest first. Ties break on
 * higher priority (urgent/high) so a stale P1 outranks a stale P4.
 */
export function sittingUntouched(items: AgingCandidate[], asOf: string = today()): StalledItem[] {
  const out: StalledItem[] = [];
  for (const item of items) {
    if (item.bucket !== "in_progress") continue;
    if (!item.updatedAt) continue;
    const days = daysBetween(item.updatedAt.slice(0, 10), asOf);
    if (days < AGING_THRESHOLD_DAYS) continue;
    out.push({ ...item, daysSinceUpdate: days, severity: agingSeverity(days) });
  }
  return out.sort((a, b) => {
    if (b.daysSinceUpdate !== a.daysSinceUpdate) return b.daysSinceUpdate - a.daysSinceUpdate;
    // Linear priority is 1 urgent, 2 high, 3 medium, 4 low, 0 none. A "0/none"
    // sorts after 4 so unprioritised ties fall to the bottom.
    const ap = a.priority && a.priority > 0 ? a.priority : 99;
    const bp = b.priority && b.priority > 0 ? b.priority : 99;
    return ap - bp;
  });
}
