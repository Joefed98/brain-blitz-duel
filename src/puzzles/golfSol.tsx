import { useMemo, useRef } from "react";

import { gameDisplayName } from "@/lib/duel/gameNames";
import { GS_CHECKPOINT_INTERVAL, GS_INPUT_TAP, GS_REV, GS_RUN_FULL, GS_STOCK_PILE, gsCheckpoint, type GsState } from "@/lib/arcade/cards/golfSol";
import { drawGolfSol, golfSolArtGame, gsButtonHit, gsCardBox, gsHit, gsNewView, gsOverFoundation, GS_BG, GS_WORLD_H, GS_WORLD_W } from "@/lib/arcade/cards/golfSol.renderer";
import { cardsFill } from "@/lib/arcade/cards/cardsFill.renderer";
import { encodeGolfSolRun, replayGolfSolRun } from "@/lib/duel/cards";
import { GOLFSOL_TIME_MS, type GolfSolPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import { CardStill } from "@/components/puzzles/CardStill";
import { golfSolSounds } from "@/lib/fx/gameSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

function IntroExample() {
  return <CardStill width={GS_WORLD_W} height={GS_WORLD_H} draw={(ctx, size) => drawGolfSol(ctx, golfSolArtGame().init(0), size)} caption="Play a column’s bottom card one higher or lower than the foundation; draw from the stock when stuck." />;
}

const TAP_SLOP = 10;

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: GolfSolPuzzleData | null = puzzle.type === "golfsol" ? puzzle : null;
  const view = useMemo(() => gsNewView(), []);
  const latest = useRef<GsState | null>(null);
  const start = useRef<{ x: number; y: number; hit: number; moved: boolean } | null>(null);
  const game = useMemo(() => {
    const art = golfSolArtGame(view);
    return { ...art, draw: (ctx: CanvasRenderingContext2D, state: GsState, size: { width: number; height: number }) => { latest.current = state; art.draw(ctx, state, size); } };
  }, [view]);

  const pointer = (kind: "down" | "move" | "up", x: number, y: number): PointerPayload | null => {
    const state = latest.current;
    if (!state) return null;
    if (view.button || kind === "down") {
      const button = gsButtonHit(x, y);
      if (kind === "down" && button) {
        view.button = button;
        start.current = null;
        return null;
      }
      if (view.button) {
        if (kind === "move") return null;
        const held = view.button;
        view.button = 0;
        return button === held ? { k: held, a: 0, b: 0, c: 0 } : null;
      }
    }
    if (kind === "down") {
      const hit = gsHit(state, x, y);
      start.current = hit >= 0 ? { x, y, hit, moved: false } : null;
      view.pressed = hit;
      return null;
    }
    const s = start.current;
    if (!s) return null;
    if (kind === "move") {
      if (!s.moved && s.hit !== GS_STOCK_PILE && Math.hypot(x - s.x, y - s.y) > TAP_SLOP) {
        s.moved = true;
        const b = gsCardBox(s.hit, Math.max(0, state.heights[s.hit]! - 1));
        view.drag = { col: s.hit, x, y, ox: s.x - b.x, oy: Math.min(s.y - b.y, 40) };
      }
      if (view.drag) {
        view.drag.x = x;
        view.drag.y = y;
      }
      return null;
    }
    start.current = null;
    view.pressed = -1;
    view.drag = null;
    // A tap plays (or draws); a drag plays only when dropped on the foundation.
    if (!s.moved || gsOverFoundation(x, y)) return { k: GS_INPUT_TAP, a: s.hit, b: 0, c: 0 };
    return null;
  };

  return (
    <ArcadeCanvasStage
      diagKey="golfsol"
      label={`${gameDisplayName("golfsol")}: tap a column’s bottom card one higher or lower than the foundation, or the stock; Undo and Reset at the bottom`}
      background={GS_BG}
      fitWorld
      scene={cardsFill}
      seed={data?.seed ?? 0}
      enabled={data !== null}
      locked={locked}
      worldW={GS_WORLD_W}
      worldH={GS_WORLD_H}
      game={game}
      sounds={golfSolSounds}
      checkpoint={gsCheckpoint}
      interval={GS_CHECKPOINT_INTERVAL}
      encodeRun={encodeGolfSolRun}
      discrete
      inputKind={GS_INPUT_TAP}
      pointer={pointer}
      keys={(kind, key, send) => {
        if (key === " " || key === "s" || key === "S") {
          if (kind === "down") send({ k: GS_INPUT_TAP, a: GS_STOCK_PILE, b: 0, c: 0 });
          return true;
        }
        const col = Number(key) - 1;
        if (Number.isInteger(col) && col >= 0 && col < 7) {
          if (kind === "down") send({ k: GS_INPUT_TAP, a: col, b: 0, c: 0 });
          return true;
        }
        return false;
      }}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function golfSolLine(r: { cleared: number; finished: boolean; finishSeconds: number }): string {
  return r.finished ? `All 35 cleared in ${r.finishSeconds.toFixed(1)} s` : `${r.cleared} of 35 cleared`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "golfsol") return null;
  const result = replayGolfSolRun(puzzle.seed, myAnswer ?? "", puzzle.golfSolRev);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">{golfSolLine(result)}</p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">{Math.min(result.runs, GS_RUN_FULL)} of {GS_RUN_FULL} runs of five · best run {result.bestRun}</p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same deal for everyone</p>
    </div>
  );
}

/** The deal comes from the server (a bank index, every one proved clearable); every run is replayed there for scoring. */
export const golfSolPuzzle: PuzzleDefinition = {
  key: "golfsol",
  name: gameDisplayName("golfsol"),
  category: "arcade",
  timeLimitMs: GOLFSOL_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "golfsol", seed: 0, golfSolRev: GS_REV }) satisfies GolfSolPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
