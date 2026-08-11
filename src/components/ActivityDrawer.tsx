import { useEffect, useMemo, useState } from "react";
import { Activity, X } from "lucide-react";
import { useStoredData } from "@/hooks/use-stored-data";
import { useProgram } from "@/routes/p/$programId/route";
import { relativeTime } from "@/hooks/use-program-data";

/**
 * Recent activity as a slide-over rather than a nav destination.
 *
 * Nobody sets out to visit an activity feed. They glance at one to answer "has
 * anything moved since I looked?", and a full page for that means a navigation
 * away from whatever prompted the question. As a drawer it answers in place and
 * you keep your position.
 *
 * The /activity route still exists and still works — this reads the same data
 * from the same hook. What changed is that the feed stopped occupying a
 * top-level nav row it did not earn.
 */
export function ActivityDrawer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Recent activity"
        title="Recent activity"
        className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-neutral-100"
        style={{ color: "#565c65" }}
      >
        <Activity size={18} />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close activity"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40"
            style={{ backgroundColor: "rgba(0,0,0,0.25)" }}
          />
          <aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl"
            role="dialog"
            aria-label="Recent activity"
          >
            <div
              className="flex shrink-0 items-center justify-between border-b px-4 py-3"
              style={{ borderColor: "#e5e5e2" }}
            >
              <div className="text-sm font-semibold" style={{ color: "#1b1b1b" }}>
                Recent activity
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded p-1 hover:bg-neutral-100"
                style={{ color: "#565c65" }}
              >
                <X size={16} />
              </button>
            </div>
            <DrawerBody />
          </aside>
        </>
      ) : null}
    </>
  );
}

/** Split out so the data hook only runs while the drawer is actually open. */
function DrawerBody() {
  const program = useProgram();
  const { linear, notion, isLoading } = useStoredData(program.id);

  const events = useMemo(() => {
    const out: Array<{ ts: string; source: string; title: string; detail: string; url?: string | null }> =
      [];
    for (const i of linear) {
      if (!i.source_updated_at) continue;
      out.push({
        ts: i.source_updated_at,
        source: "Linear",
        title: `${i.identifier} · ${i.title}`,
        detail: `${i.state_name ?? "—"} · ${i.assignee ?? "unassigned"}`,
        url: i.url,
      });
    }
    for (const n of notion) {
      if (!n.source_updated_at) continue;
      out.push({
        ts: n.source_updated_at,
        source: "Notion",
        title: n.title,
        detail: "Page updated",
        url: n.url,
      });
    }
    // Newest first, capped: a drawer is for a glance, and the full history is
    // still at /activity for anyone who wants to scroll it.
    return out.sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 40);
  }, [linear, notion]);

  if (isLoading) {
    return (
      <div className="p-4 text-sm" style={{ color: "#565c65" }}>
        Loading…
      </div>
    );
  }
  if (events.length === 0) {
    return (
      <div className="p-4 text-sm" style={{ color: "#565c65" }}>
        Nothing recorded yet.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3">
      <ul className="space-y-3">
        {events.map((e, i) => (
          <li key={`${e.ts}-${i}`} className="text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-medium" style={{ color: "#565c65" }}>
                {e.source}
              </span>
              <span className="shrink-0 text-xs" style={{ color: "#8a8a80" }}>
                {relativeTime(e.ts)}
              </span>
            </div>
            <div className="mt-0.5">
              {e.url ? (
                <a
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                  style={{ color: "#1b1b1b" }}
                >
                  {e.title}
                </a>
              ) : (
                <span style={{ color: "#1b1b1b" }}>{e.title}</span>
              )}
            </div>
            <div className="mt-0.5 text-xs" style={{ color: "#8a8a80" }}>
              {e.detail}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
