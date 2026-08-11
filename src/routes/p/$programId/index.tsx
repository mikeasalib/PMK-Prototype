import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { UrgencyDot } from "@/components/va-ui";
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
              <>
                <ul className="divide-y" style={{ borderColor: "#f0f0ec" }}>
                  {active.slice(0, NOW_LIST_CAP).map((i) => (
                    <IssueRow key={i.id} issue={i} />
                  ))}
                </ul>
                <MoreLink count={active.length - NOW_LIST_CAP} programId={program.id} />
              </>
            )}
          </Panel>

          {/* High priority */}
          <Panel title={`Needs attention — high priority (${urgent.length})`} accent="#b3261e">
            {urgent.length === 0 ? (
              <Empty text="No open Urgent or High priority issues." />
            ) : (
              <>
                <ul className="divide-y" style={{ borderColor: "#f0f0ec" }}>
                  {urgent.slice(0, NOW_LIST_CAP).map((i) => (
                    <IssueRow key={i.id} issue={i} showPriority />
                  ))}
                </ul>
                <MoreLink count={urgent.length - NOW_LIST_CAP} programId={program.id} />
              </>
            )}
          </Panel>

          {/* Blockers */}
          <Panel title={`Blockers flagged (${blocked.length})`} accent="#8a5a00">
            {blocked.length === 0 ? (
              <Empty text="No issues currently labeled or titled as blockers." />
            ) : (
              <>
                <ul className="divide-y" style={{ borderColor: "#f0f0ec" }}>
                  {blocked.slice(0, NOW_LIST_CAP).map((i) => (
                    <IssueRow key={i.id} issue={i} />
                  ))}
                </ul>
                <MoreLink count={blocked.length - NOW_LIST_CAP} programId={program.id} />
              </>
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

/**
 * One line, not two.
 *
 * Was a two-line block carrying a coloured workstream badge, a priority pill, an
 * assignee and a timestamp. On a landing page whose job is "what should I look
 * at", that is four attributes competing with the title. Title leads; the rest
 * is one muted line's worth of context, and urgency is the single accent.
 */
/**
 * Rows per panel on the landing page.
 *
 * Five, because this page answers "what should I look at" and Work answers
 * "show me everything". Sixteen in-progress rows and nineteen high-priority
 * rows — which overlap heavily, an urgent in-progress ticket appearing in both —
 * made the landing page a third inventory of the same board.
 */
const NOW_LIST_CAP = 5;

/** "+N more" through to Work, where the full list lives behind a scope. */
function MoreLink({ count, programId }: { count: number; programId: string }) {
  if (count <= 0) return null;
  return (
    <Link
      to="/p/$programId/team-tasks"
      params={{ programId }}
      className="mt-2 inline-block text-xs font-medium"
      style={{ color: "#3a5a40" }}
    >
      +{count} more in Work →
    </Link>
  );
}

function IssueRow({ issue, showPriority }: { issue: StoredLinearIssue; showPriority?: boolean }) {
  const program = useProgram();
  const ws = inferWorkstream(issue, program);
  return (
    <li className="flex items-start gap-2 py-1.5">
      <UrgencyDot priority={issue.priority} />
      <div className="min-w-0 flex-1">
        <a
          href={issue.url ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="text-[13px] font-medium hover:underline"
          style={{ color: "#1b1b1b" }}
          title={`${issue.identifier} · ${ws} · ${issue.state_name ?? ""}`}
        >
          {issue.title}
        </a>
        <div className="text-xs" style={{ color: "#8a8a80" }}>
          {[issue.identifier, ws, issue.assignee ?? "unassigned"].join(" · ")}
        </div>
      </div>
    </li>
  );
}
