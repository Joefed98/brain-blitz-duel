import { useMemo, useRef } from "react";

import { gameDisplayName } from "@/lib/duel/gameNames";
import { FH_CHECKPOINT_INTERVAL, FH_CORE_FULL, FH_INPUT_PICK, FH_INPUT_PLACE, fhPicking, FH_REV, FH_REV_FLAT, FH_REV_STEEP, fhCoreFullFor, FH_ROWS, FH_TURNS, fhApply, fhCheckpoint, fhDeal, type FhState } from "@/lib/arcade/cards/fiveHands";
import { drawFiveHands, fhHitColumn, fhHitRow, fhNewView, fhOnNext, fiveHandsArtGame, FH_BG, FH_WORLD_H, FH_WORLD_W } from "@/lib/arcade/cards/fiveHands.renderer";
import { cardsFill } from "@/lib/arcade/cards/cardsFill.renderer";
import { encodeFiveHandsRun, replayFiveHandsRun } from "@/lib/duel/cards";
import { FIVEHANDS_TIME_MS, type FiveHandsPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import { CardStill } from "@/components/puzzles/CardStill";
import { fiveHandsSounds } from "@/lib/fx/cardSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** The intro still: seed 0's deal seven turns in, placed as its witness places them. */
function introState(): FhState {
  let s = fiveHandsArtGame(undefined, FH_REV).init(0);
  const taps = fhDeal(0, FH_REV).witnessTaps;
  for (let t = 0; t < 7; t++) s = fhApply({ ...s, tick: s.tick + 20 }, taps[t]!) ?? s;
  return { ...s, lastTick: 0 };
}

function IntroExample() {
  return <CardStill width={FH_WORLD_W} height={FH_WORLD_H} draw={(ctx, size) => drawFiveHands(ctx, introState(), size)} caption="Tap a row to place your card. Every row takes one before any row takes the next." />;
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: FiveHandsPuzzleData | null = puzzle.type === "fivehands" ? puzzle : null;
  const view = useMemo(() => fhNewView(), []);
  const latest = useRef<FhState | null>(null);
  const start = useRef<{ fromNext: boolean; row: number } | null>(null);
  const rev = data?.fiveHandsRev ?? 1;
  const game = useMemo(() => {
    const art = fiveHandsArtGame(view, rev);
    return { ...art, draw: (ctx: CanvasRenderingContext2D, state: FhState, size: { width: number; height: number }) => { latest.current = state; art.draw(ctx, state, size); } };
  }, [view, rev]);

  // A tap on a row places your card there; dragging the card onto a row does too. Rev 3: once the rows are complete, a
  // tap on a column picks it (down and up on the same column).
  const pickStart = useRef(-1);
  const pointer = (kind: "down" | "move" | "up", x: number, y: number): PointerPayload | null => {
    if (!latest.current) return null;
    if (fhPicking(latest.current) || pickStart.current >= 0) {
      const col = fhHitColumn(x, y);
      if (kind === "down") {
        pickStart.current = col;
        view.pressedCol = col;
        return null;
      }
      if (kind === "move") {
        view.pressedCol = col === pickStart.current ? col : -1;
        return null;
      }
      const from = pickStart.current;
      pickStart.current = -1;
      view.pressedCol = -1;
      return from >= 0 && col === from && fhPicking(latest.current) ? { k: FH_INPUT_PICK, a: col, b: 0, c: 0 } : null;
    }
    if (kind === "down") {
      const row = fhHitRow(x, y);
      const fromNext = fhOnNext(x, y);
      start.current = row >= 0 || fromNext ? { fromNext, row } : null;
      view.pressed = row;
      return null;
    }
    const s = start.current;
    if (!s) return null;
    if (kind === "move") {
      if (s.fromNext) view.drag = { x, y };
      else view.pressed = fhHitRow(x, y) === s.row ? s.row : -1;
      return null;
    }
    start.current = null;
    view.pressed = -1;
    view.drag = null;
    const row = fhHitRow(x, y);
    if (row < 0 || (!s.fromNext && row !== s.row)) return null;
    return { k: FH_INPUT_PLACE, a: row, b: 0, c: 0 };
  };

  return (
    <ArcadeCanvasStage
      diagKey="fivehands"
      label={`${gameDisplayName("fivehands")}: tap a row to place your card${rev >= FH_REV_FLAT ? ", then a column to add" : ""}`}
      background={FH_BG}
      fitWorld
      scene={cardsFill}
      seed={data?.seed ?? 0}
      enabled={data !== null}
      locked={locked}
      worldW={FH_WORLD_W}
      worldH={FH_WORLD_H}
      game={game}
      sounds={fiveHandsSounds}
      checkpoint={fhCheckpoint}
      interval={FH_CHECKPOINT_INTERVAL}
      encodeRun={encodeFiveHandsRun}
      discrete
      inputKind={FH_INPUT_PLACE}
      pointer={pointer}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function fiveHandsLine(r: { total: number; made: number; column?: number; columnPoints?: number }, rev?: number | null): string {
  if ((rev ?? 1) >= FH_REV_FLAT) {
    const col = r.column !== undefined && r.column >= 0 ? `column ${r.column + 1} +${r.columnPoints ?? 0}` : "no column picked";
    return `${r.total} hand points (rows ${r.total - (r.columnPoints ?? 0)}, ${col}; capped at 200)`;
  }
  if ((rev ?? 1) >= FH_REV_STEEP) return `${r.total} hand points (full at ${fhCoreFullFor(rev)}) · ${r.made} of ${FH_ROWS} rows with a hand`;
  return `${r.total} hand points (full at ${FH_CORE_FULL}) · ${r.made} of ${FH_ROWS} hands made`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "fivehands") return null;
  const result = replayFiveHandsRun(puzzle.seed, myAnswer ?? "", puzzle.fiveHandsRev);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">{fiveHandsLine(result, puzzle.fiveHandsRev)}</p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">{result.placed} of {FH_TURNS} cards placed</p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same deck for everyone</p>
    </div>
  );
}

export const fiveHandsPuzzle: PuzzleDefinition = {
  key: "fivehands",
  name: gameDisplayName("fivehands"),
  category: "arcade",
  timeLimitMs: FIVEHANDS_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "fivehands", seed: 1, fiveHandsRev: FH_REV }) satisfies FiveHandsPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
