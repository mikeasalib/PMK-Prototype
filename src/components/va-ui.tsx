import { workstreamOf } from "@/lib/program.config";
import { useProgram } from "@/routes/p/$programId/route";
import type { WorkstreamKey } from "@/lib/va-data";
import { KZ, Square, Tag } from "./kz";

/**
 * Workstream identity.
 *
 * One badge shape for the whole app: mono 10px uppercase, 1px border in the
 * workstream's own colour, square. The old chip had a tinted fill, a rounded
 * corner and a dot inside the border — three decorations doing the work of one
 * label.
 */
export function WsTag({ ws }: { ws: WorkstreamKey }) {
  const w = workstreamOf(ws, useProgram());
  return (
    <Tag tone={w.color} title={w.label}>
      {w.short}
    </Tag>
  );
}

/** The workstream as a swatch alone, where a full badge would crowd the row. */
export function WsPip({ ws }: { ws: WorkstreamKey }) {
  const w = workstreamOf(ws, useProgram());
  return <Square tone={w.color} filled title={w.label} />;
}

/**
 * Urgent and high priority only. Medium, low and none render nothing.
 *
 * This is the one-accent rule made concrete: colour is spent on the thing that
 * is actually wrong, not on every attribute a row happens to carry. Rows that
 * badge all five levels tell you nothing about which to read first.
 */
export function PrioTag({ priority }: { priority: number | null }) {
  if (priority !== 1 && priority !== 2) return null;
  const urgent = priority === 1;
  return <Tag tone={urgent ? KZ.coral : KZ.amber}>{urgent ? "Urgent" : "High"}</Tag>;
}

/**
 * The same signal at row scale: a 6×6 filled square in the priority colour, or
 * an empty spacer that keeps the column aligned.
 */
export function UrgencyDot({ priority }: { priority: number | null }) {
  if (priority !== 1 && priority !== 2) return <span className="w-1.5 shrink-0" aria-hidden />;
  const urgent = priority === 1;
  return (
    <Square
      tone={urgent ? KZ.coral : KZ.amber}
      filled
      style={{ marginTop: 6 }}
      title={urgent ? "Urgent" : "High priority"}
    />
  );
}
