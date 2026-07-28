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

/** Page title for a route: "Sprint board — VA Program Intel". */
export function pageTitle(page: string): string {
  return `${page} — ${PROGRAM.appName}`;
}
