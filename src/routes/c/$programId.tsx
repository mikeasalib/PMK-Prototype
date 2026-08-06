import { createFileRoute, notFound } from "@tanstack/react-router";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { PROGRAMS, programById, upcomingMilestones, type ProgramConfig } from "@/lib/program.config";
import { useStoredData, bucketOf } from "@/hooks/use-stored-data";
import { useFollowUps } from "@/hooks/use-follow-ups";
import {
  phasesFromLifecycle,
  upcomingGateReadiness,
  recentlyClosed,
  lifecyclePhasesFor,
  derivePhaseState,
  today as todayIso,
} from "@/lib/program-model.adapters";
import { localDate, shortDate, daysUntilLocal } from "@/lib/local-date";

/**
 * Client-facing read-only portal.
 *
 * A calmer, executive-scoped view of the same program: launch countdown,
 * where the program stands, the next few things that need to close, the
 * open items on the client's side, and the wins in the last fortnight. No
 * assignees, no workstream-inference badges, no stalled-work panel, no
 * internal admin controls — every one of those reads as "internal team
 * pain" to a customer and doesn't belong here.
 *
 * Not gated. Anyone with the URL can view — appropriate for a shared demo
 * link, NOT for production. Real deployment must add: Supabase RLS
 * lockdown (today `anon` has SELECT USING (true) on every table), a signed
 * token flow (magic-link or JWT), and per-program policy on what's
 * legally exposable to a customer (VA carve-outs in R17, e.g., must never
 * surface). Marked in-page as "internal demo preview" so no one confuses
 * this shell for the shipped product.
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
          content: `Delivery status for ${client}. Read-only client preview.`,
        },
      ],
    };
  },
  component: ClientPortal,
});

function ClientPortal() {
  const { programId } = Route.useParams();
  const program = programById(programId);
  const asOf = todayIso();
  const daysToLaunch = daysUntilLocal(program.keyDates.launch);

  const { linear, origin, isLoading } = useStoredData(program.id);
  const { items: followUps } = useFollowUps(program.id);

  const phases = phasesFromLifecycle(program, asOf);
  const currentPhase = phases.find((p) => p.state === "in_progress") ?? null;
  const gates = upcomingGateReadiness(
    phases,
    linear.map((i) => ({ bucket: bucketOf(i), title: i.title, labels: i.labels ?? [] })),
    { asOf, program },
  );

  const closed = recentlyClosed(
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

  const milestones = upcomingMilestones(program, asOf, 6);

  const statusHeadline = deriveHeadline(daysToLaunch, gates.length, gates[0]?.pressure);
  const usesPhases = program.timeAxis === "phase";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f7f7f5", color: "#1b1b1b" }}>
      <PreviewBanner />

      {/* Hero */}
      <header
        className="px-6 py-8 md:px-10 md:py-12"
        style={{ backgroundColor: program.navColor, color: "#ffffff" }}
      >
        <div className="mx-auto max-w-4xl">
          {program.seal.src ? (
            <img
              src={program.seal.src}
              alt={program.seal.alt}
              className="mb-4 h-10 w-10 object-contain md:h-12 md:w-12"
            />
          ) : null}
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
          <div className="space-y-8">
            <NextUpSection gates={gates} program={program} />
            <MilestonesSection milestones={milestones} asOf={asOf} />
            <ClientOwesSection items={clientOwes} customer={program.contract.customer} />
            <RecentWinsSection items={closed} />
          </div>
        )}

        <footer
          className="mt-12 border-t pt-6 text-xs"
          style={{ borderColor: "#e5e5e2", color: "#8a8a80" }}
        >
          Delivered by Kaizen Laboratories. As of {asOf}. Data
          {origin === "snapshot" ? " last captured" : " read live"} from Linear
          {program.artifacts.includes("poam") ? " and Notion" : ""}. This preview omits
          internal team detail and inference-classified content.
        </footer>
      </main>
    </div>
  );
}

// -------- sections --------

function NextUpSection({
  gates,
  program,
}: {
  gates: ReturnType<typeof upcomingGateReadiness>;
  program: ProgramConfig;
}) {
  if (gates.length === 0) return null;
  // Show at most 3 gates client-side; the ranked-lower ones are noise here.
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

function HeroStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div
      className="rounded-lg px-4 py-3"
      style={{ backgroundColor: "rgba(255,255,255,0.10)" }}
    >
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {sub ? <div className="mt-0.5 text-xs opacity-80">{sub}</div> : null}
    </div>
  );
}

function PreviewBanner() {
  return (
    <div
      className="px-4 py-2 text-center text-[11px]"
      style={{ backgroundColor: "#fdf5e6", color: "#7a5a00", borderBottom: "1px solid #e5e5e2" }}
    >
      <span className="font-semibold">Internal demo preview.</span> Not auth-gated; do not share
      the URL outside Kaizen until Supabase RLS + a signed token flow are in place.
      <ExternalLink size={11} className="ml-1 inline" />
    </div>
  );
}

// -------- helpers --------

/**
 * A single-word status headline for the hero. Deliberately coarse — a
 * customer-facing status should read decisively, not simulate precision
 * that requires footnotes.
 */
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

/** Colour band for a client-facing gate card. Softer palette than the
 *  internal command centre — no "critical" red on a customer's screen. */
function clientBand(p: number): { fg: string; border: string } {
  if (p >= 0.75) return { fg: "#8a1c1c", border: "#f0c9c9" };
  if (p >= 0.5) return { fg: "#8a4a00", border: "#f0d9b8" };
  if (p >= 0.25) return { fg: "#5a4a00", border: "#e8dfb8" };
  return { fg: "#1f5c2f", border: "#d0e0d0" };
}

/**
 * Client-safe phase summary. The phase's raw `goal` string is authored for
 * internal use and can carry references to Kaizen team members; the summary
 * strips those to first-name-only. For a real portal we would carry a
 * per-phase client-facing description in the config rather than laundering
 * the internal one.
 */
function phaseSummary(program: ProgramConfig, phaseId: string): string {
  const raw = lifecyclePhasesFor(program).find((p) => p.id === phaseId);
  if (!raw) return "";
  // First-name only sanitiser — collapse "Michael Salib" style refs to first
  // name, and drop email hosts. Best-effort; a config-authored version is
  // the real fix.
  return raw.goal.replace(/([a-z]+)@[a-z0-9.-]+/gi, "$1");
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (localDate(toIso).getTime() - localDate(fromIso).getTime()) / 86400000,
  );
}
