import { puzzleReject } from "@/lib/fx/puzzleReject";
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
import { useStageState } from "@/lib/duel/stageState";
import {
  PUSH_CELLS,
  PUSH_COLS,
  PUSH_TIME_MS,
  type SlideDir,
  type PushPuzzleData,
} from "@/lib/duel/types";
import { playCorrect } from "@/lib/sound";

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
}: {
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
    />
  );
}

/** Fixed intro example — never randomised. */
function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Push every crate onto a hatched floor marking. You can only push - never pull - and only one crate at a
        time.
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
        Fewer pushes earns a bonus. You have 120 seconds.
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

  const replay = useMemo(
    () => replayPush(walls, targets, startPusher, startCrates, moves),
    [walls, targets, startPusher, startCrates, moves],
  );

  const solveFx = useSolveMoment(replay.solved, "push.solve");

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
    setMoves((current) => [...current, dir]);
  };

  const swipe = useSwipe(step, { disabled: locked || replay.solved });

  if (puzzle.type !== "push") return null;

  return (
    <div data-stage-column="2" data-polish="push" className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        pushes <span className="text-primary">{replay.pushes}</span> · moves {replay.moves} ·{" "}
        {replay.cratesOnTargets} / {targets.length} home
      </p>
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
        />
      </div>
        <ArrowPad onPress={step} disabled={locked || replay.solved} />
      <div data-game-controls="actions" className="flex shrink-0 justify-center gap-3 px-2">
        <button
          type="button"
          disabled={locked || !moves.length}
          onClick={() => setMoves((current) => current.slice(0, -1))}
          className="h-11 rounded-xl border border-border px-5 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          disabled={locked || !moves.length}
          onClick={() => setMoves([])}
          className="h-11 rounded-xl border border-border px-5 font-mono text-xs uppercase tracking-widest text-muted-foreground disabled:opacity-40"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  const isPush = puzzle.type === "push";
  const solution = isPush ? decodePushSolution(puzzle.solution ?? "") : [];
  const frames = useMemo(
    () => (isPush ? pushSolutionFrames(puzzle.crates, solution) : []),
    // The stored solution never changes while the reveal is on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPush],
  );
  const [frame, setFrame] = useState(0);

  // The minimum solution plays back over about three seconds.
  useEffect(() => {
    if (myCorrect || frames.length < 2) return;
    const gap = Math.max(120, Math.round(3000 / (frames.length - 1)));
    const timer = setInterval(() => {
      setFrame((value) => (value + 1 < frames.length ? value + 1 : value));
    }, gap);
    return () => clearInterval(timer);
  }, [frames.length, myCorrect]);

  if (!isPush) return null;

  const crates = frames[Math.min(frame, Math.max(0, frames.length - 1))] ?? puzzle.crates;
  const pusherCell = solution[Math.max(0, frame - 1)]?.cell ?? puzzle.pusher;
  const mine = replayPush(
    puzzle.walls,
    puzzle.targets,
    puzzle.pusher,
    puzzle.crates,
    decodePushMoves(myAnswer ?? ""),
  );
  const min = puzzle.minPushes ?? solution.length;
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((timeLimitMs - myMsRemaining) / 100) / 10;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-3">
      <div className="push-reveal-space flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3">
        <div className="push-reveal-board">
        <Board walls={puzzle.walls} targets={puzzle.targets} crates={myCorrect ? mine.state.crates : crates} pusher={myCorrect ? mine.state.pusher : pusherCell} />
        </div>
      <p className="font-mono text-base uppercase tracking-widest text-muted-foreground">
        minimum · {min} push{min === 1 ? "" : "es"}
      </p>
      <p className="font-mono text-base uppercase tracking-widest text-muted-foreground">
        {myCorrect
          ? `✓ ${mine.pushes} push${mine.pushes === 1 ? "" : "es"}${elapsed === null ? "" : ` · ${elapsed.toFixed(1)}s`}`
          : `✗ ${cratesOnTargets(mine.state.crates, puzzle.targets)} / ${puzzle.targets.length} crates home`}
      </p>
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
