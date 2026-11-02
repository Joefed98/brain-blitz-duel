import { useMemo, useRef } from "react";

import { gameDisplayName } from "@/lib/duel/gameNames";
import {
  BF_CHECKPOINT_INTERVAL, BF_CORE_FULL, BF_INPUT_DOWN, BF_INPUT_DROP, BF_INPUT_HOLD, BF_INPUT_MOVE, BF_INPUT_TURN, BLOCKFALL_REV, bfApply, bfCheckpoint,
  bfInit, type BfState,
} from "@/lib/arcade/blockfall";
import { BF_BG, BF_CELL, BF_WORLD_H, BF_WORLD_W, bfNewView, bfPadAt, blockfallArtGame, blockfallScene, drawBlockfall, type BfPadId } from "@/lib/arcade/blockfall.renderer";
import { encodeBlockfallRun, replayBlockfallRun } from "@/lib/duel/blockfall";
import { BLOCKFALL_TIME_MS, type BlockfallPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import { CardStill } from "@/components/puzzles/CardStill";
import { blockfallSounds } from "@/lib/fx/gameSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** The intro still: a fixed hand-placed stack on seed 7, a piece turned over its landing place. */
function introState(): BfState {
  let s = bfInit(7);
  const moves: [number, number][] = [
    [BF_INPUT_MOVE, -4], [BF_INPUT_DROP, 0], [BF_INPUT_MOVE, 3], [BF_INPUT_DROP, 0], [BF_INPUT_TURN, 1], [BF_INPUT_MOVE, -2], [BF_INPUT_DROP, 0],
    [BF_INPUT_MOVE, 2], [BF_INPUT_DROP, 0], [BF_INPUT_HOLD, 0], [BF_INPUT_TURN, 1], [BF_INPUT_MOVE, 1],
  ];
  for (const [k, a] of moves) s = bfApply({ ...s, tick: s.tick + 1 }, { k, a });
  return { ...s, piece: { ...s.piece, y: s.piece.y + 6 }, clearTick: -100 };
}

function IntroExample() {
  return (
    <CardStill
      width={BF_WORLD_W}
      height={BF_WORLD_H}
      draw={(ctx, size) => drawBlockfall(ctx, introState(), size)}
      caption="Drag sideways to move, tap to turn, flick down to drop (or use the pads). Fill a row to clear it."
    />
  );
}

/** A drag's gesture: where it went down, the columns and rows already sent, and its last few points for a flick. */
interface Gesture {
  x: number;
  y: number;
  at: number;
  cols: number;
  rows: number;
  moved: boolean;
  /** A press that started on a pad (HOLD, TURN, DROP): a tap there sends that input, and no drag moves the piece. */
  pad: BfPadId | null;
  trail: { y: number; at: number }[];
}

/** A flick down: at least this fast (world px a ms) over the last 120 ms, and this far. */
const FLICK_SPEED = 0.7;
const FLICK_MIN = 40;
const TAP_MOVE = 10;

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: BlockfallPuzzleData | null = puzzle.type === "blockfall" ? puzzle : null;
  const view = useMemo(() => bfNewView(), []);
  const game = useMemo(() => blockfallArtGame(view), [view]);
  const g = useRef<Gesture | null>(null);

  const pointer = (kind: "down" | "move" | "up", x: number, y: number): PointerPayload | null => {
    const now = performance.now();
    if (kind === "down") {
      const pad = bfPadAt(x, y);
      g.current = { x, y, at: now, cols: 0, rows: 0, moved: false, pad, trail: [{ y, at: now }] };
      view.pressed = pad;
      return null;
    }
    const s = g.current;
    if (!s) return null;
    const dx = x - s.x;
    const dy = y - s.y;
    if (Math.abs(dx) > TAP_MOVE || Math.abs(dy) > TAP_MOVE) s.moved = true;
    s.trail.push({ y, at: now });
    while (s.trail.length > 2 && now - s.trail[0]!.at > 120) s.trail.shift();
    if (kind === "move") {
      if (s.pad) {
        view.pressed = bfPadAt(x, y) === s.pad ? s.pad : null;
        return null;
      }
      // Sideways: one move event for the columns crossed since the last one.
      const cols = Math.trunc(dx / BF_CELL);
      if (cols !== s.cols && Math.abs(dx) >= Math.abs(dy) * 0.7) {
        const step = cols - s.cols;
        s.cols = cols;
        return { k: BF_INPUT_MOVE, a: step, b: 0, c: 0 };
      }
      // A slow drag down steps the piece down a row at a time.
      const rows = Math.max(0, Math.trunc(dy / BF_CELL));
      if (rows > s.rows && dy > Math.abs(dx)) {
        s.rows = rows;
        return { k: BF_INPUT_DOWN, a: 0, b: 0, c: 0 };
      }
      return null;
    }
    g.current = null;
    view.pressed = null;
    if (s.pad) {
      if (bfPadAt(x, y) !== s.pad) return null;
      if (s.pad === "hold") return { k: BF_INPUT_HOLD, a: 0, b: 0, c: 0 };
      if (s.pad === "drop") return { k: BF_INPUT_DROP, a: 0, b: 0, c: 0 };
      return { k: BF_INPUT_TURN, a: 1, b: 0, c: 0 };
    }
    if (!s.moved) return { k: BF_INPUT_TURN, a: 1, b: 0, c: 0 };
    const first = s.trail[0]!;
    const speed = (y - first.y) / Math.max(1, now - first.at);
    if (dy > FLICK_MIN && dy > Math.abs(dx) && speed > FLICK_SPEED) return { k: BF_INPUT_DROP, a: 0, b: 0, c: 0 };
    return null;
  };

  return (
    <ArcadeCanvasStage
      diagKey="blockfall"
      label={`${gameDisplayName("blockfall")}: drag to move, tap to turn, flick down to drop`}
      background={BF_BG}
      fitWorld
      scene={blockfallScene}
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={BF_WORLD_W}
      worldH={BF_WORLD_H}
      game={game}
      sounds={blockfallSounds}
      checkpoint={bfCheckpoint}
      interval={BF_CHECKPOINT_INTERVAL}
      encodeRun={encodeBlockfallRun}
      discrete
      inputKind={BF_INPUT_MOVE}
      pointer={pointer}
      keys={(kind, key, send) => {
        if (kind !== "down") return ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "c", "x", "z"].includes(key);
        if (key === "ArrowLeft") send({ k: BF_INPUT_MOVE, a: -1, b: 0, c: 0 });
        else if (key === "ArrowRight") send({ k: BF_INPUT_MOVE, a: 1, b: 0, c: 0 });
        else if (key === "ArrowUp" || key === "x") send({ k: BF_INPUT_TURN, a: 1, b: 0, c: 0 });
        else if (key === "z") send({ k: BF_INPUT_TURN, a: -1, b: 0, c: 0 });
        else if (key === "ArrowDown") send({ k: BF_INPUT_DOWN, a: 0, b: 0, c: 0 });
        else if (key === " ") send({ k: BF_INPUT_DROP, a: 0, b: 0, c: 0 });
        else if (key === "c") send({ k: BF_INPUT_HOLD, a: 0, b: 0, c: 0 });
        else return false;
        return true;
      }}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function blockfallLine(r: { lines: number; doubles: number; triples: number; quads: number }): string {
  return `${r.lines} lines (full at ${BF_CORE_FULL}) · ${r.doubles + r.triples + r.quads} multi-line clears`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "blockfall") return null;
  const result = replayBlockfallRun(puzzle.seed, myAnswer ?? "", puzzle.blockfallRev);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-2 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">{blockfallLine(result)}</p>
      {result.parts.map((part) => (
        <p key={part.key} className="shrink-0 text-center font-mono text-sm text-foreground">{`${part.label}: ${part.detail}`}</p>
      ))}
      <p className="shrink-0 text-center font-mono text-sm text-muted-foreground">Same pieces for everyone</p>
    </div>
  );
}

/** The seed is dealt on the server from the proved deal; every run is replayed there for scoring. */
export const blockfallPuzzle: PuzzleDefinition = {
  key: "blockfall",
  name: gameDisplayName("blockfall"),
  category: "arcade",
  timeLimitMs: BLOCKFALL_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "blockfall", seed: 1, blockfallRev: BLOCKFALL_REV }) satisfies BlockfallPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
