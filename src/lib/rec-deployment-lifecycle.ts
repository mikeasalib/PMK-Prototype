// Canonical recreation-deployment lifecycle, from the Rec Deployment Playbook
// (Notion: 33e68467-f30f-804a-8c56-e47846d0a36d, updated 6/8/26).
//
// Rec deployments don't run on sprints. They run on ten phases with target
// durations: Pre-Sale → Sales Handoff → Discovery → Alignment → Configuration →
// Training → Production Setup → Pre-Launch → Launch → Live Customer Handoff.
// The playbook writes each phase's exit criteria and stage gates in plain
// English; those are transcribed here so gate readiness reads what the source
// says rather than a heuristic. Update this file when the playbook updates.
//
// Dates: the playbook gives target durations, not absolute dates. Individual
// deployments back-calculate from their launch date, with the caveat that
// actual timings almost always exceed the targets. Kickoff duration is
// therefore approximate; Launch onward is anchored to the real go-live date.

import type { LifecyclePhase } from "./va-data";

/**
 * Turn a rec deployment's launch date into the canonical phase schedule,
 * working backwards for pre-launch phases and forwards for post-launch. The
 * only truly grounded dates are Launch and after; everything earlier is a
 * back-calculation from the playbook's target durations.
 *
 * Pre-Sale is intentionally not included — it happens before we assign a
 * strategist and there is nothing on the board to track it against.
 *
 * `now` decides which phase is currently in progress. The phase state itself is
 * still derived from `startsOn`/`endsOn` by phasesFromLifecycle, so callers
 * don't need to pass a status here.
 */
export function recDeploymentPhases(launchIso: string): LifecyclePhase[] {
  const launch = new Date(`${launchIso}T00:00:00Z`);
  const day = 86400000;
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  const shift = (from: Date, days: number) => new Date(from.getTime() + days * day);

  // Playbook target durations, in weeks. See the "Implementation Phases" table.
  const D = {
    salesHandoff: 1,
    discovery: 2,
    alignment: 2,
    configuration: 4,
    training: 2,
    productionSetup: 2,
    preLaunch: 2,
    launch: 2,
  };
  const w = (n: number) => n * 7;

  const launchEnd = shift(launch, w(D.launch) - 1);
  const preLaunchEnd = shift(launch, -1);
  const preLaunchStart = shift(preLaunchEnd, -(w(D.preLaunch) - 1));
  const prodEnd = shift(preLaunchStart, -1);
  const prodStart = shift(prodEnd, -(w(D.productionSetup) - 1));
  const trainingEnd = shift(prodStart, -1);
  const trainingStart = shift(trainingEnd, -(w(D.training) - 1));
  const configEnd = shift(trainingStart, -1);
  const configStart = shift(configEnd, -(w(D.configuration) - 1));
  const alignEnd = shift(configStart, -1);
  const alignStart = shift(alignEnd, -(w(D.alignment) - 1));
  const discEnd = shift(alignStart, -1);
  const discStart = shift(discEnd, -(w(D.discovery) - 1));
  const handoffEnd = shift(discStart, -1);
  const handoffStart = shift(handoffEnd, -(w(D.salesHandoff) - 1));

  // Live Customer Handoff has no fixed end — steady state. Give it a generous
  // horizon (90 days after launch) so state derivation works; the account moves
  // to Customer Success ownership sometime within that window per the playbook.
  const liveStart = shift(launchEnd, 1);
  const liveEnd = shift(liveStart, 90);

  const phases: LifecyclePhase[] = [
    {
      id: "P1",
      name: "Sales Handoff",
      startsOn: toIso(handoffStart),
      endsOn: toIso(handoffEnd),
      window: window(handoffStart, handoffEnd),
      sprints: "Wk 1",
      status: "complete",
      goal: "BD → Deployment context share; assign strategist, spin up implementation tools, complete internal information gathering, schedule kickoff.",
      exitCriteria: [
        "Handoff meeting completed and context shared",
        "Implementation tools set up (internal Notion + Linear + external Drive)",
        "All information from contract and sales process ingested",
        "Kickoff is scheduled",
      ],
      blocks: [],
      gates: ["Deployment strategist assigned", "Customer added to domain + health trackers"],
    },
    {
      id: "P2",
      name: "Discovery",
      startsOn: toIso(discStart),
      endsOn: toIso(discEnd),
      window: window(discStart, discEnd),
      sprints: "Wk 2–3",
      status: "complete",
      goal: "Kickoff, then external information intake — surface misunderstandings, identify blockers, prepare for sandbox creation.",
      exitCriteria: [
        "Kickoff meeting completed",
        "Implementation hub shared with customer",
        "Information gathering complete",
      ],
      blocks: [],
      gates: ["Customer lead + IT + Finance identified", "Discovery questions answered by module"],
    },
    {
      id: "P3",
      name: "Alignment",
      startsOn: toIso(alignStart),
      endsOn: toIso(alignEnd),
      window: window(alignStart, alignEnd),
      sprints: "Wk 4–5",
      status: "complete",
      goal: "Identify gaps with engineering, build launch plan, meet Finance and IT, create sandbox.",
      exitCriteria: [
        "Plan aligned with customer lead(s)",
        "Meetings with IT and Finance held",
        "Stripe Express account configured",
        "Sandbox set up",
      ],
      blocks: [],
      gates: ["Gap tickets in customer's Linear project", "Go-live date proposed"],
    },
    {
      id: "P4",
      name: "Configuration",
      startsOn: toIso(configStart),
      endsOn: toIso(configEnd),
      window: window(configStart, configEnd),
      sprints: "Wk 6–9",
      status: "complete",
      goal: "Walkthrough with the full team, then bulk data ingestion across modules — facilities, venues, memberships, POS, day-use, GLs, tax, hardware.",
      exitCriteria: [
        "Configuration data collected and ingested",
        "Hardware ordered",
        "Photography underway",
        "Customer lead(s) confirm site ready for training",
      ],
      blocks: [],
      gates: ["Recursive validation across modules complete", "Data ingested to sandbox"],
    },
    {
      id: "P5",
      name: "Training",
      startsOn: toIso(trainingStart),
      endsOn: toIso(trainingEnd),
      window: window(trainingStart, trainingEnd),
      sprints: "Wk 10–11",
      status: "complete",
      goal: "Train the client team on the platform module by module; give sandbox access; last trickle-in of discovery items.",
      exitCriteria: [
        "Major stakeholders trained and have sandbox accounts",
        "Customer is onboarded to sandbox and able to complete transactions",
        "Self-guided walkthrough shared",
      ],
      blocks: [],
      gates: ["Module trainings held (admins, day-to-day, staff by module)"],
    },
    {
      id: "P6",
      name: "Production Setup",
      startsOn: toIso(prodStart),
      endsOn: toIso(prodEnd),
      window: window(prodStart, prodEnd),
      sprints: "Wk 12–13",
      status: "complete",
      goal: "Build the production site, triage blockers vs. post-launch requests, finalize go-live date, test migrations, turn on payout report.",
      exitCriteria: [
        "Launch blockers identified with plans to resolve",
        "Go-live date confirmed internally and externally",
        "Production site created and configured",
        "Migrations tested with fake users",
        "Payout report turned on",
      ],
      blocks: [],
      gates: [
        "Blocker vs. request triage complete",
        "Payout report enabled (≥2 wks before go-live)",
      ],
    },
    {
      id: "P7",
      name: "Pre-Launch",
      startsOn: toIso(preLaunchStart),
      endsOn: toIso(preLaunchEnd),
      window: window(preLaunchStart, preLaunchEnd),
      sprints: "Wk 14–15",
      status: "complete",
      goal: "Socialize launch plan; confirm technical, financial, operational readiness; run migrations; coordinate launch-day support.",
      exitCriteria: [
        "Internal launch support secured (ENG on-call, DB capacity if needed)",
        "External launch support established (Zoom / on-site)",
        "Customer teams confirm platform readiness",
        "Users have correct permissions",
        "Migrations conducted",
      ],
      blocks: [],
      gates: ["UAT passes", "Migrations complete", "Launch-day roles assigned"],
    },
    {
      id: "P8",
      name: "Launch",
      startsOn: launchIso,
      endsOn: toIso(launchEnd),
      window: window(launch, launchEnd),
      sprints: "Wk 16–17",
      status: "in_progress",
      goal: "Turn on the platform, monitor initial usage, triage issues, decide post-live transition path.",
      exitCriteria: [
        "Transactions flowing through Kaizen",
        "Platform stable and any fires put out",
        "Initial support requests peter off",
      ],
      blocks: [],
      gates: ["First live transactions verified", "Stripe payouts confirmed with Finance"],
      milestone: "Go-live",
    },
    {
      id: "P9",
      name: "Live Customer Handoff",
      startsOn: toIso(liveStart),
      endsOn: toIso(liveEnd),
      window: `${monthDay(liveStart)} onward`,
      sprints: "Post-launch",
      status: "upcoming",
      goal: "Determine transition path (Support vs. Expansion), align internally, host handoff to Customer Success, write after-action report.",
      exitCriteria: [
        "First transactions successfully processed in production",
        "Stripe payouts verified",
        "Customer confirms no critical blockers remain",
        "Feedback collected and categorized",
        "Transition path defined",
        "Customer introduced to Customer Success",
        "Implementation documentation finalized",
      ],
      blocks: [],
      gates: ["Transition decision (Support or Expansion)", "AAR filed within 2 wks of transition"],
    },
  ];
  return phases;
}

function monthDay(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
function window(a: Date, b: Date): string {
  return `${monthDay(a)} – ${monthDay(b)}`;
}
