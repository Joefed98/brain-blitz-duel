/**
 * Tuning C (Oct 2026): Gemstone matchupRev 5, Grappler swingRev 7, Hover
 * hoverRev 4, Rainbow Bridge inkRev 6, Roofbound flipRev 4, Tempo beatRev 4,
 * Wavefront wavRev 5, Tilt tiltRev 4, Slice sliceRev 4, Junction retired.
 *
 *  1. Old rounds: 72 real runs recorded with the code before Tuning C on each
 *     game's then-live revision (scripts/fixtures/arcade-tuning-c-legacy.json,
 *     scripts/arcade-tuning-c-legacy.ts) replay through today's server path to
 *     the same score and the same final state, unflagged.
 *  2. New rounds carry the new stamps and score on the bands; Junction is
 *     practice only and rooms deal 21 arcade games.
 *  3. Score-only revisions (Grappler, Hover, Rainbow Bridge, Tempo) replay the
 *     same log to the same play as before and score it on their new curves.
 *  4. Per game, the new rules: Gemstone's wait and par, Roofbound's 10 s bend,
 *     Wavefront's slower drops and timed boss kill, Tilt's amber start
 *     and hole-mouth stars, Slice's bigger blade; and 150 through the server
 *     replay where a game changed play.
 *
 *   bun scripts/arcade-tuning-c-check.ts          (TUNING_C_ONLY=matchup,tilt,…)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import { TUNING_C_GAMES, type TuningCRecord } from "./arcade-tuning-c-legacy";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, type SkillLevel, type SkillProfile } from "./arcade-skill-bands/human";

/** A flawless player for 150 proofs: quick, never lapses, no timing, aim or judgement error. */
const PERFECT: SkillProfile = { reactionMs: [120, 0], lapse: 0, timingSdMs: 0, aimSdPx: 0, powerSd: 0, mistake: 0, thinkScale: 0.3, judgement: 0, trackLagMs: 30 };
import { puzzleUsesBands } from "../src/lib/arcade/bandParts";
import { bandPoints, bandTop } from "../src/lib/arcade/scoreBands";
import { ACTIVE_ARCADE_GAMES, ARCADE_GAME_WORLDS, MATCHUP_FX } from "../src/lib/arcade/arcadeFxGames.renderer";
import {
  matchupBusy,
  matchupGameFor,
  matchupWaitTicks,
  MATCHUP_CLEAR_MS,
  MATCHUP_DROP_MS,
  MATCHUP_INPUT_SWAP,
  MATCHUP_REV_BAND,
  MATCHUP_REV_PAR,
  MATCHUP_REV_WAIT,
  MATCHUP_ROWS,
  MATCHUP_SIZE,
  MATCHUP_V5_BAND_CURVE,
  type MatchupState,
} from "../src/lib/arcade/matchup";
import { encodeMatchupRun, replayMatchupRun } from "../src/lib/duel/matchup";
import { swingGameFor, SWING_BAND_CURVE, SWING_REV_TUNED, SWING_REV_TUNEC, SWING_V7_BAND_CURVE } from "../src/lib/arcade/swing";
import { hoverGameFor, HOVER_BAND_CURVE, HOVER_REV_BAND, HOVER_REV_TALL, HOVER_REV_TUNEC, HOVER_V4_BAND_CURVE } from "../src/lib/arcade/hover";
import { inkBridgeGameFor, INK_BAND_CURVE, INK_REV_BAND, INK_REV_TUNEC, INK_V6_BAND_CURVE } from "../src/lib/arcade/inkBridge";
import { flipGameFor, flipWarpAmp, FLIP_BAND_CURVE, FLIP_REV, FLIP_REV_BAND, FLIP_REV_TUNEC, FLIP_V4_BAND_CURVE, FLIP_WARP_FROM_V4 } from "../src/lib/arcade/flip";
import { beatGameFor, BEAT_BAND_CURVE, BEAT_REV_BAND, BEAT_REV_TUNEC, BEAT_REV_TUNEF, BEAT_V4_BAND_CURVE } from "../src/lib/arcade/beat";
import {
  wavDropPx,
  wavefrontGameFor,
  wavWaves,
  WAV_BOSS_HP,
  WAV_DROP_SLOW_PX,
  WAV_KILL_WINDOW_V5,
  WAV_PAR_V5,
  WAV_POINTS_BOSS,
  WAV_REV_SHAPES,
  WAV_REV_TUNEC,
  WAV_V5_BAND_CURVE,
  WAV_V5_WAVES,
  wavefrontBandParts,
  type WavState,
} from "../src/lib/arcade/wavefront";
import {
  tiltAmberMinHops,
  tiltCellCentre,
  tiltCupReachable,
  tiltGameFor,
  tiltStarPoint,
  TILT_REV_BAND,
  TILT_REV_TUNEC,
  TILT_STARS_PER_MAZE,
  TILT_STAR_MOUTH,
  TILT_V4_FINISH_MIN,
  type TiltState,
} from "../src/lib/arcade/tilt";
import { sliceGameFor, SLICE_BLADE_V4, SLICE_INPUT_BEGIN, SLICE_INPUT_SWIPE, SLICE_R, SLICE_REV_BAND, SLICE_REV_LONG, SLICE_REV_TUNEC, sliceObjectAt, type SliceState } from "../src/lib/arcade/slice";
import { generateBeat, generateFlip, generateInkBridge, generateMatchup, generateSlice, generateSwing, generateTilt, generateWavefront } from "../src/lib/duel/arcade.server";
import { generateHover } from "../src/lib/duel/hover.server";
import { isRetired, typesInCategory } from "../src/lib/duel/registry";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { encodeTiltRun, replayTiltRun } from "../src/lib/duel/tilt";
import { playTilt } from "./tilt-bot";
import { PINBALL_IN_ROOMS } from "../src/lib/arcade/pinball";
import { playRevOf } from "./scoring-targets-revs";

const ONLY = (process.env.TUNING_C_ONLY ?? "").split(",").filter(Boolean);
const want = (type: string) => ONLY.length === 0 || ONLY.includes(type);
const failures: string[] = [];
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
const section = (name: string) => console.log(`— ${name}`);

/** A skill-band player's run on a revision, sent through the server's encode + replay; returns the replay. */
async function botRun(type: string, rev: number, level: SkillLevel, n: number, withCheckpoints = true, profile?: SkillProfile) {
  const spec = GAME_BY_TYPE.get(type as never)!;
  const { bot } = await import(`./arcade-skill-bands/bots/${type}.ts`);
  const seed = spec.seedFor(n);
  const game = spec.gameFor(rev, seed);
  const human = new Human(spec.type, seed, level);
  if (profile) (human as unknown as { p: SkillProfile }).p = profile;
  const out = bot({ game, seed, rev, human });
  let state = game.init(seed);
  const checkpoints: unknown[] = [];
  const byTick = new Map((out.events ?? []).map((e: any) => [e.t, e]));
  const taps = new Set(out.taps ?? []);
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    state = game.step(state, spec.taps ? taps.has(t) : (byTick.get(t) ?? null));
    if (withCheckpoints && state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
  }
  const score = game.score(state);
  const raw = spec.encode({ seed, claimedScore: score, events: out.events ?? [], inputs: out.taps ?? [], taps: [], endTick: state.tick, checkpoints }, rev, seed);
  const result = spec.replay(seed, raw, rev);
  /** The same inputs as the phone on revision `r` would send them (its own score claim and checkpoints). */
  const reencode = (r: number) => {
    const g = spec.gameFor(r, seed);
    let st = g.init(seed);
    const cps: unknown[] = [];
    while (!g.isOver(st) && st.tick < g.runTicks) {
      const t = st.tick + 1;
      st = g.step(st, spec.taps ? taps.has(t) : (byTick.get(t) ?? null));
      if (st.tick % 300 === 0) cps.push(spec.checkpoint(st));
    }
    return spec.encode({ seed, claimedScore: g.score(st), events: out.events ?? [], inputs: out.taps ?? [], taps: [], endTick: st.tick, checkpoints: cps }, r, seed);
  };
  return { seed, raw, score, result, reencode };
}

/* =============================== 1. Old rounds =============================== */
section("Old rounds replay and score exactly as before");
{
  const fixture = JSON.parse(readFileSync("scripts/fixtures/arcade-tuning-c-legacy.json", "utf8")) as { runs: TuningCRecord[] };
  const per = new Map<string, number>();
  for (const run of fixture.runs) {
    if (!want(run.type)) continue;
    const spec = GAME_BY_TYPE.get(run.type as never)!;
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const result = spec.replay(run.seed, raw, run.rev);
    ok(result.score === run.score && !result.flagged, `${run.type} ${run.level} ${run.seed}: stored ${run.score}, replays ${result.score}${result.flagged ? " (flagged)" : ""}`);
    ok(fnv(JSON.stringify(result.state)) === run.stateHash, `${run.type} ${run.level} ${run.seed}: the replayed final state changed`);
    per.set(run.type, (per.get(run.type) ?? 0) + 1);
  }
  for (const [type] of TUNING_C_GAMES) if (want(type)) ok((per.get(type) ?? 0) >= 8, `${type}: ${per.get(type) ?? 0} recorded runs`);
}

/* ======================== 2. Stamps, bands and Junction ======================== */
section("New rounds carry the Tuning C stamps; Junction is practice only");
{
  const stamps: [string, number | undefined, number][] = [
    // Tuning F (Oct 2026) moved Gemstone on to its 2,800 par (matchupRev 6), Slice on to its longer
    // slice (sliceRev 5) and Grappler on to its evenly spread stars (swingRev 8), the same play
    // otherwise; arcade-tuning-f-check and swing-rev8-check cover them.
    ["matchup", playRevOf("matchup", generateMatchup().matchupRev), MATCHUP_REV_PAR],
    // Taller worlds batch 3 (16 Oct 2026) then moved Grappler on to its taller cavern (swingRev 9); arcade-tuning-g3-check covers it.
    ["swing", playRevOf("swing", generateSwing().swingRev), SWING_REV_TUNEC + 2],
    // Tuning E (Oct 2026) moved Hover on to its taller world (hoverRev 5); arcade-tuning-e-check covers it.
    ["hover", playRevOf("hover", generateHover().hoverRev), HOVER_REV_TALL],
    ["inkbridge", playRevOf("inkbridge", generateInkBridge().inkRev), INK_REV_TUNEC],
    ["flip", playRevOf("flip", generateFlip().flipRev), FLIP_REV_TUNEC],
    // Tuning F (Oct 2026) moved Tempo on to a thinner chart on the same curve (beatRev 5); arcade-tuning-f-check covers it.
    // Taller worlds batch 2 (16 Oct 2026) moved Tempo and Slice on to their taller worlds (beatRev 6, sliceRev 6); arcade-tuning-g2-check covers them.
    ["beat", playRevOf("beat", generateBeat().beatRev), BEAT_REV_TUNEF + 1],
    // Taller worlds batch 1 (16 Oct 2026) moved Wavefront on to its taller world (wavRev 6); arcade-tuning-g1-check covers it.
    ["wavefront", playRevOf("wavefront", generateWavefront().wavRev), WAV_REV_TUNEC + 1],
    ["tilt", playRevOf("tilt", generateTilt().tiltRev), TILT_REV_TUNEC],
    ["slice", playRevOf("slice", generateSlice().sliceRev), SLICE_REV_LONG + 1],
  ];
  const field: Record<string, string> = { matchup: "matchupRev", swing: "swingRev", hover: "hoverRev", inkbridge: "inkRev", flip: "flipRev", beat: "beatRev", wavefront: "wavRev", tilt: "tiltRev", slice: "sliceRev" };
  for (const [type, got, rev] of stamps) {
    ok(got === rev, `${type}: new rounds stamped ${rev} (got ${got})`);
    ok(puzzleUsesBands({ type, [field[type]!]: rev } as never), `${type} ${rev} scores on the bands`);
  }
  ok(isRetired("junction"), "Junction is retired (practice only)");
  ok(!typesInCategory("arcade").includes("junction"), "rooms never deal Junction");
  // 21 since Tuning C; 22 once Pinball (13 Oct, practice only until PINBALL_IN_ROOMS) is switched on.
  const dealt = 21 + (PINBALL_IN_ROOMS ? 1 : 0);
  ok(typesInCategory("arcade").length === dealt, `rooms deal ${dealt} arcade games (got ${typesInCategory("arcade").length})`);
  ok(ACTIVE_ARCADE_GAMES.length === dealt && !ACTIVE_ARCADE_GAMES.includes("junction") && "junction" in ARCADE_GAME_WORLDS, `${dealt} active arcade worlds; Junction keeps its world for practice`);
  ok([...typesInCategory("arcade")].sort().join() === [...ACTIVE_ARCADE_GAMES].sort().join(), "the active arcade list is exactly the arcade types rooms deal");
}

/* ===================== 3. Score-only revisions: same play ===================== */
section("Grappler, Hover, Rainbow Bridge and Tempo: same play, new curves");
{
  const cases: { type: string; old: number; next: number; oldCurve: any; newCurve: any; game: (r: number) => any; lower: boolean }[] = [
    { type: "swing", old: SWING_REV_TUNED, next: SWING_REV_TUNEC, oldCurve: SWING_BAND_CURVE, newCurve: SWING_V7_BAND_CURVE, game: (r) => swingGameFor(r), lower: true },
    { type: "hover", old: HOVER_REV_BAND, next: HOVER_REV_TUNEC, oldCurve: HOVER_BAND_CURVE, newCurve: HOVER_V4_BAND_CURVE, game: (r) => hoverGameFor(r), lower: true },
    { type: "inkbridge", old: INK_REV_BAND, next: INK_REV_TUNEC, oldCurve: INK_BAND_CURVE, newCurve: INK_V6_BAND_CURVE, game: (r) => inkBridgeGameFor(r), lower: true },
    { type: "beat", old: BEAT_REV_BAND, next: BEAT_REV_TUNEC, oldCurve: BEAT_BAND_CURVE, newCurve: BEAT_V4_BAND_CURVE, game: (r) => beatGameFor(r), lower: false },
  ];
  for (const c of cases) {
    if (!want(c.type)) continue;
    const spec = GAME_BY_TYPE.get(c.type as never)!;
    ok(bandTop(c.oldCurve) === bandTop(c.newCurve) && c.oldCurve.points.at(-1) === c.newCurve.points.at(-1), `${c.type}: the curve's top is unchanged`);
    for (let u = 1; u < bandTop(c.oldCurve); u++) {
      const o = bandPoints(c.oldCurve, u);
      const nw = bandPoints(c.newCurve, u);
      if (c.lower ? nw > o : nw < o) {
        ok(false, `${c.type}: ${u} units score ${nw} (was ${o}), the wrong way`);
        break;
      }
    }
    // The same inputs, played on the old and the new revision: identical play, the new curve's score.
    for (const level of ["good", "great"] as const) {
      const run = await botRun(c.type, c.old, level, 1);
      const seed = run.seed;
      const replayed = spec.replay(seed, run.reencode(c.next), c.next);
      const { tunec: _t, ...newState } = replayed.state;
      ok(!replayed.flagged || run.result.flagged, `${c.type} ${level}: the old log replays unflagged on the new revision`);
      ok(JSON.stringify(newState) === JSON.stringify(run.result.state), `${c.type} ${level}: the same log plays the same on the new revision`);
      ok(replayed.state.tunec === 1, `${c.type} ${level}: the new revision's state carries tunec`);
      ok(c.lower ? replayed.score <= run.result.score : replayed.score >= run.result.score, `${c.type} ${level}: ${run.result.score} → ${replayed.score}`);
    }
  }
  // Hover's help now states its Tuning E curve (arcade-tuning-e-check).
  // Screen audit Oct 2026: the help gives a good run from the curve rooms deal (swingRev 9, inkRev 6, beatRev 6; arcade-help-bands-check).
  ok(PUZZLE_INSTRUCTIONS.swing.score.includes("A good run (100 points) counts 166") && PUZZLE_INSTRUCTIONS.inkbridge.score.includes("A good run (100 points) counts 59") && PUZZLE_INSTRUCTIONS.beat.score.includes("A good run (100 points) reaches 868"), "the \"?\" help states a good run on the curves rooms deal");
}

/* ================================ 4a. Gemstone ================================ */
if (want("matchup")) {
  section("Gemstone matchupRev 5: wait for the gems to fall, par 2,500");
  const game = matchupGameFor(MATCHUP_REV_WAIT);
  ok(bandTop(MATCHUP_V5_BAND_CURVE) === 2500 && bandPoints(MATCHUP_V5_BAND_CURVE, 2500) === 150 && bandPoints(MATCHUP_V5_BAND_CURVE, 2499) < 150, "150 needs 2,500 match points");
  // The live help shows the curve rooms deal today (Tuning F: 150 at 2,800, arcade-tuning-f-check).
  ok(PUZZLE_INSTRUCTIONS.matchup.score.includes("2,800") && PUZZLE_INSTRUCTIONS.matchup.how.some((h) => h.detail.includes("wait")), "the \"?\" help and intro say so");
  // Find a valid swap on a fresh board, make it, then check the wait.
  const swaps: [number, number, number, number][] = [];
  for (let r = 0; r < MATCHUP_ROWS; r++)
    for (let c = 0; c < MATCHUP_SIZE; c++) {
      if (c + 1 < MATCHUP_SIZE) swaps.push([r, c, r, c + 1]);
      if (r + 1 < MATCHUP_ROWS) swaps.push([r, c, r + 1, c]);
    }
  let waitsOk = true;
  let refused = true;
  let resolvedAtOnce = true;
  for (let seed = 1; seed <= 30; seed++) {
    let s = game.init(seed * 101) as MatchupState;
    const move = swaps.find((m) => (game.step(s, { t: 1, k: MATCHUP_INPUT_SWAP, a: m[0], b: m[1], c: m[2], d: m[3] }) as MatchupState).swaps > s.swaps)!;
    s = game.step(s, { t: 1, k: MATCHUP_INPUT_SWAP, a: move[0], b: move[1], c: move[2], d: move[3] }) as MatchupState;
    const ms = s.lastAnimation.reduce((t, step) => t + MATCHUP_CLEAR_MS + Math.max(1, step.ticks) * MATCHUP_DROP_MS, 150);
    waitsOk &&= s.busyUntil === 1 + Math.ceil((ms * 60) / 1000) && matchupWaitTicks(s.lastAnimation) === s.busyUntil - 1;
    // The whole cascade resolved on the swap's tick (no pending steps).
    resolvedAtOnce &&= !(s.pendingTick ?? 0) && s.lastSteps === s.lastAnimation.length;
    // Any swap before the wait is over is ignored: the state only ticks.
    while (matchupBusy(s)) {
      const before = s;
      for (const m of swaps) {
        const tried = game.step(before, { t: before.tick + 1, k: MATCHUP_INPUT_SWAP, a: m[0], b: m[1], c: m[2], d: m[3] }) as MatchupState;
        if (tried.swaps !== before.swaps || tried.lastInvalidTick === before.tick + 1) refused = false;
      }
      s = game.step(s, null) as MatchupState;
    }
  }
  ok(waitsOk, "each swap keeps the board busy for its tween plus every step's original-speed clear and fall");
  ok(resolvedAtOnce, "a swap resolves its whole cascade at once (no constant play)");
  ok(refused, "swaps made while the gems fall are refused");
  // 150 through the server replay: a fast player taking the best swap as soon as the board settles.
  let best = 0;
  for (let seed = 1; seed <= 3 && best < 150; seed++) {
    const g = matchupGameFor(MATCHUP_REV_WAIT);
    let s = g.init(seed * 7919) as MatchupState;
    const events: any[] = [];
    const checkpoints: any[] = [];
    while (!g.isOver(s)) {
      let ev: any = null;
      if (!matchupBusy(s) && s.tick % 20 === 0) {
        let gain = 0;
        for (const m of swaps) {
          const e = { t: s.tick + 1, k: MATCHUP_INPUT_SWAP, a: m[0], b: m[1], c: m[2], d: m[3] };
          const nx = g.step(s, e) as MatchupState;
          if (nx.raw - s.raw > gain) {
            gain = nx.raw - s.raw;
            ev = e;
          }
        }
      }
      if (ev) events.push(ev);
      s = g.step(s, ev) as MatchupState;
      if (s.tick % 300 === 0) checkpoints.push((GAME_BY_TYPE.get("matchup")!.checkpoint as any)(s));
    }
    const r = replayMatchupRun(seed * 7919, encodeMatchupRun({ seed: seed * 7919, claimedScore: g.score(s), events, endTick: s.tick, checkpoints }), MATCHUP_REV_WAIT);
    ok(!r.flagged && r.score === g.score(s), `matchup ${seed}: the server replay agrees (${r.score})`);
    best = Math.max(best, r.score);
  }
  ok(best === 150, `150 is reachable through the server replay (best ${best})`);
  // The same log on matchupRev 4 differs (play changed), but rev-4 rounds are proved by the fixture above.
  ok(matchupGameFor(MATCHUP_REV_BAND).init(5).rev === 3 && game.init(5).rev === MATCHUP_REV_WAIT, "rev-4 rounds keep constant play; rev 5 carries its own stamp");
  // No bursts or rings over the gems: every Gemstone fx event that marks a place is text only.
  ok(MATCHUP_FX.events.filter((e) => e.at).every((e) => e.textOnly), "Gemstone effects over the gems are text pop-ups only");
  const art = readFileSync("src/lib/arcade/matchup.renderer.ts", "utf8");
  const bursts = art.slice(art.indexOf("function drawClearBursts"), art.indexOf("/** The board drawing through the shared success layer"));
  ok(!bursts.includes("ctx.arc(") && !bursts.includes("fillRect("), "the cascade layer draws no sparks or rings, only the chain count");
}

/* ================================ 4b. Roofbound ================================ */
if (want("flip")) {
  section("Roofbound flipRev 4: the bend from 10 s, about 10 % more");
  ok(FLIP_WARP_FROM_V4 === 600, "the bend starts at 10 s");
  ok(flipWarpAmp(600, FLIP_REV, 1) === 0 && flipWarpAmp(630, FLIP_REV, 1) > 0, "flipRev 4 bends from 10 s");
  ok(flipWarpAmp(900, FLIP_REV) === 0 && flipWarpAmp(930, FLIP_REV) > 0 && flipWarpAmp(630, FLIP_REV) === 0, "flipRev 2/3 still bend from 15 s");
  const game = flipGameFor(FLIP_REV_TUNEC);
  const band = flipGameFor(FLIP_REV_BAND);
  const a = game.init(9) as any;
  const b = band.init(9) as any;
  ok(JSON.stringify({ ...a, tunec: undefined }) === JSON.stringify(b), "same course, stars and crumbles as flipRev 3");
  for (let u = 1; u < bandTop(FLIP_BAND_CURVE); u++) if (bandPoints(FLIP_V4_BAND_CURVE, u) < bandPoints(FLIP_BAND_CURVE, u)) ok(false, `flip ${u} units score less`);
  ok(PUZZLE_INSTRUCTIONS.flip.how.some((h) => h.detail.includes("From 10 seconds")), "the intro says the corridor bends from 10 seconds");
  let best = 0;
  for (let n = 0; n < 6 && best < 150; n++) {
    const run = await botRun("flip", FLIP_REV_TUNEC, "near", n);
    ok(!run.result.flagged && run.result.score === run.score, `flip ${run.seed}: the server replay agrees (${run.result.score})`);
    best = Math.max(best, run.result.score);
  }
  ok(best === 150, `150 is reachable on flipRev 4 through the server replay (best ${best})`);
}

/* ================================ 4c. Wavefront ================================ */
if (want("wavefront")) {
  section("Wavefront wavRev 5: five waves then the boss; slower waves 3 and 4; the kill timed");
  const game = wavefrontGameFor(WAV_REV_TUNEC);
  ok(wavWaves({ tunec: 1 }) === 5 && wavWaves({}) === 5, "five formation waves, as before");
  ok(WAV_DROP_SLOW_PX === 27 && wavDropPx({ tunec: 1, wave: 3 }) === WAV_DROP_SLOW_PX && wavDropPx({ tunec: 1, wave: 4 }) === WAV_DROP_SLOW_PX && wavDropPx({ tunec: 1, wave: 2 }) === 36 && wavDropPx({ tunec: 1, wave: 5 }) === 36 && wavDropPx({ wave: 3 }) === 36, "waves 3 and 4 drop three quarters of a row at a wall on wavRev 5 only");
  let s = game.init(13) as WavState;
  const seen: number[] = [];
  for (let k = 0; k < 8000 && !s.ended && !s.boss; k++) {
    if ((s.enter ?? 0) === 0 && !seen.includes(s.wave)) {
      seen.push(s.wave);
      s = { ...s, shapes: s.shapes.map(() => 0), armour: null };
    }
    s = game.step(s, null) as WavState;
  }
  ok(seen.join() === "1,2,3,4,5" && Boolean(s.boss) && (s.bossAt ?? 0) > 0, `waves ${seen.join(", ")} then the boss, its arrival recorded`);
  // Same boss as wavRev 4: its hits and its seeded volleys.
  {
    const old = wavefrontGameFor(WAV_REV_SHAPES);
    let a = { ...s, enter: 0, reds: [] } as WavState;
    let b = { ...a, tunec: undefined, bossAt: undefined } as WavState;
    let same = a.boss?.hp === WAV_BOSS_HP;
    for (let k = 0; k < 400 && !a.ended && !b.ended; k++) {
      a = game.step({ ...a, invuln: 999 }, null) as WavState;
      b = old.step({ ...b, invuln: 999 }, null) as WavState;
      same &&= JSON.stringify(a.reds) === JSON.stringify(b.reds) && a.boss?.x === b.boss?.x;
    }
    ok(same, "the boss is wavRev 4's (36 hits, the same seeded volleys)");
  }
  // 140 needs every ship, armour hit and wave of five waves and every boss hit; saucers can stand in for misses.
  ok(bandTop(WAV_V5_BAND_CURVE) === WAV_PAR_V5 - WAV_POINTS_BOSS, `the curve tops out at five perfect waves plus every boss hit (${bandTop(WAV_V5_BAND_CURVE)})`);
  const base = game.init(1) as WavState;
  const almost = wavefrontBandParts({ ...base, shapesDown: 999, armourHits: 99, saucers: 9, wavesCleared: WAV_V5_WAVES, bossHits: WAV_BOSS_HP - 1, bossKilled: 0 } as WavState);
  ok(almost.points + almost.bonus <= 140, `no boss kill, at most 140 (${almost.points + almost.bonus})`);
  // The kill adds up to 10 by how fast the boss fell from its arrival: full within half the window, 0 at the window.
  const kill = (fight: number) => wavefrontBandParts({ ...base, shapesDown: 999, armourHits: 99, saucers: 9, wavesCleared: WAV_V5_WAVES, bossHits: WAV_BOSS_HP, bossKilled: 1, bossAt: 3000, tick: 3000 + fight } as WavState).bonus;
  ok(kill(WAV_KILL_WINDOW_V5 / 2) === 10 && kill(WAV_KILL_WINDOW_V5) === 0 && kill((WAV_KILL_WINDOW_V5 * 3) / 4) === 5, "the kill's bonus: 10 within half the window, 5 at three quarters, 0 at the end");
  for (let f = 0; f < WAV_KILL_WINDOW_V5; f += 30) if (kill(f + 30) > kill(f)) ok(false, `a slower kill scores more at ${f} ticks`);
  ok(PUZZLE_INSTRUCTIONS.wavefront.goal.startsWith("Five waves") && PUZZLE_INSTRUCTIONS.wavefront.score.includes("saucers count 1") && PUZZLE_INSTRUCTIONS.wavefront.score.includes("within 20 s"), "the intro and help say five waves and the timed kill");
  // 150 through the server replay: the skill-band player with a perfect profile (no lapses, no aim or timing error).
  let best = 0;
  for (let n = 0; n < 12 && best < 150; n++) {
    const run = await botRun("wavefront", WAV_REV_TUNEC, "near", n, true, PERFECT);
    ok(!run.result.flagged && run.result.score === run.score, `wavefront ${run.seed}: the server replay agrees (${run.result.score})`);
    best = Math.max(best, run.result.score);
  }
  ok(best === 150, `150 is reachable on wavRev 5 through the server replay (best ${best})`);
  ok(wavefrontGameFor(WAV_REV_SHAPES).init(4).tunec === undefined, "wavRev 4 rounds never set tunec");
}

/* ================================ 4d. Tilt ================================ */
if (want("tilt")) {
  section("Tilt tiltRev 4: amber start away from its cup, stars at the holes");
  const game = tiltGameFor(TILT_REV_TUNEC);
  const old = tiltGameFor(TILT_REV_BAND);
  const bfs = (m: any, from: number) => {
    const DX = [1, 0, -1, 0];
    const DY = [0, 1, 0, -1];
    const dist = new Array(m.n * m.n).fill(-1);
    dist[from] = 0;
    const q = [from];
    for (let i = 0; i < q.length; i++) {
      const c = q[i]!;
      for (let d = 0; d < 4; d++) {
        const x = (c % m.n) + DX[d]!;
        const y = Math.trunc(c / m.n) + DY[d]!;
        if (x < 0 || y < 0 || x >= m.n || y >= m.n) continue;
        const nc = y * m.n + x;
        if (!m.inside[nc]) continue;
        const wall = d === 0 ? m.wallR[c] : d === 1 ? m.wallD[c] : d === 2 ? m.wallR[nc] : m.wallD[nc];
        if (wall || dist[nc] >= 0) continue;
        dist[nc] = dist[c] + 1;
        q.push(nc);
      }
    }
    return dist;
  };
  let near = 0;
  let nearOld = 0;
  let twoMarble = 0;
  let mouth = 0;
  let mouthOk = true;
  let sameWalls = true;
  let reachable = true;
  const SEEDS = 400;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const s = game.init(seed * 7919) as TiltState;
    const o = old.init(seed * 7919) as TiltState;
    s.list.forEach((m, i) => {
      const om = o.list[i]!;
      sameWalls &&= JSON.stringify([m.wallR, m.wallD, m.pits, m.start, m.exit]) === JSON.stringify([om.wallR, om.wallD, om.pits, om.start, om.exit]);
      reachable &&= tiltCupReachable(m, 0) && tiltCupReachable(m, 1);
      ok((m.stars ?? []).length === TILT_STARS_PER_MAZE, `tilt ${seed} maze ${i + 1}: ${TILT_STARS_PER_MAZE} stars`);
      if ((m.start2 ?? -1) >= 0) {
        twoMarble++;
        if (bfs(m, m.exit2!)[m.start2!]! < tiltAmberMinHops(m)) near++;
        if (bfs(om, om.exit2!)[om.start2!]! < tiltAmberMinHops(om)) nearOld++;
      }
      for (let k = 0; k < (m.stars ?? []).length; k++) {
        const p = tiltStarPoint(m, k);
        const centre = tiltCellCentre(m, m.stars![k]!);
        if (p.x === centre.x && p.y === centre.y) continue;
        mouth++;
        // The star sits TILT_STAR_MOUTH of a cell toward a hole next door; its pick-up box reaches
        // cells the marble can sit in without falling (the hole is the middle half of its cell).
        const pit = m.pits
          .filter((c) => {
            const pc = tiltCellCentre(m, c);
            return Math.abs(pc.x - centre.x) + Math.abs(pc.y - centre.y) === m.cs;
          })
          .sort((x, y) => {
            const px = tiltCellCentre(m, x);
            const py = tiltCellCentre(m, y);
            return Math.abs(px.x - p.x) + Math.abs(px.y - p.y) - (Math.abs(py.x - p.x) + Math.abs(py.y - p.y));
          })[0];
        if (pit === undefined) {
          mouthOk = false;
          continue;
        }
        const pc = tiltCellCentre(m, pit);
        const toPit = Math.abs(pc.x - p.x) + Math.abs(pc.y - p.y);
        const reach = Math.trunc(m.cs / 3);
        // The star point itself is outside the hole's fall box, and inside the pick-up reach of the front cell's centre side.
        mouthOk &&= toPit === m.cs - Math.trunc((m.cs * TILT_STAR_MOUTH) / 100) && toPit > Math.trunc(m.cs / 4) && Math.trunc((m.cs * TILT_STAR_MOUTH) / 100) - reach < Math.trunc(m.cs / 2);
      }
    });
  }
  ok(sameWalls, "the same mazes, holes and blue cups as tiltRev 3");
  ok(reachable, "every cup reachable for both marbles");
  ok(near === 0, `the amber marble never starts within a maze's width of its cup (${near} of ${twoMarble}; tiltRev 3: ${nearOld})`);
  ok(mouth >= SEEDS * 2 * 1.5, `many stars sit at a hole's mouth (${mouth} of ${SEEDS * 8})`);
  ok(mouthOk, "every mouth star is next to its hole and can be taken without falling in");
  ok(PUZZLE_INSTRUCTIONS.tilt.how.some((h) => h.action.includes("black holes")), "the intro says where the stars are");
  // 150 through the server replay: the checks' scripted Tilt player (scripts/tilt-bot.ts, real-sim lookahead,
  // brisk 4° a tick drags) takes all four mazes and all eight stars fast enough for the full speed bonus.
  let best = 0;
  let perfect = "";
  for (let n = 1; n <= 40 && best < 150; n++)
    for (const variant of [0, 1]) {
      if (best === 150) break;
      const seed = n * 7919;
      const run = playTilt(game, seed, { horizon: 36, variant });
      const score = game.score(run.state);
      if (run.state.mazes < 4 || (run.state.stars ?? 0) < 8) continue;
      const replay = replayTiltRun(seed, encodeTiltRun({ seed, claimedScore: score, events: run.events, endTick: run.state.tick, checkpoints: run.checkpoints }), TILT_REV_TUNEC);
      ok(!replay.flagged && replay.score === score, `tilt ${seed}: the server replay agrees (${replay.score})`);
      if (replay.score > best) {
        best = replay.score;
        perfect = `seed ${seed}: all 4 mazes, ${run.state.stars} stars, finished at ${(run.state.endedTick / 60).toFixed(1)} s`;
      }
    }
  ok(best === 150, `a scripted perfect run (every maze and star, fast) scores 150 on tiltRev 4 through the server replay (best ${best}; ${perfect})`);
  if (best === 150) console.log(`  150: ${perfect}`);
  ok(TILT_V4_FINISH_MIN === 3600, "tiltRev 4's speed bonus runs from 60 s to the buzzer (full by 75 s)");
}

/* ================================ 4e. Slice ================================ */
if (want("slice")) {
  section("Slice sliceRev 4: a wider, longer blade");
  const game = sliceGameFor(SLICE_REV_TUNEC);
  const band = sliceGameFor(SLICE_REV_BAND);
  const a = game.init(21) as SliceState;
  const b = band.init(21) as SliceState;
  ok(JSON.stringify({ ...a, tunec: undefined }) === JSON.stringify(b), "same foods, specials and chillies as sliceRev 3");
  // Find a food in the air, then swipe past it just outside the old reach and width.
  let s = a;
  let found = false;
  for (let t = 0; t < 1200 && !found; t++) {
    const at = s.objects.map((o, i) => ({ o, i, p: sliceObjectAt(o, s.tick + 1, s.slowFrom, s.mayo) })).find((e) => e.p && !e.o.bomb && !e.o.special && e.p.y / 256 > 200 && e.p.y / 256 < 500);
    if (at?.p) {
      found = true;
      const cx = Math.trunc(at.p.x / 256);
      const cy = Math.trunc(at.p.y / 256);
      const gap = SLICE_R + 2; // 2 px past the old edge, inside the new blade.
      const play = (g: any, st: SliceState, x: number) => {
        let q = g.step(st, { t: st.tick + 1, k: SLICE_INPUT_BEGIN, a: x, b: cy - 60, c: 0, d: 0 });
        q = g.step(q, { t: q.tick + 1, k: SLICE_INPUT_SWIPE, a: x, b: cy - 60, c: x, d: cy + 60 });
        return q.slices as number;
      };
      const sb = { ...s, tunec: undefined } as SliceState;
      ok(play(band, sb, cx + gap) === 0 && play(game, s, cx + gap) === 1, `a swipe ${gap} px from a food's centre misses on sliceRev 3 and cuts on sliceRev 4`);
      ok(play(game, s, cx + SLICE_R + SLICE_BLADE_V4 + 3) === 0, "the blade is only SLICE_BLADE_V4 px wider");
    }
    s = game.step(s, null) as SliceState;
  }
  ok(found, "a food to swipe at");
  const art = readFileSync("src/lib/arcade/slice.renderer.ts", "utf8");
  ok(art.includes("state.tunec?2*SLICE_BLADE_V4:3"), "the cut is drawn as wide as the blade");
}

if (failures.length) {
  console.log(`\nFAIL: ${failures.length} of ${checks} checks failed:`);
  for (const f of failures.slice(0, 40)) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`\nPASS: ${checks} Tuning C checks`);
