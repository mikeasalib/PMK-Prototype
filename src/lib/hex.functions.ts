import { createServerFn } from "@tanstack/react-start";

/**
 * Signed-embed mint for a Hex app.
 *
 * The plain-iframe path in customer-health.tsx renders whatever Hex session the
 * viewer's browser has. That works for anyone signed in to Hex, and shows a
 * login screen otherwise. For a viewer without a Hex account — say, a customer
 * in the eventual read-only portal — Hex's signed-embed flow lets the server
 * mint a short-lived URL keyed on a workspace API token.
 *
 * Docs: POST https://app.hex.tech/api/v1/embedding/createPresignedUrl/{projectId}
 *
 * Two honest states leave this function:
 *
 * - { url } — HEX_API_KEY is set and Hex returned a presigned URL. Client
 *   embeds it as the iframe src. The URL is single-use and expires in
 *   `expiresIn` ms (max 300000).
 * - { url: null, reason } — either HEX_API_KEY is unset (development or an
 *   unconfigured deployment) or Hex returned an error. The route falls back
 *   to the public embed URL and discloses "session-based auth" in the
 *   subtitle rather than pretending the signed path worked.
 *
 * The function never throws to the client. A network hiccup or a rejected key
 * is a fallback-to-session case, not a page-level error.
 */

export type HexSignedEmbed =
  | { ok: true; url: string; expiresInMs: number }
  | { ok: false; reason: "no-api-key" | "no-project-id" | "api-error"; detail?: string };

export const mintHexSignedEmbedUrl = createServerFn({ method: "POST" })
  .validator((input: { projectId: string | null } | undefined) => input ?? { projectId: null })
  .handler(async ({ data }): Promise<HexSignedEmbed> => {
    const { projectId } = data;
    if (!projectId) return { ok: false, reason: "no-project-id" };

    const apiKey = process.env.HEX_API_KEY;
    if (!apiKey) return { ok: false, reason: "no-api-key" };

    // Max 300000 (5 minutes); this window is the client's grace to load the
    // returned URL into the iframe, not how long the embed itself is valid.
    const expiresInMs = 60000;

    try {
      const res = await fetch(
        `https://app.hex.tech/api/v1/embedding/createPresignedUrl/${encodeURIComponent(projectId)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            // Required by the API. Empty is valid when the app does not
            // partition data by viewer; when it does, populate with e.g.
            // { customerId: "..." } and configure the corresponding user
            // attribute on the Hex app.
            hexUserAttributes: {},
            expiresIn: expiresInMs,
          }),
        },
      );

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return {
          ok: false,
          reason: "api-error",
          detail: `${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 160)}` : ""}`,
        };
      }

      const json = (await res.json()) as { url?: unknown };
      if (typeof json.url !== "string") {
        return { ok: false, reason: "api-error", detail: "response missing url field" };
      }
      return { ok: true, url: json.url, expiresInMs };
    } catch (err) {
      return {
        ok: false,
        reason: "api-error",
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  });
