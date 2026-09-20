import { useEffect, useRef, useState } from "react";

import { pick, randInt, weightedPick } from "@/lib/duel/random";
import type { NumberSequencePuzzleData } from "@/lib/duel/types";

import { MyAnswerLine } from "@/components/puzzles/MyAnswerLine";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

// Every family here combines at least two rules (e.g. two operations, or an
// operation plus a changing step), so a single "add 3 each time" or "these are
// squares" pattern is never enough on its own.
type Family =
  | "increasing"
  | "squares"
  | "alternating"
  | "fibonacci"
  | "seconddiff"
  | "multiplyminus"
  | "nsquaredplusn"
  | "triangularplus";

const TERMS_SHOWN = 4;

/** Builds five terms (four shown + the answer) for one pattern family. */
function build(family: Family): { numbers: number[]; answer: number; rule: string } | null {
  const total = TERMS_SHOWN + 1;
  const terms: number[] = [];
  let rule = "";

  if (family === "increasing") {
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
    // Offset is always non-zero, so this is never a bare "square numbers" list.
    const offset = pick([1, 2, 3, 4, 5, 7, 10] as const);
    const from = randInt(1, 4);
    for (let i = from; i < from + total; i++) terms.push(i * i + offset);
    rule = `Square numbers plus ${offset}`;
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
  } else if (family === "triangularplus") {
    // Triangular numbers plus a constant — two rules combined, so it is never
    // just the plain triangular run.
    const offset = randInt(2, 12);
    const from = randInt(1, 6);
    for (let n = from; n < from + total; n++) terms.push((n * (n + 1)) / 2 + offset);
    rule = `Triangular numbers plus ${offset}`;
  } else if (family === "nsquaredplusn") {
    const from = randInt(1, 5);
    for (let n = from; n < from + total; n++) terms.push(n * n + n);
    rule = "Each number is n squared plus n";
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

const FAMILY_WEIGHTS: Record<Family, number> = {
  increasing: 16,
  squares: 14,
  alternating: 16,
  fibonacci: 10,
  seconddiff: 16,
  multiplyminus: 12,
  triangularplus: 12,
  nsquaredplusn: 6,
};
const FAMILIES = Object.keys(FAMILY_WEIGHTS) as Family[];

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Work out the pattern and type the next number.
      </p>
      <p className="font-mono text-2xl font-bold tabular-nums">3 7 13 21 ?</p>
      <p className="font-mono text-sm text-muted-foreground">
        answer <span className="font-bold text-primary">31</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Type the number and hit Submit. Faster = more points. You have 20 seconds.
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
  timeLimitMs: 20_000,
  generate: () => {
    for (let attempt = 0; attempt < 80; attempt++) {
      const built = build(weightedPick(FAMILIES, (family) => FAMILY_WEIGHTS[family]));
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
      numbers: [3, 7, 13, 21],
      answer: 31,
      rule: "The gaps grow by 2 each time",
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
