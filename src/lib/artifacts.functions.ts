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
      "Where the program stands, the gates coming up, and every open risk. Markdown, so it pastes straight into Notion or an email.",
    filename: "weekly-rollup.md",
    mime: "text/markdown",
  },
  {
    kind: "sprint-rollup",
    title: "Sprint status rollup",
    description:
      "The current sprint as checkboxes, grouped by workstream, with a table of what you are waiting on from outside and a watch list of what is in flight. Markdown, drops cleanly into Notion.",
    filename: "sprint-rollup.md",
    mime: "text/markdown",
  },
  {
    kind: "project-plan",
    title: "Project plan",
    description:
      "Every lifecycle phase with its Definition of Done and stage gates, plus the milestone schedule and who owns each workstream.",
    filename: "project-plan.docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  {
    kind: "poam",
    title: "POA&M",
    description:
      "The risk register mapped onto the 26 FedRAMP columns. A column with no source says so, and nothing is inferred to fill it.",
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
      const { readNotionTasks } = await import("./sources.direct.server");
      const { sourcesFor } = await import("./program.sources.server");
      // Undefined when the program keeps no tracker, so the renderer omits the
      // section entirely rather than printing an empty one that would imply a
      // page exists and is clear.
      const hasTracker = Boolean(sourcesFor(programId).notion?.taskTrackerPageId);
      const tracker = hasTracker ? await readNotionTasks(programId) : null;
      const md = renderSprintRollup(model, {
        asOf,
        program: programById(programId),
        trackerTasks: hasTracker ? (tracker?.rows ?? []) : undefined,
      });
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

/**
 * What the sources look like before you generate anything.
 *
 * Provenance used to appear only after a document had already been written and
 * downloaded — you learned it had three unsourced sections once it was in your
 * Downloads folder, which is the wrong order for something that goes to a
 * customer. This is the same assembly, reported rather than rendered: no bytes
 * are produced and nothing is written.
 */
export interface SourceReadiness {
  asOf: string;
  sources: Array<{ key: string; ok: boolean; message: string }>;
  /** Sections the model knows it has no source for. */
  unsourced: string[];
  freshestSourceAt: string | null;
  counts: { workItems: number; risks: number; milestones: number; phases: number };
  /** Which artifacts this program declares itself able to produce. */
  applicable: ArtifactKind[];
}

export const getSourceReadiness = createServerFn({ method: "GET" })
  .inputValidator((programId: string) => programId)
  .handler(async ({ data: programId }): Promise<SourceReadiness> => {
    const { assembleProgramModel } = await import("./program-model.server");
    const { programById } = await import("./program.config");
    const { model, sources } = await assembleProgramModel(programId);
    const program = programById(programId);
    return {
      asOf: new Date().toISOString().slice(0, 10),
      sources,
      unsourced: model.meta.unsourced,
      freshestSourceAt: model.meta.freshestSourceAt,
      counts: {
        workItems: model.workItems.length,
        risks: model.risks.length,
        milestones: model.milestones.length,
        phases: model.phases.length,
      },
      applicable: program.artifacts as ArtifactKind[],
    };
  });

/**
 * Generate without downloading, for preview.
 *
 * Markdown artifacts return their text so the page can show the actual document
 * before it lands on disk. Binary ones (.docx, .xlsx) return null text — there
 * is no honest way to render OOXML inline, and faking a preview of a document
 * you cannot actually display would be worse than saying so.
 */
export interface ArtifactPreview {
  artifact: GeneratedArtifact;
  /** Decoded document text, or null when the format is binary. */
  text: string | null;
}

export const previewArtifact = createServerFn({ method: "POST" })
  .inputValidator((input: GenerateArtifactInput) => input)
  .handler(async ({ data }): Promise<ArtifactPreview> => {
    const artifact = await generateArtifact({ data });
    const isText = artifact.mime === "text/markdown";
    return {
      artifact,
      text: isText ? Buffer.from(artifact.data, "base64").toString("utf8") : null,
    };
  });
