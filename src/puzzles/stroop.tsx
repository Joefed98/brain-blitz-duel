import { useRef } from "react";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";
import { CLASH_CHECKPOINT_INTERVAL, CLASH_INPUT_SWIPE, CLASH_RUN_TICKS, CLASH_SWIPE_PX, CLASH_WORLD_H, CLASH_WORLD_W, clashCheckpoint, colourClashGame } from "@/lib/arcade/colourClash";
import { encodeColourClashRun, replayColourClashRun } from "@/lib/duel/colourClash";
import type { StroopPuzzleData } from "@/lib/duel/types";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

function IntroExample() {
  return <div className="w-full rounded-xl border border-border bg-card p-4 text-center"><p className="font-mono text-sm font-bold text-primary">SORT BY INK</p><p className="mt-3 font-display text-3xl font-bold text-red-500">BLUE</p><p className="mt-3 text-sm text-muted-foreground">Swipe toward the red gate.</p></div>;
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const start = useRef<{ x: number; y: number } | null>(null);
  if (puzzle.type !== "stroop") return null;
  return <ArcadeCanvasStage diagKey="stroop" label="Colour Clash sorting channel" background="#07070D" seed={puzzle.seed} enabled locked={locked} worldW={CLASH_WORLD_W} worldH={CLASH_WORLD_H} game={colourClashGame} checkpoint={clashCheckpoint} interval={CLASH_CHECKPOINT_INTERVAL} encodeRun={encodeColourClashRun} inputKind={CLASH_INPUT_SWIPE} discrete onSubmit={onSubmit} onDraftAnswer={onDraftAnswer} pointer={(kind, x, y) => {
    if (kind === "down") { start.current = { x, y }; return null; }
    if (kind !== "up" || !start.current) return null;
    const dx = x - start.current.x; const dy = y - start.current.y; start.current = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < CLASH_SWIPE_PX) return null;
    return { k: CLASH_INPUT_SWIPE, a: Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 0 : 1) : (dy > 0 ? 2 : 3), b: 0, c: 0 };
  }} />;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "stroop") return null;
  let replay: ReturnType<typeof replayColourClashRun> | null = null;
  try { replay = replayColourClashRun(puzzle.seed, myAnswer ?? ""); } catch { /* historic/empty row */ }
  return <p className="text-center font-mono text-2xl font-bold text-primary">{replay ? `${replay.correct} / ${replay.total} · ${replay.wrong} wrong` : "No run"}</p>;
}

export function buildStroop(): StroopPuzzleData { return { type: "stroop", seed: Math.floor(Math.random() * 0x7ffffffe) + 1 }; }
export const stroopPuzzle: PuzzleDefinition = { key: "stroop", name: "Colour Clash", category: "attention", timeLimitMs: 45_000, arcadeRun: true, generate: buildStroop, check: () => false, IntroExample, Stage, Reveal };