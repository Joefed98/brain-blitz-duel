/**
 * Ball Tracker's D6 level courses (27 Nov 2026; the polish plan's difficulty spec, Joe's ladder test): the lever is the
 * marble colours and their cups, seen before the first drop. A course is built as Ball Tracker's stage-3 level courses
 * (scripts/balltrack-level-deal.ts, whose builder this copies, unchanged but for the colour count) on btRev 7/8's 13-row
 * board: the seeded fixed straights, two crossovers, the boosters, a balanced marble queue with no three of a colour in a
 * row, gold marbles one in each equal block, and the cup moves (a re-lay of the drop columns, then a colour shuffle, in
 * turn), every cup reachable with an early route in every layout. With `colours` cups the drop columns come from
 * columns 1–6 (no route reaches column 0); six colours fill all six, so each of their cup moves is a colour shuffle. The settings are D6's (BT_D6_LEVELS below, mirrored in gameLevels.ts).
 * A list keeps a course only when the boosted oracle (scripts/arcade-standard/balltrack.ts) brings every marble home
 * boosted, every gold, 200, through the server's encode + replay, unflagged; the oracle's log is its witness.
 *
 *   bun scripts/balltrack-d6-deal.ts --level=easy|hard|expert [--count=N] [--check]
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { encodeInputEvents } from "../src/lib/arcade/engine";
import { btCheckpoint, btRotatable, btTraysAt, makeBallTrackGame, BT_CHECKPOINT_INTERVAL, BT_COLS, BT_D6_LEVELS, BT_LAYOUT_V7, BT_NEVER_TICK, BT_REV_D6, BT_V7_ROWS, type BtCourse, type BtLayout, type BtState } from "../src/lib/arcade/ballTrack";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { encodeBallTrackRun, replayBallTrackRun } from "../src/lib/duel/ballTrack";
import { routeTo } from "./ball-track-bank";
import { boostedOracle } from "./arcade-standard/balltrack";

export type BtD6Level = "easy" | "hard" | "expert";
export const BT_D6_LEVEL_NAMES: readonly BtD6Level[] = ["easy", "hard", "expert"];

/** A D6 level's course settings. */
export interface BtD6Settings {
  /** Marble colours, one cup each (Normal: 4). */
  colours: number;
  balls: number;
  dropTicks: number;
  moves: number;
  golds: number;
  boosts: number;
  crosses?: number;
  comboFull?: number;
}

/** Cup moves are spread over this window (ticks): 10 s in, to 2,900 (48 s), as the stage-3 builder. */
const MOVE_FROM = 600;
const MOVE_TO = 2900;

/** The drop columns a course's cups take: columns 1–6 (no route reaches column 0, the hopper's side). */
function poolOf(_s: BtD6Settings): readonly number[] {
  return [1, 2, 3, 4, 5, 6];
}
function coloursOf(s: BtD6Settings): number[] {
  return Array.from({ length: s.colours }, (_, c) => c);
}

export function prng(seed0: number) {
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
export function makeD6Course(rng: Rng, s: BtD6Settings): BtCourse | null {
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
    cols = shuffle([...poolOf(s)]).slice(0, s.colours).sort((a, b) => a - b);
    colours = shuffle(coloursOf(s));
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
      // Six colours fill all six drop columns, so there is no other set to re-lay onto: every move is a colour shuffle.
      if (i % 2 === 0 && s.colours < poolOf(s).length) {
        do nc = shuffle([...poolOf(s)]).slice(0, s.colours).sort((a, b) => a - b);
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
  const extra = shuffle(coloursOf(s)).slice(0, s.balls % s.colours);
  const balls = shuffle(coloursOf(s).flatMap((c) => Array.from({ length: Math.floor(s.balls / s.colours) + (extra.includes(c) ? 1 : 0) }, () => c)));
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
    ...(s.comboFull !== undefined ? { combo: s.comboFull } : {}),
  };
}

/** The layouts a course's cups take: the start, then after each move. */
const layoutTicks = (c: BtCourse) => [0, ...(c.moves ?? []).map((m) => m.tick)];

/** The bank's filters, over every layout: every cup reachable, and each with an early (upper-row) route. */
export function d6ShapeOk(c: BtCourse | null, s: BtD6Settings): c is BtCourse {
  if (!c) return false;
  if (c.balls.some((b, i) => i >= 2 && b === c.balls[i - 1] && b === c.balls[i - 2])) return false;
  if ((c.cross?.length ?? 0) < (s.crosses ?? 2) || (c.boost?.length ?? 0) < s.boosts || (c.gold?.length ?? 0) < s.golds) return false;
  return layoutTicks(c).every((t) => layoutOk(c, t));
}


/** A D6 level's settings (BT_D6_LEVELS in the sim). */
export function btD6Settings(level: BtD6Level): BtD6Settings {
  const { full: _full, ...rest } = BT_D6_LEVELS[level];
  return rest;
}

/** Plays `events` on btRev 9, then sends the log through the server's encode + replay; the replayed state and score. */
export function replayedBtD6(course: BtCourse, seed: number, events: ArcadeInputEvent[]): { state: BtState; score: number; flagged: boolean } {
  const game = makeBallTrackGame(course, BT_REV_D6);
  const byTick = new Map(events.map((e) => [e.t, e]));
  let st = game.init(seed);
  const checkpoints = [];
  while (!game.isOver(st)) {
    st = game.step(st, byTick.get(st.tick + 1) ?? null);
    if (st.tick % BT_CHECKPOINT_INTERVAL === 0) checkpoints.push(btCheckpoint(st));
  }
  const raw = encodeBallTrackRun(course, { seed, claimedScore: game.score(st), events, endTick: st.tick, checkpoints }, BT_REV_D6);
  const result = replayBallTrackRun(course, seed, raw, BT_REV_D6);
  return { state: result.state, score: result.score, flagged: Boolean(result.flagged) };
}

/** How many courses each list holds. */
export const BT_D6_COUNT = 60;
const PRNG_SEED: Record<BtD6Level, number> = { easy: 0x1d6e_ba11, hard: 0x4d6d_ba11, expert: 0xed6e_ba11 };
export const D6_DEAL_FILE: Record<BtD6Level, string> = {
  easy: "src/lib/duel/ballTrackDealD6Easy.server.ts",
  hard: "src/lib/duel/ballTrackDealD6Hard.server.ts",
  expert: "src/lib/duel/ballTrackDealD6Expert.server.ts",
};
export const D6_DEAL_NAME: Record<BtD6Level, string> = { easy: "BT_D6_EASY_DEAL", hard: "BT_D6_HARD_DEAL", expert: "BT_D6_EXPERT_DEAL" };
export const D6_WITNESS_FILE: Record<BtD6Level, string> = {
  easy: "scripts/fixtures/balltrack-d6-witness-easy.json",
  hard: "scripts/fixtures/balltrack-d6-witness-hard.json",
  expert: "scripts/fixtures/balltrack-d6-witness-expert.json",
};

/** Builds a level's list: candidates on its own stream until `count` reach 200 through btRev 9's server replay. */
export function buildD6Deal(level: BtD6Level, count = BT_D6_COUNT, log = false): { courses: BtCourse[]; witness: string[]; tries: number } {
  const s = btD6Settings(level);
  const rng = prng(PRNG_SEED[level]);
  const courses: BtCourse[] = [];
  const witness: string[] = [];
  let tries = 0, shaped = 0;
  while (courses.length < count) {
    tries++;
    if (tries > 40_000) throw new Error(`${level}: course constraints exhausted`);
    const made = makeD6Course(rng, s);
    if (!d6ShapeOk(made, s)) continue;
    shaped++;
    const c: BtCourse = { ...made, full: BT_D6_LEVELS[level].full };
    const events = boostedOracle(c);
    const r = replayedBtD6(c, courses.length + 1, events);
    if (r.score !== 200 || r.flagged) continue;
    courses.push(c);
    witness.push(encodeInputEvents(events));
    if (log && courses.length % 10 === 0) console.log(`  ${level}: ${courses.length} of ${count} (${shaped} shaped of ${tries} tries)`);
  }
  if (log) console.log(`${level}: ${courses.length} courses from ${shaped} shaped candidates (${tries} tries)`);
  return { courses, witness, tries };
}

export function d6DealFileText(level: BtD6Level, courses: BtCourse[]): string {
  const s = BT_D6_LEVELS[level];
  return `/** Generated by scripts/balltrack-d6-deal.ts --level=${level}; do not hand-edit. Ball Tracker's D6 ${level} courses (btRev 9, ${s.colours} colours, ${s.balls} marbles every ${s.dropTicks} ticks, ${s.moves} cup moves, ${s.golds} gold marbles, ${s.boosts} boosters; full at ${s.full.home} home, ${s.full.gold} gold, ${s.full.combo} combos, ${s.full.boost} boosted), each proved to reach 200 by the boosted oracle through the server replay (witnesses in ${D6_WITNESS_FILE[level]}). */\nimport type { BtCourse } from "@/lib/arcade/ballTrack";\nexport const ${D6_DEAL_NAME[level]}: BtCourse[] = ${JSON.stringify(courses)};\n`;
}

if (import.meta.main) {
  const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const level = arg("level") as BtD6Level | undefined;
  if (!level || !BT_D6_LEVEL_NAMES.includes(level)) {
    console.log("usage: bun scripts/balltrack-d6-deal.ts --level=easy|hard|expert [--count=N] [--check]");
    process.exit(2);
  }
  const t0 = Date.now();
  const built = buildD6Deal(level, Number(arg("count") ?? BT_D6_COUNT), true);
  const text = d6DealFileText(level, built.courses);
  const witnessText = `${JSON.stringify(built.witness)}\n`;
  if (process.argv.includes("--check")) {
    const same = existsSync(D6_DEAL_FILE[level]) && readFileSync(D6_DEAL_FILE[level], "utf8") === text && existsSync(D6_WITNESS_FILE[level]) && readFileSync(D6_WITNESS_FILE[level], "utf8") === witnessText;
    console.log(`${same ? "PASS" : "FAIL"}: ${level} D6 deal rebuilt ${same ? "byte for byte" : "with differences"} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    process.exit(same ? 0 : 1);
  }
  writeFileSync(D6_DEAL_FILE[level], text);
  writeFileSync(D6_WITNESS_FILE[level], witnessText);
  console.log(`wrote ${D6_DEAL_FILE[level]} and ${D6_WITNESS_FILE[level]} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
