import { ArithmeticPuzzle } from "@/components/puzzles/ArithmeticPuzzle";
import { pick, randInt } from "@/lib/duel/random";
import type { ArithmeticPuzzleData } from "@/lib/duel/types";

import { MyAnswerLine } from "./anagram";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">Solve the sum as fast as you can.</p>
      <p className="font-mono text-3xl font-bold">47 + 38 − 19 = ?</p>
      <p className="font-mono text-sm text-muted-foreground">
        answer <span className="font-bold text-primary">66</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Type the number and hit Submit. Faster = more points.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit }: PuzzleStageProps) {
  if (puzzle.type !== "arithmetic") return null;
  return <ArithmeticPuzzle puzzle={puzzle} locked={locked} onSubmit={onSubmit} />;
}

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  if (puzzle.type !== "arithmetic") return null;
  return (
    <>
      <p className="font-mono text-6xl font-bold text-primary">{puzzle.answer}</p>
      <MyAnswerLine myAnswer={myAnswer} myCorrect={myCorrect} />
    </>
  );
}

type Mode = "multiply" | "bigadd" | "bigsub" | "chain";

/** Every expression is worked out strictly left to right. */
function build(mode: Mode): { expression: string; answer: number } | null {
  if (mode === "multiply") {
    const a = randInt(12, 99);
    const b = randInt(3, 9);
    return { expression: `${a} × ${b}`, answer: a * b };
  }

  if (mode === "bigadd") {
    const a = randInt(120, 780);
    const b = randInt(120, 999 - a);
    return { expression: `${a} + ${b}`, answer: a + b };
  }

  if (mode === "bigsub") {
    const a = randInt(320, 999);
    const b = randInt(105, a - 20);
    return { expression: `${a} − ${b}`, answer: a - b };
  }

  // Two operations, left to right.
  const shape = pick(["addsub", "subadd", "mulsub", "muladd"] as const);
  if (shape === "addsub") {
    const a = randInt(24, 89);
    const b = randInt(18, 89);
    const c = randInt(11, a + b - 1);
    return { expression: `${a} + ${b} − ${c}`, answer: a + b - c };
  }
  if (shape === "subadd") {
    const a = randInt(60, 140);
    const b = randInt(15, a - 10);
    const c = randInt(15, 89);
    return { expression: `${a} − ${b} + ${c}`, answer: a - b + c };
  }
  const a = randInt(6, 24);
  const b = randInt(3, 9);
  const product = a * b;
  if (product > 900) return null;
  const c = shape === "mulsub" ? randInt(7, Math.min(90, product - 1)) : randInt(7, 999 - product);
  return {
    expression: `${a} × ${b} ${shape === "mulsub" ? "−" : "+"} ${c}`,
    answer: shape === "mulsub" ? product - c : product + c,
  };
}

const MODES: Mode[] = ["multiply", "bigadd", "bigsub", "chain", "chain"];

export const arithmeticPuzzle: PuzzleDefinition = {
  key: "arithmetic",
  name: "Quick Arithmetic",
  category: "number",
  generate: () => {
    for (let attempt = 0; attempt < 60; attempt++) {
      const built = build(pick(MODES));
      if (!built) continue;
      if (built.answer < 0 || built.answer > 999) continue;
      return {
        type: "arithmetic",
        expression: built.expression,
        answer: built.answer,
      } satisfies ArithmeticPuzzleData;
    }
    return { type: "arithmetic", expression: "47 + 38 − 19", answer: 66 };
  },
  check: (answer, puzzle) => {
    if (puzzle.type !== "arithmetic") return false;
    const parsed = Number.parseInt(answer.trim(), 10);
    return Number.isFinite(parsed) && parsed === puzzle.answer;
  },
  IntroExample,
  Stage,
  Reveal,
};
