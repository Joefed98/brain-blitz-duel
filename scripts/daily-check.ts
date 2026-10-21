/**
 * daily-check (21 Oct 2026): the async-room engine (src/lib/duel/asyncRoom.server.ts) and the daily
 * challenge (daily.ts, daily.server.ts), on the real server code with the in-memory database the
 * room checks use (scripts/fixtures/memoryDb.ts), and the migration on a local PostgreSQL. Proves:
 *
 *  1. The set is the same for every device: the day's first start deals and stores it once, racing
 *     starts and later devices get the stored room; Daily Puzzle is one active game per puzzle
 *     category, Daily Arcade three different active arcade games, never a retired game (Letterfall
 *     included), never yesterday's games (2,000 seeds).
 *  2. One attempt per device per daily (sequential and racing starts); rate-limit and name refusal
 *     run before any deal.
 *  3. Puzzles hidden until each round starts: the stored room and every reply before a round's
 *     start carry no puzzle and no secret field; rounds start in order; a reveal (the private half)
 *     only once the caller's own result is stored; word and move checks only while the clock runs.
 *  4. Grades equal practice: stored answers of 47 games (puzzle-score-legacy), arcade runs
 *     (replay-runs) and every active game's empty answer, played through start → submit on the
 *     player's own clock, store exactly what practice's gradeAnswer gives (in time, and as a
 *     time-out received late); a time claim beyond the server's start is clamped (the 1.5 s check);
 *     a round with no answer by its close is missed, scores 0 and is recorded as abandoned.
 *  5. Midnight UK: day keys and windows in GMT and BST and across both clock changes (23 and 25 h),
 *     a new room after midnight, no round starts after midnight, a round started before it is still
 *     graded, unplayed rounds score 0 on the closed board.
 *  6. Ties: the board's places equal the room's standings (scoring.ts) for the same results,
 *     shared places included.
 *  7. The name filter refuses offensive names and leaves ordinary ones alone.
 *  8. The player count shows only from 20 players; today's board stays closed until you finish.
 *  9. Beta events: attempt and round starts, finishes and abandons, each once.
 * 10. SQL (local PostgreSQL when found, as beta-recording-check): the migration applies after every
 *     other one; clients can't write any daily table, can't read results, secrets, events or the
 *     rooms' puzzles; can read only the leaderboard columns, and other players' attempts only once
 *     their own is finished or the day has closed; one attempt per device is a unique index; the
 *     beta queries (docs/beta-sql.md section 7) run.
 *
 *   bun scripts/daily-check.ts
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import {
  asyncRoundReveal,
  attemptFor,
  attemptView,
  createAsyncRoom,
  gradeAsyncAnswer,
  liveRoundPuzzle,
  startAsyncRound,
  startAttempt,
  submitAsyncAnswer,
  type AsyncRoomRow,
} from "../src/lib/duel/asyncRoom.server";
import { asyncRoundWindow } from "../src/lib/duel/asyncRoom";
import {
  DAILY_COUNT_MIN,
  DAILY_PUZZLE_CATEGORIES,
  dailyRoomKey,
  rankBoard,
  shiftDayKey,
  ukDayKey,
  ukDayWindow,
} from "../src/lib/duel/daily";
import { dailyBoard, dailyRoundOrder, dailyStatus, dealDaily, ensureDailyRoom } from "../src/lib/duel/daily.server";
import { dailyStreak } from "../src/lib/duel/dailyRecord";
import { offensiveName } from "../src/lib/duel/boardName.server";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { ACTIVE_PUZZLE_TYPES, PUZZLE_REGISTRY, puzzlePrepMs, puzzleTimeLimitMs, typesInCategory } from "../src/lib/duel/registry";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { standings } from "../src/lib/duel/scoring";
import { roomTieRounds, stampTieRev } from "../src/lib/duel/tieBreak";
import type { DuelPlayerRow, PuzzleData, RoundResultRow } from "../src/lib/duel/types";
import { memoryDb } from "./fixtures/memoryDb";

let passes = 0;
const failures: string[] = [];
function check(ok: boolean, message: string) {
  if (ok) passes++;
  else {
    failures.push(message);
    console.log(`  FAIL ${message}`);
  }
}
const quietWarn = console.warn;
const quietLog = console.log;
console.warn = () => undefined;
/** Runs `fn` with the server's own [daily] / [beta-record] lines silenced. */
async function quiet<T>(fn: () => Promise<T> | T): Promise<T> {
  const log = console.log;
  const error = console.error;
  console.log = () => undefined;
  console.error = () => undefined;
  try {
    return await fn();
  } finally {
    console.log = log;
    console.error = error;
  }
}

const UNIQUE = {
  async_rooms: ["room_key"],
  async_attempts: ["room_id", "user_id"],
  async_results: ["attempt_id", "round_number"],
  async_events: ["attempt_id", "round_number", "event"],
  async_room_secrets: ["room_id"],
};
const store = () => memoryDb({ async_rooms: [], async_attempts: [], async_results: [], async_events: [], async_room_secrets: [] }, { unique: UNIQUE });
const ME = { name: "Ali", colour: 2, icon: null };
const at = (iso: string) => Date.parse(iso);
const SECRET_FIELDS = (puzzle: PuzzleData) => Object.keys(splitPuzzle(puzzle).priv).filter((k) => k !== "type");

/* ------------------------------------------------------------- 5. UK days */
{
  check(ukDayKey(at("2026-10-26T23:59:59Z")) === "2026-10-26", "GMT: 23:59:59 UTC is still the 26th in the UK");
  check(ukDayKey(at("2026-10-27T00:00:00Z")) === "2026-10-27", "GMT: midnight UTC is the 27th in the UK");
  check(ukDayKey(at("2026-07-01T22:59:59Z")) === "2026-07-01", "BST: 22:59:59 UTC is still 1 July");
  check(ukDayKey(at("2026-07-01T23:00:00Z")) === "2026-07-02", "BST: 23:00 UTC is 2 July in the UK");
  const back = ukDayWindow("2026-10-25");
  check(back.closesAt - back.opensAt === 25 * 3600_000, "the clocks-back day (25 Oct 2026) runs 25 hours");
  check(back.opensAt === at("2026-10-24T23:00:00Z") && back.closesAt === at("2026-10-26T00:00:00Z"), "the clocks-back day opens 23:00 UTC and closes midnight UTC");
  const forward = ukDayWindow("2027-03-28");
  check(forward.closesAt - forward.opensAt === 23 * 3600_000, "the clocks-forward day (28 Mar 2027) runs 23 hours");
  const beta = ukDayWindow("2026-10-27");
  check(beta.opensAt === at("2026-10-27T00:00:00Z") && beta.closesAt === at("2026-10-28T00:00:00Z"), "27 Oct 2026 (GMT) is midnight to midnight UTC");
  check(shiftDayKey("2026-10-31", 1) === "2026-11-01" && shiftDayKey("2026-01-01", -1) === "2025-12-31", "day keys roll over months and years");
  check(dailyRoomKey("puzzle", "2026-10-27") === "daily_puzzle:2026-10-27", "one room key per daily per day");
  check(dailyStreak(["2026-10-25", "2026-10-26", "2026-10-27"], "2026-10-27") === 3, "streak: three days ending today");
  check(dailyStreak(["2026-10-25", "2026-10-26"], "2026-10-27") === 2, "streak: still 2 while today is open");
  check(dailyStreak(["2026-10-24", "2026-10-26"], "2026-10-28") === 0, "streak: a missed day ends it");
}

/* ----------------------------------------------------------- 1. the deal */
{
  const retired = Object.keys(PUZZLE_REGISTRY).filter((t) => PUZZLE_REGISTRY[t as never].retired);
  check(retired.includes("wordfall"), "Letterfall is retired (practice only)");
  let bad = 0;
  let repeats = 0;
  for (let seed = 1; seed <= 2000; seed++) {
    const yesterday = dailyRoundOrder("puzzle", seed * 7919, []);
    const order = dailyRoundOrder("puzzle", seed, [yesterday]);
    const cats = order.map((t) => PUZZLE_REGISTRY[t].category);
    if (order.length !== 6 || new Set(cats).size !== 6 || !DAILY_PUZZLE_CATEGORIES.every((c) => cats.includes(c))) bad++;
    if (order.some((t) => retired.includes(t) || !ACTIVE_PUZZLE_TYPES.includes(t))) bad++;
    if (order.some((t) => yesterday.includes(t))) repeats++;
    const yA = dailyRoundOrder("arcade", seed * 31, []);
    const arcade = dailyRoundOrder("arcade", seed, [yA]);
    if (arcade.length !== 3 || new Set(arcade).size !== 3) bad++;
    if (arcade.some((t) => !typesInCategory("arcade").includes(t) || retired.includes(t))) bad++;
    if (arcade.some((t) => yA.includes(t))) repeats++;
  }
  check(bad === 0, `2,000 seeds: Daily Puzzle one active game per category, Daily Arcade 3 different active arcade games, nothing retired (${bad} bad)`);
  check(repeats === 0, `2,000 seeds: no game from the previous day repeats (${repeats} repeats)`);
  const a = await quiet(() => dealDaily("arcade", { seed: 42 }));
  const b = await quiet(() => dealDaily("arcade", { seed: 42 }));
  check(JSON.stringify(a.roundOrder) === JSON.stringify(b.roundOrder), "the same seed deals the same games");
  check(a.puzzles.every((p) => (p as { tieRev?: number }).tieRev === 1), "every dealt round carries the room tie-break stamp");
}

/* ---------------------------------- 1, 2, 3, 8, 9: rooms, attempts, hiding */
const NOW = at("2026-10-27T12:00:00Z");
{
  const db = store();
  const [r1, r2] = await quiet(() =>
    Promise.all([ensureDailyRoom(db.client, "puzzle", NOW, "u1"), ensureDailyRoom(db.client, "puzzle", NOW + 5, "u2")]),
  );
  const r3 = await quiet(() => ensureDailyRoom(db.client, "puzzle", NOW + 60_000, "u3"));
  check(r1.id === r2.id && r2.id === r3.id, "racing and later starts all get the one stored room");
  check(db.tables.async_rooms!.length === 1, "the day's room is stored once");
  check(r1.room_key === "daily_puzzle:2026-10-27" && r1.round_count === 6, "Daily Puzzle: today's key, 6 rounds");
  const stored = db.tables.async_rooms![0] as unknown as AsyncRoomRow;
  const secretsLeak = stored.puzzles_public.some((p) => {
    const full = { ...p, ...((db.tables.async_room_secrets![0] as { puzzles_private: Record<string, unknown>[] }).puzzles_private[stored.puzzles_public.indexOf(p)] ?? {}) } as PuzzleData;
    return SECRET_FIELDS(full).some((k) => k in p);
  });
  check(!secretsLeak, "the room's public halves carry no secret field (they live in async_room_secrets)");
  check(Date.parse(stored.closes_at) === at("2026-10-28T00:00:00Z"), "the room closes at UK midnight");

  const yesterdayRoom = await quiet(() => ensureDailyRoom(db.client, "arcade", NOW - 86_400_000, "u1"));
  const todayArcade = await quiet(() => ensureDailyRoom(db.client, "arcade", NOW, "u1"));
  check(yesterdayRoom.id !== todayArcade.id, "a new day deals a new room");
  check(!todayArcade.round_order.some((t) => yesterdayRoom.round_order.includes(t)), "today's arcade games avoid yesterday's");

  // One attempt per device.
  const first = await startAttempt(db.client, r1, "dev-a", ME, NOW);
  const again = await startAttempt(db.client, r1, "dev-a", { ...ME, name: "Other" }, NOW + 1000);
  const [x, y] = await Promise.all([startAttempt(db.client, r1, "dev-b", ME, NOW), startAttempt(db.client, r1, "dev-b", ME, NOW)]);
  check(first.ok && first.created && again.ok && !again.created && again.attempt.id === first.attempt.id, "a second start returns the same attempt");
  check(x.ok && y.ok && x.attempt.id === y.attempt.id && db.tables.async_attempts!.filter((r) => r.user_id === "dev-b").length === 1, "racing starts make one attempt");
  check(again.ok && again.attempt.display_name === "Ali", "a second start can't rename the attempt");

  // Nothing about a round before it starts.
  const attempt = first.ok ? first.attempt : (null as never);
  const { view } = await attemptView(db.client, r1, attempt, NOW);
  check(!JSON.stringify(view).includes("puzzles") && view.rounds.every((r) => r.startedAt === null && r.score === null), "the attempt view carries no puzzle");
  const early = await startAsyncRound(db.client, r1, attempt, 2, NOW);
  check(!early.ok, "round 2 can't start before round 1 is done");
  const notYet = await asyncRoundReveal(db.client, r1, attempt, 1);
  check(!notYet.ok, "no reveal before the round is played");
  const started = await startAsyncRound(db.client, r1, attempt, 1, NOW + 2000);
  check(started.ok && started.puzzle.type === r1.round_order[0], "round 1 starts and its puzzle arrives");
  if (started.ok) {
    const full = { ...started.puzzle, ...((db.tables.async_room_secrets![0] as { puzzles_private: Record<string, unknown>[] }).puzzles_private[0] ?? {}) } as PuzzleData;
    check(SECRET_FIELDS(full).every((k) => !(k in started.puzzle)), "the started round's puzzle is its public half only");
    const resumed = await startAsyncRound(db.client, r1, attempt, 1, NOW + 9000);
    check(resumed.ok && resumed.startedAt === started.startedAt, "a reload gets the same round on the same clock");
    const live = await liveRoundPuzzle(db.client, r1, attempt, 1, NOW + 2500);
    check(!!live, "word and move checks open while the round's clock runs");
    const window = asyncRoundWindow(started.puzzle, started.startedAt);
    check(!(await liveRoundPuzzle(db.client, r1, attempt, 1, window.lateFrom + 1)), "word and move checks closed once only late answers are left");
    const sub = await submitAsyncAnswer(db.client, r1, attempt, { round: 1, answer: "", msRemaining: 1000 }, NOW + 4000);
    const twice = await submitAsyncAnswer(db.client, r1, attempt, { round: 1, answer: "x", msRemaining: 1000 }, NOW + 4100);
    check(sub.ok && !sub.alreadySubmitted && twice.ok && twice.alreadySubmitted === true, "the first stored answer stands");
    const reveal = await asyncRoundReveal(db.client, r1, attempt, 1);
    check(reveal.ok && SECRET_FIELDS(reveal.puzzle).every((k) => k in reveal.puzzle), "the reveal (with the private half) opens once the result is stored");
    check(!(await liveRoundPuzzle(db.client, r1, attempt, 1, NOW + 4200)), "no word checks after the round is answered");
  }
  // Another device's reveal never opens on this one's attempt.
  const other = await attemptFor(db.client, r1.id, "dev-b");
  check(other !== null && !(await asyncRoundReveal(db.client, r1, other!, 1)).ok, "another device's attempt can't reveal a round it hasn't played");

  // Beta events, once each.
  const events = db.tables.async_events!.map((e) => `${e.attempt_id}:${e.round_number}:${e.event}`);
  check(new Set(events).size === events.length, "beta events are recorded once each");
  check(events.includes(`${attempt.id}:0:attempt_started`) && events.includes(`${attempt.id}:1:round_started`) && events.includes(`${attempt.id}:1:round_finished`), "attempt start, round start and finish are recorded");

  // Status: hidden before the migration (no table), else per daily.
  const missing = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { code: "42P01", message: "relation does not exist" } }) }) }) }) };
  check((await dailyStatus(missing, "dev-a", NOW)).available === false, "before the migration the daily is unavailable (card hidden)");
  const status = await dailyStatus(db.client, "dev-a", NOW + 5000);
  check(status.available && status.puzzle.state === "continue" && status.arcade.state === "play", "status: Continue for a started daily, Play for an untouched one");
  const signedOut = await dailyStatus(db.client, null, NOW + 5000);
  check(signedOut.available && signedOut.puzzle.state === "play", "status needs no session: a signed-out visitor sees Play");
  check(!/requireSupabaseAuth\]\)\s*\.handler\(\s*async \(\{ context \}\): Promise<DailyStatus>/.test(readFileSync("src/lib/duel/daily.functions.ts", "utf8")) && !/await ensureSession\(\);\s*return \(await dailyStatusFn/.test(readFileSync("src/lib/duel/asyncApi.ts", "utf8")), "the Play card's status call never signs a visitor in");
}

/* ------------------------------------------ 4. grades equal practice (+ timing) */
type Graded = ReturnType<typeof gradeAnswer>;
const view = (g: { score: number; is_correct?: boolean; isCorrect?: boolean; ms_remaining?: number; storedMs?: number; extra?: unknown }) =>
  JSON.stringify({ score: g.score, correct: g.isCorrect ?? g.is_correct, ms: g.storedMs ?? g.ms_remaining, extra: g.extra ?? null }).replace(
    /\\?"replayMs\\?":[\d.]+/g,
    "",
  );
async function playOne(puzzle: PuzzleData, answer: string, claimedMs: number, receiveAfterMs: number) {
  const db = store();
  const opensAt = NOW - 3600_000;
  const room = await createAsyncRoom(db.client, {
    kind: "challenge",
    key: `c-${Math.random()}`,
    day: null,
    seed: 1,
    puzzles: [puzzle],
    opensAt,
    closesAt: NOW + 3600_000,
    createdBy: null,
  });
  const started = await startAttempt(db.client, room, "dev", ME, NOW);
  if (!started.ok) throw new Error("no attempt");
  const round = await startAsyncRound(db.client, room, started.attempt, 1, NOW);
  if (!round.ok) throw new Error("no round");
  await submitAsyncAnswer(db.client, room, started.attempt, { round: 1, answer, msRemaining: claimedMs }, NOW + receiveAfterMs);
  return db.tables.async_results![0] as { score: number; is_correct: boolean; ms_remaining: number; extra: unknown; missed: boolean };
}
{
  let compared = 0;
  const differs: string[] = [];
  const legacy = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/puzzle-score-legacy.json.gz")).toString("utf8")) as {
    cases: { type: string; label: string; puzzle: PuzzleData; entries: { answer: string; ms: number }[] }[];
  };
  /** The last round-clock ms a tap log carries: an honest phone never claims more time than that leaves. */
  const lastLogMs = (answer: string) =>
    answer.startsWith("log1:")
      ? Math.max(0, ...answer.slice(5).split(",").map((item) => Number(item.includes("@") ? item.split("@")[1] : item)).filter(Number.isFinite))
      : 0;
  const compare = async (label: string, puzzle: PuzzleData, answer: string, claimed: number) => {
    const limit = puzzleTimeLimitMs(puzzle);
    const ms = Math.min(claimed, Math.max(0, limit - lastLogMs(answer)));
    const prep = puzzlePrepMs(puzzle);
    const practice = await quiet(() => gradeAnswer(puzzle, answer, ms));
    // In time: sent with `ms` left, received 80 ms later on the player's own clock.
    if (ms > 0) {
      const row = await quiet(() => playOne(puzzle, answer, ms, prep + (limit - ms) + 80));
      compared++;
      if (view(row) !== view(practice)) differs.push(`${label} in time`);
    }
    // A time-out at the buzzer received late (0 ms left), as a room's reveal-phase answer.
    const late = await quiet(() => gradeAnswer(puzzle, answer, 0));
    const window = asyncRoundWindow(puzzle, 0);
    const row = await quiet(() => playOne(puzzle, answer, 0, window.lateFrom + 100));
    compared++;
    if (view(row) !== view(late)) differs.push(`${label} late`);
  };
  for (const c of legacy.cases)
    for (const [i, entry] of c.entries.entries()) if (i % 4 === 0) await compare(`${c.type} ${c.label} #${i}`, c.puzzle, entry.answer, entry.ms);
  const arcade = (JSON.parse(readFileSync("scripts/fixtures/replay-runs.json", "utf8")) as { runs: { type: string; label: string; puzzle: PuzzleData; answer: string }[] }).runs;
  for (const run of arcade) await compare(`${run.type} ${run.label}`, run.puzzle, run.answer, 0);
  for (const type of ACTIVE_PUZZLE_TYPES) {
    const puzzle = withSeededRandom(21_10_2026, () => generatePuzzle(type)) as PuzzleData;
    await compare(`${type} empty`, puzzle, "", 9000);
  }
  check(differs.length === 0, `${compared} async grades equal practice's (${differs.slice(0, 5).join("; ") || "all"})`);
  console.log(`  compared ${compared} async grades with practice`);

  // The 1.5 s check holds to the player's own start: a claim of more time than the server allows is cut.
  const puzzle = withSeededRandom(5, () => generatePuzzle("lightsout")) as PuzzleData;
  const limit = puzzleTimeLimitMs(puzzle);
  const honest = await quiet(() => gradeAsyncAnswer(puzzle, NOW, NOW + 10_000, "", limit - 10_000));
  const greedy = await quiet(() => gradeAsyncAnswer(puzzle, NOW, NOW + 10_000, "", limit - 2_000));
  check(!honest.clamped && greedy.clamped && greedy.msLeft <= limit - 10_000 + 1, "a time claim beyond the player's own round start is clamped");

  // No answer by the round's close: missed, 0, abandoned.
  const db = store();
  const room = await createAsyncRoom(db.client, { kind: "challenge", key: "miss", day: null, seed: 1, puzzles: [puzzle, puzzle], opensAt: NOW - 1000, closesAt: NOW + 3600_000, createdBy: null });
  const att = await startAttempt(db.client, room, "dev", ME, NOW);
  if (att.ok) {
    await startAsyncRound(db.client, room, att.attempt, 1, NOW);
    const closes = asyncRoundWindow(puzzle, NOW).closesAt;
    const tooLate = await submitAsyncAnswer(db.client, room, att.attempt, { round: 1, answer: "", msRemaining: 0 }, closes + 1);
    const row = db.tables.async_results![0] as { missed: boolean; score: number };
    check(!tooLate.ok && row.missed && row.score === 0, "an answer after the round's close is refused and the round is missed (0)");
    check(db.tables.async_events!.some((e) => e.event === "round_abandoned" && e.round_number === 1 && e.reason === "no_answer"), "a missed round is recorded as abandoned");
    const next = await startAsyncRound(db.client, room, att.attempt, 2, closes + 2);
    check(next.ok, "the next round can start after a missed one");
  }
}

/* ------------------------------------- 5. midnight, 6. ties, 8. board and count */
{
  const db = store();
  const day = "2026-10-27";
  const { closesAt } = ukDayWindow(day);
  const before = closesAt - 120_000;
  const room = await quiet(() => ensureDailyRoom(db.client, "arcade", before, "dev-0"));
  // 25 players: each plays round 1 with an empty answer at a different moment (scores 0, so the
  // tie-break decides), pairs on the same moment share a place; some finish, some don't.
  const players = Array.from({ length: 25 }, (_, i) => `dev-${i}`);
  for (const [i, dev] of players.entries()) {
    const started = await startAttempt(db.client, room, dev, { name: `P${i}`, colour: i % 10, icon: null }, before);
    if (!started.ok) continue;
    const rounds = i < 22 ? 3 : 1;
    for (let r = 1; r <= rounds; r++) {
      const s = await startAsyncRound(db.client, room, started.attempt, r, before - 3000);
      if (!s.ok) continue;
      const used = 1000 + Math.floor(i / 2) * 500;
      await quiet(() => submitAsyncAnswer(db.client, room, started.attempt, { round: r, answer: "", msRemaining: puzzleTimeLimitMs(s.puzzle) - used }, before - 3000 + puzzlePrepMs(s.puzzle) + used));
    }
  }
  // After midnight: no round starts, but a round started before it is still graded.
  const late = await startAttempt(db.client, room, "late", ME, closesAt + 1);
  check(!late.ok, "no attempt starts after midnight");
  const partial = await attemptFor(db.client, room.id, "dev-23");
  const afterMidnight = await startAsyncRound(db.client, room, partial!, 2, closesAt + 1);
  check(!afterMidnight.ok, "no round starts after midnight");
  const tight = await startAttempt(db.client, room, "tight", { name: "Tight", colour: 0, icon: null }, closesAt - 1000);
  if (tight.ok) {
    const s = await startAsyncRound(db.client, room, tight.attempt, 1, closesAt - 900);
    const res = s.ok ? await quiet(() => submitAsyncAnswer(db.client, room, tight.attempt, { round: 1, answer: "", msRemaining: 0 }, closesAt + 200)) : null;
    check(!!res && res.ok && !res.alreadySubmitted, "a round started before midnight is still graded after it");
  }

  const todayOpen = await dailyBoard(db.client, "arcade", day, "dev-0", before);
  const todayLocked = await dailyBoard(db.client, "arcade", day, "dev-23", before);
  check(todayOpen.open && todayOpen.rows.length === 22 && todayOpen.count === 22, "today's board: finished players only, count shown from 20 (22)");
  check(!todayLocked.open && todayLocked.rows.length === 0 && todayLocked.me?.finished === false, "today's board stays closed to a player who hasn't finished");
  const closed = await dailyBoard(db.client, "arcade", day, "dev-23", closesAt + 5000);
  check(closed.open && closed.rows.length === 26 && closed.me?.rounds[1] === null, `after midnight every attempt is on the board (26), unplayed rounds empty (${closed.rows.length})`);
  const partialRow = closed.rows.find((r) => r.name === "P23");
  check(partialRow?.total === 0, "unplayed rounds score 0");

  // Ties: the same order as the room's standings for the same results.
  const attempts = db.tables.async_attempts!.filter((a) => a.room_id === room.id) as { id: string; user_id: string; display_name: string }[];
  const results: RoundResultRow[] = [];
  const duelPlayers: DuelPlayerRow[] = attempts.map((a, i) => ({ player_slot: i + 1, user_id: a.user_id, display_name: a.display_name, status: "active" }) as DuelPlayerRow);
  for (const [i, a] of attempts.entries())
    for (const r of db.tables.async_results!.filter((row) => row.attempt_id === a.id && row.answered))
      results.push({ duel_id: room.id, player_slot: i + 1, round_number: r.round_number as number, answer: null, is_correct: r.is_correct as boolean, ms_remaining: r.ms_remaining as number, reaction_avg_ms: r.reaction_avg_ms as number | null, correct_count: null, errors: null, extra: null, score: r.score as number, submitted_at: "", id: String(r.id) });
  const room2 = (db.tables.async_rooms!.find((r) => r.id === room.id) as unknown as AsyncRoomRow);
  const table = standings(duelPlayers, results, 3, new Map(), roomTieRounds(room2.puzzles_public));
  const fromRoom = new Map(table.map((row) => [duelPlayers[row.slot - 1]!.display_name, row.position]));
  const mismatched = closed.rows.filter((row) => fromRoom.get(row.name) !== row.rank);
  check(mismatched.length === 0, `the board's places equal the room standings' (${mismatched.map((m) => m.name).join(", ") || "all 25"})`);
  check(new Set(closed.rows.map((r) => r.rank)).size < closed.rows.length, "players level on points and time share a place");

  // The cold-start rule.
  const few = rankBoard(Array.from({ length: DAILY_COUNT_MIN - 1 }, (_, i) => ({ id: `${i}`, total: i, tieMs: 0, finishedAt: 0 })));
  check(few.length === 19 && DAILY_COUNT_MIN === 20, "the count threshold is 20");
  const small = store();
  const smallRoom = await quiet(() => ensureDailyRoom(small.client, "arcade", before, "x"));
  for (let i = 0; i < 19; i++) {
    const s = await startAttempt(small.client, smallRoom, `d${i}`, ME, before);
    if (s.ok) small.tables.async_attempts!.find((a) => a.id === s.attempt.id)!.finished_at = new Date(before).toISOString();
  }
  const nineteen = await dailyBoard(small.client, "arcade", day, "d0", before);
  check(nineteen.open && nineteen.count === null && nineteen.me?.rank !== null, "19 players: rank only, no count");
  const s20 = await startAttempt(small.client, smallRoom, "d19", ME, before);
  if (s20.ok) small.tables.async_attempts!.find((a) => a.id === s20.attempt.id)!.finished_at = new Date(before).toISOString();
  check((await dailyBoard(small.client, "arcade", day, "d0", before)).count === 20, "20 players: the count shows");
  const ranked = rankBoard([
    { id: "a", total: 300, tieMs: 9000, finishedAt: 2 },
    { id: "b", total: 300, tieMs: 9000, finishedAt: 1 },
    { id: "c", total: 300, tieMs: 8000, finishedAt: 3 },
    { id: "d", total: 200, tieMs: 1000, finishedAt: 0 },
  ]);
  check(ranked.map((r) => `${r.id}${r.rank}`).join(" ") === "c1 b2 a2 d4", "ties: total, then less time used, level players share a place (1, 2, 2, 4)");
}

/* ------------------------------------------------------------ 7. names */
{
  const refused = ["fuck", "FuckFace", "f*ck", "sh1t", "Shithead", "c u n t", "BigCunt99", "Wanker", "n1gger", "Ass", "fuuuck", "B1tch"];
  const allowed = ["Ali", "Cassie", "Dickens", "Scunthorpe", "Hancock", "Assia", "Sussex Sam", "Glasshouse", "Pakistan", "Matt", "Jo 🦊", "Shitake?"];
  const wrongRefused = refused.filter((n) => !offensiveName(n));
  const wrongAllowed = allowed.filter((n) => offensiveName(n));
  check(wrongRefused.length === 0, `offensive names are refused (${wrongRefused.join(", ") || "all"})`);
  check(wrongAllowed.length === 0, `ordinary names are allowed (${wrongAllowed.join(", ") || "all"})`);
  const src = readFileSync("src/lib/duel/daily.functions.ts", "utf8");
  check(
    src.indexOf("offensiveName(name)") > 0 &&
      src.indexOf("offensiveName(name)") < src.indexOf("withinRateLimit(") &&
      src.indexOf("withinRateLimit(") < src.indexOf("ensureDailyRoom("),
    "dailyStartFn refuses a name and applies the rate limit before dealing or starting",
  );
}

/* ------------------------------------------------------------ 10. SQL */
function postgresBin(): string | null {
  const root = "/usr/lib/postgresql";
  if (!existsSync(root)) return null;
  for (const version of readdirSync(root).sort().reverse()) {
    const bin = join(root, version, "bin");
    if (["initdb", "pg_ctl", "psql"].every((b) => existsSync(join(bin, b)))) return bin;
  }
  return null;
}
const MIGRATION = "20261021130000_async_rooms_daily.sql";
const migrations = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
check(migrations.includes(MIGRATION) && migrations.at(-1) === MIGRATION, "the daily migration exists and sorts last");
// Two migrations with one timestamp: only one would apply (#125's share migration took 20261021120000).
const stamps = migrations.map((f) => f.split("_")[0]!);
const shared = stamps.filter((stamp, i) => stamps.indexOf(stamp) !== i);
check(shared.length === 0, `no two migrations share a timestamp (${shared.join(", ") || "none"})`);
check(MIGRATION > "20261021120000_beta_share_events.sql", "the daily migration sorts after #125's share-events migration");
const sqlText = readFileSync(`supabase/migrations/${MIGRATION}`, "utf8");
check(!/GRANT\s+(INSERT|UPDATE|DELETE|ALL)[^;]*TO\s+(anon|authenticated)/i.test(sqlText), "SQL: no client write grant on any daily table");
const bin = postgresBin();
if (!bin) console.log("  NOTE no PostgreSQL binaries found: the SQL was checked as text only");
else {
  const dir = mkdtempSync(join(tmpdir(), "daily-check-"));
  chmodSync(dir, 0o777);
  const asRoot = process.getuid?.() === 0;
  const run = (cmd: string, args: string[]) =>
    asRoot ? spawnSync("runuser", ["-u", "postgres", "--", cmd, ...args], { encoding: "utf8" }) : spawnSync(cmd, args, { encoding: "utf8" });
  const data = join(dir, "data");
  let started = false;
  try {
    if (run(join(bin, "initdb"), ["-D", data, "-A", "trust", "-U", "postgres"]).status !== 0) throw new Error("initdb failed");
    const up = run(join(bin, "pg_ctl"), ["-D", data, "-o", `-k ${dir} -c listen_addresses='' -c fsync=off`, "-l", join(dir, "log"), "-w", "start"]);
    if (up.status !== 0) throw new Error(`pg_ctl: ${up.stderr}`);
    started = true;
    const psql = (sql: string) => {
      const file = join(dir, "q.sql");
      writeFileSync(file, sql);
      const out = spawnSync(join(bin, "psql"), ["-h", dir, "-U", "postgres", "-d", "postgres", "-X", "-q", "-tA", "-v", "ON_ERROR_STOP=1", "-f", file], { encoding: "utf8" });
      return { ok: out.status === 0, out: (out.stdout ?? "").trim(), err: (out.stderr ?? "").trim() };
    };
    const stub = psql(`
      CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, created_at timestamptz DEFAULT now(), last_sign_in_at timestamptz, is_anonymous boolean DEFAULT true);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO anon, authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
      SET client_min_messages = error; CREATE PUBLICATION supabase_realtime;`);
    if (!stub.ok) throw new Error(`stub: ${stub.err}`);
    let applied = 0;
    for (const file of migrations) {
      const out = psql(readFileSync(`supabase/migrations/${file}`, "utf8"));
      if (!out.ok) {
        check(false, `SQL: migration ${file} applies (${out.err.split("\n").find((l) => /ERROR/.test(l)) ?? ""})`);
        break;
      }
      applied++;
    }
    check(applied === migrations.length, `SQL: all ${migrations.length} migrations apply in order`);
    const A = "a0000000-0000-0000-0000-00000000000a";
    const B = "b0000000-0000-0000-0000-00000000000b";
    const OPEN = "10000000-0000-0000-0000-000000000001";
    const CLOSED = "20000000-0000-0000-0000-000000000002";
    const setup = psql(`
      INSERT INTO public.async_rooms (id, kind, room_key, day, seed, round_order, round_count, puzzles_public, opens_at, closes_at)
      VALUES ('${OPEN}', 'daily_puzzle', 'daily_puzzle:today', current_date, 1, '["flow"]', 1, '[{"type":"flow"}]', now() - interval '1 hour', now() + interval '1 hour'),
             ('${CLOSED}', 'daily_puzzle', 'daily_puzzle:yesterday', current_date - 1, 2, '["flow"]', 1, '[{"type":"flow"}]', now() - interval '25 hours', now() - interval '1 hour');
      INSERT INTO public.async_room_secrets (room_id, puzzles_private) VALUES ('${OPEN}', '[{"type":"flow","solution":[1]}]');
      INSERT INTO public.async_attempts (id, room_id, user_id, display_name, total_score, finished_at) VALUES
        ('a1000000-0000-0000-0000-000000000001', '${OPEN}', '${A}', 'Ali', 120, NULL),
        ('b1000000-0000-0000-0000-000000000001', '${OPEN}', '${B}', 'Bo', 140, now()),
        ('a2000000-0000-0000-0000-000000000002', '${CLOSED}', '${A}', 'Ali', 90, now() - interval '2 hours'),
        ('b2000000-0000-0000-0000-000000000002', '${CLOSED}', '${B}', 'Bo', 80, NULL);
      INSERT INTO public.async_results (room_id, attempt_id, user_id, round_number, started_at, answer, score)
        VALUES ('${OPEN}', 'b1000000-0000-0000-0000-000000000001', '${B}', 1, now(), 'secret answer', 140);`);
    check(setup.ok, `SQL: test rows set up (${setup.err})`);
    const as = (uid: string, sql: string) => psql(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false); ${sql}`);
    const lines = (r: { out: string }) => r.out.split("\n").slice(1).join("\n");
    const dup = psql(`INSERT INTO public.async_attempts (room_id, user_id, display_name) VALUES ('${OPEN}', '${A}', 'Again')`);
    check(!dup.ok && /async_attempts_once|duplicate/.test(dup.err), "SQL: one attempt per device per room (unique index)");
    // A (unfinished today) sees only their own row today; yesterday (closed) everything.
    check(lines(as(A, `SELECT display_name FROM public.async_attempts WHERE room_id = '${OPEN}' ORDER BY 1`)) === "Ali", "SQL: before finishing, a device reads only its own attempt on today's board");
    check(lines(as(B, `SELECT display_name FROM public.async_attempts WHERE room_id = '${OPEN}' ORDER BY 1`)) === "Ali\nBo", "SQL: after finishing, a device reads today's board");
    check(lines(as(A, `SELECT display_name FROM public.async_attempts WHERE room_id = '${CLOSED}' ORDER BY 1`)) === "Ali\nBo", "SQL: a closed day's board is readable");
    const cols = as(B, `SELECT display_name, total_score, tie_ms, round_scores, colour, icon, finished_at, rounds_done FROM public.async_attempts LIMIT 1`);
    check(cols.ok, `SQL: the leaderboard columns are readable (${cols.err})`);
    const uid = as(B, `SELECT user_id FROM public.async_attempts LIMIT 1`);
    check(!uid.ok && /permission denied/.test(uid.err), "SQL: a device can't read anyone's user id");
    const puzzles = as(B, `SELECT puzzles_public FROM public.async_rooms LIMIT 1`);
    const windowCols = as(B, `SELECT id, kind, room_key, day, round_count, opens_at, closes_at FROM public.async_rooms`);
    check(!puzzles.ok && windowCols.ok, "SQL: rooms' window columns readable, their puzzles not");
    for (const table of ["async_results", "async_room_secrets", "async_events"]) {
      const read = as(B, `SELECT count(*) FROM public.${table}`);
      check(!read.ok && /permission denied/.test(read.err), `SQL: devices can't read ${table}`);
    }
    for (const [label, sql] of [
      ["insert an attempt", `INSERT INTO public.async_attempts (room_id, user_id, display_name) VALUES ('${CLOSED}', '${B}', 'x')`],
      ["update its own attempt", `UPDATE public.async_attempts SET total_score = 999 WHERE user_id = '${A}'`],
      ["insert a result", `INSERT INTO public.async_results (room_id, attempt_id, user_id, round_number, started_at) VALUES ('${OPEN}', 'a1000000-0000-0000-0000-000000000001', '${A}', 1, now())`],
      ["delete a room", `DELETE FROM public.async_rooms`],
    ] as const) {
      const out = as(A, sql);
      check(!out.ok && /permission denied/.test(out.err), `SQL: a device can't ${label} directly (writes go through the server)`);
    }
    // The beta queries (docs/beta-sql.md section 7) run as written.
    const doc = readFileSync("docs/beta-sql.md", "utf8");
    const blocks = [...doc.slice(doc.indexOf("## 7. The daily challenge")).matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1]!);
    psql(`INSERT INTO public.async_events (room_id, kind, attempt_id, user_id, round_number, event, reason)
      VALUES ('${OPEN}', 'daily_puzzle', 'b1000000-0000-0000-0000-000000000001', '${B}', 1, 'round_finished', 'answered')`);
    const ran = blocks.map((sql) => psql(sql));
    check(blocks.length === 3 && ran.every((r) => r.ok), `SQL: the beta queries Q8a–Q8c run (${ran.map((r) => r.err.split("\n")[0]).filter(Boolean).join("; ") || `${blocks.length} ran`})`);
    const anon = psql(`SET ROLE anon; SELECT count(*) FROM public.async_attempts`);
    check(!anon.ok, "SQL: a signed-out client reads nothing");
  } catch (err) {
    console.log(`  NOTE local PostgreSQL unavailable (${err instanceof Error ? err.message.split("\n")[0] : String(err)}): the SQL was checked as text only`);
  } finally {
    if (started) run(join(bin, "pg_ctl"), ["-D", data, "-m", "immediate", "stop"]);
    rmSync(dir, { recursive: true, force: true });
  }
}

/* ------------------------------------------------------- client wiring */
{
  const run = readFileSync("src/components/async/AsyncRun.tsx", "utf8");
  check(/createRoomSender/.test(run) && /createDraftKeeper/.test(run) && /persistStageState/.test(run), "the run keeps the room's one-answer sender, the stored draft and the stage state");
  check(/autoStart=\{false\}/.test(run), "the round intro waits for READY (the player's clock starts when they do)");
  const home = readFileSync("src/routes/index.tsx", "utf8");
  check(/<DailyCard/.test(home) && /status\?\.available/.test(readFileSync("src/components/daily/DailyCard.tsx", "utf8")), "the Play card shows only once the daily is available");
}

console.warn = quietWarn;
console.log = quietLog;
console.log(`daily-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: one stored set per day, one attempt per device, puzzles only at each round's start, grades equal practice, UK midnight, ties, names, the cold-start count and RLS.");
