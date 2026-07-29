import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { CircleUserRound } from "lucide-react";
import { PROGRAMS, type ProgramConfig } from "@/lib/program.config";

/**
 * Kaizen's dark green. Fixed rather than taken from program.navColor: the
 * account control is app chrome, and it should not change colour when you switch
 * engagements. The sidebar is where per-program colour belongs.
 */
const KAIZEN_GREEN = "#1f3d2b";
import { useProgram } from "@/routes/p/$programId/route";

/**
 * Account-style menu, top right — mirrors the pattern on the customer-facing
 * reservation site: a plain circle-user trigger and an unadorned white menu.
 *
 * Where that site puts "Admin Dashboard" first, this puts the other programs, so
 * switching engagements is the same gesture as switching accounts. A single
 * cross-program view for the head of programs is a separate, later thing and is
 * deliberately not stubbed in here.
 *
 * Switching keeps the current page — /p/va/risks becomes /p/ventura/risks — and
 * it changes the URL rather than hidden state, so a program stays a linkable
 * address and two tabs can hold two engagements at once.
 */
export function ProgramSwitcher() {
  const program = useProgram();
  const navigate = useNavigate();
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
        aria-label={`${program.name}. Switch program or account.`}
        className="flex h-9 w-9 items-center justify-center rounded-full transition-all hover:brightness-110"
        style={{
          backgroundColor: KAIZEN_GREEN,
          color: "#ffffff",
          // A visible ring plus a small lift, so it reads as the one persistent
          // control on the page rather than another grey icon.
          boxShadow: open
            ? `0 0 0 3px rgba(31,61,43,0.28)`
            : "0 1px 2px rgba(17,47,78,0.18), 0 2px 6px -2px rgba(17,47,78,0.20)",
        }}
      >
        <CircleUserRound size={20} strokeWidth={2} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 min-w-[220px] rounded bg-white py-2"
          style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.13), 0 0 1px rgba(0,0,0,0.08)" }}
        >
          {others.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitem"
              onClick={() => switchTo(p.id)}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-[14px] transition-colors hover:bg-[#f5f5f2]"
              style={{ color: "#1b1b1b" }}
            >
              <Seal program={p} />
              <span className="truncate">{p.name}</span>
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            className="w-full px-4 py-2 text-left text-[14px] transition-colors hover:bg-[#f5f5f2]"
            style={{ color: "#1b1b1b" }}
          >
            My Account
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full px-4 py-2 text-left text-[14px] transition-colors hover:bg-[#f5f5f2]"
            style={{ color: "#1b1b1b" }}
          >
            Log Out
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The program's seal, or an initials chip when no asset has been supplied.
 *
 * The fallback is deliberately a flat lettermark rather than anything seal-like:
 * a hand-made approximation of an official seal would misrepresent it.
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
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-[9px] font-semibold text-white"
      style={{ backgroundColor: program.navColor }}
    >
      {initials}
    </span>
  );
}
