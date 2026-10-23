/**
 * Stored rounds of the 19 games deleted on 14 Oct 2026 (src/lib/duel/removedGames.ts).
 * Their code is gone; old rooms still hold their rounds. For one stored round of
 * each deleted type, in an otherwise ordinary finished room:
 *
 *  1. The registry has no entry for it (and no Memory category), but its name
 *     resolves (puzzleName, puzzleDef's read-only stand-in) and the stand-in's
 *     clock is the game's own, so a stamped room's tie-break is unchanged.
 *  2. The reveal (AnswerReveal) shows the name and the stored score, never
 *     "Scoring…", with or without a stored row; the stand-in's Stage, intro and
 *     help render without the game's code.
 *  3. The reveal server (loadRoundReveal) returns each stored score and no
 *     answer; the replay server (loadGameReplays, loadRoundReplay) skips the
 *     round, and no replay stepper exists for it.
 *  4. Grading never runs: gradeAnswer stores an unscored answer for a stray
 *     submission, and scoreStoredRound returns the stored score without asking a
 *     grader. Room totals, the final screen and the podium read the stored rows
 *     unchanged.
 *
 *   bun scripts/removed-games-check.tsx
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderToString } from "react-dom/server";
import { APP_NAME } from "@/lib/brand";

import { AnswerReveal } from "@/components/duel/AnswerReveal";
import { FinalResult } from "@/components/duel/FinalResult";
import { PuzzleInstructions } from "@/components/duel/PuzzleInstructions";
import { CATEGORY_ORDER } from "@/lib/duel/categories";
import { generatePuzzle, gradeAnswer } from "@/lib/duel/generate.server";
import {
  isLiveType,
  puzzleCategories,
  puzzleDef,
  puzzleName,
  puzzleRunMs,
  puzzleTimeLimitMs,
  PUZZLE_TYPES,
} from "@/lib/duel/registry";
import {
  isRemovedType,
  REMOVED_GAMES,
  REMOVED_PUZZLE_TYPES,
  scoreStoredRound,
} from "@/lib/duel/removedGames";
import { loadRoundReveal } from "@/lib/duel/reveal.server";
import { totalScore } from "@/lib/duel/scoring";
import { roomTieRounds, stampTieRev } from "@/lib/duel/tieBreak";
import type { DuelRow, PuzzleData, RoundResultRow } from "@/lib/duel/types";
import { loadGameReplays, loadRoundReplay } from "@/lib/replay/replay.server";
import { canReplay, makeStepper } from "@/lib/replay/steppers";

const failures: string[] = [];
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
const attempt = <T,>(label: string, fn: () => T): T | undefined => {
  try {
    return fn();
  } catch (error) {
    ok(false, `${label}: threw ${(error as Error).message}`);
    return undefined;
  }
};

/** A tiny in-memory stand-in for the service-role client (select/eq/in/order/maybeSingle). */
function stub(db: Record<string, any[]>) {
  return {
    from(table: string) {
      let rows = [...(db[table] ?? [])];
      const q: any = {
        select: () => q,
        eq: (col: string, v: unknown) => ((rows = rows.filter((r) => r[col] === v)), q),
        in: (col: string, vs: unknown[]) => ((rows = rows.filter((r) => vs.includes(r[col]))), q),
        order: () => q,
        maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
        then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: null }),
      };
      return q;
    },
  };
}

const row = (
  round: number,
  slot: number,
  score: number,
  answer: string | null,
): RoundResultRow => ({
  id: `${round}-${slot}`,
  duel_id: "old",
  player_slot: slot,
  round_number: round,
  answer,
  is_correct: false,
  ms_remaining: 4_000,
  reaction_avg_ms: null,
  correct_count: null,
  errors: null,
  extra: null,
  score,
  submitted_at: "2026-10-01T12:00:00Z",
});

/* 1: the registry */
ok(
  REMOVED_PUZZLE_TYPES.length === 19,
  `19 deleted games listed, found ${REMOVED_PUZZLE_TYPES.length}`,
);
ok(!(CATEGORY_ORDER as string[]).includes("memory"), "Memory is not a lobby category");
ok(!(puzzleCategories() as string[]).includes("memory"), "Memory is not a registry category");
for (const type of PUZZLE_TYPES) ok(!isRemovedType(type), `${type}: live type listed as deleted`);

const live = generatePuzzle("hover");
const STORED_SCORE = 87;

for (const type of REMOVED_PUZZLE_TYPES) {
  const { name, timeLimitMs } = REMOVED_GAMES[type];
  // What an old room stored: only the type and its own fields (a seed stands in for them).
  const stored = { type, seed: 7 } as unknown as PuzzleData;

  ok(!(PUZZLE_TYPES as string[]).includes(type), `${type}: still registered`);
  ok(!isLiveType(type), `${type}: isLiveType`);
  ok(puzzleName(type) === name, `${type}: name ${puzzleName(type)}, want ${name}`);
  const def = attempt(`${type} puzzleDef`, () => puzzleDef(type));
  ok(def?.name === name, `${type}: stand-in name ${def?.name}`);
  ok(
    puzzleTimeLimitMs(stored) === timeLimitMs,
    `${type}: clock ${puzzleTimeLimitMs(stored)}, was ${timeLimitMs}`,
  );
  if (type === "sortrush" || type === "parry")
    ok(puzzleRunMs(stored) === 60_000, `${type}: run ${puzzleRunMs(stored)}, was 60,000`);

  // The tie-break of a stamped room reads the same limits it did.
  const tie = roomTieRounds([stampTieRev(stored), stampTieRev(live)]);
  const wantLimit = type === "sortrush" || type === "parry" ? 60_000 : timeLimitMs;
  ok(
    tie?.[0]?.limitMs === wantLimit && tie[0].phaseLimitMs === timeLimitMs,
    `${type}: tie-break round ${JSON.stringify(tie?.[0])}`,
  );

  /* 2: the reveal and the stand-in screens */
  const reveal = (score: number | null) =>
    attempt(`${type} reveal`, () =>
      renderToString(
        <AnswerReveal
          round={1}
          totalRounds={2}
          puzzle={stored}
          answersReady
          myAnswer={score === null ? null : "x"}
          myCorrect={false}
          myReactionAvgMs={null}
          myScore={score}
          myExtra={null}
          startedAt={0}
          now={0}
        />,
      ),
    ) ?? "";
  const shown = reveal(STORED_SCORE);
  ok(shown.includes(name), `${type}: reveal lacks the name`);
  ok(
    shown.includes(`data-reveal-score="${STORED_SCORE}"`),
    `${type}: reveal lacks the stored score`,
  );
  ok(!shown.includes("Scoring"), `${type}: reveal shows Scoring…`);
  const none = reveal(null);
  ok(
    !none.includes("Scoring") && none.includes("No score"),
    `${type}: reveal without a row shows Scoring… or no notice`,
  );
  const Stage = def?.Stage;
  const Intro = def?.IntroExample;
  if (Stage && Intro) {
    const stage = attempt(`${type} stage`, () =>
      renderToString(
        <Stage puzzle={stored} phaseStartedAt={0} now={0} locked={false} onSubmit={() => {}} />,
      ),
    );
    ok(Boolean(stage?.includes(`no longer in ${APP_NAME}`)), `${type}: stage notice missing`);
    attempt(`${type} intro`, () => renderToString(<Intro />));
    attempt(`${type} help`, () => renderToString(<PuzzleInstructions type={type as never} />));
  }

  /* 3: the servers */
  const room = {
    id: "old",
    status: "finished",
    current_round: 2,
    phase: "result",
    round_count: 2,
    round_order: [type, "hover"],
    puzzles_public: [stored, live],
  } as unknown as DuelRow;
  const results = [
    row(1, 1, STORED_SCORE, "x"),
    row(1, 2, 12, "y"),
    row(2, 1, 40, null),
    row(2, 2, 55, null),
  ];
  const db = {
    duels: [room],
    duel_players: [
      { duel_id: "old", user_id: "u1", player_slot: 1, display_name: "Ana", status: "active" },
      { duel_id: "old", user_id: "u2", player_slot: 2, display_name: "Bo", status: "active" },
    ],
    duel_secrets: [{ duel_id: "old", puzzles_private: [{ type }, {}] }],
    round_results: results,
  };
  const revealed = await loadRoundReveal(stub(db), room, 1, 1).catch((error: Error) => ({
    ok: false as const,
    message: error.message,
  }));
  ok(revealed.ok, `${type}: loadRoundReveal failed (${revealed.ok ? "" : revealed.message})`);
  if (revealed.ok) {
    const summaries = revealed.data.players.map((p) => `${p.playerSlot}:${p.summary}`).join(" | ");
    ok(
      summaries.includes(`1:${name} · ${STORED_SCORE} points`) &&
        summaries.includes(`2:${name} · 12 points`),
      `${type}: reveal server summaries ${summaries}`,
    );
    ok(revealed.data.correctAnswer === null, `${type}: reveal server sent a correct answer`);
  }
  const game = await loadGameReplays(stub(db), "u1", { roomId: "old" });
  ok(
    game.ok && game.data.length === 1 && game.data[0]?.round === 2,
    `${type}: game replays ${JSON.stringify(game.ok ? game.data.map((r) => r.round) : game)}`,
  );
  const one = await loadRoundReplay(stub(db), "u1", { roomId: "old", roundNumber: 1 });
  ok(one.ok && one.data === null, `${type}: round replay served the deleted round`);
  ok(!canReplay(type) && makeStepper(stored, "x") === null, `${type}: a replay stepper exists`);

  /* 4: no grading; stored totals stand */
  const graded = attempt(`${type} gradeAnswer`, () => gradeAnswer(stored, "anything", 1_000));
  ok(
    graded?.score === 0 && graded.isCorrect === false,
    `${type}: stray submission scored ${graded?.score}`,
  );
  ok(
    scoreStoredRound(stored, results[0], () => {
      throw new Error("regraded");
    }) === STORED_SCORE,
    `${type}: scoreStoredRound did not return the stored score`,
  );
  ok(
    scoreStoredRound(live, results[2], () => 1) === 1,
    `${type}: scoreStoredRound skipped a live regrade`,
  );
  ok(
    totalScore(results, 1) === STORED_SCORE + 40 && totalScore(results, 2) === 12 + 55,
    `${type}: room totals changed`,
  );
  const final = attempt(`${type} final screen`, () =>
    renderToString(
      <FinalResult
        outcome="win"
        myName="Ana"
        opponentName="Bo"
        myTotal={totalScore(results, 1)}
        opponentTotal={totalScore(results, 2)}
        breakdown={[
          { round: 1, mine: STORED_SCORE, theirs: 12 },
          { round: 2, mine: 40, theirs: 55 },
        ]}
        roundOrder={room.round_order}
        busy={false}
        onPlayAgain={() => {}}
        isHost
        onHome={() => {}}
      />,
    ),
  );
  ok(Boolean(final?.includes(`>${STORED_SCORE}<`)), `${type}: final screen lacks the stored score`);
  ok(
    Boolean(
      final &&
      puzzleName(type)
        .split(" ")
        .every((word) => final.includes(word)),
    ),
    `${type}: final screen lacks the name`,
  );
}

if (failures.length) {
  console.log(failures.slice(0, 60).join("\n"));
  console.log(`FAIL: ${failures.length} of ${checks} deleted-game checks`);
  process.exit(1);
}
console.log(
  `PASS: ${checks} checks — a stored round of each of the ${REMOVED_PUZZLE_TYPES.length} deleted games shows its name and stored score on the reveal, the reveal server and the final screen, never "Scoring…"; no replay or regrade; tie-break clocks and room totals unchanged; Memory gone`,
);
