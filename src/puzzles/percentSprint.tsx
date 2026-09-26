import { useEffect, useRef, useState } from "react";

import { pick, randInt, shuffled } from "@/lib/duel/random";
import {
  PCTSPRINT_ITEMS,
  PCTSPRINT_TIME_MS,
  type PercentItem,
  type PercentPuzzleData,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro example — never randomised. */
const EXAMPLE_QUESTION = "15% of 240 = ?";
const EXAMPLE_OPTIONS = [36, 24, 32, 42];
const EXAMPLE_ANSWER = 36;

function OptionGrid({
  options,
  highlight,
  onPick,
  disabled,
}: {
  options: number[];
  highlight?: number;
  onPick?: (index: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid w-full grid-cols-2 gap-2">
      {options.map((value, index) => {
        const lit = highlight === value;
        const className = `flex items-center justify-center rounded-xl border font-mono text-2xl font-bold tabular-nums ${
          lit
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-card text-foreground"
        }`;
        if (!onPick) {
          return (
            <span key={index} className={`${className} h-14`}>
              {value}
            </span>
          );
        }
        return (
          <button
            key={index}
            type="button"
            disabled={disabled}
            onClick={() => onPick(index)}
            className={`tap-target h-20 ${className} disabled:opacity-40`}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}

function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Work out the percentage, then tap the right number.
      </p>
      <p className="font-mono text-3xl font-bold">{EXAMPLE_QUESTION}</p>
      <OptionGrid options={EXAMPLE_OPTIONS} highlight={EXAMPLE_ANSWER} />
      <p className="text-center text-xs text-muted-foreground">
        Five questions. Tap the answer. Get all five right to earn the speed bonus. You have 45
        seconds.
      </p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit }: PuzzleStageProps) {
  const items: PercentItem[] = puzzle.type === "pctsprint" ? puzzle.items : [];
  const key = items.map((i) => i.question).join("|");
  const [taps, setTaps] = useState<number[]>([]);
  const submitted = useRef("");

  useEffect(() => {
    setTaps([]);
  }, [key]);

  // Submit the run once every question is answered, or just before time is up.
  useEffect(() => {
    if (items.length === 0 || locked || submitted.current === key) return;
    const timeUp = now >= phaseStartedAt + PCTSPRINT_TIME_MS - 400;
    if (taps.length < items.length && !timeUp) return;
    submitted.current = key;
    onSubmit(taps.join(","));
  }, [taps, now, locked, key, phaseStartedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (puzzle.type !== "pctsprint") return null;

  const index = taps.length;
  const item = puzzle.items[index];

  return (
    <div className="flex flex-1 flex-col justify-between gap-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-5">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {Math.min(index + 1, puzzle.items.length)} of {puzzle.items.length}
        </p>
        {item ? (
          <p className="text-center font-mono text-3xl font-bold tabular-nums">{item.question}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Run complete</p>
        )}
      </div>

      <OptionGrid
        options={item?.options ?? [0, 0, 0, 0]}
        onPick={(optionIndex) => {
          if (!item || locked) return;
          setTaps((prev) => [...prev, optionIndex]);
        }}
        disabled={locked || !item}
      />
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "pctsprint") return null;
  // The answers only reach the phone once the round has ended.
  const answers = puzzle.answers;
  if (!answers) return null;
  const taps = (myAnswer ?? "")
    .split(",")
    .map((v) => Number.parseInt(v, 10))
    .filter((v) => Number.isFinite(v));
  const correct = puzzle.items.filter((_, i) => taps[i] === answers[i]).length;

  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-center font-mono text-3xl font-bold tabular-nums text-primary">
        {correct} / {puzzle.items.length} correct
      </p>
      <div className="flex w-full flex-col gap-2">
        {puzzle.items.map((item, index) => {
          const answerIndex = answers[index] ?? -1;
          const tap = taps[index];
          const got = tap === answerIndex;
          return (
            <div
              key={index}
              className="flex min-w-0 flex-col items-center gap-0.5 border-b border-border pb-1 text-center font-mono text-base"
            >
              <span className="w-full break-words tabular-nums">{item.question}</span>
              <span className="flex flex-wrap items-center justify-center gap-1 tabular-nums">
                <span className="text-primary">{item.options[answerIndex] ?? "—"}</span>
                {tap === undefined ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <span className={`font-display font-bold ${got ? "text-primary" : "text-warn"}`}>
                    {got ? "✓" : `✗ ${item.options[tap] ?? ""}`}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
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

/**
 * Three plausible near misses: a small slip either side of the answer, so no
 * option is ever wildly off (15% of 240 → 36 / 24 / 32 / 42).
 */
function nearMisses(answer: number): number[] {
  const candidates = [
    Math.round(answer * 1.5),
    Math.round(answer / 1.5),
    answer + Math.max(1, Math.round(answer * 0.15)),
    answer - Math.max(1, Math.round(answer * 0.15)),
    answer + Math.max(2, Math.round(answer * 0.25)),
    answer - Math.max(2, Math.round(answer * 0.25)),
    answer + 10,
    answer - 10,
    answer + 1,
    answer - 1,
  ];
  const picked: number[] = [];
  for (const value of shuffled(candidates)) {
    if (value === answer || value < 1 || value > 999) continue;
    if (picked.includes(value)) continue;
    picked.push(value);
    if (picked.length === 3) break;
  }
  // Fall back to tight neighbours if the answer is very small.
  let step = 1;
  while (picked.length < 3) {
    const value = answer + step;
    if (value !== answer && value >= 1 && value <= 999 && !picked.includes(value))
      picked.push(value);
    step = step > 0 ? -step : -step + 1;
  }
  return picked;
}

function buildItem(seen: Set<string>): { item: PercentItem; answerIndex: number } | null {
  for (let attempt = 0; attempt < 80; attempt++) {
    const built = build();
    if (!built) continue;
    if (!Number.isInteger(built.answer) || built.answer < 1 || built.answer > 999) continue;
    if (seen.has(built.question)) continue;
    seen.add(built.question);
    const options = shuffled([built.answer, ...nearMisses(built.answer)]);
    return {
      item: { question: built.question, options, working: built.working },
      answerIndex: options.indexOf(built.answer),
    };
  }
  return null;
}

export function buildPercentSprint(): PercentPuzzleData {
  const seen = new Set<string>();
  const items: PercentItem[] = [];
  const answers: number[] = [];

  while (items.length < PCTSPRINT_ITEMS) {
    const next = buildItem(seen);
    if (!next) {
      const options = [40, 30, 36, 48];
      items.push({
        question: "25% of 160 = ?",
        options,
        working: "10% is 16, so 25% is 40",
      });
      answers.push(options.indexOf(40));
      continue;
    }
    items.push(next.item);
    answers.push(next.answerIndex);
  }

  return { type: "pctsprint", items, answers };
}

export const percentSprintPuzzle: PuzzleDefinition = {
  key: "pctsprint",
  name: "Percent Sprint",
  category: "number",
  timeLimitMs: PCTSPRINT_TIME_MS,
  generate: buildPercentSprint,
  // Scored on the server from how many of the five questions were right.
  check: () => true,
  revealHeading: "The answers were",
  IntroExample,
  Stage,
  Reveal,
};
