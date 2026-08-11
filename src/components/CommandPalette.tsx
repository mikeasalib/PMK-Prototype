import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search as SearchIcon, X } from "lucide-react";
import { useProgram } from "@/routes/p/$programId/route";
import { useStoredData } from "@/hooks/use-stored-data";
import { useFollowUps } from "@/hooks/use-follow-ups";
import { seedFor } from "@/lib/program-seed";
import { searchProgram } from "@/lib/search";

/**
 * ⌘K lookup: tickets, follow-ups, people, glossary terms, and pages.
 *
 * This exists because two nav rows were doing the job badly. "Search" was a
 * whole destination for something you do mid-thought, and "Stakeholders &
 * Glossary" was two unrelated things sharing one slot — the ampersand was the
 * tell. A glossary term gets looked up while you are reading something else,
 * not navigated to; so does a contact.
 *
 * The /search and /stakeholders routes still exist for anyone who wants to
 * browse rather than look up, and the palette links through to them.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);

  // ⌘K / Ctrl+K to open, Escape to close. Registered once at the layout level
  // so every page gets it without opting in.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search or ask Dust (Command K)"
        title="Search or @ Dust — ⌘K"
        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-neutral-100"
        style={{ color: "#565c65", border: "1px solid #dfe1e2" }}
      >
        <SearchIcon size={15} />
        <span className="hidden whitespace-nowrap sm:inline">Search or @ Dust</span>
        <kbd
          className="hidden rounded px-1 text-xs sm:inline"
          style={{ backgroundColor: "#f0f0ec", color: "#8a8a80" }}
        >
          ⌘K
        </kbd>
      </button>
      {open ? <PaletteModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/**
 * True when any word in `haystack` begins with `query`.
 *
 * Deliberately not a plain substring test. On a roster, "orr" matching
 * "F-orr-en" is noise that buries the row you wanted, and this codebase has
 * been bitten by unanchored short keywords before — see the classifier notes on
 * SEARCH inside reSEARCH and VENUE inside revenue.
 */
function matchesWordStart(haystack: string, query: string): boolean {
  const q = query.toLowerCase();
  if (!q) return false;
  return haystack
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((word) => word.startsWith(q));
}

/** A question routed to Dust rather than to the local index. */
function isDustQuery(q: string): boolean {
  return q.trimStart().startsWith("@");
}

/**
 * The @ mode, disclosed rather than silently dead.
 *
 * The trigger advertises "@ Dust", so typing @ has to answer for itself. Dust
 * is not wired to this app yet — there is no connector, no key, no endpoint —
 * and returning "no matches" would read as though the question had been asked
 * and had no answer. It says what it is instead, and hands the question over
 * to Dust in a new tab so the affordance is still worth something today.
 */
function DustNotConnected({ question }: { question: string }) {
  const trimmed = question.trim();
  return (
    <div className="px-3 py-5 text-sm">
      <div className="font-medium" style={{ color: "#1b1b1b" }}>
        Dust is not connected to this workspace yet
      </div>
      <p className="mt-1.5 leading-relaxed" style={{ color: "#565c65" }}>
        Asking Dust from here needs a connector and an API key. Until that
        lands, this does not query anything — so it is not going to answer and
        pretend otherwise.
      </p>
      {trimmed ? (
        <a
          href={`https://dust.tt/?q=${encodeURIComponent(trimmed)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block font-medium hover:underline"
          style={{ color: "#3a5a40" }}
        >
          Ask Dust directly: “{trimmed}”
        </a>
      ) : (
        <p className="mt-3" style={{ color: "#8a8a80" }}>
          Type a question after the @.
        </p>
      )}
    </div>
  );
}

type Hit = {
  id: string;
  group: string;
  title: string;
  detail: string | null;
  /** External link, or an internal route to navigate to. */
  href?: string;
  to?: string;
};

/** Split out so the data hooks only run while the palette is open. */
function PaletteModal({ onClose }: { onClose: () => void }) {
  const program = useProgram();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { linear } = useStoredData(program.id);
  const { items: followUps } = useFollowUps(program.id);
  const seed = seedFor(program.id);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const hits: Hit[] = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    // @ routes to Dust, not to the local index.
    if (isDustQuery(q)) return [];
    const out: Hit[] = [];

    // Tickets, follow-ups and milestones reuse the same engine the /search page
    // uses, so a term matches identically in both places.
    const res = searchProgram(q, { linear, followUps, milestones: [] });
    for (const h of res.linear.slice(0, 6)) {
      out.push({
        id: `linear-${h.identifier}`,
        group: "Tickets",
        title: `${h.identifier} · ${h.title}`,
        detail: [h.state, h.assignee].filter(Boolean).join(" · ") || null,
        href: h.url ?? undefined,
      });
    }
    for (const h of res.followUps.slice(0, 4)) {
      out.push({
        id: `fu-${h.id}`,
        group: "Follow-ups",
        title: h.title,
        detail: h.owner,
        to: "/p/$programId/follow-ups",
      });
    }

    // People, from the program's own org roster. Matched on word starts, not
    // raw substring: typing "orr" was returning "Lisa F-orr-en", which is the
    // same substring-keyword hazard the workstream classifier documents
    // (SEARCH inside reSEARCH). "for" still finds Forren.
    for (const org of seed.orgs) {
      for (const c of org.contacts) {
        const hay = `${c.name} ${c.role ?? ""} ${org.name}`;
        if (matchesWordStart(hay, query)) {
          out.push({
            id: `person-${org.name}-${c.name}`,
            group: "People",
            title: c.name,
            detail: [c.role, org.name].filter(Boolean).join(" · ") || null,
            to: "/p/$programId/stakeholders",
          });
        }
      }
    }

    // Glossary terms. The term matches on word starts for the same reason as
    // names; the meaning is prose you are searching through, so substring is
    // the right behaviour there.
    const terms = seed.glossary.filter(
      (e) => matchesWordStart(e.term, query) || e.meaning.toLowerCase().includes(query),
    );
    terms.sort((a, b) => {
      const aExact = a.term.toLowerCase() === query ? 0 : 1;
      const bExact = b.term.toLowerCase() === query ? 0 : 1;
      return aExact - bExact;
    });
    for (const e of terms.slice(0, 5)) {
      out.push({
        id: `term-${e.term}`,
        group: "Glossary",
        title: e.term,
        detail: e.meaning,
        to: "/p/$programId/stakeholders",
      });
    }

    return out.slice(0, 24);
  }, [q, linear, followUps, seed]);

  const grouped = useMemo(() => {
    const order: string[] = [];
    const m = new Map<string, Hit[]>();
    for (const h of hits) {
      if (!m.has(h.group)) {
        m.set(h.group, []);
        order.push(h.group);
      }
      m.get(h.group)!.push(h);
    }
    return order.map((g) => ({ group: g, items: m.get(g)! }));
  }, [hits]);

  function go(h: Hit) {
    onClose();
    if (h.href) {
      window.open(h.href, "_blank", "noopener,noreferrer");
    } else if (h.to) {
      navigate({ to: h.to, params: { programId: program.id } as never });
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close search"
        onClick={onClose}
        className="fixed inset-0 z-50"
        style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
      />
      <div
        role="dialog"
        aria-label="Search"
        className="fixed left-1/2 top-[10vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <div
          className="flex items-center gap-3 border-b px-4 py-3"
          style={{ borderColor: "#e5e5e2" }}
        >
          <SearchIcon size={16} style={{ color: "#565c65" }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tickets, people, glossary — or @ Dust to ask"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "#1b1b1b" }}
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 hover:bg-neutral-100"
            style={{ color: "#8a8a80" }}
          >
            <X size={15} />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2">
          {!q.trim() ? (
            <div className="px-2 py-6 text-center text-sm" style={{ color: "#8a8a80" }}>
              Type to look up a ticket, follow-up, person, or acronym — or start
              with <span style={{ color: "#1b1b1b" }}>@</span> to ask Dust.
            </div>
          ) : isDustQuery(q) ? (
            <DustNotConnected question={q.replace(/^@\s*/, "")} />
          ) : grouped.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm" style={{ color: "#8a8a80" }}>
              No matches for “{q.trim()}”.
            </div>
          ) : (
            grouped.map(({ group, items }) => (
              <div key={group} className="mb-2">
                <div
                  className="px-2 py-1 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "#8a8a80" }}
                >
                  {group}
                </div>
                {items.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => go(h)}
                    className="block w-full rounded px-2 py-1.5 text-left transition-colors hover:bg-neutral-100"
                  >
                    <div className="truncate text-sm" style={{ color: "#1b1b1b" }}>
                      {h.title}
                    </div>
                    {h.detail ? (
                      <div className="truncate text-xs" style={{ color: "#8a8a80" }}>
                        {h.detail}
                      </div>
                    ) : null}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
