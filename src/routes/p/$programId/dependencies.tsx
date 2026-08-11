import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { SectionTabs } from "@/components/SectionTabs";
import { WsTag } from "@/components/va-ui";
import type { WorkstreamKey } from "@/lib/va-data";
import {
  useStoredData,
  bucketOf,
  inferWorkstream,
  priorityLabel,
  priorityColor,
  isBlocked,
  isOpen,
  type StoredLinearIssue,
} from "@/hooks/use-stored-data";
import { relativeTime } from "@/hooks/use-program-data";
import { HEALTH_COLOR, HEALTH_LABEL } from "@/lib/workstream-updates";
import { PROGRAMS, pageTitle, workstreamKeys, workstreamOf } from "@/lib/program.config";
import { seedFor } from "@/lib/program-seed";
import { useProgram } from "./route";

export const Route = createFileRoute("/p/$programId/dependencies")({
  head: ({ params }) => ({
    meta: [
      { title: pageTitle("Dependency map", PROGRAMS[params.programId]) },
      {
        name: "description",
        content: "Live view of open work grouped by workstream and blockers pinned on top.",
      },
    ],
  }),
  component: Dependencies,
});

function Dependencies() {
  const program = useProgram();
  // Per-program. Was a module-level constant, frozen to whichever program the
  // module happened to import — the third instance of that bug in these files.
  const WS_ORDER: WorkstreamKey[] = workstreamKeys(program);
  const seed = seedFor(program.id);
  const { linear, isLoading } = useStoredData(program.id);
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
        .filter((i) => ws === "all" || inferWorkstream(i, program) === ws)
        .filter((i) => owner === "all" || i.assignee === owner),
    [linear, ws, owner],
  );

  const blockers = useMemo(
    () =>
      // Blocked-or-urgent. Kept as two named predicates rather than one fused
      // condition so "blocked" means the same thing here as on the landing
      // page; the urgent arm is this page's own addition, stated as such.
      linear.filter((i) => isBlocked(i) || (isOpen(i) && i.priority === 1)),
    [linear],
  );

  const grouped = WS_ORDER.map((k) => ({
    ws: k,
    items: open.filter((i) => inferWorkstream(i, program) === k),
  })).filter((g) => g.items.length > 0);

  return (
    <AppLayout>
      <PageHeader
        title="Dependency map"
        subtitle="Open Linear work grouped by workstream. Blockers pinned below."
      />
      <SectionTabs group="work" />
      <div
        className="flex flex-wrap items-center gap-3 px-6 py-3"
        style={{ borderBottom: "1px solid #dfe1e2", backgroundColor: "#f0f0f0" }}
      >
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "#3a5a40" }}
        >
          Workstream
        </span>
        <select
          value={ws}
          onChange={(e) => setWs(e.target.value as WorkstreamKey | "all")}
          className="rounded border px-2 py-1 text-xs"
          style={{ borderColor: "#a9aeb1" }}
        >
          <option value="all">All workstreams</option>
          {WS_ORDER.map((k) => (
            <option key={k} value={k}>
              {workstreamOf(k, program).label}
            </option>
          ))}
        </select>
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "#3a5a40" }}
        >
          Assignee
        </span>
        <select
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className="rounded border px-2 py-1 text-xs"
          style={{ borderColor: "#a9aeb1" }}
        >
          <option value="all">All</option>
          {allOwners.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs" style={{ color: "#565c65" }}>
          {open.length} open issues
        </span>
      </div>

      {isLoading ? (
        <div className="p-6 text-[13px]" style={{ color: "#565c65" }}>
          Loading live data…
        </div>
      ) : (
        <div className="p-6 space-y-6">
          {/* Blockers pinned */}
          <section
            className="overflow-hidden rounded-xl"
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #f1c9c4",
              boxShadow:
                "0 1px 2px rgba(179, 38, 30, 0.06), 0 12px 28px -14px rgba(179, 38, 30, 0.22)",
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{
                borderBottom: "1px solid #f1c9c4",
                background: "linear-gradient(180deg, #fff5f4 0%, #fdeceb 100%)",
              }}
            >
              <h2 className="text-sm font-semibold" style={{ color: "#b3261e" }}>
                Blockers &amp; urgent · {blockers.length}
              </h2>
              <span className="text-xs" style={{ color: "#565c65" }}>
                Titles/labels containing "block" or priority = Urgent
              </span>
            </div>
            {blockers.length === 0 ? (
              <div className="p-4 text-center text-xs" style={{ color: "#565c65" }}>
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
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #dfe1e2",
              boxShadow:
                "0 1px 2px rgba(17, 47, 78, 0.04), 0 12px 28px -14px rgba(17, 47, 78, 0.18)",
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{
                borderBottom: "1px solid #dfe1e2",
                background: "linear-gradient(180deg, #f5f8fc 0%, #eef2f7 100%)",
              }}
            >
              <h2 className="text-sm font-semibold" style={{ color: "#3a5a40" }}>
                Cross-workstream dependencies · {seed.crossDeps.length}
              </h2>
              <span className="text-xs" style={{ color: "#565c65" }}>
                From Mon 7/13 cross-functional sync
              </span>
            </div>
            <ul className="divide-y" style={{ borderColor: "#eef1f4" }}>
              {seed.crossDeps.map((d) => (
                <li key={d.id} className="px-5 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-[13px] font-medium" style={{ color: "#1b1b1b" }}>
                      <span className="mr-2 font-mono text-xs" style={{ color: "#565c65" }}>
                        {d.from} → {d.to}
                      </span>
                      {d.title}
                    </div>
                    <span
                      className="rounded px-1.5 py-0.5 text-xs font-semibold uppercase"
                      style={{
                        color: HEALTH_COLOR[d.severity],
                        backgroundColor: `${HEALTH_COLOR[d.severity]}14`,
                        border: `1px solid ${HEALTH_COLOR[d.severity]}44`,
                      }}
                    >
                      {HEALTH_LABEL[d.severity]}
                    </span>
                  </div>
                  <div className="mt-1 text-xs" style={{ color: "#3d3d3d" }}>
                    {d.detail}
                  </div>
                  <div
                    className="mt-1 flex flex-wrap gap-3 text-xs"
                    style={{ color: "#565c65" }}
                  >
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
                  boxShadow:
                    "0 1px 2px rgba(17, 47, 78, 0.04), 0 8px 24px -12px rgba(17, 47, 78, 0.12)",
                }}
              >
                <div className="mb-4 flex items-baseline justify-between">
                  <h2
                    className="text-sm font-semibold"
                    style={{ color: "#3a5a40", fontFamily: "Public Sans, system-ui, sans-serif" }}
                  >
                    {workstreamOf(g.ws, program).label}
                  </h2>
                  <span className="text-xs" style={{ color: "#565c65" }}>
                    {g.items.length} open
                  </span>
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
  const program = useProgram();
  const ws = inferWorkstream(issue, program) as WorkstreamKey;
  return (
    <li
      className="rounded bg-white p-2.5"
      style={{
        border: "1px solid #eee",
        borderLeft: `3px solid ${workstreamOf(ws, program).color}`,
      }}
    >
      <div className="flex items-baseline gap-2">
        <a
          href={issue.url ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs underline"
          style={{ color: "#565c65" }}
        >
          {issue.identifier}
        </a>
        <span className="text-[13px] font-medium">{issue.title}</span>
      </div>
      <div
        className="mt-1 flex flex-wrap items-center gap-2 text-xs"
        style={{ color: "#565c65" }}
      >
        <WsTag ws={ws} />
        <span>{issue.assignee ?? "unassigned"}</span>
        <span>· {issue.state_name ?? "—"}</span>
        <span
          className="rounded px-1 py-0.5 font-semibold uppercase"
          style={{
            color: priorityColor(issue.priority),
            backgroundColor: `${priorityColor(issue.priority)}14`,
            border: `1px solid ${priorityColor(issue.priority)}44`,
          }}
        >
          {priorityLabel(issue.priority)}
        </span>
        <span className="ml-auto">{relativeTime(issue.source_updated_at)}</span>
      </div>
    </li>
  );
}
