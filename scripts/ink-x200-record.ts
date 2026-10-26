/**
 * Records ink-x200-check's new-stamp runs (scripts/fixtures/ink-x200-runs.json.gz): skill-band bot runs on inkRev 10
 * (weak, good, near-perfect and elite on three seeds) and the perfect run on two, each as the phone's encoded answer
 * with the score, levels, fails, end tick and final checkpoint the server replay gave when recorded.
 *
 *   bun scripts/ink-x200-record.ts
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { inkBridgeGameFor, inkCheckpoint, INK_REV_EXPAND, type InkState } from "../src/lib/arcade/inkBridge";
import { encodeInkBridgeRun, replayInkBridgeRun } from "../src/lib/duel/inkBridge";
import { roomSeed } from "./arcade-skill-bands/games";
import { Human } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/inkbridge";
import { inkOracleRun } from "./ink-x200-oracle";

const game = inkBridgeGameFor(INK_REV_EXPAND);

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

const runs: { who: string; seed: number; raw: string; score: number; levels: number; fails: number; tick: number; checksum: number }[] = [];
const add = (who: string, seed: number, events: ArcadeInputEvent[]) => {
  const raw = encode(seed, events);
  const r = replayInkBridgeRun(seed, raw, INK_REV_EXPAND);
  if (r.flagged) throw new Error(`${who} seed ${seed}: flagged`);
  runs.push({ who, seed, raw, score: r.score, levels: r.levels, fails: r.fails, tick: r.state.tick, checksum: inkCheckpoint(r.state).checksum });
  console.log(`${who} seed ${seed}: ${r.score} (${r.levels} levels)`);
};
for (const n of [0, 1, 2])
  for (const level of ["weak", "good", "near", "elite"] as const) {
    const seed = roomSeed(n);
    add(level, seed, bot({ game, seed, rev: INK_REV_EXPAND, human: new Human("inkbridge", seed, level) }).events ?? []);
  }
for (const n of [0, 3]) add("perfect", roomSeed(n), inkOracleRun(roomSeed(n)).events);
writeFileSync("scripts/fixtures/ink-x200-runs.json.gz", gzipSync(JSON.stringify({ note: "Rainbow Bridge inkRev 10 runs recorded by scripts/ink-x200-record.ts", rev: INK_REV_EXPAND, runs })));
console.log(`${runs.length} runs written`);
