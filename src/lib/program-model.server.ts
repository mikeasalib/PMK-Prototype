// Server-only: assemble a ProgramModel from every source that is wired up.
//
// This is the single place the model is built, so every artifact renders from
// identical facts. Sources that are unavailable contribute nothing rather than
// failing the whole assembly — a report with a marked gap is useful; a report
// that failed to generate is not.

import { PROGRAM } from "./program.config";
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
}

/** Linear's state_type -> the normalised bucket used across the model. */
function bucketOf(stateType: string | null): string {
  switch ((stateType ?? "").toLowerCase()) {
    case "completed":
      return "done";
    case "canceled":
      return "canceled";
    case "started":
      return "in_progress";
    case "unstarted":
      return "todo";
    default:
      return "backlog";
  }
}

export async function assembleProgramModel(asOf = today()): Promise<AssembleResult> {
  const sources: AssembleResult["sources"] = [];

  // ---- Linear work items, from the synced cache
  let workItems: WorkItemRecord[] = [];
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("linear_issues")
      .select(
        "source_id, identifier, title, state_name, state_type, priority, assignee, workstream, labels, url, synced_at",
      )
      .order("source_updated_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { classifyWorkstream } = await import("./program.config");
    workItems = (data ?? []).map((r) =>
      workItemFromLinear(r, bucketOf(r.state_type), classifyWorkstream(r.title, r.workstream)),
    );
    sources.push({ key: "linear", ok: true, message: `${workItems.length} issues` });
  } catch (e) {
    sources.push({ key: "linear", ok: false, message: (e as Error).message });
  }

  // ---- Risk register, read live from Notion
  let risks: ProgramModel["risks"] = [];
  try {
    const { fetchRiskRegister } = await import("./risk-register.server");
    const reg = await fetchRiskRegister();
    risks = reg.risks;
    sources.push({ key: "notion:risk-register", ok: reg.ok, message: reg.message });
  } catch (e) {
    sources.push({ key: "notion:risk-register", ok: false, message: (e as Error).message });
  }

  const phases = phasesFromLifecycle(asOf);
  const partial = {
    program: programFactsFromConfig(),
    // Health has no source yet, so it stays null rather than reusing the dated
    // hand-transcribed values — see workstreamsFromConfig.
    workstreams: PROGRAM.workstreams.map((w) => ({
      key: w.key,
      label: w.label,
      owner: w.owner,
      health: null,
      origin: { kind: "config" as const },
    })),
    phases,
    milestones: milestonesFromConfig(asOf),
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

  return { model, gates: upcomingGateReadiness(phases, workItems, { asOf }), sources };
}
