import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /search redirects to /dust.
 *
 * The screen is the same federated query; only its name changed, because in a
 * wired deployment the retrieval behind it is the Dust platform rather than a
 * local index. The old path stays as an address — it is in people's history and
 * in links they have already sent — and it carries the query string across, so a
 * shared /search?q=magic link still lands on the same result.
 */
export const Route = createFileRoute("/p/$programId/search")({
  validateSearch: (raw: Record<string, unknown>): { q?: string } => ({
    q: typeof raw.q === "string" ? raw.q : undefined,
  }),
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/p/$programId/dust",
      params: { programId: params.programId },
      search: { q: search.q },
      replace: true,
    });
  },
});
