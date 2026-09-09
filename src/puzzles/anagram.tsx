import { pick } from "@/lib/duel/random";
import type { AnagramPuzzleData } from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { AnagramPuzzle } from "@/components/puzzles/AnagramPuzzle";

export const SIX_LETTER_WORDS = [
  "garden","silver","planet","orange","market","winter","summer","guitar","packet","rocket",
  "socket","ticket","basket","castle","bottle","candle","handle","middle","purple","temple",
  "animal","bridge","butter","camera","canvas","carpet","cheese","cherry","circle","coffee",
  "copper","corner","cotton","damage","danger","desert","dinner","doctor","dollar","donkey",
  "dragon","driver","engine","eleven","expert","family","farmer","finger","flower","forest",
  "friend","future","garage","ginger","golden","ground","hammer","hidden","hollow","honest",
  "hunter","island","jacket","jungle","kitten","ladder","laptop","lawyer","legend","letter",
  "lizard","magnet","marble","meadow","member","mirror","monkey","mother","muscle","napkin",
  "nature","needle","nickel","noodle","number","object","office","oxygen","palace","parent",
  "parrot","pencil","people","pepper","person","pillow","pirate","pocket","poison","police",
  "potato","powder","prince","prison","puzzle","rabbit","ribbon","rubber","saddle","salmon",
  "school","season","second","shadow","shield","signal","singer","sister","soccer","spider",
  "spring","square","statue","stream","street","string","studio","sunset","tunnel","turtle",
  "valley","velvet","wallet","window","wizard","yellow",
];

export function scramble(word: string): string {
  const letters = word.toUpperCase().split("");
  let out = word.toUpperCase();
  for (let attempt = 0; attempt < 20 && out === word.toUpperCase(); attempt++) {
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j]!, letters[i]!];
    }
    out = letters.join("");
  }
  if (out === word.toUpperCase()) out = out.slice(1) + out[0];
  return out;
}

/** Fixed intro example tiles — never randomised. */
const EXAMPLE = ["T", "A", "P", "L", "N", "E"];

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">Unscramble the letters to make a word.</p>
      <div className="flex gap-2">
        {EXAMPLE.map((letter, index) => (
          <span
            key={index}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card font-display text-lg font-bold"
          >
            {letter}
          </span>
        ))}
      </div>
      <p className="font-mono text-sm text-muted-foreground">
        answer <span className="font-bold text-primary">PLANET</span>
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
      <p className="font-display text-5xl font-bold text-primary">{puzzle.word}</p>
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
          className={`font-display text-3xl font-bold ${myCorrect ? "text-primary" : "text-warn"}`}
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
    const word = pick(SIX_LETTER_WORDS).toUpperCase();
    return { type: "anagram", word, scrambled: scramble(word) } satisfies AnagramPuzzleData;
  },
  check: (answer, puzzle) =>
    puzzle.type === "anagram" &&
    answer.trim().toUpperCase() === puzzle.word.trim().toUpperCase(),
  IntroExample,
  Stage,
  Reveal,
};
