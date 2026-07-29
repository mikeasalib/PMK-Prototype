// Server-only helpers: fetch from providers, upsert into DB via service role.
// Never imported from client code.

import { SOURCES } from "./program.sources.server";
// Narrow on purpose: only what the source literally said gets persisted.
import { parseSourceWorkstream } from "./program.config";

const GATEWAY = SOURCES.gatewayUrl;

function headers(connKey: string) {
  return {
    Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": connKey,
    "Content-Type": "application/json",
  };
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type SyncSourceResult = {
  key: "granola" | "notion" | "linear";
  ok: boolean;
  count: number;
  scope: string;
  message: string;
};

async function logRun(r: SyncSourceResult) {
  const admin = await getAdmin();
  await admin.from("sync_runs").insert({
    source: r.key,
    ok: r.ok,
    count: r.count,
    scope: r.scope,
    message: r.message,
  });
}

export async function syncLinear(): Promise<SyncSourceResult> {
  const scope = SOURCES.linear.scopeLabel;
  const key = process.env.LINEAR_API_KEY;
  if (!key) {
    const r = { key: "linear" as const, ok: false, count: 0, scope, message: "not connected" };
    await logRun(r);
    return r;
  }
  try {
    const res = await fetch(`${GATEWAY}/linear/graphql`, {
      method: "POST",
      headers: headers(key),
      body: JSON.stringify({
        query: `query {
          project(id: "${SOURCES.linear.projectId}") {
            url
            issues(first: 250) {
              nodes {
                id identifier title url priority updatedAt createdAt dueDate
                state { name type }
                assignee { name }
                cycle { number name }
                labels { nodes { name } }
              }
            }
            projectMilestones(first: 100) {
              nodes {
                id name description targetDate progress sortOrder
                createdAt updatedAt
              }
            }
          }
        }`,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      data?: {
        project?: {
          url?: string;
          issues?: { nodes?: Array<Record<string, unknown>> };
          projectMilestones?: { nodes?: Array<Record<string, unknown>> };
        };
      };
      errors?: Array<{ message: string }>;
    };
    if (data.errors?.length) throw new Error(data.errors[0].message);
    const nodes = data.data?.project?.issues?.nodes ?? [];
    const rows = nodes.map((n) => {
      const title = (n.title as string) ?? "";
      const state = n.state as { name?: string; type?: string } | null;
      const assignee = n.assignee as { name?: string } | null;
      const cycle = n.cycle as { number?: number; name?: string } | null;
      const labels = (n.labels as { nodes?: Array<{ name: string }> } | null)?.nodes ?? [];
      return {
        source_id: n.id as string,
        identifier: n.identifier as string,
        title,
        state_name: state?.name ?? null,
        state_type: state?.type ?? null,
        priority: (n.priority as number) ?? null,
        assignee: assignee?.name ?? null,
        workstream: parseSourceWorkstream(title),
        cycle_number: cycle?.number ?? null,
        cycle_name: cycle?.name ?? null,
        labels: labels.map((l) => l.name),
        url: (n.url as string) ?? null,
        // Nullable and left that way: most issues carry no due date, and a NULL
        // means "no commitment made", not "due today".
        due_date: (n.dueDate as string) ?? null,
        source_created_at: (n.createdAt as string) ?? null,
        source_updated_at: (n.updatedAt as string) ?? null,
        synced_at: new Date().toISOString(),
      };
    });
    // Project milestones. These are the real dated backbone every artifact
    // shares; before this they came from hand-maintained config.
    const projectUrl = data.data?.project?.url ?? null;
    const msNodes = data.data?.project?.projectMilestones?.nodes ?? [];
    const msRows = msNodes.map((m) => ({
      source_id: m.id as string,
      name: (m.name as string) ?? "(untitled)",
      description: (m.description as string) ?? null,
      // Linear allows an undated milestone. Keep NULL rather than substituting
      // a date, so a reader can tell "undated" from "due today".
      target_date: (m.targetDate as string) ?? null,
      progress: typeof m.progress === "number" ? m.progress : null,
      sort_order: typeof m.sortOrder === "number" ? m.sortOrder : null,
      url: projectUrl,
      source_created_at: (m.createdAt as string) ?? null,
      source_updated_at: (m.updatedAt as string) ?? null,
      synced_at: new Date().toISOString(),
    }));

    const admin = await getAdmin();
    if (rows.length) {
      const { error } = await admin.from("linear_issues").upsert(rows, { onConflict: "source_id" });
      if (error) throw new Error(error.message);
    }
    if (msRows.length) {
      const { error } = await admin
        .from("linear_milestones")
        .upsert(msRows, { onConflict: "source_id" });
      if (error) throw new Error(error.message);
    }
    const message = `${rows.length} ${SOURCES.linear.itemNoun}, ${msRows.length} milestones`;
    const r = { key: "linear" as const, ok: true, count: rows.length, scope, message };
    await logRun(r);
    return r;
  } catch (e) {
    const r = { key: "linear" as const, ok: false, count: 0, scope, message: (e as Error).message };
    await logRun(r);
    return r;
  }
}

export async function syncGranola(): Promise<SyncSourceResult> {
  const scope = `folder "${SOURCES.granola.folderLabel}" (${SOURCES.granola.folderId})`;
  const key = process.env.GRANOLA_API_KEY;
  if (!key) {
    const r = { key: "granola" as const, ok: false, count: 0, scope, message: "not connected" };
    await logRun(r);
    return r;
  }
  try {
    const res = await fetch(
      `${GATEWAY}/granola/v1/notes?limit=100&folder_id=${SOURCES.granola.folderId}`,
      { headers: headers(key) },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      notes?: Array<{ id: string; title?: string; updated_at?: string; created_at?: string }>;
    };
    const seen = new Set<string>();
    const unique = (data.notes ?? []).filter((n) =>
      seen.has(n.id) ? false : (seen.add(n.id), true),
    );
    const rows = unique.map((n) => ({
      source_id: n.id,
      title: n.title ?? "(untitled)",
      url: `https://notes.granola.ai/d/${n.id}`,
      source_created_at: n.created_at ?? null,
      source_updated_at: n.updated_at ?? null,
      synced_at: new Date().toISOString(),
    }));
    const admin = await getAdmin();
    if (rows.length) {
      const { error } = await admin.from("granola_notes").upsert(rows, { onConflict: "source_id" });
      if (error) throw new Error(error.message);
    }
    const message = `${rows.length} ${SOURCES.granola.itemNoun}`;
    const r = { key: "granola" as const, ok: true, count: rows.length, scope, message };
    await logRun(r);
    return r;
  } catch (e) {
    const r = {
      key: "granola" as const,
      ok: false,
      count: 0,
      scope,
      message: (e as Error).message,
    };
    await logRun(r);
    return r;
  }
}

function notionTitle(block: Record<string, unknown>): string {
  const type = block.type as string;
  const inner = block[type] as
    | { title?: string; rich_text?: Array<{ plain_text?: string }> }
    | undefined;
  if (inner?.title) return inner.title;
  if (inner?.rich_text?.length) return inner.rich_text.map((t) => t.plain_text ?? "").join("");
  return "(untitled)";
}

export async function syncNotion(): Promise<SyncSourceResult> {
  const scope = `hub "${SOURCES.notion.hubLabel}" (children of ${SOURCES.notion.rootPageId.slice(0, 8)}…)`;
  const key = process.env.NOTION_API_KEY;
  if (!key) {
    const r = { key: "notion" as const, ok: false, count: 0, scope, message: "not connected" };
    await logRun(r);
    return r;
  }
  try {
    let cursor: string | undefined;
    const blocks: Array<Record<string, unknown>> = [];
    do {
      const u = new URL(`${GATEWAY}/notion/v1/blocks/${SOURCES.notion.rootPageId}/children`);
      u.searchParams.set("page_size", "100");
      if (cursor) u.searchParams.set("start_cursor", cursor);
      const res = await fetch(u.toString(), { headers: headers(key) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = (await res.json()) as {
        results?: Array<Record<string, unknown>>;
        next_cursor?: string;
        has_more?: boolean;
      };
      blocks.push(...(d.results ?? []));
      cursor = d.has_more ? d.next_cursor : undefined;
    } while (cursor);

    const childPages = blocks.filter((b) => b.type === "child_page" || b.type === "child_database");
    const rows = childPages.map((b) => {
      const id = b.id as string;
      const type = b.type as string;
      return {
        source_id: id,
        title: notionTitle(b),
        url: `https://www.notion.so/${id.replace(/-/g, "")}`,
        parent_type: type,
        parent_id: SOURCES.notion.rootPageId,
        source_updated_at: (b.last_edited_time as string) ?? null,
        synced_at: new Date().toISOString(),
      };
    });
    const admin = await getAdmin();
    if (rows.length) {
      const { error } = await admin.from("notion_pages").upsert(rows, { onConflict: "source_id" });
      if (error) throw new Error(error.message);
    }
    const r = {
      key: "notion" as const,
      ok: true,
      count: rows.length,
      scope,
      message: `${rows.length} child pages/DBs`,
    };
    await logRun(r);
    return r;
  } catch (e) {
    const r = { key: "notion" as const, ok: false, count: 0, scope, message: (e as Error).message };
    await logRun(r);
    return r;
  }
}
