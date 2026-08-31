import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { WsTag } from "@/components/va-ui";
import { Chip, Disclosure, KZ, List, Mono, Tag, pad2 } from "@/components/kz";
import type { WorkstreamKey } from "@/lib/va-data";
import { useStoredData, inferWorkstream } from "@/hooks/use-stored-data";
import { relativeTime } from "@/hooks/use-program-data";
import { PROGRAMS, pageTitle } from "@/lib/program.config";
import { shortDate } from "@/lib/local-date";
import { useProgram } from "./route";

export const Route = createFileRoute("/p/$programId/activity")({
  head: ({ params }) => ({
    meta: [
      { title: pageTitle("Activity feed", PROGRAMS[params.programId]) },
      {
        name: "description",
        content: "Reverse-chronological program event stream from Linear and Notion.",
      },
    ],
  }),
  component: ActivityFeed,
});

type Kind = "linear" | "notion";

/** One tone per source, so the column reads by origin at a glance. */
const KIND_META: Record<Kind, { label: string; tone: string }> = {
  linear: { label: "Linear", tone: KZ.amber },
  notion: { label: "Notion", tone: KZ.blue },
};

type Event = {
  ts: string;
  kind: Kind;
  title: string;
  detail?: string;
  url?: string | null;
  ws?: WorkstreamKey;
};

/**
 * What moved, in order.
 *
 * Timeline rows: a mono date column on the left, then the source tag, the label
 * and the workstream, then the entry itself. Grouped by day, because "when" is
 * the only axis this page has.
 */
function ActivityFeed() {
  const program = useProgram();
  const { linear, notion, isLoading, origin } = useStoredData(program.id);
  const [kind, setKind] = useState<Kind | "all">("all");

  const events: Event[] = useMemo(() => {
    const out: Event[] = [];
    for (const i of linear) {
      if (!i.source_updated_at) continue;
      out.push({
        ts: i.source_updated_at,
        kind: "linear",
        title: i.title,
        detail: `${i.identifier} · ${i.state_name ?? "—"} · ${i.assignee ?? "unassigned"}`,
        url: i.url,
        ws: inferWorkstream(i, program) as WorkstreamKey,
      });
    }
    for (const n of notion) {
      if (!n.source_updated_at) continue;
      out.push({
        ts: n.source_updated_at,
        kind: "notion",
        title: n.title,
        detail: "Notion page updated",
        url: n.url,
      });
    }
    return out.sort((a, b) => b.ts.localeCompare(a.ts));
  }, [linear, notion, program]);

  const filtered = kind === "all" ? events : events.filter((e) => e.kind === kind);

  const grouped = useMemo(() => {
    const g = new Map<string, Event[]>();
    for (const e of filtered) {
      const d = e.ts.slice(0, 10);
      if (!g.has(d)) g.set(d, []);
      g.get(d)!.push(e);
    }
    return Array.from(g.entries());
  }, [filtered]);

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Feed"
        title="Activity"
        subtitle={
          origin === "snapshot"
            ? "What moved, in order, across Linear and Notion — from a captured snapshot."
            : "What moved, in order, across Linear and Notion — live."
        }
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
          Source
        </Mono>
        {(["all", "linear", "notion"] as const).map((k) => (
          <Chip
            key={k}
            label={k === "all" ? "All" : KIND_META[k].label}
            active={kind === k}
            tone={k === "all" ? KZ.ink : KIND_META[k].tone}
            onClick={() => setKind(k)}
          />
        ))}
        <Mono size={11} tone={KZ.muted} style={{ marginLeft: "auto" }}>
          {pad2(filtered.length)} events
        </Mono>
      </div>

      <div style={{ padding: "28px var(--kz-pad-x) 60px var(--kz-pad-x)", maxWidth: 1000 }}>
        {isLoading ? (
          <Mono size={11}>Loading…</Mono>
        ) : grouped.length === 0 ? (
          <div style={{ fontSize: 13.5, color: KZ.body }}>
            Nothing has moved in this source since the last read.
          </div>
        ) : (
          <List>
            {grouped.flatMap(([date, items]) =>
              items.map((e, i) => (
                <li
                  key={`${date}-${i}`}
                  style={{
                    display: "flex",
                    gap: 24,
                    padding: "18px 0",
                    borderBottom: `1px solid ${KZ.grey200}`,
                  }}
                >
                  {/* The date prints once per day; subsequent rows in the same
                      day leave the column empty rather than repeating it. */}
                  <div style={{ width: 66, flex: "0 0 66px" }}>
                    {i === 0 ? (
                      <Mono size={11} tone={KZ.ink}>
                        {shortDate(date)}
                      </Mono>
                    ) : null}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <Tag tone={KIND_META[e.kind].tone}>{KIND_META[e.kind].label}</Tag>
                      {e.detail ? <Mono size={10.5}>{e.detail}</Mono> : null}
                      {e.ws ? <WsTag ws={e.ws} /> : null}
                      <Mono size={10.5} style={{ marginLeft: "auto" }}>
                        {relativeTime(e.ts)}
                      </Mono>
                    </div>
                    <p
                      style={{
                        margin: "8px 0 0 0",
                        fontSize: 14,
                        lineHeight: 1.5,
                        maxWidth: "78ch",
                      }}
                    >
                      {e.url ? (
                        <a href={e.url} target="_blank" rel="noreferrer" style={{ color: KZ.ink }}>
                          {e.title}
                        </a>
                      ) : (
                        e.title
                      )}
                    </p>
                  </div>
                </li>
              )),
            )}
          </List>
        )}
        <Disclosure>
          Ordered by the source's own last-updated timestamp — not by when this app read it
        </Disclosure>
      </div>
    </AppLayout>
  );
}
