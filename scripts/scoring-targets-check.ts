/**
 * Scoring targets (18 Oct 2026, docs/scoring-targets.md).
 *
 *  1. The lift: BAND_TARGET_MAP takes 70 / 100 / 125 to 100 / 120 / 135 and keeps
 *     0, 140 and 150; every lifted curve keeps its game's unit knots, starts at
 *     (0, 0), never falls and never scores less than the curve it lifts.
 *  2. Rooms deal the new revision of every arcade band game (Junction stays
 *     practice-only on its old one), the "?" help reads it, and every older
 *     revision's game object is untouched (band 1, its own curve).
 *  3. 176 runs recorded by the skill-band bots on the new revisions
 *     (scripts/fixtures/scoring-targets-runs.json.gz, 8 per game) replay through
 *     the server path unflagged; replayed on the previous revision the same log
 *     ends in the identical state (only `band` differs) and never scores more.
 *     Swish binRev 5 is the exception by design: its spinner is shorter.
 *  4. Swish binRev 5: the bar is 21 px each side of its pivot (24 before), drawn
 *     from the same ends the sim bounces off.
 *  5. Nucleus wordsmithRev 1 and Forage wordHuntRev 1: new rounds are stamped,
 *     stamped rounds score on their curves, unstamped rounds keep 2.5 × and 2 ×.
 *  5b. Bonk whackRev 1: the same play, the score lifted (62 / 102 / 118 / 133 → 100 /
 *     120 / 135 / 145); new rounds stamped, the server replay agrees.
 *  6. Hanoi: the posts stay the tap targets (full-height columns), whatever the
 *     ring thickness.
 *
 *   bun scripts/scoring-targets-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { LIVE_BANDS, type LiveBandGame } from "../src/lib/arcade/liveBands";
import { BAND_SPECS } from "../src/lib/arcade/bandParts";
import { BAND_TARGET_MAP, BAND_TARGET_MARK, bandPoints, bandRetarget, bandTop, type BandCurve } from "../src/lib/arcade/scoreBands";
import { WAV_V6_BAND_CURVE, WAV_V7_BAND_CURVE } from "../src/lib/arcade/wavefront";
import { BINTOSS_SPIN_HALF, BINTOSS_SPIN_HALF_SHORT, binTossGameFor, binTossSpinEnds, BINTOSS_REV_BAND, BINTOSS_REV_TARGET } from "../src/lib/arcade/binToss";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { scoreWordHunt, scoreWordsmith, WORDHUNT_REV_TARGET, WORDHUNT_V1_CURVE, WORDSMITH_REV_TARGET, WORDSMITH_V1_CURVE } from "../src/lib/duel/scoring";
import type { PuzzleType } from "../src/lib/duel/types";
import { whackCheckpoint, whackGameFor, whackLift, whackScore, WHACK_HOLES, WHACK_INPUT_TAP, WHACK_REV_TARGET } from "../src/lib/arcade/whack";
import { encodeWhackRun, replayWhackRun } from "../src/lib/duel/whack";
import { GAMES } from "./arcade-skill-bands/games";
import { STRICT_REVS, TARGET_REVS } from "./scoring-targets-revs";
import { BT_V4_BAND_CURVE } from "../src/lib/arcade/ballTrack";
import { FLIP_V4_BAND_CURVE } from "../src/lib/arcade/flip";
import { INK_V6_BAND_CURVE } from "../src/lib/arcade/inkBridge";
import { MATCHUP_V6_BAND_CURVE } from "../src/lib/arcade/matchup";
import { BUB_V5_BAND_CURVE } from "../src/lib/arcade/bubble";
import { CROSS_BAND_CURVE } from "../src/lib/arcade/cross";
import { RALLY_V6_BAND_CURVE } from "../src/lib/arcade/rally";
import { SNAKE_V6_BAND_CURVE } from "../src/lib/arcade/snake";
import { BINTOSS_BAND_CURVE } from "../src/lib/arcade/binToss";
import { SNIP_V5_BAND_CURVE } from "../src/lib/arcade/snip";
import { HOVER_V5_BAND_CURVE } from "../src/lib/arcade/hover";
import { SKYLINE_BAND_CURVE } from "../src/lib/arcade/skyline";
import { BRK_V6_BAND_CURVE } from "../src/lib/arcade/breaker";
import { TILT_V4_BAND_CURVE } from "../src/lib/arcade/tilt";
import { ORBIT_BAND_CURVE } from "../src/lib/arcade/orbitRev3";
import { BEAT_V6_BAND_CURVE } from "../src/lib/arcade/beat";
import { SLICE_V6_BAND_CURVE } from "../src/lib/arcade/slice";
import { BURST_V4_BAND_CURVE } from "../src/lib/arcade/burst";
import { SWING_V9_BAND_CURVE } from "../src/lib/arcade/swing";
import { BULLSEYE_V4_BAND_CURVE } from "../src/lib/arcade/bullseye";
import { PIN_BAND_CURVE } from "../src/lib/arcade/pinball";

let checks = 0;
const failures: string[] = [];
function ok(cond: unknown, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
function section(title: string): void {
  console.log(`— ${title}`);
}

/** Each lifted game's curve before the lift (the one its previous revision scores on). */
const BEFORE: Record<Exclude<LiveBandGame, "junction">, BandCurve> = {
  balltrack: BT_V4_BAND_CURVE,
  wavefront: WAV_V6_BAND_CURVE,
  flip: FLIP_V4_BAND_CURVE,
  inkbridge: INK_V6_BAND_CURVE,
  matchup: MATCHUP_V6_BAND_CURVE,
  bubble: BUB_V5_BAND_CURVE,
  cross: CROSS_BAND_CURVE,
  rally: RALLY_V6_BAND_CURVE,
  snake: SNAKE_V6_BAND_CURVE,
  bintoss: BINTOSS_BAND_CURVE,
  snip: SNIP_V5_BAND_CURVE,
  hover: HOVER_V5_BAND_CURVE,
  skyline: SKYLINE_BAND_CURVE,
  breaker: BRK_V6_BAND_CURVE,
  tilt: TILT_V4_BAND_CURVE,
  orbit: ORBIT_BAND_CURVE,
  beat: BEAT_V6_BAND_CURVE,
  slice: SLICE_V6_BAND_CURVE,
  burst: BURST_V4_BAND_CURVE,
  swing: SWING_V9_BAND_CURVE,
  bullseye: BULLSEYE_V4_BAND_CURVE,
  pinball: PIN_BAND_CURVE,
};

/* ============================== 1. The lift ============================== */
section("The lift: 70 / 100 / 125 → 100 / 120 / 135; 0, 140 and 150 kept");
{
  const lift = (p: number) => bandPoints(BAND_TARGET_MAP, p);
  ok(lift(0) === 0 && lift(70) === 100 && lift(100) === 120 && lift(125) === 135 && lift(140) === 140 && lift(150) === 150, "the map's anchors");
  for (let p = 1; p <= 150; p++) ok(lift(p) >= lift(p - 1) && lift(p) >= p, `the map never falls and never lowers (${p})`);
  for (const [type, before] of Object.entries(BEFORE) as [Exclude<LiveBandGame, "junction">, BandCurve][]) {
    // The target revision's curve (rooms deal the score-bands revision after it since 19 Oct 2026: scoring-bands-check).
    const after = type === "wavefront" ? WAV_V7_BAND_CURVE : bandRetarget(before);
    ok(JSON.stringify(after.units) === JSON.stringify(type === "wavefront" ? WAV_V7_BAND_CURVE.units : before.units), `${type}: the same unit knots`);
    ok(after.units[0] === 0 && after.points[0] === 0, `${type}: starts at (0, 0)`);
    ok(after.points.at(-1) === before.points.at(-1) && bandTop(after) === bandTop(before), `${type}: the same top (${after.points.at(-1)} at ${bandTop(after)})`);
    const top = bandTop(after);
    const step = Math.max(1, Math.floor(top / 2000));
    let prev = -1;
    let rises = true;
    let never = true;
    for (let u = 0; u <= top; u += step) {
      const a = bandPoints(after, u);
      if (a < prev) rises = false;
      if (a < bandPoints(before, u)) never = false;
      prev = a;
    }
    ok(rises, `${type}: more units never score less`);
    ok(never, `${type}: never below its previous curve for the same units`);
  }
}

/* ============================== 2. Stamps ============================== */
section("Rooms deal the revisions after the target ones (score bands); older revisions untouched");
for (const [type, live] of Object.entries(LIVE_BANDS) as [LiveBandGame, (typeof LIVE_BANDS)[LiveBandGame]][]) {
  const dealt = (generatePuzzle(type as PuzzleType) as unknown as Record<string, unknown>)[live.field];
  ok(dealt === live.rev, `${type}: rooms deal ${live.field} ${live.rev} (got ${String(dealt)})`);
  if (type === "junction") continue;
  // The score-bands revision rooms dealt (before any world expansion, scoring-targets-revs.ts EXPANSION_REVS).
  ok(TARGET_REVS[type]?.[0] === STRICT_REVS[type]! - 1 && TARGET_REVS[type]?.[1] === STRICT_REVS[type]! - 2, `${type}: the target revision follows the one rooms dealt before it (and the score-bands revision follows it)`);
  ok(BAND_SPECS[type] !== undefined, `${type}: a band game`);
}
{
  const spec = (type: string) => GAMES.find((g) => g.type === type)!;
  for (const type of Object.keys(BEFORE)) {
    const s = spec(type);
    const [target, prev] = TARGET_REVS[type as LiveBandGame]!;
    const seed = s.seedFor(0);
    const before = s.gameFor(prev, seed).init(seed) as { band?: number };
    const after = s.gameFor(target, seed).init(seed) as { band?: number };
    ok(before.band === 1, `${type} ${prev}: still band 1 (its own curve)`);
    ok(after.band === BAND_TARGET_MARK, `${type} ${target}: band ${BAND_TARGET_MARK} from the first tick`);
  }
}

/* ============================== 3. Recorded runs ============================== */
section("Runs recorded on the new revisions replay unflagged; the previous revision plays them identically");
{
  const runs = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/scoring-targets-runs.json.gz")).toString()) as { type: string; level: string; n: number; raw: string }[];
  ok(runs.length === 176, `176 recorded runs (got ${runs.length})`);
  const strip = (state: any) => {
    const { band: _band, ...rest } = state as Record<string, unknown>;
    return JSON.stringify(rest);
  };
  const perGame = new Map<string, number>();
  for (const run of runs) {
    const spec = GAMES.find((g) => g.type === run.type)!;
    const [target, prev] = TARGET_REVS[run.type as LiveBandGame]!;
    const seed = spec.seedFor(run.n);
    const after = spec.replay(seed, run.raw, target);
    const tag = `${run.type} ${run.level} #${run.n}`;
    ok(!after.flagged && after.desyncTick === null, `${tag}: replays unflagged on ${target} (${after.reason ?? ""})`);
    ok((after.state as { band?: number }).band === BAND_TARGET_MARK, `${tag}: scored on the lift`);
    if (run.type !== "bintoss") {
      const before = spec.replay(seed, run.raw, prev);
      ok(before.desyncTick === null, `${tag}: no desync on ${prev}`);
      ok(strip(before.state) === strip(after.state), `${tag}: identical final state on ${prev} and ${target}`);
      ok(after.score >= before.score, `${tag}: ${after.score} on ${target} ≥ ${before.score} on ${prev}`);
    }
    perGame.set(run.type, (perGame.get(run.type) ?? 0) + 1);
  }
  for (const type of Object.keys(BEFORE)) ok(perGame.get(type) === 8, `${type}: 8 recorded runs`);
}

/* ============================== 4. Swish spinner ============================== */
section("Swish binRev 5: the spinner an eighth shorter");
{
  ok(BINTOSS_SPIN_HALF === 6_144 && BINTOSS_SPIN_HALF_SHORT === 5_376, "24 px → 21 px each side (12.5 % shorter)");
  let seen = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const old = binTossGameFor(BINTOSS_REV_BAND).init(seed);
    const now = binTossGameFor(BINTOSS_REV_TARGET).init(seed);
    ok(old.spinHalf === undefined && now.spinHalf === BINTOSS_SPIN_HALF_SHORT, `seed ${seed}: only binRev 5 carries the short bar`);
    ok(JSON.stringify({ ...now, spinHalf: undefined, band: undefined }) === JSON.stringify({ ...old, spinHalf: undefined, band: undefined }), `seed ${seed}: the same winds, slides, hoops and spinners`);
    for (let i = 0; i < (now.spinners?.length ?? 0); i++) {
      const spinner = now.spinners![i];
      if (!spinner) continue;
      for (const tick of [0, 37, 90]) {
        const a = binTossSpinEnds(old, i, spinner, tick);
        const b = binTossSpinEnds(now, i, spinner, tick);
        const len = (e: typeof a) => Math.hypot(e.x1 - e.x0, e.y1 - e.y0) / 2 / 256;
        ok(Math.abs(len(a) - 24) < 0.05 && Math.abs(len(b) - 21) < 0.05, `seed ${seed} throw ${i + 1}: half-lengths ${len(a).toFixed(2)} → ${len(b).toFixed(2)} px`);
        ok(Math.abs((a.x0 + a.x1) / 2 - (b.x0 + b.x1) / 2) <= 1 && Math.abs((a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2) <= 1, `seed ${seed} throw ${i + 1}: the same pivot`);
        seen++;
      }
    }
  }
  ok(seen > 100, `${seen} spinner positions compared`);
  const renderer = readFileSync("src/lib/arcade/binTossArt.renderer.ts", "utf8");
  ok(/binTossSpinEnds\(state, index, spinner, state\.tick\)/.test(renderer) && !/BINTOSS_SPIN_HALF/.test(renderer), "the art draws the sim's own bar ends (no length of its own)");
}

/* ============================== 5. Nucleus and Forage ============================== */
section("Nucleus wordsmithRev 1 and Forage wordHuntRev 1");
{
  const smith = generatePuzzle("wordsmith") as any;
  const hunt = generatePuzzle("wordhunt") as any;
  ok(smith.wordsmithRev === WORDSMITH_REV_TARGET && hunt.wordHuntRev === WORDHUNT_REV_TARGET && WORDSMITH_REV_TARGET >= 1 && WORDHUNT_REV_TARGET >= 1, "new rounds are stamped");
  for (let p = 0; p <= 120; p++) {
    ok(scoreWordsmith(p) === Math.min(150, Math.floor(2.5 * p)) && scoreWordHunt(p) === Math.min(150, 2 * p), `unstamped rounds keep 2.5 × / 2 × (${p})`);
    ok(scoreWordsmith(p, 1) === Math.min(150, bandPoints(WORDSMITH_V1_CURVE, p)) && scoreWordHunt(p, 1) === Math.min(150, bandPoints(WORDHUNT_V1_CURVE, p)), `stamped rounds score on the curves (${p})`);
    if (p > 0) ok(scoreWordsmith(p, 1) >= scoreWordsmith(p - 1, 1) && scoreWordHunt(p, 1) >= scoreWordHunt(p - 1, 1), `more points never score less (${p})`);
    ok(scoreWordsmith(p, 1) >= scoreWordsmith(p) && scoreWordHunt(p, 1) >= scoreWordHunt(p), `never below the old formula (${p})`);
  }
  ok(scoreWordsmith(10, 1) === 95 && scoreWordsmith(23, 1) === 122 && scoreWordsmith(34, 1) === 135 && scoreWordsmith(55, 1) === 145 && scoreWordsmith(60, 1) === 150, "Nucleus anchors: 10 → 95, 23 → 122, 34 → 135, 55 → 145, 60 → 150");
  ok(scoreWordHunt(9, 1) === 95 && scoreWordHunt(15, 1) === 120 && scoreWordHunt(24, 1) === 135 && scoreWordHunt(36, 1) === 145 && scoreWordHunt(48, 1) === 150, "Forage anchors: 9 → 95, 15 → 120, 24 → 135, 36 → 145, 48 → 150");
  ok(scoreWordsmith(2, 1) < 10 && scoreWordHunt(4, 1) <= 10, "a couple of lucky random words stay under 10");
  // The grader follows the stored stamp (on the rev-1 puzzle shape; rev 2 maps this score: scoring-bands-check).
  smith.puzzleScoreRev = 1;
  hunt.puzzleScoreRev = 1;
  // Rooms deal wordsmithRev 2 and wordHuntRev 2 since 20 Oct 2026 (scoring-batch2-check); these prove rev 1.
  smith.wordsmithRev = 1;
  hunt.wordHuntRev = 1;
  const words = (smith.words as { word: string; points: number }[]).slice(0, 6);
  const answer = words.map((w) => w.word).join(",");
  const points = words.reduce((s, w) => s + w.points, 0);
  ok(gradeAnswer(smith, answer, 0).score === scoreWordsmith(points, 1), "a stamped Nucleus round grades on the curve");
  const { wordsmithRev: _a, ...oldSmith } = smith;
  ok(gradeAnswer(oldSmith, answer, 0).score === scoreWordsmith(points), "an unstamped Nucleus round grades as before");
  const huntWords = (hunt.words as { word: string; path: number[]; points: number }[]).slice(0, 6);
  const huntAnswer = huntWords.map((w) => `${w.word}:${w.path.join("-")}`).join(",");
  const huntPoints = huntWords.reduce((s, w) => s + w.points, 0);
  ok(gradeAnswer(hunt, huntAnswer, 0).score === scoreWordHunt(huntPoints, 1), "a stamped Forage round grades on the curve");
  const { wordHuntRev: _b, ...oldHunt } = hunt;
  ok(gradeAnswer(oldHunt, huntAnswer, 0).score === scoreWordHunt(huntPoints), "an unstamped Forage round grades as before");
}

/* ============================== 5b. Bonk ============================== */
section("Bonk whackRev 1: the same play, the score lifted");
{
  ok((generatePuzzle("whack") as any).whackRev >= WHACK_REV_TARGET, "new rounds are stamped whackRev 1 or later (2: score bands)");
  ok(whackLift(0) === 0 && whackLift(62) === 100 && whackLift(102) === 120 && whackLift(118) === 135 && whackLift(133) === 145 && whackLift(150) === 150, "the lift's anchors (0 stays 0)");
  for (let p = 1; p <= 150; p++) ok(whackLift(p) >= whackLift(p - 1) && whackLift(p) >= p, `the lift never falls or lowers (${p})`);
  let x = 12345;
  const rnd = (n: number) => {
    x = (Math.imul(x, 1103515245) + 12345) >>> 0;
    return x % n;
  };
  for (let seed = 1; seed <= 12; seed++) {
    const old = whackGameFor(undefined);
    const now = whackGameFor(WHACK_REV_TARGET);
    let a = old.init(seed);
    let b = now.init(seed);
    const events: { t: number; k: number; a: number; b: number; c: number; d: number }[] = [];
    const checkpoints: ReturnType<typeof whackCheckpoint>[] = [];
    const every = 4 + (seed % 5) * 6;
    while (!now.isOver(b) && b.tick < now.runTicks) {
      const t = b.tick + 1;
      const input = t % every === 0 ? { t, k: WHACK_INPUT_TAP, a: rnd(WHACK_HOLES), b: 0, c: 0, d: 0 } : null;
      if (input) events.push(input);
      a = old.step(a, input);
      b = now.step(b, input);
      if (b.tick % 300 === 0) checkpoints.push(whackCheckpoint(b));
    }
    const { tgt: _t, ...rest } = b;
    ok(JSON.stringify(rest) === JSON.stringify(a), `seed ${seed}: identical play`);
    const raw = whackScore(a.hits, a.wrong, a.schedule.total, a.empty, a.bombs);
    ok(old.score(a) === raw && now.score(b) === whackLift(raw), `seed ${seed}: ${raw} → ${now.score(b)}`);
    const replay = replayWhackRun(seed, encodeWhackRun({ seed, claimedScore: now.score(b), events, endTick: b.tick, checkpoints }), WHACK_REV_TARGET);
    ok(!replay.flagged && replay.score === now.score(b), `seed ${seed}: the server replay agrees (${replay.reason ?? "ok"})`);
  }
}

/* ============================== 6. Hanoi ============================== */
section("Hanoi: the posts are the tap targets");
{
  const src = readFileSync("src/puzzles/tower.tsx", "utf8");
  ok(/<button[\s\S]{0,200}onClick=\{\(\) => onPeg\?\.\(peg\)\}[\s\S]{0,200}className=\{`relative flex h-full flex-1 flex-col/.test(src), "each post is a full-height, equal-width button (whatever the ring thickness)");
}

if (failures.length) {
  console.log(`FAIL scoring-targets-check: ${failures.length} of ${checks} checks failed`);
  for (const f of failures.slice(0, 40)) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`PASS scoring-targets-check: ${checks} checks — the lift, the new revisions rooms deal, 176 recorded runs, Swish's shorter spinner, Nucleus and Forage curves, Bonk's lift, Hanoi's posts`);
