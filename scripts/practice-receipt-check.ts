/**
 * practice-receipt-check (7 Nov 2026, scoring audit issue 16e): practice holds the phone's time claim to the server's
 * receipt, as rooms do (src/lib/duel/practiceReceipt.ts).
 *
 *  1. The rules: the start is the start token's time, held to dealtAt + INTRO_MS + PRACTICE_START_SLACK_MS; with no
 *     token, dealtAt + INTRO_MS; a deal sealed without dealtAt has no bound (the old length clamp). A token from
 *     before the deal is ignored.
 *  2. The same honest run grades the same in practice as in a room (gradeRoomAnswer) for every active game, with the
 *     token's start as the room's phase start, received 80 ms and 1.2 s after the phone sent it; an inflated claim is
 *     cut to the server's figure in both; a run with no token that tapped Ready early is never cut.
 *  3. Source: the phone asks for the token when the round's clock starts (live deals only) and sends it with the
 *     answer; every unseal path drops the deal's time, so it never reaches a puzzle, a check or a stored demo.
 *
 *   bun scripts/practice-receipt-check.ts
 */
import { readFileSync } from "node:fs";

import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { ACTIVE_PUZZLE_TYPES, puzzlePrepMs, puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { TIME_CLAIM_TOLERANCE_MS } from "../src/lib/duel/grade";
import { gradeRoomAnswer } from "../src/lib/duel/roomGrade.server";
import {
  PRACTICE_START_SLACK_MS,
  practiceReceiptMsRemaining,
  practiceStartMs,
  practiceTrustedMs,
} from "../src/lib/duel/practiceReceipt";
import { INTRO_MS, type PuzzleData } from "../src/lib/duel/types";

const failures: string[] = [];
let passed = 0;
function ok(cond: boolean, what: string): void {
  if (cond) passed++;
  else failures.push(what);
}

const view = (g: ReturnType<typeof gradeAnswer>) =>
  JSON.stringify({ score: g.score, isCorrect: g.isCorrect, storedMs: g.storedMs, correctCount: g.correctCount, errors: g.errors, extra: g.extra }).replace(
    /\\?"replayMs\\?":[\d.]+/g,
    "",
  );

/* 1. The rules. */
const D = 1_000_000;
ok(practiceStartMs({ nowMs: D + 60_000 }) === undefined, "no dealtAt: no bound");
ok(practiceStartMs({ dealtAt: D, nowMs: D + 60_000 }) === D + INTRO_MS, "no token: the intro's own start");
ok(practiceStartMs({ dealtAt: D, startAt: D + 12_000, nowMs: D + 60_000 }) === D + 12_000, "a token: its own time");
ok(practiceStartMs({ dealtAt: D, startAt: D + INTRO_MS + PRACTICE_START_SLACK_MS + 40_000, nowMs: D + 200_000 }) === D + INTRO_MS + PRACTICE_START_SLACK_MS, "a late token: held to the latest honest start");
ok(practiceStartMs({ dealtAt: D, startAt: D - 5, nowMs: D + 60_000 }) === D + INTRO_MS, "a token from before the deal is ignored");
ok(practiceStartMs({ dealtAt: D, startAt: Number.NaN, nowMs: D + 60_000 }) === D + INTRO_MS, "a broken token is ignored");

/* 2. Practice = room for the same honest run; inflated claims cut. */
let games = 0;
let compared = 0;
let cut = 0;
for (const type of ACTIVE_PUZZLE_TYPES) {
  let puzzle: PuzzleData;
  try {
    puzzle = withSeededRandom(4242, () => generatePuzzle(type)) as PuzzleData;
  } catch {
    continue; // banked types that need a database row (Gridlock) are covered by room-practice-grade-check
  }
  games++;
  const limit = puzzleTimeLimitMs(puzzle);
  const prep = puzzlePrepMs(puzzle);
  const dealtAt = D;
  const startAt = D + 9_000; // Ready tapped 9 s into the intro (the server's time for it)
  for (const usedMs of [Math.floor(limit / 3), limit]) {
    const claim = Math.max(0, limit - usedMs);
    const sentAt = startAt + prep + usedMs;
    for (const lag of [80, 1_200]) {
      const nowMs = sentAt + lag;
      for (const answer of ["", "junk"]) {
        const room = gradeRoomAnswer(puzzle, { phase: "puzzle", phaseStartedAt: new Date(startAt).toISOString(), nowMs }, answer, claim);
        const received = practiceReceiptMsRemaining(puzzle, { dealtAt, startAt, nowMs });
        const { ms, clamped } = practiceTrustedMs(puzzle, claim, received);
        const practice = gradeAnswer(puzzle, answer, ms, undefined, received);
        compared++;
        ok(view(room.graded) === view(practice) && room.clamped === clamped, `${type}: practice = room (used ${usedMs} ms, lag ${lag}, ${answer || "empty"})`);
        ok(!clamped, `${type}: an honest claim is never cut (lag ${lag})`);
        // No token: the run started before the intro's own start, so its claim is under that bound too.
        const loose = practiceReceiptMsRemaining(puzzle, { dealtAt, nowMs });
        ok(!practiceTrustedMs(puzzle, claim, loose).clamped, `${type}: no token, Ready tapped early: never cut`);
      }
    }
    // An inflated claim (a modified phone): the whole limit left, sent after `usedMs`.
    if (usedMs > TIME_CLAIM_TOLERANCE_MS * 2) {
      const nowMs = startAt + prep + usedMs + 80;
      const received = practiceReceiptMsRemaining(puzzle, { dealtAt, startAt, nowMs });
      const t = practiceTrustedMs(puzzle, limit, received);
      const room = gradeRoomAnswer(puzzle, { phase: "puzzle", phaseStartedAt: new Date(startAt).toISOString(), nowMs }, "", limit);
      ok(t.clamped && t.ms === room.msLeft && room.clamped, `${type}: an inflated claim is cut to the server's figure, as in a room`);
      // Leaving the token out gives no more than a start at the intro's end.
      const noToken = practiceTrustedMs(puzzle, limit, practiceReceiptMsRemaining(puzzle, { dealtAt, nowMs: dealtAt + INTRO_MS + prep + usedMs + 80 }));
      ok(noToken.clamped && noToken.ms <= limit - usedMs, `${type}: no token: the claim held as if started at the intro's end`);
      cut++;
    }
  }
  // A deal sealed before the bound: the claim as it is (gradeAnswer's length clamp).
  ok(practiceTrustedMs(puzzle, limit + 5_000, undefined).ms === limit + 5_000, `${type}: an older seal keeps the old rule`);
}
ok(games >= 80, `every active game that deals without a database is compared (${games})`);

/* 3. Source. */
const page = readFileSync("src/routes/practice.tsx", "utf8");
const fns = readFileSync("src/lib/duel/practice.functions.ts", "utf8");
const seal = readFileSync("src/lib/duel/practiceSeal.server.ts", "utf8");
ok(/const beginRound = useCallback\([\s\S]*?practiceStartFn\(\{ data: \{ sealed \} \}\)[\s\S]*?setStage\("puzzle"\)/.test(page), "the phone asks for the start token as the round's clock starts");
ok((page.match(/beginRound\(\);/g) ?? []).length >= 2, "both ways into the round (Ready and the intro's end) go through beginRound");
ok(!/setStartedAt\(Date\.now\(\)\);\s*setStage\("puzzle"\)/.test(page.replace(/const beginRound[\s\S]*?\}, \[sealed\]\);/, "")), "no other path starts the round without the token");
ok(/packSeed\.current === null && sealed/.test(page), "pack runs ask for no token (they are graded on the phone's clock)");
ok(/\.\.\.\(start \? \{ start \} : \{\}\)/.test(page), "the answer carries the token");
ok((fns.match(/__dealtAt: Date\.now\(\)/g) ?? []).length === 2, "live deals and the intro example are sealed with the deal's time");
ok(!/__pack: seed[^\n]*__dealtAt/.test(fns), "pack deals carry no deal time");
ok(/__dealtAt: at, \.\.\.priv \} = raw;/.test(seal) && /dealtAt = typeof at === "number"/.test(seal), "openDeal drops the deal's time from the private half and returns it apart");
ok(!/unsealRaw\([^)]*\)[^\n]*\.\.\.priv/.test(fns), "practice.functions merges no sealed half but openDeal's");
ok(/practiceReceiptMsRemaining\(puzzle, \{ dealtAt, startAt, nowMs \}\)/.test(fns) && /startAtFor\(data\.start, /.test(fns), "the grade bounds the claim with the deal's time and the token");
ok(/raw\["__for"\] !== \(await tokenDigest\(sealed\)\)/.test(seal), "a token from another deal is refused");
ok(/practiceTrustedMs\(puzzle, data\.msRemaining, received\)/.test(fns) && /gradeAnswer\(puzzle, data\.answer, ms, data\.extra, bound\)/.test(fns), "the bounded time and the receipt reach gradeAnswer");

console.log(`practice-receipt-check: ${games} games, ${compared} practice/room comparisons, ${cut} inflated claims cut`);
if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  FAIL ${f}`);
  console.log(`FAIL: ${failures.length} of ${passed + failures.length} checks`);
  process.exit(1);
}
console.log(`PASS: ${passed} checks`);
