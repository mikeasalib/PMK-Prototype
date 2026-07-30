# PMK-Prototype — handoff for a new session

Paste this into a new Claude Code session before asking for changes. It's the
minimum a new pair needs to work on this codebase without re-litigating
decisions or repeating the mistakes the current one made.

## Repo

- **GitHub**: github.com/mikeasalib/PMK-Prototype
- **Local**: `/Users/mikesalib/Claude/PMK-Prototype`
- **Working branch**: `program-agnostic-refactor` (all work in this session)
- **Base branch**: `main` — do not force-push, this repo is Lovable-connected
  and rewriting history clobbers the editor. This branch has not been merged.

## Run

```bash
cd /Users/mikesalib/Claude/PMK-Prototype
bun run dev     # http://localhost:5173
```

Both programs live: `/p/va` and `/p/ventura`. Root redirects to the default
(`va`). Unknown ids 404 on purpose. Do NOT run `bun run format` (whole-repo
prettier reformat — flagged in AGENTS.md context and previously undone once)
and do NOT `bun add` without asking (bunfig.toml has a 24h supply-chain hold).

## What this is

The reframe (settled early): **a federated read-layer over Granola / Linear /
Notion that emits formal documents** — weekly rollup, project plan, POA&M. The
nine-ish pages are previews of that model, not the product. Everything the app
knows is sourced from those three systems; **nothing gets typed into it that
becomes program-of-record data.** Curation (checkmarks on follow-ups, sidebar
customization) is the sole exception, and it lives in browser localStorage.

Two programs run on the same shell:

| | VA (Department of Veterans Affairs) | Ventura County Parks |
|---|---|---|
| Type | Federal, fixed-price, POA&M obligation | Rec deployment, commercial SOW |
| Time axis | Sprints (VA runs Sprint 4–8 to Nov 11 launch) | Phases per Rec Deployment Playbook |
| Workstreams | WS1–WS5 + Admin | FAC / FIN / CC / MEM / PLAT / Admin |
| Linear project | 8 real dated milestones | 0 milestones, project is a Backlog stub |
| Notion risk register | 19-row table under the VA hub | No written register — derived from Linear |
| Granola scope | Folder `fol_QyIIASIUKJmme3` | Participant domain match |
| Launch | 2026-11-11 | 2026-07-13 (currently in Live Customer Handoff) |
| Seal | `/public/seal-va.png` | `/public/seal-ventura.png` |

**Both differences are load-bearing** — the whole point of having two programs
is that the shell can't cheat by hardcoding VA's shape. Anytime a bug or
feature reads "VA behavior in Ventura's UI" or vice versa, that's a cross-
program leak and should be fixed at the model layer, not patched at the route.

## Architecture, minimum you must know

### The model

Everything projects from `ProgramModel` in `src/lib/program-model.ts`. Every
record carries an `origin`:

```ts
type Origin =
  | { kind: "sourced"; refs: SourceRef[] }   // pulled from Linear/Notion/Granola
  | { kind: "config" }                       // authored in program.config.ts
  | { kind: "derived"; from: string };       // computed from other records
```

**Provenance is mandatory on sourced records**, deliberately not optional. The
POA&M and rollup cite each row's `refs`; anything that ships to a customer must
be able to answer "where did this come from?" per row. If you find yourself
tempted to fabricate a SourceRef to make something look sourced, don't — mark
it `derived` or `config`, and it will render honestly.

### The registry

`src/lib/program.config.ts` — one `ProgramConfig` per engagement, keyed in
`PROGRAMS`. Contains identity, contract facts, key dates, workstreams,
`timeAxis: "sprint" | "phase"`, seal path, and the classifier. **Client-safe**
(no secrets). The corresponding server-only file is
`program.sources.server.ts` — external project IDs live there and stay out of
the client bundle by suffix.

The URL owns the active program: `/p/$programId/...`. Reading `PROGRAM` (module
constant) in a route is a bug — use `useProgram()` from
`src/routes/p/$programId/route.tsx`. The accessors `workstreamOf`,
`workstreamKeys`, `classifyWorkstream`, `pageTitle` **have no defaults on
purpose** — pass the program. Defaults are how cross-program leaks happen.

### Phases (aka lifecycle)

VA lifecycle: `src/lib/va-data.ts` `LIFECYCLE`.
Ventura lifecycle: `src/lib/rec-deployment-lifecycle.ts` — a factory that takes
a launch date and back-calculates phases from the Rec Deployment Playbook
target durations. Exit criteria and gates are transcribed verbatim from the
playbook (`33e68467-f30f-804a-8c56-e47846d0a36d`).

Registry: `PHASES_BY_PROGRAM` in `src/lib/program-model.adapters.ts`.

### Workstream classifier

`src/lib/program.config.ts`. Read-path is `classifyWorkstream(title, explicit,
program)` — cascades: source's stored value → explicit-rule capture from the
title (VA "WS3", Ventura "Reservations:" prefix mapped to FAC) → keyword rules
→ program's fallback. **Write-path is `parseSourceWorkstream(title, program)`
and NEVER guesses** — it only persists what the source literally said.

The distinction matters: if the sync stored keyword guesses, a later rules
change couldn't re-derive old rows. Keep the two separate.

**Substring-keyword bug is a recurring hazard.** `SEARCH` inside "reSEARCH",
`API` in "rAPId", `VENUE` in "reVENUE" — all real bugs found on live data.
Every short keyword needs `\b` boundaries. `scratchpad/pattern-guard.ts` scans
for unreviewed substring matches; keep it in the regression suite.

### Live data vs. snapshots

The app can't reach live data locally without `SUPABASE_SERVICE_ROLE_KEY` (read
path) + `LOVABLE_API_KEY` + connector keys (sync). Snapshots in
`src/lib/snapshots/{va,ventura}.json` (+ `follow-ups.*.json`) hold what the
sources actually returned when I pulled them through the Linear + Notion MCPs.

Rules the snapshot fallback follows, in code:

1. **Supabase always wins.** Snapshot is only read when the live query fails
   or returns nothing (`sync.functions.ts` `readLive`).
2. **The origin travels with the rows** as `"live" | "snapshot" | "empty"`.
3. **The UI labels it in place** — footer shows Linear amber with "N
   snapshot" and a banner naming capture age; page subtitles say "captured
   snapshot" not "live from Linear."
4. **Off in production** unless `ALLOW_SNAPSHOT_FALLBACK=1`. A deployed
   instance showing month-old capture while claiming to be live is worse than
   showing nothing.

Do NOT remove these guarantees when adding new data paths.

### Follow-ups: the hybrid pattern

The one place the tool accepts input. Read `src/lib/follow-ups.ts` — the
architectural note at the top matters. **Candidates are DERIVED with
provenance; only DS decisions (done/dismissed/manual add) get typed.** That
keeps read-only-spine intact.

Candidates today are captured snapshots (from account records) because the
Granola content sync is deferred and Granola gateway access is shaky. Same
shape will accept live extraction later.

### Artifacts

`src/lib/artifacts/{ooxml,docx,xlsx,weekly-rollup,project-plan,poam}.ts`.
Pure `ProgramModel → bytes` functions, no dependencies. OOXML written by hand
because bunfig has a supply-chain hold and pulling a docx/xlsx package requires
a decision. STORE method zip (no compression) so it runs in a Cloudflare
Worker. Verified: CRC32 against published vectors, `unzip -t`, `textutil`,
`file` reports "Microsoft Excel 2007+" on the base64-round-tripped output.

**POA&M has a stricter rule than the others**: an unfillable column emits
`[NOT SOURCED]`, never an inferred value. Do not "helpfully" parse dates out
of prose to fill it. Register mitigation dates like "remediate before 10/15"
are not scheduled-completion commitments.

### The disclosure pattern (important)

Every panel that mixes real signal with placeholder inputs states it in place:

- Gate readiness: "not tracked yet" on exit-criteria (exit criteria aren't
  individually tracked in any source).
- Burn-down health: "N% inferred" badge when a workstream's issues are mostly
  keyword-attributed.
- Rollup / POA&M / project plan: unsourced sections get an explicit
  `> **Not yet sourced.**` marker, never a confident-looking empty section.
- Snapshot banner in the sidebar when data is captured, not live.

Every honesty change is a subtraction from misleading UI, not decoration. When
you're building a new panel, ask: "which of my inputs is real, which is a
placeholder?" and label the placeholders in place.

## What's built (branch `program-agnostic-refactor`)

**Phase A foundation ✅** — Program registry, model, phases, milestones (VA
Linear-sourced with config fallback), gate readiness math, source references,
sync-layer keys env-driven, workstream classifier per-program.

**Phase B rollup ✅** — Weekly Markdown rollup. Deterministic. Provenance
footer. Real 19-row Notion risk register wired for VA.

**Phase C project plan ✅** — `.docx`. From same ProgramModel.

**Phase D POA&M ✅** — `.xlsx`, FedRAMP 26 columns. Notion risk register for
VA, Linear-derived (`risk-register.linear.ts`) for Ventura.

**Phase E project switcher ✅** — `/p/$programId/*` routing, account-style
menu top-right, keeps your place across programs. `Escape` closes, outside
click closes. NOT a portfolio view; that was explicitly dropped.

**Artifacts page ✅** — `/p/$programId/artifacts` generates all three;
snapshot origin flagged.

**Follow-ups ✅** — Subnav under Team Tasks. Hybrid propose/curate model.
Real captured candidates for both programs. Command-center summary panel on
`/program-overview` shows top 6 open with inline mark-done.

**Customizable sidebar ✅** — Hide items you don't use (localStorage
`nav-hidden`). Never deletes, always recoverable via the "Customize sidebar"
control at the bottom of the nav.

**Program overview polish ✅** — Removed dead "Workstream quick-dive" and
"What's moving right now" sections; replaced with the follow-ups summary and
the gate readiness panel. Health is derived from Linear signals, not a
hand-typed field. Current-panel splits between sprint and phase views per
`timeAxis`. Milestone panel is program-driven via `upcomingMilestones()` in
config — no hardcoded "Sprint 5 start" labels.

**Snapshot-based real data ✅** — Both programs render real Linear content
(50 VA issues, 25 Ventura issues), real Notion risk register (19 rows),
correctly flagged as snapshot in the UI.

**Kaizen favicon ✅** — real multi-size `.ico` from
`the_kaizen_labs_logo.jpeg`, plus `kaizen-logo.png` referenced as PNG icon
and apple-touch-icon.

## What's NOT built / open work

**Aging on in-progress work** — from the original readout, third of the
three "make what's happening now visible" priorities. Not started. Would
show items sitting untouched for N days on the sprint board. Derivable from
Linear's `updatedAt`/`startedAt`.

**Read-only customer portal** — the "biggest single transparency lever" per
your original readout. Not started. Gated on Supabase RLS being tightened
(right now `anon` has `SELECT USING (true)` on all tables + publishable key
in public repo, so a deployed portal would leak stakeholder names and risk
descriptions).

**Per-project "start here" page** — not started.

**VA Current Sprint from Linear milestones** — the answer to the original
"is the sprint panel reading Linear?" question. Config strip happens to
match Linear today; wiring the picker to prefer Linear milestones when
present is the alignment task. Small.

**Live Granola content sync** — deferred. Would enable live follow-up
candidate extraction and unblock detection-from-transcripts on the risk
register.

**Notion database query capability through the Lovable gateway** — used
`blocks/children` because it was known to work (VA register is a table
block, not a database). If you need a Notion *database* query later, verify
the gateway supports `/notion/v1/databases/{id}/query` first.

**Anonymizing VA seed content into a reusable template** — the ~1400 lines
of remaining VA-specific text in `va-data.ts` / `va-glossary.ts` /
`workstream-updates.ts`. Deferred; content work, not engineering.

**Supabase write path for curation** — Follow-up decisions and sidebar prefs
live in localStorage. Per-user Supabase storage is the natural next step
once auth exists.

## Ground rules that keep getting rediscovered

**Cross-program leaks are the load-bearing bug class.** The isolation suite
(model layer) passes while route files, default parameters, and
module-level constants derived from `PROGRAM` silently render VA's data on
Ventura. Whenever you touch a component that shows program data:

- Take the program from `useProgram()` or a prop, never `import { PROGRAM }`.
- Anything computed from the program (`SPRINT_MILESTONES`, `WS_KEYS`, etc.)
  goes **inside the component body**, not module-level.
- No default program argument on any accessor. Compiler must catch omissions.
- Run `scratchpad/leak.sh` — 15 assertions that a program's identity,
  taxonomy, and content appear only on its own pages.

**Concurrency bug pattern.** Any hook that reads `prev` state and writes new
state via `setX(newValue)` will lose one update if called twice in a tick.
`setX((prev) => ...)` is the correct form. This showed up first in
`use-nav-prefs.ts` and `use-follow-ups.ts` — search for `setCuration(` or
`setHidden(` calls and check they take a function. Persist to localStorage
in a `useEffect` on the state, not inside each mutator, so functional
updates aren't fighting the persistence closure.

**Working directory drift.** `cd $S` inside a Bash tool call persists across
calls. If a Python script suddenly can't find `src/`, you're outside the
repo. Prefer absolute paths, or `cd /Users/mikesalib/Claude/PMK-Prototype`
explicitly at the top.

**Grep matches wrong on the built HTML.** Vite output has a null byte
early, which flips grep to binary mode and hides matches. Use `grep -a`
always when scanning built HTML.

**Local dates.** All calendar dates render through `src/lib/local-date.ts`.
`new Date("2026-12-01")` parses as UTC midnight and formats in local time,
so west of UTC it lands on Nov 30. Ventura's launch showed "Nov 30" for
one commit because of this. Do not directly `new Date(iso).toLocale…`.

**Sonner is the toast library.** Router is TanStack Router v1 file-based.
Bun runs everything.

## Verification you're expected to run before committing

```bash
# from repo root
eval "$(/opt/homebrew/bin/brew shellenv)"
bunx tsc --noEmit -p tsconfig.json    # tsc must be clean
bun run build                          # must build; catches server-only imports
$SCRATCH/leak.sh                       # cross-program leak assertions
bun run lint | grep -oE '[0-9]+ problems'   # compare to baseline
```

Current lint baseline: **155 errors** (down from 645 when the branch
started; several waves of route-file cleanup). Generated files
(`types.ts`, `routeTree.gen.ts`) are eslint-ignored — they carry
do-not-edit headers and 189+ permanent violations that would otherwise
drown out real regressions.

Regression suites in `scratchpad/`:
- `classify-check.ts` — VA classifier behavior + intended divergences from
  original
- `ventura-real.ts` — Ventura classifier against 29 real work items
- `pattern-guard.ts` — substring-keyword hazard detector
- `linear-risk-check.ts` — Linear→risk adapter, 25 checks
- `ms-check.ts` — milestone adapter, 12 checks
- `isolation-check.ts` — model-layer cross-program isolation
- `zip-check.ts` — OOXML container validity

Run any that touch code you edited. All pass on current HEAD.

## MCP connectors this session has

If your session has these too, real live data is one call away:

- **Linear** (`mcp__b9164682-…`) — projects, issues, milestones, cycles.
  VA project ID `3e9eebbb-e77c-473f-8509-4f8f3d0df140`. Ventura project ID
  `b7d98661-7d8a-47d7-addf-096bc73a7752`.
- **Notion** (`mcp__b11cdd6d-…`) — fetch pages, query data sources. VA hub
  page `35968467f30f80ef87dbc6e3585b52de`. VA risk register table
  `3ab68467f30f8125bd3ecdccaf6b0ef4`. Rec Deployment Playbook
  `33e68467f30f804a8c56e47846d0a36d`.
- **Granola** (`mcp__f6e6bf1c-…`) — meetings by folder or participant
  domain. Access is shaky; VA folder returns 403.

Note the app itself can't reach these live — it needs its own
`LOVABLE_API_KEY` + connector keys. The connectors in a Claude session are
for building snapshots and verifying assumptions, not for the runtime.

## First-day advice

If the user asks for a new feature, before writing any code:

1. Read the section of this doc that's closest to what they're asking for.
2. If it involves data on screen, ask: **which of my inputs are real,
   which are stand-ins?** Plan to disclose the stand-ins in place.
3. If it involves both programs, plan the model-layer change, not a route
   patch. Then check `leak.sh` still passes.
4. If a hook writes state after reading state, use the functional updater.
5. Run the verification block. Commit small, push to
   `program-agnostic-refactor`.

The commit history is verbose on purpose — read the last few commits with
`git log -p --stat HEAD~5..HEAD` to see the style. Explain WHY, name what
you didn't do, and confess self-corrections in the same commit rather than
hiding them.

## Where the user is in the arc

He's the deployment strategist for VA and Ventura. He came in wanting a
program-agnostic refactor of a Lovable-built dashboard; the session
reframed it (with his agreement) into a federated read-layer that emits
documents, then built two real programs on the same shell as proof. He
values honest disclosure over polished-looking UI, prefers "not sourced"
markers to invented values, and has caught me hardcoding VA labels into
"generic" code more than once. Take that as a signal — this codebase is
allergic to guesses that render as measurements.

He rejected a cross-Kaizen portfolio view (in favor of the account-style
switcher) and asked for the customizable sidebar because "not everything
is useful for everyone always but there's good stuff in each." Both are
worth remembering: he'd rather be able to switch off a whole page than
delete it, and he doesn't want Kaizen-wide roll-ups mixed into
strategist-scope work.

That's the shape of what to build.
