/**
 * Records Scrumper snipRev 11 runs for snip-x200-check (the 200-point expansion): the skill-band bots'
 * logs on room seeds 0 and 1 for every tier (weak … elite), plus the stored perfect plans on room seed 0
 * (level "perfect", 200), each encoded as the phone does (checkpoints every SNIP_CHECKPOINT_INTERVAL ticks),
 * replayed through the server path and stored with its score.
 *
 *   bun scripts/snip-x200-runs.ts > scripts/fixtures/snip-x200-runs.json.gz
 */
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { snipCheckpoint, snipGameFor, SNIP_CHECKPOINT_INTERVAL, SNIP_REV_EXPAND, type SnipCheckpoint } from "../src/lib/arcade/snip";
import { encodeSnipRun, replaySnipRun } from "../src/lib/duel/snip";
import { Human, TIERS } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/snip";
import { roomSeed } from "./arcade-skill-bands/games";
import { xPlannedRun, type XProofs } from "./snip-x200-lib";

const game = snipGameFor(SNIP_REV_EXPAND);

/** The phone's encoding of a log: the run replayed for its checkpoints and claimed score. */
export function encodeLog(seed: number, events: ArcadeInputEvent[]): string {
  let s = game.init(seed);
  const checkpoints: SnipCheckpoint[] = [];
  const byTick = new Map(events.map((e) => [e.t, e]));
  while (!game.isOver(s)) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    if (s.tick % SNIP_CHECKPOINT_INTERVAL === 0) checkpoints.push(snipCheckpoint(s));
  }
  return encodeSnipRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
}

if (import.meta.main) {
  const runs: { level: string; n: number; seed: number; score: number; raw: string }[] = [];
  for (const tier of TIERS)
    for (const n of [0, 1]) {
      const seed = roomSeed(n);
      const { events } = bot({ game, seed, human: new Human("snip", seed, tier) } as never);
      const raw = encodeLog(seed, events);
      const r = replaySnipRun(seed, raw, SNIP_REV_EXPAND);
      if (r.flagged) throw new Error(`${tier} ${n}: flagged (${r.reason})`);
      runs.push({ level: tier, n, seed, score: r.score, raw });
    }
  const proofs = JSON.parse(readFileSync("scripts/fixtures/snip-x200-proofs.json", "utf8")) as XProofs;
  {
    const seed = roomSeed(0);
    const { raw } = xPlannedRun(seed, proofs, "best");
    const r = replaySnipRun(seed, raw, SNIP_REV_EXPAND);
    if (r.flagged || r.score !== 200) throw new Error(`perfect run: ${r.score} ${r.reason ?? ""}`);
    runs.push({ level: "perfect", n: 0, seed, score: r.score, raw });
  }
  process.stdout.write(gzipSync(JSON.stringify({ runs })));
  console.error(`${runs.length} snipRev ${SNIP_REV_EXPAND} runs: ${runs.map((r) => `${r.level} ${r.score}`).join(", ")}`);
}
