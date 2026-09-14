import { useEffect, useRef, useState } from "react";

import { pick, randInt } from "@/lib/duel/random";
import type { NumberSequencePuzzleData } from "@/lib/duel/types";

import { MyAnswerLine } from "./anagram";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

type Family =
  | "add"
  | "subtract"
  | "multiply"
  | "increasing"
  | "squares"
  | "alternating"
  | "fibonacci"
  | "seconddiff"
  | "multiplyminus"
  | "triangular"
  | "nsquaredplusn"
  | "primes";

const TERMS_SHOWN = 4;
const PRIMES = [
  2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97,
  101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193,
];

/** Builds five terms (four shown + the answer) for one pattern family. */
function build(family: Family): { numbers: number[]; answer: number; rule: string } | null {
  const total = TERMS_SHOWN + 1;
  const terms: number[] = [];
  let rule = "";

  if (family === "add") {
    const step = randInt(3, 19);
    const start = randInt(1, 40);
    for (let i = 0; i < total; i++) terms.push(start + i * step);
    rule = `Add ${step} each time`;
  } else if (family === "subtract") {
    const step = randInt(3, 17);
    const start = step * 5 + randInt(0, 40);
    for (let i = 0; i < total; i++) terms.push(start - i * step);
    rule = `Subtract ${step} each time`;
  } else if (family === "multiply") {
    const factor = pick([2, 3] as const);
    const start = factor === 2 ? randInt(2, 20) : randInt(1, 8);
    for (let i = 0; i < total; i++) terms.push(start * factor ** i);
    rule = factor === 2 ? "Each number doubles" : "Each number triples";
  } else if (family === "increasing") {
    const start = randInt(1, 20);
    const firstStep = randInt(1, 4);
    let value = start;
    let step = firstStep;
    for (let i = 0; i < total; i++) {
      terms.push(value);
      value += step;
      step += 1;
    }
    rule = `Add one more each time, starting with +${firstStep}`;
  } else if (family === "squares") {
    const offset = pick([0, 0, 1, 2, 5] as const);
    const from = randInt(1, 4);
    for (let i = from; i < from + total; i++) terms.push(i * i + offset);
    rule = offset === 0 ? "Square numbers" : `Square numbers plus ${offset}`;
  } else if (family === "alternating") {
    const add = randInt(3, 9);
    const start = randInt(2, 12);
    let value = start;
    for (let i = 0; i < total; i++) {
      terms.push(value);
      value = i % 2 === 0 ? value + add : value * 2;
    }
    rule = `Alternately add ${add} and double`;
  } else if (family === "seconddiff") {
    const first = randInt(2, 6);
    const growth = randInt(1, 4);
    const start = randInt(1, 30);
    let value = start;
    let step = first;
    for (let i = 0; i < total; i++) {
      terms.push(value);
      value += step;
      step += growth;
    }
    rule = `The gaps start at +${first} and grow by ${growth} each time`;
  } else if (family === "multiplyminus") {
    const factor = pick([2, 3] as const);
    const minus = randInt(2, 9);
    const start = randInt(4, 15);
    let value = start;
    for (let i = 0; i < total; i++) {
      terms.push(value);
      value = i % 2 === 0 ? value * factor : value - minus;
    }
    rule = `Alternately multiply by ${factor} and subtract ${minus}`;
  } else if (family === "triangular") {
    const from = randInt(1, 6);
    for (let n = from; n < from + total; n++) terms.push((n * (n + 1)) / 2);
    rule = from === 1 ? "Triangular numbers" : "Triangular numbers, carrying on the run";
  } else if (family === "nsquaredplusn") {
    const from = randInt(1, 5);
    for (let n = from; n < from + total; n++) terms.push(n * n + n);
    rule = "Each number is n squared plus n";
  } else if (family === "primes") {
    const from = randInt(0, PRIMES.length - total);
    for (let i = from; i < from + total; i++) terms.push(PRIMES[i]!);
    rule = from === 0 ? "Prime numbers" : "Prime numbers, carrying on the run";
  } else {
    const a = randInt(1, 6);
    const b = randInt(a, a + 6);
    terms.push(a, b);
    for (let i = 2; i < total; i++) terms.push(terms[i - 1]! + terms[i - 2]!);
    rule = "Each number is the sum of the two before it";
  }

  if (terms.some((n) => n < 0 || n > 999 || !Number.isInteger(n))) return null;
  if (new Set(terms).size !== terms.length) return null;
  return { numbers: terms.slice(0, TERMS_SHOWN), answer: terms[TERMS_SHOWN]!, rule };
}

const FAMILIES: Family[] = [
  "add",
  "subtract",
  "multiply",
  "increasing",
  "squares",
  "alternating",
  "fibonacci",
  "seconddiff",
  "multiplyminus",
  "triangular",
  "nsquaredplusn",
  "primes",
];

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Work out the pattern and type the next number.
      </p>
      <p className="font-mono text-2xl font-bold tabular-nums">2 4 8 16 ?</p>
      <p className="font-mono text-sm text-muted-foreground">
        answer <span className="font-bold text-primary">32</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Type the number and hit Submit. Faster = more points.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit }: PuzzleStageProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const key = puzzle.type === "numseq" ? puzzle.numbers.join(",") : "";

  useEffect(() => {
    setValue("");
    inputRef.current?.focus();
  }, [key]);

  if (puzzle.type !== "numseq") return null;

  const submit = () => {
    if (locked || value.trim().length === 0) return;
    onSubmit(value.trim());
  };

  return (
    <div className="flex flex-1 flex-col justify-between gap-8">
      <div className="flex flex-col items-center gap-5 pt-4">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">What comes next?</p>
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-card px-4 py-6">
          {puzzle.numbers.map((n, index) => (
            <span key={index} className="font-mono text-2xl font-bold tabular-nums text-foreground">
              {n}
            </span>
          ))}
          <span className="font-mono text-2xl font-bold text-primary">?</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <input
          ref={inputRef}
          value={value}
          disabled={locked}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          placeholder="Answer"
          onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          className="tap-target w-full rounded-xl border border-border bg-card px-4 py-3 text-center font-mono text-2xl tabular-nums text-foreground placeholder:font-sans placeholder:text-base placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
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
  if (puzzle.type !== "numseq") return null;
  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {puzzle.numbers.map((n, index) => (
          <span key={index} className="font-mono text-2xl font-bold tabular-nums text-foreground">
            {n}
          </span>
        ))}
        <span className="font-mono text-3xl font-bold tabular-nums text-primary">
          {puzzle.answer}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{puzzle.rule}</p>
      <MyAnswerLine myAnswer={myAnswer} myCorrect={myCorrect} />
    </>
  );
}

export const numberSequencePuzzle: PuzzleDefinition = {
  key: "numseq",
  name: "Number Sequence",
  category: "number",
  generate: () => {
    for (let attempt = 0; attempt < 80; attempt++) {
      const built = build(pick(FAMILIES));
      if (built) {
        return {
          type: "numseq",
          numbers: built.numbers,
          answer: built.answer,
          rule: built.rule,
        } satisfies NumberSequencePuzzleData;
      }
    }
    return {
      type: "numseq",
      numbers: [3, 10, 17, 24],
      answer: 31,
      rule: "Add 7 each time",
    } satisfies NumberSequencePuzzleData;
  },
  check: (answer, puzzle) => {
    if (puzzle.type !== "numseq") return false;
    const parsed = Number.parseInt(answer.trim(), 10);
    return Number.isFinite(parsed) && parsed === puzzle.answer;
  },
  IntroExample,
  Stage,
  Reveal,
};
