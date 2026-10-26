import { gameDisplayName } from "@/lib/duel/gameNames";
import { solvedMovesText } from "@/lib/duel/scoring";
import { useEffect, useMemo, useRef, useState } from "react";

import { ArrowPad, usePrefersReducedMotion, useSwipe } from "@/components/puzzles/GridDrag";
import {
  encodeSlideMoves,
  replaySlide,
  slideBoard,
  slideOutcome,
  slideSearch,
} from "@/lib/duel/slide";
import { useGameKeys } from "@/lib/desktop";
import { useStageState } from "@/lib/duel/stageState";
import {
  SLIDE_COLS,
  SLIDE_TIME_MS,
  type SlideDir,
  type SlidePuzzleData,
} from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect, playWrong } from "@/lib/sound";
import { puzzleReject } from "@/lib/fx/puzzleReject";
import { LiveSummary, SummaryItem, useInFrame } from "@/components/puzzles/batchP/LiveSummary";
import { IceGems } from "@/components/puzzles/depth4/IceGems";
import { popCount, replayGems } from "@/lib/duel/depth4/iceGems";
import { rightMoveFlash } from "@/lib/fx/gameToolkit";
import { useSolveMoment } from "@/lib/fx/patternFx";
import { IceBoard as Board, IceTrail, useIceSlideFx } from "@/components/puzzles/pattern/iceSlideBoard";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Of this slide's new gems (`bits`), those the moving ball has reached along `path` (display only). */
function gemsPassed(gems: readonly number[], bits: number, cell: number, path: readonly number[]): number {
  const reached = path.indexOf(cell);
  let out = 0;
  gems.forEach((gem, i) => {
    if (!(bits & (1 << i))) return;
    const at = path.indexOf(gem);
    if (at >= 0 && reached >= 0 && at <= reached) out |= 1 << i;
  });
  return out;
}

/** Fixed intro example — never randomised. */
function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Swipe to slide the ball. It won&apos;t stop until it hits something. Avoid the holes - fall
        in and you start again. A chevron turns the ball. Portals carry you across the board.
        Cracked ice breaks after you cross it once.
      </p>
      <div style={{ width: 132 }}>
        <Board
          cols={4}
          cells={16}
          walls={[6, 12]}
          holes={[9]}
          arrows={[{ cell: 5, dir: "D" }]}
          portals={[[3, 10]]}
          thin={[14]}
          start={0}
          exit={15}
          ball={0}
          route={[0, 4, 5, 13, 14, 15]}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Fewer moves earn a bonus. You have 90 seconds.
      </p>
    </div>
  );
}

function Stage({
  puzzle,
  locked,
  onSubmit,
  onDraftAnswer,
  stateKey = "iceslide",
}: PuzzleStageProps) {
  const data = puzzle.type === "iceslide" ? puzzle : null;
  const board = useMemo(
    () => slideBoard(data ?? { walls: [], holes: [], start: 0, exit: 0 }),
    [data],
  );
  const [moves, setMoves] = useStageState<SlideDir[]>(stateKey, "slideMoves", () => []);
  const submitted = useRef(false);
  const [flash, setFlash] = useState(false);
  const fallsSeen = useRef(0);
  const reducedMotion = usePrefersReducedMotion();
  const inFrame = useInFrame();
  const [animating, setAnimating] = useState(false);
  const [visualBall, setVisualBall] = useState<{ cell: number; jump: boolean } | null>(null);
  const slideTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const slidePath = useRef<number[]>([]);

  useEffect(() => () => slideTimers.current.forEach(clearTimeout), []);

  const replay = useMemo(() => replaySlide(board, moves), [board, moves]);
  // slideRev 1 (depth batch 4): ice gems. A gem lights as the moving ball reaches it; the count is the shared replay's.
  const gems = useMemo(() => (data && (data.slideRev ?? 0) >= 1 ? (data.gems ?? []) : []), [data]);
  const gemReplay = useMemo(() => replayGems(board, gems, moves), [board, gems, moves]);
  const gemsBefore = gemReplay.history[gemReplay.history.length - 2] ?? 0;
  const gemsShown = animating && visualBall
    ? gemsBefore | gemsPassed(gems, gemReplay.mask & ~gemsBefore, visualBall.cell, slidePath.current)
    : gemReplay.mask;
  const gemsLit = useRef(0);
  useEffect(() => {
    const fresh = gemsShown & ~gemsLit.current;
    if (fresh) {
      playCorrect();
      gems.forEach((cell, i) => {
        if (fresh & (1 << i)) rightMoveFlash(document.querySelector(`[data-game-stage] [data-d4-gem="${cell}"]`));
      });
    }
    gemsLit.current = gemsShown;
  }, [gemsShown, gems]);
  const portalPairs = useMemo(() => data?.portals ?? [], [data]);
  const fx = useIceSlideFx({
    portals: board.portals,
    pairs: portalPairs,
    thin: board.thin,
    visualBall,
    animating,
    restCell: replay.cell,
    restMask: replay.mask,
  });
  const solving = useSolveMoment(replay.solved && !animating, "iceslide.solve");

  useEffect(() => {
    onDraftAnswer?.(encodeSlideMoves(moves));
  }, [moves, onDraftAnswer]);

  // A fall flashes the board red and buzzes; the move still counts.
  useEffect(() => {
    if (replay.falls <= fallsSeen.current) {
      fallsSeen.current = replay.falls;
      return;
    }
    fallsSeen.current = replay.falls;
    setFlash(true);
    puzzleReject(undefined, false);
    buzz(25);
    playWrong();
    const timer = setTimeout(() => setFlash(false), 320);
    return () => clearTimeout(timer);
  }, [replay.falls]);

  useEffect(() => {
    if (locked || submitted.current || !replay.solved || animating) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encodeSlideMoves(moves));
  }, [replay.solved, moves, locked, animating, onSubmit]);

  const slide = (dir: SlideDir) => {
    if (locked || submitted.current || replay.solved || animating) return;
    const outcome = slideOutcome(board, replay.cell, replay.mask, dir);
    if (!outcome.path.length) return;
    slidePath.current = outcome.path;
    fx.begin(replay.cell, replay.mask, outcome);
    setVisualBall({ cell: replay.cell, jump: true });
    setAnimating(true);
    let elapsed = 20;
    let previous = replay.cell;
    for (const cell of outcome.path) {
      const jump = board.portals.get(previous) === cell;
      slideTimers.current.push(setTimeout(() => setVisualBall({ cell, jump }), elapsed));
      elapsed += jump ? 32 : reducedMotion ? 45 : 100;
      previous = cell;
    }
    slideTimers.current.push(setTimeout(() => {
      setVisualBall(null);
      setAnimating(false);
      slideTimers.current = [];
    }, elapsed));
    setMoves((current) => [...current, dir]);
  };

  const swipe = useSwipe(slide, { disabled: locked || replay.solved || animating });

  const undo = () => setMoves((current) => [...current, "X"]);
  const reset = () => setMoves((current) => [...current, "Y"]);

  // Desktop keys: Z or Backspace = Undo, R = Reset (the arrows and WASD slide through ArrowPad).
  useGameKeys((kind, key, event) => {
    const used = key === "z" || key === "Backspace" || key === "r";
    if (!used || kind !== "down" || event.repeat) return used;
    if (locked || animating || !moves.length) return true;
    if (key === "r") reset();
    else undo();
    return true;
  });

  if (!data) return null;

  return (
    <div data-stage-column="2" data-polish="iceslide" className="flex min-h-0 flex-1 flex-col gap-2">
      {inFrame ? null : (
        <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
          moves <span className="text-primary">{replay.moves}</span>
          {replay.falls > 0 ? ` · ${replay.falls} fall${replay.falls === 1 ? "" : "s"}` : ""}
        </p>
      )}
      <div
        data-game-arena="board" className="flex min-h-0 flex-1 items-center justify-center touch-none rounded-lg transition-colors"
        style={{
          touchAction: "none",
          outline: flash ? "2px solid var(--destructive)" : undefined,
        }}
        {...swipe}
      >
        <div className="ice-stage-square relative aspect-square h-full max-h-full w-full max-w-full">
          <Board
            walls={data.walls}
            holes={data.holes ?? []}
            arrows={data.arrows ?? []}
            portals={data.portals ?? []}
            thin={data.thin ?? []}
            broken={fx.mask}
            fresh={fx.fresh}
            flare={solving ? -1 : fx.flare}
            start={data.start}
            exit={data.exit}
            ball={animating ? -1 : replay.cell}
            solving={solving}
          >
            <IceTrail cells={fx.trail} cols={SLIDE_COLS} rows={SLIDE_COLS} fading={fx.trailFading} />
            {gems.length ? <IceGems gems={gems} collected={gemsShown} cols={SLIDE_COLS} /> : null}
            {fx.fall ? (
              <span
                key={fx.fall.key}
                className="ice-fall"
                aria-hidden="true"
                style={{
                  left: `calc((100% - 22px) * ${((fx.fall.cell % SLIDE_COLS) + 0.5) / SLIDE_COLS} + ${(fx.fall.cell % SLIDE_COLS) * 2}px)`,
                  top: `calc((100% - 22px) * ${(Math.floor(fx.fall.cell / SLIDE_COLS) + 0.5) / SLIDE_COLS} + ${Math.floor(fx.fall.cell / SLIDE_COLS) * 2}px)`,
                }}
              />
            ) : null}
          </Board>
          {visualBall && (
            <span
              aria-label="Ball"
              className="pointer-events-none absolute z-10 block rounded-full ice-player ice-ball"
              style={{
                width: "calc((100% - 22px) * 0.066666667)",
                height: "calc((100% - 22px) * 0.066666667)",
                left: `calc((100% - 22px) * ${((visualBall.cell % SLIDE_COLS) + 0.5) / SLIDE_COLS} + ${(visualBall.cell % SLIDE_COLS) * 2}px)`,
                top: `calc((100% - 22px) * ${(Math.floor(visualBall.cell / SLIDE_COLS) + 0.5) / SLIDE_COLS} + ${Math.floor(visualBall.cell / SLIDE_COLS) * 2}px)`,
                transform: "translate(-50%, -50%)",
                transition: visualBall.jump || reducedMotion ? "none" : "left 90ms linear, top 90ms linear",
              }}
            />
          )}
        </div>
      </div>
      <LiveSummary
        items={[
          <SummaryItem key="moves" label="Moves" value={replay.moves} />,
          gems.length ? <SummaryItem key="gems" label="Gems" value={`${popCount(gemsShown)} / ${gems.length}`} /> : null,
          replay.falls > 0 ? <SummaryItem key="falls" value={replay.falls} after={replay.falls === 1 ? "fall" : "falls"} warn /> : null,
        ]}
      />
      <ArrowPad onPress={slide} disabled={locked || replay.solved || animating} />
      <div data-game-controls="actions" className="flex shrink-0 justify-center gap-3 px-2">
        <button
          type="button"
          disabled={locked || animating || !moves.length}
          onClick={undo}
          className="h-11 rounded-xl border border-border px-5 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          disabled={locked || animating || !moves.length}
          onClick={reset}
          className="h-11 rounded-xl border border-border px-5 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining, scoreParts }: PuzzleRevealProps) {
  if (puzzle.type !== "iceslide") return null;
  const board = slideBoard(puzzle);
  const best = puzzle.solution
    ? (puzzle.solution.split("") as SlideDir[])
    : (slideSearch(board)?.route ?? []);
  const bestReplay = replaySlide(board, best);
  const route = [puzzle.start, ...bestReplay.paths.flat()];
  const replay = replaySlide(board, (myAnswer ?? "").split("") as SlideDir[]);
  const min = puzzle.minMoves ?? best.length;

  return (
    <div className="ice-reveal flex min-h-0 w-full flex-1 flex-col items-center gap-3">
      <div className="ice-reveal-space">
        <div className="ice-reveal-square">
        <Board
          walls={puzzle.walls}
          holes={puzzle.holes ?? []}
          arrows={puzzle.arrows ?? []}
          portals={puzzle.portals ?? []}
          thin={puzzle.thin ?? []}
          start={puzzle.start}
          exit={puzzle.exit}
          ball={puzzle.start}
          route={route}
        />
        </div>
      </div>
      <p className="font-mono text-base uppercase tracking-widest text-muted-foreground">
        shortest route · {min} move{min === 1 ? "" : "s"}
      </p>
      <p className="font-mono text-base uppercase tracking-widest text-muted-foreground">
        {myCorrect
          ? `✓ ${solvedMovesText(replay.moves, min, myMsRemaining, timeLimitMs, "B", scoreParts)}`
          : "✗ Not solved"}
      </p>
    </div>
  );
}

/** The minimum and the shortest route stay server-side until the reveal. */
export const iceSlidePuzzle: PuzzleDefinition = {
  key: "iceslide",
  name: gameDisplayName("iceslide"),
  category: "pattern",
  timeLimitMs: SLIDE_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({ type: "iceslide", walls: [], holes: [], start: 0, exit: 0 }) satisfies SlidePuzzleData,
  check: () => false,
  revealHeading: "The shortest route",
  IntroExample,
  Stage,
  Reveal,
};
