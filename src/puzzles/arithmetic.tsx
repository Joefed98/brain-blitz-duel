import { ArithmeticPuzzle } from "@/components/puzzles/ArithmeticPuzzle";
import { pick, randInt } from "@/lib/duel/random";
import type { ArithmeticPuzzleData } from "@/lib/duel/types";

import { MyAnswerLine } from "./anagram";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">Solve the sum as fast as you can.</p>
      <p className="font-mono text-4xl font-bold">36 + 27 = ?</p>
      <p className="font-mono text-sm text-muted-foreground">
        answer <span className="font-bold text-primary">63</span>
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

export const arithmeticPuzzle: PuzzleDefinition = {
  key: "arithmetic",
  name: "Quick Arithmetic",
  category: "number",
  generate: () => {
    const op = pick(["+", "-", "×", "÷"] as const);
    let a: number;
    let b: number;
    let answer: number;

    if (op === "+") {
      a = randInt(17, 89);
      b = randInt(17, 89);
      answer = a + b;
    } else if (op === "-") {
      a = randInt(40, 99);
      b = randInt(11, a - 1);
      answer = a - b;
    } else if (op === "×") {
      a = randInt(6, 19);
      b = randInt(3, 9);
      answer = a * b;
    } else {
      b = randInt(3, 9);
      answer = randInt(4, 24);
      a = b * answer;
    }

    return {
      type: "arithmetic",
      expression: `${a} ${op} ${b}`,
      answer,
    } satisfies ArithmeticPuzzleData;
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
