/**
 * Topsy-Turvy gravityRev 3 (the remodel; topsy.ts, docs/depth/d5-remodels.md): the board, the ring row,
 * the live stage, the reveal and the intro still. The tray, blocks, felt and shaded balls keep the polished
 * Topsy-Turvy look (polish-pattern/gravity.css, batch P); holes, stars, home drops and the rings are new
 * (topsy.css). The board animates what replayTopsy decided and never decides anything itself.
 */
import { shownPar, usesParMoves } from "@/lib/duel/parMoves";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { ArrowPad, gridCellCentre, useGridMetrics, usePrefersReducedMotion } from "@/components/puzzles/GridDrag";
import { useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import { FramePills, parPills } from "@/components/puzzles/pattern/framePills";
import { TopsyCup, TopsyMarble } from "@/components/puzzles/pattern/topsyArt";
import { Button } from "@/components/ui/button";
import { useGameKeys } from "@/lib/desktop";
import { decodeGravityTilts, encodeGravityTilts } from "@/lib/duel/gravity";
import { useStageState } from "@/lib/duel/stageState";
import {
  TOPSY_BALLS,
  TOPSY_BOARDS,
  TOPSY_HOME,
  TOPSY_SIZE,
  TOPSY_STARS,
  replayTopsyPuzzle,
  starCount,
  topsyBoardPar,
  topsyHomeCount,
  topsyStart,
  topsyTilt,
  type TopsyBoard as TopsyBoardData,
  type TopsyReplay,
  type TopsyState,
  type TopsyTilt,
} from "@/lib/duel/topsy";
import type { GravityDir, GravityPuzzleData } from "@/lib/duel/types";
import { soundCue, useSolveMoment } from "@/lib/fx/patternFx";
import { cueHasFile, ensureLoop, playSound, playTick, stopLoop } from "@/lib/sound";
import type { PuzzleRevealProps, PuzzleStageProps } from "@/puzzles/types";

import "@/polish-pattern/topsy.css";

/**
 * Six ball colours, each with its own mark (dot, triangle, square, diamond, cross, bar) drawn on the ball and in
 * its hole, so a colour is never the only way to tell two balls apart.
 */
export const TOPSY_COLOURS = ["#F5C542", "#2FD4C4", "#A97BFF", "#FF5FA2", "#4F8BFF", "#FF8A3D"] as const;
const MARKS = [
  <circle key="m" cx="12" cy="12" r="4.2" />,
  <path key="m" d="M12 6.5 L17.5 16.5 H6.5 Z" />,
  <rect key="m" x="7.5" y="7.5" width="9" height="9" rx="1" />,
  <path key="m" d="M12 5.5 L18.5 12 L12 18.5 L5.5 12 Z" />,
  <path key="m" d="M10.2 6h3.6v4.2H18v3.6h-4.2V18h-3.6v-4.2H6v-3.6h4.2z" />,
  <rect key="m" x="5.5" y="10" width="13" height="4" rx="1" />,
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
  lean?: GravityDir | null;
  /** The lean is a tilt that moves nothing: a smaller lean (topsy.css), the board otherwise unchanged. */
  nudge?: boolean;
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

export function TopsyBoardView({ board, state, size, lean, nudge = false, cleared = false, missed = false }: TopsyBoardProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const rollMs = useRollDurations(board, state.balls);
  const metrics = useGridMetrics(gridRef, TOPSY_SIZE, TOPSY_SIZE);
  const walls = useMemo(() => new Set(board.walls), [board.walls]);
  const ballSize = metrics ? Math.max(6, Math.min(metrics.cellW, metrics.cellH) * 0.8) : 0;
  const leanName = lean === "U" || lean === "D" || lean === "L" || lean === "R" ? lean : "none";

  return (
    <div
      className={`gravity-board grav-tray topsy-tray relative shrink-0${cleared ? " is-solving" : ""}`}
      data-lean={leanName}
      data-nudge={nudge && leanName !== "none" ? "" : undefined}
      data-topsy-board=""
      style={{ width: size ?? "100%", height: size ?? "auto", aspectRatio: "1 / 1", ["--grav-cols" as string]: TOPSY_SIZE }}
    >
      <div className="grav-well">
        <div
          ref={gridRef}
          className="puzzle-board grav-grid topsy-grid grid h-full w-full"
          style={{ gridTemplateColumns: `repeat(${TOPSY_SIZE}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${TOPSY_SIZE}, minmax(0, 1fr))` }}
        >
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
                    data-missed={missed && state.balls[hole] !== TOPSY_HOME ? "" : undefined}
                    style={{ ["--ball" as string]: TOPSY_COLOURS[hole], ["--order" as string]: hole }}
                  >
                    <TopsyCup index={hole} />
                    {state.balls[hole] === TOPSY_HOME ? <TopsyMarble index={hole} className="topsy-marble topsy-sunk" /> : null}
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
  );
}

/** One ring per ball, in its colour; filled once that ball is home. */
export function TopsyRings({ state, label }: { state: TopsyState; label?: string }) {
  return (
    <div className="topsy-rings" data-topsy-rings="" aria-label={label ?? `${state.balls.filter((b) => b === TOPSY_HOME).length} of ${TOPSY_BALLS} balls home`}>
      {state.balls.map((cell, index) => (
        <span key={index} className={`topsy-ring${cell === TOPSY_HOME ? " is-home" : ""}`} style={{ ["--ball" as string]: TOPSY_COLOURS[index] }}>
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
  const [lean, setLean] = useState<GravityDir | null>(null);
  const [nudge, setNudge] = useState(false);
  const submitted = useRef(false);
  const reduced = usePrefersReducedMotion();
  const boardSpaceRef = useRef<HTMLDivElement | null>(null);
  const boardSpace = useGridMetrics(boardSpaceRef, 1, 1);

  const replay = useMemo(() => replayTopsyPuzzle(data, tilts), [data, tilts]);
  const limits = data.tiltLimits ?? [];

  // A finished board stays up for a moment (display only): the board shown lags the replay's current one.
  const [shown, setShown] = useState(() => Math.min(replay.current, TOPSY_BOARDS - 1));
  const holding = shown < Math.min(replay.current, TOPSY_BOARDS - 1);
  const current = replay.current;
  useEffect(() => {
    const target = Math.min(current, TOPSY_BOARDS - 1);
    if (shown >= target) return;
    const timer = setTimeout(() => setShown(target), reduced ? BOARD_HOLD_REDUCED_MS : BOARD_HOLD_MS);
    return () => clearTimeout(timer);
  }, [current, shown, reduced]);

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
  const inFrame = useFrameProgress(Math.min(shown + 1, TOPSY_BOARDS), TOPSY_BOARDS, "", `Board ${Math.min(shown + 1, TOPSY_BOARDS)} of ${TOPSY_BOARDS}`);

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

  const leanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (leanTimer.current) clearTimeout(leanTimer.current);
  }, []);
  const press = (dir: GravityDir) => {
    if (blocked) return;
    const index = replay.current;
    const playing = data.boards[index];
    if (!playing) return;
    const out = topsyTilt(playing, new Set(playing.walls), currentBoardState(data, replay, index), dir);
    if (leanTimer.current) clearTimeout(leanTimer.current);
    setLean(dir);
    // A tilt that moves nothing: a small lean and nothing else (no sound, no draft; the server never counted it).
    setNudge(!out.moved);
    leanTimer.current = setTimeout(() => setLean(null), out.moved ? 200 : 140);
    if (!out.moved) return;
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
              Board {Math.min(shown + 1, TOPSY_BOARDS)}/{TOPSY_BOARDS} · tilts {tiltText}
            </span>
          )}
        </div>
        {boardSpace ? (
          <TopsyBoardView
            key={shown}
            board={board}
            state={state}
            lean={lean}
            nudge={nudge}
            cleared={solving || Boolean(boardResult?.cleared)}
            size={Math.max(0, Math.floor(Math.min(boardSpace.width, boardSpace.height - TOPSY_HEAD_PX)))}
          />
        ) : null}
        {outOfTilts ? <span className="topsy-banner" data-topsy-banner="">Out of tilts</span> : null}
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
              { id: "home", label: "Home", value: `${replay.home} / ${TOPSY_BALLS * TOPSY_BOARDS}` },
              limitHere ? { id: "left", label: "Left", value: Math.max(0, limitHere - tiltsHere), limit: limitHere, ...(limitHere - tiltsHere <= 3 ? { tone: "warn" as const } : {}) } : null,
            ]
          : par !== null
          ? [
              ...parPills("Tilts", replay.tilts, par),
              { id: "home", label: "Home", value: `${replay.home} / ${TOPSY_BALLS * TOPSY_BOARDS}` },
              limitHere ? { id: "left", label: "Left", value: Math.max(0, limitHere - tiltsHere), limit: limitHere, ...(limitHere - tiltsHere <= 5 ? { tone: "warn" as const } : {}) } : null,
            ]
          : [
              { id: "tilts", label: "Tilts", value: tiltText, ...(limitHere ? { limit: limitHere } : {}), ...(outOfTilts ? { tone: "warn" as const } : {}) },
              // gravityRev 6 (the puzzle batch of 3 Nov 2026, parMoves.ts): no stars, so no star count.
              noStars ? null : { id: "stars", label: "Stars", value: `${starsHere} / ${TOPSY_STARS}` },
              { id: "home", label: "Home", value: `${replay.home} / ${TOPSY_BALLS * TOPSY_BOARDS}` },
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
    <div className="topsy-route-chips" data-topsy-route="" aria-label={`Par route: ${route.length} tilts`}>
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
  // The key numbers, from the stored grade where it has them (the replay otherwise, for stored rounds without them).
  const num = (k: string) => (typeof myExtra?.[k] === "number" ? (myExtra[k] as number) : null);
  const cleared = num("cleared") ?? boards.filter((x) => x.outcome === "cleared").length;
  const home = num("home") ?? boards.reduce((n, x) => n + x.home, 0);
  const tilts = num("tilts") ?? boards.reduce((n, x) => n + x.tilts, 0);
  const par = num("parTilts") ?? (data.boardMins ? data.boardMins.reduce((n, m) => n + m, 0) : null);
  const total = data.boards.reduce((n, x) => n + x.starts.length, 0);
  const secondsLeft = myCorrect && typeof myMsRemaining === "number" ? Math.max(0, Math.round(myMsRemaining / 1000)) : null;
  const starsTaken = starCount(b.state.starMask);
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
      <p className="topsy-board-line" data-own-count="">
        <span data-outcome={b.outcome}>{OUTCOME_TEXT[b.outcome]}</span>
        {" · "}
        You {b.tilts} {b.tilts === 1 ? "tilt" : "tilts"}
        {b.par !== null ? ` · Par ${b.par}` : ""}
        {" · "}
        {b.home} of {data.boards[index]!.starts.length} home
        {noStars ? "" : ` · ${starsTaken} of ${data.boards[index]!.stars.length} stars`}
      </p>
      <div className="grav-reveal-space">
        <div className="grav-reveal-square" data-reveal-board="">
          <TopsyBoardView key={index} board={data.boards[index]!} state={b.state} missed={b.outcome !== "cleared"} />
        </div>
      </div>
      <TopsyRouteChips route={b.route} />
      {/* The key numbers, the player's own (labelled "You"), from the stored grade. */}
      <div className="topsy-key-pills" data-own-count="" data-topsy-keys="">
        <span className="topsy-key"><span>Boards</span> <b>{cleared} of {data.boards.length}</b></span>
        <span className="topsy-key"><span>Home</span> <b>{home} of {total}</b></span>
        <span className="topsy-key"><span>You</span> <b>{tilts} {tilts === 1 ? "tilt" : "tilts"}</b></span>
        {par !== null ? <span className="topsy-key"><span>Par</span> <b>{par}</b></span> : null}
        {secondsLeft !== null ? <span className="topsy-key"><span>Time left</span> <b>{secondsLeft} s</b></span> : null}
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
