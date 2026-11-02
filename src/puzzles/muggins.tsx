import { useMemo, useRef } from "react";

import { gameDisplayName } from "@/lib/duel/gameNames";
import { MG_CHECKPOINT_INTERVAL, MG_CORE_FULL, MG_INPUT_DRAW, MG_INPUT_PLAY, MG_REV, mgApply, mgCheckpoint, mgDeal, type MgState } from "@/lib/arcade/cards/muggins";
import { drawMuggins, mgBestEnd, mgButtonHit, mgHitEnd, mgHitHand, mgNewView, mugginsArtGame, MG_BG, MG_WORLD_H, MG_WORLD_W } from "@/lib/arcade/cards/muggins.renderer";
import { encodeMugginsRun, replayMugginsRun } from "@/lib/duel/cards";
import { MUGGINS_TIME_MS, type MugginsPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import { CardStill } from "@/components/puzzles/CardStill";
import { mugginsFill } from "@/lib/arcade/cards/mugginsFill.renderer";
import { mugginsSounds } from "@/lib/fx/gameSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** The intro still: seed 0's deal three plays into its witness, the next witness tile chosen. */
function introState(): { state: MgState; sel: number } {
  let s = mugginsArtGame().init(0);
  const w = mgDeal(0).witness;
  let k = 0;
  for (let plays = 0; k < w.length && plays < 3; k++) {
    const [t, end] = w[k]!;
    s = mgApply({ ...s, tick: s.tick + 20 }, t, end) ?? s;
    if (t >= 0) plays++;
  }
  const next = w.slice(k).find((p) => p[0] >= 0);
  return { state: { ...s, lastTick: 0 }, sel: next ? next[0] : -1 };
}

function IntroExample() {
  return (
    <CardStill
      width={MG_WORLD_W}
      height={MG_WORLD_H}
      draw={(ctx, size) => {
        const { state, sel } = introState();
        drawMuggins(ctx, state, size, { sel, button: 0, end: -1 });
      }}
      caption="Pick a tile, then tap an end (or Play). Ends adding to 5, 10, 15 or 20 score."
    />
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: MugginsPuzzleData | null = puzzle.type === "muggins" ? puzzle : null;
  const view = useMemo(() => mgNewView(), []);
  const latest = useRef<MgState | null>(null);
  const start = useRef<{ tile: number; end: number } | null>(null);
  const game = useMemo(() => {
    const art = mugginsArtGame(view);
    return { ...art, draw: (ctx: CanvasRenderingContext2D, state: MgState, size: { width: number; height: number }) => { latest.current = state; art.draw(ctx, state, size); } };
  }, [view]);

  // Tap a hand tile to choose it (again to let go), then an end to lay it there; Play lays it on its better end; Draw,
  // Undo and Reset are a press and release on the same button. A chosen tile can also be dragged onto an end.
  const pointer = (kind: "down" | "move" | "up", x: number, y: number): PointerPayload | null => {
    const state = latest.current;
    if (!state) return null;
    if (kind === "down") {
      const button = mgButtonHit(x, y);
      if (button) {
        view.button = button;
        start.current = null;
        return null;
      }
      const tile = mgHitHand(state, x, y);
      const end = tile < 0 ? mgHitEnd(state, x, y) : -1;
      start.current = { tile, end };
      view.end = end >= 0 && view.sel >= 0 ? end : -1;
      return null;
    }
    if (kind === "move") return null;
    const held = view.button;
    view.button = 0;
    view.end = -1;
    if (held) {
      if (mgButtonHit(x, y) !== held) return null;
      if (held === MG_INPUT_PLAY) {
        if (view.sel < 0 || !state.hand.includes(view.sel)) return null;
        const end = mgBestEnd(state, view.sel);
        if (end < 0) return null;
        const tile = view.sel;
        view.sel = -1;
        return { k: MG_INPUT_PLAY, a: tile, b: end, c: 0 };
      }
      if (held === MG_INPUT_DRAW) view.sel = -1;
      return { k: held, a: 0, b: 0, c: 0 };
    }
    const s = start.current;
    start.current = null;
    if (!s) return null;
    if (s.tile >= 0) {
      // Dragged from the hand onto an end: play it there.
      const end = mgHitEnd(state, x, y);
      if (end >= 0) {
        view.sel = -1;
        return { k: MG_INPUT_PLAY, a: s.tile, b: end, c: 0 };
      }
      if (mgHitHand(state, x, y) === s.tile) view.sel = view.sel === s.tile ? -1 : s.tile;
      return null;
    }
    if (s.end >= 0 && mgHitEnd(state, x, y) === s.end && view.sel >= 0 && state.hand.includes(view.sel)) {
      const tile = view.sel;
      view.sel = -1;
      return { k: MG_INPUT_PLAY, a: tile, b: s.end, c: 0 };
    }
    return null;
  };

  return (
    <ArcadeCanvasStage
      diagKey="muggins"
      label={`${gameDisplayName("muggins")}: choose a tile from your hand, then tap an end of the line or Play; Draw when nothing fits`}
      background={MG_BG}
      fitWorld
      scene={mugginsFill}
      seed={data?.seed ?? 0}
      enabled={data !== null}
      locked={locked}
      worldW={MG_WORLD_W}
      worldH={MG_WORLD_H}
      game={game}
      sounds={mugginsSounds}
      checkpoint={mgCheckpoint}
      interval={MG_CHECKPOINT_INTERVAL}
      encodeRun={encodeMugginsRun}
      discrete
      inputKind={MG_INPUT_PLAY}
      pointer={pointer}
      keys={(kind, key, send) => {
        if (key !== "d" && key !== "D") return false;
        if (kind === "down") send({ k: MG_INPUT_DRAW, a: 0, b: 0, c: 0 });
        return true;
      }}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function mugginsLine(r: { points: number; finished: boolean; finishSeconds: number }): string {
  return r.finished ? `${r.points} points (full at ${MG_CORE_FULL}) · hand cleared in ${r.finishSeconds.toFixed(1)} s` : `${r.points} points (full at ${MG_CORE_FULL})`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "muggins") return null;
  const result = replayMugginsRun(puzzle.seed, myAnswer ?? "", puzzle.mugginsRev);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">{mugginsLine(result)}</p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">{result.plays} tiles laid · {result.bigs} big play{result.bigs === 1 ? "" : "s"}</p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same tiles for everyone</p>
    </div>
  );
}

export const mugginsPuzzle: PuzzleDefinition = {
  key: "muggins",
  name: gameDisplayName("muggins"),
  category: "arcade",
  timeLimitMs: MUGGINS_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "muggins", seed: 1, mugginsRev: MG_REV }) satisfies MugginsPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
