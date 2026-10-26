/**
 * Tilt tiltRev 8: a flawless player (the skill bot with no reaction lag, aim error, slips or misreads,
 * taking every star and quick star) over room seeds, to find runs that reach the round's maximum of 200
 * through the server's own replay. tilt-expand-check replays the stored best runs
 * (scripts/fixtures/tilt-expand-best.json.gz); this script records them:
 *
 *   bun scripts/tilt-expand-best.ts [--seeds=200] [--from=0] [--stop=k] [--write] [--out=<file>]
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
/** First seed index (`--from=n`), and stop once this many 200s are found (`--stop=k`). */
const FROM = Number(args.find((a) => a.startsWith("--from="))?.slice(7) ?? 0);
const STOP = Number(args.find((a) => a.startsWith("--stop="))?.slice(7) ?? 1e9);
const OUT = args.find((a) => a.startsWith("--out="))?.slice(6) ?? "scripts/fixtures/tilt-expand-best.json.gz";
const spec = GAME_BY_TYPE.get("tilt" as never)!;
const flawless = { ...PROFILES.elite, reactionMs: [120, 0] as const, lapse: 0, timingSdMs: 0, aimSdPx: 0, powerSd: 0, mistake: 0, thinkScale: 0.2, judgement: 0, trackLagMs: 0 };

export function flawlessRun(seed: number): { raw: string; score: number; state: TiltState } {
  const human = new Human("tilt-best", seed, "elite");
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

/**
 * `--stitch`: a 200 built maze by maze. The mazes are independent once one begins (the marbles start afresh), so
 * for each maze the flawless player is tried from the state the previous maze ended in, under a few variants (its
 * glance timing and a hair of aim error), and the first try that takes the maze's gold star, both quick stars in
 * their windows and finishes at par is kept; the next maze starts from there. The joined log is checked through
 * the server's replay.
 */
function stitchRun(seed: number, tries: number): { raw: string; score: number } {
  type Ev = { t: number; k: number; a: number; b: number; c: number; d: number };
  let events: Ev[] = [];
  const replayTo = (log: Ev[], stopMazes: number): TiltState => {
    const byTick = new Map(log.map((e) => [e.t, e]));
    let s = tiltExpandGame.init(seed);
    while (!tiltExpandGame.isOver(s) && s.tick < tiltExpandGame.runTicks && s.mazes < stopMazes) s = tiltExpandGame.step(s, byTick.get(s.tick + 1) ?? null);
    return s;
  };
  for (let level = 0; level < 3; level++) {
    const start = replayTo(events, level);
    let kept: Ev[] | null = null;
    let keptValue = -1;
    for (let i = 0; i < tries; i++) {
      const human = new Human(`tilt-best-${level}-${i}`, seed, "elite");
      (human as { p: unknown }).p = { ...flawless, aimSdPx: i === 0 ? 0 : 0.5 + 0.25 * (i % 4) };
      human.chance = (p: number) => p >= 0.3;
      human.slip = () => false;
      const game = { ...tiltExpandGame, init: () => start, isOver: (st: TiltState) => tiltExpandGame.isOver(st) || st.mazes > level };
      const out = bot({ game: game as never, seed, rev: TILT_REV_EXPAND, human });
      const log = [...events, ...((out.events ?? []) as Ev[]).filter((e) => e.t > start.tick)];
      const end = replayTo(log, level + 1);
      if (end.mazes <= level) continue;
      const value = (end.quickPts ?? 0) - (start.quickPts ?? 0) + (end.pace ?? 0) - (start.pace ?? 0) + 10 * ((end.stars ?? 0) - (start.stars ?? 0)) - end.tick / 10000;
      if (value > keptValue) {
        keptValue = value;
        kept = log.filter((e) => e.t <= end.tick);
      }
      if (value >= 30 - end.tick / 10000) break;
    }
    if (!kept) break;
    events = kept;
  }
  const byTick = new Map(events.map((e) => [e.t, e]));
  let s = tiltExpandGame.init(seed);
  const checkpoints: unknown[] = [];
  while (!tiltExpandGame.isOver(s) && s.tick < tiltExpandGame.runTicks) {
    s = tiltExpandGame.step(s, byTick.get(s.tick + 1) ?? null);
    if (s.tick % TILT_CHECKPOINT_INTERVAL === 0) checkpoints.push(tiltCheckpoint(s));
  }
  const raw = encodeTiltRun({ seed, claimedScore: tiltExpandGame.score(s), events, endTick: s.tick, checkpoints: checkpoints as never });
  const r = replayTiltRun(seed, raw, TILT_REV_EXPAND);
  return { raw, score: r.flagged ? -1 : r.score };
}

if (import.meta.main && args.includes("--stitch")) {
  const tries = Number(args.find((a) => a.startsWith("--tries="))?.slice(8) ?? 12);
  const found: { seed: number; raw: string; score: number }[] = [];
  for (let n = FROM; n < FROM + SEEDS && found.length < Math.min(STOP, 3); n++) {
    const seed = spec.seedFor(n);
    const r = stitchRun(seed, tries);
    console.log(`seed index ${n} (${seed}): ${r.score}`);
    if (r.score === 200) found.push({ seed, raw: r.raw, score: r.score });
  }
  if (args.includes("--write") && found.length) {
    writeFileSync(OUT, gzipSync(JSON.stringify({ runs: found })));
    console.log(`wrote ${found.length} runs`);
  }
} else if (import.meta.main) {
  const best: { seed: number; raw: string; score: number }[] = [];
  const scores: number[] = [];
  for (let n = FROM; n < FROM + SEEDS && best.filter((b) => b.score === 200).length < STOP; n++) {
    const seed = spec.seedFor(n);
    const r = flawlessRun(seed);
    scores.push(r.score);
    if (r.score >= 190) best.push({ seed, raw: r.raw, score: r.score });
    if (r.score === 200) console.log(`seed index ${n} (${seed}): 200`);
    if (n % 20 === 19) console.log(`${n + 1} seeds: best ${Math.max(...scores)}, 190+ ${best.length}, 200 ${best.filter((b) => b.score === 200).length}`);
  }
  scores.sort((a, b) => a - b);
  console.log(`median ${scores[scores.length >> 1]}, p90 ${scores[Math.floor(scores.length * 0.9)]}, best ${scores.at(-1)}`);
  if (args.includes("--write")) {
    const keep = [...best.filter((b) => b.score === 200).slice(0, 3), ...best.filter((b) => b.score < 200).slice(0, 2)];
    writeFileSync(OUT, gzipSync(JSON.stringify({ runs: keep })));
    console.log(`wrote ${keep.length} runs`);
  }
}
