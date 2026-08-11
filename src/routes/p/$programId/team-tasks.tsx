import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { SectionTabs } from "@/components/SectionTabs";
import { UrgencyDot } from "@/components/va-ui";
import { PROGRAMS, pageTitle } from "@/lib/program.config";
import { useProgram } from "./route";
import { useNotionTasks } from "@/hooks/use-notion-tasks";
import { summarizeTask, tidySection } from "@/lib/task-summary";
import { relativeTime } from "@/hooks/use-program-data";
import {
  useStoredData,
  bucketOf,
  priorityLabel,
  type StoredLinearIssue,
  type LinearBucket,
  inferWorkstream,
} from "@/hooks/use-stored-data";

export const Route = createFileRoute("/p/$programId/team-tasks")({
  head: ({ params }) => ({
    meta: [
      { title: pageTitle("Team tasks", PROGRAMS[params.programId]) },
      { name: "description", content: "Live team task view synced from Linear." },
    ],
  }),
  component: TeamTasks,
});

// Normalize Linear assignee (email or full name) → short display name
const UNASSIGNED = "Unassigned";
type Person = string;

/**
 * Display name for an assignee.
 *
 * There used to be a hardcoded OWNER_MAP and TEAM of four VA people here, so
 * every program showed VA's roster as its filter buckets and filed everyone
 * outside it as unassigned — on Ventura that was all 25 issues. Names are now
 * derived from whoever actually appears in the data.
 *
 * Linear returns a mix of display names ("Daman Chatha") and raw emails
 * ("nico@kaizenlabs.co"), so both have to reduce to the same short form.
 */
function ownerOf(issue: StoredLinearIssue): Person {
  const raw = (issue.assignee ?? "").trim();
  if (!raw) return UNASSIGNED;
  // A real display name: keep the given name.
  if (!raw.includes("@")) return raw.split(/\s+/)[0];
  // An email: take the local part before any dot, and capitalise it.
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

function bucketStyle(b: LinearBucket): { color: string; bg: string } {
  switch (b) {
    case "in_progress":
      return { color: "#1a6fa8", bg: "#e6f0f7" };
    case "todo":
      return { color: "#1b1b1b", bg: "#f0f0f0" };
    case "backlog":
      return { color: "#565c65", bg: "#f8f9fa" };
    case "done":
      return { color: "#1b6e2f", bg: "#e6f4ea" };
    case "canceled":
      return { color: "#7a1414", bg: "#fbeaea" };
  }
}

function priorityStyle(p: number | null): { color: string; bg: string } {
  switch (p) {
    case 1:
      return { color: "#b3261e", bg: "#fbeaea" };
    case 2:
      return { color: "#8a5a00", bg: "#fdf3d8" };
    case 3:
      return { color: "#1a6fa8", bg: "#e6f0f7" };
    case 4:
      return { color: "#565c65", bg: "#f0f0f0" };
    default:
      return { color: "#888", bg: "#f0f0f0" };
  }
}

/**
 * Work, by person.
 *
 * Rebuilt around a default working set. It used to render the whole dataset
 * three times over — the Notion tracker fully expanded, a "Right this second"
 * list, per-person cards, and then a table of everything — which measured 6.5
 * screens of scroll and 107 rows, with all 43 tickets appearing in more than
 * one section. The reader was left to do the reduction.
 *
 * The principle borrowed from the nav collapse: grouping is a control, not a
 * destination. One level down, volume is a control too. So this shows what
 * needs attention now, and everything else is one click away:
 *
 *   - The scope selector replaces the "Right this second" section. That list
 *     was a filter of the table rendered as its own inventory; now it IS the
 *     default filter, so the same tickets are not printed twice.
 *   - Tracker sections start collapsed. 47 open checkboxes across six
 *     headings is a page on its own; the counts are the summary.
 *   - Owner chips are a filter row, styled as controls rather than as cards,
 *     because that is what they always were.
 *   - The table lost the Priority and Workstream columns. Priority is a dot
 *     against the title; workstream has an entire tab of its own, which is the
 *     point of the tab grouping.
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
  const todayIso = new Date().toISOString().slice(0, 10);
  const currentWindow =
    program.sprintStrip.find((w) => w.start <= todayIso && todayIso <= w.end) ?? null;

  const [scope, setScope] = useState<Scope>("attention");
  const [owner, setOwner] = useState<Person | "All">("All");

  const withOwner = useMemo(
    () => linear.map((i) => ({ ...i, _owner: ownerOf(i), _bucket: bucketOf(i) })),
    [linear],
  );

  const team = useMemo(() => {
    const names = new Set(withOwner.map((t) => t._owner));
    const real = [...names].filter((n) => n !== UNASSIGNED).sort();
    return names.has(UNASSIGNED) ? [...real, UNASSIGNED] : real;
  }, [withOwner]);

  const countsByOwner = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of withOwner) {
      if (t._bucket === "done" || t._bucket === "canceled") continue;
      m[t._owner] = (m[t._owner] ?? 0) + 1;
    }
    return m;
  }, [withOwner]);

  const rows = useMemo(() => {
    let out = withOwner;
    if (scope === "attention") {
      out = out.filter(
        (t) =>
          t._bucket !== "done" &&
          t._bucket !== "canceled" &&
          (t._bucket === "in_progress" || t.priority === 1 || t.priority === 2),
      );
    } else if (scope === "open") {
      out = out.filter((t) => t._bucket !== "done" && t._bucket !== "canceled");
    }
    if (owner !== "All") out = out.filter((t) => t._owner === owner);

    const bucketOrder: Record<LinearBucket, number> = {
      in_progress: 0,
      todo: 1,
      backlog: 2,
      done: 3,
      canceled: 4,
    };
    return [...out].sort((a, b) => {
      const bo = bucketOrder[a._bucket] - bucketOrder[b._bucket];
      if (bo !== 0) return bo;
      const pa = a.priority && a.priority > 0 ? a.priority : 99;
      const pb = b.priority && b.priority > 0 ? b.priority : 99;
      if (pa !== pb) return pa - pb;
      return a.identifier.localeCompare(b.identifier);
    });
  }, [withOwner, scope, owner]);

  const openTotal = withOwner.filter(
    (t) => t._bucket !== "done" && t._bucket !== "canceled",
  ).length;
  const activeScope = SCOPES.find((sc) => sc.key === scope)!;

  return (
    <AppLayout>
      <PageHeader
        title={currentWindow ? `Work — ${currentWindow.label}` : "Work"}
        subtitle={
          origin === "snapshot"
            ? "From a captured snapshot · assignees, statuses and priorities are as of the capture"
            : "Live from Linear · assignees, statuses, and priorities update on sync"
        }
      />
      <SectionTabs group="work" />
      <div className="space-y-5 px-4 py-5 sm:px-6">
        {/* Scope. The page's one real control: it decides how much you are
            being shown, which is the thing that was previously not adjustable
            because everything was always shown. */}
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            {SCOPES.map((sc) => {
              const active = sc.key === scope;
              const count =
                sc.key === "attention"
                  ? withOwner.filter(
                      (t) =>
                        t._bucket !== "done" &&
                        t._bucket !== "canceled" &&
                        (t._bucket === "in_progress" || t.priority === 1 || t.priority === 2),
                    ).length
                  : sc.key === "open"
                    ? openTotal
                    : withOwner.length;
              return (
                <button
                  key={sc.key}
                  type="button"
                  onClick={() => setScope(sc.key)}
                  aria-pressed={active}
                  className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: active ? "#1b1b1b" : "#fff",
                    color: active ? "#fff" : "#565c65",
                    border: `1px solid ${active ? "#1b1b1b" : "#dfe1e2"}`,
                  }}
                >
                  {sc.label} · {count}
                </button>
              );
            })}
          </div>
          <div className="mt-1.5 text-xs" style={{ color: "#8a8a80" }}>
            {activeScope.hint}.
          </div>
        </div>

        {/* Owner filter. A row of chips, not a grid of cards: these were always
            controls, and card styling made them read as content to be read. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip label="Everyone" active={owner === "All"} onClick={() => setOwner("All")} />
          {team.map((p) => (
            <FilterChip
              key={p}
              label={`${p} · ${countsByOwner[p] ?? 0}`}
              active={owner === p}
              onClick={() => setOwner(p)}
            />
          ))}
        </div>

        {isLoading ? (
          <div className="text-sm" style={{ color: "#565c65" }}>
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div
            className="rounded-md border border-dashed p-6 text-center text-sm"
            style={{ borderColor: "#dcdcd6", color: "#565c65" }}
          >
            Nothing in this scope.
            {scope === "attention" ? " Nothing in progress and nothing urgent — try All open." : ""}
          </div>
        ) : (
          <div
            className="overflow-hidden rounded-md bg-white"
            style={{ border: "1px solid #e5e5e2" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    className="text-left uppercase tracking-wide"
                    style={{ color: "#8a8a80", fontSize: 12, borderBottom: "1px solid #e5e5e2" }}
                  >
                    <th className="px-3 py-2 font-medium">Ticket</th>
                    <th className="px-3 py-2 font-medium">Title</th>
                    <th className="px-3 py-2 font-medium">Owner</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id} style={{ borderTop: "1px solid #f0f0ec" }}>
                      <td className="px-3 py-2 align-top">
                        <a
                          href={t.url ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs hover:underline"
                          style={{ color: "#565c65" }}
                        >
                          {t.identifier}
                        </a>
                      </td>
                      <td className="px-3 py-2 align-top" style={{ color: "#1b1b1b" }}>
                        <span className="flex items-start gap-2">
                          {/* One accent, spent on the only thing that is
                              actually wrong: urgent or high priority. Medium,
                              low and none get no colour at all, because a row
                              carrying four coloured tokens tells you nothing
                              about which row to read first. */}
                          <UrgencyDot priority={t.priority} />
                          <span>{t.title}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 align-top" style={{ color: "#565c65" }}>
                        {t._owner}
                      </td>
                      <td className="px-3 py-2 align-top text-xs" style={{ color: "#565c65" }}>
                        {BUCKET_LABEL[t._bucket]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tracker below the ticket table and collapsed by default: it is the
            larger population but the less structured one, and 47 expanded
            checkboxes was most of the page's height. */}
        <NotionTrackerSection programId={program.id} />

        <p className="text-xs" style={{ color: "#8a8a80" }}>
          Tickets live in Linear; the checkbox tracker lives in Notion. Edit either
          at source and hit Refresh — nothing typed here is written back.
        </p>
      </div>
    </AppLayout>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded px-2 py-1 text-xs font-medium transition-colors"
      style={{
        backgroundColor: active ? "#eef2ee" : "transparent",
        color: active ? "#1b1b1b" : "#8a8a80",
        border: `1px solid ${active ? "#c3d3c3" : "#e5e5e2"}`,
      }}
    >
      {label}
    </button>
  );
}


function NotionTrackerSection({ programId }: { programId: string }) {
  const { isLoading, open, done, bySection, readAt, status } = useNotionTasks(programId);
  const [showDone, setShowDone] = useState(false);
  // Sections start collapsed. Forty-seven open checkboxes across six headings
  // was most of this page's height, and the counts on the headers are the
  // summary a reader actually wanted first.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  if (status === "not-configured") return null;

  return (
    <section
      style={{
        border: "1px solid #dfe1e2",
        borderLeft: "4px solid #2e6b2f",
        backgroundColor: "#fff",
        padding: 16,
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div
            className="text-[13px] font-semibold uppercase tracking-wide"
            style={{ color: "#2e6b2f", fontFamily: "Public Sans, system-ui, sans-serif" }}
          >
            Notion tracker{status === "ok" ? ` — ${open.length} open` : ""}
          </div>
          <div className="mt-1 text-xs" style={{ color: "#565c65" }}>
            Hand-maintained checkboxes that never became Linear tickets.
            {status === "ok" && readAt ? ` Read ${relativeTime(readAt)}.` : ""}
          </div>
        </div>
        {status === "ok" && done.length > 0 ? (
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide"
            style={{ border: "1px solid #dfe1e2", backgroundColor: "#fff", color: "#3a5a40" }}
          >
            {showDone ? "Hide" : "Show"} {done.length} done
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <div className="mt-3 text-[13px]" style={{ color: "#565c65" }}>
          Reading the tracker…
        </div>
      ) : status === "no-token" ? (
        <div className="mt-3 text-[13px]" style={{ color: "#8a5a00" }}>
          NOTION_API_KEY is not set, so the tracker cannot be read. The Linear
          sections below are unaffected.
        </div>
      ) : status === "read-failed" ? (
        <div className="mt-3 text-[13px]" style={{ color: "#8a5a00" }}>
          Could not read the tracker page. Most often this means the page is not
          shared with the Notion integration — Notion answers 404 rather than 403
          for that, so it looks like a missing page.
        </div>
      ) : open.length === 0 && done.length === 0 ? (
        <div className="mt-3 text-[13px]" style={{ color: "#565c65" }}>
          The tracker page has no checkbox items.
        </div>
      ) : (
        <div className="mt-4 space-y-4">
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
                  className="mb-1.5 flex w-full items-baseline gap-2 text-left text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "#565c65" }}
                >
                  <span aria-hidden style={{ width: 10, display: "inline-block" }}>
                    {expanded ? "▾" : "▸"}
                  </span>
                  <span className="min-w-0 flex-1">
                    {tidySection(group.section)} · {group.open.length} open
                    {group.done.length ? ` · ${group.done.length} done` : ""}
                  </span>
                </button>
                {expanded ? (
                <ul className="space-y-1">
                  {rows.map((t) => {
                    const sum = summarizeTask(t.text);
                    const refs = t.ticketRefs.filter((r) => !t.text.includes(r));
                    return (
                      <li
                        key={t.id}
                        className="flex items-start gap-2 text-[13px]"
                        style={{ paddingLeft: t.depth * 16 }}
                      >
                        <span
                          aria-hidden
                          className="mt-0.5 shrink-0 font-mono text-xs"
                          style={{ color: t.checked ? "#2e8540" : "#8a8a80" }}
                        >
                          {t.checked ? "\u2713" : "\u25a2"}
                        </span>
                        <span className="min-w-0 flex-1">
                          {/* Headline carries the link and the emphasis. Full
                              original stays on the title attribute so nothing
                              the author wrote is unreachable from the row. */}
                          <a
                            href={t.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium hover:underline"
                            title={t.text}
                            style={{
                              color: t.checked ? "#8a8a80" : "#1b1b1b",
                              textDecoration: t.checked ? "line-through" : undefined,
                            }}
                          >
                            {sum.headline}
                          </a>
                          {refs.length ? (
                            <span
                              className="ml-2 font-mono text-xs"
                              style={{ color: "#4a3fb5" }}
                            >
                              {refs.join(" ")}
                            </span>
                          ) : null}
                          {/* Detail on its own muted line rather than inline.
                              Sixty lines of running prose is the wall this
                              page had; a headline column with the specifics
                              underneath is scannable at the same density. */}
                          {sum.detail && !t.checked ? (
                            <div
                              className="mt-0.5 text-xs leading-snug"
                              style={{ color: "#6b7280" }}
                            >
                              {sum.detail}
                            </div>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
