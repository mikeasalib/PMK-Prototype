// Cross-source search over one program's snapshot.
//
// The query is a plain case-insensitive substring, matched against a small set
// of fields per record. No stemming, no fuzziness, no ranking model — a
// strategist wanting "invoice" wants the exact string, and pretending we did
// something smarter would just make the results harder to trust.
//
// Grouped by source in the return value because the panel needs to render
// them in labelled sections; a strategist reading "DEP-1919" alongside a
// follow-up alongside a milestone wants to know which system each row lives
// in without inspecting the identifier.

import type { StoredLinearIssue } from "./sync.functions";
import type { FollowUp } from "./follow-ups";

export interface LinearSearchHit {
  identifier: string;
  title: string;
  state: string | null;
  assignee: string | null;
  url: string | null;
  /** Which field the query hit — used for the "matched X" badge. */
  matched: "identifier" | "title" | "assignee" | "label" | "state";
}

export interface FollowUpSearchHit {
  id: string;
  title: string;
  detail: string | null;
  owner: string | null;
  status: FollowUp["status"];
  sourceLabel: string;
  sourceUrl: string | null;
  matched: "title" | "detail" | "owner" | "source";
}

export interface MilestoneSearchHit {
  identifier: string;
  name: string;
  targetDate: string | null;
  url: string | null;
}

export interface SearchIndex {
  linear: StoredLinearIssue[];
  followUps: FollowUp[];
  milestones: Array<{ source_id: string; name: string; target_date: string | null; url: string | null }>;
}

export interface SearchResults {
  linear: LinearSearchHit[];
  followUps: FollowUpSearchHit[];
  milestones: MilestoneSearchHit[];
  total: number;
}

const EMPTY: SearchResults = { linear: [], followUps: [], milestones: [], total: 0 };

/**
 * Run the query. Empty / whitespace-only returns an empty result (rather than
 * everything), so the page's default state is quiet.
 */
export function searchProgram(query: string, index: SearchIndex): SearchResults {
  const q = query.trim().toLowerCase();
  if (!q) return EMPTY;

  const linear: LinearSearchHit[] = [];
  for (const i of index.linear) {
    const matched = matchLinear(i, q);
    if (matched) {
      linear.push({
        identifier: i.identifier,
        title: i.title,
        state: i.state_name,
        assignee: i.assignee,
        url: i.url,
        matched,
      });
    }
  }

  const followUps: FollowUpSearchHit[] = [];
  for (const f of index.followUps) {
    const matched = matchFollowUp(f, q);
    if (matched) {
      followUps.push({
        id: f.id,
        title: f.title,
        detail: f.detail ?? null,
        owner: f.owner ?? null,
        status: f.status,
        sourceLabel: f.source?.label ?? (f.origin === "manual" ? "You added this" : f.origin),
        sourceUrl: f.source?.url ?? null,
        matched,
      });
    }
  }

  const milestones: MilestoneSearchHit[] = [];
  for (const m of index.milestones) {
    if (m.name.toLowerCase().includes(q)) {
      milestones.push({
        identifier: m.source_id,
        name: m.name,
        targetDate: m.target_date,
        url: m.url,
      });
    }
  }

  // Rank: identifier exact wins, then identifier prefix, then title prefix,
  // then everything else in existing order. Kept simple deliberately — a
  // strategist typing "DEP-1919" expects it first, but does not expect the
  // engine to guess intent past that.
  linear.sort((a, b) => rankLinear(a, q) - rankLinear(b, q));
  followUps.sort((a, b) => rankFollowUp(a, q) - rankFollowUp(b, q));

  return {
    linear,
    followUps,
    milestones,
    total: linear.length + followUps.length + milestones.length,
  };
}

function matchLinear(i: StoredLinearIssue, q: string): LinearSearchHit["matched"] | null {
  if (i.identifier.toLowerCase().includes(q)) return "identifier";
  if (i.title.toLowerCase().includes(q)) return "title";
  if (i.assignee && i.assignee.toLowerCase().includes(q)) return "assignee";
  if (i.labels && i.labels.some((l) => l.toLowerCase().includes(q))) return "label";
  if (i.state_name && i.state_name.toLowerCase().includes(q)) return "state";
  return null;
}

function matchFollowUp(f: FollowUp, q: string): FollowUpSearchHit["matched"] | null {
  if (f.title.toLowerCase().includes(q)) return "title";
  if (f.detail && f.detail.toLowerCase().includes(q)) return "detail";
  if (f.owner && f.owner.toLowerCase().includes(q)) return "owner";
  if (f.source?.label && f.source.label.toLowerCase().includes(q)) return "source";
  return null;
}

function rankLinear(h: LinearSearchHit, q: string): number {
  const id = h.identifier.toLowerCase();
  const title = h.title.toLowerCase();
  if (id === q) return 0;
  if (id.startsWith(q)) return 1;
  if (title.startsWith(q)) return 2;
  if (h.matched === "identifier") return 3;
  if (h.matched === "title") return 4;
  return 5;
}

function rankFollowUp(h: FollowUpSearchHit, q: string): number {
  if (h.title.toLowerCase().startsWith(q)) return 0;
  if (h.matched === "title") return 1;
  if (h.matched === "owner") return 2;
  return 3;
}
