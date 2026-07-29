// Per-program seed content.
//
// This exists because five routes imported VA's seed arrays directly and
// rendered them for whatever program was in the URL. /p/ventura/risks listed
// VA's eleven risks, filterable by WS1-WS5, owned by Brad and Lindsey. The model
// layer had already been made program-aware; the pages had not, so the leak was
// invisible to every test that went through ProgramModel.
//
// The registry is deliberately explicit rather than defaulting: a program absent
// from a map gets an empty list, and the page shows an empty state saying so. A
// silent fallback to VA is the exact failure being removed.
//
// This is a way station, not the destination. Hand-authored content in the app
// is the thing the whole design is trying to eliminate — these should become
// sourced records with provenance. Keeping them here, keyed by program, at least
// stops one engagement's content appearing under another's name.

import { ORGS, LIFECYCLE, RISKS, type Org, type LifecyclePhase, type Risk } from "./va-data";
import { GLOSSARY, GLOSSARY_CATEGORIES, GLOSSARY_SOURCE, type GlossaryEntry } from "./va-glossary";
import {
  CROSS_DEPS,
  WORKSTREAM_UPDATES,
  WORKSTREAM_UPDATES_SOURCE,
  type CrossDep,
  type WorkstreamUpdate,
} from "./workstream-updates";

export interface ProgramSeed {
  risks: Risk[];
  orgs: Org[];
  lifecycle: LifecyclePhase[];
  crossDeps: CrossDep[];
  workstreamUpdates: WorkstreamUpdate[];
  workstreamUpdatesSource: typeof WORKSTREAM_UPDATES_SOURCE | null;
  glossary: GlossaryEntry[];
  glossaryCategories: typeof GLOSSARY_CATEGORIES;
  glossarySource: typeof GLOSSARY_SOURCE | null;
}

const EMPTY: ProgramSeed = {
  risks: [],
  orgs: [],
  lifecycle: [],
  crossDeps: [],
  workstreamUpdates: [],
  workstreamUpdatesSource: null,
  glossary: [],
  glossaryCategories: [],
  glossarySource: null,
};

const SEED_BY_PROGRAM: Record<string, ProgramSeed> = {
  va: {
    risks: RISKS,
    orgs: ORGS,
    lifecycle: LIFECYCLE,
    crossDeps: CROSS_DEPS,
    workstreamUpdates: WORKSTREAM_UPDATES,
    workstreamUpdatesSource: WORKSTREAM_UPDATES_SOURCE,
    glossary: GLOSSARY,
    glossaryCategories: GLOSSARY_CATEGORIES,
    glossarySource: GLOSSARY_SOURCE,
  },
  // Ventura has no hand-authored seed content, and should not borrow VA's.
  // Its risks come off the Linear board; the rest is genuinely absent and the
  // pages say so.
  ventura: EMPTY,
};

export function seedFor(programId: string): ProgramSeed {
  return SEED_BY_PROGRAM[programId] ?? EMPTY;
}
