/**
 * Coral Pop on the arcade scoring standard (bubbleRev 11, docs/arcade-standard/bubble.md):
 *
 *  1. bubbleRev 10 runs recorded on the untouched tree (scripts/fixtures/bubble-standard-legacy.json.gz, written by
 *     scripts/bubble-standard-legacy.ts) replay to the same score, final checksum and feature counters;
 *  2. bubbleRev 11 starts as bubbleRev 10 (field, queue, chests) with the 4-pop mine in place of the blast radius,
 *     the checksum folding it in; rooms deal it;
 *  3. the mine pops exactly the 4 bubbles nearest where it lands (bubbleRev 10's mine, on the same shot, two rings);
 *  4. bubbleRev 11 runs played by the skill-band bot replay through the server path (replayBubbleRun) to the stored
 *     score, which is its standard parts' sum (stdScore), the reveal lines adding up to it.
 *
 *   bun scripts/bubble-standard-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  bubCheckpoint,
  bubbleGameFor,
  bubbleStdParts,
  bubMineNearest,
  BUB_BOMB,
  BUB_COLS,
  BUB_INPUT_SHOT,
  BUB_REV_BLAST,
  BUB_REV_STD,
  BUB_V11_MINE_POPS,
  BUB_V11_STD_SPEC,
  type BubState,
} from "../src/lib/arcade/bubble";
import { stdHelp, stdLines, stdScore } from "../src/lib/arcade/arcadeStandard";
import { encodeBubbleRun, replayBubbleRun } from "../src/lib/duel/bubble";
import { generateBubble } from "../src/lib/duel/arcade.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { roomSeed } from "./arcade-skill-bands/games";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}

/* 1. Legacy bubbleRev 10 runs. */
const legacy = JSON.parse(gunzipSync(readFileSync(new URL("./fixtures/bubble-standard-legacy.json.gz", import.meta.url))).toString()) as any[];
ok(legacy.length >= 20, `${legacy.length} legacy runs`);
for (const run of legacy) {
  const r = replayBubbleRun(run.seed, run.raw, run.rev);
  const s = r.state;
  const same =
    r.score === run.score &&
    bubCheckpoint(s).checksum === run.checksum &&
    s.tick === run.tick &&
    s.popped === run.popped &&
    s.dropped === run.dropped &&
    (s.chests ?? 0) === run.chests &&
    (s.banks ?? 0) === run.banks &&
    (s.combos ?? 0) === run.combos &&
    (s.bombs ?? 0) === run.bombs;
  ok(same, `legacy ${run.level} #${run.n}: bubbleRev ${run.rev} replays to ${r.score} (stored ${run.score}) and the same state`);
  ok(bubbleStdParts(s) === null, `legacy ${run.level} #${run.n}: no standard parts on bubbleRev ${run.rev}`);
}

/* 2. The new stamp's start. */
const blast = bubbleGameFor(BUB_REV_BLAST);
const std = bubbleGameFor(BUB_REV_STD);
for (const seed of [1, 7, 12345, 987654321, 2_000_000_011]) {
  const b = blast.init(seed) as BubState;
  const s = std.init(seed) as BubState;
  ok(s.minePops === BUB_V11_MINE_POPS && s.std === 1 && s.bombR === undefined, `seed ${seed}: bubbleRev 11 carries the 4-pop mine and no blast radius`);
  ok(JSON.stringify({ ...s, minePops: undefined, std: undefined }) === JSON.stringify({ ...b, bombR: undefined }), `seed ${seed}: bubbleRev 11 starts as bubbleRev 10 (field, queue, chests)`);
  ok(bubCheckpoint(s).checksum !== bubCheckpoint(b).checksum, `seed ${seed}: the checksum folds the mine in`);
}
ok(generateBubble().bubbleRev === BUB_REV_STD, `rooms deal bubbleRev ${BUB_REV_STD}`);
ok(String(PUZZLE_INSTRUCTIONS.bubble?.score ?? "").includes(stdHelp(BUB_V11_STD_SPEC)), "the help states every part and the 200");

/* 3. The mine. */
{
  /** A full reef five rows deep (colour 3), the mine first in the queue, shot straight up. */
  const minedReef = (game: typeof std): BubState => {
    const s = game.init(1) as BubState;
    const grid = new Array<number>(s.grid.length).fill(0);
    for (let i = 0; i < 5 * BUB_COLS; i++) grid[i] = 3;
    const queue = [...s.queue];
    queue[0] = BUB_BOMB;
    return { ...s, grid, queue, queueAt: 0, startCount: 5 * BUB_COLS };
  };
  const fire = (game: typeof std, s0: BubState): BubState => {
    let s = game.step(s0, { t: 1, k: BUB_INPUT_SHOT, a: 100, b: -4096, c: 0, d: 0 });
    for (let i = 0; i < 400 && s.flightColour !== 0; i++) s = game.step(s, null);
    return s;
  };
  const before = minedReef(std);
  const after = fire(std, before);
  const old = fire(blast, minedReef(blast));
  const landed = after.lastSpecialCell ?? -1;
  ok(after.lastSpecial === BUB_BOMB && landed === old.lastSpecialCell, `the mine lands on the same cell on both stamps (${landed})`);
  const grid = [...before.grid];
  grid[landed] = BUB_BOMB;
  const nearest = bubMineNearest(grid, landed, BUB_V11_MINE_POPS);
  ok(after.lastSpecialCleared === BUB_V11_MINE_POPS && after.popped === BUB_V11_MINE_POPS, `bubbleRev 11's mine pops ${after.lastSpecialCleared}, not ${BUB_V11_MINE_POPS}`);
  ok(nearest.every((i) => before.grid[i] && !after.grid[i]) && after.grid[landed] === 0, "the four it pops are the nearest");
  ok(before.grid.filter((v, i) => v && !after.grid[i]).length === BUB_V11_MINE_POPS + after.dropped, "nothing else leaves the reef but what then hangs loose");
  ok((old.lastSpecialCleared ?? 0) > BUB_V11_MINE_POPS, `bubbleRev 10's mine still clears two rings (${old.lastSpecialCleared})`);
  // In a full field the hex neighbours above and below (17 px across, 29 down: 1,130 px²) are nearer than those beside
  // (34 px: 1,156 px²), so the mine pops those four; a fifth would be the nearer-indexed of the two beside (ties go to
  // the lower cell index).
  const full = new Array<number>(before.grid.length).fill(0);
  for (let i = 0; i < 9 * BUB_COLS; i++) full[i] = 2;
  const centre = 4 * BUB_COLS + 4;
  const four = bubMineNearest(full, centre, 4);
  ok(JSON.stringify(four) === JSON.stringify([3 * BUB_COLS + 3, 3 * BUB_COLS + 4, 5 * BUB_COLS + 3, 5 * BUB_COLS + 4]), `in a full field the mine pops the four diagonal neighbours (${four.join(", ")})`);
  const five = bubMineNearest(full, centre, 5);
  ok(JSON.stringify(five) === JSON.stringify([3 * BUB_COLS + 3, 3 * BUB_COLS + 4, 4 * BUB_COLS + 3, 5 * BUB_COLS + 3, 5 * BUB_COLS + 4]), `ties go to the lower cell index (${five.join(", ")})`);
}

/* 4. Real play through the server replay. */
{
  const { bot } = await import("./arcade-skill-bands/bots/bubble.ts");
  const levels: SkillLevel[] = ["weak", "good", "near", "elite"];
  let featurePaid = 0;
  for (const [k, level] of levels.entries()) {
    for (const n of [k, k + 10]) {
      const seed = roomSeed(n);
      const events = bot({ game: std, seed, rev: BUB_REV_STD, human: new Human("bubble", seed, level), fixes: true } as any).events ?? [];
      const byTick = new Map(events.map((e: any) => [e.t, e]));
      let s = std.init(seed) as BubState;
      const checkpoints: any[] = [];
      while (!std.isOver(s) && s.tick < std.runTicks) {
        s = std.step(s, (byTick.get(s.tick + 1) as any) ?? null);
        if (s.tick % 300 === 0) checkpoints.push(bubCheckpoint(s));
      }
      const claimed = std.score(s);
      const result = replayBubbleRun(seed, encodeBubbleRun({ seed, claimedScore: claimed, events, endTick: s.tick, checkpoints }), BUB_REV_STD);
      ok(!result.flagged && result.score === claimed && claimed >= 1 && claimed <= 200, `${level} #${n}: a bubbleRev 11 run (${claimed}) replays through the server to ${result.score}`);
      const parts = bubbleStdParts(result.state)!;
      ok(parts !== null && result.score === stdScore(parts, true), `${level} #${n}: the score is its parts' sum`);
      const lines = stdLines(parts, result.score);
      ok(lines[lines.length - 1]!.includes(String(result.score)), `${level} #${n}: the reveal lines end on the score`);
      featurePaid += parts.slice(1).reduce((t, p) => t + p.points, 0);
    }
  }
  ok(featurePaid > 0, "features pay in real play");
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL: ${failures.length} of ${checks} Coral Pop standard checks`);
  process.exit(1);
}
console.log(`PASS: ${checks} Coral Pop standard checks (bubbleRev ${BUB_REV_STD}; ${legacy.length} bubbleRev ${BUB_REV_BLAST} runs replay as before)`);
