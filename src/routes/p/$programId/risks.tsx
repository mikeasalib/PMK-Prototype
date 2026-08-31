import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { WsTag } from "@/components/va-ui";
import {
  Chip,
  Disclosure,
  KZ,
  KpiStrip,
  Mono,
  TableFrame,
  Tag,
  Td,
  Th,
  pad2,
} from "@/components/kz";
import { type RiskSeverity, type RiskStatus, type WorkstreamKey } from "@/lib/va-data";
import { PROGRAMS, pageTitle, workstreamKeys, workstreamOf } from "@/lib/program.config";
import { seedFor } from "@/lib/program-seed";
import { useProgram } from "./route";

export const Route = createFileRoute("/p/$programId/risks")({
  head: ({ params }) => ({
    meta: [
      { title: pageTitle("Risks & blockers", PROGRAMS[params.programId]) },
      {
        name: "description",
        content: `Active risk and blocker register for the ${PROGRAMS[params.programId].domainLabel} program.`,
      },
    ],
  }),
  component: RisksPage,
});

/**
 * Severity carries the accent, because severity is the thing that is actually
 * wrong on this page. Low stays grey and medium stays blue so that high and
 * critical read as alarming — when all four levels carry a hot colour, none of
 * them does.
 */
const SEV_COLOR: Record<RiskSeverity, string> = {
  low: KZ.muted,
  medium: KZ.blue,
  high: KZ.amber,
  critical: KZ.coral,
};

/**
 * Status is the register's own word for where the risk stands, so it gets the
 * same tag treatment: open is the alarm, mitigating is in hand, resolved is the
 * one green thing in this design.
 */
const STATUS_COLOR: Record<RiskStatus, string> = {
  open: KZ.coral,
  mitigating: KZ.amber,
  resolved: KZ.green,
};

const AGING_DAYS = 5;

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function RisksPage() {
  const program = useProgram();
  const seed = seedFor(program.id);
  const today = "2026-07-07";
  const [ws, setWs] = useState<WorkstreamKey | "all">("all");
  const [owner, setOwner] = useState<string>("all");
  const [sev, setSev] = useState<RiskSeverity | "all">("all");
  const [status, setStatus] = useState<RiskStatus | "all">("all");

  const owners = useMemo(() => Array.from(new Set(seed.risks.map((r) => r.owner))).sort(), [seed]);

  const rows = useMemo(
    () =>
      seed.risks.filter(
        (r) =>
          (ws === "all" || r.ws === ws) &&
          (owner === "all" || r.owner === owner) &&
          (sev === "all" || r.severity === sev) &&
          (status === "all" || r.status === status),
      ),
    [seed, ws, owner, sev, status],
  );

  const openedThisWeek = seed.risks.filter((r) => daysBetween(r.opened, today) <= 7).length;
  const closedThisWeek = seed.risks.filter(
    (r) => r.closed && daysBetween(r.closed, today) <= 7,
  ).length;
  const openTotal = seed.risks.filter((r) => r.status !== "resolved").length;
  const net = openedThisWeek - closedThisWeek;

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Register"
        title="Risks & blockers"
        subtitle={`Program risk register, read from the Notion table under this program's hub. Anything open more than ${AGING_DAYS} business days shows its age in coral.`}
      />

      <KpiStrip
        items={[
          {
            label: "Open",
            value: pad2(openTotal),
            sub: `of ${seed.risks.length} in register`,
            danger: openTotal > 0,
          },
          { label: "Opened this week", value: pad2(openedThisWeek), sub: "new entries" },
          { label: "Closed this week", value: pad2(closedThisWeek), sub: "resolved" },
          {
            label: "Net this week",
            value: `${net > 0 ? "+" : ""}${net}`,
            sub: "opened minus closed",
          },
        ]}
      />

      {/* The four filters, as the chip row the sprint board uses. Owner keeps a
          select: on VA it has eleven values, and eleven chips is a paragraph. */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          padding: "16px var(--kz-pad-x)",
          borderBottom: `1px solid ${KZ.bone}`,
        }}
      >
        <Mono size={10} tone={KZ.muted} style={{ textTransform: "uppercase", marginRight: 6 }}>
          Workstream
        </Mono>
        <Chip label="All" active={ws === "all"} onClick={() => setWs("all")} />
        {workstreamKeys(program).map((k) => (
          <Chip
            key={k}
            label={k}
            active={ws === k}
            tone={workstreamOf(k, program).color}
            onClick={() => setWs(k as WorkstreamKey)}
          />
        ))}

        <Mono
          size={10}
          tone={KZ.muted}
          style={{ textTransform: "uppercase", marginLeft: 18, marginRight: 6 }}
        >
          Severity
        </Mono>
        <Chip label="All" active={sev === "all"} onClick={() => setSev("all")} />
        {(["critical", "high", "medium", "low"] as RiskSeverity[]).map((s) => (
          <Chip
            key={s}
            label={s}
            active={sev === s}
            tone={SEV_COLOR[s]}
            onClick={() => setSev(s)}
          />
        ))}

        <Mono
          size={10}
          tone={KZ.muted}
          style={{ textTransform: "uppercase", marginLeft: 18, marginRight: 6 }}
        >
          Status
        </Mono>
        <Chip label="All" active={status === "all"} onClick={() => setStatus("all")} />
        {(["open", "mitigating", "resolved"] as RiskStatus[]).map((s) => (
          <Chip
            key={s}
            label={s}
            active={status === s}
            tone={STATUS_COLOR[s]}
            onClick={() => setStatus(s)}
          />
        ))}

        <label style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 18 }}>
          <Mono size={10} tone={KZ.muted} style={{ textTransform: "uppercase" }}>
            Owner
          </Mono>
          <select
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            style={{
              border: `1px solid ${KZ.bone}`,
              borderRadius: 0,
              background: KZ.white,
              color: KZ.ink,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              padding: "6px 8px",
            }}
          >
            <option value="all">All</option>
            {owners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>

        <Mono size={11} tone={KZ.muted} style={{ marginLeft: "auto" }}>
          {pad2(rows.length)} of {pad2(seed.risks.length)}
        </Mono>
      </div>

      <div style={{ padding: "28px var(--kz-pad-x) 60px var(--kz-pad-x)" }}>
        <TableFrame>
          <thead>
            <tr style={{ borderBottom: `1px solid ${KZ.ink}` }}>
              <Th>ID</Th>
              <Th>Risk</Th>
              <Th>WS</Th>
              <Th>Owner</Th>
              <Th>Age</Th>
              <Th>Severity</Th>
              <Th>Status</Th>
              <Th>Ticket</Th>
              <Th>Next action</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const age = daysBetween(r.opened, r.closed ?? today);
              const aging = r.status !== "resolved" && age > AGING_DAYS;
              return (
                <tr key={r.id} style={{ borderBottom: `1px solid ${KZ.grey200}` }}>
                  <Td
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.id}
                  </Td>
                  <Td style={{ fontWeight: 500 }}>{r.title}</Td>
                  <Td>
                    <WsTag ws={r.ws} />
                  </Td>
                  <Td style={{ color: KZ.body, whiteSpace: "nowrap" }}>{r.owner}</Td>
                  {/* Aging is the one thing the age column can be wrong about
                      quietly, so it carries the accent — and the opened date
                      stays on the tooltip rather than taking a column. */}
                  <Td
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: aging ? KZ.coral : KZ.monoDate,
                      whiteSpace: "nowrap",
                    }}
                    title={
                      aging
                        ? `Opened ${r.opened}. Open longer than ${AGING_DAYS} days`
                        : `Opened ${r.opened}`
                    }
                  >
                    {age}d
                  </Td>
                  <Td>
                    <Tag tone={SEV_COLOR[r.severity]}>{r.severity}</Tag>
                  </Td>
                  <Td>
                    <Tag tone={STATUS_COLOR[r.status]}>{r.status}</Tag>
                  </Td>
                  <Td
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: r.linkedTicket ? KZ.blue : KZ.muted,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.linkedTicket ?? "—"}
                  </Td>
                  <Td style={{ color: KZ.body, maxWidth: 280 }}>{r.nextAction}</Td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <Td colSpan={9} style={{ color: KZ.body }}>
                  No risk in the register matches these filters.
                </Td>
              </tr>
            ) : null}
          </tbody>
        </TableFrame>
        <Disclosure>
          Age counts from the register's own opened date, or to the closed date where one is set
        </Disclosure>
      </div>
    </AppLayout>
  );
}
