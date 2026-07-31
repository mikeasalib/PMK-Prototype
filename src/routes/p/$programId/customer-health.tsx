import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Activity } from "lucide-react";
import { AppLayout, PageHeader } from "@/components/AppLayout";
import { PROGRAMS, pageTitle } from "@/lib/program.config";
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

function CustomerHealth() {
  const program = useProgram();
  const { embedUrl, projectLabel } = program.hex.customerHealth;
  const configured = typeof embedUrl === "string" && embedUrl.length > 0;

  return (
    <AppLayout>
      <PageHeader
        title="Customer health"
        subtitle={[
          program.domainLabel,
          configured
            ? `Live Hex project${projectLabel ? ` · ${projectLabel}` : ""}`
            : "Not configured — no Hex project wired to this program yet",
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          configured ? (
            <a
              href={embedUrl!}
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

      {configured ? <HexEmbed url={embedUrl!} /> : <NotConfigured />}
    </AppLayout>
  );
}

/**
 * Full-height iframe with no chrome. Hex owns the visual language for what's
 * inside; wrapping it in a Kaizen card would fight it. Height is a viewport
 * calc so the embed fills the available space under the page header without a
 * hard-coded pixel value that would break on smaller screens.
 */
function HexEmbed({ url }: { url: string }) {
  return (
    <div className="mt-4">
      <iframe
        src={url}
        title="Customer health dashboard"
        className="w-full rounded-lg border border-neutral-200 bg-white"
        style={{ height: "calc(100vh - 180px)", minHeight: 520 }}
        // The Hex embed handles its own auth; we do not need to relax the
        // sandbox beyond the browser default. If a Hex link ever requires
        // top-level navigation, revisit this attribute rather than dropping it.
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}

/**
 * Honest empty state. Says exactly what is missing and where to add it — the
 * disclosure pattern applied to a not-yet-connected data source, so the page
 * doesn't render an empty iframe that could read as "the dashboard has nothing
 * to show."
 */
function NotConfigured() {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-8">
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
          <code className="rounded bg-neutral-200 px-1.5 py-0.5 text-[12px] text-neutral-800">
            hex.customerHealth.embedUrl
          </code>{" "}
          on the program in{" "}
          <code className="rounded bg-neutral-200 px-1.5 py-0.5 text-[12px] text-neutral-800">
            src/lib/program.config.ts
          </code>{" "}
          to a Hex public-app URL or a signed-embed URL and the dashboard will
          appear here.
        </p>
      </div>
    </div>
  );
}
