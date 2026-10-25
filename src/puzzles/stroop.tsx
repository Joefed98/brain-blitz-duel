import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useRef } from "react";
import { colourClashArtGameFor, drawClashFinish } from "@/lib/arcade/colourClash.renderer";
import { playOverlayFx, registerFxPreview, soundCue } from "@/components/puzzles/speedFx";
import { colourClashSounds } from "@/lib/fx/gameSounds";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";
import { stroopFill } from "@/lib/arcade/arenaFills.renderer";
import { ArrowPad } from "@/components/puzzles/GridDrag";
import { clashTapPayload } from "@/components/puzzles/tapMapping";
import { playTone } from "@/lib/sound";
import { CLASH_QUEUE, CLASH_REV_DEPTH, CLASH_GOLD_STREAK, clashVariantOf, clashWorldHFor, CLASH_CHECKPOINT_INTERVAL, CLASH_DROP, CLASH_INPUT_LANE, CLASH_MOVE_LEFT, CLASH_MOVE_RIGHT, CLASH_WORLD_W, clashCheckpoint, type ClashState } from "@/lib/arcade/colourClash";
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
  const prev = useRef<ClashState | null>(null);
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
    prev.current = null;
    return {
      frame(state: ClashState, running: boolean) {
        base.frame(state, running);
        last.current = state;
        const sorted = state.correct + state.wrong;
        if (counts.current >= 0 && sorted > counts.current) {
          soundCue("stroop.gatePulse");
          // clashRev 8: each lane plays its own note when a word is sorted into it, so a quick streak plays a little
          // tune; a gold word adds a high sparkle. Synthesised on the effects channel (mute and the Effects slider apply).
          const before = prev.current;
          if (state.depth && before && state.correct > before.correct && before.items.at(-1)?.kind !== 1) {
            const lift = state.depth.streak >= CLASH_GOLD_STREAK ? 0.05 : 0;
            playTone(LANE_NOTES[Math.min(LANE_NOTES.length - 1, Math.max(0, before.lane))]!, 150, "triangle", 0.16 + lift);
            if (before.items.at(-1)?.kind === 2) playTone(1568, 110, "sine", 0.12, 2093);
          }
        }
        counts.current = sorted;
        prev.current = state;
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
  const d = replay?.depth;
  return <div className="flex flex-col items-center gap-1">
    <p className="text-center font-mono text-2xl font-bold text-primary">{replay ? `${replay.correct} / ${replay.total} · ${replay.wrong} wrong` : "No run"}</p>
    {d ? <p data-stroop-depth className="text-center font-mono text-[13px] font-semibold text-[var(--ap-text-2)]">{`Best streak ${d.best} · Gold ${d.golds}/${d.goldWords} · Let fall ${d.passed}/${d.skips}`}</p> : null}
    {d && d.finished ? <p className="text-center font-mono text-[13px] font-semibold text-[var(--ap-text-2)]">{`${d.base} + ${d.gold} gold + ${d.streak} streak + ${d.stretch} speed`}</p> : null}
  </div>;
}

/** clashRev 8: one note per lane (C, E, G, A), so a quick streak across the lanes plays a little pentatonic tune. */
const LANE_NOTES = [523.25, 659.25, 783.99, 880] as const;

export function buildStroop(): StroopPuzzleData { return { type: "stroop", seed: Math.floor(Math.random() * 0x7ffffffe) + 1, queue: CLASH_QUEUE, clashRev: CLASH_REV_DEPTH }; }
export const stroopPuzzle: PuzzleDefinition = { key: "stroop", name: gameDisplayName("stroop"), category: "attention", timeLimitMs: 78_000, arcadeRun: true, generate: buildStroop, check: () => false, IntroExample, Stage, Reveal };