import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { WORKSTREAMS, type WorkstreamKey } from "@/lib/va-data";
import { useStoredData, inferWorkstream } from "@/hooks/use-stored-data";
import { relativeTime } from "@/hooks/use-program-data";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity feed — VA Program Intel" },
      { name: "description", content: "Reverse-chronological program event stream from Linear, Notion and Granola." },
    ],
  }),
  component: ActivityFeed,
});

type Kind = "linear" | "notion" | "granola";

const KIND_META: Record<Kind, { label: string; color: string }> = {
  linear: { label: "Linear", color: "#4a3fb5" },
  notion: { label: "Notion", color: "#2e6b2f" },
  granola: { label: "Granola", color: "#8a5a00" },
};

type Event = {
  ts: string;
  kind: Kind;
  title: string;
  detail?: string;
  url?: string | null;
  ws?: WorkstreamKey;
};

function ActivityFeed() {
  const { linear, notion, granola, isLoading } = useStoredData();
  const [kind, setKind] = useState<Kind | "all">("all");

  const events: Event[] = useMemo(() => {
    const out: Event[] = [];
    for (const i of linear) {
      if (!i.source_updated_at) continue;
      out.push({
        ts: i.source_updated_at,
        kind: "linear",
        title: `${i.identifier} · ${i.title}`,
        detail: `${i.state_name ?? "—"} · ${i.assignee ?? "unassigned"}`,
        url: i.url,
        ws: inferWorkstream(i) as WorkstreamKey,
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
    for (const g of granola) {
      if (!g.source_updated_at) continue;
      out.push({
        ts: g.source_updated_at,
        kind: "granola",
        title: g.title,
        detail: "Meeting captured",
        url: g.url,
      });
    }
    return out.sort((a, b) => b.ts.localeCompare(a.ts));
  }, [linear, notion, granola]);

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
        title="Activity feed"
        subtitle="Everything that changed, newest first — live from all three sources."
      />
      <div
        className="flex flex-wrap items-center gap-3 px-6 py-3"
        style={{ borderBottom: "1px solid #e5e5e2" }}
      >
        <span className="text-[11px] uppercase tracking-wide" style={{ color: "#666" }}>Source</span>
        {(["all", "linear", "notion", "granola"] as const).map((k) => {
          const active = kind === k;
          const c = k === "all" ? "#3a5a40" : KIND_META[k].color;
          return (
            <button
              key={k}
              onClick={() => setKind(k)}
              className="rounded px-2 py-1 text-[11px] font-semibold"
              style={{
                border: `1px solid ${active ? c : "#dfe1e2"}`,
                backgroundColor: active ? c : "#fff",
                color: active ? "#fff" : "#1b1b1b",
              }}
            >
              {k === "all" ? "All" : KIND_META[k].label}
            </button>
          );
        })}
        <span className="ml-auto text-[11px]" style={{ color: "#666" }}>
          {filtered.length} events
        </span>
      </div>

      {isLoading ? (
        <div className="p-6 text-[13px]" style={{ color: "#565c65" }}>Loading live data…</div>
      ) : (
        <div className="p-6 space-y-4">
          {grouped.map(([date, items]) => (
            <section key={date}>
              <div className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#3a5a40" }}>
                {date}
              </div>
              <ul className="rounded-md bg-white" style={{ border: "1px solid #e5e5e2" }}>
                {items.map((e, i) => {
                  const k = KIND_META[e.kind];
                  return (
                    <li
                      key={i}
                      className="flex items-start gap-3 px-3 py-2 text-[13px]"
                      style={{ borderTop: i === 0 ? undefined : "1px solid #eee" }}
                    >
                      <span
                        className="mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                        style={{
                          color: k.color,
                          backgroundColor: `${k.color}14`,
                          border: `1px solid ${k.color}44`,
                          minWidth: 62,
                          textAlign: "center",
                        }}
                      >
                        {k.label}
                      </span>
                      {e.ws ? (
                        <span
                          className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: WORKSTREAMS[e.ws].color }}
                          title={e.ws}
                        />
                      ) : (
                        <span className="mt-1 inline-block h-2 w-2 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">
                          {e.url ? (
                            <a href={e.url} target="_blank" rel="noreferrer" className="underline" style={{ color: "#005ea2" }}>
                              {e.title}
                            </a>
                          ) : (
                            e.title
                          )}
                        </div>
                        {e.detail ? (
                          <div className="text-[11px]" style={{ color: "#565c65" }}>
                            {e.detail} · {relativeTime(e.ts)}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
