import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { WsPip } from "@/components/va-ui";
import type { WorkstreamKey } from "@/lib/va-data";
import { useStoredData, bucketOf, inferWorkstream } from "@/hooks/use-stored-data";
import { HEALTH_COLOR, HEALTH_LABEL } from "@/lib/workstream-updates";
import {
  PROGRAMS,
  pageTitle,
  workstreamKeys,
  workstreamOf,
  type ProgramConfig,
} from "@/lib/program.config";
import { daysUntilLocal } from "@/lib/local-date";
import { seedFor } from "@/lib/program-seed";
import { useFollowUps } from "@/hooks/use-follow-ups";
import { useProgram } from "./route";

export const Route = createFileRoute("/p/$programId/program-overview")({
  head: ({ params }) => ({
    meta: [
      { title: pageTitle("Program overview", PROGRAMS[params.programId]) },
      {
        name: "description",
        content: `${PROGRAMS[params.programId].domainLabel} program status — milestones, sprint progress, workstream burn-down.`,
      },
    ],
  }),
  component: Overview,
});

// Was already parsing parts locally, but rounding from "now" rather than from
// midnight, so the number changed during the day. Shared helper does both.
const daysFromNow = daysUntilLocal;

function Overview() {
  const program = useProgram();
  const seed = seedFor(program.id);
  const { linear, isLoading, origin } = useStoredData(program.id);
  // Per-program, from the URL. Was a module-level constant.
  const SPRINT_MILESTONES = program.sprintStrip;

  const now = new Date().toISOString();
  const activeSprint =
    SPRINT_MILESTONES.find((s) => s.start <= now.slice(0, 10) && now.slice(0, 10) <= s.end) ??
    SPRINT_MILESTONES[0];

  const total = linear.filter((i) => bucketOf(i) !== "canceled").length;
  const done = linear.filter((i) => bucketOf(i) === "done").length;
  const inProgress = linear.filter((i) => bucketOf(i) === "in_progress").length;
  const todo = linear.filter((i) => bucketOf(i) === "todo").length;
  const backlog = linear.filter((i) => bucketOf(i) === "backlog").length;
  const pctDone = total ? Math.round((done / total) * 100) : 0;

  const wsKeys: WorkstreamKey[] = workstreamKeys(program);
  const wsRows = wsKeys.map((ws) => {
    const items = linear.filter((i) => inferWorkstream(i, program) === ws);
    return {
      ws,
      done: items.filter((i) => bucketOf(i) === "done").length,
      inProgress: items.filter((i) => bucketOf(i) === "in_progress").length,
      todo: items.filter((i) => bucketOf(i) === "todo").length,
      backlog: items.filter((i) => bucketOf(i) === "backlog").length,
      total: items.length,
    };
  });

  return (
    <AppLayout>
      <PageHeader
        title="Program overview"
        subtitle={[
          program.domainLabel,
          // Ventura has no contract number; printing "Contract null" was the
          // other half of this line being wrong.
          program.contract.displayNumber ? `Contract ${program.contract.displayNumber}` : null,
          origin === "snapshot" ? "captured snapshot" : "live from Linear",
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      {/* Milestone strip */}
      <div className="px-6 pt-5">
        <div className="flex overflow-hidden rounded" style={{ border: "1px solid #dfe1e2" }}>
          {SPRINT_MILESTONES.map((s) => {
            const isActive = s.key === activeSprint.key;
            const past = s.end < now.slice(0, 10);
            return (
              <div
                key={s.key}
                className="flex-1 px-3 py-2 text-[11px]"
                style={{
                  backgroundColor: isActive ? "#fff5c2" : past ? "#ecf3ec" : "#eef2f7",
                  color: "#3a5a40",
                  borderRight: "1px solid #dfe1e2",
                }}
              >
                <div className="font-mono text-[10px]" style={{ opacity: 0.65 }}>
                  {s.key}
                </div>
                <div
                  className="font-semibold"
                  style={{ fontFamily: "Public Sans, system-ui, sans-serif" }}
                >
                  {s.label}
                </div>
                <div className="text-[10px]" style={{ color: "#565c65" }}>
                  {s.start.slice(5)} – {s.end.slice(5)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="p-6 text-[13px]" style={{ color: "#565c65" }}>
          Loading live data…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-2">
          {/* Sprint status (real Linear data) */}
          <section
            className="rounded-md p-4"
            style={{ backgroundColor: "#f7f7f5", border: "1px solid #e5e5e2" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2
                className="text-sm font-semibold"
                style={{ color: "#3a5a40", fontFamily: "Public Sans, system-ui, sans-serif" }}
              >
                Current sprint — {activeSprint.label}
              </h2>
              <span className="text-[11px]" style={{ color: "#565c65" }}>
                {activeSprint.start.slice(5)} – {activeSprint.end.slice(5)}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Ring pct={pctDone} />
              <div className="text-[13px]">
                <div>
                  <b>{done}</b> done · <b>{inProgress}</b> in progress · <b>{todo}</b> todo ·{" "}
                  <b>{backlog}</b> backlog
                </div>
                <div style={{ color: "#565c65" }}>{total} issues in Linear (DEP)</div>
              </div>
            </div>
            <div
              className="mt-4 h-2 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: "#eee" }}
            >
              <div className="flex h-2">
                <span style={{ width: `${(done / total) * 100}%`, backgroundColor: "#2e8540" }} />
                <span
                  style={{ width: `${(inProgress / total) * 100}%`, backgroundColor: "#ffbe2e" }}
                />
                <span style={{ width: `${(todo / total) * 100}%`, backgroundColor: "#a3b8cc" }} />
                <span
                  style={{ width: `${(backlog / total) * 100}%`, backgroundColor: "#dfe1e2" }}
                />
              </div>
            </div>
          </section>

          {/* Next milestones */}
          <section
            className="rounded-md p-4"
            style={{ backgroundColor: "#f7f7f5", border: "1px solid #e5e5e2" }}
          >
            <h2
              className="mb-3 text-sm font-semibold"
              style={{ color: "#3a5a40", fontFamily: "Public Sans, system-ui, sans-serif" }}
            >
              Next milestones
            </h2>
            <div className="grid grid-cols-4 gap-3">
              <Milestone
                label={`${program.sprintStrip[0]?.label ?? "First milestone"} end`}
                date={activeSprint.end}
                days={daysFromNow(activeSprint.end)}
              />
              <Milestone
                label="Sprint 5 start"
                date={program.keyDates.nextSprintStart}
                days={daysFromNow(program.keyDates.nextSprintStart)}
              />
              <Milestone
                label="Code freeze"
                date={program.keyDates.codeFreeze}
                days={daysFromNow(program.keyDates.codeFreeze)}
              />
              <Milestone
                label="Public launch"
                date={program.keyDates.launch}
                days={daysFromNow(program.keyDates.launch)}
                danger
              />
            </div>
          </section>

          {/* Workstream burn-down */}
          <section
            className="lg:col-span-2 rounded-md py-4 pl-2 pr-4"
            style={{ backgroundColor: "#f7f7f5", border: "1px solid #e5e5e2" }}
          >
            <div className="mb-3 flex items-baseline justify-between">
              <h2
                className="text-sm font-semibold"
                style={{ color: "#3a5a40", fontFamily: "Public Sans, system-ui, sans-serif" }}
              >
                Workstream burn-down
              </h2>
              <span className="text-[11px]" style={{ color: "#565c65" }}>
                Linear tickets + program-truth signals ({seed.workstreamUpdatesSource?.date})
              </span>
            </div>
            <table className="w-full text-[12px]">
              <thead>
                <tr
                  className="text-left uppercase tracking-wide"
                  style={{ color: "#565c65", fontSize: 10 }}
                >
                  <th className="px-2 py-1 font-medium">Workstream</th>
                  <th className="px-2 py-1 font-medium">Health</th>
                  <th className="px-2 py-1 font-medium">Done</th>
                  <th className="px-2 py-1 font-medium">In Prog</th>
                  <th className="px-2 py-1 font-medium leading-tight">
                    <div>Todo +</div>
                    <div>Backlog</div>
                  </th>
                  <th className="px-2 py-1 font-medium">Total</th>
                  <th className="px-2 py-1 font-medium">Signals</th>
                  <th className="px-2 py-1 font-medium">Burn-down</th>
                </tr>
              </thead>
              <tbody>
                {wsRows.map((r) => {
                  const update = seed.workstreamUpdates.find((u) => u.ws === r.ws);
                  const progressCount = update?.progress.length ?? 0;
                  const openCount = (update?.risks.length ?? 0) + (update?.nextSteps.length ?? 0);
                  const linearRatio = r.total ? r.done / r.total : 0;
                  const signalRatio =
                    progressCount + openCount > 0 ? progressCount / (progressCount + openCount) : 0;
                  const blended =
                    r.total > 0
                      ? Math.round((linearRatio * 0.6 + signalRatio * 0.4) * 100)
                      : Math.round(signalRatio * 100);
                  const color = workstreamOf(r.ws, program).color;
                  const health = update?.health ?? "on_track";
                  return (
                    <tr key={r.ws} style={{ borderTop: "1px solid #eee" }}>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <WsPip ws={r.ws} />
                          <span>{workstreamOf(r.ws, program).label}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                          style={{
                            color: HEALTH_COLOR[health],
                            backgroundColor: `${HEALTH_COLOR[health]}14`,
                            border: `1px solid ${HEALTH_COLOR[health]}44`,
                          }}
                        >
                          {HEALTH_LABEL[health]}
                        </span>
                      </td>
                      <td className="px-2 py-2 font-mono">{r.done}</td>
                      <td className="px-2 py-2 font-mono">{r.inProgress}</td>
                      <td className="px-2 py-2 font-mono">{r.todo + r.backlog}</td>
                      <td className="px-2 py-2 font-mono">{r.total}</td>
                      <td className="px-2 py-2 font-mono text-[11px]">
                        <span title="Progress items logged" style={{ color: "#2e8540" }}>
                          {progressCount}▲
                        </span>{" "}
                        <span title="Open risks + next steps" style={{ color: "#b3261e" }}>
                          {openCount}●
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-1.5 w-24 rounded-full"
                            style={{ backgroundColor: "#eee" }}
                          >
                            <div
                              className="h-1.5 rounded-full"
                              style={{ width: `${blended}%`, backgroundColor: color }}
                            />
                          </div>
                          <span style={{ color: "#565c65" }}>{blended}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-2 text-[10px]" style={{ color: "#565c65" }}>
              Burn-down blends Linear ticket completion (60%) with logged program progress vs open
              risks/next-steps (40%). Signals: ▲ progress items logged · ● open risks + next steps.
            </div>
          </section>

          {/* Follow-ups summary. Replaces the old "Workstream quick-dive" (hand-
              authored VA narrative, empty for other programs) and "What's moving
              right now" (a re-list of in-progress issues already covered by
              What's Important and the sprint board). The command centre is more
              useful surfacing the sub-issue follow-ups caught between calls. */}
          <FollowUpsSummary program={program} />
        </div>
      )}
    </AppLayout>
  );
}

/**
 * The command-centre view of Follow-ups: the open items caught between calls,
 * with a count breakdown, inline "mark done" (so a forgotten to-do can be
 * cleared without leaving the overview), and a link to the full page. Reads the
 * same per-program curation as the Follow-ups route, so a done here shows there.
 */
function FollowUpsSummary({ program }: { program: ProgramConfig }) {
  const { hydrated, buckets, setStatus } = useFollowUps(program.id);
  const open = buckets.open;
  const weOwe = open.filter((i) => i.direction === "we-owe").length;
  const theyOwe = open.filter((i) => i.direction === "they-owe").length;
  const todo = open.filter((i) => i.direction === null).length;
  const top = open.slice(0, 6);

  return (
    <section
      className="lg:col-span-2 rounded-md p-4"
      style={{ backgroundColor: "#f7f7f5", border: "1px solid #e5e5e2" }}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h2
          className="text-sm font-semibold"
          style={{ color: "#3a5a40", fontFamily: "Public Sans, system-ui, sans-serif" }}
        >
          Follow-ups{hydrated ? ` · ${open.length} open` : ""}
        </h2>
        <Link
          to="/p/$programId/follow-ups"
          params={{ programId: program.id }}
          className="text-[11px] underline"
          style={{ color: "#2e5d3a" }}
        >
          View all →
        </Link>
      </div>

      {!hydrated ? (
        <div className="text-[12px]" style={{ color: "#8a8a80" }}>
          Loading…
        </div>
      ) : open.length === 0 ? (
        <div className="text-[12px]" style={{ color: "#565c65" }}>
          Nothing open — all follow-ups are done or dismissed.
        </div>
      ) : (
        <>
          <div
            className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px]"
            style={{ color: "#565c65" }}
          >
            {weOwe ? (
              <span>
                <b style={{ color: "#1b1b1b" }}>{weOwe}</b> we owe
              </span>
            ) : null}
            {theyOwe ? (
              <span>
                <b style={{ color: "#1b1b1b" }}>{theyOwe}</b> they owe
              </span>
            ) : null}
            {todo ? (
              <span>
                <b style={{ color: "#1b1b1b" }}>{todo}</b> to do
              </span>
            ) : null}
          </div>
          <ul className="space-y-1.5">
            {top.map((item) => (
              <li key={item.id} className="flex items-start gap-2.5">
                <button
                  type="button"
                  aria-label="Mark done"
                  onClick={() => setStatus(item.id, "done")}
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors hover:bg-[#eef3ee]"
                  style={{ borderColor: "#c9c9c2", backgroundColor: "#ffffff" }}
                >
                  <Check size={11} strokeWidth={3} style={{ opacity: 0 }} />
                </button>
                <span className="min-w-0 flex-1 text-[12px]" style={{ color: "#1b1b1b" }}>
                  {item.title}
                  {item.owner ? <span style={{ color: "#8a8a80" }}> · {item.owner}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          {open.length > top.length ? (
            <div className="mt-2 text-[11px]" style={{ color: "#8a8a80" }}>
              +{open.length - top.length} more
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <svg width="70" height="70" viewBox="0 0 70 70">
      <circle cx="35" cy="35" r={r} fill="none" stroke="#e5e5e2" strokeWidth="6" />
      <circle
        cx="35"
        cy="35"
        r={r}
        fill="none"
        stroke="#1a6fa8"
        strokeWidth="6"
        strokeDasharray={c}
        strokeDashoffset={off}
        transform="rotate(-90 35 35)"
        strokeLinecap="round"
      />
      <text x="35" y="39" textAnchor="middle" fontSize="13" fontWeight="600" fill="#1a1a1a">
        {pct}%
      </text>
    </svg>
  );
}

function Milestone({
  label,
  date,
  days,
  danger,
}: {
  label: string;
  date: string;
  days: number;
  danger?: boolean;
}) {
  return (
    <div
      className="rounded-md bg-white p-3"
      style={{ border: `1px solid ${danger ? "#b3261e55" : "#e5e5e2"}` }}
    >
      <div className="text-[11px] uppercase tracking-wide" style={{ color: "#565c65" }}>
        {label}
      </div>
      <div
        className="mt-1 text-2xl font-semibold"
        style={{ color: danger ? "#b3261e" : "#1a1a1a" }}
      >
        {Math.max(0, days)}
        <span className="ml-1 text-[11px] font-normal" style={{ color: "#565c65" }}>
          days
        </span>
      </div>
      <div className="text-[11px]" style={{ color: "#565c65" }}>
        {(() => {
          const [y, m, d] = date.split("-").map(Number);
          return new Date(y, m - 1, d).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
        })()}
      </div>
    </div>
  );
}
