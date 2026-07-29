import { useCallback, useEffect, useMemo, useState } from "react";
import {
  bucketFollowUps,
  emptyCuration,
  mergeFollowUps,
  type CurationState,
  type FollowUpCandidate,
  type FollowUpDirection,
  type FollowUpStatus,
} from "@/lib/follow-ups";
import vaCandidates from "@/lib/snapshots/follow-ups.va.json";
import venturaCandidates from "@/lib/snapshots/follow-ups.ventura.json";

interface CandidateFile {
  programId: string;
  capturedAt: string;
  note: string;
  candidates: FollowUpCandidate[];
}

const CANDIDATES: Record<string, CandidateFile> = {
  va: vaCandidates as CandidateFile,
  ventura: venturaCandidates as CandidateFile,
};

/** localStorage key. Per program, so switching engagements never crosses lists. */
const storageKey = (programId: string) => `follow-ups:${programId}`;

function loadCuration(programId: string): CurationState {
  // SSR-safe: no window on the server, and the first client render must match
  // the server's, so we hydrate from storage in an effect rather than here.
  if (typeof window === "undefined") return emptyCuration();
  try {
    const raw = window.localStorage.getItem(storageKey(programId));
    if (!raw) return emptyCuration();
    const parsed = JSON.parse(raw) as Partial<CurationState>;
    return { decisions: parsed.decisions ?? {}, manual: parsed.manual ?? [] };
  } catch {
    return emptyCuration();
  }
}

/**
 * The follow-ups for one program: derived candidates merged with the DS's
 * curation. Curation lives in localStorage — honestly browser-local, never
 * written back to any source — and every mutation persists immediately.
 *
 * A monotonic counter for manual ids rather than Date.now()/random, so ids are
 * stable within a session and the code stays free of the nondeterminism the rest
 * of the app avoids.
 */
export function useFollowUps(programId: string) {
  const file = CANDIDATES[programId];
  const candidates = useMemo(() => file?.candidates ?? [], [file]);

  const [curation, setCuration] = useState<CurationState>(emptyCuration());
  const [hydrated, setHydrated] = useState(false);

  // Hydrate after mount so server and first client render agree.
  useEffect(() => {
    setCuration(loadCuration(programId));
    setHydrated(true);
  }, [programId]);

  const persist = useCallback(
    (next: CurationState) => {
      setCuration(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey(programId), JSON.stringify(next));
      }
    },
    [programId],
  );

  const now = () => new Date().toISOString();

  const setStatus = useCallback(
    (id: string, status: FollowUpStatus) => {
      persist({
        ...curation,
        decisions: { ...curation.decisions, [id]: { status, updatedAt: now() } },
      });
    },
    [curation, persist],
  );

  const addManual = useCallback(
    (input: { title: string; detail?: string; owner?: string; direction: FollowUpDirection }) => {
      const title = input.title.trim();
      if (!title) return;
      // Next in sequence from the highest existing suffix, so ids stay unique
      // even after items are removed, without Date.now()/random.
      const seq =
        curation.manual.reduce((n, m) => Math.max(n, Number(m.id.split("-").at(-1)) || 0), 0) + 1;
      const id = `${programId}-manual-${seq}`;
      persist({
        ...curation,
        manual: [
          ...curation.manual,
          {
            id,
            title,
            detail: input.detail?.trim() || undefined,
            owner: input.owner?.trim() || undefined,
            direction: input.direction,
            createdAt: now(),
          },
        ],
      });
    },
    [curation, persist, programId],
  );

  const items = useMemo(() => mergeFollowUps(candidates, curation), [candidates, curation]);
  const buckets = useMemo(() => bucketFollowUps(items), [items]);

  return {
    hydrated,
    capturedAt: file?.capturedAt ?? null,
    sourceNote: file?.note ?? null,
    hasCandidates: candidates.length > 0,
    items,
    buckets,
    setStatus,
    addManual,
  };
}
