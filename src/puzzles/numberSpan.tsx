import { NumberEntry } from "@/components/puzzles/NumberEntry";
import { randInt } from "@/lib/duel/random";
import {
  NUMSPAN_LEAD_IN_MS,
  NUMSPAN_LENGTH,
  NUMSPAN_PREP_MS,
  type NumberSpanPuzzleData,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro example — the same eight digits every time. */
const EXAMPLE = "49271583";

function Digits({ value, size = "lg" }: { value: string; size?: "lg" | "sm" }) {
  return (
    <p
      className={`font-mono font-bold tabular-nums tracking-[0.18em] ${
        size === "lg" ? "text-4xl" : "text-2xl"
      }`}
    >
      {value.split("").join(" ")}
    </p>
  );
}

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Memorise the digits, then type them back in order.
      </p>
      <Digits value={EXAMPLE} size="sm" />
      <p className="text-xs text-muted-foreground">Your timer starts when the numbers disappear.</p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit }: PuzzleStageProps) {
  if (puzzle.type !== "numspan") return null;

  const elapsed = now - phaseStartedAt;
  const showing = elapsed >= NUMSPAN_LEAD_IN_MS && elapsed < NUMSPAN_PREP_MS;
  const revealing = elapsed < NUMSPAN_PREP_MS;

  if (revealing) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Remember the digits
        </p>
        <div className="flex h-24 items-center">
          {showing ? (
            <Digits value={puzzle.digits} />
          ) : (
            <span className="font-mono text-sm text-muted-foreground">Ready…</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {Math.max(1, Math.ceil((NUMSPAN_PREP_MS - elapsed) / 1000))}s
        </p>
      </div>
    );
  }

  return (
    <NumberEntry
      label="Type the digits"
      resetKey={puzzle.digits}
      locked={locked}
      maxLength={NUMSPAN_LENGTH}
      placeholder="Digits in order"
      onSubmit={onSubmit}
    >
      <div className="flex h-24 items-center justify-center rounded-2xl bg-card px-6">
        <p className="font-mono text-sm text-muted-foreground">{NUMSPAN_LENGTH} digits, in order</p>
      </div>
    </NumberEntry>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  if (puzzle.type !== "numspan") return null;
  const entry = (myAnswer ?? "").replace(/[^0-9]/g, "");

  return (
    <>
      <p className="font-mono text-3xl font-bold tabular-nums tracking-[0.18em] text-primary">
        {puzzle.digits.split("").join(" ")}
      </p>
      <div className="flex w-full flex-col items-center gap-2 rounded-2xl bg-card px-4 py-5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Your entry</p>
        {entry.length === 0 ? (
          <p className="font-display text-2xl font-bold text-warn">No answer</p>
        ) : (
          <p className="font-mono text-2xl font-bold tabular-nums tracking-[0.18em]">
            {entry.split("").map((digit, index) => (
              <span
                key={index}
                className={digit === puzzle.digits[index] ? "text-foreground" : "text-warn"}
              >
                {digit}{" "}
              </span>
            ))}
          </p>
        )}
        <p className={`font-display text-lg font-bold ${myCorrect ? "text-primary" : "text-warn"}`}>
          {myCorrect ? "✓" : "✗"}
        </p>
      </div>
    </>
  );
}

/** No digit twice in a row, and never three in a row that step by one. */
export function buildNumberSpan(): NumberSpanPuzzleData {
  for (let attempt = 0; attempt < 400; attempt++) {
    const digits: number[] = [];
    let ok = true;
    for (let i = 0; i < NUMSPAN_LENGTH; i++) {
      let next = -1;
      for (let tries = 0; tries < 40; tries++) {
        const candidate = randInt(1, 9);
        if (candidate === digits[i - 1]) continue;
        if (i >= 2) {
          const a = digits[i - 2]!;
          const b = digits[i - 1]!;
          if (b - a === 1 && candidate - b === 1) continue;
          if (a - b === 1 && b - candidate === 1) continue;
        }
        next = candidate;
        break;
      }
      if (next < 0) {
        ok = false;
        break;
      }
      digits.push(next);
    }
    if (ok) return { type: "numspan", digits: digits.join("") };
  }
  return { type: "numspan", digits: EXAMPLE };
}

export const numberSpanPuzzle: PuzzleDefinition = {
  key: "numspan",
  name: "Number Span",
  category: "memory",
  timeLimitMs: 30_000,
  generate: buildNumberSpan,
  check: (answer, puzzle) => {
    if (puzzle.type !== "numspan") return false;
    return answer.replace(/[^0-9]/g, "") === puzzle.digits;
  },
  prepMs: () => NUMSPAN_PREP_MS,
  IntroExample,
  Stage,
  Reveal,
};
