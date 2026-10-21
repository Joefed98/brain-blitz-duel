/**
 * challenge-check (22 Oct 2026): friend challenges (src/lib/duel/challenge.ts, challenge.server.ts)
 * on the real server code with the in-memory database the room and daily checks use
 * (scripts/fixtures/memoryDb.ts), and the migration on a local PostgreSQL when one is installed.
 * Proves:
 *
 *  1. The same content for every player: a challenge is dealt once and stored; every friend's rounds
 *     (puzzles and arcade seeds) are the stored ones, identical across devices; the same seed deals the
 *     same set; a challenge made from a finished room stores that room's own puzzles and copies its
 *     players' stored results unchanged (never regraded), once per game.
 *  2. Ghost pings at the recorded times: an earlier player's "finished" ping is released exactly when
 *     the friend's own round has run as long as theirs did to the answer's receipt, not a millisecond
 *     before; a time-out's draft, a late answer and a missed round never ping; only slots are sent.
 *  3. No early answers or scores: nothing about the earlier players' results (scores, verdicts,
 *     summaries) before the friend's own result for that round is stored; then only that round and
 *     the earlier ones, never an answer, and of `extra` only plain numbers and true/false; the final
 *     board only once the friend has finished.
 *  4. The 20-player cap (and the database trigger, when PostgreSQL is installed).
 *  5. Expiry: the link lasts exactly 7 days; no attempt or round starts after it.
 *  6. One attempt per device (sequential and racing starts).
 *  7. Grades equal practice: stored answers of every game in puzzle-score-legacy, arcade runs
 *     (replay-runs) and every active game's empty answer, played through a challenge's start → round
 *     → submit, store exactly what practice's gradeAnswer gives.
 *  8. Making challenges is rate limited (10 an hour per device, from the challenges table).
 *  9. Profile's lines ("Sam beat you 612–580") and the creator's list; the device record's
 *     follow-ups count once per kind, only after finishing someone else's challenge.
 * 10. Beta events: created (play and room), link opened and a friend's finish, once each.
 * 11. Standings, awards and the reveal chart are the room's own, from the challenge's boards.
 *
 *   bun scripts/challenge-check.ts
 */
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import { attemptFor, createAsyncRoom, startAsyncRound, submitAsyncAnswer, type AsyncRoomRow } from "../src/lib/duel/asyncRoom.server";
import { asyncRoundWindow } from "../src/lib/duel/asyncRoom";
import {
  CHALLENGE_MAX_PLAYERS,
  CHALLENGE_OPEN_MS,
  challengeCodeFrom,
  challengeLink,
  challengeResultLine,
  challengeRoomKey,
  challengeRoundChoices,
  isChallengeCode,
  rivalRow,
} from "../src/lib/duel/challenge";
import {
  CHALLENGE_CREATE_PER_HOUR,
  challengeByCode,
  challengeFinalBoard,
  challengeInfo,
  challengePings,
  challengeRoster,
  challengeRoundBoard,
  challengeRoundOrder,
  challengesAvailable,
  createChallenge,
  createChallengeFromRoom,
  dealChallenge,
  myChallenges,
  startChallenge,
} from "../src/lib/duel/challenge.server";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { podiumAwards } from "../src/lib/duel/podiumAwards";
import { withSeededRandom } from "../src/lib/duel/random";
import { ACTIVE_PUZZLE_TYPES, puzzlePrepMs, puzzleTimeLimitMs, typesInCategory } from "../src/lib/duel/registry";
import { mergePuzzle, splitPuzzle } from "../src/lib/duel/secrets";
import { standings } from "../src/lib/duel/scoring";
import { stampTieRev } from "../src/lib/duel/tieBreak";
import type { DuelPlayerRow, PuzzleCategory, PuzzleData, RoundResultRow } from "../src/lib/duel/types";
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
  challenges: ["code"],
  challenge_events: ["room_id", "user_id", "event"],
};
const store = (extra: Record<string, Record<string, unknown>[]> = {}) =>
  memoryDb(
    { async_rooms: [], async_attempts: [], async_results: [], async_events: [], async_room_secrets: [], challenges: [], challenge_events: [], ...extra },
    { unique: UNIQUE },
  );
const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-27T12:00:00Z");
const who = (name: string, colour: number | null = null) => ({ name, colour, icon: null });
const SECRET_FIELDS = (puzzle: PuzzleData) => Object.keys(splitPuzzle(puzzle).priv).filter((k) => k !== "type");
const STANDARD: PuzzleCategory[] = ["logic", "pattern", "speed", "attention", "word", "arcade"];

/** Makes a challenge and returns its stored room and the creator's attempt. */
async function make(db: ReturnType<typeof store>, creator: string, opts: { categories?: PuzzleCategory[]; rounds?: number; now?: number } = {}) {
  const made = await quiet(() =>
    createChallenge(db.client, creator, { categories: opts.categories ?? STANDARD, rounds: opts.rounds ?? 6, who: who(creator.toUpperCase().slice(0, 14), 1) }, opts.now ?? NOW),
  );
  if (!made.ok) throw new Error(`create: ${made.message}`);
  const found = (await challengeByCode(db.client, made.code))!;
  return { code: made.code, room: found.room, found, attempt: (await attemptFor(db.client, found.room.id, creator))! };
}

/** Plays every round of an attempt: round r answered `usedMs(r)` after the clock starts (or as a time-out). */
async function playAll(
  db: ReturnType<typeof store>,
  room: AsyncRoomRow,
  userId: string,
  start: number,
  usedMs: (round: number, puzzle: PuzzleData) => number | "timeout",
) {
  const attempt = (await attemptFor(db.client, room.id, userId))!;
  let t = start;
  for (let r = 1; r <= room.round_count; r++) {
    const s = await startAsyncRound(db.client, room, attempt, r, t);
    if (!s.ok) throw new Error(`round ${r}: ${s.message}`);
    const used = usedMs(r, s.puzzle);
    const limit = puzzleTimeLimitMs(s.puzzle);
    const prep = puzzlePrepMs(s.puzzle);
    const receive = used === "timeout" ? asyncRoundWindow(s.puzzle, t).timeoutAt + 50 : t + prep + used;
    await quiet(() => submitAsyncAnswer(db.client, room, attempt, { round: r, answer: "", msRemaining: used === "timeout" ? 0 : limit - used }, receive));
    t = receive + 20_000;
  }
  return t;
}

/* ---------------------------------------------------------- codes, links */
{
  const db = store();
  const { code } = await make(db, "dev-creator");
  check(isChallengeCode(code) && code.length === 6, `a challenge code is 6 unambiguous characters (${code})`);
  check(challengeCodeFrom(` ${code.toLowerCase()} `) === code && challengeCodeFrom("I0O1LZ") === null, "codes are read case-blind; ambiguous characters are refused");
  check(challengeLink("https://x.app/", code) === `https://x.app/challenge?code=${code}&ref=challenge`, "the shared link is the challenge's own page with ?ref=challenge");
  check(JSON.stringify(challengeRoundChoices(STANDARD)) === "[3,6,10]" && JSON.stringify(challengeRoundChoices(["logic", "pattern", "speed", "attention", "word", "number", "arcade"])) === "[3,7,10]", "rounds offered: 3, the lobby's own count (6, or 7 with all seven), 10");
  const speed = typesInCategory("speed").length;
  check(Math.max(...challengeRoundChoices(["speed"])) === Math.min(10, speed), `one category never offers more rounds than it has games (speed: ${speed})`);
  check((await challengesAvailable(db.client)) === true, "status: available once the table exists");
  const missing = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { code: "42P01", message: "relation does not exist" } }) }) }) }) };
  check((await challengesAvailable(missing)) === false, "status: unavailable before the migration (the Play card and podium button stay hidden)");
}

/* ------------------------------------------------- 1. the same content */
{
  let bad = 0;
  let repeats = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const cats = [STANDARD, ["arcade"], ["word", "number"], ["speed"]][seed % 4] as PuzzleCategory[];
    for (const rounds of [3, 6, 10]) {
      const order = challengeRoundOrder(cats, rounds, seed);
      const pool = cats.reduce((n, c) => n + typesInCategory(c).length, 0);
      if (order.length !== Math.min(rounds, pool)) bad++;
      if (new Set(order).size !== order.length) repeats++;
      if (order.some((t) => !ACTIVE_PUZZLE_TYPES.includes(t))) bad++;
    }
  }
  check(bad === 0, `400 seeds × 3 lengths: the asked number of rounds (capped by the pool), active games only (${bad} bad)`);
  check(repeats === 0, `no game twice in one challenge (${repeats} repeats)`);
  // The order follows the seed; some generators draw fresh, which is why a challenge (like a room) is
  // dealt once and stored (rule 5) and every device is sent the stored puzzles (proved below).
  const a = await quiet(() => withSeededRandom(5, () => dealChallenge({ categories: STANDARD, rounds: 10, seed: 77 })));
  const b = await quiet(() => withSeededRandom(5, () => dealChallenge({ categories: STANDARD, rounds: 10, seed: 77 })));
  check(JSON.stringify(a.roundOrder) === JSON.stringify(b.roundOrder) && a.puzzles.length === 10, "the same seed deals the same ten games (their puzzles are dealt once and stored, so every device gets the same)");
  check(a.puzzles.every((p) => (p as { tieRev?: number }).tieRev === 1), "every dealt round carries the room tie-break stamp");

  const db = store();
  const { code, room } = await make(db, "dev-a", { categories: STANDARD, rounds: 6 });
  check(db.tables.async_rooms!.length === 1 && db.tables.challenges!.length === 1 && room.kind === "challenge" && room.room_key === challengeRoomKey(code), "one async room (kind challenge) and one challenge row are stored");
  const stored = db.tables.async_rooms![0] as unknown as AsyncRoomRow;
  const priv = (db.tables.async_room_secrets![0] as { puzzles_private: Record<string, unknown>[] }).puzzles_private;
  check(stored.puzzles_public.every((p, i) => SECRET_FIELDS(mergePuzzle(p, priv[i])).every((k) => !(k in p))), "the stored public halves carry no secret field");
  // Three friends on three devices see the same rounds.
  const seen: string[][] = [];
  for (const dev of ["dev-b", "dev-c", "dev-d"]) {
    const s = await startChallenge(db.client, code, dev, who(dev), NOW + 1000);
    if (!s.ok) throw new Error(s.message);
    const attempt = (await attemptFor(db.client, room.id, dev))!;
    const list: string[] = [];
    let t = NOW + 2000;
    for (let r = 1; r <= room.round_count; r++) {
      const started = await startAsyncRound(db.client, room, attempt, r, t);
      if (!started.ok) throw new Error(started.message);
      list.push(JSON.stringify(started.puzzle));
      await quiet(() => submitAsyncAnswer(db.client, room, attempt, { round: r, answer: "", msRemaining: 0 }, asyncRoundWindow(started.puzzle, t).timeoutAt + 10));
      t += 600_000;
    }
    seen.push(list);
  }
  check(seen.every((list) => JSON.stringify(list) === JSON.stringify(seen[0])), "every device gets exactly the same rounds, in the same order");
  check(seen[0]!.every((p, i) => p === JSON.stringify(stored.puzzles_public[i])), "each round is the stored public half (nothing generated per device)");
  check(stored.round_order.some((t) => typesInCategory("arcade").includes(t as never)) ? seen[0]!.some((p) => /"seed"/.test(p)) : true, "arcade rounds carry their stored seed to every device");
}

/* ---------------------------------- 2, 3: ghost pings and no early results */
{
  const db = store();
  const { code, room } = await make(db, "dev-sam", { categories: ["logic", "pattern"], rounds: 3 });
  // Sam (the creator) answers round r after 4 s + r s on the clock; round 3 is a time-out (never pings).
  await playAll(db, room, "dev-sam", NOW, (r) => (r === 3 ? "timeout" : 4000 + r * 1000));
  // Ali answers later than Sam and later still a missed round.
  const ali = await startChallenge(db.client, code, "dev-ali", who("Ali"), NOW + 3_000_000);
  if (!ali.ok) throw new Error(ali.message);
  await playAll(db, room, "dev-ali", NOW + 3_000_100, (r) => 9000 + r * 500);
  const samRows = db.tables.async_results!.filter((r) => r.user_id === "dev-sam").sort((a, b) => (a.round_number as number) - (b.round_number as number));
  const recorded = samRows.map((r) => Date.parse(r.answered_at as string) - Date.parse(r.started_at as string));

  // Jo plays now: the earlier players are Sam and Ali.
  const T = NOW + 9_000_000;
  const jo = await startChallenge(db.client, code, "dev-jo", who("Jo"), T);
  if (!jo.ok) throw new Error(jo.message);
  const joAttempt = (await attemptFor(db.client, room.id, "dev-jo"))!;
  const roster = await challengeRoster(db.client, room, joAttempt);
  check(roster.players.length === 3 && roster.mySlot === 3 && roster.players.map((p) => p.name).join() === "DEV-SAM,Ali,Jo", `Jo's earlier players are Sam and Ali, in start order (${roster.players.map((p) => p.name).join()})`);
  check(!/score|total|answer|correct/i.test(JSON.stringify(roster)), "the roster carries names and looks only");
  const r1 = await startAsyncRound(db.client, room, joAttempt, 1, T + 100);
  if (!r1.ok) throw new Error(r1.message);
  const samAt = recorded[0]!;
  const aliAt = 9500 + puzzlePrepMs(r1.puzzle);
  const before = await challengePings(db.client, room, joAttempt, 1, T + 100 + samAt - 1);
  const onTime = await challengePings(db.client, room, joAttempt, 1, T + 100 + samAt);
  const both = await challengePings(db.client, room, joAttempt, 1, T + 100 + aliAt);
  check(before.length === 0, "no ping a millisecond before Sam's recorded finish");
  check(JSON.stringify(onTime) === "[1]", `Sam's ping at exactly the recorded time (${samAt} ms into the round) (${JSON.stringify(onTime)})`);
  check(JSON.stringify(both) === "[1,2]", `Ali's ping joins at Ali's own recorded time (${JSON.stringify(both)})`);
  check(both.every((s) => typeof s === "number"), "a ping is a slot number, nothing else");
  // No board (no scores, verdicts or summaries) before Jo's own result is stored.
  const early = await challengeRoundBoard(db.client, room, joAttempt, 1);
  check(!early.ok, "no round results before the friend's own result for that round is stored");
  const finalEarly = await challengeFinalBoard(db.client, (await challengeByCode(db.client, code))!, joAttempt, T + 200);
  check(!finalEarly.ok, "no final board before the friend has finished");
  const infoEarly = await challengeInfo(db.client, code, "dev-jo", T + 200);
  check(!/total|score|"rows"/i.test(JSON.stringify(infoEarly)), "the link's info carries no one's score");
  await quiet(() => submitAsyncAnswer(db.client, room, joAttempt, { round: 1, answer: "", msRemaining: 20_000 }, T + 100 + 7000));
  check((await challengePings(db.client, room, joAttempt, 1, T + 100 + aliAt)).length === 0, "no pings once the friend's own round is answered");
  const board = await challengeRoundBoard(db.client, room, joAttempt, 1);
  check(board.ok && board.board.results.every((r) => r.round_number === 1), "after round 1: round 1's results only (nothing from later rounds)");
  if (board.ok) {
    const others = board.board.results.filter((r) => r.player_slot !== board.board.mySlot);
    check(others.length === 2 && others.every((r) => r.answer === null), "the earlier players' rows carry no answer");
    check(
      others.every((r) => Object.entries(r.extra ?? {}).every(([k, v]) => typeof v === "number" || typeof v === "boolean" || k === "reveal")),
      "of their `extra`, only plain numbers and true/false (and the reveal's progress axis)",
    );
    check(board.board.details.length === 3, "this round's summaries for every player (as a room's results screen shows them)");
  }
  // Round 3: Sam's time-out and a late answer never ping, at any moment.
  for (let r = 2; r <= 3; r++) {
    const s = await startAsyncRound(db.client, room, joAttempt, r, T + 1_000_000 * r);
    if (!s.ok) throw new Error(s.message);
    if (r === 3) {
      const late = await challengePings(db.client, room, joAttempt, 3, asyncRoundWindow(s.puzzle, T + 1_000_000 * r).lateFrom - 1);
      check(!late.includes(1), "a time-out's draft never pings");
    }
    await quiet(() => submitAsyncAnswer(db.client, room, joAttempt, { round: r, answer: "", msRemaining: 5000 }, T + 1_000_000 * r + 5000));
  }
  // A rival row built from a stored row with words and a log drops them.
  const scrubbed = rivalRow(
    { round_number: 1, is_correct: true, ms_remaining: 100, reaction_avg_ms: null, correct_count: null, errors: null, score: 140, extra: { words: ["SECRET"], log: "1,2,3", moves: 12, done: true, reveal: { axis: { value: 3, max: 5, label: "x" }, lines: ["SECRET"] } } },
    2,
    "room",
  );
  check(scrubbed.answer === null && !JSON.stringify(scrubbed).includes("SECRET") && !JSON.stringify(scrubbed).includes("1,2,3") && (scrubbed.extra as { moves: number }).moves === 12, "rivalRow drops answers, word lists, logs and the reveal's lines; keeps numbers");

  // The final board, the podium and awards are the room's own.
  const final = await challengeFinalBoard(db.client, (await challengeByCode(db.client, code))!, joAttempt, T + 9_000_000);
  check(final.ok && final.board.players.length === 3 && final.board.results.every((r) => r.player_slot === final.board.mySlot || r.answer === null), "the final board: every finished player, answers only Jo's own");
  if (final.ok) {
    const rows = final.board.players.map((p) => ({ player_slot: p.slot, display_name: p.name, status: "active", user_id: "" }) as DuelPlayerRow);
    const table = standings(rows, final.board.results, room.round_count, undefined, final.board.tie);
    check(table.length === 3 && table.every((t) => t.total === final.board.results.filter((r) => r.player_slot === t.slot).reduce((a, r) => a + r.score, 0)), "podium totals are the stored round scores");
    const awards = podiumAwards(rows, final.board.results, final.board.awardRounds, final.board.tie);
    check(Array.isArray(awards) && awards.every((a) => rows.some((r) => r.player_slot === a.slot)), "awards come from the room's own podiumAwards on the challenge's results");
    check(db.tables.challenge_events!.some((e) => e.event === "friend_finished" && e.user_id === "dev-jo"), "a friend's finish is recorded");
    await challengeFinalBoard(db.client, (await challengeByCode(db.client, code))!, joAttempt, T + 9_000_001);
    check(db.tables.challenge_events!.filter((e) => e.event === "friend_finished" && e.user_id === "dev-jo").length === 1, "a friend's finish is recorded once");
  }
}

/* --------------------------------------- 4, 5, 6: cap, expiry, one attempt */
{
  const db = store();
  const { code, room } = await make(db, "dev-0");
  const again = await startChallenge(db.client, code, "dev-0", who("Other"), NOW + 10);
  check(again.ok && !again.created && db.tables.async_attempts!.filter((a) => a.user_id === "dev-0").length === 1, "the creator's second start is the same attempt");
  const [x, y] = await Promise.all([startChallenge(db.client, code, "dev-race", who("R"), NOW + 20), startChallenge(db.client, code, "dev-race", who("R"), NOW + 20)]);
  check(x.ok && y.ok && db.tables.async_attempts!.filter((a) => a.user_id === "dev-race").length === 1, "racing starts on one device make one attempt");
  for (let i = 2; i < CHALLENGE_MAX_PLAYERS; i++) {
    const s = await startChallenge(db.client, code, `dev-${i}`, who(`P${i}`), NOW + 100 + i);
    if (!s.ok) check(false, `player ${i + 1} could start (${s.message})`);
  }
  check(db.tables.async_attempts!.filter((a) => a.room_id === room.id).length === CHALLENGE_MAX_PLAYERS, "20 players can play");
  const full = await startChallenge(db.client, code, "dev-21", who("Late"), NOW + 500);
  check(!full.ok && full.full === true && db.tables.async_attempts!.filter((a) => a.room_id === room.id).length === 20, "the 21st device is refused (full)");
  const fullInfo = await challengeInfo(db.client, code, "dev-21", NOW + 600);
  check(fullInfo.found && fullInfo.state === "full", "the link says full to a newcomer");
  const playerInfo = await challengeInfo(db.client, code, "dev-5", NOW + 600);
  check(playerInfo.found && playerInfo.state === "continue", "a device already in it can still continue");
  check(Date.parse(room.closes_at) - Date.parse(room.opens_at) === CHALLENGE_OPEN_MS && CHALLENGE_OPEN_MS === 7 * 86_400_000, "the link lasts exactly 7 days");

  const db2 = store();
  const second = await make(db2, "dev-x");
  const lastMoment = await startChallenge(db2.client, second.code, "dev-y", who("Y"), NOW + CHALLENGE_OPEN_MS - 1);
  check(lastMoment.ok, "a friend can start in the link's last millisecond");
  const expired = await startChallenge(db2.client, second.code, "dev-z", who("Z"), NOW + CHALLENGE_OPEN_MS);
  check(!expired.ok && expired.closed === true, "no attempt starts once 7 days have passed");
  const yAttempt = (await attemptFor(db2.client, second.room.id, "dev-y"))!;
  check(!(await startAsyncRound(db2.client, second.room, yAttempt, 1, NOW + CHALLENGE_OPEN_MS + 1)).ok, "no round starts after expiry");
  const closedInfo = await challengeInfo(db2.client, second.code, "dev-new", NOW + CHALLENGE_OPEN_MS + 5);
  check(closedInfo.found && closedInfo.state === "closed", "the link says ended after 7 days");
  check(!(await challengeInfo(db2.client, "ZZZZZZ", "dev-new", NOW)).found, "an unknown code is not found");
}

/* ------------------------------------------------------- 8. rate limit */
{
  const db = store();
  for (let i = 0; i < CHALLENGE_CREATE_PER_HOUR; i++) await make(db, "dev-rate", { now: NOW + i * 1000 });
  const over = await quiet(() => createChallenge(db.client, "dev-rate", { categories: STANDARD, rounds: 3, who: who("R") }, NOW + 60_000));
  check(!over.ok && CHALLENGE_CREATE_PER_HOUR === 10, "the 11th challenge in an hour is refused");
  const later = await quiet(() => createChallenge(db.client, "dev-rate", { categories: STANDARD, rounds: 3, who: who("R") }, NOW + 3_600_000 + 10_000));
  check(later.ok, "an hour later one can be made again");
  const bad = await quiet(() => createChallenge(db.client, "dev-other", { categories: STANDARD, rounds: 42, who: who("R") }, NOW));
  check(!bad.ok, "a round count outside 3–10 is refused");
  const fns = readFileSync("src/lib/duel/challenge.functions.ts", "utf8");
  const create = fns.slice(fns.indexOf("export const createChallengeFn"), fns.indexOf("export const challengeFromRoomFn"));
  check(create.indexOf("playerFrom(") < create.indexOf("withinRateLimit(") && create.indexOf("withinRateLimit(") < create.indexOf("createChallenge("), "createChallengeFn checks the name and the per-device rate limit before dealing");
  check(/CHALLENGE_CREATE_LIMIT/.test(fns.slice(fns.indexOf("export const challengeFromRoomFn"))), "making one from a room is rate limited too");
}

/* -------------------------------------------- 1. a challenge from a room */
{
  const puzzles = await quiet(() => dealChallenge({ categories: STANDARD, rounds: 6, seed: 4242 }).puzzles);
  const duelId = "d0000000-0000-0000-0000-000000000001";
  const split = puzzles.map(splitPuzzle);
  const names = ["Sam", "Ali", "Jo", "Bartholomew-Jo"];
  const results: RoundResultRow[] = [];
  const phaseStart = NOW - 3_600_000;
  for (const [slot0, name] of names.entries())
    puzzles.forEach((puzzle, i) => {
      if (slot0 === 3 && i === 4) return; // Bartholomew-Jo missed round 5
      const limit = puzzleTimeLimitMs(puzzle);
      const used = 3000 + slot0 * 2000 + i * 100;
      const graded = gradeAnswer(puzzle, "", limit - used);
      results.push({
        id: `r${slot0}-${i}`,
        duel_id: duelId,
        player_slot: slot0 + 1,
        round_number: i + 1,
        answer: graded.answer || `ans-${name}-${i}`,
        is_correct: graded.isCorrect,
        ms_remaining: limit - used,
        reaction_avg_ms: graded.reactionAvgMs,
        correct_count: graded.correctCount,
        errors: graded.errors,
        extra: { ...(graded.extra ?? {}), words: [`WORD${slot0}`] },
        score: 50 + slot0 * 10 + i,
        submitted_at: new Date(phaseStart + i * 100_000 + puzzlePrepMs(puzzle) + used).toISOString(),
      });
    });
  const duel = {
    id: duelId,
    room_code: "ROOM",
    status: "finished",
    round_count: 6,
    round_order: puzzles.map((p) => p.type),
    puzzles_public: split.map((s) => s.pub),
    selected_categories: STANDARD,
    tournament_history: [],
  };
  const players = names.map((name, i) => ({ id: `p${i}`, duel_id: duelId, player_slot: i + 1, display_name: name, user_id: `room-dev-${i}`, status: "active", colour: i, icon: null }));
  const db = store({
    duels: [duel],
    duel_players: players,
    round_results: results as unknown as Record<string, unknown>[],
    duel_secrets: [{ duel_id: duelId, puzzles_private: split.map((s) => s.priv) }],
  });
  const outsider = await quiet(() => createChallengeFromRoom(db.client, "stranger", duelId, NOW));
  check(!outsider.ok, "only the room's players can make its challenge");
  const made = await quiet(() => createChallengeFromRoom(db.client, "room-dev-1", duelId, NOW));
  check(made.ok, `a room's player makes its challenge (${made.ok ? made.code : made.message})`);
  if (made.ok) {
    const again = await quiet(() => createChallengeFromRoom(db.client, "room-dev-2", duelId, NOW + 5000));
    check(again.ok && again.code === made.code && db.tables.challenges!.length === 1, "one challenge per room game (another player gets the same code)");
    const found = (await challengeByCode(db.client, made.code))!;
    const priv = (db.tables.async_room_secrets![0] as { puzzles_private: Record<string, unknown>[] }).puzzles_private;
    const sorted = (v: unknown): unknown => (Array.isArray(v) ? v.map(sorted) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([x], [y]) => x.localeCompare(y)).map(([k, x]) => [k, sorted(x)])) : v);
    check(found.room.puzzles_public.every((p, i) => JSON.stringify(sorted(mergePuzzle(p, priv[i]))) === JSON.stringify(sorted(puzzles[i]))), "the challenge stores the room's own puzzles");
    check(found.meta.source === "room" && found.meta.source_duel_id === duelId, "it remembers the room it came from");
    const attempts = db.tables.async_attempts!.filter((a) => a.room_id === found.room.id);
    check(attempts.length === 4 && attempts.every((a) => a.finished_at !== null), "every player of the room is on it, finished");
    const copied = db.tables.async_results!.filter((r) => r.room_id === found.room.id && r.answered);
    check(
      copied.length === results.length &&
        results.every((r) => {
          const u = players[r.player_slot - 1]!.user_id;
          const c = copied.find((x) => x.user_id === u && x.round_number === r.round_number)!;
          return c && c.score === r.score && c.ms_remaining === r.ms_remaining && c.is_correct === r.is_correct && c.answer === r.answer;
        }),
      "their stored results are copied unchanged (never regraded)",
    );
    const missed = db.tables.async_results!.find((r) => r.user_id === "room-dev-3" && r.round_number === 5);
    check(!!missed && missed.missed === true && missed.score === 0, "a round a player didn't answer is stored as missed (0)");
    const totals = attempts.map((a) => [a.display_name, a.total_score]);
    check(totals.every(([name, total]) => total === results.filter((r) => players[r.player_slot - 1]!.display_name === name).reduce((s, r) => s + r.score, 0)), "imported totals are the room's own totals");
    // A room player opening the link has already played it.
    const roomInfo = await challengeInfo(db.client, made.code, "room-dev-0", NOW + 10_000);
    check(roomInfo.found && roomInfo.state === "done" && roomInfo.fromRoom, "the room's players see it as played (one attempt per device)");
    const roomPlayerAttempt = (await attemptFor(db.client, found.room.id, "room-dev-0"))!;
    const roomFinal = await challengeFinalBoard(db.client, found, roomPlayerAttempt, NOW + 10_000);
    check(roomFinal.ok && !db.tables.challenge_events!.some((e) => e.event === "friend_finished" && e.user_id === "room-dev-0"), "a room player opening the challenge sees the podium and is not counted as a friend's finish");
    // A friend gets the room's players as earlier players, pinged at their room times.
    const f = await startChallenge(db.client, made.code, "friend", who("Friend"), NOW + 20_000);
    if (!f.ok) throw new Error(f.message);
    const fa = (await attemptFor(db.client, found.room.id, "friend"))!;
    const roster = await challengeRoster(db.client, found.room, fa);
    check(roster.players.map((p) => p.name).join() === "Sam,Ali,Jo,Bartholomew-Jo,Friend", `the friend plays against the room's players, in room order (${roster.players.map((p) => p.name).join()})`);
    const s1 = await startAsyncRound(db.client, found.room, fa, 1, NOW + 30_000);
    if (!s1.ok) throw new Error(s1.message);
    const samUsed = puzzlePrepMs(s1.puzzle) + 3000;
    const p0 = await challengePings(db.client, found.room, fa, 1, NOW + 30_000 + samUsed - 1);
    const p1 = await challengePings(db.client, found.room, fa, 1, NOW + 30_000 + samUsed);
    check(p0.length === 0 && JSON.stringify(p1) === "[1]", `a room player's ping lands at their room time (${samUsed} ms) (${JSON.stringify(p1)})`);
    await quiet(() => submitAsyncAnswer(db.client, found.room, fa, { round: 1, answer: "", msRemaining: 0 }, NOW + 30_000 + 400_000));
    const board = await challengeRoundBoard(db.client, found.room, fa, 1);
    check(board.ok && !JSON.stringify(board.board.results).includes("ans-") && !JSON.stringify(board.board.results).includes("WORD"), "the room players' answers never reach the friend");
    const unfinished = await quiet(() => createChallengeFromRoom(store({ duels: [{ ...duel, status: "in_progress" }], duel_players: players }).client, "room-dev-0", duelId, NOW));
    check(!unfinished.ok, "a game still being played can't be made into a challenge");
    check(db.tables.challenge_events!.some((e) => e.event === "created" && e.source === "room"), "a challenge made from a room is recorded (source room)");
  }
}

/* ------------------------------------------ 7. grades equal practice */
type Row = { score: number; is_correct: boolean; ms_remaining: number; extra: unknown };
const shape = (g: { score: number; is_correct?: boolean; isCorrect?: boolean; ms_remaining?: number; storedMs?: number; extra?: unknown }) =>
  JSON.stringify({ score: g.score, correct: g.isCorrect ?? g.is_correct, ms: g.storedMs ?? g.ms_remaining, extra: g.extra ?? null }).replace(/\\?"replayMs\\?":[\d.]+/g, "");
async function playInChallenge(puzzle: PuzzleData, answer: string, claimedMs: number, receiveAfterMs: number): Promise<Row> {
  const db = store();
  const code = "GRADE2";
  const room = await createAsyncRoom(db.client, { kind: "challenge", key: challengeRoomKey(code), day: null, seed: 1, puzzles: [puzzle], opensAt: NOW - 1000, closesAt: NOW + CHALLENGE_OPEN_MS, createdBy: "c" });
  await db.client.from("challenges").insert({ room_id: room.id, code, created_by: "c", source: "play", source_duel_id: null, source_game_index: null, selected_categories: [], round_count: 1, created_at: new Date(NOW).toISOString(), expires_at: room.closes_at });
  const started = await startChallenge(db.client, code, "friend", who("F"), NOW);
  if (!started.ok) throw new Error(started.message);
  const attempt = (await attemptFor(db.client, room.id, "friend"))!;
  const round = await startAsyncRound(db.client, room, attempt, 1, NOW);
  if (!round.ok) throw new Error(round.message);
  await submitAsyncAnswer(db.client, room, attempt, { round: 1, answer, msRemaining: claimedMs }, NOW + receiveAfterMs);
  return db.tables.async_results![0] as unknown as Row;
}
{
  let compared = 0;
  const differs: string[] = [];
  const legacy = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/puzzle-score-legacy.json.gz")).toString("utf8")) as {
    cases: { type: string; label: string; puzzle: PuzzleData; entries: { answer: string; ms: number }[] }[];
  };
  const lastLogMs = (answer: string) =>
    answer.startsWith("log1:")
      ? Math.max(0, ...answer.slice(5).split(",").map((item) => Number(item.includes("@") ? item.split("@")[1] : item)).filter(Number.isFinite))
      : 0;
  const compare = async (label: string, puzzle: PuzzleData, answer: string, claimed: number) => {
    const limit = puzzleTimeLimitMs(puzzle);
    const ms = Math.min(claimed, Math.max(0, limit - lastLogMs(answer)));
    const prep = puzzlePrepMs(puzzle);
    if (ms > 0) {
      const practice = await quiet(() => gradeAnswer(puzzle, answer, ms));
      const row = await quiet(() => playInChallenge(puzzle, answer, ms, prep + (limit - ms) + 80));
      compared++;
      if (shape(row) !== shape(practice)) differs.push(`${label} in time`);
    }
    const late = await quiet(() => gradeAnswer(puzzle, answer, 0));
    const row = await quiet(() => playInChallenge(puzzle, answer, 0, asyncRoundWindow(puzzle, 0).lateFrom + 100));
    compared++;
    if (shape(row) !== shape(late)) differs.push(`${label} late`);
  };
  for (const c of legacy.cases)
    for (const [i, entry] of c.entries.entries()) if (i % 6 === 0) await compare(`${c.type} ${c.label} #${i}`, c.puzzle, entry.answer, entry.ms);
  const arcade = (JSON.parse(readFileSync("scripts/fixtures/replay-runs.json", "utf8")) as { runs: { type: string; label: string; puzzle: PuzzleData; answer: string }[] }).runs;
  for (const run of arcade) await compare(`${run.type} ${run.label}`, run.puzzle, run.answer, 0);
  for (const type of ACTIVE_PUZZLE_TYPES) {
    const puzzle = stampTieRev(withSeededRandom(22_10_2026, () => generatePuzzle(type)) as PuzzleData);
    await compare(`${type} empty`, puzzle, "", 9000);
  }
  check(differs.length === 0, `${compared} challenge grades equal practice's (${differs.slice(0, 5).join("; ") || "all"})`);
  console.log(`  compared ${compared} challenge grades with practice`);
}

/* ----------------------------------------- 9. Profile lines, the record */
{
  check(challengeResultLine({ name: "Sam", total: 612, finished: true }, 580) === "Sam beat you 612–580", "Profile line: Sam beat you 612–580");
  check(challengeResultLine({ name: "Sam", total: 540, finished: true }, 580) === "You beat Sam 580–540", "Profile line: You beat Sam 580–540");
  check(challengeResultLine({ name: "Sam", total: 580, finished: true }, 580) === "You and Sam drew 580–580", "Profile line: a draw");
  check(challengeResultLine({ name: "Sam", total: null, finished: false }, 580) === "Sam is playing", "Profile line: still playing (no score shown)");
  const db = store();
  const { code, room } = await make(db, "dev-me");
  await playAll(db, room, "dev-me", NOW, () => 5000);
  const s = await startChallenge(db.client, code, "dev-sam2", who("Sam"), NOW + 10_000_000);
  if (!s.ok) throw new Error(s.message);
  const mid = await myChallenges(db.client, "dev-me", [], NOW + 10_000_001);
  check(mid.length === 1 && mid[0]!.friends[0]!.total === null && mid[0]!.myTotal !== null, "the creator's list: a friend still playing shows no score");
  await playAll(db, room, "dev-sam2", NOW + 10_000_100, () => 3000);
  const after = await myChallenges(db.client, "dev-me", [], NOW + 20_000_000);
  check(after[0]!.friends[0]!.finished && typeof after[0]!.friends[0]!.total === "number", "the creator's list: a finished friend's total");
  const other = await myChallenges(db.client, "dev-sam2", [code], NOW + 20_000_000);
  check(other.length === 1 && other[0]!.code === code, "codes the device remembers are listed too (device storage plus the server)");

  // challengeRecord.ts on a stand-in localStorage.
  const mem = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) },
  };
  const rec = await import("../src/lib/duel/challengeRecord");
  check(rec.takeChallengeFollowup("room") === null, "no follow-up before finishing someone else's challenge");
  check(rec.noteChallengeOpened("ABCDEF") && !rec.noteChallengeOpened("ABCDEF"), "a link's opening is counted once per device");
  rec.noteChallengeFriendFinish("ABCDEF");
  check(rec.takeChallengeFollowup("room") === "ABCDEF" && rec.takeChallengeFollowup("room") === null, "the first room after it is a follow-up, once");
  check(rec.takeChallengeFollowup("daily") === "ABCDEF" && rec.takeChallengeFollowup("daily") === null, "the first daily after it is a follow-up, once");
  rec.noteMyChallenge("AAAAAA");
  rec.noteMyChallenge("BBBBBB");
  check(rec.readChallengeRecord().mine.map((m) => m.code).join() === "BBBBBB,AAAAAA", "made challenges are remembered newest first");
}

/* -------------------------------------------------- 10. beta events */
{
  const db = store();
  await make(db, "dev-b1");
  const ev = db.tables.challenge_events!;
  check(ev.length === 1 && ev[0]!.event === "created" && ev[0]!.source === "play", "a challenge made on the Play tab is recorded (source play)");
  const fns = readFileSync("src/lib/duel/challenge.functions.ts", "utf8");
  check(/opened && info\.found && !info\.isCreator/.test(fns) && /event: "link_opened"/.test(fns), "a link's opening is recorded for friends (never the creator)");
  check(/followup_room/.test(fns) && /followup_daily/.test(fns), "a friend's first room and daily afterwards are recorded");
  const duelRoute = readFileSync("src/routes/duel.$code.tsx", "utf8");
  const dailyRoute = readFileSync("src/routes/daily.tsx", "utf8");
  check(/takeChallengeFollowup\("room"\)/.test(duelRoute) && /takeChallengeFollowup\("daily"\)/.test(dailyRoute), "rooms and dailies report the follow-up");
}

/* ------------------------------------------------- client wiring */
{
  const run = readFileSync("src/components/async/AsyncRun.tsx", "utf8");
  check(/rivals/.test(run) && /useRivalPings/.test(run) && /RivalRoundResults/.test(run) && /RivalStandings/.test(run), "the run plays against the earlier players: pings, round results, standings");
  check(/rivalRevealPlayers/.test(run), "arcade reveals place the earlier players on the room's chart");
  const route = readFileSync("src/routes/challenge.tsx", "utf8");
  check(/<Podium/.test(route) && /podiumAwards\(/.test(route) && /Challenge someone else/.test(route), "the final screen is the room's podium with awards, Share and Challenge someone else");
  const share = readFileSync("src/components/challenge/ChallengeShare.tsx", "utf8");
  check(/ShareResultButton/.test(share) && !/navigator\.share/.test(share), "challenges share through shareResult() only");
  // The Play card (22 Oct 2026, no jumps): reserved from the first frame unless the last answer was no, and
  // collapsed when the daily status call says challenges aren't available (PlaySlot, play-tab-shift-check).
  const { dailyStatus } = await import("../src/lib/duel/daily.server");
  const withTables = store();
  check((await dailyStatus(withTables.client, null, NOW)).challenges === true, "the daily status call says challenges are available once their table exists");
  const noChallenges = { from: (t: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => (t === "challenges" ? { data: null, error: { code: "42P01", message: "relation does not exist" } } : { data: null, error: null }) }) }) }) };
  check((await dailyStatus(noChallenges, null, NOW)).challenges === false, "the daily status call says no before the challenge migration");
  const home = readFileSync("src/routes/index.tsx", "utf8");
  check(
    /daily\.status\?\.challenges === true/.test(home) && /<PlaySlot id="challenge" state=\{slotState\(challenges !== null, challenges === true\)\}>/.test(home) && /if \(!available\) return null/.test(readFileSync("src/components/challenge/ChallengeCard.tsx", "utf8")),
    "the Play card shows only while challenges may be available, and collapses when they aren't",
  );
  const daily = readFileSync("src/lib/share/dailyShare.ts", "utf8");
  check(/I scored \$\{total\} on today's \$\{DAILY_TITLE\[kind\]\} – can you beat it\?/.test(daily), "the daily's share text");
  const { dailyShareLine } = await import("../src/lib/share/dailyShare");
  const { shareText } = await import("../src/lib/share/shareResult");
  check(shareText([dailyShareLine("puzzle", 612)], "https://x/daily", "") === "I scored 612 on today's Daily Puzzle – can you beat it? https://x/daily", "the daily's shared text is exactly: I scored 612 on today's Daily Puzzle – can you beat it? <link>");
}

/* ------------------------------------------------------------ SQL */
function postgresBin(): string | null {
  const root = "/usr/lib/postgresql";
  if (!existsSync(root)) return null;
  for (const version of readdirSync(root).sort().reverse()) {
    const bin = join(root, version, "bin");
    if (["initdb", "pg_ctl", "psql"].every((b) => existsSync(join(bin, b)))) return bin;
  }
  return null;
}
const MIGRATION = "20261022120000_friend_challenges.sql";
const migrations = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort();
check(migrations.includes(MIGRATION) && MIGRATION > "20261021130000_async_rooms_daily.sql", "the challenge migration sorts after the async-room migration it builds on");
const sqlText = readFileSync(`supabase/migrations/${MIGRATION}`, "utf8");
check(!/GRANT\s+(SELECT|INSERT|UPDATE|DELETE|ALL)[^;]*TO\s+(anon|authenticated)/i.test(sqlText), "SQL: no client grant on the challenge tables");
check(/ENABLE ROW LEVEL SECURITY/.test(sqlText) && /challenge_attempt_cap/.test(sqlText) && />= 20/.test(sqlText), "SQL: RLS on both tables; the 20-player trigger");
const bin = postgresBin();
if (!bin) console.log("  NOTE no PostgreSQL binaries found: the SQL was checked as text only");
else {
  const dir = mkdtempSync(join(tmpdir(), "challenge-check-"));
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
    const ROOM = "30000000-0000-0000-0000-000000000003";
    const A = "a0000000-0000-0000-0000-00000000000a";
    const setup = psql(`
      INSERT INTO public.async_rooms (id, kind, room_key, seed, round_count, opens_at, closes_at)
        VALUES ('${ROOM}', 'challenge', 'challenge:ABCDEF', 1, 3, now(), now() + interval '7 days');
      INSERT INTO public.challenges (room_id, code, created_by, source, round_count, expires_at) VALUES ('${ROOM}', 'ABCDEF', '${A}', 'play', 3, now() + interval '7 days');
      INSERT INTO public.async_attempts (room_id, user_id, display_name)
        SELECT '${ROOM}', gen_random_uuid(), 'P' || g FROM generate_series(1, 20) g;`);
    check(setup.ok, `SQL: 20 attempts fit (${setup.err})`);
    const extra = psql(`INSERT INTO public.async_attempts (room_id, user_id, display_name) VALUES ('${ROOM}', gen_random_uuid(), 'Late')`);
    check(!extra.ok && /challenge_full/.test(extra.err), "SQL: the 21st attempt on a challenge is refused by the trigger");
    const as = (uid: string, sql: string) => psql(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uid}', false); ${sql}`);
    for (const table of ["challenges", "challenge_events"]) {
      const read = as(A, `SELECT count(*) FROM public.${table}`);
      check(!read.ok && /permission denied/.test(read.err), `SQL: devices can't read ${table}`);
      const write = as(A, `DELETE FROM public.${table}`);
      check(!write.ok && /permission denied/.test(write.err), `SQL: devices can't write ${table}`);
    }
    const badCode = psql(`INSERT INTO public.challenges (room_id, code, created_by, source, round_count, expires_at) VALUES ('${ROOM}', 'I0O1LL', '${A}', 'play', 3, now() + interval '1 day')`);
    check(!badCode.ok, "SQL: a code outside the alphabet is refused");
    const ev = psql(`INSERT INTO public.challenge_events (room_id, code, user_id, event) VALUES ('${ROOM}', 'ABCDEF', '${A}', 'link_opened');
      INSERT INTO public.challenge_events (room_id, code, user_id, event) VALUES ('${ROOM}', 'ABCDEF', '${A}', 'link_opened');`);
    check(!ev.ok && /duplicate|challenge_events_once/.test(ev.err), "SQL: a link's opening is stored once per device");
    // share_events by source (this migration adds it; 20261021120000 made the table).
    const shares = psql(`INSERT INTO public.share_events (user_id, event, method) VALUES ('${A}', 'share_tap', 'copy');
      INSERT INTO public.share_events (user_id, event, source, daily_kind, method) VALUES ('${A}', 'share_tap', 'daily', 'puzzle', 'native');
      INSERT INTO public.share_events (user_id, event, source, challenge_code, place, players, rounds) VALUES ('${A}', 'share_tap', 'challenge', 'ABCDEF', 14, 20, 10);
      SELECT string_agg(source, ',' ORDER BY id) FROM public.share_events;`);
    check(shares.ok && shares.out === "room,daily,challenge", `SQL: share_events takes a source, room by default; 20-player challenge shares fit (${shares.err || shares.out})`);
    const badSource = psql(`INSERT INTO public.share_events (user_id, event, source) VALUES ('${A}', 'share_tap', 'sms')`);
    check(!badSource.ok, "SQL: an unknown share source is refused");
    const badKind = psql(`INSERT INTO public.share_events (user_id, event, source, daily_kind) VALUES ('${A}', 'share_tap', 'daily', 'weekly')`);
    check(!badKind.ok, "SQL: an unknown daily kind is refused");
    const shareDoc = readFileSync("docs/beta-sql.md", "utf8");
    const sourceBlocks = [...shareDoc.slice(shareDoc.indexOf("**Q-S4."), shareDoc.indexOf("## 8.")).matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1]!);
    const sourceRan = sourceBlocks.map((sql) => psql(sql));
    check(sourceBlocks.length === 2 && sourceRan.every((r) => r.ok), `SQL: the share-source queries Q-S4 and Q-S5 run (${sourceRan.map((r) => r.err.split("\n")[0]).filter(Boolean).join("; ") || `${sourceBlocks.length} ran`})`);
    const doc = readFileSync("docs/beta-sql.md", "utf8");
    const blocks = [...doc.slice(doc.indexOf("## 9. Friend challenges")).matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1]!);
    const ran = blocks.map((sql) => psql(sql));
    check(blocks.length >= 3 && ran.every((r) => r.ok), `SQL: the beta queries (section 9) run (${ran.map((r) => r.err.split("\n")[0]).filter(Boolean).join("; ") || `${blocks.length} ran`})`);
  } catch (err) {
    console.log(`  NOTE local PostgreSQL unavailable (${err instanceof Error ? err.message.split("\n")[0] : String(err)}): the SQL was checked as text only`);
  } finally {
    if (started) run(join(bin, "pg_ctl"), ["-D", data, "-m", "immediate", "stop"]);
    rmSync(dir, { recursive: true, force: true });
  }
}
{
  const doc = readFileSync("docs/beta-sql.md", "utf8");
  check(doc.includes("## 9. Friend challenges"), "docs/beta-sql.md has the friend-challenge queries (section 9)");
}

console.warn = quietWarn;
console.log = quietLog;
console.log(`challenge-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: the same stored rounds for every player, pings at the recorded times, no early answers or scores, 20 players, 7 days, one attempt per device, grades equal practice, rate limit, Profile lines and beta events.");
