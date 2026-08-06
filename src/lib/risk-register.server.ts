// Server-only: read the risk register table out of Notion.
//
// The register is a table *block* on a page, not a database, so this walks
// blocks/children — the same gateway path syncNotion already uses, which means
// no new connector capability is needed. A table block's rows are its children;
// each table_row carries a `cells` array of rich-text runs, one per column.
//
// Parsing lives in risk-register.ts as a pure function so it can be verified
// against captured content without a network call. This file only fetches.

import { sourcesFor } from "./program.sources.server";
import { notionChildren } from "./sources.direct.server";
import { parseRiskRegister, type ParseResult } from "./risk-register";
import type { SourceRef } from "./program-model";

// Reads go straight to api.notion.com with a NOTION_API_KEY personal token.
// Was routed through the Lovable connector gateway, which additionally needed
// LOVABLE_API_KEY — so setting only NOTION_API_KEY produced an auth failure
// that surfaced as an empty register rather than a configuration error.
type Block = Record<string, unknown>;

/** All children of a block or page, following pagination. */
async function children(blockId: string): Promise<Block[]> {
  return notionChildren(blockId);
}

/** Flatten a table_row's cells into plain strings, one per column. */
export function rowCells(block: Block): string[] {
  const row = block.table_row as { cells?: Array<Array<{ plain_text?: string }>> } | undefined;
  if (!row?.cells) return [];
  return row.cells.map((runs) =>
    runs
      .map((r) => r.plain_text ?? "")
      .join("")
      .trim(),
  );
}

export interface RegisterFetch extends ParseResult {
  ok: boolean;
  message: string;
  /** Notion page id the table was found on. */
  pageId: string | null;
}

/**
 * Find the risk register page under the program's Notion hub, locate the first
 * table block on it, and parse the rows.
 *
 * `pageTitleMatch` defaults to matching "risk register" case-insensitively, so
 * the page can be renamed without a code change as long as it still says what
 * it is.
 */
export async function fetchRiskRegister(programId: string): Promise<RegisterFetch> {
  const empty = { risks: [], skipped: [], pageId: null };
  const src = sourcesFor(programId);
  if (!src.notion) {
    return { ...empty, ok: false, message: "no Notion source for this program" };
  }
  const pageTitleMatch = src.notion.riskRegisterMatch;
  if (!pageTitleMatch) {
    return { ...empty, ok: false, message: "this program keeps no Notion register page" };
  }
  const key = process.env.NOTION_API_KEY;
  if (!key) return { ...empty, ok: false, message: "not connected" };

  try {
    // 1. Find the register page among the hub's children. syncNotion already
    //    enumerates these, so this is a path we know works.
    const hubChildren = await children(src.notion.rootPageId);
    const page = hubChildren.find((b) => {
      if (b.type !== "child_page") return false;
      const t = (b.child_page as { title?: string } | undefined)?.title ?? "";
      return pageTitleMatch.test(t);
    });
    if (!page) {
      return {
        ...empty,
        ok: false,
        message: `no page matching ${pageTitleMatch} under the hub`,
      };
    }
    const pageId = page.id as string;

    // 2. First table block on that page is the register.
    const blocks = await children(pageId);
    const table = blocks.find((b) => b.type === "table");
    if (!table) {
      return { ...empty, pageId, ok: false, message: "register page has no table block" };
    }

    // 3. Rows are the table block's children.
    const rows = (await children(table.id as string))
      .filter((b) => b.type === "table_row")
      .map(rowCells);

    const ref: SourceRef = {
      system: "notion",
      id: pageId,
      url: `https://www.notion.so/${pageId.replace(/-/g, "")}`,
      fetchedAt: new Date().toISOString(),
    };

    const parsed = parseRiskRegister(rows, ref);
    const skippedNote = parsed.skipped.length ? `, ${parsed.skipped.length} row(s) skipped` : "";
    return {
      ...parsed,
      pageId,
      ok: true,
      message: `${parsed.risks.length} risks${skippedNote}`,
    };
  } catch (e) {
    return { ...empty, ok: false, message: (e as Error).message };
  }
}
