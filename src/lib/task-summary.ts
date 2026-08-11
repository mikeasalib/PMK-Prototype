// Split a hand-written tracker task into a scannable headline and the detail
// behind it.
//
// The tracker is written as working notes, not as a status report. Lines run to
// three sentences with parentheticals, embedded decisions, and cross-references:
//
//   "shannon ford to update the figma from the 8/5 benefits discussion (vivian
//    has no figma access). covers updates-section structure, nav scope, itf
//    placement. iterate on figma rather than regenerating the blue-sky
//    prototype."
//
// Rendered verbatim in a list, sixty of those is a wall. Rendered as a headline
// with the rest available underneath, it is a list you can scan.
//
// This is pure text surgery — split, trim, capitalise. It never paraphrases and
// never drops information: `detail` holds the exact remainder, and every
// surface keeps the full original reachable (title attribute, link to the
// block). A summariser that rewrote the author's words would be inventing, and
// the whole read layer is built on not doing that.

/** A tracker line, split for display. */
export interface TaskSummary {
  /** Short scannable form. Always non-empty. */
  headline: string;
  /** Exact remaining text, or null when the line was already short. */
  detail: string | null;
  /** True when `headline` was cut mid-sentence rather than at a natural break. */
  truncated: boolean;
}

/** Longest headline we will render before truncating at a word boundary. */
const MAX_HEADLINE = 78;
/** A break only marks a headline when the prefix is a useful length. Below
 *  this a fragment like "fix:" says nothing; "sticker sheet" does. */
const MIN_COLON_PREFIX = 10;
const MAX_COLON_PREFIX = 72;

const TICKET_RE = /\s*\[?\b(?:DEP|REC)-\d+\b\]?/g;

export function summarizeTask(raw: string): TaskSummary {
  // Ticket refs render as their own chip, so they are noise inside a headline.
  // Stripped from the display text only — callers keep the parsed refs.
  const text = raw.replace(TICKET_RE, "").replace(/\s{2,}/g, " ").trim();
  if (!text) return { headline: raw.trim(), detail: null, truncated: false };

  // A line that already fits is already a headline. Splitting it loses
  // information for no gain — a Linear title like "Data/Architecture
  // Conversation for MyVA Subpage: Benefits" is 57 characters, and breaking at
  // the colon dropped the only word distinguishing it from the Payments and
  // Forms tickets beside it. Splitting exists to tame long prose, not to
  // shorten things that are already short.
  if (text.length <= MAX_HEADLINE) {
    return { headline: capitalise(text), detail: null, truncated: false };
  }

  const cut = findBreak(text);
  if (cut !== null) {
    const head = text.slice(0, cut.end).trim().replace(/[,;:.\s]+$/, "");
    const rest = text.slice(cut.restFrom).trim();
    if (head.length >= MIN_COLON_PREFIX && head.length <= MAX_HEADLINE) {
      return {
        headline: capitalise(head),
        detail: rest ? capitalise(rest) : null,
        truncated: false,
      };
    }
  }

  // No natural break, or the break produced something unusable. Cut at the
  // last word inside the budget.
  const slice = text.slice(0, MAX_HEADLINE);
  const lastSpace = slice.lastIndexOf(" ");
  const head = (lastSpace > MAX_HEADLINE * 0.6 ? slice.slice(0, lastSpace) : slice).replace(
    /[,;:.\s]+$/,
    "",
  );
  return {
    headline: `${capitalise(head)}…`,
    // Detail is the FULL line, not the tail. A reader opening the detail wants
    // the whole thought, not a fragment starting mid-clause.
    detail: capitalise(text),
    truncated: true,
  };
}

interface Break {
  /** Index the headline ends at (exclusive). */
  end: number;
  /** Index the detail starts from. */
  restFrom: number;
}

/**
 * Earliest natural break in the line.
 *
 * Colon wins when its prefix is a sensible headline length, because on this
 * tracker a colon almost always separates "what" from "the specifics". A
 * parenthetical or a sentence end is the fallback. Whichever appears first in
 * the string wins among the candidates that qualify.
 */
function findBreak(text: string): Break | null {
  const candidates: Break[] = [];

  const colon = text.indexOf(": ");
  if (colon >= MIN_COLON_PREFIX && colon <= MAX_COLON_PREFIX) {
    candidates.push({ end: colon, restFrom: colon + 2 });
  }

  const paren = text.indexOf(" (");
  if (paren >= MIN_COLON_PREFIX) {
    candidates.push({ end: paren, restFrom: paren + 1 });
  }

  // Sentence end: a period followed by a space. Guarded against decimals and
  // common abbreviations that would otherwise split a line in half.
  const sentence = findSentenceEnd(text);
  if (sentence !== null && sentence >= MIN_COLON_PREFIX) {
    candidates.push({ end: sentence, restFrom: sentence + 2 });
  }

  if (candidates.length > 0) {
    return candidates.sort((a, b) => a.end - b.end)[0];
  }

  // Last resort, and only for lines that would otherwise be cut mid-word: a
  // comma. "cap nav at two accordion levels, third-level drilling dropped per
  // accessibility findings" reads far better broken at the comma than sliced
  // at character 78. Not a first-tier candidate because most lines use commas
  // inside a single clause, where splitting would mangle the meaning.
  if (text.length > MAX_HEADLINE) {
    const comma = text.indexOf(", ");
    if (comma >= MIN_COLON_PREFIX && comma <= MAX_HEADLINE) {
      return { end: comma, restFrom: comma + 2 };
    }
  }

  return null;
}

/** Index of the first real sentence-ending period, or null. */
function findSentenceEnd(text: string): number | null {
  for (let i = 0; i < text.length - 1; i++) {
    if (text[i] !== ".") continue;
    if (text[i + 1] !== " ") continue;
    // "e.g. " / "i.e. " / "vs. " and decimals like "1.5 " are not sentence ends.
    const before = text.slice(Math.max(0, i - 4), i).toLowerCase();
    if (/\b(e\.g|i\.e|vs|etc|approx|no|fig)$/.test(before)) continue;
    if (/\d$/.test(before) && /^\s?\d/.test(text.slice(i + 1, i + 3))) continue;
    return i;
  }
  return null;
}

/** Uppercase the first letter. The tracker is written in lowercase; a list of
 *  sentence-case headlines reads as a status report rather than as notes. */
function capitalise(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Shorten a section heading for display.
 *
 * The tracker numbers its headings ("1. daman design revisions (ws3)") and
 * dates its additions ("net new from 8/4 auth exp sync + daman's design system
 * drop"). Both are meaningful to the author and noisy in a summary, so the
 * numeric prefix goes and the rest is capitalised. The original is kept by
 * callers for the title attribute.
 */
export function tidySection(section: string): string {
  const stripped = section.replace(/^\s*\d+[.)]\s*/, "").trim();
  return capitalise(stripped || section);
}
