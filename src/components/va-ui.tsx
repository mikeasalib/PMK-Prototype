import {
  WORKSTREAMS,
  STATUS_LABEL,
  STATUS_COLOR,
  type WorkstreamKey,
  type TaskStatus,
  type Dep,
  type Task,
} from "@/lib/va-data";

export function WsPip({ ws }: { ws: WorkstreamKey }) {
  return (
    <span
      className="inline-block h-2 w-2 rounded-full"
      style={{ backgroundColor: WORKSTREAMS[ws].color }}
      title={WORKSTREAMS[ws].label}
    />
  );
}

export function WsTag({ ws }: { ws: WorkstreamKey }) {
  const w = WORKSTREAMS[ws];
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
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
      {ws}
    </span>
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const color = STATUS_COLOR[status];
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
      style={{
        color,
        backgroundColor: `${color}14`,
        border: `1px solid ${color}55`,
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

const DEP_MARK: Record<Dep["state"], { icon: string; color: string }> = {
  clear: { icon: "✓", color: "#3b7a2e" },
  watch: { icon: "⏱", color: "#8a5a00" },
  block: { icon: "⚠", color: "#b3261e" },
};

export function DepBadge({ dep }: { dep: Dep }) {
  const m = DEP_MARK[dep.state];
  return (
    <span
      className="inline-flex items-start gap-1 rounded px-1.5 py-1 text-[11px] leading-tight"
      style={{
        backgroundColor: `${m.color}0d`,
        border: `1px solid ${m.color}44`,
        color: "#333",
      }}
    >
      <span style={{ color: m.color, fontWeight: 700 }}>{m.icon}</span>
      <span>{dep.text}</span>
    </span>
  );
}

export function TaskCard({ task }: { task: Task }) {
  const w = WORKSTREAMS[task.ws];
  return (
    <div
      className="rounded-lg bg-white p-3.5 transition-shadow hover:shadow-md"
      style={{
        border: "1px solid #e5e7e4",
        borderLeft: `3px solid ${w.color}`,
        boxShadow:
          "0 1px 1px rgba(17, 47, 78, 0.04), 0 2px 6px -2px rgba(17, 47, 78, 0.08)",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13px] font-semibold leading-snug">
          {task.title}
        </div>
        <StatusBadge status={task.status} />
      </div>
      <div
        className="mt-1.5 flex items-center gap-2 text-[11px]"
        style={{ color: "#666" }}
      >
        <WsTag ws={task.ws} />
        <span>{task.owner}</span>
        {task.note ? (
          <span style={{ color: "#8a5a00" }}>· {task.note}</span>
        ) : null}
      </div>
      {task.deps.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {task.deps.map((d, i) => (
            <DepBadge key={i} dep={d} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

