// Calendar-date handling for a US-based team.
//
// The bug this exists to prevent: `new Date("2026-12-01")` is parsed as UTC
// midnight per the ECMAScript date-only form, but toLocaleDateString renders in
// the viewer's zone. West of UTC that lands on the previous day, so the Ventura
// launch date rendered "Nov 30" while the summary card said "Dec 1, 2026" —
// two different dates for the same value on the same screen.
//
// The same skew shifts day counts by up to a day, which is why a launch
// countdown appeared to tick over the evening before.
//
// Every YYYY-MM-DD in this app is a calendar date, not an instant. It should be
// interpreted in the reader's own day, so parse the parts explicitly.

/** Parse YYYY-MM-DD as local midnight, not UTC midnight. */
export function localDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Whole days from today to a calendar date. Negative when past. */
export function daysUntilLocal(iso: string, now: Date = new Date()): number {
  const target = localDate(iso).getTime();
  // Compare midnight to midnight so the answer does not depend on the time of
  // day the page happens to be loaded.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / 86400000);
}

/** "Dec 1" — short month and day, in the reader's locale and their own day. */
export function shortDate(iso: string): string {
  return localDate(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Add a signed day count to a YYYY-MM-DD and return YYYY-MM-DD. The math is
 * done in local calendar space, matching the rest of this module: no timezone
 * skew, no off-by-one across DST boundaries.
 */
export function addDaysIso(iso: string, days: number): string {
  const d = localDate(iso);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
