// Seed data for the VA Program Intelligence Suite.

export type WorkstreamKey = "WS1" | "WS2" | "WS3" | "WS4" | "WS5" | "Admin";

export const WORKSTREAMS: Record<
  WorkstreamKey,
  { label: string; color: string }
> = {
  WS1: { label: "WS1 · Architecture & API / Brad", color: "#005ea2" },
  WS2: { label: "WS2 · Identity & Login / Rain", color: "#2e8540" },
  WS3: { label: "WS3 · Landing Page & UI / Kaizen", color: "#54278f" },
  WS4: { label: "WS4 · QuickSubmit / VR&E / VLM", color: "#008480" },
  WS5: { label: "WS5 · VA Health Chat / OCC", color: "#936f38" },
  Admin: { label: "Admin · Program", color: "#565c65" },
};

export type DepState = "clear" | "watch" | "block";
export type TaskStatus =
  | "ready"
  | "in_progress"
  | "partial_block"
  | "blocked"
  | "not_started";

export interface Dep {
  state: DepState;
  text: string;
}

export interface Task {
  id: string;
  title: string;
  owner: string;
  ws: WorkstreamKey;
  status: TaskStatus;
  deps: Dep[];
  note?: string;
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  ready: "Ready",
  in_progress: "In progress",
  partial_block: "Partial block",
  blocked: "Blocked",
  not_started: "Not started",
};

export const STATUS_COLOR: Record<TaskStatus, string> = {
  ready: "#3b7a2e",
  in_progress: "#8a5a00",
  partial_block: "#8a5a00",
  blocked: "#b3261e",
  not_started: "#555555",
};

export const SPRINT3: Task[] = [
  {
    id: "s3-1",
    title: "QuickSubmit SNS feed structure",
    owner: "Brad / Paul Short",
    ws: "WS1",
    status: "in_progress",
    deps: [
      { state: "watch", text: "SNS docs to share this sprint" },
      { state: "block", text: "Kafka not ready by 11/11, SNS fallback" },
      { state: "block", text: "Bill flagged velocity risk" },
    ],
  },
  {
    id: "s3-2",
    title: "Magic link requirements finalized",
    owner: "Brad",
    ws: "WS1",
    status: "in_progress",
    note: "Deadline Jul 10",
    deps: [
      { state: "watch", text: "Requirements close Jul 10" },
      { state: "block", text: "Blocks WS3 notification template in S4" },
    ],
  },
  {
    id: "s3-3",
    title: "Architecture intent ticket submitted",
    owner: "Steven / Rain",
    ws: "WS2",
    status: "blocked",
    deps: [
      { state: "block", text: "AWS vs VETS API unresolved, tech meeting today" },
      { state: "block", text: "Blocks all S4 search build" },
    ],
  },
  {
    id: "s3-4",
    title: "Resources + support retrieval adapter",
    owner: "Rain",
    ws: "WS2",
    status: "ready",
    deps: [
      { state: "clear", text: "Public data, no auth needed" },
      { state: "clear", text: "Evaluation dataset complete" },
    ],
  },
  {
    id: "s3-5",
    title: "Feature flag + rollback strategy",
    owner: "Rain / Steven",
    ws: "WS2",
    status: "blocked",
    deps: [{ state: "block", text: "Requires architecture intent ticket first" }],
  },
  {
    id: "s3-6",
    title: "MyVA prototype — iteration + detail pass",
    owner: "Daman",
    ws: "WS3",
    status: "ready",
    deps: [
      { state: "clear", text: "S2 prototype complete" },
      { state: "clear", text: "Kevin feedback in hand" },
    ],
  },
  {
    id: "s3-7",
    title: "Unauthenticated homepage prototype",
    owner: "Daman",
    ws: "WS3",
    status: "partial_block",
    deps: [
      { state: "watch", text: "OPIA call this week" },
      { state: "clear", text: "Top tasks research complete" },
    ],
  },
  {
    id: "s3-8",
    title: "Typography / font decision",
    owner: "Daman",
    ws: "WS3",
    status: "ready",
    deps: [
      { state: "clear", text: "USWDS stack confirmed per Matt" },
      { state: "watch", text: "Readability test still needed per Kevin" },
    ],
  },
  {
    id: "s3-9",
    title: "SNS payload docs + data dictionary",
    owner: "Paul Short / Chuck / Jean / Denise",
    ws: "WS4",
    status: "in_progress",
    deps: [
      { state: "watch", text: "SNS docs to share this sprint" },
      { state: "block", text: "Jean + Denise data dictionary TBD" },
    ],
  },
  {
    id: "s3-10",
    title: "Discovery stories added to backlog",
    owner: "Luke",
    ws: "WS5",
    status: "not_started",
    deps: [
      { state: "block", text: "Health chat location unknown" },
      { state: "block", text: "WS1 API feasibility TBD" },
      { state: "watch", text: "VA stakeholder meeting this week" },
    ],
  },
  {
    id: "s3-11",
    title: "Cross-workstream dependency story",
    owner: "Michael",
    ws: "Admin",
    status: "in_progress",
    deps: [{ state: "watch", text: "Pre-call sync with Luke today" }],
  },
  {
    id: "s3-12",
    title: "Architecture intent collab cycle placement",
    owner: "Kevin",
    ws: "Admin",
    status: "in_progress",
    deps: [{ state: "watch", text: "Kevin to confirm with Steve/Erica/Jen" }],
  },
];

export const SPRINT4: Task[] = [
  {
    id: "s4-1",
    title: "Magic link notification template",
    owner: "Kaizen",
    ws: "WS1",
    status: "blocked",
    deps: [
      { state: "block", text: "Requires WS1 magic link reqs finalized Jul 10" },
      { state: "watch", text: "No-auth status page template scope" },
    ],
  },
  {
    id: "s4-2",
    title: "GitHub + vets-website repo access",
    owner: "Brad / Andrea / Lindsey",
    ws: "WS1",
    status: "blocked",
    deps: [
      { state: "block", text: "GitHub access pending" },
      { state: "block", text: "Branching strategy unconfirmed" },
      { state: "watch", text: "Kaizen to contact Andrea + Lindsey" },
    ],
  },
  {
    id: "s4-3",
    title: "Search retrieval adapter — full build",
    owner: "Rain / Steven",
    ws: "WS2",
    status: "blocked",
    deps: [
      { state: "block", text: "Requires arch intent approved in S3" },
      { state: "block", text: "AWS vs VETS API must resolve first" },
    ],
  },
  {
    id: "s4-4",
    title: "Search entry point — unauth homepage",
    owner: "Kaizen + Rain",
    ws: "WS2",
    status: "blocked",
    deps: [
      { state: "block", text: "Requires unauth prototype complete" },
      { state: "block", text: "Requires Rain retrieval adapter live" },
      { state: "watch", text: "8/1 typography changes flagged tight" },
    ],
  },
  {
    id: "s4-5",
    title: "MyVA iterated prototype review",
    owner: "Michael",
    ws: "WS3",
    status: "blocked",
    deps: [
      { state: "block", text: "Requires S3 iteration complete" },
      { state: "block", text: "Invite not sent, Michael to action this week" },
    ],
  },
  {
    id: "s4-6",
    title: "Design recommendations sticker sheet",
    owner: "Daman",
    ws: "WS3",
    status: "blocked",
    deps: [
      { state: "block", text: "Requires S3 font decision" },
      { state: "block", text: "Requires MyVA + unauth designs" },
      { state: "watch", text: "Format to align with Matt" },
    ],
  },
  {
    id: "s4-7",
    title: "QuickSubmit tracker UI design",
    owner: "Daman + WS4",
    ws: "WS4",
    status: "blocked",
    deps: [
      { state: "block", text: "Tracker ownership open DEP-1900" },
      { state: "block", text: "Data dictionary from Jean/Denise needed" },
      { state: "block", text: "UI location MyVA/ARP/VA.gov open" },
    ],
  },
  {
    id: "s4-8",
    title: "WS5 entry point design — PEP + Health Chat",
    owner: "Daman",
    ws: "WS5",
    status: "blocked",
    deps: [
      { state: "block", text: "Requires VA stakeholder meeting this week" },
      { state: "block", text: "Health chat staging not arranged" },
      { state: "block", text: "WS1 open/closed API apothesource TBD" },
    ],
  },
  {
    id: "s4-9",
    title: "Chromatic regression testing",
    owner: "Jacob Wright + Kaizen",
    ws: "Admin",
    status: "blocked",
    deps: [
      { state: "block", text: "Luke to send chromatic meeting notes" },
      { state: "watch", text: "Matt + Vivian follow-up TBD" },
    ],
  },
];

export interface Blocker {
  ws: WorkstreamKey;
  title: string;
  description: string;
  resolver: string;
}

export const BLOCKERS: Blocker[] = [
  {
    ws: "WS2",
    title: "AWS vs VETS API decision",
    description:
      "Orchestrator placement must resolve at today's tech meeting.",
    resolver: "Blocks arch intent + all S4 search work.",
  },
  {
    ws: "WS1",
    title: "Magic link requirements Jul 10",
    description: "Treat as at-risk per Bill's velocity skepticism.",
    resolver: "Blocks notification template.",
  },
  {
    ws: "WS1",
    title: "GitHub + vets-website access",
    description:
      "Kaizen cannot implement without repo access. Branching strategy per Lindsey also unconfirmed.",
    resolver: "Awaiting Andrea + Lindsey.",
  },
  {
    ws: "WS4",
    title: "Unified tracker scope DEP-1900",
    description: "Ownership, data source, UI location all open.",
    resolver: "Blocks all tracker design.",
  },
  {
    ws: "WS5",
    title: "Health chat exact setup unknown",
    description:
      "VA stakeholder meeting this week required. WS1 API feasibility also TBD.",
    resolver: "Awaiting stakeholder meeting.",
  },
  {
    ws: "WS3",
    title: "MyVA review invite not sent",
    description:
      "Michael to send, include Julie/designee and Patrick or Lauren Alexanderson.",
    resolver: "Michael to action this week.",
  },
  {
    ws: "Admin",
    title: "Chromatic prereqs + Kaneez access",
    description:
      "Luke to send notes, Kaneez VA DTC + GitHub pending.",
    resolver: "Awaiting Luke + platform team.",
  },
];

// Stakeholders
export interface Contact {
  name: string;
  role: string;
  ws?: string;
}
export interface Org {
  name: string;
  color: string;
  contacts: Contact[];
}

export const ORGS: Org[] = [
  {
    name: "Kaizen Labs",
    color: "#7F77DD",
    contacts: [
      { name: "Nikhil", role: "Exec lead" },
      { name: "Vivian Ellis", role: "PM / DS lead", ws: "WS3" },
      { name: "Daman", role: "Lead designer", ws: "WS3" },
      { name: "Michael Salib", role: "Admin / reporting", ws: "WS3" },
      { name: "Steven", role: "Engineering", ws: "WS2" },
      { name: "Shaham", role: "Engineering", ws: "WS3" },
      { name: "Lou", role: "Design", ws: "WS3" },
    ],
  },
  {
    name: "GovCIO / Soldierpoint",
    color: "#1D9E75",
    contacts: [
      { name: "Alex Mojica", role: "Program exec (Soldierpoint)" },
      { name: "John Larkin", role: "WS4 VP lead", ws: "WS4" },
      { name: "Luke Majewski", role: "PM", ws: "WS3+WS5" },
      { name: "Kaneez Anwar", role: "Scrum master" },
      { name: "Mariam Elisashvili", role: "Planning + reporting" },
      { name: "Paul Short", role: "WS4 technical director", ws: "WS4" },
      { name: "Dan O'Connor", role: "Product delivery / testing" },
      { name: "Lisa Forren", role: "VA.gov support", ws: "WS4" },
      { name: "Denise Cummings", role: "Senior BA", ws: "WS4" },
      { name: "Jacob Wright", role: "Regression testing" },
      { name: "Brenna Hatch", role: "Soldierpoint" },
    ],
  },
  {
    name: "VA / Government",
    color: "#BA7517",
    contacts: [
      { name: "Michael Young", role: "Exec sponsor / DepSec" },
      { name: "Kevin Hoffman", role: "MyVA product lead", ws: "WS3" },
      { name: "Danielle Thierry", role: "Content + IA lead", ws: "WS3" },
      { name: "Erica Washburn", role: "Drupal / CMS", ws: "WS3" },
      { name: "Michelle Middaw", role: "Public websites PM", ws: "WS3" },
      { name: "Mikki Northuis", role: "IA + navigation", ws: "WS3" },
      { name: "Martha Wilkes", role: "Accessibility", ws: "WS3" },
      { name: "Robyn Singleton", role: "MyHealtheVet PO", ws: "WS3" },
      { name: "Amy Lai", role: "Claims status / BMT", ws: "WS4" },
      { name: "Julie Strothman", role: "OCTO", ws: "WS4" },
      { name: "Matt Dingee", role: "File upload tool", ws: "WS4" },
      { name: "Shannon Ford", role: "Benefits design lead", ws: "WS4" },
      { name: "Andrea Townsend", role: "VA platform PM", ws: "WS1" },
      { name: "Lindsey", role: "VA platform engineering", ws: "WS1" },
      { name: "Derrick", role: "PEP", ws: "WS5" },
      { name: "Matt Baum", role: "VA Health Chat", ws: "WS5" },
      { name: "Brian", role: "App development", ws: "WS5" },
    ],
  },
  {
    name: "Rain / subcontractors",
    color: "#3b7a2e",
    contacts: [
      { name: "Dale LaRue", role: "Rain lead" },
      { name: "Ben Steele", role: "Rain" },
      { name: "Josh Davari", role: "Rain engineering lead" },
      { name: "Brad (apothesource)", role: "Architecture / API", ws: "WS1" },
    ],
  },
];

// Linear tickets (seed placeholders)
export interface Ticket {
  id: string;
  title: string;
  status: "Backlog" | "Todo" | "In Progress" | "In Review" | "Done";
  assignee: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  ws: WorkstreamKey;
  created: string;
  sprint: SprintKey;
}

export type SprintKey =
  | "S1" | "S2" | "S3" | "S4" | "S5" | "S6"
  | "S7" | "S8" | "S9" | "S10" | "S11";

export interface SprintDef {
  key: SprintKey;
  label: string;
  window: string;
  start: string; // YYYY-MM-DD
  end: string;
}

export const SPRINTS: SprintDef[] = [
  { key: "S1", label: "S1 · Discovery kickoff", window: "Jun 8 – Jun 19", start: "2026-06-08", end: "2026-06-19" },
  { key: "S2", label: "S2 · Requirements", window: "Jun 22 – Jul 3", start: "2026-06-22", end: "2026-07-03" },
  { key: "S3", label: "S3 · Foundations", window: "Jul 6 – Jul 17", start: "2026-07-06", end: "2026-07-17" },
  { key: "S4", label: "S4 · Build out", window: "Jul 20 – Jul 31", start: "2026-07-20", end: "2026-07-31" },
  { key: "S5", label: "S5 · Integration", window: "Aug 3 – Aug 14", start: "2026-08-03", end: "2026-08-14" },
  { key: "S6", label: "S6 · UAT prep", window: "Aug 17 – Aug 28", start: "2026-08-17", end: "2026-08-28" },
  { key: "S7", label: "S7 · TRR / Integration test", window: "Aug 31 – Sep 11", start: "2026-08-31", end: "2026-09-11" },
  { key: "S8", label: "S8 · UAT 1", window: "Sep 14 – Sep 25", start: "2026-09-14", end: "2026-09-25" },
  { key: "S9", label: "S9 · UAT 2 / PRR", window: "Sep 28 – Oct 9", start: "2026-09-28", end: "2026-10-09" },
  { key: "S10", label: "S10 · ORR / Prod checkout", window: "Oct 12 – Oct 23", start: "2026-10-12", end: "2026-10-23" },
  { key: "S11", label: "S11 · Launch", window: "Oct 26 – Nov 11", start: "2026-10-26", end: "2026-11-11" },
];

export const TICKETS: Ticket[] = [
  { id: "DEP-1890", title: "Arch intent — orchestrator placement", status: "In Progress", assignee: "Steven", priority: "Urgent", ws: "WS2", created: "2026-07-01", sprint: "S3" },
  { id: "DEP-1891", title: "SNS payload documentation", status: "In Progress", assignee: "Paul Short", priority: "High", ws: "WS4", created: "2026-07-01", sprint: "S3" },
  { id: "DEP-1892", title: "Magic link requirements", status: "In Progress", assignee: "Brad", priority: "High", ws: "WS1", created: "2026-07-02", sprint: "S3" },
  { id: "DEP-1893", title: "MyVA prototype iteration", status: "In Progress", assignee: "Daman", priority: "Medium", ws: "WS3", created: "2026-07-02", sprint: "S3" },
  { id: "DEP-1894", title: "Unauth homepage prototype", status: "In Progress", assignee: "Daman", priority: "Medium", ws: "WS3", created: "2026-07-03", sprint: "S3" },
  { id: "DEP-1895", title: "Retrieval adapter — resources + support", status: "Todo", assignee: "Rain", priority: "Medium", ws: "WS2", created: "2026-07-03", sprint: "S3" },
  { id: "DEP-1896", title: "Font / typography decision", status: "In Review", assignee: "Daman", priority: "Low", ws: "WS3", created: "2026-07-04", sprint: "S3" },
  { id: "DEP-1897", title: "Chromatic prereqs", status: "Backlog", assignee: "Jacob Wright", priority: "Medium", ws: "Admin", created: "2026-07-04", sprint: "S4" },
  { id: "DEP-1898", title: "WS5 discovery stories", status: "Backlog", assignee: "Luke", priority: "High", ws: "WS5", created: "2026-07-05", sprint: "S4" },
  { id: "DEP-1899", title: "GitHub access — vets-website", status: "Todo", assignee: "Brad", priority: "Urgent", ws: "WS1", created: "2026-07-05", sprint: "S4" },
  { id: "DEP-1900", title: "Unified tracker scope", status: "Backlog", assignee: "Unassigned", priority: "Urgent", ws: "WS4", created: "2026-07-06", sprint: "S4" },
  { id: "DEP-1901", title: "Magic link notification template", status: "Backlog", assignee: "Kaizen", priority: "High", ws: "WS1", created: "2026-07-06", sprint: "S4" },
  { id: "DEP-1902", title: "Search entry point — unauth homepage", status: "Backlog", assignee: "Rain", priority: "High", ws: "WS2", created: "2026-07-06", sprint: "S4" },
  { id: "DEP-1903", title: "Design sticker sheet", status: "Backlog", assignee: "Daman", priority: "Medium", ws: "WS3", created: "2026-07-06", sprint: "S4" },
  { id: "DEP-1904", title: "CLEAR integration — dev/unit test", status: "Backlog", assignee: "Rain", priority: "Medium", ws: "WS2", created: "2026-07-06", sprint: "S5" },
  { id: "DEP-1905", title: "QuickSubmit SSO configuration", status: "Backlog", assignee: "GovCIO", priority: "High", ws: "WS4", created: "2026-07-06", sprint: "S5" },
];

// Meeting notes
export interface Meeting {
  date: string;
  title: string;
  orgs: string[];
  ws: WorkstreamKey[];
  summary: string;
  body: string;
  link?: string;
  linkLabel?: string;
}

export const MEETINGS: Meeting[] = [
  {
    date: "2026-07-07",
    title: "WS2 tech alignment — orchestrator placement",
    orgs: ["Kaizen Labs", "Rain / subcontractors", "VA / Government"],
    ws: ["WS2"],
    summary: "Deciding AWS vs VETS API for search orchestrator. Unblocks arch intent ticket.",
    body: "Steven and Rain walked through both options. Decision pending Kevin sign-off with Steve/Erica/Jen. Impact: gates all S4 search work.",
    link: "https://www.notion.so/kaizen/WS2-Tech-Alignment-Orchestrator",
    linkLabel: "Notion notes",
  },
  {
    date: "2026-07-06",
    title: "Sprint 3 planning",
    orgs: ["Kaizen Labs", "GovCIO / Soldierpoint"],
    ws: ["Admin", "WS1", "WS2", "WS3", "WS4", "WS5"],
    summary: "Locked Sprint 3 scope Jul 6–17. Blockers captured, tracker seeded.",
    body: "Full sprint scope committed. Cross-workstream dependency story assigned to Michael.",
    link: "https://www.notion.so/kaizen/Sprint-3-Planning",
    linkLabel: "Notion notes",
  },
  {
    date: "2026-07-03",
    title: "WS3 MyVA feedback",
    orgs: ["Kaizen Labs", "VA / Government"],
    ws: ["WS3"],
    summary: "Kevin feedback consolidated on S2 prototype; iteration approved.",
    body: "Daman to run detail pass this sprint. Review invite still pending — Michael to send.",
    link: "https://notes.granola.ai/kaizen/ws3-myva-feedback",
    linkLabel: "Granola recording",
  },
  {
    date: "2026-07-02",
    title: "WS4 SNS structure kickoff",
    orgs: ["GovCIO / Soldierpoint", "Rain / subcontractors"],
    ws: ["WS4", "WS1"],
    summary: "Brad + Paul Short aligning on SNS feed. Kafka fallback confirmed.",
    body: "Data dictionary still open with Jean + Denise. Bill flagged velocity risk.",
    link: "https://www.notion.so/kaizen/WS4-SNS-Kickoff",
    linkLabel: "Notion notes",
  },
];

// Timeline — from VA.gov Roadmap master (v11). Weeks are labels; each activity
// spans a [start, end] week index inclusive.
export const TIMELINE_WEEKS = [
  "W06/08", "W06/15", "W06/22", "W06/29",
  "W07/06", "W07/13", "W07/20", "W07/27",
  "W08/03", "W08/10", "W08/17", "W08/24", "W08/31",
  "W09/07", "W09/14", "W09/21", "W09/28",
  "W10/05", "W10/12", "W10/19", "W10/26",
  "W11/02", "W11/09",
];

export interface TimelineActivity {
  ws: WorkstreamKey;
  label: string;
  phase: "reqs" | "dev" | "test" | "uat" | "prr" | "orr" | "release";
  start: number; // week index
  end: number;
}

export const TIMELINE: TimelineActivity[] = [
  // WS1
  { ws: "WS1", label: "All MMS Document Events Published on EEB", phase: "dev", start: 0, end: 12 },
  { ws: "WS1", label: "Claim Status Links Notifications", phase: "dev", start: 2, end: 12 },
  { ws: "WS1", label: "Claim Status TRR", phase: "test", start: 13, end: 14 },
  { ws: "WS1", label: "Claim Status PRR / Checkout", phase: "release", start: 15, end: 17 },
  { ws: "WS1", label: "Reporting API — Requirements", phase: "reqs", start: 2, end: 3 },
  { ws: "WS1", label: "Reporting API — Development", phase: "dev", start: 4, end: 12 },
  { ws: "WS1", label: "Reporting API — PRR / Checkout", phase: "release", start: 15, end: 17 },
  { ws: "WS1", label: "QuickSubmit Document Workflows", phase: "dev", start: 4, end: 12 },
  { ws: "WS1", label: "VST Document Workflows", phase: "dev", start: 4, end: 12 },
  // WS2
  { ws: "WS2", label: "CLEAR Integration — Requirements", phase: "reqs", start: 4, end: 5 },
  { ws: "WS2", label: "CLEAR Integration — Dev / Unit Test", phase: "dev", start: 6, end: 12 },
  { ws: "WS2", label: "CLEAR Integration — TRR", phase: "test", start: 13, end: 14 },
  { ws: "WS2", label: "CLEAR Integration — PRR UAT 1 / ORR UAT 2", phase: "uat", start: 15, end: 20 },
  { ws: "WS2", label: "Long-Lived Tokens — Requirements", phase: "reqs", start: 4, end: 5 },
  { ws: "WS2", label: "Long-Lived Tokens — Dev / UX test", phase: "dev", start: 6, end: 12 },
  { ws: "WS2", label: "Long-Lived Tokens — TRR / UAT", phase: "uat", start: 13, end: 20 },
  { ws: "WS2", label: "Magic Links / Registration — Discovery", phase: "reqs", start: 4, end: 6 },
  { ws: "WS2", label: "Magic Links / Login — TBD build window", phase: "dev", start: 7, end: 15 },
  // WS3
  { ws: "WS3", label: "UI Refresh of Design System Only — Dev", phase: "dev", start: 6, end: 11 },
  { ws: "WS3", label: "UI Refresh — TRR / Integration test", phase: "test", start: 12, end: 15 },
  { ws: "WS3", label: "UI Refresh — UAT", phase: "uat", start: 16, end: 20 },
  { ws: "WS3", label: "Unauthenticated Homepage — Dev", phase: "dev", start: 4, end: 10 },
  { ws: "WS3", label: "Unauth Homepage — TRR / Integration test", phase: "test", start: 11, end: 15 },
  { ws: "WS3", label: "Unauth Homepage — UAT", phase: "uat", start: 16, end: 20 },
  { ws: "WS3", label: "MyVA Modernization — Dev", phase: "dev", start: 4, end: 10 },
  { ws: "WS3", label: "MyVA — TRR / Integration test", phase: "test", start: 11, end: 15 },
  { ws: "WS3", label: "MyVA — UAT", phase: "uat", start: 16, end: 20 },
  { ws: "WS3", label: "Intelligent Search — Dev", phase: "dev", start: 4, end: 10 },
  { ws: "WS3", label: "Intelligent Search — TRR / Integration test", phase: "test", start: 11, end: 15 },
  { ws: "WS3", label: "Intelligent Search — UAT", phase: "uat", start: 16, end: 20 },
  // WS4
  { ws: "WS4", label: "QuickSubmit SSO — Design & Discovery", phase: "reqs", start: 0, end: 2 },
  { ws: "WS4", label: "QuickSubmit SSO — Configuration & Validation", phase: "dev", start: 4, end: 7 },
  { ws: "WS4", label: "QuickSubmit SSO — Release", phase: "release", start: 8, end: 9 },
  { ws: "WS4", label: "VLM SSO — Configuration & Validation", phase: "dev", start: 4, end: 7 },
  { ws: "WS4", label: "VLM SSO — Release", phase: "release", start: 8, end: 9 },
  { ws: "WS4", label: "CrossSite Integration — VA.gov (Rev-Proxy / SubD)", phase: "dev", start: 4, end: 15 },
  { ws: "WS4", label: "CrossSite Integration — VA.gov Deploy 10/18", phase: "release", start: 18, end: 19 },
  { ws: "WS4", label: "CrossSite Integration — ARP", phase: "dev", start: 4, end: 15 },
  { ws: "WS4", label: "QuickSubmit — Pizza Tracker Build", phase: "dev", start: 4, end: 15 },
  { ws: "WS4", label: "36 eForms — Dev increments", phase: "dev", start: 0, end: 15 },
  { ws: "WS4", label: "36 eForms — Prod Checkout / OPS", phase: "release", start: 18, end: 20 },
  // WS5
  { ws: "WS5", label: "Health Chat Experience & Access — OCC dependency", phase: "reqs", start: 3, end: 6 },
  { ws: "WS5", label: "Health Chat — TRR / Integration with VA.gov", phase: "test", start: 7, end: 10 },
  { ws: "WS5", label: "Health Chat — UAT", phase: "uat", start: 11, end: 14 },
  { ws: "WS5", label: "Patient Engagement Platform (PEP) — OCC dependency", phase: "reqs", start: 3, end: 6 },
  { ws: "WS5", label: "PEP — TRR / Integration with VA.gov", phase: "test", start: 7, end: 10 },
  { ws: "WS5", label: "PEP — UAT", phase: "uat", start: 11, end: 14 },
  { ws: "WS5", label: "Identity, Integration & Technical Enablement", phase: "reqs", start: 3, end: 6 },
  { ws: "WS5", label: "Identity — TRR / Integration Test", phase: "test", start: 7, end: 10 },
  { ws: "WS5", label: "Identity — UAT", phase: "uat", start: 11, end: 14 },
];

export const CONTRACT = {
  contractor: "Kaizen Laboratories Inc.",
  prime: "Soldierpoint Digital Health LLC (GovCIO subsidiary)",
  customer: "Department of Veterans Affairs",
  contract: "36C10G24D0048 / CLIN 0001",
  period: "May 2026 – November 11, 2026",
  value: "$4,000,000 FFP",
  invoice: "ap@govcio.com",
  deadline: "November 11, 2026",
};

// Risks & Blockers register
export type RiskSeverity = "low" | "medium" | "high" | "critical";
export type RiskStatus = "open" | "mitigating" | "resolved";

export interface Risk {
  id: string;
  title: string;
  ws: WorkstreamKey;
  owner: string;
  opened: string; // YYYY-MM-DD
  closed?: string;
  severity: RiskSeverity;
  status: RiskStatus;
  linkedTicket?: string;
  nextAction: string;
}

export const RISKS: Risk[] = [
  { id: "R-001", title: "AWS vs VETS API decision", ws: "WS2", owner: "Steven / Kevin", opened: "2026-06-30", severity: "critical", status: "mitigating", linkedTicket: "DEP-1890", nextAction: "Kevin to confirm with Steve/Erica/Jen this week" },
  { id: "R-002", title: "Magic link requirements slip past Jul 10", ws: "WS1", owner: "Brad", opened: "2026-06-28", severity: "high", status: "open", linkedTicket: "DEP-1892", nextAction: "Lock reqs Jul 10; Bill flagged velocity risk" },
  { id: "R-003", title: "vets-website GitHub access outstanding", ws: "WS1", owner: "Kaizen / Andrea", opened: "2026-06-25", severity: "high", status: "open", linkedTicket: "DEP-1899", nextAction: "Kaizen to escalate with Andrea + Lindsey" },
  { id: "R-004", title: "Unified tracker scope unowned", ws: "WS4", owner: "Unassigned", opened: "2026-06-20", severity: "critical", status: "open", linkedTicket: "DEP-1900", nextAction: "Assign owner; resolve UI location (MyVA / ARP / VA.gov)" },
  { id: "R-005", title: "Kafka not ready by 11/11", ws: "WS1", owner: "Brad / Paul Short", opened: "2026-06-15", severity: "medium", status: "mitigating", nextAction: "SNS fallback in flight; monitor velocity" },
  { id: "R-006", title: "Health chat staging not arranged", ws: "WS5", owner: "Luke / Matt Baum", opened: "2026-06-22", severity: "high", status: "open", linkedTicket: "DEP-1898", nextAction: "VA stakeholder meeting this week" },
  { id: "R-007", title: "MyVA review invite not sent", ws: "WS3", owner: "Michael Salib", opened: "2026-07-01", severity: "medium", status: "open", nextAction: "Send invite incl. Julie/designee, Patrick or Lauren" },
  { id: "R-008", title: "Chromatic prereqs + Kaneez access", ws: "Admin", owner: "Luke / Platform", opened: "2026-06-27", severity: "medium", status: "open", linkedTicket: "DEP-1897", nextAction: "Luke to send notes; VA DTC + GitHub for Kaneez" },
  { id: "R-009", title: "SNS data dictionary open", ws: "WS4", owner: "Jean / Denise", opened: "2026-06-24", severity: "medium", status: "mitigating", linkedTicket: "DEP-1891", nextAction: "Draft this sprint; review with Paul Short" },
  { id: "R-010", title: "S2 typography readability test pending", ws: "WS3", owner: "Daman / Kevin", opened: "2026-07-02", severity: "low", status: "open", nextAction: "Schedule readability test before 8/1 change window" },
  { id: "R-011", title: "S1 branching strategy confirmed", ws: "WS1", owner: "Lindsey", opened: "2026-06-10", closed: "2026-06-30", severity: "medium", status: "resolved", nextAction: "Documented in Notion — closed" },
];

// Decisions log
export interface Decision {
  id: string;
  date: string;
  title: string;
  rationale: string;
  decidedBy: string;
  ws: WorkstreamKey;
  relatedMeeting?: string;
  relatedTickets?: string[];
}

export const DECISIONS: Decision[] = [
  { id: "D-012", date: "2026-07-06", title: "Sprint 3 scope locked", rationale: "All four workstreams committed; cross-WS dependency story assigned to Michael.", decidedBy: "Vivian / Luke / Kaizen leads", ws: "Admin", relatedMeeting: "Sprint 3 planning" },
  { id: "D-011", date: "2026-07-04", title: "USWDS typography stack adopted", rationale: "Confirmed with Matt; Source Sans 3 + Bitter meets VA.gov parity. Readability test still pending.", decidedBy: "Daman / Matt", ws: "WS3", relatedTickets: ["DEP-1896"] },
  { id: "D-010", date: "2026-07-02", title: "SNS fallback if Kafka not ready by 11/11", rationale: "Removes launch dependency on Kafka availability. Brad + Paul Short co-signed.", decidedBy: "Brad / Paul Short", ws: "WS1", relatedMeeting: "WS4 SNS structure kickoff", relatedTickets: ["DEP-1891"] },
  { id: "D-009", date: "2026-06-30", title: "Retrieval adapter starts with resources + support", rationale: "Public data, no auth blockers; unblocks Rain immediately.", decidedBy: "Rain / Steven", ws: "WS2", relatedTickets: ["DEP-1895"] },
  { id: "D-008", date: "2026-06-28", title: "MyVA S2 iteration approved", rationale: "Kevin feedback consolidated; Daman to run detail pass in S3.", decidedBy: "Kevin Hoffman / Daman", ws: "WS3", relatedMeeting: "WS3 MyVA feedback" },
];

// Activity feed — derived events (seeded here; would be generated from CRUD in production)
export type ActivityKind =
  | "ticket_created"
  | "ticket_status"
  | "blocker_opened"
  | "blocker_closed"
  | "decision"
  | "meeting"
  | "risk_opened"
  | "risk_resolved";

export interface ActivityEvent {
  ts: string; // YYYY-MM-DD
  kind: ActivityKind;
  title: string;
  detail?: string;
  ws?: WorkstreamKey;
  actor?: string;
}

export const ACTIVITY: ActivityEvent[] = [
  { ts: "2026-07-07", kind: "meeting", title: "WS2 tech alignment — orchestrator placement", ws: "WS2", actor: "Steven / Rain" },
  { ts: "2026-07-07", kind: "risk_opened", title: "R-010 · Typography readability test pending", ws: "WS3", actor: "Daman" },
  { ts: "2026-07-06", kind: "ticket_created", title: "DEP-1903 · Design sticker sheet", ws: "WS3", actor: "Daman" },
  { ts: "2026-07-06", kind: "ticket_created", title: "DEP-1900 · Unified tracker scope", ws: "WS4", actor: "Unassigned" },
  { ts: "2026-07-06", kind: "decision", title: "D-012 · Sprint 3 scope locked", ws: "Admin", actor: "Vivian / Luke" },
  { ts: "2026-07-05", kind: "blocker_opened", title: "GitHub + vets-website access", ws: "WS1", actor: "Kaizen" },
  { ts: "2026-07-04", kind: "decision", title: "D-011 · USWDS typography stack adopted", ws: "WS3", actor: "Daman / Matt" },
  { ts: "2026-07-04", kind: "ticket_status", title: "DEP-1896 · Font decision → In Review", ws: "WS3", actor: "Daman" },
  { ts: "2026-07-03", kind: "meeting", title: "WS3 MyVA feedback", ws: "WS3", actor: "Kevin / Daman" },
  { ts: "2026-07-02", kind: "decision", title: "D-010 · SNS fallback if Kafka not ready by 11/11", ws: "WS1", actor: "Brad / Paul Short" },
  { ts: "2026-07-02", kind: "meeting", title: "WS4 SNS structure kickoff", ws: "WS4", actor: "Brad / Paul Short" },
  { ts: "2026-07-01", kind: "risk_opened", title: "R-007 · MyVA review invite not sent", ws: "WS3", actor: "Michael Salib" },
  { ts: "2026-06-30", kind: "risk_resolved", title: "R-011 · Branching strategy confirmed", ws: "WS1", actor: "Lindsey" },
  { ts: "2026-06-30", kind: "decision", title: "D-009 · Retrieval adapter starts with resources + support", ws: "WS2", actor: "Rain / Steven" },
  { ts: "2026-06-28", kind: "decision", title: "D-008 · MyVA S2 iteration approved", ws: "WS3", actor: "Kevin / Daman" },
];

// Project lifecycle plan — big blocks from VA Implementation Plan (6/8 – 11/11)
// October = full deliverable to VA (PRR complete, code frozen, UAT2 wrap)
// November 11 = production launch, contract close
export type PhaseStatus = "complete" | "in_progress" | "upcoming";

export interface LifecycleBlock {
  ws: WorkstreamKey;
  title: string;
  detail: string;
  status: PhaseStatus;
}

export interface LifecyclePhase {
  id: string;
  name: string;
  window: string;
  sprints: string;
  status: PhaseStatus;
  goal: string;
  exitCriteria: string[];
  blocks: LifecycleBlock[];
  gates: string[];
  milestone?: string;
}

export const LIFECYCLE: LifecyclePhase[] = [
  {
    id: "P1",
    name: "Phase 1 · Discovery & Requirements",
    window: "Jun 8 – Jul 3, 2026",
    sprints: "S1–S2",
    status: "complete",
    goal: "Lock scope across all five workstreams; establish contract-level dependency and reporting cadence.",
    exitCriteria: [
      "All WS charters signed off by Kaizen + GovCIO + VA",
      "Baseline backlog seeded in Linear (DEP-*)",
      "USWDS design system parity confirmed",
      "Sprint cadence + Notion/Granola/Linear feeds live",
    ],
    blocks: [
      { ws: "WS1", title: "Reporting API + Claim Status requirements", detail: "MMS Document Events + Claim Status Links scoped; SNS fallback socialized with Bill.", status: "complete" },
      { ws: "WS2", title: "CLEAR + Long-Lived Tokens discovery", detail: "Auth surface mapped; magic-link discovery kicked off.", status: "complete" },
      { ws: "WS3", title: "MyVA + unauth homepage research", detail: "Top-tasks research complete; Kevin feedback consolidated.", status: "complete" },
      { ws: "WS4", title: "QuickSubmit / VLM / VR&E scope", detail: "36 eForms enumerated; SSO discovery closed.", status: "complete" },
      { ws: "WS5", title: "Health Chat + PEP intake with OCC", detail: "Initial OCC contact established; discovery stories drafted.", status: "in_progress" },
    ],
    gates: ["Contract 36C10G24D0048 CLIN 0001 kickoff", "S2 planning sign-off"],
  },
  {
    id: "P2",
    name: "Phase 2 · Foundations & Architecture",
    window: "Jul 6 – Jul 31, 2026",
    sprints: "S3–S4",
    status: "in_progress",
    goal: "Approve architecture intents, unblock repo + platform access, finalize magic-link + SNS specs so build can start on schedule.",
    exitCriteria: [
      "Architecture intent ticket approved (AWS vs VETS API resolved)",
      "vets-website GitHub access + branching strategy live for Kaizen",
      "Magic link requirements locked (Jul 10)",
      "SNS payload docs + data dictionary published",
      "MyVA + unauth homepage prototypes reviewed with Kevin",
    ],
    blocks: [
      { ws: "WS1", title: "Magic link reqs + SNS payload docs", detail: "Brad locks reqs Jul 10; SNS docs shared this sprint. Unblocks WS3 notification template.", status: "in_progress" },
      { ws: "WS2", title: "Orchestrator arch intent approved", detail: "AWS vs VETS API decision pending Kevin sign-off — gates all S4 search build.", status: "in_progress" },
      { ws: "WS3", title: "Unauth homepage + MyVA detail pass", detail: "Daman iterating; typography stack (USWDS Source Sans 3 + Bitter) confirmed.", status: "in_progress" },
      { ws: "WS4", title: "Unified tracker scope + QuickSubmit UI", detail: "DEP-1900 owner + UI location (MyVA / ARP / VA.gov) must resolve.", status: "in_progress" },
      { ws: "WS5", title: "VA stakeholder alignment on health chat", detail: "Location + WS1 API feasibility unblock discovery build.", status: "in_progress" },
    ],
    gates: ["Arch intent approval", "Jul 10 magic-link reqs freeze", "GitHub / vets-website access granted"],
  },
  {
    id: "P3",
    name: "Phase 3 · Build-Out & Integration",
    window: "Aug 3 – Aug 28, 2026",
    sprints: "S5–S6",
    status: "upcoming",
    goal: "Ship code-complete increments for every workstream; wire cross-site integration; land QuickSubmit + VLM SSO releases.",
    exitCriteria: [
      "CLEAR integration passes unit test",
      "Magic-link login flow end-to-end in dev",
      "MyVA + unauth homepage feature-complete in staging",
      "QuickSubmit SSO + VLM SSO released to production window",
      "Chromatic regression suite green on all fronts",
    ],
    blocks: [
      { ws: "WS1", title: "QuickSubmit + VST Document Workflows", detail: "Reporting API dev increments; all MMS events publishing to EEB.", status: "upcoming" },
      { ws: "WS2", title: "CLEAR + Long-Lived Tokens dev", detail: "Retrieval adapter full build; feature-flag + rollback wired.", status: "upcoming" },
      { ws: "WS3", title: "MyVA, unauth homepage, Intelligent Search dev", detail: "UI refresh of design system in flight; sticker sheet applied.", status: "upcoming" },
      { ws: "WS4", title: "QuickSubmit + VLM SSO release; tracker build", detail: "Pizza-tracker UI; CrossSite integration via rev-proxy / SubD.", status: "upcoming" },
      { ws: "WS5", title: "Health Chat + PEP TRR / integration with VA.gov", detail: "Identity + technical enablement wired.", status: "upcoming" },
    ],
    gates: ["S5 planning", "SSO release windows (WS4)", "Chromatic prereqs cleared"],
  },
  {
    id: "P4",
    name: "Phase 4 · TRR & System Integration Test",
    window: "Aug 31 – Sep 25, 2026",
    sprints: "S7–S8",
    status: "upcoming",
    goal: "Test Readiness Review across all workstreams; complete integration testing; enter UAT 1.",
    exitCriteria: [
      "TRR sign-off for Claim Status, CLEAR, UI Refresh, Unauth Homepage, MyVA, Intelligent Search",
      "Integration test suite green across WS1–WS5",
      "UAT 1 entrance criteria met (all P1 defects closed)",
      "Accessibility (Martha Wilkes) sign-off on modernized surfaces",
    ],
    blocks: [
      { ws: "WS1", title: "Claim Status TRR", detail: "Notification path validated end-to-end.", status: "upcoming" },
      { ws: "WS2", title: "CLEAR TRR + Long-Lived Tokens TRR", detail: "Orchestrator + token lifecycle tested.", status: "upcoming" },
      { ws: "WS3", title: "UI Refresh, MyVA, Unauth Homepage, Search TRR", detail: "Integration test with VA.gov; sticker sheet locked.", status: "upcoming" },
      { ws: "WS4", title: "CrossSite integration validation", detail: "Rev-proxy / SubD path validated pre-10/18 deploy.", status: "upcoming" },
      { ws: "WS5", title: "Health Chat + PEP UAT entry", detail: "Identity UAT starts; OCC hand-off confirmed.", status: "upcoming" },
    ],
    gates: ["TRR approval per workstream", "UAT 1 entrance gate"],
  },
  {
    id: "P5",
    name: "Phase 5 · UAT & Production Readiness — October deliverable",
    window: "Sep 28 – Oct 23, 2026",
    sprints: "S9–S10",
    status: "upcoming",
    goal: "Complete UAT 1 → UAT 2, PRR sign-off, ORR entry. This is the full deliverable to VA — code freeze end of October.",
    milestone: "★ Full deliverable to VA — end of October",
    exitCriteria: [
      "UAT 1 + UAT 2 complete with all P1/P2 defects closed",
      "PRR sign-off for CLEAR, Reporting API, Claim Status, UI Refresh, MyVA, Unauth Homepage, Intelligent Search",
      "ORR checkout complete for WS1 + WS2 releases",
      "CrossSite VA.gov deploy 10/18 successful",
      "Code freeze; only defect fixes into S11",
    ],
    blocks: [
      { ws: "WS1", title: "Claim Status + Reporting API PRR / Checkout", detail: "Production checkout windows: mid-October.", status: "upcoming" },
      { ws: "WS2", title: "CLEAR PRR UAT 1 / ORR UAT 2", detail: "Long-Lived Tokens TRR/UAT wraps.", status: "upcoming" },
      { ws: "WS3", title: "UI Refresh + MyVA + Unauth + Search UAT", detail: "All four surfaces in UAT concurrently.", status: "upcoming" },
      { ws: "WS4", title: "CrossSite VA.gov deploy 10/18", detail: "Hard external date — QuickSubmit + VLM live on VA.gov.", status: "upcoming" },
      { ws: "WS5", title: "Health Chat + PEP + Identity UAT wrap", detail: "OCC-owned handoff complete.", status: "upcoming" },
    ],
    gates: ["PRR sign-off (all WS)", "ORR entry", "10/18 VA.gov deploy", "Code freeze end October"],
  },
  {
    id: "P6",
    name: "Phase 6 · ORR, Prod Checkout & Launch",
    window: "Oct 26 – Nov 11, 2026",
    sprints: "S11",
    status: "upcoming",
    goal: "Production checkout, ORR completion, launch, and contract close by the Nov 11 hard deadline.",
    milestone: "★ Production launch — November 11, 2026 (contract deadline)",
    exitCriteria: [
      "ORR complete across all workstreams",
      "36 eForms prod checkout / ops handoff done",
      "Production launch signed off by VA (Michael Young)",
      "Contract 36C10G24D0048 deliverables closed; final invoice to ap@govcio.com",
      "Post-launch monitoring + hypercare handoff to GovCIO ops",
    ],
    blocks: [
      { ws: "WS1", title: "Final Reporting API + Claim Status ops handoff", detail: "SNS pipeline monitored; runbooks published.", status: "upcoming" },
      { ws: "WS2", title: "Auth surface hypercare", detail: "Magic-link + CLEAR on-call rotation established.", status: "upcoming" },
      { ws: "WS3", title: "MyVA + Unauth homepage launch", detail: "Public cutover; Chromatic regression on live.", status: "upcoming" },
      { ws: "WS4", title: "36 eForms prod checkout / OPS", detail: "Final eForm increments to production.", status: "upcoming" },
      { ws: "WS5", title: "Health Chat + PEP go-live", detail: "OCC-owned launch with VA.gov entry points live.", status: "upcoming" },
    ],
    gates: ["ORR approval", "VA launch sign-off", "Contract close / final invoice"],
  },
];
