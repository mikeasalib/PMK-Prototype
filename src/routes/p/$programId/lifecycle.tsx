import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
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
  const done = seed.lifecycle.filter((p) => p.status === "complete").length;
  const active = seed.lifecycle.filter((p) => p.status === "in_progress").length;
  const pctDone = Math.round((done / total) * 100);

  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(seed.lifecycle.map((p) => [p.id, p.status === "in_progress"])),
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

      {/* KPI strip */}
      <div
        className="grid grid-cols-4 gap-3 px-6 py-4"
        style={{ borderBottom: "1px solid #dfe1e2", backgroundColor: "#f8f8f6" }}
      >
        <Kpi label="Phases complete" value={`${done} / ${total}`} sub={`${pctDone}% of program`} />
        <Kpi
          label="Active phase"
          value={active > 0 ? "Phase 2 · Foundations" : "—"}
          sub="S4 – S5"
        />
        <Kpi
          label="October deliverable"
          value="Phase 5 · UAT / PRR"
          sub="Sep 28 – Oct 23 · code freeze"
        />
        <Kpi
          label="Launch deadline"
          value={program.keyDates.launchLabel}
          sub="Phase 6 · ORR & launch"
        />
      </div>

      {/* Gantt-style timeline. Phases sized to their actual duration, milestones
          as tick marks, "today" as a vertical line. Only rendered when the
          program has real phase dates — a program with an empty lifecycle
          config (there are none today, but the safety belongs here) hides
          this section rather than drawing an empty axis. */}
      <div className="px-6 pt-5">
        <LifecycleTimeline program={program} />
      </div>

      {/* Original equal-width strip: kept as the compact scan/jump index. Sized
          panels above give proportional time; this one gives one-click jumps
          to each phase card below. */}
      <div className="px-6 pt-4">
        <div
          className="flex items-stretch overflow-hidden rounded"
          style={{ border: "1px solid #dfe1e2" }}
        >
          {seed.lifecycle.map((p) => {
            const s = STATUS_STYLE[p.status];
            return (
              <a
                key={p.id}
                href={`#${p.id}`}
                className="flex-1 px-3 py-2 text-[11px]"
                style={{
                  backgroundColor: s.bg,
                  color: s.fg,
                  borderRight: "1px solid #dfe1e2",
                  textDecoration: "none",
                }}
              >
                <div className="font-mono" style={{ fontSize: 10, opacity: 0.75 }}>
                  {p.id} · {p.sprints}
                </div>
                <div
                  className="mt-0.5 font-semibold"
                  style={{ fontFamily: "Public Sans, system-ui, sans-serif", color: "#3a5a40" }}
                >
                  {p.name.replace(/^Phase \d+ · /, "")}
                </div>
                <div className="mt-0.5" style={{ fontSize: 10 }}>
                  {p.window}
                </div>
              </a>
            );
          })}
        </div>
      </div>

      {/* Phase cards */}
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-end gap-2 text-[11px]">
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
          const s = STATUS_STYLE[p.status];
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
                  className="font-mono text-[12px]"
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
                  className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ backgroundColor: s.bg, color: s.fg }}
                >
                  {s.label}
                </span>
                <span className="font-mono text-[11px]" style={{ color: "#565c65" }}>
                  {p.window} · {p.sprints}
                </span>
                {p.milestone ? (
                  <span
                    className="ml-auto rounded px-2 py-0.5 text-[11px] font-semibold"
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
                        className="mb-2 text-[11px] font-semibold uppercase tracking-wide"
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
                                  className="ml-auto rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                                  style={{ backgroundColor: bs.bg, color: bs.fg }}
                                >
                                  {bs.label}
                                </span>
                              </div>
                              <p className="mt-1 text-[12px]" style={{ color: "#3a3a3a" }}>
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
                          className="mb-2 text-[11px] font-semibold uppercase tracking-wide"
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
                          className="mb-2 text-[11px] font-semibold uppercase tracking-wide"
                          style={{ color: "#565c65" }}
                        >
                          Gates
                        </h3>
                        <div className="flex flex-wrap gap-1.5">
                          {p.gates.map((g, i) => (
                            <span
                              key={i}
                              className="rounded px-2 py-0.5 text-[11px]"
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
        <span className="text-[11px]" style={{ color: "#565c65" }}>
          Bars sized to phase duration · milestones as ticks · today line
        </span>
      </div>

      <div className="relative" style={{ height: 24 + 34 * phases.length + 40 }}>
        {/* Month gridlines. Faint verticals so the eye can measure spans
            without a full ruler. */}
        {monthTicks.map((t) => (
          <div
            key={`gl-${t.iso}`}
            className="absolute top-0 bottom-10"
            style={{
              left: `${pct(t.iso)}%`,
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
                className="truncate px-2 py-1 text-[11px] font-semibold"
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
              className="absolute rounded px-1.5 py-0.5 text-[10px] font-semibold"
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

        {/* Milestone ticks along the bottom. Labels stack vertically-offset to
            avoid overlap when two milestones are close in time. */}
        {milestones.map((m, i) => (
          <div
            key={`ms-${m.date}-${m.label}`}
            className="absolute"
            style={{ left: `${pct(m.date)}%`, bottom: 0 }}
          >
            <div
              style={{
                width: 2,
                height: 24,
                backgroundColor: "#3a5a40",
                position: "absolute",
                left: -1,
                bottom: 16,
              }}
            />
            <div
              className="absolute whitespace-nowrap text-[10px] font-medium"
              style={{
                color: "#3a5a40",
                bottom: -2 + (i % 2 === 0 ? 0 : 12),
                left: 4,
              }}
              title={`${m.label} · ${m.date}`}
            >
              {m.label} · {shortDate(m.date)}
            </div>
          </div>
        ))}

        {/* Bottom axis: month labels aligned to the tick lines. */}
        {monthTicks.map((t) => (
          <div
            key={`ml-${t.iso}`}
            className="absolute text-[10px]"
            style={{
              left: `${pct(t.iso)}%`,
              bottom: -18,
              color: "#8a8a80",
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
            }}
          >
            {t.label}
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-4 text-[10px]" style={{ color: "#8a8a80" }}>
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
        className="text-[10px] font-semibold uppercase tracking-wide"
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
      <div className="mt-0.5 text-[11px]" style={{ color: "#565c65" }}>
        {sub}
      </div>
    </div>
  );
}
