# First-prompt template

Paste this into a fresh Claude Code session started in
`/Users/mikesalib/Claude/PMK-Prototype`, replacing `{{ASK}}` with the actual
request. The template is short on purpose — the real context lives in
HANDOFF.md, which the new session will read for itself.

---

I'm continuing work on this repo. Before doing anything:

1. Read `HANDOFF.md` end-to-end — it's the handoff from the previous session
   and covers the reframe, architecture, ground rules, and open work.
2. Read the last few commits on the current branch (`git log --oneline -10`,
   then `git show <hash>` on anything that looks relevant to my ask) — commit
   messages here are verbose on purpose and explain *why*.
3. Check the current branch (`git status`, `git branch --show-current`) —
   work happens on `program-agnostic-refactor`, not `main`.

Then:

- Do NOT run `bun run format` or `bun add`.
- If the ask touches data on screen, plan disclosure in place for any input
  that isn't real (see HANDOFF's "disclosure pattern" section).
- If it touches both programs, model-layer change with `leak.sh` passing —
  not a route-level patch.
- Use functional state updaters in any hook that reads then writes state.
- Before committing, run: `bunx tsc --noEmit -p tsconfig.json`, `bun run
  build`, and `scratchpad/leak.sh` if data-shape or route-visibility changed.

My ask:

{{ASK}}
