import { gameDisplayName } from "@/lib/duel/gameNames";
import { WordsmithRing } from "@/components/puzzles/WordsmithRing";
import { WordsmithPuzzle } from "@/components/puzzles/WordsmithPuzzle";
import { wordsmithPoints, type WordsmithPuzzleData } from "@/lib/duel/types";
import { WORDSMITH_TIME_MS } from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro example — never randomised. Centre letter is index 4. */
const EXAMPLE_TILES = ["C", "A", "R", "E", "P", "N", "T", "E", "R"];
const EXAMPLE_WORDS = ["CARPENTER", "PARENT", "CARPET", "REPENT"];

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Tap the round tiles to make words - the glowing centre letter must be in every word.
      </p>
      <div className="flex items-start gap-4">
        <div className="wordsmith-ring-example w-[160px] shrink-0">
          <WordsmithRing letters={EXAMPLE_TILES} />
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
      <p className="text-xs text-muted-foreground">No plurals. Longer words score more: 9+ letters is 15 word points. More word points, higher score: 140 at most, 150 only with the word that uses every tile. You have 100 seconds.</p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit, onDraftAnswer, checkWord }: PuzzleStageProps) {
  if (puzzle.type !== "wordsmith") return null;
  return (
    <WordsmithPuzzle
      puzzle={puzzle}
      phaseStartedAt={phaseStartedAt}
      now={now}
      locked={locked}
      onSubmit={onSubmit}
      onDraftAnswer={onDraftAnswer}
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
  const missed = (puzzle.words ?? [])
    .filter((entry) => !mine.includes(entry.word))
    .sort((a, b) => b.word.length - a.word.length || b.points - a.points)
    .slice(0, 5);
  const pangram = puzzle.source ?? (puzzle.words ?? []).find((entry) => entry.word.length === puzzle.letters.length)?.word;

  // Sized so all 25-odd words of a board fit on one 375×667 screen: the ring sits
  // beside the counts, and both lists run in compact columns (14 px text).
  return (
    <div data-word-reveal="wordsmith" className="flex w-full flex-col items-center gap-3">
      <div className="flex items-center gap-4">
        <div className="wordsmith-ring-example w-[112px] shrink-0">
          <WordsmithRing letters={puzzle.letters} />
        </div>
        <div className="flex flex-col gap-1 font-mono text-sm">
          <p className="text-base uppercase tracking-widest text-foreground">{mine.length} words</p>
          {pangram && (
            <p className="text-muted-foreground">
              {puzzle.letters.length}-letter word:
              <br />
              <span className="text-primary">{pangram}</span>
            </p>
          )}
        </div>
      </div>

      {mine.length > 0 && (
        <ul className="word-reveal-list w-full">
          {mine.map((word) => (
            <li key={word}>
              <span>{word}</span>
              <span className="text-primary">{wordsmithPoints(word)}</span>
            </li>
          ))}
        </ul>
      )}

      {missed.length > 0 && (
        <div className="flex w-full flex-col items-center gap-1">
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">You missed</p>
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
 * Wordsmith is generated, checked and scored entirely on the server (the
 * dictionary never reaches a device), so the client definition only renders.
 */
export const wordsmithPuzzle: PuzzleDefinition = {
  key: "wordsmith",
  name: gameDisplayName("wordsmith"),
  category: "word",
  timeLimitMs: WORDSMITH_TIME_MS,
  generate: () => ({ type: "wordsmith", letters: [] }) satisfies WordsmithPuzzleData,
  check: () => false,
  revealHeading: "Your words",
  IntroExample,
  Stage,
  Reveal,
};
