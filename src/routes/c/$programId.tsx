import { createFileRoute, notFound, useNavigate, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { LogOut } from "lucide-react";
import { PROGRAMS, programById } from "@/lib/program.config";
import { useStoredData, bucketOf } from "@/hooks/use-stored-data";
import { useClientAuth } from "@/hooks/use-client-auth";
import {
  phasesFromLifecycle,
  upcomingGateReadiness,
  today as todayIso,
} from "@/lib/program-model.adapters";
import { daysUntilLocal } from "@/lib/local-date";
import { SealMark, HeroStat, deriveHeadline } from "./-shared";

/**
 * Client portal layout: auth gate, identity bar, hero, breadcrumb.
 *
 * The portal is two pages sharing this frame — the overview at
 * /c/$programId and the full record at /c/$programId/history. Hero and gate
 * live here so navigating between them does not re-mount the header or
 * re-run the redirect check.
 *
 * Gated on useClientAuth: without a session, redirects to /c/login. A
 * session names the customer contact AND the one program they may see, so
 * someone signed in as "Chad Bowie / ventura" landing on /c/va is bounced
 * to their own program rather than shown someone else's engagement.
 *
 * Demo-scoped: the session is localStorage and the picker on /c/login is
 * unrestricted. Real deployment must swap in a signed-token flow (Supabase
 * magic-link is the drop-in) paired with RLS filtered by authorised program.
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
  component: ClientPortalLayout,
});

function ClientPortalLayout() {
  const { programId } = Route.useParams();
  const program = programById(programId);
  const navigate = useNavigate();
  const { user, hydrated, signOut } = useClientAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      navigate({ to: "/c/login", replace: true });
      return;
    }
    if (user.programId !== programId) {
      navigate({ to: "/c/$programId", params: { programId: user.programId }, replace: true });
    }
  }, [hydrated, user, programId, navigate]);

  const asOf = todayIso();
  const daysToLaunch = daysUntilLocal(program.keyDates.launch);
  const { linear } = useStoredData(program.id);
  const phases = phasesFromLifecycle(program, asOf);
  const currentPhase = phases.find((p) => p.state === "in_progress") ?? null;
  const gates = upcomingGateReadiness(
    phases,
    linear.map((i) => ({ bucket: bucketOf(i), title: i.title, labels: i.labels ?? [] })),
    { asOf, program },
  );
  const statusHeadline = deriveHeadline(daysToLaunch, gates.length, gates[0]?.pressure);
  const usesPhases = program.timeAxis === "phase";
  const onHistory = pathname.endsWith("/history");

  // Blank while the redirect fires, so a stale program never flashes.
  if (!hydrated || !user || user.programId !== programId) {
    return <div style={{ minHeight: "100vh", backgroundColor: "#f7f7f5" }} />;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f7f7f5", color: "#1b1b1b" }}>
      <div
        className="flex items-center justify-between border-b px-4 py-2 text-xs md:px-8"
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

      {/* Breadcrumb. Only rendered off the overview — a single crumb reading
          "Overview" on the overview is chrome that says nothing. */}
      {onHistory ? (
        <nav
          className="mx-auto max-w-4xl px-6 pt-6 text-xs md:px-10"
          style={{ color: "#565c65" }}
          aria-label="Breadcrumb"
        >
          <Link
            to="/c/$programId"
            params={{ programId }}
            className="font-medium hover:underline"
            style={{ color: "#3a5a40" }}
          >
            Overview
          </Link>
          <span className="mx-2" aria-hidden>
            /
          </span>
          <span style={{ color: "#1b1b1b" }}>Delivery history</span>
        </nav>
      ) : null}

      <Outlet />
    </div>
  );
}
