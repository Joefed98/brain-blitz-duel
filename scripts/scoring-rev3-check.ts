/**
 * scoring-rev3-check (20 Oct 2026): the shared puzzle helper, `puzzleScoreRev 3` (src/lib/duel/puzzleScoreRev3.ts,
 * src/lib/duel/puzzleProgress.ts, docs/scoring-targets.md). About 10 s.
 *
 *  1. Rooms deal puzzleScoreRev 3 on every finish and open puzzle; open games keep rev 2's curves under it.
 *  2. The helper's arithmetic: unfinished = min(110, round(110 × progress ÷ oneShort)); a finish = 120 + up to 30,
 *     30 × min(1, time left share ÷ fastShare) × efficiency; fastShare inside 0.40–0.75.
 *  3. Stored runs (scripts/fixtures/scoring-rev3-runs.json.gz, `bun scripts/scoring-rev3-record.ts`: three room
 *     seeds of every helper game, the kits' clean ladder, finishes at 0 / 50 / 90 % of the clock left, a finish
 *     with slips and every spam strategy) grade exactly as recorded, as a room too (gradeRoomAnswer).
 *  4. Joe's pass marks on those runs: a finish is 120–150 (120 at the buzzer, 150 with 90 % left and no slips),
 *     unfinished at most 110, one short 105–110, spam at most 10 (median), never lower for more actions of the
 *     clean ladder, more time left or fewer slips; the games that miss a mark by design are listed with why.
 *  5. Older stamps: the same answers on a puzzle stamped puzzleScoreRev 2 still take rev 2's path; Interlock's
 *     short valid grid is a finish on rev 2 and progress on rev 3.
 *  6. The help and intro numbers: each game's dealt clock and "150 in about N s" agree with freshly dealt puzzles.
 *  7. Grading stays quick: every stored run grades in a few ms once a board's table is built.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { gradeRoomAnswer } from "../src/lib/duel/roomGrade.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { puzzleScoreRevOf } from "../src/lib/duel/puzzleScoreRev";
import { REV2_FINISH_GAMES, REV2_OPEN_GAMES } from "../src/lib/duel/puzzleScoreRev2";
import {
  PUZZLE_SCORE_REV_HELPER,
  REV3_FAST_MAX,
  REV3_FAST_MIN,
  REV3_GAMES,
  rev3Applies,
  rev3FastFinishSeconds,
  rev3Finish,
  rev3Unfinished,
} from "../src/lib/duel/puzzleScoreRev3";
import { clearProgressCaches, targetProgress, SLIDER_ROW_POINTS } from "../src/lib/duel/puzzleProgress";
import { DEALT_LIMIT_S, fastFinishSeconds, rev3Help, rev3Intro } from "../src/lib/duel/puzzleBandsText";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { isNumberDepthType } from "../src/lib/duel/numberDepth";
import { depthHelp, depthIntro } from "../src/lib/duel/numberDepthText";
import { fillMax } from "../src/lib/duel/roundMax";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { REV3_FIXTURE, type Rev3Game } from "./scoring-rev3-record";
import { KNOWN_SPAM } from "./puzzle-fairness";
import { KITS } from "./puzzle-fairness/kits";
import { hashText, makeRng } from "./puzzle-fairness/kit";
import { roomPuzzle } from "./puzzle-fairness/run";
import { pinPreDepth, WORD_DEPTH_GAMES } from "../src/lib/duel/wordDepth";

// Word depth (25 Oct 2026): this check proves the pre-depth stamps; new deals of the nine word games are pinned to them.
pinPreDepth(true);

let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};

/** Marks a game misses by design on the kits' runs, and why (docs/scoring-targets.md lists them for Joe). */
export const ONE_SHORT_EXCEPTIONS: Partial<Record<PuzzleType, string>> = {
  strikeout: "the kit's last action types the whole last word, so its one-short board is that word part-revealed; one letter short is 105–110",
  target: "Exact's one short is off by 1 (110 by rule); the kit's last-but-one step is usually far from the target",
  wordslide: "the last slide can make several rows at once, so the board one slide short may hold fewer rows (Joe's row scale)",
};
export const MONOTONIC_EXCEPTIONS: Partial<Record<PuzzleType, string>> = {
  pipes: "Pipeline counts tiles joined to the source (rev-1 credit, not a batch-1 game): turning a tile on the way can briefly cut off the tiles beyond it",
};
export const SPAM_EXCEPTIONS: Partial<Record<PuzzleType, string>> = {
  flow: "Chroma Lines' blind fill joins some pairs on their real route (rev-1 credit, not a batch-1 game)",
};

/* ------------------------------------------------------------------ 1. stamps */
for (const type of [...REV2_FINISH_GAMES, ...REV2_OPEN_GAMES]) {
  const p = generatePuzzle(type, { bankSeed: 4242 });
  ok(puzzleScoreRevOf(p) === PUZZLE_SCORE_REV_HELPER, `${type}: rooms deal puzzleScoreRev ${puzzleScoreRevOf(p)}, not 3`);
  if (REV2_OPEN_GAMES.has(type)) {
    const g = gradeAnswer(p, "", 0);
    ok(typeof (g.extra as Record<string, unknown> | null)?.["result"] === "number", `${type}: an open game left rev 2's curve under rev 3`);
  }
}
for (const type of REV2_FINISH_GAMES) ok(rev3Applies(type), `${type}: a finish game is not on the helper`);

/* ------------------------------------------------------------------ 2. arithmetic */
for (const [type, g] of Object.entries(REV3_GAMES) as [PuzzleType, { fastShare: number; oneShort: number }][]) {
  ok(g.fastShare >= REV3_FAST_MIN && g.fastShare <= REV3_FAST_MAX, `${type}: fastShare ${g.fastShare} outside 0.40–0.75`);
  ok(g.oneShort > 0.5 && g.oneShort <= 1, `${type}: oneShort ${g.oneShort}`);
  ok(rev3Unfinished(type, g.oneShort).score === 110 && rev3Unfinished(type, 1).score === 110, `${type}: one short is not 110`);
  ok(rev3Unfinished(type, 0).score === 0, `${type}: nothing scores`);
  ok(rev3Finish(type, 0, 60_000, 1).score === 120, `${type}: a finish at the buzzer is not 120`);
  ok(rev3Finish(type, 60_000 * g.fastShare, 60_000, 1).score === 150, `${type}: a fast clean finish is not 150`);
  ok(rev3Finish(type, 60_000, 60_000, 0).score === 120, `${type}: mistakes took a finish below 120`);
  let prev = -1;
  for (let i = 0; i <= 20; i++) {
    const s = rev3Unfinished(type, i / 20).score;
    ok(s >= prev && s <= 110, `${type}: unfinished not rising to 110 at ${i / 20}`);
    prev = s;
  }
  for (let i = 0; i <= 20; i++) for (const e of [0, 0.5, 1]) {
    const a = rev3Finish(type, (60_000 * i) / 20, 60_000, e).score;
    ok(a >= 120 && a <= 150 && a >= rev3Finish(type, (60_000 * Math.max(0, i - 1)) / 20, 60_000, e).score, `${type}: finish not rising with time`);
  }
}
ok(SLIDER_ROW_POINTS.join(",") === "0,30,70,90,110", "Slider's row scale is not Joe's 0/30/70/90/110");
ok(targetProgress(1, 500) === 1 && targetProgress(0.5, 500) === 1 && targetProgress(Infinity, 500) === 0 && targetProgress(500, 500) === 0, "Exact: off by 1 is not one short, or no number made scores");
for (let d = 1; d < 600; d++) ok(targetProgress(d + 1, 500) <= targetProgress(d, 500), `Exact: further (${d + 1}) scores more than ${d}`);

/* Joe's phone cases (docs/scoring-report-oct-2026.md, "Your phone results"), on the progress each measure gives. */
{
  const u = (type: PuzzleType, p: number) => rev3Unfinished(type, p).score;
  const cases: [string, number, number, number][] = [
    ["Slider 4 rows", u("wordslide", SLIDER_ROW_POINTS[4]! / 110), 110, 110],
    ["Slider 3 rows", u("wordslide", SLIDER_ROW_POINTS[3]! / 110), 90, 90],
    ["Trail 8/26 tiles", u("trail", 8 / 26), 32, 36],
    ["Interlock 14 tiles in valid words", u("tilegrid", 14 / 15), 110, 110],
    ["Counterweight 1 of 4 scales", u("balance", 1 / 4), 26, 29],
    ["Lookout 4 of 6 words (rev-1 credit 88)", u("wordsearch", 88 / 110), 86, 90],
  ];
  for (const [label, got, lo, hi] of cases) ok(got >= lo && got <= hi, `${label}: ${got} (want ${lo}–${hi})`);
  console.log(`Joe's cases: ${cases.map(([l, g]) => `${l} ${g}`).join("; ")}`);
}

/* ------------------------------------------------------------------ 3–4. stored runs */
const fixture = JSON.parse(gunzipSync(readFileSync(REV3_FIXTURE)).toString("utf8")) as { recordedOn: string; games: Rev3Game[] };
const covered = new Set(fixture.games.map((g) => g.type));
for (const type of Object.keys(REV3_GAMES)) ok(covered.has(type as PuzzleType), `${type}: no stored rev-3 runs`);
let entries = 0, same = 0, roomSame = 0;
const spamScores = new Map<PuzzleType, number[]>();
const oneShorts = new Map<PuzzleType, number[]>();
let gradeMs = 0;
for (const game of fixture.games) {
  const { puzzle, type } = game;
  const limit = puzzleTimeLimitMs(puzzle);
  const scoreOf: Record<string, number> = {};
  gradeAnswer(puzzle, game.entries[0]?.answer ?? "", 0); // builds any per-board table before timing
  for (const e of game.entries) {
    entries++;
    const t0 = performance.now();
    const g = gradeAnswer(puzzle, e.answer, e.ms);
    gradeMs = Math.max(gradeMs, performance.now() - t0);
    const extra = (g.extra ?? {}) as Record<string, unknown>;
    const now = { score: g.score, isCorrect: g.isCorrect, parts: extra.parts ?? null, progress: typeof extra.progressShare === "number" ? extra.progressShare : null };
    const identical = JSON.stringify(now) === JSON.stringify(e.graded);
    if (identical) same++;
    ok(identical, `${type} ${game.seed} ${e.level}: graded ${JSON.stringify(now)}, stored ${JSON.stringify(e.graded)}`);
    // As a room: received in the puzzle phase 80 ms after the claim, or in the reveal phase for a time-out.
    const startedAt = 1_000_000;
    const room = gradeRoomAnswer(
      puzzle,
      { phase: e.ms > 0 ? "puzzle" : "reveal", phaseStartedAt: new Date(startedAt).toISOString(), nowMs: e.ms > 0 ? startedAt + (limit - e.ms) + 80 : startedAt + limit + 100 },
      e.answer,
      e.ms,
    );
    if (room.graded.score === g.score) roomSame++;
    ok(room.graded.score === g.score, `${type} ${game.seed} ${e.level}: room ${room.graded.score} ≠ practice ${g.score}`);
    scoreOf[e.level] = g.score;
    if (g.isCorrect) {
      ok(g.score >= 120 && g.score <= 150, `${type} ${game.seed} ${e.level}: a finish scored ${g.score}`);
      ok((extra.parts as { base?: number } | undefined)?.base === 120, `${type} ${game.seed} ${e.level}: finish breakdown base is not 120`);
    } else {
      ok(g.score >= 0 && g.score <= 110, `${type} ${game.seed} ${e.level}: unfinished scored ${g.score}`);
    }
    // Strategies that read the screen's feedback (KNOWN_SPAM) are play, not random input.
    if (e.level.startsWith("spam:") && !(e.level.slice(5) in (KNOWN_SPAM[type] ?? {}))) (spamScores.get(type) ?? spamScores.set(type, []).get(type)!).push(g.score);
  }
  // One short (the game's median is judged below; a single seed may hold a little less).
  const one = scoreOf["one-short"];
  if (one !== undefined) {
    (oneShorts.get(type) ?? oneShorts.set(type, []).get(type)!).push(one);
    if (!ONE_SHORT_EXCEPTIONS[type]) ok(one >= 95 && one <= 110, `${type} ${game.seed}: one short scored ${one}`);
  }
  // The clock: 120 at the buzzer, 150 with 90 % left (tap and action logs finish a little before the buzzer).
  const timed = game.entries.some((e) => e.level === "t0" && e.ms > 0);
  if (scoreOf.t0 !== undefined) ok(timed ? scoreOf.t0 <= 122 && scoreOf.t0 >= 120 : scoreOf.t0 === 120, `${type} ${game.seed}: a finish at the buzzer scored ${scoreOf.t0}`);
  if (scoreOf.t90 !== undefined && !timed) ok(scoreOf.t90 === 150, `${type} ${game.seed}: a clean finish with 90 % left scored ${scoreOf.t90}`);
  ok((scoreOf.t0 ?? 0) <= (scoreOf.t50 ?? 150) && (scoreOf.t50 ?? 0) <= (scoreOf.t90 ?? 150), `${type} ${game.seed}: more time left scored less`);
  if (scoreOf.mistakes !== undefined && scoreOf.t50 !== undefined && !timed) ok(scoreOf.mistakes <= scoreOf.t50, `${type} ${game.seed}: slips scored more than a clean finish`);
  // More of the clean solve never scores less.
  const ladder = game.entries.filter((e) => e.level.startsWith("ladder:") || e.level === "one-short");
  let prev = -1;
  for (const e of ladder) {
    const s = scoreOf[e.level]!;
    if (!MONOTONIC_EXCEPTIONS[type]) ok(s >= prev - 2, `${type} ${game.seed}: ${e.level} scored ${s} after ${prev}`);
    prev = Math.max(prev, s);
  }
}
for (const [type, xs] of oneShorts) {
  const sorted = [...xs].sort((a, b) => a - b);
  const median = sorted[sorted.length >> 1] ?? 0;
  if (!ONE_SHORT_EXCEPTIONS[type]) ok(median >= 105 && median <= 110, `${type}: one short median ${median}`);
}
for (const [type, xs] of spamScores) {
  const sorted = [...xs].sort((a, b) => a - b);
  const median = sorted[sorted.length >> 1] ?? 0;
  if (!SPAM_EXCEPTIONS[type]) ok(median <= 10, `${type}: spam median ${median}`);
}
ok(gradeMs < 250, `a stored run took ${gradeMs.toFixed(0)} ms to grade`);
console.log(`stored runs: ${same}/${entries} identical to ${fixture.recordedOn}; rooms = practice on ${roomSame}/${entries}; slowest grade ${gradeMs.toFixed(1)} ms`);

/* ------------------------------------------------------------------ 5. older stamps */
for (const game of fixture.games.filter((g) => g.seed === fixture.games.find((x) => x.type === g.type)!.seed)) {
  const rev2 = { ...(game.puzzle as object), puzzleScoreRev: 2 } as PuzzleData;
  const e = game.entries.find((x) => x.level === "one-short") ?? game.entries[0]!;
  const g = gradeAnswer(rev2, e.answer, e.ms);
  const extra = (g.extra ?? {}) as Record<string, unknown>;
  ok(typeof extra.result === "number" && extra.progressShare === undefined, `${game.type}: a puzzleScoreRev 2 round left rev 2's path`);
}
{
  const g = fixture.games.find((x) => x.type === "tilegrid")!;
  const valid = g.entries.find((e) => e.level === "one-short")!;
  // The clean ladder's board one tile short: rev 2 took a valid short grid as a finish, rev 3 as progress.
  const rev2 = { ...(g.puzzle as object), puzzleScoreRev: 2 } as PuzzleData;
  const r2 = gradeAnswer(rev2, valid.answer, 30_000);
  const r3 = gradeAnswer(g.puzzle, valid.answer, 30_000);
  const placed = valid.answer.replace(/\./g, "").length;
  ok(placed === 14 && !r3.isCorrect && r3.score <= 110, `Interlock: a 14-tile grid is a finish on rev 3 (${r3.score})`);
  // On rev 2 the same grid kept its old verdict (any valid grid was a finish).
  ok(r2.isCorrect === ((r2.extra as { valid?: boolean } | null)?.valid === true), "Interlock: rev 2's verdict changed");
}

/* -------------------------------------------- 6a. Heave and Gridlock: deterministic, cached, never lower on the way */
{
  // Heave's push count (a bound, not the exact solver) and Gridlock's whole-board table: on 40 room boards each,
  // every action of a clean solve (the stored solution, walked as the phone sends it) never scores less than the one
  // before, and every answer grades to the same score and progress with the tables cold (cleared) and warm, in
  // either order.
  const near = { level: "near", pace: 0.4, err: 0, reactionMs: 160, reactionSd: 20 } as const;
  let steps = 0;
  const cold: number[] = [];
  for (const type of ["push", "unblock"] as PuzzleType[]) {
    for (let n = 0; n < 40; n++) {
      const seed = 12_001 + n * 11;
      const puzzle = roomPuzzle(type, seed);
      const play = KITS[type]!.play(puzzle, makeRng(hashText(`${type}:rev3-mono:${seed}`)), near as never, puzzleTimeLimitMs(puzzle) * 4);
      const answers = play.steps.map((s) => s.answer);
      clearProgressCaches();
      const t0 = performance.now();
      const first = answers.map((a) => gradeAnswer(puzzle, a, 0));
      if (type === "unblock") cold.push(performance.now() - t0);
      const shareOf = (g: { extra: unknown }) => (g.extra as { progressShare?: number } | null)?.progressShare ?? null;
      // Warm, newest first.
      const warm = answers.map((a, i) => [i, gradeAnswer(puzzle, a, 0)] as const).reverse();
      // Cold again, oldest last.
      clearProgressCaches();
      const again = [...answers].reverse().map((a) => gradeAnswer(puzzle, a, 0)).reverse();
      let prev = -1;
      for (let i = 0; i < answers.length; i++) {
        steps++;
        const g = first[i]!;
        const w = warm.find(([j]) => j === i)![1];
        const same = g.score === w.score && g.score === again[i]!.score && shareOf(g) === shareOf(w) && shareOf(g) === shareOf(again[i]!);
        ok(same,
          `${type} ${seed} step ${i + 1}: graded ${g.score}/${shareOf(g)} cold, ${w.score}/${shareOf(w)} warm, ${again[i]!.score}/${shareOf(again[i]!)} cold again`);
        if (g.isCorrect) break;
        ok(g.score >= prev, `${type} ${seed}: step ${i + 1} toward the solution scored ${g.score} after ${prev}`);
        prev = g.score;
      }
    }
  }
  cold.sort((a, b) => a - b);
  console.log(`Heave and Gridlock: ${steps} solution steps graded cold and warm, identical and never lower; Gridlock's first grade of a board (its table built once, then shared by every grade of that board on the server) median ${cold[cold.length >> 1]!.toFixed(0)} ms, slowest ${cold[cold.length - 1]!.toFixed(0)} ms`);
}

/* ------------------------------------------------------------------ 6. help and intro numbers */
for (const type of Object.keys(REV3_GAMES) as PuzzleType[]) {
  const dealt = new Set([1, 2, 3].map((n) => puzzleTimeLimitMs(generatePuzzle(type, { bankSeed: 977 * n }))));
  ok(dealt.size === 1 && dealt.has((DEALT_LIMIT_S[type] ?? 0) * 1000), `${type}: the help's clock ${DEALT_LIMIT_S[type]} s, dealt ${[...dealt].join("/")} ms`);
  const n = fastFinishSeconds(type);
  ok(n === rev3FastFinishSeconds(type, [...dealt][0]!), `${type}: help says 150 in ${n} s`);
  ok(rev3Help(type).includes(`about ${n} s with no mistakes`), `${type}: the rev-3 help states its numbers`);
  // Word depth (25 Oct 2026): the nine word games state their depth curves (proved by their depth-<game>-checks).
  if (WORD_DEPTH_GAMES.includes(type)) continue;
  // The Number puzzles to 200 (depthRev 1) keep rev 3's numbers inside their own text (numberDepthText.ts).
  const help = isNumberDepthType(type) ? depthHelp(type) : rev3Help(type);
  const intro = isNumberDepthType(type) ? fillMax(depthIntro(type), type) : rev3Intro(type);
  ok(help.includes(`about ${n} s with no mistakes`) && PUZZLE_INSTRUCTIONS[type]?.score === help, `${type}: the "?" help does not state the rev-3 numbers`);
  ok(INTRO_SCORE[type] === intro && intro.length <= 90, `${type}: intro line "${INTRO_SCORE[type]}"`);
}

if (failures.length) {
  console.log(failures.slice(0, 80).map((f) => `FAIL ${f}`).join("\n"));
  console.log(`scoring-rev3-check: FAIL (${failures.length} failed, ${checks - failures.length} passed)`);
  process.exit(1);
}
console.log(`scoring-rev3-check: PASS (${checks} checks)`);
