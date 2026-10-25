/**
 * Tilt tiltRev 7: a flawless player (the skill bot with no reaction lag, aim error, slips or misreads,
 * taking every star and quick star) over room seeds, to find runs that reach the round's maximum of 200
 * through the server's own replay. tilt-expand-check replays the stored best runs
 * (scripts/fixtures/tilt-expand-best.json.gz); this script records them:
 *
 *   bun scripts/tilt-expand-best.ts [--seeds=200] [--write]
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { bot } from "./arcade-skill-bands/bots/tilt";
import { Human, PROFILES } from "./arcade-skill-bands/human";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { tiltCheckpoint, tiltExpandGame, TILT_CHECKPOINT_INTERVAL, TILT_REV_EXPAND, type TiltState } from "../src/lib/arcade/tilt";
import { encodeTiltRun, replayTiltRun } from "../src/lib/duel/tilt";

const args = process.argv.slice(2);
const SEEDS = Number(args.find((a) => a.startsWith("--seeds="))?.slice(8) ?? 200);
const spec = GAME_BY_TYPE.get("tilt" as never)!;
const flawless = { ...PROFILES.near, reactionMs: [120, 0] as const, lapse: 0, timingSdMs: 0, aimSdPx: 0, powerSd: 0, mistake: 0, thinkScale: 0.2, judgement: 0, trackLagMs: 0 };

export function flawlessRun(seed: number): { raw: string; score: number; state: TiltState } {
  const human = new Human("tilt-best", seed, "near");
  (human as { p: unknown }).p = flawless;
  human.chance = (p: number) => p >= 0.3;
  human.slip = () => false;
  const out = bot({ game: tiltExpandGame, seed, rev: TILT_REV_EXPAND, human });
  const byTick = new Map((out.events ?? []).map((e) => [e.t, e]));
  let s = tiltExpandGame.init(seed);
  const checkpoints: unknown[] = [];
  while (!tiltExpandGame.isOver(s) && s.tick < tiltExpandGame.runTicks) {
    s = tiltExpandGame.step(s, byTick.get(s.tick + 1) ?? null);
    if (s.tick % TILT_CHECKPOINT_INTERVAL === 0) checkpoints.push(tiltCheckpoint(s));
  }
  const raw = encodeTiltRun({ seed, claimedScore: tiltExpandGame.score(s), events: out.events ?? [], endTick: s.tick, checkpoints: checkpoints as never });
  const r = replayTiltRun(seed, raw, TILT_REV_EXPAND);
  return { raw, score: r.flagged ? -1 : r.score, state: r.state };
}

if (import.meta.main) {
  const best: { seed: number; raw: string; score: number }[] = [];
  const scores: number[] = [];
  for (let n = 0; n < SEEDS; n++) {
    const seed = spec.seedFor(n);
    const r = flawlessRun(seed);
    scores.push(r.score);
    if (r.score >= 190) best.push({ seed, raw: r.raw, score: r.score });
    if (n % 20 === 19) console.log(`${n + 1} seeds: best ${Math.max(...scores)}, 190+ ${best.length}, 200 ${best.filter((b) => b.score === 200).length}`);
  }
  scores.sort((a, b) => a - b);
  console.log(`median ${scores[scores.length >> 1]}, p90 ${scores[Math.floor(scores.length * 0.9)]}, best ${scores.at(-1)}`);
  if (args.includes("--write")) {
    const keep = [...best.filter((b) => b.score === 200).slice(0, 3), ...best.filter((b) => b.score < 200).slice(0, 2)];
    writeFileSync("scripts/fixtures/tilt-expand-best.json.gz", gzipSync(JSON.stringify({ runs: keep })));
    console.log(`wrote ${keep.length} runs`);
  }
}
