/**
 * Number depth to 200 (25 Oct 2026, depthRev 1): old (puzzleScoreRev 3, before the stamp) versus new score
 * distributions for the eight Number puzzles (docs/depth/d2-number.md "Tuning"). Report only: nothing here
 * changes a score. Script-only: floats are fine.
 *
 * Each game is played on room seeds by the puzzle-fairness kit players (average, good, great, near-perfect) plus
 * an elite player (pace 0.35, no slips), on the board rooms dealt before the stamp (old) and on the depth board
 * (new), through the real server grader. Feature games model who goes for the feature: Exact's five-number
 * answer and Checkout's big finishes are played by a share of each level (FEATURE_RATE); the others play the
 * six-number answer and an ordinary checkout. Brimful's par comes from the kit's own slips.
 *
 *   bun scripts/number-depth-bands.ts [--seeds=30] [--game=balance,trail] [--json=<path>]
 */
import { writeFileSync } from "node:fs";
import { CHECKOUT_BULL, checkoutDartValue, checkoutOptions, encodeCheckoutDarts, searchCheckout, type CheckoutDart } from "../src/lib/duel/checkout";
import { pinNumberDepth } from "../src/lib/duel/numberDepth";
import { solveWithAllSixTiles } from "../src/lib/duel/target";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { CheckoutPuzzleData, CheckoutStageData, PuzzleData, PuzzleType, TargetNumberPuzzleData } from "../src/lib/duel/types";
import { SKILLS, hashText, makeRng, type Skill } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { grade, roomPuzzle } from "./puzzle-fairness/run";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 30);
const GAMES = (opt("game")?.split(",") ?? ["balance", "equation", "numpyramid", "trail", "target", "measure", "checkout", "numline"]) as PuzzleType[];

const LEVEL_NAMES = ["average", "good", "great", "near", "elite"] as const;
type LevelName = (typeof LEVEL_NAMES)[number];
const ELITE: Skill = { level: "near", pace: 0.35, err: 0, reactionMs: 140, reactionSd: 15 };
/**
 * Ballpark's kit sets its estimation spread from the slip rate (0.5 % + 20 × err); its elite estimates within
 * 0.3 % (err −0.01: no slips, a tighter spread), the precision a bullseye streak asks for.
 */
const ELITE_BALLPARK: Skill = { ...ELITE, err: -0.01 };
let current: PuzzleType = "balance";
const skillOf = (level: LevelName): Skill => (level === "elite" ? (current === "numline" ? ELITE_BALLPARK : ELITE) : SKILLS[level]);
/** Share of each level that goes for Exact's five-number answer or Checkout's big finishes. */
const FEATURE_RATE: Record<LevelName, number> = { average: 0.1, good: 0.3, great: 0.5, near: 0.8, elite: 1 };

/** Exact: the puzzle the kit plays (it follows `solution`): the five-number answer or a six-number one. */
function exactAs(p: TargetNumberPuzzleData, elegant: boolean): TargetNumberPuzzleData {
  if (elegant) return p;
  const six = solveWithAllSixTiles(p.tiles, p.target);
  return six ? { ...p, solution: six } : p;
}

/** Checkout: the routes the kit plays: big finishes where it goes for them, ordinary checkouts otherwise. */
function checkoutAs(p: CheckoutPuzzleData, big: boolean): CheckoutPuzzleData {
  const routes = p.stages.map((stage, i) => {
    if (!stage.bigFinish) return p.routes?.[i] ?? "";
    const plain: CheckoutStageData = { ...stage, bigFinish: false };
    const ordinary = searchCheckout(plain).route;
    if (!big) return ordinary ? encodeCheckoutDarts(ordinary) : (p.routes?.[i] ?? "");
    const bigRoute = bigFinishRoute(stage);
    return bigRoute ? encodeCheckoutDarts(bigRoute) : (p.routes?.[i] ?? "");
  });
  return { ...p, routes };
}

/** The fewest-dart route that ends on a big finish (the Bull, or a treble on a double board), if any. */
function bigFinishRoute(stage: CheckoutStageData): CheckoutDart[] | null {
  const options = checkoutOptions(stage);
  const big = options.filter((d) => (d.wedge === CHECKOUT_BULL ? d.ring === 2 : d.ring === 3 && stage.finish !== 3));
  const lengths = stage.exactDarts ? [stage.maxDarts] : Array.from({ length: stage.maxDarts }, (_, i) => i + 1);
  for (const length of lengths) {
    const walk = (start: number, left: number, picked: CheckoutDart[], remaining: number): CheckoutDart[] | null => {
      if (left === 0) {
        const fin = big.find((d) => checkoutDartValue(stage, d) === remaining);
        return fin ? [...picked, fin] : null;
      }
      for (let i = start; i < options.length; i++) {
        const r = walk(i, left - 1, [...picked, options[i]!], remaining - checkoutDartValue(stage, options[i]!));
        if (r) return r;
      }
      return null;
    };
    const r = walk(0, length - 1, [], stage.target);
    if (r) return r;
  }
  return null;
}

/** Time-left shares of each level's finishes on the new boards (for fitting the elite shares). */
const SHARES: Record<string, number[]> = {};
function playScore(type: PuzzleType, real: PuzzleData, played: PuzzleData, seed: number, level: LevelName): number {
  const kit = KITS[type]!;
  const limit = puzzleTimeLimitMs(real);
  const rng = makeRng(hashText(`${type}:play:${seed}:${level}`));
  const play = kit.play(played, rng, skillOf(level), limit);
  const inTime = play.steps.filter((s) => s.atMs <= limit);
  if (!inTime.length) return grade(real, kit.nothing(real), 0).score;
  for (const step of inTime) {
    const g = grade(real, step.answer, Math.max(0, limit - step.atMs));
    if (g.isCorrect) {
      if ((real as { depthRev?: number }).depthRev) (SHARES[`${type}:${level}`] ??= []).push((limit - step.atMs) / limit);
      return g.score;
    }
  }
  return grade(real, inTime[inTime.length - 1]!.answer, 0).score;
}

function stats(xs: number[]): { median: number; p90: number; best: number; mean: number } {
  const s = [...xs].sort((a, b) => a - b);
  const at = (q: number) => s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))] ?? 0;
  return { median: at(0.5), p90: at(0.9), best: s[s.length - 1] ?? 0, mean: Math.round((s.reduce((a, b) => a + b, 0) / Math.max(1, s.length)) * 10) / 10 };
}

const out: Record<string, Record<string, { old: ReturnType<typeof stats>; now: ReturnType<typeof stats> }>> = {};
for (const type of GAMES) {
  current = type;
  const rows: Record<string, { old: number[]; now: number[] }> = {};
  for (const level of LEVEL_NAMES) rows[level] = { old: [], now: [] };
  for (let i = 1; i <= SEEDS; i++) {
    const seed = 20_000 + i;
    pinNumberDepth(true);
    const oldPuzzle = roomPuzzle(type, seed);
    pinNumberDepth(false);
    const newPuzzle = roomPuzzle(type, seed);
    for (const level of LEVEL_NAMES) {
      const fr = makeRng(hashText(`feature:${type}:${seed}:${level}`)).next() < FEATURE_RATE[level];
      const played = type === "target" ? exactAs(newPuzzle as TargetNumberPuzzleData, fr)
        : type === "checkout" ? checkoutAs(newPuzzle as CheckoutPuzzleData, fr)
        : newPuzzle;
      rows[level]!.old.push(playScore(type, oldPuzzle, oldPuzzle, seed, level));
      rows[level]!.now.push(playScore(type, newPuzzle, played, seed, level));
    }
  }
  out[type] = Object.fromEntries(LEVEL_NAMES.map((l) => [l, { old: stats(rows[l]!.old), now: stats(rows[l]!.now) }]));
  console.log(`\n${type} (${SEEDS} seeds)   old median / p90 / best  →  new median / p90 / best   (mean old → new)`);
  for (const l of LEVEL_NAMES) {
    const r = out[type]![l]!;
    console.log(`  ${l.padEnd(8)} ${String(r.old.median).padStart(4)} / ${String(r.old.p90).padStart(3)} / ${String(r.old.best).padStart(3)}  →  ${String(r.now.median).padStart(4)} / ${String(r.now.p90).padStart(3)} / ${String(r.now.best).padStart(3)}   (${r.old.mean} → ${r.now.mean})`);
  }
}
if (args.includes("--shares"))
  for (const [k, v] of Object.entries(SHARES)) {
    const st = [...v].sort((a, b) => a - b);
    console.log(`share ${k.padEnd(18)} n=${st.length} median ${st[Math.floor(st.length / 2)]?.toFixed(3)} p90 ${st[Math.floor(st.length * 0.9)]?.toFixed(3)} max ${st[st.length - 1]?.toFixed(3)}`);
  }
const json = opt("json");
if (json) writeFileSync(json, JSON.stringify(out, null, 1));
