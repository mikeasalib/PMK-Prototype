// Source status probe. Server-only.
//
// Answers "is this source actually reachable, and how much did it return?" for
// the sidebar footer. Reads the sources directly rather than counting rows in a
// mirror table, so the footer reflects reality: a page rendering 64 issues can
// no longer show "Linear · not synced".
//
// Every status carries the reason. "not configured" (no token) and "read failed"
// (token present, call rejected) are different problems with different fixes,
// and collapsing them into one grey dot is how a misconfigured deployment
// looks identical to an unconfigured one.

import type { SyncSourceStatus } from "./sync.functions";
import { sourcesFor } from "./program.sources.server";

export async function probeSources(
  programId: string,
  opts: { bustCache?: boolean } = {},
): Promise<SyncSourceStatus[]> {
  const src = sourcesFor(programId);
  const out: SyncSourceStatus[] = [];

  const {
    readLinearIssues,
    linearConfigured,
    notionConfigured,
    notionChildren,
    granolaConfigured,
    granolaMissingKey,
    granolaLastError,
    readGranolaNotes,
  } = await import("./sources.direct.server");

  if (opts.bustCache) {
    const { clearSourceCache } = await import("./sources.direct.server");
    clearSourceCache();
  }

  // ---- Linear
  if (!src.linear) {
    out.push({
      key: "linear",
      ok: false,
      count: 0,
      scope: "no Linear project configured for this program",
      message: "not configured",
    });
  } else if (!linearConfigured()) {
    out.push({
      key: "linear",
      ok: false,
      count: 0,
      scope: src.linear.scopeLabel,
      message: "LINEAR_API_KEY not set",
    });
  } else {
    const read = await readLinearIssues(programId);
    out.push(
      read
        ? {
            key: "linear",
            ok: true,
            count: read.rows.length,
            scope: src.linear.scopeLabel,
            message: `${read.rows.length} ${src.linear.itemNoun}`,
          }
        : {
            key: "linear",
            ok: false,
            count: 0,
            scope: src.linear.scopeLabel,
            message: "read failed — check the token and project id",
          },
    );
  }

  // ---- Notion. Probed by reading the hub page's children: cheap, and it
  //      exercises the same path the risk register uses, so a page-not-shared
  //      problem surfaces here rather than as an empty risk table later.
  if (!src.notion) {
    out.push({
      key: "notion",
      ok: false,
      count: 0,
      scope: "no Notion hub configured for this program",
      message: "not configured",
    });
  } else if (!notionConfigured()) {
    out.push({
      key: "notion",
      ok: false,
      count: 0,
      scope: `hub "${src.notion.hubLabel}"`,
      message: "NOTION_API_KEY not set",
    });
  } else {
    try {
      const blocks = await notionChildren(src.notion.rootPageId);
      out.push({
        key: "notion",
        ok: true,
        count: blocks.length,
        scope: `hub "${src.notion.hubLabel}"`,
        message: `${blocks.length} blocks on the hub page`,
      });
    } catch (e) {
      out.push({
        key: "notion",
        ok: false,
        count: 0,
        scope: `hub "${src.notion.hubLabel}"`,
        message: (e as Error).message.slice(0, 120),
      });
    }
  }

  // ---- Granola. Back after a spell out of the footer, on a different scope:
  //      the read is by time window and attendee/title, never by folder, because
  //      a folder-scoped read is refused for this account and listing folders
  //      returns nothing. Metadata only — titles, ids, timestamps — so the row
  //      answers "are the calls reachable", not "what was said".
  if (!src.granola) {
    out.push({
      key: "granola",
      ok: false,
      count: 0,
      scope: "no Granola scope configured for this program",
      message: "not configured",
    });
  } else if (!granolaConfigured()) {
    out.push({
      key: "granola",
      ok: false,
      count: 0,
      scope: src.granola.label,
      // Two keys, two different fixes. The old sync collapsed them and told
      // people to set a Granola token that was already set.
      message:
        granolaMissingKey() === "granola"
          ? "GRANOLA_API_KEY not set"
          : "LOVABLE_API_KEY not set — the gateway needs it too",
    });
  } else {
    const read = await readGranolaNotes(programId);
    out.push(
      read
        ? {
            key: "granola",
            ok: true,
            count: read.rows.length,
            scope: src.granola.label,
            message: `${read.rows.length} ${src.granola.itemNoun}`,
          }
        : {
            key: "granola",
            ok: false,
            count: 0,
            scope: src.granola.label,
            message: (granolaLastError() ?? "read failed").slice(0, 120),
          },
    );
  }

  return out;
}
