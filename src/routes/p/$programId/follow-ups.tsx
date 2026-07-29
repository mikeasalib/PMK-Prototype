import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, X, Undo2, Plus, ExternalLink } from "lucide-react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { PROGRAMS, pageTitle } from "@/lib/program.config";
import { relativeTime } from "@/hooks/use-program-data";
import { useFollowUps } from "@/hooks/use-follow-ups";
import type { FollowUp, FollowUpDirection } from "@/lib/follow-ups";
import { useProgram } from "./route";

export const Route = createFileRoute("/p/$programId/follow-ups")({
  head: ({ params }) => ({
    meta: [
      { title: pageTitle("Follow-ups", PROGRAMS[params.programId]) },
      {
        name: "description",
        content:
          "Call-to-call follow-ups below the threshold of a Linear issue — proposed from calls and issues, curated by the strategist.",
      },
    ],
  }),
  component: FollowUps,
});

const ORIGIN_LABEL: Record<string, string> = {
  granola: "from a call",
  linear: "from Linear",
  notion: "from Notion",
  manual: "you added",
};

function FollowUps() {
  const program = useProgram();
  const { hydrated, capturedAt, hasCandidates, buckets, setStatus, addManual } = useFollowUps(
    program.id,
  );
  const [showDone, setShowDone] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);

  // Group open items by obligation direction, to-dos last.
  const groups: Array<{ key: string; label: string; items: FollowUp[] }> = [
    { key: "we-owe", label: "We owe", items: buckets.open.filter((i) => i.direction === "we-owe") },
    {
      key: "they-owe",
      label: "They owe",
      items: buckets.open.filter((i) => i.direction === "they-owe"),
    },
    { key: "todo", label: "To do", items: buckets.open.filter((i) => i.direction === null) },
  ].filter((g) => g.items.length > 0);

  return (
    <AppLayout>
      <PageHeader
        title="Follow-ups"
        subtitle="The small things caught between calls — proposed from your calls and issues, kept or waved off by you."
      />

      <div className="px-6 pb-10 pt-2">
        {/* The read-only exception, stated plainly. */}
        <div
          className="mb-5 rounded-md p-3 text-[12px]"
          style={{ backgroundColor: "#f7f7f5", border: "1px solid #e5e5e2", color: "#565c65" }}
        >
          These are <strong>proposed</strong> from your calls and issues — each shows where it came
          from. Your checkmarks, dismissals, and added items are your working notes:{" "}
          <strong>saved in this browser only</strong>, never written back to Linear, Notion, or
          Granola. {capturedAt ? `Candidates captured ${relativeTime(capturedAt)}.` : null}
        </div>

        <AddForm onAdd={addManual} navColor={program.navColor} />

        {!hydrated ? null : !hasCandidates && buckets.open.length === 0 ? (
          <Empty />
        ) : (
          <>
            {groups.map((g) => (
              <section key={g.key} className="mb-6">
                <h2
                  className="mb-2 text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: "#8a8a80" }}
                >
                  {g.label} · {g.items.length}
                </h2>
                <ul className="space-y-2">
                  {g.items.map((item) => (
                    <Row key={item.id} item={item} onStatus={setStatus} />
                  ))}
                </ul>
              </section>
            ))}

            {groups.length === 0 ? (
              <p className="mb-6 text-[13px]" style={{ color: "#565c65" }}>
                Nothing open. Everything is either done or dismissed below.
              </p>
            ) : null}

            <Collapsible
              label={`Done · ${buckets.done.length}`}
              open={showDone}
              onToggle={() => setShowDone((v) => !v)}
            >
              {buckets.done.map((item) => (
                <Row key={item.id} item={item} onStatus={setStatus} />
              ))}
            </Collapsible>

            <Collapsible
              label={`Dismissed · ${buckets.dismissed.length}`}
              open={showDismissed}
              onToggle={() => setShowDismissed((v) => !v)}
            >
              {buckets.dismissed.map((item) => (
                <Row key={item.id} item={item} onStatus={setStatus} />
              ))}
            </Collapsible>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function Row({
  item,
  onStatus,
}: {
  item: FollowUp;
  onStatus: (id: string, status: "open" | "done" | "dismissed") => void;
}) {
  const done = item.status === "done";
  const dismissed = item.status === "dismissed";
  return (
    <li
      className="flex items-start gap-3 rounded-lg bg-white p-3"
      style={{ border: "1px solid #e5e7e4", opacity: dismissed ? 0.6 : 1 }}
    >
      {/* Check toggles done; only meaningful for a live item. */}
      <button
        type="button"
        aria-label={done ? "Mark not done" : "Mark done"}
        onClick={() => onStatus(item.id, done ? "open" : "done")}
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors"
        style={{
          borderColor: done ? "#2e8540" : "#c9c9c2",
          backgroundColor: done ? "#2e8540" : "#ffffff",
          color: "#ffffff",
        }}
      >
        {done ? <Check size={13} strokeWidth={3} /> : null}
      </button>

      <div className="min-w-0 flex-1">
        <div
          className="text-[13px]"
          style={{
            textDecoration: done ? "line-through" : "none",
            color: done ? "#8a8a80" : "#1b1b1b",
          }}
        >
          {item.title}
        </div>
        {item.detail ? (
          <div className="mt-0.5 text-[12px]" style={{ color: "#565c65" }}>
            {item.detail}
          </div>
        ) : null}
        <div
          className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]"
          style={{ color: "#8a8a80" }}
        >
          {item.owner ? <span>{item.owner}</span> : null}
          {item.dueHint ? <span>· {item.dueHint}</span> : null}
          {item.source ? (
            <span className="inline-flex items-center gap-1">
              · {ORIGIN_LABEL[item.origin]}
              {item.source.url ? (
                <a
                  href={item.source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 underline"
                  style={{ color: "#2e5d3a" }}
                  title={item.source.label}
                >
                  {item.source.label}
                  <ExternalLink size={10} />
                </a>
              ) : (
                <span title={item.source.label}>({item.source.label})</span>
              )}
            </span>
          ) : (
            <span>· {ORIGIN_LABEL[item.origin]}</span>
          )}
        </div>
      </div>

      {/* Dismiss a bad proposal, or restore a dismissed one. */}
      {dismissed ? (
        <button
          type="button"
          aria-label="Restore"
          onClick={() => onStatus(item.id, "open")}
          className="mt-0.5 shrink-0 rounded p-1 transition-colors hover:bg-[#f0f0ec]"
          style={{ color: "#565c65" }}
        >
          <Undo2 size={15} />
        </button>
      ) : (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => onStatus(item.id, "dismissed")}
          className="mt-0.5 shrink-0 rounded p-1 transition-colors hover:bg-[#f0f0ec]"
          style={{ color: "#a0a099" }}
        >
          <X size={15} />
        </button>
      )}
    </li>
  );
}

function AddForm({
  onAdd,
  navColor,
}: {
  onAdd: (input: { title: string; owner?: string; direction: FollowUpDirection }) => void;
  navColor: string;
}) {
  const [title, setTitle] = useState("");
  const [direction, setDirection] = useState<FollowUpDirection>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onAdd({ title, direction });
    setTitle("");
    setDirection(null);
  }

  return (
    <form onSubmit={submit} className="mb-6 flex flex-wrap items-center gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a follow-up you caught — email X, remember Y…"
        className="min-w-[240px] flex-1 rounded-md px-3 py-2 text-[13px]"
        style={{ border: "1px solid #d9d9d3", backgroundColor: "#ffffff" }}
      />
      <select
        value={direction ?? ""}
        onChange={(e) => setDirection((e.target.value || null) as FollowUpDirection)}
        className="rounded-md px-2 py-2 text-[13px]"
        style={{ border: "1px solid #d9d9d3", backgroundColor: "#ffffff", color: "#565c65" }}
      >
        <option value="">To do</option>
        <option value="we-owe">We owe</option>
        <option value="they-owe">They owe</option>
      </select>
      <button
        type="submit"
        disabled={!title.trim()}
        className="flex items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium text-white transition-opacity disabled:opacity-50"
        style={{ backgroundColor: navColor }}
      >
        <Plus size={15} />
        Add
      </button>
    </form>
  );
}

function Collapsible({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  if (!hasChildren) return null;
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={onToggle}
        className="text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: "#8a8a80" }}
      >
        {open ? "▾" : "▸"} {label}
      </button>
      {open ? <ul className="mt-2 space-y-2">{children}</ul> : null}
    </div>
  );
}

function Empty() {
  return (
    <div
      className="rounded-lg p-8 text-center text-[13px]"
      style={{ border: "1px dashed #d9d9d3", color: "#8a8a80" }}
    >
      No follow-ups proposed yet for this program. Add one above, or connect Granola so calls
      propose them automatically.
    </div>
  );
}
