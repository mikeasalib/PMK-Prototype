import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { SectionTabs } from "@/components/SectionTabs";
import { UrgencyDot } from "@/components/va-ui";
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

const COLUMNS: { key: LinearBucket; label: string; color: string }[] = [
  { key: "backlog", label: "Backlog", color: "#565c65" },
  { key: "todo", label: "Todo", color: "#1a6fa8" },
  { key: "in_progress", label: "In Progress", color: "#8a5a00" },
  { key: "done", label: "Done", color: "#2e8540" },
];

/** Cards per column before a "show more". Eight fills a screen without
 *  scrolling past the other columns. */
const COLUMN_CAP = 8;

function SprintBoard() {
  const program = useProgram();
  // Per-program. Was module-level.
  const WS_KEYS: (WorkstreamKey | "all")[] = ["all", ...workstreamKeys(program)];
  const seed = seedFor(program.id);
  const { linear, isLoading } = useStoredData(program.id);
  const [ws, setWs] = useState<WorkstreamKey | "all">("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const expandColumn = (key: string) => setExpanded((prev) => ({ ...prev, [key]: true }));

  const filtered = useMemo(
    () => linear.filter((i) => ws === "all" || inferWorkstream(i, program) === ws),
    [linear, ws],
  );

  return (
    <AppLayout>
      <PageHeader
        title="Sprint board"
        subtitle="Live Linear board for the DEP project — grouped by state."
      />
      <SectionTabs group="work" />
      <div
        className="flex flex-wrap items-center gap-2 px-6 py-3"
        style={{ borderBottom: "1px solid #dfe1e2", backgroundColor: "#f0f0f0" }}
      >
        <span
          className="text-xs uppercase tracking-wide font-semibold"
          style={{ color: "#3a5a40" }}
        >
          Workstream
        </span>
        {WS_KEYS.map((k) => {
          const active = ws === k;
          const color = k === "all" ? "#3a5a40" : workstreamOf(k, program).color;
          return (
            <button
              key={k}
              onClick={() => setWs(k)}
              className="rounded px-2 py-1 text-xs font-semibold"
              style={{
                border: `1px solid ${active ? color : "#dfe1e2"}`,
                backgroundColor: active ? color : "#fff",
                color: active ? "#fff" : "#1b1b1b",
              }}
            >
              {k === "all" ? "All" : k}
            </button>
          );
        })}
        <span className="ml-auto text-xs" style={{ color: "#565c65" }}>
          {filtered.length} issues
        </span>
      </div>

      {ws !== "all" &&
        (() => {
          const u = seed.workstreamUpdates.find((x) => x.ws === ws);
          if (!u) return null;
          return (
            <div
              className="mx-6 mt-4 rounded-md bg-white p-4"
              style={{
                border: "1px solid #e5e5e2",
                borderLeft: `3px solid ${HEALTH_COLOR[u.health]}`,
              }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div
                    className="text-[13px] font-semibold"
                    style={{ color: "#3a5a40", fontFamily: "Public Sans, system-ui, sans-serif" }}
                  >
                    {u.ws} · {u.name}
                  </div>
                  <div className="text-xs" style={{ color: "#565c65" }}>
                    Lead: {u.owner} · from Mon 7/13 sync
                  </div>
                </div>
                <span
                  className="rounded px-1.5 py-0.5 text-xs font-semibold uppercase"
                  style={{
                    color: HEALTH_COLOR[u.health],
                    backgroundColor: `${HEALTH_COLOR[u.health]}14`,
                    border: `1px solid ${HEALTH_COLOR[u.health]}44`,
                  }}
                >
                  {HEALTH_LABEL[u.health]}
                </span>
              </div>
              <div className="mt-2 text-xs">{u.headline}</div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <UpdateList title="In progress" color="#1a6fa8" items={u.progress} />
                <UpdateList title="Risks" color="#b3261e" items={u.risks} />
                <UpdateList title="Next steps" color="#2e8540" items={u.nextSteps} />
              </div>
            </div>
          );
        })()}

      {isLoading ? (
        <div className="p-6 text-[13px]" style={{ color: "#565c65" }}>
          Loading live data…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 p-4 sm:p-6 md:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = filtered.filter((t) => bucketOf(t) === col.key);
            // Columns are capped rather than filtered: a board's columns are
            // the point of a board, so none of them disappears — but Backlog
            // and Done carried 17 and 21 cards, which is what made this page
            // 13.6 screens tall.
            const cap = expanded[col.key] ? items.length : COLUMN_CAP;
            const shown = items.slice(0, cap);
            const hidden = items.length - shown.length;
            return (
              <div
                key={col.key}
                className="rounded-md p-2"
                style={{ backgroundColor: "#f7f7f5", border: "1px solid #e5e5e2" }}
              >
                {/* Header is neutral. Four column colours plus a card border
                    plus a priority badge was four accents competing on one
                    screen; the column label already says which column it is. */}
                <div
                  className="mb-2 flex items-center justify-between px-1 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "#565c65" }}
                >
                  <span>{col.label}</span>
                  <span>{items.length}</span>
                </div>
                <div className="space-y-1.5">
                  {shown.map((t) => (
                    <IssueCard key={t.id} issue={t} />
                  ))}
                </div>
                {hidden > 0 ? (
                  <button
                    type="button"
                    onClick={() => expandColumn(col.key)}
                    className="mt-2 w-full rounded px-2 py-1.5 text-xs font-medium"
                    style={{ border: "1px solid #dfe1e2", backgroundColor: "#fff", color: "#3a5a40" }}
                  >
                    Show {hidden} more
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}

/**
 * One card, two lines.
 *
 * Was five lines carrying three coloured tokens — a workstream border, a
 * workstream badge, and a priority badge at every level — which made 64 cards
 * measure 13.6 screens and made none of the colour mean anything. The
 * workstream badge duplicated the border it sat next to (and workstream has a
 * whole tab of its own); the priority badge became a dot for urgent and high
 * only; the relative timestamp moved onto the title's tooltip.
 */
function IssueCard({ issue }: { issue: StoredLinearIssue }) {
  const program = useProgram();
  const ws = inferWorkstream(issue, program) as WorkstreamKey;
  const color = workstreamOf(ws, program).color;
  return (
    <div
      className="rounded bg-white px-2 py-1.5"
      style={{ border: "1px solid #e5e5e2", borderLeft: `3px solid ${color}` }}
      title={`${ws} · ${priorityLabel(issue.priority)} · updated ${relativeTime(issue.source_updated_at)}`}
    >
      <div className="flex items-start gap-1.5">
        <UrgencyDot priority={issue.priority} />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium leading-snug" style={{ color: "#1b1b1b" }}>
            {issue.title}
          </div>
          <div className="mt-0.5 flex items-baseline gap-2 text-xs" style={{ color: "#8a8a80" }}>
            <a
              href={issue.url ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="font-mono hover:underline"
              style={{ color: "#8a8a80" }}
            >
              {issue.identifier}
            </a>
            <span className="min-w-0 truncate">{issue.assignee ?? "unassigned"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function UpdateList({ title, color, items }: { title: string; color: string; items: string[] }) {
  if (!items.length) return <div />;
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>
        {title}
      </div>
      <ul className="mt-0.5 list-disc pl-4 text-xs" style={{ color: "#3d3d3d" }}>
        {items.map((i, idx) => (
          <li key={idx}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
