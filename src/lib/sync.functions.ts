import { createServerFn } from "@tanstack/react-start";

// Granola is back in this union, on a narrower promise than the sync it left
// with. That sync tried to mirror note *content* through a folder-scoped read
// the workspace refuses, so the row sat permanently at "not synced". What the
// probe reports now is reachability of note metadata inside a time window —
// enough to say the calls are there and link to them, never enough to source a
// claim about what was said.
export type SyncSourceStatus = {
  key: "notion" | "linear" | "granola";
  ok: boolean;
  count: number;
  scope: string;
  message: string;
};

export type SyncResult = {
  syncedAt: string;
  sources: SyncSourceStatus[];
};

/**
 * "Refresh" now just drops the in-memory read cache and reports what a fresh
 * read of each source returns. There is no mirror to write into: the previous
 * implementation pushed rows into Supabase tables that don't exist behind this
 * deployment, so every sync reported failure and every read fell back.
 */
export const syncAll = createServerFn({ method: "POST" })
  .inputValidator((programId: unknown) => (typeof programId === "string" ? programId : "va"))
  .handler(async ({ data: programId }): Promise<SyncResult> => {
    const { probeSources } = await import("./sources.probe.server");
    const sources = await probeSources(programId, { bustCache: true });
    return { syncedAt: new Date().toISOString(), sources };
  });

export type SyncedSnapshot = {
  syncedAt: string | null;
  sources: SyncSourceStatus[];
  counts: { linear: number; notion: number; granola: number };
};

/**
 * Current source status, for the sidebar footer. Reads each source directly
 * and reports what it actually got — the previous version counted rows in
 * Supabase mirror tables, which is why the footer said "not synced" on a page
 * full of rendered issues.
 */
export const getSyncedSnapshot = createServerFn({ method: "GET" })
  .inputValidator((programId: unknown) => (typeof programId === "string" ? programId : "va"))
  .handler(async ({ data: programId }): Promise<SyncedSnapshot> => {
    const { probeSources } = await import("./sources.probe.server");
    const sources = await probeSources(programId);
    const counts = {
      linear: sources.find((s) => s.key === "linear")?.count ?? 0,
      notion: sources.find((s) => s.key === "notion")?.count ?? 0,
      // Notes in the window, not note content: see readGranolaNotes.
      granola: sources.find((s) => s.key === "granola")?.count ?? 0,
    };
    const anyOk = sources.some((s) => s.ok);
    return {
      syncedAt: anyOk ? new Date().toISOString() : null,
      sources,
      counts,
    };
  });

export type StoredLinearMilestone = {
  source_id: string;
  name: string;
  description: string | null;
  target_date: string | null;
  progress: number | null;
  sort_order: number | null;
  url: string | null;
  synced_at: string;
};

export type StoredLinearIssue = {
  id: string;
  source_id: string;
  identifier: string;
  title: string;
  state_name: string | null;
  state_type: string | null;
  priority: number | null;
  assignee: string | null;
  workstream: string | null;
  labels: string[] | null;
  url: string | null;
  due_date: string | null;
  source_created_at: string | null;
  source_updated_at: string | null;
  synced_at: string;
};

export type StoredNotionPage = {
  id: string;
  source_id: string;
  title: string;
  url: string | null;
  parent_type: string | null;
  source_updated_at: string | null;
  synced_at: string;
};

export type StoredDataOrigin = "live" | "snapshot" | "empty";

/** Mirrors NotionTask in sources.direct.server, client-safe. */
export type NotionTaskRow = {
  id: string;
  text: string;
  checked: boolean;
  section: string | null;
  depth: number;
  ticketRefs: string[];
  url: string;
};

export type NotionTasksResult = {
  tasks: NotionTaskRow[];
  /** Null when no tracker is configured for this program. */
  readAt: string | null;
  /** Why the list is empty, when it is. Rendered in place so a configuration
   *  problem does not read as "no work in flight". */
  status: "ok" | "not-configured" | "no-token" | "read-failed";
};

/**
 * Hand-maintained checkbox tasks from the program's Notion tracker.
 *
 * Separate from getStoredData because the two answer different questions and
 * fail independently: Linear can be live while the tracker page is unshared,
 * and a page full of open checkboxes is meaningful even when Linear is down.
 */
export const getNotionTasks = createServerFn({ method: "GET" })
  .inputValidator((programId: string) => programId)
  .handler(async ({ data: programId }): Promise<NotionTasksResult> => {
    const { readNotionTasks, notionConfigured } = await import("./sources.direct.server");
    const { sourcesFor } = await import("./program.sources.server");
    const src = sourcesFor(programId);
    if (!src.notion?.taskTrackerPageId) {
      return { tasks: [], readAt: null, status: "not-configured" };
    }
    if (!notionConfigured()) {
      return { tasks: [], readAt: null, status: "no-token" };
    }
    const read = await readNotionTasks(programId);
    if (!read) return { tasks: [], readAt: null, status: "read-failed" };
    return { tasks: read.rows, readAt: read.readAt, status: "ok" };
  });

export interface StoredData {
  /** Set when a live read was attempted and failed, naming the reason. Null when
   *  the read succeeded or was never attempted. */
  liveError?: string | null;
  linear: StoredLinearIssue[];
  notion: StoredNotionPage[];
  /** Where these rows came from. The UI must not present a snapshot as live. */
  origin: StoredDataOrigin;
  /** For a snapshot, when it was captured. Null when live or empty. */
  capturedAt: string | null;
  /** Human-readable provenance for a snapshot. */
  capturedFrom: string | null;
}

export const getStoredData = createServerFn({ method: "GET" })
  .inputValidator((programId: string) => programId)
  .handler(async ({ data: programId }): Promise<StoredData> => {
    // Direct read against Linear's API. No mirror table, no sync step: a page
    // request reads the source. Replaces a Supabase-mirror read that could
    // never succeed — there is no Supabase instance behind this app, so every
    // "live" read failed and silently fell back, which is why setting
    // NOTION_API_KEY changed nothing.
    const { readLinearIssues, linearConfigured, linearLastError } =
      await import("./sources.direct.server");
    const live = await readLinearIssues(programId);
    if (live && live.rows.length > 0) {
      return {
        linear: live.rows as unknown as StoredLinearIssue[],
        notion: [],
        origin: "live",
        capturedAt: live.readAt,
        capturedFrom: `Linear API (read ${live.readAt})`,
      };
    }

    // No token, or the call failed. Fall back to a captured snapshot so the app
    // is developable and demonstrable — but never in preference to a live read,
    // and never silently: the origin travels with the rows.
    const { snapshotFor, snapshotFallbackAllowed } = await import("./snapshots");
    const snap = snapshotFallbackAllowed() ? snapshotFor(programId) : null;
    if (!snap) {
      return {
        linear: [],
        notion: [],
        origin: "empty",
        capturedAt: null,
        capturedFrom: linearConfigured()
          ? `Linear read failed (${linearLastError() ?? "unknown"}) and snapshot fallback is off`
          : "LINEAR_API_KEY not set and snapshot fallback is off",
      };
    }
    return {
      linear: snap.linear_issues as unknown as StoredLinearIssue[],
      notion: [],
      origin: "snapshot",
      capturedAt: snap.fetchedAt,
      capturedFrom: snap.source,
      // Why the live read did not win. A rejected token and an absent one need
      // different fixes, and the footer was advising the second while the first
      // was true.
      liveError: linearConfigured() ? linearLastError() : "LINEAR_API_KEY not set",
    };
  });
