import { useProgramData, relativeTime, absoluteTime } from "@/hooks/use-program-data";
import { useProgram } from "@/routes/p/$programId/route";

const SOURCES = [
  { key: "granola", label: "Granola" },
  { key: "notion", label: "Notion" },
  { key: "linear", label: "Linear" },
] as const;

export function DataSourcesFooter() {
  const program = useProgram();
  const { lastSyncedAt, sources, counts } = useProgramData();
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
          const color = !s ? "#8a9099" : s.ok ? "#2e8540" : "#e52207";
          const count = counts[key];
          const text = !s ? "not synced" : `${count} in DB`;
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
