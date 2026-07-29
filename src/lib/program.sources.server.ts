// Which external projects each program pulls from. Server-only: the .server.ts
// suffix keeps these IDs out of the client bundle structurally rather than by
// convention. Only sync.server.ts and risk-register.server.ts import this.
//
// Auth stays in LINEAR_API_KEY / NOTION_API_KEY / GRANOLA_API_KEY, which were
// already env-driven. These are the "which data" selectors, not credentials.
//
// Two things the second program forced into the open:
//
//  1. Not every program has every source. Ventura County has no Linear project —
//     its delivery work is not tracked there — so `linear` is null rather than
//     pointing at something wrong. A null source is honest; a wrong id produces
//     confident garbage.
//  2. Granola is not scoped the same way twice. The VA program is a folder.
//     Ventura is identified by participant email domain, because that is how the
//     meetings actually cohere — six Ventura calls in the last 30 days all carry
//     venturacounty.gov or ventura.org attendees and belong to no shared folder.

export interface LinearSource {
  projectId: string;
  /** Human-readable scope, recorded on every sync_runs row. */
  scopeLabel: string;
  /** Plural noun for the sync result message, e.g. "12 DEP issues". */
  itemNoun: string;
}

/** Granola scoping. Exactly one of these forms, never both. */
export type GranolaSource =
  | { kind: "folder"; folderId: string; label: string; itemNoun: string }
  | { kind: "participantDomains"; domains: string[]; label: string; itemNoun: string };

export interface NotionSource {
  rootPageId: string;
  hubLabel: string;
  /** Page title to look for when locating the risk register, if the program keeps one. */
  riskRegisterMatch: RegExp | null;
}

export interface ProgramSources {
  /** Null when the program's delivery work does not live in Linear. */
  linear: LinearSource | null;
  granola: GranolaSource | null;
  notion: NotionSource | null;
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
    kind: "folder",
    folderId: process.env.GRANOLA_FOLDER_ID ?? "fol_QyIIASIUKJmme3",
    label: process.env.GRANOLA_FOLDER_LABEL ?? "VA Project",
    itemNoun: process.env.GRANOLA_ITEM_NOUN ?? "VA notes",
  },
  notion: {
    rootPageId: process.env.NOTION_ROOT_PAGE_ID ?? "35968467f30f80ef87dbc6e3585b52de",
    hubLabel: process.env.NOTION_HUB_LABEL ?? "VA",
    riskRegisterMatch: /risk register/i,
  },
};

const VENTURA_SOURCES: ProgramSources = {
  // No Linear project. Recreation deployments are run out of Notion, and the
  // "Implementation" Linear project referenced in Customer Operations is not
  // per-customer. Left null so work-item sections report an absent source
  // instead of silently showing another program's board.
  linear: null,
  granola: {
    kind: "participantDomains",
    domains: ["venturacounty.gov", "ventura.org"],
    label: "Ventura County (by participant domain)",
    itemNoun: "Ventura notes",
  },
  notion: {
    // "Ventura County, CA" under Recreation Customer Deployment & Health.
    rootPageId: process.env.VENTURA_NOTION_ROOT_PAGE_ID ?? "31768467f30f81d29342cac96e9ea6bc",
    hubLabel: "Ventura County, CA",
    // This program keeps outstanding questions and decisions rather than a risk
    // register table, so there is nothing to look for. Null, not a guess.
    riskRegisterMatch: null,
  },
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

/**
 * Back-compat alias for the active program's sources. Existing call sites in
 * sync.server.ts read SOURCES.linear.projectId and friends; keeping this means
 * the multi-program registry lands without rewriting the sync layer in the same
 * change.
 */
export const SOURCES = {
  gatewayUrl: GATEWAY_URL,
  linear: VA_SOURCES.linear!,
  granola: {
    folderId: (VA_SOURCES.granola as { folderId: string }).folderId,
    folderLabel: VA_SOURCES.granola!.label,
    itemNoun: VA_SOURCES.granola!.itemNoun,
  },
  notion: VA_SOURCES.notion!,
} as const;
