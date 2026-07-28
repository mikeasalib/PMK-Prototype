import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { WORKSTREAMS, type WorkstreamKey } from "@/lib/va-data";
import { useStoredData, bucketOf, inferWorkstream, priorityLabel, priorityColor, type LinearBucket, type StoredLinearIssue } from "@/hooks/use-stored-data";
import { relativeTime } from "@/hooks/use-program-data";
import { WORKSTREAM_UPDATES, HEALTH_COLOR, HEALTH_LABEL } from "@/lib/workstream-updates";
import { pageTitle } from "@/lib/program.config";

export const Route = createFileRoute("/sprint-board")({
  head: () => ({ meta: [{ title: pageTitle("Sprint board") }] }),
  component: SprintBoard,
});

const COLUMNS: { key: LinearBucket; label: string; color: string }[] = [
  { key: "backlog", label: "Backlog", color: "#565c65" },
  { key: "todo", label: "Todo", color: "#1a6fa8" },
  { key: "in_progress", label: "In Progress", color: "#8a5a00" },
  { key: "done", label: "Done", color: "#2e8540" },
];

const WS_KEYS: (WorkstreamKey | "all")[] = ["all", "WS1", "WS2", "WS3", "WS4", "WS5", "Admin"];

function SprintBoard() {
  const { linear, isLoading } = useStoredData();
  const [ws, setWs] = useState<WorkstreamKey | "all">("all");

  const filtered = useMemo(
    () => linear.filter((i) => ws === "all" || inferWorkstream(i) === ws),
    [linear, ws],
  );

  return (
    <AppLayout>
      <PageHeader
        title="Sprint board"
        subtitle="Live Linear board for the DEP project — grouped by state."
      />
      <div
        className="flex flex-wrap items-center gap-2 px-6 py-3"
        style={{ borderBottom: "1px solid #dfe1e2", backgroundColor: "#f0f0f0" }}
      >
        <span className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: "#3a5a40" }}>
          Workstream
        </span>
        {WS_KEYS.map((k) => {
          const active = ws === k;
          const color = k === "all" ? "#3a5a40" : WORKSTREAMS[k as WorkstreamKey].color;
          return (
            <button
              key={k}
              onClick={() => setWs(k)}
              className="rounded px-2 py-1 text-[11px] font-semibold"
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
        <span className="ml-auto text-[11px]" style={{ color: "#565c65" }}>
          {filtered.length} issues
        </span>
      </div>

      {ws !== "all" && (() => {
        const u = WORKSTREAM_UPDATES.find((x) => x.ws === ws);
        if (!u) return null;
        return (
          <div className="mx-6 mt-4 rounded-md bg-white p-4" style={{ border: "1px solid #e5e5e2", borderLeft: `3px solid ${HEALTH_COLOR[u.health]}` }}>
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <div className="text-[13px] font-semibold" style={{ color: "#3a5a40", fontFamily: 'Public Sans, system-ui, sans-serif' }}>
                  {u.ws} · {u.name}
                </div>
                <div className="text-[11px]" style={{ color: "#565c65" }}>Lead: {u.owner} · from Mon 7/13 sync</div>
              </div>
              <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase" style={{ color: HEALTH_COLOR[u.health], backgroundColor: `${HEALTH_COLOR[u.health]}14`, border: `1px solid ${HEALTH_COLOR[u.health]}44` }}>
                {HEALTH_LABEL[u.health]}
              </span>
            </div>
            <div className="mt-2 text-[12px]">{u.headline}</div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <UpdateList title="In progress" color="#1a6fa8" items={u.progress} />
              <UpdateList title="Risks" color="#b3261e" items={u.risks} />
              <UpdateList title="Next steps" color="#2e8540" items={u.nextSteps} />
            </div>
          </div>
        );
      })()}


      {isLoading ? (
        <div className="p-6 text-[13px]" style={{ color: "#565c65" }}>Loading live data…</div>
      ) : (
        <div className="grid grid-cols-4 gap-3 p-6">
          {COLUMNS.map((col) => {
            const items = filtered.filter((t) => bucketOf(t) === col.key);
            return (
              <div
                key={col.key}
                className="rounded-md p-2"
                style={{ backgroundColor: "#f7f7f5", border: "1px solid #e5e5e2", minHeight: 300 }}
              >
                <div
                  className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: col.color }}
                >
                  <span>{col.label}</span>
                  <span className="rounded px-1.5" style={{ backgroundColor: `${col.color}14`, color: col.color }}>
                    {items.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((t) => (
                    <IssueCard key={t.id} issue={t} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}

function IssueCard({ issue }: { issue: StoredLinearIssue }) {
  const ws = inferWorkstream(issue) as WorkstreamKey;
  const color = WORKSTREAMS[ws]?.color ?? "#565c65";
  return (
    <div
      className="rounded bg-white p-2"
      style={{ border: "1px solid #e5e5e2", borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-center justify-between text-[10px]" style={{ color: "#565c65" }}>
        <a href={issue.url ?? "#"} target="_blank" rel="noreferrer" className="font-mono underline" style={{ color: "#005ea2" }}>
          {issue.identifier}
        </a>
        <span className="rounded px-1 py-0.5 font-semibold uppercase" style={{ color, backgroundColor: `${color}14`, border: `1px solid ${color}44` }}>
          {ws}
        </span>
      </div>
      <div className="mt-1 text-[12px] font-medium leading-snug">{issue.title}</div>
      <div className="mt-1 flex items-center justify-between text-[10px]" style={{ color: "#565c65" }}>
        <span>{issue.assignee ?? "unassigned"}</span>
        <span
          className="rounded px-1 py-0.5 font-semibold uppercase"
          style={{ color: priorityColor(issue.priority), backgroundColor: `${priorityColor(issue.priority)}14`, border: `1px solid ${priorityColor(issue.priority)}44` }}
        >
          {priorityLabel(issue.priority)}
        </span>
      </div>
      <div className="mt-1 text-[10px]" style={{ color: "#8a9099" }}>
        {relativeTime(issue.source_updated_at)}
      </div>
    </div>
  );
}

function UpdateList({ title, color, items }: { title: string; color: string; items: string[] }) {
  if (!items.length) return <div />;
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color }}>{title}</div>
      <ul className="mt-0.5 list-disc pl-4 text-[11px]" style={{ color: "#3d3d3d" }}>
        {items.map((i, idx) => <li key={idx}>{i}</li>)}
      </ul>
    </div>
  );
}

