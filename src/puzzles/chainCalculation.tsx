import { useEffect, useRef, useState } from "react";

import { pick, randInt } from "@/lib/duel/random";
import type {
  ChainCalculationPuzzleData,
  ChainOperation,
  Operator,
} from "@/lib/duel/types";

import { MyAnswerLine } from "./anagram";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

function nextStep(current: number): ChainOperation {
  const options: ChainOperation[] = [];
  if (current < 400) options.push({ operator: "+", operand: randInt(2, Math.min(30, 400 - current)) });
  if (current > 2) options.push({ operator: "-", operand: randInt(2, Math.min(30, current - 1)) });
  for (const operand of [2, 3, 4]) {
    if (current * operand <= 400) options.push({ operator: "×", operand });
  }
  for (const operand of [2, 3, 4, 5]) {
    if (current % operand === 0) options.push({ operator: "÷", operand });
  }
  return pick(options);
}

function apply(value: number, step: ChainOperation): number {
  const actions: Record<Operator, () => number> = {
    "+": () => value + step.operand,
    "-": () => value - step.operand,
    "×": () => value * step.operand,
    "÷": () => value / step.operand,
  };
  return actions[step.operator]();
}

export function generateChainCalculation(): ChainCalculationPuzzleData {
  for (;;) {
    const start = randInt(5, 50);
    const operations: ChainOperation[] = [];
    const intermediates: number[] = [];
    let current = start;
    for (let index = 0; index < 4; index++) {
      const step = nextStep(current);
      current = apply(current, step);
      operations.push(step);
      intermediates.push(current);
    }
    if (operations.some((step) => step.operator === "×" || step.operator === "÷")) {
      return { type: "chaincalc", start, operations, intermediates, answer: current };
    }
  }
}

function Chain({
  start,
  operations,
  intermediates,
  compact = false,
}: {
  start: number;
  operations: ChainOperation[];
  intermediates?: number[];
  compact?: boolean;
}) {
  return (
    <div className={`font-mono tabular-nums ${compact ? "text-xl" : "text-3xl"}`}>
      <div className="grid grid-cols-[2rem_4rem_auto] items-center gap-x-2 py-1">
        <span />
        <span className="text-right font-bold">{start}</span>
        <span />
      </div>
      {operations.map((step, index) => (
        <div key={index} className="grid grid-cols-[2rem_4rem_auto] items-center gap-x-2 border-t border-border/60 py-1">
          <span className="text-muted-foreground">{step.operator === "-" ? "−" : step.operator}</span>
          <span className="text-right font-bold">{step.operand}</span>
          {intermediates && (
            <span className="pl-2 text-xs text-muted-foreground">= {intermediates[index]}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function IntroExample() {
  const operations: ChainOperation[] = [
    { operator: "+", operand: 8 },
    { operator: "×", operand: 2 },
    { operator: "-", operand: 5 },
  ];
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-center text-sm text-muted-foreground">Start at the top and work down the chain.</p>
      <Chain start={12} operations={operations} compact />
      <p className="font-mono text-sm text-muted-foreground">
        = <span className="font-bold text-primary">35</span>
      </p>
      <p className="text-center text-xs text-muted-foreground">
        Type the final number and hit Submit. Faster = more points.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit }: PuzzleStageProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const key = puzzle.type === "chaincalc" ? `${puzzle.start}:${puzzle.operations.map((step) => `${step.operator}${step.operand}`).join(",")}` : "";

  useEffect(() => {
    setValue("");
    inputRef.current?.focus();
  }, [key]);

  if (puzzle.type !== "chaincalc") return null;
  const submit = () => {
    if (!locked && value.length > 0) onSubmit(value);
  };

  return (
    <div className="flex flex-1 flex-col justify-between gap-5">
      <div className="flex flex-col items-center gap-3">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Work top to bottom</p>
        <Chain start={puzzle.start} operations={puzzle.operations} />
        <p className="font-mono text-3xl font-bold text-primary">= ?</p>
      </div>
      <div className="flex flex-col gap-3">
        <input
          ref={inputRef}
          value={value}
          disabled={locked}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={3}
          placeholder="Final answer"
          onChange={(event) => setValue(event.target.value.replace(/[^0-9]/g, ""))}
          onKeyDown={(event) => event.key === "Enter" && submit()}
          className="tap-target w-full rounded-xl border border-border bg-card px-4 py-3 text-center font-mono text-2xl tabular-nums text-foreground placeholder:font-sans placeholder:text-base placeholder:text-muted-foreground focus:border-primary focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          disabled={locked || value.length === 0}
          onClick={submit}
          className="tap-target w-full rounded-xl bg-primary font-display text-base font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-40"
        >
          Submit
        </button>
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  if (puzzle.type !== "chaincalc") return null;
  return (
    <>
      <Chain start={puzzle.start} operations={puzzle.operations} intermediates={puzzle.intermediates} compact />
      <p className="font-mono text-4xl font-bold text-primary">= {puzzle.answer}</p>
      <MyAnswerLine myAnswer={myAnswer} myCorrect={myCorrect} />
    </>
  );
}

export const chainCalculationPuzzle: PuzzleDefinition = {
  key: "chaincalc",
  name: "Chain Calculation",
  category: "number",
  generate: generateChainCalculation,
  check: (answer, puzzle) =>
    puzzle.type === "chaincalc" && Number.parseInt(answer.trim(), 10) === puzzle.answer,
  IntroExample,
  Stage,
  Reveal,
};