import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { WsTag } from "@/components/va-ui";
import {
  Bullet,
  Button,
  Disclosure,
  Eyebrow,
  KZ,
  List,
  Mono,
  NoteBox,
  Panel,
  PanelHead,
  SectionTitle,
  Tag,
} from "@/components/kz";
import { PROGRAMS, pageTitle } from "@/lib/program.config";
import { generateBrief, type BriefResult } from "@/lib/brief.functions";
import {
  HEALTH_COLOR,
  HEALTH_LABEL,
  WORKSTREAM_UPDATES,
  WORKSTREAM_UPDATES_SOURCE,
} from "@/lib/workstream-updates";
import { seedFor } from "@/lib/program-seed";
import { useProgram } from "./route";

/**
 * The week, two ways.
 *
 * The body of the page is the cross-workstream update as it was written: one
 * hairline section per workstream carrying its own health, headline and
 * highlights, closed by the decisions that are still open. That is the record,
 * and it needs no model to render.
 *
 * Above it, "How are we doing?" as a paragraph generated on demand from the
 * program model. Explicit button rather than auto-generated on load: an LLM call
 * is a real spend and a real few-seconds wait, and a strategist should know they
 * asked for it. Every claim is expected to carry an identifier citation; the
 * panel shows them as-is so the reader can jump to the source.
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
    { kind: "idle" } | { kind: "loading" } | { kind: "loaded"; result: BriefResult }
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

  // Decisions still open, read from the register rather than typed here: the
  // high-severity open risks are exactly the calls nobody has made yet.
  const openDecisions = seedFor(program.id)
    .risks.filter(
      (r) => r.status !== "resolved" && (r.severity === "critical" || r.severity === "high"),
    )
    .slice(0, 6);

  return (
    <AppLayout>
      <PageHeader
        eyebrow="This week"
        title="Brief"
        subtitle={`${WORKSTREAM_UPDATES_SOURCE.label}, composed from the sync, Linear and the risk register. Every line traces back to a source.`}
        actions={
          <Button onClick={generate} disabled={isLoading}>
            {isLoading
              ? "Generating…"
              : state.kind === "loaded"
                ? "Regenerate synthesis"
                : "Generate synthesis"}
          </Button>
        }
      />

      <div style={{ padding: "28px var(--kz-pad-x) 60px var(--kz-pad-x)", maxWidth: 1100 }}>
        <Mono size={10.5}>
          {WORKSTREAM_UPDATES_SOURCE.label} · {WORKSTREAM_UPDATES_SOURCE.date}
        </Mono>

        {/* The generated paragraph, when asked for. It sits above the record and
            is labelled a draft, so it can never be mistaken for it. */}
        {state.kind === "loaded" ? (
          <div style={{ marginTop: 20 }}>
            <Synthesis result={state.result} />
          </div>
        ) : null}

        <div style={{ marginTop: 20, display: "flex", flexDirection: "column" }}>
          {WORKSTREAM_UPDATES.map((u) => (
            <section
              key={u.ws}
              style={{
                border: `1px solid ${KZ.bone}`,
                borderBottom: "none",
                padding: "22px 26px",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12 }}>
                <WsTag ws={u.ws} />
                <SectionTitle size={18}>{u.name}</SectionTitle>
                <Mono size={10.5}>{u.owner}</Mono>
                <Tag tone={HEALTH_COLOR[u.health]} style={{ marginLeft: "auto" }}>
                  {HEALTH_LABEL[u.health]}
                </Tag>
              </div>
              <p
                style={{
                  margin: "12px 0 0 0",
                  fontSize: 14.5,
                  lineHeight: 1.5,
                  maxWidth: "80ch",
                  color: KZ.ink,
                  textWrap: "pretty",
                }}
              >
                {u.headline}
              </p>
              <List
                style={{
                  margin: "14px 0 0 0",
                  display: "flex",
                  flexDirection: "column",
                  gap: 7,
                }}
              >
                {u.highlights.map((h) => (
                  <Bullet key={h}>{h}</Bullet>
                ))}
              </List>
            </section>
          ))}

          {/* The one tinted panel on the page: what still needs a decision. */}
          <section
            style={{
              border: `1px solid ${KZ.bone}`,
              padding: "22px 26px",
              background: KZ.grey050,
            }}
          >
            <Eyebrow size={10}>Decisions needed</Eyebrow>
            {openDecisions.length ? (
              <List
                style={{
                  margin: "12px 0 0 0",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(360px,1fr))",
                  gap: "18px 32px",
                }}
              >
                {openDecisions.map((r) => (
                  <li key={r.id}>
                    <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4 }}>{r.title}</div>
                    <div style={{ marginTop: 5 }}>
                      <Mono size={10.5}>
                        {r.owner} · {r.severity}
                        {r.linkedTicket ? ` · ${r.linkedTicket}` : ""}
                      </Mono>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.45, color: KZ.body }}>
                      {r.nextAction}
                    </div>
                  </li>
                ))}
              </List>
            ) : (
              <div style={{ marginTop: 12, fontSize: 13, color: KZ.body }}>
                No open critical or high risk in the register. Nothing is waiting on a call.
              </div>
            )}
            <Disclosure>
              Read from the Notion risk register: open entries at high or critical severity
            </Disclosure>
          </section>
        </div>
      </div>
    </AppLayout>
  );
}

/** The generated paragraph and its watch list, or the reason there isn't one. */
function Synthesis({ result }: { result: BriefResult }) {
  if (!result.ok) {
    const messages: Record<typeof result.reason, string> = {
      "no-api-key":
        "ANTHROPIC_API_KEY is not set in this environment, so the brief writer isn't wired up. This is expected in local dev; a deployed instance with the key will render the synthesis here.",
      "no-program-data":
        "No work items or risks are reaching this route, so the writer has nothing to summarize. Check the data sources on the rail.",
      "api-error":
        "The Anthropic API returned an error. Usually transient, so try again in a moment.",
      unparseable:
        "The model returned text that could not be parsed as the expected {paragraph, watchList} JSON. The prompt may need tightening.",
    };
    return (
      <NoteBox style={{ maxWidth: "none", background: KZ.grey050 }}>
        <div style={{ fontWeight: 500, color: KZ.ink }}>Synthesis not available</div>
        <p style={{ margin: "8px 0 0 0" }}>{messages[result.reason]}</p>
        {result.detail ? (
          <div style={{ marginTop: 12 }}>
            <Mono size={10.5}>{result.detail}</Mono>
          </div>
        ) : null}
      </NoteBox>
    );
  }

  return (
    <Panel>
      <PanelHead label="Generated synthesis" right="draft" rightTone={KZ.amber} />
      <p
        style={{
          margin: "16px 0 0 0",
          fontSize: 14,
          lineHeight: 1.6,
          maxWidth: "80ch",
          color: KZ.ink,
          textWrap: "pretty",
        }}
      >
        {result.paragraph}
      </p>
      {result.watchList.length > 0 ? (
        <div style={{ marginTop: 20 }}>
          <Eyebrow size={10}>Worth watching</Eyebrow>
          <List style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {result.watchList.map((line) => (
              <Bullet key={line}>{line}</Bullet>
            ))}
          </List>
        </div>
      ) : null}
      <Disclosure>
        Generated {new Date(result.generatedAt).toLocaleString()} · model {result.model} · draft,
        review before sending. Citations reference the identifiers this program uses in Linear and
        Notion
      </Disclosure>
    </Panel>
  );
}
