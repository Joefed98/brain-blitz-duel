import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { useSwipe } from "@/components/puzzles/GridDrag";
import { ArcadeControlButton } from "@/components/puzzles/ArcadeControlButton";
import { clueHolds, dialsCorrect, decodeSafeTries, encodeSafeDraft, encodeSafeTries } from "@/lib/duel/safe";
import { puzzleScoreRevOf } from "@/lib/duel/puzzleScoreRev";
import { useStageState } from "@/lib/duel/stageState";
import { SAFE_DIALS, SAFE_TIME_MS, SAFE_TRIES, type SafePuzzleData } from "@/lib/duel/types";
import { directionOf, useGameKeys } from "@/lib/desktop";
import { playSound, playWrong } from "@/lib/sound";

import { soundCue, usePrevious, useSolveFx } from "./logicFx";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { usesDepth } from "@/lib/duel/logicDepth";
import { usesStandard } from "@/lib/duel/standard/stamps";
import "@/polish-depth-d6/depth-d6.css";

/** One vertical drum, with arrows that repeat while held and a vertical swipe. */
export function Dial({
  digit,
  onStep,
  disabled,
  wrong,
  gold,
  compact,
  order = 0,
}: {
  digit: number;
  onStep?: (delta: number) => void;
  disabled?: boolean;
  wrong?: boolean;
  gold?: boolean;
  compact?: boolean;
  /** Which drum this is (the completion clicks them in turn). */
  order?: number;
}) {
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const previous = usePrevious(digit);
  // The drum rolls the way it turned: up for +1, down for -1.
  const roll = previous === undefined || previous === digit ? "" : (digit - previous + 10) % 10 === 1 ? "logic-roll-up" : "logic-roll-down";
  const swipe = useSwipe((dir) => onStep?.(dir === "U" ? 1 : -1), {
    disabled: disabled || !onStep,
  });

  const hold = (delta: number) => {
    if (disabled || !onStep) return;
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
    <ArcadeControlButton
      type="button"
      disabled={disabled || !onStep}
      onPressStart={() => hold(delta)}
      onPressEnd={stop}
      aria-label={delta > 0 ? "Up" : "Down"}
      className="flex size-11 items-center justify-center font-mono text-sm leading-none text-muted-foreground disabled:opacity-40"
    >{label}</ArcadeControlButton>
  );

  return (
    <div className="flex flex-col items-center">
      {onStep && arrow("▲", 1)}
      <div
        {...swipe}
        className={`safe-dial-drum logic-drum relative flex items-center justify-center overflow-hidden rounded-lg border-2 font-mono font-bold tabular-nums ${compact ? "" : "logic-drum-live"} ${
          wrong ? "border-warn text-warn logic-drum-wrong" : gold ? "border-primary text-primary logic-drum-gold" : "border-border text-foreground"
        }`}
        style={{
          ...(compact ? { width: 34, height: 44, fontSize: 22 } : {}),
          touchAction: "none",
          "--logic-i": order,
        } as CSSProperties}
      >
        <span aria-hidden="true" className="logic-drum-ghost logic-drum-ghost-top">{(digit + 1) % 10}</span>
        <span key={digit} className={`logic-drum-digit ${roll}`}>{digit}</span>
        <span aria-hidden="true" className="logic-drum-ghost logic-drum-ghost-bottom">{(digit + 9) % 10}</span>
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
  // Presentation only: the public clues all hold for the last try (the same test that submits).
  const lastTry = tries[tries.length - 1];
  const opened = isSafe && lastTry !== undefined && puzzle.clues.every((clue) => clueHolds(clue, lastTry));
  const solving = useSolveFx("safe", opened);

  // puzzleScoreRev 2: the draft also carries the dials as they stand, so a time-out keeps their right dials as progress.
  const pendingDraft = puzzleScoreRevOf(puzzle) >= 2 && tries.length < SAFE_TRIES;
  useEffect(() => {
    onDraftAnswer?.(pendingDraft ? encodeSafeDraft(tries, dials) : encodeSafeTries(tries));
  }, [tries, dials, pendingDraft, onDraftAnswer]);

  const step = (dial: number, delta: number) => {
    if (locked || submitted.current || triesLeft === 0) return;
    soundCue("safe.click");
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
      playSound("pz_safe_open");
      onSubmit(encodeSafeTries(next));
      return;
    }
    playWrong();
    setShake(true);
    setTimeout(() => setShake(false), 320);
    if (next.length >= SAFE_TRIES) {
      submitted.current = true;
      onSubmit(encodeSafeTries(next));
    }
  };

  // Desktop keys: ← → (A/D) choose which drum ↑ ↓ (W/S) turn, as its ▲ ▼ do (outlined once a key is
  // used; the first drum to start); Enter = Try.
  const keyDial = useRef(0);
  const [shownDial, setShownDial] = useState<number | null>(null);
  useGameKeys((kind, key, event) => {
    if (!isSafe) return false;
    const dir = directionOf(key);
    const used = dir !== null || key === "Enter";
    if (!used || kind !== "down") return used;
    if (dir === "left") keyDial.current = Math.max(0, keyDial.current - 1);
    else if (dir === "right") keyDial.current = Math.min(dials.length - 1, keyDial.current + 1);
    else if (dir) {
      if (!(locked || triesLeft === 0)) step(keyDial.current, dir === "up" ? 1 : -1);
    } else if (!event.repeat && !(locked || triesLeft === 0)) tryIt();
    if (dir) setShownDial(keyDial.current);
    return true;
  });

  if (!isSafe) return null;

  return (
    <div data-logic-stage="safe" data-logic-solved={solving ? "" : undefined} data-stage-column="2" className="relative flex min-h-0 flex-1 flex-col gap-2">
      <span aria-hidden="true" className="logic-calm-glow" />
      <div data-game-arena="logic">
        <div className="logic-safe-card w-full rounded-lg border border-border px-3 py-2">
          {puzzle.clues.map((clue) => (
            <p key={clue.text} className="safe-clue-text logic-safe-clue text-center leading-[1.45]">
              {clue.text}
            </p>
          ))}
        </div>

        <div className="logic-safe-vault relative mx-auto w-4/5">
          <span aria-hidden="true" className="logic-safe-inside"><i /><i /><i /></span>
          <div
            data-game-controls="dial" className={`safe-metal-panel logic-safe-door relative flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-border p-1 ${
              shake ? "animate-shake border-warn" : ""
            } ${opened ? "logic-safe-door-open" : ""}`}
          >
            <span aria-hidden="true" className="logic-safe-hinge" />
            <span aria-hidden="true" className="logic-rivet" data-corner="tl" />
            <span aria-hidden="true" className="logic-rivet" data-corner="tr" />
            <span aria-hidden="true" className="logic-rivet" data-corner="bl" />
            <span aria-hidden="true" className="logic-rivet" data-corner="br" />
            <div className="flex gap-2" data-key-dial={shownDial ?? undefined}>
              {dials.map((digit, dial) => (
                <Dial
                  key={dial}
                  digit={digit}
                  order={dial}
                  disabled={locked || triesLeft === 0}
                  onStep={(delta) => step(dial, delta)}
                />
              ))}
            </div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              tries left <span className="text-primary">{triesLeft}</span>
              {/* depthRev 1: opening with a try to spare is a clean crack (the top 50 by speed: all of it on try 1, half on try 2). */}
              {/* The scoring standard (depthRev 3): the clean crack is full only with no wrong try (2.5 off each). */}
              {isSafe && usesDepth(puzzle) && (usesStandard(puzzle) ? triesLeft === SAFE_TRIES : triesLeft > 1) ? (
                <span className="d6-clean"> · clean crack</span>
              ) : null}
            </p>
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={locked || triesLeft === 0}
        onClick={tryIt}
        data-game-controls="actions" className="h-12 shrink-0 rounded-xl bg-primary font-display text-base font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-40"
      >
        Try
      </button>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "safe") return null;
  const combination = puzzle.combination ?? new Array(SAFE_DIALS).fill(0);
  const tries = decodeSafeTries(myAnswer ?? "");
  const last = tries[tries.length - 1] ?? null;
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((timeLimitMs - myMsRemaining) / 100) / 10;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div className={`flex gap-2 ${myCorrect ? "safe-metal-panel logic-safe-door solve-safe-door rounded-lg border border-border p-2" : ""}`}>
        {combination.map((digit, dial) => (
          <Dial key={dial} digit={digit} gold compact order={dial} />
        ))}
      </div>
      <div className="w-full">
        {puzzle.clues.map((clue) => (
          <p key={clue.text} className="text-center text-base text-muted-foreground">
            <span className="text-ok">✓</span> {clue.text}
          </p>
        ))}
      </div>
      {last && (
        <div className="flex flex-col items-center gap-1">
          <p className="font-mono text-base uppercase tracking-widest text-muted-foreground">
            your last try
          </p>
          <div className="flex gap-2">
            {last.map((digit, dial) => (
              <Dial
                key={dial}
                digit={digit}
                compact
                order={dial}
                wrong={digit !== combination[dial]}
                gold={digit === combination[dial]}
              />
            ))}
          </div>
        </div>
      )}
      <p className="font-mono text-base uppercase tracking-widest text-muted-foreground">
        {myCorrect
          ? `opened on try ${tries.length}${usesDepth(puzzle) && (usesStandard(puzzle) ? tries.length === 1 : tries.length < SAFE_TRIES) ? ", clean crack" : ""}${elapsed !== null ? ` · ${elapsed.toFixed(1)} s` : ""}`
          : `locked · ${last ? dialsCorrect(last, combination) : 0} / ${SAFE_DIALS} dials`}
      </p>
    </div>
  );
}

/** The combination is generated and checked on the server; clues are public. */
export const safeCrackerPuzzle: PuzzleDefinition = {
  key: "safe",
  name: gameDisplayName("safe"),
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
