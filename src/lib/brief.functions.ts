import { createServerFn } from "@tanstack/react-start";

/**
 * "How are we doing?" as a paragraph, grounded in the program model.
 *
 * Same shape as the Hex signed-embed function: honest fallback when the key
 * isn't configured, structured error surfaces so a misconfig doesn't hide
 * behind an empty screen. Every finding the model produces must cite a
 * specific record id (DEP-1234, R2, milestone name) so a reader can trace
 * the sentence back to what it read — the citation contract is the whole
 * point of this feature.
 *
 * No client SDK. Anthropic's Messages API is documented HTTP; adding the
 * @anthropic-ai/sdk package would trigger the bunfig supply-chain hold for
 * no real gain — the fetch call is short.
 */
export type BriefResult =
  | {
      ok: true;
      paragraph: string;
      watchList: string[];
      generatedAt: string;
      model: string;
    }
  | {
      ok: false;
      reason: "no-api-key" | "no-program-data" | "api-error" | "unparseable";
      detail?: string;
    };

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are the weekly program-brief writer for a Kaizen Labs deployment strategist.

You will receive a JSON snapshot of a program's current state — Linear work items, Notion risk register, lifecycle phases, milestones, and recently closed / stalled items. Read it and write a short brief for the strategist.

Ground rules — these matter more than length or style:
- Every specific claim must cite the source record's identifier in square brackets: [DEP-1907], [R2], [Sprint 5]. A sentence without a citation is a general observation, allowed but rare.
- Never invent numbers, dates, or people. If the data does not support a claim, do not make it. Say "not yet sourced" if a natural section has no supporting data.
- Do not editorialize or forecast beyond what the data shows. "This looks bad" is not signal; "R2 is still open and blocks Kaizen implementation [R2]" is.
- No em dashes; use plain punctuation.
- Prefer short direct sentences over stacked clauses.
- Do NOT include a title, headers, or the words "Brief" / "Summary" — the caller supplies chrome.

Output format is strict JSON, exactly:
{"paragraph": "<2-3 short sentences summarising program state, each citing sources>", "watchList": ["<up to 5 bullets, each one line, each citing a source>"]}

Output ONLY that JSON. No commentary before or after.`;

interface BriefInputSummary {
  program: { id: string; name: string; launchDate: string };
  asOf: string;
  workItems: Array<{
    id: string;
    title: string;
    bucket: string;
    priority: number | null;
    workstream: string;
    updatedAt: string | null;
  }>;
  phases: Array<{ id: string; name: string; state: string; window: string }>;
  milestones: Array<{ label: string; date: string; state: string }>;
  risks: Array<{ id: string; description: string; severity: string; state: string }>;
  recentlyClosed: Array<{ id: string; title: string; bucket: string; daysAgo: number }>;
  stalled: Array<{ id: string; title: string; daysSinceUpdate: number }>;
}

export const generateBrief = createServerFn({ method: "POST" })
  .validator((programId: unknown) => {
    if (typeof programId !== "string" || !programId) throw new Error("programId required");
    return programId;
  })
  .handler(async ({ data: programId }): Promise<BriefResult> => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { ok: false, reason: "no-api-key" };

    const { assembleProgramModel } = await import("./program-model.server");
    const { sittingUntouched, recentlyClosed, today } = await import("./program-model.adapters");

    const asOf = today();
    const assembled = await assembleProgramModel(programId, asOf);
    const model = assembled.model;
    if (!model.workItems.length && !model.risks.length) {
      return { ok: false, reason: "no-program-data" };
    }

    // Compact the model to the fields the LLM actually reads. Full raw records
    // would drown the prompt in identifiers and origin blocks the brief writer
    // doesn't cite. The mapping stays honest: each summarised field is a
    // straight projection, not an invented value.
    const agingItems = model.workItems
      .filter((w) => w.updatedAt !== null || w.createdAt !== null)
      .map((w) => ({
        identifier: w.identifier,
        title: w.title,
        bucket: w.bucket,
        updatedAt: (w.updatedAt ?? w.createdAt) as string,
        assignee: w.assignee,
        priority: w.priority,
        workstream: w.workstream,
        url: null,
      }));
    const stalled = sittingUntouched(agingItems, asOf)
      .slice(0, 8)
      .map((i) => ({
        id: i.identifier,
        title: i.title,
        daysSinceUpdate: i.daysSinceUpdate,
      }));
    const closed = recentlyClosed(agingItems, asOf)
      .slice(0, 10)
      .map((i) => ({
        id: i.identifier,
        title: i.title,
        bucket: i.bucket,
        daysAgo: i.daysSinceClosed,
      }));

    const summary: BriefInputSummary = {
      program: {
        id: model.program.id,
        name: model.program.name,
        launchDate: model.program.launchDate,
      },
      asOf,
      workItems: model.workItems.slice(0, 60).map((w) => ({
        id: w.identifier,
        title: w.title,
        bucket: w.bucket,
        priority: w.priority,
        workstream: w.workstream,
        updatedAt: w.updatedAt ?? null,
      })),
      phases: model.phases.map((p) => ({
        id: p.id,
        name: p.name,
        state: p.state,
        window: p.window,
      })),
      milestones: model.milestones.slice(0, 12).map((m) => ({
        label: m.label,
        date: m.date,
        state: m.state,
      })),
      risks: model.risks.slice(0, 20).map((r) => ({
        id: r.id,
        description: r.description,
        severity: r.severity,
        state: r.state,
      })),
      recentlyClosed: closed,
      stalled,
    };

    const userContent = `Here is the program's current state as JSON. Write the brief.\n\n${JSON.stringify(summary, null, 2)}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 900,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userContent }],
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return {
          ok: false,
          reason: "api-error",
          detail: `${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ""}`,
        };
      }

      const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
      const text = (json.content ?? []).find((c) => c.type === "text")?.text ?? "";
      const parsed = tryParseBrief(text);
      if (!parsed) {
        return { ok: false, reason: "unparseable", detail: text.slice(0, 240) };
      }
      return {
        ok: true,
        paragraph: parsed.paragraph,
        watchList: parsed.watchList,
        generatedAt: new Date().toISOString(),
        model: MODEL,
      };
    } catch (err) {
      return {
        ok: false,
        reason: "api-error",
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  });

/**
 * Extract the JSON output. The prompt asks for pure JSON, but small models
 * sometimes wrap in ```json fences or prefix with a sentence; strip both
 * defensively rather than failing the run on a formatting quirk.
 */
function tryParseBrief(text: string): { paragraph: string; watchList: string[] } | null {
  const stripped = text
    .replace(/^```(?:json)?\s*/, "")
    .replace(/```\s*$/, "")
    .trim();
  // If there's leading prose before "{", start at the first "{".
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(stripped.slice(start, end + 1)) as {
      paragraph?: unknown;
      watchList?: unknown;
    };
    if (typeof parsed.paragraph !== "string") return null;
    if (!Array.isArray(parsed.watchList)) return null;
    const watch: string[] = [];
    for (const item of parsed.watchList) {
      if (typeof item === "string") watch.push(item);
    }
    return { paragraph: parsed.paragraph, watchList: watch };
  } catch {
    return null;
  }
}
