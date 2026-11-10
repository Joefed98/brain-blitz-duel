/**
 * round-engine-parity-check (B6, docs/round-engine/plan.md): the round engine (src/lib/round/) runs a round exactly as
 * main da93f5d did, in every mode. Main's own functions are kept in scripts/round-engine/legacy.ts (temporary: retired
 * at the start of wave 3, with Joe's approval) and run beside today's in one process.
 *
 *  0. The copy is main's text: every block of legacy.ts against `git show da93f5d:<file>` (fetched once if a shallow
 *     checkout lacks it), or, with no history to read, against the span hashes stored in spans.ts and legacy.ts.
 *  1. Deals: rooms (buildRoomPuzzles, older rooms and the three settings presets, 3/6/12 rounds), both dailies, three
 *     challenge sizes and practice's single deal (every active game) give identical puzzles, seed for seed.
 *  2. Receipts: every stored answer case (puzzle-score-legacy, the honest tap logs, the stored arcade runs, empty and
 *     junk answers for every active game) under a room receipt (puzzle phase +80 ms / +1.2 s, the reveal +0.1 s / +3 s,
 *     no stamp), an async start (in time, late, closed) and a practice seal (a token, none, a token too late, no deal
 *     time, queued): the same time left, the same clamp and the same receipt figures.
 *  3. Grades: the same cases graded by main's gradeRoomAnswer / gradeAsyncAnswer and today's give a deep-equal grade,
 *     clamp, server figure and time left (arcade runs: a sample at quick depth, all with CHECKS_FULL=1).
 *  4. Stored rows: the row a room inserts and the values an async round stores, main's and the engine's, deep-equal.
 *  5. Windows: the engine's window and receipt equal main's asyncRoundWindow / asyncReceipt for every active game.
 *  6. Rankings, tie-breaks and dropouts: 2,000 seeded rooms (2–16 players, Total and Placings, left and inactive
 *     players, missed rounds, level totals and times) whose rows are built by main's path and by the engine's give the
 *     same standings after every round, the same two-player outcomes and the same async tie time and Daily board.
 *
 *   bun scripts/round-engine-parity-check.ts            (quick: ~40 s)
 *   CHECKS_FULL=1 bun scripts/round-engine-parity-check.ts   (every arcade run under every receipt, more deal seeds)
 *   bun scripts/round-engine-parity-check.ts --no-history     (the copy proved by its stored hashes only)
 */
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import * as legacy from "./round-engine/legacy";
import { LEGACY_COMMIT, SPANS, applySubs, copyIn, cutSpan, reverseSubs, sha256 } from "./round-engine/spans";
import { makeRoom } from "./ranking-identity-lib";

import { generatePuzzle } from "../src/lib/duel/generate.server";
import { gradeRoomAnswer, roomReceiptMsRemaining, type RoomReceipt } from "../src/lib/duel/roomGrade.server";
import { asRoundResult, gradeAsyncAnswer, type AsyncResultRow } from "../src/lib/duel/asyncRoom.server";
import { asyncReceipt, asyncRoundWindow } from "../src/lib/duel/asyncRoom";
import * as practiceReceipt from "../src/lib/duel/practiceReceipt";
import { ACTIVE_PUZZLE_TYPES, puzzlePrepMs, puzzleTimeLimitMs } from "../src/lib/duel/catalogue";
import { withSeededRandom } from "../src/lib/duel/random";
import { duelOutcome, roundTimeUsedMs, standings } from "../src/lib/duel/scoring";
import { tieRoundFor } from "../src/lib/duel/tieBreak";
import { rankBoard } from "../src/lib/duel/daily";
import { TAP_REV, encodeNumberTaps, encodeTapTimes, type NumberTap } from "../src/lib/duel/tapLog";
import { INTRO_MS, type PuzzleCategory, type PuzzleData, type PuzzleType, type RoundResultRow } from "../src/lib/duel/types";
import type { Graded, SubmitExtra } from "../src/lib/duel/grade";
import type { ScoringMode } from "../src/lib/duel/scoringMode";
import { resultColumns } from "../src/lib/round/result";
import { roundWindow, windowReceipt } from "../src/lib/round/window";
import { receiptMsRemaining } from "../src/lib/round/receipt";
import { asJson } from "../src/lib/data/db.server";

const FULL = process.env["CHECKS_FULL"] === "1" || process.argv.includes("--full");
const started = Date.now();
const failures: string[] = [];
const counts: Record<string, number> = {};
const tally = (section: string) => (counts[section] = (counts[section] ?? 0) + 1);
const marks: string[] = [];
const mark = (name: string) => marks.push(`${name} ${((Date.now() - started) / 1000).toFixed(1)}s`);
function check(section: string, ok: boolean, label: string) {
  tally(section);
  if (!ok && failures.length < 200) failures.push(`${section}: ${label}`);
}

/** The graders log desyncs for junk answers; the check's own output stays readable. */
function quiet<T>(fn: () => T): T {
  const saved = [console.log, console.warn, console.error, console.info] as const;
  console.log = console.warn = console.error = console.info = () => {};
  try {
    return fn();
  } finally {
    [console.log, console.warn, console.error, console.info] = saved as unknown as [typeof console.log, typeof console.log, typeof console.log, typeof console.log];
  }
}
async function quietAsync<T>(fn: () => Promise<T>): Promise<T> {
  const saved = [console.log, console.warn, console.error, console.info] as const;
  console.log = console.warn = console.error = console.info = () => {};
  try {
    return await fn();
  } finally {
    [console.log, console.warn, console.error, console.info] = saved as unknown as [typeof console.log, typeof console.log, typeof console.log, typeof console.log];
  }
}

const clean = <T>(fn: () => T): T => quiet(fn);

/** Key order kept, undefined kept apart from a missing key; Lightbender's build time and the replay's own clock left out. */
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === "generationMs" || k === "replayMs") continue;
      out[k] = v === undefined ? { __undef: true } : stable(v);
    }
    return out;
  }
  if (typeof value === "number" && Number.isNaN(value)) return { __nan: true };
  return value;
}
const same = (a: unknown, b: unknown) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));

/* ------------------------------------------------------------------ 0. the copy is main's text */

const legacyText = readFileSync("scripts/round-engine/legacy.ts", "utf8");
let history = false;
// --no-history proves the copy by its hashes alone, as on a checkout with no history to read (and tries no fetch).
const NO_HISTORY = process.argv.includes("--no-history");
const gitShow = (file: string): string | null => {
  if (NO_HISTORY) return null;
  try {
    return execFileSync("git", ["show", `${LEGACY_COMMIT}:${file}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
};
{
  let probe = gitShow(SPANS[0]!.file);
  if (probe === null && !NO_HISTORY) {
    // A shallow checkout: fetch the one commit (best effort, a few seconds), else prove the copy by its hashes.
    try {
      execFileSync("git", ["fetch", "--quiet", "--depth=1", "origin", LEGACY_COMMIT], { stdio: "ignore", timeout: 30_000 });
    } catch {
      /* no history to read: the hashes below decide */
    }
    probe = gitShow(SPANS[0]!.file);
  }
  history = probe !== null;
  for (const span of SPANS) {
    const copy = copyIn(legacyText, span.id);
    if (copy === null) {
      check("copy", false, `${span.id}: no block in legacy.ts`);
      continue;
    }
    const stored = legacy.LEGACY_HASHES[span.id];
    check("copy", sha256(reverseSubs(copy, span.subs)) === stored, `${span.id}: the block's text (substitutions undone) doesn't match its stored hash`);
    if (history) {
      const original = cutSpan(gitShow(span.file)!, span);
      check("copy", sha256(original) === stored, `${span.id}: the stored hash isn't ${LEGACY_COMMIT}'s ${span.file}`);
      check("copy", applySubs(original, span.subs) === copy, `${span.id}: the block isn't ${LEGACY_COMMIT}'s ${span.file} byte for byte`);
    }
  }
}

/* ------------------------------------------------------------------ 1. deals */

// Generators keep caches across calls, so each side deals the same sequence in its own fresh process
// (scripts/round-engine/deals.ts); the two run in parallel while the sections below run here.
const runDeals = (side: "legacy" | "engine") =>
  new Promise<Record<string, string>>((resolve, reject) => {
    const child = spawn("bun", ["scripts/round-engine/deals.ts", side, ...(FULL ? ["--full"] : [])], { stdio: ["ignore", "pipe", "inherit"] });
    let text = "";
    child.stdout.on("data", (chunk) => (text += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`deals.ts ${side} exited ${code}`));
      try {
        resolve(JSON.parse(text.trim().split("\n").pop()!) as Record<string, string>);
      } catch (error) {
        reject(error as Error);
      }
    });
  });
const dealsDone = Promise.all([runDeals("legacy"), runDeals("engine")]);

// Today's practice deal is main's with generatePuzzle → dealOne (the deal side proves dealOne deals what generatePuzzle
// does); its text, comment aside, must be main's exactly.
{
  const today = readFileSync("src/lib/duel/practice.functions.ts", "utf8");
  const copy = copyIn(legacyText, "dealPractice") ?? "";
  const span = SPANS.find((s) => s.id === "dealPractice")!;
  const mainText = reverseSubs(copy, span.subs);
  const todayText = cutSpan(today, span)
    .replace("  // The round engine's single deal (src/lib/round/deal.server.ts): no tie-break stamp, a fresh bank seed.\n", "")
    .replace('const { dealOne } = await import("./generate.server");', 'const { generatePuzzle } = await import("./generate.server");')
    .replace("splitPuzzle(dealOne(type,", "splitPuzzle(generatePuzzle(type,");
  check("deals", todayText === mainText, "practice.functions.ts dealPractice is not main's with generatePuzzle → dealOne");
}

/* ------------------------------------------------------------------ 2–4. receipts, grades, stored rows */

interface Case {
  label: string;
  puzzle: PuzzleData;
  answer: string;
  ms: number;
  extra?: SubmitExtra;
  arcade?: boolean;
}
const cases: Case[] = [];
const dealtOnce = new Map<PuzzleType, PuzzleData>();
{
  const stored = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/puzzle-score-legacy.json.gz")).toString("utf8")) as {
    cases: { type: string; label: string; puzzle: PuzzleData; entries: { answer: string; ms: number }[] }[];
  };
  for (const c of stored.cases)
    for (const [i, entry] of c.entries.entries()) {
      cases.push({ label: `${c.type} ${c.label} #${i}`, puzzle: c.puzzle, answer: entry.answer, ms: entry.ms });
      if (entry.ms !== 0) cases.push({ label: `${c.type} ${c.label} #${i} (timed out)`, puzzle: c.puzzle, answer: entry.answer, ms: 0 });
    }
  const runs = (JSON.parse(readFileSync("scripts/fixtures/tap-log-honest-runs.json", "utf8")) as {
    runs: { game: string; seed: number; puzzle: PuzzleData; meta: Record<string, number> | null; msRemaining: number; taps: unknown[] }[];
  }).runs;
  for (const run of runs) {
    if (run.game === "stopwatch") continue; // Bang On's logs are rebuilt from watch plans (room-practice-grade-check); its cases are in the stored entries.
    const puzzle = { ...run.puzzle, tapRev: TAP_REV } as PuzzleData;
    const log = run.game === "reaction" ? encodeTapTimes(run.taps as number[]) : encodeNumberTaps(run.taps as NumberTap[]);
    const extra = run.meta ? ({ reactionAvgMs: run.meta["reactionAvgMs"], correctCount: run.meta["correctCount"], errors: run.meta["errors"] } as SubmitExtra) : undefined;
    cases.push({ label: `${run.game} seed ${run.seed}`, puzzle, answer: log, ms: run.msRemaining, extra });
    cases.push({ label: `${run.game} seed ${run.seed} (timed out)`, puzzle, answer: log, ms: 0, extra });
  }
  const arcade = (JSON.parse(readFileSync("scripts/fixtures/replay-runs.json", "utf8")) as {
    runs: { type: string; label: string; puzzle: PuzzleData; answer: string }[];
  }).runs;
  const seenType = new Set<string>();
  for (const run of arcade) {
    // Quick depth: the first stored run of each game; full depth: every run.
    if (!FULL && seenType.has(run.type)) continue;
    seenType.add(run.type);
    cases.push({ label: `${run.type} ${run.label}`, puzzle: run.puzzle, answer: run.answer, ms: 0, arcade: true });
    cases.push({ label: `${run.type} ${run.label} (time left)`, puzzle: run.puzzle, answer: run.answer, ms: 4000, arcade: true });
  }
  for (const type of ACTIVE_PUZZLE_TYPES) {
    const puzzle = clean(() => withSeededRandom(9_11_2026, () => generatePuzzle(type))) as PuzzleData;
    dealtOnce.set(type, puzzle);
    for (const answer of ["", "x", "1,2,3"]) for (const ms of [0, 9000]) cases.push({ label: `${type} "${answer}" ${ms}`, puzzle, answer, ms });
  }
}

/** Receipts of every kind for a case: each mode's honest, early, late and odd shapes, and a claim beyond the clock. */
function roomReceipts(p: PuzzleData, ms: number): [string, RoomReceipt][] {
  const sentAt = puzzlePrepMs(p) + puzzleTimeLimitMs(p) - ms;
  return [
    ["room +80 ms", { phase: "puzzle", phaseStartedAt: new Date(0).toISOString(), nowMs: sentAt + 80 }],
    ["room +1.2 s", { phase: "puzzle", phaseStartedAt: new Date(0).toISOString(), nowMs: sentAt + 1200 }],
    ["room early (claim beyond the clock)", { phase: "puzzle", phaseStartedAt: new Date(0).toISOString(), nowMs: sentAt + 6000 }],
    ["room reveal +0.1 s", { phase: "reveal", phaseStartedAt: new Date(100_000).toISOString(), nowMs: 100_100 }],
    ["room reveal +3 s", { phase: "reveal", phaseStartedAt: new Date(100_000).toISOString(), nowMs: 103_000 }],
    ["room no stamp", { phase: "puzzle", phaseStartedAt: null, nowMs: 50_000 }],
  ];
}
function asyncStarts(p: PuzzleData, ms: number): [string, number, number][] {
  const start = 1_000_000;
  const sentAt = start + puzzlePrepMs(p) + puzzleTimeLimitMs(p) - ms;
  const w = legacy.asyncRoundWindow(p, start);
  return [
    ["async in time", start, sentAt + 150],
    ["async late", start, w.lateFrom + 10],
    ["async closed", start, w.closesAt + 10],
  ];
}
function practiceReceipts(p: PuzzleData, ms: number): [string, { dealtAt?: number; startAt?: number; nowMs: number } | undefined][] {
  const dealtAt = 2_000_000;
  const honestStart = dealtAt + 2_000;
  const nowMs = honestStart + puzzlePrepMs(p) + puzzleTimeLimitMs(p) - ms + 120;
  return [
    ["practice token", { dealtAt, startAt: honestStart, nowMs }],
    ["practice no token", { dealtAt, nowMs: dealtAt + INTRO_MS + puzzlePrepMs(p) + puzzleTimeLimitMs(p) - ms + 120 }],
    ["practice token too late", { dealtAt, startAt: dealtAt + INTRO_MS + 60_000, nowMs: nowMs + INTRO_MS + 60_000 }],
    ["practice token before the deal", { dealtAt, startAt: dealtAt - 5, nowMs }],
    ["practice no deal time", { nowMs }],
    ["practice queued", undefined],
  ];
}

mark("cases loaded");
const graded: { label: string; legacy: Graded; engine: Graded }[] = [];
for (const c of cases) {
  const p = c.puzzle;
  // Receipts and trust (cheap): every receipt, every case.
  for (const [where, r] of roomReceipts(p, c.ms)) {
    check("receipts", same(legacy.roomReceiptMsRemaining(p, r), roomReceiptMsRemaining(p, r)), `${c.label} (${where}): room receipt`);
    check("receipts", same(legacy.roomReceiptMsRemaining(p, r), receiptMsRemaining(p, { mode: "phase", ...r })), `${c.label} (${where}): engine phase receipt`);
  }
  for (const [where, start, now] of asyncStarts(p, c.ms)) {
    check("receipts", legacy.asyncReceipt(p, start, now) === asyncReceipt(p, start, now), `${c.label} (${where}): async timing`);
    // Main's gradeAsyncAnswer read the room receipt off its mapping; the engine's start receipt must give that figure.
    const t = legacy.asyncReceipt(p, start, now);
    const mapped = legacy.roomReceiptMsRemaining(p, { phase: t === "puzzle" ? "puzzle" : "reveal", phaseStartedAt: new Date(start).toISOString(), nowMs: now });
    check("receipts", same(mapped, receiptMsRemaining(p, { mode: "start", startedAt: start, nowMs: now })), `${c.label} (${where}): engine start receipt`);
  }
  for (const [where, r] of practiceReceipts(p, c.ms)) {
    const before = r ? legacy.practiceReceiptMsRemaining(p, r) : undefined;
    const after = r ? practiceReceipt.practiceReceiptMsRemaining(p, r) : undefined;
    check("receipts", same(before, after), `${c.label} (${where}): practice receipt`);
    if (r) check("receipts", same(legacy.practiceStartMs(r), practiceReceipt.practiceStartMs(r)), `${c.label} (${where}): practice start`);
    for (const claim of [c.ms, c.ms + 3000, -5, Number.NaN, 10_000_000])
      check("receipts", same(legacy.practiceTrustedMs(p, claim, before), practiceReceipt.practiceTrustedMs(p, claim, after)), `${c.label} (${where}) claim ${claim}: practice trust`);
  }

  // Grades (the real grader, main's wiring and the engine's): rooms on two receipts, async on all three.
  // Quick depth grades a room answer in time and one in the reveal (arcade runs: in time only), and an async answer in
  // time and late; full depth every receipt. The receipts above are compared on every shape at both depths, and the
  // grader below them is the same function, called with what they give.
  const rooms = roomReceipts(p, c.ms);
  const gradeReceipts = FULL ? rooms : c.arcade ? rooms.slice(0, 1) : [rooms[0]!, rooms[3]!];
  for (const [where, r] of gradeReceipts) {
    const before = quiet(() => legacy.gradeRoomAnswer(p, r, c.answer, c.ms, c.extra));
    const after = quiet(() => gradeRoomAnswer(p, r, c.answer, c.ms, c.extra));
    check("grades", same(before, after), `${c.label} (${where}): gradeRoomAnswer differs`);
    if (where === "room +80 ms") graded.push({ label: c.label, legacy: before.graded, engine: after.graded });
  }
  if (!c.arcade || FULL)
    for (const [where, start, now] of asyncStarts(p, c.ms).slice(0, FULL ? 3 : 2)) {
      const before = await quietAsync(() => legacy.gradeAsyncAnswer(p, start, now, c.answer, c.ms, c.extra));
      const after = await quietAsync(() => gradeAsyncAnswer(p, start, now, c.answer, c.ms, c.extra));
      check("grades", same(before, after), `${c.label} (${where}): gradeAsyncAnswer differs`);
    }
}
mark("receipts+grades");
const missing = ACTIVE_PUZZLE_TYPES.filter((type) => !cases.some((c) => c.puzzle.type === type));
check("grades", missing.length === 0, `active games never graded: ${missing.join(", ")}`);

// Stored rows: each graded case, plus odd grades (an empty answer, extra undefined / null / set, null counts).
const odd: Graded[] = [
  { answer: "", isCorrect: false, score: 0, reactionAvgMs: null, correctCount: null, errors: null, extra: null, storedMs: 0 },
  { answer: "a", isCorrect: true, score: 150, reactionAvgMs: 210, correctCount: 3, errors: 1, extra: { k: 1, nested: { x: [1, 2] } }, storedMs: 12_345 },
  { answer: "b", isCorrect: false, score: 7, reactionAvgMs: null, correctCount: 0, errors: 0, extra: undefined as unknown as null, storedMs: 1 },
];
const rowOf = (g: Graded, slot: number, round: number) => ({
  duel_id: "room-1",
  player_slot: slot,
  round_number: round,
  ...resultColumns(g),
  extra: asJson(g.extra),
});
const valuesOf = (g: Graded, nowMs: number) => ({
  answered: true,
  answered_at: new Date(nowMs).toISOString(),
  ...resultColumns(g),
  extra: g.extra ?? null,
});
for (const [i, g] of [...graded.map((x) => x.engine), ...odd].entries()) {
  const before = await legacy.legacyRoomRow(g, { id: "room-1" }, { player_slot: 1 + (i % 16) }, { roundNumber: 1 + (i % 12) });
  check("rows", same(before, rowOf(g, 1 + (i % 16), 1 + (i % 12))), `room row ${i} differs`);
  const values = legacy.legacyAsyncValues(g, 5_000_000 + i);
  check("rows", same(values, valuesOf(g, 5_000_000 + i)), `async values ${i} differ`);
  // As stored (JSON): a key set to undefined and a missing key are the same column.
  check("rows", JSON.stringify(values) === JSON.stringify(valuesOf(g, 5_000_000 + i)), `async values ${i} differ as stored`);
}

mark("rows");
/* ------------------------------------------------------------------ 5. windows */

for (const type of ACTIVE_PUZZLE_TYPES) {
  const p = dealtOnce.get(type)!;
  for (const start of [0, 1, 999_999, 1_700_000_000_000, 1_762_646_400_123]) {
    check("windows", same(legacy.asyncRoundWindow(p, start), roundWindow(p, start)), `${type} start ${start}: window`);
    check("windows", same(legacy.asyncRoundWindow(p, start), asyncRoundWindow(p, start)), `${type} start ${start}: asyncRoundWindow`);
    const w = legacy.asyncRoundWindow(p, start);
    for (const now of [start, w.timeoutAt, w.lateFrom - 1, w.lateFrom, w.lateFrom + 1, w.closesAt - 1, w.closesAt, w.closesAt + 1])
      check("windows", legacy.asyncReceipt(p, start, now) === windowReceipt(p, start, now), `${type} start ${start} now ${now}: receipt`);
  }
}
check("windows", same(legacy.asyncRoundWindow(undefined, 5), roundWindow(undefined, 5)), "no puzzle: window");

mark("windows");
/* ------------------------------------------------------------------ 6. rankings, tie-breaks, dropouts */

{
  const rooms = 2000;
  const pool = graded.filter((g) => !g.label.includes('"'));
  for (let seed = 1; seed <= rooms; seed++) {
    const room = makeRoom(seed);
    // Each row graded by main's path and by the engine's (the room's own figures kept on most rows so level totals and
    // level times stay common; every fourth row a real graded case).
    const legacyRows: RoundResultRow[] = [];
    const engineRows: RoundResultRow[] = [];
    for (const [i, row] of room.results.entries()) {
      const fromPool = i % 4 === 0 && pool.length ? pool[(seed * 31 + i) % pool.length]! : null;
      const g: Graded = fromPool?.engine ?? {
        answer: row.answer ?? "",
        isCorrect: row.is_correct,
        score: row.score,
        reactionAvgMs: row.reaction_avg_ms,
        correctCount: row.correct_count,
        errors: row.errors,
        extra: row.extra,
        storedMs: row.ms_remaining,
      };
      const gl: Graded = fromPool?.legacy ?? g;
      const base = { id: row.id, submitted_at: row.submitted_at };
      legacyRows.push({ ...base, ...(await legacy.legacyRoomRow(gl, { id: "d" }, { player_slot: row.player_slot }, { roundNumber: row.round_number })) } as unknown as RoundResultRow);
      engineRows.push({ ...base, ...rowOf(g, row.player_slot, row.round_number), duel_id: "d" } as unknown as RoundResultRow);
    }
    for (const mode of ["total", "placings"] as ScoringMode[]) {
      for (let through = 0; through <= room.rounds; through++)
        check(
          "rankings",
          same(standings(room.players, legacyRows, through, new Map(), room.tie ?? undefined, mode), standings(room.players, engineRows, through, new Map(), room.tie ?? undefined, mode)),
          `room ${seed} ${mode} through ${through}: standings differ`,
        );
      const a = room.players[0]!;
      const b = room.players[room.players.length - 1]!;
      check(
        "rankings",
        duelOutcome(legacyRows, a.player_slot, b.player_slot, room.tie ?? undefined, mode, room.rounds) ===
          duelOutcome(engineRows, a.player_slot, b.player_slot, room.tie ?? undefined, mode, room.rounds),
        `room ${seed} ${mode}: outcome differs`,
      );
    }
    // The same rows as async attempts (missed rounds: a round with no row): tie time and the Daily board.
    if (seed % 4 === 0) {
      const puzzles = Array.from({ length: room.rounds }, (_, i) => ({ type: "sudoku", timeLimitMs: 30_000 + (i % 3) * 15_000, tieRev: 1 }) as unknown as PuzzleData);
      const tie = (rows: RoundResultRow[], slot: number) =>
        puzzles.map((p) => tieRoundFor(p)).reduce((sum, round, index) => {
          const r = rows.find((x) => x.player_slot === slot && x.round_number === index + 1);
          const asAsync = r ? asRoundResult({ ...(r as unknown as AsyncResultRow), answered: true, missed: false, answered_at: r.submitted_at, started_at: r.submitted_at, attempt_id: "a", room_id: "d", user_id: "u" }) : undefined;
          return sum + roundTimeUsedMs(asAsync, round);
        }, 0);
      const board = (rows: RoundResultRow[]) =>
        rankBoard(
          room.players.map((p) => ({
            id: `a${p.player_slot}`,
            total: rows.filter((r) => r.player_slot === p.player_slot).reduce((s, r) => s + r.score, 0),
            tieMs: tie(rows, p.player_slot),
            finishedAt: p.player_slot * 1000,
          })),
        );
      check("rankings", same(board(legacyRows), board(engineRows)), `room ${seed}: async board differs`);
    }
  }
}

mark("rankings");
/* ------------------------------------------------------------------ 1. deals: the two sides compared */

{
  const [before, after] = await dealsDone;
  const keys = Object.keys(before);
  check("deals", keys.length > 0 && keys.join() === Object.keys(after).join(), "the two sides dealt different sequences");
  for (const key of keys) check("deals", before[key] === after[key], `${key} deals differently`);
}

/* ------------------------------------------------------------------ summary */

const seconds = ((Date.now() - started) / 1000).toFixed(1);
const summary = Object.entries(counts)
  .map(([k, v]) => `${k} ${v}`)
  .join(", ");
console.log(`timings: ${marks.join(", ")}`);
console.log(`round-engine-parity-check (${FULL ? "full" : "quick"} depth, copy proved ${history ? `against git ${LEGACY_COMMIT}` : "by stored hashes"}): ${summary}; ${cases.length} cases, ${seconds} s`);
if (failures.length) {
  for (const f of failures) console.log(`  FAIL ${f}`);
  console.log(`round-engine-parity-check: FAIL (${failures.length} failed)`);
  process.exit(1);
}
console.log("round-engine-parity-check: PASS");
