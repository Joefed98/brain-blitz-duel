import { useEffect, useRef, useState } from "react";

import { pick, shuffled } from "@/lib/duel/random";
import type { MissingLettersPuzzleData } from "@/lib/duel/types";

import { MyAnswerLine } from "./anagram";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Common seven-letter words: no proper nouns, no plurals ending in S. */
export const SEVEN_LETTER_WORDS = [
  "balance","bargain","battery","bedroom","believe","between","bicycle","biology","blanket","brother",
  "cabinet","caption","capture","carrier","ceiling","central","century","chamber","channel","chapter",
  "charity","chicken","circuit","climate","clothes","collect","comfort","command","company","compare",
  "concert","confirm","connect","control","country","courage","crystal","culture","curtain","cushion",
  "dentist","deliver","descent","develop","diamond","digital","dolphin","drawing","eastern","economy",
  "elegant","embrace","engaged","evening","example","explain","factory","fashion","feather","fiction",
  "finance","fishing","fitness","flavour","flowers","foreign","forever","fortune","freedom","furnace",
  "gallery","garbage","gateway","general","genuine","glimpse","gravity","harbour","harmony","harvest",
  "healthy","hearing","heating","helpful","holiday","hunting","husband","imagine","improve","include",
  "journey","justice","kitchen","landing","laundry","leather","lecture","leisure","library","lighter",
  "machine","magical","manager","mansion","measure","meeting","message","mineral","mixture","monitor",
  "morning","musical","mystery","natural","network","nothing","obvious","organic","outdoor","package",
  "painter","parking","partner","passion","patient","pattern","payment","penalty","pension","perfect",
  "picture","pioneer","plastic","popular","portion","poverty","precise","predict","premium","present",
  "pretend","primary","printer","private","problem","produce","program","project","promise","protect",
  "publish","purpose","pyramid","quality","quarter","rainbow","reality","receipt","recover","reflect",
  "regular","related","release","remains","request","require","reserve","respect","restore","retreat",
  "reverse","routine","sailing","scatter","science","scratch","section","serious","service",
  "shelter","shortly","similar","society","soldier","special","station","stomach","storage","stretch",
  "student","subject","success","support","surface","survive","sweater","teacher","texture","theatre",
  "therapy","thought","tonight","tourist","traffic","tragedy","trouble","tuition","typical","uniform",
  "unusual","upgrade","utility","vaccine","variety","vehicle","venture","version","victory","village",
  "vintage","visible","visitor","volcano","voltage","weather","wedding","weekend","welcome","western",
  "whisper","willing","without","witness","working","writing",
].filter((w) => w.length === 7 && !w.endsWith("s"));

/** A blank layout is only fair if exactly one bank word fits the pattern. */
function unique(word: string, blanks: number[]): boolean {
  const matches = SEVEN_LETTER_WORDS.filter((candidate) =>
    candidate.split("").every((letter, i) => blanks.includes(i) || letter === word[i]),
  );
  return matches.length === 1;
}

function validBlanks(blanks: number[]): boolean {
  const sorted = [...blanks].sort((a, b) => a - b);
  // Never all three adjacent.
  if (sorted[1] === sorted[0]! + 1 && sorted[2] === sorted[1]! + 1) return false;
  // At most one of the first two letters.
  if (sorted.filter((p) => p < 2).length > 1) return false;
  return true;
}

const POSITIONS = [0, 1, 2, 3, 4, 5, 6];

const EXAMPLE_WORD = "BALANCE";
const EXAMPLE_BLANKS = [1, 3, 5];

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
  const box = size === "sm" ? "h-10 w-8 text-base" : "h-12 w-10 text-lg";
  return (
    <div className="flex justify-center gap-1.5">
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
        answer <span className="font-bold text-primary">BALANCE</span>
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
          maxLength={7}
          placeholder="Whole word"
          onChange={(e) => setValue(e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          className="tap-target w-full rounded-xl border border-border bg-card px-4 py-3 text-center font-display text-2xl uppercase tracking-[0.2em] text-foreground placeholder:font-sans placeholder:text-base placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
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
  for (let attempt = 0; attempt < 200; attempt++) {
    const word = pick(SEVEN_LETTER_WORDS).toUpperCase();
    for (let tries = 0; tries < 12; tries++) {
      const blanks = shuffled(POSITIONS).slice(0, 3).sort((a, b) => a - b);
      if (!validBlanks(blanks)) continue;
      if (!unique(word.toLowerCase(), blanks)) continue;
      return { type: "missing", word, blanks };
    }
  }
  return { type: "missing", word: "JOURNEY", blanks: [1, 3, 5] };
}

export const missingLettersPuzzle: PuzzleDefinition = {
  key: "missing",
  name: "Missing Letters",
  category: "word",
  generate: buildMissingLetters,
  check: (answer, puzzle) =>
    puzzle.type === "missing" &&
    answer.trim().toUpperCase() === puzzle.word.trim().toUpperCase(),
  IntroExample,
  Stage,
  Reveal,
};
