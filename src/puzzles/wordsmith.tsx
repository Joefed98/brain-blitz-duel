import { WordsmithPuzzle } from "@/components/puzzles/WordsmithPuzzle";
import { wordsmithPoints, type WordsmithPuzzleData } from "@/lib/duel/types";
import { scoreWordsmith } from "@/lib/duel/scoring";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro example — never randomised. Centre letter is index 4. */
const EXAMPLE_TILES = ["C", "A", "R", "E", "P", "N", "T", "E", "R"];
const EXAMPLE_WORDS = ["CARPENTER", "PARENT", "CARPET", "REPENT"];

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Make words from the nine letters — every word must use the centre letter.
      </p>
      <div className="flex items-start gap-4">
        <div className="grid grid-cols-3 gap-1.5">
          {EXAMPLE_TILES.map((letter, index) => (
            <span
              key={index}
              className={`flex h-10 w-10 items-center justify-center rounded-lg border font-display text-base font-bold ${
                index === 4 ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
              }`}
            >
              {letter}
            </span>
          ))}
        </div>
        <ul className="flex flex-col gap-1">
          {EXAMPLE_WORDS.map((word) => (
            <li key={word} className="flex items-center gap-3 font-mono text-xs uppercase tracking-widest">
              <span>{word}</span>
              <span className="text-primary">{wordsmithPoints(word)}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">No plurals. Longer words score more; find the nine-letter word for 15. Word points × 2 = round score (max 150). You have 120 seconds.</p>
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
  const missed = (puzzle.words ?? [])
    .filter((entry) => !mine.includes(entry.word))
    .sort((a, b) => b.word.length - a.word.length || b.points - a.points)
    .slice(0, 5);
  const nine = puzzle.source ?? (puzzle.words ?? []).find((entry) => entry.word.length === 9)?.word;

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="font-mono text-base uppercase tracking-widest text-muted-foreground">
        <span className="text-primary">{points} points × 2 = {scoreWordsmith(points)}</span> · {mine.length} words
      </p>

      {mine.length > 0 && (
        <ul className="flex w-full flex-col items-center gap-1">
          {mine.map((word) => (
            <li key={word} className="font-mono text-base uppercase text-foreground">
              <span>{word}</span>
              <span className="ml-1 text-primary">{wordsmithPoints(word)}</span>
            </li>
          ))}
        </ul>
      )}

      {missed.length > 0 && (
        <div className="w-full text-center font-mono text-base text-muted-foreground">
          <p>You missed:</p>
          <ul className="flex flex-col gap-1">{missed.map((entry) => <li key={entry.word}>{entry.word} ({entry.points})</li>)}</ul>
        </div>
      )}

      {nine && (
        <p className="text-center font-mono text-base text-muted-foreground">
          Nine-letter word: <span className="text-primary">{nine}</span>
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
  timeLimitMs: 120_000,
  generate: () => ({ type: "wordsmith", letters: [] }) satisfies WordsmithPuzzleData,
  check: () => false,
  revealHeading: "Your words",
  IntroExample,
  Stage,
  Reveal,
};
