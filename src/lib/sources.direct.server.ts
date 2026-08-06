// Direct source reads. Server-only.
//
// Replaces the Supabase-mirror architecture. There is no Supabase instance
// behind this app, so every "live read" through supabaseAdmin was failing and
// silently falling back to a captured snapshot — the footer said "not synced"
// while the pages rendered snapshot rows, and no amount of setting NOTION_API_KEY
// changed that because the read path never touched Notion.
//
// This module talks to Linear's GraphQL API and Notion's REST API directly with
// a personal access token each. No connector gateway, no mirror table, no sync
// step: a page request reads the source. Results are cached in module memory
// for CACHE_TTL_MS so a page with four panels doesn't make four round trips.
//
// Honest fallback is preserved. If a token is missing or a call fails, the
// caller gets `null` for that source and decides whether to use a snapshot —
// the origin travels with the rows exactly as before.

import { sourcesFor } from "./program.sources.server";

const CACHE_TTL_MS = 60_000;

export interface DirectLinearIssue {
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

export interface DirectLinearMilestone {
  source_id: string;
  name: string;
  target_date: string | null;
  progress: number | null;
  url: string | null;
  synced_at: string;
}

export interface DirectReadResult<T> {
  rows: T[];
  /** When this read happened. */
  readAt: string;
}

type CacheEntry = { at: number; value: unknown };
const cache = new Map<string, CacheEntry>();

function cached<T>(key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value as T;
}

function store(key: string, value: unknown) {
  cache.set(key, { at: Date.now(), value });
}

/** Drop every cached read. Called by the Refresh control so a manual refresh
 *  actually re-reads rather than returning the cache it just filled. */
export function clearSourceCache(): void {
  cache.clear();
}

/** True when a Linear token is configured. Callers use this to decide whether
 *  a null result means "not configured" or "call failed". */
export function linearConfigured(): boolean {
  return Boolean(process.env.LINEAR_API_KEY);
}

/** True when a Notion token is configured. */
export function notionConfigured(): boolean {
  return Boolean(process.env.NOTION_API_KEY);
}

// -------------------------------------------------------------- Linear

const LINEAR_ISSUES_QUERY = `
  query ProjectIssues($projectId: String!, $after: String) {
    project(id: $projectId) {
      issues(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          identifier
          title
          url
          priority
          dueDate
          createdAt
          updatedAt
          state { name type }
          assignee { name email }
          labels { nodes { name } }
        }
      }
    }
  }
`;

const LINEAR_MILESTONES_QUERY = `
  query ProjectMilestones($projectId: String!) {
    project(id: $projectId) {
      url
      projectMilestones(first: 50) {
        nodes { id name targetDate progress sortOrder }
      }
    }
  }
`;

interface LinearIssueNode {
  id: string;
  identifier: string;
  title: string;
  url: string | null;
  priority: number | null;
  dueDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  state: { name: string; type: string } | null;
  assignee: { name: string | null; email: string | null } | null;
  labels: { nodes: Array<{ name: string }> } | null;
}

async function linearGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const key = process.env.LINEAR_API_KEY;
  if (!key) throw new Error("LINEAR_API_KEY not set");
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      // Linear personal API keys go in Authorization without a Bearer prefix.
      Authorization: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Linear HTTP ${res.status}${body ? ` — ${body.slice(0, 200)}` : ""}`);
  }
  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) throw new Error(`Linear: ${json.errors[0].message}`);
  if (!json.data) throw new Error("Linear: empty response");
  return json.data;
}

/**
 * Every issue on a program's Linear project. Returns null when no token is
 * configured or the call fails — the caller decides whether to fall back.
 */
export async function readLinearIssues(
  programId: string,
): Promise<DirectReadResult<DirectLinearIssue> | null> {
  const src = sourcesFor(programId);
  if (!src.linear) return null;
  const projectId = src.linear.projectId;
  const cacheKey = `linear:issues:${projectId}`;
  const hit = cached<DirectReadResult<DirectLinearIssue>>(cacheKey);
  if (hit) return hit;

  try {
    const readAt = new Date().toISOString();
    const rows: DirectLinearIssue[] = [];
    let after: string | undefined;
    do {
      const data = await linearGraphql<{
        project: {
          issues: {
            pageInfo: { hasNextPage: boolean; endCursor: string };
            nodes: LinearIssueNode[];
          };
        } | null;
      }>(LINEAR_ISSUES_QUERY, { projectId, after });
      const page = data.project?.issues;
      if (!page) break;
      for (const n of page.nodes) {
        rows.push({
          source_id: n.identifier,
          identifier: n.identifier,
          title: n.title,
          state_name: n.state?.name ?? null,
          state_type: n.state?.type ?? null,
          priority: n.priority ?? null,
          // Prefer display name; fall back to email so an unnamed account still
          // attributes rather than reading as unassigned.
          assignee: n.assignee?.name ?? n.assignee?.email ?? null,
          // Never store a guess. The read-time classifier owns attribution.
          workstream: null,
          labels: n.labels?.nodes.map((l) => l.name) ?? [],
          url: n.url,
          due_date: n.dueDate,
          source_created_at: n.createdAt,
          source_updated_at: n.updatedAt,
          synced_at: readAt,
        });
      }
      after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : undefined;
    } while (after);

    const out = { rows, readAt };
    store(cacheKey, out);
    return out;
  } catch {
    return null;
  }
}

/** Project milestones for a program. Null on missing token or failure. */
export async function readLinearMilestones(
  programId: string,
): Promise<DirectReadResult<DirectLinearMilestone> | null> {
  const src = sourcesFor(programId);
  if (!src.linear) return null;
  const projectId = src.linear.projectId;
  const cacheKey = `linear:milestones:${projectId}`;
  const hit = cached<DirectReadResult<DirectLinearMilestone>>(cacheKey);
  if (hit) return hit;

  try {
    const readAt = new Date().toISOString();
    const data = await linearGraphql<{
      project: {
        url: string | null;
        projectMilestones: {
          nodes: Array<{
            id: string;
            name: string;
            targetDate: string | null;
            progress: number | null;
          }>;
        };
      } | null;
    }>(LINEAR_MILESTONES_QUERY, { projectId });
    const rows: DirectLinearMilestone[] = (data.project?.projectMilestones.nodes ?? []).map((m) => ({
      source_id: m.id,
      name: m.name,
      target_date: m.targetDate ? m.targetDate.slice(0, 10) : null,
      progress: m.progress ?? null,
      url: data.project?.url ?? null,
      synced_at: readAt,
    }));
    const out = { rows, readAt };
    store(cacheKey, out);
    return out;
  } catch {
    return null;
  }
}

// -------------------------------------------------------------- Notion

const NOTION_VERSION = "2022-06-28";

function notionHeaders() {
  const key = process.env.NOTION_API_KEY;
  if (!key) throw new Error("NOTION_API_KEY not set");
  return {
    Authorization: `Bearer ${key}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

type NotionBlock = Record<string, unknown>;

/**
 * All children of a Notion block or page, following pagination. Direct against
 * api.notion.com — the integration must be shared on the page, otherwise Notion
 * returns 404 (not 403), which is easy to misread as a bad id.
 */
export async function notionChildren(blockId: string): Promise<NotionBlock[]> {
  const out: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const u = new URL(`https://api.notion.com/v1/blocks/${blockId}/children`);
    u.searchParams.set("page_size", "100");
    if (cursor) u.searchParams.set("start_cursor", cursor);
    const res = await fetch(u.toString(), { headers: notionHeaders() });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Notion HTTP ${res.status} reading children of ${blockId}` +
          (res.status === 404
            ? " — page not shared with the integration, or wrong id"
            : body
              ? ` — ${body.slice(0, 200)}`
              : ""),
      );
    }
    const d = (await res.json()) as {
      results?: NotionBlock[];
      next_cursor?: string;
      has_more?: boolean;
    };
    out.push(...(d.results ?? []));
    cursor = d.has_more ? d.next_cursor : undefined;
  } while (cursor);
  return out;
}
