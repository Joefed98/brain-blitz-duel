/**
 * retro-overhaul-check (15 Nov 2026, the Retro overhaul, phase 2 step 4; docs/design/game-reviews/retro.md,
 * docs/design/retro-overhaul.md): the Retro games' new stamps and shared look rules.
 *
 *  Tempo beatRev 12 (a missed note scores 0 rather than −2):
 *   1. wiring: rooms deal beatRev 12, preRetro deals beatRev 11, the help reads beatRev 12's spec, playRevOf maps 12
 *      to beatRev 11's play; beatRev 12's init is beatRev 11's plus `floor: 1`;
 *   2. play unchanged: the skill-band bots' logs at every level give the same judgements, counters and every
 *      checkpoint checksum on beatRev 11 and 12;
 *   3. never lower: the same log scores at least as much on beatRev 12, and exactly as much with no miss;
 *   4. a miss-heavy run earns its hits (a third of the notes Perfect is 333 of 1,000, not 0);
 *   5. the server replay (replayBeatRun on beatRev 12) scores every bot run to its sim score, unflagged, 1–200, and a
 *      flawless run still reaches 200; the 120 s rule holds (the song is 75 s).
 *  Rally rallyRev 13 (two blue-ball lives, spin shots):
 *   1. wiring: rooms deal rallyRev 13 (preRetro rallyRev 12); its init is rallyRev 12's draws plus the lives fields; the
 *      help and reveal read its four parts; the run is 60 s;
 *   2. grace: the skill-band bots' logs play tick for tick as on rallyRev 12 up to the first miss; on rallyRev 13 the
 *      first miss costs a life (never the run), the ball waits 1.5 s at the serve spot, then serves again; the run ends
 *      on the second miss or at the buzzer; every room's world is the same (the serve's lean from the seeded stream);
 *   3. spin shots: a curling ball striking a pink pad counts one (built ball), a straight one doesn't;
 *   4. the server replay scores every bot run to its sim score, unflagged.
 *  Fission burstRev 12 (wave clears taper to 0 at three times the quick time):
 *   wiring (rooms 12, preRetro 11, playRevOf 12 → 11, the help's words); the bots' logs at every level play tick for
 *   tick as on burstRev 11 (atoms, ship, lives, beams); the clear points never fall and rise for the good levels; the
 *   server replay scores every bot run to its sim score.
 *  Pinball pinRev 7 (one J-O-U-L-Z set fills its part): wiring; the bots' logs play checkpoint for checkpoint as on
 *  pinRev 6, never score less, and replay through the server; a flawless-level run reaches 200 more often.
 *  Meteor snakeRev 13 (wrap-around edges, the core full at 36): wiring; the wrap on a built state (out the right edge,
 *  in at the left in the same row; out the top, in at the bottom); the bots' logs play tick for tick as on snakeRev 12
 *  until snakeRev 12's wall crash, and on past it; the server replay; nobody crashes into a wall.
 *  Breaker brkRev 12 (the clearable wall): wiring; every board is brkRev 11's with rows 3–5 taken out (81 bricks, the
 *  3 gold bricks kept, every power brick kept, the lost ones in the lower rows); a quicker ball; a stronger multi-ball;
 *  the elite bot clears the wall on most seeds (it cleared 4 of 12 on brkRev 11); the server replay.
 *  Wavefront wavRev 14 (the charged shot): wiring; a log that never charges plays tick for tick as on wavRev 13; a touch
 *  held a second and lifted fires one heavy blast (a shorter hold none); repeated blasts crack armour faster; the
 *  server replay of a charged run.
 *  The shared Retro HUD: every count it draws is at least 11 px (retroHudFloorPx).
 *
 *   bun scripts/retro-overhaul-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human } from "./arcade-skill-bands/human";
import { bot as beatBot } from "./arcade-skill-bands/bots/beat";
import { playRevOf } from "./scoring-targets-revs";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { pinPreRetro } from "../src/lib/duel/arcade.server";
import { replayBeatRun } from "../src/lib/duel/beat";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { ARCADE_STANDARD } from "../src/lib/arcade/standard";
import { TICKS_PER_SECOND } from "../src/lib/arcade/engine";
import {
  beatAccuracy,
  beatCheckpoint,
  beatGameFor,
  beatStdParts,
  BEAT_REV_FLOOR,
  BEAT_REV_STD,
  BEAT_STD_SPEC_V12,
  type BeatState,
} from "../src/lib/arcade/beat";
import { bot as rallyBot } from "./arcade-skill-bands/bots/rally";
import { replayRallyRun } from "../src/lib/duel/rally";
import {
  rallyGameFor,
  rallyTargetLeft,
  RALLY_HUD_H,
  RALLY_REV_LIVES,
  RALLY_REV_STD,
  RALLY_RUN_TICKS,
  RALLY_STD_SPEC_V13,
  RALLY_V13_EXP,
  RALLY_V13_LIVES,
  RALLY_V13_RELAUNCH,
  type RallyState,
} from "../src/lib/arcade/rally";
import { bot as burstBot } from "./arcade-skill-bands/bots/burst";
import { replayBurstRun } from "../src/lib/duel/burst";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { burstGameFor, burstV10ClearPoints, BURST_CHECKPOINT_INTERVAL, BURST_REV_AIM, BURST_REV_WIDE, type BurstState } from "../src/lib/arcade/burst";
import { bot as pinballBot } from "./arcade-skill-bands/bots/pinball";
import { replayPinballRun } from "../src/lib/duel/pinball";
import { pinballGameForAny } from "../src/lib/arcade/pinball4";
import { PIN_REV_JOULZ, PIN_REV_STD } from "../src/lib/arcade/pinball";
import { bot as snakeBot } from "./arcade-skill-bands/bots/snake";
import { replaySnakeRun } from "../src/lib/duel/snake";
import { snakeColsOf, snakeGameFor, snakeRowsOf, snakeTarget, SNAKE_REV_12, SNAKE_REV_WRAP, SNAKE_V13_BAND_CURVE, type SnakeState } from "../src/lib/arcade/snake";
import { bot as breakerBot } from "./arcade-skill-bands/bots/breaker";
import { replayBreakerRun } from "../src/lib/duel/breaker";
import { breakerGameFor, brkGoldDealt, BRK_REV_CLEAR, BRK_REV_STD, type BrkState } from "../src/lib/arcade/breaker";
import { ARCADE_INPUT_DRAG, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { bot as wavefrontBot } from "./arcade-skill-bands/bots/wavefront";
import { encodeWavefrontRun, replayWavefrontRun } from "../src/lib/duel/wavefront";
import { wavCheckpoint, wavefrontGameFor, wavShapeBox, WAV_REV_CHARGE, WAV_REV_KEEP, WAV_V14_CHARGE_TICKS, WAV_V14_HEAVY_HITS, WAV_V14_HOLD, WAV_V14_LIFT, WAV_WORLD_W, type WavState } from "../src/lib/arcade/wavefront";
import { RETRO_HUD_MIN_PX, retroHudFloorPx } from "../src/lib/arcade/retro.renderer";

let checks = 0;
const failures: string[] = [];
const ok = (cond: unknown, label: string) => {
  checks++;
  if (!cond && failures.length < 80) failures.push(label);
};

/** Key-order-free JSON, to compare states built in a different order. */
const sorted = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([p], [q]) => (p < q ? -1 : 1))) : x));

const LEVELS = ["weak", "average", "good", "great", "near", "elite", "perfect"] as const;

/* ============================ Tempo beatRev 12 ============================ */
{
  // 1. Wiring.
  ok((generatePuzzle("beat") as any).beatRev === BEAT_REV_FLOOR && BEAT_REV_FLOOR === BEAT_REV_STD + 1, "beat: rooms deal beatRev 12");
  pinPreRetro(true);
  ok((generatePuzzle("beat") as any).beatRev === BEAT_REV_STD, "beat: preRetro deals beatRev 11");
  pinPreRetro(false);
  ok((generatePuzzle("beat") as any).beatRev === BEAT_REV_FLOOR, "beat: unpinned again, rooms deal beatRev 12");
  ok(LIVE_BANDS.beat.rev === BEAT_REV_FLOOR && LIVE_BANDS.beat.std === BEAT_STD_SPEC_V12 && ARCADE_STANDARD.beat.spec === BEAT_STD_SPEC_V12, "beat: the help and the reveal read beatRev 12's spec");
  ok(/missed note scores nothing/.test(BEAT_STD_SPEC_V12.parts[0]!.how), "beat: the help says a missed note scores nothing");
  ok(playRevOf("beat", BEAT_REV_FLOOR) === playRevOf("beat", BEAT_REV_STD), "beat: playRevOf maps beatRev 12 to beatRev 11's play");
  const g11 = beatGameFor(BEAT_REV_STD);
  const g12 = beatGameFor(BEAT_REV_FLOOR);
  ok(g12.runTicks === g11.runTicks && g12.inputRanges === g11.inputRanges, "beat: beatRev 12 keeps beatRev 11's song and inputs");
  ok(g12.runTicks <= 120 * TICKS_PER_SECOND, `beat: the run is at most 120 s (${g12.runTicks / TICKS_PER_SECOND} s)`);
  for (const seed of [1, 77, 4242, 99991]) {
    const { floor, ...rest } = g12.init(seed) as BeatState;
    ok(floor === 1 && JSON.stringify(rest) === JSON.stringify(g11.init(seed)), `beat seed ${seed}: beatRev 12's init is beatRev 11's plus floor: 1`);
  }

  // 2–5. Bot runs.
  const spec = GAME_BY_TYPE.get("beat" as never)!;
  const replayOn = (rev: number, seed: number, events: any[]) => {
    const game = beatGameFor(rev);
    const by = new Map(events.map((e: any) => [e.t, e]));
    let s = game.init(seed) as BeatState;
    const sums: number[] = [];
    while (!game.isOver(s)) {
      s = game.step(s, by.get(s.tick + 1) ?? null) as BeatState;
      if (s.tick % 300 === 0) sums.push(beatCheckpoint(s).checksum);
    }
    return { state: s, sums, score: game.score(s), checkpoints: [] as unknown[] };
  };
  let top = 0;
  let missRuns = 0;
  for (const level of LEVELS)
    for (let n = 0; n < 4; n++) {
      const seed = spec.seedFor(n);
      const tag = `beat ${level} seed ${seed}`;
      const game = spec.gameFor(BEAT_REV_FLOOR, seed);
      const out = beatBot({ game, seed, rev: BEAT_REV_FLOOR, human: new Human("beat", seed, level as never), fixes: true });
      const events = out.events ?? [];
      const a = replayOn(BEAT_REV_STD, seed, events);
      const b = replayOn(BEAT_REV_FLOOR, seed, events);
      ok(JSON.stringify(a.sums) === JSON.stringify(b.sums), `${tag}: every checkpoint checksum the same on beatRev 11 and 12`);
      ok(JSON.stringify([a.state.judged, a.state.perfect, a.state.good, a.state.ok, a.state.misses, a.state.fevers, a.state.maxStreak]) === JSON.stringify([b.state.judged, b.state.perfect, b.state.good, b.state.ok, b.state.misses, b.state.fevers, b.state.maxStreak]), `${tag}: the same judgements on both stamps`);
      ok(b.score >= a.score, `${tag}: beatRev 12 never scores less (${a.score} → ${b.score})`);
      if (b.state.misses === 0) ok(b.score === a.score, `${tag}: with no miss the score is unchanged`);
      else {
        missRuns++;
        ok(beatAccuracy(b.state) > beatAccuracy(a.state) || beatAccuracy(a.state) === beatAccuracy({ ...a.state, misses: 0 }), `${tag}: misses no longer take accuracy away`);
      }
      const checkpoints: unknown[] = [];
      {
        const by = new Map(events.map((e: any) => [e.t, e]));
        let s = game.init(seed);
        while (!game.isOver(s)) {
          s = game.step(s, by.get(s.tick + 1) ?? null);
          if (s.tick % 300 === 0) checkpoints.push(spec.checkpoint(s));
        }
      }
      const raw = spec.encode({ seed, claimedScore: b.score, events, endTick: b.state.tick, checkpoints }, BEAT_REV_FLOOR, seed);
      const res = replayBeatRun(seed, raw, BEAT_REV_FLOOR);
      ok(!res.flagged && res.score === b.score, `${tag}: replays through the server to ${b.score} (got ${res.score}${res.flagged ? ", flagged" : ""})`);
      if (events.length) ok(res.score >= 1 && res.score <= 200, `${tag}: a played run scores 1–200 (${res.score})`);
      top = Math.max(top, res.score);
    }
  ok(missRuns >= 8, `beat: misses compared on ${missRuns} runs`);
  ok(top >= 195, `beat: a flawless run still reaches ${top}`);

  // 4. A miss-heavy run earns its hits.
  const s = g12.init(4242) as BeatState;
  const n = s.chart.ticks.length;
  const third = Math.floor(n / 3);
  const heavy = { ...s, tick: g12.runTicks, acted: 1, perfect: third, good: 0, ok: 0, misses: n - third } as BeatState;
  const acc = beatAccuracy(heavy);
  ok(acc === Math.floor((1000 * 4 * third) / (4 * n)) && acc >= 330, `beat: a third of the notes Perfect is ${acc} of 1,000 on beatRev 12`);
  ok(beatAccuracy({ ...heavy, floor: undefined }) === 0, "beat: the same run scored 0 accuracy on beatRev 11");
  ok((beatStdParts(heavy)?.[0]?.points ?? 0) >= 40, "beat: its accuracy points are real (≥ 40 of 130)");
}

/* ============================ Rally rallyRev 13 ============================ */
{
  const g12 = rallyGameFor(RALLY_REV_STD);
  const g13 = rallyGameFor(RALLY_REV_LIVES);
  ok((generatePuzzle("rally") as any).rallyRev === RALLY_REV_LIVES && RALLY_REV_LIVES === RALLY_REV_STD + 1, "rally: rooms deal rallyRev 13");
  pinPreRetro(true);
  ok((generatePuzzle("rally") as any).rallyRev === RALLY_REV_STD, "rally: preRetro deals rallyRev 12");
  pinPreRetro(false);
  ok(LIVE_BANDS.rally.rev === RALLY_REV_LIVES && LIVE_BANDS.rally.std === RALLY_STD_SPEC_V13 && ARCADE_STANDARD.rally.spec === RALLY_STD_SPEC_V13, "rally: the help and the reveal read rallyRev 13's spec");
  ok(ARCADE_STANDARD.rally.specFor?.(RALLY_REV_STD)?.parts.length === 3 && ARCADE_STANDARD.rally.specFor?.(RALLY_REV_LIVES)?.parts.length === 4, "rally: a rallyRev 12 round keeps its three part names");
  ok(g13.runTicks <= 120 * TICKS_PER_SECOND, "rally: the run is at most 120 s");
  ok(RALLY_V13_LIVES >= 2, "rally: Normal has a life to spare");
  for (const seed of [1, 99, 123456, 2 ** 30 + 7]) {
    const a = g12.init(seed) as RallyState;
    const { lives, relaunch, spinScores, lostAt, spinAt, exp, ...rest } = g13.init(seed) as RallyState;
    ok(lives === RALLY_V13_LIVES && relaunch === 0 && spinScores === 0 && lostAt === 0 && spinAt === 0 && exp === RALLY_V13_EXP && sorted({ ...rest, exp: a.exp }) === sorted(a), `rally seed ${seed}: rallyRev 13 starts from rallyRev 12's exact draws`);
  }
  const play = (rev: number, seed: number, events: any[]) => {
    const game = rallyGameFor(rev);
    const by = new Map(events.map((e: any) => [e.t, e]));
    let s = game.init(seed) as RallyState;
    const trace: string[] = [];
    let firstLoss = 0;
    let lost = 0;
    let servedAfter = 0;
    while (!game.isOver(s)) {
      const before = s;
      s = game.step(s, by.get(s.tick + 1) ?? null) as RallyState;
      trace.push(`${s.x},${s.y},${s.paddleX},${s.goldHits},${s.targetHits},${s.golds.length},${s.rng}`);
      if ((s.lives ?? 0) < (before.lives ?? 0) && !s.dead) {
        lost++;
        if (!firstLoss) firstLoss = s.tick;
      }
      if ((before.relaunch ?? 0) > 0 && (s.relaunch ?? 0) === 0 && !servedAfter) servedAfter = s.tick;
    }
    return { state: s, trace, firstLoss, lost, servedAfter, score: game.score(s) };
  };
  const spec = GAME_BY_TYPE.get("rally" as never)!;
  let graced = 0;
  for (const level of ["weak", "average", "good", "great", "near"] as const)
    for (let n = 0; n < 6; n++) {
      const seed = spec.seedFor(n);
      const tag = `rally ${level} seed ${seed}`;
      const out = rallyBot({ game: rallyGameFor(RALLY_REV_STD), seed, rev: RALLY_REV_STD, human: new Human("rally", seed, level as never), fixes: true });
      const events = out.events ?? [];
      const a = play(RALLY_REV_STD, seed, events);
      const b = play(RALLY_REV_LIVES, seed, events);
      const upTo = a.state.dead ? a.trace.length - 1 : a.trace.length;
      ok(JSON.stringify(a.trace.slice(0, upTo)) === JSON.stringify(b.trace.slice(0, upTo)), `${tag}: rallyRev 13 plays tick for tick as rallyRev 12 until the first miss`);
      if (a.state.dead && a.state.tick < RALLY_RUN_TICKS) {
        graced++;
        ok(b.firstLoss === a.state.tick, `${tag}: rallyRev 12's run-ending miss costs a life on rallyRev 13 (tick ${a.state.tick}, ${b.firstLoss})`);
        ok(b.state.tick > a.state.tick, `${tag}: the run carries on past the first miss (${a.state.tick} → ${b.state.tick})`);
        if (b.servedAfter) ok(b.servedAfter === b.firstLoss + RALLY_V13_RELAUNCH, `${tag}: the ball serves again ${RALLY_V13_RELAUNCH} ticks after the miss`);
        ok(b.state.goldHits >= a.state.goldHits, `${tag}: no gold hit is lost by playing on`);
      }
      ok(b.state.tick >= RALLY_RUN_TICKS || (b.state.dead && b.state.lives === 0), `${tag}: the run ends at the buzzer or on the last life`);
      // The server replay.
      const checkpoints: unknown[] = [];
      {
        const game = rallyGameFor(RALLY_REV_LIVES);
        const by = new Map(events.map((e: any) => [e.t, e]));
        let s = game.init(seed);
        while (!game.isOver(s)) {
          s = game.step(s, by.get(s.tick + 1) ?? null);
          if (s.tick % 300 === 0) checkpoints.push(spec.checkpoint(s));
        }
      }
      const raw = spec.encode({ seed, claimedScore: b.score, events, endTick: b.state.tick, checkpoints }, RALLY_REV_LIVES, seed);
      const res = replayRallyRun(seed, raw, RALLY_REV_LIVES);
      ok(!res.flagged && res.score === b.score, `${tag}: replays through the server to ${b.score} (got ${res.score}${res.flagged ? ", flagged" : ""})`);
      // Identical worlds: the same log twice gives the same final state.
      ok(JSON.stringify(play(RALLY_REV_LIVES, seed, events).state) === JSON.stringify(b.state), `${tag}: the same log plays the same world`);
    }
  ok(graced >= 4, `rally: the first miss forgiven on ${graced} runs`);

  // 3. Spin shots, on a built ball: a curling gold ball flying into a live pad counts; the same ball straight doesn't.
  const s0 = g13.init(4242) as RallyState;
  const left = rallyTargetLeft(s0.spots ?? [], (s0.live ?? [0])[0]!);
  const cx = left + 22;
  const topY = RALLY_HUD_H + 8 + 7 + 3;
  const flying = (spun: number): RallyState => ({ ...s0, tick: 30, acted: 1, golds: [{ x: cx * 256, y: topY * 256, vx: 0, vy: -1024, spin: spun ? 40 : 0, spun }] } as RallyState);
  const curled = g13.step(flying(1), null) as RallyState;
  const straight = g13.step(flying(0), null) as RallyState;
  ok((curled.targetHits ?? 0) === 1 && curled.spinScores === 1, `rally: a curling gold ball on a pink pad is a spin shot (${curled.targetHits}, ${curled.spinScores})`);
  ok((straight.targetHits ?? 0) === 1 && straight.spinScores === 0, "rally: a straight one is a pad and no spin shot");
}

/* ============================ Fission burstRev 12 ============================ */
{
  ok((generatePuzzle("burst") as any).burstRev === BURST_REV_WIDE && BURST_REV_WIDE === BURST_REV_AIM + 1, "burst: rooms deal burstRev 12");
  pinPreRetro(true);
  ok((generatePuzzle("burst") as any).burstRev === BURST_REV_AIM, "burst: preRetro deals burstRev 11");
  pinPreRetro(false);
  ok(LIVE_BANDS.burst.rev === BURST_REV_WIDE && playRevOf("burst", BURST_REV_WIDE) === playRevOf("burst", BURST_REV_AIM), "burst: LIVE_BANDS reads burstRev 12, burstRev 11's play");
  ok(/down to 0 at three times that/.test(JSON.stringify(PUZZLE_INSTRUCTIONS.burst)), "burst: the help says the bonus runs out at three times the quick time");
  ok(burstGameFor(BURST_REV_WIDE).runTicks <= 120 * TICKS_PER_SECOND, "burst: the run is at most 120 s");
  const q = 200;
  ok(burstV10ClearPoints(q, q, true) === 7 && burstV10ClearPoints(2 * q, q, true) > 0 && burstV10ClearPoints(3 * q, q, true) === 0 && burstV10ClearPoints(2 * q, q, false) === 0, "burst: 7 within the quick time, some at twice it, 0 at three times it (burstRev 11: 0 at twice)");
  for (let t = 0; t <= 4 * q; t += 7) if (burstV10ClearPoints(t, q, true) < burstV10ClearPoints(t, q, false)) ok(false, `burst: a clear at ${t} pays less on burstRev 12`);
  const spec = GAME_BY_TYPE.get("burst" as never)!;
  const play = (rev: number, seed: number, events: any[]) => {
    const game = burstGameFor(rev);
    const by = new Map(events.map((e: any) => [e.t, e]));
    let s = game.init(seed) as BurstState;
    const trace: string[] = [];
    const checkpoints: unknown[] = [];
    while (!game.isOver(s)) {
      s = game.step(s, by.get(s.tick + 1) ?? null) as BurstState;
      trace.push(`${s.x},${s.lives},${s.hits},${s.balls.length},${s.shots.length},${s.wave},${s.cleared},${s.whiffs}`);
      if (s.tick % BURST_CHECKPOINT_INTERVAL === 0) checkpoints.push(spec.checkpoint(s));
    }
    return { state: s, trace, checkpoints, score: game.score(s) };
  };
  let rose = 0;
  for (const level of ["weak", "average", "good", "great", "near", "elite"] as const)
    for (let n = 0; n < 3; n++) {
      const seed = spec.seedFor(n);
      const tag = `burst ${level} seed ${seed}`;
      const out = burstBot({ game: burstGameFor(BURST_REV_AIM), seed, rev: BURST_REV_AIM, human: new Human("burst", seed, level as never), fixes: true });
      const events = out.events ?? [];
      const a = play(BURST_REV_AIM, seed, events);
      const b = play(BURST_REV_WIDE, seed, events);
      ok(JSON.stringify(a.trace) === JSON.stringify(b.trace), `${tag}: burstRev 12 plays tick for tick as burstRev 11`);
      ok((b.state.clearPts ?? 0) >= (a.state.clearPts ?? 0) && b.score >= a.score, `${tag}: never lower (clears ${a.state.clearPts} → ${b.state.clearPts}, score ${a.score} → ${b.score})`);
      if ((b.state.clearPts ?? 0) > (a.state.clearPts ?? 0)) rose++;
      const raw = spec.encode({ seed, claimedScore: b.score, events, endTick: b.state.tick, checkpoints: b.checkpoints }, BURST_REV_WIDE, seed);
      const res = replayBurstRun(seed, raw, BURST_REV_WIDE);
      ok(!res.flagged && res.score === b.score, `${tag}: replays through the server to ${b.score} (got ${res.score}${res.flagged ? ", flagged" : ""})`);
    }
  ok(rose >= 4, `burst: wave clears earn more on ${rose} of 18 runs`);
}

/* ============================ Pinball pinRev 7 ============================ */
{
  ok((generatePuzzle("pinball") as any).pinRev === PIN_REV_JOULZ && PIN_REV_JOULZ === PIN_REV_STD + 1, "pinball: rooms deal pinRev 7");
  pinPreRetro(true);
  ok((generatePuzzle("pinball") as any).pinRev === PIN_REV_STD, "pinball: preRetro deals pinRev 6");
  pinPreRetro(false);
  ok(LIVE_BANDS.pinball.rev === PIN_REV_JOULZ && ARCADE_STANDARD.pinball.spec?.rev === PIN_REV_JOULZ && playRevOf("pinball", PIN_REV_JOULZ) === playRevOf("pinball", PIN_REV_STD), "pinball: the help reads pinRev 7, pinRev 6's play");
  ok(pinballGameForAny(PIN_REV_JOULZ).runTicks <= 120 * TICKS_PER_SECOND, "pinball: the run is at most 120 s");
  const spec = GAME_BY_TYPE.get("pinball" as never)!;
  const play = (rev: number, seed: number, events: any[]) => {
    const game = pinballGameForAny(rev);
    const by = new Map(events.map((e: any) => [e.t, e]));
    let s = game.init(seed);
    const sums: number[] = [];
    const checkpoints: unknown[] = [];
    while (!game.isOver(s)) {
      s = game.step(s, by.get(s.tick + 1) ?? null);
      if (s.tick % 300 === 0) {
        const c = spec.checkpoint(s) as any;
        checkpoints.push(c);
        sums.push(c.checksum);
      }
    }
    return { state: s as any, sums, checkpoints, score: game.score(s) };
  };
  let at200 = [0, 0];
  for (const level of ["average", "great", "near", "elite", "perfect"] as const)
    for (let n = 0; n < 4; n++) {
      const seed = spec.seedFor(n);
      const tag = `pinball ${level} seed ${seed}`;
      const out = pinballBot({ game: pinballGameForAny(PIN_REV_STD), seed, rev: PIN_REV_STD, human: new Human("pinball", seed, level as never), fixes: true });
      const events = out.events ?? [];
      const a = play(PIN_REV_STD, seed, events);
      const b = play(PIN_REV_JOULZ, seed, events);
      ok(JSON.stringify(a.sums) === JSON.stringify(b.sums), `${tag}: every checkpoint checksum the same on pinRev 6 and 7`);
      ok(b.score >= a.score, `${tag}: pinRev 7 never scores less (${a.score} → ${b.score})`);
      if (level === "perfect" || level === "elite") {
        if (a.score === 200) at200[0]++;
        if (b.score === 200) at200[1]++;
      }
      const raw = spec.encode({ seed, claimedScore: b.score, events, endTick: b.state.tick, checkpoints: b.checkpoints }, PIN_REV_JOULZ, seed);
      const res = replayPinballRun(seed, raw, PIN_REV_JOULZ);
      ok(!res.flagged && res.score === b.score, `${tag}: replays through the server to ${b.score} (got ${res.score}${res.flagged ? ", flagged" : ""})`);
    }
  ok(at200[1] >= at200[0], `pinball: elite and flawless runs at 200 on pinRev 6 / 7: ${at200[0]} / ${at200[1]} of 8`);
}

/* ============================ Meteor snakeRev 13 ============================ */
{
  ok((generatePuzzle("snake") as any).snakeRev === SNAKE_REV_WRAP && SNAKE_REV_WRAP === SNAKE_REV_12 + 1, "snake: rooms deal snakeRev 13");
  pinPreRetro(true);
  ok((generatePuzzle("snake") as any).snakeRev === SNAKE_REV_12, "snake: preRetro deals snakeRev 12");
  pinPreRetro(false);
  ok(LIVE_BANDS.snake.rev === SNAKE_REV_WRAP && LIVE_BANDS.snake.curve === SNAKE_V13_BAND_CURVE, "snake: the help reads snakeRev 13's core line");
  ok(/edges wrap/.test(JSON.stringify(PUZZLE_INSTRUCTIONS.snake)) && !/Hit a wall/.test(JSON.stringify(PUZZLE_INSTRUCTIONS.snake)), "snake: the help says the edges wrap, not that a wall ends the run");
  const g12 = snakeGameFor(SNAKE_REV_12);
  const g13 = snakeGameFor(SNAKE_REV_WRAP);
  ok(g13.runTicks <= 120 * TICKS_PER_SECOND, "snake: the run is at most 120 s");
  for (const seed of [1, 99, 4242]) {
    const { wrap, ...rest } = g13.init(seed) as SnakeState;
    ok(wrap === 1 && sorted(rest) === sorted(g12.init(seed)), `snake seed ${seed}: snakeRev 13 starts from snakeRev 12's exact world`);
  }
  // The wrap rule on built heads.
  const s0 = g13.init(4242) as SnakeState;
  const cols = snakeColsOf(s0);
  const rows = snakeRowsOf(s0);
  const at = (row: number, col: number) => row * cols + col;
  const exit = (cell: number, dir: number, st: SnakeState = s0) => snakeTarget({ ...st, body: [cell], warps: undefined } as SnakeState, dir);
  ok(exit(at(5, cols - 1), 1) === at(5, 0) && exit(at(5, 0), 3) === at(5, cols - 1), "snake: out the right edge, in at the left in the same row (and back)");
  ok(exit(at(0, 4), 0) === at(rows - 1, 4) && exit(at(rows - 1, 4), 2) === at(0, 4), "snake: out the top, in at the bottom in the same column (and back)");
  ok(exit(at(5, cols - 1), 1, { ...s0, wrap: undefined } as SnakeState) === -1, "snake: snakeRev 12's walls still end the move");
  // The bots' logs.
  const spec = GAME_BY_TYPE.get("snake" as never)!;
  const play = (rev: number, seed: number, events: any[]) => {
    const game = snakeGameFor(rev);
    const by = new Map(events.map((e: any) => [e.t, e]));
    let s = game.init(seed) as SnakeState;
    const trace: string[] = [];
    const checkpoints: unknown[] = [];
    while (!game.isOver(s)) {
      s = game.step(s, by.get(s.tick + 1) ?? null) as SnakeState;
      trace.push(`${s.body.join(".")}|${s.eaten}|${s.pellet}|${(s.rocks ?? []).join(".")}`);
      if (s.tick % 300 === 0) checkpoints.push(spec.checkpoint(s));
    }
    return { state: s, trace, checkpoints, score: game.score(s) };
  };
  let walled = 0;
  for (const level of ["weak", "average", "good", "near"] as const)
    for (let n = 0; n < 5; n++) {
      const seed = spec.seedFor(n);
      const tag = `snake ${level} seed ${seed}`;
      const out = snakeBot({ game: g12, seed, rev: SNAKE_REV_12, human: new Human("snake", seed, level as never), fixes: true });
      const events = out.events ?? [];
      const a = play(SNAKE_REV_12, seed, events);
      const b = play(SNAKE_REV_WRAP, seed, events);
      const wallEnd = a.state.dead && !a.state.rockHit && a.state.body.length > 0 && snakeTarget(a.state, a.state.dir) < 0;
      const upTo = a.state.dead ? a.trace.length - 1 : a.trace.length;
      ok(JSON.stringify(a.trace.slice(0, upTo)) === JSON.stringify(b.trace.slice(0, upTo)), `${tag}: snakeRev 13 plays tick for tick as snakeRev 12 until its end`);
      if (wallEnd && a.state.tick < g12.runTicks) {
        walled++;
        ok(b.state.tick > a.state.tick, `${tag}: snakeRev 12's wall crash at tick ${a.state.tick} is a wrap on snakeRev 13 (ran to ${b.state.tick})`);
      }
      ok(!(b.state.dead && !b.state.rockHit && snakeTarget(b.state, b.state.dir) < 0), `${tag}: no wall crash on snakeRev 13`);
      const raw = spec.encode({ seed, claimedScore: b.score, events, endTick: b.state.tick, checkpoints: b.checkpoints }, SNAKE_REV_WRAP, seed);
      const res = replaySnakeRun(seed, raw, SNAKE_REV_WRAP);
      ok(!res.flagged && res.score === b.score, `${tag}: replays through the server to ${b.score} (got ${res.score}${res.flagged ? ", flagged" : ""})`);
    }
  ok(walled >= 2, `snake: ${walled} wall crashes turned into wraps`);
}

/* ============================ Breaker brkRev 12 ============================ */
{
  ok((generatePuzzle("breaker") as any).brkRev === BRK_REV_CLEAR && BRK_REV_CLEAR === BRK_REV_STD + 1, "breaker: rooms deal brkRev 12");
  pinPreRetro(true);
  ok((generatePuzzle("breaker") as any).brkRev === BRK_REV_STD, "breaker: preRetro deals brkRev 11");
  pinPreRetro(false);
  ok(LIVE_BANDS.breaker.rev === BRK_REV_CLEAR, "breaker: the help reads brkRev 12");
  ok(/multi-ball/i.test(JSON.stringify(PUZZLE_INSTRUCTIONS.breaker)) && /9 rows/.test(JSON.stringify(PUZZLE_INSTRUCTIONS.breaker)), "breaker: the help describes the 9-row wall and the multi-ball");
  const g11 = breakerGameFor(BRK_REV_STD);
  const g12 = breakerGameFor(BRK_REV_CLEAR);
  ok(g12.runTicks <= 120 * TICKS_PER_SECOND, "breaker: the run is at most 120 s");
  for (const seed of [1, 77, 4242, 99991, 123456]) {
    const a = g11.init(seed) as BrkState;
    const b = g12.init(seed) as BrkState;
    const count = (st: BrkState, kind?: number) => st.gold.filter((g) => (kind === undefined ? g > 0 : g === kind)).length;
    ok(b.bricks.length === 81 && a.bricks.length === 108, `breaker seed ${seed}: 81 bricks (brkRev 11: 108)`);
    ok(brkGoldDealt(b) === brkGoldDealt(a) && brkGoldDealt(b) === 3, `breaker seed ${seed}: the 3 gold bricks kept`);
    ok(count(b) === count(a), `breaker seed ${seed}: every power brick kept (${count(a)} → ${count(b)})`);
    const keptRows = [0, 1, 2, 6, 7, 8, 9, 10, 11];
    ok(keptRows.every((row, r) => JSON.stringify(a.bricks.slice(row * 9, row * 9 + 9)) === JSON.stringify(b.bricks.slice(r * 9, r * 9 + 9))), `breaker seed ${seed}: the kept rows' bricks as brkRev 11 dealt them`);
    ok(b.gold.slice(0, 27).every((g, i) => g === a.gold[i]), `breaker seed ${seed}: the top three rows' power bricks unchanged`);
    ok((b.slide ?? []).every((r) => r >= 0 && r < 9) && new Set(b.slide).size === (b.slide ?? []).length, `breaker seed ${seed}: two distinct sliding rows on the wall`);
    ok(b.speed > a.speed, `breaker seed ${seed}: the ball starts quicker (${a.speed} → ${b.speed})`);
    ok(sorted(g12.init(seed)) === sorted(b), `breaker seed ${seed}: the same board twice (identical for every player)`);
  }
  const spec = GAME_BY_TYPE.get("breaker" as never)!;
  const clears = [0, 0];
  for (let n = 0; n < 6; n++) {
    const seed = spec.seedFor(n);
    for (const [k, rev] of [[0, BRK_REV_STD], [1, BRK_REV_CLEAR]] as const) {
      const game = breakerGameFor(rev);
      const out = breakerBot({ game, seed, rev, human: new Human("breaker", seed, "elite" as never), fixes: true });
      const events = out.events ?? [];
      const by = new Map(events.map((e: any) => [e.t, e]));
      let st = game.init(seed) as BrkState;
      const checkpoints: unknown[] = [];
      while (!game.isOver(st)) {
        st = game.step(st, by.get(st.tick + 1) ?? null) as BrkState;
        if (st.tick % 300 === 0) checkpoints.push(spec.checkpoint(st));
      }
      if (st.cleared) clears[k]!++;
      if (rev === BRK_REV_CLEAR) {
        const score = game.score(st);
        const raw = spec.encode({ seed, claimedScore: score, events, endTick: st.tick, checkpoints }, rev, seed);
        const res = replayBreakerRun(seed, raw, rev);
        ok(!res.flagged && res.score === score, `breaker elite seed ${seed}: replays through the server to ${score} (got ${res.score}${res.flagged ? ", flagged" : ""})`);
      }
    }
  }
  ok(clears[1]! >= 5 && clears[1]! > clears[0]!, `breaker: the elite bot clears the wall on ${clears[1]} of 6 seeds (brkRev 11: ${clears[0]})`);
}

/* ============================ Wavefront wavRev 14 ============================ */
{
  ok((generatePuzzle("wavefront") as any).wavRev === WAV_REV_CHARGE && WAV_REV_CHARGE === WAV_REV_KEEP + 1, "wavefront: rooms deal wavRev 14");
  pinPreRetro(true);
  ok((generatePuzzle("wavefront") as any).wavRev === WAV_REV_KEEP, "wavefront: preRetro deals wavRev 13");
  pinPreRetro(false);
  ok(LIVE_BANDS.wavefront.rev === WAV_REV_CHARGE, "wavefront: the help reads wavRev 14");
  ok(/heavy blast/.test(JSON.stringify(PUZZLE_INSTRUCTIONS.wavefront)), "wavefront: the intro and help teach the charged shot");
  const g13 = wavefrontGameFor(WAV_REV_KEEP);
  const g14 = wavefrontGameFor(WAV_REV_CHARGE);
  ok(g14.runTicks <= 120 * TICKS_PER_SECOND, "wavefront: the run is at most 120 s");
  const play = (game: typeof g14, seed: number, events: ArcadeInputEvent[]) => {
    const by = new Map(events.map((e) => [e.t, e]));
    let st = game.init(seed) as WavState;
    const trace: string[] = [];
    const checkpoints: unknown[] = [];
    while (!game.isOver(st)) {
      st = game.step(st, by.get(st.tick + 1) ?? null) as WavState;
      trace.push(`${st.shipX}|${st.shapesDown}|${st.armourHits}|${st.lives}|${st.bolts.length}|${st.rng}`);
      if (st.tick % 300 === 0) checkpoints.push(wavCheckpoint(st));
    }
    return { state: st, trace, checkpoints, score: game.score(st) };
  };
  // A sweeping drag log (never lifted): the same play on both stamps.
  const sweep = (charge: boolean): ArcadeInputEvent[] => {
    const out: ArcadeInputEvent[] = [];
    for (let t = 1; t < g14.runTicks; t += 6) {
      const x = 40 + ((t * 7) % (WAV_WORLD_W - 80));
      const phase = t % 120;
      const c = !charge ? 0 : phase === 1 ? WAV_V14_HOLD : phase === 85 ? WAV_V14_LIFT : 0;
      out.push({ t, k: ARCADE_INPUT_DRAG, a: x, b: 0, c, d: 0 });
    }
    return out;
  };
  for (const seed of [3, 41, 777]) {
    const a = play(g13, seed, sweep(false));
    const b = play(g14, seed, sweep(false));
    ok(JSON.stringify(a.trace) === JSON.stringify(b.trace) && a.score === b.score, `wavefront seed ${seed}: with no charge wavRev 14 plays tick for tick as wavRev 13`);
    const c = play(g14, seed, sweep(true));
    ok((c.state.heavies ?? 0) > 0, `wavefront seed ${seed}: holds of 84 ticks fire heavy blasts (${c.state.heavies})`);
    const raw = encodeWavefrontRun({ seed, claimedScore: c.score, events: sweep(true), inputs: [], taps: [], endTick: c.state.tick, checkpoints: c.checkpoints } as never);
    const res = replayWavefrontRun(seed, raw, WAV_REV_CHARGE);
    ok(!res.flagged && res.score === c.score, `wavefront seed ${seed}: a charged run replays through the server to ${c.score} (got ${res.score}${res.flagged ? ", flagged" : ""})`);
  }
  // A heavy blast on armour cracks three plates at once, an ordinary bolt one (the same bolt placed under the armour).
  {
    const wspec = GAME_BY_TYPE.get("wavefront" as never)!;
    const wseed = wspec.seedFor(0);
    let st = g14.init(wseed) as WavState;
    const ev = (wavefrontBot({ game: g13, seed: wseed, rev: WAV_REV_KEEP, human: new Human("wavefront", wseed, "elite" as never), fixes: true }).events ?? []) as ArcadeInputEvent[];
    const by = new Map(ev.map((e) => [e.t, e]));
    while (!g14.isOver(st) && !(st.armour && st.armour.hp >= WAV_V14_HEAVY_HITS && !(st.enter ?? 0))) st = g14.step(st, by.get(st.tick + 1) ?? null) as WavState;
    ok(!!st.armour, "wavefront: a wave with armour comes up");
    if (st.armour) {
      const box = wavShapeBox(st, st.armour.row * 9 + st.armour.col);
      const shot = (hv: boolean): WavState => {
        let t = { ...st, bolts: [{ x: (box.x + 10) * 256, y: (box.y + 40) * 256, ...(hv ? { p: WAV_V14_HEAVY_HITS, hv: WAV_V14_HEAVY_HITS } : {}) }], fireIn: 999 } as WavState;
        for (let k = 0; k < 8; k++) t = g14.step(t, null) as WavState;
        return t;
      };
      const plain = shot(false).armourHits - st.armourHits;
      const heavy = shot(true).armourHits - st.armourHits;
      ok(plain === 1 && heavy === WAV_V14_HEAVY_HITS, `wavefront: one bolt cracks ${plain} plate, a heavy blast ${heavy}`);
    }
  }
  // The hold's length: under a second fires nothing; a second or more fires one blast from the ship.
  const hold = (len: number) => {
    let st = g14.init(9) as WavState;
    const events: Record<number, ArcadeInputEvent> = {
      5: { t: 5, k: ARCADE_INPUT_DRAG, a: 200, b: 0, c: WAV_V14_HOLD, d: 0 },
      [5 + len]: { t: 5 + len, k: ARCADE_INPUT_DRAG, a: 200, b: 0, c: WAV_V14_LIFT, d: 0 },
    };
    while (st.tick < 5 + len) st = g14.step(st, events[st.tick + 1] ?? null) as WavState;
    return st;
  };
  ok((hold(WAV_V14_CHARGE_TICKS - 1).heavies ?? 0) === 0, "wavefront: a hold under a second fires no blast");
  const fired = hold(WAV_V14_CHARGE_TICKS);
  ok((fired.heavies ?? 0) === 1 && fired.bolts.some((bolt) => bolt.hv === WAV_V14_HEAVY_HITS), "wavefront: a one-second hold fires one heavy blast");
}

/* ============================ The shared Retro HUD ============================ */
{
  ok(RETRO_HUD_MIN_PX === 11, `the Retro HUD's smallest count is 11 px (${RETRO_HUD_MIN_PX})`);
  for (const want of [6, 8, 10, 11, 14, 20]) {
    const got = retroHudFloorPx(want);
    ok(got >= 11 && got >= Math.min(want, 11) && (want < 11 || got === want), `retroHudFloorPx(${want}) = ${got}, never under 11`);
  }
}

if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  console.log(`FAIL retro-overhaul-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS retro-overhaul-check: ${checks} checks (Tempo beatRev 12 plays as beatRev 11, never scores less; Rally's lives and spin shots; Fission's kinder wave clears; Pinball's one J-O-U-L-Z set; Meteor's wrap; Breaker's clearable wall; Wavefront's charged shot; the Retro HUD floor)`);
