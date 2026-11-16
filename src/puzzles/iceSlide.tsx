import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { ArrowPad, usePrefersReducedMotion, useSwipe } from "@/components/puzzles/GridDrag";
import {
  countedSlides,
  decodeSlideMoves,
  encodeSlideMoves,
  oneSlideFromExit,
  replaySlide,
  slideBoard,
  slideDims,
  slideOutcome,
  slideSearch,
} from "@/lib/duel/slide";
import { useGameKeys } from "@/lib/desktop";
import { useStageState } from "@/lib/duel/stageState";
import {
  SLIDE_TIME_MS,
  type SlideDir,
  type SlidePuzzleData,
} from "@/lib/duel/types";
import { playCorrect, playWrong } from "@/lib/sound";
import { puzzleReject } from "@/lib/fx/puzzleReject";
import { useInFrame } from "@/components/puzzles/batchP/LiveSummary";
import { FramePills, parPills } from "@/components/puzzles/pattern/framePills";
import { shownPar } from "@/lib/duel/parMoves";
import { usesPatternNov15 } from "@/lib/duel/patternNov15";
import { soundCue } from "@/lib/fx/patternFx";
import "@/polish-layout/polish-nov3-pattern.css";
import { IceGems } from "@/components/puzzles/depth4/IceGems";
import { popCount, replayGems } from "@/lib/duel/depth4/iceGems";
import { rightMoveFlash } from "@/lib/fx/gameToolkit";
import { useSolveMoment } from "@/lib/fx/patternFx";
import { IceArt, IceBoard as Board, IceFallingBall, IceTrail, useIceSlideFx, type IceBallFx } from "@/components/puzzles/pattern/iceSlideBoard";
import { gameFx } from "@/lib/fx/kit";
import { HudPills, type HudPillItem } from "@/components/puzzles/HudPills";

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
        Swipe or tap an arrow to slide the ball. It won’t stop until it hits something. Avoid the holes – fall
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
        Reaching the exit in par slides earns a bonus; Undo gives a slide back. You have 90 seconds (100 on Hard, 120 on Expert).
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
  // Difficulty levels (16 Nov 2026): a level board's own size (Easy 8 × 8, Expert 11 × 13); else 12 × 12.
  const dims = slideDims(data);
  const tall = dims.rows !== dims.cols;
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
  // Stage 2 (display only): the resting ball's moment, a settle as it stops or a bump against a wall; a new key plays it.
  const [ballFx, setBallFx] = useState<IceBallFx | null>(null);
  const ballFxKey = useRef(0);

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
  // slideRev 5 (the Pattern overhaul): Undo and Reset give the slide back, so the count is the slides still standing,
  // as the server counts them; older stamps count every slide played.
  const overhaul = usesPatternNov15(data, "iceslide");
  const slidesShown = countedSlides(replay, overhaul);
  const par = data ? shownPar(data) : null;
  // Display and sound only: one slide from the exit with the finish still at par, the exit glows (once per resting spot).
  const nearExit =
    !animating && !replay.solved && par !== null && slidesShown + 1 <= par && oneSlideFromExit(board, replay);
  const nearKey = useRef<string | null>(null);
  // The resting spot's key: the exit's near-miss pulse (the kit's nearMiss, stage 2) plays once per new key.
  const nearSpot = nearExit ? `${replay.cell}:${replay.mask}:${slidesShown}` : null;
  useEffect(() => {
    const key = nearSpot;
    if (key && key !== nearKey.current) soundCue("iceslide.nearExit");
    nearKey.current = key;
  }, [nearSpot]);

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
    if (!outcome.path.length) {
      // Straight into a wall or the edge: nothing moves and nothing counts; a tiny bump says so (a dull tap, and the
      // ball's art nudges 2–3 px toward the wall; the next slide is taken at once).
      soundCue("iceslide.bump");
      setBallFx({ kind: "bump", dir, key: ++ballFxKey.current });
      return;
    }
    setBallFx(null);
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
    const stops = !outcome.fell && outcome.cell !== board.exit;
    slideTimers.current.push(setTimeout(() => {
      // The ball comes to rest against what stopped it: a thump (sound only; a fall or the exit plays its own).
      if (stops) soundCue("iceslide.stop");
      // ...and its art settles (the kit's drop) as it comes to rest in its cell.
      if (stops) setBallFx({ kind: "settle", key: ++ballFxKey.current });
      setVisualBall(null);
      setAnimating(false);
      slideTimers.current = [];
    }, elapsed));
    setMoves((current) => [...current, dir]);
  };

  const swipe = useSwipe(slide, { disabled: locked || replay.solved || animating });

  const undo = () => {
    setBallFx(null);
    setMoves((current) => [...current, "X"]);
  };
  const reset = () => {
    setBallFx(null);
    setMoves((current) => [...current, "Y"]);
  };

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
    <div
      data-stage-column="2"
      data-polish="iceslide"
      data-ice-tall={tall ? "true" : undefined}
      style={tall ? ({ "--ice-ar": `${dims.cols / dims.rows}` } as CSSProperties) : undefined}
      className="flex min-h-0 flex-1 flex-col gap-2"
    >
      {inFrame ? null : (
        <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
          moves <span className="text-primary">{slidesShown}</span>
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
        <div className={`ice-stage-square relative${tall ? "" : " aspect-square"} h-full max-h-full w-full max-w-full`}>
          <Board
            {...(dims.cols !== 12 || dims.rows !== 12 ? { cols: dims.cols, cells: dims.cells } : {})}
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
            nearExit={nearExit}
            nearPulse={nearSpot}
            ballFx={ballFx}
          >
            <IceTrail cells={fx.trail} cols={dims.cols} rows={dims.rows} fading={fx.trailFading} />
            {gems.length ? <IceGems gems={gems} collected={gemsShown} cols={dims.cols} /> : null}
            {fx.fall ? <IceFallingBall key={fx.fall.key} cell={fx.fall.cell} cols={dims.cols} rows={dims.rows} /> : null}
          </Board>
          {visualBall && (
            <span
              aria-label="Ball"
              className="pointer-events-none absolute z-10 block rounded-full ice-player ice-ball"
              style={{
                // One square (2 px gaps between squares): the ball render is 90 % of it, as the resting ball.
                width: `calc((100% - ${2 * (dims.cols - 1)}px) / ${dims.cols})`,
                height: `calc((100% - ${2 * (dims.rows - 1)}px) / ${dims.rows})`,
                left: `calc((100% - ${2 * (dims.cols - 1)}px) * ${((visualBall.cell % dims.cols) + 0.5) / dims.cols} + ${(visualBall.cell % dims.cols) * 2}px)`,
                top: `calc((100% - ${2 * (dims.rows - 1)}px) * ${(Math.floor(visualBall.cell / dims.cols) + 0.5) / dims.rows} + ${Math.floor(visualBall.cell / dims.cols) * 2}px)`,
                transform: "translate(-50%, -50%)",
                transition: visualBall.jump || reducedMotion ? "none" : "left 90ms linear, top 90ms linear",
              }}
            >
              <IceArt name="ball" />
            </span>
          )}
        </div>
      </div>
      {/* Puzzle polish (3 Nov 2026): the summary as pills. On a stamp that shows its par (parMoves.ts `shownPar`),
          "Slides n" is every slide made, an undone one included (the replay's count, as the server grades it); on
          slideRev 5 (the Pattern overhaul) the slides still standing, Undo and Reset giving them back. */}
      <FramePills
        testId="iceslide"
        items={[
          ...(par !== null ? parPills("Slides", slidesShown, par) : [{ id: "moves", label: "Moves", value: slidesShown }]),
          gems.length ? { id: "gems", label: "Gems", value: `${popCount(gemsShown)} / ${gems.length}` } : null,
          replay.falls > 0 ? { id: "falls", label: replay.falls === 1 ? "Fall" : "Falls", value: replay.falls, tone: "warn" } : null,
        ]}
      />
      <ArrowPad modeSwitch={false} onPress={slide} disabled={locked || replay.solved || animating} />
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

const DIR_NAME: Record<string, string> = { U: "Up", D: "Down", L: "Left", R: "Right" };

/** A route as a strip of arrow chips (the arrow tiles' own renders), in order. */
function SlideChips({ dirs, label, view }: { dirs: readonly SlideDir[]; label: string; view: string }) {
  const shown = dirs.filter((d) => d === "U" || d === "D" || d === "L" || d === "R");
  return (
    <div className="ice-chips" data-ice-chips={view}>
      <span className="ice-chips-label">{label}</span>
      <span className="ice-chips-row" role="img" aria-label={`${label}: ${shown.map((d) => DIR_NAME[d]).join(", ") || "none"}`}>
        {shown.length ? (
          shown.map((d, i) => <IceArt key={i} name={`arrow-${d as "U" | "D" | "L" | "R"}`} className="ice-chip" />)
        ) : (
          <span className="ice-chips-none">none</span>
        )}
      </span>
    </div>
  );
}

const storedNum = (extra: Record<string, unknown> | null | undefined, key: string): number | null => {
  const v = extra?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

/**
 * The answer reveal (the Pattern overhaul's reveal, 15 Nov 2026), every stamp: two labelled columns for the reveal's
 * Solution / Yours switch, one large board at a time. Solution: the shortest route drawn on the rink and as arrow chips.
 * Yours: the player's own final board (the ball where it stopped, the slides left standing, the ice it broke, a red ring
 * wherever it fell), the numbers behind the score from the stored grade, and the player's slides against the par
 * route as chips. Older stamps read their stored figures (every slide played) the same way.
 */
function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining, myExtra }: PuzzleRevealProps) {
  // Stage 2: the solve's payoff on the result, the kit's win on the reveal's own result card, once (silent: the reveal
  // plays its score sound; no haptic outside a live board).
  const won = Boolean(myCorrect && puzzle.type === "iceslide");
  const revealRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!won) return;
    const card = revealRef.current?.closest(".answer-reveal-content, [data-reveal-screen]")?.querySelector("[data-verdict-row]");
    gameFx("win", card ?? null, { silent: true, inGame: false });
  }, [won]);
  if (puzzle.type !== "iceslide") return null;
  const board = slideBoard(puzzle);
  const dims = slideDims(puzzle);
  const revealTall = dims.rows !== dims.cols;
  const best = puzzle.solution
    ? (puzzle.solution.split("") as SlideDir[])
    : (slideSearch(board)?.route ?? []);
  const bestReplay = replaySlide(board, best);
  const route = [puzzle.start, ...bestReplay.paths.flat()];
  const mine = replaySlide(board, decodeSlideMoves(myAnswer ?? ""));
  const overhaul = usesPatternNov15(puzzle, "iceslide");
  const par = puzzle.minMoves ?? best.length;
  // The figures the score was built from, as the server stored them (the phone's replay only where none was stored).
  const slides = storedNum(myExtra, "moves") ?? countedSlides(mine, overhaul);
  const falls = storedNum(myExtra, "falls") ?? mine.falls;
  const away = storedNum(myExtra, "movesFromExit");
  const seconds = myCorrect && typeof myMsRemaining === "number" ? Math.max(0, Math.floor(myMsRemaining / 1000)) : null;
  const items: Array<HudPillItem | null> = [
    { id: "you", label: "You", value: `${slides}`, tone: myCorrect ? (slides <= par ? "good" : "warn") : undefined },
    par > 0 ? { id: "par", label: "Par", value: `${par}`, tone: "gold" } : null,
    falls > 0 ? { id: "falls", label: falls === 1 ? "Fall" : "Falls", value: `${falls}`, tone: "warn" } : null,
    !myCorrect && away !== null ? { id: "away", label: "From the exit", value: `${away} slide${away === 1 ? "" : "s"}` } : null,
    seconds !== null ? { id: "time", label: "Time left", value: `${seconds} s` } : null,
  ];
  const rink = (props: { route: number[]; ball: number; broken?: number; fallen?: number[] }) => (
    <div
      className="ice-reveal-board"
      data-reveal-board=""
      data-ice-tall={revealTall ? "true" : undefined}
      style={revealTall ? ({ "--ice-ar": `${dims.cols / dims.rows}` } as CSSProperties) : undefined}
    >
      <Board
        {...(dims.cols !== 12 || dims.rows !== 12 ? { cols: dims.cols, cells: dims.cells } : {})}
        walls={puzzle.walls}
        holes={puzzle.holes ?? []}
        arrows={puzzle.arrows ?? []}
        portals={puzzle.portals ?? []}
        thin={puzzle.thin ?? []}
        broken={props.broken ?? 0}
        start={puzzle.start}
        exit={puzzle.exit}
        ball={props.ball}
        route={props.route}
        fallen={props.fallen}
      />
    </div>
  );

  return (
    <div ref={revealRef} className="ice-reveal flex w-full flex-col items-center gap-3">
      <div className="ice-reveal-space">
        <div className="ice-reveal-pair">
          <div className="ice-reveal-col flex flex-col items-center gap-2" data-ice-solution="">
            {rink({ route, ball: puzzle.start })}
            <span className="ice-reveal-label">Solution</span>
            <p className="ice-reveal-caption" data-solution-caption="">
              Shortest route · {par} slide{par === 1 ? "" : "s"}
            </p>
            <SlideChips dirs={best} label="Par route" view="solution" />
          </div>
          <div className="ice-reveal-col flex flex-col items-center gap-2" data-ice-yours="">
            {rink({ route: [puzzle.start, ...mine.standing.flat()], ball: mine.cell, broken: mine.mask, fallen: mine.fellAt })}
            <span className="ice-reveal-label">Yours</span>
            <HudPills testId="iceslide-reveal" items={items} className="ice-reveal-pills" />
            <div className="ice-chips-pair">
              <SlideChips dirs={mine.standingDirs} label="You" view="yours" />
              <SlideChips dirs={best} label="Par" view="yours-par" />
            </div>
            {mine.fellAt.length ? (
              <p className="ice-reveal-key">
                <span className="ice-key ice-key--fell">Red ring: where you fell</span>
              </p>
            ) : null}
          </div>
        </div>
      </div>
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
