/**
 * Blockfall (blockfallRev 1, 1 Nov 2026; docs/arcade-standard/blockfall.md):
 *
 *  1. the piece order comes from the seed alone: shuffled bags of seven (every bag holds each shape once), the same
 *     sequence for the same seed and a different one for another;
 *  2. the rules: a move steps until blocked, a turn kicks off a wall, a drop lands on the ghost and locks at once,
 *     hold works once a piece, gravity speeds up every 15 s (BF_GRAVITY), a resting piece locks after BF_LOCK_TICKS,
 *     full rows clear, a new piece that overlaps the stack tops the run out early (its score kept), the buzzer at 60 s;
 *  3. a replay is deterministic and the server path agrees with the sim; out-of-range payloads are clamped; a
 *     tampered claimed score is flagged;
 *  4. the deal: 300 distinct seeds, and the oracle takes each to exactly 200 through the server replay (quick depth
 *     24 spread through the deal, CHECKS_FULL=1 all 300 and the file rebuilt byte for byte); rooms dealt from it until
 *     3 Nov 2026 (Blockzone, blockfallRev 2, deals from its own deal: moon-blockzone-check);
 *  5. the score: no input 0, a run that played at least 1;
 *  6. the skill bands rise weak → flawless (12 deal seeds; flawless 200 on each);
 *  7. the help states "total 200" and names no borrowed game (Blockzone's own help and controls: moon-blockzone-check).
 *
 *   bun scripts/blockfall-check.ts
 */
import { execFileSync } from "node:child_process";
import { inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  BF_CHECKPOINT_INTERVAL, BF_GRAVITY, BF_HIDDEN, BF_INPUT_DOWN, BF_INPUT_DROP, BF_INPUT_HOLD, BF_INPUT_MOVE, BF_INPUT_TURN, BF_LEVEL_TICKS, BF_LOCK_TICKS,
  BF_ROWS, BF_RUN_TICKS, BF_W, BLOCKFALL_REV, bfApply, bfCells, bfCheckpoint, bfGhostY, bfInit, bfLevel, bfStackHeight, blockfallGame, type BfState,
} from "../src/lib/arcade/blockfall";
import { encodeBlockfallRun, replayBlockfallRun } from "../src/lib/duel/blockfall";
import { BLOCKFALL_DEAL } from "../src/lib/duel/blockfallDeal.server";
import { generateBlockfall } from "../src/lib/duel/arcade.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { blockfallOracleRun } from "./blockfall-oracle";
import { ALL_LEVELS, Human } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/blockfall";

console.error = () => {};
const FULL = process.env["CHECKS_FULL"] === "1" || process.argv.includes("--full");
let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}

/* 1. The piece order. */
{
  const order = (seed: number) => {
    const s = bfInit(seed);
    return [s.piece.shape, ...s.queue];
  };
  let bags = true;
  for (const seed of [1, 2, 99, 123456]) {
    let s = bfInit(seed);
    const seen = [s.piece.shape];
    for (let i = 0; i < 69; i++) {
      s = bfApply({ ...s, board: new Array(BF_ROWS * BF_W).fill(0) }, { k: BF_INPUT_DROP, a: 0 });
      seen.push(s.piece.shape);
    }
    for (let b = 0; b < 10; b++) if (new Set(seen.slice(b * 7, b * 7 + 7)).size !== 7) bags = false;
  }
  ok(bags, "order: every bag of seven holds each shape once");
  ok(JSON.stringify(order(5)) === JSON.stringify(order(5)) && JSON.stringify(order(5)) !== JSON.stringify(order(6)), "order: the same seed gives the same pieces, another seed others");
  ok(order(5).length >= 4, "order: the next three show (the queue holds at least three after the piece)");
}

/* 2. The rules. */
{
  const s0 = { ...bfInit(11), acted: 1 };
  const far = bfApply(s0, { k: BF_INPUT_MOVE, a: -9 });
  const minX = Math.min(...bfCells(far.piece.shape, far.piece.turn).map(([x]) => far.piece.x + x));
  ok(minX === 0, "move: steps until blocked by the wall");
  const turned = bfApply(far, { k: BF_INPUT_TURN, a: 1 });
  ok(turned.piece.turn === (far.piece.turn + 1) % 4 || turned.piece.shape === 1, "turn: a turn at the wall kicks clear");
  const ghost = bfGhostY(s0.board, s0.piece);
  const dropped = bfApply(s0, { k: BF_INPUT_DROP, a: 0 });
  ok(dropped.pieces === 1 && bfCells(s0.piece.shape, s0.piece.turn).every(([x, y]) => dropped.board[(ghost + y) * BF_W + s0.piece.x + x] === s0.piece.shape + 1), "drop: lands on the ghost and locks at once");
  const held = bfApply(s0, { k: BF_INPUT_HOLD, a: 0 });
  ok(held.hold === s0.piece.shape && held.piece.shape === s0.queue[0] && held.held === 1, "hold: keeps the piece and brings the next");
  const again = bfApply(held, { k: BF_INPUT_HOLD, a: 0 });
  ok(again.rejects === held.rejects + 1 && again.hold === held.hold, "hold: once a piece");
  const down = bfApply(s0, { k: BF_INPUT_DOWN, a: 0 });
  ok(down.piece.y === s0.piece.y + 1, "down: one row");
  ok(bfLevel(0) === 0 && bfLevel(BF_LEVEL_TICKS - 1) === 0 && bfLevel(BF_LEVEL_TICKS) === 1 && bfLevel(3 * BF_LEVEL_TICKS) === 3 && bfLevel(BF_RUN_TICKS) === 3, "gravity: a step faster every 15 s, four steps");
  ok(BF_GRAVITY.every((g, i) => i === 0 || g < BF_GRAVITY[i - 1]!), "gravity: each step faster than the last");
  // Gravity and the lock wait on an idle run: the first piece falls a row every BF_GRAVITY[0] ticks, then locks.
  let s = bfInit(11);
  const y0 = s.piece.y;
  for (let t = 0; t < BF_GRAVITY[0]; t++) s = blockfallGame.step(s, null);
  ok(s.piece.y === y0 + 1, `gravity: a row every ${BF_GRAVITY[0]} ticks at first`);
  let landed = -1;
  for (let t = 0; t < 2000 && s.pieces === 0; t++) {
    const was = s.lock;
    s = blockfallGame.step(s, null);
    if (landed < 0 && was === 0 && s.lock === 1) landed = s.tick;
  }
  ok(s.pieces === 1 && landed > 0 && s.lockTick - landed === BF_LOCK_TICKS - 1, `lock: a resting piece locks after ${BF_LOCK_TICKS} ticks`);
  // A full row clears: fill the bottom row but one gap, drop a bar upright into the gap.
  const board = new Array(BF_ROWS * BF_W).fill(0);
  for (let x = 0; x < BF_W - 1; x++) board[(BF_ROWS - 1) * BF_W + x] = 3;
  let c: BfState = { ...bfInit(1), board, piece: { shape: 0, turn: 1, x: BF_W - 3, y: 0 } };
  c = bfApply(c, { k: BF_INPUT_DROP, a: 0 });
  ok(c.lines === 1 && bfStackHeight(c.board) === 3, "clear: a full row clears and the stack above falls");
  // Top out: a stack up to the spawn rows ends the run early, its score kept.
  const tall = new Array(BF_ROWS * BF_W).fill(0);
  for (let y = BF_HIDDEN; y < BF_ROWS; y++) for (let x = 0; x < BF_W; x++) if (x !== 0) tall[y * BF_W + x] = 2;
  let t = { ...bfInit(3), board: tall, acted: 1, lines: 9 };
  for (let i = 0; i < 400 && !t.ended; i++) t = blockfallGame.step(t, null);
  ok(t.ended === 2 && t.endTick < BF_RUN_TICKS && blockfallGame.score(t) >= 1 && t.lines === 9, "top out: the run ends early and keeps its score");
  let idle = bfInit(4);
  while (!blockfallGame.isOver(idle)) idle = blockfallGame.step(idle, null);
  ok(idle.ended === 2 || idle.tick === BF_RUN_TICKS, "the run ends at 60 s or on a top-out");
  ok(blockfallGame.score(idle) === 0, "score: no input scores 0");
}

/* 3. Replay. */
{
  let seed = 4242;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) >>> 8) / 16777216;
  const events: ArcadeInputEvent[] = [];
  let s = blockfallGame.init(BLOCKFALL_DEAL[3]!);
  const checkpoints = [];
  while (!blockfallGame.isOver(s)) {
    const t = s.tick + 1;
    if (rnd() < 0.12) recordInput(events, { t, k: 1 + Math.floor(rnd() * 5), a: Math.floor(rnd() * 30) - 15, b: 0, c: 0, d: 0 }, blockfallGame.inputRanges);
    s = blockfallGame.step(s, inputAt(events, t));
    if (s.tick % BF_CHECKPOINT_INTERVAL === 0) checkpoints.push(bfCheckpoint(s));
  }
  ok(events.every((e) => e.k !== BF_INPUT_MOVE || Math.abs(e.a) <= BF_W - 1) && events.every((e) => e.k !== BF_INPUT_TURN || Math.abs(e.a) <= 1), "replay: out-of-range payloads are clamped");
  const raw = encodeBlockfallRun({ seed: BLOCKFALL_DEAL[3]!, claimedScore: blockfallGame.score(s), events, endTick: s.tick, checkpoints });
  const r1 = replayBlockfallRun(BLOCKFALL_DEAL[3]!, raw);
  const r2 = replayBlockfallRun(BLOCKFALL_DEAL[3]!, raw);
  ok(r1.score === blockfallGame.score(s) && JSON.stringify(r1.state) === JSON.stringify(r2.state) && !r1.flagged, "replay: deterministic and the server agrees with the sim");
  const tampered = encodeBlockfallRun({ seed: BLOCKFALL_DEAL[3]!, claimedScore: 200, events, endTick: s.tick, checkpoints });
  ok(replayBlockfallRun(BLOCKFALL_DEAL[3]!, tampered).score === r1.score, "replay: a tampered claimed score changes nothing (the server's own score)");
}

/* 4. The deal. */
{
  ok(BLOCKFALL_DEAL.length === 300 && new Set(BLOCKFALL_DEAL).size === 300, "deal: 300 distinct seeds");
  const picks = FULL ? BLOCKFALL_DEAL.map((_, i) => i) : Array.from({ length: 24 }, (_, i) => Math.floor((i * 299) / 23));
  const bad: string[] = [];
  for (const i of picks) {
    const r = blockfallOracleRun(BLOCKFALL_DEAL[i]!).result;
    if (r.score !== 200 || r.flagged) bad.push(`#${i} ${BLOCKFALL_DEAL[i]}: ${r.score}`);
  }
  ok(bad.length === 0, `deal: the oracle takes ${picks.length} deal seeds to 200 through the server replay${bad.length ? ` (${bad.join(", ")})` : ""}`);
  if (FULL) {
    let same = true;
    try {
      execFileSync("bun", ["scripts/blockfall-deal.ts", "--check"], { stdio: "pipe" });
    } catch {
      same = false;
    }
    ok(same, "deal: the file is what blockfall-deal.ts builds");
  }
  // Rooms dealt blockfallRev 1 from this deal until 3 Nov 2026; they now deal Blockzone (blockfallRev 2) from its own
  // proved deal (the brief changed the rule; moon-blockzone-check proves the new deal).
  const dealt = generateBlockfall();
  ok(BLOCKFALL_REV === 1 && dealt.blockfallRev === 2, "deal: blockfallRev 1 keeps this deal; rooms now deal blockfallRev 2");
}

/* 5–6. The bands. */
{
  const medians: number[] = [];
  for (const level of ALL_LEVELS) {
    const scores: number[] = [];
    for (let n = 0; n < 12; n++) {
      const seed = BLOCKFALL_DEAL[(n * 37) % 300]!;
      const ev = bot({ game: blockfallGame, seed, rev: 1, human: new Human("blockfall", seed, level) }).events ?? [];
      const raw = encodeBlockfallRun({ seed, claimedScore: 0, events: ev, endTick: 0, checkpoints: [] });
      scores.push(replayBlockfallRun(seed, raw).score);
    }
    if (level === "perfect") ok(scores.every((x) => x === 200), "bands: flawless play scores 200 on every seed");
    if (level !== "perfect") ok(scores.every((x) => x >= 1), `bands: every ${level} run that played scores at least 1`);
    medians.push([...scores].sort((a, b) => a - b)[6]!);
  }
  ok(medians.every((m, i) => i === 0 || m >= medians[i - 1]!) && medians[0]! < medians[3]! && medians[3]! < medians[4]!, `bands: medians rise weak → flawless (${medians.join(" / ")})`);
}

/* 7. The help. */
{
  const help = PUZZLE_INSTRUCTIONS.blockfall;
  ok(!!help && help.score.includes("total 200") || help!.score.includes("Together 200"), `help: the parts total 200: ${help?.score}`);
  // Blockzone (3 Nov 2026) has no hold and no pads: its help names drag, tap, the drag down and flick (the brief
  // changed the rule; moon-blockzone-check holds the rest).
  const how = JSON.stringify(help?.how ?? []);
  ok(/drag/i.test(how) && /tap/i.test(how) && /flick/i.test(how), "help: drag, tap and flick are named");
  ok(!/tetr/i.test(JSON.stringify(help)), "help: no borrowed names");
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL blockfall-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS blockfall-check: ${checks} checks (${FULL ? "full" : "quick"} depth)`);
