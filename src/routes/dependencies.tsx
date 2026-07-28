import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { WsTag } from "@/components/va-ui";
import { WORKSTREAMS, type WorkstreamKey } from "@/lib/va-data";
import { useStoredData, bucketOf, inferWorkstream, priorityLabel, priorityColor, type StoredLinearIssue } from "@/hooks/use-stored-data";
import { relativeTime } from "@/hooks/use-program-data";
import { CROSS_DEPS, HEALTH_COLOR, HEALTH_LABEL } from "@/lib/workstream-updates";
import { pageTitle } from "@/lib/program.config";

export const Route = createFileRoute("/dependencies")({
  head: () => ({
    meta: [
      { title: pageTitle("Dependency map") },
      { name: "description", content: "Live view of open work grouped by workstream and blockers pinned on top." },
    ],
  }),
  component: Dependencies,
});

const WS_ORDER: WorkstreamKey[] = ["WS1", "WS2", "WS3", "WS4", "WS5", "Admin"];

function Dependencies() {
  const { linear, isLoading } = useStoredData();
  const [ws, setWs] = useState<WorkstreamKey | "all">("all");
  const [owner, setOwner] = useState<string>("all");

  const allOwners = useMemo(() => {
    const s = new Set<string>();
    linear.forEach((i) => {
      if (i.assignee) s.add(i.assignee);
    });
    return Array.from(s).sort();
  }, [linear]);

  const open = useMemo(
    () =>
      linear
        .filter((i) => bucketOf(i) !== "done" && bucketOf(i) !== "canceled")
        .filter((i) => ws === "all" || inferWorkstream(i) === ws)
        .filter((i) => owner === "all" || i.assignee === owner),
    [linear, ws, owner],
  );

  const blockers = useMemo(
    () =>
      linear.filter((i) => {
        const b = bucketOf(i);
        if (b === "done" || b === "canceled") return false;
        const t = i.title.toLowerCase();
        return t.includes("blocked") || t.includes("blocker") || (i.labels ?? []).some((l) => /block/i.test(l)) || i.priority === 1;
      }),
    [linear],
  );

  const grouped = WS_ORDER.map((k) => ({
    ws: k,
    items: open.filter((i) => inferWorkstream(i) === k),
  })).filter((g) => g.items.length > 0);

  return (
    <AppLayout>
      <PageHeader
        title="Dependency map"
        subtitle="Open Linear work grouped by workstream. Blockers pinned below."
      />
      <div
        className="flex flex-wrap items-center gap-3 px-6 py-3"
        style={{ borderBottom: "1px solid #dfe1e2", backgroundColor: "#f0f0f0" }}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#3a5a40" }}>Workstream</span>
        <select
          value={ws}
          onChange={(e) => setWs(e.target.value as WorkstreamKey | "all")}
          className="rounded border px-2 py-1 text-[12px]"
          style={{ borderColor: "#a9aeb1" }}
        >
          <option value="all">All workstreams</option>
          {WS_ORDER.map((k) => (
            <option key={k} value={k}>{WORKSTREAMS[k].label}</option>
          ))}
        </select>
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#3a5a40" }}>Assignee</span>
        <select
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className="rounded border px-2 py-1 text-[12px]"
          style={{ borderColor: "#a9aeb1" }}
        >
          <option value="all">All</option>
          {allOwners.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <span className="ml-auto text-[11px]" style={{ color: "#565c65" }}>
          {open.length} open issues
        </span>
      </div>

      {isLoading ? (
        <div className="p-6 text-[13px]" style={{ color: "#565c65" }}>Loading live data…</div>
      ) : (
        <div className="p-6 space-y-6">
          {/* Blockers pinned */}
          <section
            className="overflow-hidden rounded-xl"
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #f1c9c4",
              boxShadow: "0 1px 2px rgba(179, 38, 30, 0.06), 0 12px 28px -14px rgba(179, 38, 30, 0.22)",
            }}
          >
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid #f1c9c4", background: "linear-gradient(180deg, #fff5f4 0%, #fdeceb 100%)" }}>
              <h2 className="text-sm font-semibold" style={{ color: "#b3261e" }}>
                Blockers &amp; urgent · {blockers.length}
              </h2>
              <span className="text-[11px]" style={{ color: "#565c65" }}>
                Titles/labels containing "block" or priority = Urgent
              </span>
            </div>
            {blockers.length === 0 ? (
              <div className="p-4 text-center text-[12px]" style={{ color: "#565c65" }}>
                No blockers currently flagged in Linear.
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: "#f1c9c4" }}>
                {blockers.map((b) => (
                  <IssueRow key={b.id} issue={b} />
                ))}
              </ul>
            )}
          </section>

          {/* Cross-workstream dependencies (meeting truth) */}
          <section
            className="overflow-hidden rounded-xl"
            style={{ backgroundColor: "#ffffff", border: "1px solid #dfe1e2", boxShadow: "0 1px 2px rgba(17, 47, 78, 0.04), 0 12px 28px -14px rgba(17, 47, 78, 0.18)" }}
          >
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid #dfe1e2", background: "linear-gradient(180deg, #f5f8fc 0%, #eef2f7 100%)" }}>
              <h2 className="text-sm font-semibold" style={{ color: "#3a5a40" }}>
                Cross-workstream dependencies · {CROSS_DEPS.length}
              </h2>
              <span className="text-[11px]" style={{ color: "#565c65" }}>From Mon 7/13 cross-functional sync</span>
            </div>
            <ul className="divide-y" style={{ borderColor: "#eef1f4" }}>
              {CROSS_DEPS.map((d) => (
                <li key={d.id} className="px-5 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-[13px] font-medium" style={{ color: "#1b1b1b" }}>
                      <span className="mr-2 font-mono text-[11px]" style={{ color: "#565c65" }}>
                        {d.from} → {d.to}
                      </span>
                      {d.title}
                    </div>
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase" style={{ color: HEALTH_COLOR[d.severity], backgroundColor: `${HEALTH_COLOR[d.severity]}14`, border: `1px solid ${HEALTH_COLOR[d.severity]}44` }}>
                      {HEALTH_LABEL[d.severity]}
                    </span>
                  </div>
                  <div className="mt-1 text-[12px]" style={{ color: "#3d3d3d" }}>{d.detail}</div>
                  <div className="mt-1 flex flex-wrap gap-3 text-[11px]" style={{ color: "#565c65" }}>
                    <span>Owner: {d.owner}</span>
                    {d.due && <span>Due: {d.due}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Grouped by workstream */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {grouped.map((g) => (
              <section
                key={g.ws}
                className="rounded-xl p-5"
                style={{
                  backgroundColor: "#f7f7f5",
                  border: "1px solid #e0e2e0",
                  boxShadow: "0 1px 2px rgba(17, 47, 78, 0.04), 0 8px 24px -12px rgba(17, 47, 78, 0.12)",
                }}
              >
                <div className="mb-4 flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold" style={{ color: "#3a5a40", fontFamily: 'Public Sans, system-ui, sans-serif' }}>
                    {WORKSTREAMS[g.ws].label}
                  </h2>
                  <span className="text-[11px]" style={{ color: "#565c65" }}>{g.items.length} open</span>
                </div>
                <ul className="space-y-2">
                  {g.items.map((i) => (
                    <IssueRow key={i.id} issue={i} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function IssueRow({ issue }: { issue: StoredLinearIssue }) {
  const ws = inferWorkstream(issue) as WorkstreamKey;
  return (
    <li className="rounded bg-white p-2.5" style={{ border: "1px solid #eee", borderLeft: `3px solid ${WORKSTREAMS[ws]?.color ?? "#565c65"}` }}>
      <div className="flex items-baseline gap-2">
        <a href={issue.url ?? "#"} target="_blank" rel="noreferrer" className="font-mono text-[11px] underline" style={{ color: "#005ea2" }}>
          {issue.identifier}
        </a>
        <span className="text-[13px] font-medium">{issue.title}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]" style={{ color: "#565c65" }}>
        <WsTag ws={ws} />
        <span>{issue.assignee ?? "unassigned"}</span>
        <span>· {issue.state_name ?? "—"}</span>
        <span
          className="rounded px-1 py-0.5 font-semibold uppercase"
          style={{ color: priorityColor(issue.priority), backgroundColor: `${priorityColor(issue.priority)}14`, border: `1px solid ${priorityColor(issue.priority)}44` }}
        >
          {priorityLabel(issue.priority)}
        </span>
        <span className="ml-auto">{relativeTime(issue.source_updated_at)}</span>
      </div>
    </li>
  );
}
