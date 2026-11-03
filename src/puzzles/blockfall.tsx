import { useMemo, useRef } from "react";

import { gameDisplayName } from "@/lib/duel/gameNames";
import {
  BF_CHECKPOINT_INTERVAL, BF_INPUT_DOWN, BF_INPUT_DROP, BF_INPUT_HOLD, BF_INPUT_MOVE, BF_INPUT_SOFT, BF_INPUT_TURN, BLOCKFALL_REV_ZONE, bfApply, bfCheckpoint,
  bfCoreFullFor, bzInit, type BfState,
} from "@/lib/arcade/blockfall";
import { BF_BG, BF_WORLD_H, BF_WORLD_W, bfLayout, bfNewView, bfPadAt, blockfallArtGame, blockfallScene, drawBlockfall, type BfPadId } from "@/lib/arcade/blockfall.renderer";
import { encodeBlockfallRun, replayBlockfallRun } from "@/lib/duel/blockfall";
import { BLOCKFALL_TIME_MS, type BlockfallPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import { CardStill } from "@/components/puzzles/CardStill";
import { blockfallSounds } from "@/lib/fx/gameSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** The intro still (Blockzone, blockfallRev 2): a fixed hand-placed stack on seed 7, a piece turned over its landing place. */
export function blockzoneIntroState(): BfState {
  let s = bzInit(7);
  const moves: [number, number][] = [
    [BF_INPUT_MOVE, -4], [BF_INPUT_DROP, 0], [BF_INPUT_MOVE, 3], [BF_INPUT_DROP, 0], [BF_INPUT_TURN, 1], [BF_INPUT_MOVE, -2], [BF_INPUT_DROP, 0],
    [BF_INPUT_MOVE, 2], [BF_INPUT_DROP, 0], [BF_INPUT_MOVE, -3], [BF_INPUT_DROP, 0], [BF_INPUT_TURN, 1], [BF_INPUT_MOVE, 1],
  ];
  for (const [k, a] of moves) s = bfApply({ ...s, tick: s.tick + 1 }, { k, a });
  return { ...s, piece: { ...s.piece, y: s.piece.y + 6 }, clearTick: -100 };
}

function IntroExample() {
  return (
    <CardStill
      width={BF_WORLD_W}
      height={BF_WORLD_H}
      draw={(ctx, size) => drawBlockfall(ctx, blockzoneIntroState(), size)}
      caption="Drag sideways to move, tap to turn, drag down to speed it up, flick down to drop. Fill rows to clear them."
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
  /** Blockzone: the soft drop sent on for this drag. */
  soft: boolean;
  /** The finger's latest y (a lock mid-drag measures the next drag down from here). */
  lastY: number;
}

/** A flick down: at least this fast (world px a ms) over the last 120 ms, and this far. */
const FLICK_SPEED = 0.7;
const FLICK_MIN = 40;
const TAP_MOVE = 10;

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: BlockfallPuzzleData | null = puzzle.type === "blockfall" ? puzzle : null;
  const rev = data?.blockfallRev ?? 1;
  const zone = rev >= BLOCKFALL_REV_ZONE;
  const cell = bfLayout(zone ? BLOCKFALL_REV_ZONE : 1).cell;
  const view = useMemo(() => bfNewView(), []);
  const game = useMemo(() => blockfallArtGame(view, zone ? BLOCKFALL_REV_ZONE : 1), [view, zone]);
  const g = useRef<Gesture | null>(null);
  /**
   * Blockzone's soft drop (3 Nov 2026, Joe's phone note: after a soft drop the next pieces kept falling fast).
   * A drag down that ended in a flick sent only the hard drop, never the soft drop's "off", so the sim kept
   * `soft` on for every later piece. Input mapping only, no stamp: the soft drop is on only while a drag
   * down (or ↓) holds it for the piece it started on; the stage's discreteTick sends the "off" the tick the
   * finger lifts (whatever the release sent), the key is let go or the piece locks.
   */
  const soft = useRef<{ by: "drag" | "key" | null; pieces: number; asked: number }>({ by: null, pieces: -1, asked: 0 });
  const softOn = (by: "drag" | "key"): PointerPayload => {
    soft.current = { by, pieces: -1, asked: 1 };
    return { k: BF_INPUT_SOFT, a: 1, b: 0, c: 0 };
  };
  const softOff = (): PointerPayload | null => {
    const was = soft.current.asked;
    soft.current = { by: null, pieces: -1, asked: 0 };
    return was ? { k: BF_INPUT_SOFT, a: 0, b: 0, c: 0 } : null;
  };
  const discreteTick = (state: BfState): PointerPayload | null => {
    if (!zone) return null;
    const s = soft.current;
    if (s.by !== null && s.pieces < 0) s.pieces = state.pieces;
    if (s.by !== null && state.pieces !== s.pieces) {
      // The piece the soft drop started on has locked: the new one starts at its normal speed, and a drag
      // still down needs to move down again to speed it up.
      const gesture = g.current;
      if (gesture && s.by === "drag") {
        gesture.soft = false;
        gesture.y = gesture.lastY;
      }
      s.by = null;
    }
    if (s.by === null && (state.soft ?? 0) === 1 && s.asked !== 0) {
      s.asked = 0;
      return { k: BF_INPUT_SOFT, a: 0, b: 0, c: 0 };
    }
    if (s.by === null && (state.soft ?? 0) === 0) s.asked = 0;
    return null;
  };

  const pointer = (kind: "down" | "move" | "up", x: number, y: number): PointerPayload | null => {
    const now = performance.now();
    if (kind === "down") {
      // Blockzone has no pads: the whole screen is for gestures.
      const pad = zone ? null : bfPadAt(x, y);
      g.current = { x, y, at: now, cols: 0, rows: 0, moved: false, pad, trail: [{ y, at: now }], soft: false, lastY: y };
      view.pressed = pad;
      return null;
    }
    const s = g.current;
    if (!s) return null;
    const dx = x - s.x;
    const dy = y - s.y;
    if (Math.abs(dx) > TAP_MOVE || Math.abs(dy) > TAP_MOVE) s.moved = true;
    s.trail.push({ y, at: now });
    s.lastY = y;
    while (s.trail.length > 2 && now - s.trail[0]!.at > 120) s.trail.shift();
    if (kind === "move") {
      if (s.pad) {
        view.pressed = bfPadAt(x, y) === s.pad ? s.pad : null;
        return null;
      }
      // Sideways: one move event for the columns crossed since the last one.
      const cols = Math.trunc(dx / cell);
      if (cols !== s.cols && Math.abs(dx) >= Math.abs(dy) * 0.7) {
        const step = cols - s.cols;
        s.cols = cols;
        return { k: BF_INPUT_MOVE, a: step, b: 0, c: 0 };
      }
      // Blockzone: a drag down holds the soft drop on (the piece falls fast) until the finger lifts or turns back.
      if (zone) {
        const down = dy > cell * 0.6 && dy > Math.abs(dx);
        if (down !== s.soft) {
          s.soft = down;
          return down ? softOn("drag") : softOff();
        }
        return null;
      }
      // A slow drag down steps the piece down a row at a time.
      const rows = Math.max(0, Math.trunc(dy / cell));
      if (rows > s.rows && dy > Math.abs(dx)) {
        s.rows = rows;
        return { k: BF_INPUT_DOWN, a: 0, b: 0, c: 0 };
      }
      return null;
    }
    g.current = null;
    view.pressed = null;
    // Lifting ends this drag's soft drop: discreteTick sends the "off" next tick if this release sends a drop.
    if (zone && soft.current.by === "drag") soft.current.by = null;
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
    // Blockzone: the finger lifted off a slow drag down: the soft drop ends.
    if (zone) return softOff();
    return null;
  };

  return (
    <ArcadeCanvasStage
      diagKey="blockfall"
      label={`${gameDisplayName("blockfall")}: drag to move, tap to turn, drag down to fall faster, flick down to drop`}
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
      discreteTick={discreteTick}
      keys={(kind, key, send, _state, event) => {
        if (zone) {
          // Blockzone: ← → move, ↑ turns, ↓ soft-drops while held, Space drops; no hold.
          if (key === "ArrowDown") {
            if (!event.repeat) {
              const payload = kind === "down" ? softOn("key") : softOff();
              if (payload) send(payload);
            }
            return true;
          }
          if (kind !== "down") return ["ArrowLeft", "ArrowRight", "ArrowUp", " ", "x", "z"].includes(key);
          if (key === "ArrowLeft") send({ k: BF_INPUT_MOVE, a: -1, b: 0, c: 0 });
          else if (key === "ArrowRight") send({ k: BF_INPUT_MOVE, a: 1, b: 0, c: 0 });
          else if (key === "ArrowUp" || key === "x") send({ k: BF_INPUT_TURN, a: 1, b: 0, c: 0 });
          else if (key === "z") send({ k: BF_INPUT_TURN, a: -1, b: 0, c: 0 });
          else if (key === " ") send({ k: BF_INPUT_DROP, a: 0, b: 0, c: 0 });
          else return false;
          return true;
        }
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

export function blockfallLine(r: { lines: number; doubles: number; triples: number; quads: number; pieces?: number }, rev?: number | null): string {
  const pieces = (rev ?? 1) >= BLOCKFALL_REV_ZONE ? ` · ${r.pieces ?? 0} pieces` : "";
  return `${r.lines} lines (full at ${bfCoreFullFor(rev)})${pieces} · ${r.doubles + r.triples + r.quads} multi-line clears`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "blockfall") return null;
  const result = replayBlockfallRun(puzzle.seed, myAnswer ?? "", puzzle.blockfallRev);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-2 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">{blockfallLine(result, puzzle.blockfallRev)}</p>
      {result.parts.map((part) => (
        <p key={part.key} className="shrink-0 text-center font-mono text-sm text-foreground">{`${part.label}: ${part.detail}`}</p>
      ))}
      <p className="shrink-0 text-center font-mono text-sm text-muted-foreground">Same pieces for everyone</p>
    </div>
  );
}

/** The seed is dealt on the server from the proved deal (blockfallRev 2, Blockzone); every run is replayed there for scoring. */
export const blockfallPuzzle: PuzzleDefinition = {
  key: "blockfall",
  name: gameDisplayName("blockfall"),
  category: "arcade",
  timeLimitMs: BLOCKFALL_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "blockfall", seed: 1, blockfallRev: BLOCKFALL_REV_ZONE }) satisfies BlockfallPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
