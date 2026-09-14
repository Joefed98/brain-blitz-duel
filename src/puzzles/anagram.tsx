import { pick } from "@/lib/duel/random";
import type { AnagramPuzzleData } from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { AnagramPuzzle } from "@/components/puzzles/AnagramPuzzle";
import { EIGHT_LETTER_WORDS, SEVEN_LETTER_WORDS } from "./words";

/** Seven- and eight-letter words only. */
export const ANAGRAM_WORDS = [...SEVEN_LETTER_WORDS, ...EIGHT_LETTER_WORDS];

/**
 * A fair scramble never starts with the word's first letter and never leaves
 * two letters next to each other in their original order.
 */
function isFairOrder(order: number[], word: string): boolean {
  // Never opens with the word's first letter.
  if (word[order[0]!] === word[0]) return false;
  for (let i = 0; i < order.length - 1; i++) {
    if (order[i + 1] === order[i]! + 1) return false;
  }
  return true;
}

export function scramble(word: string): string {
  const upper = word.toUpperCase();
  const indices = upper.split("").map((_, i) => i);
  for (let attempt = 0; attempt < 400; attempt++) {
    const order = [...indices];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    if (!isFairOrder(order, upper)) continue;
    return order.map((i) => upper[i]!).join("");
  }
  // Deterministic fallback: interleave from the back, which satisfies both rules.
  const order: number[] = [];
  for (let i = indices.length - 1; i >= 0; i--) order.push(i);
  return order.map((i) => upper[i]!).join("");
}

/** Fixed intro example tiles — never randomised. */
const EXAMPLE = ["T", "A", "V", "H", "S", "R", "E"];

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">Unscramble the letters to make a word.</p>
      <div className="flex gap-1.5">
        {EXAMPLE.map((letter, index) => (
          <span
            key={index}
            className="flex h-11 w-9 items-center justify-center rounded-lg border border-border bg-card font-display text-base font-bold"
          >
            {letter}
          </span>
        ))}
      </div>
      <p className="font-mono text-sm text-muted-foreground">
        answer <span className="font-bold text-primary">HARVEST</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Type the word and hit Submit. Faster = more points.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit }: PuzzleStageProps) {
  if (puzzle.type !== "anagram") return null;
  return <AnagramPuzzle puzzle={puzzle} locked={locked} onSubmit={onSubmit} />;
}

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  if (puzzle.type !== "anagram") return null;
  return (
    <>
      <p className="font-display text-4xl font-bold text-primary">{puzzle.word}</p>
      <MyAnswerLine myAnswer={myAnswer} myCorrect={myCorrect} />
    </>
  );
}

/** Shared plain-text "your answer" line used by the typed puzzle types. */
export function MyAnswerLine({
  myAnswer,
  myCorrect,
}: {
  myAnswer: string | null;
  myCorrect: boolean;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-3 rounded-2xl bg-card px-4 py-5">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Your answer</p>
      {!myAnswer ? (
        <p className="font-display text-2xl font-bold text-warn">No answer</p>
      ) : (
        <p
          className={`font-display text-2xl font-bold ${myCorrect ? "text-primary" : "text-warn"}`}
        >
          {myAnswer} {myCorrect ? "✓" : "✗"}
        </p>
      )}
    </div>
  );
}

export const anagramPuzzle: PuzzleDefinition = {
  key: "anagram",
  name: "Anagram",
  category: "word",
  generate: () => {
    const word = pick(ANAGRAM_WORDS).toUpperCase();
    return { type: "anagram", word, scrambled: scramble(word) } satisfies AnagramPuzzleData;
  },
  check: (answer, puzzle) =>
    puzzle.type === "anagram" && answer.trim().toUpperCase() === puzzle.word.trim().toUpperCase(),
  IntroExample,
  Stage,
  Reveal,
};
