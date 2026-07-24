import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getStoredData, type StoredLinearIssue, type StoredNotionPage, type StoredGranolaNote } from "@/lib/sync.functions";

export type { StoredLinearIssue, StoredNotionPage, StoredGranolaNote };

export function useStoredData() {
  const fn = useServerFn(getStoredData);
  const { data, isLoading } = useQuery({
    queryKey: ["stored-data"],
    queryFn: () => fn(),
    staleTime: 30_000,
  });
  return {
    isLoading,
    linear: data?.linear ?? [],
    notion: data?.notion ?? [],
    granola: data?.granola ?? [],
  };
}

// -------- Linear helpers --------

export type LinearBucket = "backlog" | "todo" | "in_progress" | "done" | "canceled";

export function bucketOf(issue: StoredLinearIssue): LinearBucket {
  const t = (issue.state_type ?? "").toLowerCase();
  if (t === "completed") return "done";
  if (t === "canceled") return "canceled";
  if (t === "started") return "in_progress";
  if (t === "unstarted") return "todo";
  return "backlog";
}

export function priorityLabel(p: number | null): string {
  switch (p) {
    case 1: return "Urgent";
    case 2: return "High";
    case 3: return "Medium";
    case 4: return "Low";
    default: return "None";
  }
}

export function priorityColor(p: number | null): string {
  switch (p) {
    case 1: return "#b3261e";
    case 2: return "#8a5a00";
    case 3: return "#1a6fa8";
    case 4: return "#565c65";
    default: return "#888";
  }
}

export function inferWorkstream(issue: StoredLinearIssue): string {
  if (issue.workstream) return issue.workstream;
  const t = issue.title.toUpperCase();
  const m = t.match(/\bWS([1-5])\b/);
  if (m) return `WS${m[1]}`;
  // heuristics based on domain keywords
  if (/MYVA|HOMEPAGE|PROTOTYPE|DESIGN|TYPOGRAPHY|FONT/.test(t)) return "WS3";
  if (/QUICKSUBMIT|VR&E|VLM|TRACKER|SNS/.test(t)) return "WS4";
  if (/HEALTH CHAT|PEP|WS5/.test(t)) return "WS5";
  if (/AUTH|LOGIN|MAGIC LINK|IDENTITY|SEARCH/.test(t)) return "WS2";
  if (/API|ARCHITECTURE|FEATURE FLAG|GITHUB|BRANCH/.test(t)) return "WS1";
  return "Admin";
}
