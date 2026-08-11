import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Who is signed in, in this browser.
 *
 * This is deliberately shallow — a name, a role, and the provider that
 * authenticated the session. The provider tag is forward-looking: today the
 * only provider is "static" (a single hard-coded demo user), and when Okta
 * lands the same shape holds with provider "okta" and the same downstream
 * consumers (header chip, sign-out control) needing no change.
 *
 * The state is per-browser localStorage, matching every other bit of curation
 * in this app (nav prefs, follow-up decisions). Not gated: the app still
 * renders for a user who has not signed in — the login page is a landing to
 * flip on later, not a wall to bounce them off today.
 */
export type AuthProvider = "static" | "okta";
export interface SignedInUser {
  name: string;
  role: string;
  provider: AuthProvider;
  signedInAt: string;
}

const STORAGE_KEY = "kaizen-user";

function load(): SignedInUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SignedInUser>;
    // Defensive read — a stale entry from a shape change should fail closed
    // rather than surface as a broken chip.
    if (
      typeof parsed?.name === "string" &&
      typeof parsed?.role === "string" &&
      (parsed?.provider === "static" || parsed?.provider === "okta") &&
      typeof parsed?.signedInAt === "string"
    ) {
      return parsed as SignedInUser;
    }
    return null;
  } catch {
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState<SignedInUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setUser(load());
    setHydrated(true);
  }, []);

  // Persist on change — same pattern as use-nav-prefs so functional updaters in
  // signIn/signOut are never fighting a stale closure inside the mutator.
  const skipFirst = useRef(true);
  useEffect(() => {
    if (!hydrated) return;
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    if (typeof window === "undefined") return;
    if (user === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    }
  }, [user, hydrated]);

  const signIn = useCallback((next: Omit<SignedInUser, "signedInAt">) => {
    setUser(() => ({ ...next, signedInAt: new Date().toISOString() }));
  }, []);

  const signOut = useCallback(() => {
    setUser(() => null);
  }, []);

  return { user, hydrated, signIn, signOut };
}
