import { useEffect, useState } from "react";

import { randInt, shuffled } from "@/lib/duel/random";
import type { EquationPuzzleData, Operator } from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

export const OPERATORS: Operator[] = ["+", "-", "×", "÷"];

/** Strict left-to-right evaluation. Returns null on a non-whole or negative step. */
export function evaluateLeftToRight(numbers: number[], ops: Operator[]): number | null {
  let value = numbers[0]!;
  for (let i = 0; i < ops.length; i++) {
    const next = numbers[i + 1]!;
    const op = ops[i]!;
    if (op === "+") value += next;
    else if (op === "-") value -= next;
    else if (op === "×") value *= next;
    else {
      if (next === 0 || value % next !== 0) return null;
      value /= next;
    }
    if (value < 0 || !Number.isInteger(value)) return null;
  }
  return value;
}

function allPairs(): Operator[][] {
  const pairs: Operator[][] = [];
  for (const a of OPERATORS) for (const b of OPERATORS) pairs.push([a, b]);
  return pairs;
}

export function buildEquation(): EquationPuzzleData {
  for (let attempt = 0; attempt < 600; attempt++) {
    const numbers = [randInt(1, 12), randInt(1, 12), randInt(1, 12)];
    const solutions = allPairs()
      .map((ops) => ({ ops, value: evaluateLeftToRight(numbers, ops) }))
      .filter((r) => r.value !== null) as { ops: Operator[]; value: number }[];

    const candidates = shuffled(solutions).filter(
      (candidate) =>
        candidate.value >= 0 &&
        candidate.value <= 144 &&
        solutions.filter((other) => other.value === candidate.value).length === 1,
    );
    const chosen = candidates[0];
    if (!chosen) continue;
    return { type: "equation", numbers, target: chosen.value, operators: chosen.ops };
  }
  return { type: "equation", numbers: [8, 4, 2], target: 10, operators: ["+", "-"] };
}

function OperatorSlot({ value, onClick }: { value: Operator | null; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-lg border font-mono text-2xl font-bold ${
        value
          ? "border-primary/70 bg-primary/15 text-primary"
          : "border-dashed border-border bg-card text-muted-foreground"
      }`}
    >
      {value ?? "▢"}
    </button>
  );
}

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Pick the two operators that make the equation true. Work it out left to right.
      </p>
      <div className="flex items-center gap-2 font-mono text-2xl font-bold tabular-nums">
        <span>8</span>
        <OperatorSlot value={null} />
        <span>4</span>
        <OperatorSlot value={null} />
        <span>2</span>
        <span>= 10</span>
      </div>
      <p className="font-mono text-sm text-muted-foreground">
        answer <span className="font-bold text-primary">8 + 4 − 2 = 10</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Tap the operators, then hit Submit. Faster = more points.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit }: PuzzleStageProps) {
  const [slots, setSlots] = useState<(Operator | null)[]>([null, null]);
  const key = puzzle.type === "equation" ? `${puzzle.numbers.join(",")}=${puzzle.target}` : "";

  useEffect(() => {
    setSlots([null, null]);
  }, [key]);

  if (puzzle.type !== "equation") return null;

  const tapOperator = (op: Operator) => {
    if (locked) return;
    setSlots((prev) => {
      const next = [...prev];
      const target = next[0] === null ? 0 : next[1] === null ? 1 : -1;
      if (target === -1) return prev;
      next[target] = op;
      return next;
    });
  };

  const clearSlot = (index: number) => {
    if (locked) return;
    setSlots((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  };

  const ready = slots.every((s) => s !== null);

  return (
    <div className="flex flex-1 flex-col justify-between gap-6">
      <div className="flex flex-col items-center gap-6 pt-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Left to right — no BODMAS
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-card px-4 py-6 font-mono text-2xl font-bold tabular-nums">
          <span>{puzzle.numbers[0]}</span>
          <OperatorSlot value={slots[0] ?? null} onClick={() => clearSlot(0)} />
          <span>{puzzle.numbers[1]}</span>
          <OperatorSlot value={slots[1] ?? null} onClick={() => clearSlot(1)} />
          <span>{puzzle.numbers[2]}</span>
          <span className="text-primary">= {puzzle.target}</span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {OPERATORS.map((op) => (
            <button
              key={op}
              type="button"
              disabled={locked}
              onClick={() => tapOperator(op)}
              className="tap-target flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-card font-mono text-3xl font-bold text-foreground disabled:opacity-50"
            >
              {op === "-" ? "−" : op}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => ready && !locked && onSubmit(slots.join(","))}
        disabled={locked || !ready}
        className="tap-target w-full rounded-xl bg-primary font-display text-base font-bold uppercase tracking-wide text-primary-foreground transition-opacity disabled:opacity-40"
      >
        Submit
      </button>
    </div>
  );
}

function display(op: string): string {
  return op === "-" ? "−" : op;
}

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  if (puzzle.type !== "equation") return null;
  const mine = (myAnswer ?? "").split(",").filter((v) => v.length > 0);
  return (
    <>
      <p className="font-mono text-3xl font-bold tabular-nums text-primary">
        {puzzle.numbers[0]} {display(puzzle.operators[0]!)} {puzzle.numbers[1]}{" "}
        {display(puzzle.operators[1]!)} {puzzle.numbers[2]} = {puzzle.target}
      </p>
      <div className="flex w-full flex-col items-center gap-3 rounded-2xl bg-card px-4 py-5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Your answer</p>
        {mine.length < 2 ? (
          <p className="font-display text-2xl font-bold text-warn">No answer</p>
        ) : (
          <p
            className={`font-mono text-2xl font-bold tabular-nums ${
              myCorrect ? "text-primary" : "text-warn"
            }`}
          >
            {puzzle.numbers[0]} {display(mine[0]!)} {puzzle.numbers[1]} {display(mine[1]!)}{" "}
            {puzzle.numbers[2]} {myCorrect ? "✓" : "✗"}
          </p>
        )}
      </div>
    </>
  );
}

export const equationPuzzle: PuzzleDefinition = {
  key: "equation",
  name: "Equation Balancing",
  category: "number",
  generate: buildEquation,
  check: (answer, puzzle) => {
    if (puzzle.type !== "equation") return false;
    const ops = answer.split(",").filter((v) => v.length > 0) as Operator[];
    if (ops.length !== 2 || ops.some((op) => !OPERATORS.includes(op))) return false;
    return evaluateLeftToRight(puzzle.numbers, ops) === puzzle.target;
  },
  IntroExample,
  Stage,
  Reveal,
};
