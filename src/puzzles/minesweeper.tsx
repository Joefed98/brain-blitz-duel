import { useRef, useState } from "react";

import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import { ArcadeControlButton } from "@/components/puzzles/ArcadeControlButton";
import { minesweeperFill } from "@/lib/arcade/arenaFills.renderer";
import {
  minesCellAt,
  minesCheckpoint,
  MINES_CELL,
  MINES_CHECKPOINT_INTERVAL,
  MINES_INPUT_TAP,
  MINES_MODE_FLAG,
  MINES_MODE_REVEAL,
  MINES_REV_STD,
  MINES_RUN_TICKS,
  MINES_SAFE,
  MINES_WORLD_H,
  MINES_WORLD_W,
  type MinesState,
} from "@/lib/arcade/minesweeper";
import { MINES_ART, minesweeperArtGameFor, paintMinesCover, paintMinesFlag, paintMinesNumber, paintMinesOpen } from "@/lib/arcade/minesweeper.renderer";
import { TICKS_PER_SECOND } from "@/lib/arcade/engine";
import { encodeMinesweeperRun, replayMinesweeperRun } from "@/lib/duel/minesweeper";
import { gameDisplayName } from "@/lib/duel/gameNames";
import type { MinesweeperPuzzleData } from "@/lib/duel/types";
import { expansionSounds } from "@/lib/fx/expansionSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { canvasRatio } from "@/lib/battery";

/** A press held this long flags the square instead of revealing it (ms). */
const LONG_PRESS_MS = 380;

/** Reveals tick, mines hit zap, flags tick quietly, the clear chimes. */
function minesSounds() {
  const watch = expansionSounds<MinesState>([
    { count: (s) => s.reveals + s.chords, sound: "tick", volume: 0.6 },
    { count: (s) => s.hits, sound: "zap" },
    { count: (s) => s.flags, sound: "tick", volume: 0.35 },
    { count: (s) => (s.clearedTick > 0 ? 1 : 0), sound: "chime" },
  ]);
  return { frame: (state: MinesState, running: boolean) => watch(state, running || state.clearedTick === state.tick), stop: () => {} };
}

/** Fixed intro still: a corner of the board with an opening, numbers, a flag and covered squares. */
function IntroExample() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const draw = (canvas: HTMLCanvasElement | null) => {
    ref.current = canvas;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const ratio = canvasRatio();
    canvas.width = 180 * ratio;
    canvas.height = 126 * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = MINES_ART.slate;
    ctx.fillRect(0, 0, 180, 126);
    const size = 30;
    // 6 × 4: an opening on the left, its numbered edge, a flag and covered squares.
    const grid = ["00112F", "00113C", "0012CC", "011FCC"];
    grid.forEach((row, r) =>
      [...row].forEach((ch, c) => {
        const x = c * size;
        const y = 3 + r * size;
        if (ch === "C" || ch === "F") {
          paintMinesCover(ctx, x, y, size);
          if (ch === "F") paintMinesFlag(ctx, x, y, size);
        } else {
          paintMinesOpen(ctx, x, y, size);
          paintMinesNumber(ctx, Number(ch), x + size / 2, y + size / 2, size);
        }
      }),
    );
  };
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <canvas ref={draw} aria-hidden="true" style={{ width: 180, height: 126, borderRadius: 10, background: MINES_ART.slate }} />
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: MinesweeperPuzzleData | null = puzzle.type === "minesweeper" ? puzzle : null;
  const [mode, setMode] = useState<number>(MINES_MODE_REVEAL);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  /** The pressed square, when the press began and whether a long press already flagged it. */
  const press = useRef<{ cell: number; timer: ReturnType<typeof setTimeout> | null; flagged: boolean } | null>(null);
  const sendRef = useRef<((payload: PointerPayload) => void) | null>(null);
  const game = minesweeperArtGameFor(data?.minesRev);

  const clearPress = () => {
    if (press.current?.timer) clearTimeout(press.current.timer);
    press.current = null;
  };

  const pointer = (kind: "down" | "move" | "up", x: number, y: number): PointerPayload | null => {
    if (kind === "down") {
      clearPress();
      const cell = minesCellAt(x, y);
      if (cell < 0) return null;
      const held = { cell, timer: null as ReturnType<typeof setTimeout> | null, flagged: false };
      held.timer = setTimeout(() => {
        if (press.current !== held) return;
        held.flagged = true;
        // A long press flags (or unflags) whatever the switch says.
        sendRef.current?.({ k: MINES_INPUT_TAP, a: cell, b: MINES_MODE_FLAG, c: 0 });
        if (typeof navigator !== "undefined") navigator.vibrate?.(12);
      }, LONG_PRESS_MS);
      press.current = held;
      return null;
    }
    if (kind === "move") {
      // Sliding off the square cancels the press.
      if (press.current && minesCellAt(x, y) !== press.current.cell) clearPress();
      return null;
    }
    const held = press.current;
    clearPress();
    if (!held || held.flagged || minesCellAt(x, y) !== held.cell) return null;
    return { k: MINES_INPUT_TAP, a: held.cell, b: modeRef.current, c: 0 };
  };

  const segment = (value: number, label: string) => {
    const on = mode === value;
    return (
      <ArcadeControlButton
        type="button"
        aria-label={label}
        aria-pressed={on}
        disabled={locked}
        className={`h-[52px] w-full rounded-xl border-2 p-0 text-[15px] font-extrabold tracking-wide ${on ? "border-primary bg-primary/25 text-primary shadow-[0_0_14px_rgba(245,184,46,0.3)] hover:bg-primary/25" : "border-white/15 bg-background/40 text-muted-foreground hover:bg-background/40"}`}
        onPressStart={() => setMode(value)}
      >
        {label === "Flag" ? "⚑ Flag" : "Reveal"}
      </ArcadeControlButton>
    );
  };

  return (
    <div data-stage-column="2" className="flex min-h-0 w-full flex-1 flex-col gap-2">
      <ArcadeCanvasStage
        diagKey="minesweeper"
        scene={minesweeperFill}
        label={`${gameDisplayName("minesweeper")}: tap to reveal, long press to flag`}
        background={MINES_ART.bg}
        fitWorld
        seed={data?.seed ?? 1}
        enabled={data !== null}
        locked={locked}
        worldW={MINES_WORLD_W}
        worldH={MINES_WORLD_H}
        game={game}
        sounds={minesSounds}
        checkpoint={minesCheckpoint}
        interval={MINES_CHECKPOINT_INTERVAL}
        encodeRun={encodeMinesweeperRun}
        inputKind={MINES_INPUT_TAP}
        discrete
        pointer={pointer}
        keys={(kind, key) => {
          // F switches between Reveal and Flag.
          if (key === "f" || key === "F") {
            if (kind === "down") setMode((m) => (m === MINES_MODE_FLAG ? MINES_MODE_REVEAL : MINES_MODE_FLAG));
            return true;
          }
          return false;
        }}
        footer={(send) => {
          sendRef.current = send;
          return (
            <div data-game-controls="mode" className="grid h-[52px] shrink-0 touch-none select-none grid-cols-2 gap-3" role="group" aria-label="Tap mode">
              {segment(MINES_MODE_REVEAL, "Reveal")}
              {segment(MINES_MODE_FLAG, "Flag")}
            </div>
          );
        }}
        onSubmit={(answer) => onSubmit(answer)}
        onDraftAnswer={onDraftAnswer}
      />
    </div>
  );
}

export function minesweeperLine(r: { revealed: number; opening: number; hits: number; cleared: boolean; clearedSeconds: number }): string {
  const head = `${r.revealed - r.opening} of ${MINES_SAFE - r.opening} safe squares`;
  const hits = r.hits === 0 ? "no mine hit" : `${r.hits} ${r.hits === 1 ? "mine" : "mines"} hit`;
  return r.cleared ? `${head} · cleared in ${r.clearedSeconds.toFixed(1)}s · ${hits}` : `${head} · ${hits}`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "minesweeper") return null;
  const result = replayMinesweeperRun(puzzle.seed, myAnswer ?? "", puzzle.minesRev);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">{minesweeperLine(result)}</p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same board for everyone · {result.flags} flags</p>
    </div>
  );
}

/** The board is dealt in the sim from the stored seed; every run is replayed on the server for scoring. */
export const minesweeperPuzzle: PuzzleDefinition = {
  key: "minesweeper",
  name: gameDisplayName("minesweeper"),
  category: "arcade",
  timeLimitMs: (MINES_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "minesweeper", seed: 1, minesRev: MINES_REV_STD }) satisfies MinesweeperPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};

export { MINES_CELL };
