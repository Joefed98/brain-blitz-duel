import { useEffect, useRef, useState } from "react";

import { pick, shuffled } from "@/lib/duel/random";
import type { MissingLettersPuzzleData } from "@/lib/duel/types";

import { MyAnswerLine } from "./anagram";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { EIGHT_LETTER_WORDS, NINE_LETTER_WORDS } from "./words";

/** Eight- and nine-letter words, kept in separate banks for the uniqueness check. */
const BANKS: Record<number, string[]> = {
  8: EIGHT_LETTER_WORDS,
  9: NINE_LETTER_WORDS,
};

const BLANK_COUNT = 4;

/** A blank layout is only fair if exactly one bank word fits the pattern. */
function unique(word: string, blanks: number[]): boolean {
  const bank = BANKS[word.length] ?? [];
  const matches = bank.filter((candidate) =>
    candidate.split("").every((letter, i) => blanks.includes(i) || letter === word[i]),
  );
  return matches.length === 1;
}

function validBlanks(blanks: number[]): boolean {
  const sorted = [...blanks].sort((a, b) => a - b);
  // Never all four adjacent.
  if (sorted.every((p, i) => i === 0 || p === sorted[i - 1]! + 1)) return false;
  // Never both of the first two letters.
  if (sorted.filter((p) => p < 2).length > 1) return false;
  return true;
}

const EXAMPLE_WORD = "SANDWICH";
const EXAMPLE_BLANKS = [1, 3, 5, 7];

function Tiles({
  word,
  blanks,
  reveal = false,
  size = "md",
}: {
  word: string;
  blanks: number[];
  reveal?: boolean;
  size?: "sm" | "md";
}) {
  const long = word.length >= 9;
  const box = size === "sm" ? "h-10 w-7 text-sm" : long ? "h-12 w-8 text-base" : "h-12 w-9 text-lg";
  return (
    <div className="flex justify-center gap-1">
      {word.split("").map((letter, index) => {
        const blank = blanks.includes(index);
        return (
          <span
            key={index}
            className={`flex items-center justify-center rounded-lg border font-display font-bold ${box} ${
              blank
                ? reveal
                  ? "border-primary/70 bg-primary/15 text-primary"
                  : "border-primary/70 bg-transparent text-transparent"
                : reveal
                  ? "border-border bg-card text-primary"
                  : "border-border bg-card text-foreground"
            }`}
          >
            {blank && !reveal ? "" : letter}
          </span>
        );
      })}
    </div>
  );
}

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Fill in the missing letters to complete the word.
      </p>
      <Tiles word={EXAMPLE_WORD} blanks={EXAMPLE_BLANKS} />
      <p className="font-mono text-sm text-muted-foreground">
        answer <span className="font-bold text-primary">SANDWICH</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Type the whole word and hit Submit. Faster = more points.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit }: PuzzleStageProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const key = puzzle.type === "missing" ? puzzle.word : "";

  useEffect(() => {
    setValue("");
    inputRef.current?.focus();
  }, [key]);

  if (puzzle.type !== "missing") return null;

  const submit = () => {
    if (locked || value.trim().length === 0) return;
    onSubmit(value.trim().toUpperCase());
  };

  return (
    <div className="flex flex-1 flex-col justify-between gap-8">
      <div className="flex flex-col items-center gap-5 pt-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Complete the word
        </p>
        <Tiles word={puzzle.word} blanks={puzzle.blanks} />
      </div>

      <div className="flex flex-col gap-3">
        <input
          ref={inputRef}
          value={value}
          disabled={locked}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={9}
          placeholder="Whole word"
          onChange={(e) => setValue(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          className="tap-target w-full rounded-xl border border-border bg-card px-4 py-3 text-center font-display text-2xl uppercase tracking-[0.15em] text-foreground placeholder:font-sans placeholder:text-base placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={submit}
          disabled={locked || value.trim().length === 0}
          className="tap-target w-full rounded-xl bg-primary font-display text-base font-bold uppercase tracking-wide text-primary-foreground transition-opacity disabled:opacity-40"
        >
          Submit
        </button>
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  if (puzzle.type !== "missing") return null;
  return (
    <>
      <Tiles word={puzzle.word} blanks={puzzle.blanks} reveal />
      <MyAnswerLine myAnswer={myAnswer} myCorrect={myCorrect} />
    </>
  );
}

export function buildMissingLetters(): MissingLettersPuzzleData {
  for (let attempt = 0; attempt < 400; attempt++) {
    const length = Math.random() < 0.5 ? 8 : 9;
    const word = pick(BANKS[length]!).toUpperCase();
    const positions = Array.from({ length }, (_, i) => i);
    for (let tries = 0; tries < 20; tries++) {
      const blanks = shuffled(positions)
        .slice(0, BLANK_COUNT)
        .sort((a, b) => a - b);
      if (!validBlanks(blanks)) continue;
      if (!unique(word.toLowerCase(), blanks)) continue;
      return { type: "missing", word, blanks };
    }
  }
  return { type: "missing", word: "SANDWICH", blanks: [1, 3, 5, 7] };
}

export const missingLettersPuzzle: PuzzleDefinition = {
  key: "missing",
  name: "Missing Letters",
  category: "word",
  generate: buildMissingLetters,
  check: (answer, puzzle) =>
    puzzle.type === "missing" && answer.trim().toUpperCase() === puzzle.word.trim().toUpperCase(),
  IntroExample,
  Stage,
  Reveal,
};
