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
