/**
 * Coral Pop bubbleRev 4 (Tuning F, Oct 2026): the directional Torpedo.
 *
 * Before (bubbleRev 2 and 3) a Torpedo landed like a bubble and cleared every
 * other bubble in the row it landed in; everything that row had held then
 * dropped as loose. From bubbleRev 4 it never lands: it flies like any shot and,
 * once it touches the field, carries on the way it points, destroying each
 * bubble it touches (up to BUB_TORPEDO_HITS) until it reaches the top row's line;
 * loose bubbles then drop by the usual rule.
 *
 *  1. Stored rev-4 runs (skill-band bots, scripts/fixtures/bubble-rev4-runs.json)
 *     replay through the server path to the same score and final state.
 *  2. The rule on constructed fields: only bubbles within contact distance of the
 *     Torpedo's path go, at most BUB_TORPEDO_HITS, never a whole row; it never
 *     stays on the field; loose bubbles drop exactly as after any pop.
 *  3. Older revisions are unchanged: the pre-change bubbleRev 3 runs in
 *     scripts/fixtures/arcade-tuning-f2-legacy.json replay to the same score and
 *     state, rev 3 still clears a row, and rev 4 starts from rev 3's field and queue.
 *  4. Wiring: new rooms stamp 4 and score on the bands; a stored scripted best
 *     run (a two-shot lookahead bot, seed 93) clears the field through the server
 *     replay, and a clear with half the time left scores 150. (No bot run found
 *     a 150 clear on rev 3 or rev 4: clearing within 45 s needs luckier queues.)
 *
 *   bun scripts/bubble-rev4-check.ts
 *   bun scripts/bubble-rev4-check.ts --record=<logs> --best=<seed>:<file>   (logs from
 *     bun scripts/arcade-skill-bands.ts bubble --rev=f --seeds=8 --save=<logs>)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  bubbleGameFor,
  bubCellX,
  bubCellY,
  bubCheckpoint,
  bubRowCols,
  BUB_COLS,
  BUB_D,
  BUB_LINE,
  BUB_REV,
  BUB_REV_BAND,
  BUB_REV_TORPEDO,
  BUB_R,
  BUB_TORPEDO_HITS,
  type BubState,
} from "../src/lib/arcade/bubble";
import { puzzleUsesBands } from "../src/lib/arcade/bandParts";
import { replayBubbleRun } from "../src/lib/duel/bubble";
import { generateBubble } from "../src/lib/duel/arcade.server";
import { fnv } from "./arcade-tuning-a-legacy";
import { roomSeed } from "./arcade-skill-bands/games";
import { playRevOf } from "./scoring-targets-revs";

const FIXTURE = "scripts/fixtures/bubble-rev4-runs.json";

interface RunRecord {
  level: string;
  seed: number;
  score: number;
  stateHash: number;
  /** Torpedoes that destroyed something in the run. */
  lines: number;
  /** The encoded run, gzip + base64. */
  raw: string;
}

const recordArg = process.argv.find((a) => a.startsWith("--record="));
if (recordArg) {
  const logs = recordArg.slice("--record=".length);
  const runs: RunRecord[] = [];
  // Room seeds 1, 4, 5 and 6 deal a Torpedo (the others a mine).
  for (const level of ["average", "good", "great", "near"])
    for (const n of [1, 4, 5, 6]) {
      const raw = readFileSync(`${logs}/bubble/next-${level}-${n}.txt`, "utf8");
      const seed = roomSeed(n);
      const result = replayBubbleRun(seed, raw, BUB_REV_TORPEDO);
      if (result.flagged) throw new Error(`${level} ${n}: the saved run is flagged`);
      runs.push({ level, seed, score: result.score, stateHash: fnv(JSON.stringify(result.state)), lines: result.lines, raw: gzipSync(raw).toString("base64") });
    }
  const [bestSeed, bestFile] = (process.argv.find((a) => a.startsWith("--best="))?.slice(7) ?? "").split(":");
  const bestRaw = readFileSync(bestFile!, "utf8");
  const bestResult = replayBubbleRun(Number(bestSeed), bestRaw, BUB_REV_TORPEDO);
  if (bestResult.flagged || !bestResult.cleared) throw new Error("the best run must clear unflagged");
  const best = { level: "scripted", seed: Number(bestSeed), score: bestResult.score, stateHash: fnv(JSON.stringify(bestResult.state)), lines: bestResult.lines, raw: gzipSync(bestRaw).toString("base64") };
  writeFileSync(FIXTURE, JSON.stringify({ recorded: "skill-band bots on bubbleRev 4 (Tuning F)", rev: BUB_REV_TORPEDO, runs, best }) + "\n");
  console.log(`wrote ${runs.length} runs to ${FIXTURE}`);
  process.exit(0);
}

const failures: string[] = [];
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
const section = (name: string) => console.log(`\n== ${name}`);

/* ========================= 1. stored rev-4 runs ========================= */
section("Stored bubbleRev 4 runs replay to the same score and state");
{
  const fixture = JSON.parse(readFileSync(FIXTURE, "utf8")) as { rev: number; runs: RunRecord[] };
  ok(fixture.rev === BUB_REV_TORPEDO && fixture.runs.length >= 16, `fixture holds ${fixture.runs.length} rev-${fixture.rev} runs`);
  let torpedoes = 0;
  for (const run of fixture.runs) {
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const result = replayBubbleRun(run.seed, raw, BUB_REV_TORPEDO);
    ok(!result.flagged, `${run.level} ${run.seed}: flagged on replay`);
    ok(result.score === run.score, `${run.level} ${run.seed}: stored ${run.score}, replays ${result.score}`);
    ok(fnv(JSON.stringify(result.state)) === run.stateHash, `${run.level} ${run.seed}: final state differs`);
    torpedoes += result.lines;
  }
  ok(torpedoes >= 8, `the stored runs fire ${torpedoes} torpedoes that hit something (want 8+)`);
  console.log(`  ${fixture.runs.length} runs, ${torpedoes} torpedo runs that destroyed bubbles`);
}

/* ========================= 2. the rule ========================= */
section("bubbleRev 4 torpedo rule on constructed fields");
const v3 = bubbleGameFor(BUB_REV_BAND);
const v4 = bubbleGameFor(BUB_REV_TORPEDO);
const at = (r: number, c: number) => r * BUB_COLS + c;
const reach = (BUB_D - 2) * (BUB_D - 2);

/** Fires a Torpedo from (x, y) world px with velocity (vx, vy); returns the end state and the path (world px, every tick). */
function fire(game: typeof v4, grid: number[], x: number, y: number, vx: number, vy: number) {
  const base = game.init(77);
  let s: BubState = { ...base, grid, startCount: grid.filter(Boolean).length, flightColour: BUB_LINE, x: x * 256, y: y * 256, vx, vy };
  const path: { x: number; y: number; grid: number[] }[] = [];
  for (let i = 0; i < 400 && s.flightColour !== 0; i++) {
    s = game.step(s, null);
    path.push({ x: s.x, y: s.y, grid: s.grid });
  }
  return { s, path };
}

/** Independent check: the loose set after removing `gone` (BFS from row 0). */
function looseAfter(grid: readonly number[]): Set<number> {
  const held = new Set<number>();
  const stack: number[] = [];
  for (let c = 0; c < bubRowCols(0); c++) if (grid[at(0, c)]) (held.add(at(0, c)), stack.push(at(0, c)));
  while (stack.length) {
    const i = stack.pop()!;
    const r = Math.floor(i / BUB_COLS);
    const c = i % BUB_COLS;
    const d = r % 2 === 1 ? 0 : -1;
    for (const [nr, nc] of [[r, c - 1], [r, c + 1], [r - 1, c + d], [r - 1, c + d + 1], [r + 1, c + d], [r + 1, c + d + 1]] as const) {
      if (nr < 0 || nr >= 18 || nc < 0 || nc >= bubRowCols(nr)) continue;
      const j = at(nr, nc);
      if (grid[j] && !held.has(j)) (held.add(j), stack.push(j));
    }
  }
  const loose = new Set<number>();
  grid.forEach((v, i) => v && !held.has(i) && loose.add(i));
  return loose;
}

const full = (rows: number) => {
  const g = new Array<number>(18 * BUB_COLS).fill(0);
  for (let r = 0; r < rows; r++) for (let c = 0; c < bubRowCols(r); c++) g[at(r, c)] = 1 + ((r * 3 + c) % 5);
  return g;
};

{
  // a. Straight up through a full 7-row field.
  const grid = full(7);
  const x0 = bubCellX(6, 4);
  const { s, path } = fire(v4, grid, x0, bubCellY(6, 0) + 60, 0, -1536);
  const gone = grid.map((v, i) => (v && !s.grid[i] ? i : -1)).filter((i) => i >= 0);
  ok(s.flightColour === 0 && !s.grid.includes(BUB_LINE), "a. the torpedo ends and never stays on the field");
  ok(s.lastSpecialCleared === BUB_TORPEDO_HITS && gone.length === BUB_TORPEDO_HITS && s.dropped === 0, `a. straight up a full field it destroys exactly ${BUB_TORPEDO_HITS} (got ${gone.length}, dropped ${s.dropped})`);
  ok(s.popped === BUB_TORPEDO_HITS && s.lines === 1 && s.shots === 1, "a. what it destroys counts as popped, and the torpedo as one shot and one torpedo");
  ok(gone.every((i) => Math.abs(bubCellX(Math.floor(i / BUB_COLS), i % BUB_COLS) - x0) <= BUB_D - 2), "a. everything it destroyed lies within contact distance of its straight path");
  for (let r = 0; r < 7; r++) ok(s.grid.slice(at(r, 0), at(r, 0) + bubRowCols(r)).some(Boolean), `a. row ${r} still holds bubbles (never a whole row)`);
  ok(path.every((p) => p.x === x0 * 256), "a. it keeps to its line (no deflection)");
  // Each tick, every bubble the torpedo has touched so far is gone (what is drawn touching is what goes).
  let drawnOk = true;
  for (const p of path.slice(0, -1)) {
    const px = Math.trunc(p.x / 256);
    const py = Math.trunc(p.y / 256);
    for (let r = 0; r < 7; r++)
      for (let c = 0; c < bubRowCols(r); c++) {
        const dx = bubCellX(r, c) - px;
        const dy = bubCellY(r, 0) - py;
        if (p.grid[at(r, c)] && dx * dx + dy * dy <= reach) drawnOk = false;
      }
  }
  ok(drawnOk, "a. while it flies, no bubble it overlaps is left standing");

  // On rev 3 the same field and shot clears the row it lands in.
  const old = fire(v3, grid, x0, bubCellY(6, 0) + 60, 0, -1536).s;
  ok(old.lines === 0 && old.grid[at(7, 4)] === 0, "a. rev 3 still lands the torpedo (an empty bottom row: nothing cleared)");
}

{
  // b. A diagonal shot: only bubbles within contact distance of its path, and it stops at the top.
  const grid = full(4);
  const startX = bubCellX(3, 1);
  const startY = bubCellY(3, 0) + 70;
  const { s, path } = fire(v4, grid, startX, startY, 600, -1414);
  const allGone = grid.map((v, i) => (v && !s.grid[i] ? i : -1)).filter((i) => i >= 0);
  const points: { x: number; y: number }[] = [{ x: startX, y: startY }, ...path.map((p) => ({ x: p.x / 256, y: p.y / 256 }))];
  const nearPath = (i: number) => {
    const cx = bubCellX(Math.floor(i / BUB_COLS), i % BUB_COLS);
    const cy = bubCellY(Math.floor(i / BUB_COLS), 0);
    // Sub-steps lie between tick points: check the segments.
    for (let k = 1; k < points.length; k++) {
      const a = points[k - 1]!;
      const b = points[k]!;
      const lx = b.x - a.x;
      const ly = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((cx - a.x) * lx + (cy - a.y) * ly) / (lx * lx + ly * ly || 1)));
      const dx = cx - (a.x + t * lx);
      const dy = cy - (a.y + t * ly);
      if (dx * dx + dy * dy <= (BUB_D - 1) * (BUB_D - 1)) return true;
    }
    return false;
  };
  const onPath = allGone.filter(nearPath);
  const offPath = allGone.filter((i) => !nearPath(i));
  const loose = looseAfter(grid.map((v, i) => (onPath.includes(i) ? 0 : v)));
  ok(s.lastSpecialCleared! > 0 && s.lastSpecialCleared! <= BUB_TORPEDO_HITS, `b. the diagonal torpedo destroys 1…${BUB_TORPEDO_HITS} (got ${s.lastSpecialCleared})`);
  ok(onPath.length === s.lastSpecialCleared, `b. what it destroyed (${s.lastSpecialCleared}) is exactly what lies on its path (${onPath.length})`);
  ok(offPath.length === s.dropped && offPath.every((i) => loose.has(i)) && loose.size === s.dropped, "b. anything else gone had lost its hold and dropped");
  for (let r = 0; r < 4; r++) ok(s.grid.slice(at(r, 0), at(r, 0) + bubRowCols(r)).some(Boolean), `b. row ${r} still holds bubbles`);
  ok(path.at(-1)!.y / 256 <= bubCellY(0, 0) || s.lastSpecialCleared === BUB_TORPEDO_HITS, "b. it runs until the top row's line or its last hit");
}

{
  // c. The rev-2 constructed field (arcade-batch2-check): rev 3 clears row 1; rev 4 only what it touches.
  const grid = new Array<number>(18 * BUB_COLS).fill(0);
  for (let c = 0; c < 10; c++) grid[at(0, c)] = c % 2 === 0 ? 3 : 4;
  grid[at(1, 1)] = 1;
  grid[at(1, 2)] = 1;
  grid[at(1, 4)] = 2;
  grid[at(1, 5)] = 2;
  const x = bubCellX(1, 3);
  const y = bubCellY(1, 0) + BUB_R + 6;
  const old = fire(v3, grid, x, y, 0, -1536).s;
  ok([1, 2, 4, 5].every((c) => old.grid[at(1, c)] === 0) && old.lastSpecialCleared === 4, "c. rev 3: the torpedo clears its whole row");
  const now = fire(v4, grid, x, y, 0, -1536).s;
  const gone = grid.map((v, i) => (v && !now.grid[i] ? i : -1)).filter((i) => i >= 0);
  ok(now.grid[at(1, 1)] === 1 && now.grid[at(1, 5)] === 2, "c. rev 4: bubbles in its row but off its path stay");
  ok(gone.every((i) => Math.abs(bubCellX(Math.floor(i / BUB_COLS), i % BUB_COLS) - x) <= BUB_D - 2), "c. rev 4: only bubbles touching its path go");
}

{
  // d. Orphan rule unchanged: a full row 2 hangs from row 0 by one bubble at (1, 4); the torpedo goes up through it.
  const grid = new Array<number>(18 * BUB_COLS).fill(0);
  for (let c = 0; c < 10; c++) grid[at(0, c)] = 1 + (c % 5);
  grid[at(1, 4)] = 2;
  for (let c = 0; c < 10; c++) grid[at(2, c)] = 1 + ((c + 2) % 5);
  const x = bubCellX(1, 4);
  const { s } = fire(v4, grid, x, bubCellY(2, 0) + 60, 0, -1536);
  const gone = grid.map((v, i) => (v && !s.grid[i] ? i : -1)).filter((i) => i >= 0);
  const cut = grid.map((v, i) => (gone.includes(i) && !(Math.floor(i / BUB_COLS) === 2 && Math.abs(bubCellX(2, i % BUB_COLS) - x) > BUB_D - 2) ? 0 : v));
  const loose = looseAfter(cut);
  ok(s.lastSpecialCleared === 5 && s.grid[at(1, 4)] === 0, `d. the torpedo destroys (2,4), (2,5), (1,4), (0,4), (0,5) (got ${s.lastSpecialCleared})`);
  ok(loose.size === 8 && s.dropped === 8 && [...loose].every((i) => s.grid[i] === 0), `d. the rest of row 2 loses its hold and drops (dropped ${s.dropped})`);
  ok(s.grid.slice(0, 10).filter(Boolean).length === 8, "d. row 0 keeps the eight bubbles off the path");
  ok(s.popped === 5 && s.lines === 1, "d. popped counts the torpedo's hits, dropped the loose ones");
}

{
  // e. A torpedo that touches nothing ends at the top and is not counted as used.
  const grid = new Array<number>(18 * BUB_COLS).fill(0);
  grid[at(0, 0)] = 1;
  const { s } = fire(v4, grid, bubCellX(0, 8), 400, 0, -1536);
  ok(s.flightColour === 0 && s.shots === 1 && (s.lines ?? 0) === 0 && s.grid[at(0, 0)] === 1 && !s.grid.includes(BUB_LINE), "e. a torpedo that hits nothing ends at the top row's line, counted as a shot only");
}

/* ========================= 3. older revisions ========================= */
section("Older revisions are unchanged");
{
  const legacy = JSON.parse(readFileSync("scripts/fixtures/arcade-tuning-f2-legacy.json", "utf8")) as {
    runs: { type: string; rev: number; level: string; seed: number; score: number; stateHash: number; raw: string }[];
  };
  const runs = legacy.runs.filter((r) => r.type === "bubble");
  ok(runs.length === 8 && runs.every((r) => r.rev === BUB_REV_BAND), `the Tuning F legacy fixture holds 8 bubbleRev 3 runs (got ${runs.length})`);
  for (const run of runs) {
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const result = replayBubbleRun(run.seed, raw, run.rev);
    ok(!result.flagged && result.score === run.score && fnv(JSON.stringify(result.state)) === run.stateHash, `rev 3 ${run.level} ${run.seed}: stored ${run.score}, replays ${result.score}`);
  }
  for (const seed of [1, 77, 4242, roomSeed(6)]) {
    const a = v3.init(seed);
    const b = v4.init(seed);
    const { lineRev, drilled, ...rest } = b;
    ok(lineRev === BUB_REV_TORPEDO && drilled === 0 && JSON.stringify(rest) === JSON.stringify(a), `seed ${seed}: rev 4 starts from rev 3's field, queue, PRNG and band fields`);
    ok(a.lineRev === undefined && bubbleGameFor(BUB_REV).init(seed).lineRev === undefined && bubbleGameFor(null).init(seed).lineRev === undefined, `seed ${seed}: older revisions carry no rev-4 fields`);
    ok(bubCheckpoint(b).checksum !== bubCheckpoint(a).checksum, `seed ${seed}: rev 4 folds its fields into the checksum`);
  }
}

/* ========================= 4. wiring ========================= */
section("Wiring");
{
  // Taller worlds batch 2 (16 Oct 2026) moved rooms on to bubbleRev 5 (bubbleRev 4 play in a deeper tank); arcade-tuning-g2-check covers it.
  const puzzle = { ...generateBubble(), bubbleRev: BUB_REV_TORPEDO };
  ok(playRevOf("bubble", generateBubble().bubbleRev) === BUB_REV_TORPEDO + 1, `new rooms stamp bubbleRev ${playRevOf("bubble", generateBubble().bubbleRev)}`);
  ok(puzzleUsesBands(puzzle as never), "bubbleRev 4 scores on the bands");
  const s = v4.init(5);
  const t = v3.init(5);
  const part = { ...s, grid: s.grid.map((v, i) => (i % 3 ? v : 0)), acted: 1 };
  const partOld = { ...t, grid: part.grid, acted: 1 };
  ok(v4.score(part) === v3.score(partOld), "rev 4 scores a field exactly as rev 3 (same band curve)");
  // The stored scripted best run clears the field through the server replay; a clear at half time scores 150.
  const fixture = JSON.parse(readFileSync(FIXTURE, "utf8")) as { best: RunRecord };
  const best = fixture.best;
  const replay = replayBubbleRun(best.seed, gunzipSync(Buffer.from(best.raw, "base64")).toString(), BUB_REV_TORPEDO);
  ok(!replay.flagged && replay.cleared && replay.score === best.score && fnv(JSON.stringify(replay.state)) === best.stateHash, `the scripted best run clears through the server replay (${replay.score}, ${replay.endedSeconds} s)`);
  ok(replay.lines > 0, "the scripted best run uses its torpedo");
  ok(v4.score({ ...replay.state, endedTick: 2700 }) === 150 && v4.score({ ...replay.state, endedTick: 5400 }) === 140, "a clear with half the time left scores 150 (140 at the buzzer)");
  console.log(`  scripted best run: ${replay.score} (cleared at ${replay.endedSeconds} s, seed ${best.seed})`);
}

console.log(`\n${checks} checks`);
if (failures.length) {
  console.log(`FAIL: ${failures.length} failed`);
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("PASS: bubble-rev4-check");
