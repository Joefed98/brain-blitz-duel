import { pick, randInt } from "@/lib/duel/random";
import type { PercentPuzzleData } from "@/lib/duel/types";

import { MyAnswerLine } from "./anagram";
import { NumberEntry } from "@/components/puzzles/NumberEntry";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">Work out the percentage or ratio.</p>
      <p className="font-mono text-3xl font-bold">25% of 160 = ?</p>
      <p className="font-mono text-sm text-muted-foreground">
        answer <span className="font-bold text-primary">40</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Type the number and hit Submit. Faster = more points.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit }: PuzzleStageProps) {
  if (puzzle.type !== "pctsprint") return null;
  return (
    <NumberEntry
      label="Percentages"
      resetKey={puzzle.question}
      locked={locked}
      onSubmit={onSubmit}
    >
      <div className="rounded-2xl bg-card px-5 py-7">
        <p className="text-center font-mono text-2xl font-bold tabular-nums text-foreground">
          {puzzle.question}
        </p>
      </div>
    </NumberEntry>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  if (puzzle.type !== "pctsprint") return null;
  return (
    <>
      <p className="text-center font-mono text-sm text-muted-foreground">{puzzle.question}</p>
      <p className="font-mono text-6xl font-bold text-primary">{puzzle.answer ?? "—"}</p>
      <p className="text-center font-mono text-xs text-muted-foreground">{puzzle.working ?? ""}</p>
      <MyAnswerLine myAnswer={myAnswer} myCorrect={myCorrect} />
    </>
  );
}

const NICE_PCT = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 75, 80, 90];

type Built = { question: string; answer: number; working: string };

function build(): Built | null {
  const family = pick(["of", "whatpct", "change", "ratio"] as const);

  if (family === "of") {
    const pct = pick(NICE_PCT);
    const n = randInt(3, 60) * 20; // always divisible enough for whole answers
    const answer = (pct * n) / 100;
    if (!Number.isInteger(answer)) return null;
    const tenth = n / 10;
    return {
      question: `${pct}% of ${n} = ?`,
      answer,
      working: `10% is ${tenth}, so ${pct}% is ${answer}`,
    };
  }

  if (family === "whatpct") {
    const pct = pick(NICE_PCT);
    const m = randInt(3, 50) * 20;
    const n = (pct * m) / 100;
    if (!Number.isInteger(n) || n < 1) return null;
    return {
      question: `${n} is what % of ${m}?`,
      answer: pct,
      working: `${n} ÷ ${m} = ${(n / m).toFixed(2)}, so ${pct}%`,
    };
  }

  if (family === "change") {
    const pct = pick([5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 75]);
    const n = randInt(2, 40) * 20;
    const part = (pct * n) / 100;
    if (!Number.isInteger(part)) return null;
    const up = Math.random() < 0.5;
    const answer = up ? n + part : n - part;
    if (answer < 1 || answer > 999) return null;
    return {
      question: `${up ? "Increase" : "Decrease"} ${n} by ${pct}%`,
      answer,
      working: `${pct}% of ${n} is ${part}, so ${n} ${up ? "+" : "−"} ${part} = ${answer}`,
    };
  }

  // Ratio split — always the larger share.
  const [a, b] = pick([
    [3, 5],
    [2, 3],
    [1, 4],
    [3, 7],
    [4, 5],
    [2, 7],
    [3, 4],
    [1, 3],
  ] as const);
  const parts = a + b;
  const one = randInt(3, 60);
  const total = one * parts;
  const answer = one * b;
  if (total > 999 || answer > 999) return null;
  return {
    question: `Split ${total} in the ratio ${a} : ${b} — larger share?`,
    answer,
    working: `${parts} parts, so 1 part is ${one}; ${b} parts is ${answer}`,
  };
}

export function buildPercentSprint(): PercentPuzzleData {
  for (let attempt = 0; attempt < 80; attempt++) {
    const built = build();
    if (!built) continue;
    if (!Number.isInteger(built.answer) || built.answer < 1 || built.answer > 999) continue;
    return { type: "pctsprint", ...built };
  }
  return {
    type: "pctsprint",
    question: "25% of 160 = ?",
    answer: 40,
    working: "10% is 16, so 25% is 40",
  };
}

export const percentSprintPuzzle: PuzzleDefinition = {
  key: "pctsprint",
  name: "Percent Sprint",
  category: "number",
  generate: buildPercentSprint,
  check: (answer, puzzle) => {
    if (puzzle.type !== "pctsprint") return false;
    const parsed = Number.parseInt(answer.trim(), 10);
    return Number.isFinite(parsed) && parsed === puzzle.answer;
  },
  IntroExample,
  Stage,
  Reveal,
};
