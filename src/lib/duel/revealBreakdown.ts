/**
 * The reveal's breakdown in plain words (3 Nov 2026, Joe's audit of all 92 games; display only, never a regrade).
 *
 * The server stores each run's breakdown lines (round_results.extra.reveal.lines, built by the server replay); this
 * module reads them as stored and writes them for people:
 *   - no arrows: "Distance: 412 ft → 110 of 130" is the row "Distance · 412 ft · 110 of 130", or as one line
 *     "Distance: 412 ft: 110 of 130 points"; "3 / 25 clays → 2" reads "3 of 25 clays: 2 points";
 *   - one line per item, at most one "·" a line (a stored line with more splits into rows), no duplicates;
 *   - singular for one ("1 word", "1 swap"), lower-case units ("2.6 s", never "2.6S");
 *   - the rows add up to the score shown: a standard run's parts, then any gap between their sum and the stored
 *     score written out (penalties, or the at-least-1 for playing), then the total.
 *
 * Every row keeps the stored line it came from (`line`), so a check can prove no stored line is lost.
 */

export interface BreakdownRow {
  /** The stored line this row was read from (exactly as stored). */
  line: string;
  kind: "part" | "adjust" | "total" | "note";
  /** The part's name ("Distance"), or the whole text for a note. */
  name: string;
  /** What the run did ("412 ft"), when the line says. */
  detail: string | null;
  /** Points this row adds (signed); null for a note with no figure. */
  points: number | null;
  /** The part's maximum, when stored. */
  max: number | null;
}

/** A standard part line (stdLines): "<label>: <detail> → <points> of <max>". */
const STD_PART = /^([^:→]+): (.*) → (-?\d+) of (\d+)$/;
const TOTAL = /^Total → (\d+)(?: of (\d+))?(?: · (.+))?$/;
const AT_LEAST_ONE = /^At least 1 for playing → (\d+)$/;
/** A penalty line (arcadeBandStd.ts): "Penalty: 2 lives lost → −10". */
export const PENALTY_LINE = /^Penalty: (.*) → [−-](\d+)$/;
/** A named cost (engineBreakdown.ts, 6 Nov 2026): "Cost: Wrong colour: 2 taps → −7". */
export const COST_LINE = /^Cost: ([^:]+): (.*) → [−-](\d+)$/;
const NO_INPUT = /^(.*) · no input → 0$/;
/** Any other "<text> → <number>[ rest]" line. */
const ARROW_POINTS = /^(.*?) → ([−-]?\d+)$/;

/** Plural words that don't take a plain -s off. */
const SINGULAR: Record<string, string> = {
  lives: "life",
  points: "point",
  bonuses: "bonus",
  buses: "bus",
  boxes: "box",
  matches: "match",
  dishes: "dish",
  pieces: "piece",
  tries: "try",
  chillies: "chilli",
  combos: "combo",
  misses: "miss",
  passes: "pass",
  crosses: "cross",
  touches: "touch",
  switches: "switch",
  shelves: "shelf",
  leaves: "leaf",
};
/** Words ending in s that are already singular (or uncountable) and must never lose it. */
const KEEP_S = new Set(["pass", "miss", "bus", "bonus", "cross", "gas", "plus", "minus", "status", "this", "is", "was", "has", "as", "us", "chess", "less", "class", "glass", "grass", "boss", "loss", "press", "progress", "success", "access", "focus", "radius", "canvas", "series", "species", "ms", "s", "yes", "always", "its", "his", "lens", "pls", "physics"]);

function singularOf(word: string): string {
  const lower = word.toLowerCase();
  if (SINGULAR[lower]) return matchCase(word, SINGULAR[lower]!);
  if (KEEP_S.has(lower) || !/s$/i.test(word) || word.length < 3) return word;
  if (/ies$/i.test(word)) return word.slice(0, -3) + "y";
  if (/(ss|sh|ch|x|z)es$/i.test(word)) return word.slice(0, -2);
  if (/ss$/i.test(word) || /us$/i.test(word)) return word;
  return word.slice(0, -1);
}

function matchCase(original: string, word: string): string {
  if (original === original.toUpperCase()) return word.toUpperCase();
  if (original[0] === original[0]!.toUpperCase()) return word[0]!.toUpperCase() + word.slice(1);
  return word;
}

/** Singular after a lone 1: "1 words" → "1 word", "1 swaps" → "1 swap" (never "21 words", "1.5 words", "of 1"). */
function singular(text: string): string {
  return text.replace(/(^|[^\d.,/])1 ([A-Za-z]+)\b/g, (m, before: string, word: string) => {
    if (word === "words") return `${before}1 word`;
    return `${before}1 ${singularOf(word)}`;
  });
}

/** Plain words for one stored fragment: no arrows, "of" for counts, lower-case units, singular for one. */
export function plainText(text: string): string {
  let out = text
    // Internal targets never reach a player (text pass, 4 Nov 2026): "(120 at 28)", ", full at 51", "in thousandths".
    .replace(/\s*\((?:full |all )?(?:at )?[\d,.]+ at [\d,.]+[^)]*\)/g, "")
    .replace(/,?\s*\bfull at [\d,.]+(?:\s*[a-z%]+)?/gi, "")
    .replace(/,?\s*in thousandths/gi, "")
    // "(84 from the rows + 0 from column 2) × 1.4": "84 from the rows + 0 from column 2, times 1.4".
    .replace(/^\((.+)\) × ([\d.]+)$/, "$1, times $2")
    // "2 lives lost × 5" (a count and its cost each): "2 lives lost, 5 each" (6 Nov 2026, Joe's review).
    .replace(/^(\d+ [A-Za-z][A-Za-z ]*?) × (\d+)$/, "$1, $2 each")
    .replace(/\s×\s/g, " times ")
    // "12 / 40" and "12/40" between figures: "12 of 40".
    .replace(/(\d)\s*\/\s*(\d)/g, "$1 of $2")
    // An arrow left in the middle of a phrase reads as a colon.
    .replace(/\s*→\s*/g, ": ")
    // Upper-case units drawn by a shouting label ("2.6S", "60.0 S", "12MS"): lower-case.
    .replace(/(\d)\s?(MS|S|M|KM\/H|FT|CM)\b/g, (_, d: string, unit: string) => `${d} ${unit.toLowerCase()}`)
    .replace(/\s{2,}/g, " ")
    .trim();
  out = singular(out);
  return out;
}

/** "N points" with the singular for one. */
export function pointsWord(n: number): string {
  const abs = Math.abs(n);
  return `${n < 0 ? "−" : ""}${abs} ${abs === 1 ? "point" : "points"}`;
}

/** A stored line with more than one " · " splits into pieces, so no row carries more than one. */
function pieces(text: string): string[] {
  const parts = text.split(" · ");
  if (parts.length <= 2) return [text];
  return parts;
}

const num = (s: string) => Number(s.replace("−", "-"));

/**
 * The breakdown rows for a run's stored lines and stored score. Standard runs (two or more part lines) get a row a
 * part, then the gap to the score written out ("Penalties" below the parts' sum, "At least 1 for playing" above it),
 * then the total; anything else gets a row a stored line, in plain words, one "·" at most, each fact once.
 */
export function breakdownRows(lines: readonly string[], score: number | null): BreakdownRow[] {
  const rows: BreakdownRow[] = [];
  const seen = new Set<string>();
  const push = (row: BreakdownRow) => {
    const key = `${row.kind}|${row.name}|${row.detail ?? ""}|${row.points ?? ""}|${row.max ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push(row);
  };
  let partSum = 0;
  let maxSum = 0;
  let parts = 0;
  let total: BreakdownRow | null = null;
  for (const line of lines) {
    const std = STD_PART.exec(line);
    if (std) {
      parts++;
      partSum += num(std[3]!);
      maxSum += num(std[4]!);
      push({ line, kind: "part", name: plainText(std[1]!), detail: plainText(std[2]!), points: num(std[3]!), max: num(std[4]!) });
      continue;
    }
    const pen = PENALTY_LINE.exec(line);
    if (pen) {
      partSum -= num(pen[2]!);
      push({ line, kind: "adjust", name: "Penalty", detail: plainText(pen[1]!), points: -num(pen[2]!), max: null });
      continue;
    }
    const named = COST_LINE.exec(line);
    if (named) {
      partSum -= num(named[3]!);
      push({ line, kind: "adjust", name: plainText(named[1]!), detail: plainText(named[2]!), points: -num(named[3]!), max: null });
      continue;
    }
    const tot = TOTAL.exec(line);
    if (tot) {
      total = { line, kind: "total", name: "Total", detail: null, points: num(tot[1]!), max: tot[2] ? num(tot[2]) : null };
      if (tot[3]) push({ line, kind: "note", name: plainText(tot[3]), detail: null, points: null, max: null });
      continue;
    }
    const least = AT_LEAST_ONE.exec(line);
    if (least) {
      // Written out below from the parts' sum; the stored line is kept on the total row.
      total = { line, kind: "total", name: "Total", detail: null, points: num(least[1]!), max: null };
      continue;
    }
    const none = NO_INPUT.exec(line);
    if (none) {
      // "0 waves · 0 ships · 0 armour hits · …: no input": one row a fact, then "No input: 0 points".
      for (const piece of none[1]!.split(" · ")) push({ line, kind: "note", name: plainText(piece), detail: null, points: null, max: null });
      push({ line, kind: "note", name: "No input", detail: null, points: 0, max: null });
      continue;
    }
    for (const piece of pieces(line)) {
      const arrow = ARROW_POINTS.exec(piece);
      if (arrow) {
        push({ line, kind: "note", name: plainText(arrow[1]!), detail: null, points: num(arrow[2]!), max: null });
        continue;
      }
      // "Board cleared → 130 · time +12": the arrow's figure and the extra as their own rows.
      const mid = /^(.*?) → ([−-]?\d+) · (.+)$/.exec(piece);
      if (mid) {
        push({ line, kind: "note", name: plainText(mid[1]!), detail: null, points: num(mid[2]!), max: null });
        push({ line, kind: "note", name: plainText(mid[3]!), detail: null, points: null, max: null });
        continue;
      }
      push({ line, kind: "note", name: plainText(piece), detail: null, points: null, max: null });
    }
  }
  // The standard's parts add up to the score shown: write out any gap (penalties, or the 1 for playing).
  if (parts >= 1 && score !== null && partSum !== score) {
    const gap = score - partSum;
    const adjustLine = total?.line ?? "";
    push({
      line: adjustLine,
      kind: "adjust",
      name: gap > 0 && partSum < 1 ? "At least 1 for playing" : gap < 0 ? "Penalties" : "Adjustment",
      detail: null,
      points: gap,
      max: null,
    });
  }
  // Every standard total reads "N of 200" (4 Nov 2026: Cue Ball's said "145 points" where a penalty made it differ).
  if (total && total.max === null && parts >= 2) total = { ...total, max: maxSum };
  if (total) rows.push(total);
  else if (parts >= 1 && score !== null) rows.push({ line: "", kind: "total", name: "Total", detail: null, points: score, max: parts >= 2 ? maxSum : null });
  return rows;
}

/** One row as one line of plain words: "Distance: 412 ft: 110 of 130 points", "3 of 25 clays: 2 points". */
export function rowText(row: BreakdownRow): string {
  const figure =
    row.points === null ? null : row.max !== null ? `${row.points} of ${row.max} ${row.max === 1 ? "point" : "points"}` : row.kind === "adjust" && row.points > 0 ? `+${pointsWord(row.points)}` : pointsWord(row.points);
  const head = row.detail ? `${row.name}: ${row.detail}` : row.name;
  return figure === null ? head : `${head}: ${figure}`;
}

/**
 * A real full clear (3 Nov 2026: "Full clear!" showed on scores as low as 1, Flightpath, Home Run, Curl Champ, Ringer,
 * Five Hands, whose runs always "finish"): the server's finish outcome and, on the standard, the core part (the first)
 * at its maximum; a game off the standard needs FULL_CLEAR_MIN_SCORE.
 */
export const FULL_CLEAR_MIN_SCORE = 150;
/** Whether a core part's detail says the whole of it was done: no "N of M" short of M, no percentage under 100. */
function wholeDone(detail: string): boolean {
  for (const m of detail.matchAll(/(\d+) (?:of|\/) (\d+)/g)) if (Number(m[1]) < Number(m[2])) return false;
  for (const m of detail.matchAll(/(\d+(?:\.\d+)?) ?% of/g)) if (Number(m[1]) < 100) return false;
  return true;
}
export function realFullClear(outcome: string | undefined, lines: readonly string[], score: number | null): boolean {
  if (outcome !== "finish" || score === null) return false;
  const core = lines.map((l) => STD_PART.exec(l)).find(Boolean);
  // A core full before the whole course (6 Nov 2026: Grappler's course part is full at 70 % of the course, and "Full
  // clear!" showed at 85 %): every counted item ("44 of 51 stretches", "85 % of the course") must be done too.
  if (core && !wholeDone(core[2]!)) return false;
  if (core) return num(core[3]!) >= num(core[4]!);
  return score >= FULL_CLEAR_MIN_SCORE;
}

/** The room reveal's one-line summary in plain words ("13 of 15 barriers: 132 points"; the standard's line as is). */
export function summaryText(summary: string): string {
  if (/^\d+ points?, .+ \d+ [+−] (?:bonuses|penalties) \d+$/.test(summary)) return summary;
  const rows = breakdownRows([summary], null);
  return rows.map(rowText).slice(0, 2).join(", ");
}

/* ---- The stats card under an arcade breakdown (4 Nov 2026, Joe's review): only what the parts don't already say. ---- */

/**
 * Whether a stat states what a part's detail already says (6 Nov 2026, Joe's review: Summit's and Thirteen's "Time
 * 23.0 s" under "Speed: cleared in 23.0 s", Thirteen's "Removed 28 / 28" under "28 of 28 removed", Curl Champ's "In the
 * 4-foot 6 / 8" under "Red ring: 6 in the 4-foot"): its value with its unit appears in a detail, or its first figure and
 * every word of its label do.
 */
function statInDetails(label: string, value: string, lines: readonly string[]): boolean {
  const details = lines.map((l) => STD_PART.exec(l)?.[2]).filter((d): d is string => Boolean(d)).map((d) => plainText(d).toLowerCase());
  if (!details.length) return false;
  const shown = plainText(value).toLowerCase();
  if (/[a-z]/.test(shown) && /\d/.test(shown) && details.some((d) => d.includes(shown))) return true;
  const figure = /\d+(?:\.\d+)?/.exec(shown)?.[0];
  if (!figure) return false;
  const words = [...statWords(label)];
  if (!words.length) return false;
  return details.some((d) => new RegExp(`(^|[^\\d.])${figure.replace(".", "\\.")}(?![\\d.])`).test(d) && words.every((w) => statWords(d).has(w)));
}

/** Words too common to tie a stat to a part. */
const STAT_STOP = new Set(["the", "and", "for", "best", "left", "total", "all", "per", "with", "your", "off", "out"]);

function statWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/j-o-u-l-z/g, "joulz")
      .split(/[^a-z]+/)
      .filter((w) => w.length >= 3 && !STAT_STOP.has(w))
      .map((w) => singularOf(w)),
  );
}

/** Stat labels that are never extra facts: jargon, or the parts' sum by another name. */
const STAT_NEVER = /^(full at|features?|bonus|core|paddle)$/i;

/**
 * Whether a stored stat repeats a part of the run's standard breakdown (its label shares a word with a part's name,
 * "Far buckets" with "Far buckets", "J-O-U-L-Z" with "J-O-U-L-Z", "The black" with "Black"), or is jargon ("Full at",
 * "Features"). Runs not on the standard keep every stat.
 */
export function statRepeatsPart(label: string, lines: readonly string[], partLabels: readonly string[] = [], value?: string): boolean {
  if (STAT_NEVER.test(label.trim())) return true;
  if (value !== undefined && statInDetails(label, value, lines)) return true;
  // The part names from the stored lines, else from the game's spec (a run with no input stores one line).
  const fromLines = lines.map((l) => STD_PART.exec(l)?.[1]).filter((n): n is string => Boolean(n));
  const names = fromLines.length >= 2 ? fromLines : partLabels;
  if (names.length < 2) return false;
  const words = statWords(label);
  if (!words.size) return false;
  return names.some((name) => {
    const part = statWords(name);
    return [...words].some((w) => part.has(w));
  });
}

/**
 * An engine game's stored lines on the puzzle reveal in real points only (4 Nov 2026, Joe's review: Bonk's "Total −6
 * wrong · −207 empty" and Pull!'s "−0 from the total" were costs taken off the run's total before its curve, never off
 * the score): a cost on the total, or a cost of 0, is left out (the counts stay as stats under the rows); anything else
 * reads as stored.
 */
export function engineLines(type: string, lines: readonly string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    if (type === "whack" && /(^|·\s*)[−-]\d+ (wrong|hedgehogs|empty)\b/.test(line)) {
      // "Total −6 wrong · −207 empty · +15 all targets": the costs are the total's; the bonus for every target stays.
      const kept = line.replace(/^Total /, "").split(" · ").filter((p) => !/^[−-]\d+ /.test(p));
      if (kept.length) out.push(kept.map((p) => (/^\+15 all targets$/.test(p) ? "All targets hit" : p)).join(" · "));
      continue;
    }
    if (type === "clayshoot" && /birds? hit · [−-]\d+/.test(line) && (/ from the total$/.test(line) || /[−-]0\b/.test(line))) continue;
    if (/[−-]0(?!\d)/.test(line) && !/→/.test(line)) continue;
    // Extras that paid nothing ("Combo +0 (best run 0) · diamonds +0 (0 of 2)") are left out, piece by piece.
    if (!/→/.test(line) && /\+0(?!\d)/.test(line)) {
      const kept = line.split(" · ").filter((p) => !/\+0(?!\d)/.test(p));
      if (kept.length) out.push(kept.join(" · "));
      continue;
    }
    out.push(line);
  }
  return out;
}
