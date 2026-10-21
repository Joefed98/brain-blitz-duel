/**
 * room-practice-grade-check (18 Oct 2026): the same play scores the same in a room as in practice.
 *
 * Practice grades with gradeAnswer(puzzle, answer, ms, extra) (practice.functions.ts); a room with
 * gradeRoomAnswer (roomGrade.server.ts, what submitAnswerFn runs), which adds only the server's
 * receipt time. Rooms used to measure that from phase_started_at in every phase, and the reveal
 * phase rewrites it, so an answer that arrived just after the room left the puzzle phase (a
 * time-out sent at the buzzer on a slow uplink) was read as received 1.5 s into the round: every
 * later tap or action was dropped, and Flash, Bang On, Ascend and Lightbender scored 0 or close to
 * it where practice gave points.
 *
 *  1. Every stored entry of scripts/fixtures/puzzle-score-legacy.json.gz (47 puzzle types, complete
 *     and partial answers), the honest Flash / Bang On / Ascend tap logs (stamped tapRev) and the
 *     stored arcade runs (scripts/fixtures/replay-runs.json), plus an empty and a junk answer for
 *     every active game: graded as practice and as a room for receipts the play allows (in the
 *     puzzle phase 80 ms and 1.2 s after the phone sent it; for a time-out sent at the buzzer, also
 *     0.1 s and 3 s into the reveal phase). Score, verdict, stored time, counts and the stored detail
 *     must be identical.
 *  2. The room page (duel.$code.tsx, source scan): one send per round (a stage's own submit and the
 *     time-out never both go), the round's draft is sent when the room reaches the reveal before the
 *     phone sent anything, drafts carry their round, and "everyone answered" counts active players
 *     only, on the phone and in both server functions.
 *
 *   bun scripts/room-practice-grade-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { ACTIVE_PUZZLE_TYPES, puzzlePrepMs, puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { trustedMsRemaining } from "../src/lib/duel/grade";
import { gradeRoomAnswer, type RoomReceipt } from "../src/lib/duel/roomGrade.server";
import { TAP_REV, encodeNumberTaps, encodeTapTimes, type NumberTap } from "../src/lib/duel/tapLog";
import { STOPWATCH_GAP_MS, STOPWATCH_LEAD_IN_MS, type PuzzleData, type StopWatchPuzzleData } from "../src/lib/duel/types";
import { watchLifeMs } from "../src/lib/duel/stopWatch";
import { planWatchLeadIn } from "./tap-log-players";

const failures: string[] = [];
let compared = 0;
const types = new Set<string>();
let oldWouldDiffer = 0;
let onTimeCompared = 0;
let storedSame = 0;

type Extra = Parameters<typeof gradeAnswer>[3];
const view = (g: ReturnType<typeof gradeAnswer>) =>
  JSON.stringify({
    score: g.score,
    isCorrect: g.isCorrect,
    storedMs: g.storedMs,
    correctCount: g.correctCount,
    errors: g.errors,
    reactionAvgMs: g.reactionAvgMs,
    answer: g.answer,
    extra: g.extra,
    // The replay's own wall-clock time (a diagnostic) differs between any two grades of the same run.
  }).replace(/\\?"replayMs\\?":[\d.]+/g, "");

/** The last round-clock ms a tap log ("log1:t,…" or "log1:n@t,…") carries: an honest phone sends after it. */
function lastLogMs(answer: string): number {
  if (!answer.startsWith("log1:")) return 0;
  let last = 0;
  for (const item of answer.slice(5).split(",")) {
    const t = Number(item.includes("@") ? item.split("@")[1] : item);
    if (Number.isFinite(t)) last = Math.max(last, t);
  }
  return last;
}

/** The room's receipt for an answer the phone sent with `ms` left, arriving `latency` ms later. */
function puzzleReceipt(puzzle: PuzzleData, ms: number, latency: number): RoomReceipt {
  // The puzzle phase started at 0 (server clock): the phone's clock reads limit - ms after its prep.
  const sentAt = puzzlePrepMs(puzzle) + puzzleTimeLimitMs(puzzle) - ms;
  return { phase: "puzzle", phaseStartedAt: new Date(0).toISOString(), nowMs: sentAt + latency };
}
function revealReceipt(into: number): RoomReceipt {
  // The reveal started at 100 s; the answer arrived `into` ms later.
  return { phase: "reveal", phaseStartedAt: new Date(100_000).toISOString(), nowMs: 100_000 + into };
}

/** The receipt time rooms used before 18 Oct 2026 (from phase_started_at in every phase). */
function oldReceived(puzzle: PuzzleData, receipt: RoomReceipt): number {
  return puzzleTimeLimitMs(puzzle) - (receipt.nowMs - Date.parse(receipt.phaseStartedAt!) - puzzlePrepMs(puzzle));
}

/** The graders log desyncs for junk answers; the check's own output stays readable. */
const out = console.log;
function quiet<T>(fn: () => T): T {
  const saved = [console.log, console.warn, console.error, console.info];
  console.log = console.warn = console.error = console.info = () => {};
  try {
    return fn();
  } finally {
    [console.log, console.warn, console.error, console.info] = saved as [typeof console.log, typeof console.log, typeof console.log, typeof console.log];
  }
}

function compare(label: string, puzzle: PuzzleData, answer: string, ms: number, extra?: Extra) {
  quiet(() => compareLoud(label, puzzle, answer, ms, extra));
}

function compareLoud(label: string, puzzle: PuzzleData, answer: string, claimed: number, extra?: Extra) {
  types.add(puzzle.type);
  // An honest phone never claims more time left than its own last tap allows (some fixture claims do:
  // a room then holds the claim to its receipt, the anti-cheat check practice has no receipt for).
  const ms = Math.min(claimed, Math.max(0, puzzleTimeLimitMs(puzzle) - lastLogMs(answer)));
  let practice: string;
  try {
    practice = view(gradeAnswer(puzzle, answer, ms, extra));
  } catch (error) {
    failures.push(`${label}: practice grading threw (${(error as Error).message})`);
    return;
  }
  const receipts: [string, RoomReceipt][] = [
    ["puzzle phase, 80 ms later", puzzleReceipt(puzzle, ms, 80)],
    ["puzzle phase, 1.2 s later", puzzleReceipt(puzzle, ms, 1200)],
  ];
  // A time-out goes at the buzzer with 0 ms left; a slow uplink can land it in the reveal phase.
  if (ms === 0) receipts.push(["reveal phase +0.1 s", revealReceipt(100)], ["reveal phase +3 s", revealReceipt(3000)]);
  for (const [where, receipt] of receipts) {
    compared++;
    const room = view(gradeRoomAnswer(puzzle, receipt, answer, ms, extra).graded);
    if (receipt.phase === "puzzle") {
      // On time: exactly what submitAnswerFn stored before 18 Oct 2026 (the same receipt, the same clamp).
      const received = oldReceived(puzzle, receipt);
      const limit = puzzleTimeLimitMs(puzzle);
      const before = view(gradeAnswer(puzzle, answer, trustedMsRemaining(ms, received, limit).ms, extra, received));
      onTimeCompared++;
      if (before !== room) failures.push(`${label} (${where}): an on-time answer now grades differently from before the fix`);
    }
    if (room !== practice) {
      failures.push(`${label} (${where}): room ${room.slice(0, 160)} ≠ practice ${practice.slice(0, 160)}`);
      continue;
    }
    if (receipt.phase === "reveal") {
      const before = view(gradeAnswer(puzzle, answer, ms, extra, oldReceived(puzzle, receipt)));
      if (before !== practice) oldWouldDiffer++;
    }
  }
}

/* ------------------------------------------------------------------ 1a. stored puzzle entries */

const legacy = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/puzzle-score-legacy.json.gz")).toString("utf8")) as {
  cases: { type: string; label: string; puzzle: PuzzleData; entries: { answer: string; ms: number }[] }[];
};
for (const c of legacy.cases)
  for (const [i, entry] of c.entries.entries()) {
    // The grader itself is untouched: every stored entry still grades to its recorded score.
    const stored = quiet(() => gradeAnswer(c.puzzle, entry.answer, entry.ms).score);
    if (stored === (entry as unknown as { score: number }).score) storedSame++;
    else failures.push(`${c.type} ${c.label} #${i}: grades ${stored}, recorded ${(entry as unknown as { score: number }).score}`);
    compare(`${c.type} ${c.label} #${i}`, c.puzzle, entry.answer, entry.ms);
    if (entry.ms !== 0) compare(`${c.type} ${c.label} #${i} (timed out)`, c.puzzle, entry.answer, 0);
  }

/* ------------------------------------------------------------------ 1b. tap logs */

interface Run {
  game: "reaction" | "stopwatch" | "numhunt";
  seed: number;
  puzzle: PuzzleData;
  meta: Record<string, number> | null;
  msRemaining: number;
  taps: unknown[];
  watches?: { e: number | null; gap: number | null }[];
}
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
const runs = (JSON.parse(readFileSync("scripts/fixtures/tap-log-honest-runs.json", "utf8")) as { runs: Run[] }).runs;
for (const run of runs) {
  const puzzle = { ...run.puzzle, tapRev: TAP_REV } as PuzzleData;
  const log =
    run.game === "reaction"
      ? encodeTapTimes(run.taps as number[])
      : run.game === "numhunt"
        ? encodeNumberTaps(run.taps as NumberTap[])
        : encodeTapTimes(bangOnLog(puzzle as StopWatchPuzzleData, planWatchLeadIn(run.seed), run.watches!));
  const extra = run.meta
    ? { reactionAvgMs: run.meta["reactionAvgMs"], correctCount: run.meta["correctCount"], errors: run.meta["errors"] }
    : undefined;
  compare(`${run.game} seed ${run.seed}`, puzzle, log, run.msRemaining, extra);
  compare(`${run.game} seed ${run.seed} (timed out)`, puzzle, log, 0, extra);
}

/* ------------------------------------------------------------------ 1c. arcade runs */

const arcade = (JSON.parse(readFileSync("scripts/fixtures/replay-runs.json", "utf8")) as {
  runs: { type: string; label: string; puzzle: PuzzleData; answer: string }[];
}).runs;
for (const run of arcade) {
  compare(`${run.type} ${run.label}`, run.puzzle, run.answer, 0);
  compare(`${run.type} ${run.label} (time left)`, run.puzzle, run.answer, 4000);
}

/* ------------------------------------------------------------------ 1d. every active game */

for (const type of ACTIVE_PUZZLE_TYPES) {
  const puzzle = withSeededRandom(18_10_2026, () => generatePuzzle(type)) as PuzzleData;
  for (const answer of ["", "x", "1,2,3"]) for (const ms of [0, 9000]) compare(`${type} "${answer}"`, puzzle, answer, ms);
}
const missing = ACTIVE_PUZZLE_TYPES.filter((type) => !types.has(type));
if (missing.length) failures.push(`active games never compared: ${missing.join(", ")}`);

/* ------------------------------------------------------------------ 2. the room page */

const route = readFileSync("src/routes/duel.$code.tsx", "utf8");
const server = readFileSync("src/lib/duel/duel.functions.ts", "utf8");
const src = (cond: boolean, label: string) => {
  compared++;
  if (!cond) failures.push(label);
};
const submitBody = route.split("const handleSubmit = useCallback(")[1]?.split("const handleDraftAnswer")[0] ?? "";
// One answer per round through the room sender (roomSend.ts, room-send-check), drafts through the
// device keeper (roomDraft.ts, room-draft-check).
src(/if \(sender\.claimed\(sent\)\) return;/.test(submitBody) && /sender\.send\(\s*sent,/.test(submitBody), "handleSubmit sends at most once per round");
src(/\} else if \(phase !== "reveal"\) return;\s*if \(sender\.claimed\(key\)\) return;/.test(route), "the draft is sent when the room reached the reveal first");
src(/answer: drafts\.current\(stateKey\)/.test(route), "only this round's draft is sent");
src(/drafts\.push\(latest\.current\.stateKey, answer\);/.test(route), "drafts carry their round");
src(/drafts\.prune\(stateKey\);/.test(route) && !/clearStageState\(stateKey\)/.test(route), "a restored draft for this round survives the round's reset");
src(/r\.round_number === round && roomPlayers\.some\(\(p\) => p\.player_slot === r\.player_slot && p\.status === "active"\)/.test(route), "the phone counts active players' answers only");
src((server.match(/await activeAnsweredCount\(client,/g) ?? []).length === 2, "both server functions count active players' answers only");
src(!/submissionCount/.test(server), "no server count of every answer row is left");
src(/const \{ gradeRoomAnswer \} = await import\("\.\/roomGrade\.server"\);/.test(server) && !/gradeAnswer\(puzzle, data\.answer/.test(server), "submitAnswerFn grades through gradeRoomAnswer");
// Stored rounds are never regraded: the only graders are a new room answer (submitAnswerFn, which
// inserts once and keeps an existing row) and practice; nothing in the app updates or deletes a
// round_results row, so every stored score stays exactly as it was.
{
  const { readdirSync, statSync } = await import("node:fs");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = `${dir}/${name}`;
      return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
    });
  const graders: string[] = [];
  const writes: string[] = [];
  for (const file of walk("src")) {
    const text = readFileSync(file, "utf8");
    if (/\bgradeAnswer\(|\bgradeRoomAnswer\(/.test(text) && !/src\/lib\/duel\/(generate|roomGrade)\.server\.ts$/.test(file)) graders.push(file);
    if (/from\("round_results"\)\s*\.(update|delete|upsert)\(/.test(text)) writes.push(file);
  }
  // Async rooms (21 Oct 2026, the daily challenge): asyncRoom.server.ts grades a new answer once, its
  // store guarded on the round not yet answered (daily-check proves the first stored answer stands).
  src(
    graders.sort().join(",") === "src/lib/duel/asyncRoom.server.ts,src/lib/duel/duel.functions.ts,src/lib/duel/practice.functions.ts" &&
      /\.eq\("answered", false\)/.test(readFileSync("src/lib/duel/asyncRoom.server.ts", "utf8")),
    `grading runs only for new answers (found in ${graders.join(", ")})`,
  );
  src(writes.length === 0, `round_results rows are rewritten in ${writes.join(", ")}`);
  const submit = server.slice(server.indexOf("export const submitAnswerFn"), server.indexOf("export const readyUpFn"));
  src(/if \(existing\.data\) return \{ ok: true as const, alreadySubmitted: true \};/.test(submit) && submit.indexOf("existing.data") < submit.indexOf("gradeRoomAnswer("), "a stored answer is never graded again");
  src(/if \(error && error\.code !== UNIQUE_VIOLATION\)/.test(submit), "a second insert never replaces the stored row");
}
const practiceFn = readFileSync("src/lib/duel/practice.functions.ts", "utf8");
src(/gradeAnswer\(puzzle, [^)]*\)/.test(practiceFn), "practice grades with gradeAnswer");

console.log(`${compared} room/practice comparisons over ${types.size} games (${ACTIVE_PUZZLE_TYPES.length} active, all covered)`);
console.log(`before the fix, ${oldWouldDiffer} reveal-phase receipts would have scored differently from practice`);
console.log(`${onTimeCompared} on-time (puzzle-phase) answers grade exactly as before the fix; ${storedSame} stored entries still grade to their recorded score`);
if (oldWouldDiffer === 0) failures.push("the fixtures no longer exercise the reveal-phase receipt (expected some old-path differences)");
if (failures.length) {
  console.log(`FAIL: ${failures.length} problems`);
  for (const failure of failures.slice(0, 400)) console.log(`  - ${failure}`);
  process.exit(1);
}
console.log("PASS: the same play scores the same in a room and in practice");
process.exit(0);
