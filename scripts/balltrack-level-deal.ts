/**
 * Ball Tracker's level deal lists (Strategy overhaul stage 3, 15 Nov 2026; docs/arcade-standard/balltrack.md "Levels"):
 * the courses btRev 8 deals at Easy, Hard and Expert, each proved to reach 200.
 *
 *   bun scripts/balltrack-level-deal.ts --level=easy|hard|expert [--count=N] [--check]
 *
 * A course is built from the level's settings (GAME_LEVELS.balltrack: marbles, release ticks, cup moves, gold marbles,
 * boosters) on btRev 7/8's 13-row board with the bank's own rules (scripts/ball-track-bank.ts --v7): four cups in
 * seeded columns, the sparse lower rows and the upper rows' seeded fixed straights, two crossovers under rotatable
 * tubes, the boosters on other upper fixed straights, a balanced marble queue with no three of a colour in a row, gold
 * marbles one in each equal block (never the first two). The cup moves alternate a re-lay of the drop columns (a new
 * set of four, each cup moving with its drop) and a colour shuffle (a derangement over the same columns), one in each
 * equal window between MOVE_FROM and MOVE_TO; Easy's cups never move. Every cup must be reachable in every layout and
 * have an early (upper-row) route. Then the proof: the boosted oracle (scripts/arcade-standard/balltrack.ts) must bring
 * every marble home boosted, every gold, 200, through the server's encode + replay, unflagged; a course that falls
 * short is dropped. Each kept course's oracle log is its witness (scripts/fixtures/balltrack-level-witness-<level>.json), so
 * balltrack-levels-check can replay every one quickly and re-run the oracle on a sample (all at full depth).
 *
 * Its own PRNG stream per level, so a rebuild is byte for byte; --check rebuilds without writing and fails on any
 * difference.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { encodeInputEvents } from "../src/lib/arcade/engine";
import {
  btRotatable,
  btTraysAt,
  BT_COLOURS,
  BT_COLS,
  BT_LAYOUT_V7,
  BT_NEVER_TICK,
  BT_V7_ROWS,
  type BtCourse,
  type BtLayout,
} from "../src/lib/arcade/ballTrack";
import { gameLevelSettings } from "../src/lib/levels/gameLevels";
import type { Level } from "../src/lib/levels/levels";
import { routeTo } from "./ball-track-bank";
import { boostedOracle, replayedBtStd } from "./arcade-standard/balltrack";

export type BtLevel = Exclude<Level, "normal">;
export const BT_LEVELS: readonly BtLevel[] = ["easy", "hard", "expert"];

/** A level's settings (GAME_LEVELS.balltrack). */
export interface BtLevelSettings {
  balls: number;
  dropTicks: number;
  moves: number;
  golds: number;
  boosts: number;
  /** Crossovers (X tiles); 2 when left out, as Normal. */
  crosses?: number;
}
export function btLevelSettings(level: BtLevel): BtLevelSettings {
  const s = gameLevelSettings<BtLevelSettings>("balltrack", level);
  if (!s) throw new Error(`balltrack has no ${level} level`);
  return s;
}

/** How many courses each list holds. */
export const BT_LEVEL_COUNT = 60;
/** Cup moves are spread over this window (ticks): 10 s in, to 2,900 (48 s), before the last marbles land. */
const MOVE_FROM = 600;
const MOVE_TO = 2900;
const PRNG_SEED: Record<BtLevel, number> = { easy: 0x1e5e_ba11, hard: 0x4a2d_ba11, expert: 0xe8e2_ba11 };

export const DEAL_FILE: Record<BtLevel, string> = {
  easy: "src/lib/duel/ballTrackDealEasy.server.ts",
  hard: "src/lib/duel/ballTrackDealHard.server.ts",
  expert: "src/lib/duel/ballTrackDealExpert.server.ts",
};
export const DEAL_NAME: Record<BtLevel, string> = { easy: "BT_EASY_DEAL", hard: "BT_HARD_DEAL", expert: "BT_EXPERT_DEAL" };
export const WITNESS_FILE: Record<BtLevel, string> = {
  easy: "scripts/fixtures/balltrack-level-witness-easy.json",
  hard: "scripts/fixtures/balltrack-level-witness-hard.json",
  expert: "scripts/fixtures/balltrack-level-witness-expert.json",
};

function prng(seed0: number) {
  let seed = seed0 >>> 0;
  const rnd = (n: number) => {
    seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0;
    return ((seed ^ (seed >>> 13)) >>> 0) % n;
  };
  const shuffle = <T,>(list: T[]) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      [list[i], list[j]] = [list[j]!, list[i]!];
    }
    return list;
  };
  return { rnd, shuffle };
}
type Rng = ReturnType<typeof prng>;

/** The bank's seeded fixed straights (scripts/ball-track-bank.ts seededFixed on the 13-row board), on this stream. */
function seededFixed(rng: Rng, layout: BtLayout = BT_LAYOUT_V7): number[] {
  const { rnd, shuffle } = rng;
  const { kind, alwaysFixed, rows } = layout;
  const lowerA = (rows - 3) * BT_COLS, lowerB = (rows - 2) * BT_COLS, bottom = (rows - 1) * BT_COLS;
  const budgetMin = 13, budgetSpan = 4, budgetMax = budgetMin + budgetSpan - 1;
  const row8Cols = shuffle([1, 2, 3, 4, 5]).slice(0, 4);
  const row7Cols = shuffle([1, 2, 3, 4, 5]).slice(0, 2);
  const lowerRot = [...row7Cols.map((c) => lowerA + c), ...row8Cols.map((c) => lowerB + c)];
  const lowerFixed = kind.flatMap((k, c) => (k === 1 && c >= lowerA && c < bottom && !lowerRot.includes(c) ? [c] : []));
  const patterns = Array.from({ length: BT_COLS }, (_, col) => {
    const candidates = kind.flatMap((k, c) => (k === 1 && c < lowerA && c % 7 === col && !alwaysFixed.includes(c) ? [c] : []));
    const options: { fixed: number[]; triples: number }[] = [];
    for (let mask = 0; mask < 2 ** candidates.length; mask++) {
      const fixed = candidates.filter((_, i) => mask & (1 << i));
      const all = new Set([...alwaysFixed, ...lowerFixed, ...fixed]);
      let run = 0, triples = 0, valid = true;
      for (let row = 0; row < rows - 1; row++) {
        const c = row * 7 + col;
        run = kind[c] === 1 && !all.has(c) ? run + 1 : 0;
        if (run === 3) triples++;
        if (run > 3) valid = false;
      }
      if (valid) options.push({ fixed, triples });
    }
    return options;
  });
  const costs = Array.from({ length: 8 }, () => Array.from({ length: budgetMax + 1 }, () => Infinity));
  costs[7]![0] = 0;
  for (let col = 6; col >= 0; col--)
    for (let b = 0; b <= budgetMax; b++)
      for (const p of patterns[col] ?? []) if (p.fixed.length <= b) costs[col]![b] = Math.min(costs[col]![b]!, p.triples + (costs[col + 1]?.[b - p.fixed.length] ?? Infinity));
  let budget = budgetMin + rnd(budgetSpan);
  if (!Number.isFinite(costs[0]?.[budget])) return seededFixed(rng, layout);
  const fixed = [...lowerFixed];
  for (let col = 0; col < 7; col++) {
    const options = (patterns[col] ?? []).filter((p) => p.fixed.length <= budget && p.triples + (costs[col + 1]?.[budget - p.fixed.length] ?? Infinity) === costs[col]?.[budget]);
    const p = options[rnd(options.length)]!;
    fixed.push(...p.fixed);
    budget -= p.fixed.length;
  }
  return fixed.sort((a, b) => a - b);
}

const layoutOf = (cols: number[], colours: number[]) => {
  const trays = Array.from({ length: BT_COLS }, () => -1);
  colours.forEach((c, i) => (trays[cols[i]!] = c));
  return trays;
};

/** Whether every cup of the layout live at tick `t` is reachable, with an early (upper-row) route (the bank's rules). */
function layoutOk(c: BtCourse, t: number): boolean {
  return btTraysAt(c, t).every((tray, col) => tray < 0 || (routeTo(c, col, false, t) && routeTo(c, col, true, t)));
}

/** Tries at each cup layout before the candidate is given up. */
const LAYOUT_TRIES = 40;

/**
 * One candidate course for a level, or null. The board first (the seeded fixed straights, then the crossovers and
 * boosters on them, which routing depends on), then the start layout and each cup move, each re-drawn until every cup
 * in it is reachable with an early route (up to LAYOUT_TRIES), then the marbles and the gold marbles.
 */
export function makeLevelCourse(rng: Rng, s: BtLevelSettings): BtCourse | null {
  const { rnd, shuffle } = rng;
  const fixed = seededFixed(rng);
  const layout = BT_LAYOUT_V7;
  const lower = (layout.rows - 3) * BT_COLS;
  const board: BtCourse = { trays: [], relay: { tick: BT_NEVER_TICK, trays: [] }, shuffle: { tick: BT_NEVER_TICK, trays: [] }, balls: [], fixed, rows: BT_V7_ROWS };
  const rot = new Set(btRotatable(board));
  const upperFixed = fixed.filter((c) => c < lower && c >= BT_COLS && c % BT_COLS !== 3 && layout.kind[c] === 1);
  const cross = shuffle(upperFixed.filter((c) => rot.has(c - BT_COLS))).slice(0, s.crosses ?? 2).sort((a, b) => a - b);
  const boost = shuffle(upperFixed.filter((c) => !cross.includes(c))).slice(0, s.boosts).sort((a, b) => a - b);
  const probe = (trays: number[]): boolean => layoutOk({ ...board, trays, cross, boost }, 0);
  let cols: number[] = [], colours: number[] = [], trays: number[] = [];
  let found = false;
  for (let k = 0; k < LAYOUT_TRIES && !found; k++) {
    cols = shuffle([1, 2, 3, 4, 5, 6]).slice(0, BT_COLOURS).sort((a, b) => a - b);
    colours = shuffle([0, 1, 2, 3]);
    trays = layoutOf(cols, colours);
    found = probe(trays);
  }
  if (!found) return null;
  // The cup moves: a re-lay, then a colour shuffle, in turn, one in each equal window of the move span.
  const moves: { tick: number; trays: number[] }[] = [];
  const span = Math.floor((MOVE_TO - MOVE_FROM) / Math.max(1, s.moves));
  for (let i = 0; i < s.moves; i++) {
    const tick = MOVE_FROM + i * span + rnd(Math.max(1, Math.floor(span * 0.6)));
    let next: number[] | null = null;
    for (let k = 0; k < LAYOUT_TRIES && !next; k++) {
      let nc = cols, nk = colours;
      if (i % 2 === 0) {
        do nc = shuffle([1, 2, 3, 4, 5, 6]).slice(0, BT_COLOURS).sort((a, b) => a - b);
        while (nc.join() === cols.join());
      } else {
        do nk = shuffle([...colours]);
        while (nk.some((c, j) => c === colours[j]));
      }
      const t = layoutOf(nc, nk);
      if (probe(t)) {
        next = t;
        cols = nc;
        colours = nk;
      }
    }
    if (!next) return null;
    moves.push({ tick, trays: next });
  }
  const extra = shuffle([0, 1, 2, 3]).slice(0, s.balls % BT_COLOURS);
  const balls = shuffle([0, 1, 2, 3].flatMap((c) => Array.from({ length: Math.floor(s.balls / BT_COLOURS) + (extra.includes(c) ? 1 : 0) }, () => c)));
  const block = Math.floor(s.balls / s.golds);
  const gold: number[] = [];
  for (let k = 0; k < s.golds; k++) gold.push(Math.max(2, k * block + rnd(block)));
  const never = { tick: BT_NEVER_TICK, trays };
  return {
    trays,
    relay: moves[0] ?? never,
    shuffle: moves[moves.length - 1] ?? never,
    balls,
    fixed,
    rows: BT_V7_ROWS,
    gold: [...new Set(gold)].sort((a, b) => a - b),
    boost,
    cross,
    drop: s.dropTicks,
    moves,
  };
}

/** The layouts a course's cups take: the start, then after each move. */
const layoutTicks = (c: BtCourse) => [0, ...(c.moves ?? []).map((m) => m.tick)];

/** The bank's filters, over every layout: every cup reachable, and each with an early (upper-row) route. */
export function courseShapeOk(c: BtCourse | null, s: BtLevelSettings): c is BtCourse {
  if (!c) return false;
  if (c.balls.some((b, i) => i >= 2 && b === c.balls[i - 1] && b === c.balls[i - 2])) return false;
  if ((c.cross?.length ?? 0) < (s.crosses ?? 2) || (c.boost?.length ?? 0) < s.boosts || (c.gold?.length ?? 0) < s.golds) return false;
  return layoutTicks(c).every((t) => layoutOk(c, t));
}

export interface BuiltDeal {
  courses: BtCourse[];
  witness: string[];
  tries: number;
}

/** Builds a level's list: candidates on the level's stream until `count` reach 200 through the server replay. */
export function buildLevelDeal(level: BtLevel, count = BT_LEVEL_COUNT, log = false): BuiltDeal {
  const s = btLevelSettings(level);
  const rng = prng(PRNG_SEED[level]);
  const courses: BtCourse[] = [];
  const witness: string[] = [];
  let tries = 0, shaped = 0;
  while (courses.length < count) {
    tries++;
    if (tries > 20_000) throw new Error(`${level}: course constraints exhausted`);
    const c = makeLevelCourse(rng, s);
    if (!courseShapeOk(c, s)) continue;
    shaped++;
    const events = boostedOracle(c);
    const r = replayedBtStd(c, courses.length + 1, events);
    if (r.score !== 200 || r.flagged) continue;
    courses.push(c);
    witness.push(encodeInputEvents(events));
    if (log && courses.length % 10 === 0) console.log(`  ${level}: ${courses.length} of ${count} (${shaped} shaped of ${tries} tries)`);
  }
  if (log) console.log(`${level}: ${courses.length} courses from ${shaped} shaped candidates (${tries} tries)`);
  return { courses, witness, tries };
}

export function dealFileText(level: BtLevel, courses: BtCourse[]): string {
  const s = btLevelSettings(level);
  return `/** Generated by scripts/balltrack-level-deal.ts --level=${level}; do not hand-edit. Ball Tracker's ${level} courses (btRev 8, ${s.balls} marbles every ${s.dropTicks} ticks, ${s.moves} cup moves, ${s.golds} gold marbles, ${s.boosts} boosters), each proved to reach 200 by the boosted oracle through the server replay (witnesses in ${WITNESS_FILE[level]}). */\nimport type { BtCourse } from "@/lib/arcade/ballTrack";\nexport const ${DEAL_NAME[level]}: BtCourse[] = ${JSON.stringify(courses)};\n`;
}

/** A level's witnesses: each listed course's oracle log (encoded), in list order. */
export function readWitness(level: BtLevel): string[] | null {
  return existsSync(WITNESS_FILE[level]) ? (JSON.parse(readFileSync(WITNESS_FILE[level], "utf8")) as string[]) : null;
}

if (import.meta.main) {
  const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const level = arg("level") as BtLevel | undefined;
  if (!level || !BT_LEVELS.includes(level)) {
    console.log("usage: bun scripts/balltrack-level-deal.ts --level=easy|hard|expert [--count=N] [--check]");
    process.exit(2);
  }
  const count = Number(arg("count") ?? BT_LEVEL_COUNT);
  const t0 = Date.now();
  const built = buildLevelDeal(level, count, true);
  const text = dealFileText(level, built.courses);
  if (process.argv.includes("--check")) {
    const same = existsSync(DEAL_FILE[level]) && readFileSync(DEAL_FILE[level], "utf8") === text && JSON.stringify(readWitness(level)) === JSON.stringify(built.witness);
    console.log(`${same ? "PASS" : "FAIL"}: ${level} deal rebuilt ${same ? "byte for byte" : "with differences"} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    process.exit(same ? 0 : 1);
  }
  writeFileSync(DEAL_FILE[level], text);
  writeFileSync(WITNESS_FILE[level], `${JSON.stringify(built.witness)}\n`);
  console.log(`wrote ${DEAL_FILE[level]} and ${WITNESS_FILE[level]} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
