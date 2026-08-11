import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Star,
  ListChecks,
  LayoutDashboard,
  LayoutGrid,
  Share2,
  Activity,
  GitBranch,
  AlertTriangle,
  Users,
  FileOutput,
  ListTodo,
  HeartPulse,
  Search,
  Sparkles,
  ArrowUp,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Check,
  Menu,
} from "lucide-react";
import { useEffect, useState } from "react";
import { DataSourcesFooter } from "./DataSourcesFooter";
import { ProgramSwitcher } from "./ProgramSwitcher";
import { RefreshButton } from "./RefreshButton";
import { CommandPalette } from "./CommandPalette";
import { ActivityDrawer } from "./ActivityDrawer";
import { PROGRAMS } from "@/lib/program.config";
import { useProgram } from "@/routes/p/$programId/route";
import { useNavPrefs } from "@/hooks/use-nav-prefs";

// Every destination is program-scoped. The leading "/p/$programId" is a literal
// route id, not a template string — TanStack fills the param from `params`.
/**
 * Sidebar destinations.
 *
 * Deliberately short. This was thirteen equal-weight rows, which means no
 * hierarchy at all — a user scans all thirteen every time because none of them
 * outranks the others. Three collapsed into "Work" and two into "Plan", both
 * reached through a tab strip on the page itself, because those groups are the
 * same dataset cut differently rather than separate places to go.
 *
 * Two things left the nav entirely: the activity feed, which is ambient (nobody
 * sets out to visit an activity feed, they glance at one) and is now a drawer;
 * and Stakeholders & Glossary, whose ampersand was the tell that two unrelated
 * things were sharing a slot neither had earned. Both are reachable from the
 * header. Their routes still resolve — URLs are addresses people share.
 *
 * The leading "/p/$programId" is a literal route id, not a template string.
 */
const NAV = [
  { to: "/p/$programId", label: "Now", icon: Star },
  {
    to: "/p/$programId/team-tasks",
    label: "Work",
    icon: ListChecks,
    // Follow-ups are the sub-issue companion to the work views: the discrete
    // things caught between calls that never became a Linear issue.
    children: [{ to: "/p/$programId/follow-ups", label: "Follow-ups", icon: ListTodo }],
  },
  { to: "/p/$programId/program-overview", label: "Plan", icon: LayoutDashboard },
  { to: "/p/$programId/risks", label: "Risks", icon: AlertTriangle },
  { to: "/p/$programId/brief", label: "Brief", icon: Sparkles },
  { to: "/p/$programId/customer-health", label: "Customer health", icon: HeartPulse },
  { to: "/p/$programId/artifacts", label: "Artifacts", icon: FileOutput },
] as const;

/** Routes that live under a nav item's tab strip rather than their own row, so
 *  the parent still highlights while you are on them. */
const TAB_SIBLINGS: Record<string, string[]> = {
  "/p/$programId/team-tasks": ["/p/$programId/sprint-board", "/p/$programId/dependencies"],
  "/p/$programId/program-overview": ["/p/$programId/lifecycle"],
};

const NAV_BG_FALLBACK = "#1f3d2b";
const NAV_ACTIVE = "rgba(255,255,255,0.13)";
const NAV_HOVER = "rgba(255,255,255,0.07)";

interface NavLeaf {
  to: string;
  label: string;
  icon: typeof Star;
}

/** One nav link, at top level or indented as a subnav child. Extracted so the
 *  parent and its children render identically apart from the indent. */
function renderNavLink(n: NavLeaf, indented: boolean, programId: string, pathname: string) {
  const Icon = n.icon;
  const href = n.to.replace("$programId", programId);
  // The index route is a prefix of every sibling, so it is only "active" on an
  // exact match — otherwise it would highlight everywhere. A grouped item also
  // stays active while you are on one of its tab siblings, so "Work" does not
  // go dark the moment you switch from the person view to the board.
  const siblings = (TAB_SIBLINGS[n.to] ?? []).map((t) => t.replace("$programId", programId));
  const active =
    n.to === "/p/$programId"
      ? pathname === href
      : pathname.startsWith(href) || siblings.some((sib) => pathname.startsWith(sib));
  return (
    <Link
      to={n.to}
      params={{ programId }}
      className="flex items-center gap-3 rounded-lg py-2 text-[13px] transition-colors"
      style={{
        // Indented children sit under the parent's label, with a smaller icon.
        paddingLeft: indented ? 34 : 12,
        paddingRight: 12,
        backgroundColor: active ? NAV_ACTIVE : "transparent",
        color: active ? "#ffffff" : "rgba(255,255,255,0.82)",
        fontWeight: active ? 600 : 500,
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = NAV_HOVER;
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      <Icon size={indented ? 15 : 18} strokeWidth={active ? 2.25 : 2} />
      <span>{n.label}</span>
    </Link>
  );
}

/** One nav item in customize mode: not a link, but a toggle that shows or hides
 *  it. Hidden items stay listed here (dimmed) so they can always be brought
 *  back — hiding is never deletion. */
function renderEditRow(n: NavLeaf, indented: boolean, hidden: boolean, onToggle: () => void) {
  const Icon = n.icon;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={!hidden}
      aria-label={`${hidden ? "Show" : "Hide"} ${n.label}`}
      className="flex w-full items-center gap-3 rounded-lg py-2 text-left text-[13px] transition-colors"
      style={{
        paddingLeft: indented ? 34 : 12,
        paddingRight: 12,
        backgroundColor: "transparent",
        color: hidden ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.82)",
        fontWeight: 500,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = NAV_HOVER)}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
    >
      <Icon size={indented ? 15 : 18} strokeWidth={2} />
      <span className="flex-1" style={{ textDecoration: hidden ? "line-through" : "none" }}>
        {n.label}
      </span>
      {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
    </button>
  );
}

export function AppLayout({ children }: { children?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const program = useProgram();
  const { hydrated, isHidden, toggle, hidden } = useNavPrefs();
  const [editing, setEditing] = useState(false);
  // Below md the sidebar is a drawer rather than a fixed column. At 240px on a
  // 375px phone it left a 135px content well, which no panel on this app can
  // render into.
  const [navOpen, setNavOpen] = useState(false);

  // Close on navigate: a drawer that stays open over the page you just chose is
  // a trap on a phone, where it covers most of the viewport.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Escape closes too — same reasoning as the ProgramSwitcher menu: a control
  // that only closes by re-clicking its trigger is unusable without a mouse.
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNavOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);
  // Green nav chrome — mirrors Cedar's admin shell, kept green so the internal
  // tool reads as clearly distinct from the external-facing product. Per-program
  // so a second engagement can be visually distinguishable.
  const NAV_BG = program.navColor || NAV_BG_FALLBACK;

  // Before hydration, show everything — a server render cannot know the user's
  // hidden set, and hiding on the server then revealing on the client would
  // flash. Once hydrated, honour the preference unless the user is editing, in
  // which case every item is shown so it can be toggled.
  const showItem = (key: string) => !hydrated || editing || !isHidden(key);

  return (
    <div className="flex min-h-screen" style={{ color: "#1b1b1b" }}>
      {/* Mobile top bar. Only below md, where the sidebar is a drawer and there
          would otherwise be no way to reach the nav. */}
      <div
        className="fixed inset-x-0 top-0 z-20 flex items-center gap-3 px-4 py-3 md:hidden"
        style={{ backgroundColor: NAV_BG, color: "#ffffff" }}
      >
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation"
          aria-expanded={navOpen}
          className="-ml-1 rounded p-1"
          style={{ color: "#ffffff" }}
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0 truncate text-[14px] font-semibold">{program.name}</div>
      </div>

      {/* Backdrop. Rendered only while the drawer is open so it never eats
          clicks on desktop. */}
      {navOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 md:hidden"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 shrink-0 flex-col transition-transform duration-200 md:translate-x-0 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ backgroundColor: NAV_BG, color: "#ffffff" }}
      >
        <div className="px-5 pb-4 pt-5">
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 16,
              fontWeight: 600,
              lineHeight: 1.2,
            }}
          >
            {program.name}
          </div>
          <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>
            {program.org}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-1">
          <div className="space-y-0.5">
            {NAV.map((n) => {
              const children = "children" in n ? n.children : undefined;
              // In view mode a parent hidden by the user drops out entirely,
              // taking its children with it. In edit mode everything shows.
              if (!editing && !showItem(n.to)) return null;
              return (
                <div key={n.to}>
                  {editing
                    ? renderEditRow(n, false, isHidden(n.to), () => toggle(n.to))
                    : renderNavLink(n, false, program.id, pathname)}
                  {children?.map((c) =>
                    !editing && !showItem(c.to) ? null : (
                      <div key={c.to}>
                        {editing
                          ? renderEditRow(c, true, isHidden(c.to), () => toggle(c.to))
                          : renderNavLink(c, true, program.id, pathname)}
                      </div>
                    ),
                  )}
                </div>
              );
            })}
          </div>

          {/* Customize control. Always present so a hidden item is never a dead
              end, and a plain button rather than a nav item so it cannot itself
              be hidden. */}
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs transition-colors"
            style={{
              color: editing ? "#ffffff" : "rgba(255,255,255,0.55)",
              backgroundColor: editing ? NAV_ACTIVE : "transparent",
            }}
            onMouseEnter={(e) => {
              if (!editing) e.currentTarget.style.backgroundColor = NAV_HOVER;
            }}
            onMouseLeave={(e) => {
              if (!editing) e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            {editing ? <Check size={15} /> : <SlidersHorizontal size={15} />}
            <span>{editing ? "Done customizing" : "Customize sidebar"}</span>
            {!editing && hidden.length ? (
              <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                {hidden.length} hidden
              </span>
            ) : null}
          </button>
        </nav>

        <DataSourcesFooter />
      </aside>

      {/* overflow-x-auto, not hidden: when a panel does exceed its column the
          user must still be able to reach the right-hand columns. Clipping made
          assignee and workstream silently vanish. pt-14 clears the mobile top
          bar, which is fixed. */}
      <main
        className="ml-0 flex-1 overflow-x-auto pt-14 md:ml-60 md:pt-0"
        style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}
      >
        {children ?? <Outlet />}
      </main>

      <BackToTopFab />
    </div>
  );
}

/**
 * Scroll-to-top control.
 *
 * Was named HelpFab and rendered a question-mark icon while its aria-label,
 * title, and click handler all said "back to top" — so sighted users were
 * offered help and screen-reader users were offered a scroll. Same control
 * announcing two different things is worse than either. It scrolls, so it
 * looks like scrolling now.
 *
 * Hidden until the page is actually scrolled: a jump-to-top button at the top
 * of the page is a control that does nothing.
 */
function BackToTopFab() {
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
      className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full text-white"
      style={{
        backgroundColor: "#2f6b41",
        boxShadow: "0 4px 14px rgba(31,61,43,0.35)",
      }}
    >
      <ArrowUp size={22} strokeWidth={2} />
    </button>
  );
}

export function PageHeader({
  title,
  subtitle,
  search,
  actions,
}: {
  title: string;
  subtitle?: string;
  search?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
      {/* Stacks below sm. The actions cluster is shrink-0 and never yielded, so
          on a narrow viewport the title crushed to two or three lines while
          Refresh and the account chip kept a fixed slab on the right. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="cedar-title text-[22px] sm:text-[26px]">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-[13px]" style={{ color: "#565c65" }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3 sm:pt-1">
          {actions}
          {/* Lookup and activity live in the header, not the nav: both are
              things you reach for mid-task rather than navigate to. */}
          <CommandPalette />
          <ActivityDrawer />
          <RefreshButton />
          {/* The account control sits in the far corner, the way it does on the
              customer site — so Refresh moves left of it rather than being the
              rightmost thing. The extra left margin separates a per-page action
              from an app-level one. */}
          <div className="ml-1">
            <ProgramSwitcher />
          </div>
        </div>
      </div>
      {search ? <div className="mt-4">{search}</div> : null}
    </div>
  );
}
