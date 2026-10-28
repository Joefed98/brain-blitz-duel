/**
 * Wavefront wavRev 11 runs (Joe's phone notes, 27 Oct 2026; docs/phone-notes-oct-2026/wavefront.md): the skill-band
 * bots (with the Oct 2026 fixes, as the band tool plays them) on room seeds, every score the server replay's. Prints
 * each level's runs (base units, skill points, the kill) for fitting the curves, or with --record re-records the runs
 * wavefront-phone-check replays.
 *
 *   bun scripts/wavefront-phone-bands.ts --levels=good,great --from=0 --seeds=60 --json=<path>   (fitting data)
 *   bun scripts/wavefront-phone-bands.ts --record                                                (the check's runs)
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { stateDigest } from "./wavefront-expand-record";
import { GAMES } from "./arcade-skill-bands/games";
import { ALL_LEVELS, Human, type SkillLevel } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/wavefront";
import { encodeWavefrontRun, replayWavefrontRun } from "../src/lib/duel/wavefront";
import { wavCheckpoint, wavefrontBandParts, wavSkillRawR11, WAV_REV_PHONE, type WavState } from "../src/lib/arcade/wavefront";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const spec = GAMES.find((g) => g.type === "wavefront")!;
export const PHONE_RECORDED_SEEDS = [0, 10, 20, 10000];

export function playWavefrontPhone(level: SkillLevel, n: number, rev = WAV_REV_PHONE) {
  const seed = spec.seedFor(n);
  const game = spec.gameFor(rev, seed);
  const out = bot({ game, seed, rev, human: new Human("wavefront", seed, level), fixes: true });
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
  return { seed, raw, score: result.score, state: result.state as WavState, flagged: result.flagged };
}

if (import.meta.main) {
  if (args.includes("--record")) {
    const runs: { level: string; n: number; seed: number; score: number; raw: string; digest: string }[] = [];
    for (const level of ALL_LEVELS)
      for (const n of PHONE_RECORDED_SEEDS) {
        const r = playWavefrontPhone(level, n);
        runs.push({ level, n, seed: r.seed, score: r.score, raw: r.raw, digest: stateDigest(r.state) });
        console.log(`${level.padEnd(8)} #${String(n).padEnd(6)} ${r.score}`);
      }
    const path = "scripts/fixtures/wavefront-phone-runs.json.gz";
    writeFileSync(path, gzipSync(JSON.stringify({ runs })));
    console.log(`recorded ${runs.length} wavRev 11 runs to ${path}`);
  } else {
    const levels = (opt("levels")?.split(",") ?? [...ALL_LEVELS]) as SkillLevel[];
    const from = Number(opt("from") ?? 0);
    const seeds = Number(opt("seeds") ?? 20);
    const out: unknown[] = [];
    for (const level of levels)
      for (let n = from; n < from + seeds; n++) {
        const r = playWavefrontPhone(level, n);
        const p = wavefrontBandParts(r.state);
        const s = r.state;
        const row = { level, n, score: r.score, units: p.units, skillRaw: wavSkillRawR11(s), bonus: p.bonus, finished: p.finished, kill: p.finished ? p.bonus : 0, waves: s.wavesCleared, boss: s.bossAt ?? 0, tick: s.tick, powerups: s.powerups ?? 0, made: s.pickupsMade ?? 0, saucers: s.saucers, cannons: s.cannonsDown ?? 0, core: s.weakHits ?? 0, precise: s.precise ?? 0, flagged: r.flagged };
        out.push(row);
        if (!opt("json")) console.log(JSON.stringify(row));
      }
    if (opt("json")) writeFileSync(opt("json")!, JSON.stringify(out));
  }
}
