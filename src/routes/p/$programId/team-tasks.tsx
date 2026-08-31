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
import { PROGRAMS, pageTitle, workstreamKeys, workstreamOf } from "@/lib/program.config";
import { useNotionTasks } from "@/hooks/use-notion-tasks";
import { summarizeTask, tidySection } from "@/lib/task-summary";
import { relativeTime } from "@/hooks/use-program-data";
import {
  useStoredData,
  bucketOf,
  priorityColor,
  priorityLabel,
  inferWorkstream,
  type StoredLinearIssue,
  type LinearBucket,
} from "@/hooks/use-stored-data";
import type { WorkstreamKey } from "@/lib/va-data";
import { useProgram } from "./route";

export const Route = createFileRoute("/p/$programId/team-tasks")({
  head: ({ params }) => ({
    meta: [
      { title: pageTitle("Team tasks", PROGRAMS[params.programId]) },
      { name: "description", content: "Live team task view synced from Linear." },
    ],
  }),
  component: TeamTasks,
});

const UNASSIGNED = "Unassigned";
type Person = string;

/**
 * Display name for an assignee.
 *
 * Linear returns a mix of display names ("Daman Chatha") and raw emails
 * ("nico@kaizenlabs.co"), so both have to reduce to the same short form. Names
 * are derived from whoever actually appears in the data — a hardcoded roster
 * showed one program's people as every program's filter buckets.
 */
function ownerOf(issue: StoredLinearIssue): Person {
  const raw = (issue.assignee ?? "").trim();
  if (!raw) return UNASSIGNED;
  if (!raw.includes("@")) return raw.split(/\s+/)[0];
  const first = raw.split("@")[0].split(".")[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

const BUCKET_LABEL: Record<LinearBucket, string> = {
  in_progress: "In Progress",
  todo: "Todo",
  backlog: "Backlog",
  done: "Done",
  canceled: "Canceled",
};

/** Only three buckets are worth an accent: moving, done, dropped. */
function bucketTone(b: LinearBucket): string {
  switch (b) {
    case "in_progress":
      return KZ.amber;
    case "done":
      return KZ.green;
    case "canceled":
      return KZ.coral;
    default:
      return KZ.muted;
  }
}

/**
 * Every tracked issue, grouped by workstream.
 *
 * Two controls above the list: scope, which decides how much you are being
 * shown, and owner. Both are chip rows rather than cards, because that is what
 * they always were. The rows themselves are flat — mono identifier, title,
 * bucket, priority, owner, when it last moved — so a section reads as a list
 * rather than as a table with a frame around it.
 *
 * Follow-ups are the child route: the things caught between calls that never
 * became an issue.
 */
type Scope = "attention" | "open" | "all";

const SCOPES: Array<{ key: Scope; label: string; hint: string }> = [
  { key: "attention", label: "Needs attention", hint: "In progress, or urgent and high priority" },
  { key: "open", label: "All open", hint: "Everything not done or cancelled" },
  { key: "all", label: "Everything", hint: "Including done and cancelled" },
];

function TeamTasks() {
  const program = useProgram();
  const { isLoading, linear, origin } = useStoredData(program.id);

  const [scope, setScope] = useState<Scope>("attention");
  const [owner, setOwner] = useState<Person | "All">("All");

  const enriched = useMemo(
    () =>
      linear.map((i) => ({
        ...i,
        _owner: ownerOf(i),
        _bucket: bucketOf(i),
        _ws: inferWorkstream(i, program),
      })),
    [linear, program],
  );

  const team = useMemo(() => {
    const names = new Set(enriched.map((t) => t._owner));
    const real = [...names].filter((n) => n !== UNASSIGNED).sort();
    return names.has(UNASSIGNED) ? [...real, UNASSIGNED] : real;
  }, [enriched]);

  const countsByOwner = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of enriched) {
      if (t._bucket === "done" || t._bucket === "canceled") continue;
      m[t._owner] = (m[t._owner] ?? 0) + 1;
    }
    return m;
  }, [enriched]);

  const inScope = (t: (typeof enriched)[number]) => {
    if (scope === "attention") {
      return (
        t._bucket !== "done" &&
        t._bucket !== "canceled" &&
        (t._bucket === "in_progress" || t.priority === 1 || t.priority === 2)
      );
    }
    if (scope === "open") return t._bucket !== "done" && t._bucket !== "canceled";
    return true;
  };

  const rows = useMemo(() => {
    const bucketOrder: Record<LinearBucket, number> = {
      in_progress: 0,
      todo: 1,
      backlog: 2,
      done: 3,
      canceled: 4,
    };
    return enriched
      .filter((t) => inScope(t) && (owner === "All" || t._owner === owner))
      .sort((a, b) => {
        const bo = bucketOrder[a._bucket] - bucketOrder[b._bucket];
        if (bo !== 0) return bo;
        const pa = a.priority && a.priority > 0 ? a.priority : 99;
        const pb = b.priority && b.priority > 0 ? b.priority : 99;
        if (pa !== pb) return pa - pb;
        return a.identifier.localeCompare(b.identifier);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enriched, scope, owner]);

  // One section per workstream, in the program's own display order, plus a
  // trailing group for anything the classifier could not place.
  const wsOrder = workstreamKeys(program);
  const groups = [
    ...wsOrder.map((ws) => ({
      key: ws,
      items: rows.filter((t) => t._ws === ws),
    })),
    { key: "—", items: rows.filter((t) => !wsOrder.includes(t._ws)) },
  ].filter((g) => g.items.length > 0);

  const openTotal = enriched.filter((t) => t._bucket !== "done" && t._bucket !== "canceled").length;
  const activeScope = SCOPES.find((sc) => sc.key === scope)!;

  const scopeCount = (key: Scope) =>
    key === "attention"
      ? enriched.filter(
          (t) =>
            t._bucket !== "done" &&
            t._bucket !== "canceled" &&
            (t._bucket === "in_progress" || t.priority === 1 || t.priority === 2),
        ).length
      : key === "open"
        ? openTotal
        : enriched.length;

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Delivery"
        title="Team tasks"
        subtitle={
          origin === "snapshot"
            ? "Every tracked issue, grouped by workstream — from a captured snapshot, so assignees, statuses and priorities are as of the capture."
            : "Every tracked issue, grouped by workstream — live from Linear."
        }
      />

      {/* Scope and owner. Two chip rows, sharing the header's hairline. */}
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
          Scope
        </Mono>
        {SCOPES.map((sc) => (
          <Chip
            key={sc.key}
            label={`${sc.label} · ${pad2(scopeCount(sc.key))}`}
            active={sc.key === scope}
            onClick={() => setScope(sc.key)}
            title={sc.hint}
          />
        ))}
        <Mono size={10.5} tone={KZ.muted} style={{ marginLeft: "auto" }}>
          {activeScope.hint}
        </Mono>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 8,
          padding: "12px var(--kz-pad-x)",
          borderBottom: `1px solid ${KZ.bone}`,
        }}
      >
        <Mono size={10} tone={KZ.muted} style={{ textTransform: "uppercase", marginRight: 6 }}>
          Owner
        </Mono>
        <Chip label="Everyone" active={owner === "All"} onClick={() => setOwner("All")} />
        {team.map((p) => (
          <Chip
            key={p}
            label={`${p} · ${countsByOwner[p] ?? 0}`}
            active={owner === p}
            onClick={() => setOwner(p)}
          />
        ))}
      </div>

      <div style={{ padding: "28px var(--kz-pad-x) 60px var(--kz-pad-x)" }}>
        {isLoading ? (
          <Mono size={11}>Loading…</Mono>
        ) : groups.length === 0 ? (
          <div
            style={{
              border: `1px solid ${KZ.grey400}`,
              padding: 40,
              textAlign: "center",
              fontSize: 13.5,
              color: KZ.body,
              maxWidth: 720,
            }}
          >
            Nothing in this scope.
            {scope === "attention" ? " Nothing in progress and nothing urgent — try All open." : ""}
          </div>
        ) : (
          groups.map((g) => {
            const ws = workstreamOf(g.key, program);
            return (
              <section key={g.key} style={{ marginBottom: 34 }}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "baseline",
                    gap: 12,
                    borderBottom: `1px solid ${KZ.ink}`,
                    paddingBottom: 10,
                  }}
                >
                  <WsTag ws={g.key as WorkstreamKey} />
                  <SectionTitle size={16}>{ws.label}</SectionTitle>
                  {ws.owner ? <Mono size={10.5}>{ws.owner}</Mono> : null}
                  <Mono size={11} style={{ marginLeft: "auto" }}>
                    {pad2(g.items.length)}
                  </Mono>
                </div>
                <List>
                  {g.items.map((t) => (
                    <li
                      key={t.identifier}
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 14,
                        padding: "13px 0",
                        borderBottom: `1px solid ${KZ.grey200}`,
                      }}
                    >
                      <a
                        href={t.url ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        style={{ width: 76, flex: "0 0 76px" }}
                      >
                        <Mono size={11} tone={KZ.blue}>
                          {t.identifier}
                        </Mono>
                      </a>
                      <span style={{ flex: 1, minWidth: 220, fontSize: 14, lineHeight: 1.35 }}>
                        {t.title}
                      </span>
                      <Tag tone={bucketTone(t._bucket)}>{BUCKET_LABEL[t._bucket]}</Tag>
                      {/* Priority only where it means something. Medium and
                          below get no tag: a row carrying four coloured tokens
                          tells you nothing about which row to read first. */}
                      {t.priority === 1 || t.priority === 2 ? (
                        <Tag tone={priorityColor(t.priority)}>{priorityLabel(t.priority)}</Tag>
                      ) : null}
                      <Mono size={10.5} style={{ width: 110 }} title={t.assignee ?? UNASSIGNED}>
                        {t._owner}
                      </Mono>
                      <Mono size={10.5} style={{ width: 60, textAlign: "right" }}>
                        {relativeTime(t.source_updated_at)}
                      </Mono>
                    </li>
                  ))}
                </List>
              </section>
            );
          })
        )}

        {/* The tracker sits below the tickets and collapsed: it is the larger
            population but the less structured one, and forty-seven expanded
            checkboxes was most of this page's height. */}
        <NotionTrackerSection programId={program.id} />

        <Disclosure style={{ marginTop: 24 }}>
          Tickets live in Linear; the checkbox tracker lives in Notion. Edit either at source and
          hit Refresh — nothing typed here is written back
        </Disclosure>
      </div>
    </AppLayout>
  );
}

function NotionTrackerSection({ programId }: { programId: string }) {
  const { isLoading, open, done, bySection, readAt, status } = useNotionTasks(programId);
  const [showDone, setShowDone] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  if (status === "not-configured") return null;

  return (
    <Panel style={{ marginTop: 10 }}>
      <PanelHead
        label={`Notion tracker${status === "ok" ? ` · ${pad2(open.length)} open` : ""}`}
        right={
          status === "ok" && done.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              style={{
                border: 0,
                background: "transparent",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                textTransform: "uppercase",
                color: KZ.blue,
                cursor: "pointer",
                padding: 0,
              }}
            >
              {showDone ? "Hide" : "Show"} {done.length} done
            </button>
          ) : undefined
        }
      />

      <div style={{ marginTop: 10 }}>
        <Mono size={10.5}>
          Hand-maintained checkboxes that never became Linear tickets.
          {status === "ok" && readAt ? ` Read ${relativeTime(readAt)}.` : ""}
        </Mono>
      </div>

      {isLoading ? (
        <Mono size={11} style={{ display: "block", marginTop: 14 }}>
          Reading the tracker…
        </Mono>
      ) : status === "no-token" ? (
        <div style={{ marginTop: 14, fontSize: 13, color: KZ.amber }}>
          NOTION_API_KEY is not set, so the tracker cannot be read. The Linear sections above are
          unaffected.
        </div>
      ) : status === "read-failed" ? (
        <div style={{ marginTop: 14, fontSize: 13, lineHeight: 1.5, color: KZ.amber }}>
          Could not read the tracker page. Most often this means the page is not shared with the
          Notion integration — Notion answers 404 rather than 403 for that, so it looks like a
          missing page.
        </div>
      ) : open.length === 0 && done.length === 0 ? (
        <div style={{ marginTop: 14, fontSize: 13, color: KZ.body }}>
          The tracker page has no checkbox items.
        </div>
      ) : (
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 18 }}>
          {bySection.map((group) => {
            const rows = showDone ? [...group.open, ...group.done] : group.open;
            if (rows.length === 0) return null;
            const expanded = Boolean(openSections[group.section]);
            return (
              <div key={group.section}>
                <button
                  type="button"
                  onClick={() => toggleSection(group.section)}
                  aria-expanded={expanded}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    width: "100%",
                    border: 0,
                    borderBottom: `1px solid ${KZ.grey200}`,
                    paddingBottom: 8,
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    textTransform: "uppercase",
                    color: KZ.ink,
                  }}
                >
                  <span aria-hidden style={{ width: 10 }}>
                    {expanded ? "−" : "+"}
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>{tidySection(group.section)}</span>
                  <span style={{ color: KZ.muted }}>
                    {pad2(group.open.length)} open
                    {group.done.length ? ` · ${group.done.length} done` : ""}
                  </span>
                </button>
                {expanded ? (
                  <List style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                    {rows.map((t) => {
                      const sum = summarizeTask(t.text);
                      const refs = t.ticketRefs.filter((r) => !t.text.includes(r));
                      return (
                        <li
                          key={t.id}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 10,
                            paddingLeft: t.depth * 16,
                          }}
                        >
                          <span
                            aria-hidden
                            style={{
                              marginTop: 4,
                              width: 10,
                              flex: "0 0 10px",
                              fontFamily: "var(--font-mono)",
                              fontSize: 11,
                              color: t.checked ? KZ.green : KZ.muted,
                            }}
                          >
                            {t.checked ? "✓" : "▫"}
                          </span>
                          <span style={{ minWidth: 0, flex: 1 }}>
                            {/* Headline carries the link; the full original
                                stays on the title attribute so nothing the
                                author wrote is unreachable from the row. */}
                            <a
                              href={t.url}
                              target="_blank"
                              rel="noreferrer"
                              title={t.text}
                              style={{
                                fontSize: 13.5,
                                fontWeight: 500,
                                color: t.checked ? KZ.muted : KZ.ink,
                                textDecoration: t.checked ? "line-through" : undefined,
                              }}
                            >
                              {sum.headline}
                            </a>
                            {refs.length ? (
                              <Mono size={10.5} tone={KZ.blue} style={{ marginLeft: 8 }}>
                                {refs.join(" ")}
                              </Mono>
                            ) : null}
                            {sum.detail && !t.checked ? (
                              <div
                                style={{
                                  marginTop: 4,
                                  fontSize: 12.5,
                                  lineHeight: 1.45,
                                  color: KZ.body,
                                }}
                              >
                                {sum.detail}
                              </div>
                            ) : null}
                          </span>
                        </li>
                      );
                    })}
                  </List>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
