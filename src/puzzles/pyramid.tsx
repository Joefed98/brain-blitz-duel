import { useMemo, useRef } from "react";

import { gameDisplayName } from "@/lib/duel/gameNames";
import { PY_CHECKPOINT_INTERVAL, PY_INPUT_TAP, PY_PAIR_FULL, PY_REV, pyApply, pyCheckpoint, pyDeal, type PyState } from "@/lib/arcade/cards/pyramid";
import { drawPyramid, pyButtonHit, pyHit, pyNewView, pyramidArtGame, PY_BG, PY_WORLD_H, PY_WORLD_W } from "@/lib/arcade/cards/pyramid.renderer";
import { cardsFill } from "@/lib/arcade/cards/cardsFill.renderer";
import { encodePyramidRun, replayPyramidRun } from "@/lib/duel/cards";
import { PYRAMID_TIME_MS, type PyramidPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import { CardStill } from "@/components/puzzles/CardStill";
import { pyramidSounds } from "@/lib/fx/gameSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** The intro still: seed 0's deal a few removals into its witness line, a card selected. */
function introState(): PyState {
  let s = pyramidArtGame().init(0);
  const taps = pyDeal(0).witness;
  for (let t = 0; t < 9 && t < taps.length; t++) s = pyApply({ ...s, tick: s.tick + 20 }, taps[t]!)?.state ?? s;
  return { ...s, lastTick: 0 };
}

function IntroExample() {
  return <CardStill width={PY_WORLD_W} height={PY_WORLD_H} draw={(ctx, size) => drawPyramid(ctx, introState(), size)} caption="Tap two uncovered cards that add to 13; a King goes alone. Undo and Reset sit at the bottom." />;
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: PyramidPuzzleData | null = puzzle.type === "pyramid" ? puzzle : null;
  const view = useMemo(() => pyNewView(), []);
  const latest = useRef<PyState | null>(null);
  const start = useRef<number>(-1);
  const game = useMemo(() => {
    const art = pyramidArtGame(view);
    return { ...art, draw: (ctx: CanvasRenderingContext2D, state: PyState, size: { width: number; height: number }) => { latest.current = state; art.draw(ctx, state, size); } };
  }, [view]);

  // A tap on a card or pile; Undo and Reset are a press and release on the same button.
  const pointer = (kind: "down" | "move" | "up", x: number, y: number): PointerPayload | null => {
    const state = latest.current;
    if (!state) return null;
    if (kind === "down") {
      const button = pyButtonHit(x, y);
      view.button = button;
      start.current = button ? -1 : pyHit(state, x, y);
      view.pressed = start.current;
      return null;
    }
    if (kind === "move") return null;
    const held = view.button;
    const hit = start.current;
    view.button = 0;
    view.pressed = -1;
    start.current = -1;
    if (held) return pyButtonHit(x, y) === held ? { k: held, a: 0, b: 0, c: 0 } : null;
    if (hit < 0 || pyHit(state, x, y) !== hit) return null;
    return { k: PY_INPUT_TAP, a: hit, b: 0, c: 0 };
  };

  return (
    <ArcadeCanvasStage
      diagKey="pyramid"
      label={`${gameDisplayName("pyramid")}: tap two uncovered cards adding to 13, a King alone, or the stock; Undo and Reset at the bottom`}
      background={PY_BG}
      fitWorld
      scene={cardsFill}
      seed={data?.seed ?? 0}
      enabled={data !== null}
      locked={locked}
      worldW={PY_WORLD_W}
      worldH={PY_WORLD_H}
      game={game}
      sounds={pyramidSounds}
      checkpoint={pyCheckpoint}
      interval={PY_CHECKPOINT_INTERVAL}
      encodeRun={encodePyramidRun}
      discrete
      inputKind={PY_INPUT_TAP}
      pointer={pointer}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function pyramidLine(r: { removed: number; finished: boolean; finishSeconds: number }): string {
  return r.finished ? `All 28 removed in ${r.finishSeconds.toFixed(1)} s` : `${r.removed} of 28 removed`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "pyramid") return null;
  const result = replayPyramidRun(puzzle.seed, myAnswer ?? "", puzzle.pyramidRev);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">{pyramidLine(result)}</p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">{Math.min(result.ppPairs, PY_PAIR_FULL)} of {PY_PAIR_FULL} pyramid pairs · {result.kings} Kings</p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same deal for everyone</p>
    </div>
  );
}

/** The deal is built from the seed in the sim (every deal proved clearable); every run is replayed on the server. */
export const pyramidPuzzle: PuzzleDefinition = {
  key: "pyramid",
  name: gameDisplayName("pyramid"),
  category: "arcade",
  timeLimitMs: PYRAMID_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "pyramid", seed: 0, pyramidRev: PY_REV }) satisfies PyramidPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
