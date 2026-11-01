/**
 * Tuning F, second set (14 Oct 2026; arcade-tuning-f-check holds the first set:
 * Breaker, Rally, Tempo, Meteor, Orbit): Jaywalk's smaller walker (crossRev 5), Slice's longer
 * slice (sliceRev 5), Gemstone's 2,800 par (matchupRev 6), Coral Pop's
 * directional torpedo, Grappler's spread stars and Scrumper's per-pin proofs
 * (the last three also have checks of their own).
 *
 *  1. Old rounds: 48 real runs recorded with the code before Tuning F on each
 *     game's then-live revision (scripts/fixtures/arcade-tuning-f2-legacy.json,
 *     scripts/arcade-tuning-f2-legacy.ts) replay through today's server path to
 *     the same score and the same final state, unflagged.
 *  2. New rounds carry the Tuning F stamps and score on the bands; runs
 *     recorded on the new revisions (scripts/fixtures/arcade-tuning-f2-runs.json)
 *     replay to the same score and state.
 *  3. Per game: Jaywalk's walker collides 13 px either side (16 before) on the
 *     same courses; Slice's path runs 620 px (465 before) on the same foods;
 *     Gemstone plays exactly as matchupRev 5 and scores 150 at 2,800; the best
 *     reachable score through the server replay.
 *  4. Intro and "?" help say what changed.
 *
 *   bun scripts/arcade-tuning-f2-check.ts          (TUNING_F2_ONLY=cross,slice,…)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import { TUNING_F2_GAMES, type TuningF2Record } from "./arcade-tuning-f2-legacy";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, type SkillLevel, type SkillProfile } from "./arcade-skill-bands/human";
import { puzzleUsesBands } from "../src/lib/arcade/bandParts";
import { bandPoints, bandTop } from "../src/lib/arcade/scoreBands";
import {
  crossBlocked,
  crossColumnCentreFp,
  crossGameFor,
  crossPlayerHalfFp,
  crossPlayerR,
  CROSS_PLAYER_HALF_FP,
  CROSS_REV_BAND,
  CROSS_REV_SMALL,
  CROSS_REV_STD,
  type CrossLane,
} from "../src/lib/arcade/cross";
import { SLICE_REV_BIG, SLICE_REV_EXPAND,
  sliceClipSegment,
  sliceGameFor,
  sliceMaxPath,
  SLICE_INPUT_BEGIN,
  SLICE_INPUT_SWIPE,
  SLICE_MAX_PATH,
  SLICE_MAX_PATH_V5,
  SLICE_REV_LONG,
  SLICE_REV_TUNEC,
  SLICE_V4_BAND_CURVE,
  type SliceState,
} from "../src/lib/arcade/slice";
import {
  matchupBandParts,
  matchupBusy,
  matchupGameFor,
  MATCHUP_INPUT_SWAP,
  MATCHUP_REV_PAR,
  MATCHUP_REV_WAIT,
  MATCHUP_ROWS,
  MATCHUP_SIZE,
  MATCHUP_V5_BAND_CURVE,
  MATCHUP_V6_BAND_CURVE,
  type MatchupState,
} from "../src/lib/arcade/matchup";
import { encodeMatchupRun, replayMatchupRun } from "../src/lib/duel/matchup";
import { generateBubble, generateCross, generateMatchup, generateSlice, generateSnip, generateSwing } from "../src/lib/duel/arcade.server";
import { BUB_REV_TORPEDO } from "../src/lib/arcade/bubble";
import { SWING_REV_SPREAD } from "../src/lib/arcade/swing";
import { SNIP_REV_EXPAND, SNIP_REV_PROVEN } from "../src/lib/arcade/snip";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { playRevOf } from "./scoring-targets-revs";

/** A flawless player for best-score proofs: quick, never lapses, no timing, aim or judgement error. */
const PERFECT: SkillProfile = { reactionMs: [120, 0], lapse: 0, timingSdMs: 0, aimSdPx: 0, powerSd: 0, mistake: 0, thinkScale: 0.3, judgement: 0, trackLagMs: 30 };

const ONLY = (process.env.TUNING_F2_ONLY ?? "").split(",").filter(Boolean);
const want = (type: string) => ONLY.length === 0 || ONLY.includes(type);
const failures: string[] = [];
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
const section = (name: string) => console.log(`— ${name}`);

/** A skill-band player's run on a revision, sent through the server's encode + replay. */
async function botRun(type: string, rev: number, level: SkillLevel, n: number, profile?: SkillProfile) {
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
    if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
  }
  const score = game.score(state);
  const raw = spec.encode({ seed, claimedScore: score, events: out.events ?? [], inputs: out.taps ?? [], taps: [], endTick: state.tick, checkpoints }, rev, seed);
  return { state, score, raw, seed, result: spec.replay(seed, raw, rev) };
}

/** Replays every run of a fixture and checks score and state. */
function replayFixture(file: string, label: string): Map<string, number> {
  const fixture = JSON.parse(readFileSync(file, "utf8")) as { runs: TuningF2Record[] };
  const per = new Map<string, number>();
  for (const run of fixture.runs) {
    if (!want(run.type)) continue;
    const spec = GAME_BY_TYPE.get(run.type as never)!;
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const result = spec.replay(run.seed, raw, run.rev);
    ok(result.score === run.score && !result.flagged, `${label} ${run.type} ${run.rev} ${run.level}: stored ${run.score}, replays ${result.score}${result.flagged ? " (flagged)" : ""}`);
    ok(fnv(JSON.stringify(result.state)) === run.stateHash, `${label} ${run.type} ${run.rev} ${run.level}: the replayed final state is byte-identical`);
    per.set(run.type, (per.get(run.type) ?? 0) + 1);
  }
  return per;
}

/* ============================== 1. Old rounds ============================== */
section("Old rounds replay and score exactly as before");
{
  const per = replayFixture("scripts/fixtures/arcade-tuning-f2-legacy.json", "old");
  for (const [type] of TUNING_F2_GAMES) if (want(type)) ok((per.get(type) ?? 0) >= 8, `${type}: ${per.get(type) ?? 0} recorded old runs`);
}

/* ======================== 2. Stamps and new-revision runs ======================== */
section("New rounds carry the Tuning F stamps; runs on them replay unchanged");
{
  const stamps: [string, string, number | undefined, number][] = [
    ["cross", "crossRev", playRevOf("cross", generateCross().crossRev), CROSS_REV_SMALL],
    // Taller worlds batch 2 (16 Oct 2026) moved Slice and Coral Pop on to their taller worlds (sliceRev 6, bubbleRev 5); arcade-tuning-g2-check covers them.
    ["slice", "sliceRev", playRevOf("slice", generateSlice().sliceRev), SLICE_REV_LONG],
    ["matchup", "matchupRev", playRevOf("matchup", generateMatchup().matchupRev), MATCHUP_REV_PAR],
    // Their rules are proved by bubble-rev4-check, swing-rev8-check and snip-rev7-check.
    ["bubble", "bubbleRev", playRevOf("bubble", generateBubble().bubbleRev), BUB_REV_TORPEDO],
    ["swing", "swingRev", playRevOf("swing", generateSwing().swingRev), SWING_REV_SPREAD],
    ["snip", "snipRev", playRevOf("snip", generateSnip().snipRev), SNIP_REV_PROVEN],
  ];
  // Taller worlds batch 3 (16 Oct 2026) moved Grappler on to its taller cavern (swingRev 9); arcade-tuning-g3-check covers it.
  // Expansion E6 (25 Oct 2026) moved Coral Pop on to bubbleRev 8 and Gemstone on to matchupRev 9; e6-check covers them.
  // World expansion E5 (25 Oct 2026) moved Slice on again (sliceRev 9); expansion-e5-check covers it.
  // bubbleRev 9 (26 Oct 2026) keeps bubbleRev 8's play with burst credit in the base units.
  // Grappler's 200 expansion (26 Oct 2026) moved Grappler on again (swingRev 13); swing-x200-check covers it. The assault
  // course (27 Oct 2026) moved it on to swingRev 14; swing-assault-check covers it. The swinging course (29 Oct 2026) to
  // swingRev 15; swing-rework-check covers it.
  // The 200-point expansion (26 Oct 2026) moved Scrumper on to snipRev 11; snip-x200-check covers it.
  // x200 (26 Oct 2026) moved Jaywalk on to crossRev 9 (the expansion); cross-x200-check covers it. The arcade scoring
  // standard (29 Oct 2026) moved it on to crossRev 10; arcade-standard-check covers it.
  // Gemstone's phone-test notes (27 Oct 2026) moved it on to matchupRev 10; gemstone-rev10-check covers it.
  // sliceRev 10 (27 Oct 2026, Joe's phone notes) is sliceRev 9 with bigger onions and golden fruit; expansion-e5-check covers it.
  // The arcade scoring standard (29 Oct 2026) moved Coral Pop on to bubbleRev 11; bubble-standard-check covers it.
  // Six goals and six treasures (Nov 2026) moved Gemstone on from matchupRev 11 to 12; gemstone-rev12-check covers it.
  const movedOn: Record<string, number> = { slice: SLICE_REV_BIG, bubble: BUB_REV_TORPEDO + 7, swing: SWING_REV_SPREAD + 7, matchup: 12, snip: SNIP_REV_EXPAND, cross: CROSS_REV_STD };
  for (const [type, field, got, rev] of stamps) {
    if (!want(type)) continue;
    ok(got === (movedOn[type] ?? rev), `${type}: new rounds stamped ${movedOn[type] ?? rev} (got ${got})`);
    ok(puzzleUsesBands({ type, [field]: rev } as never), `${type} ${rev} scores on the bands`);
    ok(GAME_BY_TYPE.get(type as never)?.tunef === rev, `${type}: the skill-band tool measures ${rev} as Tuning F`);
  }
  const per = replayFixture("scripts/fixtures/arcade-tuning-f2-runs.json", "new");
  for (const type of ["cross", "slice", "matchup"]) if (want(type)) ok((per.get(type) ?? 0) >= 8, `${type}: ${per.get(type) ?? 0} recorded runs on the new revision`);
}

/* ================================ 3a. Jaywalk ================================ */
if (want("cross")) {
  section("Jaywalk crossRev 5: a smaller walker on the same courses");
  const band = crossGameFor(CROSS_REV_BAND);
  const small = crossGameFor(CROSS_REV_SMALL);
  let same = true;
  for (let seed = 1; seed <= 6; seed++) {
    const a = small.init(seed * 977);
    const b = band.init(seed * 977);
    same &&= JSON.stringify({ ...a, tunef: undefined }) === JSON.stringify(b) && a.tunef === 1 && b.tunef === undefined;
  }
  ok(same, "same courses, traffic and start as crossRev 4; only the tunef marker is new");
  ok(crossPlayerHalfFp(small.init(5)) === 13 * 256 && crossPlayerHalfFp(band.init(5)) === CROSS_PLAYER_HALF_FP && CROSS_PLAYER_HALF_FP === 16 * 256, "hit box 13 px either side on crossRev 5, 16 px before");
  ok(crossPlayerR(small.init(5)) === 13 && crossPlayerR(band.init(5)) === 16, "the hit flash is drawn at the round's own hit box");
  // A car whose front edge sits 14 px from the walker's centre: a hit with the old box, a miss with the new one.
  const centre = crossColumnCentreFp(6);
  const lane: CrossLane = { dir: 1, speed: 0, period: 400 * 256, blockW: 60 * 256, phase: centre - 74 * 256 } as CrossLane;
  // The car covers [centre − 74, centre − 14) px: 2 px into the old box, 1 px clear of the new one.
  ok(crossBlocked(lane, centre, 0) && !crossBlocked(lane, centre, 0, crossPlayerHalfFp(small.init(5))), "a car 14 px from the centre hits the old walker, misses the new one");
  const touching: CrossLane = { ...lane, phase: centre - 12 * 256 - 60 * 256 } as CrossLane;
  ok(crossBlocked(touching, centre, 0, crossPlayerHalfFp(small.init(5))), "a car 12 px from the centre still hits the new walker");
  // The figure's arms reach 6 + 2 + 3 px plus half the 5.5 px outline: within 2 px of the 13 px box (bounds rule).
  ok(Math.abs(6 + 2 + 3 + 5.5 / 2 - 13) <= 2, "the drawn walker sits within 2 px of the new hit box");
  ok(PUZZLE_INSTRUCTIONS.cross.how.some((h) => /walker/.test(h.action) && /touch/.test(h.detail)), "the \"?\" help says only the walker itself is hit");
  // 150 through the server replay.
  let best = 0;
  for (let n = 0; n < 6 && best < 150; n++) {
    const run = await botRun("cross", CROSS_REV_SMALL, "near", n, PERFECT);
    ok(!run.result.flagged && run.result.score === run.score, `cross ${n}: the server replay agrees (${run.result.score})`);
    best = Math.max(best, run.result.score);
  }
  ok(best === 150, `a flawless player scores 150 on crossRev 5 through the server replay (best ${best})`);
}

/* ================================ 3b. Slice ================================ */
if (want("slice")) {
  section("Slice sliceRev 5: a longer slice");
  const tunec = sliceGameFor(SLICE_REV_TUNEC);
  const long = sliceGameFor(SLICE_REV_LONG);
  const a = long.init(21) as SliceState;
  const b = tunec.init(21) as SliceState;
  ok(JSON.stringify({ ...a, tunef: undefined }) === JSON.stringify(b) && a.tunef === 1 && b.tunec === 1, "same foods, specials, chillies and blade as sliceRev 4");
  ok(SLICE_MAX_PATH === 465 && SLICE_MAX_PATH_V5 === 620 && sliceMaxPath(a) === 620 && sliceMaxPath(b) === 465, "one path runs 620 px (the world's height) on sliceRev 5, 465 px before");
  // One long straight swipe: clipped at 465 before, at 620 now.
  const start = { strokeX: 20, strokeY: 60, strokeLen: 0, strokeActive: 1 };
  const old = sliceClipSegment(start, 20, 60, 20, 760)!;
  const now = sliceClipSegment({ ...start, tunef: 1 }, 20, 60, 20, 760)!;
  ok(old.d === 60 + 465 && now.d === 60 + 620, `a 700 px swipe stops at 465 px before and 620 px now (${old.d - 60}, ${now.d - 60})`);
  // In the sim: the path budget a stroke carries.
  const play = (g: any) => {
    let q = g.step(g.init(21), { t: 1, k: SLICE_INPUT_BEGIN, a: 30, b: 50, c: 0, d: 0 });
    for (let k = 0; k < 8; k++) q = g.step(q, { t: q.tick + 1, k: SLICE_INPUT_SWIPE, a: 30 + k * 40, b: k % 2 ? 600 : 50, c: 30 + (k + 1) * 40, d: k % 2 ? 50 : 600 });
    return q as SliceState;
  };
  ok(play(tunec).strokeLen === 465 && play(long).strokeLen === 620, "the sim enforces each revision's own path budget");
  ok(bandTop(SLICE_V4_BAND_CURVE) === 900, "sliceRev 5 scores on sliceRev 4's curve");
  ok(PUZZLE_INSTRUCTIONS.slice.how.some((h) => h.detail.includes("full height")), "the \"?\" help gives the new length");
  let best = 0;
  for (let n = 0; n < 12 && best < 150; n++) {
    const run = await botRun("slice", SLICE_REV_LONG, "near", n, PERFECT);
    ok(!run.result.flagged && run.result.score === run.score, `slice ${n}: the server replay agrees (${run.result.score})`);
    best = Math.max(best, run.result.score);
  }
  ok(best >= 140, `a flawless player scores near the top on sliceRev 5 through the server replay (best ${best})`);
}

/* ================================ 3c. Gemstone ================================ */
if (want("matchup")) {
  section("Gemstone matchupRev 6: matchupRev 5 play, 150 at 2,800");
  ok(bandTop(MATCHUP_V6_BAND_CURVE) === 2800 && bandPoints(MATCHUP_V6_BAND_CURVE, 2800) === 150 && bandPoints(MATCHUP_V6_BAND_CURVE, 2799) < 150, "150 needs 2,800 match points");
  ok(bandPoints(MATCHUP_V6_BAND_CURVE, 1456) === 125 && bandPoints(MATCHUP_V6_BAND_CURVE, 620) === 70, "125 at 1,456 (1,300 × 1.12), 70 still at 620");
  let never = true;
  for (let u = 0; u <= 3200; u += 7) never &&= bandPoints(MATCHUP_V6_BAND_CURVE, u) <= bandPoints(MATCHUP_V5_BAND_CURVE, u);
  ok(never, "no run scores more on the 2,800 par than on the 2,500 one");
  // Same play: every recorded rev-5 log replays on rev 6 to the same state (plus the marker), scored on the new curve.
  const fixture = JSON.parse(readFileSync("scripts/fixtures/arcade-tuning-f2-legacy.json", "utf8")) as { runs: TuningF2Record[] };
  let samePlay = true;
  let curve = true;
  for (const run of fixture.runs.filter((r) => r.type === "matchup")) {
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const five = replayMatchupRun(run.seed, raw, MATCHUP_REV_WAIT);
    const six = replayMatchupRun(run.seed, raw, MATCHUP_REV_PAR);
    const s5 = five.state as MatchupState;
    const s6 = six.state as MatchupState;
    // The log claims its rev-5 score, so only the checkpoints are compared (no desync).
    samePlay &&= six.desyncTick === null && JSON.stringify({ ...s6, tunef: undefined }) === JSON.stringify(s5) && s6.tunef === 1;
    curve &&= six.score === matchupBandParts(s6).points && six.score === bandPoints(MATCHUP_V6_BAND_CURVE, s6.raw);
  }
  ok(samePlay, "matchupRev 5 logs replay on matchupRev 6 to the same board (no desync)");
  ok(curve, "matchupRev 6 scores those runs on the 2,800 curve");
  // 150 through the server replay: a fast player taking the best swap as soon as the board settles.
  const swaps: [number, number, number, number][] = [];
  for (let r = 0; r < MATCHUP_ROWS; r++)
    for (let c = 0; c < MATCHUP_SIZE; c++) {
      if (c + 1 < MATCHUP_SIZE) swaps.push([r, c, r, c + 1]);
      if (r + 1 < MATCHUP_ROWS) swaps.push([r, c, r + 1, c]);
    }
  let best = 0;
  let bestRaw = 0;
  for (let seed = 1; seed <= 6 && best < 150; seed++) {
    const g = matchupGameFor(MATCHUP_REV_PAR);
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
    const r = replayMatchupRun(seed * 7919, encodeMatchupRun({ seed: seed * 7919, claimedScore: g.score(s), events, endTick: s.tick, checkpoints }), MATCHUP_REV_PAR);
    ok(!r.flagged && r.score === g.score(s), `matchup ${seed}: the server replay agrees (${r.score})`);
    best = Math.max(best, r.score);
    bestRaw = Math.max(bestRaw, s.raw);
  }
  ok(best === 150, `150 is reachable through the server replay (best ${best}, ${bestRaw} match points)`);
  // Expansion E6's matchupRev 9 scores on its own curve (150 at 3,200 before its feature bonus); e6-check covers it.
  // matchupRev 10 (27 Oct 2026, the 90 s run) topped its base curve at 4,200; matchupRev 11 (the arcade scoring standard)
  // pays gems cleared on a straight line to 110, then fixed parts to 200.
  ok(PUZZLE_INSTRUCTIONS.matchup.score.includes("More gems cleared") && PUZZLE_INSTRUCTIONS.matchup.score.includes("make 200"), "the \"?\" help shows the scoring rooms deal (gems cleared, parts to 200)");
}

console.log(failures.length === 0 ? `PASS arcade-tuning-f2-check (${checks} checks)` : `FAIL arcade-tuning-f2-check: ${failures.length} of ${checks} failed`);
for (const f of failures.slice(0, 40)) console.log(`  ✗ ${f}`);
process.exit(failures.length === 0 ? 0 : 1);
