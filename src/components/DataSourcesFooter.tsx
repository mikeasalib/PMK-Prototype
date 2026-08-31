import { useProgramData, relativeTime, absoluteTime } from "@/hooks/use-program-data";
import { useStoredData } from "@/hooks/use-stored-data";
import { useProgram } from "@/routes/p/$programId/route";
import { Eyebrow, KZ, RAIL, Square } from "./kz";

/**
 * Three sources, in the order they carry weight: Notion holds the register,
 * Linear holds the board, Granola holds the calls.
 *
 * Granola was out of this list for a while, and for a good reason — the sync it
 * had tried to mirror note content through a folder-scoped read the workspace
 * refuses, so the row read "not synced" forever and told a reader nothing. It is
 * back on a narrower, truthful promise: note metadata inside a time window,
 * scoped by attendee and title. The row says which of the two keys that path
 * needs is missing, because "set GRANOLA_API_KEY" is the wrong instruction when
 * the key that is actually absent is the gateway's.
 */
const SOURCES = [
  { key: "notion", label: "Notion" },
  { key: "linear", label: "Linear" },
  { key: "granola", label: "Granola" },
] as const;

export function DataSourcesFooter() {
  const program = useProgram();
  const { lastSyncedAt, sources } = useProgramData(program.id);
  const { origin, capturedAt, capturedFrom, linear, liveError } = useStoredData(program.id);
  const statusFor = (k: string) => sources.find((s) => s.key === k);

  return (
    <div style={{ padding: "16px 20px 20px 20px", borderTop: `1px solid ${RAIL.rule}` }}>
      <Eyebrow size={10} tone={RAIL.meta}>
        Data sources
      </Eyebrow>
      <ul
        style={{
          listStyle: "none",
          margin: "10px 0 0 0",
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
        }}
      >
        {SOURCES.map(({ key, label }) => {
          const s = statusFor(key);
          // Linear rows are what the pages actually render, so its swatch
          // follows the render origin rather than the probe: amber when the
          // rows are a captured snapshot, green on a live read.
          const isLinearSnapshot = key === "linear" && origin === "snapshot";
          const color = isLinearSnapshot ? KZ.amber : !s ? KZ.muted : s.ok ? KZ.green : KZ.coral;
          const text = isLinearSnapshot
            ? `${linear.length} snapshot`
            : !s
              ? "checking…"
              : s.ok
                ? `${s.count} live`
                : shortReason(s.message);
          return (
            <li
              key={key}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
              title={s ? `${s.scope} · ${s.message}` : undefined}
            >
              {/* A square, not a dot: nothing in this design is round. */}
              <Square tone={color} filled />
              <span style={{ color: RAIL.text }}>{label}</span>
              <span
                className="truncate"
                style={{ marginLeft: "auto", color: RAIL.meta, maxWidth: 104 }}
              >
                {text}
              </span>
            </li>
          );
        })}
      </ul>

      <div
        style={{
          marginTop: 10,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: RAIL.meta,
        }}
        title={lastSyncedAt ? absoluteTime(lastSyncedAt) : undefined}
      >
        Last read · {relativeTime(lastSyncedAt)}
      </div>

      {/* The three states keep their copy verbatim. Which one shows is the
          honesty rule the whole app turns on: a snapshot must never read as a
          live source, and a failure must name the actual reason. */}
      {origin === "snapshot" ? (
        <Disclosure title={capturedFrom}>
          <strong style={{ fontWeight: 500 }}>Captured snapshot, not a live read.</strong> Taken{" "}
          {capturedAt ? relativeTime(capturedAt) : "unknown"}.{" "}
          {liveError
            ? liveError.includes("not set")
              ? "LINEAR_API_KEY is not set."
              : `Linear refused the live read: ${liveError}`
            : "Set LINEAR_API_KEY for a live read."}
        </Disclosure>
      ) : null}

      {origin === "live" ? (
        <Disclosure title={capturedFrom}>
          <strong style={{ fontWeight: 500 }}>Live read from Linear.</strong> {linear.length}{" "}
          issues, read {capturedAt ? relativeTime(capturedAt) : "just now"}.
        </Disclosure>
      ) : null}

      <div
        style={{
          marginTop: 10,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: RAIL.dim,
          lineHeight: 1.5,
        }}
      >
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

/** The snapshot / live disclosure box on the rail: hairline, mono, no fill. */
function Disclosure({ children, title }: { children: React.ReactNode; title?: string | null }) {
  return (
    <div
      title={title ?? undefined}
      style={{
        marginTop: 12,
        padding: 10,
        border: `1px solid ${RAIL.box}`,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        lineHeight: 1.5,
        color: RAIL.disclosure,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Squeeze a failure reason into the rail's narrow column. The full message stays
 * on the row's title attribute — "not configured" and "read failed" need
 * different fixes, so the distinction survives even at this width.
 */
function shortReason(message: string): string {
  // Order matters: the gateway case also matches /not set/, and "no token" would
  // send someone to rotate a Granola key that is already there.
  if (/LOVABLE_API_KEY/i.test(message)) return "no gateway key";
  if (/policy refused/i.test(message)) return "policy refused";
  if (/not set/i.test(message)) return "no token";
  if (/not configured/i.test(message)) return "not configured";
  if (/not shared/i.test(message)) return "not shared";
  if (/read failed/i.test(message)) return "read failed";
  if (/^HTTP 4\d\d/i.test(message)) return "auth failed";
  return "unavailable";
}
