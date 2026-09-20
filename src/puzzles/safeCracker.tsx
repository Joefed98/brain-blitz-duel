import { useEffect, useRef } from "react";

import { hapticTick, useSwipe } from "@/components/puzzles/GridDrag";
import { clueHolds, dialsCorrect, decodeSafeTries, encodeSafeTries } from "@/lib/duel/safe";
import { useStageState } from "@/lib/duel/stageState";
import { SAFE_DIALS, SAFE_TIME_MS, SAFE_TRIES, type SafePuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect, playWrong } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** One vertical drum, with arrows that repeat while held and a vertical swipe. */
function Dial({
  digit,
  onStep,
  disabled,
  wrong,
  gold,
  compact,
}: {
  digit: number;
  onStep?: (delta: number) => void;
  disabled?: boolean;
  wrong?: boolean;
  gold?: boolean;
  compact?: boolean;
}) {
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const swipe = useSwipe((dir) => onStep?.(dir === "U" ? 1 : -1), {
    disabled: disabled || !onStep,
  });

  const hold = (delta: number) => {
    if (disabled || !onStep) return;
    hapticTick();
    onStep(delta);
    stop();
    repeat.current = setInterval(() => onStep(delta), 160);
  };
  const stop = () => {
    if (repeat.current) clearInterval(repeat.current);
    repeat.current = null;
  };
  useEffect(() => stop, []);

  const arrow = (label: "▲" | "▼", delta: number) => (
    <button
      type="button"
      disabled={disabled || !onStep}
      onPointerDown={() => hold(delta)}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      aria-label={delta > 0 ? "Up" : "Down"}
      className="flex size-11 items-center justify-center font-mono text-lg leading-none text-muted-foreground disabled:opacity-40"
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col items-center">
      {onStep && arrow("▲", 1)}
      <div
        {...swipe}
        className={`flex items-center justify-center rounded-lg border-2 bg-background font-mono font-bold tabular-nums ${
          wrong ? "border-warn text-warn" : gold ? "border-primary text-primary" : "border-border"
        }`}
        style={{
          width: compact ? 34 : 46,
          height: compact ? 44 : 50,
          fontSize: compact ? 22 : 26,
          touchAction: "none",
        }}
      >
        {digit}
      </div>
      {onStep && arrow("▼", -1)}
    </div>
  );
}

/** Fixed intro example — never randomised. */
function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-2">
        <Dial digit={4} compact gold />
        <Dial digit={8} compact gold />
      </div>
      <div className="text-center text-xs text-muted-foreground">
        <p>① is even</p>
        <p>② is double ①</p>
      </div>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey = "safe" }: PuzzleStageProps) {
  const isSafe = puzzle.type === "safe";
  const [dials, setDials] = useStageState<number[]>(stateKey, "safeDials", () =>
    new Array(SAFE_DIALS).fill(0),
  );
  const [tries, setTries] = useStageState<number[][]>(stateKey, "safeTries", () => []);
  const [shake, setShake] = useStageState<boolean>(stateKey, "safeShake", () => false);
  const submitted = useRef(false);

  const triesLeft = Math.max(0, SAFE_TRIES - tries.length);

  useEffect(() => {
    onDraftAnswer?.(encodeSafeTries(tries));
  }, [tries, onDraftAnswer]);

  const step = (dial: number, delta: number) => {
    if (locked || submitted.current || triesLeft === 0) return;
    setDials((current) =>
      current.map((digit, index) => (index === dial ? (digit + delta + 10) % 10 : digit)),
    );
  };

  const tryIt = () => {
    if (locked || submitted.current || triesLeft === 0 || !isSafe) return;
    const next = [...tries, [...dials]];
    setTries(next);
    // Only the server knows the combination; a wrong-looking try just shakes.
    const opened = puzzle.clues.every((clue) => clueHolds(clue, dials));
    if (opened) {
      submitted.current = true;
      playCorrect();
      hapticTick();
      onSubmit(encodeSafeTries(next));
      return;
    }
    buzz(30);
    playWrong();
    setShake(true);
    setTimeout(() => setShake(false), 320);
    if (next.length >= SAFE_TRIES) {
      submitted.current = true;
      onSubmit(encodeSafeTries(next));
    }
  };

  if (!isSafe) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="min-h-0 shrink-0 rounded-xl border border-border bg-card px-2 py-1.5">
        {puzzle.clues.map((clue) => (
          <p key={clue.text} className="text-center text-base leading-[1.45]">
            {clue.text}
          </p>
        ))}
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-border bg-card/60 p-1 ${
          shake ? "animate-shake border-warn" : ""
        }`}
      >
        <div className="flex gap-2">
          {dials.map((digit, dial) => (
            <Dial
              key={dial}
              digit={digit}
              disabled={locked || triesLeft === 0}
              onStep={(delta) => step(dial, delta)}
            />
          ))}
        </div>
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          tries left <span className="text-primary">{triesLeft}</span>
        </p>
      </div>

      <button
        type="button"
        disabled={locked || triesLeft === 0}
        onClick={tryIt}
        className="h-12 shrink-0 rounded-xl bg-primary font-display text-base font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-40"
      >
        Try
      </button>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "safe") return null;
  const combination = puzzle.combination ?? new Array(SAFE_DIALS).fill(0);
  const tries = decodeSafeTries(myAnswer ?? "");
  const last = tries[tries.length - 1] ?? null;
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((SAFE_TIME_MS - myMsRemaining) / 100) / 10;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className="flex gap-2">
        {combination.map((digit, dial) => (
          <Dial key={dial} digit={digit} gold compact />
        ))}
      </div>
      <div className="w-full">
        {puzzle.clues.map((clue) => (
          <p key={clue.text} className="text-center text-xs text-muted-foreground">
            <span className="text-ok">✓</span> {clue.text}
          </p>
        ))}
      </div>
      {last && (
        <div className="flex flex-col items-center gap-1">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            your last try
          </p>
          <div className="flex gap-2">
            {last.map((digit, dial) => (
              <Dial
                key={dial}
                digit={digit}
                compact
                wrong={digit !== combination[dial]}
                gold={digit === combination[dial]}
              />
            ))}
          </div>
        </div>
      )}
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        {myCorrect
          ? `opened on try ${tries.length}${elapsed !== null ? ` · ${elapsed.toFixed(1)}s` : ""}`
          : `locked · ${last ? dialsCorrect(last, combination) : 0} / ${SAFE_DIALS} dials`}
      </p>
    </div>
  );
}

/** The combination is generated and checked on the server; clues are public. */
export const safeCrackerPuzzle: PuzzleDefinition = {
  key: "safe",
  name: "Safe Cracker",
  category: "logic",
  timeLimitMs: SAFE_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "safe", clues: [] }) satisfies SafePuzzleData,
  check: () => false,
  revealHeading: "The combination",
  IntroExample,
  Stage,
  Reveal,
};
