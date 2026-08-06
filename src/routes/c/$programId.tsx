import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, LogOut } from "lucide-react";
import { PROGRAMS, programById, upcomingMilestones, type ProgramConfig } from "@/lib/program.config";
import { useStoredData, bucketOf, type StoredLinearIssue } from "@/hooks/use-stored-data";
import { useFollowUps } from "@/hooks/use-follow-ups";
import { useNotionTasks } from "@/hooks/use-notion-tasks";
import { useClientAuth } from "@/hooks/use-client-auth";
import {
  phasesFromLifecycle,
  upcomingGateReadiness,
  recentlyClosed,
  lifecyclePhasesFor,
  today as todayIso,
} from "@/lib/program-model.adapters";
import { localDate, shortDate, daysUntilLocal } from "@/lib/local-date";

/**
 * Client-facing portal.
 *
 * Gated on useClientAuth: without a session, redirects to /c/login. The
 * session names the customer contact + which program they're allowed to
 * see, so someone signed in as "Chad Bowie / ventura" cannot land on /c/va
 * even by typing the URL — beforeLoad redirects them home.
 *
 * Demo-scoped: the session lives in localStorage, and the picker on
 * /c/login is unrestricted. Real deployment must swap in a signed-token
 * flow (Supabase magic-link is the drop-in) and pair it with Supabase RLS
 * on every table filtered by the client's authorised program id.
 */
export const Route = createFileRoute("/c/$programId")({
  beforeLoad: ({ params }) => {
    if (!PROGRAMS[params.programId]) throw notFound();
  },
  head: ({ params }) => {
    const p = PROGRAMS[params.programId];
    const client = p?.contract.customer ?? "";
    return {
      meta: [
        { title: `${client} — Program status` },
        {
          name: "description",
          content: `Delivery status for ${client}. Client portal.`,
        },
      ],
    };
  },
  component: ClientPortal,
});

function ClientPortal() {
  const { programId } = Route.useParams();
  const program = programById(programId);
  const navigate = useNavigate();
  const { user, hydrated, signOut } = useClientAuth();

  // Gate: unauthenticated visitors go to sign-in; a signed-in visitor whose
  // authorised program doesn't match this URL is bounced to theirs. Waits
  // for hydration so the first client render never contradicts the server.
  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      navigate({ to: "/c/login", replace: true });
      return;
    }
    if (user.programId !== programId) {
      navigate({
        to: "/c/$programId",
        params: { programId: user.programId },
        replace: true,
      });
    }
  }, [hydrated, user, programId, navigate]);

  const asOf = todayIso();
  const daysToLaunch = daysUntilLocal(program.keyDates.launch);
  const { linear, origin, isLoading } = useStoredData(program.id);
  const { items: followUps } = useFollowUps(program.id);
  // Hand-maintained tracker tasks. Same source the internal Team tasks page
  // reads; the client view shows counts and recent completions, not the raw
  // internal wording of every checkbox.
  const {
    tasks: trackerTasks,
    open: trackerOpen,
    done: trackerDone,
    status: trackerStatus,
  } = useNotionTasks(program.id);

  const phases = phasesFromLifecycle(program, asOf);
  const currentPhase = phases.find((p) => p.state === "in_progress") ?? null;
  const gates = upcomingGateReadiness(
    phases,
    linear.map((i) => ({ bucket: bucketOf(i), title: i.title, labels: i.labels ?? [] })),
    { asOf, program },
  );

  // Progress-so-far tallies. Everything that's ever closed, not just the
  // last 14 days — a client's "what's been done thus far" is the running
  // total, not a fortnight slice.
  // Both populations count. The Linear board is only the ticketed subset of the
  // work; the Notion tracker carries the rest, and on the VA program that is
  // the larger half. A client-facing "33% complete" computed off tickets alone
  // was describing a third of the engagement.
  const linearTracked = linear.filter((i) => bucketOf(i) !== "canceled").length;
  const linearDone = linear.filter((i) => bucketOf(i) === "done").length;
  const totalTracked = linearTracked + trackerTasks.length;
  const totalDone = linearDone + trackerDone.length;
  const pctDone = totalTracked ? Math.round((totalDone / totalTracked) * 100) : 0;
  const passedPhases = phases.filter((p) => p.state === "complete");
  const passedMilestones = [...program.sprintStrip, ...program.namedMilestones.map((m) => ({ key: m.id, label: m.label, end: m.date, start: m.date }))].filter(
    (m) => m.end < asOf,
  );

  const historyByMonth = groupClosedByMonth(linear);

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
  const statusHeadline = deriveHeadline(daysToLaunch, gates.length, gates[0]?.pressure);
  const usesPhases = program.timeAxis === "phase";

  // Nothing gated after hydration + auth check — render blank while
  // redirecting so a stale VA screen doesn't flash on a Ventura contact.
  if (!hydrated || !user || user.programId !== programId) {
    return <div style={{ minHeight: "100vh", backgroundColor: "#f7f7f5" }} />;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f7f7f5", color: "#1b1b1b" }}>
      {/* Top bar — customer sign-in identity + sign out. Not a full nav.
          A client portal doesn't need program switching or admin controls. */}
      <div
        className="flex items-center justify-between border-b px-4 py-2 text-[12px] md:px-8"
        style={{ backgroundColor: "#ffffff", borderColor: "#e5e5e2", color: "#565c65" }}
      >
        <div className="truncate">
          Signed in as <span style={{ color: "#1b1b1b", fontWeight: 600 }}>{user.name}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            signOut();
            navigate({ to: "/c/login", replace: true });
          }}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 font-medium hover:bg-neutral-100"
          style={{ color: "#565c65" }}
        >
          <LogOut size={12} /> Sign out
        </button>
      </div>

      {/* Hero */}
      <header
        className="px-6 py-8 md:px-10 md:py-12"
        style={{ backgroundColor: program.navColor, color: "#ffffff" }}
      >
        <div className="mx-auto max-w-4xl">
          <SealMark program={program} />
          <h1
            className="text-2xl font-semibold md:text-3xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {program.contract.customer}
          </h1>
          <p className="mt-1 text-sm opacity-90 md:text-base">{program.domainLabel}</p>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <HeroStat
              label="Launch"
              value={program.keyDates.launchLabel}
              sub={
                daysToLaunch > 0
                  ? `${daysToLaunch} days away`
                  : daysToLaunch === 0
                    ? "today"
                    : `${-daysToLaunch} days past`
              }
            />
            <HeroStat
              label={usesPhases ? "Current phase" : "Current milestone"}
              value={currentPhase?.name ?? "—"}
              sub={currentPhase?.window ?? ""}
            />
            <HeroStat label="Status" value={statusHeadline.label} sub={statusHeadline.sub} />
          </div>
        </div>
      </header>

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
            {trackerStatus === "ok" && trackerDone.length > 0 ? (
              <TrackerCompletedSection done={trackerDone} openCount={trackerOpen.length} />
            ) : null}
            <HistorySection history={historyByMonth} />
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
    </div>
  );
}

// -------- sections --------

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
 * Delivery tasks completed off the hand-maintained tracker.
 *
 * Kept separate from "Recently shipped" (which is Linear closures with real
 * dates) because a ticked checkbox carries no completion timestamp — Notion
 * does not record when a to_do was checked. So this section can say WHAT was
 * completed but not WHEN, and it says so rather than borrowing the page's
 * last-edited time and presenting it as a per-item date.
 */
function TrackerCompletedSection({
  done,
  openCount,
}: {
  done: ReturnType<typeof useNotionTasks>["done"];
  openCount: number;
}) {
  return (
    <Section title="Delivery tasks completed">
      <ul className="space-y-1.5">
        {done.map((t) => (
          <li key={t.id} className="flex items-start gap-2 text-sm">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: "#1f5c2f" }} />
            <span style={{ color: "#1b1b1b" }}>{t.text}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 text-xs" style={{ color: "#8a8a80" }}>
        {done.length} complete · {openCount} still open. These are delivery
        tasks tracked outside the engineering board. No completion dates: the
        source records that an item is done, not when it was ticked.
      </div>
    </Section>
  );
}

/**
 * The "what's been done thus far" history — every closed item grouped by
 * the month it closed. Answers a client returning after a month with
 * "what happened since I last checked."
 */
function HistorySection({ history }: { history: Array<{ month: string; label: string; items: StoredLinearIssue[] }> }) {
  if (history.length === 0) return null;
  return (
    <Section title="Delivery history">
      <div className="space-y-4">
        {history.map((group) => (
          <div key={group.month}>
            <h3
              className="mb-2 text-xs font-semibold uppercase tracking-wide"
              style={{ color: "#565c65" }}
            >
              {group.label} · {group.items.length} shipped
            </h3>
            <ul className="space-y-1.5">
              {group.items.map((i) => (
                <li key={i.identifier} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0" style={{ color: "#1f5c2f" }} />
                  <span style={{ color: "#1b1b1b" }}>{i.title}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

// -------- primitives --------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2
        className="mb-3 text-base font-semibold md:text-lg"
        style={{ fontFamily: "var(--font-display)", color: "#1b1b1b" }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Program seal for the hero. Attempts the configured src; on 404 or missing
 * config, falls back to an initials chip rather than showing a broken image
 * glyph. A hand-approximated seal on a customer-facing screen would
 * misrepresent an official mark, so the fallback is deliberately a flat
 * lettermark instead.
 */
function SealMark({ program }: { program: ProgramConfig }) {
  const [failed, setFailed] = useState(false);
  if (program.seal.src && !failed) {
    return (
      <img
        src={program.seal.src}
        alt={program.seal.alt}
        onError={() => setFailed(true)}
        className="mb-4 h-10 w-10 object-contain md:h-12 md:w-12"
      />
    );
  }
  // Initials source: program.name reads cleaner than the long-form customer
  // string. Two rules:
  //   1. If the first token is an existing short all-caps acronym (VA, USDA,
  //      NASA, etc.), use it as-is. "VA Website Redesign" -> "VA", not "VW".
  //   2. Otherwise, first character of the first two non-filler words.
  //      "Ventura County Parks" -> "VC".
  const filler = new Set(["of", "the", "and", "for", "a", "an"]);
  const tokens = program.name.split(/\s+/).filter((w) => w && !filler.has(w.toLowerCase()));
  const first = tokens[0] ?? "";
  const isAcronym = first.length >= 2 && first.length <= 5 && first === first.toUpperCase();
  const initials = isAcronym
    ? first
    : tokens
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase();
  return (
    <div
      aria-hidden="true"
      className="mb-4 flex h-10 w-10 items-center justify-center rounded-md text-sm font-semibold md:h-12 md:w-12 md:text-base"
      style={{ backgroundColor: "rgba(255,255,255,0.14)", color: "#ffffff" }}
    >
      {initials || "•"}
    </div>
  );
}

function HeroStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.10)" }}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {sub ? <div className="mt-0.5 text-xs opacity-80">{sub}</div> : null}
    </div>
  );
}

function ProgressCard({ label, primary, sub }: { label: string; primary: string; sub: string }) {
  return (
    <div className="rounded-lg bg-white p-4" style={{ border: "1px solid #e5e5e2" }}>
      <div className="text-xs uppercase tracking-wide" style={{ color: "#565c65" }}>
        {label}
      </div>
      <div
        className="mt-1 text-2xl font-semibold"
        style={{ fontFamily: "var(--font-display)", color: "#1b1b1b" }}
      >
        {primary}
      </div>
      {sub ? <div className="mt-0.5 text-xs" style={{ color: "#565c65" }}>{sub}</div> : null}
    </div>
  );
}

// -------- helpers --------

function deriveHeadline(
  daysToLaunch: number,
  openGates: number,
  worstPressure: number | undefined,
): { label: string; sub: string } {
  if (daysToLaunch < 0) return { label: "Post-launch", sub: "In customer handoff" };
  if (worstPressure !== undefined && worstPressure >= 0.75)
    return { label: "Attention needed", sub: `${openGates} open gates` };
  if (worstPressure !== undefined && worstPressure >= 0.5)
    return { label: "On track, close watch", sub: `${openGates} open gates` };
  if (openGates > 0) return { label: "On track", sub: `${openGates} open gates` };
  return { label: "On track", sub: "" };
}

function clientBand(p: number): { fg: string; border: string } {
  if (p >= 0.75) return { fg: "#8a1c1c", border: "#f0c9c9" };
  if (p >= 0.5) return { fg: "#8a4a00", border: "#f0d9b8" };
  if (p >= 0.25) return { fg: "#5a4a00", border: "#e8dfb8" };
  return { fg: "#1f5c2f", border: "#d0e0d0" };
}

function phaseSummary(program: ProgramConfig, phaseId: string): string {
  const raw = lifecyclePhasesFor(program).find((p) => p.id === phaseId);
  if (!raw) return "";
  return raw.goal.replace(/([a-z]+)@[a-z0-9.-]+/gi, "$1");
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((localDate(toIso).getTime() - localDate(fromIso).getTime()) / 86400000);
}

/**
 * Group done items by the month their state changed to done. Uses
 * source_updated_at (closure time in Linear). Sorted newest month first.
 * Items missing updatedAt are omitted — a shipped item with no closure
 * timestamp is a data-quality problem, not a customer-facing surprise.
 */
function groupClosedByMonth(
  items: StoredLinearIssue[],
): Array<{ month: string; label: string; items: StoredLinearIssue[] }> {
  const closed = items.filter((i) => bucketOf(i) === "done" && i.source_updated_at);
  const byMonth = new Map<string, StoredLinearIssue[]>();
  for (const item of closed) {
    const day = item.source_updated_at!.slice(0, 7); // YYYY-MM
    const arr = byMonth.get(day) ?? [];
    arr.push(item);
    byMonth.set(day, arr);
  }
  const groups = Array.from(byMonth.entries()).map(([month, items]) => ({
    month,
    label: monthLabel(month),
    items: items.sort((a, b) => (b.source_updated_at ?? "").localeCompare(a.source_updated_at ?? "")),
  }));
  return groups.sort((a, b) => b.month.localeCompare(a.month));
}

function monthLabel(monthIso: string): string {
  const [y, m] = monthIso.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
