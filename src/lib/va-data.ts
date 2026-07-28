// Seed data for the VA program. VA is currently the only program; see program.config.ts.

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
