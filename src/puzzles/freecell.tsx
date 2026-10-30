import { useMemo, useRef } from "react";

import { gameDisplayName } from "@/lib/duel/gameNames";
import { FC_CHECKPOINT_INTERVAL, FC_INPUT_MOVE, FC_INPUT_TAP, FC_REV, fcCheckpoint, type FcState } from "@/lib/arcade/cards/freecell";
import {
  drawFreecell, fcCardBox, fcDropPile, fcHit, fcNewView, FC_BG, FC_WORLD_H, FC_WORLD_W, freecellArtGame,
} from "@/lib/arcade/cards/freecell.renderer";
import { cardsFill } from "@/lib/arcade/cards/cardsFill.renderer";
import { encodeFreecellRun, replayFreecellRun } from "@/lib/duel/cards";
import { FREECELL_TIME_MS, type FreecellPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import { CardStill } from "@/components/puzzles/CardStill";
import { freecellSounds } from "@/lib/fx/cardSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: a deal on the felt (drawn by the game's own renderer). */
function IntroExample() {
  return <CardStill width={FC_WORLD_W} height={FC_WORLD_H} draw={(ctx, size) => drawFreecell(ctx, freecellArtGame().init(0), size)} caption="Tap a card to send it to its best spot; drag for a particular one. Safe cards go home by themselves." />;
}

/** Drags shorter than this many world pixels are taps. */
const TAP_SLOP = 10;

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: FreecellPuzzleData | null = puzzle.type === "freecell" ? puzzle : null;
  const view = useMemo(() => fcNewView(), []);
  const latest = useRef<FcState | null>(null);
  const start = useRef<{ x: number; y: number; pile: number; index: number; moved: boolean } | null>(null);
  const game = useMemo(() => {
    const art = freecellArtGame(view);
    return { ...art, draw: (ctx: CanvasRenderingContext2D, state: FcState, size: { width: number; height: number }) => { latest.current = state; art.draw(ctx, state, size); } };
  }, [view]);

  const pointer = (kind: "down" | "move" | "up", x: number, y: number): PointerPayload | null => {
    const state = latest.current;
    if (!state) return null;
    if (kind === "down") {
      const hit = fcHit(state, x, y);
      start.current = hit ? { x, y, pile: hit.pile, index: hit.index, moved: false } : null;
      view.pressed = hit;
      return null;
    }
    const s = start.current;
    if (!s) return null;
    if (kind === "move") {
      if (!s.moved && Math.hypot(x - s.x, y - s.y) > TAP_SLOP) {
        s.moved = true;
        const box = fcCardBox(state, s.pile, s.index);
        view.drag = { pile: s.pile, index: s.index, x, y, ox: s.x - box.x, oy: s.y - box.y };
      }
      if (view.drag) {
        view.drag.x = x;
        view.drag.y = y;
      }
      return null;
    }
    start.current = null;
    view.pressed = null;
    view.drag = null;
    if (!s.moved) return { k: FC_INPUT_TAP, a: s.pile, b: s.index, c: 0 };
    const dest = fcDropPile(x, y);
    if (dest < 0 || dest === s.pile) return null;
    return { k: FC_INPUT_MOVE, a: s.pile, b: s.index, c: dest };
  };

  return (
    <ArcadeCanvasStage
      diagKey="freecell"
      label={`${gameDisplayName("freecell")}: tap a card to move it, or drag it to a pile`}
      background={FC_BG}
      fitWorld
      scene={cardsFill}
      seed={data?.seed ?? 0}
      enabled={data !== null}
      locked={locked}
      worldW={FC_WORLD_W}
      worldH={FC_WORLD_H}
      game={game}
      sounds={freecellSounds}
      checkpoint={fcCheckpoint}
      interval={FC_CHECKPOINT_INTERVAL}
      encodeRun={encodeFreecellRun}
      discrete
      inputKind={FC_INPUT_TAP}
      pointer={pointer}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function freecellLine(r: { home: number; finished: boolean; moves: number; par: number; finishSeconds: number }): string {
  return r.finished ? `All 52 home in ${r.finishSeconds.toFixed(1)} s · ${r.moves} moves (par ${r.par})` : `${r.home} of 52 cards home`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "freecell") return null;
  const result = replayFreecellRun(puzzle.seed, myAnswer ?? "", puzzle.freecellRev);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">{freecellLine(result)}</p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">{result.sorted} cards in sorted runs · {result.moves} moves</p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same deal for everyone</p>
    </div>
  );
}

/** The deal comes from the server (a bank index); every run is replayed there for scoring. */
export const freecellPuzzle: PuzzleDefinition = {
  key: "freecell",
  name: gameDisplayName("freecell"),
  category: "arcade",
  timeLimitMs: FREECELL_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "freecell", seed: 0, freecellRev: FC_REV }) satisfies FreecellPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
