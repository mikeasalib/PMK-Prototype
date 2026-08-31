// Ground truth workstream status from the corrected v2 program update
// (Kaizen Laboratories, Sprint 3, Jul 13 2026). Consolidates Cross-Workstream
// Sync 7/13, WS3 Tech Set Up 7/13, MyVA Demo Follow-Up 7/13, WS5 7/9,
// Typography 7/8, Cross-WS 7/6, Cross-WS Roadmap 6/29, WS4 Doc Status 6/23.
//
// Taxonomy correction (v2): WS3 = Design + Intelligent Search (search lives
// INSIDE WS3, run with Media Rain). WS2 = Identity + Auth (CLEAR / long-lived
// tokens / Magic Link). Earlier versions had WS1/WS2 mislabeled.

import type { WorkstreamKey } from "./va-data";

export const WORKSTREAM_UPDATES_SOURCE = {
  date: "2026-07-13",
  label: "Cross-Workstream Program Update v2 · Sprint 4",
};

export type Health = "on_track" | "at_risk" | "blocked";

export const HEALTH_LABEL: Record<Health, string> = {
  on_track: "On track",
  at_risk: "At risk",
  blocked: "Blocked",
};

/** The Kaizen accent scale. Green is reserved for on-track. */
export const HEALTH_COLOR: Record<Health, string> = {
  on_track: "#2E8540",
  at_risk: "#8A5A00",
  blocked: "#FB4938",
};

export interface WorkstreamUpdate {
  ws: WorkstreamKey;
  name: string;
  owner: string;
  health: Health;
  headline: string;
  progress: string[];
  risks: string[];
  nextSteps: string[];
  highlights: string[];
}

export const WORKSTREAM_UPDATES: WorkstreamUpdate[] = [
  {
    ws: "WS1",
    name: "Document Submission + Tracking",
    owner: "Brad / Justin (apothesource)",
    health: "on_track",
    headline: "No blockers as of 7/13. Architecture review checklist submitting today.",
    progress: [
      "Architecture review checklist approval submitting 7/13",
      "Veterans Submission Workflow Services (VST) started",
      "Draft ADRs forwarded to Jennifer Holliday; Bill has copy for review",
      "CNP confirmation meeting held on VST/event publishing ownership",
    ],
    risks: [
      "QS MMS event state due 7/17 from source system — hard external dependency",
      "Port exceptions for MAP/Temporal to enterprise event bus needed by 8/31",
      "SARA form for reporting API ATO blocked on template from platform team (target early Aug)",
      "WS1 velocity still unknown — may absorb work from other streams in ~1 month (Steve Albers)",
    ],
    nextSteps: [
      "Start Notification API proxy onboarding this sprint",
      "Kick off Temporal API proxy creation",
      "Resolve single vs. multiple Temporal workflow definitions (1010EZ, 527EZ) mid-July",
      "VA Notify onboarding kicks off next sprint (trigger events TBD)",
    ],
    highlights: [
      "Architecture review checklist approval submitting 7/13; VST kicked off",
      "External dep: QS MMS event state due 7/17 from source system",
      "Port exceptions for MAP/Temporal → enterprise event bus by 8/31",
    ],
  },
  {
    ws: "WS2",
    name: "Identity + Authentication",
    owner: "Mariam (GovCIO / CLEAR)",
    health: "at_risk",
    headline: "CLEAR contract slipped to 8/1; Magic Link scope replanned to 7/24.",
    progress: [
      "Session length doc delivered to George Waddington and Jacob",
      "IO1 pilot: team recommending against; pros/cons doc in progress",
      "Big CLEAR IL1 presentation held 7/13",
    ],
    risks: [
      "CLEAR contract slipped from end of June to 8/1 (Samara tracking) — ATO readiness at risk if slips further",
      "Magic Link scope finalization replanned from 7/10 to 7/24",
      "Long-lived tokens revision requests pushed to next week",
      "CLEAR IL1: no out-of-box solution; plan due from CLEAR by 7/17",
    ],
    nextSteps: [
      "Mariam + CLEAR to document IO1 pros/cons for leadership sign-off",
      "Finalize long-lived token requirements end of next week; UX research mid-Aug",
      "NPI stage environment stand-up by end of July",
      "NPR integration targeted end of July",
    ],
    highlights: [
      "CLEAR contract slipped end-June → 8/1; blocks heavy integration & CLEAR ATO",
      "Magic Link scope finalization replanned 7/10 → 7/24",
      "CLEAR IL1 plan due from CLEAR by 7/17; no out-of-box solution",
    ],
  },
  {
    ws: "WS3",
    name: "Design + Intelligent Search",
    owner: "Lukasz / Daman / Ben (Kaizen + Media Rain)",
    health: "at_risk",
    headline:
      "Active design sprint on critical path. 3 product outlines ready; search go/no-go open.",
    progress: [
      "MyVA authenticated prototype (v A/B/C) reviewed 7/7 and 7/13 — ~80% designed, third rail removed",
      "Unauth homepage wireframes live; first click-through prototype in progress",
      "Three product outlines complete (unauth, MyVA, intelligent search) — pending Matt review before collab cycle",
      "Typography decision: Public Sans everywhere, 16px body, stay in USWDS stack",
      "Search: representative eval dataset done; staging + side-by-side testing ready; search.gov API accessible",
      "~100 VA subdomains reviewed for search ingestion",
    ],
    risks: [
      "Intelligent search architecture (search.gov vs Amazon Kendra) go/no-go still open — Lukasz, Jul/Aug",
      "Typography rollout is larger effort than color (more hard-coded); 8/1 target tight",
      "Nov 11 full integration of MyHealtheVet/Benefits/Debt unlikely — must go section by section",
      "GitHub / vets-website access for Kaizen engineers still progressing (Josh, Vivian GFE/PIV)",
      "Feature flag/fallback strategy blocked on search architecture decision (DEP-1903 on DEP-1902)",
    ],
    nextSteps: [
      "Submit product outlines to collab cycle after Matt review",
      "Schedule additional unauth homepage demo",
      "One round of readability/comprehension testing on typography (Kevin)",
      "Engage 508 team on 8/1; start Shane/Martha accessibility sessions now",
      "Coordinate outline submission with Matt (Kevin OOO)",
    ],
    highlights: [
      "Search go/no-go (search.gov vs Kendra) still open — blocks feature-flag/fallback (DEP-1903)",
      "Public Sans typography rollout tight for 8/1; more hard-coded than color",
      "Full MyHealtheVet/Benefits/Debt integration by 11/11 unlikely — section-by-section",
    ],
  },
  {
    ws: "WS4",
    name: "Cross-Site Integration + Document Status",
    owner: "John Larkin (GovCIO)",
    health: "at_risk",
    headline: "SSO + federation on critical path. ATO package won't finalize until end of month.",
    progress: [
      "PIV: QuickSubmit complete; VLM production migration to Okta done",
      "Lower environments for QuickSubmit → VA.gov set up",
      "Reverse proxy ServiceNow ticket approved; subdomain in NEO/edge routing queue",
      "RES (Appian backend) went to production",
      "eForms ahead of schedule — 36 forms in progress",
    ],
    risks: [
      "Full ATO package slips to end of month — proceeding on interim paragraph to PSAC/AO",
      "ICAM/OCDO bookmark spike (SSO critical path) confirmation due 7/17 — Oren",
      "ARP environments still to configure",
      "QuickSubmit UX context (first-time vs evidence response) still open with WS3",
      "Packet-level tracking (~2 docs/packet) needs alignment with WS1 on status expression",
    ],
    nextSteps: [
      "John drafting interim ATO paragraph (Steve to sanity-check)",
      "Assemble PIA, PTA, WASA, open POAMs for subdomain review",
      "Formalize QuickSubmit UX dependency with WS3 next week",
      "Last code drop cross-site federation target 10/18",
    ],
    highlights: [
      "Full ATO package slips to end of month — interim paragraph to PSAC/AO",
      "ICAM/OCDO bookmark spike (SSO critical path) confirmation due 7/17",
      "PIV: QuickSubmit complete; VLM prod migration to Okta done",
    ],
  },
  {
    ws: "WS5",
    name: "Health Chat + PEP",
    owner: "Luke (OCC / VHA coord)",
    health: "at_risk",
    headline:
      "Lowest scope — integration handshake. Possible completion before September. ATO conversation still needed.",
    progress: [
      "Follow-up WS5 Health Chat/PEP call held 7/9 with Derek Juang, Patrick Bateman, Robyn Singleton, Brian Olinger, Matt Bouma",
      "Bi-directional integration discussions underway; spikes planned for Sprint 4",
      "Feature flag fallback/rollback strategy in progress",
      "Vets API integration: tacit approval received",
    ],
    risks: [
      "WS5 ATO conversation still needs to be scheduled — Andrea",
      "Health chat setup unknown: UI placement change vs separate server/stylesheet",
      "WS1 API feasibility for open/closed status check unconfirmed",
      "Staging/demo access for Vivian's team being arranged via Luke",
    ],
    nextSteps: [
      "Luke to assemble architecture details for ATO follow-up",
      "Andrea to schedule WS5 ATO follow-up with Luke (urgent)",
      "Confirm health chat setup approach this week",
    ],
    highlights: [
      "WS5 ATO conversation still unscheduled — blocks design/architecture intent",
      "Bi-directional integration spikes underway; Vets API tacit approval received",
      "Health chat setup (UI vs separate server) to be confirmed this week",
    ],
  },
  {
    ws: "Admin",
    name: "Program / Cross-cutting",
    owner: "Andrea / Kaizen PM / Luke",
    health: "at_risk",
    headline: "New ATO security lead onboarding; Kendra sunset + platform ATO renewal on watch.",
    progress: [
      "Decision: stay on Amazon Kendra for now (~1 yr runway) pending WS3 go/no-go",
      "Jason Day taking over as ATO security lead (route through Andrea)",
      "Weekly cross-workstream syncs running Mondays 1pm CDT",
      "Program tracking moving into Jira for live status",
    ],
    risks: [
      "VA.gov platform ATO renewal 7/31 — Andrea",
      "Kendra in maintenance mode — migration story needed in backlog",
      "AWS account (Kendra/Bedrock) confirmation outstanding — Ben",
      "GitHub / vets-website access for Kaizen engineers blocks implementation tickets",
    ],
    nextSteps: [
      "Patrick to create Kendra migration backlog story",
      "Ben to confirm AWS account and flag if Kendra needed by 11/11",
      "Daniel to sync with Alex Mojica on monitoring/observability before Bob Cunningham meeting",
      "Roadmap review with ESC (Executive Steering Committee)",
    ],
    highlights: [
      "VA.gov platform ATO renewal 7/31 — cross-cutting risk",
      "Jason Day taking over as ATO security lead (via Andrea)",
      "Kendra in maintenance mode — migration story needed pending WS3 go/no-go",
    ],
  },
];

// Cross-workstream dependencies consolidated from v2 blocker table.
export interface CrossDep {
  id: string;
  title: string;
  from: WorkstreamKey;
  to: WorkstreamKey;
  severity: Health;
  detail: string;
  owner: string;
  due?: string;
}

export const CROSS_DEPS: CrossDep[] = [
  {
    id: "xd-qs-mms",
    title: "QS MMS event state hand-off",
    from: "WS4",
    to: "WS1",
    severity: "at_risk",
    detail:
      "WS1 needs the QS MMS event state from the source system by 7/17 to keep Veterans Submission Workflow Services on track.",
    owner: "WS4 source system → Brad (WS1)",
    due: "2026-07-17",
  },
  {
    id: "xd-icam-sso",
    title: "ICAM / OCDO bookmark spike (SSO critical path)",
    from: "WS4",
    to: "Admin",
    severity: "at_risk",
    detail:
      "SSO critical path depends on the OCDO bookmark spike. ICAM confirmation needed no later than 7/17.",
    owner: "Oren Kanner",
    due: "2026-07-17",
  },
  {
    id: "xd-qs-ux",
    title: "QuickSubmit placement in MyVA / ARP / VA.gov",
    from: "WS3",
    to: "WS4",
    severity: "at_risk",
    detail:
      "WS3 wireframe raised open questions on how QuickSubmit appears in context (first-time upload vs evidence response). ARP design is current focus; VA.gov conversation must close in parallel. Formal dependency next week.",
    owner: "Daman (WS3) + John Larkin / Paul Short (WS4)",
  },
  {
    id: "xd-ws5-ato",
    title: "WS5 ATO conversation blocks architecture intent",
    from: "WS5",
    to: "Admin",
    severity: "blocked",
    detail:
      "Design and architecture intent cannot move until the WS5 ATO conversation happens. Andrea to schedule with Luke ASAP.",
    owner: "Andrea + Luke",
  },
  {
    id: "xd-github-access",
    title: "GitHub / vets-website access for Kaizen engineers",
    from: "WS3",
    to: "Admin",
    severity: "blocked",
    detail:
      "Josh completed trainings; VA access still progressing. Vivian GFE + PIV setup in progress. Implementation tickets blocked until access lands.",
    owner: "Michael → Andrea / Lindsey Hattamer",
  },
  {
    id: "xd-clear-contract",
    title: "CLEAR contract gates WS2 integration",
    from: "WS2",
    to: "Admin",
    severity: "at_risk",
    detail:
      "CLEAR contract slipped from end of June to 8/1 (Samara tracking). Heavy CLEAR integration cannot restart until it closes. Blocks Magic Link path options and CLEAR ATO (~10/16).",
    owner: "Mariam + Samara",
    due: "2026-08-01",
  },
  {
    id: "xd-magic-link",
    title: "Magic Link scope → WS3 notification template",
    from: "WS2",
    to: "WS3",
    severity: "at_risk",
    detail:
      "Magic Link notification template (WS3 design deliverable) depends on WS2 finalizing Magic Link scope. Originally due 7/10; now 7/24.",
    owner: "Mariam (WS2) → Daman (WS3)",
    due: "2026-07-24",
  },
  {
    id: "xd-long-lived-tokens",
    title: "Long-lived tokens → authenticated MyVA states",
    from: "WS2",
    to: "WS3",
    severity: "at_risk",
    detail:
      "Authenticated MyVA states depend on long-lived token behavior. Requirements finalized end of next week; UX research mid-Aug; integration test/UAT1 end of Aug.",
    owner: "George Waddington (WS2)",
  },
  {
    id: "xd-search-arch",
    title: "Intelligent search go/no-go (search.gov vs Kendra)",
    from: "WS3",
    to: "WS3",
    severity: "at_risk",
    detail:
      "Two parallel backend paths. Lukasz to decide Jul/Aug. Feature flag/fallback strategy (DEP-1903) blocked on this. Amazon Kendra inclusion in ATO docs pending decision.",
    owner: "Lukasz",
  },
  {
    id: "xd-kendra",
    title: "Kendra sunset / Bedrock migration decision",
    from: "Admin",
    to: "WS3",
    severity: "at_risk",
    detail:
      "Amazon Kendra is in maintenance mode. WS3 search retrieval needs to know whether to plan a migration before 11/11.",
    owner: "Ben + Patrick",
  },
  {
    id: "xd-typography",
    title: "Typography rollout by Matt's team",
    from: "WS3",
    to: "Admin",
    severity: "at_risk",
    detail:
      "Public Sans everywhere, 16px body. Typography more hard-coded than color; 8/1 target tight. 508 engagement 8/1.",
    owner: "Matt Dingee",
    due: "2026-08-01",
  },
  {
    id: "xd-ws4-ato",
    title: "WS4 ATO package finalization",
    from: "WS4",
    to: "Admin",
    severity: "at_risk",
    detail:
      "Full ATO package won't finalize until end of month. Team proceeding on interim paragraph to PSAC/AO; Steve to sanity-check.",
    owner: "John Larkin + Steve Albers",
  },
  {
    id: "xd-platform-ato",
    title: "VA.gov platform ATO renewal",
    from: "Admin",
    to: "Admin",
    severity: "at_risk",
    detail: "Platform ATO renewal scheduled 7/31 — affects all workstreams.",
    owner: "Andrea Townsend",
    due: "2026-07-31",
  },
  {
    id: "xd-ws5-ws1-api",
    title: "WS1 API feasibility for open/closed status (WS5)",
    from: "WS5",
    to: "WS1",
    severity: "at_risk",
    detail:
      "WS5 needs WS1 API feasibility confirmation for open/closed status check via apothesource.",
    owner: "WS1 + WS5",
  },
  {
    id: "xd-vanotify",
    title: "VA Notify trigger events → claims status notifications (WS3)",
    from: "WS1",
    to: "WS3",
    severity: "at_risk",
    detail:
      "Claim status notification design (WS3) depends on VA Notify trigger events being defined. SMS may require new application number — unknown.",
    owner: "Brad (WS1) → Daman (WS3)",
  },
];
