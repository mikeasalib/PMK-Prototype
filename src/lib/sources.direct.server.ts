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
/**
 * Last error from a live Linear read, for the UI to report.
 *
 * readLinearIssues used to swallow its exception and return null, so a rejected
 * token and an absent one were indistinguishable downstream — the footer told
 * the user to set LINEAR_API_KEY while the key was set and being 401'd. Module
 * scope is fine: this is a diagnostic about the process's own credentials, not
 * per-request state.
 */
let lastLinearError: string | null = null;

export function linearLastError(): string | null {
  return lastLinearError;
}

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
    // Pull the human message out rather than pasting the envelope. This used to
    // append 200 characters of raw JSON, which ended up rendered verbatim in the
    // sidebar footer.
    const body = await res.text().catch(() => "");
    let detail = "";
    try {
      const parsed = JSON.parse(body) as {
        errors?: Array<{ extensions?: { userPresentableMessage?: string }; message?: string }>;
      };
      const first = parsed.errors?.[0];
      detail = first?.extensions?.userPresentableMessage ?? first?.message ?? "";
    } catch {
      detail = body.slice(0, 120);
    }
    throw new Error(`HTTP ${res.status}${detail ? ` — ${detail}` : ""}`);
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
    lastLinearError = null;
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
  } catch (err) {
    lastLinearError = err instanceof Error ? err.message : String(err);
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
 * A hand-maintained checkbox task from a Notion page.
 *
 * Deliberately NOT a WorkItemRecord. A `to_do` block has no identifier, no
 * assignee field, no state machine and no priority — modelling it as an issue
 * would fake structure the source does not have. What it does carry is the
 * text, whether it is checked, and the heading it sits under, which on a
 * well-kept tracker is a real grouping.
 */
export interface NotionTask {
  /** Notion block id. Stable across reads, so it is a usable React key. */
  id: string;
  text: string;
  checked: boolean;
  /** Nearest heading above this block, or null at the top of the page. */
  section: string | null;
  /** Nesting depth. 0 is a top-level to_do; children of a to_do are 1+. */
  depth: number;
  /** Ticket identifiers found in the text, e.g. "[DEP-1920]". Cited, not parsed
   *  into a link — the tracker writes them by hand and they can be stale. */
  ticketRefs: string[];
  /** Deep link to the block on the tracker page. */
  url: string;
}

/** Flatten a rich-text array to plain text. */
function plain(runs: unknown): string {
  if (!Array.isArray(runs)) return "";
  return runs
    .map((r) => (r as { plain_text?: string }).plain_text ?? "")
    .join("")
    .trim();
}

const TICKET_RE = /\b((?:DEP|REC)-\d+)\b/g;

/**
 * Every checkbox task on a program's Notion tracker page.
 *
 * Walks the page recursively because `to_do` blocks nest — a sub-task is a
 * child of its parent to_do, and the tracker uses that. Headings are tracked as
 * we descend so each task carries the section it was written under.
 *
 * Returns null when no tracker page is configured or the read fails; the caller
 * distinguishes those with notionConfigured().
 */
export async function readNotionTasks(
  programId: string,
): Promise<DirectReadResult<NotionTask> | null> {
  const src = sourcesFor(programId);
  const pageId = src.notion?.taskTrackerPageId;
  if (!pageId) return null;

  const cacheKey = `notion:tasks:${pageId}`;
  const hit = cached<DirectReadResult<NotionTask>>(cacheKey);
  if (hit) return hit;

  if (!notionConfigured()) return null;

  try {
    const readAt = new Date().toISOString();
    const rows: NotionTask[] = [];
    const pageHref = `https://www.notion.so/${pageId.replace(/-/g, "")}`;

    // Depth cap is a runaway guard, not a content decision: a tracker nests two
    // or three deep in practice, and an unbounded recursion on a page with a
    // synced-block cycle would hang the request.
    const MAX_DEPTH = 5;

    async function walk(blockId: string, depth: number, section: string | null) {
      if (depth > MAX_DEPTH) return;
      const children = await notionChildren(blockId);
      let currentSection = section;

      for (const b of children) {
        const type = b.type as string;

        // Headings reset the section label for everything after them at this
        // level. heading_3 included: the tracker uses it for "net new from 8/4"
        // style sub-sections that genuinely group work.
        if (type === "heading_1" || type === "heading_2" || type === "heading_3") {
          const h = b[type] as { rich_text?: unknown } | undefined;
          const label = plain(h?.rich_text);
          if (label) currentSection = label;
          continue;
        }

        if (type === "to_do") {
          const td = b.to_do as { rich_text?: unknown; checked?: boolean } | undefined;
          const text = plain(td?.rich_text);
          if (text) {
            const id = b.id as string;
            rows.push({
              id,
              text,
              checked: Boolean(td?.checked),
              section: currentSection,
              depth,
              ticketRefs: Array.from(text.matchAll(TICKET_RE)).map((m) => m[1]),
              url: `${pageHref}#${id.replace(/-/g, "")}`,
            });
          }
          // A to_do can own sub-tasks. Descend with the same section so a
          // nested item is still attributed to the heading it lives under.
          if (b.has_children) await walk(b.id as string, depth + 1, currentSection);
          continue;
        }

        // Toggles and columns hold tasks without being tasks. Descend through
        // any container so a collapsed section is not silently dropped.
        if (b.has_children) {
          await walk(b.id as string, depth + 1, currentSection);
        }
      }
    }

    await walk(pageId, 0, null);
    const out = { rows, readAt };
    store(cacheKey, out);
    return out;
  } catch {
    return null;
  }
}

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
