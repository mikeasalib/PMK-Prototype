import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { Button, Eyebrow, KZ, Mono } from "@/components/kz";
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
 * Three states, disclosed in the subtitle rather than hidden behind
 * indistinguishable "Live Hex project" text:
 *
 * - "signed embed" — the server minted a presigned URL against HEX_API_KEY.
 *   Anyone with app access sees the dashboard, Hex account or not.
 * - "session-based auth" — no HEX_API_KEY (or the mint failed) and the plain
 *   embedUrl is loaded directly. Viewers signed in to Hex in the same browser
 *   see the dashboard; others see Hex's login screen.
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
    // Optimistic: render the session-auth fallback immediately so the page is
    // not blank while the mint request is in flight.
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
          note: result.reason === "no-api-key" ? null : (result.detail ?? null),
        });
      } else {
        setMode({ kind: "not-configured" });
      }
    })();
    return () => {
      cancelled = true;
    };
    // projectId and embedUrl are stable per program; the effect re-runs on
    // program switch. mint is a memoised binding.
  }, [projectId, embedUrl, mint]);

  const subtitleTail = describeMode(mode);
  const openInHexUrl = deriveOpenInHex(embedUrl, projectId);

  return (
    <AppLayout>
      <PageHeader
        eyebrow="Sentiment"
        title="Customer health"
        subtitle={
          subtitleTail
            ? `Live Hex project · ${subtitleTail}${projectLabel ? ` · ${projectLabel}` : ""} · ${program.domainLabel} sentiment.`
            : `Not configured — no Hex project is wired to ${program.domainLabel} yet.`
        }
        actions={
          openInHexUrl ? (
            <a href={openInHexUrl} target="_blank" rel="noreferrer">
              <Button style={{ borderColor: KZ.bone }}>Open in Hex</Button>
            </a>
          ) : null
        }
      />

      <div style={{ padding: "28px var(--kz-pad-x) 60px var(--kz-pad-x)" }}>
        {mode.kind === "not-configured" ? (
          <NotConfigured />
        ) : mode.kind === "pending" ? (
          <Placeholder>Requesting a signed embed URL from Hex…</Placeholder>
        ) : (
          <>
            <iframe
              src={mode.url}
              title="Customer health dashboard"
              style={{
                width: "100%",
                height: "calc(100vh - 200px)",
                minHeight: 520,
                border: `1px solid ${KZ.bone}`,
                background: KZ.white,
                display: "block",
              }}
              referrerPolicy="no-referrer-when-downgrade"
            />
            {mode.kind === "session" && mode.note ? (
              <div style={{ marginTop: 12 }}>
                <Mono size={10.5} tone={KZ.amber}>
                  Signed embed unavailable — {mode.note}. Falling back to session auth, so this
                  renders only for viewers already signed in to Hex.
                </Mono>
              </div>
            ) : null}
          </>
        )}
      </div>
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
 * "Open in Hex" always points at the human-readable app URL, not the signed
 * one — presigned URLs are single-use, so opening one in a new tab would either
 * race the iframe or hand the recipient a dead link.
 */
function deriveOpenInHex(embedUrl: string | null, projectId: string | null): string | null {
  if (embedUrl) return embedUrl.replace(/\?embedded=true(&|$)/, (_, tail) => (tail ? "?" : ""));
  if (projectId) return `https://app.hex.tech/app/${projectId}/latest`;
  return null;
}

/** The one tinted panel shape, used where the embed cannot render. */
function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${KZ.bone}`,
        background: KZ.grey050,
        minHeight: 520,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: 40,
      }}
    >
      <Eyebrow size={10}>Hex embed</Eyebrow>
      <p
        style={{
          margin: 0,
          maxWidth: "52ch",
          textAlign: "center",
          fontSize: 14,
          lineHeight: 1.55,
          color: KZ.body,
        }}
      >
        {children}
      </p>
    </div>
  );
}

function NotConfigured() {
  return (
    <Placeholder>
      Customer-health sentiment renders as a live Hex embed, minted server-side per program. This
      program has not been wired to one — set <Code>hex.customerHealth</Code> in{" "}
      <Code>src/lib/program.config.ts</Code> with either an <Code>embedUrl</Code> (session-auth
      fallback) or a <Code>projectId</Code> plus <Code>HEX_API_KEY</Code> for signed embeds.
    </Placeholder>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11.5,
        border: `1px solid ${KZ.bone}`,
        background: KZ.white,
        padding: "1px 5px",
      }}
    >
      {children}
    </code>
  );
}
