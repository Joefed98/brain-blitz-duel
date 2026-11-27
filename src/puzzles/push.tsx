import { puzzleReject } from "@/lib/fx/puzzleReject";
import { useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import { FramePills, parPills } from "@/components/puzzles/pattern/framePills";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useMemo, useRef, useState } from "react";

import { ArrowPad, useSwipe } from "@/components/puzzles/GridDrag";
import { WarehouseBoard } from "@/components/puzzles/pattern/pushArt";
import { soundCue, useSolveMoment } from "@/lib/fx/patternFx";
import {
  cratesOnTargets,
  decodePushMoves,
  decodePushSolution,
  encodePushMoves,
  movePusher,
  pushSolutionFrames,
  replayPush,
} from "@/lib/duel/push";
import { pushParFor } from "@/lib/duel/pushPar";
import { pushDeadSquares, stuckCrates } from "@/lib/duel/pushStuck";
import { stuckHintOn } from "@/lib/duel/pushLevels";
import { useGameKeys } from "@/lib/desktop";
import { useStageState } from "@/lib/duel/stageState";
import {
  PUSH_CELLS,
  PUSH_COLS,
  PUSH_TIME_MS,
  type SlideDir,
  type PushPuzzleData,
} from "@/lib/duel/types";
import { playCorrect } from "@/lib/sound";
import { useRevealHosted, useRevealViews } from "@/components/duel/revealContext";
import { useRevealBoardWidth } from "@/components/puzzles/pattern/revealBoard";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

function Board({
  walls,
  targets,
  crates,
  pusher,
  cols = PUSH_COLS,
  cells = PUSH_CELLS,
  facing,
  solveFx,
  gold,
  lit,
  goldOff,
  moveFx,
  stuck,
}: {
  stuck?: readonly number[] | undefined;
  gold?: { crate: number; target: number } | undefined;
  lit?: boolean;
  goldOff?: number;
  moveFx?: boolean;
  walls: number[];
  targets: number[];
  crates: number[];
  pusher: number;
  cols?: number;
  cells?: number;
  facing?: SlideDir | undefined;
  solveFx?: boolean;
}) {
  // Every piece is drawn inside its own cell and slides between cells (pattern/pushArt).
  return (
    <WarehouseBoard
      walls={walls}
      targets={targets}
      crates={crates}
      pusher={pusher}
      cols={cols}
      cells={cells}
      facing={facing}
      solveFx={solveFx ?? false}
      gold={gold}
      lit={lit ?? false}
      goldOff={goldOff ?? 0}
      moveFx={moveFx ?? false}
      stuck={stuck}
    />
  );
}

/** Fixed intro example — never randomised. */
function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Push every crate onto a marked square. You can only push – never pull – and only one crate at a time.
        Undo gives the push back.
      </p>
      <div className="flex items-center gap-2">
        <div style={{ width: 116 }}>
          <Board
            cols={4}
            cells={16}
            walls={[0, 1, 2, 3, 4, 7, 8, 11, 12, 13, 14, 15]}
            targets={[10]}
            crates={[9]}
            pusher={5}
          />
        </div>
        <span className="text-lg text-primary">▶</span>
      </div>
      <p className="text-xs text-muted-foreground">
        The fewest pushes (par, shown as you play) earn a bonus. You have 120 seconds.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey = "push" }: PuzzleStageProps) {
  const walls = puzzle.type === "push" ? puzzle.walls : [];
  const targets = puzzle.type === "push" ? puzzle.targets : [];
  const startCrates = puzzle.type === "push" ? puzzle.crates : [];
  const startPusher = puzzle.type === "push" ? puzzle.pusher : 0;
  const [moves, setMoves] = useStageState<SlideDir[]>(stateKey, "pushMoves", () => []);
  const submitted = useRef(false);
  // Stage 2 (display only): a new key dims the gold mark (a push took the gold crate off it).
  const [goldOff, setGoldOff] = useState(0);
  // A crate home thumps and its mark glows only on a push (never when Undo or Reset puts a crate back on a mark).
  const [moveFx, setMoveFx] = useState(false);

  const replay = useMemo(
    () => replayPush(walls, targets, startPusher, startCrates, moves),
    [walls, targets, startPusher, startCrates, moves],
  );

  const solveFx = useSolveMoment(replay.solved, "push.solve");
  // pushRev 1 (depth batch 4): the gold crate and its gold mark.
  const gold = puzzle.type === "push" && (puzzle.pushRev ?? 0) >= 1 ? puzzle.gold : undefined;
  const goldHome = gold ? replay.state.crates[gold.crate] === gold.target : false;
  const inFrame = useFrameProgress(replay.cratesOnTargets, targets.length, "home");
  // The Pattern overhaul (15 Nov 2026, display only): par, the fewest pushes, looked up from the dealt layout.
  const par = useMemo(() => (puzzle.type === "push" ? pushParFor(puzzle) : null), [puzzle]);
  // Stage 3 (display only, no stamp): the stuck hint on the levels that have it (Easy, Normal): a crate on a square
  // it can never leave for a mark is tinted, and the push that put it there plays push.stuck.
  const dead = useMemo(() => (stuckHintOn(puzzle) ? pushDeadSquares(walls, targets) : null), [puzzle, walls, targets]);
  const stuck = useMemo(() => (dead ? stuckCrates(replay.state.crates, dead) : undefined), [dead, replay.state.crates]);

  useEffect(() => {
    onDraftAnswer?.(encodePushMoves(moves));
  }, [moves, onDraftAnswer]);

  useEffect(() => {
    if (locked || submitted.current || !replay.solved) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encodePushMoves(moves));
  }, [replay.solved, moves, locked, onSubmit]);

  const step = (dir: SlideDir) => {
    if (locked || submitted.current || replay.solved) return;
    const result = movePusher(replay.state, dir, new Set(walls));
    if (!result.moved) return puzzleReject();
    const home = cratesOnTargets(result.state.crates, targets);
    soundCue(result.pushed ? "push.push" : "push.step");
    if (home > replay.cratesOnTargets && home < targets.length) soundCue("push.home");
    if (dead && result.pushed && result.state.crates.some((cell, index) => dead.has(cell) && cell !== replay.state.crates[index])) soundCue("push.stuck");
    if (gold && !goldHome && result.state.crates[gold.crate] === gold.target) playCorrect();
    // The Pattern overhaul (15 Nov 2026, sound only): the gold crate pushed off its gold mark.
    if (gold && goldHome && result.state.crates[gold.crate] !== gold.target) {
      soundCue("push.goldOff");
      setGoldOff((key) => key + 1);
    }
    setMoveFx(true);
    setMoves((current) => [...current, dir]);
  };

  const swipe = useSwipe(step, { disabled: locked || replay.solved });

  const undo = () => setMoves((current) => current.slice(0, -1));
  const reset = () => setMoves([]);
  // Undo and Reset as the buttons and keys run them: a crate they put back on a mark lands quietly (no thump or glow).
  const undoMove = () => {
    setMoveFx(false);
    undo();
  };
  const resetMoves = () => {
    setMoveFx(false);
    reset();
  };

  // Desktop keys: Z or Backspace = Undo, R = Reset (the arrows and WASD step through ArrowPad).
  useGameKeys((kind, key, event) => {
    const used = key === "z" || key === "Backspace" || key === "r";
    if (!used || kind !== "down" || event.repeat) return used;
    if (locked || !moves.length) return true;
    if (key === "r") resetMoves();
    else undoMove();
    return true;
  });

  if (puzzle.type !== "push") return null;

  return (
    <div data-stage-column="2" data-polish="push" className="flex min-h-0 flex-1 flex-col gap-2">
      {inFrame ? null : (
        <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
          pushes <span className="text-primary">{replay.pushes}</span>
          {par ? ` · par ${par}` : ""} · moves {replay.moves} · {replay.cratesOnTargets} / {targets.length} home
        </p>
      )}
      <div
        data-game-arena="board" className="flex min-h-0 flex-1 items-center justify-center touch-none"
        style={{ touchAction: "none" }}
        {...swipe}
      >
        <Board
          walls={walls}
          targets={targets}
          crates={replay.state.crates}
          pusher={replay.state.pusher}
          facing={moves.at(-1)}
          solveFx={solveFx}
          gold={gold}
          lit={replay.solved}
          goldOff={goldOff}
          moveFx={moveFx}
          stuck={stuck}
        />
      </div>
      <FramePills
        testId="push"
        items={[
          // The Pattern overhaul (15 Nov 2026): Pushes and Par (red once over par), as the other Pattern games show.
          ...(par ? parPills("Pushes", replay.pushes, par, "pushes") : [{ id: "pushes", label: "Pushes", value: replay.pushes }]),
          gold ? { id: "gold", label: "Gold crate", value: goldHome ? "on its mark" : "not yet", ...(goldHome ? { tone: "good" as const } : {}) } : null,
        ]}
      />
        <ArrowPad modeSwitch={false} onPress={step} disabled={locked || replay.solved} />
      <div data-game-controls="actions" className="flex shrink-0 justify-center gap-3 px-2">
        <button
          type="button"
          disabled={locked || !moves.length}
          onClick={undoMove}
          className="h-11 rounded-xl border border-border px-5 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          disabled={locked || !moves.length}
          onClick={resetMoves}
          className="h-11 rounded-xl border border-border px-5 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

const ARROW: Partial<Record<SlideDir, string>> = { U: "↑", D: "↓", L: "←", R: "→" };

/** The reveal's two views on the template's control (G4). */
const PUSH_REVEAL_VIEWS = [
  { id: "solution", label: "Solution" },
  { id: "yours", label: "Yours" },
] as const;

/** A stored figure from the grade (`extra`), when it is a number. */
function storedNumber(extra: Record<string, unknown> | null | undefined, key: string): number | null {
  const v = extra?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * The answer reveal (the Pattern overhaul, 15 Nov 2026). Two labelled columns for the reveal's Solution / Yours switch
 * (SolutionSwitch), one board at a time at full size: the minimum solution playing back with its pushes as arrow chips,
 * and the player's own final warehouse with the crates not home outlined red and the marks left empty ringed. The key
 * numbers (par, the player's pushes, crates home, the gold crate, time left) come from the stored grade; the replay only
 * stands in on a row stored without them. Any stamp reads the same stored fields.
 */
function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining, myExtra, onWin }: PuzzleRevealProps) {
  const isPush = puzzle.type === "push";
  // Stage 2: the solve's payoff, the reveal's win moment, once (the template plays the effects kit's win; the polish
  // plan's G4, 27 Nov 2026: a callback, so the board never reaches outside its own reveal).
  const won = Boolean(myCorrect && isPush);
  const revealRef = useRef<HTMLDivElement>(null);
  const onWinRef = useRef(onWin);
  onWinRef.current = onWin;
  useEffect(() => {
    if (won) onWinRef.current?.();
  }, [won]);
  // Solution and Yours on the template's views control (G4), one board at a time at the stage's size.
  const shown = useRevealViews(PUSH_REVEAL_VIEWS);
  // Outside the template (a replay, a bare render) there is no control: both boards are drawn, as before G4.
  const hosted = useRevealHosted();
  const boardRef = useRef<HTMLDivElement>(null);
  const fitWidth = useRevealBoardWidth(revealRef, boardRef, { max: 400 });
  const fitStyle = fitWidth ? { width: fitWidth } : undefined;
  const solution = isPush ? decodePushSolution(puzzle.solution ?? "") : [];
  const frames = useMemo(
    () => (isPush ? pushSolutionFrames(puzzle.crates, solution) : []),
    // The stored solution never changes while the reveal is on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPush],
  );
  const [frame, setFrame] = useState(0);

  // The minimum solution plays back over about three seconds, after a short pause on the start.
  useEffect(() => {
    if (frames.length < 2) return;
    setFrame(0);
    const gap = Math.max(120, Math.round(3000 / (frames.length - 1)));
    let id: ReturnType<typeof setInterval> | null = null;
    const wait = setTimeout(() => {
      id = setInterval(() => setFrame((value) => (value + 1 < frames.length ? value + 1 : value)), gap);
    }, 600);
    return () => {
      clearTimeout(wait);
      if (id !== null) clearInterval(id);
    };
  }, [frames.length]);

  if (!isPush) return null;

  const gold = (puzzle.pushRev ?? 0) >= 1 ? puzzle.gold : undefined;
  const available = solution.length > 0 && frames.length === solution.length + 1;
  const at = Math.min(frame, Math.max(0, frames.length - 1));
  const crates = frames[at] ?? puzzle.crates;
  const lastPush = at > 0 ? solution[at - 1] : undefined;
  const pusherCell = lastPush?.cell ?? puzzle.pusher;

  const mine = myAnswer !== null ? replayPush(puzzle.walls, puzzle.targets, puzzle.pusher, puzzle.crates, decodePushMoves(myAnswer)) : null;
  const missedCrates = mine ? mine.state.crates.flatMap((cell, index) => (puzzle.targets.includes(cell) ? [] : [index])) : [];
  const emptyMarks = mine ? puzzle.targets.filter((cell) => !mine.state.crates.includes(cell)) : [];

  // The key numbers, from the stored grade.
  const par = storedNumber(myExtra, "minPushes") ?? puzzle.minPushes ?? (solution.length || null);
  const pushes = storedNumber(myExtra, "pushes") ?? mine?.pushes ?? null;
  const total = storedNumber(myExtra, "crates") ?? puzzle.targets.length;
  const home = storedNumber(myExtra, "cratesHome") ?? (mine ? cratesOnTargets(mine.state.crates, puzzle.targets) : null);
  const storedGold = myExtra?.["goldHome"];
  const goldHome = typeof storedGold === "boolean" ? storedGold : null;
  const timeLeft = myCorrect && typeof myMsRemaining === "number" ? Math.max(0, Math.round(myMsRemaining / 1000)) : null;
  // The player's own numbers sit under Yours only, so nothing below the solution reads as the solution's.
  const yoursHidden = Boolean(hosted && available && mine !== null && shown === "solution");

  const solutionBoard = (
    <div className="push-reveal-space">
      <div ref={shown === "solution" ? boardRef : undefined} className="push-reveal-board" data-push-reveal-step={at} style={fitStyle}>
        <Board walls={puzzle.walls} targets={puzzle.targets} crates={crates} pusher={pusherCell} facing={lastPush?.dir} gold={gold} />
      </div>
    </div>
  );
  const yoursBoard = mine ? (
    <div className="push-reveal-space">
      <div ref={shown === "yours" || !available ? boardRef : undefined} className="push-reveal-board" data-push-yours-board={myCorrect ? "solved" : "unfinished"} style={fitStyle}>
        <WarehouseBoard
          walls={puzzle.walls}
          targets={puzzle.targets}
          crates={mine.state.crates}
          pusher={mine.state.pusher}
          cols={PUSH_COLS}
          cells={PUSH_CELLS}
          gold={gold}
          missed={myCorrect ? undefined : { crates: missedCrates, marks: emptyMarks }}
        />
      </div>
    </div>
  ) : null;
  const route = available ? (
    <div className="push-route" data-push-route={solution.length} aria-label={`The ${solution.length} pushes`}>
      {solution.map((move, index) => (
        <span key={index} className="push-route-chip" data-done={index < at ? "" : undefined} data-active={index === at - 1 ? "" : undefined}>
          {ARROW[move.dir]}
        </span>
      ))}
    </div>
  ) : null;

  return (
    <div ref={revealRef} className="push-reveal flex w-full flex-col items-center gap-2">
      {available && yoursBoard ? (
        <div className="push-reveal-pair flex w-full items-start justify-center gap-3">
          <div hidden={hosted && shown !== "solution"} className="flex min-w-0 flex-1 flex-col items-center gap-2" data-push-solution="">
            <span className={`push-reveal-label${hosted ? " sr-only" : ""}`}>Solution</span>
            {solutionBoard}
            {route}
          </div>
          <div hidden={hosted && shown !== "yours"} className="flex min-w-0 flex-1 flex-col items-center gap-2" data-push-yours="">
            <span className={`push-reveal-label${hosted ? " sr-only" : ""}`}>Yours</span>
            {yoursBoard}
            {!myCorrect && missedCrates.length ? (
              <p className="push-reveal-note" data-push-missed-count={missedCrates.length}>
                {missedCrates.length === 1 ? "1 crate" : `${missedCrates.length} crates`} not on a mark (red); empty marks ringed
              </p>
            ) : null}
          </div>
        </div>
      ) : available ? (
        <>
          {solutionBoard}
          {route}
        </>
      ) : yoursBoard ? (
        yoursBoard
      ) : (
        <div className="push-reveal-space">
          <div ref={boardRef} className="push-reveal-board" style={fitStyle}>
            <Board walls={puzzle.walls} targets={puzzle.targets} crates={puzzle.crates} pusher={puzzle.pusher} gold={gold} />
          </div>
        </div>
      )}
      {!available && <p className="push-reveal-note">Solution unavailable</p>}
      <div className="push-reveal-keys" data-push-keys="">
        {par ? (
          <span className="push-key" data-push-key="par">
            Par <span className="push-key-value">{par}</span>
          </span>
        ) : null}
        {pushes !== null ? (
          <span className="push-key" data-push-key="pushes" data-yours-only="" hidden={yoursHidden}>
            You <span className="push-key-value">{pushes}</span>
          </span>
        ) : null}
        {home !== null ? (
          <span className="push-key" data-push-key="home" data-yours-only="" hidden={yoursHidden}>
            Home <span className="push-key-value">{home} / {total}</span>
          </span>
        ) : null}
        {gold && goldHome !== null ? (
          <span className="push-key" data-push-key="gold" data-yours-only="" hidden={yoursHidden}>
            Gold crate <span className="push-key-value">{goldHome ? "on its mark" : "not home"}</span>
          </span>
        ) : null}
        {timeLeft !== null ? (
          <span className="push-key" data-push-key="time" data-yours-only="" hidden={yoursHidden}>
            Time left <span className="push-key-value">{timeLeft} s</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Layouts come from the curated bank; the minimum and solution stay server-side. */
export const pushPuzzle: PuzzleDefinition = {
  key: "push",
  name: gameDisplayName("push"),
  category: "pattern",
  timeLimitMs: PUSH_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({ type: "push", walls: [], crates: [], targets: [], pusher: 0 }) satisfies PushPuzzleData,
  check: () => false,
  revealHeading: "The minimum solution",
  IntroExample,
  Stage,
  Reveal,
};
