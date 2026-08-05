// Client-safe server-function wrappers for artifact generation.
//
// Bytes cross the boundary base64-encoded so the payload survives JSON
// serialization; the browser turns it back into a Blob to download. Nothing is
// written anywhere on the server, and nothing is published — generating a draft
// and sending it are separate acts, and the second one is the user's to take.

import { createServerFn } from "@tanstack/react-start";

export type ArtifactKind = "rollup" | "sprint-rollup" | "project-plan" | "poam";

export interface ArtifactMeta {
  kind: ArtifactKind;
  title: string;
  description: string;
  filename: string;
  mime: string;
}

export const ARTIFACTS: ArtifactMeta[] = [
  {
    kind: "rollup",
    title: "Weekly status rollup",
    description:
      "Where the program stands, what gates are coming, and the open risk register. Markdown, for pasting into Notion or an email.",
    filename: "weekly-rollup.md",
    mime: "text/markdown",
  },
  {
    kind: "sprint-rollup",
    title: "Sprint status rollup",
    description:
      "Task-oriented, checkbox-driven view of the current sprint (or phase). Grouped by workstream, includes a waiting-on-external table and an in-flight watch list. Markdown, drops cleanly into Notion.",
    filename: "sprint-rollup.md",
    mime: "text/markdown",
  },
  {
    kind: "project-plan",
    title: "Project plan",
    description:
      "Lifecycle phases with their Definition of Done and stage gates, the milestone schedule, workstream owners, and gate readiness.",
    filename: "project-plan.docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  {
    kind: "poam",
    title: "POA&M",
    description:
      "The risk register on the 26 FedRAMP columns. Columns with no source are marked, never inferred.",
    filename: "poam.xlsx",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  },
];

export interface GeneratedArtifact {
  kind: ArtifactKind;
  filename: string;
  mime: string;
  /** base64-encoded file bytes. */
  data: string;
  /** Assembly notes worth showing next to the download. */
  assembledAt: string;
  freshestSourceAt: string | null;
  unsourced: string[];
  sources: Array<{ key: string; ok: boolean; message: string }>;
  /** POA&M only: required columns that came out wholly unsourced. */
  emptyColumns?: string[];
  rowCount?: number;
}

export interface GenerateArtifactInput {
  kind: ArtifactKind;
  programId: string;
}

export const generateArtifact = createServerFn({ method: "POST" })
  .inputValidator((input: GenerateArtifactInput) => input)
  .handler(async ({ data }): Promise<GeneratedArtifact> => {
    const { kind, programId } = data;
    const { assembleProgramModel } = await import("./program-model.server");
    const { model, gates, sources } = await assembleProgramModel(programId);

    const meta = ARTIFACTS.find((a) => a.kind === kind);
    if (!meta) throw new Error(`unknown artifact: ${kind}`);

    const asOf = new Date().toISOString().slice(0, 10);
    const stamped = meta.filename.replace(/(\.[^.]+)$/, `-${asOf}$1`);

    const base: Omit<GeneratedArtifact, "data"> = {
      kind,
      filename: stamped,
      mime: meta.mime,
      assembledAt: model.meta.assembledAt,
      freshestSourceAt: model.meta.freshestSourceAt,
      unsourced: model.meta.unsourced,
      sources,
    };

    if (kind === "rollup") {
      const { renderWeeklyRollup } = await import("./artifacts/weekly-rollup");
      const md = renderWeeklyRollup(model, { asOf, gates });
      return { ...base, data: Buffer.from(md, "utf8").toString("base64") };
    }

    if (kind === "sprint-rollup") {
      const { renderSprintRollup } = await import("./artifacts/sprint-rollup");
      const { programById } = await import("./program.config");
      const md = renderSprintRollup(model, { asOf, program: programById(programId) });
      return { ...base, data: Buffer.from(md, "utf8").toString("base64") };
    }

    if (kind === "project-plan") {
      const { renderProjectPlan } = await import("./artifacts/project-plan");
      const bytes = renderProjectPlan(model, { asOf, gates, revision: "Draft" });
      return { ...base, data: Buffer.from(bytes).toString("base64") };
    }

    const { renderPoam } = await import("./artifacts/poam");
    const out = renderPoam(model, { asOf });
    return {
      ...base,
      data: Buffer.from(out.bytes).toString("base64"),
      emptyColumns: out.emptyColumns,
      rowCount: out.rowCount,
    };
  });
