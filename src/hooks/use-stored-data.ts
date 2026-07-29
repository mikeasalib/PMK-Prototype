import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { classifyWorkstream, type ProgramConfig } from "@/lib/program.config";
import {
  getStoredData,
  type StoredLinearIssue,
  type StoredNotionPage,
  type StoredGranolaNote,
} from "@/lib/sync.functions";

export type { StoredLinearIssue, StoredNotionPage, StoredGranolaNote };

export function useStoredData(programId: string) {
  const fn = useServerFn(getStoredData);
  const { data, isLoading } = useQuery({
    // Keyed by program: without this, switching engagements served the previous
    // program's cached rows until the query went stale.
    queryKey: ["stored-data", programId],
    queryFn: () => fn({ data: programId }),
    staleTime: 30_000,
  });
  return {
    isLoading,
    linear: data?.linear ?? [],
    notion: data?.notion ?? [],
    granola: data?.granola ?? [],
    origin: data?.origin ?? "empty",
    capturedAt: data?.capturedAt ?? null,
    capturedFrom: data?.capturedFrom ?? null,
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

export function inferWorkstream(issue: StoredLinearIssue, program: ProgramConfig): string {
  return classifyWorkstream(issue.title, issue.workstream, program);
}
