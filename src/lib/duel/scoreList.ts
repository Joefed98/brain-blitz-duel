/**
 * Player-facing score text as a short list (text pass, 4 Nov 2026): the "?" help's SCORE is one line per part
 * ("Part: how you earn it, up to N."), then penalties, then "Total 200." The help draws it a sentence a row
 * (`scoreParts` in PuzzleInstructions.tsx), so each part is one sentence and no part holds ". " before a capital.
 *
 * Plain words only: no "core", "features", "full at N", "units" or "in thousandths" (score-text-check proves it).
 * Shared and pure.
 */
import { STANDARD_FINISH, STANDARD_UNFINISHED_CAP } from "./standard/shape";

export interface ScoreLine {
  /** The part's name, e.g. "Lines". */
  label: string;
  /** How you earn it, in plain words, e.g. "clear rows". Empty to state the label and points alone. */
  how: string;
  /** The most it can earn ("up to N"). */
  max?: number;
  /** A fixed amount instead ("Finish: …, 150."). */
  fixed?: number;
}

const sentence = (s: string) => {
  const t = s.trim();
  if (!t) return "";
  const cap = t[0]!.toUpperCase() + t.slice(1);
  return /[.!?]$/.test(cap) ? cap : `${cap}.`;
};

/** One part as a line: "Label: how, up to N." */
export function scoreLine(line: ScoreLine): string {
  const amount = line.fixed !== undefined ? String(line.fixed) : line.max !== undefined ? `up to ${line.max}` : "";
  const body = [line.how, amount].filter(Boolean).join(", ");
  return `${line.label}: ${body}.`;
}

/** The whole list: parts, then penalties and notes (each a sentence), then "Total N." */
export function scoreList(lines: readonly ScoreLine[], opts: { penalties?: readonly string[] | undefined; total?: number | undefined } = {}): string {
  const out = lines.map(scoreLine);
  for (const p of opts.penalties ?? []) {
    const s = sentence(p);
    if (s) out.push(s);
  }
  if (opts.total !== undefined) out.push(`Total ${opts.total}.`);
  return out.join(" ");
}

/** A speed line in plain words: "Speed: finish within 45 s for all of it, falling to 0 at the buzzer, up to 40." */
export function speedLine(max: number, fullByS: number, what = "finish"): ScoreLine {
  return { label: "Speed", how: `${what} within ${fullByS} s for all of it, falling to 0 at the buzzer`, max };
}

/**
 * A finish puzzle's help list on the scoring standard: Finish 150, Speed, the bonuses, Not finished (up to 130), the
 * penalties, then the total.
 */
export function puzzleScoreList(o: {
  /** What a finish is, e.g. "solve the whole grid". */
  finish: string;
  finishLabel?: string;
  speed?: { max: number; fullByS: number; what?: string | undefined; note?: string | undefined };
  bonuses?: readonly ScoreLine[];
  /** What counts when unfinished, e.g. "the share of cells right, more for filling them early". */
  unfinished: string;
  penalties?: readonly string[];
  total: number;
}): string {
  const lines: ScoreLine[] = [{ label: o.finishLabel ?? "Finish", how: o.finish, fixed: STANDARD_FINISH }];
  if (o.speed && o.speed.max > 0) {
    const sp = speedLine(o.speed.max, o.speed.fullByS, o.speed.what);
    lines.push(o.speed.note ? { ...sp, how: `${sp.how} (${o.speed.note})` } : sp);
  }
  lines.push(...(o.bonuses ?? []));
  lines.push({ label: "Not finished", how: o.unfinished, max: STANDARD_UNFINISHED_CAP });
  return scoreList(lines, { penalties: o.penalties, total: o.total });
}

/**
 * A score text as its rows: one sentence a row, split after a full stop followed by a space and a capital or digit, so
 * decimals ("2.5 s") and abbreviations stay whole (the intro's and the help's SCORE lists draw these rows).
 */
export function scoreSentences(text: string | undefined): string[] {
  return (text ?? "")
    .split(/(?<=[.!])\s+(?=[A-Z0-9])/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Whether a help list has the part "Label: …, up to N." (checks read it). */
export function hasScorePart(text: string, label: string, max: number): boolean {
  return scoreSentences(text).some((row) => row.startsWith(`${label}: `) && row.endsWith(`up to ${max}.`));
}

/** Words a player should never read in score text (internal jargon). */
export const SCORE_JARGON: readonly RegExp[] = [
  /\b(?<!open )core\b/i,
  /\bfeatures?\b/i,
  /\bfull at\b/i,
  /\bunits?\b/i,
  /thousandths/i,
  /per mille/i,
  /A good run \(/,
  /\bnow\b/i,
  /than before/i,
  /→/,
];
