import { useMemo, useRef } from "react";

import { gameDisplayName } from "@/lib/duel/gameNames";
import { PS_CHECKPOINT_INTERVAL, PS_CORE_FULL, PS_INPUT_PLACE, PS_REV, psCheckpoint, type PsState } from "@/lib/arcade/cards/pokerSquares";
import { drawPokerSquares, pokerSquaresArtGame, psHit, psNewView, psOnNext, PS_BG, PS_WORLD_H, PS_WORLD_W } from "@/lib/arcade/cards/pokerSquares.renderer";
import { cardsFill } from "@/lib/arcade/cards/cardsFill.renderer";
import { encodePokerSquaresRun, replayPokerSquaresRun } from "@/lib/duel/cards";
import { POKERSQUARES_TIME_MS, type PokerSquaresPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import { CardStill } from "@/components/puzzles/CardStill";
import { pokerSquaresSounds } from "@/lib/fx/cardSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

function IntroExample() {
  return <CardStill width={PS_WORLD_W} height={PS_WORLD_H} draw={(ctx, size) => drawPokerSquares(ctx, pokerSquaresArtGame().init(0), size)} caption="Tap an empty square to place the next card. Every row and column scores as a poker hand." />;
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: PokerSquaresPuzzleData | null = puzzle.type === "pokersquares" ? puzzle : null;
  const view = useMemo(() => psNewView(), []);
  const latest = useRef<PsState | null>(null);
  const start = useRef<{ fromNext: boolean; square: number } | null>(null);
  const game = useMemo(() => {
    const art = pokerSquaresArtGame(view);
    return { ...art, draw: (ctx: CanvasRenderingContext2D, state: PsState, size: { width: number; height: number }) => { latest.current = state; art.draw(ctx, state, size); } };
  }, [view]);

  // A tap on an empty square places the card; dragging the next card onto a square does too.
  const pointer = (kind: "down" | "move" | "up", x: number, y: number): PointerPayload | null => {
    if (!latest.current) return null;
    if (kind === "down") {
      const square = psHit(x, y);
      const fromNext = psOnNext(x, y);
      start.current = square >= 0 || fromNext ? { fromNext, square } : null;
      view.pressed = square;
      return null;
    }
    const s = start.current;
    if (!s) return null;
    if (kind === "move") {
      if (s.fromNext) view.drag = { x, y };
      else view.pressed = psHit(x, y) === s.square ? s.square : -1;
      return null;
    }
    start.current = null;
    view.pressed = -1;
    view.drag = null;
    const square = psHit(x, y);
    if (square < 0 || (!s.fromNext && square !== s.square)) return null;
    return { k: PS_INPUT_PLACE, a: square, b: 0, c: 0 };
  };

  return (
    <ArcadeCanvasStage
      diagKey="pokersquares"
      label={`${gameDisplayName("pokersquares")}: tap an empty square to place the next card`}
      background={PS_BG}
      fitWorld
      scene={cardsFill}
      seed={data?.seed ?? 0}
      enabled={data !== null}
      locked={locked}
      worldW={PS_WORLD_W}
      worldH={PS_WORLD_H}
      game={game}
      sounds={pokerSquaresSounds}
      checkpoint={psCheckpoint}
      interval={PS_CHECKPOINT_INTERVAL}
      encodeRun={encodePokerSquaresRun}
      discrete
      inputKind={PS_INPUT_PLACE}
      pointer={pointer}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function pokerSquaresLine(r: { total: number; made: number }): string {
  return `${r.total} hand points (full at ${PS_CORE_FULL}) · ${r.made} of 10 lines made`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "pokersquares") return null;
  const result = replayPokerSquaresRun(puzzle.seed, myAnswer ?? "", puzzle.pokerSquaresRev);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">{pokerSquaresLine(result)}</p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">{result.placed} of 25 cards placed</p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same cards, same order, for everyone</p>
    </div>
  );
}

export const pokerSquaresPuzzle: PuzzleDefinition = {
  key: "pokersquares",
  name: gameDisplayName("pokersquares"),
  category: "arcade",
  timeLimitMs: POKERSQUARES_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "pokersquares", seed: 1, pokerSquaresRev: PS_REV }) satisfies PokerSquaresPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
