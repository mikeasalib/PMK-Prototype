import { toast } from "sonner";
import { useProgramData, relativeTime, absoluteTime } from "@/hooks/use-program-data";
import { useProgram } from "@/routes/p/$programId/route";
import { Button, KZ, Mono } from "./kz";

export function RefreshButton() {
  const program = useProgram();
  const { refresh, isRefreshing, lastSyncedAt } = useProgramData(program.id);

  const onClick = async () => {
    try {
      const result = await refresh();
      const summary = result.sources
        .map((s) => `${s.key} (${s.scope}): ${s.ok ? s.message : `⚠ ${s.message}`}`)
        .join(" · ");
      const anyFail = result.sources.some((s) => !s.ok);
      (anyFail ? toast.warning : toast.success)("Data refreshed", {
        description: `${absoluteTime(result.syncedAt)} · ${summary}`,
      });
    } catch (e) {
      toast.error("Refresh failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  };

  return (
    <div className="flex items-center gap-[10px]">
      {/* When the data was last read stays next to the control that re-reads
          it — mono, because it is a timestamp, not prose. */}
      <Mono
        size={10.5}
        tone={KZ.muted}
        title={lastSyncedAt ? absoluteTime(lastSyncedAt) : undefined}
      >
        Updated {relativeTime(lastSyncedAt)}
      </Mono>
      <Button onClick={onClick} disabled={isRefreshing} style={{ borderColor: KZ.bone }}>
        {isRefreshing ? "Refreshing…" : "Refresh"}
      </Button>
    </div>
  );
}
