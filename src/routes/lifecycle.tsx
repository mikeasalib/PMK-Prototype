import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { WsTag } from "@/components/va-ui";
import { LIFECYCLE, WORKSTREAMS, type PhaseStatus, type WorkstreamKey } from "@/lib/va-data";
import { PROGRAM, pageTitle } from "@/lib/program.config";

export const Route = createFileRoute("/lifecycle")({
  head: () => ({
    meta: [
      { title: pageTitle("Lifecycle plan") },
      { name: "description", content: "End-to-end delivery plan through October deliverable and Nov 11 launch." },
    ],
  }),
  component: LifecyclePage,
});

const STATUS_STYLE: Record<PhaseStatus, { label: string; bg: string; fg: string; bar: string }> = {
  complete: { label: "Complete", bg: "#ecf3ec", fg: "#2e6b2f", bar: "#2e8540" },
  in_progress: { label: "In progress", bg: "#fff5c2", fg: "#7a5a00", bar: "#ffbe2e" },
  upcoming: { label: "Upcoming", bg: "#eef2f7", fg: "#3a4a5c", bar: "#a9aeb1" },
};

function LifecyclePage() {
  const total = LIFECYCLE.length;
  const done = LIFECYCLE.filter((p) => p.status === "complete").length;
  const active = LIFECYCLE.filter((p) => p.status === "in_progress").length;
  const pctDone = Math.round((done / total) * 100);

  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(LIFECYCLE.map((p) => [p.id, p.status === "in_progress"])),
  );
  const allOpen = LIFECYCLE.every((p) => openPhases[p.id]);
  const togglePhase = (id: string) =>
    setOpenPhases((prev) => ({ ...prev, [id]: !prev[id] }));
  const setAll = (open: boolean) =>
    setOpenPhases(Object.fromEntries(LIFECYCLE.map((p) => [p.id, open])));


  return (
    <AppLayout>
      <PageHeader
        title="Lifecycle plan"
        subtitle="End-to-end delivery blocks — from discovery through the October deliverable to the November 11, 2026 launch."
      />

      {/* KPI strip */}
      <div
        className="grid grid-cols-4 gap-3 px-6 py-4"
        style={{ borderBottom: "1px solid #dfe1e2", backgroundColor: "#f8f8f6" }}
      >
        <Kpi label="Phases complete" value={`${done} / ${total}`} sub={`${pctDone}% of program`} />
        <Kpi label="Active phase" value={active > 0 ? "Phase 2 · Foundations" : "—"} sub="S4 – S5" />
        <Kpi label="October deliverable" value="Phase 5 · UAT / PRR" sub="Sep 28 – Oct 23 · code freeze" />
        <Kpi label="Launch deadline" value={PROGRAM.keyDates.launchLabel} sub="Phase 6 · ORR & launch" />
      </div>

      {/* Timeline strip */}
      <div className="px-6 pt-5">
        <div className="flex items-stretch overflow-hidden rounded" style={{ border: "1px solid #dfe1e2" }}>
          {LIFECYCLE.map((p) => {
            const s = STATUS_STYLE[p.status];
            return (
              <a
                key={p.id}
                href={`#${p.id}`}
                className="flex-1 px-3 py-2 text-[11px]"
                style={{
                  backgroundColor: s.bg,
                  color: s.fg,
                  borderRight: "1px solid #dfe1e2",
                  textDecoration: "none",
                }}
              >
                <div className="font-mono" style={{ fontSize: 10, opacity: 0.75 }}>{p.id} · {p.sprints}</div>
                <div className="mt-0.5 font-semibold" style={{ fontFamily: 'Public Sans, system-ui, sans-serif', color: "#3a5a40" }}>
                  {p.name.replace(/^Phase \d+ · /, "")}
                </div>
                <div className="mt-0.5" style={{ fontSize: 10 }}>{p.window}</div>
              </a>
            );
          })}
        </div>
      </div>

      {/* Phase cards */}
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-end gap-2 text-[11px]">
          <button
            type="button"
            onClick={() => setAll(!allOpen)}
            className="rounded px-2 py-1 font-semibold uppercase tracking-wide"
            style={{ border: "1px solid #dfe1e2", backgroundColor: "#fff", color: "#3a5a40" }}
          >
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>
        {LIFECYCLE.map((p) => {
          const s = STATUS_STYLE[p.status];
          const isOpen = !!openPhases[p.id];
          return (
            <section
              id={p.id}
              key={p.id}
              className="rounded-md bg-white"
              style={{ border: "1px solid #e5e5e2", borderLeft: `4px solid ${s.bar}` }}
            >
              <button
                type="button"
                onClick={() => togglePhase(p.id)}
                aria-expanded={isOpen}
                aria-controls={`${p.id}-body`}
                className="flex w-full flex-wrap items-baseline gap-3 px-4 py-3 text-left"
                style={{ borderBottom: isOpen ? "1px solid #eee" : "none", background: "transparent", cursor: "pointer" }}
              >
                <span
                  aria-hidden
                  className="font-mono text-[12px]"
                  style={{ color: "#565c65", width: 12, display: "inline-block" }}
                >
                  {isOpen ? "▾" : "▸"}
                </span>
                <h2
                  className="text-[16px] font-semibold"
                  style={{ fontFamily: 'Public Sans, system-ui, sans-serif', color: "#3a5a40" }}
                >
                  {p.name}
                </h2>
                <span
                  className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  style={{ backgroundColor: s.bg, color: s.fg }}
                >
                  {s.label}
                </span>
                <span className="font-mono text-[11px]" style={{ color: "#565c65" }}>
                  {p.window} · {p.sprints}
                </span>
                {p.milestone ? (
                  <span
                    className="ml-auto rounded px-2 py-0.5 text-[11px] font-semibold"
                    style={{ backgroundColor: "#3a5a40", color: "#ffbe2e" }}
                  >
                    {p.milestone}
                  </span>
                ) : null}
              </button>

              {isOpen ? (
              <div id={`${p.id}-body`} className="px-4 pt-3 pb-4">

                <p className="text-[13px]" style={{ color: "#333" }}>
                  <strong style={{ color: "#3a5a40" }}>Goal.</strong> {p.goal}
                </p>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#565c65" }}>
                      Big blocks
                    </h3>
                    <ul className="space-y-2">
                      {p.blocks.map((b, i) => {
                        const bs = STATUS_STYLE[b.status];
                        return (
                          <li
                            key={i}
                            className="rounded p-2"
                            style={{
                              border: "1px solid #eee",
                              borderLeft: `3px solid ${WORKSTREAMS[b.ws as WorkstreamKey].color}`,
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <WsTag ws={b.ws as WorkstreamKey} />
                              <span className="text-[13px] font-semibold" style={{ color: "#3a5a40" }}>
                                {b.title}
                              </span>
                              <span
                                className="ml-auto rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase"
                                style={{ backgroundColor: bs.bg, color: bs.fg }}
                              >
                                {bs.label}
                              </span>
                            </div>
                            <p className="mt-1 text-[12px]" style={{ color: "#3a3a3a" }}>{b.detail}</p>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#565c65" }}>
                        Exit criteria
                      </h3>
                      <ul className="space-y-1 text-[13px]" style={{ color: "#333" }}>
                        {p.exitCriteria.map((c, i) => (
                          <li key={i} className="flex gap-2">
                            <span style={{ color: s.bar }}>▸</span>
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#565c65" }}>
                        Gates
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {p.gates.map((g, i) => (
                          <span
                            key={i}
                            className="rounded px-2 py-0.5 text-[11px]"
                            style={{ backgroundColor: "#f0f0f0", color: "#333", border: "1px solid #dfe1e2" }}
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </AppLayout>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-md bg-white p-3" style={{ border: "1px solid #dfe1e2" }}>
      <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#565c65" }}>{label}</div>
      <div className="mt-1 text-[15px] font-semibold" style={{ fontFamily: 'Public Sans, system-ui, sans-serif', color: "#3a5a40" }}>{value}</div>
      <div className="mt-0.5 text-[11px]" style={{ color: "#565c65" }}>{sub}</div>
    </div>
  );
}
