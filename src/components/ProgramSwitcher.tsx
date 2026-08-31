import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { PROGRAMS, type ProgramConfig } from "@/lib/program.config";
import { useProgram } from "@/routes/p/$programId/route";
import { useAuth } from "@/hooks/use-auth";
import { KZ, Mono, Square } from "./kz";

/**
 * The program chip, top right — trigger and account menu in one.
 *
 * In the design this is a hairline chip: a 6×6 swatch, then the program and the
 * sprint it is in. It replaces the round account avatar, which was the last
 * rounded, shadowed thing on the page. Everything the avatar menu did still
 * happens here; only the shape changed.
 *
 * Switching keeps the current page — /p/va/risks becomes /p/ventura/risks — and
 * changes the URL rather than hidden state, so a program stays a linkable
 * address and two tabs can hold two engagements at once.
 */
export function ProgramSwitcher() {
  const program = useProgram();
  const navigate = useNavigate();
  const { user, hydrated, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Dismiss on outside click and on Escape. A menu that only closes by
  // re-clicking the trigger is a trap for anyone not using a mouse.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const others = Object.values(PROGRAMS).filter((p) => p.id !== program.id);

  function switchTo(id: string) {
    setOpen(false);
    // "." keeps the matched route and swaps only the program segment.
    navigate({ to: ".", params: { programId: id } as never });
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          hydrated && user
            ? `${user.name}, ${user.role}. ${program.name}. Switch program or sign out.`
            : `${program.name}. Sign in or switch program.`
        }
        className="kz-transition"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          border: `1px solid ${open ? KZ.ink : KZ.bone}`,
          background: KZ.white,
          color: KZ.ink,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.02em",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        <Square tone={program.navColor} filled />
        <span>{chipLabel(program)}</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50"
          style={{
            marginTop: 8,
            minWidth: 260,
            background: KZ.white,
            border: `1px solid ${KZ.ink}`,
          }}
        >
          {/* Identity first, so the menu answers "who am I" before "what can I
              switch to". Rendered only after hydration so the server render
              never disagrees with the client. */}
          {hydrated && user ? (
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${KZ.grey200}` }}>
              <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                {user.name} · {user.role}
              </div>
              <Mono size={10.5} tone={KZ.muted}>
                Signed in via {user.provider === "okta" ? "Okta" : "static demo"}
              </Mono>
            </div>
          ) : null}

          {others.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitem"
              onClick={() => switchTo(p.id)}
              className="kz-transition"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                padding: "11px 16px",
                border: 0,
                background: "transparent",
                color: KZ.ink,
                fontSize: 13.5,
                textAlign: "left",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = KZ.grey050)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Seal program={p} />
              <span className="truncate">{p.name}</span>
            </button>
          ))}

          {/* The auth affordance flips shape with state — "Sign in" as a link
              when nobody is signed in, "Log out" as a mutator when someone is.
              Same slot, different meaning. */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              if (hydrated && user) {
                signOut();
                navigate({ to: "/login", replace: true });
              } else {
                navigate({ to: "/login" });
              }
            }}
            className="kz-transition"
            style={{
              width: "100%",
              padding: "11px 16px",
              border: 0,
              borderTop: `1px solid ${KZ.grey200}`,
              background: "transparent",
              color: KZ.ink,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
              textAlign: "left",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = KZ.grey050)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {hydrated && user ? "Log out" : "Sign in"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * "VA · Sprint 6", or just "VA" when today falls outside every window in the
 * strip. The sprint is read from the program's own strip rather than hardcoded,
 * so a chip never claims a sprint the program is not in.
 */
function chipLabel(program: ProgramConfig): string {
  const today = new Date().toISOString().slice(0, 10);
  const now = program.sprintStrip.find((s) => s.start <= today && today <= s.end);
  const id = program.id.toUpperCase();
  return now ? `${id} · ${now.label}` : id;
}

/**
 * The program's seal, or an initials chip when no asset has been supplied.
 *
 * The fallback is deliberately a flat lettermark rather than anything
 * seal-like: a hand-made approximation of an official seal would misrepresent
 * it.
 */
function Seal({ program }: { program: ProgramConfig }) {
  // A configured path is not a guarantee the file is there. Falling back on
  // error keeps the menu readable instead of showing a broken-image glyph.
  const [failed, setFailed] = useState(false);
  if (program.seal.src && !failed) {
    return (
      <img
        src={program.seal.src}
        alt={program.seal.alt}
        onError={() => setFailed(true)}
        className="h-5 w-5 shrink-0 object-contain"
      />
    );
  }
  const initials = program.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="flex h-5 w-5 shrink-0 items-center justify-center"
      style={{
        background: program.navColor,
        color: KZ.white,
        fontFamily: "var(--font-mono)",
        fontSize: 10,
      }}
    >
      {initials}
    </span>
  );
}
