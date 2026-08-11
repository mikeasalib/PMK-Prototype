import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { SectionTabs } from "@/components/SectionTabs";
import { WsTag } from "@/components/va-ui";
import { type LifecyclePhase, type PhaseStatus, type WorkstreamKey } from "@/lib/va-data";
import { PROGRAMS, pageTitle, upcomingMilestones, workstreamOf } from "@/lib/program.config";
import { seedFor } from "@/lib/program-seed";
import { lifecyclePhasesFor, today as todayIso, derivePhaseState } from "@/lib/program-model.adapters";
import { shortDate, localDate } from "@/lib/local-date";
import { useProgram } from "./route";

export const Route = createFileRoute("/p/$programId/lifecycle")({
  head: ({ params }) => ({
    meta: [
      { title: pageTitle("Lifecycle plan", PROGRAMS[params.programId]) },
      {
        name: "description",
        content: `End-to-end delivery plan through ${PROGRAMS[params.programId].keyDates.launchLabel}.`,
      },
    ],
  }),
  component: LifecyclePage,
});

const STATUS_STYLE: Record<PhaseStatus, { label: string; bg: string; fg: string; bar: string }> = {
  complete: { label: "Complete", bg: "#ecf3ec", fg: "#2e6b2f", bar: "#2e8540" },
  in_progress: { label: "In progress", bg: "#fff5c2", fg: "#7a5a00", bar: "#ffbe2e" },
  upcoming: { label: "Upcoming", bg: "#eef2f7", fg: "#3a4a5c", bar: "#a9aeb1" },
};

function LifecyclePage() {
  const program = useProgram();
  const seed = seedFor(program.id);
  const total = seed.lifecycle.length;
  const rawPhases = lifecyclePhasesFor(program);
  const iso = todayIso();

  // Status is derived from the phase window, never read from the stored
  // `status` literal on the seed. That literal said Phase 2 was in progress
  // through August — it was authored in July and nobody moved it — so the KPI
  // strip (which derives) and the phase cards (which did not) named different
  // active phases on the same screen. va-data's own comment warns about exactly
  // this: storing state means someone has to remember to move it.
  const statusOf = (id: string): PhaseStatus => {
    const raw = rawPhases.find((ph) => ph.id === id);
    if (!raw) return "upcoming";
    const st = derivePhaseState(raw, iso);
    return st === "complete" ? "complete" : st === "in_progress" ? "in_progress" : "upcoming";
  };
  const done = seed.lifecycle.filter((p) => statusOf(p.id) === "complete").length;
  const pctDone = Math.round((done / total) * 100);

  // Derived from the same phase array the timeline plots, so the strip cannot
  // disagree with the chart directly beneath it.
  const activePhase = rawPhases.find((ph) => derivePhaseState(ph, iso) === "in_progress") ?? null;
  const lastPhase = rawPhases.length ? rawPhases[rawPhases.length - 1] : null;
  const activeSprint =
    program.sprintStrip.find((sw) => sw.start <= iso && iso <= sw.end) ?? null;

  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(seed.lifecycle.map((p) => [p.id, statusOf(p.id) === "in_progress"])),
  );
  const allOpen = seed.lifecycle.every((p) => openPhases[p.id]);
  const togglePhase = (id: string) => setOpenPhases((prev) => ({ ...prev, [id]: !prev[id] }));
  const setAll = (open: boolean) =>
    setOpenPhases(Object.fromEntries(seed.lifecycle.map((p) => [p.id, open])));

  return (
    <AppLayout>
      <PageHeader
        title="Lifecycle plan"
        subtitle="End-to-end delivery blocks — from discovery through the October deliverable to the November 11, 2026 launch."
      />
      <SectionTabs group="plan" />

      {/* KPI strip */}
      <div
        className="grid grid-cols-2 gap-3 px-4 py-4 sm:px-6 md:grid-cols-4"
        style={{ borderBottom: "1px solid #dfe1e2", backgroundColor: "#f8f8f6" }}
      >
        {/* Derived, not typed. These four were hardcoded VA strings — "Phase 2 ·
            Foundations", "S4 – S5", "Sep 28 – Oct 23 · code freeze" — which
            printed on Ventura too, and went stale the moment the sprint strip
            was corrected against the delivery plan: there is no Sprint 4 any
            more and the freeze is not September. */}
        <Kpi label="Phases complete" value={`${done} / ${total}`} sub={`${pctDone}% of program`} />
        <Kpi
          label="Active phase"
          value={activePhase ? activePhase.name.replace(/^Phase \d+ · /, "") : "—"}
          sub={activePhase ? `${activePhase.window} · ${activePhase.sprints}` : "none in progress"}
        />
        <Kpi
          label="Current sprint"
          value={activeSprint ? activeSprint.label : "—"}
          sub={
            activeSprint
              ? (activeSprint.focus ?? `${shortDate(activeSprint.start)} – ${shortDate(activeSprint.end)}`)
              : "outside the strip"
          }
        />
        <Kpi
          label="Launch deadline"
          value={program.keyDates.launchLabel}
          sub={lastPhase ? lastPhase.name.replace(/^Phase \d+ · /, "") : ""}
        />
      </div>

      {/* Gantt-style timeline. Phases sized to their actual duration, milestones
          as tick marks, "today" as a vertical line. Only rendered when the
          program has real phase dates — a program with an empty lifecycle
          config (there are none today, but the safety belongs here) hides
          this section rather than drawing an empty axis. */}
      <div className="px-4 pt-5 sm:px-6">
        <LifecycleTimeline program={program} />
      </div>

      {/* Original equal-width strip: kept as the compact scan/jump index. Sized
          panels above give proportional time; this one gives one-click jumps
          to each phase card below. */}
      <div className="px-4 pt-4 sm:px-6">
        <div
          className="flex items-stretch overflow-hidden rounded"
          style={{ border: "1px solid #dfe1e2" }}
        >
          {seed.lifecycle.map((p) => {
            const s = STATUS_STYLE[statusOf(p.id)];
            return (
              <a
                key={p.id}
                href={`#${p.id}`}
                className="flex-1 px-3 py-2 text-xs"
                style={{
                  backgroundColor: s.bg,
                  color: s.fg,
                  borderRight: "1px solid #dfe1e2",
                  textDecoration: "none",
                }}
              >
                <div className="font-mono" style={{ fontSize: 12, opacity: 0.75 }}>
                  {p.id} · {p.sprints}
                </div>
                <div
                  className="mt-0.5 font-semibold"
                  style={{ fontFamily: "Public Sans, system-ui, sans-serif", color: "#3a5a40" }}
                >
                  {p.name.replace(/^Phase \d+ · /, "")}
                </div>
                <div className="mt-0.5" style={{ fontSize: 12 }}>
                  {p.window}
                </div>
              </a>
            );
          })}
        </div>
      </div>

      {/* Phase cards */}
      <div className="p-4 space-y-4 sm:p-6">
        <div className="flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={() => setAll(!allOpen)}
            className="rounded px-2 py-1 font-semibold uppercase tracking-wide"
            style={{ border: "1px solid #dfe1e2", backgroundColor: "#fff", color: "#3a5a40" }}
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>
        {seed.lifecycle.map((p) => {
          const s = STATUS_STYLE[statusOf(p.id)];
          const isOpen = !!openPhases[p.id];
          return (
            <section
              id={p.id}
              key={p.id}
              className="rounded-md bg-white"
              style={{ border: "1px solid #e5e5e2", borderLeft: `4px solid ${s.bar}` }}
            >
              <button
                type="button"
                onClick={() => togglePhase(p.id)}
                aria-expanded={isOpen}
                aria-controls={`${p.id}-body`}
                className="flex w-full flex-wrap items-baseline gap-3 px-4 py-3 text-left"
                style={{
                  borderBottom: isOpen ? "1px solid #eee" : "none",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                <span
                  aria-hidden
                  className="font-mono text-xs"
                  style={{ color: "#565c65", width: 12, display: "inline-block" }}
                >
                  {isOpen ? "▾" : "▸"}
                </span>
                <h2
                  className="text-[16px] font-semibold"
                  style={{ fontFamily: "Public Sans, system-ui, sans-serif", color: "#3a5a40" }}
                >
                  {p.name}
                </h2>
                <span
                  className="rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide"
                  style={{ backgroundColor: s.bg, color: s.fg }}
                >
                  {s.label}
                </span>
                <span className="font-mono text-xs" style={{ color: "#565c65" }}>
                  {p.window} · {p.sprints}
                </span>
                {p.milestone ? (
                  <span
                    className="ml-auto rounded px-2 py-0.5 text-xs font-semibold"
                    style={{ backgroundColor: "#3a5a40", color: "#ffbe2e" }}
                  >
                    {p.milestone}
                  </span>
                ) : null}
              </button>

              {isOpen ? (
                <div id={`${p.id}-body`} className="px-4 pt-3 pb-4">
                  <p className="text-[13px]" style={{ color: "#333" }}>
                    <strong style={{ color: "#3a5a40" }}>Goal.</strong> {p.goal}
                  </p>

                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <h3
                        className="mb-2 text-xs font-semibold uppercase tracking-wide"
                        style={{ color: "#565c65" }}
                      >
                        Big blocks
                      </h3>
                      <ul className="space-y-2">
                        {p.blocks.map((b, i) => {
                          const bs = STATUS_STYLE[b.status];
                          return (
                            <li
                              key={i}
                              className="rounded p-2"
                              style={{
                                border: "1px solid #eee",
                                borderLeft: `3px solid ${workstreamOf(b.ws, program).color}`,
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <WsTag ws={b.ws as WorkstreamKey} />
                                <span
                                  className="text-[13px] font-semibold"
                                  style={{ color: "#3a5a40" }}
                                >
                                  {b.title}
                                </span>
                                <span
                                  className="ml-auto rounded px-1.5 py-0.5 text-xs font-semibold uppercase"
                                  style={{ backgroundColor: bs.bg, color: bs.fg }}
                                >
                                  {bs.label}
                                </span>
                              </div>
                              <p className="mt-1 text-xs" style={{ color: "#3a3a3a" }}>
                                {b.detail}
                              </p>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h3
                          className="mb-2 text-xs font-semibold uppercase tracking-wide"
                          style={{ color: "#565c65" }}
                        >
                          Exit criteria
                        </h3>
                        <ul className="space-y-1 text-[13px]" style={{ color: "#333" }}>
                          {p.exitCriteria.map((c, i) => (
                            <li key={i} className="flex gap-2">
                              <span style={{ color: s.bar }}>▸</span>
                              <span>{c}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h3
                          className="mb-2 text-xs font-semibold uppercase tracking-wide"
                          style={{ color: "#565c65" }}
                        >
                          Gates
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                          {p.gates.map((g, i) => (
                            <span
                              key={i}
                              className="rounded px-2 py-0.5 text-xs"
                              style={{
                                backgroundColor: "#f0f0f0",
                                color: "#333",
                                border: "1px solid #dfe1e2",
                              }}
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </AppLayout>
  );
}

/**
 * Proportional timeline of phases with milestones and "today" as an overlay.
 *
 * Positions are percentages of the program window (earliest phase start →
 * latest phase end, or the launch date if it falls past that). Every element
 * that renders past the window is clipped rather than drawn off-canvas — the
 * chart is a proportional read of what's in front of us, not a scroll.
 *
 * A milestone that falls outside the window (e.g. a post-launch date not
 * covered by any phase) is silently omitted rather than glued to an edge,
 * because a tick at 100% would read as "same day as launch" and lie.
 */
/** Reserved height at the bottom of the plot for milestone keys + month axis. */
const AXIS_BAND = 56;

/**
 * A milestone label short enough to sit on a tick without colliding.
 *
 * "Sprint 5 end" becomes "S5", "Public launch" becomes "Launch". Anything else
 * falls back to its first word. The full label and date are on the tick's
 * tooltip and spelled out on the phase cards below, so nothing is lost —
 * previously these printed in full and overlapped each other at any zoom.
 */
function shortMilestoneKey(label: string): string {
  const sprint = label.match(/sprint\s*(\d+)/i);
  if (sprint) return `S${sprint[1]}`;
  if (/launch/i.test(label)) return "Launch";
  if (/uat/i.test(label)) return "UAT";
  if (/production|hardening/i.test(label)) return "Prod";
  return label.split(/[\s·]+/)[0];
}

type ProgramLike = ReturnType<typeof useProgram>;
function LifecycleTimeline({ program }: { program: ProgramLike }) {
  const phases = lifecyclePhasesFor(program);
  if (phases.length === 0) return null;

  const iso = todayIso();
  const windowStart = phases[0].startsOn;
  const windowEnd = phases[phases.length - 1].endsOn;
  const startMs = localDate(windowStart).getTime();
  const endMs = localDate(windowEnd).getTime();
  const span = Math.max(1, endMs - startMs);

  const pct = (dayIso: string) => {
    const t = localDate(dayIso).getTime();
    return Math.max(0, Math.min(100, ((t - startMs) / span) * 100));
  };

  const todayInside = iso >= windowStart && iso <= windowEnd;
  const milestones = upcomingMilestones(program, windowStart).filter(
    (m) => m.date >= windowStart && m.date <= windowEnd,
  );

  const monthTicks = monthMarkers(windowStart, windowEnd);

  return (
    <section
      className="rounded-md bg-white p-4"
      style={{ border: "1px solid #e5e5e2" }}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h2
          className="text-sm font-semibold"
          style={{ color: "#3a5a40", fontFamily: "Public Sans, system-ui, sans-serif" }}
        >
          Timeline · {shortDate(windowStart)} – {shortDate(windowEnd)}
        </h2>
        <span className="text-xs" style={{ color: "#565c65" }}>
          Bars sized to phase duration · milestones as ticks · today line
        </span>
      </div>

      {/* AXIS_BAND is reserved height at the bottom for the milestone ticks and
          the month labels. They previously sat at negative `bottom` offsets, so
          they rendered outside this container and collided with each other and
          with the legend below. */}
      <div
        className="relative"
        style={{ height: 24 + 34 * phases.length + AXIS_BAND }}
      >
        {/* Month gridlines. Faint verticals so the eye can measure spans
            without a full ruler. */}
        {monthTicks.map((t) => (
          <div
            key={`gl-${t.iso}`}
            className="absolute top-0"
            // Gridlines stop at the axis band rather than running through it.
            style={{
              left: `${pct(t.iso)}%`,
              bottom: AXIS_BAND,
              width: 1,
              backgroundColor: "#f0f0ec",
            }}
          />
        ))}

        {/* Phase bars, stacked one row per phase. */}
        {phases.map((p, idx) => {
          const state = derivePhaseState(p, iso);
          const s = STATUS_STYLE[state];
          const left = pct(p.startsOn);
          const right = pct(p.endsOn);
          const width = Math.max(1, right - left);
          return (
            <a
              key={p.id}
              href={`#${p.id}`}
              className="absolute rounded"
              style={{
                top: 24 + idx * 34,
                left: `${left}%`,
                width: `${width}%`,
                height: 26,
                backgroundColor: s.bar,
                opacity: state === "upcoming" ? 0.55 : 1,
                textDecoration: "none",
                overflow: "hidden",
              }}
              title={`${p.name} · ${p.window}`}
            >
              <div
                className="truncate px-2 py-1 text-xs font-semibold"
                style={{ color: "#ffffff" }}
              >
                {p.name.replace(/^Phase \d+ · /, "")}
              </div>
            </a>
          );
        })}

        {/* Today line — only when today falls inside the plotted window;
            outside it, a tick clamped to the edge would misread as "today is
            launch day." */}
        {todayInside ? (
          <>
            <div
              className="absolute top-0"
              style={{
                left: `${pct(iso)}%`,
                width: 2,
                bottom: 40,
                backgroundColor: "#b3261e",
              }}
            />
            <div
              className="absolute rounded px-1.5 py-0.5 text-xs font-semibold"
              style={{
                left: `calc(${pct(iso)}% - 20px)`,
                top: 4,
                backgroundColor: "#b3261e",
                color: "#ffffff",
              }}
            >
              today
            </div>
          </>
        ) : null}

        {/* Milestone ticks. Labels are the short key only — "Sprint 5 end ·
            Aug 14" beside "Sprint 6 end · Aug 28" two weeks later overlapped no
            matter how they were staggered, and a two-row stagger only defers
            the collision. Full label and date live on the tooltip, and the
            phase cards below carry the same dates in full. */}
        {milestones.map((m) => (
          <div
            key={`ms-${m.date}-${m.label}`}
            className="absolute"
            style={{ left: `${pct(m.date)}%`, bottom: AXIS_BAND - 24 }}
            title={`${m.label} · ${shortDate(m.date)}`}
          >
            <div
              style={{
                width: 2,
                height: 22,
                backgroundColor: "#3a5a40",
                position: "absolute",
                left: -1,
                bottom: 0,
              }}
            />
            <div
              className="absolute whitespace-nowrap text-xs font-medium"
              style={{ color: "#3a5a40", bottom: -14, transform: "translateX(-50%)" }}
            >
              {shortMilestoneKey(m.label)}
            </div>
          </div>
        ))}

        {/* Month axis, on its own row beneath the milestone keys. */}
        {monthTicks.map((t) => (
          <div
            key={`ml-${t.iso}`}
            className="absolute text-xs"
            style={{
              left: `${pct(t.iso)}%`,
              bottom: 0,
              color: "#8a8a80",
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: "#8a8a80" }}>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded" style={{ backgroundColor: STATUS_STYLE.complete.bar }} /> complete
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded" style={{ backgroundColor: STATUS_STYLE.in_progress.bar }} /> in progress
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded"
            style={{ backgroundColor: STATUS_STYLE.upcoming.bar, opacity: 0.55 }}
          />{" "}
          upcoming
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2" style={{ backgroundColor: "#b3261e" }} /> today
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2" style={{ backgroundColor: "#3a5a40" }} /> milestone
        </span>
      </div>
    </section>
  );
}

/**
 * Month boundaries within a window, for axis labels. Emits the first of each
 * month falling in [startIso, endIso], plus the window start if it isn't
 * itself the first — this keeps the leftmost label anchored.
 */
function monthMarkers(startIso: string, endIso: string): { iso: string; label: string }[] {
  const out: { iso: string; label: string }[] = [];
  const start = localDate(startIso);
  const end = localDate(endIso);
  // Start at the first of the month at or after startIso.
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  if (cursor.getTime() < start.getTime()) {
    cursor = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  }
  while (cursor.getTime() <= end.getTime()) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, "0");
    out.push({
      iso: `${y}-${m}-01`,
      label: cursor.toLocaleDateString(undefined, { month: "short" }),
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return out;
}

// Kept-legacy note: LifecyclePhase type is imported for the timeline helpers
// even though it's only structurally used here — importing keeps the intent
// obvious to a reader following the phase-shape.
type _KeepLifecyclePhase = LifecyclePhase;

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-md bg-white p-3" style={{ border: "1px solid #dfe1e2" }}>
      <div
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: "#565c65" }}
      >
        {label}
      </div>
      <div
        className="mt-1 text-[15px] font-semibold"
        style={{ fontFamily: "Public Sans, system-ui, sans-serif", color: "#3a5a40" }}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs" style={{ color: "#565c65" }}>
        {sub}
      </div>
    </div>
  );
}
