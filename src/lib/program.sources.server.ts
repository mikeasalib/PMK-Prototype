// Which external projects the active program pulls from. Server-only: the
// .server.ts suffix keeps these IDs out of the client bundle structurally
// rather than by convention. Only sync.server.ts should import this.
//
// Env overrides mean repointing at a different Linear project, Notion hub, or
// Granola folder needs no code change. Auth stays in LINEAR_API_KEY /
// NOTION_API_KEY / GRANOLA_API_KEY, which were already env-driven.

export const SOURCES = {
  gatewayUrl: process.env.CONNECTOR_GATEWAY_URL ?? "https://connector-gateway.lovable.dev",

  linear: {
    projectId: process.env.LINEAR_PROJECT_ID ?? "3e9eebbb-e77c-473f-8509-4f8f3d0df140",
    /** Human-readable scope, recorded on every sync_runs row. */
    scopeLabel: process.env.LINEAR_SCOPE_LABEL ?? "project Department of Veterans Affairs (DEP)",
    /** Plural noun for the sync result message, e.g. "12 DEP issues". */
    itemNoun: process.env.LINEAR_ITEM_NOUN ?? "DEP issues",
  },

  granola: {
    folderId: process.env.GRANOLA_FOLDER_ID ?? "fol_QyIIASIUKJmme3",
    folderLabel: process.env.GRANOLA_FOLDER_LABEL ?? "VA Project",
    itemNoun: process.env.GRANOLA_ITEM_NOUN ?? "VA notes",
  },

  notion: {
    rootPageId: process.env.NOTION_ROOT_PAGE_ID ?? "35968467f30f80ef87dbc6e3585b52de",
    hubLabel: process.env.NOTION_HUB_LABEL ?? "VA",
  },
} as const;
