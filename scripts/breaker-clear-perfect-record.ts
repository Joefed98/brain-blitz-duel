/**
 * Records scripts/fixtures/breaker-clear-perfect.json (the Retro overhaul, 15 Nov 2026): a flawless skill-band bot run
 * on Breaker brkRev 12 that scores 200 through the server replay, for arcade-standard-check's breaker entry.
 *
 *   bun scripts/breaker-clear-perfect-record.ts
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/breaker";
import { breakerGameFor, BRK_REV_CLEAR } from "../src/lib/arcade/breaker";
import { replayBreakerRun } from "../src/lib/duel/breaker";

const spec = GAME_BY_TYPE.get("breaker" as never)!;
for (let n = 0; n < 60; n++) {
  const seed = spec.seedFor(n);
  const game = breakerGameFor(BRK_REV_CLEAR);
  const out = bot({ game, seed, rev: BRK_REV_CLEAR, human: new Human("breaker", seed, "perfect" as never), fixes: true } as never) as { events?: unknown[] };
  const events = (out.events ?? []) as { t: number }[];
  const by = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  const checkpoints: unknown[] = [];
  while (!game.isOver(s)) {
    s = game.step(s, (by.get(s.tick + 1) as never) ?? null);
    if (s.tick % 300 === 0) checkpoints.push(spec.checkpoint(s));
  }
  const score = game.score(s);
  if (score !== 200) continue;
  const raw = spec.encode({ seed, claimedScore: score, events, endTick: s.tick, checkpoints }, BRK_REV_CLEAR, seed) as string;
  const res = replayBreakerRun(seed, raw, BRK_REV_CLEAR);
  if (res.flagged || res.score !== 200) continue;
  writeFileSync("scripts/fixtures/breaker-clear-perfect.json", JSON.stringify({ rev: BRK_REV_CLEAR, seed, raw: gzipSync(raw).toString("base64") }) + "\n");
  console.log(`recorded seed ${seed} (bot seed index ${n}): 200 through the server replay`);
  process.exit(0);
}
console.log("no 200 run found");
process.exit(1);
