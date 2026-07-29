// Deriving a risk register from Linear issues.
//
// Ventura keeps no written register — confirmed by the account owner, the team
// holds it mentally and the board is the working record. So risks are derived
// from labelled or overdue issues rather than parsed from a document.
//
// This is a genuinely different fidelity from VA's Notion table, in both
// directions, and the honest thing is to be explicit about which:
//
//   better  Linear carries a real createdAt and dueDate, so Original Detection
//           Date and Scheduled Completion Date are actual values. VA's table has
//           neither, and those were the two biggest gaps in its POA&M.
//   worse   Linear models no likelihood or impact. Severity has to come from
//           priority, which is a different thing — a priority is what we intend
//           to do about it, not how likely it is to hurt. So likelihood and
//           impact stay null rather than being back-filled from priority.

import type { Likelihood, RiskRecord, RiskSeverity, RiskState, SourceRef } from "./program-model";

export interface LinearIssueForRisk {
  identifier: string;
  title: string;
  description?: string | null;
  statusType: string | null;
  status?: string | null;
  /** Linear: 0 none, 1 urgent, 2 high, 3 medium, 4 low. */
  priority: number | null;
  assignee: string | null;
  labels: string[];
  url: string | null;
  dueDate: string | null;
  createdAt: string | null;
  syncedAt: string;
}

export interface LinearRiskOptions {
  /** Labels that qualify an issue as a register entry. Empty means all issues. */
  labels: string[];
  /** Count an overdue issue regardless of label. */
  includeOverdue: boolean;
  /** YYYY-MM-DD, for the overdue comparison. */
  asOf: string;
}

/**
 * Linear priority -> severity.
 *
 * Deliberately NOT written into likelihood/impact. Priority expresses intent;
 * likelihood x impact expresses exposure. Conflating them would put a number in
 * a compliance column that nobody actually assessed.
 *
 * "No priority" (0) maps to low rather than throwing, because an untriaged issue
 * is common and should still appear — as low, visibly.
 */
export function severityFromPriority(priority: number | null): RiskSeverity {
  switch (priority) {
    case 1:
    case 2:
      return "high";
    case 3:
      return "medium";
    default:
      return "low";
  }
}

export function stateFromStatusType(statusType: string | null): RiskState {
  switch ((statusType ?? "").toLowerCase()) {
    case "completed":
      return "resolved";
    case "canceled":
    case "duplicate":
      return "resolved";
    case "started":
      return "mitigating";
    default:
      return "open";
  }
}

/** Is this issue a register entry under the program's rules? */
export function qualifies(issue: LinearIssueForRisk, opts: LinearRiskOptions): boolean {
  const state = stateFromStatusType(issue.statusType);
  // A closed issue is not an open risk. Resolved entries are kept out here
  // rather than filtered later, so counts of "the register" mean live items.
  if (state === "resolved") return false;
  if (opts.labels.length && issue.labels.some((l) => opts.labels.includes(l))) return true;
  if (opts.includeOverdue && issue.dueDate && issue.dueDate < opts.asOf) return true;
  // With no label filter configured, every open issue counts.
  return opts.labels.length === 0;
}

export interface LinearRegisterResult {
  risks: RiskRecord[];
  /** Why each qualified, so a renderer can explain the register's composition. */
  reasons: Record<string, "label" | "overdue" | "all">;
  /** Issues considered but excluded, for an honest denominator. */
  excluded: number;
}

export function risksFromLinearIssues(
  issues: LinearIssueForRisk[],
  opts: LinearRiskOptions,
): LinearRegisterResult {
  const risks: RiskRecord[] = [];
  const reasons: LinearRegisterResult["reasons"] = {};

  for (const i of issues) {
    if (!qualifies(i, opts)) continue;

    const overdue = !!i.dueDate && i.dueDate < opts.asOf;
    reasons[i.identifier] =
      opts.labels.length && i.labels.some((l) => opts.labels.includes(l))
        ? "label"
        : overdue
          ? "overdue"
          : "all";

    const ref: SourceRef = {
      system: "linear",
      id: i.identifier,
      url: i.url ?? undefined,
      fetchedAt: i.syncedAt,
    };

    risks.push({
      id: i.identifier,
      description: i.title,
      severity: severityFromPriority(i.priority),
      // Linear has no likelihood/impact model. Left null rather than derived
      // from priority — see the note at the top of this file.
      likelihood: null as Likelihood | null,
      impact: null as Likelihood | null,
      // Worth carrying: an overdue item is materially different from one merely
      // labelled, and the label set is the closest thing to a category.
      severityNote: overdue ? `overdue since ${i.dueDate}` : i.labels.join(", ") || null,
      state: stateFromStatusType(i.statusType),
      area: i.labels.length ? i.labels.join(", ") : null,
      workstream: null,
      owner: i.assignee,
      // The issue body is the nearest thing to a remediation plan. Not
      // synthesised — if there is no description, the column stays null.
      mitigation: i.description?.trim() || null,
      // Both real values, which the Notion table could not supply.
      openedAt: i.createdAt ? i.createdAt.slice(0, 10) : null,
      dueAt: i.dueDate,
      control: null,
      assetId: null,
      linkedWorkItems: [i.identifier],
      origin: { kind: "sourced", refs: [ref] },
    });
  }

  return { risks, reasons, excluded: issues.length - risks.length };
}
