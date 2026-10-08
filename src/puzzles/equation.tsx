import { gameDisplayName } from "@/lib/duel/gameNames";
import { useGameColumnLayout } from "@/components/puzzles/gameColumn";
import { useEffect, useRef } from "react";

import { StageProgress } from "@/components/puzzles/StageProgress";
import { StageCorrect, useStageCorrectHold } from "@/components/puzzles/StageCorrect";
import { randInt, shuffled } from "@/lib/duel/random";
import { useStageState } from "@/lib/duel/stageState";
import {
  equationStageCorrect,
  evaluateLeftToRight,
  joinStages,
  parseOperators,
  splitStages,
} from "@/lib/duel/stagedRounds";
import { EQUATION_STAGE_COUNT, EQUATION_TIME_MS, type EquationPuzzleData, type EquationStage, type Operator } from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

export { evaluateLeftToRight };

export const OPERATORS: Operator[] = ["+", "-", "×", "÷"];

/** Numbers per stage: three, four, five, then a harder five. */
export const EQUATION_STAGE_NUMBERS = [3, 4, 5, 5] as const;

/** Every operator combination for the given number of slots. */
export function allCombos(slots: number): Operator[][] {
  let combos: Operator[][] = [[]];
  for (let i = 0; i < slots; i++) combos = combos.flatMap((c) => OPERATORS.map((op) => [...c, op]));
  return combos;
}

/** Answer-first: pick numbers, keep a target reached by exactly one operator set. */
function buildStage(count: number, stageIndex: number): { stage: EquationStage; ops: Operator[] } {
  const combos = allCombos(count - 1);
  const allowed = (ops: Operator[]) => stageIndex === 3
    ? ops.includes("÷") && ops.includes("×") && new Set(ops).size >= 3
    : stageIndex !== 2 || !ops.includes("÷");
  for (let attempt = 0; attempt < 900; attempt++) {
    const numbers = Array.from({ length: count }, () => randInt(2, stageIndex === 3 ? 20 : count === 3 ? 12 : 15));
    const solutions = combos
      .map((ops) => ({ ops, value: evaluateLeftToRight(numbers, ops) }))
      .filter((r): r is { ops: Operator[]; value: number } => r.value !== null);
    const chosen = shuffled(solutions).find(
      (c) => c.value <= 400 && allowed(c.ops) && solutions.filter((o) => o.value === c.value).length === 1,
    );
    if (chosen) return { stage: { numbers, target: chosen.value }, ops: chosen.ops };
  }
  const fallback: Record<number, { stage: EquationStage; ops: Operator[] }> = {
    3: { stage: { numbers: [7, 3, 2], target: 20 }, ops: ["+", "×"] },
    4: { stage: { numbers: [8, 2, 5, 3], target: 17 }, ops: ["÷", "×", "-"] },
    5: { stage: { numbers: [9, 3, 4, 2, 5], target: 31 }, ops: ["-", "×", "+", "+"] },
  };
  if (stageIndex === 3) return { stage: { numbers: [12, 3, 7, 2, 5], target: 55 }, ops: ["+", "+", "÷", "×"] };
  const result = fallback[count];
  if (!result) throw new Error("Unsupported Equation stage");
  return result;
}

export function buildEquation(): EquationPuzzleData {
  const built = EQUATION_STAGE_NUMBERS.map((n, i) => buildStage(n, i));
  return { type: "equation", stages: built.map((b) => b.stage), operators: built.map((b) => b.ops) };
}

function OperatorSlot({ value, onClick }: { value: Operator | null; onClick?: (() => void) | undefined }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-lg border font-mono text-xl font-bold ${
        value
          ? "border-primary/70 bg-primary/15 text-primary"
          : "border-dashed border-border bg-card text-muted-foreground"
      }`}
    >
      {value ? display(value) : "▢"}
    </button>
  );
}

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-1.5 font-mono text-xl font-bold tabular-nums">
        <span>7</span>
        <OperatorSlot value={null} />
        <span>3</span>
        <OperatorSlot value={null} />
        <span>2</span>
        <span>= 20</span>
      </div>
      <p className="font-mono text-sm text-muted-foreground">
        answer <span className="font-bold text-primary">7 + 3 × 2 = 20</span>
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey = "equation" }: PuzzleStageProps) {
  const column = useGameColumnLayout();
  const data = puzzle.type === "equation" ? puzzle : null;
  const [stage, setStage] = useStageState<number>(stateKey, "eqStage", () => 0);
  const [answers, setAnswers] = useStageState<string[]>(stateKey, "eqAnswers", () => Array.from({ length: data?.stages.length ?? 4 }, () => ""));
  const [slots, setSlots] = useStageState<(Operator | null)[]>(stateKey, "eqSlots", () =>
    Array(Math.max(0, (data?.stages[0]?.numbers.length ?? 1) - 1)).fill(null),
  );
  const done = useRef(false);

  const total = data?.stages.length ?? 4;
  const current = data?.stages[Math.min(stage, total - 1)];
  const liveAnswers = answers.map((a, i) => (i === stage ? slots.filter(Boolean).join(",") : a));
  const draft = joinStages(liveAnswers, total);
  const complete = !!current && slots.every((slot) => slot !== null) && equationStageCorrect(current.numbers, current.target, slots.join(","));
  const holding = useStageCorrectHold({
    complete,
    finalStage: stage >= total - 1,
    locked: locked || done.current,
    stateKey,
    onAdvance: () => advance(slots),
  });
  useEffect(() => {
    onDraftAnswer?.(draft);
  }, [draft, onDraftAnswer]);

  if (!data || !current) return null;
  const frozen = locked || done.current || holding;

  const advance = (filled: (Operator | null)[]) => {
    const next = [...answers];
    next[stage] = filled.filter(Boolean).join(",");
    setAnswers(next);
    if (stage >= total - 1) {
      done.current = true;
      onSubmit(joinStages(next, total));
      return;
    }
    const nextStage = stage + 1;
    setStage(nextStage);
    const nextNumbers = data.stages[nextStage]?.numbers;
    if (nextNumbers) setSlots(Array(nextNumbers.length - 1).fill(null));
  };

  const tapOperator = (op: Operator) => {
    if (frozen) return;
    const index = slots.findIndex((s) => s === null);
    if (index === -1) return;
    const next = [...slots];
    next[index] = op;
    setSlots(next);
  };

  const clearSlot = (index: number) => {
    if (frozen) return;
    const next = [...slots];
    next[index] = null;
    setSlots(next);
  };

  const last = stage >= total - 1;

  return (
    <div data-stage-column="3" className={`flex min-h-0 flex-1 flex-col gap-3 ${column ? "" : "justify-between"}`}>
      <div data-game-arena="fixed" className="flex flex-col items-center gap-3">
        <StageProgress stage={stage} total={total} />
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Equation {stage + 1} of {total} · left to right
        </p>
        <div className="flex w-full flex-wrap items-center justify-center gap-1 rounded-2xl bg-card px-2 py-3 font-mono text-lg font-bold tabular-nums min-[390px]:text-xl">
          {current.numbers.map((n, index) => (
            <span key={index} className="flex items-center gap-1.5">
              <span>{n}</span>
              {index < current.numbers.length - 1 && (
                <OperatorSlot value={slots[index] ?? null} onClick={frozen ? undefined : () => clearSlot(index)} />
              )}
            </span>
          ))}
          <span className="text-primary">= {current.target}</span>
        </div>
        <StageCorrect visible={holding} />
        <div className="grid grid-cols-4 gap-2">
          {OPERATORS.map((op) => (
            <button
              key={op}
              type="button"
              disabled={frozen}
              onClick={() => tapOperator(op)}
              className="tap-target flex h-16 w-16 items-center justify-center rounded-xl border border-border bg-card font-mono text-3xl font-bold text-foreground disabled:opacity-50"
            >
              {display(op)}
            </button>
          ))}
        </div>
      </div>

      <button
        data-game-controls="submit"
        type="button"
        onClick={() => !frozen && advance(slots)}
        disabled={frozen}
        className="tap-target w-full rounded-xl bg-primary font-display text-base font-bold uppercase tracking-wide text-primary-foreground transition-opacity disabled:opacity-40"
      >
        {last ? "Submit" : "Next"}
      </button>
    </div>
  );
}

function display(op: string): string {
  return op === "-" ? "−" : op;
}

function Line({ numbers, ops }: { numbers: number[]; ops: string[] }) {
  return (
    <>
      {numbers.map((n, index) => (
        <span key={index}>
          {n}
          {index < ops.length ? ` ${display(ops[index]!)} ` : ""}
        </span>
      ))}
    </>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "equation") return null;
  const parts = splitStages(myAnswer, puzzle.stages.length);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col justify-center gap-2">
      {puzzle.stages.map((stage, i) => {
        const mine = parseOperators(parts[i] ?? "");
        const ok = equationStageCorrect(stage.numbers, stage.target, parts[i] ?? "");
        return (
          <div key={i} className="flex w-full flex-col items-center gap-1 rounded-lg bg-card px-2 py-2">
            <p className="text-sm text-muted-foreground">
              Equation {i + 1} · <span className={ok ? "text-primary" : "text-warn"}>{ok ? "✓" : mine.length < stage.numbers.length - 1 ? (mine.length ? "Incomplete ✗" : "Skipped ✗") : "✗"}</span>
            </p>
            <p className="text-center font-mono text-lg font-bold tabular-nums text-primary">
              <Line numbers={stage.numbers} ops={puzzle.operators?.[i] ?? []} /> = {stage.target}
            </p>
            {!ok && mine.length === stage.numbers.length - 1 && (
              <p className="text-center font-mono text-base font-bold tabular-nums text-warn">
                <Line numbers={stage.numbers} ops={mine} /> ✗
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export const equationPuzzle: PuzzleDefinition = {
  key: "equation",
  name: gameDisplayName("equation"),
  category: "number",
  timeLimitMs: EQUATION_TIME_MS,
  generate: buildEquation,
  check: (answer, puzzle) => {
    if (puzzle.type !== "equation") return false;
    const parts = splitStages(answer, puzzle.stages.length);
    return puzzle.stages.every((st, i) => equationStageCorrect(st.numbers, st.target, parts[i] ?? ""));
  },
  IntroExample,
  Stage,
  Reveal,
};
