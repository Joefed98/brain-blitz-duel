import { heldHorizontal } from "@/lib/desktop";
import { useFissionThumb } from "@/lib/arcade/fissionThumb";
import { puzzleLevel } from "@/lib/levels/levels";
import { ArtStill } from "@/components/puzzles/ArtStill";
import { burstAmbient, burstFill } from "@/lib/arcade/arenaFills.renderer";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { useRef, useMemo } from "react";

import { ArcadeControlButton } from "@/components/puzzles/ArcadeControlButton";

import {
  burstCheckpoint,
  BURST_BG,
  BURST_CHECKPOINT_INTERVAL,
  BURST_COLOURS,
  burstWorldHFor,
  BURST_GOLD,
  BURST_INPUT_FIRE,
  BURST_INPUT_MOVE,
  BURST_REV_BIG,
  BURST_V8_GOLDENS,
  BURST_V10_GOLDENS,
  burstStdParts,
  burstCleanBonus,
  burstCarryBonus,
  burstGoldenCount,
  BURST_TEAL,
  BURST_WORLD_W,
  type BurstState,
} from "@/lib/arcade/burst";
import { encodeBurstRun, replayBurstRun } from "@/lib/duel/burst";
import { BURST_TIME_MS, type BurstPuzzleData } from "@/lib/duel/types";
import { burstArtGameFor } from "@/lib/arcade/burst.renderer";
import { burstSounds } from "@/lib/fx/gameSounds";
import { expansionSounds } from "@/lib/fx/expansionSounds";

/** Fission's sounds plus burstRev 8's features (older rounds keep those counters at 0, so they stay silent). */
function burstAllSounds() {
  const base = burstSounds();
  const features = expansionSounds<BurstState>([
    { count: (s) => s.doubles ?? 0, sound: "zap" },
    { count: (s) => burstGoldenCount(s), sound: "chime" },
    { count: (s) => s.cleanWaves ?? 0, sound: "ding", volume: 0.8 },
    // burstRev 9: a wave cleared with a time bonus, and a BURST icon caught.
    { count: (s) => s.quickWaves ?? 0, sound: "ding", volume: 0.8 },
    { count: (s) => s.bursts ?? 0, sound: "zap" },
    { count: (s) => s.missed ?? 0, sound: "tick", volume: 0.5 },
  ]);
  return { frame: (state: BurstState, running: boolean) => { base.frame(state, running); features(state, running); }, stop: base.stop };
}
import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: the player, one large ball mid-bounce and a shot line. */
/**
 * The intro still (the Retro overhaul, 15 Nov 2026: a real frame of today's game, not an old drawing): the dealt
 * stamp's own renderer a few seconds into a fixed seed's run, with no input, the first wave's atoms bouncing.
 */
function IntroExample() {
  return (
    <ArtStill
      game={burstArtGameFor(BURST_REV_BIG)}
      worldW={BURST_WORLD_W}
      worldH={burstWorldHFor(BURST_REV_BIG)}
      ticks={150}
      input={null}
      caption="Fire straight up to split the atoms. Clear each wave quickly for a bonus; don't let one touch you."
    />
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: BurstPuzzleData | null = puzzle.type === "burst" ? puzzle : null;
  const fireFlip = useRef(0);
  /** Arrow press/release waiting to be sent: −1/1 = head for a wall, 0 = stop here. */
  const arrowEdge = useRef<number | null>(null);
  const keyMove = useRef(heldHorizontal());
  const thumb = useFissionThumb();
  const thumbX = useRef<number | null>(null);

  const tickInput = (state: BurstState): PointerPayload | null => {
    // One thumb: the move towards the touch follows the fire on the next tick.
    if (thumbX.current !== null) {
      const a = thumbX.current;
      thumbX.current = null;
      return { k: BURST_INPUT_MOVE, a, b: 0, c: 0 };
    }
    const edge = arrowEdge.current;
    if (edge === null) return null;
    arrowEdge.current = null;
    const a = edge < 0 ? 0 : edge > 0 ? BURST_WORLD_W : Math.round(state.x / 256);
    return { k: BURST_INPUT_MOVE, a, b: 0, c: 0 };
  };

  const holdStart = (dir: -1 | 1) => () => { arrowEdge.current = dir; };
  const holdEnd = () => { arrowEdge.current = 0; };

  const fire = (): PointerPayload => {
    fireFlip.current ^= 1;
    return { k: BURST_INPUT_FIRE, a: 0, b: fireFlip.current, c: 0 };
  };

  // Tuning B: no FIRE button. A tap anywhere on the arena fires (the stage's
  // pointer-down below), sending the same BURST_INPUT_FIRE event the button
  // did, so the input log format and every replay are unchanged.

  // One game object per stamp and level (stage 3 of the Retro overhaul: a level wraps init).
  const game = useMemo(() => burstArtGameFor(data?.burstRev, puzzleLevel(data)), [data?.burstRev, puzzleLevel(data)]);
  return (
    <div data-stage-column="2" className="flex min-h-0 w-full flex-1 flex-col gap-2">
    <ArcadeCanvasStage
      diagKey="burst"
      scene={burstFill}
      ambient={burstAmbient}
      label={gameDisplayName("burst")}
      background="#000000"
      fitWorld
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={BURST_WORLD_W}
      worldH={burstWorldHFor(data?.burstRev)}
      game={game}
      sounds={burstAllSounds}
      checkpoint={burstCheckpoint}
      interval={BURST_CHECKPOINT_INTERVAL}
      encodeRun={encodeBurstRun}
      tickInput={tickInput}
      pointer={(kind, x) => {
        // One thumb (fissionThumb.ts): touching fires and heads for the thumb's x; dragging follows; lifting stops.
        if (thumb) {
          if (kind === "down") {
            thumbX.current = Math.round(x);
            return fire();
          }
          if (kind === "move") return { k: BURST_INPUT_MOVE, a: Math.round(x), b: 0, c: 0 };
          arrowEdge.current = 0;
          return null;
        }
        return kind === "down" ? fire() : null;
      }}
      keys={(kind, key, send, _state, event) => {
        // Space fires (a tap); ←/→ (A/D) are the two arrow buttons, held.
        if (key === " ") {
          if (kind === "down" && !event.repeat) send(fire());
          return true;
        }
        const before = keyMove.current.dir();
        if (!keyMove.current.key(kind, key)) return false;
        const after = keyMove.current.dir();
        if (after !== before) arrowEdge.current = after;
        return true;
      }}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
    {/* Two large arrows (76 px tall, half the width each); the arcade play screen puts their bottom 16 px above the visible bottom (15 Oct 2026). */}
    {/* 3 Nov 2026 (Joe's audit; look only): the same 76 px row and tap boxes, drawn slim and translucent in the game's Retro cyan (a thin
        neon frame, a faint fill, the pixel font's arrows) in place of the chunky orange-outlined buttons. */}
    {thumb ? null : <div data-home-bar-clear="32" data-game-controls="pad" className="grid h-[76px] shrink-0 touch-none select-none grid-cols-2 items-start gap-4">
      <ArcadeControlButton type="button" data-home-bar-fill="" aria-label="Move left" disabled={locked} className="h-[76px] w-full rounded-[10px] border border-[rgba(61,255,224,0.45)] bg-[rgba(61,255,224,0.06)] p-0 font-['Press_Start_2P',ui-monospace,monospace] text-[30px] leading-none text-[#3DFFE0] [text-shadow:0_0_8px_rgba(61,255,224,0.6)] active:border-[rgba(61,255,224,0.85)] active:bg-[rgba(61,255,224,0.18)] before:content-['◀']" onPressStart={holdStart(-1)} onPressEnd={holdEnd} />
      <ArcadeControlButton type="button" data-home-bar-fill="" aria-label="Move right" disabled={locked} className="h-[76px] w-full rounded-[10px] border border-[rgba(61,255,224,0.45)] bg-[rgba(61,255,224,0.06)] p-0 font-['Press_Start_2P',ui-monospace,monospace] text-[30px] leading-none text-[#3DFFE0] [text-shadow:0_0_8px_rgba(61,255,224,0.6)] active:border-[rgba(61,255,224,0.85)] active:bg-[rgba(61,255,224,0.18)] before:content-['▶']" onPressStart={holdStart(1)} onPressEnd={holdEnd} />
    </div>}
    </div>
  );
}

export function burstLine(r: { wave: number; score: number; hits: number; livesLost: number }): string {
  return `Wave ${Math.max(1, r.wave)} · ${r.hits} atoms split or destroyed · ${r.livesLost} ${r.livesLost === 1 ? "life" : "lives"} lost`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "burst") return null;
  const result = replayBurstRun(puzzle.seed, myAnswer ?? "", puzzle.burstRev);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {burstLine(result)}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same waves for everyone</p>
      {result.state.std ? (
        <p className="shrink-0 text-center font-mono text-sm text-muted-foreground">
          {(() => {
            const p = burstStdParts(result.state);
            return `${result.hits}/${p.atoms} atoms ${p.core} · wave clears ${p.clear} · golden ${burstGoldenCount(result.state)}/${BURST_V10_GOLDENS} ${p.gold}${p.lives ? ` · lives −${p.lives}` : ""}${p.misses ? ` · wasted beams −${p.misses}` : ""}`;
          })()}
        </p>
      ) : result.state.carry ? (
        <p className="shrink-0 text-center font-mono text-sm text-muted-foreground">
          {`${result.state.quickWaves ?? 0} quick wave${result.state.quickWaves === 1 ? "" : "s"} · ${burstGoldenCount(result.state)}/${BURST_V8_GOLDENS} golden · bonus +${burstCarryBonus(result.state).total}`}
        </p>
      ) : result.state.exp ? (
        <p className="shrink-0 text-center font-mono text-sm text-muted-foreground">
          {`${result.state.cleanWaves ?? 0} clean wave${result.state.cleanWaves === 1 ? "" : "s"} · ${burstGoldenCount(result.state)}/${BURST_V8_GOLDENS} golden · bonus +${burstCleanBonus(result.state).total}`}
        </p>
      ) : null}
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const burstPuzzle: PuzzleDefinition = {
  key: "burst",
  name: gameDisplayName("burst"),
  category: "arcade",
  timeLimitMs: BURST_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "burst", seed: 1, burstRev: BURST_REV_BIG }) satisfies BurstPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
