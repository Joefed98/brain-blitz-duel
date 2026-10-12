/**
 * Tap-log check: Flash (reaction), Bang On (stopwatch) and Ascend (numhunt) are
 * scored by the server from raw taps (src/lib/duel/tapLog.ts, puzzles stamped
 * `tapRev: 1`), never from the phone's own summary.
 *
 *  1. Legacy identity: every honest run recorded on main
 *     (scripts/fixtures/tap-log-honest-runs.json) still grades exactly as main
 *     stored it on its original, unstamped puzzle.
 *  2. Honest identity: the same runs, sent as tap logs on the stamped puzzle,
 *     get exactly the same score and tie-break time (reaction average or time
 *     left). The one difference is deliberate and asserted: an unfinished Ascend
 *     run sent nothing on main (score 0); its log now earns the documented
 *     5 per number reached − 5 per wrong tap.
 *  3. Phone parity: today's real Stage, played by the same scripted players in
 *     happy-dom, sends main's exact answers on unstamped puzzles, and on stamped
 *     puzzles sends logs the server scores identically, with the phone's own
 *     reaction average matching the server's. Six runs per game by default
 *     (TAP_LOG_PARITY=all plays all twelve). The reveal shows the stored figures.
 *  4. Tampering: summary answers, claimed counts, impossibly fast taps, taps out
 *     of order, beyond the round, after the server received the log, garbage
 *     and floods are repaired or ignored, every repair counted, and never score
 *     above the honest run.
 *
 *   bun scripts/tap-log-check.tsx
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToString } from "react-dom/server";

import { drive, type ScriptedTap } from "./tap-log-driver";
import {
  FLASH_SELECTOR,
  WATCH_SELECTOR,
  circleSelector,
  planAscend,
  planFlash,
  planWatch,
  planWatchLeadIn,
  watchLife,
} from "./tap-log-players";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { scoreNumberHunt } from "../src/lib/duel/scoring";
import { watchLifeMs, watchStop } from "../src/lib/duel/stopWatch";
import {
  FLASH_FASTEST_MS,
  TAP_LOG_MAX,
  TAP_REV,
  encodeNumberTaps,
  encodeTapTimes,
  type NumberTap,
} from "../src/lib/duel/tapLog";
import {
  REACTION_FLASH_MS,
  STOPWATCH_GAP_MS,
  STOPWATCH_LEAD_IN_MS,
  type NumberHuntPuzzleData,
  type PuzzleData,
  type ReactionPuzzleData,
  type StopWatchPuzzleData,
} from "../src/lib/duel/types";
import { reactionPuzzle } from "../src/puzzles/reaction";
import { stopWatchPuzzle } from "../src/puzzles/stopWatch";
import { numberHuntPuzzle } from "../src/puzzles/numberHunt";

type Stored = { score: number; reactionAvgMs: number | null; storedMs: number; errors: number | null; correctCount: number | null; isCorrect: boolean };
interface Run {
  game: "reaction" | "stopwatch" | "numhunt";
  seed: number;
  slow?: boolean;
  puzzle: PuzzleData;
  answer: string;
  meta: Record<string, number> | null;
  msRemaining: number;
  submitted: boolean;
  submittedAt: number;
  taps: unknown[];
  watches?: { start: number; e: number | null; gap: number | null }[];
  stored: Stored;
}

const fixture = JSON.parse(readFileSync("scripts/fixtures/tap-log-honest-runs.json", "utf8")) as { runs: Run[] };
const failures: string[] = [];
const lines: string[] = [];
const fail = (message: string) => failures.push(message);

/** The server's own time left when the answer arrived: 80 ms of network after the phone sent it. */
const receivedFor = (run: Run, limit: number) => (run.submitted ? limit - run.submittedAt - 80 : -300);
const extraFor = (meta: Record<string, number> | null) =>
  meta ? { reactionAvgMs: meta["reactionAvgMs"], correctCount: meta["correctCount"], errors: meta["errors"] } : undefined;
const stamp = <T extends PuzzleData>(puzzle: T): T => ({ ...puzzle, tapRev: TAP_REV });
const pick = (g: ReturnType<typeof gradeAnswer>): Stored => ({
  score: g.score, reactionAvgMs: g.reactionAvgMs, storedMs: g.storedMs, errors: g.errors, correctCount: g.correctCount, isCorrect: g.isCorrect,
});
const same = (a: Stored, b: Stored) =>
  a.score === b.score && a.reactionAvgMs === b.reactionAvgMs && a.storedMs === b.storedMs && a.errors === b.errors && a.correctCount === b.correctCount && a.isCorrect === b.isCorrect;
const show = (s: Stored) => `score ${s.score} avg ${s.reactionAvgMs ?? "-"} ms ${s.storedMs} errors ${s.errors ?? "-"} count ${s.correctCount ?? "-"}`;

/** Bang On taps on the fixed schedule: watch 1 at 800 ms, each next 600 ms after a stop or a run-out. */
function bangOnLog(puzzle: StopWatchPuzzleData, lead: number | null, watches: { e: number | null; gap: number | null }[]): number[] {
  const taps: number[] = lead === null ? [] : [lead];
  let start = STOPWATCH_LEAD_IN_MS;
  puzzle.watches.forEach((spec, index) => {
    const plan = watches[index]!;
    let at: number;
    if (plan.e === null) at = start + watchLifeMs(spec);
    else {
      at = start + plan.e;
      taps.push(at);
      if (plan.gap !== null) taps.push(at + plan.gap);
    }
    start = at + STOPWATCH_GAP_MS;
  });
  return taps;
}

/** The honest run as the tap log a stamped phone sends. */
function honestLog(run: Run): string {
  if (run.game === "reaction") return encodeTapTimes(run.taps as number[]);
  if (run.game === "numhunt") return encodeNumberTaps(run.taps as NumberTap[]);
  return encodeTapTimes(bangOnLog(run.puzzle as StopWatchPuzzleData, planWatchLeadIn(run.seed), run.watches!));
}

/* ---------------------------------------------------------------- shared rules */
let lifeChecks = 0;
for (let i = 0; i < 40; i++) {
  const puzzle = withSeededRandom(70_000 + i, () => generatePuzzle("stopwatch")) as StopWatchPuzzleData;
  for (const spec of puzzle.watches) {
    if (watchLifeMs(spec) !== watchLife(spec)) fail(`watchLifeMs ${watchLifeMs(spec)} ≠ marker run-out ${watchLife(spec)}`);
    lifeChecks++;
  }
}
for (const type of ["reaction", "stopwatch", "numhunt"] as const) {
  const fresh = generatePuzzle(type) as { tapRev?: number };
  if (fresh.tapRev !== TAP_REV) fail(`${type}: new puzzles are not stamped tapRev ${TAP_REV}`);
}
lines.push(`watch run-out matches the marker on ${lifeChecks} watches; new Flash, Bang On and Ascend puzzles carry tapRev ${TAP_REV}`);

/* ---------------------------------------------------- 1 + 2: legacy and honest */
let legacyOk = 0;
let honestOk = 0;
let partialOk = 0;
for (const run of fixture.runs) {
  const label = `${run.game} seed ${run.seed}`;
  const limit = puzzleTimeLimitMs(run.puzzle);
  const legacy = pick(gradeAnswer(run.puzzle, run.answer, run.msRemaining, extraFor(run.meta)));
  if (!same(legacy, run.stored)) fail(`${label}: legacy grading changed: ${show(legacy)} vs main ${show(run.stored)}`);
  else legacyOk++;

  if (run.game === "stopwatch") {
    // The legacy phone measured each stop from that watch's own start, as the log does.
    const distances = run.answer.split(",").map(Number);
    run.watches!.forEach((w, i) => {
      const spec = (run.puzzle as StopWatchPuzzleData).watches[i]!;
      const want = w.e === null ? 500 : watchStop(spec, w.e).distance;
      if (distances[i] !== want) fail(`${label}: watch ${i + 1} recorded ${distances[i]}, replay ${want}`);
    });
  }

  const graded = gradeAnswer(stamp(run.puzzle), honestLog(run), run.msRemaining, extraFor(run.meta), receivedFor(run, limit));
  const honest = pick(graded);
  const repaired = Number((graded.extra as Record<string, unknown> | null)?.["repaired"] ?? -1);
  if (repaired !== 0) fail(`${label}: honest log needed ${repaired} repairs`);
  if (run.game === "numhunt" && !run.submitted) {
    // Main sent no answer for an unfinished run; the log now earns the documented partial score.
    const taps = run.taps as NumberTap[];
    const reached = honest.correctCount ?? -1;
    const errors = honest.errors ?? -1;
    const want = scoreNumberHunt(false, 0, errors, reached, 24, limit);
    if (run.stored.score !== 0 || run.answer !== "") fail(`${label}: expected main to have stored 0 for an empty answer`);
    if (honest.score !== want || honest.storedMs !== 0 || reached < 1 || reached >= 24) fail(`${label}: unfinished log ${show(honest)}, want ${want}`);
    else partialOk++;
    lines.push(`${label}: unfinished (${taps.length} taps) → main 0 (no answer sent), now ${honest.score} = 5 × ${reached} − 5 × ${errors}`);
    continue;
  }
  if (!same(honest, run.stored)) fail(`${label}: tap log ${show(honest)} vs main ${show(run.stored)}`);
  else honestOk++;
}
lines.push(`legacy identity: ${legacyOk}/${fixture.runs.length} recorded runs grade exactly as main stored them`);
lines.push(`honest identity: ${honestOk}/${fixture.runs.filter((r) => r.game !== "numhunt" || r.submitted).length} runs score and tie-break identically as tap logs; ${partialOk} unfinished Ascend runs now earn partial credit`);

/* ------------------------------------------------------------- 3: phone parity */
let legacyPhone = 0;
let loggedPhone = 0;
const parityRuns = fixture.runs.filter((run) => process.env["TAP_LOG_PARITY"] === "all" || run.seed <= 6);
for (const run of parityRuns) {
  const label = `${run.game} seed ${run.seed}`;
  const limit = puzzleTimeLimitMs(run.puzzle);
  for (const mode of ["legacy", "stamped"] as const) {
    const puzzle = mode === "legacy" ? run.puzzle : stamp(run.puzzle);
    let result;
    if (run.game === "reaction") {
      const plan = planFlash(puzzle as ReactionPuzzleData, run.seed);
      result = await drive(reactionPuzzle.Stage, puzzle, limit, {
        initial: plan.map((t): ScriptedTap => ({ t, selector: FLASH_SELECTOR, event: "pointerdown" })),
      });
    } else if (run.game === "numhunt") {
      const plan = planAscend(puzzle as NumberHuntPuzzleData, run.seed, run.slow === true);
      result = await drive(numberHuntPuzzle.Stage, puzzle, limit, {
        initial: plan.map((tap): ScriptedTap => ({ t: tap.t, selector: circleSelector(tap.n), event: "click" })),
      });
    } else {
      const sw = puzzle as StopWatchPuzzleData;
      const lead = planWatchLeadIn(run.seed);
      const plans = sw.watches.map((spec, i) => planWatch(spec, i, run.seed));
      if (mode === "stamped") {
        // The stamped phone runs watches on the fixed schedule, so the whole run is known up front.
        result = await drive(stopWatchPuzzle.Stage, puzzle, limit, {
          initial: bangOnLog(sw, lead, plans).map((t): ScriptedTap => ({ t, selector: WATCH_SELECTOR, event: "pointerdown" })),
        });
      } else {
        let seen = 0;
        result = await drive(stopWatchPuzzle.Stage, puzzle, limit, {
          initial: lead === null ? [] : [{ t: lead, selector: WATCH_SELECTOR, event: "pointerdown" }],
          onFrame: (rel, container, schedule) => {
            const match = [...container.querySelectorAll("p")].map((p) => /^Watch (\d+) \/ \d+$/.exec(p.textContent ?? "")).find(Boolean);
            const index = match ? Number(match[1]) - 1 : -1;
            if (index < seen) return;
            const start = index === 0 ? STOPWATCH_LEAD_IN_MS : rel;
            const plan = plans[index]!;
            if (plan.e !== null) {
              schedule({ t: start + plan.e, selector: WATCH_SELECTOR, event: "pointerdown" });
              if (plan.gap !== null) schedule({ t: start + plan.e + plan.gap, selector: WATCH_SELECTOR, event: "pointerdown" });
            }
            seen = index + 1;
          },
        });
      }
    }
    if (mode === "legacy") {
      const match = result.answer === run.answer && result.msRemaining === run.msRemaining && result.submitted === run.submitted
        && JSON.stringify(result.meta) === JSON.stringify(run.meta);
      if (!match) fail(`${label}: today's legacy Stage sent "${result.answer}" (${result.msRemaining} ms), main sent "${run.answer}" (${run.msRemaining} ms)`);
      else legacyPhone++;
      continue;
    }
    if (!result.answer.startsWith("log1:")) {
      fail(`${label}: stamped Stage sent "${result.answer.slice(0, 40)}", not a tap log`);
      continue;
    }
    const phone = gradeAnswer(puzzle, result.answer, result.msRemaining, extraFor(result.meta as Record<string, number> | null), receivedFor({ ...run, submitted: result.submitted, submittedAt: result.submittedAt }, limit));
    const expected = gradeAnswer(puzzle, honestLog(run), run.msRemaining, extraFor(run.meta), receivedFor(run, limit));
    const phoneMeta = result.meta as Record<string, number> | null;
    const okScore = same(pick(phone), pick(expected)) && result.submitted === run.submitted;
    const okMeta = run.game === "numhunt" ? phoneMeta === null || phoneMeta["errors"] === phone.errors : phoneMeta?.["reactionAvgMs"] === phone.reactionAvgMs;
    if (!okScore) fail(`${label}: stamped Stage log scores ${show(pick(phone))}, expected ${show(pick(expected))}`);
    else if (!okMeta) fail(`${label}: phone shows ${JSON.stringify(phoneMeta)}, server ${show(pick(phone))}`);
    else loggedPhone++;
  }
}
lines.push(`phone parity: today's Stage sends main's exact answer on ${legacyPhone}/${parityRuns.length} unstamped runs; stamped logs score as expected and agree with the phone on ${loggedPhone}/${parityRuns.length}`);

/* -------------------------------------------- reveal: the stored figures shown */
let reveals = 0;
for (const run of fixture.runs) {
  const puzzle = stamp(run.puzzle);
  const limit = puzzleTimeLimitMs(puzzle);
  const graded = gradeAnswer(puzzle, honestLog(run), run.msRemaining, extraFor(run.meta), receivedFor(run, limit));
  const def = run.game === "reaction" ? reactionPuzzle : run.game === "stopwatch" ? stopWatchPuzzle : numberHuntPuzzle;
  const html = renderToString(
    <def.Reveal puzzle={puzzle} myAnswer={graded.answer} myCorrect={graded.isCorrect} myReactionAvgMs={graded.reactionAvgMs} myMsRemaining={graded.storedMs} timeLimitMs={limit} />,
  ).replace(/<!-- -->/g, "");
  const extra = graded.extra as Record<string, unknown>;
  const want =
    run.game === "reaction"
      ? [`${graded.reactionAvgMs} ms`, `False starts: ${graded.errors}`]
      : run.game === "stopwatch"
        ? [`${graded.reactionAvgMs} ms`, ...(extra["distances"] as number[]).map((d, i) => `Watch ${i + 1} - ${d >= 500 ? "missed" : `${d} ms off`}`)]
        : graded.isCorrect
          ? [`Finished with ${graded.errors} ${graded.errors === 1 ? "error" : "errors"}`]
          : [`reached ${graded.correctCount} of 24`];
  const missing = want.filter((text) => !html.includes(text));
  if (missing.length) fail(`${run.game} seed ${run.seed}: reveal lacks ${missing.join("; ")}`);
  else reveals++;
}
lines.push(`reveal: ${reveals}/${fixture.runs.length} tap-log reveals show the server's averages, distances, false starts and counts`);

/* ---------------------------------------------------------------- 4: tampering */
let tamperCases = 0;
function tamper(run: Run, name: string, answer: string, opts: { received?: number; ms?: number; expectRepair?: boolean; expectEqual?: boolean } = {}) {
  const limit = puzzleTimeLimitMs(run.puzzle);
  const puzzle = stamp(run.puzzle);
  const ms = opts.ms ?? run.msRemaining;
  const honest = pick(gradeAnswer(puzzle, honestLog(run), run.msRemaining, extraFor(run.meta), receivedFor(run, limit)));
  const graded = gradeAnswer(puzzle, answer, ms, extraFor(run.meta), opts.received ?? receivedFor(run, limit));
  const repaired = Number((graded.extra as Record<string, unknown> | null)?.["repaired"] ?? 0);
  const label = `${run.game} seed ${run.seed} ${name}`;
  if (graded.score > honest.score) fail(`${label}: scored ${graded.score} above the honest ${honest.score}`);
  // Ties break on the lower reaction average, or the higher time left.
  if (graded.score === honest.score) {
    if (graded.reactionAvgMs !== null && honest.reactionAvgMs !== null && graded.reactionAvgMs < honest.reactionAvgMs) fail(`${label}: better tie-break average ${graded.reactionAvgMs} < ${honest.reactionAvgMs}`);
    if (graded.storedMs > honest.storedMs) fail(`${label}: more time left ${graded.storedMs} > ${honest.storedMs}`);
  }
  if (opts.expectRepair !== false && repaired < 1) fail(`${label}: no repair counted`);
  if (opts.expectEqual && graded.score !== honest.score) fail(`${label}: ${graded.score}, expected the honest ${honest.score}`);
  tamperCases++;
}

for (const run of fixture.runs) {
  const limit = puzzleTimeLimitMs(run.puzzle);
  const honestAnswer = honestLog(run);
  const body = honestAnswer.slice("log1:".length);
  const items = body ? body.split(",") : [];
  const times = items.map((item) => Number(item.includes("@") ? item.split("@")[1] : item));
  const at = (item: string, t: number) => (item.includes("@") ? `${item.split("@")[0]}@${t}` : String(t));

  // The old summary formats, claiming a perfect run, are not tap logs.
  const summary = run.game === "reaction" ? `${(run.puzzle as ReactionPuzzleData).flashes.map(() => 150).join(",")}|0`
    : run.game === "stopwatch" ? Array.from({ length: 10 }, () => 0).join(",") : "24,0,20000";
  tamper(run, "summary answer", summary);
  // (Bang On's ten zeros read as ten taps in the lead-in: valid, and ignored.)
  tamper(run, "summary inside the log", `log1:${summary}`, { expectRepair: run.game !== "stopwatch" });
  // Claimed counts tacked on: unreadable, dropped, and the taps still decide.
  tamper(run, "claimed counts appended", `${honestAnswer},falseStarts=0,errors=0,score=150`, { expectEqual: true });
  // Out of order: reversed. Taps are moved up, never sorted into a better run.
  if (items.length > 1) tamper(run, "taps reversed", `log1:${[...items].reverse().join(",")}`);
  // Times beyond the round, and taps after the server received the answer.
  tamper(run, "taps beyond the round", `${honestAnswer},${at(items[0] ?? "10", limit + 1)},${at(items[0] ?? "10", 99_999)}`, { expectEqual: true });
  tamper(run, "negative times", `log1:${at(items[0] ?? "10", -50)},${body}`, { expectEqual: true });
  if (times.length > 2) {
    const sentAt = times[Math.floor(times.length / 2)]!;
    tamper(run, "taps after the server received it", honestAnswer, { received: limit - sentAt, ms: limit - sentAt, expectRepair: times.some((t) => t > sentAt + 1_500) });
  }
  tamper(run, "flood beyond the cap", `${honestAnswer},${Array.from({ length: TAP_LOG_MAX }, () => at(items.at(-1) ?? "10", times.at(-1) ?? 10)).join(",")}`);
  tamper(run, "garbage", "log1:abc,,12.5,1e3,@,9@", { expectRepair: true });

  if (run.game === "reaction") {
    const puzzle = run.puzzle as ReactionPuzzleData;
    // Faster claimed times, impossibly fast: every hit moved to 50 ms after its flash.
    const fast = times.map((t) => {
      const flash = puzzle.flashes.find((f) => t >= f && t < f + REACTION_FLASH_MS);
      return flash === undefined ? t : flash + FLASH_FASTEST_MS / 2;
    });
    tamper(run, "impossibly fast times", encodeTapTimes([...new Set(fast)].sort((a, b) => a - b)), { expectRepair: false });
    // Taps in the same millisecond as each flash appears.
    tamper(run, "taps on the flash itself", encodeTapTimes(puzzle.flashes), { expectRepair: false });
  }
  if (run.game === "numhunt") {
    const puzzle = run.puzzle as NumberHuntPuzzleData;
    const taps = run.taps as NumberTap[];
    // Wrong taps disguised as numbers that are not on the board still count as wrong.
    const values = new Set(puzzle.spots.map((s) => s.n));
    let replayNext = 0;
    const disguised = taps.map((tap) => {
      const index = puzzle.spots.findIndex((s) => s.n === tap.n);
      if (index === replayNext) { replayNext++; return tap; }
      return index > replayNext ? { n: values.has(100) ? 101 : 100, t: tap.t } : tap;
    });
    tamper(run, "wrong taps relabelled off the board", encodeNumberTaps(disguised), { expectRepair: taps.length !== disguised.filter((t, i) => t.n === taps[i]!.n).length });
    // A finish claimed sooner than the log's last tap: the log's own finishing tap caps the time left.
    if (run.submitted) tamper(run, "time left beyond the finishing tap", honestAnswer, { ms: run.msRemaining + 5_000, expectRepair: false });
    // Reached claimed by repeating the first number 24 times.
    tamper(run, "one number tapped 24 times", encodeNumberTaps(Array.from({ length: 24 }, (_, i) => ({ n: puzzle.spots[0]!.n, t: 1_000 + i * 100 }))), { expectRepair: false });
  }
}
lines.push(`tampering: ${tamperCases} altered logs over ${fixture.runs.length} runs, none above the honest score or tie-break, repairs counted`);

for (const line of lines) console.log(line);
if (failures.length) {
  console.log(`FAIL (${failures.length})\n  ` + failures.slice(0, 60).join("\n  "));
  process.exit(1);
}
console.log("PASS: Flash, Bang On and Ascend score from raw taps; honest runs unchanged; tampering never pays");
