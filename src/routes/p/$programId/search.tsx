import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Search as SearchIcon } from "lucide-react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { PROGRAMS, pageTitle } from "@/lib/program.config";
import { useStoredData } from "@/hooks/use-stored-data";
import { useFollowUps } from "@/hooks/use-follow-ups";
import vaSnapshot from "@/lib/snapshots/va.json";
import venturaSnapshot from "@/lib/snapshots/ventura.json";
import { searchProgram, type SearchResults } from "@/lib/search";
import { shortDate } from "@/lib/local-date";
import { useProgram } from "./route";

/**
 * Cross-source search over one program's snapshot: Linear issues, follow-ups,
 * and Linear milestones in one input. Program-scoped by design — the shell is
 * program-scoped everywhere else, and a global "search every engagement" mode
 * belongs behind an explicit toggle rather than being the default result set.
 *
 * The query lives in the URL (?q=...) so a strategist can share the result
 * they were looking at. Debounced 150ms so keystrokes on a 60-item snapshot
 * don't waste render.
 */
export const Route = createFileRoute("/p/$programId/search")({
  head: ({ params }) => ({
    meta: [
      { title: pageTitle("Search", PROGRAMS[params.programId]) },
      { name: "description", content: "Search across Linear issues, follow-ups, and milestones." },
    ],
  }),
  validateSearch: (raw: Record<string, unknown>): { q?: string } => ({
    q: typeof raw.q === "string" ? raw.q : undefined,
  }),
  component: Search,
});

const MILESTONE_BY_PROGRAM = {
  va: vaSnapshot.linear_milestones,
  ventura: venturaSnapshot.linear_milestones,
} as const;

function Search() {
  const program = useProgram();
  const nav = Route.useNavigate();
  const { q: initialQ } = Route.useSearch();
  const [query, setQuery] = useState(initialQ ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(initialQ ?? "");
  const { linear } = useStoredData(program.id);
  const { items: followUps } = useFollowUps(program.id);
  const milestones = MILESTONE_BY_PROGRAM[program.id as keyof typeof MILESTONE_BY_PROGRAM] ?? [];
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input on mount so the user can start typing without another
  // click. A dedicated search route where you first have to click the input
  // is a broken affordance.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounce so a snapshot of 60 items doesn't get scanned on every keystroke
  // even though 60 items is fast — the browser stays snappy on much larger
  // ones later. Also mirrors the URL so a refresh preserves the query.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
      nav({ search: { q: query || undefined }, replace: true });
    }, 150);
    return () => clearTimeout(t);
  }, [query, nav]);

  const results: SearchResults = useMemo(
    () => searchProgram(debouncedQuery, { linear, followUps, milestones }),
    [debouncedQuery, linear, followUps, milestones],
  );

  const trimmedQ = debouncedQuery.trim();

  return (
    <AppLayout>
      <PageHeader
        title="Search"
        subtitle={`${program.domainLabel} — Linear, follow-ups, milestones. Program-scoped.`}
      />

      <div className="px-4 pb-10 pt-2 sm:px-6">
        <div
          className="mb-4 flex items-center gap-3 rounded-lg bg-white px-3 py-2"
          style={{ border: "1px solid #e5e5e2" }}
        >
          <SearchIcon size={16} style={{ color: "#565c65" }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search issues, follow-ups, milestones…"
            className="flex-1 bg-transparent text-[14px] outline-none"
            style={{ color: "#1b1b1b" }}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-[12px] font-medium"
              style={{ color: "#565c65" }}
            >
              Clear
            </button>
          ) : null}
        </div>

        {!trimmedQ ? (
          <EmptyPrompt />
        ) : results.total === 0 ? (
          <NoResults query={trimmedQ} />
        ) : (
          <div className="space-y-6">
            {results.linear.length > 0 ? (
              <ResultGroup label={`Linear (${results.linear.length})`}>
                {results.linear.map((h) => (
                  <div
                    key={h.identifier}
                    className="flex flex-col gap-1 py-1.5 text-[13px] md:flex-row md:items-center md:gap-3"
                  >
                    <span
                      className="shrink-0 font-mono text-[11px] md:w-16"
                      style={{ color: "#565c65" }}
                    >
                      {h.identifier}
                    </span>
                    <div className="min-w-0 flex-1 truncate">
                      {h.url ? (
                        <a
                          href={h.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 hover:underline"
                          style={{ color: "#1b1b1b" }}
                        >
                          {h.title}
                          <ExternalLink size={12} style={{ color: "#8a8a80" }} />
                        </a>
                      ) : (
                        h.title
                      )}
                    </div>
                    {/* Meta wraps to its own row below md rather than
                        competing with the title for a narrow column. */}
                    <div className="flex items-center gap-3 md:contents">
                      <span
                        className="min-w-0 truncate text-[11px] md:w-24 md:shrink-0 md:text-right"
                        style={{ color: "#565c65" }}
                        title={h.assignee ?? "Unassigned"}
                      >
                        {h.assignee ?? "—"}
                      </span>
                      <span
                        className="shrink-0 text-[10px] uppercase tracking-wide md:w-24 md:text-right"
                        style={{ color: "#565c65" }}
                      >
                        {h.state ?? "—"}
                      </span>
                      <MatchedBadge label={h.matched} />
                    </div>
                  </div>
                ))}
              </ResultGroup>
            ) : null}

            {results.followUps.length > 0 ? (
              <ResultGroup label={`Follow-ups (${results.followUps.length})`}>
                {results.followUps.map((h) => (
                  <div
                    key={h.id}
                    className="flex flex-col gap-1 py-1.5 text-[13px] md:flex-row md:items-center md:gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate" style={{ color: "#1b1b1b" }}>
                        {h.title}
                      </div>
                      {h.detail ? (
                        <div
                          className="mt-0.5 truncate text-[11px]"
                          style={{ color: "#565c65" }}
                        >
                          {h.detail}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3 md:contents">
                      <span
                        className="min-w-0 truncate text-[11px] md:w-24 md:shrink-0 md:text-right"
                        style={{ color: "#565c65" }}
                      >
                        {h.owner ?? "—"}
                      </span>
                      <span
                        className="shrink-0 text-[10px] uppercase tracking-wide md:w-16 md:text-right"
                        style={{ color: h.status === "done" ? "#1f5c2f" : "#565c65" }}
                      >
                        {h.status}
                      </span>
                    </div>
                    <Link
                      to="/p/$programId/follow-ups"
                      params={{ programId: program.id }}
                      className="text-[11px] font-medium"
                      style={{ color: "#3a5a40" }}
                    >
                      open
                    </Link>
                  </div>
                ))}
              </ResultGroup>
            ) : null}

            {results.milestones.length > 0 ? (
              <ResultGroup label={`Milestones (${results.milestones.length})`}>
                {results.milestones.map((m) => (
                  <div
                    key={m.identifier}
                    className="flex flex-col gap-1 py-1.5 text-[13px] md:flex-row md:items-center md:gap-3"
                  >
                    <div className="min-w-0 flex-1 truncate" style={{ color: "#1b1b1b" }}>
                      {m.url ? (
                        <a
                          href={m.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {m.name}
                        </a>
                      ) : (
                        m.name
                      )}
                    </div>
                    <span
                      className="shrink-0 text-[11px] md:w-32 md:text-right"
                      style={{ color: "#565c65" }}
                    >
                      {m.targetDate ? shortDate(m.targetDate) : "no target"}
                    </span>
                  </div>
                ))}
              </ResultGroup>
            ) : null}
          </div>
        )}

        <div className="mt-8 text-[10px] leading-relaxed" style={{ color: "#8a8a80" }}>
          Program-scoped. Case-insensitive substring match on identifier, title,
          assignee, labels, and state (Linear); title, detail, owner, source
          (follow-ups); name (milestones). The Notion risk register and Granola
          transcripts are not indexed here — the risk register is fetched live
          via server function and Granola content is not stored client-side.
        </div>
      </div>
    </AppLayout>
  );
}

function ResultGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-md bg-white px-3 py-2"
      style={{ border: "1px solid #e5e5e2" }}
    >
      <h2
        className="mb-2 text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: "#565c65" }}
      >
        {label}
      </h2>
      <div>{children}</div>
    </section>
  );
}

function MatchedBadge({ label }: { label: string }) {
  return (
    <span
      className="w-20 shrink-0 rounded px-1.5 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: "#f0f0ec", color: "#565c65" }}
      title={`Matched on ${label}`}
    >
      {label}
    </span>
  );
}

function EmptyPrompt() {
  return (
    <div
      className="rounded-lg border border-dashed p-6 text-center text-[13px]"
      style={{ borderColor: "#dcdcd6", color: "#565c65" }}
    >
      Type to search across Linear issues, follow-ups, and milestones for this program.
    </div>
  );
}

function NoResults({ query }: { query: string }) {
  return (
    <div
      className="rounded-lg border border-dashed p-6 text-center text-[13px]"
      style={{ borderColor: "#dcdcd6", color: "#565c65" }}
    >
      No matches for <span style={{ color: "#1b1b1b", fontWeight: 500 }}>&ldquo;{query}&rdquo;</span>{" "}
      in Linear, follow-ups, or milestones. The Notion risk register and Granola content are not
      indexed here.
    </div>
  );
}
