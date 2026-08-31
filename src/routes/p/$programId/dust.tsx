import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Disclosure, KZ, List, Mono, NoteBox, PanelHead, Tag, pad2 } from "@/components/kz";
import { PROGRAMS, pageTitle } from "@/lib/program.config";
import { useStoredData } from "@/hooks/use-stored-data";
import { useFollowUps } from "@/hooks/use-follow-ups";
import vaSnapshot from "@/lib/snapshots/va.json";
import venturaSnapshot from "@/lib/snapshots/ventura.json";
import { searchProgram, type SearchResults } from "@/lib/search";
import { shortDate } from "@/lib/local-date";
import { useProgram } from "./route";

/**
 * Dust — the federated query surface.
 *
 * Dust is Kaizen's internal knowledge base: the deployment team already asks it
 * questions across the same sources this app reads. This screen is that query,
 * scoped to one program, and in a wired deployment it runs against the Dust
 * platform's own retrieval rather than a local index.
 *
 * It is NOT wired to Dust here, and the page says so in place rather than
 * implying it. What runs today is the local matcher over the program's own
 * captured index — Linear issues, follow-ups, Linear milestones — which is why
 * every result still carries the source it came from. When the Dust connection
 * lands, the input and the result shape stay; the retrieval behind them changes.
 *
 * Program-scoped by design: the shell is program-scoped everywhere else, and a
 * "query every engagement" mode belongs behind an explicit toggle rather than
 * being the default result set. The query lives in the URL (?q=...) so a
 * strategist can share the result they were looking at. Debounced 150ms.
 */
export const Route = createFileRoute("/p/$programId/dust")({
  head: ({ params }) => ({
    meta: [
      { title: pageTitle("Dust", PROGRAMS[params.programId]) },
      {
        name: "description",
        content:
          "Federated query across the program's sources — Dust in a wired deployment, the local index here.",
      },
    ],
  }),
  validateSearch: (raw: Record<string, unknown>): { q?: string } => ({
    q: typeof raw.q === "string" ? raw.q : undefined,
  }),
  component: Dust,
});

const MILESTONE_BY_PROGRAM = {
  va: vaSnapshot.linear_milestones,
  ventura: venturaSnapshot.linear_milestones,
} as const;

/** One tone per kind, so the result list is scannable by source. */
const KIND_TONE = {
  Linear: KZ.amber,
  "Follow-up": KZ.green,
  Milestone: KZ.blue,
} as const;

function Dust() {
  const program = useProgram();
  const nav = Route.useNavigate();
  const { q: initialQ } = Route.useSearch();
  const [query, setQuery] = useState(initialQ ?? "");
  const [debouncedQuery, setDebouncedQuery] = useState(initialQ ?? "");
  const { linear } = useStoredData(program.id);
  const { items: followUps } = useFollowUps(program.id);
  const milestones = MILESTONE_BY_PROGRAM[program.id as keyof typeof MILESTONE_BY_PROGRAM] ?? [];
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus on mount: a dedicated search route where you first have to click the
  // input is a broken affordance.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
        eyebrow="Federated"
        title="Dust"
        subtitle={`One query across the ${program.domainLabel} program's sources. Every result carries the source it came from.`}
      />

      <div style={{ padding: "28px var(--kz-pad-x) 60px var(--kz-pad-x)" }}>
        {/* Said in place, not in a comment: this screen is the shape of the Dust
            query, not the Dust query. Anything else would let a demo imply a
            connection that does not exist. */}
        <NoteBox style={{ marginBottom: 24 }}>
          <strong style={{ color: KZ.ink, fontWeight: 500 }}>Not connected to Dust yet.</strong> In
          a wired deployment this input queries the Dust platform, which already indexes the
          program's Granola calls, Notion pages and Linear issues alongside the rest of Kaizen's
          internal knowledge. What runs here is the local matcher over this program's captured index
          — Linear issues, follow-ups and milestones — so results are narrower than Dust's and carry
          no answer synthesis.
        </NoteBox>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask across this program's sources…"
          className="kz-input"
          style={{
            maxWidth: 760,
            padding: "14px 16px",
            border: `1px solid ${KZ.ink}`,
            fontSize: 15,
          }}
        />

        {/* Nothing renders until there is a query: an empty-state card on a
            search page is a card that says "you have not typed yet". */}
        {trimmedQ ? (
          <div style={{ marginTop: 24, maxWidth: 900 }}>
            <PanelHead
              label="Results"
              right={pad2(results.total)}
              rightTone={results.total === 0 ? KZ.coral : undefined}
            />
            {results.total === 0 ? (
              <div style={{ padding: "18px 0", fontSize: 13.5, color: KZ.body }}>
                No matches for “{trimmedQ}” in Linear, follow-ups, or milestones.
              </div>
            ) : (
              <List>
                {results.linear.map((h) => (
                  <Result
                    key={`l-${h.identifier}`}
                    kind="Linear"
                    title={h.title}
                    href={h.url ?? undefined}
                    meta={[
                      h.identifier,
                      h.assignee ?? "unassigned",
                      h.state ?? "—",
                      `matched on ${h.matched}`,
                    ]}
                  />
                ))}
                {results.followUps.map((h) => (
                  <Result
                    key={`f-${h.id}`}
                    kind="Follow-up"
                    title={h.title}
                    meta={[h.owner ?? "unassigned", h.status, h.detail ?? ""].filter(Boolean)}
                    trailing={
                      <Link to="/p/$programId/follow-ups" params={{ programId: program.id }}>
                        <Mono size={10.5} tone={KZ.blue}>
                          Open
                        </Mono>
                      </Link>
                    }
                  />
                ))}
                {results.milestones.map((m) => (
                  <Result
                    key={`m-${m.identifier}`}
                    kind="Milestone"
                    title={m.name}
                    href={m.url ?? undefined}
                    meta={[m.targetDate ? shortDate(m.targetDate) : "no target date"]}
                  />
                ))}
              </List>
            )}
            <Disclosure>
              Local matcher, pending the Dust connection: case-insensitive substring match on
              identifier, title, assignee, labels and state (Linear); title, detail, owner and
              source (follow-ups); name (milestones). The Notion risk register and Granola call
              content are not in this index — the register is read live by server function, and
              Granola is metadata-only here. Dust reaches all of them
            </Disclosure>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}

/** One result row: kind badge, title, then one mono line of provenance. */
function Result({
  kind,
  title,
  meta,
  href,
  trailing,
}: {
  kind: keyof typeof KIND_TONE;
  title: string;
  meta: string[];
  href?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <li
      style={{
        padding: "14px 0",
        borderBottom: `1px solid ${KZ.grey200}`,
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
      }}
    >
      <Tag tone={KIND_TONE[kind]} style={{ marginTop: 2 }}>
        {kind}
      </Tag>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, lineHeight: 1.4 }}>
          {href ? (
            <a href={href} target="_blank" rel="noreferrer" style={{ color: KZ.ink }}>
              {title}
            </a>
          ) : (
            title
          )}
        </div>
        <div style={{ marginTop: 5 }}>
          <Mono size={10.5}>{meta.join(" · ")}</Mono>
        </div>
      </div>
      {trailing ? <div style={{ flexShrink: 0 }}>{trailing}</div> : null}
    </li>
  );
}
