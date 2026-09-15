import { WordHuntBoard, WordHuntPuzzle } from "@/components/puzzles/WordHuntPuzzle";
import {
  WORDHUNT_TIME_MS,
  wordHuntPoints,
  type WordHuntPuzzleData,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro example — never randomised. */
const EXAMPLE_GRID = "TAPLENSROIDMCKUG".split("");
/** P → A → N → E, through touching letters. */
const EXAMPLE_PATH = [2, 1, 5, 4];
const EXAMPLE_FOUND = ["PLANE", "SNARE", "TIDE"];

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Drag through touching letters to make words. Four letters or more.
      </p>
      <div className="flex items-center gap-4">
        <WordHuntBoard grid={EXAMPLE_GRID} path={EXAMPLE_PATH} size={128} />
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
      <p className="text-xs text-muted-foreground">
        Longer words score more. You have 60 seconds.
      </p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit, checkWord }: PuzzleStageProps) {
  if (puzzle.type !== "wordhunt") return null;
  return (
    <WordHuntPuzzle
      puzzle={puzzle}
      phaseStartedAt={phaseStartedAt}
      now={now}
      locked={locked}
      onSubmit={onSubmit}
      {...(checkWord ? { checkWord } : {})}
    />
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "wordhunt") return null;
  const mine = (myAnswer ?? "")
    .split(",")
    .map((word) => word.trim().toUpperCase())
    .filter((word) => word.length > 0);
  const points = mine.reduce((sum, word) => sum + wordHuntPoints(word), 0);
  const par = puzzle.par ?? 0;
  const missed = (puzzle.words ?? []).filter((entry) => !mine.includes(entry.word)).slice(0, 5);

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
        {mine.length} words · <span className="text-primary">{points} pts</span>
        {par > 0 ? ` · par ${par}` : ""}
      </p>

      {mine.length > 0 && (
        <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-1">
          {mine.map((word) => (
            <li
              key={word}
              className="flex items-center justify-between font-mono text-xs uppercase tracking-widest text-foreground"
            >
              <span>{word}</span>
              <span className="text-primary">{wordHuntPoints(word)}</span>
            </li>
          ))}
        </ul>
      )}

      {missed.length > 0 && (
        <div className="flex w-full flex-col items-center gap-2">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            best words you missed
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {missed.map((entry) => (
              <div key={entry.word} className="flex flex-col items-center gap-1">
                <WordHuntBoard grid={puzzle.grid} path={entry.path} size={72} />
                <span className="font-mono text-[10px] uppercase tracking-widest text-foreground">
                  {entry.word} <span className="text-primary">{entry.points}</span>
                </span>
              </div>
            ))}
          </div>
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
  name: "Word Hunt",
  category: "word",
  timeLimitMs: WORDHUNT_TIME_MS,
  generate: () => ({ type: "wordhunt", grid: [] }) satisfies WordHuntPuzzleData,
  check: () => false,
  revealHeading: "Your words",
  IntroExample,
  Stage,
  Reveal,
};
