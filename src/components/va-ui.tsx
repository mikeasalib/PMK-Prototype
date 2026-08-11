import { workstreamOf } from "@/lib/program.config";
import { useProgram } from "@/routes/p/$programId/route";
import type { WorkstreamKey } from "@/lib/va-data";

export function WsPip({ ws }: { ws: WorkstreamKey }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ backgroundColor: workstreamOf(ws, useProgram()).color }}
      title={workstreamOf(ws, useProgram()).label}
    />
  );
}

export function WsTag({ ws }: { ws: WorkstreamKey }) {
  const w = workstreamOf(ws, useProgram());
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide"
      style={{
        backgroundColor: `${w.color}14`,
        color: w.color,
        border: `1px solid ${w.color}33`,
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: w.color }}
      />
      {w.short}
    </span>
  );
}

/**
 * Urgent and high priority only. Medium, low and none render an empty spacer.
 *
 * This is the app's one-accent rule made concrete: colour is spent on the thing
 * that is actually wrong, not on every attribute a row happens to carry. Rows
 * used to show a coloured priority badge at all five levels, which meant none
 * of them told you which row to read first.
 */
export function UrgencyDot({ priority }: { priority: number | null }) {
  if (priority !== 1 && priority !== 2) return <span className="w-2 shrink-0" aria-hidden />;
  const urgent = priority === 1;
  return (
    <span
      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: urgent ? "#b3261e" : "#d98324" }}
      title={urgent ? "Urgent" : "High priority"}
      aria-label={urgent ? "Urgent" : "High priority"}
    />
  );
}
