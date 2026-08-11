import { createFileRoute } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import {
  useStoredData,
  bucketOf,
  priorityLabel,
  priorityColor,
  inferWorkstream,
  isBlocked,
  isHighPriority,
  byPriority,
  type StoredLinearIssue,
} from "@/hooks/use-stored-data";
import { relativeTime } from "@/hooks/use-program-data";
import { PROGRAMS, pageTitle, workstreamOf } from "@/lib/program.config";
import { daysUntilLocal, shortDate } from "@/lib/local-date";
import { useProgram } from "./route";

export const Route = createFileRoute("/p/$programId/")({
  head: ({ params }) => ({
    meta: [
      { title: pageTitle("What's important", PROGRAMS[params.programId]) },
      {
        name: "description",
        content: `Top hits of what is happening right now on the ${PROGRAMS[params.programId].domainLabel} program.`,
      },
    ],
  }),
  component: WhatsImportant,
});

// Local-calendar arithmetic — see lib/local-date.ts for why UTC parsing showed
// the Ventura launch as Nov 30.
const daysUntil = daysUntilLocal;

function WhatsImportant() {
  const program = useProgram();
  const { linear, isLoading, origin } = useStoredData(program.id);

  const active = linear.filter((i) => bucketOf(i) === "in_progress");
  // Shared predicates, so this page and the dependency map cannot disagree
  // about what "blocked" means. They previously did: this list counted closed
  // blockers, the dependency map did not.
  const blocked = linear.filter(isBlocked);
  const urgent = linear.filter(isHighPriority).sort(byPriority);

  const doneCount = linear.filter((i) => bucketOf(i) === "done").length;
  const totalTracked = linear.filter((i) => bucketOf(i) !== "canceled").length;
  // Derived per render from the URL's program. Was a module-level constant, which
  // froze one program's launch date at import time.
  const daysToLaunch = Math.max(0, daysUntilLocal(program.keyDates.launch));

  return (
    <AppLayout>
      <PageHeader
        title="What's important"
        subtitle={
          // Do not claim "live" when the rows came from a capture. The origin is
          // known, so say which.
          origin === "snapshot"
            ? "The top hits of ongoing work — from a captured snapshot, not a live read."
            : "The top hits of ongoing work — live from Linear, Notion, and Granola."
        }
      />

      {/* Headline KPIs */}
      <div
        className="grid grid-cols-2 gap-3 px-4 py-4 sm:px-6 md:grid-cols-4"
        style={{ borderBottom: "1px solid #dfe1e2", backgroundColor: "#f7f7f5" }}
      >
        <Kpi
          label="Days to launch"
          value={String(daysToLaunch)}
          sub={program.keyDates.launchLabel}
          danger={daysToLaunch < 120}
        />
        <Kpi label="In progress" value={String(active.length)} sub={`of ${totalTracked} tracked`} />
        <Kpi label="Completed" value={String(doneCount)} sub="issues closed" />
        <Kpi
          label="High priority open"
          value={String(urgent.length)}
          sub="Urgent + High"
          danger={urgent.length > 5}
        />
      </div>

      {isLoading ? (
        <div className="p-6 text-[13px]" style={{ color: "#565c65" }}>
          Loading live data…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-2">
          {/* Active work */}
          <Panel title={`Active right now (${active.length})`} accent="#005ea2">
            {active.length === 0 ? (
              <Empty text="Nothing currently marked In Progress in Linear." />
            ) : (
              <ul className="divide-y" style={{ borderColor: "#eee" }}>
                {active.map((i) => (
                  <IssueRow key={i.id} issue={i} />
                ))}
              </ul>
            )}
          </Panel>

          {/* High priority */}
          <Panel title={`Needs attention — high priority (${urgent.length})`} accent="#b3261e">
            {urgent.length === 0 ? (
              <Empty text="No open Urgent or High priority issues." />
            ) : (
              <ul className="divide-y" style={{ borderColor: "#eee" }}>
                {urgent.slice(0, 8).map((i) => (
                  <IssueRow key={i.id} issue={i} showPriority />
                ))}
              </ul>
            )}
          </Panel>

          {/* Blockers */}
          <Panel title={`Blockers flagged (${blocked.length})`} accent="#8a5a00">
            {blocked.length === 0 ? (
              <Empty text="No issues currently labeled or titled as blockers." />
            ) : (
              <ul className="divide-y" style={{ borderColor: "#eee" }}>
                {blocked.map((i) => (
                  <IssueRow key={i.id} issue={i} />
                ))}
              </ul>
            )}
          </Panel>

        </div>
      )}
    </AppLayout>
  );
}

function Kpi({
  label,
  value,
  sub,
  danger,
}: {
  label: string;
  value: string;
  sub: string;
  danger?: boolean;
}) {
  return (
    <div
      className="rounded-md bg-white px-3 py-2"
      style={{
        border: "1px solid #e5e5e2",
        borderLeft: `3px solid ${danger ? "#b3261e" : "#005ea2"}`,
      }}
    >
      <div className="text-xs uppercase tracking-wide" style={{ color: "#565c65" }}>
        {label}
      </div>
      <div
        className="text-2xl font-bold"
        style={{
          fontFamily: "Public Sans, system-ui, sans-serif",
          color: danger ? "#b3261e" : "#3a5a40",
        }}
      >
        {value}
      </div>
      <div className="text-xs" style={{ color: "#565c65" }}>
        {sub}
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
  accent,
}: {
  title: string;
  children: React.ReactNode;
  accent: string;
}) {
  return (
    <section
      className="rounded-md bg-white"
      style={{ border: "1px solid #e5e5e2", borderTop: `3px solid ${accent}` }}
    >
      <div
        className="px-3 py-2 text-xs font-semibold"
        style={{
          color: "#3a5a40",
          borderBottom: "1px solid #eee",
          fontFamily: "Public Sans, system-ui, sans-serif",
        }}
      >
        {title}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="py-4 text-center text-xs" style={{ color: "#565c65" }}>
      {text}
    </div>
  );
}

function IssueRow({ issue, showPriority }: { issue: StoredLinearIssue; showPriority?: boolean }) {
  const program = useProgram();
  const ws = inferWorkstream(issue, program);
  const wsColor = workstreamOf(ws, program).color;
  return (
    <li className="py-2">
      <div className="flex items-baseline gap-2">
        <a
          href={issue.url ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs underline"
          style={{ color: "#005ea2" }}
        >
          {issue.identifier}
        </a>
        <span className="text-[13px] font-medium">{issue.title}</span>
      </div>
      <div
        className="mt-1 flex flex-wrap items-center gap-2 text-xs"
        style={{ color: "#565c65" }}
      >
        <span
          className="rounded px-1.5 py-0.5 font-semibold"
          style={{
            color: wsColor,
            backgroundColor: `${wsColor}14`,
            border: `1px solid ${wsColor}33`,
          }}
        >
          {ws}
        </span>
        <span>{issue.assignee ?? "unassigned"}</span>
        <span>· {issue.state_name ?? "—"}</span>
        {showPriority ? (
          <span
            className="rounded px-1 py-0.5 font-semibold"
            style={{
              color: priorityColor(issue.priority),
              backgroundColor: `${priorityColor(issue.priority)}14`,
              border: `1px solid ${priorityColor(issue.priority)}44`,
            }}
          >
            {priorityLabel(issue.priority)}
          </span>
        ) : null}
        <span className="ml-auto">{relativeTime(issue.source_updated_at)}</span>
      </div>
    </li>
  );
}
