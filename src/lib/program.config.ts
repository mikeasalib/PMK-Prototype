// The single active program. VA is the first program running on this shell, not
// the shell itself — everything here is per-engagement and should be the only
// place a program's identity, contract facts, and key dates are written down.
//
// Client-safe: no process.env, no Supabase, no secrets. The "which external
// project do we pull from" selectors live in program.sources.server.ts so they
// stay out of the client bundle.

export interface SprintWindow {
  key: string;
  label: string;
  start: string; // YYYY-MM-DD
  end: string;
}

export interface Workstream {
  /** Appears in issue titles ("WS3") and is stored in linear_issues.workstream. */
  key: string;
  /** Chip and pip text. */
  short: string;
  /** Full label for legends, dropdowns, and burn-down rows. */
  label: string;
  /** Accountable owner. Carried separately from label — never concatenated. */
  owner: string;
  color: string;
}

export interface ProgramConfig {
  /** Stable slug. Becomes the /p/$programId segment if multi-program lands. */
  id: string;
  /** Program name, shown in the sidebar. */
  name: string;
  /** Delivery org, long form — used for the author meta tag. */
  org: string;
  /** Delivery org, short form — used in the browser title. */
  orgShort: string;
  /** Product name of this dashboard, used as the page-title suffix. */
  appName: string;
  /** Program domain, interpolated into meta descriptions and subtitles. */
  domainLabel: string;
  /** Sidebar chrome. Green mirrors Cedar's admin shell — see AppLayout. */
  navColor: string;
  contract: {
    /** Bare contract number, as shown in the UI. */
    displayNumber: string;
    /** Contract number with CLIN, for reference. */
    fullNumber: string;
    prime: string;
    customer: string;
    period: string;
    value: string;
    invoiceEmail: string;
  };
  /** Dates that appear on more than one page. Labels stay at the call sites. */
  keyDates: {
    launch: string; // YYYY-MM-DD
    launchLabel: string; // human form, e.g. "Nov 11, 2026"
    codeFreeze: string;
    nextSprintStart: string;
  };
  /** The milestone strip on the program overview page. */
  sprintStrip: SprintWindow[];
  /** Ordered — this is the display order in every legend, column, and dropdown. */
  workstreams: Workstream[];
  /** Colour for a workstream key that is not in the roster above. */
  unknownWorkstreamColor: string;
  /** How to attribute an issue to a workstream when the source doesn't say. */
  classifier: WorkstreamClassifier;
}

export interface WorkstreamClassifier {
  /**
   * Pattern the source itself uses, e.g. "WS3" in an issue title. Capture group
   * 1 is appended to `prefix`.
   *
   * Never give these patterns the `g` flag. A module-level RegExp with /g keeps
   * `lastIndex` between calls, so it would match on odd calls and miss on even
   * ones — invisible to a typecheck and painful to find.
   */
  explicit: { pattern: RegExp; prefix: string } | null;
  /** Ordered fallbacks, first match wins. Tested against the UPPERCASED title. */
  keywords: Array<{ pattern: RegExp; workstream: string }>;
  /** Used when nothing matches. Must be a key in `workstreams`. */
  fallback: string;
}

export const PROGRAM: ProgramConfig = {
  id: "va",
  name: "VA Website Redesign",
  org: "Kaizen Laboratories Inc.",
  orgShort: "Kaizen Laboratories",
  appName: "VA Program Intel",
  domainLabel: "VA.gov modernization",
  navColor: "#1f3d2b",
  contract: {
    displayNumber: "36C10G24D0048",
    fullNumber: "36C10G24D0048 / CLIN 0001",
    prime: "Soldierpoint Digital Health LLC (GovCIO subsidiary)",
    customer: "Department of Veterans Affairs",
    period: "May 2026 – November 11, 2026",
    value: "$4,000,000 FFP",
    invoiceEmail: "ap@govcio.com",
  },
  keyDates: {
    launch: "2026-11-11",
    launchLabel: "Nov 11, 2026",
    codeFreeze: "2026-09-28",
    nextSprintStart: "2026-08-03",
  },
  sprintStrip: [
    { key: "S4", label: "Sprint 4", start: "2026-07-20", end: "2026-07-31" },
    { key: "S5", label: "Sprint 5", start: "2026-08-03", end: "2026-08-14" },
    { key: "S6", label: "Sprint 6", start: "2026-08-17", end: "2026-08-28" },
    { key: "S7", label: "Sprint 7", start: "2026-08-31", end: "2026-09-11" },
    { key: "S8", label: "Sprint 8 · UAT/PRR", start: "2026-09-14", end: "2026-10-23" },
    { key: "S9", label: "ORR · Launch", start: "2026-10-26", end: "2026-11-11" },
  ],
  // NOTE: workstream-updates.ts carries a second, differing set of names for
  // these same keys and calls itself the "corrected v2" taxonomy. Owners below
  // come from that corrected set; labels reproduce the older naming the UI
  // shows today. Reconciling the two is a content decision, deferred until the
  // VA content is genericised into a template.
  workstreams: [
    {
      key: "WS1",
      short: "WS1",
      label: "WS1 · Architecture & API / Brad",
      owner: "Brad / Justin (apothesource)",
      color: "#005ea2",
    },
    {
      key: "WS2",
      short: "WS2",
      label: "WS2 · Identity & Login / Rain",
      owner: "Mariam (GovCIO / CLEAR)",
      color: "#2e8540",
    },
    {
      key: "WS3",
      short: "WS3",
      label: "WS3 · Landing Page & UI / Kaizen",
      owner: "Lukasz / Daman / Ben (Kaizen + Media Rain)",
      color: "#54278f",
    },
    {
      key: "WS4",
      short: "WS4",
      label: "WS4 · QuickSubmit / VR&E / VLM",
      owner: "John Larkin (GovCIO)",
      color: "#008480",
    },
    {
      key: "WS5",
      short: "WS5",
      label: "WS5 · VA Health Chat / OCC",
      owner: "Luke (OCC / VHA coord)",
      color: "#936f38",
    },
    {
      key: "Admin",
      short: "Admin",
      label: "Admin · Program",
      owner: "Andrea / Kaizen PM / Luke",
      color: "#565c65",
    },
  ],
  unknownWorkstreamColor: "#565c65",
  classifier: {
    explicit: { pattern: /\bWS([1-5])\b/, prefix: "WS" },
    // Short keywords carry \b. Measured against 50 real DEP titles, the
    // unanchored forms misfired: SEARCH matched inside RESEARCH, sending two
    // accessibility-research tickets to WS2 (identity/login). AUTH inside
    // AUTHOR and API inside RAPID/CAPITAL are the same trap waiting to happen.
    keywords: [
      // PROTOTYP, not PROTOTYPE — "prototyping" and "prototypes" are both common
      // on this board and the exact form matches neither.
      { pattern: /MYVA|HOMEPAGE|PROTOTYP|DESIGN|TYPOGRAPHY|\bFONTS?\b/, workstream: "WS3" },
      { pattern: /QUICKSUBMIT|\bQS\b|VR&E|\bVLM\b|TRACKER|\bSNS\b/, workstream: "WS4" },
      { pattern: /HEALTH CHAT|\bPEP\b|WS5/, workstream: "WS5" },
      { pattern: /\bAUTH\b|LOGIN|MAGIC LINK|IDENTITY|\bSEARCH\b/, workstream: "WS2" },
      { pattern: /\bAPIS?\b|ARCHITECTURE|FEATURE FLAG|GITHUB|BRANCH/, workstream: "WS1" },
    ],
    fallback: "Admin",
  },
};

const WORKSTREAM_BY_KEY: Record<string, Workstream> = Object.fromEntries(
  PROGRAM.workstreams.map((w) => [w.key, w]),
);

/**
 * Total function — never returns undefined, so no call site has to handle a
 * miss. linear_issues.workstream is free text with no constraint, so an
 * unrecognised key is reachable; before this existed those lookups threw.
 */
export function workstreamOf(key: string | null | undefined): Workstream {
  const hit = key ? WORKSTREAM_BY_KEY[key] : undefined;
  if (hit) return hit;
  const shown = key ?? "—";
  return {
    key: shown,
    short: shown,
    label: shown,
    owner: "",
    color: PROGRAM.unknownWorkstreamColor,
  };
}

/** Workstream keys in display order. */
export function workstreamKeys(): string[] {
  return PROGRAM.workstreams.map((w) => w.key);
}

/**
 * What the source literally said, or null. Used on the WRITE path, where the
 * value is persisted.
 *
 * Deliberately narrower than classifyWorkstream and NOT to be merged with it: if
 * sync stored keyword guesses, linear_issues.workstream would stop being "what
 * Linear said", and a later change to the keyword rules could no longer
 * re-derive old rows.
 */
export function parseSourceWorkstream(title: string): string | null {
  const c = PROGRAM.classifier.explicit;
  if (!c) return null;
  const m = title.toUpperCase().match(c.pattern);
  return m ? c.prefix + m[1] : null;
}

/**
 * Best available attribution for display: an explicit value if the source has
 * one, then the source's own pattern, then keyword heuristics, then the
 * fallback. Used on the READ path, so a rule change re-derives everything.
 */
export function classifyWorkstream(title: string, explicit?: string | null): string {
  return classifyWorkstreamDetailed(title, explicit).workstream;
}

/** How an attribution was arrived at. Only "stored" and "explicit" are facts. */
export type AttributionBasis = "stored" | "explicit" | "keyword" | "fallback";

/**
 * Same result as classifyWorkstream, plus how it was derived.
 *
 * This exists because attribution accuracy is genuinely poor on real data:
 * across 50 live DEP issues only 7 carry an explicit WSn, so most rows are
 * inference. A report that presents a keyword guess with the same confidence as
 * a stored value is misleading, so renderers surface the split.
 */
export function classifyWorkstreamDetailed(
  title: string,
  explicit?: string | null,
): { workstream: string; basis: AttributionBasis } {
  if (explicit) return { workstream: explicit, basis: "stored" };
  const t = title.toUpperCase();
  const c = PROGRAM.classifier;
  if (c.explicit) {
    const m = t.match(c.explicit.pattern);
    if (m) return { workstream: c.explicit.prefix + m[1], basis: "explicit" };
  }
  for (const r of c.keywords) {
    if (r.pattern.test(t)) return { workstream: r.workstream, basis: "keyword" };
  }
  return { workstream: c.fallback, basis: "fallback" };
}

/** Page title for a route: "Sprint board — VA Program Intel". */
export function pageTitle(page: string): string {
  return `${page} — ${PROGRAM.appName}`;
}
