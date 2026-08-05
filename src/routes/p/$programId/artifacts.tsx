import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, FileSpreadsheet, FileType, Download, Loader2 } from "lucide-react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { PROGRAMS, pageTitle } from "@/lib/program.config";
import { useProgram } from "./route";
import {
  ARTIFACTS,
  generateArtifact,
  type ArtifactKind,
  type GeneratedArtifact,
} from "@/lib/artifacts.functions";

export const Route = createFileRoute("/p/$programId/artifacts")({
  head: ({ params }) => ({
    meta: [
      { title: pageTitle("Artifacts", PROGRAMS[params.programId]) },
      {
        name: "description",
        content:
          "Generate the weekly rollup, project plan, and POA&M from the current program model.",
      },
    ],
  }),
  component: Artifacts,
});

const ICON: Record<ArtifactKind, typeof FileText> = {
  rollup: FileText,
  "sprint-rollup": FileText,
  "project-plan": FileType,
  poam: FileSpreadsheet,
};

/** Turn the base64 payload into a file the browser saves. */
function download(a: GeneratedArtifact) {
  const bin = atob(a.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: a.mime }));
  const el = document.createElement("a");
  el.href = url;
  el.download = a.filename;
  el.click();
  URL.revokeObjectURL(url);
}

function Artifacts() {
  const program = useProgram();
  const run = useServerFn(generateArtifact);
  const [busy, setBusy] = useState<ArtifactKind | null>(null);
  const [last, setLast] = useState<Record<string, GeneratedArtifact>>({});

  async function generate(kind: ArtifactKind) {
    setBusy(kind);
    try {
      const out = await run({ data: { kind, programId: program.id } });
      setLast((p) => ({ ...p, [kind]: out }));
      download(out);
      toast.success(`${out.filename} generated`);
    } catch (e) {
      toast.error(`Could not generate: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppLayout>
      <PageHeader
        title="Artifacts"
        subtitle={`Formal documents generated from the ${program.domainLabel} program model. Every one is a draft to review, not a finished deliverable.`}
      />

      <div className="px-6 pb-10 pt-2">
        <div
          className="mb-5 rounded-md p-3 text-[12px]"
          style={{ backgroundColor: "#f7f7f5", border: "1px solid #e5e5e2", color: "#565c65" }}
        >
          Facts are read from Linear, Notion, and Granola at generation time and never stored here.
          Anything without a wired source is marked in the output as a gap rather than left blank,
          so a reader can tell the difference between <em>zero</em> and <em>unknown</em>.
        </div>

        <div className="space-y-3">
          {ARTIFACTS.map((a) => {
            const Icon = ICON[a.kind];
            const done = last[a.kind];
            const isBusy = busy === a.kind;
            return (
              <div
                key={a.kind}
                className="rounded-lg bg-white p-4"
                style={{
                  border: "1px solid #e5e7e4",
                  boxShadow: "0 1px 1px rgba(17,47,78,0.04), 0 2px 6px -2px rgba(17,47,78,0.08)",
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded"
                      style={{ backgroundColor: "#1f3d2b14", color: program.navColor }}
                    >
                      <Icon size={18} strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold">{a.title}</div>
                      <p className="mt-0.5 text-[12.5px]" style={{ color: "#565c65" }}>
                        {a.description}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => generate(a.kind)}
                    disabled={isBusy}
                    className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-[13px] font-medium text-white transition-opacity disabled:opacity-60"
                    style={{ backgroundColor: program.navColor }}
                  >
                    {isBusy ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Download size={15} />
                    )}
                    {isBusy ? "Generating…" : "Generate"}
                  </button>
                </div>

                {done ? (
                  <div
                    className="mt-3 space-y-1 rounded p-2.5 text-[11.5px]"
                    style={{ backgroundColor: "#f8f8f6", color: "#565c65" }}
                  >
                    <div>
                      <strong>{done.filename}</strong> · assembled {done.assembledAt}
                    </div>
                    <div>
                      {done.sources.map((s) => (
                        <span key={s.key} className="mr-3">
                          <span style={{ color: s.ok ? "#2e8540" : "#b3261e" }}>
                            {s.ok ? "●" : "○"}
                          </span>{" "}
                          {s.key}: {s.message}
                        </span>
                      ))}
                    </div>
                    {done.rowCount !== undefined ? <div>{done.rowCount} rows</div> : null}
                    {done.unsourced.length ? (
                      <div style={{ color: "#8a5a00" }}>
                        Unsourced sections: {done.unsourced.join(", ")}
                      </div>
                    ) : null}
                    {done.emptyColumns?.length ? (
                      <div style={{ color: "#8a5a00" }}>
                        Columns with no source: {done.emptyColumns.join(", ")}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </AppLayout>
  );
}
