/**
 * Oct 2026 arcade score bands (docs/arcade-score-bands-oct-2026.md), all 22 active arcade games:
 *
 *  1. Stored rounds keep their scores: 88 real runs (one bot run per game and
 *     skill level, scripts/arcade-skill-bands) recorded with the pre-change code
 *     at each game's then-live revision replay through today's server path to
 *     the identical score, unflagged.
 *  2. Same play: each of those logs (Coral Pop aside: its band queue differs)
 *     replays on the band revision with no checkpoint desync, and scores exactly
 *     the band breakdown of the replayed state.
 *  3. The rules: every curve starts at 0, never falls, tops out at 140 (finish
 *     games, + up to 10 for a full clear) or 150 (open games); one unit short of
 *     a finish is at most 12 below the best finish at every extras count; doing
 *     nothing scores 0; scores stay within 0–150.
 *  4. Coral Pop bubbleRev 3: the rev-2 field, one Joker in each block of 22 shots
 *     and exactly one mine or torpedo.
 *
 *   bun scripts/arcade-score-bands-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { BAND_SPECS, BAND_STAMPS } from "../src/lib/arcade/bandParts";
import { bandPoints, bandTop, bandTotal, BAND_FINISH_BONUS, BAND_PARTIAL_TOP } from "../src/lib/arcade/scoreBands";
import { bubbleGameFor, BUB_BOMB, BUB_JOKER, BUB_LINE, BUB_QUEUE, BUB_REV, BUB_REV_BAND, BUB_SPECIAL_FROM, BUB_V3_JOKER_BLOCK } from "../src/lib/arcade/bubble";
import { GAMES, GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { liveBornOnStandard } from "../src/lib/arcade/liveBands";

const failures: string[] = [];
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};

/* 1 + 2: recorded runs */
const fixture = JSON.parse(readFileSync("scripts/fixtures/arcade-score-bands-legacy.json", "utf8")) as {
  runs: { type: string; rev: number | null; level: string; seed: number; score: number; raw: string }[];
};
const perGame = new Map<string, number>();
for (const run of fixture.runs) {
  const spec = GAME_BY_TYPE.get(run.type as never)!;
  const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
  const old = spec.replay(run.seed, raw, run.rev);
  ok(old.score === run.score && !old.flagged, `${run.type} ${run.level}: stored ${run.score}, replays ${old.score}${old.flagged ? " (flagged)" : ""}`);
  perGame.set(run.type, (perGame.get(run.type) ?? 0) + 1);
  if (run.type === "bubble") continue;
  const band = spec.replay(run.seed, raw, spec.next!);
  ok(band.desyncTick === null, `${run.type} ${run.level}: band replay desyncs at ${band.desyncTick} (play must not change)`);
  ok(Boolean(band.state.band), `${run.type}: band replay state is not stamped`);
  const parts = BAND_SPECS[run.type]!.parts(band.state);
  ok(band.score === bandTotal(parts, Boolean(band.state.acted)), `${run.type} ${run.level}: band score ${band.score} is not its breakdown`);
}
ok(perGame.size === 22, `fixture covers ${perGame.size} games, not 22`);

/* 3: the rules */
for (const [type, spec] of Object.entries(BAND_SPECS)) {
  const { units, points } = spec.curve;
  ok(units[0] === 0 && points[0] === 0, `${type}: curve does not start at (0, 0)`);
  for (let i = 1; i < units.length; i++) {
    ok(units[i]! > units[i - 1]!, `${type}: knots not ascending`);
    ok(points[i]! >= points[i - 1]!, `${type}: curve falls between knots ${i - 1} and ${i}`);
  }
  const top = bandTop(spec.curve);
  const max = points.at(-1)!;
  ok(max === (spec.kind === "open" ? 150 : BAND_PARTIAL_TOP), `${type}: curve tops out at ${max}`);
  let prev = 0;
  for (let u = 0; u <= top + 5; u++) {
    const p = bandPoints(spec.curve, u);
    ok(p >= prev && p >= 0 && p <= 150, `${type}: points ${p} at ${u} after ${prev}`);
    prev = p;
  }
  if (spec.kind === "finish") ok(max + BAND_FINISH_BONUS === 150, `${type}: a perfect finish is not 150`);
  if (spec.last) {
    const { unit, extra, extras } = spec.last;
    for (let k = 0; k <= extras; k++) {
      const full = top - extra * (extras - k);
      const short = bandPoints(spec.curve, full - unit);
      const finish = bandPoints(spec.curve, full) + BAND_FINISH_BONUS;
      ok(finish - short <= 12, `${type}: one unit short (${short}) is ${finish - short} below a finish (${finish}) with ${k} extras`);
    }
  }
}

/* 3: doing nothing scores 0, on the band revision of every game */
for (const spec of GAMES) {
  const seed = spec.seedFor(3);
  const game = spec.gameFor(spec.next!, seed);
  let state = game.init(seed);
  // Games born on the arcade scoring standard (Cards & Board, Sports) have no band revision; the idle-0 proofs below still hold for them.
  if (!liveBornOnStandard(spec.type)) ok(Boolean(state.band) && state[BAND_STAMPS[spec.type]![0]] === undefined, `${spec.type}: band init not stamped`);
  while (!game.isOver(state) && state.tick < game.runTicks) state = game.step(state, spec.taps ? false : null);
  ok(game.score(state) === 0, `${spec.type}: an idle run scores ${game.score(state)}`);
  const replay = spec.replay(seed, spec.encode({ seed, claimedScore: 0, events: [], inputs: [], taps: [], endTick: state.tick, checkpoints: [] }, spec.next!, seed), spec.next!);
  ok(replay.score === 0, `${spec.type}: the server scores an empty log ${replay.score}`);
}

/* 4: Coral Pop bubbleRev 3 queue */
const v0 = bubbleGameFor(null);
const v2 = bubbleGameFor(BUB_REV);
const v3 = bubbleGameFor(BUB_REV_BAND);
for (let seed = 1; seed <= 200; seed++) {
  const a = v2.init(seed);
  const b = v3.init(seed);
  ok(JSON.stringify(a.grid) === JSON.stringify(b.grid) && b.rev === BUB_REV, `Coral Pop ${seed}: band field differs from rev 2`);
  const jokers = b.queue.filter((v: number) => v === BUB_JOKER).length;
  const others = b.queue.filter((v: number) => v === BUB_BOMB || v === BUB_LINE).length;
  ok(jokers === Math.ceil((BUB_QUEUE - BUB_SPECIAL_FROM) / BUB_V3_JOKER_BLOCK) && others === 1, `Coral Pop ${seed}: ${jokers} Jokers and ${others} mines/torpedoes`);
  const base = v0.init(seed).queue;
  ok(b.queue.every((v: number, i: number) => v === BUB_JOKER || v === BUB_BOMB || v === BUB_LINE || v === base[i]), `Coral Pop ${seed}: a colour slot changed`);
}

if (failures.length) {
  console.log(failures.slice(0, 40).join("\n"));
  console.log(`FAIL: ${failures.length} of ${checks} score-band checks`);
  process.exit(1);
}
console.log(`Arcade score bands: ${checks} checks passed — ${fixture.runs.length} stored runs replay unchanged, the same logs replay on the band revisions without desync, curves, one-short gaps, idle runs and the Coral Pop queue`);
