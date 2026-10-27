/**
 * Wavefront wavRev 10 runs for wavefront-expand-check (docs/expansions/x200-wavefront.md): the skill-band bots
 * (scripts/arcade-skill-bands/) at every level, weak to elite, on four room seeds each, every score the server
 * replay's. Without --record it prints each run's score and parts. The tuning tables come from
 * `bun scripts/arcade-skill-bands.ts wavefront --rev=x --levels=weak,average,good,great,near,elite`.
 *
 *   bun scripts/wavefront-expand-bands.ts            (print)
 *   bun scripts/wavefront-expand-bands.ts --record   (re-records the 24 wavRev 10 runs wavefront-expand-check replays)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { stateDigest } from "./wavefront-expand-record";
import { GAMES } from "./arcade-skill-bands/games";
import { ALL_LEVELS, Human, type SkillLevel } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/wavefront";
import { encodeWavefrontRun, replayWavefrontRun } from "../src/lib/duel/wavefront";
import { wavCheckpoint, wavefrontBandParts, wavSkillRaw, WAV_REV_EXPAND, type WavState } from "../src/lib/arcade/wavefront";

const args = process.argv.slice(2);
const spec = GAMES.find((g) => g.type === "wavefront")!;
export const RECORDED_SEEDS = [0, 10, 20, 30];

export function playWavefront(rev: number, level: SkillLevel, n: number) {
  const seed = spec.seedFor(n);
  const game = spec.gameFor(rev, seed);
  const out = bot({ game, seed, rev, human: new Human("wavefront", seed, level) });
  const events = out.events ?? [];
  const byTick = new Map(events.map((e) => [e.t, e]));
  let state = game.init(seed) as WavState;
  const checkpoints: unknown[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    state = game.step(state, byTick.get(state.tick + 1) ?? null) as WavState;
    if (state.tick % 300 === 0) checkpoints.push(wavCheckpoint(state));
  }
  const raw = encodeWavefrontRun({ seed, claimedScore: game.score(state), events, inputs: [], taps: [], endTick: state.tick, checkpoints } as never);
  const result = replayWavefrontRun(seed, raw, rev);
  return { seed, raw, score: result.score, state: result.state as WavState };
}

if (import.meta.main) {
  const runs: { level: string; n: number; seed: number; score: number; raw: string; digest: string }[] = [];
  for (const level of ALL_LEVELS)
    for (const n of RECORDED_SEEDS) {
      const r = playWavefront(WAV_REV_EXPAND, level, n);
      const parts = wavefrontBandParts(r.state);
      console.log(`${level.padEnd(8)} #${String(n).padEnd(3)} ${String(r.score).padStart(3)}  base ${parts.points} (${parts.units} units) · bonus ${parts.bonus} · skill points ${wavSkillRaw(r.state)}`);
      runs.push({ level, n, seed: r.seed, score: r.score, raw: r.raw, digest: stateDigest(r.state) });
    }
  if (args.includes("--record")) {
    const path = "scripts/fixtures/wavefront-expand-runs.json.gz";
    let data: { runs: unknown[]; ace?: unknown } = { runs: [] };
    try {
      data = JSON.parse(gunzipSync(readFileSync(path)).toString());
    } catch {
      /* first write */
    }
    data.runs = runs;
    writeFileSync(path, gzipSync(JSON.stringify(data)));
    console.log(`recorded ${runs.length} wavRev 10 runs to ${path}`);
  }
}
