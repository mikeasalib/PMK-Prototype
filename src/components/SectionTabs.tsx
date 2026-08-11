import { Link, useRouterState } from "@tanstack/react-router";
import { useProgram } from "@/routes/p/$programId/route";

/**
 * Tabs for routes that are the same dataset cut a different way.
 *
 * The nav used to list Team tasks, Sprint board and Dependency map as three
 * equal peers, and Command centre and Lifecycle plan as two more. All five are
 * destinations in the sense that they have URLs, but only two are destinations
 * in the sense a user means: "the work" and "the plan". Grouping is a control,
 * not a place, so grouping moved into a tab strip and the nav lost three rows.
 *
 * Routes are unchanged. Every old URL still resolves, because they are real
 * addresses people paste to each other — this only changes how you get there.
 */
export type TabGroupKey = "work" | "plan";

interface TabDef {
  /** Literal route id; TanStack fills programId from params. */
  to: string;
  label: string;
  /** One line under the strip explaining what this cut is for. */
  hint: string;
}

const GROUPS: Record<TabGroupKey, { label: string; tabs: TabDef[] }> = {
  work: {
    label: "Work",
    tabs: [
      {
        to: "/p/$programId/team-tasks",
        label: "By person",
        hint: "Who is carrying what, plus the Notion tracker.",
      },
      {
        to: "/p/$programId/sprint-board",
        label: "By state",
        hint: "The board: backlog through done.",
      },
      {
        to: "/p/$programId/dependencies",
        label: "By workstream",
        hint: "Cross-workstream dependencies and what is blocking.",
      },
    ],
  },
  plan: {
    label: "Plan",
    tabs: [
      {
        to: "/p/$programId/program-overview",
        label: "Command centre",
        hint: "Where the program stands right now.",
      },
      {
        to: "/p/$programId/lifecycle",
        label: "Lifecycle",
        hint: "Phases, gates and the full timeline.",
      },
    ],
  },
};

export function SectionTabs({ group }: { group: TabGroupKey }) {
  const program = useProgram();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { tabs } = GROUPS[group];

  const activeTab =
    tabs.find((t) => pathname === t.to.replace("$programId", program.id)) ?? null;

  return (
    <div className="px-4 sm:px-6">
      <div
        className="flex gap-1 overflow-x-auto"
        style={{ borderBottom: "1px solid #dfe1e2" }}
        role="tablist"
      >
        {tabs.map((t) => {
          const href = t.to.replace("$programId", program.id);
          const active = pathname === href;
          return (
            <Link
              key={t.to}
              to={t.to}
              params={{ programId: program.id }}
              role="tab"
              aria-selected={active}
              className="whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors"
              style={{
                color: active ? "#1b1b1b" : "#565c65",
                // The active marker is a weight-and-underline change, not a
                // colour: one accent per screen is reserved for whatever is
                // actually wrong, not for telling you which tab you clicked.
                borderBottom: active ? "2px solid #1b1b1b" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      {activeTab ? (
        <div className="pt-2 text-xs" style={{ color: "#8a8a80" }}>
          {activeTab.hint}
        </div>
      ) : null}
    </div>
  );
}
