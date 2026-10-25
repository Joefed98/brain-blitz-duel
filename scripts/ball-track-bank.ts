/**
 * Ball Track bank: 400 courses over the fixed serpentine.
 *   bun scripts/ball-track-bank.ts
 *   bun scripts/ball-track-bank.ts --tall   (btRev 4: 400 courses on the 12-row board, own PRNG stream,
 *                                            written to src/lib/duel/ballTrackBankTall.server.ts)
 *   bun scripts/ball-track-bank.ts --v7     (btRev 7, expansion E6: 300 courses on the 13-row board with 36
 *                                            marbles, BT_V7_GOLDS gold marbles, three speed boosters and two
 *                                            crossovers, own PRNG stream, proved on the btRev 7 rules,
 *                                            written to src/lib/duel/ballTrackBankV7.server.ts)
 * Seeds tray columns/order, the bottom-row re-lay, the tray colour shuffle, ball order and 8–10 upper fixed straights and sparse lower rotatables. Every tray
 * must be reachable from the all-horizontal start, and a just-in-time playbook
 * (each tile set for the next ball due through it) must route every ball home in the
 * real sim; seeds that fail are rerolled. On the taller board the same rules
 * scale with it: the hopper column is fixed down to three rows above the
 * bottom, the two rows above the bottom are the sparse lower rows, and the
 * upper rows take 12–15 seeded fixed straights (8–10 on the 9-row board).
 */
import { writeFileSync } from "node:fs";
import { encodeInputEvents, inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  btNext,
  btTraysAt,
  btRotatable,
  btLayout,
  makeBallTrackGame,
  BT_BALLS,
  BT_COLOURS,
  BT_COLS,
  BT_HOPPER_COL,
  BT_K_ROTATE,
  BT_LAYOUT,
  BT_LAYOUT_TALL,
  BT_TALL_ROWS,
  BT_LAYOUT_V7,
  BT_V7_ROWS,
  BT_V7_BALLS,
  BT_V7_GOLDS,
  BT_REV_RUSH,
  type BtCourse,
  type BtLayout,
} from "../src/lib/arcade/ballTrack";

const V7 = process.argv.includes("--v7");
const TARGET = Number(process.env.BT_TARGET ?? (V7 ? 300 : 400));
const TALL = process.argv.includes("--tall");
/** Marbles per course: 36 on btRev 7, 30 before. */
const BALLS = V7 ? BT_V7_BALLS : BT_BALLS;

let seed = V7 ? 0xe6e6_ba11 : TALL ? 0x7a11_ba11 : 0x5eed_ba11;
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

/** Shortest route into column `col`: visited cells with the vertical state each needs (-1 for corners). */
export function routeTo(course: BtCourse, col: number, requireEarly = false, tick = 0): { cell: number; vert: number }[] | null {
  const rot = new Set(btRotatable(course));
  const { kind: BT_KIND, rows } = btLayout(course);
  /** The first of the two sparse lower rows (cell 42 on the 9-row board). */
  const lower = (rows - 3) * BT_COLS;
  type Q = { cell: number; above: boolean; early: boolean; path: { cell: number; vert: number }[] };
  const queue: Q[] = [{ cell: BT_HOPPER_COL, above: true, early: false, path: [] }];
  const seen = new Set<string>();
  while (queue.length) {
    const q = queue.shift()!;
    const key = `${q.cell}|${q.above}|${q.early}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const options = BT_KIND[q.cell] === 2 ? [-1] : rot.has(q.cell) ? [0, 1] : [0];
    for (const v of options) {
      const next = btNext(q.cell, q.above, v === 1, course, tick);
      const early = q.early || (q.cell < lower && v === 1);
      const path = [...q.path, { cell: q.cell, vert: v }];
      if (next.cell >= 100) { if (next.cell - 100 === col && (!requireEarly || early)) return path; continue; }
      if (next.cell < 0) continue;
      queue.push({ cell: next.cell, above: next.fromAbove, early, path });
    }
  }
  return null;
}

/** Seed sparse lower rows; optimise upper fixed placements with no four-tube stacks. */
function seededFixed(layout: BtLayout = BT_LAYOUT): number[] {
  const { kind: BT_KIND, alwaysFixed: BT_ALWAYS_FIXED, rows } = layout;
  // The two rows above the bottom (cells 42–55 on the 9-row board) and the upper rows' budget.
  const lowerA = (rows - 3) * BT_COLS, lowerB = (rows - 2) * BT_COLS, bottom = (rows - 1) * BT_COLS;
  const budgetMin = rows === BT_V7_ROWS ? 13 : rows === BT_TALL_ROWS ? 12 : 8, budgetSpan = rows === BT_TALL_ROWS || rows === BT_V7_ROWS ? 4 : 3;
  const budgetMax = budgetMin + budgetSpan - 1;
  const row8Cols = shuffle([1, 2, 3, 4, 5]).slice(0, 4);
  const row7Cols = shuffle([1, 2, 3, 4, 5]).slice(0, 2);
  const lowerRot = [...row7Cols.map(c => lowerA + c), ...row8Cols.map(c => lowerB + c)];
  const lowerFixed = BT_KIND.flatMap((k, c) => k === 1 && c >= lowerA && c < bottom && !lowerRot.includes(c) ? [c] : []);
  const patterns = Array.from({length: BT_COLS}, (_, col) => {
    const candidates = BT_KIND.flatMap((k,c) => k === 1 && c < lowerA && c % 7 === col && !BT_ALWAYS_FIXED.includes(c) ? [c] : []);
    const options: {fixed: number[]; triples: number}[] = [];
    for(let mask=0; mask<2**candidates.length; mask++) {
      const fixed=candidates.filter((_,i)=>mask & (1<<i));
      const all=new Set([...BT_ALWAYS_FIXED,...lowerFixed,...fixed]);
      let run=0, triples=0, valid=true;
      for(let row=0;row<rows-1;row++) {const c=row*7+col;run=BT_KIND[c]===1&&!all.has(c)?run+1:0;if(run===3)triples++;if(run>3)valid=false;}
      if(valid) options.push({fixed,triples});
    }
    return options;
  });
  const costs=Array.from({length:8},()=>Array.from({length:budgetMax+1},()=>Infinity));
  const last=costs[7];if(!last)throw Error("Missing costs");last[0]=0;
  for(let col=6;col>=0;col--) {const current=costs[col];if(!current)throw Error("Missing costs");for(let b=0;b<=budgetMax;b++) for(const p of patterns[col]??[]) if(p.fixed.length<=b)current[b]=Math.min(current[b]??Infinity,p.triples+(costs[col+1]?.[b-p.fixed.length]??Infinity));}
  let budget=budgetMin+rnd(budgetSpan);if(!Number.isFinite(costs[0]?.[budget]))return seededFixed(layout);
  const fixed=[...lowerFixed];
  for(let col=0;col<7;col++){const options=(patterns[col]??[]).filter(p=>p.fixed.length<=budget&&p.triples+(costs[col+1]?.[budget-p.fixed.length]??Infinity)===costs[col]?.[budget]);const p=options[rnd(options.length)];if(!p)throw Error("Missing pattern");fixed.push(...p.fixed);budget-=p.fixed.length;}
  return fixed.sort((a,b)=>a-b);
}

/** Every tray must have an early-routing alternative, not depend solely on a late single tap. */
export function hasLowerShortcut(course: BtCourse): boolean {
  return [0, course.relay.tick, course.shuffle.tick].some((t) => btTraysAt(course, t).some((tray, col) => tray >= 0 && !routeTo(course, col, true, t)));
}

function makeCourse(): BtCourse {
  // Row 9: entry corner in column 1, then four drops and two horizontals in seeded columns 2–7.
  const cols = shuffle([1, 2, 3, 4, 5, 6]).slice(0, BT_COLOURS).sort((a, b) => a - b);
  const colours = shuffle([0, 1, 2, 3]);
  const trays = Array.from({ length: BT_COLS }, () => -1);
  colours.forEach((c, i) => (trays[cols[i]!] = c));
  // Re-lay (40–30 s left): a different set of four drop columns; tray k moves with drop k.
  let moved: number[];
  do moved = shuffle([1, 2, 3, 4, 5, 6]).slice(0, BT_COLOURS).sort((a, b) => a - b); while (moved.join() === cols.join());
  const relaid = Array.from({ length: BT_COLS }, () => -1);
  colours.forEach((c, i) => (relaid[moved[i]!] = c));
  // Colour shuffle (20–15 s left): a seeded derangement over the re-laid drops.
  let order: number[];
  do order = shuffle([...colours]); while (order.some((c, i) => c === colours[i]));
  const after = Array.from({ length: BT_COLS }, () => -1);
  order.forEach((c, i) => (after[moved[i]!] = c));
  // Balanced queue: seeded colours receive the remainder; triple runs are rerolled below.
  const extra = shuffle([0, 1, 2, 3]).slice(0, BALLS % BT_COLOURS);
  const balls = shuffle([0, 1, 2, 3].flatMap((c) => Array.from({ length: Math.floor(BALLS / BT_COLOURS) + (extra.includes(c) ? 1 : 0) }, () => c)));
  const fixed = seededFixed(V7 ? BT_LAYOUT_V7 : TALL ? BT_LAYOUT_TALL : BT_LAYOUT);
  const course: BtCourse = { trays, relay: { tick: 1200 + rnd(601), trays: relaid }, shuffle: { tick: 2400 + rnd(301), trays: after }, balls, fixed };
  if (V7) return v7Features({ ...course, rows: BT_V7_ROWS });
  return TALL ? { ...course, rows: BT_TALL_ROWS } : course;
}

/**
 * btRev 7: gold marbles (one in each block of six marbles, never the first two), two crossovers (upper fixed
 * straights under a rotatable one, so marbles can drop into them, outside the hopper column) and three speed
 * boosters (other upper fixed straights). Crossovers and boosters stay in `fixed` (never turned).
 */
function v7Features(course: BtCourse): BtCourse {
  const layout = BT_LAYOUT_V7;
  const lower = (layout.rows - 3) * BT_COLS;
  const fixed = new Set([...layout.alwaysFixed, ...course.fixed]);
  const rot = new Set(btRotatable(course));
  const upperFixed = course.fixed.filter((c) => c < lower && c >= BT_COLS && c % BT_COLS !== BT_HOPPER_COL && layout.kind[c] === 1);
  const crossOk = shuffle(upperFixed.filter((c) => rot.has(c - BT_COLS)));
  const cross = crossOk.slice(0, 2).sort((a, b) => a - b);
  const boost = shuffle(upperFixed.filter((c) => !cross.includes(c))).slice(0, 3).sort((a, b) => a - b);
  const gold: number[] = [];
  for (let block = 0; block < BT_V7_GOLDS; block++) gold.push(Math.max(2, block * 6 + rnd(6)));
  void fixed;
  return { ...course, gold: [...new Set(gold)].sort((a, b) => a - b), boost, cross };
}


/** Just-in-time playbook: each tick toggle the mismatched tile whose next ball is closest to it. */
export function playRoutes(course: BtCourse, routes: { cell: number; vert: number }[][]) {
  // btRev 7 courses are proved on their own rules (boosters and crossovers live).
  const game = makeBallTrackGame(course, course.rows === BT_V7_ROWS ? BT_REV_RUSH : undefined);
  let state = game.init(1);
  const log: ArcadeInputEvent[] = [];
  const landed: number[] = [];
  while (!game.isOver(state)) {
    const t = state.tick + 1;
    // Progress of each ball along its route (index of the tile it's in; -1 hopper/undropped).
    const progress = routes.map((_, id) => {
      const b = state.balls.find((x) => x.id === id);
      if (b) return b.cell >= 100 ? Infinity : b.steps - 1;
      return id < state.next ? Infinity : -1;
    });
    let best: { cell: number; dist: number } | null = null;
    const claimed = new Set<number>();
    for (let id = 0; id < routes.length; id++) {
      const route = routes[id]!;
      for (let i = Math.max(0, progress[id]! + 1); i < route.length; i++) {
        const step = route[i]!;
        if (step.vert < 0 || claimed.has(step.cell)) continue;
        claimed.add(step.cell);
        if (state.vert[step.cell] === step.vert || state.balls.some((b) => b.cell === step.cell)) continue;
        const dist = (id - state.next) * 1000 + i - progress[id]!;
        if (!best || dist < best.dist) best = { cell: step.cell, dist };
      }
      // A tile whose state was already used by this ball's earlier steps is still claimed by it.
      for (let i = 0; i <= progress[id]! && i < route.length; i++) if (state.balls.some((b) => b.id === id && b.cell === route[i]!.cell)) claimed.add(route[i]!.cell);
    }
    if (best) recordInput(log, { k: BT_K_ROTATE, a: best.cell, b: 0, c: 0, d: 0, t }, game.inputRanges);
    const before = state.balls.map((b) => b.id);
    state = game.step(state, inputAt(log, t));
    for (const id of before) if (!state.balls.some((b) => b.id === id)) landed[id] = state.tick;
  }
  return { state, log, landed };
}

if (import.meta.main) {
  const entries: { course: BtCourse; tier: number; par: number; endTick: number; playbook: string }[] = [];
  let tries = 0;
  const stats = { short: 0, fail: 0, best: 0 };
  while (entries.length < TARGET) {
    tries++;
    if (tries > 100_000) throw Error("Course constraints exhausted");
    const course = makeCourse();
    if (course.balls.some((b, i) => i >= 2 && b === course.balls[i - 1] && b === course.balls[i - 2])) continue;
    if (V7 && ((course.cross?.length ?? 0) < 2 || (course.boost?.length ?? 0) < 3 || (course.gold?.length ?? 0) < BT_V7_GOLDS)) continue;
    if (hasLowerShortcut(course)) { stats.short++; continue; }
    if (![0, course.relay.tick, course.shuffle.tick].every((t) => btTraysAt(course, t).every((tray, col) => tray < 0 || routeTo(course, col, false, t)))) continue;
    // Aim each ball at the column its colour occupies when it lands; re-aim after each trial run.
    const target = course.balls.map((c) => course.trays.indexOf(c));
    const when = course.balls.map(() => 0);
    const plan = () => target.map((col, id) => routeTo(course, col, false, when[id]) ?? routeTo(course, col)!);
    let run = playRoutes(course, plan());
    for (let pass = 0; pass < 8 && run.state.home !== BALLS; pass++) {
      const landed = run.landed;
      let changed = false;
      course.balls.forEach((c, id) => {
        const col = btTraysAt(course, landed[id] ?? 0).indexOf(c);
        const t = landed[id] ?? 0;
        if (col !== target[id] || btTraysAt(course, t) !== btTraysAt(course, when[id]!)) { target[id] = col; when[id] = t; changed = true; }
      });
      if (!changed) break;
      run = playRoutes(course, plan());
    }
    if (run.state.home !== BALLS) { stats.fail++; stats.best = Math.max(stats.best, run.state.home); continue; }
    const par = run.state.actions;
    entries.push({ course, tier: par < 20 ? 1 : par < 30 ? 2 : 3, par, endTick: run.state.lastLand, playbook: encodeInputEvents(run.log) });
  }
  if (V7)
    writeFileSync(
      "src/lib/duel/ballTrackBankV7.server.ts",
      `/** Generated by scripts/ball-track-bank.ts --v7; do not hand-edit. btRev 7 courses on the 13-row board (36 marbles, gold marbles, boosters, crossovers), each with its proving playbook. */\nimport type { BallTrackBankEntry } from "./ballTrackBank.server";\nexport const BALL_TRACK_BANK_V7: BallTrackBankEntry[] = ${JSON.stringify(entries)};\n`,
    );
  else if (TALL)
    writeFileSync(
      "src/lib/duel/ballTrackBankTall.server.ts",
      `/** Generated by scripts/ball-track-bank.ts --tall; do not hand-edit. btRev 4 courses on the 12-row board, each with its proving playbook. */\nimport type { BallTrackBankEntry } from "./ballTrackBank.server";\nexport const BALL_TRACK_BANK_TALL: BallTrackBankEntry[] = ${JSON.stringify(entries)};\n`,
    );
  else writeFileSync(
    "src/lib/duel/ballTrackBank.server.ts",
    `/** Generated by scripts/ball-track-bank.ts; do not hand-edit. */\nimport type { BtCourse } from "@/lib/arcade/ballTrack";\nexport interface BallTrackBankEntry { course: BtCourse; tier: number; par: number; endTick: number; playbook: string }\nexport const BALL_TRACK_BANK: BallTrackBankEntry[] = ${JSON.stringify(entries)};\n`,
  );
  const tiers = [1, 2, 3].map((t) => entries.filter((e) => e.tier === t).length);
  console.log(`ball track bank: ${entries.length} courses from ${tries} tries · tiers ${tiers.join("/")}`);
}
