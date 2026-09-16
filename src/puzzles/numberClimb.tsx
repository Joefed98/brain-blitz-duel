import { useEffect, useRef, useState } from "react";

import { buildNumberClimb, numberClimbSpan } from "@/lib/duel/numberClimb";
import { NUMBER_CLIMB_LENGTH, NUMBER_CLIMB_PREP_MS, NUMBER_CLIMB_TIME_MS } from "@/lib/duel/types";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const EXAMPLE = "492715836041";
const grouped = (value: string) => value.match(/.{1,3}/g)?.join(" ") ?? value;

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-sm text-foreground">
        Memorise as many digits as you can, in order, then type them back.
      </p>
      <p className="font-mono text-xl font-bold text-primary">{grouped(EXAMPLE)}</p>
      <p className="text-xs text-muted-foreground">You typed 492 715 8 → span 7</p>
      <p className="text-xs text-muted-foreground">
        Every digit you get right in a row counts. You have 45 seconds once they vanish.
      </p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const elapsed = now - phaseStartedAt;
  const showing = elapsed < NUMBER_CLIMB_PREP_MS;
  const submit = () => {
    if (!locked && value.length) onSubmit(value);
  };
  useEffect(() => {
    if (!showing) input.current?.focus();
  }, [showing]);
  if (puzzle.type !== "numclimb") return null;
  return (
    <div className="flex flex-1 flex-col justify-between gap-4">
      <div className="flex flex-col items-center gap-4 pt-8">
        <div className="flex h-24 w-full items-center justify-center">
          {showing ? (
            <p className="whitespace-nowrap font-mono text-[clamp(1.6rem,8vw,2.4rem)] font-bold tabular-nums text-primary">
              {grouped(puzzle.digits)}
            </p>
          ) : (
            <input
              ref={input}
              value={value}
              aria-label="Digits in order"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={NUMBER_CLIMB_LENGTH}
              placeholder="Type the digits in order"
              onChange={(e) => {
                const next = e.target.value.replace(/\D/g, "");
                setValue(next);
                onDraftAnswer?.(next);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              className="h-16 w-full rounded-xl border border-border bg-card px-3 text-center font-mono text-xl tracking-[0.12em] text-foreground placeholder:font-sans placeholder:text-sm placeholder:tracking-normal focus:border-primary focus:outline-none"
            />
          )}
        </div>
        {showing && (
          <div className="h-1 w-full overflow-hidden rounded bg-card">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.max(0, 100 * (1 - elapsed / NUMBER_CLIMB_PREP_MS))}%` }}
            />
          </div>
        )}
      </div>
      {!showing && (
        <button
          type="button"
          disabled={!value.length || locked}
          onClick={submit}
          className="h-12 w-full rounded-xl bg-primary font-display text-base font-bold uppercase text-primary-foreground disabled:opacity-40"
        >
          Submit
        </button>
      )}
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "numclimb") return null;
  const answer = puzzle.answerDigits ?? puzzle.digits;
  const entry = (myAnswer ?? "").replace(/\D/g, "");
  const span = numberClimbSpan(entry, answer);
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="font-mono text-2xl font-bold tracking-[0.12em] text-primary">
        {grouped(answer)}
      </p>
      <p className="font-mono text-xl font-bold tracking-[0.12em]">
        {entry ? (
          entry.split("").map((digit, index) => (
            <span key={index} className={index < span ? "text-primary" : "text-warn"}>
              {digit}
              {index % 3 === 2 ? " " : ""}
            </span>
          ))
        ) : (
          <span className="text-warn">No answer</span>
        )}
      </p>
      <p className="font-display text-lg font-bold text-foreground">Span: {span} of 12</p>
    </div>
  );
}

export const numberClimbPuzzle: PuzzleDefinition = {
  key: "numclimb",
  name: "Number Climb",
  category: "memory",
  timeLimitMs: NUMBER_CLIMB_TIME_MS,
  revealMs: 5_000,
  prepMs: () => NUMBER_CLIMB_PREP_MS,
  generate: buildNumberClimb,
  check: (answer, puzzle) =>
    puzzle.type === "numclimb" && numberClimbSpan(answer, puzzle.digits) === 12,
  IntroExample,
  Stage,
  Reveal,
};
