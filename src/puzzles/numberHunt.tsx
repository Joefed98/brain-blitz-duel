import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useRef, useState, type RefObject } from "react";

import { serverNow } from "@/lib/duel/clock";
import { randInt } from "@/lib/duel/random";
import {
  TAP_LOG_MAX,
  TAP_LOG_PREFIX,
  TAP_REV,
  decodeNumberTaps,
  encodeNumberTaps,
  replayAscend,
  usesTapLog,
  type NumberTap,
} from "@/lib/duel/tapLog";
import {
  NUMHUNT_CIRCLE_PX,
  NUMHUNT_COUNT,
  NUMHUNT_FLASH_MS,
  NUMHUNT_MOVE_MS,
  NUMHUNT_TIME_MS,
  type HuntSpot,
  type NumberHuntPuzzleData,
} from "@/lib/duel/types";

import { fireAscendFinish } from "@/components/puzzles/numberHuntFx";
import { playSound } from "@/lib/sound";
import { puzzleReject } from "@/lib/fx/puzzleReject";
import { rightMoveFlash } from "@/lib/fx/gameToolkit";
import { registerFxPreview } from "@/components/puzzles/speedFx";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Reference size of the puzzle area on a 390px-wide phone, used for spacing. */
const AREA_W = 340;
const AREA_H = 320;
const MIN_GAP_PX = NUMHUNT_CIRCLE_PX + 6;
const CONSECUTIVE_GAP_PX = 120;

function distancePx(a: HuntSpot, b: HuntSpot): number {
  const dx = ((a.x - b.x) / 100) * AREA_W;
  const dy = ((a.y - b.y) / 100) * AREA_H;
  return Math.sqrt(dx * dx + dy * dy);
}

/** "reached,errors,elapsedMs" — everything the reveal needs. */
export function parseRun(answer: string | null) {
  const [reached, errors, elapsed] = (answer ?? "").split(",").map((v) => Number.parseInt(v, 10));
  return {
    reached: Number.isFinite(reached) ? reached! : 0,
    errors: Number.isFinite(errors) ? errors! : 0,
    elapsedMs: Number.isFinite(elapsed) ? elapsed! : 0,
  };
}

/** A tap-log answer, replayed as the server scored it: count reached, wrong taps, finishing time. */
function loggedRun(puzzle: NumberHuntPuzzleData, answer: string | null) {
  if (!answer?.startsWith(TAP_LOG_PREFIX)) return { reached: 0, errors: 0, elapsedMs: 0 };
  const replay = replayAscend(puzzle, decodeNumberTaps(answer, NUMHUNT_TIME_MS, puzzle).taps);
  return { reached: replay.reached, errors: replay.errors, elapsedMs: replay.finishedAt ?? 0 };
}

const EXAMPLE_SPOTS: HuntSpot[] = [
  { x: 20, y: 22, n: 12 },
  { x: 74, y: 32, n: 34 },
  { x: 38, y: 62, n: 57 },
  { x: 82, y: 74, n: 68 },
  { x: 16, y: 84, n: 81 },
  { x: 54, y: 12, n: 95 },
];

function Circle({
  n,
  done,
  wrong = false,
  size = NUMHUNT_CIRCLE_PX,
}: {
  n: number;
  done: boolean;
  wrong?: boolean;
  size?: number;
}) {
  return (
    <span
      data-disc={wrong ? "wrong" : done ? "done" : "todo"}
      className={`ascend-disc flex items-center justify-center rounded-full border-2 font-mono font-bold ${
        wrong
          ? "border-warn bg-warn/25 text-warn"
          : done
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-foreground"
      }`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.46) }}
    >
      {n}
    </span>
  );
}

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Tap the numbers in order, smallest to largest, as fast as you can.
      </p>
      <div className="relative h-40 w-56">
        {EXAMPLE_SPOTS.map((spot, index) => (
          <span
            key={index}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
          >
            <Circle n={spot.n} done={index < 3} size={38} />
          </span>
        ))}
        {/* Finger pointing at 68 — drawn inline, never a Unicode glyph. */}
        <svg
          className="absolute text-primary"
          style={{ left: `${EXAMPLE_SPOTS[3]!.x + 6}%`, top: `${EXAMPLE_SPOTS[3]!.y}%` }}
          width="26"
          height="26"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M10 21v-5l-3 1c-1 .3-1.8-.8-1.1-1.6l3.6-4.2V4.6a1.6 1.6 0 0 1 3.2 0v4.6h1a4 4 0 0 1 4 4V21z"
            fill="currentColor"
          />
        </svg>
      </div>
      <p className="text-center text-xs text-muted-foreground">Wrong taps cost you points.</p>
    </div>
  );
}

/**
 * Display only: a wrong tap plays the existing wrong sound (directly: playWrong's duelz-cue would
 * shake the whole board) and gives the tapped disc the shared shake and red outline; a right tap
 * a light, quiet tick.
 */
function ascendWrongTap(disc: Element | null): void {
  playSound("wrong");
  if (disc) puzzleReject(disc, false);
}
function ascendRightTap(disc: Element | null): void {
  playSound("tick", 0.45, 1.25, true);
  // Polish batch S: the shared right-move glow on the disc just tapped (display only).
  rightMoveFlash(disc);
}

/** Rounds stored before tap logs (no `tapRev`): the phone's own "reached,errors" summary. */
function LegacyStage({ puzzle, phaseStartedAt, now, locked, onSubmit }: PuzzleStageProps) {
  const layouts = puzzle.type === "numhunt" ? puzzle.layouts : [];
  const key = layouts.flat().map((s) => `${s.x}:${s.y}`).join("|");
  const [next, setNext] = useState(0);
  const [errors, setErrors] = useState(0);
  const [flash, setFlash] = useState<number | null>(null);
  const [moveFlash, setMoveFlash] = useState(-1);
  const submitted = useRef("");
  const arenaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setNext(0);
    setErrors(0);
    setFlash(null);
  }, [key]);

  useEffect(() => {
    if (flash === null) return;
    const id = setTimeout(() => setFlash(null), NUMHUNT_FLASH_MS);
    return () => clearTimeout(id);
  }, [flash]);

  const layoutIndex = Math.min(3, Math.floor(Math.max(0, now - phaseStartedAt) / NUMHUNT_MOVE_MS));
  const spots = layouts[layoutIndex] ?? (puzzle.type === "numhunt" ? puzzle.spots : []);

  useEffect(() => {
    if (layoutIndex === 0) return;
    setMoveFlash(layoutIndex);
    const id = setTimeout(() => setMoveFlash(-1), NUMHUNT_FLASH_MS);
    return () => clearTimeout(id);
  }, [layoutIndex]);

  if (puzzle.type !== "numhunt") return null;

  const handleTap = (index: number, disc: Element | null) => {
    if (locked || index < next) return;
    if (index !== next) {
      setErrors((e) => e + 1);
      setFlash(index);
      ascendWrongTap(disc);
      return;
    }
    ascendRightTap(disc);
    const done = index + 1;
    setNext(done);
    if (done === spots.length && submitted.current !== key) {
      submitted.current = key;
      const remaining = Math.max(0, NUMHUNT_TIME_MS - (serverNow() - phaseStartedAt));
      fireAscendFinish(arenaRef.current, spots);
      onSubmit(`${done},${errors},${Math.round(NUMHUNT_TIME_MS - remaining)}`, { errors });
    }
  };

  return (
    <AscendBoard
      spots={spots}
      next={next}
      errors={errors}
      flash={flash}
      pulse={moveFlash === layoutIndex}
      locked={locked}
      elapsed={Math.max(0, now - phaseStartedAt)}
      onTap={handleTap}
      arenaRef={arenaRef}
    />
  );
}

function AscendBoard({
  spots,
  next,
  errors,
  flash,
  pulse,
  locked,
  elapsed,
  onTap,
  arenaRef,
}: {
  spots: HuntSpot[];
  next: number;
  errors: number;
  flash: number | null;
  pulse: boolean;
  locked: boolean;
  elapsed: number;
  onTap: (index: number, disc: Element | null) => void;
  arenaRef: RefObject<HTMLDivElement | null>;
}) {
  const spotsRef = useRef(spots);
  spotsRef.current = spots;
  useEffect(() => registerFxPreview("numhunt", () => fireAscendFinish(arenaRef.current, spotsRef.current)), [arenaRef]);
  return (
    <div data-polish="numhunt" data-stage-column="3" className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Next: {spots[Math.min(next, spots.length - 1)]?.n ?? ""}
        </span>
        <MoveTimer elapsed={elapsed} />
        <span className="text-right font-mono text-xs text-muted-foreground">
          {errors} {errors === 1 ? "error" : "errors"}
        </span>
      </div>

      <div ref={arenaRef} data-game-arena="tall" className={`ascend-board relative min-h-[320px] flex-1 rounded-2xl border border-border bg-muted/10 ${pulse ? "animate-pulse" : ""}`}>
        {spots.map((spot, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Circle ${spot.n}`}
            disabled={locked}
            onClick={(e) => onTap(index, e.currentTarget.querySelector(".ascend-disc"))}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
          >
            <Circle n={spot.n} done={index < next} wrong={flash === index} size={44} />
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The count-up timer centred above the board: 0 to 15 s, back to 0 when the
 * untapped discs move (every NUMHUNT_MOVE_MS), then up again. Display only.
 */
function MoveTimer({ elapsed }: { elapsed: number }) {
  const inCycle = Math.max(0, elapsed) % NUMHUNT_MOVE_MS;
  const fraction = inCycle / NUMHUNT_MOVE_MS;
  const soon = NUMHUNT_MOVE_MS - inCycle <= 3_000;
  return (
    <div data-ascend-timer="" aria-label={`${Math.floor(inCycle / 1000)} seconds since the discs moved`} className="ascend-move-timer flex min-w-24 flex-col items-center gap-1">
      <span className={`font-mono text-2xl font-bold leading-none tabular-nums ${soon ? "text-warn" : "text-foreground"}`}>
        {(inCycle / 1000).toFixed(1)}s
      </span>
      <span aria-hidden="true" className="relative h-1 w-20 overflow-hidden rounded-full bg-muted">
        <span className={`absolute inset-y-0 left-0 rounded-full ${soon ? "bg-warn" : "bg-primary"}`} style={{ width: `${fraction * 100}%` }} />
      </span>
    </div>
  );
}

/**
 * Tap-log rounds (`tapRev`): every tap is logged by its number on the round
 * clock and sent raw, finished or not; the server checks each one against the
 * layout on screen at that moment. What the phone shows comes from the same replay.
 */
function LoggedStage({ puzzle, phaseStartedAt, now, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const layouts = puzzle.type === "numhunt" ? puzzle.layouts : [];
  const key = layouts.flat().map((s) => `${s.x}:${s.y}`).join("|");
  const taps = useRef<NumberTap[]>([]);
  const [logLength, setLogLength] = useState(0);
  const [flash, setFlash] = useState<number | null>(null);
  const [moveFlash, setMoveFlash] = useState(-1);
  const submitted = useRef("");
  const arenaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    taps.current = [];
    setLogLength(0);
    setFlash(null);
  }, [key]);

  useEffect(() => {
    if (flash === null) return;
    const id = setTimeout(() => setFlash(null), NUMHUNT_FLASH_MS);
    return () => clearTimeout(id);
  }, [flash]);

  const layoutIndex = Math.min(3, Math.floor(Math.max(0, now - phaseStartedAt) / NUMHUNT_MOVE_MS));
  const spots = layouts[layoutIndex] ?? (puzzle.type === "numhunt" ? puzzle.spots : []);

  useEffect(() => {
    if (layoutIndex === 0) return;
    setMoveFlash(layoutIndex);
    const id = setTimeout(() => setMoveFlash(-1), NUMHUNT_FLASH_MS);
    return () => clearTimeout(id);
  }, [layoutIndex]);

  useEffect(() => {
    if (logLength > 0) onDraftAnswer?.(encodeNumberTaps(taps.current));
  }, [logLength]); // eslint-disable-line react-hooks/exhaustive-deps

  if (puzzle.type !== "numhunt") return null;
  const replay = replayAscend(puzzle, taps.current);

  const handleTap = (index: number, disc: Element | null) => {
    const spot = spots[index];
    if (locked || !spot || replay.finishedAt !== null) return;
    const log = taps.current;
    if (log.length >= TAP_LOG_MAX) return;
    // Whole ms on the round clock, never earlier than the tap before.
    const stamp = Math.max(0, Math.round(serverNow() - phaseStartedAt), log[log.length - 1]?.t ?? 0);
    taps.current = [...log, { n: spot.n, t: stamp }];
    setLogLength(taps.current.length);
    const after = replayAscend(puzzle, taps.current);
    const outcome = after.outcomes[after.outcomes.length - 1];
    if (outcome === "wrong") {
      setFlash(index);
      ascendWrongTap(disc);
    } else if (after.reached > replay.reached) ascendRightTap(disc);
    if (after.finishedAt !== null && submitted.current !== key) {
      submitted.current = key;
      fireAscendFinish(arenaRef.current, spots);
      onSubmit(encodeNumberTaps(taps.current), { errors: after.errors });
    }
  };

  return (
    <AscendBoard
      spots={spots}
      next={replay.reached}
      errors={replay.errors}
      flash={flash}
      pulse={moveFlash === layoutIndex}
      locked={locked}
      elapsed={Math.max(0, now - phaseStartedAt)}
      onTap={handleTap}
      arenaRef={arenaRef}
    />
  );
}

function Stage(props: PuzzleStageProps) {
  return usesTapLog(props.puzzle) ? <LoggedStage {...props} /> : <LegacyStage {...props} />;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "numhunt") return null;
  const { reached, errors, elapsedMs } = usesTapLog(puzzle) ? loggedRun(puzzle, myAnswer) : parseRun(myAnswer);
  const finished = reached >= puzzle.spots.length;

  return (
    <>
      <div className="ascend-board relative h-64 w-full rounded-2xl border border-border bg-muted/10">
        {puzzle.spots.map((spot, index) => (
          <span
            key={index}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
          >
            <Circle n={spot.n} done size={38} />
          </span>
        ))}
      </div>
      <div className="ascend-reveal-result flex w-full flex-col items-center gap-2 rounded-2xl bg-card px-4 py-4">
        <p className="text-center font-mono text-base font-bold text-primary">
          {finished
            ? `Finished with ${errors} ${errors === 1 ? "error" : "errors"} · ${(
                elapsedMs / 1000
              ).toFixed(1)}s`
            : `Did not finish · reached ${Math.max(reached, 0)} of ${puzzle.spots.length}`}
        </p>
      </div>
    </>
  );
}

/** Twenty-four distinct two-digit numbers, ascending. */
function pickValues(): number[] {
  const pool = new Set<number>();
  while (pool.size < NUMHUNT_COUNT) pool.add(randInt(10, 99));
  return [...pool].sort((a, b) => a - b);
}

/**
 * Positions are stored as percentages, so both phones lay the circles out
 * identically. No two circles touch, and consecutive numbers are never close.
 */
function buildLayout(values: number[]): HuntSpot[] {
  for (let attempt = 0; attempt < 400; attempt++) {
    const spots: HuntSpot[] = [];
    let ok = true;
    for (let i = 0; i < NUMHUNT_COUNT; i++) {
      let placed = false;
      for (let tries = 0; tries < 300; tries++) {
        const spot: HuntSpot = {
          x: randInt(9, 91),
          y: randInt(9, 91),
          n: values[i]!,
        };
        if (spots.some((s) => distancePx(s, spot) < MIN_GAP_PX)) continue;
        const previous = spots[i - 1];
        if (previous && distancePx(previous, spot) < CONSECUTIVE_GAP_PX) continue;
        spots.push(spot);
        placed = true;
        break;
      }
      if (!placed) {
        ok = false;
        break;
      }
    }
    if (ok) return spots;
  }
  // Fallback staggered grid — 24 circles (4 × 6) with safe spacing at 390×700.
  return Array.from({ length: NUMHUNT_COUNT }, (_, i) => ({
      x: 10 + (i % 4) * 27,
      y: 8 + Math.floor(i / 4) * 16.8,
      n: values[i]!,
    }));
}

export function buildNumberHunt(): NumberHuntPuzzleData {
  const values = pickValues();
  const layouts = Array.from({ length: 4 }, () => buildLayout(values));
  return { type: "numhunt", spots: layouts[0]!, layouts, tapRev: TAP_REV };
}

export const numberHuntPuzzle: PuzzleDefinition = {
  key: "numhunt",
  name: gameDisplayName("numhunt"),
  category: "speed",
  timeLimitMs: NUMHUNT_TIME_MS,
  generate: buildNumberHunt,
  revealHeading: "Your run",
  check: (answer, puzzle) =>
    puzzle.type === "numhunt" &&
    (usesTapLog(puzzle) ? loggedRun(puzzle, answer) : parseRun(answer)).reached >= puzzle.spots.length,
  IntroExample,
  Stage,
  Reveal,
};
