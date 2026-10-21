/**
 * Stand-in daily data for the screen harness (scripts/safe-area-harness.tsx H.daily): today's status
 * before and after playing, the boards, a finished attempt and its reveals. The rounds are real dealt
 * puzzles (a fixed seed) with sample results; names and scores are made up. Used by
 * scripts/shots/daily-shots.ts and the theme / no-wrap screens (scripts/theme-screens.ts).
 */
import { DAILY_RECORD_KEY } from "../src/lib/duel/dailyRecord";
import { dealDaily } from "../src/lib/duel/daily.server";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleDef } from "../src/lib/duel/registry";
import { shiftDayKey, ukDayKey, ukDayWindow, type DailyBoardView, type DailyStatus } from "../src/lib/duel/daily";
import { withSeededRandom } from "../src/lib/duel/random";

export interface HarnessDaily {
  status: DailyStatus;
  boards: Record<string, DailyBoardView>;
  view: unknown;
  reveals: unknown[];
}

/** The longest name a player can set (14 characters). */
export const LONGEST_NAME = "Bartholomew-Jo";

type DailyFixture = { before: HarnessDaily; after: HarnessDaily; total: number; record: [string, string] };
let cached: DailyFixture | null = null;

/** The fixture (made once per process). */
export function dailyFixture(): DailyFixture {
  cached ??= makeDailyFixture(Date.now());
  return cached;
}

function makeDailyFixture(now: number): DailyFixture {
  const day = ukDayKey(now);
  const closesAt = ukDayWindow(day).closesAt;
  const log = console.log;
  console.log = () => undefined;
  const { puzzles } = withSeededRandom(2710, () => dealDaily("puzzle", { seed: 2710 }));
  console.log = log;
  const SCORES = [138, 121, 96, 150, 72, 117];
  const reveals = puzzles.map((puzzle, i) => {
    const graded = gradeAnswer(puzzle, "", 0);
    const result = {
      id: `r${i}`,
      duel_id: "daily-room",
      player_slot: 1,
      round_number: i + 1,
      answer: graded.answer || null,
      is_correct: SCORES[i]! >= 120,
      ms_remaining: 20_000,
      reaction_avg_ms: graded.reactionAvgMs,
      correct_count: graded.correctCount,
      errors: graded.errors,
      extra: graded.extra ?? null,
      score: SCORES[i]!,
      submitted_at: new Date(now).toISOString(),
    };
    let summary = "—";
    try {
      summary = puzzleDef(puzzle.type).roundSummary(result as never, puzzle).summary;
    } catch {
      /* a sample row */
    }
    return { puzzle, result, missed: false, summary, detail: [], correctAnswer: null };
  });
  const total = SCORES.reduce((a, b) => a + b, 0);
  const NAMES = ["Priya", "Tom W", LONGEST_NAME, "Joe", "Aisha", "WWWWWWWWWWWWWW", "Kofi", "Lena", "Sam", "Hannah", "Oli", "Rosa", "Dev", "Ellie"];
  // Joe (4th, level with Aisha on points and time) among a made-up board.
  const TOTALS = [812, 789, 766, total, total, 671, 655, 640, 612, 598, 577, 560, 541, 519];
  const rows = NAMES.map((name, i) => ({ rank: i === 4 ? 4 : i + 1, name, total: TOTALS[i]!, colour: i % 10, icon: null, isMe: name === "Joe" }));
  const boardOpen: DailyBoardView = { day, open: true, count: null, rows, me: { rank: 4, total, rounds: SCORES, finished: true, name: "Joe" } };
  const boardLocked: DailyBoardView = { day, open: false, count: 34, rows: [], me: null };
  const yesterday: DailyBoardView = {
    day: shiftDayKey(day, -1),
    open: true,
    count: 41,
    rows: rows.map((r, i) => ({ ...r, total: 790 - i * 19, isMe: false })),
    me: null,
  };
  const status = (puzzle: DailyStatus["puzzle"], arcade: DailyStatus["arcade"]): DailyStatus => ({ available: true, day, closesAt, puzzle, arcade });
  const view = {
    roomId: "daily-room",
    attemptId: "a",
    roundCount: 6,
    rounds: puzzles.map((p, i) => ({ round: i + 1, type: p.type, startedAt: now - 60_000, score: SCORES[i], missed: false })),
    finished: true,
    total,
    closesAt,
  };
  const boards = (today: DailyBoardView) => ({ "puzzle:today": today, "puzzle:yesterday": yesterday, "arcade:today": boardLocked, "arcade:yesterday": yesterday });
  return {
    before: { status: status({ state: "play" }, { state: "continue", roundsDone: 1 }), boards: boards(boardLocked), view, reveals },
    after: { status: status({ state: "done", total, rank: 4, count: null }, { state: "continue", roundsDone: 1 }), boards: boards(boardOpen), view, reveals },
    total,
    record: [
      DAILY_RECORD_KEY,
      JSON.stringify({ days: [shiftDayKey(day, -3), shiftDayKey(day, -2), shiftDayKey(day, -1), day], best: { puzzle: total, arcade: 388 }, totals: {} }),
    ],
  };
}
