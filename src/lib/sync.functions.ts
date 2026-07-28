import { createServerFn } from "@tanstack/react-start";

export type SyncSourceStatus = {
  key: "granola" | "notion" | "linear";
  ok: boolean;
  count: number;
  scope: string;
  message: string;
};

export type SyncResult = {
  syncedAt: string;
  sources: SyncSourceStatus[];
};

export const syncAll = createServerFn({ method: "POST" }).handler(async (): Promise<SyncResult> => {
  const { syncGranola, syncNotion, syncLinear } = await import("./sync.server");
  const sources = await Promise.all([syncGranola(), syncNotion(), syncLinear()]);
  return { syncedAt: new Date().toISOString(), sources };
});

export type SyncedSnapshot = {
  syncedAt: string | null;
  sources: SyncSourceStatus[];
  counts: { linear: number; notion: number; granola: number };
};

export const getSyncedSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<SyncedSnapshot> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [runs, li, np, gn] = await Promise.all([
      supabaseAdmin
        .from("sync_runs")
        .select("source, ok, count, scope, message, ran_at")
        .order("ran_at", { ascending: false })
        .limit(30),
      supabaseAdmin.from("linear_issues").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("notion_pages").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("granola_notes").select("*", { count: "exact", head: true }),
    ]);

    const latestBySource = new Map<string, SyncSourceStatus & { ran_at: string }>();
    for (const r of runs.data ?? []) {
      if (!latestBySource.has(r.source)) {
        latestBySource.set(r.source, {
          key: r.source as SyncSourceStatus["key"],
          ok: r.ok,
          count: r.count ?? 0,
          scope: r.scope ?? "",
          message: r.message ?? "",
          ran_at: r.ran_at,
        });
      }
    }
    const sources = Array.from(latestBySource.values()).map(({ ran_at: _r, ...rest }) => rest);
    const syncedAt = runs.data?.[0]?.ran_at ?? null;
    return {
      syncedAt,
      sources,
      counts: {
        linear: li.count ?? 0,
        notion: np.count ?? 0,
        granola: gn.count ?? 0,
      },
    };
  },
);

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

export type StoredGranolaNote = {
  id: string;
  source_id: string;
  title: string;
  url: string | null;
  source_updated_at: string | null;
  synced_at: string;
};

export const getStoredData = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [linear, notion, granola] = await Promise.all([
    supabaseAdmin
      .from("linear_issues")
      .select(
        "id, source_id, identifier, title, state_name, state_type, priority, assignee, workstream, labels, url, source_updated_at, synced_at",
      )
      .order("source_updated_at", { ascending: false }),
    supabaseAdmin
      .from("notion_pages")
      .select("id, source_id, title, url, parent_type, source_updated_at, synced_at")
      .order("source_updated_at", { ascending: false }),
    supabaseAdmin
      .from("granola_notes")
      .select("id, source_id, title, url, source_updated_at, synced_at")
      .order("source_updated_at", { ascending: false }),
  ]);
  return {
    linear: (linear.data ?? []) as StoredLinearIssue[],
    notion: (notion.data ?? []) as StoredNotionPage[],
    granola: (granola.data ?? []) as StoredGranolaNote[],
  };
});
