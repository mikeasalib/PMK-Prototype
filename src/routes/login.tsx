import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { DEFAULT_PROGRAM_ID } from "@/lib/program.config";

/**
 * Login landing.
 *
 * Passive today — the rest of the app renders without signing in, so this
 * route is a demo of the flow, not a gate. When Okta lands, the redirect
 * on submit stays the same and the button's onClick is swapped for an
 * Okta widget or PKCE handoff; every consumer of `useAuth().user` keeps
 * working unchanged.
 *
 * Single static option (Mike — DS) rather than a form: this is not a real
 * IdP. Typing a name into a text box would suggest identity is being
 * authenticated, which it isn't — clicking a labelled button is more
 * honest about what the interaction actually does.
 */
export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Kaizen Program Intel" },
      {
        name: "description",
        content: "Sign in to the Kaizen program intel workspace.",
      },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { user, hydrated, signIn } = useAuth();

  // If someone lands on /login already signed in, drop them at the default
  // program rather than showing a login they don't need. Wait for hydration
  // so the first client render never contradicts the server.
  useEffect(() => {
    if (hydrated && user) {
      navigate({
        to: "/p/$programId",
        params: { programId: DEFAULT_PROGRAM_ID },
        replace: true,
      });
    }
  }, [hydrated, user, navigate]);

  function signInAsMike() {
    signIn({ name: "Mike", role: "DS", provider: "static" });
    navigate({
      to: "/p/$programId",
      params: { programId: DEFAULT_PROGRAM_ID },
      replace: true,
    });
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{ backgroundColor: "#f7f7f5" }}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-8"
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
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              fontWeight: 600,
              color: "#1b1b1b",
            }}
          >
            Kaizen Program Intel
          </h1>
          <p className="mt-1 text-[13px]" style={{ color: "#565c65" }}>
            Sign in to your workspace.
          </p>
        </div>

        <button
          type="button"
          onClick={signInAsMike}
          disabled={!hydrated}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-[14px] font-medium transition-all"
          style={{
            backgroundColor: "#1f3d2b",
            color: "#ffffff",
            opacity: hydrated ? 1 : 0.6,
            cursor: hydrated ? "pointer" : "wait",
          }}
        >
          Continue as Mike — DS
        </button>

        <div
          className="mt-4 rounded-md px-3 py-2 text-[11px] leading-relaxed"
          style={{ backgroundColor: "#f7f7f5", border: "1px solid #e5e5e2", color: "#565c65" }}
        >
          Static demo sign-in for now. Real identity will slot in behind this
          button when the Okta integration is wired up — the rest of the app
          keeps working either way.
        </div>
      </div>
    </div>
  );
}
