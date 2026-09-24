import { WordsmithPuzzle } from "@/components/puzzles/WordsmithPuzzle";
import { wordsmithPoints, type WordsmithPuzzleData } from "@/lib/duel/types";
import { scoreWordHunt } from "@/lib/duel/scoring";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro example — never randomised. */
const EXAMPLE_TILES = ["T", "A", "P", "L", "N", "E", "S"];
const EXAMPLE_WORDS = ["PLANT", "PANEL", "LEAPT", "NEST"];

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Make as many words as you can from the letters. Four letters or more.
      </p>
      <div className="flex items-start gap-4">
        <div className="flex flex-wrap justify-center gap-1.5" style={{ maxWidth: 132 }}>
          {EXAMPLE_TILES.map((letter, index) => (
            <span
              key={index}
              className="flex h-11 w-9 items-center justify-center rounded-lg border border-border bg-card font-display text-base font-bold"
            >
              {letter}
            </span>
          ))}
        </div>
        <ul className="flex flex-col gap-1">
          {EXAMPLE_WORDS.map((word) => (
            <li
              key={word}
              className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest"
            >
              <span>{word}</span>
              <span className="text-primary">{wordsmithPoints(word)}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">Word points × 3 = round score (max 150). You have 60 seconds.</p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit, checkWord }: PuzzleStageProps) {
  if (puzzle.type !== "wordsmith") return null;
  return (
    <WordsmithPuzzle
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
  if (puzzle.type !== "wordsmith") return null;
  const mine = (myAnswer ?? "")
    .split(",")
    .map((word) => word.trim().toUpperCase())
    .filter((word) => word.length > 0);
  const points = mine.reduce((sum, word) => sum + wordsmithPoints(word), 0);
  const missed = (puzzle.words ?? []).filter((entry) => !mine.includes(entry.word)).slice(0, 5);

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
        <span className="text-primary">{points} points × 3 = {scoreWordHunt(points)}</span> · {mine.length} words
      </p>

      {mine.length > 0 && (
        <ul className="flex w-full flex-wrap justify-center gap-x-3 gap-y-1">
          {mine.map((word) => (
            <li key={word} className="font-mono text-[10px] uppercase text-foreground">
              <span>{word}</span>
              <span className="ml-1 text-primary">{wordsmithPoints(word)}</span>
            </li>
          ))}
        </ul>
      )}

      {missed.length > 0 && (
        <p className="text-center font-mono text-xs text-muted-foreground">
          You missed: {missed.map((entry) => `${entry.word} (${entry.points})`).join(" · ")}
        </p>
      )}
    </div>
  );
}

/**
 * Wordsmith is generated, checked and scored entirely on the server (the
 * dictionary never reaches a device), so the client definition only renders.
 */
export const wordsmithPuzzle: PuzzleDefinition = {
  key: "wordsmith",
  name: "Wordsmith",
  category: "word",
  timeLimitMs: 60_000,
  generate: () => ({ type: "wordsmith", letters: [] }) satisfies WordsmithPuzzleData,
  check: () => false,
  revealHeading: "Your words",
  IntroExample,
  Stage,
  Reveal,
};
