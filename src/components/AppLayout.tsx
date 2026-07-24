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
  HelpCircle,
} from "lucide-react";
import { DataSourcesFooter } from "./DataSourcesFooter";
import { RefreshButton } from "./RefreshButton";

const NAV = [
  { to: "/", label: "What's important", icon: Star },
  { to: "/team-tasks", label: "Team tasks", icon: ListChecks },
  { to: "/program-overview", label: "Program overview", icon: LayoutDashboard },
  { to: "/sprint-board", label: "Sprint board", icon: LayoutGrid },
  { to: "/dependencies", label: "Dependency map", icon: Share2 },
  { to: "/activity", label: "Activity feed", icon: Activity },
  { to: "/lifecycle", label: "Lifecycle plan", icon: GitBranch },
  { to: "/risks", label: "Risks & blockers", icon: AlertTriangle },
  { to: "/stakeholders", label: "Stakeholders & Glossary", icon: Users },
] as const;

// Green nav chrome — mirrors Cedar's admin shell, kept green so the internal
// tool reads as clearly distinct from the external-facing product.
const NAV_BG = "#1f3d2b";
const NAV_ACTIVE = "rgba(255,255,255,0.13)";
const NAV_HOVER = "rgba(255,255,255,0.07)";

export function AppLayout({ children }: { children?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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
            VA Website Redesign
          </div>
          <div className="mt-1 text-[11px]" style={{ color: "rgba(255,255,255,0.6)" }}>
            Kaizen Laboratories Inc.
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-2 py-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors"
                style={{
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
                <Icon size={18} strokeWidth={active ? 2.25 : 2} />
                <span>{n.label}</span>
              </Link>
            );
          })}
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
        </div>
      </div>
      {search ? <div className="mt-4">{search}</div> : null}
    </div>
  );
}
