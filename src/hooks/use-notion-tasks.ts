import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getNotionTasks, type NotionTaskRow } from "@/lib/sync.functions";

export type { NotionTaskRow };

/**
 * The program's hand-maintained Notion checkbox tasks.
 *
 * Kept separate from useStoredData because the two sources fail independently:
 * Linear can be live while the tracker page is unshared with the integration,
 * and vice versa. A single combined hook would have made one failure look like
 * the other.
 */
export function useNotionTasks(programId: string) {
  const fn = useServerFn(getNotionTasks);
  const { data, isLoading } = useQuery({
    queryKey: ["notion-tasks", programId],
    queryFn: () => fn({ data: programId }),
    staleTime: 60_000,
  });

  const tasks = data?.tasks ?? [];
  const open = tasks.filter((t) => !t.checked);
  const done = tasks.filter((t) => t.checked);

  return {
    isLoading,
    tasks,
    open,
    done,
    readAt: data?.readAt ?? null,
    status: data?.status ?? "read-failed",
    /** Grouped by section, sections in first-seen order — the order they appear
     *  on the tracker page, which is the order the author chose. */
    bySection: groupBySection(tasks),
  };
}

export function groupBySection(
  tasks: NotionTaskRow[],
): Array<{ section: string; open: NotionTaskRow[]; done: NotionTaskRow[] }> {
  const order: string[] = [];
  const map = new Map<string, NotionTaskRow[]>();
  for (const t of tasks) {
    const key = t.section ?? "Ungrouped";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(t);
  }
  return order.map((section) => {
    const all = map.get(section)!;
    return {
      section,
      open: all.filter((t) => !t.checked),
      done: all.filter((t) => t.checked),
    };
  });
}
