/**
 * Score bands check (19 Oct 2026, docs/scoring-targets.md): Joe's bands (perfect 150 only, near perfect 130–149,
 * great 110–129, good 90–109, decent 80–89, average 60–79, smoothly down to 0) on every active game.
 *
 *   1. Arcade (band 3): every live band game's base curve has its strict row; each strict curve starts at (0, 0),
 *      rises, keeps its base's top; rooms deal the strict revisions; their states carry band 3 from the first tick
 *      and the target revisions before them still band 2.
 *   2. Recorded arcade runs (scripts/fixtures/scoring-bands-runs.json.gz, 8 per game on the strict revisions):
 *      replay unflagged to the stored score; the target revision before replays the same log to the identical
 *      final state (only `band` differs), so the new revisions change the score and nothing else.
 *   3. Engine games (Tenfall tenRev 2, Mixed Signals clashRev 6, Bonk whackRev 2, Pull! clayRev 7, Letterfall
 *      wordfallRev 3): rooms deal the stamps; recorded answers grade to their stored scores; each map starts at 0,
 *      rises and gives 150 only at the top; the same answer under the previous stamp scores the old way.
 *   4. Puzzles (puzzleScoreRev 2): every rev-2 game has knots that start at (0, 0), rise, end at 150 and give half
 *      progress more than 0; every finish beats every unfinished run; recorded answers grade to their stored
 *      scores, equal to the knots at their result, and under rev 1 to the rev-1 score; random and spam answers
 *      (strategies the fairness audit does not count as real play) score at most 10; doing nothing scores 0.
 *   5. Safe Cracker's rev-2 draft (dials left standing count as progress, never as a try); the "?" help numbers.
 *
 *   bun scripts/scoring-bands-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { isD4Type } from "../src/lib/duel/depth4/stamps";
import { d4Help } from "../src/lib/duel/depth4/text";
import { generateMazeClassic } from "../src/lib/duel/maze.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { LIVE_BANDS, liveStrictRev, type LiveBandGame } from "../src/lib/arcade/liveBands";
import { BAND_STRICT_MARK, BAND_TARGET_MARK, bandHasStrict, bandMapTotal, bandStrict, bandTop, type BandCurve } from "../src/lib/arcade/scoreBands";
import { BASES } from "./arcade-bands-fit";
import { GAMES } from "./arcade-skill-bands/games";
import { STRICT_REVS, TARGET_REVS } from "./scoring-targets-revs";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { rev2KnotsFor, rev2KnotsForPuzzle, REV2_DEALT_KEY, REV2_IDENTITY_KNOTS, rev2Points, REV2_FINISH_GAMES, REV2_OPEN_GAMES, PUZZLE_SCORE_REV_BANDS } from "../src/lib/duel/puzzleScoreRev2";
import { PUZZLE_REV2_KNOTS } from "../src/lib/duel/puzzleBands.data";
import { puzzleScoreRevOf } from "../src/lib/duel/puzzleScoreRev";
import { decodeSafePending, decodeSafeTries, encodeSafeDraft } from "../src/lib/duel/safe";
import { bandsFigures, bandsHelp } from "../src/lib/duel/puzzleBandsText";
import { isNumberDepthType } from "../src/lib/duel/numberDepth";
import { depthHelp } from "../src/lib/duel/numberDepthText";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { TEN_DROP_BANDS_MAP, TEN_DROP_BANDS_REV, TEN_DROP_DEPTH_REV, TEN_DROP_RAW_REV } from "../src/lib/arcade/tenDrop";
import { CLASH_BANDS_MAP, CLASH_REV_BANDS, CLASH_REV_DEPTH, CLASH_REV_GREAT } from "../src/lib/arcade/colourClash";
import { WHACK_BANDS_MAP, WHACK_REV_BANDS, WHACK_REV_DEPTH } from "../src/lib/arcade/whack";
import { CLAY_BANDS_MAP, CLAY_REV_BANDS, CLAY_REV_DEPTH, CLAY_REV_QUICK } from "../src/lib/arcade/clayShoot";
import { WORDFALL_BANDS_MAP, WORDFALL_REV_BANDS } from "../src/lib/arcade/wordfall";
import { ensureWordfallDict } from "../src/lib/duel/wordfallDict.server";
import { KNOWN_SPAM } from "./puzzle-fairness";
import { FIXTURE, type AnswerRun, type ArcadeRun } from "./scoring-bands-record";
import { roomPuzzle, runSpam } from "./puzzle-fairness/run";
import { legacyRoomPuzzle, stripDepth } from "./depth-d6-legacy";
import { isDepthType } from "../src/lib/duel/logicDepth";
import { KITS } from "./puzzle-fairness/kits";
import type { FloodPuzzleData, PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { FLOOD_BANK, FLOOD_BANK_V3 } from "../src/lib/duel/flood.server";
import { FLOOD_REV2_SPARE_MOVES } from "../src/lib/duel/moveLimits";
import { pinDealtPuzzleScoreRev } from "../src/lib/duel/puzzleScoreRev";
import { pinPreDepth } from "../src/lib/duel/wordDepth";
// Word depth (25 Oct 2026): this check proves the pre-depth stamps; new deals of the nine word games are pinned to them.
pinPreDepth(true);
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { pinPreDepthTapRev } from "../src/lib/duel/tapLog";
import { pinPreTopup } from "../src/lib/duel/depthTopup";

// The puzzle top-up (26 Oct 2026, docs/depth/topup-oct-2026.md) deals newer stamps; this check proves the stamps it was
// written for, so new deals are pinned to them (depth-topup-check proves the top-up's).
pinPreTopup(true);

// Flash, Bang On and Ascend deal tapRev 5 (Depth to 200, depth-*-check proves it); this check proves the stamps before it.
pinPreDepthTapRev(true);

// This check proves puzzleScoreRev 2 (the score bands): new deals are pinned to it. Rooms deal 3 (scoring-rev3-check).
pinDealtPuzzleScoreRev(2);

let checks = 0;
const failures: string[] = [];
function ok(cond: unknown, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
ensureWordfallDict();

/** The room puzzle a recorded answer was played on (the same seeded draw the recorder used). */
const cache = new Map<string, PuzzleData>();
function roomPuzzleCached(type: PuzzleType, seed: number): PuzzleData {
  const key = `${type}:${seed}`;
  if (!cache.has(key)) cache.set(key, roomPuzzle(type, seed));
  return cache.get(key)!;
}

/**
 * The fixture's answers were recorded before Topsy-Turvy gravityRev 2 and Polypotions tubesRev 2 (19 Oct 2026,
 * solverProgress.server.ts) and Jumbled tilesRev 2 (20 Oct 2026, 90 s), so they grade on the stamps they were
 * played on; solver-progress-check and jumbled-clock-check hold the runs recorded on the new stamps. Strikeout's
 * were played on strikeoutRev 3 (ten strikes; rooms deal rev 4's twelve since 19 Oct 2026, the same boards):
 * strikeout-check holds rev 4.
 */
const RECORDED_STAMPS: Partial<Record<PuzzleType, Record<string, number | undefined>>> = {
  // Scoring report batch 2 (20 Oct 2026): rooms deal wordsmithRev 2, wordHuntRev 2 and tapRev 4 (scoring-batch2-check).
  wordsmith: { wordsmithRev: 1 },
  wordhunt: { wordHuntRev: 1 },
  reaction: { tapRev: 3 },
  stopwatch: { tapRev: 3 },
  gravity: { gravityRev: 1 },
  tubes: { tubesRev: 1 },
  tiles: { tilesRev: 1, timeLimitMs: undefined },
  strikeout: { strikeoutRev: 3 },
  // Depth to 200 (25 Oct 2026): rooms deal chainDepthRev 1 and pairRev 1 (depth-chain-check, depth-matchmaker-check).
  chain: { chainDepthRev: undefined },
  pairmatch: { pairRev: undefined, gold: undefined },
};
/**
 * Colour Flood floodRev 3 (20 Oct 2026) deals from a new pool by the same draw: the recorded runs played the
 * floodRev 2 pool's board at the same index, with par + 2 taps.
 */
function floodRev2(p: PuzzleData): PuzzleData {
  const f = p as FloodPuzzleData;
  const i = FLOOD_BANK_V3.findIndex((b) => b.grid.join(",") === f.grid.join(","));
  const old = FLOOD_BANK[i];
  if (!old) return p;
  return { ...f, grid: [...old.grid], solution: [...(old.solution ?? [])], par: old.par, floodRev: 2, moveLimit: old.par + FLOOD_REV2_SPARE_MOVES } as unknown as PuzzleData;
}
function recordedPuzzle(type: PuzzleType, seed: number): PuzzleData {
  if (type === "flood") return floodRev2(stripDepth(roomPuzzleCached(type, seed)));
  // Labyrinth mazeRev 1 (depth to 200, 25 Oct 2026) deals a bigger maze: the recorded runs played the 19 × 19 one
  // the same seeded draw built before it (depth-labyrinth-check holds mazeRev 1).
  if (type === "maze") {
    const { cells, start, exit, solution } = withSeededRandom(seed, () => generateMazeClassic());
    const { mazeRev: _r, cols: _c, rows: _w, stars: _s, ...stamps } = roomPuzzleCached(type, seed) as unknown as Record<string, unknown>;
    return { ...stamps, cells, start, exit, solution } as unknown as PuzzleData;
  }
  // The Logic depth revision (25 Oct 2026): the eleven games' answers were played before it (no depth stamp; Mosaic,
  // Tents, Shikaku and Lamplighter on their old boards, scripts/depth-d6-legacy.ts).
  const p = isDepthType(type) ? legacyRoomPuzzle(type, seed) : roomPuzzleCached(type, seed);
  return RECORDED_STAMPS[type] ? ({ ...(p as object), ...RECORDED_STAMPS[type] } as unknown as PuzzleData) : p;
}

/* ============================== 1. Arcade curves and stamps ============================== */
const ARCADE = (Object.keys(LIVE_BANDS) as LiveBandGame[]).filter((t) => t !== "junction");
for (const type of ARCADE) {
  const { base } = BASES[type]!;
  const live = LIVE_BANDS[type];
  ok(bandHasStrict(base), `${type}: its base curve has a strict row`);
  const strict = bandStrict(base);
  // A game raised to 200 (docs/scoring-200.md) lists its expansion's base curve; its strict revision is `strictRev`.
  if (live.strictRev === undefined) ok(live.curve === strict, `${type}: LIVE_BANDS lists the strict curve`);
  ok(strict.units[0] === 0 && strict.points[0] === 0, `${type}: strict curve starts at (0, 0)`);
  ok(strict.points.at(-1) === base.points.at(-1) && bandTop(strict) === bandTop(base), `${type}: strict curve keeps the top (${base.points.at(-1)} at ${bandTop(base)})`);
  for (let i = 1; i < strict.units.length; i++) ok(strict.units[i]! > strict.units[i - 1]! && strict.points[i]! > strict.points[i - 1]!, `${type}: strict knots rise (${i})`);
  const dealt = (generatePuzzle(type as PuzzleType) as unknown as Record<string, unknown>)[live.field];
  ok(dealt === live.rev, `${type}: rooms deal ${live.field} ${live.rev} (got ${String(dealt)})`);
  const spec = GAMES.find((g) => g.type === type)!;
  const seed = spec.seedFor(0);
  ok((spec.gameFor(liveStrictRev(type), seed).init(seed) as { band?: number }).band === BAND_STRICT_MARK, `${type} ${liveStrictRev(type)}: band ${BAND_STRICT_MARK} from the first tick`);
  ok((spec.gameFor(TARGET_REVS[type]![0], seed).init(seed) as { band?: number }).band === BAND_TARGET_MARK, `${type} ${TARGET_REVS[type]![0]}: still band ${BAND_TARGET_MARK}`);
}

/* ============================== 2. Recorded arcade runs ============================== */
const fixture = JSON.parse(gunzipSync(readFileSync(FIXTURE)).toString()) as { arcade: ArcadeRun[]; answers: AnswerRun[] };
{
  const strip = (state: any) => {
    const { band: _band, ...rest } = state as Record<string, unknown>;
    return JSON.stringify(rest);
  };
  const per = new Map<string, number>();
  for (const run of fixture.arcade) {
    const spec = GAMES.find((g) => g.type === run.type)!;
    // Recorded on the room seeds of their day (fixtureSeedFor: Tilt's measured seeds have since moved to its bank).
    const seed = (spec.fixtureSeedFor ?? spec.seedFor)(run.n);
    const tag = `${run.type} ${run.level} #${run.n}`;
    ok(run.rev === liveStrictRev(run.type as LiveBandGame), `${tag}: recorded on the score-bands revision`);
    const now = spec.replay(seed, run.raw, run.rev);
    ok(!now.flagged && now.desyncTick == null, `${tag}: replays unflagged (${now.reason ?? ""})`);
    ok(now.score === run.score, `${tag}: replays to its stored ${run.score} (got ${now.score})`);
    ok((now.state as { band?: number }).band === BAND_STRICT_MARK, `${tag}: scored on its strict curve`);
    const target = TARGET_REVS[run.type as LiveBandGame]![0];
    const before = spec.replay(seed, run.raw, target);
    ok(before.desyncTick == null, `${tag}: no desync on ${target}`);
    ok(strip(before.state) === strip(now.state), `${tag}: identical final state on ${target} and ${run.rev}`);
    per.set(run.type, (per.get(run.type) ?? 0) + 1);
  }
  for (const type of ARCADE) ok(per.get(type) === 8, `${type}: 8 recorded runs (got ${per.get(type) ?? 0})`);
}

/* ============================== 3. Engine games ============================== */
{
  const maps: [PuzzleType, string, number, BandCurve, number][] = [
    ["tendrop", "tenRev", TEN_DROP_BANDS_REV, TEN_DROP_BANDS_MAP, 1],
    ["stroop", "clashRev", CLASH_REV_BANDS, CLASH_BANDS_MAP, 5],
    ["whack", "whackRev", WHACK_REV_BANDS, WHACK_BANDS_MAP, 0],
    ["clayshoot", "clayRev", CLAY_REV_BANDS, CLAY_BANDS_MAP, 6],
    ["wordfall", "wordfallRev", WORDFALL_REV_BANDS, WORDFALL_BANDS_MAP, 2],
  ];
  // Scoring report batch 2 (20 Oct 2026) moved rooms on to these stamps (scoring-batch2-check); the recorded runs keep this one.
  const later: Partial<Record<PuzzleType, number>> = { tendrop: TEN_DROP_RAW_REV, stroop: CLASH_REV_GREAT, clayshoot: CLAY_REV_QUICK };
  // Depth to 200 (25 Oct 2026, docs/depth/d3-speed-attention.md) moved rooms on again; the recorded runs keep this one.
  const depthD3: Partial<Record<PuzzleType, number>> = { whack: WHACK_REV_DEPTH, clayshoot: CLAY_REV_DEPTH, stroop: CLASH_REV_DEPTH };
  for (const [type, field, rev, map, prev] of maps) {
    const dealt = (generatePuzzle(type) as unknown as Record<string, unknown>)[field];
    // Tenfall's depth-to-200 tenRev 4 (25 Oct 2026) follows tenRev 3; the D3 depth stamps (depthD3) follow theirs.
    ok(dealt === rev || dealt === later[type] || dealt === depthD3[type] || (type === "tendrop" && dealt === TEN_DROP_DEPTH_REV), `${type}: rooms deal ${field} ${rev}${later[type] ? ` or ${later[type]}` : ""}`);
    ok(bandMapTotal(map, 0) === 0 && bandMapTotal(map, bandTop(map)) === 150, `${type}: the map runs 0 → 150`);
    for (let x = 1; x <= bandTop(map); x++) ok(bandMapTotal(map, x) >= bandMapTotal(map, x - 1), `${type}: the map never falls (${x})`);
    if (type !== "wordfall") ok(bandMapTotal(map, 149) < 150, `${type}: only a perfect 150 is 150`);
    const runs = fixture.answers.filter((a) => a.type === type);
    ok(runs.length >= 10, `${type}: recorded answers (${runs.length})`);
    for (const a of runs) {
      const puzzle = { ...(roomPuzzleCached(type, a.seed) as object), [field]: rev } as unknown as PuzzleData;
      const g = gradeAnswer(puzzle, a.answer, a.ms);
      ok(g.score === a.score, `${type} ${a.label} ${a.seed}: grades to its stored ${a.score} (got ${g.score})`);
      const old = gradeAnswer({ ...(puzzle as object), [field]: prev } as unknown as PuzzleData, a.answer, a.ms);
      // The same play under the previous stamp: its score (Letterfall: its word points) maps to the new one.
      const from = type === "wordfall" ? Number((old.extra as any)?.points ?? 0) : old.score;
      ok(g.score === bandMapTotal(map, from), `${type} ${a.label}: the previous stamp's ${from} maps to ${g.score}`);
    }
  }
}


/* ============================== 4. Puzzles (puzzleScoreRev 2) ============================== */
{
  const games = [...REV2_FINISH_GAMES, ...REV2_OPEN_GAMES];
  for (const type of games) {
    ok(PUZZLE_REV2_KNOTS[type] !== undefined, `${type}: has fitted knots`);
    const dealt = REV2_DEALT_KEY[type];
    // Batch 2's own-curve stamps (Nucleus wordsmithRev 2, Flash and Bang On tapRev 4) pass their score through unchanged.
    if (dealt) ok(PUZZLE_REV2_KNOTS[dealt] !== undefined ? rev2KnotsFor(type) === PUZZLE_REV2_KNOTS[dealt] : rev2KnotsFor(type) === REV2_IDENTITY_KNOTS, `${type}: rooms are dealt its ${dealt} knots`);
    for (const k of [rev2KnotsFor(type), PUZZLE_REV2_KNOTS[type]!]) {
      ok(k[0]![0] === 0 && k[0]![1] === 0, `${type}: knots start at (0, 0)`);
      ok(k.at(-1)![1] === 150 && k.slice(0, -1).every(([, y]) => y < 150), `${type}: 150 only at the last knot (a perfect run)`);
      for (let i = 1; i < k.length; i++) ok(k[i]![0] > k[i - 1]![0] && k[i]![1] > k[i - 1]![1], `${type}: knots rise (${i})`);
      if (REV2_FINISH_GAMES.has(type)) {
        ok(rev2Points(k, 49.5) > 0, `${type}: half progress scores (${rev2Points(k, 49.5)})`);
        ok(rev2Points(k, 100) >= rev2Points(k, 99), `${type}: a finish at the buzzer beats every unfinished run`);
      }
    }
    // Rooms deal puzzleScoreRev 3 since 20 Oct 2026 (scoring-rev3-check); rev 2 is proved on its stored runs below.
    ok(puzzleScoreRevOf(generatePuzzle(type, { bankSeed: 4242 })) >= PUZZLE_SCORE_REV_BANDS, `${type}: rooms deal puzzleScoreRev ${PUZZLE_SCORE_REV_BANDS} or later`);
  }
  for (const a of fixture.answers.filter((x) => x.kind === "puzzle")) {
    const puzzle = recordedPuzzle(a.type as PuzzleType, a.seed);
    const tag = `${a.type} ${a.label} ${a.seed}`;
    const g = gradeAnswer(puzzle, a.answer, a.ms);
    ok(g.score === a.score, `${tag}: grades to its stored ${a.score} (got ${g.score})`);
    const result = Number((g.extra as any)?.result);
    // The stored result is rounded to a tenth, so the knots there may differ from the score by a point.
    ok(Number.isFinite(result) && Math.abs(g.score - rev2Points(rev2KnotsForPuzzle(puzzle), result)) <= 1, `${tag}: the score is the knots at its result (${result})`);
    const old = gradeAnswer({ ...(puzzle as object), puzzleScoreRev: 1 } as unknown as PuzzleData, a.answer, a.ms);
    // Safe Cracker's rev-2 grader keeps the best try's dials (and the dials left standing), so its rev-1 figure differs.
    if (a.type !== "safe") ok((g.extra as any)?.rev1Score === old.score && old.isCorrect === g.isCorrect, `${tag}: the rev-1 grade is kept (${old.score})`);
    if (a.label === "nothing") ok(g.score === 0, `${tag}: doing nothing scores 0`);
    const parts = (g.extra as any)?.parts;
    ok(parts && (parts.kind === "partial" ? parts.base === g.score : parts.base + (parts.efficiency ?? 0) + (parts.speed ?? 0) === g.score), `${tag}: the stored breakdown adds up to the score`);
  }
}

/* ============================== 4b. Random and spam input stays low ============================== */
{
  // The fairness audit's rule b on the rev-2 scores: every spam strategy it does not count as real play keeps a
  // median of about 0 over 12 room seeds: at most 5, or never more than a point above the same answers under rev 1
  // (the open games' random play scored a little there already; rev 2 must not pay it more).
  const median = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.floor((xs.length - 1) / 2)] ?? 0;
  for (const type of [...REV2_FINISH_GAMES, ...REV2_OPEN_GAMES]) {
    if (!KITS[type]) continue;
    const now: Record<string, number[]> = {};
    const was: Record<string, number[]> = {};
    for (let seed = 6101; seed <= 6112; seed++) {
      const p = roomPuzzleCached(type, seed);
      for (const r of runSpam(KITS[type]!, p, seed)) (now[r.label] ??= []).push(r.score);
      for (const r of runSpam(KITS[type]!, { ...(p as object), puzzleScoreRev: 1 } as unknown as PuzzleData, seed)) (was[r.label] ??= []).push(r.score);
    }
    for (const [label, xs] of Object.entries(now)) {
      if (KNOWN_SPAM[type]?.[label]) continue;
      const before = median(was[label] ?? []);
      ok(median(xs) <= Math.max(5, before + 1), `${type}: spam "${label}" median ${median(xs)} (at most 5, or a point above rev 1's ${before})`);
    }
  }
}

/* ============================== 5. Safe Cracker draft; help text ============================== */
{
  const draft = encodeSafeDraft([[1, 2, 3, 4]], [5, 6, 7, 8]);
  ok(JSON.stringify(decodeSafeTries(draft)) === "[[1,2,3,4]]" && JSON.stringify(decodeSafePending(draft)) === "[5,6,7,8]", "Safe: a rev-2 draft keeps its tries and the dials left standing");
  ok(decodeSafePending("1234,5678") === null, "Safe: a stored answer has no dials left standing");
  for (let s = 0; s < 6; s++) {
    const p = roomPuzzleCached("safe", 8800 + s) as PuzzleData & { combination?: number[] };
    const combo = p.combination ?? [];
    const pending = gradeAnswer(p, encodeSafeDraft([], [combo[0]!, combo[1]!, combo[2]!, (combo[3]! + 1) % 10]), 0);
    ok(!pending.isCorrect && pending.score > 0, `Safe ${s}: three dials right left standing score (${pending.score}) but never open the safe`);
    const old = gradeAnswer({ ...(p as object), puzzleScoreRev: 1 } as unknown as PuzzleData, encodeSafeDraft([], [...combo]), 0);
    ok(!old.isCorrect && old.score === 0, `Safe ${s}: a rev-1 round ignores dials left standing`);
  }
  for (const type of REV2_FINISH_GAMES) {
    const f = bandsFigures(type);
    // Since puzzleScoreRev 3 (20 Oct 2026) the help states the helper's numbers (scoring-rev3-check proves them).
    void f;
    // Depth to 200: a D3 game raised to 200 states its own revision's help (its depth check proves it); the Number
    // puzzles to 200 (depthRev 1) state their own text (numberDepthText.ts; number-depth-check proves it).
    // Depth batch 4's games state their own text (depth4/text.ts; depth4-check proves the rest).
    if (isD4Type(type)) {
      ok(PUZZLE_INSTRUCTIONS[type].score === d4Help(type), `${type}: the "?" help is not the puzzle's score text`);
      continue;
    }
    if (roundMaxFor(type) > 150 && !isNumberDepthType(type)) continue;
    ok(PUZZLE_INSTRUCTIONS[type].score === (isNumberDepthType(type) ? depthHelp(type) : bandsHelp(type)), `${type}: the "?" help is not the puzzle's score text`);
  }
}

if (failures.length) {
  console.log(`FAIL scoring-bands-check: ${failures.length} of ${checks} checks failed`);
  for (const f of failures.slice(0, 40)) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`PASS scoring-bands-check: ${checks} checks — strict arcade curves and stamps, ${fixture.arcade.length} recorded arcade runs, engine maps, puzzle knots and ${fixture.answers.length} recorded answers, Safe Cracker's draft, the help numbers`);
