/**
 * Records the legacy fixture for moon-blockzone-check (3 Nov 2026): runs on the stamps rooms dealt before Moon Climb and
 * Blockzone (Ricochet ricoRev 2, the ninja wall-climb; Blockfall blockfallRev 1), each with the score and a digest of
 * the final state the server's replay stores. Run it on a checkout of main from before the change (the APIs it calls
 * exist there unchanged), so the check proves both stamps still replay and score exactly as they did:
 *
 *   bun scripts/moon-blockzone-legacy-record.ts [out.json]   (default scripts/fixtures/moon-blockzone-legacy.json)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { encodeNinjaRun, replayNinjaRun } from "../src/lib/duel/ricochet";
import { ninjaCheckpoint, ninjaGame, NINJA_CHECKPOINT_INTERVAL } from "../src/lib/arcade/ricochetNinja";
import { bfCheckpoint, blockfallGame, BF_CHECKPOINT_INTERVAL } from "../src/lib/arcade/blockfall";
import { encodeBlockfallRun, replayBlockfallRun } from "../src/lib/duel/blockfall";
import { BLOCKFALL_DEAL } from "../src/lib/duel/blockfallDeal.server";
import { Human } from "./arcade-skill-bands/human";
import { bot as ninjaBot } from "./arcade-skill-bands/bots/ricochet";
import { bot as bfBot } from "./arcade-skill-bands/bots/blockfall";

console.error = () => {};
export const digest = (state: unknown) => createHash("sha256").update(JSON.stringify(state)).digest("hex").slice(0, 16);

function encode(game: any, checkpoint: any, interval: number, enc: (r: any) => string, seed: number, events: any[]): string {
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  const cps: any[] = [];
  while (!game.isOver(s)) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % interval === 0) cps.push(checkpoint(s));
  }
  return enc({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints: cps });
}

if (import.meta.main) {
  const out: { type: string; rev: number; seed: number; level: string; raw: string; score: number; digest: string }[] = [];
  const levels = ["weak", "average", "great", "elite"] as const;
  for (let i = 0; i < 12; i++) {
    const level = levels[i % levels.length]!;
    const seed = 1000 + i * 7919;
    const ev = ninjaBot({ game: ninjaGame as any, seed, rev: 2, human: new Human("ricochet", seed, level), fixes: true }).events ?? [];
    const raw = encode(ninjaGame, ninjaCheckpoint, NINJA_CHECKPOINT_INTERVAL, encodeNinjaRun, seed, ev);
    const r = replayNinjaRun(seed, raw);
    out.push({ type: "ricochet", rev: 2, seed, level, raw, score: r.score, digest: digest(r.state) });
  }
  for (let i = 0; i < 12; i++) {
    const level = levels[i % levels.length]!;
    const seed = BLOCKFALL_DEAL[(i * 23) % BLOCKFALL_DEAL.length]!;
    const ev = bfBot({ game: blockfallGame as any, seed, rev: 1, human: new Human("blockfall", seed, level), fixes: true }).events ?? [];
    const raw = encode(blockfallGame, bfCheckpoint, BF_CHECKPOINT_INTERVAL, encodeBlockfallRun, seed, ev);
    const r = replayBlockfallRun(seed, raw, 1);
    out.push({ type: "blockfall", rev: 1, seed, level, raw, score: r.score, digest: digest(r.state) });
  }
  const file = process.argv[2] ?? "scripts/fixtures/moon-blockzone-legacy.json";
  writeFileSync(file, JSON.stringify({ recorded: "main before Moon Climb and Blockzone", runs: out }) + "\n");
  console.log(`wrote ${out.length} runs to ${file}`);
}
