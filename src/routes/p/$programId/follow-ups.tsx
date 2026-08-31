import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import {
  Button,
  CheckSquare,
  Disclosure,
  KZ,
  List,
  Mono,
  NoteBox,
  PanelHead,
  doneTextStyle,
  pad2,
} from "@/components/kz";
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
          "Follow-ups too small for a Linear issue, proposed from calls and issues and curated by the strategist.",
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

  // Open items grouped by which way the obligation runs, to-dos last.
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
        eyebrow="Curation"
        title="Follow-ups"
        subtitle="The small things caught between calls. Proposed from your calls and issues, kept or waved off by you."
      />

      <div style={{ padding: "28px var(--kz-pad-x) 60px var(--kz-pad-x)" }}>
        {/* The read-only exception, stated plainly. This is the one screen where
            a click changes something, and it must be unmistakable that the
            change lives in this browser and nowhere else. */}
        <NoteBox>
          These are <strong style={{ color: KZ.ink, fontWeight: 500 }}>proposed</strong> from your
          calls and issues, and each one shows where it came from. Your checkmarks, dismissals, and
          added items are working notes: saved in this browser only, never written back to Linear,
          Notion, or Granola.{" "}
          {capturedAt ? `Candidates captured ${relativeTime(capturedAt)}.` : null}
        </NoteBox>

        <AddForm onAdd={addManual} />

        {!hydrated ? null : !hasCandidates && buckets.open.length === 0 ? (
          <div
            style={{
              marginTop: 34,
              border: `1px solid ${KZ.grey400}`,
              padding: 40,
              textAlign: "center",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: KZ.body,
              maxWidth: 900,
            }}
          >
            No follow-ups proposed yet for this program. Add one above, or connect Granola so calls
            propose them automatically.
          </div>
        ) : (
          <>
            {groups.map((g) => (
              <section key={g.key} style={{ marginTop: 34, maxWidth: 900 }}>
                <PanelHead label={g.label} right={pad2(g.items.length)} />
                <List>
                  {g.items.map((item) => (
                    <Row key={item.id} item={item} onStatus={setStatus} />
                  ))}
                </List>
              </section>
            ))}

            {groups.length === 0 ? (
              <div style={{ marginTop: 34, fontSize: 13.5, color: KZ.body }}>
                Nothing open. Everything is either done or dismissed below.
              </div>
            ) : null}

            <Collapsible
              label="Done"
              count={buckets.done.length}
              open={showDone}
              onToggle={() => setShowDone((v) => !v)}
            >
              {buckets.done.map((item) => (
                <Row key={item.id} item={item} onStatus={setStatus} />
              ))}
            </Collapsible>

            <Collapsible
              label="Dismissed"
              count={buckets.dismissed.length}
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

/**
 * One follow-up: square checkbox, title, then a mono line carrying owner, due
 * hint and provenance. Dismiss and restore are mono text controls rather than
 * icons — the Kaizen system ships no icon set, and a word is unambiguous.
 */
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
      style={{
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        padding: "14px 0",
        borderBottom: `1px solid ${KZ.grey200}`,
        opacity: dismissed ? 0.6 : 1,
      }}
    >
      <CheckSquare
        done={done}
        onClick={() => onStatus(item.id, done ? "open" : "done")}
        label={done ? `Mark not done: ${item.title}` : `Mark done: ${item.title}`}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={doneTextStyle(done)}>{item.title}</div>
        {item.detail ? (
          <div style={{ marginTop: 4, fontSize: 13, lineHeight: 1.45, color: KZ.body }}>
            {item.detail}
          </div>
        ) : null}
        <div
          style={{
            marginTop: 6,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            color: KZ.muted,
          }}
        >
          {item.owner ? <span>{item.owner}</span> : null}
          {item.dueHint ? <span>· {item.dueHint}</span> : null}
          <span>· {ORIGIN_LABEL[item.origin]}</span>
          {item.source ? (
            item.source.url ? (
              <a
                href={item.source.url}
                target="_blank"
                rel="noreferrer"
                style={{ color: KZ.blue }}
                title={item.source.label}
              >
                · {item.source.label}
              </a>
            ) : (
              <span title={item.source.label}>· {item.source.label}</span>
            )
          ) : null}
        </div>
      </div>

      {/* Dismiss a bad proposal, or restore one that was waved off too early. */}
      <button
        type="button"
        onClick={() => onStatus(item.id, dismissed ? "open" : "dismissed")}
        className="kz-transition kz-hover-fade"
        style={{
          flexShrink: 0,
          border: 0,
          background: "transparent",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.02em",
          color: KZ.muted,
          cursor: "pointer",
          padding: "2px 0",
        }}
      >
        {dismissed ? "Restore" : "Dismiss"}
      </button>
    </li>
  );
}

/** Square input, solid button. Direction is a select, because "we owe" and
 *  "they owe" are the same shape of choice as the groups below. */
function AddForm({
  onAdd,
}: {
  onAdd: (input: { title: string; owner?: string; direction: FollowUpDirection }) => void;
}) {
  const [title, setTitle] = useState("");
  const [direction, setDirection] = useState<FollowUpDirection>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({ title, direction });
    setTitle("");
    setDirection(null);
  }

  return (
    <form
      onSubmit={submit}
      style={{ display: "flex", gap: 10, marginTop: 24, maxWidth: 900, flexWrap: "wrap" }}
    >
      <input
        className="kz-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a follow-up you caught: email X, remember Y…"
        style={{ flex: 1, minWidth: 240 }}
      />
      <select
        value={direction ?? ""}
        onChange={(e) => setDirection((e.target.value || null) as FollowUpDirection)}
        style={{
          border: `1px solid ${KZ.bone}`,
          borderRadius: 0,
          background: KZ.white,
          color: KZ.ink,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          textTransform: "uppercase",
          padding: "0 10px",
        }}
      >
        <option value="">To do</option>
        <option value="we-owe">We owe</option>
        <option value="they-owe">They owe</option>
      </select>
      <Button
        variant="solid"
        type="submit"
        disabled={!title.trim()}
        style={{ padding: "12px 16px" }}
      >
        Add
      </Button>
    </form>
  );
}

/**
 * Done and Dismissed stay on the page but collapsed: both are reversible, and
 * hiding them outright would make "dismiss" feel like deletion.
 */
function Collapsible({
  label,
  count,
  open,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section style={{ marginTop: 34, maxWidth: 900 }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
          width: "100%",
          border: 0,
          borderBottom: `1px solid ${KZ.bone}`,
          paddingBottom: 10,
          background: "transparent",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <Mono size={11} tone={KZ.ink} style={{ textTransform: "uppercase" }}>
          {open ? "−" : "+"} {label}
        </Mono>
        <Mono size={11} tone={KZ.muted}>
          {pad2(count)}
        </Mono>
      </button>
      {open ? <List>{children}</List> : null}
      {open ? <Disclosure>Both states are reversible. Nothing here is deleted</Disclosure> : null}
    </section>
  );
}
