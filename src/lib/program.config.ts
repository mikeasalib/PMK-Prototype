// The program registry. Each entry is one engagement; the shell is the thing
// they share. VA was the first program on it, Ventura County is the second, and
// having two is what actually proves the shell is not the VA program.
//
// The two differ in ways that matter to the design, not just in labels:
//   - VA is federal, fixed-price, with a contract number and a POA&M obligation.
//     Ventura is a recreation deployment with neither.
//   - VA's delivery work lives in a Linear project. Ventura's does not, so its
//     work-item sections have no source and must say so.
//   - Granola scoping differs: VA is a folder, Ventura is a participant domain.
//   - "Workstreams" for VA are WS1-WS5. For Ventura the equivalent axis is
//     functional area (facilities, finance, call centre...). Same concept, and
//     the reason the taxonomy is data rather than a type.
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
  /** Which artifacts this program can produce. A POA&M is a federal compliance
   *  deliverable — offering one for a parks deployment would be nonsense, so
   *  applicability is per-program rather than global. */
  artifacts: Array<"rollup" | "project-plan" | "poam">;
  contract: {
    /** Null when the engagement has no contract number (commercial SOW). */
    displayNumber: string | null;
    /** Contract number with CLIN, for reference. Null if not applicable. */
    fullNumber: string | null;
    /** Null when Kaizen contracts directly with the customer, i.e. no prime. */
    prime: string | null;
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

const VA: ProgramConfig = {
  id: "va",
  name: "VA Website Redesign",
  org: "Kaizen Laboratories Inc.",
  orgShort: "Kaizen Laboratories",
  appName: "VA Program Intel",
  domainLabel: "VA.gov modernization",
  navColor: "#1f3d2b",
  artifacts: ["rollup", "project-plan", "poam"],
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

/**
 * Ventura County Parks — a recreation deployment, and the second program on this
 * shell. Sourced from the Notion "Ventura County Implementation Plan", read
 * 2026-07-28.
 *
 * Deliberately different from VA in every way the shell has to tolerate: no
 * contract number, no prime, no Linear project, no POA&M, and an entirely
 * different "workstream" axis. If the shell renders this correctly it is a
 * framework; if it only renders VA it is still the VA program.
 */
const VENTURA: ProgramConfig = {
  id: "ventura",
  name: "Ventura County Parks",
  org: "Kaizen Laboratories Inc.",
  orgShort: "Kaizen Laboratories",
  appName: "Program Intel",
  domainLabel: "Ventura County Parks recreation deployment",
  navColor: "#1f3d2b",
  // No POA&M. It is a federal compliance artifact and has no meaning for a
  // county parks reservation system.
  artifacts: ["rollup", "project-plan"],
  contract: {
    // Commercial SOW rather than a federal contract vehicle. AE Will Harrison,
    // closed December 2025, kickoff Jan 6 2026.
    displayNumber: null,
    fullNumber: null,
    // Kaizen contracts directly with the county; there is no prime above it.
    prime: null,
    // Enterprise Fund — the department takes no resident tax funding, which is
    // why fiscal scrutiny (ACO itemisation) is heavy.
    customer: "County of Ventura — Parks, General Services Agency",
    period: "January 2026 – January 1, 2027 (full cutover)",
    value: "not recorded in Notion",
    invoiceEmail: "Brandon.Nakamoto@venturacounty.gov",
  },
  keyDates: {
    // The pivotal gate is December 1, not the January cutover: live campsite
    // reservations open, day use and community centres go live, annual passes
    // become Kaizen-only as Itineo is disabled, and the gate-fee system starts
    // transitioning. Everything unresolved has a December 1 runway.
    launch: "2026-12-01",
    launchLabel: "Dec 1, 2026",
    // Nothing freezes on a rec deployment. The nearest equivalent is the day
    // public booking opened and the system became load-bearing.
    codeFreeze: "2026-07-13",
    nextSprintStart: "2026-08-03",
  },
  // Recreation deployments run to dated operational gates, not sprints.
  sprintStrip: [
    { key: "CAMP", label: "Campground res. live", start: "2026-07-13", end: "2026-07-13" },
    { key: "DAY", label: "Day use live", start: "2026-07-15", end: "2026-07-15" },
    { key: "DEC1", label: "Campsites + gate fees", start: "2026-12-01", end: "2026-12-01" },
    { key: "SUNSET", label: "Itineo sunset", start: "2026-12-31", end: "2026-12-31" },
    { key: "GATE", label: "Gate fees fully Kaizen", start: "2027-01-01", end: "2027-01-01" },
    { key: "LIMIT", label: "Hard res. date limit", start: "2027-01-09", end: "2027-01-09" },
  ],
  // The equivalent axis for a rec deployment is functional area, not WS1-WS5.
  // Owners are the real named leads; titles corrected against the account
  // handoff and memory dump (Jeri is Parks Manager, not Interim Director;
  // Brandon is Accountant I; Tina is Senior Accounting Assistant).
  workstreams: [
    {
      key: "FAC",
      short: "FAC",
      label: "Facilities & Venues",
      owner: "Chad Bowie (Chief Ranger) / William Seelos",
      color: "#2e8540",
    },
    {
      key: "FIN",
      short: "FIN",
      label: "Finance & Reporting",
      owner: "Brandon Nakamoto / Tina Arellano (Dana Vodantis approves)",
      color: "#005ea2",
    },
    {
      key: "CC",
      short: "CC",
      label: "Call Center (Zion)",
      owner: "Abbey Clove (Zion Dir. Ops) / Mia Clove (lead agent)",
      color: "#54278f",
    },
    {
      key: "MEM",
      short: "MEM",
      label: "Memberships & Passes",
      owner: "William Seelos (approves DV + annual passes)",
      color: "#008480",
    },
    {
      key: "PLAT",
      short: "PLAT",
      label: "Platform & Integrations",
      owner: "Nico Turk (Kaizen DS lead)",
      color: "#936f38",
    },
    {
      key: "Admin",
      short: "Admin",
      label: "Admin · Deployment",
      owner: "Nico Turk (lead) / Michael Salib (secondary)",
      color: "#565c65",
    },
  ],
  unknownWorkstreamColor: "#565c65",
  classifier: {
    // No WSn convention on this program, so there is no explicit pattern to
    // read — everything is keyword inference or fallback, and the rollup says so
    // rather than implying the split is authoritative.
    explicit: null,
    // Vocabulary taken from the real account record: Itineo, Zion, Sherpa, ACO,
    // gate fees, DV passes, accrual. Short keywords carry \b — this program
    // already produced two substring bugs (VENUE inside "revenue", PARK inside
    // "parking"), so the guard in the harness checks every pattern.
    keywords: [
      {
        pattern:
          /CAMPGROUND|CAMPING|CAMPSITE|\bVENUES?\b|FACILIT|\bPARKS?\b|PICNIC|\bSITES?\b|\bMAPS?\b|GATE FEE|DAY USE|COMMUNITY CENTER|BALLFIELD/,
        workstream: "FAC",
      },
      {
        pattern:
          /\bGLS?\b|GL CODE|RECONCIL|\bREVENUES?\b|ACCRUAL|INVOICE|PAYOUT|SETTLEMENT|SHERPA|\bACO\b|DEPOSIT|CHARGEBACK|\bCHARGES?\b|\bFEES?\b|RECEIPT|REFUND|REPORT|FINANC|\bBSA\b|ACCOUNTING|ACCOUNTANT/,
        workstream: "FIN",
      },
      { pattern: /CALL CENTER|CALL CENTRE|\bZION\b|PHONE|VOICEMAIL|ESCALATION/, workstream: "CC" },
      {
        pattern:
          /MEMBERSHIP|ANNUAL PASS|PARKING PASS|\bDV\b|VETERAN|DISCOUNT|PERMIT|NONPROFIT|NON-PROFIT/,
        workstream: "MEM",
      },
      {
        pattern:
          /\bSSO\b|\bAUTH\b|INTEGRAT|MIGRAT|ITINEO|SHAREPOINT|STRIPE|\bACH\b|RESIDENCY|LOGIN|\bACCOUNTS?\b/,
        workstream: "PLAT",
      },
    ],
    fallback: "Admin",
  },
};

/**
 * Every program the shell knows about. Adding an engagement is a new entry here
 * plus its source ids in program.sources.server.ts — not a code change.
 */
export const PROGRAMS: Record<string, ProgramConfig> = {
  va: VA,
  ventura: VENTURA,
};

export const DEFAULT_PROGRAM_ID = "va";

/**
 * The active program. Kept as a plain const so the ~10 existing call sites are
 * untouched; when the project switcher lands this becomes a lookup on the route
 * param and PROGRAMS is already the registry it needs.
 */
export const PROGRAM: ProgramConfig = PROGRAMS[DEFAULT_PROGRAM_ID];

/** Is this artifact offered for this program? */
export function artifactApplies(
  kind: "rollup" | "project-plan" | "poam",
  program: ProgramConfig = PROGRAM,
): boolean {
  return program.artifacts.includes(kind);
}

// Per-program lookup, memoised by program id. This was a single module-level map
// built from the active program, which meant workstreamOf and the classifier
// could only ever answer for one program — the exact way a "program-agnostic"
// config stays secretly single-program. Adding Ventura is what surfaced it.
const BY_KEY_CACHE = new Map<string, Record<string, Workstream>>();

function workstreamIndex(program: ProgramConfig): Record<string, Workstream> {
  let hit = BY_KEY_CACHE.get(program.id);
  if (!hit) {
    hit = Object.fromEntries(program.workstreams.map((w) => [w.key, w]));
    BY_KEY_CACHE.set(program.id, hit);
  }
  return hit;
}

/**
 * Total function — never returns undefined, so no call site has to handle a
 * miss. linear_issues.workstream is free text with no constraint, so an
 * unrecognised key is reachable; before this existed those lookups threw.
 */
export function workstreamOf(
  key: string | null | undefined,
  program: ProgramConfig = PROGRAM,
): Workstream {
  const hit = key ? workstreamIndex(program)[key] : undefined;
  if (hit) return hit;
  const shown = key ?? "—";
  return {
    key: shown,
    short: shown,
    label: shown,
    owner: "",
    color: program.unknownWorkstreamColor,
  };
}

/** Workstream keys in display order. */
export function workstreamKeys(program: ProgramConfig = PROGRAM): string[] {
  return program.workstreams.map((w) => w.key);
}

/**
 * What the source literally said, or null. Used on the WRITE path, where the
 * value is persisted.
 *
 * Deliberately narrower than classifyWorkstream and NOT to be merged with it: if
 * sync stored keyword guesses, linear_issues.workstream would stop being "what
 * the source said", and a later change to the keyword rules could no longer
 * re-derive old rows.
 */
export function parseSourceWorkstream(
  title: string,
  program: ProgramConfig = PROGRAM,
): string | null {
  const c = program.classifier.explicit;
  if (!c) return null;
  const m = title.toUpperCase().match(c.pattern);
  return m ? c.prefix + m[1] : null;
}

/**
 * Best available attribution for display: an explicit value if the source has
 * one, then the source's own pattern, then keyword heuristics, then the
 * fallback. Used on the READ path, so a rule change re-derives everything.
 */
export function classifyWorkstream(
  title: string,
  explicit?: string | null,
  program: ProgramConfig = PROGRAM,
): string {
  return classifyWorkstreamDetailed(title, explicit, program).workstream;
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
  program: ProgramConfig = PROGRAM,
): { workstream: string; basis: AttributionBasis } {
  if (explicit) return { workstream: explicit, basis: "stored" };
  const t = title.toUpperCase();
  const c = program.classifier;
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
