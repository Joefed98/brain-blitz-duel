/**
 * pinball-ladder-check (D5's ladder, 23 Nov 2026; docs/arcade-standard/pinball.md "pinRev 9" and "Levels (D5, 23 Nov
 * 2026)"): Pinball's pinRev 9, Normal's refit and the four-level ladder on the flippers' length.
 *
 *  1. Legacy: every start (pinRev 8 at every level, pinRev 7 and 6) and every run recorded before pinRev 9
 *     (scripts/fixtures/pinball-ladder-legacy.json.gz, scripts/pinball-ladder-legacy-record.ts) starts, replays and grades
 *     exactly as recorded: the server's score and verdict, a digest of its stored extra, the replayed state and checkpoints.
 *  2. The stamp and the pin: rooms and every level deal pinRev 9 from the level's proved list; `pinballPreLadder` deals
 *     pinRev 8 (and `preRetro` pinRev 6); a Normal deal is byte for byte the deal with no level asked; LIVE_BANDS, the
 *     standard's spec, the help, the practice definition, the intro still and the practice stamps follow the dealt stamp.
 *  3. Normal: pinRev 8's game exactly (the same start, the same play tick for tick, its own checksum), on the refitted
 *     lines (table points full at 56,000, jackpots 8 each, ramp combos 8 each); the parts' maximums still sum to 200.
 *  4. The levels as dealt: each level's state is its row of PINBALL_LEVELS (flippers, balls, ball save, gravity,
 *     multiball, lines), the registry mirrors the table, pinRev 8's table is kept for pinRev 8; the flippers are swept at
 *     the level's length (a ball dropped past a shorter bat's tip falls by it); the art draws each
 *     bat at its sim length (the renderers read the same figure).
 *  5. The proof: the deal file rebuilds from its witnesses byte for byte, every dealt seed has one, and every witness (a
 *     sample at default depth, all with CHECKS_FULL=1) scores exactly 200 through the server's grade; on a sample the
 *     flawless player held to the human limits plays exactly the stored witness.
 *  6. The ladder: Joe's ladder test on the recorded 96-deal table (scripts/fixtures/d5-ladder-pinball.json.gz) and a live
 *     re-play of two recorded runs a level and player.
 *
 *   bun scripts/pinball-ladder-check.ts            (CHECKS_FULL=1: every witness)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";
import { gunzipSync } from "node:zlib";
import { PIN_FLIP_LEN, PIN_INPUT_FLIPPERS, PIN_REV_LADDER, PIN_REV_SAVE, PIN_REV_STD, type PinState } from "../src/lib/arcade/pinball";
import { pinballGameForAny, pinballStdParts, pinCheckpointAny, pinFlipLenFp, pinFlipLenOf, PIN_STD_SPEC_V9, PIN_V9_BAND_CURVE, PIN_V9_COMBO_EACH, PIN_V9_FULL_AT, PIN_V9_JACKPOT_EACH, type Pin4State } from "../src/lib/arcade/pinball4";
import { pinballArtGameForAny } from "../src/lib/arcade/pinball4.renderer";
import { drawFlippers } from "../src/lib/arcade/pinball.renderer";
import { stdSpecMax } from "../src/lib/arcade/arcadeStandard";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { PINBALL_LEVELS, PINBALL_LEVELS_V8 } from "../src/lib/arcade/retroLevels";
import * as standardPinball from "../src/lib/arcade/standard/pinball";
import { PINBALL_LEVEL_DEALS } from "../src/lib/duel/pinballLevelDeals.server";
import { replayPinballRun } from "../src/lib/duel/pinball";
import { activeDealPins, DEAL_PINS, withDealOptions } from "../src/lib/duel/dealEra";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { PRACTICE_STAMPS } from "../src/lib/duel/practiceStamps.data";
import { withSeededRandom } from "../src/lib/duel/random";
import type { PuzzleData } from "../src/lib/duel/types";
import { GAME_LEVELS } from "../src/lib/levels/gameLevels";
import type { Level } from "../src/lib/levels/levels";
import { pinballPuzzle } from "../src/puzzles/pinball";
import { digest, PINBALL_LADDER_LEGACY, stableExtra, type PinballLegacyRun } from "./pinball-ladder-legacy-record";
import { checkPinballWitnesses, pinballDealSource, pinballProofLog, PIN_DEAL_FILE, PIN_DEAL_LEVELS, readPinballWitnesses } from "./pinball-level-witness";
import { ladderFixtureVerdicts, replaySample } from "./d5-ladder-lib";

const t0 = Date.now();
let checks = 0;
const failures: string[] = [];
function ok(cond: unknown, label: string): void {
  checks++;
  if (!cond) {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}
const section = (name: string) => console.log(`\n== ${name}`);
const canon = (v: unknown): unknown => (Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().filter((k) => (v as Record<string, unknown>)[k] !== undefined).map((k) => [k, canon((v as Record<string, unknown>)[k])])) : v);
const sorted = (v: unknown) => JSON.stringify(canon(v));
const LEVELS: Level[] = ["normal", "easy", "hard", "expert"];
const FULL = process.env["CHECKS_FULL"] === "1";

/* ============================== 1. Legacy ============================== */
section("pinRev 8 (every level), 7 and 6 start, replay and grade exactly as recorded");
{
  const fixture = JSON.parse(gunzipSync(readFileSync(PINBALL_LADDER_LEGACY)).toString()) as { inits: { rev: number; level: Level; seed: number; digest: string }[]; runs: PinballLegacyRun[] };
  ok(fixture.inits.length === 60 && fixture.runs.length === 48, `the fixture holds 60 starts and 48 runs (${fixture.inits.length}, ${fixture.runs.length})`);
  ok(new Set(fixture.runs.map((r) => `${r.rev}:${r.level}`)).size === 6, "the runs cover pinRev 8 at every level, pinRev 7 and 6");
  let starts = 0;
  for (const i of fixture.inits) if (digest(pinballGameForAny(i.rev, i.level).init(i.seed)) === i.digest) starts++;
  ok(starts === fixture.inits.length, `${starts} of ${fixture.inits.length} recorded starts identical`);
  let same = 0;
  for (const r of fixture.runs) {
    const replay = replayPinballRun(r.seed, r.raw, r.rev, r.level);
    const puzzle = { type: "pinball", seed: r.seed, pinRev: r.rev, ...(r.level !== "normal" ? { level: r.level } : {}) } as unknown as PuzzleData;
    const g = gradeAnswer(puzzle, r.raw, 0);
    const exact = replay.score === r.score && !!replay.flagged === r.flagged && digest(replay.state) === r.state && digest(replay.checkpoints ?? null) === r.checkpoints && g.score === r.grade.score && g.isCorrect === r.grade.isCorrect && digest(stableExtra(g.extra)) === r.grade.extra;
    if (exact) same++;
    else ok(false, `pinRev ${r.rev} ${r.level} seed ${r.seed} ${r.player}: replays to ${r.score} and grades ${r.grade.score} as recorded (got ${replay.score}, ${g.score})`);
  }
  ok(same === fixture.runs.length, `${same} of ${fixture.runs.length} recorded runs identical`);
}

/* ============================== 2. The stamp and the pin ============================== */
section("Rooms and every level deal pinRev 9 from the level's proved list; pinballPreLadder deals pinRev 8");
{
  ok(PIN_REV_LADDER === 9 && PIN_REV_LADDER === PIN_REV_SAVE + 1, "pinRev 9 is one above pinRev 8");
  for (const level of LEVELS) {
    for (const n of [0, 7, 31, 88]) {
      const opts = level === "normal" ? {} : { level };
      const p = withSeededRandom(7000 + n, () => generatePuzzle("pinball", opts as never)) as any;
      ok(p.pinRev === PIN_REV_LADDER && (level === "normal" ? p.level === undefined : p.level === level), `${level} deal ${n}: pinRev 9 at ${p.level ?? "normal"}`);
      ok(PINBALL_LEVEL_DEALS[level].includes(p.seed), `${level} deal ${n}: the seed ${p.seed} is on the level's proved list`);
      const pinned = withSeededRandom(7000 + n, () => withDealOptions({ pins: ["pinballPreLadder"] }, () => generatePuzzle("pinball", opts as never))) as any;
      ok(pinned.pinRev === PIN_REV_SAVE, `${level} deal ${n}: pinballPreLadder deals pinRev 8 (${pinned.pinRev})`);
    }
  }
  ok(withDealOptions({ pins: ["preRetro"] }, () => (generatePuzzle("pinball") as any).pinRev) === PIN_REV_STD, "preRetro still deals pinRev 6");
  ok("pinballPreLadder" in DEAL_PINS && DEAL_PINS.pinballPreLadder.texts === false, "DEAL_PINS has pinballPreLadder (no text rebuild)");
  ok(activeDealPins().length === 0, "nothing left pinned");
  for (const seed of [7, 99, 4242, 123456]) {
    const a = withSeededRandom(seed, () => generatePuzzle("pinball", { bankSeed: seed }));
    const b = withSeededRandom(seed, () => generatePuzzle("pinball", { bankSeed: seed, level: "normal" }));
    ok(JSON.stringify(a) === JSON.stringify(b), `seed ${seed}: a Normal deal is byte for byte the deal with no level asked`);
  }
  ok(LIVE_BANDS.pinball.rev === PIN_REV_LADDER && LIVE_BANDS.pinball.curve === PIN_V9_BAND_CURVE && LIVE_BANDS.pinball.std === PIN_STD_SPEC_V9, "LIVE_BANDS reads pinRev 9, its core line and its spec");
  ok(standardPinball.spec === PIN_STD_SPEC_V9 && PIN_STD_SPEC_V9.rev === PIN_REV_LADDER && stdSpecMax(PIN_STD_SPEC_V9) === 200, "the standard's spec is pinRev 9's, 200 in all");
  const help = JSON.stringify(PUZZLE_INSTRUCTIONS.pinball);
  ok(/56,000/.test(help) && /8 for each jackpot/.test(help) && /8 for a ramp shot straight after another/.test(help), "the help states Normal's lines (56,000, 8 a jackpot, 8 a combo)");
  ok((pinballPuzzle.generate() as any).pinRev === PIN_REV_LADDER, "the practice definition deals pinRev 9");
  ok(/pinballArtGameForAny\(PIN_REV_LADDER\)/.test(readFileSync("src/puzzles/pinball.tsx", "utf8")), "the intro still is drawn on pinRev 9");
  ok(/pinRev=9\b/.test(PRACTICE_STAMPS.pinball ?? ""), `the practice stamps name pinRev 9 (${PRACTICE_STAMPS.pinball})`);
  const art = pinballArtGameForAny(PIN_REV_LADDER);
  ok(art === pinballArtGameForAny(PIN_REV_LADDER) && art !== pinballArtGameForAny(PIN_REV_SAVE) && (art.init(5) as Pin4State).lad === 1, "the stage's art game for pinRev 9 is its own (cached) and starts with the ladder's marker");
  ok(((pinballArtGameForAny(PIN_REV_LADDER, "hard").init(5) as Pin4State).lv?.flipLen ?? 0) === PINBALL_LEVELS.hard.flipLen, "a level's art game carries its flippers");
}

/* ============================== 3. Normal ============================== */
section("Normal: pinRev 8's play exactly, on the refitted lines");
{
  const g8 = pinballGameForAny(PIN_REV_SAVE);
  const g9 = pinballGameForAny(PIN_REV_LADDER);
  ok(g9 === pinballGameForAny(PIN_REV_LADDER, "normal"), "Normal (asked or not) is the same game");
  for (const seed of [1, 99, 4242, 301794028]) {
    const a = g9.init(seed) as Pin4State;
    const { lad, ...rest } = a;
    ok(lad === 1 && sorted(rest) === sorted(g8.init(seed)) && a.lv === undefined, `seed ${seed}: pinRev 9 starts from pinRev 8's exact start, plus lad: 1 (no level)`);
    ok(pinCheckpointAny(a).checksum !== pinCheckpointAny(rest as PinState).checksum, `seed ${seed}: its own checksum (pinRev 8's without the marker)`);
    let s8 = g8.init(seed) as PinState;
    let s9 = a as PinState;
    let x = seed | 1;
    let mask = 0;
    let same = true;
    for (let t = 1; !g8.isOver(s8) && t <= g8.runTicks; t++) {
      x = Math.imul(x ^ (x >>> 13), 0x5bd1e995) >>> 0;
      let ev = null;
      if (t % 9 === 0 && x % 4 !== mask) {
        mask = x % 4;
        ev = { t, k: PIN_INPUT_FLIPPERS, a: mask, b: 0, c: 0, d: 0 };
      }
      s8 = g8.step(s8, ev);
      s9 = g9.step(s9, ev);
      const { lad: _l, ...r9 } = s9 as Pin4State;
      if (sorted(r9) !== sorted(s8)) {
        same = false;
        break;
      }
    }
    ok(same && g9.isOver(s9) === g8.isOver(s8), `seed ${seed}: the same play tick for tick (to tick ${s8.tick})`);
  }
  ok(PIN_V9_FULL_AT === 56_000 && PIN_V9_JACKPOT_EACH === 8 && PIN_V9_COMBO_EACH === 8, "Normal's lines: table points full at 56,000, jackpots 8, ramp combos 8");
  const base = g9.init(4242) as Pin4State;
  const parts = (over: Partial<Pin4State>) => Object.fromEntries((pinballStdParts({ ...base, ...over } as Pin4State) ?? []).map((p) => [p.key, p.points]));
  ok(parts({ points: 56_000 }).core === 130 && parts({ points: 28_000 }).core === 65 && parts({ points: 90_000 }).core === 130, "Table points: 130 at 56,000, a straight line below");
  ok(parts({ jackpots: 1 }).jackpots === 8 && parts({ jackpots: 2 }).jackpots === 15 && parts({ jackpots: 3 }).jackpots === 15, "Jackpots: 8 each, the 15 full at 2");
  ok(parts({ combos: 1 }).combos === 8 && parts({ combos: 2 }).combos === 15 && parts({ combos: 3 }).combos === 15, "Ramp combos: 8 each, the 15 full at 2");
  const full = parts({ points: 56_000, laneSets: 1, multiballs: 1, jackpots: 2, combos: 2 });
  ok(full.core === 130 && full.joulz === 20 && full.multiball === 20 && full.jackpots === 15 && full.combos === 15, "every part full makes 200");
}

/* ============================== 4. The levels ============================== */
section("The levels as dealt: flippers, balls, ball save, gravity, multiball, lines");
{
  for (const level of ["easy", "hard", "expert"] as const) {
    const lv = PINBALL_LEVELS[level];
    ok(sorted(GAME_LEVELS.pinball?.levels?.[level]?.settings) === sorted(lv), `${level}: the registry mirrors the sim's table`);
    const game = pinballGameForAny(PIN_REV_LADDER, level);
    ok(game === pinballGameForAny(PIN_REV_LADDER, level), `${level}: one cached game object`);
    const s = game.init(4242) as Pin4State;
    ok(s.lad === 1 && s.rev8 === 1 && sorted(s.lv) === sorted(lv), `${level}: pinRev 9's marker on pinRev 8's table, the level's row`);
    ok(pinFlipLenOf(s) === lv.flipLen && pinFlipLenFp(s) === (lv.flipLen ?? 0) * 256, `${level}: ${lv.flipLen} px flippers`);
    const parts = Object.fromEntries((pinballStdParts({ ...s, points: lv.fullAt, jackpots: 1, combos: 1 } as Pin4State) ?? []).map((p) => [p.key, p.points]));
    ok(parts.core === 130 && parts.jackpots === Math.min(15, lv.jackpotEach ?? 0) && parts.combos === Math.min(15, lv.comboEach ?? 0), `${level}: its own lines (table points full at ${lv.fullAt}, a jackpot ${lv.jackpotEach}, a combo ${lv.comboEach})`);
  }
  ok(pinFlipLenOf(pinballGameForAny(PIN_REV_LADDER).init(1) as Pin4State) === PIN_FLIP_LEN && PIN_FLIP_LEN === 56, "Normal's flippers are 56 px");
  const lens = [PINBALL_LEVELS.easy.flipLen!, PIN_FLIP_LEN, PINBALL_LEVELS.hard.flipLen!, PINBALL_LEVELS.expert.flipLen!];
  ok(lens.every((l, i) => i === 0 || l < lens[i - 1]!), `the lever: the flippers shorten every level (${lens.join(" / ")} px)`);
  ok(PINBALL_LEVELS.easy.balls >= 3 && PINBALL_LEVELS.expert.balls <= PINBALL_LEVELS.hard.balls && PINBALL_LEVELS.hard.saveS === 0 && PINBALL_LEVELS.expert.saveS === 0, "Hard and Expert add no ball save, Expert no more balls than Hard");
  ok(sorted(PINBALL_LEVELS_V8) === sorted({ easy: { balls: 4, saveS: 10, gravityPct: 85, multiS: 25, fullAt: 50_000 }, hard: { balls: 3, saveS: 0, gravityPct: 110, multiS: 18, fullAt: 61_000 }, expert: { balls: 2, saveS: 0, gravityPct: 120, multiS: 15, fullAt: 66_000 } }), "pinRev 8's table kept for pinRev 8's rounds");
  // The sweep at the level's length: a ball dropped straight down at x is turned aside by the left flipper's tip at rest
  // only where the bat reaches (its tip at 113 + len × cos 30°, plus its 6 px cap and the 8 px ball).
  const bounces = (level: Level, xPx: number) => {
    const game = pinballGameForAny(PIN_REV_LADDER, level);
    const s0 = game.init(4242) as Pin4State;
    let s = { ...s0, live: 1, wait: 0, charge: -1, x: Math.round(xPx * 256), y: 700 * 256, vx: 0, vy: 0, extras: [] } as Pin4State;
    for (let t = 0; t < 60 && s.live; t++) {
      s = game.step(s, null) as Pin4State;
      // A free fall keeps vx 0 exactly (gravity is along y); the sloped, soft bat deflects the ball sideways.
      if (s.vx !== 0 && s.y < 800 * 256) return true;
    }
    return false;
  };
  ok(bounces("normal", 174) && !bounces("hard", 174) && !bounces("expert", 174), "a ball dropped at x 174 hits Normal's 56 px flipper and falls past Hard's 52 px and Expert's 50 px ones");
  ok(bounces("hard", 171.3) && !bounces("expert", 171.3), "at x 171.3 it hits Hard's flipper and falls past Expert's");
  ok(bounces("easy", 178) && !bounces("normal", 178), "at x 178 it hits Easy's 62 px flipper and falls past Normal's");
  // The art: the real flipper painter (drawFlippers, the one the table's art calls) on a blank canvas reaches along each
  // bat to within 2 px of the sim's capsule end (its length plus its 6 px radius), at every level.
  for (const level of LEVELS) {
    const s = pinballGameForAny(PIN_REV_LADDER, level).init(4242) as Pin4State;
    const len = pinFlipLenOf(s);
    const c = createCanvas(390, 700);
    const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    drawFlippers(ctx, s);
    const img = (c.getContext("2d") as any).getImageData(0, 0, 390, 700).data as Uint8ClampedArray;
    const [px, py] = [113, 620];
    const ang = Math.PI / 6;
    let reach = 0;
    for (let d = 0; d < 90; d += 0.25) {
      const x = Math.round(px + Math.cos(ang) * d);
      const y = Math.round(py + Math.sin(ang) * d);
      if (x < 0 || x >= 390 || y < 0 || y >= 700) break;
      if ((img[(y * 390 + x) * 4 + 3] ?? 0) > 64) reach = d;
    }
    ok(Math.abs(reach - (len + 6)) <= 2, `${level}: the left bat is drawn ${reach.toFixed(1)} px along its axis, the sim's capsule ${len + 6} px (within 2)`);
  }
}

/* ============================== 5. The proof ============================== */
section("The proof: every dealt seed's witness, the human-limited flawless player, scores 200 through the server");
{
  const sets = readPinballWitnesses();
  ok(sets.map((s) => s.level).join() === PIN_DEAL_LEVELS.join(), "a witness set for every level");
  ok(readFileSync(PIN_DEAL_FILE, "utf8") === pinballDealSource(sets), `${PIN_DEAL_FILE} rebuilds from the witnesses byte for byte`);
  for (const set of sets) {
    ok(sorted(set.witnesses.map((w) => w.seed)) === sorted(PINBALL_LEVEL_DEALS[set.level]) && set.witnesses.length >= 30, `${set.level}: the dealt list is exactly the ${set.witnesses.length} witnessed seeds (at least 30)`);
  }
  const { bad, replayed } = checkPinballWitnesses(FULL ? undefined : 4);
  ok(bad.length === 0, `${replayed} witnesses replayed through the server's grade at 200 (${bad.slice(0, 5).join("; ")})`);
  for (const set of sets) {
    const w = set.witnesses[Math.floor(set.witnesses.length / 3)]!;
    const log = await pinballProofLog(w.seed, set.level);
    ok(JSON.stringify(log) === JSON.stringify(w.events), `${set.level} seed ${w.seed}: the flawless player held to the human limits plays exactly the stored witness`);
  }
}

/* ============================== 6. The ladder ============================== */
section("Joe's ladder test on the recorded 96-deal table, and a live re-play of it");
{
  for (const [cond, label] of await ladderFixtureVerdicts("pinball")) ok(cond, label);
  for (const [cond, label] of await replaySample("pinball", 2)) ok(cond, label);
}

console.log(`\n${failures.length ? "FAIL" : "PASS"}: ${checks - failures.length} passed, ${failures.length} failed (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
if (failures.length) process.exit(1);
