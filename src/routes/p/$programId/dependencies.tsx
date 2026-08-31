import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { WsTag } from "@/components/va-ui";
import {
  Chip,
  Disclosure,
  KZ,
  List,
  Mono,
  Panel,
  PanelHead,
  SectionTitle,
  Tag,
  pad2,
} from "@/components/kz";
import type { WorkstreamKey } from "@/lib/va-data";
import {
  useStoredData,
  bucketOf,
  inferWorkstream,
  priorityLabel,
  priorityColor,
  isBlocked,
  isOpen,
  type StoredLinearIssue,
} from "@/hooks/use-stored-data";
import { relativeTime } from "@/hooks/use-program-data";
import { HEALTH_COLOR, HEALTH_LABEL } from "@/lib/workstream-updates";
import { PROGRAMS, pageTitle, workstreamKeys, workstreamOf } from "@/lib/program.config";
import { seedFor } from "@/lib/program-seed";
import { shortDate } from "@/lib/local-date";
import { useProgram } from "./route";

export const Route = createFileRoute("/p/$programId/dependencies")({
  head: ({ params }) => ({
    meta: [
      { title: pageTitle("Dependency map", PROGRAMS[params.programId]) },
      {
        name: "description",
        content: "What each workstream is waiting on from another, and the blockers behind it.",
      },
    ],
  }),
  component: Dependencies,
});

/**
 * Dependency map.
 *
 * The tiles at the top are the cross-workstream dependencies as the sync stated
 * them: who is waiting on whom, how bad it is, who owns it, when it is due. They
 * tile rather than stack because each one is a self-contained fact, and adjacent
 * cards collapse their borders into a single hairline grid.
 *
 * Below: the blockers Linear itself is flagging, and then the open work by
 * workstream — the same "what is waiting" question asked of the board rather
 * than of the meeting.
 */
function Dependencies() {
  const program = useProgram();
  const WS_ORDER: WorkstreamKey[] = workstreamKeys(program);
  const seed = seedFor(program.id);
  const { linear, isLoading } = useStoredData(program.id);
  const [ws, setWs] = useState<WorkstreamKey | "all">("all");
  const [owner, setOwner] = useState<string>("all");

  const allOwners = useMemo(() => {
    const s = new Set<string>();
    linear.forEach((i) => {
      if (i.assignee) s.add(i.assignee);
    });
    return Array.from(s).sort();
  }, [linear]);

  const open = useMemo(
    () =>
      linear
        .filter((i) => bucketOf(i) !== "done" && bucketOf(i) !== "canceled")
        .filter((i) => ws === "all" || inferWorkstream(i, program) === ws)
        .filter((i) => owner === "all" || i.assignee === owner),
    [linear, ws, owner, program],
  );

  const blockers = useMemo(
    () =>
      // Blocked-or-urgent. Two named predicates rather than one fused
      // condition, so "blocked" means the same thing here as on the landing
      // page; the urgent arm is this page's own addition, stated as such.
      linear.filter((i) => isBlocked(i) || (isOpen(i) && i.priority === 1)),
    [linear],
  );

  const grouped = WS_ORDER.map((k) => ({
    ws: k,
    items: open.filter((i) => inferWorkstream(i, program) === k),
  })).filter((g) => g.items.length > 0);

  const deps =
    ws === "all" ? seed.crossDeps : seed.crossDeps.filter((d) => d.from === ws || d.to === ws);

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Between streams"
        title="Dependency map"
        subtitle="What each workstream is waiting on from another, consolidated from the cross-workstream sync — with the blockers Linear is flagging underneath."
      />

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
        {WS_ORDER.map((k) => (
          <Chip
            key={k}
            label={k}
            active={ws === k}
            tone={workstreamOf(k, program).color}
            onClick={() => setWs(k)}
            title={workstreamOf(k, program).label}
          />
        ))}

        <label style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 18 }}>
          <Mono size={10} tone={KZ.muted} style={{ textTransform: "uppercase" }}>
            Assignee
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
            {allOwners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>

        <Mono size={11} tone={KZ.muted} style={{ marginLeft: "auto" }}>
          {pad2(open.length)} open issues
        </Mono>
      </div>

      <div style={{ padding: "28px var(--kz-pad-x) 60px var(--kz-pad-x)" }}>
        {/* Tiled dependency cards. margin:-0.5px so adjacent borders collapse
            into one hairline instead of doubling up. */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(420px,1fr))",
            gap: 0,
          }}
        >
          {deps.map((d) => (
            <section
              key={d.id}
              style={{
                border: `1px solid ${KZ.bone}`,
                margin: -0.5,
                padding: "20px 24px",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                <WsTag ws={d.from} />
                <Mono size={11}>blocks</Mono>
                <WsTag ws={d.to} />
                <Tag tone={HEALTH_COLOR[d.severity]} style={{ marginLeft: "auto" }}>
                  {HEALTH_LABEL[d.severity]}
                </Tag>
              </div>
              <div
                style={{
                  marginTop: 12,
                  fontSize: 15,
                  fontWeight: 500,
                  lineHeight: 1.35,
                  letterSpacing: "-0.01em",
                }}
              >
                {d.title}
              </div>
              <p
                style={{
                  margin: "8px 0 0 0",
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: KZ.body,
                  textWrap: "pretty",
                }}
              >
                {d.detail}
              </p>
              <div style={{ marginTop: 12 }}>
                <Mono size={10.5}>
                  {d.owner}
                  {d.due ? ` · due ${shortDate(d.due)}` : " · no date stated"}
                </Mono>
              </div>
            </section>
          ))}
        </div>
        {deps.length === 0 ? (
          <div style={{ fontSize: 13.5, color: KZ.body }}>
            No cross-workstream dependency is recorded for this filter.
          </div>
        ) : (
          <Disclosure style={{ marginTop: 14 }}>
            As stated in the cross-workstream sync — a dependency with no date says so rather than
            inventing one
          </Disclosure>
        )}

        {isLoading ? (
          <div style={{ marginTop: 34 }}>
            <Mono size={11}>Loading…</Mono>
          </div>
        ) : (
          <>
            <div style={{ marginTop: 34 }}>
              <Panel>
                <PanelHead
                  label="Blockers & urgent"
                  right={pad2(blockers.length)}
                  rightTone={blockers.length ? KZ.coral : undefined}
                />
                {blockers.length === 0 ? (
                  <div style={{ marginTop: 14, fontSize: 13, color: KZ.body }}>
                    No blockers currently flagged in Linear.
                  </div>
                ) : (
                  <List>
                    {blockers.map((b) => (
                      <IssueRow key={b.identifier} issue={b} />
                    ))}
                  </List>
                )}
                <Disclosure>
                  Titles or labels containing "block", plus anything open at Urgent
                </Disclosure>
              </Panel>
            </div>

            <div
              style={{
                marginTop: 34,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(440px,1fr))",
                gap: 24,
                alignItems: "start",
              }}
            >
              {grouped.map((g) => (
                <Panel key={g.ws}>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "baseline",
                      gap: 12,
                      borderBottom: `1px solid ${KZ.bone}`,
                      paddingBottom: 10,
                    }}
                  >
                    <WsTag ws={g.ws} />
                    <SectionTitle size={16}>{workstreamOf(g.ws, program).label}</SectionTitle>
                    <Mono size={11} style={{ marginLeft: "auto" }}>
                      {pad2(g.items.length)} open
                    </Mono>
                  </div>
                  <List>
                    {g.items.map((i) => (
                      <IssueRow key={i.identifier} issue={i} />
                    ))}
                  </List>
                </Panel>
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function IssueRow({ issue }: { issue: StoredLinearIssue }) {
  const program = useProgram();
  const ws = inferWorkstream(issue, program) as WorkstreamKey;
  return (
    <li
      style={{
        padding: "14px 0",
        borderBottom: `1px solid ${KZ.grey200}`,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <a href={issue.url ?? undefined} target="_blank" rel="noreferrer">
          <Mono size={11} tone={KZ.blue}>
            {issue.identifier}
          </Mono>
        </a>
        <span style={{ fontSize: 14, lineHeight: 1.35 }}>{issue.title}</span>
      </div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          color: KZ.monoDate,
        }}
      >
        <WsTag ws={ws} />
        <span>{issue.assignee ?? "unassigned"}</span>
        <span>· {issue.state_name ?? "—"}</span>
        {issue.priority === 1 || issue.priority === 2 ? (
          <Tag tone={priorityColor(issue.priority)}>{priorityLabel(issue.priority)}</Tag>
        ) : null}
        <span style={{ marginLeft: "auto" }}>{relativeTime(issue.source_updated_at)}</span>
      </div>
    </li>
  );
}
