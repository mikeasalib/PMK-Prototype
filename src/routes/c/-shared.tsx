// Shared pieces for the client portal.
//
// The portal is a layout (auth gate, hero, breadcrumb) with two child routes:
// the overview at /c/$programId and the full record at /c/$programId/history.
// Both children need the same primitives and the same derivations, so they live
// here rather than being duplicated or re-exported through a route file.

import { useState } from "react";
import type { ReactNode } from "react";
import { bucketOf, type StoredLinearIssue } from "@/hooks/use-stored-data";
import { localDate } from "@/lib/local-date";
import type { ProgramConfig } from "@/lib/program.config";
import { lifecyclePhasesFor } from "@/lib/program-model.adapters";

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2
        className="mb-3 text-base font-semibold md:text-lg"
        style={{ fontFamily: "var(--font-display)", color: "#1b1b1b" }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Program seal for the hero. Attempts the configured src; on 404 or missing
 * config, falls back to an initials chip rather than showing a broken image
 * glyph. A hand-approximated seal on a customer-facing screen would
 * misrepresent an official mark, so the fallback is deliberately a flat
 * lettermark instead.
 */
export function SealMark({ program }: { program: ProgramConfig }) {
  const [failed, setFailed] = useState(false);
  if (program.seal.src && !failed) {
    return (
      <img
        src={program.seal.src}
        alt={program.seal.alt}
        onError={() => setFailed(true)}
        className="mb-4 h-10 w-10 object-contain md:h-12 md:w-12"
      />
    );
  }
  // Initials source: program.name reads cleaner than the long-form customer
  // string. Two rules:
  //   1. If the first token is an existing short all-caps acronym (VA, USDA,
  //      NASA, etc.), use it as-is. "VA Website Redesign" -> "VA", not "VW".
  //   2. Otherwise, first character of the first two non-filler words.
  //      "Ventura County Parks" -> "VC".
  const filler = new Set(["of", "the", "and", "for", "a", "an"]);
  const tokens = program.name.split(/\s+/).filter((w) => w && !filler.has(w.toLowerCase()));
  const first = tokens[0] ?? "";
  const isAcronym = first.length >= 2 && first.length <= 5 && first === first.toUpperCase();
  const initials = isAcronym
    ? first
    : tokens
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase();
  return (
    <div
      aria-hidden="true"
      className="mb-4 flex h-10 w-10 items-center justify-center rounded-md text-sm font-semibold md:h-12 md:w-12 md:text-base"
      style={{ backgroundColor: "rgba(255,255,255,0.14)", color: "#ffffff" }}
    >
      {initials || "•"}
    </div>
  );
}

export function HeroStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.10)" }}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
      {sub ? <div className="mt-0.5 text-xs opacity-80">{sub}</div> : null}
    </div>
  );
}

export function ProgressCard({ label, primary, sub }: { label: string; primary: string; sub: string }) {
  return (
    <div className="rounded-lg bg-white p-4" style={{ border: "1px solid #e5e5e2" }}>
      <div className="text-xs uppercase tracking-wide" style={{ color: "#565c65" }}>
        {label}
      </div>
      <div
        className="mt-1 text-2xl font-semibold"
        style={{ fontFamily: "var(--font-display)", color: "#1b1b1b" }}
      >
        {primary}
      </div>
      {sub ? <div className="mt-0.5 text-xs" style={{ color: "#565c65" }}>{sub}</div> : null}
    </div>
  );
}

export function deriveHeadline(
  daysToLaunch: number,
  openGates: number,
  worstPressure: number | undefined,
): { label: string; sub: string } {
  if (daysToLaunch < 0) return { label: "Post-launch", sub: "In customer handoff" };
  if (worstPressure !== undefined && worstPressure >= 0.75)
    return { label: "Attention needed", sub: `${openGates} open gates` };
  if (worstPressure !== undefined && worstPressure >= 0.5)
    return { label: "On track, close watch", sub: `${openGates} open gates` };
  if (openGates > 0) return { label: "On track", sub: `${openGates} open gates` };
  return { label: "On track", sub: "" };
}

export function clientBand(p: number): { fg: string; border: string } {
  if (p >= 0.75) return { fg: "#8a1c1c", border: "#f0c9c9" };
  if (p >= 0.5) return { fg: "#8a4a00", border: "#f0d9b8" };
  if (p >= 0.25) return { fg: "#5a4a00", border: "#e8dfb8" };
  return { fg: "#1f5c2f", border: "#d0e0d0" };
}

export function phaseSummary(program: ProgramConfig, phaseId: string): string {
  const raw = lifecyclePhasesFor(program).find((p) => p.id === phaseId);
  if (!raw) return "";
  return raw.goal.replace(/([a-z]+)@[a-z0-9.-]+/gi, "$1");
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((localDate(toIso).getTime() - localDate(fromIso).getTime()) / 86400000);
}

/**
 * Group done items by the month their state changed to done. Uses
 * source_updated_at (closure time in Linear). Sorted newest month first.
 * Items missing updatedAt are omitted — a shipped item with no closure
 * timestamp is a data-quality problem, not a customer-facing surprise.
 */
export function groupClosedByMonth(
  items: StoredLinearIssue[],
): Array<{ month: string; label: string; items: StoredLinearIssue[] }> {
  const closed = items.filter((i) => bucketOf(i) === "done" && i.source_updated_at);
  const byMonth = new Map<string, StoredLinearIssue[]>();
  for (const item of closed) {
    const day = item.source_updated_at!.slice(0, 7); // YYYY-MM
    const arr = byMonth.get(day) ?? [];
    arr.push(item);
    byMonth.set(day, arr);
  }
  const groups = Array.from(byMonth.entries()).map(([month, items]) => ({
    month,
    label: monthLabel(month),
    items: items.sort((a, b) => (b.source_updated_at ?? "").localeCompare(a.source_updated_at ?? "")),
  }));
  return groups.sort((a, b) => b.month.localeCompare(a.month));
}

export function monthLabel(monthIso: string): string {
  const [y, m] = monthIso.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
