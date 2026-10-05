import { useEffect, useMemo, useRef, useState } from "react";

import { ArrowPad, useSwipe } from "@/components/puzzles/GridDrag";
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
}: {
  walls: number[];
  targets: number[];
  crates: number[];
  pusher: number;
  cols?: number;
  cells?: number;
}) {
  const rows = Math.ceil(cells / cols);
  const wall = new Set(walls);

  const crate = new Set(crates);

  return (
    <div className="relative mx-auto aspect-square h-full max-h-full w-full max-w-full">
      <div
        className="grid h-full w-full"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          gap: 2,
        }}
      >
        {/* Every piece is a centred child of its own cell, so nothing can drift. */}
        {Array.from({ length: cols * rows }, (_, cell) => {
          if (wall.has(cell)) return <div key={cell} className="rounded-md bg-foreground/70" />;
          const onTarget = targets.includes(cell);
          const hasCrate = crate.has(cell);
          const hasPusher = cell === pusher;
          return (
            <div
              key={cell}
              className={`flex items-center justify-center rounded-[3px] bg-card ${
                onTarget ? "border-2 border-primary/70" : "border border-border/50"
              }`}
            >
              {hasCrate && (
                <span
                  aria-label={onTarget ? "Crate home" : "Crate"}
                  className="block rounded-[15%]"
                  style={{
                    width: "80%",
                    height: "80%",
                    backgroundColor: onTarget ? "var(--primary)" : "#B07B4F",
                  }}
                />
              )}
              {hasPusher && !hasCrate && (
                <span
                  aria-label="You"
                  className="block rounded-full bg-primary"
                  style={{ width: "70%", height: "70%" }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Fixed intro example — never randomised. */
function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-muted-foreground">
        Push every crate onto a target. You can only push — never pull — and only one crate at a
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
    if (!result.moved) return;
    setMoves((current) => [...current, dir]);
  };

  const swipe = useSwipe(step, { disabled: locked || replay.solved });

  if (puzzle.type !== "push") return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        pushes <span className="text-primary">{replay.pushes}</span> · moves {replay.moves} ·{" "}
        {replay.cratesOnTargets} / {targets.length} home
      </p>
      <div
        className="flex min-h-0 flex-1 items-center justify-center touch-none"
        style={{ touchAction: "none" }}
        {...swipe}
      >
        <Board
          walls={walls}
          targets={targets}
          crates={replay.state.crates}
          pusher={replay.state.pusher}
        />
      </div>
        <ArrowPad onPress={step} disabled={locked || replay.solved} />
      <div className="flex shrink-0 justify-center gap-2">
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
    if (frames.length < 2) return;
    const gap = Math.max(120, Math.round(3000 / (frames.length - 1)));
    const timer = setInterval(() => {
      setFrame((value) => (value + 1 < frames.length ? value + 1 : value));
    }, gap);
    return () => clearInterval(timer);
  }, [frames.length]);

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
    <div className="flex w-full flex-col items-center gap-3">
      <div style={{ width: 176 }}>
        <Board walls={puzzle.walls} targets={puzzle.targets} crates={crates} pusher={pusherCell} />
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
  );
}

/** Layouts come from the curated bank; the minimum and solution stay server-side. */
export const pushPuzzle: PuzzleDefinition = {
  key: "push",
  name: "Push",
  category: "logic",
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
