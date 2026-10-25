/**
 * Topsy-Turvy gravityRev 3 (the remodel; topsy.ts, docs/depth/d5-remodels.md): the board, the ring row,
 * the live stage, the reveal and the intro still. The tray, blocks, felt and shaded balls keep the polished
 * Topsy-Turvy look (polish-pattern/gravity.css, batch P); holes, stars, home drops and the rings are new
 * (topsy.css). The board animates what replayTopsy decided and never decides anything itself.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { ArrowPad, gridCellCentre, hapticTick, useGridMetrics, usePrefersReducedMotion } from "@/components/puzzles/GridDrag";
import { LiveSummary, SummaryItem, useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
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
  topsyStart,
  topsyTilt,
  type TopsyBoard as TopsyBoardData,
  type TopsyReplay,
  type TopsyState,
} from "@/lib/duel/topsy";
import type { GravityDir, GravityPuzzleData } from "@/lib/duel/types";
import { soundCue, useSolveMoment } from "@/lib/fx/patternFx";
import { buzz } from "@/lib/motion";
import { playCorrect, playLock, playSound, playTick } from "@/lib/sound";
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
  /** The board was just cleared (or the round solved): the holes light in turn. */
  cleared?: boolean;
}

export function TopsyBoardView({ board, state, size, lean, cleared = false }: TopsyBoardProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const metrics = useGridMetrics(gridRef, TOPSY_SIZE, TOPSY_SIZE);
  const walls = useMemo(() => new Set(board.walls), [board.walls]);
  const ballSize = metrics ? Math.max(6, Math.min(metrics.cellW, metrics.cellH) * 0.8) : 0;
  const leanName = lean === "U" || lean === "D" || lean === "L" || lean === "R" ? lean : "none";

  return (
    <div
      className={`gravity-board grav-tray topsy-tray relative shrink-0${cleared ? " is-solving" : ""}`}
      data-lean={leanName}
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
                    className={`grav-socket topsy-hole${state.balls[hole] === TOPSY_HOME ? " is-locked is-home" : ""}`}
                    style={{ ["--ball" as string]: TOPSY_COLOURS[hole], ["--order" as string]: hole }}
                  >
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
                  className={`grav-ball topsy-ball${home ? " is-home" : ""}`}
                  data-ball={index}
                  style={{
                    width: ballSize,
                    height: ballSize,
                    transform: `translate(${centre.x - ballSize / 2}px, ${centre.y - ballSize / 2}px)`,
                    ["--ball" as string]: TOPSY_COLOURS[index],
                    ["--order" as string]: index,
                  }}
                >
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

  // Sounds: a ball home, a star, a cleared board (a tilt plays on press).
  const seen = useRef({ home: replay.home, stars: replay.stars, cleared: replay.cleared });
  useEffect(() => {
    const before = seen.current;
    if (replay.cleared > before.cleared && !replay.solved) playCorrect();
    else if (replay.home > before.home) {
      playLock();
      soundCue("gravity.lock");
    }
    if (replay.stars > before.stars) playTick(0.8);
    seen.current = { home: replay.home, stars: replay.stars, cleared: replay.cleared };
  }, [replay]);

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
    hapticTick();
    buzz(10);
    playSound("pz_gravity_pull");
    soundCue("gravity.tilt");
    setLean(dir);
    if (leanTimer.current) clearTimeout(leanTimer.current);
    leanTimer.current = setTimeout(() => setLean(null), 200);
    setTilts((current) => [...current, dir]);
  };

  const starsHere = board.stars.filter((_, i) => state.starMask & (1 << i)).length;
  const tiltText = limitHere ? `${tiltsHere} / ${limitHere}` : `${tiltsHere}`;
  const outOfTilts = Boolean(boardResult?.outOfTilts);

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
            cleared={solving || Boolean(boardResult?.cleared)}
            size={Math.max(0, Math.floor(Math.min(boardSpace.width, boardSpace.height - TOPSY_HEAD_PX)))}
          />
        ) : null}
        {outOfTilts ? <span className="topsy-banner" data-topsy-banner="">Out of tilts</span> : null}
      </div>
      <LiveSummary
        items={[
          <SummaryItem key="tilts" label="Tilts" value={<span data-move-limit={limitHere || undefined}>{tiltText}</span>} warn={outOfTilts} />,
          <SummaryItem key="stars" label="Stars" value={`${starsHere} / ${TOPSY_STARS}`} />,
          <SummaryItem key="home" label="Home" value={`${replay.home} / ${TOPSY_BALLS * TOPSY_BOARDS}`} />,
        ]}
      />
      <div data-game-controls="pad" className="flex shrink-0 flex-col items-center gap-3">
        <ArrowPad onPress={press} disabled={blocked} />
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

export function TopsyReveal({ puzzle, myAnswer, myCorrect, scoreParts }: PuzzleRevealProps) {
  const data = puzzle as GravityPuzzleData & { boards: TopsyBoardData[] };
  const replay = replayTopsyPuzzle(data, decodeGravityTilts(myAnswer ?? ""));
  const last = Math.min(replay.current, TOPSY_BOARDS - 1);
  const shownIndex = replay.solved ? TOPSY_BOARDS - 1 : last;
  const state = currentBoardState(data, replay, shownIndex);
  const routes = data.boardSolutions ?? [];
  const parts = scoreParts && scoreParts.kind === "finish" ? `${scoreParts.base} + ${scoreParts.efficiency ?? 0} stars + ${scoreParts.speed ?? 0} speed` : null;
  return (
    <div className="grav-reveal flex min-h-0 w-full flex-1 flex-col items-center gap-3" data-topsy-reveal="">
      <TopsyRings state={state} />
      <div className="grav-reveal-space">
        <div className="grav-reveal-square">
          <TopsyBoardView board={data.boards[shownIndex]!} state={state} />
        </div>
      </div>
      {routes.length ? (
        <p className="topsy-routes text-center font-display text-sm font-bold tracking-widest text-primary">
          {routes.map((route, i) => (
            <span key={i} className="topsy-route">
              {i + 1}: {route.split("").map((d) => ARROWS[d as GravityDir] ?? d).join(" ")}
            </span>
          ))}
        </p>
      ) : null}
      <p className="font-display text-2xl font-bold">
        <span className={myCorrect ? "text-primary" : "text-warn"}>
          {replay.cleared} / {TOPSY_BOARDS} {myCorrect ? "✓" : "✗"}
        </span>
        <span className="ml-2 font-mono text-base uppercase tracking-widest text-muted-foreground">boards</span>
      </p>
      <p className="font-mono text-base text-muted-foreground">
        {replay.home} / {TOPSY_BALLS * TOPSY_BOARDS} home · {replay.stars} / {TOPSY_BOARDS * TOPSY_STARS} stars · {replay.tilts} tilts
      </p>
      {parts ? <p className="font-mono text-base text-primary">{parts}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ intro still */

/** A fixed board (never randomised): one tilt right rolls five balls home, gold through a star. */
const INTRO_BOARD: TopsyBoardData = {
  walls: [5, 26, 44, 57, 63, 78, 81],
  starts: [10, 31, 52, 3, 70, 86],
  holes: [17, 36, 55, 33, 75, 89],
  stars: [14, 48],
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
        One tilt right: five balls roll over their own holes and drop in; gold takes a star on the way.
      </p>
    </div>
  );
}

/** For checks: the intro still's board and the state after its tilt. */
export const TOPSY_INTRO = { board: INTRO_BOARD, after: INTRO_AFTER, tilt: "R" as GravityDir };
