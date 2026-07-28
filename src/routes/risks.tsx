import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { WsTag } from "@/components/va-ui";
import {
  RISKS,
  type RiskSeverity,
  type RiskStatus,
  type WorkstreamKey,
} from "@/lib/va-data";
import { PROGRAM, pageTitle, workstreamKeys } from "@/lib/program.config";

export const Route = createFileRoute("/risks")({
  head: () => ({
    meta: [
      { title: pageTitle("Risks & blockers") },
      { name: "description", content: `Active risk and blocker register for the ${PROGRAM.domainLabel} program.` },
    ],
  }),
  component: RisksPage,
});

const SEV_COLOR: Record<RiskSeverity, string> = {
  low: "#565c65",
  medium: "#1a6fa8",
  high: "#8a5a00",
  critical: "#b3261e",
};

const STATUS_COLOR: Record<RiskStatus, string> = {
  open: "#b3261e",
  mitigating: "#8a5a00",
  resolved: "#3b7a2e",
};

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function RisksPage() {
  const today = "2026-07-07";
  const [ws, setWs] = useState<WorkstreamKey | "all">("all");
  const [owner, setOwner] = useState<string>("all");
  const [sev, setSev] = useState<RiskSeverity | "all">("all");
  const [status, setStatus] = useState<RiskStatus | "all">("all");

  const owners = useMemo(
    () => Array.from(new Set(RISKS.map((r) => r.owner))).sort(),
    [],
  );

  const rows = useMemo(
    () =>
      RISKS.filter(
        (r) =>
          (ws === "all" || r.ws === ws) &&
          (owner === "all" || r.owner === owner) &&
          (sev === "all" || r.severity === sev) &&
          (status === "all" || r.status === status),
      ),
    [ws, owner, sev, status],
  );

  const openedThisWeek = RISKS.filter((r) => daysBetween(r.opened, today) <= 7).length;
  const closedThisWeek = RISKS.filter(
    (r) => r.closed && daysBetween(r.closed, today) <= 7,
  ).length;
  const openTotal = RISKS.filter((r) => r.status !== "resolved").length;

  return (
    <AppLayout>
      <PageHeader
        title="Risks & blockers"
        subtitle="Program risk register. Aging highlighted after 5 business days."
      />

      <div
        className="grid grid-cols-4 gap-3 px-6 py-4"
        style={{ borderBottom: "1px solid #dfe1e2", backgroundColor: "#f7f7f5" }}
      >
        <Kpi label="Open" value={openTotal} color="#b3261e" />
        <Kpi label="Opened this week" value={openedThisWeek} color="#8a5a00" />
        <Kpi label="Closed this week" value={closedThisWeek} color="#3b7a2e" />
        <Kpi
          label="Net this week"
          value={openedThisWeek - closedThisWeek}
          color="#3a5a40"
        />
      </div>

      <div
        className="flex flex-wrap items-center gap-2 px-6 py-3"
        style={{ borderBottom: "1px solid #e5e5e2" }}
      >
        <Filter label="Workstream">
          <select
            value={ws}
            onChange={(e) => setWs(e.target.value as WorkstreamKey | "all")}
            className="rounded border px-2 py-1 text-[12px]"
            style={{ borderColor: "#d5d5d0" }}
          >
            <option value="all">All</option>
            {workstreamKeys().map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </Filter>
        <Filter label="Owner">
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="rounded border px-2 py-1 text-[12px]"
            style={{ borderColor: "#d5d5d0" }}
          >
            <option value="all">All</option>
            {owners.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </Filter>
        <Filter label="Severity">
          <select
            value={sev}
            onChange={(e) => setSev(e.target.value as RiskSeverity | "all")}
            className="rounded border px-2 py-1 text-[12px]"
            style={{ borderColor: "#d5d5d0" }}
          >
            <option value="all">All</option>
            {(["critical", "high", "medium", "low"] as RiskSeverity[]).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Filter>
        <Filter label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as RiskStatus | "all")}
            className="rounded border px-2 py-1 text-[12px]"
            style={{ borderColor: "#d5d5d0" }}
          >
            <option value="all">All</option>
            {(["open", "mitigating", "resolved"] as RiskStatus[]).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Filter>
        <span className="ml-auto text-[11px]" style={{ color: "#666" }}>
          {rows.length} of {RISKS.length}
        </span>
      </div>

      <div className="p-6">
        <table className="w-full text-[12px]" style={{ border: "1px solid #e5e5e2" }}>
          <thead style={{ backgroundColor: "#f7f7f5" }}>
            <tr
              className="text-left uppercase tracking-wide"
              style={{ color: "#666", fontSize: 10 }}
            >
              <th className="px-3 py-2 font-medium">ID</th>
              <th className="px-3 py-2 font-medium">Risk</th>
              <th className="px-3 py-2 font-medium">WS</th>
              <th className="px-3 py-2 font-medium">Owner</th>
              <th className="px-3 py-2 font-medium">Opened</th>
              <th className="px-3 py-2 font-medium">Age</th>
              <th className="px-3 py-2 font-medium">Severity</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Ticket</th>
              <th className="px-3 py-2 font-medium">Next action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const age = daysBetween(r.opened, r.closed ?? today);
              const aging = r.status !== "resolved" && age > 5;
              return (
                <tr key={r.id} style={{ borderTop: "1px solid #eee" }}>
                  <td className="px-3 py-2 font-mono">{r.id}</td>
                  <td className="px-3 py-2 font-medium">{r.title}</td>
                  <td className="px-3 py-2"><WsTag ws={r.ws} /></td>
                  <td className="px-3 py-2">{r.owner}</td>
                  <td className="px-3 py-2 font-mono" style={{ color: "#666" }}>{r.opened}</td>
                  <td
                    className="px-3 py-2 font-mono"
                    style={{ color: aging ? "#b3261e" : "#666", fontWeight: aging ? 700 : 400 }}
                    title={aging ? "Aging — open >5 days" : undefined}
                  >
                    {age}d{aging ? " ⚠" : ""}
                  </td>
                  <td className="px-3 py-2">
                    <Pill color={SEV_COLOR[r.severity]} label={r.severity} />
                  </td>
                  <td className="px-3 py-2">
                    <Pill color={STATUS_COLOR[r.status]} label={r.status} />
                  </td>
                  <td className="px-3 py-2 font-mono" style={{ color: "#005ea2" }}>
                    {r.linkedTicket ?? "—"}
                  </td>
                  <td className="px-3 py-2" style={{ color: "#333" }}>{r.nextAction}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}

function Kpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-md bg-white px-3 py-2"
      style={{ border: "1px solid #e5e5e2", borderLeft: `3px solid ${color}` }}
    >
      <div className="text-[10px] uppercase tracking-wide" style={{ color: "#666" }}>
        {label}
      </div>
      <div className="text-xl font-bold" style={{ color, fontFamily: 'Public Sans, system-ui, sans-serif' }}>
        {value}
      </div>
    </div>
  );
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[11px] uppercase tracking-wide" style={{ color: "#666" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function Pill({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
      style={{ color, backgroundColor: `${color}14`, border: `1px solid ${color}44` }}
    >
      {label}
    </span>
  );
}
