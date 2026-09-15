import { useEffect, useRef, useState } from "react";

import { pick, randInt } from "@/lib/duel/random";
import type { ChainCalculationPuzzleData, ChainOperation, Operator } from "@/lib/duel/types";

import { MyAnswerLine } from "@/components/puzzles/MyAnswerLine";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

function nextStep(current: number): ChainOperation {
  const options: ChainOperation[] = [];
  if (current < 950)
    options.push({ operator: "+", operand: randInt(3, Math.min(60, 999 - current)) });
  if (current > 3) options.push({ operator: "-", operand: randInt(3, Math.min(60, current - 1)) });
  for (const operand of [2, 3, 4, 5]) {
    if (current * operand <= 999) options.push({ operator: "×", operand });
  }
  for (const operand of [2, 3, 4, 5, 6]) {
    if (current % operand === 0 && current / operand >= 1) options.push({ operator: "÷", operand });
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
    const start = randInt(10, 80);
    const length = Math.random() < 0.5 ? 5 : 6;
    const operations: ChainOperation[] = [];
    const intermediates: number[] = [];
    let current = start;
    let ok = true;
    for (let index = 0; index < length; index++) {
      const step = nextStep(current);
      current = apply(current, step);
      if (!Number.isInteger(current) || current < 1 || current > 999) {
        ok = false;
        break;
      }
      operations.push(step);
      intermediates.push(current);
    }
    if (!ok) continue;
    const heavy = operations.filter(
      (step) => step.operator === "×" || step.operator === "÷",
    ).length;
    if (heavy >= 2) {
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
    <div className={`font-mono tabular-nums ${compact ? "text-xs" : "text-2xl"}`}>
      <div className="grid grid-cols-[2rem_4rem_auto] items-center gap-x-2 py-0.5">
        <span />
        <span className="text-right font-bold">{start}</span>
        <span />
      </div>
      {operations.map((step, index) => (
        <div
          key={index}
          className="grid grid-cols-[2rem_4rem_auto] items-center gap-x-2 border-t border-border/60 py-0.5"
        >
          <span className="text-muted-foreground">
            {step.operator === "-" ? "−" : step.operator}
          </span>
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
    { operator: "÷", operand: 7 },
    { operator: "×", operand: 9 },
  ];
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-center text-sm text-muted-foreground">
        Start at the top and work down the chain.
      </p>
      <Chain start={12} operations={operations} compact />
      <p className="font-mono text-sm text-muted-foreground">
        = <span className="font-bold text-primary">45</span>
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
  const key =
    puzzle.type === "chaincalc"
      ? `${puzzle.start}:${puzzle.operations.map((step) => `${step.operator}${step.operand}`).join(",")}`
      : "";

  useEffect(() => {
    setValue("");
    inputRef.current?.focus();
  }, [key]);

  if (puzzle.type !== "chaincalc") return null;
  const submit = () => {
    if (!locked && value.length > 0) onSubmit(value);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-between gap-2">
      <div className="flex min-h-0 flex-col items-center gap-1.5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Work top to bottom
        </p>
        <Chain start={puzzle.start} operations={puzzle.operations} />
        <p className="font-mono text-2xl font-bold text-primary">= ?</p>
      </div>
      <div className="flex shrink-0 flex-col gap-2">
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
  const expression = [
    String(puzzle.start),
    ...puzzle.operations.flatMap((step) => [step.operator === "-" ? "−" : step.operator, String(step.operand)]),
  ].join(" ");
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <p className="font-mono text-5xl font-bold text-primary">{puzzle.answer}</p>
      <button type="button" title={`Intermediate values: ${puzzle.intermediates.join(" · ")}`} className="w-full truncate font-mono text-[11px] text-muted-foreground">
        {expression}
      </button>
      <MyAnswerLine myAnswer={myAnswer} myCorrect={myCorrect} />
    </div>
  );
}

export const chainCalculationPuzzle: PuzzleDefinition = {
  key: "chaincalc",
  name: "Chain Calculation",
  category: "number",
  timeLimitMs: 45_000,
  generate: generateChainCalculation,
  check: (answer, puzzle) =>
    puzzle.type === "chaincalc" && Number.parseInt(answer.trim(), 10) === puzzle.answer,
  IntroExample,
  Stage,
  Reveal,
};
