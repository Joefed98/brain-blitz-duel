import { useMemo, useRef } from "react";

import { gameDisplayName } from "@/lib/duel/gameNames";
import { TP_CHECKPOINT_INTERVAL, TP_INPUT_TAP, TP_REV, TP_STOCK_PILE, tpCheckpoint, type TpState } from "@/lib/arcade/cards/tripeaks";
import { drawTripeaks, tpCardBox, tpHit, tpNewView, tpOverDiscard, TP_BG, TP_WORLD_H, TP_WORLD_W, tripeaksArtGame } from "@/lib/arcade/cards/tripeaks.renderer";
import { cardsFill } from "@/lib/arcade/cards/cardsFill.renderer";
import { encodeTripeaksRun, replayTripeaksRun } from "@/lib/duel/cards";
import { TRIPEAKS_TIME_MS, type TripeaksPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import { CardStill } from "@/components/puzzles/CardStill";
import { tripeaksSounds } from "@/lib/fx/cardSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

function IntroExample() {
  return <CardStill width={TP_WORLD_W} height={TP_WORLD_H} draw={(ctx, size) => drawTripeaks(ctx, tripeaksArtGame().init(0), size)} caption="Play a card one higher or lower than the discard; tap the stock when stuck." />;
}

const TAP_SLOP = 10;

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: TripeaksPuzzleData | null = puzzle.type === "tripeaks" ? puzzle : null;
  const view = useMemo(() => tpNewView(), []);
  const latest = useRef<TpState | null>(null);
  const start = useRef<{ x: number; y: number; hit: number; moved: boolean } | null>(null);
  const game = useMemo(() => {
    const art = tripeaksArtGame(view);
    return { ...art, draw: (ctx: CanvasRenderingContext2D, state: TpState, size: { width: number; height: number }) => { latest.current = state; art.draw(ctx, state, size); } };
  }, [view]);

  const pointer = (kind: "down" | "move" | "up", x: number, y: number): PointerPayload | null => {
    const state = latest.current;
    if (!state) return null;
    if (kind === "down") {
      const hit = tpHit(state, x, y);
      start.current = hit >= 0 ? { x, y, hit, moved: false } : null;
      view.pressed = hit;
      return null;
    }
    const s = start.current;
    if (!s) return null;
    if (kind === "move") {
      if (!s.moved && s.hit !== TP_STOCK_PILE && Math.hypot(x - s.x, y - s.y) > TAP_SLOP) {
        s.moved = true;
        const b = tpCardBox(s.hit);
        view.drag = { index: s.hit, x, y, ox: s.x - b.x, oy: s.y - b.y };
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
    // A tap plays (or turns the stock); a drag plays only when dropped on the discard.
    if (!s.moved || tpOverDiscard(x, y)) return { k: TP_INPUT_TAP, a: s.hit, b: 0, c: 0 };
    return null;
  };

  return (
    <ArcadeCanvasStage
      diagKey="tripeaks"
      label={`${gameDisplayName("tripeaks")}: tap a card one higher or lower than the discard, or the stock`}
      background={TP_BG}
      fitWorld
      scene={cardsFill}
      seed={data?.seed ?? 0}
      enabled={data !== null}
      locked={locked}
      worldW={TP_WORLD_W}
      worldH={TP_WORLD_H}
      game={game}
      sounds={tripeaksSounds}
      checkpoint={tpCheckpoint}
      interval={TP_CHECKPOINT_INTERVAL}
      encodeRun={encodeTripeaksRun}
      discrete
      inputKind={TP_INPUT_TAP}
      pointer={pointer}
      keys={(kind, key, send) => {
        if (key !== " " && key !== "s" && key !== "S") return false;
        if (kind === "down") send({ k: TP_INPUT_TAP, a: TP_STOCK_PILE, b: 0, c: 0 });
        return true;
      }}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function tripeaksLine(r: { cleared: number; finished: boolean; finishSeconds: number }): string {
  return r.finished ? `All 28 cleared in ${r.finishSeconds.toFixed(1)} s` : `${r.cleared} of 28 cleared`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "tripeaks") return null;
  const result = replayTripeaksRun(puzzle.seed, myAnswer ?? "", puzzle.tripeaksRev);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">{tripeaksLine(result)}</p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">{result.peaks} of 3 peak tops · best run {result.bestRun}</p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same deal for everyone</p>
    </div>
  );
}

export const tripeaksPuzzle: PuzzleDefinition = {
  key: "tripeaks",
  name: gameDisplayName("tripeaks"),
  category: "arcade",
  timeLimitMs: TRIPEAKS_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "tripeaks", seed: 0, tripeaksRev: TP_REV }) satisfies TripeaksPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
