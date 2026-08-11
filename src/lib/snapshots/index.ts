// Captured snapshots of each program's real source data.
//
// Why these exist: the read path needs SUPABASE_SERVICE_ROLE_KEY and the sync
// needs LOVABLE_API_KEY plus the three connector keys. Without them every
// data-driven page renders empty, which makes the app impossible to develop
// against or demonstrate. These files hold what the sources actually returned,
// pulled through the Linear and Notion connectors, so both programs render real
// content locally.
//
// This is NOT a substitute for syncing, and the design goes out of its way to
// stop it being mistaken for one:
//
//   - every row carries the real fetchedAt from when it was captured, so it ages
//     visibly rather than looking current
//   - the model marks the origin as a snapshot, distinct from "sourced"
//   - the UI labels the data source "snapshot" rather than "synced"
//   - Supabase always wins. The snapshot is only read when the live query fails
//     or returns nothing, never in preference to it
//
// Ventura's milestone list is empty here, and that is accurate rather than
// missing: its Linear project genuinely has zero milestones. Keeping it empty
// exercises the config fallback instead of papering over it.

import va from "./va.json";
import ventura from "./ventura.json";

export interface SnapshotRow {
  source_id: string;
  identifier: string;
  title: string;
  state_name: string | null;
  state_type: string | null;
  priority: number | null;
  assignee: string | null;
  workstream: string | null;
  labels: string[];
  url: string | null;
  due_date: string | null;
  source_created_at: string | null;
  source_updated_at: string | null;
  synced_at: string;
}

export interface SnapshotMilestone {
  source_id: string;
  name: string;
  target_date: string | null;
  progress: number | null;
  url: string | null;
  synced_at: string;
}

export interface ProgramSnapshot {
  programId: string;
  /** When this was captured from the live source. */
  fetchedAt: string;
  /** Which project it came from, recorded so provenance is citable. */
  source: string;
  linear_issues: SnapshotRow[];
  linear_milestones: SnapshotMilestone[];
}

const SNAPSHOTS: Record<string, ProgramSnapshot> = {
  va: va as ProgramSnapshot,
  ventura: ventura as ProgramSnapshot,
};

/** The snapshot for a program, or null if none was captured. */
export function snapshotFor(programId: string): ProgramSnapshot | null {
  return SNAPSHOTS[programId] ?? null;
}

/**
 * Whether falling back to snapshots is permitted.
 *
 * Off in production by default: a deployed instance showing month-old captured
 * data while claiming to be a live read layer would be worse than showing
 * nothing. Set ALLOW_SNAPSHOT_FALLBACK=1 to override, e.g. for a demo build.
 */
export function snapshotFallbackAllowed(): boolean {
  if (process.env.ALLOW_SNAPSHOT_FALLBACK === "1") return true;
  return process.env.NODE_ENV !== "production";
}
