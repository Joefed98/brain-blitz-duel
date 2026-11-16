import { speedLevelGoal, speedLevelLine } from "@/lib/levels/speedLevels";
import { useGoalText } from "@/components/duel/GameFrame";
import { puzzleLevel } from "@/lib/levels/levels";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { speedArtCss } from "@/lib/fx/speedArt";
import { gameFx } from "@/lib/fx/kit";
import { useBeforePaint } from "@/components/puzzles/useBeforePaint";

import { serverNow } from "@/lib/duel/clock";
import { randInt } from "@/lib/duel/random";
import {
  TAP_LOG_MAX,
  TAP_LOG_PREFIX,
  ascendLayoutIndex,
  ascendMoveMs,
  dealtTapRev,
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
import { playCueSlot, playSound } from "@/lib/sound";
import { puzzleReject } from "@/lib/fx/puzzleReject";
import { rightMoveFlash } from "@/lib/fx/gameToolkit";
import { registerFxPreview } from "@/components/puzzles/speedFx";
import { HudPills } from "@/components/puzzles/HudPills";
import { RevealCaption, RevealNumbers } from "@/components/puzzles/SpeedRevealKit";

import { ascendFlow, liveFlowMultiplier, usesAscendDepth } from "@/lib/duel/depth/ascend";
import { ascendBestRun, ascendStandard } from "@/lib/duel/standard/attention";

import type { AscendLevel } from "@/lib/levels/speedLevels";
import { puzzleTimeLimitMs } from "@/lib/duel/catalogue";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Reference size of the puzzle area on a 390px-wide phone, used for spacing. */
const AREA_W = 340;
const AREA_H = 320;
const MIN_GAP_PX = NUMHUNT_CIRCLE_PX + 6;
const CONSECUTIVE_GAP_PX = 120;

/** The Speed overhaul's Blender art (speedArt.ts): the walnut board and the two counters, as CSS variables. */
const ASCEND_ART_STYLE = {
  "--ascend-board-art": speedArtCss("ascend-board"),
  "--ascend-disc-art": speedArtCss("ascend-disc"),
  "--ascend-disc-done-art": speedArtCss("ascend-disc-done"),
} as CSSProperties;

/** The disc's size range (px): 44 as before, up to ASCEND_DISC_MAX where the board has the room. */
export const ASCEND_DISC_MIN = 44;
export const ASCEND_DISC_MAX = 60;
/** Space kept between the two closest discs (px). */
export const ASCEND_DISC_GAP = 6;

/**
 * The disc size for a board of w × h px: the closest pair of centres less ASCEND_DISC_GAP, within 44–60 (44 until
 * the board is measured). Display only: the positions are the dealt ones.
 */
export function ascendDiscSize(spots: readonly { x: number; y: number }[], w: number, h: number): number {
  if (w <= 0 || h <= 0 || spots.length < 2) return ASCEND_DISC_MIN;
  let closest = Infinity;
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      const dx = ((spots[i]!.x - spots[j]!.x) / 100) * w;
      const dy = ((spots[i]!.y - spots[j]!.y) / 100) * h;
      closest = Math.min(closest, Math.hypot(dx, dy));
    }
  }
  return Math.max(ASCEND_DISC_MIN, Math.min(ASCEND_DISC_MAX, Math.floor(closest - ASCEND_DISC_GAP)));
}

/**
 * The Speed overhaul (15 Nov 2026; display and sound only): a small bell one second before the discs move, then every
 * disc glides from where it was to its new place (the kit's slide, transform only; each disc's button is at its new
 * place at once, so a tap during the glide counts as before) with a whoosh.
 */
function useShuffleCues(arenaRef: RefObject<HTMLDivElement | null>, spots: readonly HuntSpot[], elapsed: number, moveMs = NUMHUNT_MOVE_MS, shuffles = 3): void {
  const every = moveMs > 0 ? moveMs : Number.POSITIVE_INFINITY;
  const cycle = Math.floor(Math.max(0, elapsed) / every);
  const warnAt = every - 1000;
  const warned = useRef(-1);
  useEffect(() => {
    const inCycle = Math.max(0, elapsed) % every;
    if (inCycle >= warnAt && warned.current !== cycle && cycle < shuffles) {
      warned.current = cycle;
      playCueSlot("numhunt.warn", 0.7);
    }
  }, [elapsed, cycle, warnAt]);
  const places = useRef(new Map<number, DOMRect>());
  const layoutKey = spots.map((s) => `${s.n}:${s.x}:${s.y}`).join("|");
  const firstLayout = useRef(true);
  useBeforePaint(() => {
    const root = arenaRef.current;
    if (!root) return;
    const next = new Map<number, DOMRect>();
    const buttons = [...root.querySelectorAll<HTMLElement>("[aria-label^='Circle ']")];
    for (const b of buttons) next.set(Number(b.getAttribute("aria-label")!.slice(7)), b.getBoundingClientRect());
    if (!firstLayout.current) {
      let moved = false;
      for (const b of buttons) {
        const n = Number(b.getAttribute("aria-label")!.slice(7));
        const was = places.current.get(n);
        const now = next.get(n)!;
        if (!was || (Math.abs(was.left - now.left) < 1 && Math.abs(was.top - now.top) < 1)) continue;
        moved = true;
        gameFx("slide", b, { from: { x: was.left - now.left, y: was.top - now.top }, silent: true });
      }
      if (moved) playCueSlot("numhunt.shuffle");
    }
    firstLayout.current = false;
    places.current = next;
  }, [layoutKey]);
}

function useBoardSize(ref: RefObject<HTMLDivElement | null>): { w: number; h: number } {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize((prev) => (prev.w === el.clientWidth && prev.h === el.clientHeight ? prev : { w: el.clientWidth, h: el.clientHeight }));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

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
/**
 * The server's stored count for a tap-log round (extra.reached, extra.wrongTaps or the replay's errors, the finishing
 * tap's time), or null for a round stored without it. Exported for speed-overhaul-check.
 */
export function storedAscendRun(extra: Record<string, unknown> | null | undefined): { reached: number; errors: number; elapsedMs: number } | null {
  const reached = extra?.["reached"];
  if (typeof reached !== "number") return null;
  const wrong = extra?.["wrongTaps"];
  const at = extra?.["finishedAtMs"];
  return { reached, errors: typeof wrong === "number" ? wrong : 0, elapsedMs: typeof at === "number" ? at : 0 };
}

function loggedRun(puzzle: NumberHuntPuzzleData, answer: string | null) {
  if (!answer?.startsWith(TAP_LOG_PREFIX)) return { reached: 0, errors: 0, elapsedMs: 0 };
  const replay = replayAscend(puzzle, decodeNumberTaps(answer, puzzleTimeLimitMs(puzzle), puzzle).taps);
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

export function Circle({
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
      className={`ascend-disc flex items-center justify-center rounded-full border-2 font-display font-black ${
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
      <p className="text-center text-xs text-muted-foreground">Wrong taps cost you points; right taps in a row build a flow bonus.</p>
    </div>
  );
}

/**
 * Display only: a wrong tap plays the existing wrong sound (directly: playWrong's duelz-cue would
 * shake the whole board) and gives the tapped disc the shared shake and red outline; a right tap
 * a light, quiet tick.
 */
function ascendWrongTap(disc: Element | null): void {
  // The Speed overhaul (15 Nov 2026): a short "wrong" on that disc only (its own knock; the shared wrong without one).
  if (!playCueSlot("numhunt.wrong")) playSound("wrong");
  ascendRun.length = 0;
  if (disc) gameFx("wrong", disc, { silent: true });
}

/** The time of each right tap in the current fast run (a gap over ASCEND_FAST_GAP_MS starts a new one). */
const ascendRun: number[] = [];
export const ASCEND_FAST_GAP_MS = 700;

/**
 * A right tap: a marimba note a step (a semitone) higher each number, two octaves over 24, from three recordings an
 * octave apart (low for 1–8, mid for 9–16, high for 17–24, so none is pitched far); five fast in a row a combo.
 */
export function ascendNote(reached: number): { cue: "numhunt.note-low" | "numhunt.note-mid" | "numhunt.note-high"; rate: number } {
  const step = Math.max(0, Math.min(23, reached - 1));
  if (step < 8) return { cue: "numhunt.note-low", rate: Math.pow(2, step / 12) };
  if (step < 16) return { cue: "numhunt.note-mid", rate: Math.pow(2, (step - 12) / 12) };
  return { cue: "numhunt.note-high", rate: Math.pow(2, (step - 24) / 12) };
}
function ascendRightTap(disc: Element | null, reached = 0): void {
  const note = ascendNote(reached);
  if (!playCueSlot(note.cue, 0.8, note.rate)) playSound("tick", 0.45, 1.25, true);
  // Polish batch S: the shared right-move glow on the disc just tapped (display only).
  rightMoveFlash(disc);
  const now = typeof performance === "undefined" ? 0 : performance.now();
  if (ascendRun.length && now - ascendRun[ascendRun.length - 1]! > ASCEND_FAST_GAP_MS) ascendRun.length = 0;
  ascendRun.push(now);
  if (ascendRun.length >= 5 && ascendRun.length % 5 === 0) {
    playCueSlot("numhunt.combo");
    gameFx("combo", disc, { count: ascendRun.length / 5, silent: true });
  }
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

  const layoutIndex = puzzle.type === "numhunt" ? ascendLayoutIndex(puzzle, now - phaseStartedAt) : 0;
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
    ascendRightTap(disc, index + 1);
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
      moveMs={puzzle.type === "numhunt" ? ascendMoveMs(puzzle) : NUMHUNT_MOVE_MS}
      shuffles={Math.max(0, layouts.length - 1)}
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
  flow = null,
  run = null,
  moveMs = NUMHUNT_MOVE_MS,
  shuffles = 3,
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
  /** Depth (tapRev 5): the flow multiplier on show (null: an older round, no chip). */
  flow?: number | null;
  /** The scoring standard (tapRev 6): the run of right taps since the last wrong one (null: an older round, no chip). */
  run?: number | null;
  /** The level's reshuffle interval (0 = the board never moves: no timer) and how many reshuffles the round holds. */
  moveMs?: number;
  shuffles?: number;
}) {
  const spotsRef = useRef(spots);
  spotsRef.current = spots;
  // The Speed overhaul (15 Nov 2026; display only): the discs grow into the room the board really has (never more
  // than the closest pair allows, so no two ever touch); each disc's button is the disc, as before.
  const board = useBoardSize(arenaRef);
  const discSize = ascendDiscSize(spots, board.w, board.h);
  useShuffleCues(arenaRef, spots, elapsed, moveMs, shuffles);
  useEffect(() => registerFxPreview("numhunt", () => fireAscendFinish(arenaRef.current, spotsRef.current)), [arenaRef]);
  return (
    <div data-polish="numhunt" data-stage-column="3" className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Puzzle polish (3 Nov 2026): the HUD as separate pills ("Next 7", "In a row 3", "Errors 0"), the move timer
          centred under them; the old one-line label was cut off ("NEX…") beside the chips. Display only. */}
      <div data-ascend-hud="" className="flex flex-col items-center gap-2">
        <HudPills
          testId="numhunt"
          items={[
            { id: "next", label: "Next", value: spots[Math.min(next, spots.length - 1)]?.n ?? "", tone: "gold" },
            flow !== null && { id: "flow", label: "Flow", value: `×${flow}`, ...(flow > 1 ? { tone: "gold" as const } : {}) },
            run !== null && { id: "run", label: "In a row", value: run, ...(run >= 4 ? { tone: "gold" as const } : {}) },
            { id: "errors", label: "Errors", value: errors, ...(errors > 0 ? { tone: "warn" as const } : {}) },
          ]}
        />
        {moveMs > 0 && shuffles > 0 ? <MoveTimer elapsed={elapsed} moveMs={moveMs} /> : null}
      </div>

      <div ref={arenaRef} data-game-arena="tall" data-ascend-art="" style={ASCEND_ART_STYLE} className={`ascend-board relative min-h-[320px] flex-1 rounded-2xl border border-border bg-muted/10 ${pulse ? "animate-pulse" : ""}`}>
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
            <Circle n={spot.n} done={index < next} wrong={flash === index} size={discSize} />
          </button>
        ))}
      </div>
    </div>
  );
}

/** The run of right taps since the last wrong tap (the standard's flow streak, live). */
function currentRun(outcomes: readonly string[]): number {
  let run = 0;
  for (const o of outcomes) run = o === "wrong" ? 0 : o === "correct" ? run + 1 : run;
  return run;
}

/**
 * The count-up timer centred above the board: 0 to 15 s, back to 0 when the
 * untapped discs move (every NUMHUNT_MOVE_MS), then up again. Display only.
 */
function MoveTimer({ elapsed, moveMs = NUMHUNT_MOVE_MS }: { elapsed: number; moveMs?: number }) {
  const inCycle = Math.max(0, elapsed) % moveMs;
  const fraction = inCycle / moveMs;
  const soon = moveMs - inCycle <= 3_000;
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

  const layoutIndex = puzzle.type === "numhunt" ? ascendLayoutIndex(puzzle, now - phaseStartedAt) : 0;
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
    const candidate = [...log, { n: spot.n, t: stamp }];
    const after = replayAscend(puzzle, candidate);
    const outcome = after.outcomes[after.outcomes.length - 1];
    // Speed review fixes (15 Nov 2026): a tap on a disc already done is one the server ignores, so it is not logged
    // (the same score) and makes no draft change, so it no longer ticks.
    if (ascendTapSilent(outcome)) return;
    taps.current = candidate;
    setLogLength(taps.current.length);
    if (outcome === "wrong") {
      setFlash(index);
      ascendWrongTap(disc);
    } else if (after.reached > replay.reached) ascendRightTap(disc, after.reached);
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
      flow={usesAscendDepth(puzzle) ? liveFlowMultiplier(ascendFlow(puzzle, taps.current), Math.max(0, now - phaseStartedAt)) : null}
      run={ascendStandard(puzzle) ? currentRun(replay.outcomes) : null}
      moveMs={puzzle.type === "numhunt" ? ascendMoveMs(puzzle) : NUMHUNT_MOVE_MS}
      shuffles={Math.max(0, layouts.length - 1)}
    />
  );
}

/** A tap the server's replay ignores (a disc already done): the phone neither logs nor sounds it. */
export function ascendTapSilent(outcome: string | undefined): boolean {
  return outcome === "ignored";
}

/** The reveal draws the discs reached (the first `reached` in rising order) gold, the rest grey. */
export function ascendRevealDone(index: number, reached: number): boolean {
  return index < reached;
}

function Stage(props: PuzzleStageProps) {
  // The Speed overhaul's levels: Expert counts down, so the goal line says so (every other level: the game's goal).
  useGoalText(speedLevelGoal("numhunt", puzzleLevel(props.puzzle)));
  return usesTapLog(props.puzzle) ? <LoggedStage {...props} /> : <LegacyStage {...props} />;
}

/** Depth (tapRev 5): the stored flow points and best multiplier (ascend.server.ts). */
function storedFlow(extra: Record<string, unknown> | null | undefined): { flow: number; best: number } | null {
  const d = extra?.["depth"] as Record<string, unknown> | undefined;
  return d && typeof d["flow"] === "number" && typeof d["bestFlow"] === "number" ? { flow: d["flow"] as number, best: d["bestFlow"] as number } : null;
}

function Reveal({ puzzle, myAnswer, myExtra }: PuzzleRevealProps) {
  if (puzzle.type !== "numhunt") return null;
  const flow = usesAscendDepth(puzzle) ? storedFlow(myExtra) : null;
  // The scoring standard (tapRev 6): the flow streak's best run (the stored grade's, else the log's) and its stored points.
  const standard = ascendStandard(puzzle) && usesTapLog(puzzle);
  const storedRun = myExtra?.["bestRun"];
  const bestRun = !standard ? 0 : typeof storedRun === "number" ? storedRun : ascendBestRun(replayAscend(puzzle, decodeNumberTaps(myAnswer ?? "", puzzleTimeLimitMs(puzzle), puzzle).taps).outcomes);
  const flowPoints = typeof myExtra?.["flowPoints"] === "number" ? (myExtra["flowPoints"] as number) : null;
  // The server's own count first (15 Nov 2026): the server replays the log only up to its receipt (latestTapMs), so the
  // phone's replay of the whole log could show 24/24 beside a "Not solved" verdict. The stored figures are what was
  // graded; the phone's replay stands in only for rounds stored without them.
  const replayed = usesTapLog(puzzle) ? loggedRun(puzzle, myAnswer) : parseRun(myAnswer);
  const { reached, errors, elapsedMs } = storedAscendRun(myExtra) ?? replayed;
  const finished = reached >= puzzle.spots.length;

  // The Speed overhaul (Joe, 15 Nov 2026; display only): the board large, reached discs gold, the disc you needed
  // next ringed, then the figures that explain the score.
  const total = puzzle.spots.length;
  const nextIndex = finished ? -1 : Math.max(reached, 0);
  return (
    <>
      <div data-ascend-art="" style={ASCEND_ART_STYLE} className="ascend-board relative h-80 w-full rounded-2xl border border-border bg-muted/10">
        {puzzle.spots.map((spot, index) => (
          <span
            key={index}
            data-ascend-missed={index === nextIndex ? "" : undefined}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${index === nextIndex ? "ring-4 ring-primary ring-offset-2 ring-offset-black" : ""}`}
            style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
          >
            {/* Speed review fixes (15 Nov 2026): only the discs reached are gold; the rest stay grey. */}
            <Circle n={spot.n} done={ascendRevealDone(index, reached)} size={44} />
          </span>
        ))}
      </div>
      {/* The result in one plain line for a screen reader (the board and big figures carry it on screen). */}
      <p className="sr-only" data-ascend-reveal-summary="">{finished ? `Finished with ${errors} ${errors === 1 ? "error" : "errors"}.` : `You reached ${reached} of ${puzzle.spots.length}.`}</p>
      <RevealCaption tone={finished ? "good" : undefined}>
        {finished ? `All ${puzzle.spots.length} in order` : `Next was ${puzzle.spots[nextIndex]?.n ?? "—"} (ringed)`}
      </RevealCaption>
      <RevealNumbers
        testId="numhunt"
        items={[
          { id: "reached", label: "Reached", value: `${Math.max(reached, 0)}/${total}`, tone: "gold" },
          { id: "wrong", label: "Wrong taps", value: errors, ...(errors > 0 ? { tone: "warn" as const } : { tone: "good" as const }) },
          standard ? { id: "run", label: "Best run", value: bestRun } : null,
          flow ? { id: "flow", label: "Flow bonus", value: `+${flow.flow}` } : null,
          finished ? { id: "time", label: "Time", value: `${(elapsedMs / 1000).toFixed(1)} s` } : null,
        ]}
      />
      {standard && flowPoints !== null ? <p data-ascend-flow-reveal="" className="text-center text-sm text-muted-foreground">Flow points +{flowPoints}</p> : null}
    </>
  );
}

/** Twenty-four distinct two-digit numbers, ascending (a level: its count and range; Expert highest first). */
function pickValues(level?: AscendLevel): number[] {
  const pool = new Set<number>();
  const count = level?.count ?? NUMHUNT_COUNT;
  while (pool.size < count) pool.add(level ? randInt(level.min, level.max) : randInt(10, 99));
  const sorted = [...pool].sort((a, b) => a - b);
  return level?.descending ? sorted.reverse() : sorted;
}

/**
 * Positions are stored as percentages, so both phones lay the circles out
 * identically. No two circles touch, and consecutive numbers are never close.
 */
function buildLayout(values: number[], gapPx = MIN_GAP_PX, consecutivePx = CONSECUTIVE_GAP_PX): HuntSpot[] {
  for (let attempt = 0; attempt < 400; attempt++) {
    const spots: HuntSpot[] = [];
    let ok = true;
    for (let i = 0; i < values.length; i++) {
      let placed = false;
      for (let tries = 0; tries < 300; tries++) {
        const spot: HuntSpot = {
          x: randInt(9, 91),
          y: randInt(9, 91),
          n: values[i]!,
        };
        if (spots.some((s) => distancePx(s, spot) < gapPx)) continue;
        const previous = spots[i - 1];
        if (previous && distancePx(previous, spot) < consecutivePx) continue;
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
  return Array.from({ length: values.length }, (_, i) => ({
      x: 10 + (i % 4) * 27,
      y: 8 + Math.floor(i / 4) * 16.8,
      n: values[i]!,
    }));
}

/**
 * A level's scatter (30 discs on Hard and Expert, 16 on Easy): today's rules with the gaps scaled to the count, so 30
 * discs fit the board as 24 do; if the scatter can't be drawn, a 5-column grid with the numbers shuffled into it (never
 * in order). The discs are sized to the closest pair on the phone (ascendDiscSize), so none ever touch.
 */
function buildLevelLayout(values: number[]): HuntSpot[] {
  const scale = Math.min(1, Math.sqrt(NUMHUNT_COUNT / values.length));
  const spots = buildLayout(values, Math.floor(MIN_GAP_PX * scale), Math.floor(CONSECUTIVE_GAP_PX * scale));
  const inside = spots.every((s) => s.x >= 9 && s.x <= 91 && s.y >= 8 && s.y <= 92);
  if (inside) return spots;
  const cols = values.length > NUMHUNT_COUNT ? 5 : 4;
  const rows = Math.ceil(values.length / cols);
  const cells = shuffledCells(values.length);
  return values.map((n, i) => {
    const cell = cells[i]!;
    return { x: 10 + (cell % cols) * Math.floor(80 / (cols - 1)), y: 8 + Math.floor(cell / cols) * Math.floor(84 / Math.max(1, rows - 1)), n };
  });
}

/** The cells 0…n−1 in a random order (the deal's own Math.random, seeded by the room). */
function shuffledCells(n: number): number[] {
  const cells = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = randInt(0, i);
    [cells[i], cells[j]] = [cells[j]!, cells[i]!];
  }
  return cells;
}

/**
 * At a level other than Normal (the Speed overhaul, stage 3; levels/speedLevels.ts) the level's count, range, order,
 * reshuffles and clock, stamped as `moveMs`, `timeLimitMs` and `descending`. Normal (no level) deals exactly as before.
 */
export function buildNumberHunt(level?: AscendLevel): NumberHuntPuzzleData {
  const values = pickValues(level);
  if (!level) {
    const layouts = Array.from({ length: 4 }, () => buildLayout(values));
    return { type: "numhunt", spots: layouts[0]!, layouts, tapRev: dealtTapRev("numhunt") };
  }
  const count = level.moveMs > 0 ? Math.max(1, Math.ceil(level.timeLimitMs / level.moveMs)) : 1;
  const layouts = Array.from({ length: count }, () => buildLevelLayout(values));
  return {
    type: "numhunt",
    spots: layouts[0]!,
    layouts,
    tapRev: dealtTapRev("numhunt"),
    moveMs: level.moveMs,
    timeLimitMs: level.timeLimitMs,
    ...(level.fullByS !== 40 ? { fullByS: level.fullByS } : {}),
    ...(level.descending ? { descending: true } : {}),
  };
}

export const numberHuntPuzzle: PuzzleDefinition = {
  // The Speed overhaul's levels: what the level changes, in one line on the round intro (Normal: none).
  introLine: (puzzle) => speedLevelLine(puzzle.type, puzzleLevel(puzzle)),
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
