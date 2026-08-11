import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The program root redirects to the command centre.
 *
 * This used to be "Now" / "What's important": a KPI strip plus three five-row
 * lists — in-progress, high-priority, and blockers. It stopped earning a slot
 * once Work gained its scope selector, whose default is `in_progress OR
 * priority 1|2` — precisely the union of the two main lists here — and once
 * these lists were capped at five with a "+N more in Work" link on each. What
 * remained was a table of contents whose every payoff was somewhere else, while
 * the command centre had grown into the real landing: gates, follow-ups, the
 * Notion tracker, current sprint, milestones, burn-down, stalled and closed.
 *
 * The KPI strip was the one thing this page had that the command centre did
 * not; it moved there rather than being deleted.
 *
 * The route stays because /p/va and /p/ventura are addresses people have and
 * share. Deleting it would 404 them; redirecting keeps them working.
 */
export const Route = createFileRoute("/p/$programId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/p/$programId/program-overview",
      params: { programId: params.programId },
      replace: true,
    });
  },
});
