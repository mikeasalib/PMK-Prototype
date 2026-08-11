import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { classifyWorkstream, type ProgramConfig } from "@/lib/program.config";
import {
  getStoredData,
  type StoredLinearIssue,
  type StoredNotionPage,
} from "@/lib/sync.functions";

export type { StoredLinearIssue, StoredNotionPage };

export function useStoredData(programId: string) {
  const fn = useServerFn(getStoredData);
  const { data, isLoading } = useQuery({
    // Keyed by program: without this, switching engagements served the previous
    // program's cached rows until the query went stale.
    queryKey: ["stored-data", programId],
    queryFn: () => fn({ data: programId }),
    staleTime: 30_000,
  });
  return {
    isLoading,
    linear: data?.linear ?? [],
    notion: data?.notion ?? [],
    origin: data?.origin ?? "empty",
    capturedAt: data?.capturedAt ?? null,
    capturedFrom: data?.capturedFrom ?? null,
    liveError: data?.liveError ?? null,
  };
}

// -------- Linear helpers --------

export type LinearBucket = "backlog" | "todo" | "in_progress" | "done" | "canceled";

export function bucketOf(issue: StoredLinearIssue): LinearBucket {
  const t = (issue.state_type ?? "").toLowerCase();
  if (t === "completed") return "done";
  if (t === "canceled") return "canceled";
  if (t === "started") return "in_progress";
  if (t === "unstarted") return "todo";
  return "backlog";
}

export function priorityLabel(p: number | null): string {
  switch (p) {
    case 1:
      return "Urgent";
    case 2:
      return "High";
    case 3:
      return "Medium";
    case 4:
      return "Low";
    default:
      return "None";
  }
}

export function priorityColor(p: number | null): string {
  switch (p) {
    case 1:
      return "#b3261e";
    case 2:
      return "#8a5a00";
    case 3:
      return "#1a6fa8";
    case 4:
      return "#565c65";
    default:
      return "#888";
  }
}

export function inferWorkstream(issue: StoredLinearIssue, program: ProgramConfig): string {
  return classifyWorkstream(issue.title, issue.workstream, program);
}

// -------- shared derived predicates --------
//
// These were re-implemented per page and had already drifted three ways:
// index.tsx counted blockers whose tickets were already closed, dependencies.tsx
// excluded closed ones but folded urgent priority into the same predicate, and
// program-model.adapters.looksBlocking matched the title only, with word
// boundaries. One definition each, used everywhere, so a change to "what counts
// as blocked" lands on every screen at once.

/** Open means still actionable — not done, not cancelled, not a duplicate. */
export function isOpen(issue: StoredLinearIssue): boolean {
  const b = bucketOf(issue);
  return b !== "done" && b !== "canceled";
}

/**
 * Blocked by the source's own words: the title or a label says so.
 *
 * Word-boundaried, matching program-model.adapters.looksBlocking — an
 * unanchored /block/ matches "blockchain" and "roadblocks removed", which is
 * the same substring-keyword hazard the workstream classifier documents.
 *
 * Only open issues count. A closed ticket that once said "blocked" is history,
 * not a current blocker, and counting it inflated the landing page's blocked
 * tally against the dependency map's.
 */
const BLOCKING_RE = /\bblock(ed|er|ers|ing)?\b/i;

export function isBlocked(issue: StoredLinearIssue): boolean {
  if (!isOpen(issue)) return false;
  if (BLOCKING_RE.test(issue.title)) return true;
  return (issue.labels ?? []).some((l) => BLOCKING_RE.test(l));
}

/** Urgent or High in Linear, still open. Priority 1 and 2 respectively. */
export function isHighPriority(issue: StoredLinearIssue): boolean {
  return isOpen(issue) && (issue.priority === 1 || issue.priority === 2);
}

/** Sort comparator putting the most urgent first, unprioritised last. */
export function byPriority(a: StoredLinearIssue, b: StoredLinearIssue): number {
  const rank = (p: number | null) => (p && p > 0 ? p : 99);
  return rank(a.priority) - rank(b.priority);
}
