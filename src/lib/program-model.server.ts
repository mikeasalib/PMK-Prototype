// Server-only: assemble a ProgramModel from every source that is wired up.
//
// This is the single place the model is built, so every artifact renders from
// identical facts. Sources that are unavailable contribute nothing rather than
// failing the whole assembly — a report with a marked gap is useful; a report
// that failed to generate is not.

import { PROGRAM, programById, type ProgramConfig } from "./program.config";
import {
  freshestSourceAt,
  programFactsFromConfig,
  unsourcedSections,
  workItemFromLinear,
  type ProgramModel,
  type WorkItemRecord,
} from "./program-model";
import {
  milestonesFromConfig,
  phasesFromLifecycle,
  today,
  upcomingGateReadiness,
} from "./program-model.adapters";
import type { GateReadiness } from "./program-model";

export interface AssembleResult {
  model: ProgramModel;
  gates: GateReadiness[];
  /** Per-source outcome, so the UI can say what did and did not contribute. */
  sources: Array<{ key: string; ok: boolean; message: string }>;
  /** "linear" when the schedule came from real milestones, "config" on fallback. */
  milestoneOrigin: string;
}

/**
 * Linear's state_type -> the normalised bucket used across the model.
 *
 * "duplicate" is a real state on this board (two live DEP issues carry it) and
 * must not fall through to backlog — a duplicate is not open work, and counting
 * it as such inflates every open-item total in every artifact.
 */
function bucketOf(stateType: string | null): string {
  switch ((stateType ?? "").toLowerCase()) {
    case "completed":
      return "done";
    case "canceled":
    case "duplicate":
      return "canceled";
    case "started":
      return "in_progress";
    case "unstarted":
      return "todo";
    case "backlog":
      return "backlog";
    default:
      // Unknown state types are surfaced as-is rather than silently bucketed,
      // so a new Linear workflow state shows up as odd instead of as backlog.
      return (stateType ?? "unknown").toLowerCase();
  }
}

export async function assembleProgramModel(
  programId: string = PROGRAM.id,
  asOf = today(),
): Promise<AssembleResult> {
  const sources: AssembleResult["sources"] = [];
  const program: ProgramConfig = programById(programId);
  const { sourcesFor } = await import("./program.sources.server");
  const src = sourcesFor(program.id);

  // ---- Linear work items, read directly from Linear's API. Was a Supabase
  //      mirror read, which could never succeed: no Supabase instance sits
  //      behind this deployment, so every read failed and fell through to the
  //      snapshot while the footer reported "not synced".
  let workItems: WorkItemRecord[] = [];
  let liveIssuesLoaded = false;
  if (!src.linear) {
    sources.push({
      key: "linear",
      ok: false,
      message: "no Linear project configured for this program",
    });
  } else {
    const { readLinearIssues, linearConfigured } = await import("./sources.direct.server");
    if (!linearConfigured()) {
      sources.push({ key: "linear", ok: false, message: "LINEAR_API_KEY not set" });
    } else {
      const read = await readLinearIssues(program.id);
      if (read && read.rows.length > 0) {
        const { classifyWorkstreamDetailed } = await import("./program.config");
        workItems = read.rows.map((r) => {
          const a = classifyWorkstreamDetailed(r.title, r.workstream, program);
          return workItemFromLinear(r, bucketOf(r.state_type), a.workstream, a.basis);
        });
        liveIssuesLoaded = true;
        sources.push({
          key: "linear",
          ok: true,
          message: `${workItems.length} issues (live read ${read.readAt})`,
        });
      } else {
        sources.push({ key: "linear", ok: false, message: "live read returned nothing" });
      }
    }
  }

  // Snapshot fallback for work items — mirrors sync.functions.ts's rule.
  // Keeps every artifact renderable when no token is configured. The origin
  // travels into the provenance footer, so a rollup built off a snapshot says
  // so rather than presenting captured rows as a live read.
  if (!liveIssuesLoaded) {
    const { snapshotFor, snapshotFallbackAllowed } = await import("./snapshots");
    const snap = snapshotFallbackAllowed() ? snapshotFor(program.id) : null;
    if (snap && snap.linear_issues.length > 0) {
      const { classifyWorkstreamDetailed } = await import("./program.config");
      workItems = snap.linear_issues.map((r) => {
        const a = classifyWorkstreamDetailed(r.title, r.workstream, program);
        return workItemFromLinear(r, bucketOf(r.state_type), a.workstream, a.basis);
      });
      sources.push({
        key: "linear:snapshot",
        ok: true,
        message: `${workItems.length} issues (captured ${snap.fetchedAt})`,
      });
    }
  }

  // ---- Linear project milestones. The real dated backbone; falls back to
  //      config only if Linear has none, and says which was used.
  let milestones = milestonesFromConfig(program, asOf);
  let milestoneOrigin = "config";
  try {
    const { readLinearMilestones } = await import("./sources.direct.server");
    const read = await readLinearMilestones(program.id);
    const rows = read?.rows ?? [];

    if (rows.length) {
      const { milestonesFromLinear } = await import("./program-model.adapters");
      const out = milestonesFromLinear(rows, asOf);
      if (out.milestones.length) {
        milestones = out.milestones;
        milestoneOrigin = "linear";
      }
      const undated = out.undated ? `, ${out.undated} undated omitted` : "";
      sources.push({
        key: "linear:milestones",
        ok: true,
        message: `${out.milestones.length} milestones${undated}`,
      });
    } else {
      // Try the captured snapshot before giving up on real dates. Ventura
      // genuinely has zero Linear milestones, so an empty result is accurate
      // there and the config fallback is correct.
      const { snapshotFor, snapshotFallbackAllowed } = await import("./snapshots");
      const snap = snapshotFallbackAllowed() ? snapshotFor(program.id) : null;
      if (snap && snap.linear_milestones.length > 0) {
        const { milestonesFromLinear } = await import("./program-model.adapters");
        const out = milestonesFromLinear(snap.linear_milestones, asOf);
        if (out.milestones.length) {
          milestones = out.milestones;
          milestoneOrigin = "snapshot";
        }
        sources.push({
          key: "linear:milestones",
          ok: true,
          message: `${out.milestones.length} milestones (captured ${snap.fetchedAt})`,
        });
      } else {
        sources.push({
          key: "linear:milestones",
          ok: false,
          message: "none available — schedule falls back to config dates",
        });
      }
    }
  } catch (e) {
    sources.push({
      key: "linear:milestones",
      ok: false,
      message: `${(e as Error).message} — schedule falls back to config dates`,
    });
  }

  // ---- Risks. Where the register lives differs per program, so branch on the
  //      configured source rather than assuming Notion.
  let risks: ProgramModel["risks"] = [];
  if (src.risks.kind === "notionTable") {
    try {
      const { fetchRiskRegister } = await import("./risk-register.server");
      const reg = await fetchRiskRegister(program.id);
      risks = reg.risks;
      sources.push({ key: "notion:risk-register", ok: reg.ok, message: reg.message });
    } catch (e) {
      sources.push({ key: "notion:risk-register", ok: false, message: (e as Error).message });
    }
  } else if (src.risks.kind === "linearIssues") {
    // Derived from the board, because this program keeps no written register.
    const rule = src.risks;
    try {
      const { risksFromLinearIssues } = await import("./risk-register.linear");
      const out = risksFromLinearIssues(
        workItems.map((w) => ({
          identifier: w.identifier,
          title: w.title,
          description: null,
          statusType: w.bucket === "in_progress" ? "started" : w.bucket,
          priority: w.priority,
          assignee: w.assignee,
          labels: w.labels,
          url: w.origin.kind === "sourced" ? (w.origin.refs[0]?.url ?? null) : null,
          dueDate: w.dueDate,
          createdAt: w.createdAt,
          syncedAt:
            w.origin.kind === "sourced" ? w.origin.refs[0].fetchedAt : new Date().toISOString(),
        })),
        { labels: rule.labels, includeOverdue: rule.includeOverdue, asOf },
      );
      risks = out.risks;
      const why = rule.labels.length ? `label ${rule.labels.join("/")}` : "all open issues";
      sources.push({
        key: "linear:risks",
        ok: true,
        // linear_issues does not persist due_date or created_at yet, so the
        // overdue half of the rule cannot fire from cached rows. Say so instead
        // of quietly returning a label-only register.
        message: `${out.risks.length} from ${why}` + (rule.includeOverdue ? " or past due" : ""),
      });
    } catch (e) {
      sources.push({ key: "linear:risks", ok: false, message: (e as Error).message });
    }
  } else {
    sources.push({
      key: "risks",
      ok: false,
      message: "this program keeps no risk register",
    });
  }

  const phases = phasesFromLifecycle(program, asOf);
  const partial = {
    program: programFactsFromConfig(program),
    // Health has no source yet, so it stays null rather than reusing the dated
    // hand-transcribed values — see workstreamsFromConfig.
    workstreams: program.workstreams.map((w) => ({
      key: w.key,
      label: w.label,
      owner: w.owner,
      health: null,
      origin: { kind: "config" as const },
    })),
    phases,
    milestones,
    workItems,
    risks,
    decisions: [],
    dependencies: [],
  };

  const model: ProgramModel = {
    ...partial,
    meta: {
      assembledAt: new Date().toISOString(),
      freshestSourceAt: freshestSourceAt(partial),
      unsourced: unsourcedSections(partial),
    },
  };

  return {
    model,
    gates: upcomingGateReadiness(phases, workItems, { asOf, program }),
    sources,
    milestoneOrigin,
  };
}
