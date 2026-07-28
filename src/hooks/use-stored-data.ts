import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { classifyWorkstream } from "@/lib/program.config";
import {
  getStoredData,
  type StoredLinearIssue,
  type StoredNotionPage,
  type StoredGranolaNote,
} from "@/lib/sync.functions";

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
    case 1:
      return "Urgent";
    case 2:
      return "High";
    case 3:
      return "Medium";
    case 4:
      return "Low";
    default:
      return "None";
  }
}

export function priorityColor(p: number | null): string {
  switch (p) {
    case 1:
      return "#b3261e";
    case 2:
      return "#8a5a00";
    case 3:
      return "#1a6fa8";
    case 4:
      return "#565c65";
    default:
      return "#888";
  }
}

export function inferWorkstream(issue: StoredLinearIssue): string {
  return classifyWorkstream(issue.title, issue.workstream);
}
