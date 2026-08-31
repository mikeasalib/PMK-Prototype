import { createFileRoute } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { WsTag } from "@/components/va-ui";
import {
  Bullet,
  Disclosure,
  Eyebrow,
  KZ,
  KpiStrip,
  List,
  Mono,
  Panel,
  PanelHead,
  SectionTitle,
  Square,
  Tag,
} from "@/components/kz";
import { type PhaseStatus, type WorkstreamKey } from "@/lib/va-data";
import { PROGRAMS, pageTitle, upcomingMilestones } from "@/lib/program.config";
import { seedFor } from "@/lib/program-seed";
import {
  lifecyclePhasesFor,
  today as todayIso,
  derivePhaseState,
} from "@/lib/program-model.adapters";
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

/** One tone per phase state. Blue for the phase in flight, green for done. */
const STATUS_TONE: Record<PhaseStatus, { label: string; tone: string }> = {
  complete: { label: "Complete", tone: KZ.green },
  in_progress: { label: "In progress", tone: KZ.blue },
  upcoming: { label: "Upcoming", tone: KZ.muted },
};

function LifecyclePage() {
  const program = useProgram();
  const seed = seedFor(program.id);
  const total = seed.lifecycle.length;
  const rawPhases = lifecyclePhasesFor(program);
  const iso = todayIso();

  // Status is derived from the phase window, never read from the stored
  // `status` literal on the seed. That literal said Phase 2 was in progress
  // through August — it was authored in July and nobody moved it — so a strip
  // that derived and cards that did not named different active phases on the
  // same screen.
  const statusOf = (id: string): PhaseStatus => {
    const raw = rawPhases.find((ph) => ph.id === id);
    if (!raw) return "upcoming";
    const st = derivePhaseState(raw, iso);
    return st === "complete" ? "complete" : st === "in_progress" ? "in_progress" : "upcoming";
  };
  const done = seed.lifecycle.filter((p) => statusOf(p.id) === "complete").length;
  const pctDone = Math.round((done / total) * 100);

  const activePhase = rawPhases.find((ph) => derivePhaseState(ph, iso) === "in_progress") ?? null;
  const lastPhase = rawPhases.length ? rawPhases[rawPhases.length - 1] : null;
  const activeSprint = program.sprintStrip.find((sw) => sw.start <= iso && iso <= sw.end) ?? null;

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Plan"
        title="Lifecycle plan"
        subtitle={`${total} phases from discovery to launch, with the exit criteria and gates each one has to clear.`}
      />

      <KpiStrip
        items={[
          {
            label: "Phases complete",
            value: `${done} / ${total}`,
            sub: `${pctDone}% of program`,
          },
          {
            label: "Active phase",
            value: activePhase ? activePhase.id : "—",
            sub: activePhase
              ? `${activePhase.window} · ${activePhase.sprints}`
              : "none in progress",
            title: activePhase?.name,
          },
          {
            label: "Current sprint",
            value: activeSprint ? activeSprint.key : "—",
            sub: activeSprint
              ? `${shortDate(activeSprint.start)} – ${shortDate(activeSprint.end)}`
              : "outside the strip",
            title: activeSprint?.focus ?? undefined,
          },
          {
            label: "Launch",
            value: shortDate(program.keyDates.launch),
            sub: lastPhase ? lastPhase.id : program.keyDates.launchLabel,
            danger: true,
          },
        ]}
      />

      <div style={{ padding: "28px var(--kz-pad-x) 0 var(--kz-pad-x)" }}>
        <LifecycleTimeline program={program} />
      </div>

      {/* Stacked phase frames sharing borders: one continuous sheet from
          discovery to launch, with the phase in flight on the tinted fill. */}
      <div
        style={{
          padding: "24px var(--kz-pad-x) 60px var(--kz-pad-x)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {seed.lifecycle.map((p, idx) => {
          const status = statusOf(p.id);
          const s = STATUS_TONE[status];
          return (
            <section
              id={p.id}
              key={p.id}
              style={{
                border: `1px solid ${KZ.bone}`,
                borderTop: idx === 0 ? `1px solid ${KZ.bone}` : "none",
                padding: "24px 28px",
                background: status === "in_progress" ? KZ.grey050 : KZ.white,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "baseline",
                  gap: 14,
                  borderBottom: `1px solid ${KZ.bone}`,
                  paddingBottom: 14,
                }}
              >
                <Mono
                  size={11}
                  tone={KZ.ink}
                  style={{ border: `1px solid ${KZ.bone}`, padding: "4px 8px" }}
                >
                  {p.id}
                </Mono>
                <SectionTitle size={19}>{p.name.replace(/^Phase \d+ · /, "")}</SectionTitle>
                <Mono size={11} tone={KZ.monoDate}>
                  {p.window} · {p.sprints}
                </Mono>
                {p.milestone ? <Mono size={10.5}>{p.milestone}</Mono> : null}
                <Tag tone={s.tone} style={{ marginLeft: "auto" }}>
                  {s.label}
                </Tag>
              </div>

              <p
                style={{
                  margin: "16px 0 0 0",
                  fontSize: 14,
                  lineHeight: 1.55,
                  maxWidth: "80ch",
                  color: KZ.body,
                  textWrap: "pretty",
                }}
              >
                {p.goal}
              </p>

              <div
                style={{
                  marginTop: 20,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
                  gap: 24,
                }}
              >
                <div>
                  <Eyebrow size={10}>Exit criteria</Eyebrow>
                  <List
                    style={{
                      marginTop: 10,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {p.exitCriteria.map((c) => (
                      <Bullet key={c} tone={KZ.bone}>
                        {c}
                      </Bullet>
                    ))}
                  </List>
                  <Disclosure>Not individually tracked in any source</Disclosure>
                </div>

                <div>
                  <Eyebrow size={10}>Gates</Eyebrow>
                  <List
                    style={{
                      marginTop: 10,
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {p.gates.map((g) => (
                      <li
                        key={g}
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11.5,
                          lineHeight: 1.45,
                          color: KZ.ink,
                        }}
                      >
                        {g}
                      </li>
                    ))}
                  </List>
                </div>

                {/* The plan's own big blocks, kept because they are the only
                    place the phase says which workstream carries what. */}
                {p.blocks.length ? (
                  <div>
                    <Eyebrow size={10}>Big blocks</Eyebrow>
                    <List
                      style={{
                        marginTop: 10,
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      {p.blocks.map((b) => {
                        const bs = STATUS_TONE[b.status];
                        return (
                          <li key={`${b.ws}-${b.title}`}>
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <WsTag ws={b.ws as WorkstreamKey} />
                              <span style={{ fontSize: 13.5, fontWeight: 500 }}>{b.title}</span>
                              <Tag tone={bs.tone} style={{ marginLeft: "auto" }}>
                                {bs.label}
                              </Tag>
                            </div>
                            <p
                              style={{
                                margin: "6px 0 0 0",
                                fontSize: 13,
                                lineHeight: 1.45,
                                color: KZ.body,
                              }}
                            >
                              {b.detail}
                            </p>
                          </li>
                        );
                      })}
                    </List>
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </AppLayout>
  );
}

/** Reserved height at the bottom of the plot for milestone keys + month axis. */
const AXIS_BAND = 56;

/**
 * A milestone label short enough to sit on a tick without colliding. The full
 * label and date stay on the tooltip, and the phase frames below carry the same
 * dates in full.
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

/**
 * Proportional timeline: phases sized to their real duration, milestones as
 * ticks, today as a coral line.
 *
 * Positions are percentages of the program window. Anything outside it is
 * omitted rather than clamped to an edge — a tick at 100% would read as "same
 * day as launch" and lie.
 */
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
  const milestones = upcomingMilestones(program, windowStart, 12).filter(
    (m) => m.date >= windowStart && m.date <= windowEnd,
  );
  const monthTicks = monthMarkers(windowStart, windowEnd);

  return (
    <Panel>
      <PanelHead
        label={`Timeline · ${shortDate(windowStart)} – ${shortDate(windowEnd)}`}
        right="bars sized to phase duration"
      />

      <div style={{ position: "relative", height: 24 + 34 * phases.length + AXIS_BAND }}>
        {/* Month gridlines: faint verticals so the eye can measure spans
            without a full ruler. They stop at the axis band. */}
        {monthTicks.map((t) => (
          <div
            key={`gl-${t.iso}`}
            style={{
              position: "absolute",
              top: 0,
              left: `${pct(t.iso)}%`,
              bottom: AXIS_BAND,
              width: 1,
              background: KZ.grey200,
            }}
          />
        ))}

        {phases.map((p, idx) => {
          const state = derivePhaseState(p, iso);
          const s =
            STATUS_TONE[
              state === "in_progress"
                ? "in_progress"
                : state === "complete"
                  ? "complete"
                  : "upcoming"
            ];
          const left = pct(p.startsOn);
          const right = pct(p.endsOn);
          const width = Math.max(1, right - left);
          return (
            <a
              key={p.id}
              href={`#${p.id}`}
              style={{
                position: "absolute",
                top: 24 + idx * 34,
                left: `${left}%`,
                width: `${width}%`,
                height: 26,
                // Hairline bars, filled only for the phase in flight: an
                // upcoming phase is a plan, not a fact.
                border: `1px solid ${s.tone}`,
                background: state === "in_progress" ? s.tone : KZ.white,
                overflow: "hidden",
              }}
              title={`${p.name} · ${p.window}`}
            >
              <div
                className="truncate"
                style={{
                  padding: "5px 8px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                  color: state === "in_progress" ? KZ.white : s.tone,
                }}
              >
                {p.id} · {p.name.replace(/^Phase \d+ · /, "")}
              </div>
            </a>
          );
        })}

        {/* Today, only when it falls inside the plotted window: a tick clamped
            to the edge would misread as "today is launch day". */}
        {todayInside ? (
          <>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: `${pct(iso)}%`,
                width: 1,
                bottom: 40,
                background: KZ.coral,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: `calc(${pct(iso)}% - 18px)`,
                top: 0,
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                textTransform: "uppercase",
                color: KZ.coral,
              }}
            >
              today
            </div>
          </>
        ) : null}

        {milestones.map((m) => (
          <div
            key={`ms-${m.date}-${m.label}`}
            style={{ position: "absolute", left: `${pct(m.date)}%`, bottom: AXIS_BAND - 24 }}
            title={`${m.label} · ${shortDate(m.date)}`}
          >
            <div
              style={{
                width: 1,
                height: 22,
                background: KZ.ink,
                position: "absolute",
                left: -1,
                bottom: 0,
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: -14,
                transform: "translateX(-50%)",
                whiteSpace: "nowrap",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: KZ.ink,
              }}
            >
              {shortMilestoneKey(m.label)}
            </div>
          </div>
        ))}

        {monthTicks.map((t) => (
          <div
            key={`ml-${t.iso}`}
            style={{
              position: "absolute",
              left: `${pct(t.iso)}%`,
              bottom: 0,
              transform: "translateX(-50%)",
              whiteSpace: "nowrap",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: KZ.muted,
            }}
          >
            {t.label}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 16,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 16,
        }}
      >
        {(["complete", "in_progress", "upcoming"] as PhaseStatus[]).map((k) => (
          <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Square tone={STATUS_TONE[k].tone} filled={k === "in_progress"} />
            <Mono size={10}>{STATUS_TONE[k].label.toLowerCase()}</Mono>
          </span>
        ))}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Square tone={KZ.coral} filled />
          <Mono size={10}>today</Mono>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Square tone={KZ.ink} filled />
          <Mono size={10}>milestone</Mono>
        </span>
      </div>
    </Panel>
  );
}

/**
 * Month boundaries within a window, for axis labels. Emits the first of each
 * month falling inside it, which keeps the leftmost label anchored.
 */
function monthMarkers(startIso: string, endIso: string): { iso: string; label: string }[] {
  const out: { iso: string; label: string }[] = [];
  const start = localDate(startIso);
  const end = localDate(endIso);
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
