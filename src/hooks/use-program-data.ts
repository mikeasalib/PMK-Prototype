import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { syncAll, getSyncedSnapshot, type SyncResult, type SyncSourceStatus } from "@/lib/sync.functions";

const AUTO_TICK_MS = 60 * 1000;

export function useProgramData() {
  const qc = useQueryClient();
  const fetchSnapshot = useServerFn(getSyncedSnapshot);
  const runSync = useServerFn(syncAll);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [, setTick] = useState(0);

  const { data } = useQuery({
    queryKey: ["sync-snapshot"],
    queryFn: () => fetchSnapshot(),
    staleTime: 30_000,
  });

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), AUTO_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const refresh = useCallback(async (): Promise<SyncResult> => {
    setIsRefreshing(true);
    try {
      const result = await runSync();
      await qc.invalidateQueries({ queryKey: ["sync-snapshot"] });
      await qc.invalidateQueries({ queryKey: ["stored-data"] });
      return result;
    } finally {
      setIsRefreshing(false);
    }
  }, [runSync, qc]);

  const sources: SyncSourceStatus[] = data?.sources ?? [];
  return {
    lastSyncedAt: data?.syncedAt ?? null,
    sources,
    counts: data?.counts ?? { linear: 0, notion: 0, granola: 0 },
    isRefreshing,
    refresh,
  };
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "never";
  const diff = Math.max(0, Date.now() - then);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function absoluteTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
