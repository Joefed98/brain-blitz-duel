/**
 * flip-rev11-check (3 Nov 2026, docs/arcade-standard/flip.md "flipRev 11"): Roofbound flipRev 11. flipRev 8's course,
 * hazards, checkpoints, speed zones, sweet spots and moves exactly, with no star pickups (no gold stars dealt into the
 * state, the trails drawn but never taken) and the flow streak, scored on the arcade standard: clean time 100 (half
 * seconds survived less 40, 20 s, for each crash a checkpoint saved; full at the minute), perfect landings 60 (7.5 each
 * of the 8 sweet spots), double flips 20 (2.5 each, full at 8) and the flow streak 20 (the longest run of clean jumps, 0.4
 * each, full at 50).
 *
 *  1. Wiring: rooms deal flipRev 11; LIVE_BANDS reads its core line (FLIP_V11_BAND_CURVE: 0 → 0, 120 → 100); ROUND_MAX
 *     200; flipRev 8's 730 px world; flipRev 11 keeps flipRev 8's play for the band-era checks (playRevOf); states carry
 *     flow and std, no gold stars; the help states every part, the 20 s a saved crash costs, the flow streak and the
 *     faint trails; the intro says so in under 90 characters; the intro demo plays only when recorded on flipRev 11; the
 *     HUD shows the flow streak; the PERFECT pop is molten and has no burst.
 *  2. Older stamps unchanged: 56 runs on unstamped and flipRev 2–10 rounds (12 on flipRev 10, the stamp rooms dealt
 *     before, and 12 on flipRev 8, its play), recorded on unmodified main 63261010
 *     (scripts/fixtures/flip-rev11-legacy.json.gz, scripts/flip-rev11-legacy.ts), replay to the same score, flag, final
 *     state and checkpoints, with no flipRev 11 field.
 *  3. The same course and moves: on 60 room seeds flipRev 11's start is flipRev 10's with no gold stars and the flow
 *     fields (the same seeded stream, course, hazards, trails, sweet spots, zones); bot logs at every level played on
 *     both stamps keep the runner's path, side, arc, crashes, saves, double flips and sweet landings identical tick for
 *     tick, while flipRev 11 takes no star or trail star.
 *  4. The rules, scripted: stars and trail stars score nothing; the core's straight line with the saved-crash cost; the
 *     features' fixed amounts and caps; the flow streak recounted independently from every bot run's take-offs,
 *     landings and saves (a save sets it to 0, the flip in the air at a save is not clean, a crash ends it); the
 *     checkpoint checksum folds in the flow counters; at least 1 for a played run, 0 with no input; the reveal's lines.
 *  5. Perfect runs: the stored witness routes (flip-x200-witness) that take every part's maximum score exactly 200
 *     through the server replay on flipRev 11 (256 of 260).
 *  6. Bots: flipRev 11 runs (scripts/fixtures/flip-rev11-runs.json.gz, `--record` to re-record) replay through the
 *     server path to their stored score and state, unflagged, 1–200, parts adding up to the score.
 *
 *   bun scripts/flip-rev11-check.ts [--record]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { hasScorePart } from "../src/lib/duel/scoreList";
import { gunzipSync, gzipSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, ALL_LEVELS } from "./arcade-skill-bands/human";
import { entry, flipTakesAll } from "./arcade-standard/flip";
import type { StdRun } from "./arcade-standard/entry";
import { playRevOf } from "./scoring-targets-revs";
import { digest, type FlipLegacyRecord } from "./flip-rev11-legacy";
import { encodeFlipLog } from "./flip-x200-record";
import { flipTap } from "./flip-x200-plan";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { ROUND_MAX } from "../src/lib/duel/roundMax";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { bandPoints } from "../src/lib/arcade/scoreBands";
import { buildArcadeReveal } from "../src/lib/arcade/reveal";
import { replayFlipRun } from "../src/lib/duel/flip";
import { FLIP_FX } from "../src/lib/arcade/arcadeFxGames.renderer";
import {
  flipCheckpoint,
  flipFlowScore,
  flipFlowUnits,
  flipGameFor,
  flipStarsTaken,
  flipSweetsTaken,
  flipTrailStars,
  flipWorldHFor,
  FLIP_REV_FLOW,
  FLIP_REV_STD,
  FLIP_V11,
  FLIP_V11_BAND_CURVE,
  FLIP_V11_DOUBLES,
  FLIP_V11_SAVE_COST,
  FLIP_V11_STREAK_FULL,
  FLIP_V8_SWEETS,
  FLIP_V8_WORLD_H,
  type FlipState,
} from "../src/lib/arcade/flip";

const RECORD = process.argv.includes("--record");
const LEGACY = "scripts/fixtures/flip-rev11-legacy.json.gz";
const FIXTURE = "scripts/fixtures/flip-rev11-runs.json.gz";
let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond && failures.length < 80) failures.push(label);
};
const spec = GAME_BY_TYPE.get("flip" as never)!;
const v10 = flipGameFor(FLIP_REV_STD);
const v11 = flipGameFor(FLIP_REV_FLOW);
const quiet = <T>(fn: () => T): T => {
  const error = console.error;
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.error = error;
  }
};
const play = (game: typeof v11, seed: number, events: any[], each?: (s: FlipState, prev: FlipState) => void): FlipState => {
  const by = new Map(events.map((e: any) => [e.t, e]));
  let state = game.init(seed) as FlipState;
  while (!game.isOver(state)) {
    const prev = state;
    state = game.step(state, by.get(state.tick + 1) ?? null);
    each?.(state, prev);
  }
  return state;
};
/** The runner's own path and the play's counters: what flipRev 11 must keep from flipRev 10 tick for tick. */
const moves = (s: FlipState) =>
  JSON.stringify([s.tick, s.x, s.side, s.flipT, s.arcN, s.cursor, s.warpY, s.ended, s.rng, s.land, s.chain, s.combos, s.comboPts, s.save, s.saves, s.inv, s.cpPassed, s.cleanCps, s.zonesOk, s.pause, s.lost, s.sweetGot, s.sweetT, s.cracks, s.acted]);

/* 1. Wiring. */
// Rooms deal flipRev 12 since 3 Nov 2026 (the Action polish): flipRev 11's game exactly, dealt from its proved courses
// (flip-deal-check proves the two play and score identically), so flipRev 11's rules here hold for what rooms deal.
ok((generatePuzzle("flip") as any).flipRev === FLIP_REV_FLOW + 1 && flipGameFor(FLIP_REV_FLOW + 1) === flipGameFor(FLIP_REV_FLOW) && FLIP_REV_FLOW === FLIP_REV_STD + 1, "rooms deal flipRev 12, flipRev 11's game (flipRev 10 before 3 Nov 2026)");
ok(LIVE_BANDS.flip.rev === FLIP_REV_FLOW + 1 && LIVE_BANDS.flip.curve === FLIP_V11_BAND_CURVE, "the help reads flipRev 11's core line (dealt as flipRev 12)");
ok(JSON.stringify(FLIP_V11_BAND_CURVE.units) === JSON.stringify([0, 120]) && JSON.stringify(FLIP_V11_BAND_CURVE.points) === JSON.stringify([0, 100]), "the help's curve is the straight line 0 → 0, 120 → 100");
ok(ROUND_MAX.flip === 200, "ROUND_MAX: Roofbound is 200");
ok(flipWorldHFor(FLIP_REV_FLOW) === FLIP_V8_WORLD_H, "flipRev 11 plays in flipRev 8's 730 px world");
ok(playRevOf("flip", FLIP_REV_FLOW) === 8, "flipRev 11 keeps flipRev 8's play (course and moves) for the band-era checks");
{
  const s = v11.init(spec.seedFor(1)) as FlipState;
  ok(s.flow === 1 && s.std === 1 && s.exp === 1 && (s.stars ?? []).length === 0 && s.streak === 0 && s.bestStreak === 0 && s.slip === 0, "flipRev 11 states carry flow and std, no gold stars, the streak at 0");
  ok(!("flow" in (v10.init(spec.seedFor(1)) as FlipState)), "flipRev 10 states carry no flow field");
}
ok(JSON.stringify(FLIP_V11.parts.map((p) => [p.key, p.max, p.of])) === JSON.stringify([["core", 100, 120], ["sweets", 60, FLIP_V8_SWEETS], ["doubles", 20, FLIP_V11_DOUBLES], ["flow", 20, FLIP_V11_STREAK_FULL]]), "parts: clean time 100 (of 120), perfect landings 60 (of 8), double flips 20 (of 8), flow streak 20 (of 50)");
ok(FLIP_V11.parts.reduce((a, p) => a + p.max, 0) === 200 && FLIP_V11_SAVE_COST === 40 && FLIP_V11_DOUBLES === 8 && FLIP_V11_STREAK_FULL === 50, "the parts total 200; a saved crash costs 40 half seconds (20 s)");
{
  const help = PUZZLE_INSTRUCTIONS.flip;
  const score = help.score;
  // Text pass (4 Nov 2026): the help is a list, one line a part, then the total ("A good run (100 points)", "Core 100 and the
  // features 100" and the history word "now" were internal or dated wording); the intro names the bonuses.
  ok(score.includes("Clean time: every half second you last counts, less 20 s for each crash a checkpoint saves; the whole minute with no crash for all of it, up to 100."), `the help states clean time and its line: ${score}`);
  ok(hasScorePart(score, "Perfect landings", 60) && score.includes("7.5 for each landing") && hasScorePart(score, "Double flips", 20) && hasScorePart(score, "Flow streak", 20) && score.endsWith("Total 200."), `the help states every feature and the 200: ${score}`);
  ok(!/gold star|Star trails up to|Time survived/.test(score), "the help no longer pays stars, trails or time survived");
  const all = help.how.map((l) => `${l.action} ${l.detail}`).join(" ");
  ok(/PERFECT/.test(all) && /flow streak/i.test(all) && /clean jump is a flip that lands with no crash saved/.test(all) && /only a guide, a good line/.test(all) && /20 s/.test(all), "the help explains the PERFECT landing, the flow streak, clean jumps, the faint trails and the 20 s");
  const intro = help.how.filter((l) => !l.helpOnly);
  ok(intro.length === 3 && intro.every((l) => `${l.action} ${l.detail}`.length <= 110), "the intro HOW in three short lines");
  ok(!/Grab gold stars/.test(all), "the intro no longer asks for gold stars");
  const line = INTRO_SCORE.flip;
  ok(line.length <= 90 && /without crashing/.test(line) && line.includes("sweet spots") && line.includes("flow") && line.endsWith("Up to 200."), `the intro states the parts and the top in ≤ 90 characters: ${line}`);
  const demo = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
  ok(demo.includes("demo.puzzle.flipRev !== FLIP_REV_FLOW && demo.puzzle.flipRev !== FLIP_REV_DEAL) return null;"), "the intro demo plays only when recorded on flipRev 11 (or 12, the same game)");
  const art = readFileSync("src/lib/arcade/flipArt.renderer.ts", "utf8");
  // The Action HUD (3 Nov 2026): the flow streak as a chip.
  ok(art.includes("if (state.flow) drawFlowHud(ctx, state);") && art.includes('{ label: "FLOW", value: String(streak)'), "the HUD shows the flow streak on flipRev 11");
  const sweet = FLIP_FX.events.find((e) => e.label?.({} as any, 1, 1) === "PERFECT");
  ok(Boolean(sweet && sweet.kind === "pop" && sweet.textOnly && sweet.molten && sweet.count === flipSweetsTaken), "a perfect landing pops a molten PERFECT with no burst (the shared layer's sweet-landing event)");
}
{
  const perfect = (entry.perfect() as StdRun[]).filter((r) => r.score !== 200);
  // Since 3 Nov 2026 the standard module names flipRev 12 (flipRev 11's game, its proved deal), one above flipRev 11.
  ok(entry.type === "flip" && entry.field === "flipRev" && entry.rev === FLIP_REV_FLOW + 1 && entry.before === FLIP_REV_FLOW && FLIP_REV_FLOW === FLIP_REV_STD + 1, "the standard module names flipRev 12 (flipRev 11's game), one above flipRev 11");
  ok(perfect.length === 0, `every perfect witness scores 200 (${perfect.map((r) => `${r.label} ${r.score}`).join(", ")})`);
}

/* 2. Older stamps unchanged (recorded on main before flipRev 11). */
const legacy = JSON.parse(gunzipSync(readFileSync(LEGACY)).toString()) as { recorded: string; runs: FlipLegacyRecord[] };
ok(legacy.runs.length === 56 && legacy.recorded.includes("63261010"), `56 legacy runs recorded on main 63261010 (got ${legacy.runs.length})`);
for (const rev of [null, 2, 3, 4, 5, 6, 7, 9]) ok(legacy.runs.filter((r) => r.rev === rev).length === 4, `4 legacy runs on flipRev ${rev ?? "unstamped"}`);
for (const rev of [8, 10]) ok(legacy.runs.filter((r) => r.rev === rev).length === 12, `12 legacy runs on flipRev ${rev}`);
for (const run of legacy.runs) {
  const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
  const now = quiet(() => spec.replay(run.seed, raw, run.rev));
  const tag = `flipRev ${run.rev ?? "unstamped"} ${run.level} seed ${run.seed}`;
  ok(now.score === run.score, `${tag}: replays to its stored ${run.score} (got ${now.score})`);
  ok(Boolean(now.flagged) === run.flagged, `${tag}: flagged ${run.flagged} as recorded`);
  ok(digest(now.state) === run.digest, `${tag}: identical final state`);
  ok(digest(now.checkpoints) === run.checkpoints, `${tag}: identical checkpoints`);
  ok(now.state.flow === undefined && now.state.streak === undefined, `${tag}: no flipRev 11 field`);
}

/* 3. The same course, the same moves. */
for (let n = 0; n < 60; n++) {
  const seed = spec.seedFor(n);
  const a = v11.init(seed) as FlipState;
  const b = v10.init(seed) as FlipState;
  ok(JSON.stringify(a) === JSON.stringify(v11.init(seed)), `seed ${seed}: the same world twice`);
  const { flow, streak, bestStreak, slip, stars, ...restA } = a;
  const { stars: starsB, ...restB } = b;
  ok(flow === 1 && streak === 0 && bestStreak === 0 && slip === 0 && stars?.length === 0 && (starsB?.length ?? 0) === 10, `seed ${seed}: flipRev 10 deals 10 gold stars, flipRev 11 none`);
  ok(JSON.stringify(restA) === JSON.stringify(restB), `seed ${seed}: otherwise flipRev 10's world (rng, course, hazards, trails, sweet spots, zones)`);
}
const { bot } = await import("./arcade-skill-bands/bots/flip");
let saved = 0;
let sweetRuns = 0;
for (const level of ALL_LEVELS)
  for (let n = 0; n < 3; n++) {
    const seed = spec.seedFor(300 + n);
    // A flipRev 10 player's log (stars, trails and all) played on both stamps.
    const out = bot({ game: v10, seed, rev: FLIP_REV_STD, human: new Human("flip", seed, level), fixes: true } as any);
    const old: string[] = [];
    const end10 = play(v10, seed, out.events ?? [], (s) => old.push(moves(s)));
    let tick = 0;
    let same = true;
    const end11 = play(v11, seed, out.events ?? [], (s) => {
      if (moves(s) !== old[tick++]) same = false;
    });
    ok(same && tick === old.length, `${level} seed ${seed}: a flipRev 10 log moves the same on flipRev 11, tick for tick`);
    ok(flipStarsTaken(end11) === 0 && flipTrailStars(end11).stars === 0, `${level} seed ${seed}: flipRev 11 takes no star or trail star (flipRev 10: ${flipStarsTaken(end10)} stars, ${flipTrailStars(end10).stars} trail stars)`);
    ok(JSON.stringify(flipCheckpoint(end11)) !== JSON.stringify(flipCheckpoint(end10)) || end11.tick < 30, `${level} seed ${seed}: flipRev 11's checksum folds in its own fields`);
    if ((end11.saves ?? 0) > 0) saved++;
    if (flipSweetsTaken(end11) > 0) sweetRuns++;
  }
ok(saved >= 2 && sweetRuns >= 6, `the bot runs include saved crashes (${saved}) and perfect landings (${sweetRuns})`);

/* 4. The rules, scripted. */
{
  const base = { ...(v11.init(spec.seedFor(3)) as FlipState), acted: 1, ended: 1, tick: 3600, endedTick: 3600 };
  ok(v11.score({ ...base, got: 1023, trailGot: [31, 31, 31, 31] }) === v11.score(base), "gold stars and full trails score nothing on flipRev 11");
  let line = true;
  for (let u = 0; u <= 130; u++) {
    const want = Math.trunc((100 * Math.min(u, 120)) / 120);
    if (bandPoints(FLIP_V11_BAND_CURVE, u) !== want) line = false;
  }
  ok(line, "core = trunc(100 × min(clean half seconds, 120) ÷ 120), the help curve's own line");
  const at = (tick: number, ended: number, saves: number) => ({ ...base, tick, ended, endedTick: tick, saves });
  ok(flipFlowUnits(at(3600, 1, 0)) === 120 && flipFlowScore(at(3600, 1, 0)).core === 100, "the whole minute with no crash saved: 120 half seconds, 100");
  ok(flipFlowUnits(at(3600, 1, 1)) === 80 && flipFlowScore(at(3600, 1, 1)).core === 66, "the minute with one crash saved: 80, 66");
  ok(flipFlowUnits(at(3600, 1, 3)) === 0 && flipFlowScore(at(3600, 1, 3)).core === 0, "three saved crashes take all 60 s");
  ok(flipFlowUnits(at(1500, 2, 1)) === 10 && flipFlowUnits(at(1199, 2, 1)) === 0, "crashed at 25 s with one saved: 10; never below 0");
  ok(flipFlowUnits(at(899, 2, 0)) === 29 && flipFlowScore(at(899, 2, 0)).core === 24, "crashed at 15 s, nothing saved: 29 half seconds, 24");
  const f = (sweets: number, combos: number, best: number) => flipFlowScore({ ...at(3600, 1, 0), sweetGot: (1 << sweets) - 1, combos, bestStreak: best }).features;
  ok(JSON.stringify(f(1, 1, 1)) === JSON.stringify({ sweets: 7, doubles: 2, flow: 0 }) && JSON.stringify(f(3, 3, 10)) === JSON.stringify({ sweets: 22, doubles: 7, flow: 4 }), "7.5 a perfect landing, 2.5 a double flip, 0.4 a clean jump in the streak (floored)");
  ok(JSON.stringify(f(8, 8, 50)) === JSON.stringify({ sweets: 60, doubles: 20, flow: 20 }) && JSON.stringify(f(8, 7, 49)) === JSON.stringify({ sweets: 60, doubles: 17, flow: 19 }) && JSON.stringify(f(8, 30, 90)) === JSON.stringify({ sweets: 60, doubles: 20, flow: 20 }), "the caps: 60, 20 and 20, nothing past them");
  ok(v11.score({ ...at(3600, 1, 0), sweetGot: 255, combos: 8, bestStreak: 50 }) === 200, "everything at its maximum: 200");
  ok(v11.score({ ...at(400, 2, 0), acted: 1 }) === 10 && v11.score({ ...at(0, 2, 0), acted: 1 }) === 1 && v11.score({ ...at(0, 2, 0), acted: 0 }) === 0, "10 for 6.7 s (13 half seconds); a played run with nothing scores 1; no input 0");
  let idle = v11.init(spec.seedFor(3)) as FlipState;
  while (!v11.isOver(idle)) idle = v11.step(idle, null);
  ok(v11.score(idle) === 0, "a run with no input scores 0");
  const one = encodeFlipLog(FLIP_REV_FLOW, spec.seedFor(3), [flipTap(1)]);
  const oneR = replayFlipRun(spec.seedFor(3), one.raw, FLIP_REV_FLOW);
  ok(!oneR.flagged && oneR.score >= 1, `one flip, then nothing: at least 1 through the server (${oneR.score})`);
  // The checksum folds in the flow counters.
  const mid = { ...base, ended: 0, tick: 600, streak: 7, bestStreak: 9 };
  ok(flipCheckpoint(mid).checksum !== flipCheckpoint({ ...mid, streak: 8 }).checksum && flipCheckpoint(mid).checksum !== flipCheckpoint({ ...mid, bestStreak: 10 }).checksum && flipCheckpoint(mid).checksum !== flipCheckpoint({ ...mid, slip: 1 }).checksum, "the checkpoint checksum folds in the streak, the best streak and the slip");
  // The reveal: one line per part.
  const st = { ...at(3600, 1, 1), sweetGot: 7, combos: 2, bestStreak: 25 };
  const r = buildArcadeReveal("flip", { state: st, survived: true, survivedSeconds: 60, saves: 1, sweets: 3, sweetsTotal: 8, streak: 25, skill: 37, flow: true, std: true, starsTotal: 0 }, v11.score(st));
  ok(Boolean(r && r.lines.join(" | ") === "60.0 s survived · 1 saved (−20 s) · best streak 25 → 66 | Perfect landings 22 · Double flips 5 · Flow streak 10 +37 | Total → 103" && r.tiles.some((t) => t.label === "Best streak" && t.value === "25") && r.tiles.some((t) => t.label === "Perfect landings" && t.value === "3 / 8") && r.tiles.some((t) => t.label === "Features" && t.value === "+37")), `the reveal states clean time and each feature, and the best streak: ${JSON.stringify(r?.lines)} ${JSON.stringify(r?.tiles)}`);
  ok(v11.score(st) === 66 + 22 + 5 + 10, `one save, 3 perfect landings, 2 double flips, a streak of 25: 66 + 22 + 5 + 10 = 103 (got ${v11.score(st)})`);
}
{
  // The flow streak recounted from each run's take-offs, saves and landings (in the tick's own order: take-off, then a
  // hit saved, then a landing). A save sets the streak to 0, and the flip in the air at a save is not clean.
  let runs = 0;
  let resets = 0;
  let midAir = 0;
  for (const level of ALL_LEVELS)
    for (let n = 0; n < 6; n++) {
      const seed = spec.seedFor(500 + n);
      const out = bot({ game: v11, seed, rev: FLIP_REV_FLOW, human: new Human("flip", seed, level), fixes: true } as any);
      let cur = 0;
      let best = 0;
      let slip = false;
      let good = true;
      play(v11, seed, out.events ?? [], (s, p) => {
        if (s.ended === 2) return;
        if (p.flipT === 0 && s.flipT > 0) slip = false;
        if ((s.saves ?? 0) > (p.saves ?? 0)) {
          if (cur > 0) resets++;
          if (s.flipT > 0 || p.flipT > 0) midAir++;
          cur = 0;
          slip = true;
        }
        if (p.flipT === 1 && s.flipT === 0 && !slip) best = Math.max(best, ++cur);
        if ((s.streak ?? 0) !== cur || (s.bestStreak ?? 0) !== best || Boolean(s.slip) !== slip) good = false;
      });
      ok(good, `${level} seed ${seed}: the flow streak matches the recount on every tick`);
      runs++;
    }
  ok(runs === 42 && resets >= 3, `saved crashes reset a running streak (${resets} times in ${runs} runs; ${midAir} in the air)`);
}

/* 5. Perfect runs through the server replay (the arcade-standard entry checks every witness). */
{
  const witnesses = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/flip-x200-witness.json.gz")).toString()) as { seed: number; taps: number[] }[];
  let full = 0;
  for (const w of witnesses.slice(0, 40)) {
    const { raw, state } = encodeFlipLog(FLIP_REV_FLOW, w.seed, w.taps.map(flipTap));
    if (!flipTakesAll(state)) continue;
    const r = replayFlipRun(w.seed, raw, FLIP_REV_FLOW);
    const parts = flipFlowScore(r.state);
    ok(!r.flagged && r.score === 200 && parts.core === 100 && parts.features.sweets === 60 && parts.features.doubles === 20 && parts.features.flow === 20, `witness seed ${w.seed}: 200 through the server replay, every part at its maximum (got ${r.score})`);
    full++;
  }
  ok(full >= 35, `at least 35 of the first 40 witnesses take every part's maximum (${full})`);
}

/* 6. Bots. */
const LEVELS = ["weak", "average", "good", "great", "near", "elite", "perfect"] as const;
if (RECORD) {
  const runs: any[] = [];
  for (const level of LEVELS)
    for (let n = 0; n < 2; n++) {
      const seed = spec.seedFor(10400 + n);
      const out = bot({ game: v11, seed, rev: FLIP_REV_FLOW, human: new Human("flip", seed, level), fixes: true } as any);
      const { raw } = encodeFlipLog(FLIP_REV_FLOW, seed, out.events ?? []);
      const result = replayFlipRun(seed, raw, FLIP_REV_FLOW);
      runs.push({ level, seed, raw, score: result.score, digest: digest(result.state) });
    }
  writeFileSync(FIXTURE, gzipSync(JSON.stringify({ recorded: "flipRev 11 (no star pickups, the flow streak), 3 Nov 2026", runs })));
  console.log(`wrote ${FIXTURE} (${runs.length} runs)`);
}
const recorded = JSON.parse(gunzipSync(readFileSync(FIXTURE)).toString()) as { runs: any[] };
ok(recorded.runs.length === 14, `14 stored flipRev 11 runs (got ${recorded.runs.length})`);
for (const run of recorded.runs) {
  const now = replayFlipRun(run.seed, run.raw, FLIP_REV_FLOW);
  const tag = `${run.level} seed ${run.seed}`;
  ok(!now.flagged, `${tag}: replays unflagged`);
  ok(now.score === run.score && digest(now.state) === run.digest, `${tag}: replays to its stored ${run.score} (got ${now.score})`);
  ok(now.score >= 1 && now.score <= 200 && now.flow === true && now.std === true && now.starsTotal === 0, `${tag}: played, 1–200, a flipRev 11 result with no stars`);
  const p = flipFlowScore(now.state);
  const sum = p.core + p.features.sweets! + p.features.doubles! + p.features.flow!;
  ok(sum === now.score || (now.score === 1 && sum === 0), `${tag}: the parts add up to the score`);
  ok(p.core <= 100 && p.features.sweets! <= 60 && p.features.doubles! <= 20 && p.features.flow! <= 20, `${tag}: each part within its maximum`);
}

if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  console.log(`FAIL flip-rev11-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS flip-rev11-check: ${checks} checks — wiring, ${legacy.runs.length} legacy runs unchanged, 60 worlds, the same moves as flipRev 10, scripted rules, the flow streak recounted, perfect 200s, ${recorded.runs.length} stored runs`);
