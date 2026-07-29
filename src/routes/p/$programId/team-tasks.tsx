import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { PROGRAMS, pageTitle } from "@/lib/program.config";
import { useProgram } from "./route";
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

function TeamTasks() {
  const program = useProgram();
  const { isLoading, linear, origin } = useStoredData(program.id);
  // Whichever window in this program's own strip contains today.
  const todayIso = new Date().toISOString().slice(0, 10);
  const currentWindow =
    program.sprintStrip.find((w) => w.start <= todayIso && todayIso <= w.end) ?? null;
  const [filter, setFilter] = useState<Person | "All">("All");
  // Whoever is actually on this program's board, alphabetical, unassigned last
  // so it does not lead the row of cards.
  const team = useMemo(() => {
    const names = new Set(linear.map(ownerOf));
    const real = [...names].filter((n) => n !== UNASSIGNED).sort();
    return names.has(UNASSIGNED) ? [...real, UNASSIGNED] : real;
  }, [linear]);
  const [hideDone, setHideDone] = useState(true);

  const withOwner = useMemo(
    () => linear.map((i) => ({ ...i, _owner: ownerOf(i), _bucket: bucketOf(i) })),
    [linear],
  );

  const filtered = useMemo(() => {
    let out = filter === "All" ? withOwner : withOwner.filter((t) => t._owner === filter);
    if (hideDone) out = out.filter((t) => t._bucket !== "done" && t._bucket !== "canceled");
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
      const pa = a.priority ?? 99;
      const pb = b.priority ?? 99;
      if (pa !== pb) return pa - pb;
      return a.identifier.localeCompare(b.identifier);
    });
  }, [withOwner, filter, hideDone]);

  const rightNow = useMemo(() => {
    return withOwner
      .filter((t) => t._bucket !== "done" && t._bucket !== "canceled")
      .filter((t) => t._bucket === "in_progress" || t.priority === 1)
      .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  }, [withOwner]);

  const countsByOwner = useMemo(() => {
    const m: Record<string, { open: number; done: number }> = {};
    for (const p of team) m[p] = { open: 0, done: 0 };
    for (const t of withOwner) {
      if (!m[t._owner]) m[t._owner] = { open: 0, done: 0 };
      if (t._bucket === "done" || t._bucket === "canceled") m[t._owner].done++;
      else m[t._owner].open++;
    }
    return m;
  }, [withOwner]);

  return (
    <AppLayout>
      <PageHeader
        // Was a hardcoded "Sprint 4", which named a VA sprint on every program.
        title={currentWindow ? `Team tasks — ${currentWindow.label}` : "Team tasks"}
        subtitle={
          origin === "snapshot"
            ? "From a captured snapshot · assignees, statuses and priorities are as of the capture"
            : "Live from Linear · assignees, statuses, and priorities update on sync"
        }
      />
      <div className="px-6 py-5 space-y-6">
        {/* Right now */}
        <section
          style={{
            border: "1px solid #dfe1e2",
            borderLeft: "4px solid #b3261e",
            backgroundColor: "#fff",
            padding: 16,
          }}
        >
          <div
            className="text-[13px] font-semibold uppercase tracking-wide"
            style={{ color: "#b3261e", fontFamily: "Public Sans, system-ui, sans-serif" }}
          >
            Right this second
          </div>
          <div className="mt-1 text-[12px]" style={{ color: "#565c65" }}>
            Anything currently In Progress or marked Urgent in Linear.
          </div>
          {isLoading ? (
            <div className="mt-3 text-[13px]" style={{ color: "#565c65" }}>
              Loading…
            </div>
          ) : rightNow.length === 0 ? (
            <div className="mt-3 text-[13px]" style={{ color: "#565c65" }}>
              Nothing active — nice.
            </div>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {rightNow.map((t) => {
                const pr = priorityStyle(t.priority);
                const st = bucketStyle(t._bucket);
                return (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 text-[13px]"
                    style={{ padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}
                  >
                    <span
                      className="text-[11px] font-mono"
                      style={{ color: "#565c65", minWidth: 70 }}
                    >
                      {t.identifier}
                    </span>
                    <a
                      href={t.url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      style={{ flex: 1, color: "#1b1b1b", textDecoration: "none" }}
                    >
                      {t.title}
                    </a>
                    <span
                      className="text-[11px] font-semibold"
                      style={{
                        color: pr.color,
                        backgroundColor: pr.bg,
                        padding: "2px 8px",
                        borderRadius: 3,
                      }}
                    >
                      {priorityLabel(t.priority)}
                    </span>
                    <span
                      className="text-[11px] font-semibold"
                      style={{
                        color: st.color,
                        backgroundColor: st.bg,
                        padding: "2px 8px",
                        borderRadius: 3,
                      }}
                    >
                      {BUCKET_LABEL[t._bucket]}
                    </span>
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: "#565c65", minWidth: 80 }}
                    >
                      {t._owner}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Owner summary */}
        <section className="grid grid-cols-5 gap-3">
          {team.map((p) => {
            const c = countsByOwner[p];
            const active = filter === p;
            return (
              <button
                key={p}
                onClick={() => setFilter(active ? "All" : p)}
                style={{
                  border: active ? "2px solid #3a5a40" : "1px solid #dfe1e2",
                  backgroundColor: "#fff",
                  padding: 12,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div className="text-[13px] font-semibold" style={{ color: "#1b1b1b" }}>
                  {p}
                </div>
                <div className="mt-1 text-[11px]" style={{ color: "#565c65" }}>
                  {c.open} open · {c.done} done
                </div>
              </button>
            );
          })}
        </section>

        {/* Filters */}
        <div className="flex items-center gap-3 text-[12px]" style={{ color: "#565c65" }}>
          <span>Showing:</span>
          <button
            onClick={() => setFilter("All")}
            style={{
              padding: "3px 10px",
              border: "1px solid #dfe1e2",
              backgroundColor: filter === "All" ? "#3a5a40" : "#fff",
              color: filter === "All" ? "#fff" : "#1b1b1b",
              cursor: "pointer",
            }}
          >
            All ({withOwner.length})
          </button>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={hideDone}
              onChange={(e) => setHideDone(e.target.checked)}
            />
            Hide done / canceled
          </label>
        </div>

        {/* Task table */}
        <section style={{ border: "1px solid #dfe1e2", backgroundColor: "#fff" }}>
          {isLoading ? (
            <div className="p-4 text-[13px]" style={{ color: "#565c65" }}>
              Loading Linear issues…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-[13px]" style={{ color: "#565c65" }}>
              No issues match.
            </div>
          ) : (
            <table className="w-full text-[13px]" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #dfe1e2", backgroundColor: "#f8f9fa" }}>
                  <th
                    style={{
                      padding: "8px 10px",
                      textAlign: "left",
                      width: 78,
                      color: "#565c65",
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: "uppercase",
                    }}
                  >
                    Ticket
                  </th>
                  <th
                    style={{
                      padding: "8px 10px",
                      textAlign: "left",
                      color: "#565c65",
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: "uppercase",
                    }}
                  >
                    Title
                  </th>
                  <th
                    style={{
                      padding: "8px 10px",
                      textAlign: "left",
                      color: "#565c65",
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: "uppercase",
                    }}
                  >
                    Priority
                  </th>
                  <th
                    style={{
                      padding: "8px 10px",
                      textAlign: "left",
                      color: "#565c65",
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: "uppercase",
                    }}
                  >
                    Status
                  </th>
                  <th
                    style={{
                      padding: "8px 10px",
                      textAlign: "left",
                      color: "#565c65",
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: "uppercase",
                    }}
                  >
                    Owner
                  </th>
                  <th
                    style={{
                      padding: "8px 10px",
                      textAlign: "left",
                      color: "#565c65",
                      fontWeight: 600,
                      fontSize: 11,
                      textTransform: "uppercase",
                    }}
                  >
                    Workstream
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const pr = priorityStyle(t.priority);
                  const st = bucketStyle(t._bucket);
                  return (
                    <tr key={t.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td
                        className="font-mono text-[11px]"
                        style={{ padding: "8px 10px", color: "#565c65" }}
                      >
                        <a
                          href={t.url ?? "#"}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "#1a6fa8", textDecoration: "none" }}
                        >
                          {t.identifier}
                        </a>
                      </td>
                      <td style={{ padding: "8px 10px", color: "#1b1b1b" }}>{t.title}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <span
                          className="text-[11px] font-semibold"
                          style={{
                            color: pr.color,
                            backgroundColor: pr.bg,
                            padding: "2px 8px",
                            borderRadius: 3,
                          }}
                        >
                          {priorityLabel(t.priority)}
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <span
                          className="text-[11px] font-semibold"
                          style={{
                            color: st.color,
                            backgroundColor: st.bg,
                            padding: "2px 8px",
                            borderRadius: 3,
                          }}
                        >
                          {t.state_name ?? BUCKET_LABEL[t._bucket]}
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px", color: "#1b1b1b" }}>{t._owner}</td>
                      <td className="text-[11px]" style={{ padding: "8px 10px", color: "#565c65" }}>
                        {/* The stored column is null unless the source itself
                            said a workstream — neither board does — so fall back
                            to the program's classifier, which is what every other
                            page shows. */}
                        {t.workstream ?? inferWorkstream(t, program)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <p className="text-[11px]" style={{ color: "#888" }}>
          Source of truth is Linear. Reassign, restatus, or reprioritize there and hit Refresh to
          pull the latest.
        </p>
      </div>
    </AppLayout>
  );
}
