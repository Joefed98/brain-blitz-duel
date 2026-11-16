/**
 * Topsy-Turvy gravityRev 3 (the remodel; topsy.ts, docs/depth/d5-remodels.md): the board, the ring row,
 * the live stage, the reveal and the intro still. The tray, blocks, felt and shaded balls keep the polished
 * Topsy-Turvy look (polish-pattern/gravity.css, batch P); holes, stars, home drops and the rings are new
 * (topsy.css). The board animates what replayTopsy decided and never decides anything itself.
 */
import { shownPar, usesParMoves } from "@/lib/duel/parMoves";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { ArrowPad, gridCellCentre, useGridMetrics, usePrefersReducedMotion } from "@/components/puzzles/GridDrag";
import { useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import { FramePills, parPills } from "@/components/puzzles/pattern/framePills";
import { TopsyCup, TopsyMarble } from "@/components/puzzles/pattern/topsyArt";
import { useGameFxOnce } from "@/components/fx/GameFx";
import { Button } from "@/components/ui/button";
import { useGameKeys } from "@/lib/desktop";
import { decodeGravityTilts, encodeGravityTilts } from "@/lib/duel/gravity";
import { useStageState } from "@/lib/duel/stageState";
import {
  TOPSY_HOME,
  TOPSY_SIZE,
  TOPSY_STARS,
  replayTopsyPuzzle,
  starCount,
  topsyBoardPar,
  topsyHomeCount,
  topsyStart,
  topsyTilt,
  topsyTotalBalls,
  type TopsyBoard as TopsyBoardData,
  type TopsyReplay,
  type TopsyState,
  type TopsyTilt,
} from "@/lib/duel/topsy";
import type { GravityDir, GravityPuzzleData } from "@/lib/duel/types";
import { gameFx, gameFxVariant } from "@/lib/fx/kit";
import { soundCue, useSolveMoment } from "@/lib/fx/patternFx";
import { cueHasFile, ensureLoop, playSound, playTick, stopLoop } from "@/lib/sound";
import type { PuzzleRevealProps, PuzzleStageProps } from "@/puzzles/types";

import "@/polish-pattern/topsy.css";

/**
 * Ball colours, each with its own mark (dot, triangle, square, diamond, cross, bar; Expert's seventh and eighth balls,
 * the difficulty levels of 16 Nov 2026: lime green with a heart, pearl white with a crescent) drawn on the ball and in
 * its hole, so a colour is never the only way to tell two balls apart. Normal's six use the first six.
 */
export const TOPSY_COLOURS = ["#F5C542", "#2FD4C4", "#A97BFF", "#FF5FA2", "#4F8BFF", "#FF8A3D", "#8BE04A", "#E8ECF2"] as const; // design-lint-ignore (ball art colours, as the sprites)
const MARKS = [
  <circle key="m" cx="12" cy="12" r="4.2" />,
  <path key="m" d="M12 6.5 L17.5 16.5 H6.5 Z" />,
  <rect key="m" x="7.5" y="7.5" width="9" height="9" rx="1" />,
  <path key="m" d="M12 5.5 L18.5 12 L12 18.5 L5.5 12 Z" />,
  <path key="m" d="M10.2 6h3.6v4.2H18v3.6h-4.2V18h-3.6v-4.2H6v-3.6h4.2z" />,
  <rect key="m" x="5.5" y="10" width="13" height="4" rx="1" />,
  <path key="m" d="M12 18 C5 13.5 5.5 7.5 9.2 7.5 C10.7 7.5 11.6 8.4 12 9.3 C12.4 8.4 13.3 7.5 14.8 7.5 C18.5 7.5 19 13.5 12 18 Z" />,
  <path key="m" d="M15.5 5.8 A6.6 6.6 0 1 0 15.5 18.2 A7.5 7.5 0 0 1 15.5 5.8 Z" />,
];

export function BallMark({ index }: { index: number }) {
  return (
    <svg className="topsy-mark" viewBox="0 0 24 24" aria-hidden="true">
      {MARKS[index % MARKS.length]}
    </svg>
  );
}

const ARROWS: Record<GravityDir, string> = { U: "▲", D: "▼", L: "◀", R: "▶", X: "↶", Y: "↺" };

/* ------------------------------------------------------------------ the board */

export interface TopsyBoardProps {
  board: TopsyBoardData;
  state: TopsyState;
  size?: number | undefined;
  /** The playable board: a ball arriving home drops into its cup (the effects kit). Still boards (intro, reveal, tile) play nothing. */
  live?: boolean;
  /** Reveal only: the balls not home and their holes are marked (a red ring), so what was missed shows at a glance. */
  missed?: boolean;
  /** The board was just cleared (or the round solved): the holes light in turn. */
  cleared?: boolean;
}

/** Roll time per square: every ball rolls at the same constant speed, so balls in a line keep their spacing. */
const ROLL_MS_PER_CELL = 45;
const ROLL_MIN_MS = 90;

/**
 * Each ball's roll time for its latest move (display only): squares travelled × ROLL_MS_PER_CELL, kept until the
 * ball moves again, so a re-render mid-roll never changes a running transition.
 */
function useRollDurations(board: TopsyBoardData, balls: readonly number[]): number[] {
  const last = useRef<{ cells: number[]; ms: number[] } | null>(null);
  const cells = balls.map((cell, i) => (cell === TOPSY_HOME ? board.holes[i]! : cell));
  const before = last.current;
  const ms = cells.map((cell, i) => {
    const from = before?.cells[i];
    if (from === undefined || from === cell) return before?.ms[i] ?? ROLL_MIN_MS;
    const squares = Math.abs((from % TOPSY_SIZE) - (cell % TOPSY_SIZE)) + Math.abs(Math.floor(from / TOPSY_SIZE) - Math.floor(cell / TOPSY_SIZE));
    return Math.max(ROLL_MIN_MS, squares * ROLL_MS_PER_CELL);
  });
  useEffect(() => {
    last.current = { cells, ms };
  });
  return ms;
}

/* ------------------------------------------------------------------ effects (stage 2, 15 Nov 2026) */

/*
 * The board's effects (presentation only; they observe what the stage's replay decided and never change it). Every
 * one moves only transform and opacity, through the effects kit (gameFx) or, for the tray's own art layers, the same
 * Web Animations call with the kit's variant (gameFxVariant): reduced motion is a 120 ms crossfade with no movement,
 * reduced effects a smaller, shorter one. They animate the tray's art layers (`[data-topsy-tilt]`, `[data-topsy-flip]`)
 * and the pieces (the sunk marble, the rings), never the board's measured grid (`[data-topsy-measure]`), the arena or
 * the stage, so no square, roll or control ever moves.
 */

/** The tray's lean on a tilt, in degrees (a real tilt; a tilt that moves nothing leans a third as far). */
export const TOPSY_LEAN_DEG = 6;
export const TOPSY_NUDGE_DEG = 2;
/** Longest a lean runs (the kit's cap for one physical action). */
export const TOPSY_LEAN_MAX_MS = 900;
/** The flip between boards: the cleared tray turns away, the next turns in. */
export const TOPSY_FLIP_OUT_MS = 240;
export const TOPSY_FLIP_IN_MS = 280;
const FADE_MS = 120;

const PERSPECTIVE = "perspective(700px)";
function leanTransform(dir: GravityDir, deg: number): string {
  const r = dir === "U" ? `rotateX(${deg}deg)` : dir === "D" ? `rotateX(${-deg}deg)` : dir === "L" ? `rotateY(${-deg}deg)` : `rotateY(${deg}deg)`;
  return `${PERSPECTIVE} ${r}`;
}

const playing = new WeakMap<Element, Animation>();
/** One Web Animation on a tray art layer or piece (transform and opacity frames only); a new one replaces it. */
function play(el: Element | null | undefined, frames: Keyframe[], options: KeyframeAnimationOptions): Animation | undefined {
  if (!el || typeof (el as HTMLElement).animate !== "function") return undefined;
  playing.get(el)?.cancel();
  try {
    const anim = (el as HTMLElement).animate(frames, options);
    playing.set(el, anim);
    return anim;
  } catch {
    return undefined;
  }
}

/**
 * A tilt leans the tray's art layer towards the tilt and holds it while the balls roll (`rollMs`, the longest roll),
 * then settles back; a tilt that moves nothing (`small`) only nods a third as far and back. Reduced motion: a real
 * tilt crossfades the tray (the balls jump), a dead one shows nothing (nothing changed). A new tilt replaces the lean.
 */
export function leanTopsyTray(el: Element | null | undefined, dir: GravityDir, { small = false, rollMs = 0 } = {}): Animation | undefined {
  if (dir !== "U" && dir !== "D" && dir !== "L" && dir !== "R") return undefined;
  const variant = gameFxVariant("slide");
  if (variant === "reduced") return small ? undefined : play(el, [{ opacity: 0.55 }, { opacity: 1 }], { duration: FADE_MS, easing: "linear" });
  const lite = variant === "lite";
  const deg = (small ? TOPSY_NUDGE_DEG : TOPSY_LEAN_DEG) * (lite ? 0.5 : 1);
  const rest = `${PERSPECTIVE} rotateX(0deg)`;
  if (small) {
    const ms = lite ? 120 : 180;
    return play(el, [{ transform: rest }, { transform: leanTransform(dir, deg), offset: 0.4 }, { transform: rest }], { duration: ms, easing: "ease-out" });
  }
  const ms = Math.min(TOPSY_LEAN_MAX_MS, Math.max(lite ? 200 : 260, rollMs + (lite ? 120 : 200)));
  const peak = Math.min(0.3, 90 / ms);
  const hold = Math.max(peak, Math.min(0.8, rollMs / ms));
  return play(
    el,
    [{ transform: rest }, { transform: leanTransform(dir, deg), offset: peak }, { transform: leanTransform(dir, deg), offset: hold }, { transform: rest }],
    { duration: ms, easing: "ease-out" },
  );
}

/** A cleared board's tray turns away (held hidden: the next board replaces it). Reduced motion: none (the next board fades in). */
export function flipTopsyTrayAway(el: Element | null | undefined): Animation | undefined {
  const variant = gameFxVariant("slide");
  if (variant === "reduced") return undefined;
  const ms = variant === "lite" ? 160 : TOPSY_FLIP_OUT_MS;
  return play(el, [{ transform: "perspective(900px) rotateY(0deg) scale(1)", opacity: 1 }, { transform: "perspective(900px) rotateY(80deg) scale(0.92)", opacity: 0 }], { duration: ms, easing: "ease-in", fill: "forwards" });
}

/** The next board's tray turns in after a cleared one. Reduced motion: a 120 ms crossfade. */
export function flipTopsyTrayIn(el: Element | null | undefined): Animation | undefined {
  const variant = gameFxVariant("slide");
  if (variant === "reduced") return play(el, [{ opacity: 0 }, { opacity: 1 }], { duration: FADE_MS, easing: "linear" });
  const ms = variant === "lite" ? 180 : TOPSY_FLIP_IN_MS;
  return play(el, [{ transform: "perspective(900px) rotateY(-80deg) scale(0.92)", opacity: 0 }, { transform: "perspective(900px) rotateY(0deg) scale(1)", opacity: 1 }], { duration: ms, easing: "ease-out", fill: "backwards" });
}

/**
 * A ball home drops into its cup when its roll ends: the sunk marble shows (an opacity step on its wrapper) and lands
 * with the kit's drop (silent: gravity.lock is the board's pip, timed by topsyTiltSounds). Reduced motion: it crossfades in.
 */
export function dropTopsyBallHome(wrap: Element | null | undefined, rollMs: number): void {
  if (!wrap) return;
  const reduced = gameFxVariant("drop") === "reduced";
  const delay = reduced ? 0 : rollMs;
  play(wrap, [{ opacity: 0 }, { opacity: 1 }], { duration: reduced ? FADE_MS : 90, delay, easing: "linear", fill: "backwards" });
  gameFx("drop", wrap.firstElementChild, { delayMs: delay, silent: true });
}

/** The board's measured grid and its art grid share one template, so the art always sits on the measured squares. */
const gridStyle = { gridTemplateColumns: `repeat(${TOPSY_SIZE}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${TOPSY_SIZE}, minmax(0, 1fr))` };

export function TopsyBoardView({ board, state, size, live = false, cleared = false, missed = false }: TopsyBoardProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const rollMs = useRollDurations(board, state.balls);
  const metrics = useGridMetrics(gridRef, TOPSY_SIZE, TOPSY_SIZE);
  const walls = useMemo(() => new Set(board.walls), [board.walls]);
  const ballSize = metrics ? Math.max(6, Math.min(metrics.cellW, metrics.cellH) * 0.8) : 0;

  // A ball arriving home (live board only): it drops into its cup as its roll ends. A board that mounts with balls
  // already home (a reload, the next board, a still board) plays nothing.
  const seen = useRef(state.balls);
  useLayoutEffect(() => {
    const before = seen.current;
    seen.current = state.balls;
    if (!live || before === state.balls) return;
    state.balls.forEach((cell, i) => {
      if (cell !== TOPSY_HOME || before[i] === TOPSY_HOME) return;
      dropTopsyBallHome(rootRef.current?.querySelector(`[data-topsy-hole="${i}"] [data-topsy-sunk]`), rollMs[i] ?? 0);
    });
  }, [state.balls, live]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={rootRef}
      className={`gravity-board grav-tray topsy-tray relative shrink-0${cleared ? " is-solving" : ""}`}
      data-topsy-board=""
      style={{ width: size ?? "100%", height: size ?? "auto", aspectRatio: "1 / 1", ["--grav-cols" as string]: TOPSY_SIZE }}
    >
      {/* The measure box: an empty grid in exactly the art grid's place. It never moves (the effects animate only the
          art layers below), so the squares useGridMetrics measures, and every ball's place, never change with a lean. */}
      <div className="topsy-measure" data-topsy-measure="" aria-hidden="true">
        <div ref={gridRef} className="topsy-grid grid h-full w-full" style={gridStyle} />
      </div>
      <div className="topsy-flip" data-topsy-flip="">
        <div className="topsy-tilt" data-topsy-tilt="">
          <div className="grav-well">
            <div className="puzzle-board grav-grid topsy-grid grid h-full w-full" style={gridStyle}>
              {Array.from({ length: TOPSY_SIZE * TOPSY_SIZE }, (_, cell) => {
                if (walls.has(cell)) return <div key={cell} className="grav-block" />;
                const hole = board.holes.indexOf(cell);
                const star = board.stars.indexOf(cell);
                return (
                  <div key={cell} className="grav-floor">
                    {hole >= 0 ? (
                      <span
                        aria-label={state.balls[hole] === TOPSY_HOME ? "Ball home" : "Hole"}
                        className={`grav-socket topsy-hole${state.balls[hole] === TOPSY_HOME ? " is-locked is-home" : missed ? " is-missed" : ""}`}
                        data-topsy-hole={hole}
                        data-missed={missed && state.balls[hole] !== TOPSY_HOME ? "" : undefined}
                        style={{ ["--ball" as string]: TOPSY_COLOURS[hole], ["--order" as string]: hole }}
                      >
                        <TopsyCup index={hole} />
                        {state.balls[hole] === TOPSY_HOME ? (
                          <span className="topsy-sunk-wrap" data-topsy-sunk="">
                            <TopsyMarble index={hole} className="topsy-marble topsy-sunk" />
                          </span>
                        ) : null}
                        <BallMark index={hole} />
                      </span>
                    ) : null}
                    {star >= 0 ? <span aria-label="Star" className={`topsy-star${state.starMask & (1 << star) ? " is-taken" : ""}`} /> : null}
                  </div>
                );
              })}
            </div>
            {metrics
              ? state.balls.map((cell, index) => {
                  const home = cell === TOPSY_HOME;
                  const centre = gridCellCentre(metrics, home ? board.holes[index]! : cell, TOPSY_SIZE);
                  return (
                    <span
                      key={index}
                      aria-hidden="true"
                      className={`grav-ball topsy-ball${home ? " is-home" : missed ? " is-missed" : ""}`}
                      data-ball={index}
                      style={{
                        width: ballSize,
                        height: ballSize,
                        transform: `translate(${centre.x - ballSize / 2}px, ${centre.y - ballSize / 2}px)`,
                        ["--ball" as string]: TOPSY_COLOURS[index],
                        ["--order" as string]: index,
                        ["--roll-ms" as string]: `${rollMs[index]}ms`,
                      }}
                    >
                      <TopsyMarble index={index} />
                      <BallMark index={index} />
                    </span>
                  );
                })
              : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** One ring per ball, in its colour; filled once that ball is home. */
export function TopsyRings({ state, label }: { state: TopsyState; label?: string }) {
  return (
    <div className="topsy-rings" data-topsy-rings="" aria-label={label ?? `${state.balls.filter((b) => b === TOPSY_HOME).length} of ${state.balls.length} balls home`}>
      {state.balls.map((cell, index) => (
        <span key={index} data-topsy-ring={index} className={`topsy-ring${cell === TOPSY_HOME ? " is-home" : ""}`} style={{ ["--ball" as string]: TOPSY_COLOURS[index] }}>
          <BallMark index={index} />
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ sounds of a tilt */

/** The rumble's loop volume (gravity.tilt, a loop slot): quiet, under the clicks and pips. */
const RUMBLE_VOLUME = 0.42;
let rumbleStop: ReturnType<typeof setTimeout> | null = null;

/** Starts (or keeps) the roll's rumble and stops it `ms` from now, with a short fade. */
function playTopsyRumble(ms: number): void {
  if (rumbleStop) clearTimeout(rumbleStop);
  if (cueHasFile("gravity.tilt")) ensureLoop("gravity.tilt", RUMBLE_VOLUME, 30);
  // Until the loop has decoded: the library's one-shot marble roll (ensureLoop has asked for the file).
  else playSound("arc_marble_roll", 0.6);
  rumbleStop = setTimeout(() => stopTopsyRumble(), Math.max(60, ms - 60));
}

export function stopTopsyRumble(): void {
  if (rumbleStop) clearTimeout(rumbleStop);
  rumbleStop = null;
  stopLoop("gravity.tilt", 90);
}

/** A ball's roll time on the board (the same rule as useRollDurations: squares × ROLL_MS_PER_CELL). */
function rollTimeMs(path: readonly number[]): number {
  return Math.max(ROLL_MIN_MS, (path.length - 1) * ROLL_MS_PER_CELL);
}

/**
 * The sounds of one tilt that moved something, timed on the roll the board draws (display only): the rumble while any
 * ball moves (`gravity.tilt`), a click as each ball comes to rest (`gravity.stop`), a bright pip as each drops home
 * (`gravity.lock`; two or more in the tilt add `gravity.combo`), then the board-cleared sound (`gravity.boardClear`)
 * or, when the tilt used the board's last one, the closing clunk (`gravity.outOfTilts`). Returns the timers.
 */
export function topsyTiltSounds(out: TopsyTilt, boardCleared: boolean, outOfTilts: boolean): ReturnType<typeof setTimeout>[] {
  const timers: ReturnType<typeof setTimeout>[] = [];
  const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
  const moving = out.paths.filter((p) => p.length > 1);
  const longest = Math.max(0, ...moving.map(rollTimeMs));
  playTopsyRumble(longest);
  const dropped = new Set(out.dropped);
  out.paths.forEach((path, ball) => {
    if (path.length < 2) return;
    if (dropped.has(ball)) at(rollTimeMs(path), () => soundCue("gravity.lock"));
    else at(rollTimeMs(path), () => soundCue("gravity.stop"));
  });
  if (out.dropped.length >= 2) at(Math.max(...out.dropped.map((b) => rollTimeMs(out.paths[b]!))) + 60, () => soundCue("gravity.combo"));
  if (boardCleared) at(longest + 220, () => soundCue("gravity.boardClear"));
  else if (outOfTilts) at(longest + 120, () => soundCue("gravity.outOfTilts"));
  return timers;
}

/* ------------------------------------------------------------------ the live stage */

/** "Out of tilts" over the board while it holds: it lands with the kit's drop (silent: gravity.outOfTilts is the clunk). */
function OutOfTiltsBanner() {
  const ref = useRef<HTMLSpanElement | null>(null);
  useGameFxOnce("drop", ref, true, { silent: true, inGame: true });
  return (
    <span ref={ref} className="topsy-banner" data-topsy-banner="">
      Out of tilts
    </span>
  );
}

/** The ring row's height and its gap to the board. */
const TOPSY_HEAD_PX = 32;

/** How long a finished board stays up (cleared or out of tilts) before the next one shows. */
const BOARD_HOLD_MS = 900;
const BOARD_HOLD_REDUCED_MS = 500;

function currentBoardState(puzzle: GravityPuzzleData & { boards: TopsyBoardData[] }, replay: TopsyReplay, index: number): TopsyState {
  const result = replay.boards[index];
  return result ? result.state : topsyStart(puzzle.boards[index]!);
}

export function TopsyStage({ puzzle, locked, onSubmit, onDraftAnswer, phaseStartedAt, now, stateKey = "gravity" }: PuzzleStageProps) {
  const data = puzzle as GravityPuzzleData & { boards: TopsyBoardData[] };
  const [tilts, setTilts] = useStageState<GravityDir[]>(stateKey, "topsyTilts", () => []);
  const submitted = useRef(false);
  const reduced = usePrefersReducedMotion();
  const boardSpaceRef = useRef<HTMLDivElement | null>(null);
  const boardSpace = useGridMetrics(boardSpaceRef, 1, 1);

  const replay = useMemo(() => replayTopsyPuzzle(data, tilts), [data, tilts]);
  const limits = data.tiltLimits ?? [];
  // The difficulty levels (16 Nov 2026): the round's own board and ball counts (Easy: two boards of three balls).
  const boardCount = data.boards.length;
  const totalBalls = topsyTotalBalls(data);

  // A finished board stays up for a moment (display only): the board shown lags the replay's current one.
  const [shown, setShown] = useState(() => Math.min(replay.current, boardCount - 1));
  const holding = shown < Math.min(replay.current, boardCount - 1);
  const current = replay.current;
  // A cleared board's tray flips away at the end of its hold and the next one turns in (display only: the hold, and
  // the input it blocks, are the same with or without the flip; flipTopsyTrayAway / flipTopsyTrayIn).
  const flipIn = useRef(false);
  const clearedShown = Boolean(replay.boards[shown]?.cleared);
  useEffect(() => {
    const target = Math.min(current, boardCount - 1);
    if (shown >= target) return;
    const hold = reduced ? BOARD_HOLD_REDUCED_MS : BOARD_HOLD_MS;
    const away = clearedShown ? setTimeout(() => flipTopsyTrayAway(boardSpaceRef.current?.querySelector("[data-topsy-flip]")), hold - TOPSY_FLIP_OUT_MS) : null;
    const timer = setTimeout(() => {
      flipIn.current = clearedShown;
      setShown(target);
    }, hold);
    return () => {
      clearTimeout(timer);
      if (away) clearTimeout(away);
    };
  }, [current, shown, reduced, clearedShown]);
  useLayoutEffect(() => {
    if (!flipIn.current) return;
    flipIn.current = false;
    flipTopsyTrayIn(boardSpaceRef.current?.querySelector("[data-topsy-flip]"));
  }, [shown]);

  const board = data.boards[shown]!;
  const state = currentBoardState(data, replay, shown);
  const boardResult = replay.boards[shown];
  const boardDone = Boolean(boardResult && (boardResult.cleared || boardResult.outOfTilts));
  const tiltsHere = boardResult?.tilts ?? 0;
  const limitHere = limits[shown] ?? 0;
  const over = replay.over;

  // Sounds (the Pattern overhaul, 15 Nov 2026): every sound of a tilt is timed from the press, on the board's own roll
  // (topsyTiltSounds): the rumble while balls move, a click as each stops, a pip as each drops home (a combo for two or
  // more), the board-cleared sound, the closing clunk when the board runs out of tilts. Stars (older stamps) tick here.
  const seenStars = useRef(replay.stars);
  useEffect(() => {
    if (replay.stars > seenStars.current) playTick(0.8);
    seenStars.current = replay.stars;
  }, [replay.stars]);
  const soundTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(
    () => () => {
      for (const t of soundTimers.current) clearTimeout(t);
      stopTopsyRumble();
    },
    [],
  );

  useEffect(() => {
    onDraftAnswer?.(encodeGravityTilts(tilts));
  }, [tilts, onDraftAnswer]);

  // The round goes in when every board is done (cleared or out of tilts), or just before the buzzer.
  useEffect(() => {
    if (locked || submitted.current || !over) return;
    submitted.current = true;
    onSubmit(encodeGravityTilts(tilts));
  }, [over, tilts, locked, onSubmit]);
  useEffect(() => {
    if (locked || submitted.current) return;
    if (now < phaseStartedAt + (data.timeLimitMs ?? 120_000) - 400) return;
    submitted.current = true;
    onSubmit(encodeGravityTilts(tilts));
  }, [now, phaseStartedAt, locked, data.timeLimitMs, tilts, onSubmit]);

  const solving = useSolveMoment(replay.solved, "gravity.solve");
  const inFrame = useFrameProgress(Math.min(shown + 1, boardCount), boardCount, "", `Board ${Math.min(shown + 1, boardCount)} of ${boardCount}`);

  const blocked = locked || submitted.current || over || holding || boardDone;
  const undo = () => !blocked && tiltsHere > 0 && setTilts((current) => [...current, "X"]);
  const reset = () => !blocked && tiltsHere > 0 && setTilts((current) => [...current, "Y"]);

  useGameKeys((kind, key, event) => {
    const used = key === "z" || key === "Backspace" || key === "r";
    if (!used || kind !== "down" || event.repeat) return used;
    if (key === "r") reset();
    else undo();
    return true;
  });

  const press = (dir: GravityDir) => {
    if (blocked) return;
    const index = replay.current;
    const playing = data.boards[index];
    if (!playing) return;
    const out = topsyTilt(playing, new Set(playing.walls), currentBoardState(data, replay, index), dir);
    const tray = boardSpaceRef.current?.querySelector("[data-topsy-tilt]");
    // A tilt that moves nothing: a small lean and nothing else (no sound, no draft; the server never counted it).
    if (!out.moved) {
      leanTopsyTray(tray, dir, { small: true });
      return;
    }
    // The tray leans while the balls roll (the board's own roll times); two or more home in one tilt pop their rings
    // as a combo once the last has dropped (kit combo, silent: gravity.combo is topsyTiltSounds').
    const longest = Math.max(0, ...out.paths.filter((path) => path.length > 1).map(rollTimeMs));
    leanTopsyTray(tray, dir, { rollMs: longest });
    if (out.dropped.length >= 2) {
      const rings = boardSpaceRef.current?.querySelectorAll("[data-topsy-ring]");
      const at = reduced ? 0 : Math.max(...out.dropped.map((b) => rollTimeMs(out.paths[b]!))) + 60;
      for (const b of out.dropped) gameFx("combo", rings?.[b], { count: out.dropped.length, silent: true, delayMs: at });
    }
    const next = [...tilts, dir];
    const nextReplay = replayTopsyPuzzle(data, next);
    const after = nextReplay.boards[index];
    // The solving tilt's last sound is the solve's own (useSolveMoment's gravity.solve), not the board-cleared one.
    for (const t of topsyTiltSounds(out, Boolean(after?.cleared) && !nextReplay.solved, Boolean(after?.outOfTilts))) soundTimers.current.push(t);
    soundTimers.current = soundTimers.current.slice(-64);
    setTilts(next);
  };

  const starsHere = board.stars.filter((_, i) => state.starMask & (1 << i)).length;
  const noStars = usesParMoves(data);
  const tiltText = limitHere ? `${tiltsHere} / ${limitHere}` : `${tiltsHere}`;
  const outOfTilts = Boolean(boardResult?.outOfTilts);
  const par = shownPar(data);
  const boardPar = topsyBoardPar(data, shown);

  return (
    <div data-stage-column="2" data-polish="gravity" data-topsy="" className="flex min-h-0 flex-1 flex-col gap-2">
      <div ref={boardSpaceRef} data-game-arena="board" className="topsy-arena flex min-h-0 flex-1 flex-col items-center justify-center">
        {/* The ring row sits just above the board (its 24 px row + 8 px gap come off the board's square). */}
        <div className="topsy-head" data-topsy-head="">
          <TopsyRings state={state} />
          {inFrame ? null : (
            <span className="topsy-head-count">
              Board {Math.min(shown + 1, boardCount)}/{boardCount} · tilts {tiltText}
            </span>
          )}
        </div>
        {boardSpace ? (
          <TopsyBoardView
            key={shown}
            board={board}
            state={state}
            live
            cleared={solving || Boolean(boardResult?.cleared)}
            size={Math.max(0, Math.floor(Math.min(boardSpace.width, boardSpace.height - TOPSY_HEAD_PX)))}
          />
        ) : null}
        {outOfTilts ? <OutOfTiltsBanner /> : null}
      </div>
      {/* Puzzle polish (3 Nov 2026): the summary as pills. On a stamp that shows its par (parMoves.ts `shownPar`):
          "Moves n" (every tilt made on every board, as the server counts them), "Par p", the balls home and the
          board's tilts left (red from five; the move-limit counter, `limit`). */}
      <FramePills
        testId="gravity"
        items={boardPar !== null
          ? [
              // gravityRev 8 (the Pattern overhaul): the board's own tilts (undone ones given back) against its par.
              ...parPills("Tilts", tiltsHere, boardPar),
              { id: "home", label: "Home", value: `${replay.home} / ${totalBalls}` },
              limitHere ? { id: "left", label: "Left", value: Math.max(0, limitHere - tiltsHere), limit: limitHere, ...(limitHere - tiltsHere <= 3 ? { tone: "warn" as const } : {}) } : null,
            ]
          : par !== null
          ? [
              ...parPills("Tilts", replay.tilts, par),
              { id: "home", label: "Home", value: `${replay.home} / ${totalBalls}` },
              limitHere ? { id: "left", label: "Left", value: Math.max(0, limitHere - tiltsHere), limit: limitHere, ...(limitHere - tiltsHere <= 5 ? { tone: "warn" as const } : {}) } : null,
            ]
          : [
              { id: "tilts", label: "Tilts", value: tiltText, ...(limitHere ? { limit: limitHere } : {}), ...(outOfTilts ? { tone: "warn" as const } : {}) },
              // gravityRev 6 (the puzzle batch of 3 Nov 2026, parMoves.ts): no stars, so no star count.
              noStars ? null : { id: "stars", label: "Stars", value: `${starsHere} / ${TOPSY_STARS}` },
              { id: "home", label: "Home", value: `${replay.home} / ${totalBalls}` },
            ]}
      />
      <div data-game-controls="pad" className="flex shrink-0 flex-col items-center gap-3">
        <ArrowPad modeSwitch={false} onPress={press} disabled={blocked} />
        <div data-game-controls="actions" className="flex gap-3 px-2">
          <Button
            type="button"
            variant="outline"
            disabled={blocked || tiltsHere === 0}
            onClick={undo}
            className="h-11 min-w-11 rounded-xl px-4 font-mono text-xs uppercase tracking-widest text-muted-foreground"
          >
            Undo
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={blocked || tiltsHere === 0}
            onClick={reset}
            className="h-11 min-w-11 rounded-xl px-4 font-mono text-xs uppercase tracking-widest text-muted-foreground"
          >
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ reveal */

/** One board's line in the reveal: how the player left it. */
export type TopsyBoardOutcome = "cleared" | "outOfTilts" | "unfinished" | "notReached";

export interface TopsyRevealBoard {
  /** The player's final state on the board (the start if never reached). */
  state: TopsyState;
  outcome: TopsyBoardOutcome;
  /** The player's tilts on the board (the stored grade's `boardTilts` where it has them). */
  tilts: number;
  /** The board's fewest tilts (the stored minimum; null where the reveal doesn't know it). */
  par: number | null;
  /** The shortest route, letters U / D / L / R (the stored solution's; empty where none is stored). */
  route: string;
  home: number;
}

/**
 * Each board as the reveal shows it (the Pattern overhaul's reveal, 15 Nov 2026): the player's own final board, how it
 * ended, their tilts against the board's par, and the par route. Tilts come from the stored grade (`boardTilts`) where
 * it holds them, so the figures shown are the server's; the replay supplies the boards themselves.
 */
export function topsyRevealBoards(data: GravityPuzzleData & { boards: TopsyBoardData[] }, answer: string, extra?: Record<string, unknown> | null): TopsyRevealBoard[] {
  const replay = replayTopsyPuzzle(data, decodeGravityTilts(answer));
  const stored = Array.isArray(extra?.["boardTilts"]) ? (extra!["boardTilts"] as unknown[]) : null;
  return data.boards.map((board, i) => {
    const result = replay.boards[i];
    const state = result ? result.state : topsyStart(board);
    const outcome: TopsyBoardOutcome = !result ? "notReached" : result.cleared ? "cleared" : result.outOfTilts ? "outOfTilts" : "unfinished";
    const s = stored?.[i];
    return {
      state,
      outcome,
      tilts: typeof s === "number" && Number.isFinite(s) ? s : (result?.tilts ?? 0),
      par: typeof data.boardMins?.[i] === "number" ? data.boardMins[i]! : null,
      route: data.boardSolutions?.[i] ?? "",
      home: topsyHomeCount(state),
    };
  });
}

const OUTCOME_TEXT: Record<TopsyBoardOutcome, string> = {
  cleared: "Cleared",
  outOfTilts: "Out of tilts",
  unfinished: "Not finished",
  notReached: "Not reached",
};

/** The par route as small arrow chips (one a tilt). */
export function TopsyRouteChips({ route }: { route: string }) {
  if (!route) return null;
  return (
    <div className="topsy-route-chips" data-topsy-route="" data-long={route.length > 7 ? "" : undefined} aria-label={`Par route: ${route.length} tilts`}>
      <span className="topsy-route-label">Par route</span>
      {route.split("").map((d, i) => (
        <span key={i} className="topsy-chip" data-dir={d}>
          {ARROWS[d as GravityDir] ?? d}
        </span>
      ))}
    </div>
  );
}

export function TopsyReveal({ puzzle, myAnswer, myCorrect, myMsRemaining, myExtra }: PuzzleRevealProps) {
  const data = puzzle as GravityPuzzleData & { boards: TopsyBoardData[] };
  const boards = useMemo(() => topsyRevealBoards(data, myAnswer ?? "", myExtra), [data, myAnswer, myExtra]);
  // The board opened first: where the player stopped (the first not cleared), else the first.
  const firstOpen = Math.max(0, boards.findIndex((b) => b.outcome !== "cleared"));
  const [pick, setPick] = useState(firstOpen);
  const index = Math.min(pick, boards.length - 1);
  const b = boards[index]!;
  const noStars = usesParMoves(data);
  // The round's totals, from the stored grade where it has them (the replay otherwise, for stored rounds without them).
  const num = (k: string) => (typeof myExtra?.[k] === "number" ? (myExtra[k] as number) : null);
  const cleared = num("cleared") ?? boards.filter((x) => x.outcome === "cleared").length;
  const home = num("home") ?? boards.reduce((n, x) => n + x.home, 0);
  const tilts = num("tilts") ?? boards.reduce((n, x) => n + x.tilts, 0);
  const par = num("parTilts") ?? (data.boardMins ? data.boardMins.reduce((n, m) => n + m, 0) : null);
  const total = data.boards.reduce((n, x) => n + x.starts.length, 0);
  const ballsHere = data.boards[index]!.starts.length;
  const secondsLeft = myCorrect && typeof myMsRemaining === "number" ? Math.max(0, Math.round(myMsRemaining / 1000)) : null;
  const starsTaken = starCount(b.state.starMask);
  // A solved round's result lands with the kit's win (silent: the round already played gravity.solve).
  const result = useRef<HTMLDivElement | null>(null);
  useGameFxOnce("win", result, Boolean(myCorrect), { silent: true });
  return (
    <div className="grav-reveal topsy-reveal flex min-h-0 w-full flex-1 flex-col items-center gap-2" data-topsy-reveal="">
      {/* One board at a time, large, with a switcher (Joe's reveal rules, 15 Nov 2026). */}
      <div className="topsy-board-tabs" role="tablist" aria-label="Board shown">
        {boards.map((x, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === index}
            data-outcome={x.outcome}
            className="topsy-board-tab"
            onClick={() => setPick(i)}
          >
            Board {i + 1}
          </button>
        ))}
      </div>
      {/* Joe's fix (stage 2, 15 Nov 2026): the line and its pills are the board chosen above, all of them (its outcome,
          your tilts on it, its par, its balls home), so they can never contradict; the round's totals sit apart under
          "Round". Each board's tilts are the stored grade's `boardTilts`, its home count the grader's own replay. */}
      <div ref={result} className="topsy-board-sum" data-topsy-board-sum="" data-board={index + 1}>
        <p className="topsy-board-line">
          Board {index + 1} · <span data-outcome={b.outcome}>{OUTCOME_TEXT[b.outcome]}</span>
        </p>
        <div className="topsy-key-pills" data-own-count="" data-topsy-board-pills="">
          <span className="topsy-key" data-key="tilts"><span>Tilts</span> <b>{b.tilts}</b></span>
          {b.par !== null ? <span className="topsy-key" data-key="par"><span>Par</span> <b>{b.par}</b></span> : null}
          <span className="topsy-key" data-key="home"><span>Home</span> <b>{b.home} of {ballsHere}</b></span>
          {noStars ? null : <span className="topsy-key" data-key="stars"><span>Stars</span> <b>{starsTaken} of {data.boards[index]!.stars.length}</b></span>}
        </div>
      </div>
      <div className="grav-reveal-space">
        <div className="grav-reveal-square" data-reveal-board="">
          <TopsyBoardView key={index} board={data.boards[index]!} state={b.state} missed={b.outcome !== "cleared"} />
        </div>
      </div>
      <TopsyRouteChips route={b.route} />
      {/* The round's totals, the player's own, from the stored grade, under their own "Round" label. Joe's stage-2 answer
          (16 Nov 2026): the label above and the pills on one line at 375 and 390 px, with shorter labels ("Boards 3/3",
          "Left 50 s"), never under 11 px. */}
      <div className="topsy-round" data-own-count="" data-topsy-keys="">
        <span className="topsy-round-label">Round</span>
        <div className="topsy-round-pills" data-topsy-round-pills="">
          <span className="topsy-key" data-key="boards" aria-label={`Boards cleared: ${cleared} of ${data.boards.length}`}><span>Boards</span> <b>{cleared}/{data.boards.length}</b></span>
          <span className="topsy-key" data-key="home" aria-label={`Balls home: ${home} of ${total}`}><span>Home</span> <b>{home}/{total}</b></span>
          <span className="topsy-key" data-key="tilts"><span>Tilts</span> <b>{tilts}</b></span>
          {par !== null ? <span className="topsy-key" data-key="par"><span>Par</span> <b>{par}</b></span> : null}
          {secondsLeft !== null ? <span className="topsy-key" data-key="time" aria-label={`Time left: ${secondsLeft} seconds`}><span>Left</span> <b>{secondsLeft} s</b></span> : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ intro still */

/**
 * A fixed board (never randomised): one tilt right rolls five balls home. No stars since gravityRev 6 (the puzzle
 * batch of 3 Nov 2026), which deals none.
 */
const INTRO_BOARD: TopsyBoardData = {
  walls: [5, 26, 44, 57, 63, 78, 81],
  starts: [10, 31, 52, 3, 70, 86],
  holes: [17, 36, 55, 33, 75, 89],
  stars: [],
};
const INTRO_AFTER: TopsyState = topsyTilt(INTRO_BOARD, new Set(INTRO_BOARD.walls), topsyStart(INTRO_BOARD), "R").state;

export function TopsyIntroExample() {
  const before = topsyStart(INTRO_BOARD);
  return (
    <div className="flex flex-col items-center gap-2" data-topsy-intro="">
      <div className="flex items-center gap-3">
        <div style={{ width: 150 } as CSSProperties}>
          <TopsyBoardView board={INTRO_BOARD} state={before} size={150} />
        </div>
        <span className="font-mono text-xs text-muted-foreground">▶</span>
        <div style={{ width: 150 } as CSSProperties}>
          <TopsyBoardView board={INTRO_BOARD} state={INTRO_AFTER} size={150} />
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        One tilt right: five balls roll over their own holes and drop in.
      </p>
    </div>
  );
}

/** For checks: the intro still's board and the state after its tilt. */
export const TOPSY_INTRO = { board: INTRO_BOARD, after: INTRO_AFTER, tilt: "R" as GravityDir };
