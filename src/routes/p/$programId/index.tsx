import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The program root redirects to the command centre.
 *
 * This was "What's important": a KPI strip plus three capped lists — in
 * progress, high priority, blockers — and a milestones panel. Every one of those
 * now sits on the command centre, which carries the same KPI strip and the same
 * milestones, and the full lists live on Team tasks. A landing screen whose
 * every payoff is one row down the nav is a table of contents, not a screen, so
 * it is gone rather than kept as a second answer to "where does the program
 * stand".
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
