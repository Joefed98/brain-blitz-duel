import { useEffect, useRef, useState } from "react";

import { pick, randInt, shuffled } from "@/lib/duel/random";
import {
  NUMSEQ_ITEMS,
  NUMSEQ_TIME_MS,
  type NumberSequencePuzzleData,
  type SequenceItem,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const TERMS_SHOWN = 5;
const MIN_TERM = -200;
const MAX_TERM = 1000;

/** Fixed intro example — never randomised. */
const EXAMPLE_OPTIONS = [12, 11, 14, 20];
const EXAMPLE_ANSWER = 12;

type Built = { numbers: number[]; answer: number; rule: string };

function inRange(terms: number[]): boolean {
  return terms.every((n) => Number.isInteger(n) && n >= MIN_TERM && n <= MAX_TERM);
}

/** Tier 1 — add a constant. */
function tier1(): Built {
  const step = randInt(2, 9);
  const start = randInt(1, 20);
  const terms = Array.from({ length: TERMS_SHOWN + 1 }, (_, i) => start + i * step);
  return { numbers: terms.slice(0, TERMS_SHOWN), answer: terms[TERMS_SHOWN]!, rule: `+${step}` };
}

/** Tier 2 — subtract a constant, or add a bigger one. */
function tier2(): Built {
  const size = randInt(11, 25);
  const down = Math.random() < 0.5;
  const step = down ? -size : size;
  const start = down ? randInt(20, 90) : randInt(1, 40);
  const terms = Array.from({ length: TERMS_SHOWN + 1 }, (_, i) => start + i * step);
  return {
    numbers: terms.slice(0, TERMS_SHOWN),
    answer: terms[TERMS_SHOWN]!,
    rule: down ? `−${size}` : `+${size}`,
  };
}

/** Tier 3 — multiply by 2 or 3, or a growing difference. */
function tier3(): Built {
  if (Math.random() < 0.5) {
    const factor = pick([2, 3] as const);
    const start = randInt(2, factor === 2 ? 12 : 4);
    const terms: number[] = [start];
    for (let i = 1; i <= TERMS_SHOWN; i++) terms.push(terms[i - 1]! * factor);
    return {
      numbers: terms.slice(0, TERMS_SHOWN),
      answer: terms[TERMS_SHOWN]!,
      rule: `×${factor}`,
    };
  }
  const start = randInt(1, 12);
  const first = randInt(1, 3);
  const terms: number[] = [start];
  let step = first;
  for (let i = 1; i <= TERMS_SHOWN; i++) {
    terms.push(terms[i - 1]! + step);
    step += 1;
  }
  return {
    numbers: terms.slice(0, TERMS_SHOWN),
    answer: terms[TERMS_SHOWN]!,
    rule: `gaps grow by 1, starting +${first}`,
  };
}

/** Tier 4 — a two-step rule. */
function tier4(): Built {
  const [factor, offset] = pick([
    [2, 1],
    [2, -3],
    [3, -1],
  ] as const);
  const start = randInt(2, factor === 2 ? 9 : 4);
  const terms: number[] = [start];
  for (let i = 1; i <= TERMS_SHOWN; i++) terms.push(terms[i - 1]! * factor + offset);
  return {
    numbers: terms.slice(0, TERMS_SHOWN),
    answer: terms[TERMS_SHOWN]!,
    rule: `×${factor} then ${offset >= 0 ? `+${offset}` : `−${Math.abs(offset)}`}`,
  };
}

/** Tier 5 — squares, triangular numbers, Fibonacci-style or interleaved. */
function tier5(): Built {
  const family = pick(["squares", "triangular", "fib", "interleaved"] as const);
  if (family === "squares") {
    const from = randInt(1, 5);
    const terms = Array.from({ length: TERMS_SHOWN + 1 }, (_, i) => (from + i) * (from + i));
    return {
      numbers: terms.slice(0, TERMS_SHOWN),
      answer: terms[TERMS_SHOWN]!,
      rule: "square numbers",
    };
  }
  if (family === "triangular") {
    const from = randInt(1, 6);
    const terms = Array.from({ length: TERMS_SHOWN + 1 }, (_, i) => {
      const n = from + i;
      return (n * (n + 1)) / 2;
    });
    return {
      numbers: terms.slice(0, TERMS_SHOWN),
      answer: terms[TERMS_SHOWN]!,
      rule: "triangular numbers",
    };
  }
  if (family === "fib") {
    const a = randInt(2, 9);
    const b = randInt(a + 1, a + 8);
    const terms = [a, b];
    for (let i = 2; i <= TERMS_SHOWN; i++) terms.push(terms[i - 1]! + terms[i - 2]!);
    return {
      numbers: terms.slice(0, TERMS_SHOWN),
      answer: terms[TERMS_SHOWN]!,
      rule: "sum of previous two",
    };
  }
  // Two interleaved runs: odd positions add one step, even positions another.
  const startA = randInt(2, 10);
  const stepA = randInt(2, 6);
  const startB = randInt(8, 24);
  const stepB = randInt(5, 12);
  const terms: number[] = [];
  for (let i = 0; i <= TERMS_SHOWN; i++) {
    terms.push(i % 2 === 0 ? startA + (i / 2) * stepA : startB + ((i - 1) / 2) * stepB);
  }
  return {
    numbers: terms.slice(0, TERMS_SHOWN),
    answer: terms[TERMS_SHOWN]!,
    rule: `two sequences woven together (+${stepA} and +${stepB})`,
  };
}

const TIERS = [tier1, tier2, tier3, tier4, tier5];

/**
 * Plausible near misses: the last gap repeated or nudged, doubling, and a
 * two-digit swap. Nothing obviously out of range for the run so far.
 */
function distractors(built: Built): number[] {
  const { numbers, answer } = built;
  const last = numbers[numbers.length - 1]!;
  const gap = last - numbers[numbers.length - 2]!;
  const allPositiveRising = numbers.every((n) => n > 0) && gap > 0;
  const swapped = (() => {
    const text = String(Math.abs(answer));
    if (text.length < 2) return null;
    const chars = text.split("");
    [chars[0], chars[1]] = [chars[1]!, chars[0]!];
    if (chars[0] === "0") return null;
    const value = Number.parseInt(chars.join(""), 10);
    return answer < 0 ? -value : value;
  })();

  const candidates = [
    last + gap,
    last + gap + 1,
    last * 2,
    answer + gap,
    answer - gap,
    answer + 1,
    answer - 1,
    swapped,
  ].filter((v): v is number => typeof v === "number" && Number.isInteger(v));

  const picked: number[] = [];
  const reject = (value: number) =>
    value === answer ||
    picked.includes(value) ||
    numbers.includes(value) ||
    value < MIN_TERM ||
    value > MAX_TERM ||
    (allPositiveRising && value <= 0);

  for (const value of shuffled(candidates)) {
    if (reject(value)) continue;
    picked.push(value);
    if (picked.length === 3) break;
  }
  let step = 2;
  while (picked.length < 3) {
    const value = answer + step;
    if (!reject(value)) picked.push(value);
    step = step > 0 ? -step : -step + 1;
  }
  return picked;
}

function buildItem(tier: number): { item: SequenceItem; answerIndex: number } | null {
  for (let attempt = 0; attempt < 80; attempt++) {
    const built = TIERS[tier]!();
    if (!inRange([...built.numbers, built.answer])) continue;
    if (new Set([...built.numbers, built.answer]).size !== TERMS_SHOWN + 1) continue;
    const options = shuffled([built.answer, ...distractors(built)]);
    if (new Set(options).size !== 4) continue;
    return {
      item: { numbers: built.numbers, options, rule: built.rule },
      answerIndex: options.indexOf(built.answer),
    };
  }
  return null;
}

const FALLBACKS: { numbers: number[]; answer: number; rule: string }[] = [
  { numbers: [4, 9, 14, 19, 24], answer: 29, rule: "+5" },
  { numbers: [40, 29, 18, 7, -4], answer: -15, rule: "−11" },
  { numbers: [2, 3, 5, 8, 12], answer: 17, rule: "gaps grow by 1, starting +1" },
  { numbers: [3, 7, 15, 31, 63], answer: 127, rule: "×2 then +1" },
  { numbers: [5, 8, 13, 21, 34], answer: 55, rule: "sum of previous two" },
];

export function buildNumberSequence(): NumberSequencePuzzleData {
  const items: SequenceItem[] = [];
  const answers: number[] = [];

  for (let tier = 0; tier < NUMSEQ_ITEMS; tier++) {
    const next = buildItem(tier);
    if (next) {
      items.push(next.item);
      answers.push(next.answerIndex);
      continue;
    }
    const fallback = FALLBACKS[tier]!;
    const options = shuffled([fallback.answer, ...distractors(fallback)]);
    items.push({ numbers: fallback.numbers, options, rule: fallback.rule });
    answers.push(options.indexOf(fallback.answer));
  }

  return { type: "numseq", items, answers };
}

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
            className={`tap-target min-h-16 ${className} disabled:opacity-40`}
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
        Spot the pattern, then tap the next number.
      </p>
      <p className="font-mono text-2xl font-bold tabular-nums">2, 4, 6, 8, 10, ?</p>
      <OptionGrid options={EXAMPLE_OPTIONS} highlight={EXAMPLE_ANSWER} />
      <p className="text-center text-xs text-muted-foreground">
        Five sequences, getting harder. Tap the answer - you can&apos;t go back. All five right
        earns the speed bonus. You have 45 seconds.
      </p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit }: PuzzleStageProps) {
  const items: SequenceItem[] = puzzle.type === "numseq" ? puzzle.items : [];
  const key = items.map((item) => item.numbers.join("-")).join("|");
  const [taps, setTaps] = useState<number[]>([]);
  const submitted = useRef("");

  useEffect(() => {
    setTaps([]);
  }, [key]);

  // Submit the run once every sequence is answered, or just before time is up.
  useEffect(() => {
    if (items.length === 0 || locked || submitted.current === key) return;
    const timeUp = now >= phaseStartedAt + NUMSEQ_TIME_MS - 400;
    if (taps.length < items.length && !timeUp) return;
    submitted.current = key;
    onSubmit(taps.join(","));
  }, [taps, now, locked, key, phaseStartedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (puzzle.type !== "numseq") return null;

  const index = taps.length;
  const item = puzzle.items[index];

  return (
    <div className="flex flex-1 flex-col justify-between gap-5">
      <div className="flex w-full flex-col gap-2">
        <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {Math.min(index + 1, puzzle.items.length)} / {puzzle.items.length}
        </p>
        <div className="flex w-full gap-1.5">
          {puzzle.items.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i < index ? "bg-primary" : "bg-border"}`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center">
        {item ? (
          <p className="text-center font-mono text-2xl font-bold tabular-nums">
            {item.numbers.join(", ")}, <span className="text-primary">?</span>
          </p>
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
  if (puzzle.type !== "numseq") return null;
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
      <p className="text-center font-mono text-2xl font-bold tabular-nums text-primary">
        {correct} / {puzzle.items.length} correct
      </p>
      <div className="flex w-full flex-col gap-1.5">
        {puzzle.items.map((item, index) => {
          const answerIndex = answers[index] ?? -1;
          const answerValue = item.options[answerIndex];
          const tap = taps[index];
          const got = tap === answerIndex;
          return (
            <div key={index} className="flex min-w-0 items-center justify-between gap-2">
              <span className="min-w-0 flex-1">
                <span className="block break-words font-mono text-[13px] tabular-nums">
                  {item.numbers.join(", ")},{" "}
                  <span className="font-bold text-primary">{answerValue ?? "—"}</span>
                </span>
                <span className="block break-words text-base text-muted-foreground">
                  {item.rule}
                </span>
              </span>
              {tap === undefined ? (
                <span className="text-base text-muted-foreground">—</span>
              ) : (
                <span
                  className={`font-mono text-base font-bold tabular-nums ${got ? "text-primary" : "text-warn"}`}
                >
                  {got ? "✓" : `✗ ${item.options[tap] ?? ""}`}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const numberSequencePuzzle: PuzzleDefinition = {
  key: "numseq",
  name: "Number Sequence",
  category: "number",
  timeLimitMs: NUMSEQ_TIME_MS,
  generate: buildNumberSequence,
  // Scored on the server from how many of the five sequences were right.
  check: () => true,
  revealHeading: "The answers were",
  IntroExample,
  Stage,
  Reveal,
};
