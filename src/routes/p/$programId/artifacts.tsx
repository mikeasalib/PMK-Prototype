import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, FileSpreadsheet, FileType, Download, Loader2, Eye, X } from "lucide-react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { PROGRAMS, pageTitle } from "@/lib/program.config";
import { useProgram } from "./route";
import { useQuery } from "@tanstack/react-query";
import {
  ARTIFACTS,
  previewArtifact,
  getSourceReadiness,
  type ArtifactKind,
  type GeneratedArtifact,
  type ArtifactPreview,
  type SourceReadiness,
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
  // Revoke on the next tick, not synchronously. Some browsers have not yet
  // begun reading the blob when click() returns, and revoking underneath them
  // produced an empty or failed download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Artifacts, with the provenance shown before you commit rather than after.
 *
 * Two things were the wrong way round. Source readiness only appeared once a
 * document had been generated AND written to disk, so you learned it had three
 * unsourced sections after it was in your Downloads folder. And generate()
 * called download() unconditionally, so there was no way to look at a client
 * deliverable before it landed.
 *
 * Now: a readiness panel reads the same assembly up front and says what each
 * source is contributing; Preview is the primary action and shows the actual
 * document; Download is a button inside the preview. Nothing reaches disk
 * without being looked at first.
 */
function Artifacts() {
  const program = useProgram();
  const preview = useServerFn(previewArtifact);
  const readinessFn = useServerFn(getSourceReadiness);
  const [busy, setBusy] = useState<ArtifactKind | null>(null);
  const [open, setOpen] = useState<ArtifactPreview | null>(null);

  const { data: readiness, isLoading: readinessLoading } = useQuery({
    queryKey: ["source-readiness", program.id],
    queryFn: () => readinessFn({ data: program.id }),
    staleTime: 60_000,
  });

  async function show(kind: ArtifactKind) {
    setBusy(kind);
    try {
      const out = await preview({ data: { kind, programId: program.id } });
      setOpen(out);
    } catch (e) {
      toast.error(`Could not generate: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  // Only artifacts this program declares. The page previously offered POA&M on
  // Ventura, whose config omits it — a federal compliance deliverable for a
  // parks deployment.
  const applicable = readiness
    ? ARTIFACTS.filter((a) => readiness.applicable.includes(a.kind))
    : ARTIFACTS;

  return (
    <AppLayout>
      <PageHeader
        title="Artifacts"
        subtitle={`Formal documents generated from the ${program.domainLabel} program model. Every one is a draft to review, not a finished deliverable.`}
      />

      <div className="px-4 pb-10 pt-2 sm:px-6">
        <SourceReadinessPanel readiness={readiness} loading={readinessLoading} />

        <div className="mt-5 space-y-3">
          {applicable.map((a) => {
            const Icon = ICON[a.kind];
            const isBusy = busy === a.kind;
            return (
              <div
                key={a.kind}
                className="rounded-lg bg-white p-4"
                style={{ border: "1px solid #e5e7e4" }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded"
                      style={{ backgroundColor: "#1f3d2b14", color: program.navColor }}
                    >
                      <Icon size={18} strokeWidth={2} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold">{a.title}</div>
                      <p className="mt-0.5 text-xs" style={{ color: "#565c65" }}>
                        {a.description}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => show(a.kind)}
                    disabled={isBusy}
                    className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-[13px] font-medium text-white transition-opacity disabled:opacity-60"
                    style={{ backgroundColor: program.navColor }}
                  >
                    {isBusy ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Eye size={15} />
                    )}
                    {isBusy ? "Generating…" : "Preview"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {open ? <PreviewModal preview={open} onClose={() => setOpen(null)} /> : null}
    </AppLayout>
  );
}

/**
 * What each source is contributing, before anything is generated.
 *
 * Deliberately states counts rather than a green tick: "19 risks" and "0 risks"
 * are both successful reads, and only one of them produces a usable POA&M.
 */
function SourceReadinessPanel({
  readiness,
  loading,
}: {
  readiness: SourceReadiness | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div
        className="rounded-md p-3 text-xs"
        style={{ backgroundColor: "#f7f7f5", border: "1px solid #e5e5e2", color: "#565c65" }}
      >
        Checking what the sources are returning…
      </div>
    );
  }
  if (!readiness) return null;

  const gaps = readiness.unsourced.length;
  return (
    <div
      className="rounded-md p-3 text-xs"
      style={{
        backgroundColor: gaps > 0 ? "#fdf5e6" : "#f7f7f5",
        border: `1px solid ${gaps > 0 ? "#e8dfb8" : "#e5e5e2"}`,
        color: gaps > 0 ? "#7a5a00" : "#565c65",
      }}
    >
      <div className="font-semibold">
        {gaps > 0
          ? `Sources read — ${gaps} section${gaps === 1 ? "" : "s"} will generate as a gap`
          : "Sources read — every section has a source"}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        {readiness.sources.map((s) => (
          <span key={s.key}>
            <span style={{ color: s.ok ? "#2e8540" : "#b3261e" }}>{s.ok ? "●" : "○"}</span>{" "}
            {s.key}: {s.message}
          </span>
        ))}
      </div>
      <div className="mt-1.5">
        {readiness.counts.workItems} work items · {readiness.counts.risks} risks ·{" "}
        {readiness.counts.milestones} milestones · {readiness.counts.phases} phases
        {readiness.freshestSourceAt ? ` · freshest read ${readiness.freshestSourceAt}` : ""}
      </div>
      {gaps > 0 ? (
        <div className="mt-1.5">
          Unsourced: {readiness.unsourced.join(", ")}. These render as an explicit
          gap in the output, never as zero.
        </div>
      ) : null}
    </div>
  );
}

/**
 * The document, before it reaches disk.
 *
 * Markdown renders as text. The OOXML artifacts cannot be displayed inline
 * honestly, so instead of faking a preview they state what was produced and
 * what to check — and the download is right there either way.
 */
function PreviewModal({
  preview,
  onClose,
}: {
  preview: ArtifactPreview;
  onClose: () => void;
}) {
  const { artifact, text } = preview;
  const gaps = artifact.unsourced.length + (artifact.emptyColumns?.length ?? 0);

  return (
    <>
      <button
        type="button"
        aria-label="Close preview"
        onClick={onClose}
        className="fixed inset-0 z-50"
        style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
      />
      <div
        role="dialog"
        aria-label={`Preview ${artifact.filename}`}
        className="fixed left-1/2 top-[6vh] z-50 flex max-h-[88vh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <div
          className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3"
          style={{ borderColor: "#e5e5e2" }}
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{artifact.filename}</div>
            <div className="text-xs" style={{ color: "#565c65" }}>
              Draft — review before sending
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                download(artifact);
                const label =
                  gaps > 0
                    ? `${artifact.filename} downloaded with ${gaps} unsourced section${gaps === 1 ? "" : "s"}`
                    : `${artifact.filename} downloaded`;
                if (gaps > 0) toast.warning(label);
                else toast.success(label);
              }}
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium text-white"
              style={{ backgroundColor: "#1f3d2b" }}
            >
              <Download size={14} />
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded p-1 hover:bg-neutral-100"
              style={{ color: "#565c65" }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {gaps > 0 ? (
          <div
            className="shrink-0 px-4 py-2 text-xs"
            style={{ backgroundColor: "#fdf5e6", color: "#7a5a00" }}
          >
            {artifact.unsourced.length > 0
              ? `Unsourced sections: ${artifact.unsourced.join(", ")}. `
              : ""}
            {artifact.emptyColumns?.length
              ? `Columns with no source: ${artifact.emptyColumns.join(", ")}.`
              : ""}
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto p-4">
          {text !== null ? (
            <pre
              className="whitespace-pre-wrap font-mono text-xs leading-relaxed"
              style={{ color: "#1b1b1b" }}
            >
              {text}
            </pre>
          ) : (
            <div className="text-sm" style={{ color: "#565c65" }}>
              <p>
                This is a binary Office document, so there is no honest way to render
                it here — a mock-up of its contents would be a different document
                from the one you are about to send.
              </p>
              <p className="mt-3">
                Generated {artifact.assembledAt}
                {artifact.rowCount !== undefined ? ` · ${artifact.rowCount} rows` : ""}. Download
                and open it to check.
              </p>
              <div className="mt-3">
                {artifact.sources.map((s) => (
                  <div key={s.key}>
                    <span style={{ color: s.ok ? "#2e8540" : "#b3261e" }}>
                      {s.ok ? "●" : "○"}
                    </span>{" "}
                    {s.key}: {s.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
