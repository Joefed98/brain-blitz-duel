/**
 * Bonk, Pull! and Mixed Signals on the puzzle reveal (6 Nov 2026, Joe's review; display only, never a regrade): their
 * stored lines said what the run did ("4 of 64 hits", "39 wrong", "0 net") but not why the score was what it was,
 * because the costs came off a total before its curve. This module writes the run's score as rows that add up to it,
 * in the breakdown's own line formats (revealBreakdown.ts): a part "Hits: 4 of 64 → 9 of 150", a cost
 * "Cost: Wrong colour: 2 taps → −7", and the total. Every figure is worked out from the stored counts with the game's
 * own scoring functions, each cost taken in turn (the score with it less the score without it, through the game's
 * curve), and the rows are used only when they add up exactly to the stored score and to the stored parts (`depth`);
 * otherwise (an older stamp, a missing count) the stored lines show as before.
 */
import { bandMapTotal } from "@/lib/arcade/scoreBands";
import { CLAY_CONFIG, CLAY_DOUBLE_POINTS, CLAY_DOUBLES, CLAY_FREE_EMPTY_SHOTS, CLAY_QUICK_HIT_MAP, CLAY_QUICK_POINTS, CLAY_STREAK_POINTS, clayScore } from "@/lib/arcade/clayShoot";
import { CLASH_STD_FINISH, CLASH_STD_GOLD, CLASH_STD_SHARE, CLASH_STD_SPEED, CLASH_STD_STREAK, CLASH_STD_UNFINISHED_TOP } from "@/lib/arcade/colourClash";
import {
  WHACK_BANDS_MAP,
  WHACK_BOMB_PENALTY,
  WHACK_COMBO_POINTS,
  WHACK_DIAMOND_POINTS,
  WHACK_EMPTY_PENALTY,
  WHACK_HIT_POINTS,
  WHACK_PERFECT_BONUS,
  WHACK_WRONG_PENALTY,
} from "@/lib/arcade/whack";

type Extra = Record<string, unknown> | null | undefined;

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
/** Halves up, as the sims round (colourClash.ts roundDiv). */
const roundDiv = (a: number, b: number) => Math.floor((2 * a + b) / (2 * b));
const cost = (label: string, detail: string, points: number) => `Cost: ${label}: ${detail} → −${Math.abs(points)}`;
const part = (label: string, detail: string, points: number, max: number) => `${label}: ${detail} → ${points} of ${max}`;
/** Parts and costs as lines; the sum the rows add up to. */
type Rows = { lines: string[]; sum: number };
function rows(...entries: ([string, number] | null)[]): Rows {
  const lines: string[] = [];
  let sum = 0;
  for (const e of entries) {
    if (!e) continue;
    lines.push(e[0]);
    sum += e[1];
  }
  return { lines, sum };
}

/** Bonk (whackRev 3 and 4): hits, then each cost through the band map, then the combo and the diamonds. */
function whackRows(extra: Extra): Rows | null {
  const hits = num(extra?.["hits"]);
  const total = num(extra?.["totalTargets"]);
  const wrong = num(extra?.["wrong"]) ?? 0;
  const bombs = num(extra?.["bombs"]) ?? 0;
  const empty = num(extra?.["empty"]) ?? 0;
  const depth = extra?.["depth"] as { base?: number; combo?: number; diamonds?: number; comboBest?: number; diamondHits?: number; diamondTotal?: number } | undefined;
  if (hits === null || !total || !depth || num(depth.base) === null) return null;
  const share = Math.floor((2 * WHACK_HIT_POINTS * hits + total) / (2 * total)) + (hits >= total ? WHACK_PERFECT_BONUS : 0);
  const steps = [share, share - wrong * WHACK_WRONG_PENALTY, share - wrong * WHACK_WRONG_PENALTY - bombs * WHACK_BOMB_PENALTY, share - wrong * WHACK_WRONG_PENALTY - bombs * WHACK_BOMB_PENALTY - empty * WHACK_EMPTY_PENALTY];
  const mapped = steps.map((v) => bandMapTotal(WHACK_BANDS_MAP, clamp(v, 0, 150)));
  if (mapped[3] !== depth.base) return null;
  const diamondsMax = WHACK_DIAMOND_POINTS * (num(depth.diamondTotal) ?? 0);
  return rows(
    [part("Hits", `${hits} of ${total}`, mapped[0]!, 150), mapped[0]!],
    wrong > 0 ? [cost("Wrong colour", plural(wrong, "tap", "taps"), mapped[0]! - mapped[1]!), mapped[1]! - mapped[0]!] : null,
    bombs > 0 ? [cost("Hedgehogs", plural(bombs, "hit", "hits"), mapped[1]! - mapped[2]!), mapped[2]! - mapped[1]!] : null,
    empty > 0 ? [cost("Empty taps", plural(empty, "tap", "taps"), mapped[2]! - mapped[3]!), mapped[3]! - mapped[2]!] : null,
    [part("Gold combo", `best run ${num(depth.comboBest) ?? 0}`, num(depth.combo) ?? 0, WHACK_COMBO_POINTS), num(depth.combo) ?? 0],
    diamondsMax > 0 ? [part("Diamonds", `${num(depth.diamondHits) ?? 0} of ${num(depth.diamondTotal) ?? 0}`, num(depth.diamonds) ?? 0, diamondsMax), num(depth.diamonds) ?? 0] : null,
  );
}

/** Pull! (clayRev 9): clays, each cost through the hit map, the quick shots, the doubles and the streak. */
function clayRows(extra: Extra, rev: number | undefined): Rows | null {
  const orange = num(extra?.["orangeHits"]);
  const gold = num(extra?.["goldHits"]);
  const birds = num(extra?.["birdHits"]) ?? 0;
  const emptyShots = num(extra?.["emptyShots"]) ?? 0;
  const emptyCost = num(extra?.["emptyShotCost"]) ?? 0;
  const clays = num(extra?.["total"]) ?? CLAY_CONFIG.clays;
  const depth = extra?.["depth"] as { base?: number; doubles?: number; streak?: number; doublesHit?: number; doublesTotal?: number; streakBest?: number } | undefined;
  if (orange === null || gold === null || !depth || num(depth.base) === null) return null;
  const v0 = clayScore(orange, gold, 0, rev, 0);
  const v1 = clayScore(orange, gold, birds, rev, 0);
  const v2 = clayScore(orange, gold, birds, rev, emptyShots);
  const [m0, m1, m2] = [v0, v1, v2].map((v) => bandMapTotal(CLAY_QUICK_HIT_MAP, v)) as [number, number, number];
  const quick = depth.base! - m2;
  if (quick < 0 || quick > CLAY_QUICK_POINTS) return null;
  const hit = orange + gold;
  const doublesMax = CLAY_DOUBLE_POINTS * CLAY_DOUBLES;
  return rows(
    [part("Clays", `${hit} of ${clays}`, m0, 150 - CLAY_QUICK_POINTS), m0],
    birds > 0 ? [cost("Birds", plural(birds, "bird hit", "birds hit"), m0 - m1), m1 - m0] : null,
    emptyCost > 0 ? [cost("Empty shots", `${emptyShots - CLAY_FREE_EMPTY_SHOTS} past the ${CLAY_FREE_EMPTY_SHOTS} free`, m1 - m2), m2 - m1] : null,
    [part("Quick shots", hit > 0 ? "clays hit soon after launch" : "no clays hit", quick, CLAY_QUICK_POINTS), quick],
    [part("Doubles", `${num(depth.doublesHit) ?? 0} of ${num(depth.doublesTotal) ?? CLAY_DOUBLES}`, num(depth.doubles) ?? 0, doublesMax), num(depth.doubles) ?? 0],
    [part("Hit streak", `best ${num(depth.streakBest) ?? 0}`, num(depth.streak) ?? 0, CLAY_STREAK_POINTS), num(depth.streak) ?? 0],
  );
}

/** Mixed Signals (clashRev 10, the standard): a finish's 150 and speed, or the words right less the wrong; streak; gold. */
function clashRows(extra: Extra, lines: readonly string[]): Rows | null {
  const depth = extra?.["depth"] as { base?: number; gold?: number; streak?: number; stretch?: number; best?: number; golds?: number; goldWords?: number; standard?: number } | undefined;
  if (!depth?.standard) return null;
  const counts = /^(\d+) \/ (\d+) correct/.exec(lines[0] ?? "");
  if (!counts) return null;
  const correct = Number(counts[1]);
  const queue = Number(counts[2]);
  const wrong = num(extra?.["wrong"]) ?? 0;
  const finished = lines.some((l) => / · finish \d+ · speed \+\d+$/.test(l));
  const streak = num(depth.streak) ?? 0;
  const gold = num(depth.gold) ?? 0;
  const base = num(depth.base) ?? 0;
  const streakPart: [string, number] = [part("Sort streak", `best ${num(depth.best) ?? 0} in a row`, streak, CLASH_STD_STREAK), streak];
  const goldMax = CLASH_STD_GOLD * (num(depth.goldWords) ?? 5);
  const goldPart: [string, number] = [part("Gold words", `${num(depth.golds) ?? 0} of ${num(depth.goldWords) ?? 5}`, gold, goldMax), gold];
  if (finished) {
    const speed = num(depth.stretch) ?? 0;
    return rows(
      [part("Finish", `all ${queue} words sorted, ${plural(wrong, "wrong", "wrong")}`, CLASH_STD_FINISH, CLASH_STD_FINISH), CLASH_STD_FINISH],
      [part("Speed", wrong > 0 ? "finish time, less a sixth a wrong word" : "finish time", speed, CLASH_STD_SPEED), speed],
      streakPart,
      goldPart,
    );
  }
  const right = roundDiv(CLASH_STD_SHARE * correct, Math.max(1, queue));
  if (base > right) return null;
  const extras = base > 0 ? streak + gold : 0;
  const capped = base + extras > CLASH_STD_UNFINISHED_TOP ? base + extras - CLASH_STD_UNFINISHED_TOP : 0;
  return rows(
    [part("Words right", `${correct} of ${queue}`, right, CLASH_STD_SHARE), right],
    wrong > 0 && right > base ? [cost("Wrong words", plural(wrong, "word", "words"), right - base), base - right] : null,
    streakPart,
    goldPart,
    base === 0 && streak + gold > 0 ? [cost("Bonuses", "need more words right than wrong", streak + gold), -(streak + gold)] : null,
    capped > 0 ? [cost("Unfinished", `at most ${CLASH_STD_UNFINISHED_TOP}`, capped), -capped] : null,
  );
}

/**
 * The rows for an engine game's reveal, as breakdown lines (parts, costs and the total), or null to show its stored
 * lines as they are. Used only when the rows add up exactly to the stored score.
 */
export function engineScoreLines(type: string, extra: Extra, storedLines: readonly string[], score: number | null, rev?: number): string[] | null {
  if (score === null) return null;
  const r = type === "whack" ? whackRows(extra) : type === "clayshoot" ? clayRows(extra, rev) : type === "stroop" ? clashRows(extra, storedLines) : null;
  if (!r || clamp(r.sum, 0, 200) !== score) return null;
  if (r.sum !== score) return null;
  return [...r.lines, `Total → ${score} of 200`];
}
