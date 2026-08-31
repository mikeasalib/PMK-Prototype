import { createFileRoute, Link } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { WsPip } from "@/components/va-ui";
import {
  Bullet,
  CheckSquare,
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
  Td,
  Th,
  Track,
  doneTextStyle,
  pad2,
  toneFor,
} from "@/components/kz";
import type { WorkstreamKey } from "@/lib/va-data";
import { useStoredData, bucketOf, isHighPriority } from "@/hooks/use-stored-data";
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
import { daysUntilLocal, shortDate } from "@/lib/local-date";
import {
  phasesFromLifecycle,
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
import type { PhaseRecord } from "@/lib/program-model";
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

// Rounding from midnight rather than from "now", so the number does not change
// during the day.
const daysFromNow = daysUntilLocal;

/**
 * Command centre — the landing screen.
 *
 * The top of the page is three panels: the phase in flight on the left with its
 * own progress and the gates it has to clear, the dates that do not move on the
 * right, and what is owed either way across the full width. Everything below is
 * the same read-out one level of detail down — the tracker, the burn-down, what
 * has stopped moving and what actually closed.
 */
function Overview() {
  const program = useProgram();
  const { linear, isLoading, origin } = useStoredData(program.id);
  const SPRINT_MILESTONES = program.sprintStrip;

  const now = new Date().toISOString();
  const todayIso = now.slice(0, 10);
  const activeSprint =
    SPRINT_MILESTONES.find((s) => s.start <= todayIso && todayIso <= s.end) ?? SPRINT_MILESTONES[0];

  const total = linear.filter((i) => bucketOf(i) !== "canceled").length;
  const done = linear.filter((i) => bucketOf(i) === "done").length;
  const inProgress = linear.filter((i) => bucketOf(i) === "in_progress").length;
  const highPriorityOpen = linear.filter(isHighPriority).length;
  const daysToLaunch = Math.max(0, daysFromNow(program.keyDates.launch));

  // Attribute each issue once, keeping the basis. "stored" or "explicit" mean
  // the source said which workstream this belongs to; "keyword"/"fallback" mean
  // the classifier guessed from the title. Health is only as good as bucketing,
  // so the burn-down has to say when a row is mostly inference.
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

  const phases = phasesFromLifecycle(program, todayIso);
  const currentPhase = phases.find((p) => p.state === "in_progress") ?? null;
  const blockerInputs = linear.map((i) => ({
    bucket: bucketOf(i),
    title: i.title,
    labels: i.labels ?? [],
  }));
  // Sprint gates when the program's plan states one per sprint; phase gates
  // otherwise. VA has both — the sprint gates are the plan of record and are
  // concrete, so they win.
  const sprintGates = upcomingSprintGates(program, blockerInputs, todayIso);

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

  // What the "current" panel means depends on how the program keeps time.
  // Declared per-program in program.timeAxis so the choice is explicit.
  const usesPhases = program.timeAxis === "phase";
  const milestones = upcomingMilestones(program, todayIso, 5);

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Program"
        title="Command centre"
        subtitle={[
          `Where the ${program.domainLabel} program stands this morning: the phase in flight, what is owed either way, and the dates that do not move.`,
          origin === "snapshot" ? "Read from a captured snapshot, not a live read." : null,
        ]
          .filter(Boolean)
          .join(" ")}
      />

      <KpiStrip
        items={[
          {
            label: "Days to launch",
            value: pad2(daysToLaunch),
            sub: program.keyDates.launchLabel,
            danger: daysToLaunch < 120,
          },
          { label: "In progress", value: pad2(inProgress), sub: `of ${total} tracked` },
          { label: "Completed", value: pad2(done), sub: "issues closed" },
          {
            label: "High priority open",
            value: pad2(highPriorityOpen),
            sub: "urgent + high",
            danger: highPriorityOpen > 5,
          },
        ]}
      />

      <div
        style={{
          padding: "28px var(--kz-pad-x) 60px var(--kz-pad-x)",
          display: "grid",
          gridTemplateColumns: "minmax(0,2fr) minmax(280px,1fr)",
          gap: 24,
          alignItems: "start",
        }}
      >
        <CurrentPanel
          usesPhases={usesPhases}
          phases={phases}
          currentPhase={currentPhase}
          sprint={activeSprint}
          gates={sprintGates}
          today={todayIso}
        />

        <Panel>
          <PanelHead label="Upcoming milestones" />
          <List>
            {milestones.map((m) => {
              const isLaunch = m.date === program.keyDates.launch;
              const days = daysFromNow(m.date);
              return (
                <li
                  key={`${m.date}-${m.label}`}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 16,
                    padding: "13px 0",
                    borderBottom: `1px solid ${KZ.grey200}`,
                  }}
                >
                  <span style={{ fontSize: 13.5, lineHeight: 1.4 }}>{m.label}</span>
                  <Mono
                    size={11.5}
                    tone={isLaunch ? KZ.coral : KZ.ink}
                    title={`${Math.max(0, days)} days out`}
                  >
                    {shortDate(m.date)}
                  </Mono>
                </li>
              );
            })}
          </List>
          <Disclosure style={{ marginTop: 14 }}>
            Dated milestones read from the program plan; Linear where a ticket carries the date
          </Disclosure>
        </Panel>

        <div style={{ gridColumn: "1 / -1" }}>
          <FollowUpsPanel program={program} />
        </div>

        {/* One level down: the tracker Linear does not hold, the burn-down, and
            the two paired aging signals. */}
        <div style={{ gridColumn: "1 / -1" }}>
          <NotionTrackerPanel program={program} />
        </div>

        {isLoading ? (
          <div style={{ gridColumn: "1 / -1" }}>
            <Mono size={11}>Loading…</Mono>
          </div>
        ) : (
          <>
            <div style={{ gridColumn: "1 / -1" }}>
              <Panel>
                <PanelHead label="Workstream burn-down" right="derived from Linear" />
                <div style={{ overflowX: "auto", marginTop: 4 }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 12.5,
                      minWidth: 560,
                    }}
                  >
                    <thead>
                      <tr>
                        <Th>Workstream</Th>
                        <Th>Health</Th>
                        <Th>Total</Th>
                        <Th>Complete</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {wsRows.map((r) => {
                        // Plain ticket completion. A blended score needs a
                        // formula footnote to read at all, and a number nobody
                        // can defend in a stakeholder meeting without reciting
                        // its weighting is not worth showing.
                        const pctComplete = r.total ? Math.round((r.done / r.total) * 100) : 0;
                        const color = workstreamOf(r.ws, program).color;
                        return (
                          <tr key={r.ws} style={{ borderTop: `1px solid ${KZ.grey200}` }}>
                            <Td>
                              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <WsPip ws={r.ws} />
                                <span>{workstreamOf(r.ws, program).label}</span>
                              </span>
                            </Td>
                            <Td>
                              <span
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                {r.health ? (
                                  <Tag tone={HEALTH_COLOR[r.health]}>{HEALTH_LABEL[r.health]}</Tag>
                                ) : (
                                  <Mono size={11}>—</Mono>
                                )}
                                {/* Attribution honesty: health depends on
                                    bucketing, and when the bucketing is mostly
                                    keyword inference the row says so. */}
                                {r.inferredPct >= 50 ? (
                                  <Tag
                                    tone={KZ.amber}
                                    title={`${r.inferredPct}% of issues in this workstream were attributed by keyword from the title, not stored in Linear. Tag issues at source to firm this up.`}
                                  >
                                    {r.inferredPct}% inferred
                                  </Tag>
                                ) : null}
                              </span>
                            </Td>
                            <Td
                              style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
                              title={`${r.done} done · ${r.inProgress} in progress · ${r.todo + r.backlog} todo or backlog`}
                            >
                              {pad2(r.total)}
                            </Td>
                            <Td>
                              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <span style={{ width: 96 }}>
                                  <Track pct={pctComplete} tone={color} />
                                </span>
                                <Mono size={10.5} tone={KZ.monoDate}>
                                  {r.done}/{r.total}
                                </Mono>
                              </span>
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <Disclosure>
                  Complete is closed tickets over total tickets. Hover a total for the done /
                  in-progress / remaining split
                </Disclosure>
              </Panel>
            </div>

            {linear.length > 0 ? (
              <>
                <div style={{ gridColumn: "1 / -1" }}>
                  <StalledPanel program={program} items={stalled} inProgressTotal={inProgress} />
                </div>
                {/* The paired signal. A page with only "what's stalled" reads as
                    bad news; what actually closed in the same window grounds the
                    stall count against the real pace of completion. */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <ClosedPanel program={program} items={closed} />
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </AppLayout>
  );
}

/**
 * The phase in flight — or the sprint, on a program that keeps time in sprints.
 *
 * Same slot, one concept per program.timeAxis: the bordered id, the name at
 * 24px, the window, a status tag, the goal, a day-count track, and the gates
 * that have to clear. The gates carry days-left and blocker counts because those
 * are measurable; whether a gate is *met* is a judgement no source tracks, and
 * the disclosure says so rather than printing a score nobody can verify.
 */
function CurrentPanel({
  usesPhases,
  phases,
  currentPhase,
  sprint,
  gates,
  today,
}: {
  usesPhases: boolean;
  phases: PhaseRecord[];
  currentPhase: PhaseRecord | null;
  sprint: ProgramConfig["sprintStrip"][number];
  gates: SprintGate[];
  today: string;
}) {
  const phasesDone = phases.filter((p) => p.state === "complete").length;

  // Elapsed share of whatever window is current. On the sprint axis that is the
  // sprint; on the phase axis, the phase's own window is prose ("Jul 6 – Jul
  // 31"), so the fraction of phases complete is the honest measure instead.
  const spanDays = Math.max(1, dayDiff(sprint.start, sprint.end) + 1);
  const elapsed = Math.min(spanDays, Math.max(0, dayDiff(sprint.start, today) + 1));
  const pct = usesPhases
    ? phases.length
      ? Math.round((phasesDone / phases.length) * 100)
      : 0
    : Math.round((elapsed / spanDays) * 100);

  const heading = usesPhases ? (currentPhase?.name ?? "Live customer handoff") : sprint.label;
  const window = usesPhases
    ? (currentPhase?.window ?? "post-launch")
    : `${shortDate(sprint.start)} – ${shortDate(sprint.end)}`;
  const status = usesPhases ? (currentPhase ? "in progress" : "steady state") : "in progress";

  return (
    <Panel>
      <PanelHead
        label={usesPhases ? "Current phase" : "Current sprint"}
        style={{ paddingBottom: 12 }}
      />
      <div
        style={{
          marginTop: 18,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "baseline",
          gap: 14,
        }}
      >
        <Mono
          size={11}
          tone={KZ.ink}
          style={{ border: `1px solid ${KZ.bone}`, padding: "4px 8px" }}
        >
          {usesPhases ? (currentPhase?.id ?? "—") : sprint.key}
        </Mono>
        <SectionTitle size={24}>{heading}</SectionTitle>
        <Mono size={11} tone={KZ.monoDate}>
          {window}
        </Mono>
        <Tag tone={toneFor(status)} style={{ marginLeft: "auto" }}>
          {status}
        </Tag>
      </div>

      {usesPhases && currentPhase ? (
        <p
          style={{
            margin: "14px 0 0 0",
            fontSize: 14,
            lineHeight: 1.55,
            maxWidth: "70ch",
            color: KZ.body,
            textWrap: "pretty",
          }}
        >
          {currentPhase.goal}
        </p>
      ) : sprint.focus ? (
        <p
          style={{
            margin: "14px 0 0 0",
            fontSize: 14,
            lineHeight: 1.55,
            maxWidth: "70ch",
            color: KZ.body,
            textWrap: "pretty",
          }}
        >
          {sprint.focus}
        </p>
      ) : null}

      <div style={{ marginTop: 22 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: KZ.monoDate,
          }}
        >
          <span>
            {usesPhases
              ? `${phasesDone} of ${phases.length} phases complete`
              : `Day ${elapsed} of ${spanDays}`}
          </span>
          <span>
            {usesPhases
              ? currentPhase
                ? `${currentPhase.name} in flight`
                : "post-launch"
              : `${sprint.label} · closes ${shortDate(sprint.end)}`}
          </span>
        </div>
        <div style={{ marginTop: 8 }}>
          <Track pct={pct} />
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <Eyebrow size={10}>Gates to clear</Eyebrow>
        {gates.length ? (
          <List style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            {gates.slice(0, 4).map((g) => {
              const late = g.daysRemaining < 0;
              return (
                <li key={g.key} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <Square style={{ marginTop: 6 }} />
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11.5,
                        lineHeight: 1.5,
                        color: KZ.ink,
                      }}
                    >
                      {g.gate}
                    </span>
                    <span style={{ display: "block", marginTop: 4 }}>
                      <Mono size={10} tone={late ? KZ.coral : KZ.muted}>
                        {g.label}
                        {g.isCurrent ? " · now" : ""} ·{" "}
                        {late ? `${-g.daysRemaining}d past` : `${g.daysRemaining}d left`}
                        {g.blockingWorkItems > 0 ? ` · ${g.blockingWorkItems} blocking` : ""}
                      </Mono>
                    </span>
                  </span>
                </li>
              );
            })}
          </List>
        ) : currentPhase ? (
          <List style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {currentPhase.gates.map((g) => (
              <Bullet key={g} mono>
                {g}
              </Bullet>
            ))}
          </List>
        ) : (
          <Mono size={11} style={{ display: "block", marginTop: 10 }}>
            No gate is stated for this window in the plan
          </Mono>
        )}
        <Disclosure>Gate state is not individually tracked in any source</Disclosure>
      </div>
    </Panel>
  );
}

/**
 * Open follow-ups, top six, checkable in place — the same per-program curation
 * the Follow-ups route reads, so a check here shows there. Two columns on a wide
 * viewport because these are short lines and a single column of six wastes the
 * width.
 */
function FollowUpsPanel({ program }: { program: ProgramConfig }) {
  const { hydrated, buckets, setStatus } = useFollowUps(program.id);
  const open = buckets.open;
  const top = open.slice(0, 6);

  return (
    <Panel>
      <PanelHead
        label="Open follow-ups"
        right={hydrated ? `Top ${Math.min(6, open.length)} of ${pad2(open.length)}` : "reading…"}
        style={{ paddingBottom: 12 }}
      />
      {!hydrated ? (
        <Mono size={11} style={{ display: "block", marginTop: 14 }}>
          Loading…
        </Mono>
      ) : open.length === 0 ? (
        <div style={{ marginTop: 14, fontSize: 13, color: KZ.body }}>
          Nothing open — all follow-ups are done or dismissed.
        </div>
      ) : (
        <List
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(380px,1fr))",
            gap: "0 32px",
          }}
        >
          {top.map((item) => (
            <li
              key={item.id}
              style={{
                display: "flex",
                gap: 14,
                alignItems: "flex-start",
                padding: "14px 0",
                borderBottom: `1px solid ${KZ.grey200}`,
              }}
            >
              <CheckSquare
                done={false}
                onClick={() => setStatus(item.id, "done")}
                label={`Mark done: ${item.title}`}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={doneTextStyle(false)}>{item.title}</div>
                <div
                  style={{
                    marginTop: 6,
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 10,
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    color: KZ.muted,
                  }}
                >
                  <Tag
                    tone={
                      item.direction === "we-owe"
                        ? KZ.blue
                        : item.direction === "they-owe"
                          ? KZ.amber
                          : KZ.muted
                    }
                  >
                    {item.direction === "we-owe"
                      ? "We owe"
                      : item.direction === "they-owe"
                        ? "They owe"
                        : "To do"}
                  </Tag>
                  {item.owner ? <span>{item.owner}</span> : null}
                  {/* Provenance travels with the item: a derived follow-up
                      always says where it was said. */}
                  {item.source ? <span>· {item.source.label}</span> : null}
                </div>
              </div>
            </li>
          ))}
        </List>
      )}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <Disclosure>
          Checkmarks are your working notes — saved in this browser only, never written back
        </Disclosure>
        <Link to="/p/$programId/follow-ups" params={{ programId: program.id }}>
          <Mono size={10.5} tone={KZ.blue}>
            All follow-ups
          </Mono>
        </Link>
      </div>
    </Panel>
  );
}

/**
 * The Notion checkbox tracker: an open count and the per-section split.
 *
 * Renders nothing when the program keeps no tracker, because an empty panel
 * labelled "Notion tracker" would imply one exists and is empty. Configuration
 * problems DO render, with the reason — a silently missing 42 open items is the
 * failure this panel exists to prevent.
 */
function NotionTrackerPanel({ program }: { program: ProgramConfig }) {
  const { isLoading, open, bySection, status } = useNotionTasks(program.id);
  if (status === "not-configured") return null;

  return (
    <Panel>
      <PanelHead
        label="Notion tracker"
        right={status === "ok" ? `${pad2(open.length)} open` : status}
        rightTone={status === "ok" ? undefined : KZ.amber}
      />
      {isLoading ? (
        <Mono size={11} style={{ display: "block", marginTop: 14 }}>
          Reading the tracker…
        </Mono>
      ) : status !== "ok" ? (
        <div style={{ marginTop: 14, fontSize: 13, lineHeight: 1.5, color: KZ.amber }}>
          {status === "no-token"
            ? "NOTION_API_KEY is not set, so the hand-maintained tracker is not being read. Open counts on this page reflect Linear only."
            : "Could not read the tracker page — usually it has not been shared with the Notion integration. Open counts on this page reflect Linear only."}
        </div>
      ) : open.length === 0 ? (
        <div style={{ marginTop: 14, fontSize: 13, color: KZ.body }}>
          Every checkbox on the tracker is ticked.
        </div>
      ) : (
        <>
          <List>
            {bySection
              .filter((g) => g.open.length > 0)
              .map((g) => (
                <li
                  key={g.section}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 14,
                    padding: "11px 0",
                    borderBottom: `1px solid ${KZ.grey200}`,
                  }}
                >
                  <Mono size={11} tone={KZ.ink} style={{ width: 28, textAlign: "right" }}>
                    {pad2(g.open.length)}
                  </Mono>
                  <span style={{ minWidth: 0, fontSize: 13.5 }}>{g.section}</span>
                </li>
              ))}
          </List>
          <Disclosure>
            Checkbox tasks from the sprint tracker page. Separate from the Linear board — most never
            became tickets, which is why the two counts do not add up
          </Disclosure>
        </>
      )}
    </Panel>
  );
}

/**
 * "No recent updates" — in-progress items Linear has not seen a change on
 * inside the aging window. Lists items rather than summarising, so the eye lands
 * on which cards are stalled rather than on a number.
 *
 * When nothing is stalled it says so instead of hiding: the absence is worth
 * reading, and hiding would make it indistinguishable from an unwired signal.
 */
function StalledPanel({
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
    <Panel>
      <PanelHead
        label="No recent updates"
        right={`${pad2(items.length)} of ${pad2(inProgressTotal)} in progress`}
        rightTone={items.length ? KZ.coral : undefined}
      />
      {items.length === 0 ? (
        <div style={{ marginTop: 14, fontSize: 13, color: KZ.body }}>
          Every in-progress item has been updated in the last {AGING_THRESHOLD_DAYS} days.
        </div>
      ) : (
        <List>
          {top.map((i) => (
            <li
              key={i.identifier}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 14,
                padding: "13px 0",
                borderBottom: `1px solid ${KZ.grey200}`,
              }}
            >
              <Mono size={11} tone={KZ.blue} style={{ width: 76, flex: "0 0 76px" }}>
                {i.identifier}
              </Mono>
              <span style={{ flex: 1, minWidth: 220, fontSize: 14, lineHeight: 1.35 }}>
                {i.url ? (
                  <a href={i.url} target="_blank" rel="noreferrer" style={{ color: KZ.ink }}>
                    {i.title}
                  </a>
                ) : (
                  i.title
                )}
              </span>
              <Tag
                tone={agingTone(i.severity)}
                title={`${i.daysSinceUpdate} days since Linear last saw a change on this issue (${i.severity})`}
              >
                {i.daysSinceUpdate}d {i.severity}
              </Tag>
              <Mono size={10.5} style={{ width: 60 }}>
                {i.workstream}
              </Mono>
              <Mono size={10.5} style={{ width: 110 }} title={i.assignee ?? "Unassigned"}>
                {i.assignee ?? "—"}
              </Mono>
            </li>
          ))}
        </List>
      )}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <Disclosure>
          Days since Linear last saw a change on the issue — any field, any comment. Not opened_at:
          an item created months ago but nudged this week is not stale
          {items.length > top.length ? ` · +${items.length - top.length} more` : ""}
        </Disclosure>
        <Link to="/p/$programId/sprint-board" params={{ programId: program.id }}>
          <Mono size={10.5} tone={KZ.blue}>
            Sprint board
          </Mono>
        </Link>
      </div>
    </Panel>
  );
}

/**
 * "Recently closed" — the same two-week slice as the aging panel, read the other
 * way. Canceled items carry a "dropped" tag rather than a green one: a canceled
 * ticket is a scope decision worth seeing, not a shipped win.
 */
function ClosedPanel({ program, items }: { program: ProgramConfig; items: ClosedItem[] }) {
  const top = items.slice(0, 10);
  return (
    <Panel>
      <PanelHead
        label="Recently closed"
        right={`${pad2(items.length)} in ${RECENTLY_CLOSED_WINDOW_DAYS}d`}
      />
      {items.length === 0 ? (
        <div style={{ marginTop: 14, fontSize: 13, color: KZ.body }}>
          Nothing closed in the last {RECENTLY_CLOSED_WINDOW_DAYS} days.
        </div>
      ) : (
        <List>
          {top.map((i) => {
            const dropped = i.bucket === "canceled";
            return (
              <li
                key={i.identifier}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 14,
                  padding: "13px 0",
                  borderBottom: `1px solid ${KZ.grey200}`,
                }}
              >
                <Mono size={11} tone={KZ.blue} style={{ width: 76, flex: "0 0 76px" }}>
                  {i.identifier}
                </Mono>
                <span style={{ flex: 1, minWidth: 220, fontSize: 14, lineHeight: 1.35 }}>
                  {i.url ? (
                    <a href={i.url} target="_blank" rel="noreferrer" style={{ color: KZ.ink }}>
                      {i.title}
                    </a>
                  ) : (
                    i.title
                  )}
                </span>
                <Tag
                  tone={dropped ? KZ.muted : KZ.green}
                  title={
                    dropped
                      ? `Canceled ${i.daysSinceClosed}d ago`
                      : `Closed ${i.daysSinceClosed}d ago`
                  }
                >
                  {dropped ? "dropped" : `${i.daysSinceClosed}d closed`}
                </Tag>
                <Mono size={10.5} style={{ width: 60 }}>
                  {i.workstream}
                </Mono>
                <Mono size={10.5} style={{ width: 110 }} title={i.assignee ?? "Unassigned"}>
                  {i.assignee ?? "—"}
                </Mono>
              </li>
            );
          })}
        </List>
      )}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <Disclosure>
          "Closed" is the Linear state change to done or canceled inside the window
          {items.length > top.length ? ` · +${items.length - top.length} more` : ""}
        </Disclosure>
        <Link to="/p/$programId/activity" params={{ programId: program.id }}>
          <Mono size={10.5} tone={KZ.blue}>
            Activity feed
          </Mono>
        </Link>
      </div>
    </Panel>
  );
}

/** Whole days between two YYYY-MM-DD dates, in local calendar terms. */
function dayDiff(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round(
    (new Date(ty, tm - 1, td).getTime() - new Date(fy, fm - 1, fd).getTime()) / 86400000,
  );
}

/** The aging bands, in the one accent scale the whole app uses. */
function agingTone(severity: StalledItem["severity"]): string {
  switch (severity) {
    case "cold":
      return KZ.coral;
    case "stalled":
      return KZ.amber;
    case "aging":
    default:
      return KZ.blue;
  }
}
