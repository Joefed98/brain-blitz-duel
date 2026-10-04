/**
 * Ball Track bank: 400 courses over the fixed serpentine.
 *   bun scripts/ball-track-bank.ts
 * Seeds tray columns/order, the mid-round tray shuffle, ball order and 8–10 upper fixed straights and sparse lower rotatables. Every tray
 * must be reachable from the all-horizontal start, and a just-in-time playbook
 * (each tile set for the next ball due through it) must route every ball home in the
 * real sim; seeds that fail are rerolled.
 */
import { writeFileSync } from "node:fs";
import { encodeInputEvents, inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  btNext,
  btTraysAt,
  btRotatable,
  makeBallTrackGame,
  BT_ALWAYS_FIXED,
  BT_BALLS,
  BT_COLOURS,
  BT_COLS,
  BT_HOPPER_COL,
  BT_KIND,
  BT_K_ROTATE,
  BT_ROWS,
  type BtCourse,
} from "../src/lib/arcade/ballTrack";

const TARGET = Number(process.env.BT_TARGET ?? 400);

let seed = 0x5eed_ba11;
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
export function routeTo(course: BtCourse, col: number, requireEarly = false): { cell: number; vert: number }[] | null {
  const rot = new Set(btRotatable(course));
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
      const next = btNext(q.cell, q.above, v === 1, course);
      const early = q.early || (q.cell < 42 && v === 1);
      const path = [...q.path, { cell: q.cell, vert: v }];
      if (next.cell >= 100) { if (next.cell - 100 === col && (!requireEarly || early)) return path; continue; }
      if (next.cell < 0) continue;
      queue.push({ cell: next.cell, above: next.fromAbove, early, path });
    }
  }
  return null;
}

/** Seed sparse lower rows; optimise upper fixed placements with no four-tube stacks. */
function seededFixed(): number[] {
  const row8Cols = shuffle([1, 2, 3, 4, 5]).slice(0, 4);
  const row7Cols = shuffle([1, 2, 3, 4, 5]).slice(0, 2);
  const lowerRot = [...row7Cols.map(c => 42 + c), ...row8Cols.map(c => 49 + c)];
  const lowerFixed = BT_KIND.flatMap((k, c) => k === 1 && c >= 42 && c < 56 && !lowerRot.includes(c) ? [c] : []);
  const patterns = Array.from({length: BT_COLS}, (_, col) => {
    const candidates = BT_KIND.flatMap((k,c) => k === 1 && c < 42 && c % 7 === col && !BT_ALWAYS_FIXED.includes(c) ? [c] : []);
    const options: {fixed: number[]; triples: number}[] = [];
    for(let mask=0; mask<2**candidates.length; mask++) {
      const fixed=candidates.filter((_,i)=>mask & (1<<i));
      const all=new Set([...BT_ALWAYS_FIXED,...lowerFixed,...fixed]);
      let run=0, triples=0, valid=true;
      for(let row=0;row<8;row++) {const c=row*7+col;run=BT_KIND[c]===1&&!all.has(c)?run+1:0;if(run===3)triples++;if(run>3)valid=false;}
      if(valid) options.push({fixed,triples});
    }
    return options;
  });
  const costs=Array.from({length:8},()=>Array.from({length:11},()=>Infinity));
  const last=costs[7];if(!last)throw Error("Missing costs");last[0]=0;
  for(let col=6;col>=0;col--) {const current=costs[col];if(!current)throw Error("Missing costs");for(let b=0;b<=10;b++) for(const p of patterns[col]??[]) if(p.fixed.length<=b)current[b]=Math.min(current[b]??Infinity,p.triples+(costs[col+1]?.[b-p.fixed.length]??Infinity));}
  let budget=8+rnd(3);if(!Number.isFinite(costs[0]?.[budget]))return seededFixed();
  const fixed=[...lowerFixed];
  for(let col=0;col<7;col++){const options=(patterns[col]??[]).filter(p=>p.fixed.length<=budget&&p.triples+(costs[col+1]?.[budget-p.fixed.length]??Infinity)===costs[col]?.[budget]);const p=options[rnd(options.length)];if(!p)throw Error("Missing pattern");fixed.push(...p.fixed);budget-=p.fixed.length;}
  return fixed.sort((a,b)=>a-b);
}

/** Every tray must have an early-routing alternative, not depend solely on a late single tap. */
export function hasLowerShortcut(course: BtCourse): boolean {
  return course.trays.some((tray,col)=>tray>=0&&!routeTo(course,col,true));
}

function makeCourse(): BtCourse {
  // Row 9: entry corner in column 1, then four drops and two horizontals in seeded columns 2–7.
  const cols = shuffle([1, 2, 3, 4, 5, 6]).slice(0, BT_COLOURS).sort((a, b) => a - b);
  const colours = shuffle([0, 1, 2, 3]);
  const trays = Array.from({ length: BT_COLS }, () => -1);
  colours.forEach((c, i) => (trays[cols[i]!] = c));
  // Mid-round shuffle: a seeded derangement (every tray changes colour) with 40–20 s left.
  let order: number[];
  do order = shuffle([...colours]); while (order.some((c, i) => c === colours[i]));
  const after = Array.from({ length: BT_COLS }, () => -1);
  order.forEach((c, i) => (after[cols[i]!] = c));
  const shuffleAt = { tick: process.env.BT_NOSHUF ? 99999 : 1200 + rnd(1201), trays: after };
  // Five balls per colour, shuffled deterministically; triple runs are rerolled below.
  const balls = shuffle(Array.from({ length: BT_BALLS }, (_, i) => i % BT_COLOURS));
  const fixed = seededFixed();
  return { trays, shuffle: shuffleAt, balls, fixed };
}

/** Landing tick per ball when every ball follows the route to its target column. */
function landingTicks(course: BtCourse, target: number[]): number[] {
  const routes = target.map((col) => routeTo(course, col)!);
  const { log } = playRoutes(course, routes);
  const game = makeBallTrackGame(course);
  let state = game.init(1);
  const out: number[] = [];
  while (!game.isOver(state)) {
    const before = new Set(state.balls.map((b) => b.id));
    state = game.step(state, inputAt(log, state.tick + 1));
    const still = new Set(state.balls.map((b) => b.id));
    for (const id of before) if (!still.has(id)) out[id] = state.tick;
  }
  return out;
}

/** Just-in-time playbook: each tick toggle the mismatched tile whose next ball is closest to it. */
export function playRoutes(course: BtCourse, routes: { cell: number; vert: number }[][]) {
  const game = makeBallTrackGame(course);
  let state = game.init(1);
  const log: ArcadeInputEvent[] = [];
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
    state = game.step(state, inputAt(log, t));
  }
  return { state, log };
}

if (import.meta.main) {
  const entries: { course: BtCourse; tier: number; par: number; endTick: number; playbook: string }[] = [];
  let tries = 0;
  const stats = { short: 0, fail: 0, best: 0 };
  while (entries.length < TARGET) {
    tries++;
    if (process.env.BT_DEBUG && tries % 50 === 0) console.log(tries, entries.length, stats);
    if (tries > 100_000) throw Error("Course constraints exhausted");
    const course = makeCourse();
    if (course.balls.some((b, i) => i >= 2 && b === course.balls[i - 1] && b === course.balls[i - 2])) continue;
    if (hasLowerShortcut(course)) { stats.short++; continue; }
    if (!course.trays.every((tray, col) => tray < 0 || routeTo(course, col))) continue;
    // Aim each ball at the column its colour occupies when it lands; re-aim after each trial run.
    const target = course.balls.map((c) => course.trays.indexOf(c));
    let run = playRoutes(course, target.map((col) => routeTo(course, col)!));
    for (let pass = 0; pass < 8 && run.state.home !== BT_BALLS; pass++) {
      const landed = landingTicks(course, target);
      let changed = false;
      course.balls.forEach((c, id) => {
        const col = btTraysAt(course, landed[id] ?? 0).indexOf(c);
        if (col !== target[id]) { target[id] = col; changed = true; }
      });
      if (process.env.BT_DEBUG2 && !changed) { console.log("shuffle", course.shuffle.tick, JSON.stringify(course.trays), JSON.stringify(course.shuffle.trays)); console.log(course.balls.map((c, id) => `${id}:c${c}->${target[id]}@${landed[id]}`).join(" ")); console.log(JSON.stringify(run.state.landings)); process.exit(0); }
      if (!changed) break;
      run = playRoutes(course, target.map((col) => routeTo(course, col)!));
    }
    if (run.state.home !== BT_BALLS) { stats.fail++; stats.best = Math.max(stats.best, run.state.home); continue; }
    const par = run.state.actions;
    entries.push({ course, tier: par < 20 ? 1 : par < 30 ? 2 : 3, par, endTick: run.state.lastLand, playbook: encodeInputEvents(run.log) });
  }
  writeFileSync(
    "src/lib/duel/ballTrackBank.server.ts",
    `/** Generated by scripts/ball-track-bank.ts; do not hand-edit. */\nimport type { BtCourse } from "@/lib/arcade/ballTrack";\nexport interface BallTrackBankEntry { course: BtCourse; tier: number; par: number; endTick: number; playbook: string }\nexport const BALL_TRACK_BANK: BallTrackBankEntry[] = ${JSON.stringify(entries)};\n`,
  );
  const tiers = [1, 2, 3].map((t) => entries.filter((e) => e.tier === t).length);
  console.log(`ball track bank: ${entries.length} courses from ${tries} tries · tiers ${tiers.join("/")}`);
}
