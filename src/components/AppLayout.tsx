import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { DataSourcesFooter } from "./DataSourcesFooter";
import { ProgramSwitcher } from "./ProgramSwitcher";
import { RefreshButton } from "./RefreshButton";
import { Eyebrow, KZ, Mono, RAIL, pad2 } from "./kz";
import { seedFor } from "@/lib/program-seed";
import { useProgram } from "@/routes/p/$programId/route";
import { useNavPrefs } from "@/hooks/use-nav-prefs";

/**
 * Sidebar destinations.
 *
 * Flat and complete: every route the app has is its own row, in the order the
 * design fixes — the federated search first, the landing screen second, then
 * the read-outs, then the plan, then the register and the reference material.
 *
 * The previous shell collapsed thirteen rows into six and reached the rest
 * through a tab strip and two header controls. That traded a long list for a
 * hidden one: nothing in "Work" told you the board and the dependency map were
 * behind it. This design pays for the length with typography instead — 13.5px
 * rows at 1px gaps on a graphite rail, unwired screens dimmed — so the full map
 * is visible without a click.
 *
 * Follow-ups is the one child row: it is the sub-issue companion to Team tasks,
 * the things caught between calls that never became a Linear issue.
 *
 * The leading "/p/$programId" is a literal route id, not a template string —
 * TanStack fills the param from `params`.
 */
const NAV = [
  // Dust, not "Search": the query surface is the Dust platform in a wired
  // deployment, and the screen says so rather than letting the name imply a
  // plain local search box. /search still resolves — it redirects here.
  { to: "/p/$programId/dust", label: "Dust" },
  { to: "/p/$programId/program-overview", label: "Command centre" },
  { to: "/p/$programId/brief", label: "Brief" },
  { to: "/p/$programId/customer-health", label: "Customer health" },
  // "What's important" is gone: its KPI strip and milestones are on the command
  // centre and its lists are Team tasks, so the row was a second door to rooms
  // already in the nav. /p/$programId redirects to the command centre.
  { to: "/p/$programId/team-tasks", label: "Team tasks" },
  { to: "/p/$programId/follow-ups", label: "Follow-ups", indent: true },
  { to: "/p/$programId/sprint-board", label: "Sprint board" },
  { to: "/p/$programId/dependencies", label: "Dependency map" },
  { to: "/p/$programId/activity", label: "Activity feed" },
  { to: "/p/$programId/lifecycle", label: "Lifecycle plan" },
  { to: "/p/$programId/risks", label: "Risks & blockers", count: "risks" as const },
  { to: "/p/$programId/stakeholders", label: "Stakeholders & Glossary" },
  { to: "/p/$programId/artifacts", label: "Artifacts" },
] as const;

interface NavLeaf {
  to: string;
  label: string;
  indent?: boolean;
  count?: "risks";
}

/**
 * One nav row on the graphite rail.
 *
 * Active is a fill plus a 2px inset indicator in the tint blue — no icon, no
 * colour change on the label, because the Kaizen system ships two glyphs and no
 * icon set. Where the old shell leaned on a Lucide icon for meaning, this uses a
 * mono count or the row's own indent.
 */
function NavRow({
  item,
  programId,
  pathname,
  badge,
}: {
  item: NavLeaf;
  programId: string;
  pathname: string;
  badge?: string;
}) {
  const href = item.to.replace("$programId", programId);
  // Prefix match. Every row is a leaf path now that the index route redirects,
  // so nothing needs the exact-match branch this used to carry.
  const active = pathname.startsWith(href);
  return (
    <Link
      to={item.to}
      params={{ programId }}
      className="kz-transition"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        textAlign: "left",
        padding: item.indent ? "8px 10px 8px 26px" : "8px 10px",
        border: 0,
        borderRadius: 0,
        background: active ? RAIL.fill : "transparent",
        boxShadow: active ? `inset 2px 0 0 ${KZ.blueTint}` : "none",
        color: active ? RAIL.active : RAIL.text,
        fontFamily: "var(--font-sans)",
        fontSize: 13.5,
        fontWeight: active ? 500 : 400,
        letterSpacing: "-0.01em",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = RAIL.hover;
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      <span>{item.label}</span>
      {badge ? (
        <Mono size={10} tone={active ? RAIL.active : RAIL.meta} style={{ marginLeft: "auto" }}>
          {badge}
        </Mono>
      ) : null}
    </Link>
  );
}

/**
 * One nav item in customize mode: a toggle rather than a link. Hidden items stay
 * listed here, struck through, so they can always be brought back — hiding is
 * never deletion, and the route keeps working by URL either way.
 */
function EditRow({
  item,
  hidden,
  onToggle,
}: {
  item: NavLeaf;
  hidden: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={!hidden}
      aria-label={`${hidden ? "Show" : "Hide"} ${item.label}`}
      className="kz-transition"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        textAlign: "left",
        padding: item.indent ? "8px 10px 8px 26px" : "8px 10px",
        border: 0,
        background: "transparent",
        color: hidden ? RAIL.dim : RAIL.text,
        fontFamily: "var(--font-sans)",
        fontSize: 13.5,
        letterSpacing: "-0.01em",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = RAIL.hover)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ flex: 1, textDecoration: hidden ? "line-through" : "none" }}>
        {item.label}
      </span>
      <Mono size={10} tone={RAIL.meta}>
        {hidden ? "hidden" : "shown"}
      </Mono>
    </button>
  );
}

export function AppLayout({ children }: { children?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const program = useProgram();
  const { hydrated, isHidden, toggle, hidden } = useNavPrefs();
  const [editing, setEditing] = useState(false);
  // Below md the rail is a drawer rather than a fixed column. At 268px on a
  // 375px phone it would leave a content well no panel here can render into.
  const [navOpen, setNavOpen] = useState(false);

  // Close on navigate: a drawer that stays open over the page you just chose is
  // a trap on a phone, where it covers most of the viewport.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNavOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);

  // Graphite, per program, so a second engagement can still be told apart at a
  // glance. The Cedar green is gone: nothing in this design is green except the
  // on-track / resolved / done semantic.
  const RAIL_BG = program.navColor || KZ.graphite;

  // The register is seeded synchronously, so the row's count is free — no fetch
  // in the shell just to put a number on a nav item.
  const riskCount = seedFor(program.id).risks.length;
  const badgeFor = (item: NavLeaf) =>
    item.count === "risks" && riskCount ? pad2(riskCount) : undefined;

  // Before hydration, show everything — a server render cannot know the user's
  // hidden set, and hiding on the server then revealing on the client flashes.
  const showItem = (key: string) => !hydrated || editing || !isHidden(key);

  return (
    <div className="flex min-h-screen" style={{ color: KZ.ink, background: KZ.white }}>
      {/* Mobile top bar. Only below md, where the rail is a drawer and there
          would otherwise be no way to reach the nav. */}
      <div
        className="fixed inset-x-0 top-0 z-20 flex items-center gap-3 px-4 py-3 md:hidden"
        style={{ background: RAIL_BG, color: KZ.white }}
      >
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation"
          aria-expanded={navOpen}
          style={{
            border: `1px solid ${RAIL.box}`,
            background: "transparent",
            color: KZ.white,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            textTransform: "uppercase",
            padding: "5px 8px",
            cursor: "pointer",
          }}
        >
          Menu
        </button>
        <div className="min-w-0 truncate" style={{ fontSize: 14, fontWeight: 500 }}>
          {program.name}
        </div>
      </div>

      {navOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 md:hidden"
          style={{ background: "rgba(0,0,0,0.4)" }}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col transition-transform duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ width: 268, flex: "0 0 268px", background: RAIL_BG, color: KZ.white }}
      >
        {/* Program block. Contract and launch date are the two facts that
            identify the engagement, so they sit under the name in mono rather
            than being repeated on every page header. */}
        <div style={{ padding: "24px 20px 20px 20px", borderBottom: `1px solid ${RAIL.rule}` }}>
          <Eyebrow size={10} tone={RAIL.meta}>
            Program
          </Eyebrow>
          <div
            style={{
              marginTop: 8,
              fontSize: 19,
              fontWeight: 500,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
            }}
          >
            {program.name}
          </div>
          <div
            style={{
              marginTop: 8,
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color: "rgba(255,255,255,0.6)",
              lineHeight: 1.5,
            }}
          >
            {program.contract.fullNumber ?? program.contract.displayNumber ?? program.org}
            <br />
            Launch {program.keyDates.launchLabel}
          </div>
        </div>

        <nav
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px 12px 4px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          {NAV.map((n) => {
            if (!editing && !showItem(n.to)) return null;
            return editing ? (
              <EditRow key={n.to} item={n} hidden={isHidden(n.to)} onToggle={() => toggle(n.to)} />
            ) : (
              <NavRow
                key={n.to}
                item={n}
                programId={program.id}
                pathname={pathname}
                badge={badgeFor(n)}
              />
            );
          })}

          {/* Always present, so a hidden item is never a dead end — and a plain
              button rather than a nav item so it cannot itself be hidden. */}
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="kz-transition"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              marginTop: 10,
              padding: "8px 10px",
              border: 0,
              background: editing ? RAIL.fill : "transparent",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
              color: editing ? RAIL.active : "rgba(255,255,255,0.5)",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span>{editing ? "Done customizing" : "Customize sidebar"}</span>
            {!editing && hidden.length ? (
              <span style={{ marginLeft: "auto", color: RAIL.dim }}>{hidden.length} hidden</span>
            ) : null}
          </button>
        </nav>

        <DataSourcesFooter />
      </aside>

      {/* overflow-x-auto, not hidden: when a panel does exceed its column the
          user must still be able to reach the right-hand columns. pt-14 clears
          the mobile top bar, which is fixed. */}
      <main
        className="ml-0 flex min-w-0 flex-1 flex-col overflow-x-auto pt-14 md:pt-0"
        style={{ background: KZ.white, minHeight: "100vh" }}
      >
        {children ?? <Outlet />}
      </main>

      <BackToTop />
    </div>
  );
}

/**
 * Scroll-to-top control. Square, hairline, mono — and hidden until the page is
 * actually scrolled, because a jump-to-top button at the top of a page is a
 * control that does nothing.
 */
function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!visible) return null;
  return (
    <button
      type="button"
      aria-label="Back to top"
      title="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="kz-transition kz-hover-fade fixed bottom-6 right-6 z-40"
      style={{
        border: `1px solid ${KZ.ink}`,
        background: KZ.white,
        color: KZ.ink,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        textTransform: "uppercase",
        letterSpacing: "0.02em",
        padding: "10px 12px",
        cursor: "pointer",
      }}
    >
      Top
    </button>
  );
}

/**
 * Page header.
 *
 * Eyebrow, 38px title, subtitle at 70ch — then, shrink-0 on the right, Refresh
 * and the program chip. Closed by a 1px ink rule, which is what separates it
 * from a KPI strip or the first panel below.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header
      style={{
        padding: "28px var(--kz-pad-x) 24px var(--kz-pad-x)",
        borderBottom: `1px solid ${KZ.ink}`,
      }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <Eyebrow size={11} tone={KZ.muted}>
              {eyebrow}
            </Eyebrow>
          ) : null}
          <h1
            style={{
              margin: "10px 0 0 0",
              fontSize: 38,
              fontWeight: 500,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            {title}
          </h1>
          {subtitle ? (
            <p
              style={{
                margin: "10px 0 0 0",
                maxWidth: "70ch",
                fontSize: 14,
                lineHeight: 1.5,
                color: KZ.body,
                textWrap: "pretty",
              }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-[10px]">
          {actions}
          <RefreshButton />
          <ProgramSwitcher />
        </div>
      </div>
      {children ? <div style={{ marginTop: 20 }}>{children}</div> : null}
    </header>
  );
}
