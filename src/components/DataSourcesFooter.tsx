import { useProgramData, relativeTime, absoluteTime } from "@/hooks/use-program-data";
import { useStoredData } from "@/hooks/use-stored-data";
import { useProgram } from "@/routes/p/$programId/route";

/**
 * Two sources, not three. Granola is gone: its content sync was never wired
 * (the VA folder returns 403 at the workspace-policy level), so the row sat
 * permanently at "not synced" and told a reader nothing except that we had
 * listed something we don't read. Granola-derived follow-up candidates still
 * flow through the captured follow-ups snapshot and are cited there.
 */
const SOURCES = [
  { key: "notion", label: "Notion" },
  { key: "linear", label: "Linear" },
] as const;

export function DataSourcesFooter() {
  const program = useProgram();
  const { lastSyncedAt, sources } = useProgramData(program.id);
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
          // Linear rows are what the pages actually render, so its dot follows
          // the render origin rather than the probe: amber when the rows are a
          // captured snapshot, green on a live read.
          const isLinearSnapshot = key === "linear" && origin === "snapshot";
          const color = isLinearSnapshot
            ? "#8a5a00"
            : !s
              ? "#8a9099"
              : s.ok
                ? "#2e8540"
                : "#e52207";
          const text = isLinearSnapshot
            ? `${linear.length} snapshot`
            : !s
              ? "checking…"
              : s.ok
                ? `${s.count} live`
                : shortReason(s.message);
          return (
            <li key={key} className="flex items-center gap-2" title={s ? `${s.scope} — ${s.message}` : undefined}>
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span style={{ color: "#dfe1e2" }}>{label}</span>
              <span className="ml-auto truncate" style={{ color: "#8a9099", maxWidth: 100 }}>
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
        Last read · {relativeTime(lastSyncedAt)}
      </div>
      {origin === "snapshot" ? (
        <div
          className="mt-2 rounded px-2 py-1.5 text-[10px] leading-snug"
          style={{ backgroundColor: "rgba(138,90,0,0.22)", color: "#f2d9a8" }}
          title={capturedFrom ?? undefined}
        >
          <strong>Captured snapshot, not a live read.</strong> Taken{" "}
          {capturedAt ? relativeTime(capturedAt) : "unknown"}. Set{" "}
          <code>LINEAR_API_KEY</code> for a live read.
        </div>
      ) : null}
      {origin === "live" ? (
        <div
          className="mt-2 rounded px-2 py-1.5 text-[10px] leading-snug"
          style={{ backgroundColor: "rgba(46,133,64,0.20)", color: "#c8e6c9" }}
          title={capturedFrom ?? undefined}
        >
          <strong>Live read from Linear.</strong> {linear.length} issues, read{" "}
          {capturedAt ? relativeTime(capturedAt) : "just now"}.
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

/**
 * Squeeze a failure reason into the footer's narrow column. The full message
 * stays on the row's title attribute — "not configured" and "read failed" need
 * different fixes, so the distinction survives even at this width.
 */
function shortReason(message: string): string {
  if (/not set/i.test(message)) return "no token";
  if (/not configured/i.test(message)) return "not configured";
  if (/not shared/i.test(message)) return "not shared";
  if (/read failed/i.test(message)) return "read failed";
  if (/^HTTP 4\d\d/i.test(message)) return "auth failed";
  return "unavailable";
}
