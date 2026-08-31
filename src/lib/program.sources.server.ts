// Which external projects each program pulls from. Server-only: the .server.ts
// suffix keeps these IDs out of the client bundle structurally rather than by
// convention. Only sync.server.ts and risk-register.server.ts import this.
//
// Auth stays in LINEAR_API_KEY / NOTION_API_KEY / GRANOLA_API_KEY, which were
// already env-driven. These are the "which data" selectors, not credentials.
//
// Two things the second program forced into the open:
//
//  1. Not every program has every source, and `null` beats a wrong id — a null
//     source is honest, a wrong one produces confident garbage. Ventura was
//     briefly configured with `linear: null` on my assumption that a rec
//     deployment tracked no delivery work there. That was wrong: the project
//     exists, spans two teams (REC and DEP), and is the team's actual issue
//     register. Corrected below. The lesson kept: verify a source is absent
//     rather than inferring absence from the program type.
//  2. Granola cannot be scoped by folder. The VA program has one
//     (fol_QyIIASIUKJmme3, "VA Project") but a folder-scoped read is refused at
//     the workspace-policy level, and listing folders returns an empty set for
//     this account — so the folder id is reference-only and every read is scoped
//     by time first, then narrowed by attendee domain and note title. Ventura
//     was already scoped that way: its six calls in the last 30 days cohere by
//     venturacounty.gov / ventura.org attendees and belong to no shared folder.

export interface LinearSource {
  projectId: string;
  /** Human-readable scope, recorded on every sync_runs row. */
  scopeLabel: string;
  /** Plural noun for the sync result message, e.g. "12 DEP issues". */
  itemNoun: string;
}

/**
 * Granola scoping.
 *
 * Granola has no concept of a program, and the one structural handle it does
 * offer — folders — is not readable for this account. So the cut is: a time
 * window first (the API's own primary filter), then narrowing on what the notes
 * actually carry. A program that narrows on nothing gets every note in the
 * window, which is honest but rarely what you want, so both narrowing fields are
 * required rather than optional.
 */
export interface GranolaSource {
  /** How far back to read. The first and cheapest cut. */
  windowDays: number;
  /** Attendee email domains that identify this program. Empty = no narrowing. */
  domains: string[];
  /** Note-title pattern for this program. Null = no narrowing. */
  titleMatch: RegExp | null;
  /**
   * The program's Granola folder, for reference only. Folder-scoped reads are
   * refused for this account, so nothing sends this — it is kept so the id is
   * not lost, and so a future account with folder access has it to hand.
   */
  folderId: string | null;
  label: string;
  itemNoun: string;
}

export interface NotionSource {
  rootPageId: string;
  hubLabel: string;
  /** Page title to look for when locating the risk register, if the program keeps one. */
  riskRegisterMatch: RegExp | null;
  /**
   * Page holding hand-maintained checkbox tasks — the ones that never became
   * Linear tickets.
   *
   * This exists because the Linear board is NOT the whole picture. On the VA
   * program the strategist keeps a per-sprint tracker in Notion with ~70 `to_do`
   * blocks (design revisions, calls to schedule, admin items) of which only a
   * handful have Linear issues. Reading Linear alone made the app confidently
   * report 26 open items when the real in-flight count was several times that.
   *
   * Null when a program keeps no such page. Do not point this at the risk
   * register — different shape, different reader.
   */
  taskTrackerPageId: string | null;
}

/**
 * Where a program's risk/issue register actually lives.
 *
 * The two programs disagree, which is the point. VA keeps a hand-authored Notion
 * table with likelihood x impact. Ventura keeps no written register at all — the
 * team holds it mentally and the Linear board is the working record — so its
 * risks are derived from labelled Linear issues.
 *
 * Linear-derived risks are better on two POA&M columns and worse on one: Linear
 * carries a real createdAt and dueDate (detection date and scheduled completion,
 * both of which VA's table lacks entirely) but models no likelihood or impact,
 * so severity has to come from priority.
 */
export type RiskSource =
  | { kind: "notionTable" }
  | {
      kind: "linearIssues";
      /** Only issues carrying one of these labels count as register entries.
       *  Empty means every issue on the project counts. */
      labels: string[];
      /** Treat an overdue issue as a register entry regardless of label. */
      includeOverdue: boolean;
    }
  | { kind: "none" };

export interface ProgramSources {
  /** Null when the program's delivery work does not live in Linear. */
  linear: LinearSource | null;
  granola: GranolaSource | null;
  notion: NotionSource | null;
  /** Where risks come from. Not every program keeps one the same way. */
  risks: RiskSource;
}

export const GATEWAY_URL =
  process.env.CONNECTOR_GATEWAY_URL ?? "https://connector-gateway.lovable.dev";

const VA_SOURCES: ProgramSources = {
  linear: {
    projectId: process.env.LINEAR_PROJECT_ID ?? "3e9eebbb-e77c-473f-8509-4f8f3d0df140",
    scopeLabel: process.env.LINEAR_SCOPE_LABEL ?? "project Department of Veterans Affairs (DEP)",
    itemNoun: process.env.LINEAR_ITEM_NOUN ?? "DEP issues",
  },
  granola: {
    windowDays: Number(process.env.GRANOLA_WINDOW_DAYS ?? 30),
    // The calls that constitute this program: VA and GovCIO attendees, plus
    // Kaizen's own people on VA calls — which is why the title pattern carries
    // the load and the domains only confirm.
    domains: ["va.gov", "govcio.com", "soldierpoint.com"],
    // Measured against a real 30-day pull: 52 of 55 notes match this.
    titleMatch: /\bVA\b|veteran|govcio|\bWS[1-5]\b|my ?va|cross-?workstream|DEP-/i,
    folderId: process.env.GRANOLA_FOLDER_ID ?? "fol_QyIIASIUKJmme3",
    label: process.env.GRANOLA_LABEL ?? "VA calls (last 30 days)",
    itemNoun: process.env.GRANOLA_ITEM_NOUN ?? "VA notes",
  },
  notion: {
    rootPageId: process.env.NOTION_ROOT_PAGE_ID ?? "35968467f30f80ef87dbc6e3585b52de",
    hubLabel: process.env.NOTION_HUB_LABEL ?? "VA",
    riskRegisterMatch: /risk register/i,
    // "Mike - VA Task Tracking (Sprint 5)". Env-overridable because the tracker
    // is per-sprint: a new sprint means a new page, and rotating it should be a
    // config change rather than a deploy.
    taskTrackerPageId:
      process.env.NOTION_TASK_TRACKER_PAGE_ID ?? "3b368467f30f81758a65f0ba3ad9f349",
  },
  risks: { kind: "notionTable" },
};

const VENTURA_SOURCES: ProgramSources = {
  linear: {
    // Spans two teams, Recreation (REC) and Deployment (DEP), so issue
    // identifiers are a mix of REC- and DEP-. Lead is nico@kaizenlabs.co.
    projectId: process.env.VENTURA_LINEAR_PROJECT_ID ?? "b7d98661-7d8a-47d7-addf-096bc73a7752",
    scopeLabel: "project venturacounty (REC + DEP)",
    itemNoun: "Ventura issues",
  },
  granola: {
    windowDays: Number(process.env.VENTURA_GRANOLA_WINDOW_DAYS ?? 30),
    domains: ["venturacounty.gov", "ventura.org"],
    titleMatch: /ventura|zion|campground|parks/i,
    // This account keeps no Ventura folder — the calls cohere by attendee.
    folderId: null,
    label: "Ventura calls (last 30 days)",
    itemNoun: "Ventura notes",
  },
  notion: {
    // "Ventura County, CA" under Recreation Customer Deployment & Health.
    rootPageId: process.env.VENTURA_NOTION_ROOT_PAGE_ID ?? "31768467f30f81d29342cac96e9ea6bc",
    hubLabel: "Ventura County, CA",
    // Confirmed by the account owner: there is no written register page. The
    // team holds it mentally. Null because nothing exists to find, not because
    // it was not looked for.
    riskRegisterMatch: null,
    // No hand-maintained checkbox tracker either: this account's work lives on
    // the Linear board, and the between-call items come off Granola syncs.
    taskTrackerPageId: process.env.VENTURA_NOTION_TASK_TRACKER_PAGE_ID ?? null,
  },
  // Risks come off the Linear board instead. "Bug" is the register-worthy
  // label, and anything past its due date counts regardless of label — an
  // overdue commitment is a risk whether or not someone tagged it one.
  risks: { kind: "linearIssues", labels: ["Bug"], includeOverdue: true },
};

export const SOURCES_BY_PROGRAM: Record<string, ProgramSources> = {
  va: VA_SOURCES,
  ventura: VENTURA_SOURCES,
};

export function sourcesFor(programId: string): ProgramSources {
  const hit = SOURCES_BY_PROGRAM[programId];
  if (!hit) throw new Error(`no sources configured for program "${programId}"`);
  return hit;
}

// The SOURCES back-compat alias is gone with sync.server.ts, its only caller.
// It pinned VA's sources at module scope and encoded the folder-only Granola
// shape, so leaving it would have been a second, stale answer to "what does this
// program read from".
