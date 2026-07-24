import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { useProgramData, relativeTime, absoluteTime } from "@/hooks/use-program-data";

export function RefreshButton() {
  const { refresh, isRefreshing, lastSyncedAt } = useProgramData();

  const onClick = async () => {
    try {
      const result = await refresh();
      const summary = result.sources
        .map((s) => `${s.key} (${s.scope}): ${s.ok ? s.message : `⚠ ${s.message}`}`)
        .join(" · ");
      const anyFail = result.sources.some((s) => !s.ok);
      (anyFail ? toast.warning : toast.success)("Data refreshed", {
        description: `${absoluteTime(result.syncedAt)} — ${summary}`,
      });
    } catch (e) {
      toast.error("Refresh failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  };

  return (
    <div className="flex items-center gap-3">
      <span
        className="text-[11px]"
        style={{ color: "#565c65" }}
        title={lastSyncedAt ? absoluteTime(lastSyncedAt) : undefined}
      >
        Updated {relativeTime(lastSyncedAt)}
      </span>
      <button
        onClick={onClick}
        disabled={isRefreshing}
        className="cedar-btn"
        style={{ cursor: isRefreshing ? "wait" : "pointer" }}
      >
        <RefreshCw size={14} className={isRefreshing ? "animate-spin" : undefined} />
        {isRefreshing ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
