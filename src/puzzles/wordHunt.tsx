import { gameDisplayName } from "@/lib/duel/gameNames";
import { WordHuntBoard, WordHuntPuzzle } from "@/components/puzzles/WordHuntPuzzle";
import { WORDHUNT_TIME_MS, wordHuntPoints, type WordHuntPuzzleData } from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro example — never randomised. */
const EXAMPLE_GRID = "TAPLENSROIEMCKUGBEAHWYTRS".split("");
/** P → A → N → E, through touching letters. */
const EXAMPLE_PATH = [2, 1, 5, 10];
const EXAMPLE_FOUND = ["PLANE", "SNARE", "TIDE"];
/** Words listed on the reveal before the rest are summed up. */
const REVEAL_WORDS = 30;

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Drag through touching letters to make words. Four letters or more.
      </p>
      <div className="flex items-center gap-4">
        <WordHuntBoard grid={EXAMPLE_GRID} path={EXAMPLE_PATH} size={150} />
        <ul className="flex flex-col gap-1">
          {EXAMPLE_FOUND.map((word) => (
            <li
              key={word}
              className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest"
            >
              <span>{word}</span>
              <span className="text-primary">{wordHuntPoints(word)}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">Word points × 2 = round score (max 150). Plurals count. You have 100 seconds.</p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit, onDraftAnswer, checkWord, stateKey }: PuzzleStageProps) {
  if (puzzle.type !== "wordhunt") return null;
  return (
    <WordHuntPuzzle
      puzzle={puzzle}
      phaseStartedAt={phaseStartedAt}
      now={now}
      locked={locked}
      onSubmit={onSubmit}
      onDraftAnswer={onDraftAnswer}
      {...(checkWord ? { checkWord } : {})}
      {...(stateKey ? { stateKey } : {})}
    />
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "wordhunt") return null;
  const mine = (myAnswer ?? "")
    .split(",")
    .map((word) => word.trim().toUpperCase())
    .filter((word) => word.length > 0);
  const missed = (puzzle.words ?? []).filter((entry) => !mine.includes(entry.word)).sort((a, b) => b.word.length - a.word.length || b.points - a.points).slice(0, 5);

  // Compact columns (14 px text) so a strong run fits one 375×667 screen; past
  // 30 words the shortest are summed up in a "+N more" line.
  const shown = [...mine].sort((a, b) => wordHuntPoints(b) - wordHuntPoints(a) || b.length - a.length).slice(0, REVEAL_WORDS);
  const more = mine.length - shown.length;
  return (
    <div data-word-reveal="wordhunt" className="flex w-full flex-col items-center gap-3">
      <p className="font-mono text-base uppercase tracking-widest text-foreground">{mine.length} words</p>

      {shown.length > 0 && (
        <ul className="word-reveal-list w-full">
          {shown.map((word) => (
            <li key={word}>
              <span>{word}</span>
              <span className="text-primary">{wordHuntPoints(word)}</span>
            </li>
          ))}
        </ul>
      )}
      {more > 0 && <p className="font-mono text-sm text-muted-foreground">+ {more} more</p>}

      {missed.length > 0 && (
        <div className="flex w-full flex-col items-center gap-1">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Missed</p>
          <ul className="word-reveal-list word-reveal-missed w-full">
            {missed.map((entry) => (
              <li key={entry.word}>
                <span>{entry.word}</span>
                <span>{entry.points}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Word Hunt is built, checked and scored on the server: the dictionary and the
 * board's word list never reach a device.
 */
export const wordHuntPuzzle: PuzzleDefinition = {
  key: "wordhunt",
  name: gameDisplayName("wordhunt"),
  category: "word",
  timeLimitMs: WORDHUNT_TIME_MS,
  generate: () => ({ type: "wordhunt", grid: [] }) satisfies WordHuntPuzzleData,
  check: () => false,
  revealHeading: "Your words",
  IntroExample,
  Stage,
  Reveal,
};
