import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { SectionTabs } from "@/components/SectionTabs";
import { WsPip } from "@/components/va-ui";
import type { WorkstreamKey } from "@/lib/va-data";
import { useStoredData, bucketOf } from "@/hooks/use-stored-data";
import { HEALTH_COLOR, HEALTH_LABEL } from "@/lib/workstream-updates";
import {
  PROGRAMS,
  classifyWorkstreamDetailed,
  pageTitle,
  upcomingMilestones,
  workstreamKeys,
  workstreamOf,
  type ProgramConfig,
} from "@/lib/program.config";
import { daysUntilLocal } from "@/lib/local-date";
import { seedFor } from "@/lib/program-seed";
import {
  phasesFromLifecycle,
  upcomingGateReadiness,
  upcomingSprintGates,
  deriveHealth,
  sittingUntouched,
  recentlyClosed,
  AGING_THRESHOLD_DAYS,
  RECENTLY_CLOSED_WINDOW_DAYS,
  type StalledItem,
  type ClosedItem,
  type SprintGate,
} from "@/lib/program-model.adapters";
import type { GateReadiness, PhaseRecord } from "@/lib/program-model";
import { useFollowUps } from "@/hooks/use-follow-ups";
import { useNotionTasks } from "@/hooks/use-notion-tasks";
import { useProgram } from "./route";

export const Route = createFileRoute("/p/$programId/program-overview")({
  head: ({ params }) => ({
    meta: [
      { title: pageTitle("Command centre", PROGRAMS[params.programId]) },
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

  const todayIso = now.slice(0, 10);

  // Attribute each issue once, keeping the basis. "stored" or "explicit" mean
  // the source said which workstream this belongs to; "keyword"/"fallback" mean
  // the classifier guessed from the title. Health is only as good as bucketing,
  // so the burn-down needs to say when a row is mostly inference.
  const attributed = linear.map((i) => {
    const a = classifyWorkstreamDetailed(i.title, i.workstream, program);
    return { i, ws: a.workstream, basis: a.basis };
  });

  const wsKeys: WorkstreamKey[] = workstreamKeys(program);
  const wsRows = wsKeys.map((ws) => {
    const rows = attributed.filter((a) => a.ws === ws);
    const items = rows.map((r) => r.i);
    const inferredCount = rows.filter(
      (r) => r.basis === "keyword" || r.basis === "fallback",
    ).length;
    return {
      ws,
      done: items.filter((i) => bucketOf(i) === "done").length,
      inProgress: items.filter((i) => bucketOf(i) === "in_progress").length,
      todo: items.filter((i) => bucketOf(i) === "todo").length,
      backlog: items.filter((i) => bucketOf(i) === "backlog").length,
      total: items.length,
      // Health derived from real signals, not a hand-typed field.
      health: deriveHealth(
        items.map((i) => ({
          bucket: bucketOf(i),
          title: i.title,
          labels: i.labels ?? [],
          priority: i.priority,
          dueDate: i.due_date ?? null,
        })),
        todayIso,
      ),
      inferredPct: items.length ? Math.round((inferredCount / items.length) * 100) : 0,
    };
  });

  // Lifecycle phases and gate readiness. Both empty on a program with no phase
  // config; the panels below handle that by hiding themselves.
  const phases = phasesFromLifecycle(program, todayIso);
  const currentPhase = phases.find((p) => p.state === "in_progress") ?? null;
  const blockerInputs = linear.map((i) => ({
    bucket: bucketOf(i),
    title: i.title,
    labels: i.labels ?? [],
  }));
  const gates = upcomingGateReadiness(phases, blockerInputs, { asOf: todayIso, program });
  // Sprint gates when the program's plan states one per sprint; phase gates
  // otherwise. VA has both — the sprint gates are the plan of record and are
  // concrete, so they win. Ventura has only phase exit criteria, from the
  // playbook, and keeps using those.
  const sprintGates = upcomingSprintGates(program, blockerInputs, todayIso);

  // Aging candidates share a shape between the two panels — build once.
  const agingCandidates = linear.map((i) => ({
    identifier: i.identifier,
    title: i.title,
    bucket: bucketOf(i),
    updatedAt: i.source_updated_at,
    assignee: i.assignee,
    priority: i.priority,
    workstream: classifyWorkstreamDetailed(i.title, i.workstream, program).workstream,
    url: i.url,
  }));
  const stalled: StalledItem[] = sittingUntouched(agingCandidates, todayIso);
  const closed: ClosedItem[] = recentlyClosed(agingCandidates, todayIso);

  // What the top-left "current" panel means depends on how the program keeps
  // time. Declared per-program in program.timeAxis so the choice is explicit
  // instead of inferred from another field.
  const usesPhases = program.timeAxis === "phase";

  return (
    <AppLayout>
      <PageHeader
        title="Command centre"
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
      <SectionTabs group="plan" />

      {/* Milestone strip */}
      <div className="px-4 pt-5 sm:px-6">
        <div
          className="flex overflow-x-auto rounded"
          style={{ border: "1px solid #dfe1e2" }}
        >
          {SPRINT_MILESTONES.map((s) => {
            const isActive = s.key === activeSprint.key;
            const past = s.end < now.slice(0, 10);
            return (
              <div
                key={s.key}
                className="min-w-[116px] flex-1 px-3 py-2 text-xs"
                style={{
                  backgroundColor: isActive ? "#fff5c2" : past ? "#ecf3ec" : "#eef2f7",
                  color: "#3a5a40",
                  borderRight: "1px solid #dfe1e2",
                }}
                // Focus and gate come from the program's plan of record. On the
                // strip they are a tooltip; the active sprint prints its focus
                // and gate in full below, since that is the one you are in.
                title={[s.focus, s.gate ? `Gate: ${s.gate}` : null].filter(Boolean).join(" — ")}
              >
                <div className="font-mono text-xs" style={{ opacity: 0.65 }}>
                  {s.key}
                </div>
                <div
                  className="font-semibold"
                  style={{ fontFamily: "Public Sans, system-ui, sans-serif" }}
                >
                  {s.label}
                </div>
                <div className="text-xs" style={{ color: "#565c65" }}>
                  {s.start.slice(5)} – {s.end.slice(5)}
                </div>
              </div>
            );
          })}
        </div>
        {activeSprint.focus || activeSprint.gate ? (
          <div className="mt-2 text-xs" style={{ color: "#565c65" }}>
            {activeSprint.focus ? (
              <span style={{ color: "#1b1b1b" }}>{activeSprint.focus}</span>
            ) : null}
            {activeSprint.focus && activeSprint.gate ? " · " : ""}
            {activeSprint.gate ? <>To advance: {activeSprint.gate}</> : null}
          </div>
        ) : null}
      </div>

      {/* What's at risk — gate readiness, worst first. The "asteroid coming at
          us" signal from the readout: already computed for the rollup, now on
          the command centre so it is visible during the day. */}
      {!isLoading && sprintGates.length > 0 ? (
        <div className="px-4 pt-4 sm:px-6">
          <SprintGatePanel gates={sprintGates} />
        </div>
      ) : !isLoading && gates.length > 0 ? (
        <div className="px-4 pt-4 sm:px-6">
          <GateReadinessPanel gates={gates} />
        </div>
      ) : null}

      {/* Follow-ups sit above the fold because the sub-issue tasks caught
          between calls are the most action-shaped signal on this page —
          promoted above "No recent updates" per the strategist's own steer. */}
      {!isLoading ? (
        <div className="px-4 pt-4 sm:px-6">
          <FollowUpsSummary program={program} />
        </div>
      ) : null}

      {/* Notion tracker summary. The command centre reported open work off the
          Linear board alone, which on VA is roughly a third of what is actually
          in flight — the hand-maintained tracker carries the rest. */}
      <div className="px-4 pt-4 sm:px-6">
        <NotionTrackerSummary program={program} />
      </div>

      {isLoading ? (
        <div className="p-6 text-[13px]" style={{ color: "#565c65" }}>
          Loading live data…
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-2">
          {/* Current sprint / current phase — same slot, different concept per
              program.timeAxis. VA keeps its sprint framing; a rec deployment
              shows the current lifecycle phase from the playbook instead. */}
          <section
            className="rounded-md p-4"
            style={{ backgroundColor: "#f7f7f5", border: "1px solid #e5e5e2" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2
                className="text-sm font-semibold"
                style={{ color: "#3a5a40", fontFamily: "Public Sans, system-ui, sans-serif" }}
              >
                {usesPhases
                  ? `Current phase — ${currentPhase?.name ?? "post-launch"}`
                  : `Current sprint — ${activeSprint.label}`}
              </h2>
              <span className="text-xs" style={{ color: "#565c65" }}>
                {usesPhases
                  ? currentPhase
                    ? currentPhase.window
                    : "Live customer handoff"
                  : `${activeSprint.start.slice(5)} – ${activeSprint.end.slice(5)}`}
              </span>
            </div>
            {usesPhases ? (
              <PhaseProgress phases={phases} currentPhase={currentPhase} />
            ) : (
              <>
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
                    <span
                      style={{ width: `${(done / total) * 100}%`, backgroundColor: "#2e8540" }}
                    />
                    <span
                      style={{
                        width: `${(inProgress / total) * 100}%`,
                        backgroundColor: "#ffbe2e",
                      }}
                    />
                    <span
                      style={{ width: `${(todo / total) * 100}%`, backgroundColor: "#a3b8cc" }}
                    />
                    <span
                      style={{ width: `${(backlog / total) * 100}%`, backgroundColor: "#dfe1e2" }}
                    />
                  </div>
                </div>
              </>
            )}
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
            {/* Program-driven, from the same helper as the What's Important
                panel. Was four fixed slots labelled "Sprint 5 start" / "Code
                freeze" — VA wording that read wrong on a rec deployment. */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {upcomingMilestones(program, now.slice(0, 10)).map((m) => (
                <Milestone
                  key={`${m.label}-${m.date}`}
                  label={m.label}
                  date={m.date}
                  days={daysFromNow(m.date)}
                  danger={m.date === program.keyDates.launch}
                />
              ))}
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
              <span className="text-xs" style={{ color: "#565c65" }}>
                Health and completion derived from Linear
              </span>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr
                  className="text-left uppercase tracking-wide"
                  style={{ color: "#565c65", fontSize: 12 }}
                >
                  <th className="px-2 py-1 font-medium">Workstream</th>
                  <th className="px-2 py-1 font-medium">Health</th>
                  <th className="px-2 py-1 font-medium">Total</th>
                  <th className="px-2 py-1 font-medium">Complete</th>
                </tr>
              </thead>
              <tbody>
                {wsRows.map((r) => {
                  // Plain ticket completion. This was a blend of Linear
                  // completion (60%) and hand-logged progress-vs-risk signals
                  // (40%), which needed a formula footnote to read at all — and
                  // a number nobody can defend in a stakeholder meeting without
                  // reciting its weighting is not a number worth showing. The
                  // signals it blended in are on the Risks page, where they
                  // stand on their own.
                  const pctComplete = r.total ? Math.round((r.done / r.total) * 100) : 0;
                  const color = workstreamOf(r.ws, program).color;
                  return (
                    <tr key={r.ws} style={{ borderTop: "1px solid #eee" }}>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <WsPip ws={r.ws} />
                          <span>{workstreamOf(r.ws, program).label}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {r.health ? (
                            <span
                              className="rounded px-1.5 py-0.5 text-xs font-semibold uppercase"
                              style={{
                                color: HEALTH_COLOR[r.health],
                                backgroundColor: `${HEALTH_COLOR[r.health]}14`,
                                border: `1px solid ${HEALTH_COLOR[r.health]}44`,
                              }}
                            >
                              {HEALTH_LABEL[r.health]}
                            </span>
                          ) : (
                            <span style={{ color: "#a0a099" }}>—</span>
                          )}
                          {/* Attribution honesty. Health depends on bucketing;
                              when the bucketing is mostly keyword inference
                              (Ventura carries no stored workstream on any
                              issue), the health can only be as accurate as
                              those guesses, and the row says so. */}
                          {r.inferredPct >= 50 ? (
                            <span
                              className="rounded px-1 py-0.5 text-xs font-medium"
                              style={{
                                color: "#8a5a00",
                                backgroundColor: "#f2e6cf",
                                border: "1px solid #e0c98a",
                              }}
                              title={`${r.inferredPct}% of issues in this workstream were attributed by keyword from the title, not stored in Linear. Tag issues at source to firm this up.`}
                            >
                              {r.inferredPct}% inferred
                            </span>
                          ) : null}
                        </div>
                      </td>
                      {/* Total carries the per-bucket detail on hover rather
                          than as four separate columns. The split matters when
                          you are already asking about one workstream; as a
                          standing column it was width nobody read. */}
                      <td
                        className="px-2 py-2 font-mono"
                        title={`${r.done} done · ${r.inProgress} in progress · ${r.todo + r.backlog} todo or backlog`}
                      >
                        {r.total}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-1.5 w-24 rounded-full"
                            style={{ backgroundColor: "#eee" }}
                          >
                            <div
                              className="h-1.5 rounded-full"
                              style={{ width: `${pctComplete}%`, backgroundColor: color }}
                            />
                          </div>
                          <span style={{ color: "#565c65" }}>
                            {r.done}/{r.total}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
            <div className="mt-2 text-xs" style={{ color: "#565c65" }}>
              Complete is closed tickets over total tickets. Hover a total for the
              done / in-progress / remaining split.
            </div>
          </section>

          {/* Sitting-in-place, at the bottom of the grid: still visible during
              scan, but ranked below Follow-ups since those are the tasks a
              strategist can act on directly, while "no recent updates" is a
              symptom to investigate. */}
          {linear.length > 0 ? (
            <div className="lg:col-span-2">
              <SittingUntouchedPanel
                program={program}
                items={stalled}
                inProgressTotal={inProgress}
              />
            </div>
          ) : null}

          {/* Wins column, directly below No-recent-updates: the paired signal.
              A page with only "what's stalled" reads as bad news; showing what
              actually closed in the same window is honest and grounds the
              stall count against the pace of real completion. */}
          {linear.length > 0 ? (
            <div className="lg:col-span-2">
              <RecentlyClosedPanel program={program} items={closed} />
            </div>
          ) : null}
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
/**
 * Phase progress for a rec deployment: how far through the lifecycle the
 * program is (phases-complete-of-total), plus how much of the current phase's
 * window has elapsed. Not issue-completion — a rec board holds open commitments
 * that don't map to "sprint velocity", so borrowing the sprint ring for phases
 * would double-count things it shouldn't. A finished deployment (post-Launch,
 * in Live Customer Handoff) shows steady-state rather than a % done.
 */
function PhaseProgress({
  phases,
  currentPhase,
}: {
  phases: PhaseRecord[];
  currentPhase: PhaseRecord | null;
}) {
  const done = phases.filter((p) => p.state === "complete").length;
  const pct = phases.length ? Math.round((done / phases.length) * 100) : 0;

  return (
    <>
      <div className="flex items-center gap-4">
        <Ring pct={pct} />
        <div className="text-[13px]">
          <div>
            <b>{done}</b> of <b>{phases.length}</b> phases complete
          </div>
          <div style={{ color: "#565c65" }}>
            {currentPhase
              ? `Now in ${currentPhase.name.toLowerCase()} — ${currentPhase.goal}`
              : "Post-launch — steady operations, handoff to Customer Success"}
          </div>
        </div>
      </div>
      {currentPhase ? (
        <ul className="mt-4 space-y-1 text-xs">
          {currentPhase.exitCriteria.slice(0, 4).map((c) => (
            <li key={c} className="flex items-start gap-2" style={{ color: "#3d3d3d" }}>
              <span aria-hidden style={{ color: "#a0a099" }}>
                ▢
              </span>
              <span>{c}</span>
            </li>
          ))}
          {currentPhase.exitCriteria.length > 4 ? (
            <li className="text-xs" style={{ color: "#8a8a80" }}>
              +{currentPhase.exitCriteria.length - 4} more exit criteria
            </li>
          ) : null}
        </ul>
      ) : null}
    </>
  );
}

/** How the pressure score reads at a glance. Same thresholds as the rollup. */
function pressureBand(p: number): { label: string; color: string } {
  const pct = Math.round(p * 100);
  if (p >= 0.75) return { label: `${pct}% critical`, color: "#b3261e" };
  if (p >= 0.5) return { label: `${pct}% high`, color: "#bf6a02" };
  if (p >= 0.25) return { label: `${pct}% moderate`, color: "#8a5a00" };
  return { label: `${pct}% low`, color: "#2e8540" };
}

/**
 * Gate readiness across the open lifecycle phases, worst first. Pressure blends
 * time remaining, unmet exit criteria, and open blockers — so a gate that is
 * near, under-met, and blocked rises to the top. Blockers attach only to the
 * phase actually running; future gates carry none, and a footnote says why.
 */
/**
 * Gates as the plan states them, scored only on what is measurable.
 *
 * The phase panel this replaces on sprint-axis programs scored readiness partly
 * on exit criteria met, which no source populated — the value was a hardcoded
 * zero, so every row printed "not tracked yet" beside a percentage that was one
 * third driven by that constant. Here the gate is the plan's own sentence, and
 * the only computed inputs are days remaining and open blockers. A reader judges
 * readiness against the sentence rather than trusting a number nobody can
 * verify.
 */
function SprintGatePanel({ gates }: { gates: SprintGate[] }) {
  const top = gates.slice(0, 4);
  return (
    <section
      className="rounded-md p-4"
      style={{ backgroundColor: "#fff", border: "1px solid #e5e5e2" }}
    >
      <h2
        className="mb-3 text-sm font-semibold"
        style={{ color: "#3a5a40", fontFamily: "Public Sans, system-ui, sans-serif" }}
      >
        Gates to advance
      </h2>
      <div className="space-y-3">
        {top.map((g) => {
          const band = pressureBand(g.pressure);
          return (
            <div key={g.key} className="flex flex-col gap-1 md:flex-row md:items-start md:gap-3">
              <div className="shrink-0 md:w-24">
                <span className="text-xs font-semibold" style={{ color: "#1b1b1b" }}>
                  {g.label}
                </span>
                {g.isCurrent ? (
                  <span className="ml-1.5 text-xs" style={{ color: "#8a8a80" }}>
                    now
                  </span>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs" style={{ color: "#1b1b1b" }}>
                  {g.gate}
                </div>
                {g.focus ? (
                  <div className="mt-0.5 text-xs" style={{ color: "#8a8a80" }}>
                    {g.focus}
                  </div>
                ) : null}
              </div>
              <div className="shrink-0 text-xs md:w-40 md:text-right" style={{ color: "#565c65" }}>
                <span style={{ color: band.color, fontWeight: 600 }}>
                  {g.daysRemaining >= 0 ? `${g.daysRemaining}d left` : `${-g.daysRemaining}d past`}
                </span>
                {g.blockingWorkItems > 0 ? ` · ${g.blockingWorkItems} blocking` : ""}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-xs" style={{ color: "#8a8a80" }}>
        Gates as written in the delivery plan. Days-left and blocker counts are
        read from Linear; whether a gate is met is a judgement the plan does not
        track, so this does not claim to score it.
      </div>
    </section>
  );
}

function GateReadinessPanel({ gates }: { gates: GateReadiness[] }) {
  return (
    <section
      className="rounded-md p-4"
      style={{ backgroundColor: "#fff", border: "1px solid #e5e5e2" }}
    >
      <h2
        className="mb-3 text-sm font-semibold"
        style={{ color: "#3a5a40", fontFamily: "Public Sans, system-ui, sans-serif" }}
      >
        What's at risk — gate readiness
      </h2>
      <div className="space-y-2">
        {gates.map((g) => {
          const band = pressureBand(g.pressure);
          return (
            <div
              key={g.phaseId}
              className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-3"
            >
              <div className="truncate text-xs md:w-40 md:shrink-0" title={g.phaseName}>
                {g.phaseName}
              </div>
              <div
                className="h-2 flex-1 overflow-hidden rounded-full"
                style={{ backgroundColor: "#eee" }}
              >
                <div
                  className="h-2 rounded-full"
                  style={{ width: `${Math.round(g.pressure * 100)}%`, backgroundColor: band.color }}
                />
              </div>
              {/* Band + detail share a wrapped row below md; above it they
                  return to their own fixed columns via md:contents. */}
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 md:contents">
              <div
                className="shrink-0 text-xs font-semibold md:w-24 md:text-right"
                style={{ color: band.color }}
              >
                {band.label}
              </div>
              <div className="text-xs md:w-52 md:shrink-0" style={{ color: "#565c65" }}>
                {g.daysRemaining >= 0 ? `${g.daysRemaining}d out` : `${-g.daysRemaining}d overdue`}
                {/* Exit criteria are not individually tracked in any source yet,
                    so exitCriteriaMet is always 0. Labelled a placeholder in
                    place instead of showing a bare "0/5 met" that reads like a
                    measurement. */}
                <span
                  title="Exit criteria are not individually tracked in Linear or Notion yet — placeholder"
                  style={{ color: "#8a5a00" }}
                >
                  {" · not tracked yet"}
                </span>
                {g.blockingWorkItems > 0 ? ` · ${g.blockingWorkItems} blocking` : ""}
              </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-xs" style={{ color: "#8a8a80" }}>
        Pressure = time remaining × unmet exit criteria × open blockers. Blockers count against the
        phase now running; exit criteria are not individually tracked yet, so "0 met" reads as "not
        yet demonstrable," not "none done."
      </div>
    </section>
  );
}

/**
 * "Sitting untouched" — in-progress items with no source_updated_at movement in
 * the aging window. Present-tense, small, and lists items rather than
 * summarising, so the eye lands on which cards are stalled, not on a number.
 *
 * When nothing is stalled the panel renders a one-line "Nothing stalled" state
 * rather than hiding — the absence itself is worth reading, and hiding would
 * make it indistinguishable from "the signal isn't wired up." When there are
 * no in-progress items at all (a program that hasn't started work yet), the
 * panel does hide, because there is nothing coherent to say.
 */
function SittingUntouchedPanel({
  program,
  items,
  inProgressTotal,
}: {
  program: ProgramConfig;
  items: StalledItem[];
  inProgressTotal: number;
}) {
  if (inProgressTotal === 0) return null;
  const top = items.slice(0, 8);
  return (
    <section
      className="rounded-md p-4"
      style={{ backgroundColor: "#fff", border: "1px solid #e5e5e2" }}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h2
          className="text-sm font-semibold"
          style={{ color: "#3a5a40", fontFamily: "Public Sans, system-ui, sans-serif" }}
        >
          No recent updates — {items.length} of {inProgressTotal} in progress
        </h2>
        <Link
          to="/p/$programId/sprint-board"
          params={{ programId: program.id }}
          className="text-xs font-medium"
          style={{ color: "#3a5a40" }}
        >
          Sprint board →
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="text-xs" style={{ color: "#565c65" }}>
          Every in-progress item has been updated in the last {AGING_THRESHOLD_DAYS} days.
        </div>
      ) : (
        <div className="space-y-1.5">
          {top.map((i) => {
            const band = agingBand(i.severity);
            return (
              <div
                key={i.identifier}
                className="flex flex-col gap-1 text-xs md:flex-row md:items-center md:gap-3"
              >
                {/* Below md the fixed columns (id + chip + workstream +
                    assignee) summed past the available width and the title
                    flexed to zero. Meta wraps onto its own line instead. */}
                <div className="flex items-center gap-2 md:contents">
                  <div className="w-16 shrink-0 font-mono text-xs" style={{ color: "#565c65" }}>
                    {i.identifier}
                  </div>
                  <div
                    className="w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-semibold"
                    style={{ backgroundColor: band.bg, color: band.fg }}
                    title={`${i.daysSinceUpdate} days since Linear last saw a change on this issue (${i.severity})`}
                  >
                    {i.daysSinceUpdate}d
                  </div>
                </div>
                <div className="min-w-0 flex-1 truncate">
                  {i.url ? (
                    <a
                      href={i.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                      style={{ color: "#1b1b1b" }}
                    >
                      {i.title}
                    </a>
                  ) : (
                    i.title
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs md:contents">
                  <div
                    className="shrink-0 md:w-16 md:text-right"
                    style={{ color: "#565c65" }}
                  >
                    {i.workstream}
                  </div>
                  <div
                    className="min-w-0 truncate md:w-28 md:shrink-0 md:text-right"
                    style={{ color: "#565c65" }}
                    title={i.assignee ?? "Unassigned"}
                  >
                    {i.assignee ?? "—"}
                  </div>
                </div>
              </div>
            );
          })}
          {items.length > top.length ? (
            <div className="pt-1 text-xs" style={{ color: "#8a8a80" }}>
              +{items.length - top.length} more — see sprint board.
            </div>
          ) : null}
        </div>
      )}
      <div className="mt-2 text-xs" style={{ color: "#8a8a80" }}>
        Days since Linear last saw a change on the issue — any field, any
        comment. Not opened_at: an item created months ago but nudged this
        week does not count as stale.
      </div>
    </section>
  );
}

/** Colour bands mirroring the severity labels sittingUntouched attaches. Kept
 *  local to the panel because they're one screen's presentation choice, not a
 *  cross-page palette. */
/**
 * "Recently closed" — the paired signal to "No recent updates". Same window
 * as the aging function's threshold (14 days), so the two panels together
 * describe one two-week slice: what left the board vs what stopped moving.
 *
 * Canceled items are shown with a "dropped" tag rather than a "shipped" tag,
 * because a canceled ticket is a scope decision worth seeing but not a win.
 * Empty state renders as a one-liner — the absence of closures in a fortnight
 * is itself a signal, and hiding it would make quiet weeks indistinguishable
 * from a wired-up feed with nothing to say.
 */
function RecentlyClosedPanel({
  program,
  items,
}: {
  program: ProgramConfig;
  items: ClosedItem[];
}) {
  const top = items.slice(0, 10);
  return (
    <section
      className="rounded-md p-4"
      style={{ backgroundColor: "#fff", border: "1px solid #e5e5e2" }}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h2
          className="text-sm font-semibold"
          style={{ color: "#3a5a40", fontFamily: "Public Sans, system-ui, sans-serif" }}
        >
          Recently closed — {items.length} in the last {RECENTLY_CLOSED_WINDOW_DAYS} days
        </h2>
        <Link
          to="/p/$programId/activity"
          params={{ programId: program.id }}
          className="text-xs font-medium"
          style={{ color: "#3a5a40" }}
        >
          Activity feed →
        </Link>
      </div>
      {items.length === 0 ? (
        <div className="text-xs" style={{ color: "#565c65" }}>
          Nothing closed in the last {RECENTLY_CLOSED_WINDOW_DAYS} days.
        </div>
      ) : (
        <div className="space-y-1.5">
          {top.map((i) => {
            const dropped = i.bucket === "canceled";
            return (
              <div
                key={i.identifier}
                className="flex flex-col gap-1 text-xs md:flex-row md:items-center md:gap-3"
              >
                <div className="flex items-center gap-2 md:contents">
                <div className="w-16 shrink-0 font-mono text-xs" style={{ color: "#565c65" }}>
                  {i.identifier}
                </div>
                <div
                  className="w-16 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-semibold"
                  style={
                    dropped
                      ? { backgroundColor: "#eee", color: "#565c65" }
                      : { backgroundColor: "#dcecdd", color: "#1f5c2f" }
                  }
                  title={
                    dropped
                      ? `Canceled ${i.daysSinceClosed}d ago`
                      : `Closed ${i.daysSinceClosed}d ago`
                  }
                >
                  {dropped ? "dropped" : `${i.daysSinceClosed}d`}
                </div>
                </div>
                <div className="min-w-0 flex-1 truncate">
                  {i.url ? (
                    <a
                      href={i.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                      style={{ color: "#1b1b1b" }}
                    >
                      {i.title}
                    </a>
                  ) : (
                    i.title
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs md:contents">
                  <div
                    className="shrink-0 md:w-16 md:text-right"
                    style={{ color: "#565c65" }}
                  >
                    {i.workstream}
                  </div>
                  <div
                    className="min-w-0 truncate md:w-28 md:shrink-0 md:text-right"
                    style={{ color: "#565c65" }}
                    title={i.assignee ?? "Unassigned"}
                  >
                    {i.assignee ?? "—"}
                  </div>
                </div>
              </div>
            );
          })}
          {items.length > top.length ? (
            <div className="pt-1 text-xs" style={{ color: "#8a8a80" }}>
              +{items.length - top.length} more — see activity feed.
            </div>
          ) : null}
        </div>
      )}
      <div className="mt-2 text-xs" style={{ color: "#8a8a80" }}>
        "Closed" is the Linear state change to done or canceled within the last{" "}
        {RECENTLY_CLOSED_WINDOW_DAYS} days. Canceled items are shown as "dropped" —
        a scope decision worth seeing, not a shipped win.
      </div>
    </section>
  );
}

/**
 * Command-centre summary of the Notion checkbox tracker: an open count, the
 * per-section split, and a link through to the full list on Team tasks.
 *
 * Renders nothing when the program keeps no tracker (Ventura), because an empty
 * panel labelled "Notion tracker" would imply a page exists and is empty rather
 * than that none was configured. Configuration problems DO render, with the
 * reason, since a silently missing 42 open items is the failure this whole
 * panel exists to prevent.
 */
function NotionTrackerSummary({ program }: { program: ProgramConfig }) {
  const { isLoading, open, bySection, status } = useNotionTasks(program.id);
  if (status === "not-configured") return null;

  return (
    <section
      className="rounded-md p-4"
      style={{ backgroundColor: "#fff", border: "1px solid #e5e5e2" }}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h2
          className="text-sm font-semibold"
          style={{ color: "#3a5a40", fontFamily: "Public Sans, system-ui, sans-serif" }}
        >
          Notion tracker{status === "ok" ? ` \u00b7 ${open.length} open` : ""}
        </h2>
        <Link
          to="/p/$programId/team-tasks"
          params={{ programId: program.id }}
          className="text-xs font-medium"
          style={{ color: "#3a5a40" }}
        >
          Team tasks →
        </Link>
      </div>

      {isLoading ? (
        <div className="text-xs" style={{ color: "#565c65" }}>
          Reading the tracker…
        </div>
      ) : status !== "ok" ? (
        <div className="text-xs" style={{ color: "#8a5a00" }}>
          {status === "no-token"
            ? "NOTION_API_KEY is not set, so the hand-maintained tracker is not being read. Open counts on this page reflect Linear only."
            : "Could not read the tracker page \u2014 usually it has not been shared with the Notion integration. Open counts on this page reflect Linear only."}
        </div>
      ) : open.length === 0 ? (
        <div className="text-xs" style={{ color: "#565c65" }}>
          Every checkbox on the tracker is ticked.
        </div>
      ) : (
        <div className="space-y-1.5">
          {bySection
            .filter((g) => g.open.length > 0)
            .map((g) => (
              <div key={g.section} className="flex items-baseline gap-3 text-xs">
                <div
                  className="w-10 shrink-0 text-right font-semibold"
                  style={{ color: "#1b1b1b" }}
                >
                  {g.open.length}
                </div>
                <div className="min-w-0 flex-1 truncate" style={{ color: "#565c65" }}>
                  {g.section}
                </div>
              </div>
            ))}
          <div className="pt-1 text-xs" style={{ color: "#8a8a80" }}>
            Checkbox tasks from the sprint tracker page. Separate from the Linear
            board — most of these never became tickets, which is why counts here
            and on the sprint board do not add up to the same total.
          </div>
        </div>
      )}
    </section>
  );
}

function agingBand(severity: StalledItem["severity"]): { bg: string; fg: string } {
  switch (severity) {
    case "cold":
      return { bg: "#fce4e4", fg: "#8a1c1c" };
    case "stalled":
      return { bg: "#fbe6c8", fg: "#8a4a00" };
    case "aging":
    default:
      return { bg: "#fff5c2", fg: "#5a4a00" };
  }
}

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
          className="text-xs underline"
          style={{ color: "#2e5d3a" }}
        >
          View all →
        </Link>
      </div>

      {!hydrated ? (
        <div className="text-xs" style={{ color: "#8a8a80" }}>
          Loading…
        </div>
      ) : open.length === 0 ? (
        <div className="text-xs" style={{ color: "#565c65" }}>
          Nothing open — all follow-ups are done or dismissed.
        </div>
      ) : (
        <>
          <div
            className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs"
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
                <span className="min-w-0 flex-1 text-xs" style={{ color: "#1b1b1b" }}>
                  {item.title}
                  {item.owner ? <span style={{ color: "#8a8a80" }}> · {item.owner}</span> : null}
                </span>
              </li>
            ))}
          </ul>
          {open.length > top.length ? (
            <div className="mt-2 text-xs" style={{ color: "#8a8a80" }}>
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
      <div className="text-xs uppercase tracking-wide" style={{ color: "#565c65" }}>
        {label}
      </div>
      <div
        className="mt-1 text-2xl font-semibold"
        style={{ color: danger ? "#b3261e" : "#1a1a1a" }}
      >
        {Math.max(0, days)}
        <span className="ml-1 text-xs font-normal" style={{ color: "#565c65" }}>
          days
        </span>
      </div>
      <div className="text-xs" style={{ color: "#565c65" }}>
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
