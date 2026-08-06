import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { programById, upcomingMilestones, type ProgramConfig } from "@/lib/program.config";
import { useStoredData, bucketOf } from "@/hooks/use-stored-data";
import { useFollowUps } from "@/hooks/use-follow-ups";
import { useNotionTasks } from "@/hooks/use-notion-tasks";
import { summarizeTask, tidySection } from "@/lib/task-summary";
import {
  phasesFromLifecycle,
  upcomingGateReadiness,
  recentlyClosed,
  today as todayIso,
} from "@/lib/program-model.adapters";
import { shortDate, daysUntilLocal } from "@/lib/local-date";
import {
  Section,
  ProgressCard,
  clientBand,
  phaseSummary,
  daysBetween,
  groupClosedByMonth,
} from "../-shared";

/**
 * Client portal overview.
 *
 * Everything a customer needs at a glance: how far along, what is being
 * driven next, what is coming, what is waiting on them, what shipped
 * lately. The full record lives one click away at ./history rather than
 * expanded inline — a year of closures under the fold is an archive, not
 * a status page.
 */
export const Route = createFileRoute("/c/$programId/")({
  component: ClientOverview,
});

function ClientOverview() {
  const { programId } = Route.useParams();
  const program = programById(programId);
  const asOf = todayIso();
  const daysToLaunch = daysUntilLocal(program.keyDates.launch);

  const { linear, origin, isLoading } = useStoredData(program.id);
  const { items: followUps } = useFollowUps(program.id);
  const {
    tasks: trackerTasks,
    done: trackerDone,
    status: trackerStatus,
    bySection: trackerBySection,
  } = useNotionTasks(program.id);

  const phases = phasesFromLifecycle(program, asOf);
  const gates = upcomingGateReadiness(
    phases,
    linear.map((i) => ({ bucket: bucketOf(i), title: i.title, labels: i.labels ?? [] })),
    { asOf, program },
  );

  // Both populations count. The Linear board is only the ticketed subset of
  // the work; the Notion tracker carries the rest, and on the VA program that
  // is the larger half.
  const linearTracked = linear.filter((i) => bucketOf(i) !== "canceled").length;
  const linearDone = linear.filter((i) => bucketOf(i) === "done").length;
  const totalTracked = linearTracked + trackerTasks.length;
  const totalDone = linearDone + trackerDone.length;
  const pctDone = totalTracked ? Math.round((totalDone / totalTracked) * 100) : 0;

  const passedPhases = phases.filter((p) => p.state === "complete");
  const passedMilestones = [
    ...program.sprintStrip,
    ...program.namedMilestones.map((m) => ({ key: m.id, label: m.label, end: m.date, start: m.date })),
  ].filter((m) => m.end < asOf);

  const historyByMonth = groupClosedByMonth(linear);
  const shippedTotal = historyByMonth.reduce((n, g) => n + g.items.length, 0);

  const closedRecent = recentlyClosed(
    linear.map((i) => ({
      identifier: i.identifier,
      title: i.title,
      bucket: bucketOf(i),
      updatedAt: i.source_updated_at,
      assignee: i.assignee,
      priority: i.priority,
      workstream: "",
      url: i.url,
    })),
    asOf,
  ).slice(0, 8);

  const clientOwes = followUps
    .filter((f) => f.status === "open" && f.direction === "they-owe")
    .slice(0, 10);

  const milestonesAhead = upcomingMilestones(program, asOf, 6);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8 md:px-10 md:py-10">
      {isLoading ? (
        <p style={{ color: "#565c65" }}>Loading…</p>
      ) : (
        <div className="space-y-10">
          <ProgressSoFarSection
            pctDone={pctDone}
            totalDone={totalDone}
            totalTracked={totalTracked}
            linearDone={linearDone}
            linearTracked={linearTracked}
            trackerDone={trackerDone.length}
            trackerTotal={trackerTasks.length}
            trackerAvailable={trackerStatus === "ok"}
            passedPhases={passedPhases.length}
            totalPhases={phases.length}
            milestonesPassed={passedMilestones.length}
          />
          <NextUpSection gates={gates} program={program} />
          <MilestonesSection milestones={milestonesAhead} asOf={asOf} />
          <ClientOwesSection items={clientOwes} customer={program.contract.customer} />
          <RecentWinsSection items={closedRecent} />
          {trackerStatus === "ok" && trackerTasks.length > 0 ? (
            <WorkstreamRollupSection groups={trackerBySection} />
          ) : null}
          <HistoryCallout
            programId={programId}
            shippedTotal={shippedTotal}
            monthsCovered={historyByMonth.length}
          />
        </div>
      )}

      <footer
        className="mt-12 border-t pt-6 text-xs"
        style={{ borderColor: "#e5e5e2", color: "#8a8a80" }}
      >
        Delivered by Kaizen Laboratories. As of {asOf}. Engineering tickets
        {origin === "snapshot" ? " last captured" : " read live"} from Linear
        {trackerStatus === "ok" ? "; delivery tasks read live from Notion" : ""}. Detail
        omitted where it would misrepresent as inferred what the source didn't state.
      </footer>
    </main>
  );
}

/**
 * Doorway to the full record, in place of the record itself.
 *
 * The overview answers "where are we"; the archive answers "what have you
 * done for us". Those are different questions asked at different moments,
 * and stacking a year of closures under the second one buried the first.
 * The counts here are real, so the button says what is behind it rather
 * than being a bare link.
 */
function HistoryCallout({
  programId,
  shippedTotal,
  monthsCovered,
}: {
  programId: string;
  shippedTotal: number;
  monthsCovered: number;
}) {
  if (shippedTotal === 0) return null;
  return (
    <section
      className="rounded-lg bg-white p-5"
      style={{ border: "1px solid #e5e5e2" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2
            className="text-base font-semibold md:text-lg"
            style={{ fontFamily: "var(--font-display)", color: "#1b1b1b" }}
          >
            Delivery history
          </h2>
          <p className="mt-1 text-sm" style={{ color: "#565c65" }}>
            See everything delivered on this program so far — {shippedTotal} items
            across {monthsCovered} {monthsCovered === 1 ? "month" : "months"}, grouped
            by when each one shipped.
          </p>
        </div>
        <Link
          to="/c/$programId/history"
          params={{ programId }}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium"
          style={{ backgroundColor: "#1f3d2b", color: "#ffffff" }}
        >
          See all your delivery history
          <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  );
}

function ProgressSoFarSection({
  pctDone,
  totalDone,
  totalTracked,
  linearDone,
  linearTracked,
  trackerDone,
  trackerTotal,
  trackerAvailable,
  passedPhases,
  totalPhases,
  milestonesPassed,
}: {
  pctDone: number;
  totalDone: number;
  totalTracked: number;
  linearDone: number;
  linearTracked: number;
  trackerDone: number;
  trackerTotal: number;
  trackerAvailable: boolean;
  passedPhases: number;
  totalPhases: number;
  milestonesPassed: number;
}) {
  return (
    <Section title="Progress so far">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ProgressCard
          label="Work completed"
          primary={`${pctDone}%`}
          sub={`${totalDone} of ${totalTracked} tracked items`}
        />
        <ProgressCard
          label={totalPhases > 0 ? "Phases passed" : "—"}
          primary={totalPhases > 0 ? `${passedPhases} / ${totalPhases}` : "—"}
          sub={totalPhases > 0 ? "delivery stages complete" : ""}
        />
        <ProgressCard
          label="Milestones passed"
          primary={`${milestonesPassed}`}
          sub="dated checkpoints already met"
        />
      </div>
      {totalTracked > 0 ? (
        <div
          className="mt-4 h-2 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: "#e5e5e2" }}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${pctDone}%`, backgroundColor: "#2e8540" }}
          />
        </div>
      ) : null}
      {/* Where the number comes from. A single percentage over two populations
          invites "percent of what?", and the honest answer is worth one line:
          the engineering board plus the delivery-task tracker. */}
      {trackerAvailable && trackerTotal > 0 ? (
        <div className="mt-3 text-xs" style={{ color: "#565c65" }}>
          {linearDone} of {linearTracked} engineering tickets · {trackerDone} of {trackerTotal}{" "}
          delivery tasks.
        </div>
      ) : null}
    </Section>
  );
}

function NextUpSection({
  gates,
  program,
}: {
  gates: ReturnType<typeof upcomingGateReadiness>;
  program: ProgramConfig;
}) {
  if (gates.length === 0) return null;
  const top = gates.slice(0, 3);
  return (
    <Section title="What we're driving next">
      <div className="space-y-3">
        {top.map((g) => {
          const band = clientBand(g.pressure);
          return (
            <div
              key={g.phaseId}
              className="rounded-lg bg-white p-4"
              style={{ border: `1px solid ${band.border}` }}
            >
              <div className="flex flex-wrap items-baseline gap-3">
                <div className="text-sm font-semibold" style={{ color: band.fg }}>
                  {g.phaseName}
                </div>
                <div className="text-xs" style={{ color: "#565c65" }}>
                  {g.daysRemaining >= 0
                    ? `${g.daysRemaining} days remaining`
                    : `${-g.daysRemaining} days past`}
                </div>
              </div>
              <p className="mt-2 text-sm" style={{ color: "#333" }}>
                {phaseSummary(program, g.phaseId)}
              </p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function MilestonesSection({
  milestones,
  asOf,
}: {
  milestones: Array<{ label: string; date: string }>;
  asOf: string;
}) {
  if (milestones.length === 0) return null;
  return (
    <Section title="Upcoming milestones">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {milestones.map((m) => {
          const days = daysBetween(asOf, m.date);
          return (
            <div
              key={`${m.label}-${m.date}`}
              className="rounded-lg bg-white p-3"
              style={{ border: "1px solid #e5e5e2" }}
            >
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#565c65" }}>
                {days > 0 ? `in ${days} days` : days === 0 ? "today" : `${-days} days past`}
              </div>
              <div className="mt-1 text-sm font-semibold" style={{ color: "#1b1b1b" }}>
                {m.label}
              </div>
              <div className="mt-0.5 text-xs" style={{ color: "#565c65" }}>
                {shortDate(m.date)}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function ClientOwesSection({
  items,
  customer,
}: {
  items: ReturnType<typeof useFollowUps>["items"];
  customer: string;
}) {
  if (items.length === 0) {
    return (
      <Section title={`Open with ${customer}`}>
        <div
          className="rounded-lg bg-white p-4 text-sm"
          style={{ border: "1px solid #e5e5e2", color: "#565c65" }}
        >
          Nothing pending on your side right now.
        </div>
      </Section>
    );
  }
  return (
    <Section title={`Open with ${customer}`}>
      <ul className="space-y-2">
        {items.map((f) => (
          <li
            key={f.id}
            className="flex items-start gap-3 rounded-lg bg-white p-3"
            style={{ border: "1px solid #e5e5e2" }}
          >
            <Circle size={16} className="mt-0.5 shrink-0" style={{ color: "#565c65" }} />
            <div className="min-w-0 flex-1">
              <div className="text-sm" style={{ color: "#1b1b1b" }}>
                {f.title}
              </div>
              {f.detail ? (
                <div className="mt-1 text-xs" style={{ color: "#565c65" }}>
                  {f.detail}
                </div>
              ) : null}
              {f.owner ? (
                <div className="mt-1 text-xs" style={{ color: "#8a8a80" }}>
                  {f.owner}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function RecentWinsSection({ items }: { items: ReturnType<typeof recentlyClosed> }) {
  const shipped = items.filter((i) => i.bucket === "done");
  if (shipped.length === 0) return null;
  return (
    <Section title="Recently shipped">
      <ul className="space-y-2">
        {shipped.map((i) => (
          <li key={i.identifier} className="flex items-start gap-3">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: "#1f5c2f" }} />
            <div className="min-w-0 flex-1">
              <span className="text-sm" style={{ color: "#1b1b1b" }}>
                {i.title}
              </span>
              <span className="ml-2 text-xs" style={{ color: "#8a8a80" }}>
                {i.daysSinceClosed === 0 ? "today" : `${i.daysSinceClosed}d ago`}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/**
 * Delivery workstreams, rolled up.
 *
 * The internal Team tasks page lists every checkbox. A client does not want
 * sixty lines of another team's working notes — they want to know which areas
 * are moving and roughly how far along each is. So this renders one card per
 * tracker section with a completion bar, and names only the first few
 * headlines under each as evidence rather than as an inventory.
 *
 * Headlines come from summarizeTask, which splits the author's line at its
 * first natural break. Nothing is paraphrased: what shows is the author's own
 * words up to that break, and the "+N more" tail states exactly how much is
 * not being shown so the card cannot read as a complete list.
 */
const CLIENT_HEADLINES_PER_SECTION = 3;

function WorkstreamRollupSection({
  groups,
}: {
  groups: ReturnType<typeof useNotionTasks>["bySection"];
}) {
  const active = groups.filter((g) => g.open.length + g.done.length > 0);
  if (active.length === 0) return null;

  return (
    <Section title="Delivery workstreams">
      <div className="space-y-3">
        {active.map((g) => {
          const total = g.open.length + g.done.length;
          const pct = total ? Math.round((g.done.length / total) * 100) : 0;
          // Lead with what is still moving; fall back to completed work when a
          // section is finished, so a done area still shows what it delivered.
          const source = g.open.length > 0 ? g.open : g.done;
          const shown = source.slice(0, CLIENT_HEADLINES_PER_SECTION);
          const hidden = source.length - shown.length;
          return (
            <div
              key={g.section}
              className="rounded-lg bg-white p-4"
              style={{ border: "1px solid #e5e5e2" }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-sm font-semibold" style={{ color: "#1b1b1b" }}>
                  {tidySection(g.section)}
                </div>
                <div className="text-xs" style={{ color: "#565c65" }}>
                  {g.done.length} of {total} complete
                </div>
              </div>
              <div
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: "#ececea" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: "#2e8540" }}
                />
              </div>
              <ul className="mt-3 space-y-1">
                {shown.map((t) => {
                  const sum = summarizeTask(t.text);
                  return (
                    <li key={t.id} className="flex items-start gap-2 text-xs">
                      {t.checked ? (
                        <CheckCircle2
                          size={13}
                          className="mt-0.5 shrink-0"
                          style={{ color: "#1f5c2f" }}
                        />
                      ) : (
                        <Circle size={13} className="mt-0.5 shrink-0" style={{ color: "#8a8a80" }} />
                      )}
                      <span style={{ color: "#333" }}>{sum.headline}</span>
                    </li>
                  );
                })}
              </ul>
              {hidden > 0 ? (
                <div className="mt-2 text-xs" style={{ color: "#8a8a80" }}>
                  +{hidden} more {g.open.length > 0 ? "in progress" : "complete"}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-xs" style={{ color: "#8a8a80" }}>
        Delivery tasks tracked alongside the engineering board. Completion is a
        count of items, not effort — and the source records that a task is done,
        not the date it was completed.
      </div>
    </Section>
  );
}

/**
 * The "what's been done thus far" history — every closed item grouped by
 * the month it closed. Answers a client returning after a month with
 * "what happened since I last checked."
 */

// -------- primitives --------





// -------- helpers --------
