import { useCallback, useEffect, useRef, useState } from "react";

// Which sidebar items a person has hidden.
//
// This is a per-user preference, not per-program: the nav is app chrome, and the
// ask was "not useful for everyone" — a person tailoring their own view, not a
// program-specific config. So it is keyed globally in this browser, and hiding
// "Dependency map" hides it under every program.
//
// Hiding is never deletion. The item's route still exists and works by URL; only
// its nav entry is suppressed, and the customize control can always bring it
// back. Nothing here is destructive.

const STORAGE_KEY = "nav-hidden";

function load(): string[] {
  // SSR-safe: no window on the server, and the first client render must match
  // the server's, so hydration happens in an effect rather than here.
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function useNavPrefs() {
  const [hidden, setHidden] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHidden(load());
    setHydrated(true);
  }, []);

  // Persist on change rather than inside each mutator. This is what lets toggle
  // use the functional updater form — two toggles in one tick both operate on
  // the freshest state instead of a stale closure, so neither is lost. Guarded
  // on `hydrated` so the initial empty render never overwrites saved prefs.
  const skipFirst = useRef(true);
  useEffect(() => {
    if (!hydrated) return;
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(hidden));
    }
  }, [hidden, hydrated]);

  const isHidden = useCallback((key: string) => hidden.includes(key), [hidden]);

  const toggle = useCallback((key: string) => {
    setHidden((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }, []);

  const reset = useCallback(() => setHidden([]), []);

  return { hydrated, hidden, isHidden, toggle, reset };
}
