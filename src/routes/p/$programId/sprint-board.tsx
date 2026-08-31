import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { WsTag } from "@/components/va-ui";
import {
  Bullet,
  Chip,
  Eyebrow,
  KZ,
  List,
  Mono,
  PanelHead,
  SectionTitle,
  Tag,
  pad2,
} from "@/components/kz";
import type { WorkstreamKey } from "@/lib/va-data";
import {
  useStoredData,
  bucketOf,
  inferWorkstream,
  priorityLabel,
  priorityColor,
  type LinearBucket,
  type StoredLinearIssue,
} from "@/hooks/use-stored-data";
import { relativeTime } from "@/hooks/use-program-data";
import { HEALTH_COLOR, HEALTH_LABEL } from "@/lib/workstream-updates";
import { PROGRAMS, pageTitle, workstreamKeys, workstreamOf } from "@/lib/program.config";
import { seedFor } from "@/lib/program-seed";
import { useProgram } from "./route";

export const Route = createFileRoute("/p/$programId/sprint-board")({
  head: ({ params }) => ({
    meta: [{ title: pageTitle("Sprint board", PROGRAMS[params.programId]) }],
  }),
  component: SprintBoard,
});

const COLUMNS: { key: LinearBucket; label: string }[] = [
  { key: "backlog", label: "Backlog" },
  { key: "todo", label: "Todo" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

/** Cards per column before a "show more". Eight fills a screen without
 *  scrolling past the other columns. */
const COLUMN_CAP = 8;

function SprintBoard() {
  const program = useProgram();
  const WS_KEYS: (WorkstreamKey | "all")[] = ["all", ...workstreamKeys(program)];
  const seed = seedFor(program.id);
  const { linear, isLoading } = useStoredData(program.id);
  const [ws, setWs] = useState<WorkstreamKey | "all">("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const expandColumn = (key: string) => setExpanded((prev) => ({ ...prev, [key]: true }));

  const filtered = useMemo(
    () => linear.filter((i) => ws === "all" || inferWorkstream(i, program) === ws),
    [linear, ws, program],
  );

  const update = ws === "all" ? null : (seed.workstreamUpdates.find((x) => x.ws === ws) ?? null);
  const todayIso = new Date().toISOString().slice(0, 10);
  const currentWindow =
    program.sprintStrip.find((w) => w.start <= todayIso && todayIso <= w.end) ?? null;

  return (
    <AppLayout>
      <PageHeader
        eyebrow={currentWindow ? currentWindow.label : "Board"}
        title="Sprint board"
        subtitle="The Linear board grouped by state, with the workstream's own status from the weekly sync."
      />

      {/* Workstream chips. Active fills in the workstream's own colour, which is
          the only place this page spends colour on a control. */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          padding: "16px var(--kz-pad-x)",
          borderBottom: `1px solid ${KZ.bone}`,
        }}
      >
        <Mono size={10} tone={KZ.muted} style={{ textTransform: "uppercase", marginRight: 6 }}>
          Workstream
        </Mono>
        {WS_KEYS.map((k) => (
          <Chip
            key={k}
            label={k === "all" ? "All" : k}
            active={ws === k}
            tone={k === "all" ? KZ.ink : workstreamOf(k, program).color}
            onClick={() => setWs(k)}
          />
        ))}
        <Mono size={11} tone={KZ.muted} style={{ marginLeft: "auto" }}>
          {pad2(filtered.length)} issues
        </Mono>
      </div>

      {/* The selected workstream's status band — the one tinted panel here. */}
      {update ? (
        <div
          style={{
            margin: "24px var(--kz-pad-x) 0 var(--kz-pad-x)",
            border: `1px solid ${KZ.bone}`,
            background: KZ.grey050,
            padding: "20px 24px",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 12 }}>
            <WsTag ws={update.ws} />
            <SectionTitle size={16}>{update.name}</SectionTitle>
            <Mono size={10.5}>Lead: {update.owner} · from the weekly sync</Mono>
            <Tag tone={HEALTH_COLOR[update.health]} style={{ marginLeft: "auto" }}>
              {HEALTH_LABEL[update.health]}
            </Tag>
          </div>
          <p
            style={{
              margin: "10px 0 0 0",
              fontSize: 14,
              lineHeight: 1.5,
              color: KZ.body,
              maxWidth: "80ch",
            }}
          >
            {update.headline}
          </p>
          <div
            style={{
              marginTop: 18,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
              gap: 24,
            }}
          >
            <UpdateList title="In progress" items={update.progress} />
            <UpdateList title="Risks" items={update.risks} tone={KZ.coral} />
            <UpdateList title="Next steps" items={update.nextSteps} />
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div style={{ padding: "28px var(--kz-pad-x)" }}>
          <Mono size={11}>Loading…</Mono>
        </div>
      ) : (
        <div
          style={{
            padding: "24px var(--kz-pad-x) 60px var(--kz-pad-x)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
            gap: 20,
            alignItems: "start",
          }}
        >
          {COLUMNS.map((col) => {
            const items = filtered.filter((t) => bucketOf(t) === col.key);
            // Columns are capped rather than filtered: a board's columns are the
            // point of a board, so none of them disappears — but Backlog and
            // Done carrying twenty cards each is what made this page ten screens
            // tall.
            const cap = expanded[col.key] ? items.length : COLUMN_CAP;
            const shown = items.slice(0, cap);
            const hidden = items.length - shown.length;
            return (
              <section key={col.key} style={{ border: `1px solid ${KZ.bone}`, minHeight: 320 }}>
                <PanelHead
                  label={col.label}
                  right={pad2(items.length)}
                  style={{ padding: "12px 14px", paddingBottom: 12 }}
                />
                <div
                  style={{
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {shown.map((t) => (
                    <IssueCard key={t.identifier} issue={t} />
                  ))}
                  {hidden > 0 ? (
                    <button
                      type="button"
                      onClick={() => expandColumn(col.key)}
                      className="kz-transition"
                      style={{
                        border: `1px solid ${KZ.bone}`,
                        background: KZ.white,
                        color: KZ.ink,
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.02em",
                        padding: "8px 10px",
                        cursor: "pointer",
                      }}
                    >
                      Show {hidden} more
                    </button>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}

/**
 * One card: identifier and workstream on the top line, title, then owner and
 * priority. Priority tags only at urgent and high — a card carrying a tag at
 * every level tells you nothing about which card to read first.
 */
function IssueCard({ issue }: { issue: StoredLinearIssue }) {
  const program = useProgram();
  const ws = inferWorkstream(issue, program) as WorkstreamKey;
  return (
    <article
      style={{ border: `1px solid ${KZ.grey200}`, padding: 12 }}
      title={`${ws} · ${priorityLabel(issue.priority)} · updated ${relativeTime(issue.source_updated_at)}`}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <a href={issue.url ?? undefined} target="_blank" rel="noreferrer">
          <Mono size={10.5} tone={KZ.blue}>
            {issue.identifier}
          </Mono>
        </a>
        <WsTag ws={ws} />
      </div>
      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.4 }}>{issue.title}</div>
      <div
        style={{
          marginTop: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Mono size={10} style={{ minWidth: 0 }}>
          {issue.assignee ?? "unassigned"}
        </Mono>
        {issue.priority === 1 || issue.priority === 2 ? (
          <Tag tone={priorityColor(issue.priority)}>{priorityLabel(issue.priority)}</Tag>
        ) : null}
      </div>
    </article>
  );
}

function UpdateList({ title, items, tone }: { title: string; items: string[]; tone?: string }) {
  if (!items.length) return <div />;
  return (
    <div>
      <Eyebrow size={10}>{title}</Eyebrow>
      <List style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
        {items.map((i) => (
          <Bullet key={i} tone={tone}>
            {i}
          </Bullet>
        ))}
      </List>
    </div>
  );
}
