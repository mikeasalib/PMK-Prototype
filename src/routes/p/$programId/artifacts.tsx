import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import {
  Button,
  Disclosure,
  KZ,
  Mono,
  NoteBox,
  PanelHead,
  SectionTitle,
  Square,
  Tag,
} from "@/components/kz";
import { PROGRAMS, pageTitle } from "@/lib/program.config";
import {
  ARTIFACTS,
  previewArtifact,
  getSourceReadiness,
  type ArtifactKind,
  type GeneratedArtifact,
  type ArtifactPreview,
  type SourceReadiness,
} from "@/lib/artifacts.functions";
import { useProgram } from "./route";

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

/** The format, from the filename rather than an icon set. */
function formatOf(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "md":
      return "Markdown";
    case "docx":
      return "DOCX";
    case "xlsx":
      return "XLSX";
    default:
      return ext?.toUpperCase() ?? "File";
  }
}

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
  // Revoke on the next tick, not synchronously. Some browsers have not begun
  // reading the blob when click() returns, and revoking underneath them
  // produced an empty download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Artifacts, with the provenance shown before you commit rather than after.
 *
 * Readiness reads the same assembly the document will and says what each source
 * is contributing; Preview is the primary action and shows the real document;
 * Download sits inside the preview. Nothing reaches disk without being looked
 * at first.
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
        eyebrow="Output"
        title="Artifacts"
        subtitle={`Formal documents built from the ${program.domainLabel} program model. Read every one as a draft before it leaves the building.`}
      />

      <div style={{ padding: "28px var(--kz-pad-x) 60px var(--kz-pad-x)" }}>
        <NoteBox>
          Every fact is read from Linear, Notion, and Granola when you generate, and none of it is
          kept here. Where a source is missing, the output says so instead of leaving a blank, so
          you can tell <em>zero</em> from <em>unknown</em>.
        </NoteBox>

        <div style={{ marginTop: 24, maxWidth: 900 }}>
          <ReadinessPanel readiness={readiness} loading={readinessLoading} />
        </div>

        {/* Stacked rows sharing borders, one per artifact. */}
        <div style={{ marginTop: 24, maxWidth: 900 }}>
          {applicable.map((a, idx) => {
            const isBusy = busy === a.kind;
            return (
              <div
                key={a.kind}
                style={{
                  border: `1px solid ${KZ.bone}`,
                  borderTop: idx === 0 ? `1px solid ${KZ.bone}` : "none",
                  padding: "24px 28px",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 24,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                    <SectionTitle size={18}>{a.title}</SectionTitle>
                    <Mono size={10.5}>{formatOf(a.filename)}</Mono>
                  </div>
                  <p
                    style={{
                      margin: "8px 0 0 0",
                      fontSize: 13.5,
                      lineHeight: 1.5,
                      color: KZ.body,
                      maxWidth: "60ch",
                    }}
                  >
                    {a.description}
                  </p>
                  <Disclosure style={{ marginTop: 12 }}>
                    Unsourced sections say so in the output instead of going blank
                  </Disclosure>
                </div>
                <Button
                  onClick={() => show(a.kind)}
                  disabled={isBusy}
                  style={{ padding: "12px 14px", flexShrink: 0 }}
                >
                  {isBusy ? "Generating…" : "Generate"}
                </Button>
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
 * States counts rather than a green tick: "19 risks" and "0 risks" are both
 * successful reads, and only one of them produces a usable POA&M.
 */
function ReadinessPanel({
  readiness,
  loading,
}: {
  readiness: SourceReadiness | undefined;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div style={{ border: `1px solid ${KZ.bone}`, padding: "16px 18px" }}>
        <Mono size={11}>Checking what each source returns…</Mono>
      </div>
    );
  }
  if (!readiness) return null;

  const gaps = readiness.unsourced.length;
  return (
    <div
      style={{
        border: `1px solid ${KZ.bone}`,
        background: gaps > 0 ? KZ.grey050 : KZ.white,
        padding: "20px 24px",
      }}
    >
      <PanelHead
        label="Source readiness"
        right={
          gaps > 0
            ? `${gaps} section${gaps === 1 ? "" : "s"} will generate as a gap`
            : "every section has a source"
        }
        rightTone={gaps > 0 ? KZ.amber : KZ.green}
      />
      <div
        style={{
          marginTop: 14,
          display: "flex",
          flexWrap: "wrap",
          gap: "8px 24px",
        }}
      >
        {readiness.sources.map((s) => (
          <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Square tone={s.ok ? KZ.green : KZ.coral} filled />
            <Mono size={10.5} tone={KZ.ink}>
              {s.key}
            </Mono>
            <Mono size={10.5}>{s.message}</Mono>
          </span>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <Mono size={10.5}>
          {readiness.counts.workItems} work items · {readiness.counts.risks} risks ·{" "}
          {readiness.counts.milestones} milestones · {readiness.counts.phases} phases
          {readiness.freshestSourceAt ? ` · freshest read ${readiness.freshestSourceAt}` : ""}
        </Mono>
      </div>
      {gaps > 0 ? (
        <Disclosure style={{ color: KZ.amber }}>
          Unsourced: {readiness.unsourced.join(", ")}. Each one renders as a gap in the output,
          never as zero
        </Disclosure>
      ) : null}
    </div>
  );
}

/**
 * The document, before it reaches disk.
 *
 * Markdown renders as text. The OOXML artifacts cannot be displayed inline
 * honestly, so rather than faking a preview they state what was produced and
 * what to check — and the download is right there either way.
 */
function PreviewModal({ preview, onClose }: { preview: ArtifactPreview; onClose: () => void }) {
  const { artifact, text } = preview;
  const gaps = artifact.unsourced.length + (artifact.emptyColumns?.length ?? 0);

  return (
    <>
      <button
        type="button"
        aria-label="Close preview"
        onClick={onClose}
        className="fixed inset-0 z-50"
        style={{ background: "rgba(0,0,0,0.35)" }}
      />
      <div
        role="dialog"
        aria-label={`Preview ${artifact.filename}`}
        className="fixed left-1/2 top-[6vh] z-50 flex max-h-[88vh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 flex-col overflow-hidden"
        style={{ background: KZ.white, border: `1px solid ${KZ.ink}` }}
      >
        <div
          className="flex shrink-0 items-center justify-between gap-3"
          style={{ padding: "16px 20px", borderBottom: `1px solid ${KZ.ink}` }}
        >
          <div style={{ minWidth: 0 }}>
            <div className="truncate" style={{ fontSize: 14, fontWeight: 500 }}>
              {artifact.filename}
            </div>
            <Mono size={10.5}>Draft. Review before sending</Mono>
          </div>
          <div className="flex shrink-0 items-center gap-[10px]">
            <Button
              variant="solid"
              onClick={() => {
                download(artifact);
                const label =
                  gaps > 0
                    ? `${artifact.filename} downloaded with ${gaps} unsourced section${gaps === 1 ? "" : "s"}`
                    : `${artifact.filename} downloaded`;
                if (gaps > 0) toast.warning(label);
                else toast.success(label);
              }}
            >
              Download
            </Button>
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>

        {gaps > 0 ? (
          <div
            className="shrink-0"
            style={{
              padding: "10px 20px",
              background: KZ.grey050,
              borderBottom: `1px solid ${KZ.bone}`,
            }}
          >
            <Mono size={10.5} tone={KZ.amber}>
              {artifact.unsourced.length > 0
                ? `Unsourced sections: ${artifact.unsourced.join(", ")}. `
                : ""}
              {artifact.emptyColumns?.length
                ? `Columns with no source: ${artifact.emptyColumns.join(", ")}.`
                : ""}
            </Mono>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto" style={{ padding: 20 }}>
          {text !== null ? (
            <pre
              className="whitespace-pre-wrap"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                lineHeight: 1.6,
                color: KZ.ink,
                margin: 0,
              }}
            >
              {text}
            </pre>
          ) : (
            <div style={{ fontSize: 13.5, lineHeight: 1.55, color: KZ.body }}>
              <p style={{ margin: 0 }}>
                This is a binary Office document, so there is no honest way to render it here. A
                mock-up of its contents would be a different document from the one you are about to
                send.
              </p>
              <p style={{ marginTop: 14 }}>
                Generated {artifact.assembledAt}
                {artifact.rowCount !== undefined ? ` · ${artifact.rowCount} rows` : ""}. Download
                and open it to check.
              </p>
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                {artifact.sources.map((s) => (
                  <span
                    key={s.key}
                    style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                  >
                    <Tag tone={s.ok ? KZ.green : KZ.coral}>{s.key}</Tag>
                    <Mono size={10.5}>{s.message}</Mono>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
