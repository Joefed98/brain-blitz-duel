import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";
import { ArrowPad } from "@/components/puzzles/GridDrag";
import { CLASH_CHECKPOINT_INTERVAL, CLASH_DROP, CLASH_INPUT_LANE, CLASH_MOVE_LEFT, CLASH_MOVE_RIGHT, CLASH_SET_LANE, CLASH_WORLD_H, CLASH_WORLD_W, clashCheckpoint, clashLaneCount, colourClashGame } from "@/lib/arcade/colourClash";
import { encodeColourClashRun, replayColourClashRun } from "@/lib/duel/colourClash";
import type { StroopPuzzleData } from "@/lib/duel/types";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

function IntroExample() {
  return <div className="w-full rounded-xl border border-border bg-card p-4 text-center"><p className="font-mono text-sm font-bold text-primary">SORT BY INK</p><p className="mt-3 font-display text-3xl font-bold text-warn">BLUE</p><p className="mt-3 text-sm text-muted-foreground">Steer the word into the gate matching its ink.</p></div>;
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  if (puzzle.type !== "stroop") return null;
  let down: { x: number; y: number } | null = null;
  return <ArcadeCanvasStage diagKey="stroop" label="Colour Clash lane board" background="#07070D" seed={puzzle.seed} enabled locked={locked} worldW={CLASH_WORLD_W} worldH={CLASH_WORLD_H} game={colourClashGame} checkpoint={clashCheckpoint} interval={CLASH_CHECKPOINT_INTERVAL} encodeRun={encodeColourClashRun} inputKind={CLASH_INPUT_LANE} discrete onSubmit={onSubmit} onDraftAnswer={onDraftAnswer} footer={(send) => <ArrowPad directions={["L", "D", "R"]} disabled={locked} onPress={(dir) => send({ k: CLASH_INPUT_LANE, a: dir === "L" ? CLASH_MOVE_LEFT : dir === "R" ? CLASH_MOVE_RIGHT : CLASH_DROP, b: 0, c: 0 })} />} pointer={(kind, x, y) => {
    if (kind === "down") { down = { x, y }; return null; }
    if (kind !== "up" || !down) return null;
    const dy = y - down.y; down = null;
    if (dy > 40) return { k: CLASH_INPUT_LANE, a: CLASH_DROP, b: 0, c: 0 };
    const lanes = clashLaneCount(0);
    return { k: CLASH_INPUT_LANE, a: CLASH_SET_LANE, b: Math.min(lanes, Math.floor((x / CLASH_WORLD_W) * lanes)), c: 0 };
  }} />;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "stroop") return null;
  let replay: ReturnType<typeof replayColourClashRun> | null = null;
  try { replay = replayColourClashRun(puzzle.seed, myAnswer ?? ""); } catch { /* historic/empty row */ }
  return <p className="text-center font-mono text-2xl font-bold text-primary">{replay ? `${replay.correct} / ${replay.total} · ${replay.wrong} wrong` : "No run"}</p>;
}

export function buildStroop(): StroopPuzzleData { return { type: "stroop", seed: Math.floor(Math.random() * 0x7ffffffe) + 1 }; }
export const stroopPuzzle: PuzzleDefinition = { key: "stroop", name: "Colour Clash", category: "attention", timeLimitMs: 60_000, arcadeRun: true, generate: buildStroop, check: () => false, IntroExample, Stage, Reveal };