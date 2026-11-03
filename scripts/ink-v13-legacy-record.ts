/**
 * Records ink-v13-check's legacy fixture (scripts/fixtures/ink-v13-legacy.json.gz) on main before inkRev 13 (Nov 2026):
 * inkRev 12 runs (skill-band bots at weak, good, near-perfect and elite on two seeds, and the perfect run on one), each
 * as the phone's encoded answer with the score, levels, fails, end tick and final checkpoint the server replay gave, plus
 * a digest of the levels inkRev 10, 11 and 12 build on three seeds. ink-v13-check replays them on the changed tree.
 *
 *   bun scripts/ink-v13-legacy-record.ts       (run on main, before the change)
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { inkBridgeGameFor, inkCheckpoint, type InkState } from "../src/lib/arcade/inkBridge";
import { encodeInkBridgeRun, replayInkBridgeRun } from "../src/lib/duel/inkBridge";
import { roomSeed } from "./arcade-skill-bands/games";
import { Human } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/inkbridge";
import { inkOracleRun } from "./ink-x200-oracle";

const REV = 12;
const OUT = "scripts/fixtures/ink-v13-legacy.json.gz";
const game = inkBridgeGameFor(REV);

function encode(seed: number, events: ArcadeInputEvent[]): string {
  let s = game.init(seed) as InkState;
  const byTick = new Map(events.map((e) => [e.t, e]));
  const checkpoints: unknown[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    if (s.tick % 300 === 0) checkpoints.push(inkCheckpoint(s));
  }
  return encodeInkBridgeRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints } as never);
}

const runs: { who: string; seed: number; rev: number; raw: string; score: number; levels: number; fails: number; tick: number; checksum: number }[] = [];
const add = (who: string, seed: number, events: ArcadeInputEvent[]) => {
  const raw = encode(seed, events);
  const r = replayInkBridgeRun(seed, raw, REV);
  if (r.flagged) throw new Error(`${who} seed ${seed}: flagged`);
  runs.push({ who, seed, rev: REV, raw, score: r.score, levels: r.levels, fails: r.fails, tick: r.state.tick, checksum: inkCheckpoint(r.state).checksum });
  console.log(`${who} seed ${seed}: ${r.score} (${r.levels} levels)`);
};
for (const n of [0, 1])
  for (const level of ["weak", "good", "near", "elite"] as const) {
    const seed = roomSeed(n);
    add(level, seed, bot({ game, seed, rev: REV, human: new Human("inkbridge", seed, level), fixes: true }).events ?? []);
  }
add("perfect", roomSeed(0), inkOracleRun(roomSeed(0), REV).events);

/** A digest of the levels a revision builds on a seed. */
const levelDigests: { rev: number; seed: number; sha: string }[] = [];
for (const rev of [10, 11, 12])
  for (const n of [0, 5, 141]) {
    const seed = roomSeed(n);
    const sha = createHash("sha256").update(JSON.stringify((inkBridgeGameFor(rev).init(seed) as InkState).list)).digest("hex");
    levelDigests.push({ rev, seed, sha });
  }
writeFileSync(OUT, gzipSync(JSON.stringify({ note: "Rainbow Bridge inkRev 12 runs and inkRev 10-12 level digests recorded on main by scripts/ink-v13-legacy-record.ts before inkRev 13", runs, levelDigests })));
console.log(`${runs.length} runs and ${levelDigests.length} digests written to ${OUT}`);
