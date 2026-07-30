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
  HelpCircle,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Check,
} from "lucide-react";
import { useState } from "react";
import { DataSourcesFooter } from "./DataSourcesFooter";
import { ProgramSwitcher } from "./ProgramSwitcher";
import { RefreshButton } from "./RefreshButton";
import { PROGRAMS } from "@/lib/program.config";
import { useProgram } from "@/routes/p/$programId/route";
import { useNavPrefs } from "@/hooks/use-nav-prefs";

// Every destination is program-scoped. The leading "/p/$programId" is a literal
// route id, not a template string — TanStack fills the param from `params`.
const NAV = [
  { to: "/p/$programId/program-overview", label: "Command centre", icon: LayoutDashboard },
  { to: "/p/$programId", label: "What's important", icon: Star },
  {
    to: "/p/$programId/team-tasks",
    label: "Team tasks",
    icon: ListChecks,
    // Follow-ups are the sub-issue companion to team tasks: the discrete things
    // caught between calls that never become a Linear issue, so they nest here.
    children: [{ to: "/p/$programId/follow-ups", label: "Follow-ups", icon: ListTodo }],
  },
  { to: "/p/$programId/sprint-board", label: "Sprint board", icon: LayoutGrid },
  { to: "/p/$programId/dependencies", label: "Dependency map", icon: Share2 },
  { to: "/p/$programId/activity", label: "Activity feed", icon: Activity },
  { to: "/p/$programId/lifecycle", label: "Lifecycle plan", icon: GitBranch },
  { to: "/p/$programId/risks", label: "Risks & blockers", icon: AlertTriangle },
  { to: "/p/$programId/stakeholders", label: "Stakeholders & Glossary", icon: Users },
  { to: "/p/$programId/artifacts", label: "Artifacts", icon: FileOutput },
] as const;

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
  // exact match — otherwise it would highlight everywhere.
  const active = n.to === "/p/$programId" ? pathname === href : pathname.startsWith(href);
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
      <aside
        className="fixed inset-y-0 left-0 z-30 flex w-60 shrink-0 flex-col"
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
          <div className="mt-1 text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>
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
            className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[12px] transition-colors"
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
              <span className="ml-auto text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                {hidden.length} hidden
              </span>
            ) : null}
          </button>
        </nav>

        <DataSourcesFooter />
      </aside>

      <main
        className="ml-60 flex-1 overflow-x-hidden"
        style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}
      >
        {children ?? <Outlet />}
      </main>

      <HelpFab />
    </div>
  );
}

function HelpFab() {
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
      <HelpCircle size={22} strokeWidth={2} />
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
    <div className="px-6 pb-4 pt-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="cedar-title" style={{ fontSize: 26 }}>
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-[13px]" style={{ color: "#565c65" }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3 pt-1">
          {actions}
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
