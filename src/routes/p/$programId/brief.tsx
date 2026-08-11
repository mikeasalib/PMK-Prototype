import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles } from "lucide-react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { PROGRAMS, pageTitle } from "@/lib/program.config";
import { generateBrief, type BriefResult } from "@/lib/brief.functions";
import { useProgram } from "./route";

/**
 * "How are we doing?" as a paragraph, generated on demand from the program
 * model. Explicit button rather than auto-generated on load: an LLM call is
 * a real spend and a real few-seconds wait; a strategist should know they
 * asked for it. The output is treated the same way as any other artifact —
 * a draft to read, not a canonical status update.
 *
 * Every claim the model produces is expected to carry an identifier
 * citation (DEP-1907, R2, milestone name) per the system prompt in
 * brief.functions.ts. The panel doesn't try to interpret those; it just
 * shows them as-is so the reader can jump to the source themselves.
 */
export const Route = createFileRoute("/p/$programId/brief")({
  head: ({ params }) => ({
    meta: [
      { title: pageTitle("Brief", PROGRAMS[params.programId]) },
      {
        name: "description",
        content:
          "Grounded synthesis of the current program state, generated on demand and cited to source records.",
      },
    ],
  }),
  component: Brief,
});

function Brief() {
  const program = useProgram();
  const run = useServerFn(generateBrief);
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "loaded"; result: BriefResult }
  >({ kind: "idle" });

  async function generate() {
    setState({ kind: "loading" });
    try {
      const result = await run({ data: program.id });
      setState({ kind: "loaded", result });
    } catch (err) {
      setState({
        kind: "loaded",
        result: {
          ok: false,
          reason: "api-error",
          detail: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  const isLoading = state.kind === "loading";

  return (
    <AppLayout>
      <PageHeader
        title="Brief"
        subtitle={`${program.domainLabel} — grounded synthesis of the current program state. Each claim cites its source record.`}
      />

      <div className="px-4 pb-10 pt-2 sm:px-6">
        <div
          className="mb-5 rounded-md p-3 text-xs"
          style={{ backgroundColor: "#f7f7f5", border: "1px solid #e5e5e2", color: "#565c65" }}
        >
          Reads Linear, Notion risk register, and lifecycle phases at generation
          time. Every claim the writer produces must cite an identifier
          ([DEP-1234], [R2], milestone name); a sentence without one is a
          general observation. The writer will say "not yet sourced" for
          sections the data does not support. Nothing typed here becomes
          program-of-record data.
        </div>

        <button
          type="button"
          onClick={generate}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-medium transition-colors"
          style={{
            backgroundColor: "#1f3d2b",
            color: "#ffffff",
            opacity: isLoading ? 0.7 : 1,
            cursor: isLoading ? "wait" : "pointer",
          }}
        >
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {isLoading ? "Generating…" : state.kind === "loaded" ? "Regenerate brief" : "Generate brief"}
        </button>

        {state.kind === "loaded" ? <RenderResult result={state.result} /> : null}
      </div>
    </AppLayout>
  );
}

function RenderResult({ result }: { result: BriefResult }) {
  if (!result.ok) {
    return <NotOk result={result} />;
  }
  return (
    <section
      className="mt-6 rounded-lg bg-white p-5"
      style={{ border: "1px solid #e5e5e2" }}
    >
      <p className="text-[14px] leading-relaxed" style={{ color: "#1b1b1b" }}>
        {result.paragraph}
      </p>
      {result.watchList.length > 0 ? (
        <div className="mt-5">
          <h3
            className="mb-2 text-xs font-semibold uppercase tracking-wide"
            style={{ color: "#565c65" }}
          >
            Worth watching
          </h3>
          <ul className="space-y-1.5 text-[13px]" style={{ color: "#1b1b1b" }}>
            {result.watchList.map((line, i) => (
              <li key={i} className="flex gap-2">
                <span style={{ color: "#3a5a40" }}>▸</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-5 text-xs" style={{ color: "#8a8a80" }}>
        Generated {new Date(result.generatedAt).toLocaleString()} · model {result.model}. Draft —
        review before sending. Citations reference the identifiers this program uses
        in Linear / Notion.
      </div>
    </section>
  );
}

function NotOk({ result }: { result: Extract<BriefResult, { ok: false }> }) {
  const messages: Record<typeof result.reason, string> = {
    "no-api-key":
      "ANTHROPIC_API_KEY is not set in this environment, so the brief writer isn't wired up. This is expected in local dev; a deployed instance with the key will render the summary here.",
    "no-program-data":
      "No work items or risks are reaching this route — nothing for the writer to summarise. Check the data source footer.",
    "api-error":
      "The Anthropic API returned an error. This is usually a transient issue; try again in a moment.",
    unparseable:
      "The model returned text that could not be parsed as the expected {paragraph, watchList} JSON. The model prompt may need tightening.",
  };
  return (
    <section
      className="mt-6 rounded-lg p-5"
      style={{
        backgroundColor: "#fdf5e6",
        border: "1px solid #e5e5e2",
        color: "#5a4a00",
      }}
    >
      <div className="text-[13px] font-semibold">Brief not available</div>
      <p className="mt-2 text-[13px]">{messages[result.reason]}</p>
      {result.detail ? (
        <div
          className="mt-3 rounded p-2 font-mono text-xs"
          style={{ backgroundColor: "#f7f0e0", color: "#5a4a00" }}
        >
          {result.detail}
        </div>
      ) : null}
    </section>
  );
}
