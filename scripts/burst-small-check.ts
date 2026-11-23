/**
 * burst-small-check (D5, 22 Nov 2026; docs/arcade-standard/burst.md "burstRev 14"): Fission's burstRev 14, the middle
 * atoms (Joe, 20 Nov 2026; the polish plan's C1.8).
 *
 *  1. Legacy: every start (burstRev 13 at every level, burstRev 12) and every run recorded before burstRev 14
 *     (scripts/fixtures/burst-small-legacy.json.gz, scripts/burst-small-legacy-record.ts) starts, replays and grades
 *     exactly as recorded: the server's score and verdict, a digest of its stored extra, the replayed state and its
 *     checkpoints.
 *  2. The stamp and the pin: rooms and every level deal burstRev 14 (since 23 Nov 2026, D5's levels folded into burstRev
 *     14: on the seed its level's proved list gives the room seed burstRev 13 drew, burstLevelDeals.server.ts); `burstPreSmall`
 *     deals burstRev 13 exactly as before (and `preRetro` burstRev 11 still); LIVE_BANDS, the practice definition, the intro
 *     still, the intro-demo stop rule and the practice stamps follow the dealt stamp.
 *  3. The rule: atoms 35 / 24 / 15 / 9 px (between burstRev 13's and the original table), a level's size on top (Easy
 *     125 %), burstRev 13's start plus `small: 1` at every level (since 23 Nov 2026 a level's own waves, their golden atoms
 *     and carriers and its lives in place of Normal's: burst-ladder-check proves them), its own checksum; a beam, a bounce and a touch at the new
 *     radius; on burstRev 14 an atom touches the ship at the radius it is drawn at (Easy's size included), while burstRev
 *     13 keeps its own touch.
 *  4. The art: the real renderer (@napi-rs/canvas) draws each atom's solid disc to within 2 px of its collision radius at
 *     Normal, Easy and Hard, across and down, with nothing but its soft glow past it.
 *  5. The parts still sum to 200; a perfect run (the standard's oracle, scripts/burst-small-oracle.ts) on a real deal
 *     scores 200 through gradeAnswer, every part at its maximum (since 23 Nov 2026 on Normal's lines: the wave clears full
 *     at 19 of 35, the golden atoms at 2 of 5); bot runs at every level replay through the server to
 *     the phone's own score.
 *  6. The proof player (the flawless level held to the human limits, scripts/d5-ladder-lib.ts) on 24 Normal deals:
 *     measured and printed (the levels session reads it); every run graded.
 *
 *   bun scripts/burst-small-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import "./retro-render-lib";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createCanvas } from "@napi-rs/canvas";
import {
  burstCheckpoint,
  burstGameFor,
  burstGoldenCount,
  burstRadius,
  burstStdParts,
  burstWorldHFor,
  BURST_CHECKPOINT_INTERVAL,
  BURST_INPUT_FIRE,
  BURST_LIVES,
  BURST_RADIUS,
  BURST_RADIUS_BIG,
  BURST_RADIUS_SMALL,
  BURST_REV_AIM,
  BURST_REV_BIG,
  BURST_REV_SMALL,
  BURST_REV_STRICT,
  BURST_TALL_H,
  BURST_V10_ATOMS,
  BURST_V10_BAND_CURVE,
  BURST_V10_CLEAR_PER_WAVE,
  BURST_V10_PARTS,
  BURST_V14_CLEAR_FULL,
  BURST_V14_GOLD_FULL,
  type BurstState,
} from "../src/lib/arcade/burst";
import { burstArtGameFor } from "../src/lib/arcade/burst.renderer";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { BURST_LEVELS, BURST_LEVELS_SMALL } from "../src/lib/arcade/retroLevels";
import { burstDealSeedV14, BURST_DEAL_V14 } from "../src/lib/duel/burstLevelDeals.server";
import { generateBurst } from "../src/lib/duel/arcade.server";
import { encodeBurstRun, replayBurstRun } from "../src/lib/duel/burst";
import { activeDealPins, DEAL_PIN_NAMES, DEAL_PINS, withDealOptions } from "../src/lib/duel/dealEra";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { demoRevAccepted, SAME_PLAY_DEMO_REVS } from "../src/lib/duel/introDemo.functions";
import { PRACTICE_STAMPS } from "../src/lib/duel/practiceStamps.data";
import { withSeededRandom } from "../src/lib/duel/random";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import type { PuzzleData } from "../src/lib/duel/types";
import type { Level } from "../src/lib/levels/levels";
import { burstPuzzle } from "../src/puzzles/burst";
import { Human } from "./arcade-skill-bands/human";
import { bot as burstBot } from "./arcade-skill-bands/bots/burst";
import { playBurstOracle } from "./burst-small-oracle";
import { ladderLine, measure } from "./d5-ladder-lib";
import { dealAt } from "./level-tune";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
const section = (name: string) => console.log(`\n== ${name}`);
const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);
/** The stored extra without the replay's own wall-clock time (`diag.replayMs`), as the fixture digested it. */
const stableExtra = (v: unknown): unknown => (v == null ? null : JSON.parse(JSON.stringify(v, (k, x) => (k === "replayMs" ? undefined : x))));
/** A value as JSON with every object's keys sorted, at every depth (so key order never matters, and nothing is left out). */
const canon = (v: unknown): unknown => (Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().filter((k) => (v as Record<string, unknown>)[k] !== undefined).map((k) => [k, canon((v as Record<string, unknown>)[k])])) : v);
const sorted = (v: unknown) => JSON.stringify(canon(v));
const FP = 256;
const LEVELS: Level[] = ["normal", "easy", "hard", "expert"];
/** The Normal deal (level-tune's room deal n) the standard's oracle takes to 200 through gradeAnswer, and its seed. */
const PERFECT_DEAL = 3;
const PERFECT_DEAL_SEED = 1893021695;

/* ============================== 1. Legacy ============================== */
section("burstRev 13 (every level) and 12 start, replay and grade exactly as recorded");
{
  const fixture = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/burst-small-legacy.json.gz")).toString()) as {
    inits: { rev: number; level: Level; seed: number; digest: string }[];
    runs: { rev: number; level: Level; seed: number; player: string; raw: string; score: number; flagged: boolean; state: string; checkpoints: string; grade: { score: number; isCorrect: boolean; extra: string } }[];
  };
  ok(fixture.inits.length === 90 && fixture.runs.length === 75, `the fixture holds 90 starts and 75 runs (${fixture.inits.length}, ${fixture.runs.length})`);
  ok(new Set(fixture.runs.map((r) => `${r.rev}:${r.level}`)).size === 5 && fixture.runs.some((r) => r.rev === BURST_REV_BIG && r.level === "easy"), "the runs cover burstRev 13 at every level and burstRev 12");
  for (const i of fixture.inits) ok(digest(burstGameFor(i.rev, i.level).init(i.seed)) === i.digest, `burstRev ${i.rev} ${i.level} seed ${i.seed}: the same start`);
  let same = 0;
  for (const r of fixture.runs) {
    const tag = `burstRev ${r.rev} ${r.level} seed ${r.seed} ${r.player}`;
    const replay = replayBurstRun(r.seed, r.raw, r.rev, r.level);
    const puzzle = { type: "burst", seed: r.seed, burstRev: r.rev, ...(r.level !== "normal" ? { level: r.level } : {}) } as unknown as PuzzleData;
    const g = gradeAnswer(puzzle, r.raw, 0);
    const exact = replay.score === r.score && !!replay.flagged === r.flagged && digest(replay.state) === r.state && digest(replay.checkpoints ?? null) === r.checkpoints && g.score === r.grade.score && g.isCorrect === r.grade.isCorrect && digest(stableExtra(g.extra)) === r.grade.extra;
    if (exact) same++;
    ok(exact, `${tag}: replays to ${r.score} with the same state and grades to ${r.grade.score} with the same extra (got ${replay.score}, graded ${g.score})`);
  }
  console.log(`  ${same} of ${fixture.runs.length} recorded runs identical`);
}

/* ============================== 2. The stamp and the pin ============================== */
section("Rooms and every level deal burstRev 14; burstPreSmall deals burstRev 13");
{
  ok(BURST_REV_SMALL === 14 && BURST_REV_SMALL === BURST_REV_BIG + 1, "burstRev 14 is one above burstRev 13");
  ok(generateBurst().burstRev === BURST_REV_SMALL && (generatePuzzle("burst") as any).burstRev === BURST_REV_SMALL, "rooms deal burstRev 14");
  for (const level of ["easy", "hard", "expert"] as const) {
    const p = generatePuzzle("burst", { level }) as any;
    ok(p.burstRev === BURST_REV_SMALL && p.level === level, `${level}: the level deal is burstRev 14 (${p.burstRev}, ${p.level})`);
  }
  ok("burstPreSmall" in DEAL_PINS && DEAL_PINS.burstPreSmall.texts === false && DEAL_PIN_NAMES.at(-1) === "burstPreSmall", "DEAL_PINS ends with burstPreSmall (no text rebuild)");
  for (const level of LEVELS) {
    for (const n of [0, 5, 31]) {
      const opts = level === "normal" ? {} : { level };
      const live = withSeededRandom(9000 + n, () => generatePuzzle("burst", opts as never)) as any;
      const pinned = withSeededRandom(9000 + n, () => withDealOptions({ pins: ["burstPreSmall"] }, () => generatePuzzle("burst", opts as never))) as any;
      const { burstRev: a, seed: sa, ...restLive } = live;
      const { burstRev: b, seed: sb, ...restPinned } = pinned;
      // Since 23 Nov 2026 (D5's levels folded into burstRev 14): the live deal's seed is the one its level's proved list
      // gives the room seed burstRev 13 drew (burstDealSeedV14), the rest of the deal the same.
      const list = BURST_DEAL_V14[level as "normal"];
      ok(a === BURST_REV_SMALL && b === BURST_REV_BIG && sa === burstDealSeedV14(sb, level) && list.includes(sa) && sorted(restLive) === sorted(restPinned), `${level} deal ${n}: burstPreSmall deals burstRev 13 on the room seed, burstRev 14 that seed's proved one (${a} → ${b}, seed ${sa} / ${sb})`);
    }
  }
  ok(withDealOptions({ pins: ["preRetro"] }, () => (generatePuzzle("burst") as any).burstRev) === BURST_REV_AIM, "preRetro still deals burstRev 11");
  ok(withDealOptions({ pins: ["preRetro", "burstPreSmall"] }, () => (generatePuzzle("burst") as any).burstRev) === BURST_REV_AIM, "preRetro wins over burstPreSmall (burstRev 11)");
  ok(activeDealPins().length === 0, "nothing left pinned");
  ok(LIVE_BANDS.burst.rev === BURST_REV_SMALL && LIVE_BANDS.burst.curve === BURST_V10_BAND_CURVE && LIVE_BANDS.burst.strictRev === BURST_REV_STRICT && roundMaxFor("burst") === 200, "LIVE_BANDS reads burstRev 14 (burstRev 10's core line, the same strict revision); ROUND_MAX 200");
  ok((burstPuzzle.generate() as any).burstRev === BURST_REV_SMALL, "the practice definition deals burstRev 14");
  const page = readFileSync("src/puzzles/burst.tsx", "utf8");
  ok(/game=\{burstArtGameFor\(BURST_REV_SMALL\)\}/.test(page) && /worldH=\{burstWorldHFor\(BURST_REV_SMALL\)\}/.test(page), "the intro still is drawn on burstRev 14");
  ok(JSON.stringify(SAME_PLAY_DEMO_REVS.burst) === JSON.stringify([BURST_REV_SMALL]) && demoRevAccepted("burst", BURST_REV_SMALL) && !demoRevAccepted("burst", BURST_REV_BIG), "only an intro demo recorded on burstRev 14 plays (burstRev 13's stopped)");
  ok(/burstRev=14\b/.test(PRACTICE_STAMPS.burst ?? ""), `the practice stamps name burstRev 14 (${PRACTICE_STAMPS.burst})`);
  ok(burstWorldHFor(BURST_REV_SMALL) === BURST_TALL_H && burstWorldHFor(BURST_REV_SMALL) === burstWorldHFor(BURST_REV_BIG), "burstRev 14 plays in burstRev 13's 390 × 650 world");
  const art14 = burstArtGameFor(BURST_REV_SMALL);
  ok(art14 !== burstArtGameFor(BURST_REV_BIG) && art14 === burstArtGameFor(BURST_REV_SMALL) && (art14.init(5) as BurstState).small === 1, "the stage's art game for burstRev 14 is its own (cached) and starts with the middle atoms");
  ok((burstArtGameFor(BURST_REV_SMALL, "easy").init(5) as BurstState).lv?.sizePct === BURST_LEVELS.easy.sizePct, "the stage's art game for a burstRev 14 level carries the level");
}

/* ============================== 3. The rule ============================== */
section("The middle atoms: the table, the levels, the start, the checksum, beams, bounces and touches");
{
  ok(JSON.stringify(BURST_RADIUS_SMALL) === JSON.stringify([35, 24, 15, 9]), "atoms 35 / 24 / 15 / 9 px");
  ok(BURST_RADIUS_SMALL.every((r, i) => r > BURST_RADIUS[i]! && r < BURST_RADIUS_BIG[i]!), "every size between the original table and burstRev 13's");
  for (let i = 0; i < 4; i++) {
    ok(burstRadius({ big: 1, small: 1 }, i) === BURST_RADIUS_SMALL[i] && burstRadius({ small: 1 }, i) === BURST_RADIUS_SMALL[i], `size ${i}: burstRadius reads burstRev 14's table`);
    ok(burstRadius({ big: 1 }, i) === BURST_RADIUS_BIG[i] && burstRadius({}, i) === BURST_RADIUS[i], `size ${i}: burstRev 13's and the original tables unchanged`);
  }
  for (const level of LEVELS) {
    const g13 = burstGameFor(BURST_REV_BIG, level);
    const g14 = burstGameFor(BURST_REV_SMALL, level);
    ok(g14.runTicks === g13.runTicks, `${level}: the run is burstRev 13's length`);
    const pct = level === "normal" ? 100 : BURST_LEVELS[level].sizePct;
    const s = g14.init(4242) as BurstState;
    const want = BURST_RADIUS_SMALL.map((r) => (pct === 100 ? r : Math.trunc((r * pct) / 100)));
    ok(want.every((r, i) => burstRadius(s, i) === r), `${level}: the atoms are ${want.join(" / ")} px (the level's ${pct} %)`);
    for (const seed of [1, 99, 4242, 330123215]) {
      const a = g14.init(seed) as BurstState;
      const b = g13.init(seed) as BurstState;
      // Since 23 Nov 2026 (D5's levels folded into burstRev 14): a level's run starts with its own waves, their golden atoms
      // and carriers, its settings and lives (burst-ladder-check proves them); everything else is burstRev 13's start.
      const own = level === "normal" ? {} : { waves: a.waves, goldens: a.goldens, carriers: a.carriers, gDue: a.gDue, lv: a.lv, lives: a.lives };
      const { small, ...rest } = a;
      const { big, ...rest13 } = { ...b, ...own };
      ok(small === 1 && big === 1 && a.big === undefined && sorted(rest) === sorted(rest13), `${level} seed ${seed}: burstRev 14 starts from burstRev 13's exact start, its size marker small: 1 in place of big: 1${level === "normal" ? "" : " (the level's own waves and lives)"}`);
      ok(burstCheckpoint(a).checksum !== burstCheckpoint(b).checksum && burstCheckpoint(rest as BurstState).checksum === burstCheckpoint(rest13 as BurstState).checksum, `${level} seed ${seed}: its own checksum (burstRev 13's without either marker)`);
      ok(level === "normal" ? a.lives === b.lives && a.waves.length === b.waves.length : a.lives === BURST_LEVELS_SMALL[level].lives && a.waves.length === b.waves.length, `${level} seed ${seed}: the same lives and waves${level === "normal" ? "" : " count (the level's own lives)"}`);
    }
  }
  ok(BURST_LEVELS.easy.sizePct === 125 && BURST_LEVELS.hard.sizePct === 100 && BURST_LEVELS.expert.sizePct === 100, "the levels' sizes unchanged: Easy 125 %, Hard and Expert 100 %");

  // A beam: 1 px outside the middle radius misses on burstRev 14 and hits on burstRev 13; on the radius it hits.
  const g13 = burstGameFor(BURST_REV_BIG);
  const g14 = burstGameFor(BURST_REV_SMALL);
  for (let size = 0; size < 4; size++) {
    const beam = (game: typeof g14, off: number) => {
      const base = game.init(4242) as BurstState;
      const ball = { size, x: 200 * FP, y: 300 * FP, vx: 0, vy: 0 };
      const st = { ...base, balls: [ball], shots: [{ x: 200 * FP + off * FP, top: 300 * FP, short: 0 }], freeze: 1_000, invuln: 1_000 } as BurstState;
      return (game.step(st, null) as BurstState).hits > base.hits;
    };
    const r = BURST_RADIUS_SMALL[size]!;
    ok(!beam(g14, r + 1) && beam(g13, r + 1), `size ${size}: a beam ${r + 1} px off misses on burstRev 14 and hits on burstRev 13`);
    ok(beam(g14, r), `size ${size}: a beam ${r} px off hits on burstRev 14`);
  }
  // A bounce: the atom's bottom meets the floor at the middle radius.
  {
    const base = g14.init(77) as BurstState;
    const floor = BURST_TALL_H;
    const st = { ...base, balls: [{ size: 0, x: 200 * FP, y: (floor - BURST_RADIUS_SMALL[0] - 1) * FP, vx: 0, vy: 4 * FP }], shots: [], invuln: 1_000 } as BurstState;
    const after = g14.step(st, null) as BurstState;
    ok(after.balls[0]!.y === (floor - BURST_RADIUS_SMALL[0]) * FP && after.balls[0]!.vy < 0, `an L atom bounces with its centre ${BURST_RADIUS_SMALL[0]} px above the floor`);
  }
  // A touch: an atom level with the ship's middle, d px right of its box (24 × 36), touches iff d ≤ its radius.
  {
    const touch = (rev: number, level: Level, size: number, d: number): boolean => {
      const game = burstGameFor(rev, level);
      const base = game.init(77) as BurstState;
      const floor = BURST_TALL_H;
      const st = { ...base, x: 200 * FP, targetX: 200 * FP, balls: [{ size, x: (212 + d) * FP, y: (floor - 18) * FP, vx: 0, vy: 0 }], shots: [], icons: [], freeze: 1_000, invuln: 0, shield: 0, gn: -1 } as BurstState;
      return (game.step(st, null) as BurstState).lives < st.lives;
    };
    for (let size = 0; size < 4; size++) {
      const r = BURST_RADIUS_SMALL[size]!;
      ok(touch(BURST_REV_SMALL, "normal", size, r) && !touch(BURST_REV_SMALL, "normal", size, r + 1), `size ${size}: on burstRev 14 an atom ${r} px from the ship touches it, ${r + 1} px does not`);
      ok(touch(BURST_REV_BIG, "normal", size, r + 1) === (r + 1 <= BURST_RADIUS_BIG[size]!), `size ${size}: burstRev 13 keeps its own touch (${BURST_RADIUS_BIG[size]} px)`);
      const easy = Math.trunc((r * BURST_LEVELS.easy.sizePct) / 100);
      ok(touch(BURST_REV_SMALL, "easy", size, easy) && !touch(BURST_REV_SMALL, "easy", size, easy + 1), `size ${size}: on burstRev 14 Easy an atom touches at the radius it is drawn at (${easy} px)`);
      ok(!touch(BURST_REV_BIG, "easy", size, BURST_RADIUS_BIG[size]! + 1) && touch(BURST_REV_BIG, "easy", size, BURST_RADIUS_BIG[size]!), `size ${size}: burstRev 13 Easy still touches at the table's own ${BURST_RADIUS_BIG[size]} px (unchanged)`);
    }
  }
}

/* ============================== 4. The art ============================== */
section("The renderer draws each atom to within 2 px of its collision radius");
{
  for (const level of ["normal", "easy", "hard"] as const) {
    const game = burstGameFor(BURST_REV_SMALL, level);
    const art = burstArtGameFor(BURST_REV_SMALL, level);
    const base = game.init(77) as BurstState;
    for (let size = 0; size < 4; size++) {
      const mk = (withBall: boolean): BurstState => ({ ...base, tick: 400, popTick: -1000, wave: 1, balls: withBall ? [{ size, x: 195 * FP, y: 330 * FP, vx: 0, vy: 0 }] : [], shots: [], icons: [], invuln: 0, gn: -1 }) as BurstState;
      const frame = (st: BurstState) => {
        const c = createCanvas(390, BURST_TALL_H);
        art.draw(c.getContext("2d") as unknown as CanvasRenderingContext2D, st, { width: 390, height: BURST_TALL_H });
        return c.getContext("2d").getImageData(0, 0, 390, BURST_TALL_H).data;
      };
      const empty = frame(mk(false));
      const full = frame(mk(true));
      const r = burstRadius(mk(true), size);
      const diff = (x: number, y: number) => {
        const i = (y * 390 + x) * 4;
        return Math.max(Math.abs(full[i]! - empty[i]!), Math.abs(full[i + 1]! - empty[i + 1]!), Math.abs(full[i + 2]! - empty[i + 2]!));
      };
      for (const [dx, dy, dir] of [[1, 0, "right"], [-1, 0, "left"], [0, 1, "down"], [0, -1, "up"]] as const) {
        let edge = -1;
        let past = 0;
        for (let k = 0; k <= r + 8; k++) {
          // The pixel whose far side is k + 1 px from the centre (its centre at k + 0.5).
          const x = dx > 0 ? 195 + k : dx < 0 ? 194 - k : 195;
          const y = dy > 0 ? 330 + k : dy < 0 ? 329 - k : 330;
          const v = diff(x, y);
          if (v >= 64) edge = k + 1;
          if (k + 1 > r + 2) past = Math.max(past, v);
        }
        ok(Math.abs(edge - r) <= 2, `${level} size ${size} ${dir}: the solid disc ends ${edge} px out, its collision radius ${r} px`);
        ok(past <= 16, `${level} size ${size} ${dir}: nothing but the soft glow past ${r + 2} px (max ${past})`);
      }
    }
  }
  const src = readFileSync("src/lib/arcade/burst.renderer.ts", "utf8");
  ok(/const r = burstRadius\(state, ball\.size\);/.test(src), "the renderer sizes every atom with burstRadius(state, …), the sim's own radius");
}

/* ============================== 5. Parts, a perfect run, the server replay ============================== */
section("The parts sum to 200; a perfect run on a real deal scores 200 through gradeAnswer; bots replay at every level");
{
  ok(BURST_V10_PARTS.core + BURST_V10_PARTS.clear + BURST_V10_PARTS.gold === 200, "the parts' maxima add up to 200 (140 + 35 + 25)");
  // Since 23 Nov 2026 (Normal's deal a proved list): deal PERFECT_DEAL of level-tune's room deals, on the seed
  // PERFECT_DEAL_SEED (found by `bun scripts/burst-small-oracle.ts --dealt`).
  const puzzle = dealAt("burst", "normal", PERFECT_DEAL);
  const seed = (puzzle as any).seed as number;
  ok(seed === PERFECT_DEAL_SEED && (puzzle as any).burstRev === BURST_REV_SMALL, `deal ${PERFECT_DEAL} is burstRev 14 on seed ${PERFECT_DEAL_SEED} (${(puzzle as any).burstRev}, ${seed})`);
  const { raw, state } = playBurstOracle(seed, BURST_REV_SMALL);
  const g = gradeAnswer(puzzle, raw, 0);
  const replay = replayBurstRun(seed, raw, BURST_REV_SMALL);
  const p = burstStdParts(replay.state);
  ok(g.score === 200 && replay.score === 200 && !replay.flagged, `the oracle's run scores 200 through gradeAnswer and the server replay (${g.score}, ${replay.score})`);
  ok(p.core === BURST_V10_PARTS.core && p.clear === BURST_V10_PARTS.clear && p.gold === BURST_V10_PARTS.gold && p.lives === 0 && p.misses === 0, `every part at its maximum, no penalty (${JSON.stringify(p)})`);
  // Since 23 Nov 2026 (Normal's lines): the wave clears full at 19 of the 35 wave-clear points, the golden atoms at 2.
  ok(state.done === 1 && state.lives === BURST_LIVES && state.hits === BURST_V10_ATOMS && burstGoldenCount(state) >= BURST_V14_GOLD_FULL && (state.clearPts ?? 0) >= BURST_V14_CLEAR_FULL && (state.clearPts ?? 0) <= BURST_V10_CLEAR_PER_WAVE * 5, "a complete run: 87 atoms, the wave clears and golden atoms full, no life lost");
  // The same oracle on burstRev 13's standard seed scores 200 on burstRev 13 (a faithful copy of the standard's oracle).
  const old = playBurstOracle(489736026, BURST_REV_BIG);
  ok(replayBurstRun(489736026, old.raw, BURST_REV_BIG).score === 200, "the oracle copy scores 200 on burstRev 13's standard seed (489736026), as the standard entry does");
  // Bot runs at every level replay through the server to the phone's own score.
  for (const level of LEVELS) {
    const game = burstGameFor(BURST_REV_SMALL, level);
    for (const skill of ["weak", "average", "elite"] as const) {
      for (const s0 of [7, 10007]) {
        const out = burstBot({ game: game as any, seed: s0, rev: BURST_REV_SMALL, human: new Human("burst", s0, skill), fixes: true });
        const events = (out.events ?? []) as ArcadeInputEvent[];
        const by = new Map(events.map((e) => [e.t, e]));
        let s = game.init(s0) as BurstState;
        const checkpoints: unknown[] = [];
        while (!game.isOver(s) && s.tick < game.runTicks) {
          s = game.step(s, by.get(s.tick + 1) ?? null) as BurstState;
          if (s.tick % BURST_CHECKPOINT_INTERVAL === 0) checkpoints.push(burstCheckpoint(s));
        }
        const claimed = game.score(s);
        const r = encodeBurstRun({ seed: s0, claimedScore: claimed, events, endTick: s.tick, checkpoints } as never);
        const res = replayBurstRun(s0, r, BURST_REV_SMALL, level);
        const pz = { type: "burst", seed: s0, burstRev: BURST_REV_SMALL, ...(level !== "normal" ? { level } : {}) } as unknown as PuzzleData;
        const gr = gradeAnswer(pz, r, 0);
        ok(!res.flagged && res.score === claimed && gr.score === claimed && claimed >= 1 && claimed <= 200, `${level} ${skill} seed ${s0}: replays and grades to the phone's ${claimed} (replay ${res.score}, graded ${gr.score})`);
      }
    }
  }
  // Doing nothing scores 0; a single shot scores at least 1.
  {
    let s = g14Idle();
    ok(burstGameFor(BURST_REV_SMALL).score(s) === 0, "doing nothing scores 0");
    const game = burstGameFor(BURST_REV_SMALL);
    s = game.init(3) as BurstState;
    s = game.step(s, { t: 1, k: BURST_INPUT_FIRE, a: 0, b: 1, c: 0, d: 0 }) as BurstState;
    while (!game.isOver(s) && s.tick < game.runTicks) s = game.step(s, null) as BurstState;
    ok(game.score(s) >= 1, `a run with one shot scores at least 1 (${game.score(s)})`);
  }
}
function g14Idle(): BurstState {
  const game = burstGameFor(BURST_REV_SMALL);
  let s = game.init(11) as BurstState;
  while (!game.isOver(s) && s.tick < game.runTicks) s = game.step(s, null) as BurstState;
  return s;
}

/* ============================== 6. The proof player ============================== */
section("The proof player (flawless under the human limits) on 24 Normal deals");
{
  const { row, runs } = await measure("burst", "normal", "proof", 24);
  console.log(`  ${ladderLine(row)}`);
  ok(row.runs === 24 && row.dealt === "normal" && runs.every((r) => r.score >= 1 && r.score <= 200), "24 Normal deals, every run graded between 1 and 200");
}

if (failures.length) {
  console.log(`\nFAIL burst-small-check: ${failures.length} of ${checks} checks failed`);
  for (const f of [...new Set(failures)].slice(0, 40)) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`\nPASS burst-small-check: ${checks} checks — burstRev 13 and 12 replay and grade as recorded; burstRev 14 dealt (burstPreSmall deals 13); the middle atoms collide, touch and draw at one radius; a perfect deal at 200`);
