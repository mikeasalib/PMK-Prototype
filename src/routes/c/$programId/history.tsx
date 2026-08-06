import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { programById } from "@/lib/program.config";
import { useStoredData, type StoredLinearIssue } from "@/hooks/use-stored-data";
import { useNotionTasks } from "@/hooks/use-notion-tasks";
import { summarizeTask, tidySection } from "@/lib/task-summary";
import { today as todayIso } from "@/lib/program-model.adapters";
import { Section, groupClosedByMonth } from "../-shared";

/**
 * The full delivery record, on its own page.
 *
 * Split out of the overview because the two answer different questions. The
 * overview is "where are we"; this is "what have you delivered". Stacking a
 * year of closures under the first one buried it, and a customer looking for
 * the archive should be able to link straight to the archive.
 *
 * Two populations, kept apart on purpose: engineering tickets carry real
 * closure dates from Linear and group by month; hand-tracked delivery tasks
 * do not, because Notion records that a checkbox is ticked and not when. Each
 * gets the treatment its data supports rather than being merged into one list
 * with invented dates.
 */
export const Route = createFileRoute("/c/$programId/history")({
  head: ({ params }) => ({
    meta: [{ title: "Delivery history" }],
  }),
  component: ClientHistory,
});

function ClientHistory() {
  const { programId } = Route.useParams();
  const program = programById(programId);
  const asOf = todayIso();
  const { linear, origin, isLoading } = useStoredData(program.id);
  const { done: trackerDone, status: trackerStatus, bySection } = useNotionTasks(program.id);

  const historyByMonth = groupClosedByMonth(linear);
  const shippedTotal = historyByMonth.reduce((n, g) => n + g.items.length, 0);
  const doneBySection = bySection.filter((g) => g.done.length > 0);

  return (
    <main className="mx-auto max-w-4xl px-6 py-6 md:px-10 md:py-8">
      <h1
        className="text-2xl font-semibold md:text-3xl"
        style={{ fontFamily: "var(--font-display)", color: "#1b1b1b" }}
      >
        Delivery history
      </h1>
      <p className="mt-1 text-sm" style={{ color: "#565c65" }}>
        Everything delivered on {program.contract.customer} to date.
        {shippedTotal > 0 ? ` ${shippedTotal} engineering items` : ""}
        {trackerStatus === "ok" && trackerDone.length > 0
          ? ` and ${trackerDone.length} delivery tasks`
          : ""}
        .
      </p>

      {isLoading ? (
        <p className="mt-8" style={{ color: "#565c65" }}>
          Loading…
        </p>
      ) : (
        <div className="mt-8 space-y-10">
          <HistoryList history={historyByMonth} />

          {trackerStatus === "ok" && doneBySection.length > 0 ? (
            <Section title="Delivery tasks completed">
              <div className="space-y-4">
                {doneBySection.map((g) => (
                  <div key={g.section}>
                    <h3
                      className="mb-2 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "#565c65" }}
                    >
                      {tidySection(g.section)} · {g.done.length} complete
                    </h3>
                    <ul className="space-y-1">
                      {g.done.map((t) => (
                        <li key={t.id} className="flex items-start gap-2 text-xs">
                          <CheckCircle2
                            size={13}
                            className="mt-0.5 shrink-0"
                            style={{ color: "#1f5c2f" }}
                          />
                          <span style={{ color: "#333" }}>{summarizeTask(t.text).headline}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs" style={{ color: "#8a8a80" }}>
                No dates on these: the source records that a task is complete, not
                when it was ticked. Grouped by workstream instead of by month.
              </div>
            </Section>
          ) : null}
        </div>
      )}

      <footer
        className="mt-12 border-t pt-6 text-xs"
        style={{ borderColor: "#e5e5e2", color: "#8a8a80" }}
      >
        As of {asOf}. Engineering items {origin === "snapshot" ? "last captured" : "read live"} from
        Linear, dated by when each moved to done.
      </footer>
    </main>
  );
}

const HISTORY_PREVIEW = 6;

function HistoryList({
  history,
}: {
  history: Array<{ month: string; label: string; items: StoredLinearIssue[] }>;
}) {
  // Newest month starts open, older months collapsed. Twenty-one July items
  // stacked under eight August ones is the wall this page had; a month header
  // with a count is the summary, and the list is there when asked for.
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>(() =>
    history.length ? { [history[0].month]: true } : {},
  );
  if (history.length === 0) return null;

  return (
    <Section title="Engineering items">
      <div className="space-y-3">
        {history.map((group) => {
          const isOpen = Boolean(openMonths[group.month]);
          const shown = isOpen ? group.items : group.items.slice(0, HISTORY_PREVIEW);
          const hidden = group.items.length - shown.length;
          return (
            <div
              key={group.month}
              className="rounded-lg bg-white p-3"
              style={{ border: "1px solid #e5e5e2" }}
            >
              <button
                type="button"
                onClick={() =>
                  setOpenMonths((prev) => ({ ...prev, [group.month]: !prev[group.month] }))
                }
                className="flex w-full items-baseline justify-between gap-3 text-left"
              >
                <span
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "#565c65" }}
                >
                  {group.label}
                </span>
                <span className="text-xs" style={{ color: "#8a8a80" }}>
                  {group.items.length} shipped {isOpen ? "▴" : "▾"}
                </span>
              </button>
              <ul className="mt-2 space-y-1">
                {shown.map((i) => (
                  <li key={i.identifier} className="flex items-start gap-2 text-xs">
                    <CheckCircle2
                      size={13}
                      className="mt-0.5 shrink-0"
                      style={{ color: "#1f5c2f" }}
                    />
                    <span style={{ color: "#333" }}>{summarizeTask(i.title).headline}</span>
                  </li>
                ))}
              </ul>
              {hidden > 0 ? (
                <button
                  type="button"
                  onClick={() => setOpenMonths((prev) => ({ ...prev, [group.month]: true }))}
                  className="mt-2 text-xs font-medium"
                  style={{ color: "#3a5a40" }}
                >
                  Show {hidden} more
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

