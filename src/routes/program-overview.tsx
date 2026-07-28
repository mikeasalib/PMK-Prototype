import { createFileRoute } from "@tanstack/react-router";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { WsPip, WsTag } from "@/components/va-ui";
import type { WorkstreamKey } from "@/lib/va-data";
import { useStoredData, bucketOf, inferWorkstream } from "@/hooks/use-stored-data";
import { WORKSTREAM_UPDATES, WORKSTREAM_UPDATES_SOURCE, HEALTH_COLOR, HEALTH_LABEL } from "@/lib/workstream-updates";
import { PROGRAM, pageTitle, workstreamKeys, workstreamOf } from "@/lib/program.config";

export const Route = createFileRoute("/program-overview")({
  head: () => ({
    meta: [
      { title: pageTitle("Program overview") },
      { name: "description", content: `${PROGRAM.domainLabel} program status — milestones, sprint progress, workstream burn-down.` },
    ],
  }),
  component: Overview,
});

const SPRINT_MILESTONES = PROGRAM.sprintStrip;

function daysFromNow(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.ceil((new Date(y, m - 1, d).getTime() - Date.now()) / 86400000);
}

function Overview() {
  const { linear, isLoading } = useStoredData();

  const now = new Date().toISOString();
  const activeSprint = SPRINT_MILESTONES.find((s) => s.start <= now.slice(0, 10) && now.slice(0, 10) <= s.end) ?? SPRINT_MILESTONES[0];

  const total = linear.filter((i) => bucketOf(i) !== "canceled").length;
  const done = linear.filter((i) => bucketOf(i) === "done").length;
  const inProgress = linear.filter((i) => bucketOf(i) === "in_progress").length;
  const todo = linear.filter((i) => bucketOf(i) === "todo").length;
  const backlog = linear.filter((i) => bucketOf(i) === "backlog").length;
  const pctDone = total ? Math.round((done / total) * 100) : 0;

  const wsKeys: WorkstreamKey[] = workstreamKeys();
  const wsRows = wsKeys.map((ws) => {
    const items = linear.filter((i) => inferWorkstream(i) === ws);
    return {
      ws,
      done: items.filter((i) => bucketOf(i) === "done").length,
      inProgress: items.filter((i) => bucketOf(i) === "in_progress").length,
      todo: items.filter((i) => bucketOf(i) === "todo").length,
      backlog: items.filter((i) => bucketOf(i) === "backlog").length,
      total: items.length,
    };
  });

  return (
    <AppLayout>
      <PageHeader
        title="Program overview"
        subtitle={`${PROGRAM.domainLabel} · Contract ${PROGRAM.contract.displayNumber} · live from Linear`}
      />

      {/* Milestone strip */}
      <div className="px-6 pt-5">
        <div className="flex overflow-hidden rounded" style={{ border: "1px solid #dfe1e2" }}>
          {SPRINT_MILESTONES.map((s) => {
            const isActive = s.key === activeSprint.key;
            const past = s.end < now.slice(0, 10);
            return (
              <div
                key={s.key}
                className="flex-1 px-3 py-2 text-[11px]"
                style={{
                  backgroundColor: isActive ? "#fff5c2" : past ? "#ecf3ec" : "#eef2f7",
                  color: "#3a5a40",
                  borderRight: "1px solid #dfe1e2",
                }}
              >
                <div className="font-mono text-[10px]" style={{ opacity: 0.65 }}>{s.key}</div>
                <div className="font-semibold" style={{ fontFamily: 'Public Sans, system-ui, sans-serif' }}>{s.label}</div>
                <div className="text-[10px]" style={{ color: "#565c65" }}>{s.start.slice(5)} – {s.end.slice(5)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="p-6 text-[13px]" style={{ color: "#565c65" }}>Loading live data…</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-2">
          {/* Sprint status (real Linear data) */}
          <section className="rounded-md p-4" style={{ backgroundColor: "#f7f7f5", border: "1px solid #e5e5e2" }}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold" style={{ color: "#3a5a40", fontFamily: 'Public Sans, system-ui, sans-serif' }}>
                Current sprint — {activeSprint.label}
              </h2>
              <span className="text-[11px]" style={{ color: "#565c65" }}>
                {activeSprint.start.slice(5)} – {activeSprint.end.slice(5)}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Ring pct={pctDone} />
              <div className="text-[13px]">
                <div>
                  <b>{done}</b> done · <b>{inProgress}</b> in progress · <b>{todo}</b> todo · <b>{backlog}</b> backlog
                </div>
                <div style={{ color: "#565c65" }}>{total} issues in Linear (DEP)</div>
              </div>
            </div>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: "#eee" }}>
              <div className="flex h-2">
                <span style={{ width: `${(done / total) * 100}%`, backgroundColor: "#2e8540" }} />
                <span style={{ width: `${(inProgress / total) * 100}%`, backgroundColor: "#ffbe2e" }} />
                <span style={{ width: `${(todo / total) * 100}%`, backgroundColor: "#a3b8cc" }} />
                <span style={{ width: `${(backlog / total) * 100}%`, backgroundColor: "#dfe1e2" }} />
              </div>
            </div>
          </section>

          {/* Next milestones */}
          <section className="rounded-md p-4" style={{ backgroundColor: "#f7f7f5", border: "1px solid #e5e5e2" }}>
            <h2 className="mb-3 text-sm font-semibold" style={{ color: "#3a5a40", fontFamily: 'Public Sans, system-ui, sans-serif' }}>
              Next milestones
            </h2>
            <div className="grid grid-cols-4 gap-3">
              <Milestone label="Sprint 4 end" date={activeSprint.end} days={daysFromNow(activeSprint.end)} />
              <Milestone label="Sprint 5 start" date={PROGRAM.keyDates.nextSprintStart} days={daysFromNow(PROGRAM.keyDates.nextSprintStart)} />
              <Milestone label="Code freeze" date={PROGRAM.keyDates.codeFreeze} days={daysFromNow(PROGRAM.keyDates.codeFreeze)} />
              <Milestone label="Public launch" date={PROGRAM.keyDates.launch} days={daysFromNow(PROGRAM.keyDates.launch)} danger />
            </div>
          </section>

          {/* Workstream burn-down */}
          <section className="lg:col-span-2 rounded-md py-4 pl-2 pr-4" style={{ backgroundColor: "#f7f7f5", border: "1px solid #e5e5e2" }}>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold" style={{ color: "#3a5a40", fontFamily: 'Public Sans, system-ui, sans-serif' }}>
                Workstream burn-down
              </h2>
              <span className="text-[11px]" style={{ color: "#565c65" }}>
                Linear tickets + program-truth signals ({WORKSTREAM_UPDATES_SOURCE.date})
              </span>
            </div>
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left uppercase tracking-wide" style={{ color: "#565c65", fontSize: 10 }}>
                  <th className="px-2 py-1 font-medium">Workstream</th>
                  <th className="px-2 py-1 font-medium">Health</th>
                  <th className="px-2 py-1 font-medium">Done</th>
                  <th className="px-2 py-1 font-medium">In Prog</th>
                  <th className="px-2 py-1 font-medium leading-tight"><div>Todo +</div><div>Backlog</div></th>
                  <th className="px-2 py-1 font-medium">Total</th>
                  <th className="px-2 py-1 font-medium">Signals</th>
                  <th className="px-2 py-1 font-medium">Burn-down</th>
                </tr>
              </thead>
              <tbody>
                {wsRows.map((r) => {
                  const update = WORKSTREAM_UPDATES.find((u) => u.ws === r.ws);
                  const progressCount = update?.progress.length ?? 0;
                  const openCount = (update?.risks.length ?? 0) + (update?.nextSteps.length ?? 0);
                  const linearRatio = r.total ? r.done / r.total : 0;
                  const signalRatio = progressCount + openCount > 0 ? progressCount / (progressCount + openCount) : 0;
                  const blended = r.total > 0
                    ? Math.round((linearRatio * 0.6 + signalRatio * 0.4) * 100)
                    : Math.round(signalRatio * 100);
                  const color = workstreamOf(r.ws).color;
                  const health = update?.health ?? "on_track";
                  return (
                    <tr key={r.ws} style={{ borderTop: "1px solid #eee" }}>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <WsPip ws={r.ws} />
                          <span>{workstreamOf(r.ws).label}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase" style={{ color: HEALTH_COLOR[health], backgroundColor: `${HEALTH_COLOR[health]}14`, border: `1px solid ${HEALTH_COLOR[health]}44` }}>
                          {HEALTH_LABEL[health]}
                        </span>
                      </td>
                      <td className="px-2 py-2 font-mono">{r.done}</td>
                      <td className="px-2 py-2 font-mono">{r.inProgress}</td>
                      <td className="px-2 py-2 font-mono">{r.todo + r.backlog}</td>
                      <td className="px-2 py-2 font-mono">{r.total}</td>
                      <td className="px-2 py-2 font-mono text-[11px]">
                        <span title="Progress items logged" style={{ color: "#2e8540" }}>{progressCount}▲</span>
                        {" "}
                        <span title="Open risks + next steps" style={{ color: "#b3261e" }}>{openCount}●</span>
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 rounded-full" style={{ backgroundColor: "#eee" }}>
                            <div className="h-1.5 rounded-full" style={{ width: `${blended}%`, backgroundColor: color }} />
                          </div>
                          <span style={{ color: "#565c65" }}>{blended}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-2 text-[10px]" style={{ color: "#565c65" }}>
              Burn-down blends Linear ticket completion (60%) with logged program progress vs open risks/next-steps (40%). Signals: ▲ progress items logged · ● open risks + next steps.
            </div>
          </section>

          {/* Workstream quick-dive — top 2-3 highlights each */}
          <section className="lg:col-span-2 rounded-md p-4" style={{ backgroundColor: "#f7f7f5", border: "1px solid #e5e5e2" }}>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold" style={{ color: "#3a5a40", fontFamily: 'Public Sans, system-ui, sans-serif' }}>
                Workstream quick-dive
              </h2>
              <span className="text-[11px]" style={{ color: "#565c65" }}>
                From {WORKSTREAM_UPDATES_SOURCE.label} · {WORKSTREAM_UPDATES_SOURCE.date}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {WORKSTREAM_UPDATES.map((u) => (
                <div key={u.ws} className="rounded bg-white p-3" style={{ border: "1px solid #e5e5e2", borderLeft: `3px solid ${HEALTH_COLOR[u.health]}` }}>
                  <div className="flex items-baseline justify-between">
                    <div className="text-[12px] font-semibold" style={{ color: "#3a5a40" }}>
                      {u.ws} · {u.name}
                    </div>
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase" style={{ color: HEALTH_COLOR[u.health], backgroundColor: `${HEALTH_COLOR[u.health]}14`, border: `1px solid ${HEALTH_COLOR[u.health]}44` }}>
                      {HEALTH_LABEL[u.health]}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px]" style={{ color: "#565c65" }}>Lead: {u.owner}</div>
                  <ul className="mt-2 list-disc pl-4 text-[12px]" style={{ color: "#1b1b1b" }}>
                    {u.highlights.slice(0, 3).map((h, idx) => <li key={idx}>{h}</li>)}
                  </ul>
                  {u.nextSteps.length > 0 && (
                    <div className="mt-2">
                      <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#2e8540" }}>Next</div>
                      <ul className="mt-0.5 list-disc pl-4 text-[11px]" style={{ color: "#3d3d3d" }}>
                        {u.nextSteps.slice(0, 2).map((n, idx) => <li key={idx}>{n}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>


          {/* Active work quick-look */}
          <section className="lg:col-span-2 rounded-md p-4" style={{ backgroundColor: "#f7f7f5", border: "1px solid #e5e5e2" }}>
            <h2 className="mb-3 text-sm font-semibold" style={{ color: "#3a5a40", fontFamily: 'Public Sans, system-ui, sans-serif' }}>
              What's moving right now
            </h2>
            <ul className="space-y-1.5 text-[12px]">
              {linear.filter((i) => bucketOf(i) === "in_progress").map((i) => {
                const ws = inferWorkstream(i) as WorkstreamKey;
                return (
                  <li key={i.id} className="flex items-center gap-2">
                    <WsTag ws={ws} />
                    <a href={i.url ?? "#"} target="_blank" rel="noreferrer" className="font-mono text-[11px] underline" style={{ color: "#005ea2" }}>
                      {i.identifier}
                    </a>
                    <span className="truncate">{i.title}</span>
                    <span className="ml-auto text-[11px]" style={{ color: "#565c65" }}>{i.assignee ?? "unassigned"}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
    </AppLayout>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <svg width="70" height="70" viewBox="0 0 70 70">
      <circle cx="35" cy="35" r={r} fill="none" stroke="#e5e5e2" strokeWidth="6" />
      <circle cx="35" cy="35" r={r} fill="none" stroke="#1a6fa8" strokeWidth="6" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 35 35)" strokeLinecap="round" />
      <text x="35" y="39" textAnchor="middle" fontSize="13" fontWeight="600" fill="#1a1a1a">{pct}%</text>
    </svg>
  );
}

function Milestone({ label, date, days, danger }: { label: string; date: string; days: number; danger?: boolean }) {
  return (
    <div className="rounded-md bg-white p-3" style={{ border: `1px solid ${danger ? "#b3261e55" : "#e5e5e2"}` }}>
      <div className="text-[11px] uppercase tracking-wide" style={{ color: "#565c65" }}>{label}</div>
      <div className="mt-1 text-2xl font-semibold" style={{ color: danger ? "#b3261e" : "#1a1a1a" }}>
        {Math.max(0, days)}
        <span className="ml-1 text-[11px] font-normal" style={{ color: "#565c65" }}>days</span>
      </div>
      <div className="text-[11px]" style={{ color: "#565c65" }}>{(() => { const [y,m,d] = date.split("-").map(Number); return new Date(y, m-1, d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); })()}</div>
    </div>
  );
}
