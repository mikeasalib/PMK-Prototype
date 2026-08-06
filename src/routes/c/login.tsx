import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogIn } from "lucide-react";
import { PROGRAMS, type ProgramConfig } from "@/lib/program.config";
import { useClientAuth } from "@/hooks/use-client-auth";

/**
 * Client-portal login.
 *
 * Demo shape: pick the customer you represent, sign in as a named contact.
 * Real deployment must replace this with a magic-link email flow (Supabase
 * Auth's `signInWithOtp`) and a per-customer allow-list — a picker of every
 * known customer is only OK for a demo of the flow.
 */
export const Route = createFileRoute("/c/login")({
  head: () => ({
    meta: [
      { title: "Client portal — Sign in" },
      { name: "description", content: "Sign in to the Kaizen client portal." },
    ],
  }),
  component: ClientLogin,
});

interface DemoContact {
  name: string;
  programId: string;
  role: string;
}

/** Named contacts per program, for the demo picker. Real portal reads this
 *  off a per-program stakeholder allow-list. */
const CONTACTS: DemoContact[] = [
  { name: "Vivian Nguyen", programId: "va", role: "GovCIO / VA delivery lead" },
  { name: "Matt Dingee", programId: "va", role: "VA Design System" },
  { name: "Denise Randolph", programId: "va", role: "VA Authenticated Experience" },
  { name: "Chad Bowie", programId: "ventura", role: "Ventura County Parks — Operations" },
  { name: "Jeri Cooper", programId: "ventura", role: "Ventura County Parks — Reservations" },
  { name: "Brandon Nakamoto", programId: "ventura", role: "Ventura County Parks — Finance" },
];

function ClientLogin() {
  const navigate = useNavigate();
  const { user, hydrated, signIn } = useClientAuth();
  const [selected, setSelected] = useState<string>(CONTACTS[0]?.name ?? "");

  useEffect(() => {
    if (hydrated && user) {
      navigate({
        to: "/c/$programId",
        params: { programId: user.programId },
        replace: true,
      });
    }
  }, [hydrated, user, navigate]);

  function submit() {
    const contact = CONTACTS.find((c) => c.name === selected);
    if (!contact) return;
    signIn({ name: contact.name, programId: contact.programId, provider: "static" });
    navigate({
      to: "/c/$programId",
      params: { programId: contact.programId },
      replace: true,
    });
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-8"
      style={{ backgroundColor: "#f7f7f5" }}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 md:p-8"
        style={{ border: "1px solid #e5e5e2", boxShadow: "0 4px 20px rgba(17,47,78,0.06)" }}
      >
        <div className="mb-6 text-center">
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: "#1f3d2b", color: "#ffffff" }}
          >
            <LogIn size={20} />
          </div>
          <h1
            className="text-xl font-semibold md:text-2xl"
            style={{ fontFamily: "var(--font-display)", color: "#1b1b1b" }}
          >
            Kaizen client portal
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "#565c65" }}>
            Sign in to see your program's progress.
          </p>
        </div>

        <label className="block text-[12px] font-semibold uppercase tracking-wide" style={{ color: "#565c65" }}>
          Who's signing in
        </label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={!hydrated}
          className="mt-2 w-full rounded-md bg-white px-3 py-2 text-[14px]"
          style={{ border: "1px solid #dfe1e2", color: "#1b1b1b" }}
        >
          {CONTACTS.map((c) => {
            const p: ProgramConfig | undefined = PROGRAMS[c.programId];
            return (
              <option key={`${c.name}-${c.programId}`} value={c.name}>
                {c.name} — {p?.contract.customer ?? c.programId}
              </option>
            );
          })}
        </select>
        <p className="mt-2 text-[11px]" style={{ color: "#8a8a80" }}>
          {CONTACTS.find((c) => c.name === selected)?.role ?? ""}
        </p>

        <button
          type="button"
          onClick={submit}
          disabled={!hydrated}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-[14px] font-medium"
          style={{
            backgroundColor: "#1f3d2b",
            color: "#ffffff",
            opacity: hydrated ? 1 : 0.6,
            cursor: hydrated ? "pointer" : "wait",
          }}
        >
          Continue
        </button>

        <div
          className="mt-4 rounded-md px-3 py-2 text-[11px] leading-relaxed"
          style={{ backgroundColor: "#fdf5e6", border: "1px solid #e5e5e2", color: "#7a5a00" }}
        >
          Demo sign-in. Real client access will be a signed magic-link tied
          to your work email, with the customer allow-list enforced server
          side.
        </div>
      </div>
    </div>
  );
}
