import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Client-side portal session.
 *
 * Distinct from useAuth (which is the internal Kaizen strategist session).
 * A client user is scoped to exactly one program — the customer's identity
 * is what authorises the view, so name + programId together are the session.
 * Two localStorage keys keep the two identities from stepping on each other.
 *
 * Demo-scoped shape. Real deployment must replace `signIn` with a signed
 * token flow (Supabase Auth magic-link is the natural drop-in) and pair
 * that with row-level filtering server-side, since today the URL alone
 * is enough to read a program.
 */
export type ClientAuthProvider = "static" | "magic-link";

export interface ClientUser {
  name: string;
  programId: string;
  provider: ClientAuthProvider;
  signedInAt: string;
}

const STORAGE_KEY = "kaizen-client-user";

function load(): ClientUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ClientUser>;
    if (
      typeof parsed?.name === "string" &&
      typeof parsed?.programId === "string" &&
      (parsed?.provider === "static" || parsed?.provider === "magic-link") &&
      typeof parsed?.signedInAt === "string"
    ) {
      return parsed as ClientUser;
    }
    return null;
  } catch {
    return null;
  }
}

export function useClientAuth() {
  const [user, setUser] = useState<ClientUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setUser(load());
    setHydrated(true);
  }, []);

  const skipFirst = useRef(true);
  useEffect(() => {
    if (!hydrated) return;
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    if (typeof window === "undefined") return;
    if (user === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }, [user, hydrated]);

  const signIn = useCallback((next: Omit<ClientUser, "signedInAt">) => {
    setUser(() => ({ ...next, signedInAt: new Date().toISOString() }));
  }, []);

  const signOut = useCallback(() => setUser(() => null), []);

  return { user, hydrated, signIn, signOut };
}
