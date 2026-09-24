import { useEffect, useRef, useState } from "react";

import { pick, shuffled } from "@/lib/duel/random";
import { scoreWordMatch } from "@/lib/duel/scoring";
import {
  WORDMATCH_ITEMS,
  WORDMATCH_TIME_MS,
  type WordMatchItem,
  type WordMatchMode,
  type WordMatchPuzzleData,
} from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { WORD_PAIRS } from "./wordPairs";

function ModeLabel({ mode }: { mode: WordMatchMode }) {
  return (
    <span className="rounded-full bg-foreground px-4 py-2 font-mono text-xl font-bold uppercase tracking-widest text-background">
      {mode === "synonym" ? "SYNONYM" : "ANTONYM"}
    </span>
  );
}

/** Fixed intro example — the same eight-item run explanation every time. */
const EXAMPLE_OPTIONS = ["Lavish", "Thrifty", "Rapid", "Bitter"];

function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Tap the word that means the same — or the opposite — as shown.
      </p>
      <p className="font-display text-4xl font-bold">FRUGAL</p>
      <ModeLabel mode="synonym" />
      <div className="grid w-full grid-cols-2 gap-2">
        {EXAMPLE_OPTIONS.map((word) => (
          <span
            key={word}
            className={`flex h-11 items-center justify-center rounded-xl border text-sm font-semibold ${
              word === "Thrifty"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            {word}
          </span>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Eight words. All right = 100 + speed; otherwise 13 each, up to 90.
      </p>
    </div>
  );
}

function Stage({ puzzle, phaseStartedAt, now, locked, onSubmit }: PuzzleStageProps) {
  const items: WordMatchItem[] = puzzle.type === "wordmatch" ? puzzle.items : [];
  const key = items.map((i) => `${i.prompt}:${i.mode}`).join("|");
  const [taps, setTaps] = useState<number[]>([]);
  const submitted = useRef("");

  useEffect(() => {
    setTaps([]);
  }, [key]);

  // Submit the run once every item is answered, or just before time is up.
  useEffect(() => {
    if (items.length === 0 || locked || submitted.current === key) return;
    const timeUp = now >= phaseStartedAt + WORDMATCH_TIME_MS - 400;
    if (taps.length < items.length && !timeUp) return;
    submitted.current = key;
    onSubmit(taps.join(","));
  }, [taps, now, locked, key, phaseStartedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (puzzle.type !== "wordmatch") return null;

  const index = taps.length;
  const item = puzzle.items[index];

  return (
    <div className="flex flex-1 flex-col justify-between gap-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {Math.min(index + 1, puzzle.items.length)} of {puzzle.items.length}
        </p>
        {item ? (
          <>
            <p className="text-center font-display text-4xl font-bold uppercase">{item.prompt}</p>
            <ModeLabel mode={item.mode} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Run complete</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2">
        {(item?.options ?? ["", "", "", ""]).map((option, optionIndex) => (
          <button
            key={`${index}-${optionIndex}`}
            type="button"
            disabled={locked || !item}
            onClick={() => item && !locked && setTaps((prev) => [...prev, optionIndex])}
            className="tap-target w-full rounded-xl border border-border bg-card px-4 py-3 font-display text-base font-bold disabled:opacity-40"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "wordmatch") return null;
  // The answers only reach the phone once the round has ended.
  const answers = puzzle.answers;
  if (!answers) return null;
  const taps = (myAnswer ?? "")
    .split(",")
    .map((v) => Number.parseInt(v, 10))
    .filter((v) => Number.isFinite(v));
  const correct = taps.filter((tap, i) => tap === answers[i]).length;

  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-center font-mono text-3xl font-bold tabular-nums text-primary">
        {correct} / {puzzle.items.length} correct
      </p>
      <p className="text-center font-mono text-sm text-muted-foreground">
        {correct === puzzle.items.length ? "100 + speed" : `${correct} × 13 (max 90)`} = {scoreWordMatch(correct, myMsRemaining ?? 0)} points
      </p>
      <div className="grid w-full grid-cols-2 gap-x-3 gap-y-1">
        {puzzle.items.map((item, index) => {
          const answerIndex = answers[index] ?? -1;
          const tap = taps[index];
          const got = tap === answerIndex;
          return (
            <div key={index} className="flex min-w-0 items-center justify-between gap-1 text-xs">
              <span className="truncate font-display font-bold uppercase">{item.prompt}</span>
              <span className="flex min-w-0 items-center gap-1">
                <span className="text-primary">{item.options[answerIndex] ?? "—"}</span>
                {tap === undefined ? (
                  <span className="text-xs text-muted-foreground">—</span>
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

export function buildWordMatch(): WordMatchPuzzleData {
  const entries = shuffled(WORD_PAIRS).slice(0, WORDMATCH_ITEMS);
  const items: WordMatchItem[] = [];
  const answers: number[] = [];

  for (const [head, synonym, antonym, ...distractors] of entries) {
    const mode: WordMatchMode = pick(["synonym", "antonym"] as const);
    const correct = mode === "synonym" ? synonym : antonym;
    const opposite = mode === "synonym" ? antonym : synonym;
    const extras = shuffled(distractors).slice(0, 2);
    const options = shuffled([correct, opposite, ...extras]);
    items.push({ prompt: head, mode, options });
    answers.push(options.indexOf(correct));
  }

  return { type: "wordmatch", items, answers };
}

export const wordMatchPuzzle: PuzzleDefinition = {
  key: "wordmatch",
  name: "Word Match",
  category: "word",
  timeLimitMs: WORDMATCH_TIME_MS,
  generate: buildWordMatch,
  // Scored on the server from how many of the eight items were right.
  check: () => true,
  revealHeading: "The answers were",
  IntroExample,
  Stage,
  Reveal,
};
