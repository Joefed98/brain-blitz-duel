import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { useSwipe } from "@/components/puzzles/GridDrag";
import { ArcadeControlButton } from "@/components/puzzles/ArcadeControlButton";
import { brokenClues, clueHolds, dialsCorrect, decodeSafeTries, encodeSafeDraft, encodeSafeTries, safeShapeOf } from "@/lib/duel/safe";
import { puzzleScoreRevOf } from "@/lib/duel/puzzleScoreRev";
import { useStageState } from "@/lib/duel/stageState";
import { SAFE_TIME_MS, type SafePuzzleData } from "@/lib/duel/types";
import { directionOf, useGameKeys } from "@/lib/desktop";
import { playWrong } from "@/lib/sound";

import { soundCue, usePrevious, useSolveFx } from "./logicFx";
import { RevealFacts } from "./logicReveal";
import { gameFx } from "@/lib/fx/kit";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { usesDepth } from "@/lib/duel/logicDepth";
import { usesStandard } from "@/lib/duel/standard/stamps";
import "@/polish-depth-d6/depth-d6.css";

/** The shortest gap between two dial ticks (a held arrow steps every 160 ms; a fast swipe can step faster). */
export const SAFE_TICK_GAP_MS = 60;

/** One vertical drum, with arrows that repeat while held and a vertical swipe. */
export function Dial({
  digit,
  onStep,
  disabled,
  wrong,
  gold,
  compact,
  order = 0,
  max = 9,
}: {
  digit: number;
  onStep?: (delta: number) => void;
  disabled?: boolean;
  wrong?: boolean;
  gold?: boolean;
  compact?: boolean;
  /** Which drum this is (the completion clicks them in turn). */
  order?: number;
  /** The highest number the drum shows (a level's card; 9 today). */
  max?: number;
}) {
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const previous = usePrevious(digit);
  // The drum rolls the way it turned: up for +1, down for -1.
  const roll = previous === undefined || previous === digit ? "" : (digit - previous + max + 1) % (max + 1) === 1 ? "logic-roll-up" : "logic-roll-down";
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
        <span aria-hidden="true" className="logic-drum-ghost logic-drum-ghost-top">{(digit + 1) % (max + 1)}</span>
        <span key={digit} className={`logic-drum-digit ${roll}`}>{digit}</span>
        <span aria-hidden="true" className="logic-drum-ghost logic-drum-ghost-bottom">{(digit + max) % (max + 1)}</span>
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
  // A level's card has its own dials, range and tries (safe.ts safeShapeOf; today's four of 0–9 and three otherwise).
  const shape = safeShapeOf(isSafe ? puzzle : null);
  const [dials, setDials] = useStageState<number[]>(stateKey, "safeDials", () =>
    new Array(shape.dials).fill(0),
  );
  const [tries, setTries] = useStageState<number[][]>(stateKey, "safeTries", () => []);
  const [shake, setShake] = useStageState<boolean>(stateKey, "safeShake", () => false);
  const submitted = useRef(false);

  const triesLeft = Math.max(0, shape.tries - tries.length);
  // Presentation only: the public clues all hold for the last try (the same test that submits).
  const lastTry = tries[tries.length - 1];
  const opened = isSafe && lastTry !== undefined && puzzle.clues.every((clue) => clueHolds(clue, lastTry));
  const solving = useSolveFx("safe", opened);
  // The opening: each drum clicks into place in turn (logic.css logic-drum-lock, 95 ms apart, its dip at 45 % of
  // 220 ms), a single tumbler dropping each time.
  useEffect(() => {
    if (!solving) return;
    const timers = Array.from({ length: shape.dials }, (_, i) => window.setTimeout(() => soundCue("safe.drumLock"), i * 95 + 100));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solving]);

  // puzzleScoreRev 2: the draft also carries the dials as they stand, so a time-out keeps their right dials as progress.
  const pendingDraft = puzzleScoreRevOf(puzzle) >= 2 && tries.length < shape.tries;
  useEffect(() => {
    onDraftAnswer?.(pendingDraft ? encodeSafeDraft(tries, dials, shape) : encodeSafeTries(tries, shape));
    // The shape is the stored puzzle's (fixed for the round).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tries, dials, pendingDraft, onDraftAnswer]);

  // Logic overhaul 1: after a wrong try, the clues that try broke (only after a Try, never live while turning).
  const broken = new Set<number>(isSafe && !opened ? brokenClues(puzzle.clues, lastTry) : []);
  const doorRef = useRef<HTMLDivElement>(null);
  // One mechanical tick per dial step, at most one per 60 ms, so a held arrow doesn't smear.
  const lastTick = useRef(0);
  const step = (dial: number, delta: number) => {
    if (locked || submitted.current || triesLeft === 0) return;
    const now = performance.now();
    if (now - lastTick.current >= SAFE_TICK_GAP_MS) {
      lastTick.current = now;
      soundCue("safe.click");
    }
    setDials((current) =>
      current.map((digit, index) => (index === dial ? (digit + delta + shape.max + 1) % (shape.max + 1) : digit)),
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
      // The opening's one sound is `safe.solve` (useSolveFx, this same render): its slot plays pz_safe_open and stands in
      // for the generic lock / correct of that moment (sound.ts ownMomentReplaces; 15 Nov 2026, Joe).
      onSubmit(encodeSafeTries(next, shape));
      return;
    }
    playWrong();
    soundCue("safe.wrongTry");
    // The door jolts against its bolts (the kit's "wrong"); the broken clues flash on the card.
    gameFx("wrong", doorRef.current, { silent: true });
    if (next.length >= shape.tries) {
      submitted.current = true;
      onSubmit(encodeSafeTries(next, shape));
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
          {puzzle.clues.map((clue, index) => (
            <p
              key={clue.text}
              data-broken={broken.has(index) ? "" : undefined}
              className="safe-clue-text logic-safe-clue text-center leading-[1.45]"
            >
              {broken.has(index) ? <span className="logic-safe-broken-mark" aria-label="Broken by your last try: ">✕ </span> : null}
              {clue.text}
            </p>
          ))}
        </div>

        <div className="logic-safe-vault relative mx-auto w-4/5">
          <span aria-hidden="true" className="logic-safe-inside"><i /><i /><i /></span>
          <div
            ref={doorRef}
            data-game-controls="dial" className={`safe-metal-panel logic-safe-door relative flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-border p-1 ${
              shake ? "animate-shake border-warn" : ""
            } ${opened ? "logic-safe-door-open" : ""}`}
          >
            <span aria-hidden="true" className="logic-safe-hinge" />
            {/* The bolts: they slide back one by one when the right code opens the door (Logic overhaul 1). */}
            <span aria-hidden="true" className="logic-safe-bolts"><i /><i /><i /></span>
            <span aria-hidden="true" className="logic-rivet" data-corner="tl" />
            <span aria-hidden="true" className="logic-rivet" data-corner="tr" />
            <span aria-hidden="true" className="logic-rivet" data-corner="bl" />
            <span aria-hidden="true" className="logic-rivet" data-corner="br" />
            <div className="logic-safe-drums flex gap-2" data-dials={shape.dials} data-key-dial={shownDial ?? undefined}>
              {dials.map((digit, dial) => (
                <Dial
                  key={dial}
                  digit={digit}
                  order={dial}
                  max={shape.max}
                  disabled={locked || triesLeft === 0}
                  onStep={(delta) => step(dial, delta)}
                />
              ))}
            </div>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              tries left <span className="text-primary">{triesLeft}</span>
              {/* depthRev 1: opening with a try to spare is a clean crack (the top 50 by speed: all of it on try 1, half on try 2). */}
              {/* The scoring standard (depthRev 3): the clean crack is full only with no wrong try (2.5 off each). */}
              {isSafe && usesDepth(puzzle) && (usesStandard(puzzle) ? triesLeft === shape.tries : triesLeft > 1) ? (
                <span className="d6-clean" data-clean-crack="on"> · clean crack if this try opens it</span>
              ) : isSafe && usesDepth(puzzle) && usesStandard(puzzle) && tries.length > 0 ? (
                <span className="d6-clean" data-clean-crack="off"> · clean crack is first try only</span>
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

/**
 * The reveal (Logic overhaul 1, 15 Nov 2026): the code on big drums; each of your tries as a row of small drums, the
 * dials that matched the code green and the others red; the clues marked for your last try (✓ held, ✕ broken); and
 * the numbers behind the score (tries used, best dials right, a clean crack).
 */
function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  if (puzzle.type !== "safe") return null;
  const shape = safeShapeOf(puzzle);
  const combination = puzzle.combination ?? new Array(shape.dials).fill(0);
  const tries = decodeSafeTries(myAnswer ?? "", shape);
  const last = tries[tries.length - 1];
  const broken = new Set(brokenClues(puzzle.clues, last));
  const best = tries.reduce((most, t) => Math.max(most, dialsCorrect(t, combination)), 0);
  const clean = myCorrect && usesDepth(puzzle) && (usesStandard(puzzle) ? tries.length === 1 : tries.length < shape.tries);

  return (
    <div className="logic-reveal">
      <div className="logic-reveal-board flex-col gap-3">
        <div data-safe-code="" className={`flex gap-2 ${myCorrect ? "safe-metal-panel logic-safe-door solve-safe-door rounded-lg border border-border p-2" : ""}`}>
          {combination.map((digit, dial) => (
            <Dial key={dial} digit={digit} gold order={dial} max={shape.max} />
          ))}
        </div>
        {tries.length ? (
          <div data-safe-tries="" className="logic-safe-tries">
            {tries.map((t, i) => (
              <div key={i} className="logic-safe-try" aria-label={`Try ${i + 1}: ${t.join(" ")}, ${dialsCorrect(t, combination)} dials right`}>
                <span className="logic-safe-try-label">Try {i + 1}</span>
                {t.map((digit, dial) => (
                  <span key={dial} className="logic-safe-try-dial" data-right={digit === combination[dial] ? "" : undefined}>
                    {digit}
                  </span>
                ))}
              </div>
            ))}
          </div>
        ) : null}
        <ul data-safe-clues="" className="logic-safe-clue-list">
          {puzzle.clues.map((clue, index) => (
            <li key={clue.text} data-broken={last && broken.has(index) ? "" : undefined}>
              <span aria-hidden="true">{last && broken.has(index) ? "✕" : "✓"}</span> {clue.text}
            </li>
          ))}
        </ul>
      </div>
      <RevealFacts
        items={[
          { label: `Tries of ${shape.tries}`, value: tries.length },
          { label: `Best dials of ${shape.dials}`, value: myCorrect ? shape.dials : best, tone: myCorrect ? "good" : undefined },
          myCorrect && { label: "Clean crack", value: clean ? "Yes" : "No", tone: clean ? "gold" : undefined },
        ]}
      />
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
