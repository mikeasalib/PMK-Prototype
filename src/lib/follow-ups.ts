// Call-to-call follow-ups: the discrete tasks that fall below the threshold of a
// Linear issue — "email X", "remember Y", "did you forget Z" — caught between
// meetings.
//
// This is the one surface in the app that accepts human input, and it is scoped
// on purpose so that exception does not spread:
//
//   propose  Candidates are DERIVED, not authored. They come from calls
//            (Granola) and sub-issue mentions (Linear), each carrying provenance
//            back to where it was said. The app never invents a task.
//   curate   The DS's decisions — done, dismissed, or a manually added item —
//            are the only data entered. They are that person's working notes
//            about proposed items, NOT program-of-record data, and they never
//            leave the browser or get written back to any source.
//
// So the read-only spine holds: nothing typed here becomes a fact any artifact
// would cite. A generated document reads Linear/Notion/Granola, never this.

export type FollowUpStatus = "open" | "done" | "dismissed";
export type FollowUpOrigin = "granola" | "linear" | "notion" | "manual";

/** Which way an obligation runs — who owes whom. Null when it is just a to-do. */
export type FollowUpDirection = "we-owe" | "they-owe" | null;

/**
 * A proposed follow-up, derived from a source. Immutable: it is what the source
 * said, and the DS's response to it lives separately in curation state so a
 * re-derivation never clobbers a decision.
 */
export interface FollowUpCandidate {
  id: string;
  title: string;
  detail?: string;
  /** Person or party the item concerns. */
  owner?: string;
  direction: FollowUpDirection;
  /** Freeform timing from the source, e.g. "by Dec 1". Not a parsed date — the
   *  source rarely states one precisely, and inventing one would be a lie. */
  dueHint?: string;
  origin: Exclude<FollowUpOrigin, "manual">;
  /** Where it was said, so a curated item is still traceable. */
  source: { label: string; url?: string };
  /** When the candidate was captured from its source. */
  capturedAt: string;
}

/** A manually added item. The DS's own, not derived — origin is always manual. */
export interface ManualFollowUp {
  id: string;
  title: string;
  detail?: string;
  owner?: string;
  direction: FollowUpDirection;
  createdAt: string;
}

/** The DS's decision on one item, keyed by follow-up id. */
export interface Curation {
  status: FollowUpStatus;
  /** When the decision was last changed, for "done 2d ago". */
  updatedAt: string;
}

/** Everything the DS's browser holds for one program. */
export interface CurationState {
  /** Decisions on proposed candidates AND manual items, by id. */
  decisions: Record<string, Curation>;
  /** Items the DS typed themselves. */
  manual: ManualFollowUp[];
}

export const emptyCuration = (): CurationState => ({ decisions: {}, manual: [] });

/** A follow-up as the page renders it: a candidate or manual item, plus the
 *  resolved status. */
export interface FollowUp {
  id: string;
  title: string;
  detail?: string;
  owner?: string;
  direction: FollowUpDirection;
  dueHint?: string;
  origin: FollowUpOrigin;
  /** Present for derived items only. Manual items have no source. */
  source?: { label: string; url?: string };
  status: FollowUpStatus;
}

/**
 * Merge proposed candidates with the DS's curation into one list.
 *
 * A candidate with no decision defaults to open. A manual item defaults to open
 * too. Dismissed items are kept in the result (the page filters them into their
 * own collapsed section) rather than dropped, so "dismiss" is reversible and a
 * re-derivation cannot resurrect something the DS already waved off.
 */
export function mergeFollowUps(
  candidates: FollowUpCandidate[],
  curation: CurationState,
): FollowUp[] {
  const out: FollowUp[] = candidates.map((c) => ({
    id: c.id,
    title: c.title,
    detail: c.detail,
    owner: c.owner,
    direction: c.direction,
    dueHint: c.dueHint,
    origin: c.origin,
    source: c.source,
    status: curation.decisions[c.id]?.status ?? "open",
  }));

  for (const m of curation.manual) {
    out.push({
      id: m.id,
      title: m.title,
      detail: m.detail,
      owner: m.owner,
      direction: m.direction,
      origin: "manual",
      status: curation.decisions[m.id]?.status ?? "open",
    });
  }
  return out;
}

export interface FollowUpBuckets {
  open: FollowUp[];
  done: FollowUp[];
  dismissed: FollowUp[];
}

/** Split by status. Open items lead; the page collapses the other two. */
export function bucketFollowUps(items: FollowUp[]): FollowUpBuckets {
  return {
    open: items.filter((i) => i.status === "open"),
    done: items.filter((i) => i.status === "done"),
    dismissed: items.filter((i) => i.status === "dismissed"),
  };
}
