import { useProgramData, relativeTime, absoluteTime } from "@/hooks/use-program-data";
import { useStoredData } from "@/hooks/use-stored-data";
import { useProgram } from "@/routes/p/$programId/route";

const SOURCES = [
  { key: "granola", label: "Granola" },
  { key: "notion", label: "Notion" },
  { key: "linear", label: "Linear" },
] as const;

export function DataSourcesFooter() {
  const program = useProgram();
  const { lastSyncedAt, sources, counts } = useProgramData();
  // The origin of the rows the pages are actually rendering. Without this the
  // footer said "Linear · not synced" on a page full of Linear issues.
  const { origin, capturedAt, capturedFrom, linear } = useStoredData(program.id);
  const statusFor = (k: string) => sources.find((s) => s.key === k);

  return (
    <div
      className="px-4 py-3 text-[11px]"
      style={{ borderTop: "1px solid rgba(255,255,255,0.15)", color: "#a9aeb1" }}
    >
      <div className="mb-2 text-[10px] uppercase tracking-wide" style={{ color: "#8a9099" }}>
        Data sources
      </div>
      <ul className="space-y-1">
        {SOURCES.map(({ key, label }) => {
          const s = statusFor(key);
          // A snapshot is neither synced nor absent, and must not be shown as
          // either. Amber, and it says which it is.
          const isSnapshotSource = origin === "snapshot" && key === "linear";
          const color = isSnapshotSource
            ? "#8a5a00"
            : !s
              ? "#8a9099"
              : s.ok
                ? "#2e8540"
                : "#e52207";
          const count = counts[key];
          const text = isSnapshotSource
            ? `${linear.length} snapshot`
            : !s
              ? "not synced"
              : `${count} in DB`;
          return (
            <li key={key} className="flex items-center gap-2" title={s?.scope ?? text}>
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span style={{ color: "#dfe1e2" }}>{label}</span>
              <span className="ml-auto truncate" style={{ color: "#8a9099", maxWidth: 90 }}>
                {text}
              </span>
            </li>
          );
        })}
      </ul>
      <div
        className="mt-3"
        style={{ color: "#dfe1e2" }}
        title={lastSyncedAt ? absoluteTime(lastSyncedAt) : undefined}
      >
        Last refresh · {relativeTime(lastSyncedAt)}
      </div>
      {origin === "snapshot" ? (
        <div
          className="mt-2 rounded px-2 py-1.5 text-[10px] leading-snug"
          style={{ backgroundColor: "rgba(138,90,0,0.22)", color: "#f2d9a8" }}
          title={capturedFrom ?? undefined}
        >
          <strong>Captured snapshot, not a live read.</strong> Taken{" "}
          {capturedAt ? relativeTime(capturedAt) : "unknown"}. Connect Supabase and run a sync for
          live data.
        </div>
      ) : null}
      <div className="mt-2" style={{ color: "#8a9099" }}>
        {[
          program.contract.displayNumber ? `Contract ${program.contract.displayNumber}` : null,
          program.keyDates.launchLabel,
        ]
          .filter(Boolean)
          .join(" · ")}
      </div>
    </div>
  );
}
