import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Activity } from "lucide-react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { PROGRAMS, pageTitle } from "@/lib/program.config";
import { mintHexSignedEmbedUrl, type HexSignedEmbed } from "@/lib/hex.functions";
import { useProgram } from "./route";

export const Route = createFileRoute("/p/$programId/customer-health")({
  head: ({ params }) => ({
    meta: [
      { title: pageTitle("Customer health", PROGRAMS[params.programId]) },
      {
        name: "description",
        content: "Live Hex sentiment dashboard embedded for the active program.",
      },
    ],
  }),
  component: CustomerHealth,
});

/**
 * Three states, disclosed in the subtitle rather than hidden behind indistinguishable
 * "Live Hex project" text:
 *
 * - "signed embed" — server minted a presigned URL against HEX_API_KEY. Anyone
 *   with app access sees the dashboard, regardless of whether they have a
 *   Hex account.
 * - "session-based auth" — no HEX_API_KEY (or the mint failed) and the plain
 *   embedUrl is loaded directly. Viewers signed in to Hex in the same browser
 *   see the dashboard; viewers without a session see Hex's login screen.
 * - "not configured" — neither embedUrl nor projectId is set for this program.
 */
type EmbedMode =
  | { kind: "pending" }
  | { kind: "signed"; url: string }
  | { kind: "session"; url: string; note: string | null }
  | { kind: "not-configured" };

function CustomerHealth() {
  const program = useProgram();
  const { embedUrl, projectLabel, projectId } = program.hex.customerHealth;
  const mint = useServerFn(mintHexSignedEmbedUrl);
  const [mode, setMode] = useState<EmbedMode>(() => {
    if (!projectId && !embedUrl) return { kind: "not-configured" };
    // Optimistic: render the session-auth fallback immediately so the page
    // isn't blank while the server mint request is in flight. If the signed
    // URL comes back it swaps in; if it doesn't, we're already in the right
    // place.
    if (embedUrl) return { kind: "session", url: embedUrl, note: null };
    return { kind: "pending" };
  });

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    (async () => {
      let result: HexSignedEmbed;
      try {
        result = await mint({ data: { projectId } });
      } catch (err) {
        result = {
          ok: false,
          reason: "api-error",
          detail: err instanceof Error ? err.message : String(err),
        };
      }
      if (cancelled) return;
      if (result.ok) {
        setMode({ kind: "signed", url: result.url });
      } else if (embedUrl) {
        setMode({
          kind: "session",
          url: embedUrl,
          note: result.reason === "no-api-key" ? null : result.detail ?? null,
        });
      } else {
        setMode({ kind: "not-configured" });
      }
    })();
    return () => {
      cancelled = true;
    };
    // projectId and embedUrl are stable per program; the effect re-runs on
    // program switch. mint is stable (useServerFn returns a memoised binding).
  }, [projectId, embedUrl, mint]);

  const subtitleTail = describeMode(mode);
  const openInHexUrl = deriveOpenInHex(embedUrl, projectId);

  return (
    <AppLayout>
      <PageHeader
        title="Customer health"
        subtitle={[
          program.domainLabel,
          subtitleTail
            ? `Live Hex project · ${subtitleTail}${projectLabel ? ` · ${projectLabel}` : ""}`
            : "Not configured — no Hex project wired to this program yet",
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          openInHexUrl ? (
            <a
              href={openInHexUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-[13px] font-medium text-neutral-700 transition hover:border-neutral-400"
            >
              <ExternalLink size={14} />
              Open in Hex
            </a>
          ) : null
        }
      />

      {mode.kind === "not-configured" ? (
        <NotConfigured />
      ) : mode.kind === "pending" ? (
        <PendingEmbed />
      ) : (
        <HexEmbed url={mode.url} />
      )}
    </AppLayout>
  );
}

function describeMode(mode: EmbedMode): string | null {
  switch (mode.kind) {
    case "signed":
      return "signed embed";
    case "session":
      return "session-based auth";
    case "pending":
      return "loading";
    case "not-configured":
      return null;
  }
}

/**
 * The "Open in Hex" button always points at the human-readable app URL, not the
 * signed one — presigned URLs are single-use, so opening one in a new tab would
 * either race the iframe or hand the recipient a dead link. Strip the
 * "?embedded=true" query so the user lands on the full Hex UI.
 */
function deriveOpenInHex(embedUrl: string | null, projectId: string | null): string | null {
  if (embedUrl) return embedUrl.replace(/\?embedded=true(&|$)/, (_, tail) => (tail ? "?" : ""));
  if (projectId) return `https://app.hex.tech/app/${projectId}/latest`;
  return null;
}

function HexEmbed({ url }: { url: string }) {
  return (
    <div className="mt-4 px-6 pb-6">
      <iframe
        src={url}
        title="Customer health dashboard"
        className="w-full rounded-lg border border-neutral-200 bg-white"
        style={{ height: "calc(100vh - 200px)", minHeight: 520 }}
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}

function PendingEmbed() {
  return (
    <div className="mt-4 mx-6 mb-6 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-8">
      <div className="mx-auto max-w-xl text-center text-[13px] text-neutral-600">
        Requesting a signed embed URL from Hex…
      </div>
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="mt-4 mx-6 mb-6 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-8">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-neutral-500 shadow-sm">
          <Activity size={18} />
        </div>
        <h2 className="text-[15px] font-semibold text-neutral-800">
          No Hex project connected yet
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
          Customer-health sentiment is meant to render as a live Hex embed. This
          program hasn't been wired to one — set{" "}
          <code className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-800">
            hex.customerHealth
          </code>{" "}
          on the program in{" "}
          <code className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-800">
            src/lib/program.config.ts
          </code>{" "}
          with either an{" "}
          <code className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-800">
            embedUrl
          </code>{" "}
          (session-auth fallback) or a{" "}
          <code className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-800">
            projectId
          </code>{" "}
          plus{" "}
          <code className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs text-neutral-800">
            HEX_API_KEY
          </code>{" "}
          for signed embeds.
        </p>
      </div>
    </div>
  );
}
