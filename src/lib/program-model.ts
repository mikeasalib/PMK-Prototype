// The intermediate model every artifact renders from.
//
// Why this exists: the rollup, project plan, and POA&M all project from the same
// facts. Three bespoke pipelines would drift, so they all read ProgramModel and
// each renderer is a pure function ProgramModel -> Artifact.
//
// Why provenance is on every record: these artifacts leave the building and go
// to the prime and the customer. "Where did this row come from" has to be
// answerable per row, not per document. SourceRef is what makes a generated
// POA&M defensible, and it is nearly free because every fact already arrives
// attached to a synced source row.
//
// Provenance is deliberately NOT optional on sourced records. A record with no
// SourceRef is a record nobody can stand behind, so `origin: "config"` is a
// distinct, explicit state rather than an empty refs array.

import {
  PROGRAM,
  type AttributionBasis,
  type ProgramConfig,
  type Workstream,
} from "./program.config";
import type { Health } from "./workstream-updates";

// ---------------------------------------------------------------- provenance

export type SourceSystem = "linear" | "notion" | "granola";

export interface SourceRef {
  system: SourceSystem;
  /** Identifier in the source system. */
  id: string;
  /** Deep link, when the source exposes one. */
  url?: string;
  /** When we last read it — the synced_at of the row this came from. */
  fetchedAt: string;
}

/**
 * Where a record came from. `config` means it was authored in
 * program.config.ts rather than synced — honest, and visibly different from a
 * sourced record in any artifact that prints provenance.
 */
export type Origin =
  | { kind: "sourced"; refs: SourceRef[] }
  | { kind: "config" }
  | { kind: "derived"; from: string };

export const fromConfig: Origin = { kind: "config" };
export const derivedFrom = (from: string): Origin => ({ kind: "derived", from });

// -------------------------------------------------------------------- records

export interface ProgramFacts {
  id: string;
  name: string;
  client: string;
  /** Null when the engagement has no contract number. Renderers must mark the
   *  gap rather than print an empty string that reads like a missing value. */
  contractNumber: string | null;
  periodLabel: string;
  launchDate: string; // YYYY-MM-DD
}

export interface WorkstreamRecord {
  key: string;
  label: string;
  owner: string;
  /** Null until sourced — see the note on health below. */
  health: Health | null;
  origin: Origin;
}

export type PhaseState = "complete" | "in_progress" | "upcoming";

export interface PhaseRecord {
  id: string;
  name: string;
  window: string;
  state: PhaseState;
  goal: string;
  /** The Definition of Done for this stage. */
  exitCriteria: string[];
  /** Stage gates that must clear before the phase can close. */
  gates: string[];
  origin: Origin;
}

export interface MilestoneRecord {
  id: string;
  label: string;
  date: string; // YYYY-MM-DD
  state: PhaseState;
  owner: string | null;
  workstream: string | null;
  dependsOn: string[];
  origin: Origin;
}

export interface WorkItemRecord {
  id: string;
  identifier: string;
  title: string;
  state: string | null;
  /** Normalised bucket: backlog | todo | in_progress | done | canceled. */
  bucket: string;
  assignee: string | null;
  workstream: string;
  priority: number | null;
  labels: string[];
  /**
   * How the workstream was arrived at. Only "stored" and "explicit" are facts;
   * "keyword" and "fallback" are inference. Carried per record so a renderer can
   * report the split instead of presenting a guess as a reading.
   */
  attribution: AttributionBasis;
  /** Real values from Linear. All nullable — an unfilled field is not a
   *  fabricated one. */
  dueDate: string | null;
  createdAt: string | null;
  /** Last change on the issue (any field, any comment). Powers aging /
   *  stalled-work signals in the same way as StoredLinearIssue's
   *  source_updated_at — the shape is identical, threaded through the model
   *  so server-only consumers (the brief writer) have it too. */
  updatedAt: string | null;
  origin: Origin;
}

/** Matches the register's own three-level key. Deliberately not extended with a
 *  "critical" level the source does not distinguish. */
export type RiskSeverity = "low" | "medium" | "high";
/** Mirrors the states the register actually uses. "monitoring" is kept distinct
 *  from "mitigating": watching a risk is not the same as acting on it. */
export type RiskState = "open" | "mitigating" | "monitoring" | "resolved";
export type Likelihood = "H" | "M" | "L";

/**
 * Shaped for the FedRAMP POA&M columns, since that is the strictest consumer.
 * Fields the register may not carry yet are nullable rather than absent, so a
 * renderer can emit an explicit gap marker instead of silently omitting a
 * required column.
 */
export interface RiskRecord {
  id: string;
  /** POA&M: Weakness Description. */
  description: string;
  severity: RiskSeverity;
  /** Likelihood x impact, when the register states it. Preserved separately
   *  because the register's three severity labels lose this granularity — R1
   *  (HxH) and R3 (MxH) are both "high". */
  likelihood: Likelihood | null;
  impact: Likelihood | null;
  /** Qualifier the register attaches to severity, e.g. "accepted", "mitigated". */
  severityNote: string | null;
  state: RiskState;
  /** Free-text area from the register, e.g. "WS1 / infra", "delivery / capacity". */
  area: string | null;
  workstream: string | null;
  /** POA&M: Point of Contact. */
  owner: string | null;
  /** POA&M: Remediation Plan. */
  mitigation: string | null;
  /** POA&M: Original Detection Date. */
  openedAt: string | null;
  /** POA&M: Scheduled Completion Date. */
  dueAt: string | null;
  /** POA&M: Security Control. Enrich-at-source; absent for delivery risks. */
  control: string | null;
  /** POA&M: Asset Identifier. */
  assetId: string | null;
  /** Linked delivery tickets. Plural — register rows cite up to three. */
  linkedWorkItems: string[];
  origin: Origin;
}

export interface DecisionRecord {
  date: string;
  summary: string;
  who: string | null;
  origin: Origin;
}

export type DependencyState = "clear" | "watch" | "block";

export interface DependencyRecord {
  fromWorkstream: string;
  toWorkstream: string;
  state: DependencyState;
  description: string;
  origin: Origin;
}

// ---------------------------------------------------------------------- model

export interface ProgramModel {
  program: ProgramFacts;
  workstreams: WorkstreamRecord[];
  phases: PhaseRecord[];
  milestones: MilestoneRecord[];
  workItems: WorkItemRecord[];
  risks: RiskRecord[];
  decisions: DecisionRecord[];
  dependencies: DependencyRecord[];
  /** When the model was assembled, and how fresh its inputs were. */
  meta: {
    assembledAt: string;
    /** Most recent synced_at across all contributing sources, if any. */
    freshestSourceAt: string | null;
    /** Sections with no source wired up yet. Renderers surface these. */
    unsourced: string[];
  };
}

// ------------------------------------------------------------------ assembly

export function programFactsFromConfig(program: ProgramConfig = PROGRAM): ProgramFacts {
  return {
    id: program.id,
    name: program.name,
    client: program.contract.customer,
    // Null for a commercial engagement with no contract vehicle. Kept null so a
    // renderer prints a gap rather than the string "null".
    contractNumber: program.contract.fullNumber,
    periodLabel: program.contract.period,
    launchDate: program.keyDates.launch,
  };
}

/**
 * Workstreams come from config. `health` stays null here on purpose: the only
 * health values that exist today are hand-transcribed in workstream-updates.ts
 * and dated, so treating them as current would be exactly the stale-content
 * problem this design is meant to avoid. A caller with a dated source can
 * attach health via withHealth().
 */
export function workstreamsFromConfig(program: ProgramConfig = PROGRAM): WorkstreamRecord[] {
  return program.workstreams.map((w: Workstream) => ({
    key: w.key,
    label: w.label,
    owner: w.owner,
    health: null,
    origin: fromConfig,
  }));
}

export function withHealth(
  workstreams: WorkstreamRecord[],
  health: Record<string, Health>,
  origin: Origin,
): WorkstreamRecord[] {
  return workstreams.map((w) => (health[w.key] ? { ...w, health: health[w.key], origin } : w));
}

/** A Linear issue row, normalised. `bucket` and `workstream` come from the caller
 *  so this stays free of the read-time classification logic in use-stored-data. */
export function workItemFromLinear(
  row: {
    source_id: string;
    identifier: string;
    title: string;
    state_name: string | null;
    priority: number | null;
    assignee: string | null;
    labels: string[] | null;
    url: string | null;
    due_date?: string | null;
    source_created_at?: string | null;
    source_updated_at?: string | null;
    synced_at: string;
  },
  bucket: string,
  workstream: string,
  attribution: AttributionBasis = "keyword",
): WorkItemRecord {
  return {
    id: row.source_id,
    identifier: row.identifier,
    title: row.title,
    state: row.state_name,
    bucket,
    assignee: row.assignee,
    workstream,
    priority: row.priority,
    labels: row.labels ?? [],
    attribution,
    dueDate: row.due_date ?? null,
    createdAt: row.source_created_at ? row.source_created_at.slice(0, 10) : null,
    updatedAt: row.source_updated_at ? row.source_updated_at.slice(0, 10) : null,
    origin: {
      kind: "sourced",
      refs: [
        {
          system: "linear",
          id: row.source_id,
          url: row.url ?? undefined,
          fetchedAt: row.synced_at,
        },
      ],
    },
  };
}

/** Newest fetchedAt across every sourced record in the model, or null. */
export function freshestSourceAt(model: Omit<ProgramModel, "meta">): string | null {
  const stamps: string[] = [];
  const collect = (o: Origin) => {
    if (o.kind === "sourced") for (const r of o.refs) stamps.push(r.fetchedAt);
  };
  model.workstreams.forEach((r) => collect(r.origin));
  model.phases.forEach((r) => collect(r.origin));
  model.milestones.forEach((r) => collect(r.origin));
  model.workItems.forEach((r) => collect(r.origin));
  model.risks.forEach((r) => collect(r.origin));
  model.decisions.forEach((r) => collect(r.origin));
  model.dependencies.forEach((r) => collect(r.origin));
  return stamps.length ? stamps.sort().at(-1)! : null;
}

/** Section names with no source wired up yet — renderers must surface these
 *  rather than emitting a confident-looking empty section. */
export function unsourcedSections(model: Omit<ProgramModel, "meta">): string[] {
  const out: string[] = [];
  if (!model.risks.length) out.push("risks");
  if (!model.decisions.length) out.push("decisions");
  if (!model.milestones.length) out.push("milestones");
  if (model.workstreams.every((w) => w.health === null)) out.push("workstream health");
  return out;
}

// ------------------------------------------------------------- gate readiness

export interface GateReadiness {
  phaseId: string;
  phaseName: string;
  /** Days until the phase window closes. Negative means overdue. */
  daysRemaining: number;
  exitCriteriaTotal: number;
  exitCriteriaMet: number;
  blockingWorkItems: number;
  /**
   * 0..1, higher is more at risk. Rises as the deadline approaches, as exit
   * criteria go unmet, and as blocking work accumulates. This is the
   * "what asteroid is coming at us" signal.
   */
  pressure: number;
}

export function gateReadiness(
  phase: Pick<PhaseRecord, "id" | "name" | "exitCriteria">,
  opts: {
    daysRemaining: number;
    exitCriteriaMet: number;
    blockingWorkItems: number;
    /** Window over which urgency ramps to full. Default one quarter. */
    horizonDays?: number;
  },
): GateReadiness {
  const total = phase.exitCriteria.length;
  const met = Math.max(0, Math.min(opts.exitCriteriaMet, total));
  const horizon = opts.horizonDays ?? 90;

  // Urgency: 0 when the deadline is a horizon away, 1 at or past the deadline.
  const urgency = clamp01(1 - opts.daysRemaining / horizon);
  // Incompleteness: share of exit criteria still open. No criteria means we
  // cannot assess readiness, which is itself a gap — treat as fully incomplete.
  const incomplete = total === 0 ? 1 : 1 - met / total;
  // Blocking work saturates: three blockers is about as bad as ten.
  const blocked = clamp01(opts.blockingWorkItems / 3);

  const pressure = clamp01(0.5 * urgency + 0.3 * incomplete + 0.2 * blocked);

  return {
    phaseId: phase.id,
    phaseName: phase.name,
    daysRemaining: opts.daysRemaining,
    exitCriteriaTotal: total,
    exitCriteriaMet: met,
    blockingWorkItems: opts.blockingWorkItems,
    pressure,
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
