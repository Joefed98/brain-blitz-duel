import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useRef } from "react";
import { colourClashArtGameFor, drawClashFinish } from "@/lib/arcade/colourClash.renderer";
import { playOverlayFx, registerFxPreview, soundCue } from "@/components/puzzles/speedFx";
import { colourClashSounds } from "@/lib/fx/gameSounds";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";
import { stroopFill } from "@/lib/arcade/arenaFills.renderer";
import { ArrowPad } from "@/components/puzzles/GridDrag";
import { clashTapPayload } from "@/components/puzzles/tapMapping";
import { CLASH_QUEUE, CLASH_REV_TALL, clashVariantOf, clashWorldHFor, CLASH_CHECKPOINT_INTERVAL, CLASH_DROP, CLASH_INPUT_LANE, CLASH_MOVE_LEFT, CLASH_MOVE_RIGHT, CLASH_WORLD_W, clashCheckpoint, type ClashState } from "@/lib/arcade/colourClash";
import { encodeColourClashRun, replayColourClashRun } from "@/lib/duel/colourClash";
import type { StroopPuzzleData } from "@/lib/duel/types";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

function IntroExample() {
  return <div className="w-full rounded-xl border border-border bg-card p-4 text-center"><p className="font-mono text-sm font-bold text-primary">SORT BY INK</p><p className="mt-3 font-display text-3xl font-bold text-warn">BLUE</p><p className="mt-3 text-sm text-muted-foreground">Steer the word into the gate matching its ink.</p></div>;
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const down = useRef<{ x: number; y: number } | null>(null);
  const column = useRef<HTMLDivElement | null>(null);
  const last = useRef<ClashState | null>(null);
  const counts = useRef(-1);
  /** Finish effect over the arena: every gate flashes in its own colour (presentation only). */
  const fireFinish = () => {
    const arena = column.current?.querySelector("[data-game-arena]");
    const state = last.current;
    if (!arena || !state) return;
    const box = arena.getBoundingClientRect();
    if (box.width < 1) return;
    soundCue("stroop.gatesFlash");
    playOverlayFx({ rect: box, ms: 1100, draw: ({ ctx, ms, reduced }) => drawClashFinish(ctx, ms, box.width, box.height, state, reduced) });
  };
  useEffect(() => registerFxPreview("stroop", fireFinish), []);
  /** The game's sound observer plus a named cue for the new gate pulse when a word lands. */
  const sounds = useRef(() => {
    const base = colourClashSounds();
    counts.current = -1;
    return {
      frame(state: ClashState, running: boolean) {
        base.frame(state, running);
        last.current = state;
        const sorted = state.correct + state.wrong;
        if (counts.current >= 0 && sorted > counts.current) soundCue("stroop.gatePulse");
        counts.current = sorted;
      },
      stop: () => base.stop(),
    };
  }).current;
  if (puzzle.type !== "stroop") return null;
  return <div ref={column} data-stage-column="" data-polish="stroop" className="flex min-h-0 w-full flex-1 flex-col"><ArcadeCanvasStage diagKey="stroop" completeCue={() => "stroop.gatesFlash"} sounds={sounds} label={`${gameDisplayName("stroop")} lane board`} background="#07070D" fitWorld scene={stroopFill} seed={puzzle.seed} enabled locked={locked} worldW={CLASH_WORLD_W} worldH={clashWorldHFor(clashVariantOf(puzzle))} game={colourClashArtGameFor(clashVariantOf(puzzle))} checkpoint={clashCheckpoint} interval={CLASH_CHECKPOINT_INTERVAL} encodeRun={encodeColourClashRun} inputKind={CLASH_INPUT_LANE} discrete onSubmit={(answer) => { fireFinish(); onSubmit(answer); }} onDraftAnswer={onDraftAnswer} footer={(send) => <ArrowPad directions={["L", "D", "R"]} disabled={locked} onPress={(dir) => send({ k: CLASH_INPUT_LANE, a: dir === "L" ? CLASH_MOVE_LEFT : dir === "R" ? CLASH_MOVE_RIGHT : CLASH_DROP, b: 0, c: 0 })} />} pointer={(kind, x, y) => {
    if (kind === "down") { down.current = { x, y }; return null; }
    if (kind !== "up" || !down.current) return null;
    const from = down.current; down.current = null;
    return clashTapPayload(from, { x, y });
  }} /></div>;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "stroop") return null;
  let replay: ReturnType<typeof replayColourClashRun> | null = null;
  try { replay = replayColourClashRun(puzzle.seed, myAnswer ?? "", clashVariantOf(puzzle)); } catch { /* historic/empty row */ }
  return <p className="text-center font-mono text-2xl font-bold text-primary">{replay ? `${replay.correct} / ${replay.total} · ${replay.wrong} wrong` : "No run"}</p>;
}

export function buildStroop(): StroopPuzzleData { return { type: "stroop", seed: Math.floor(Math.random() * 0x7ffffffe) + 1, queue: CLASH_QUEUE, clashRev: CLASH_REV_TALL }; }
export const stroopPuzzle: PuzzleDefinition = { key: "stroop", name: gameDisplayName("stroop"), category: "attention", timeLimitMs: 78_000, arcadeRun: true, generate: buildStroop, check: () => false, IntroExample, Stage, Reveal };