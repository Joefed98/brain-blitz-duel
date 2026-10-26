import { heldHorizontal } from "@/lib/desktop";
import { burstAmbient, burstFill } from "@/lib/arcade/arenaFills.renderer";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { useRef } from "react";

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
  BURST_REV_CLEAN,
  BURST_V8_GOLDENS,
  burstCleanBonus,
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
    { count: (s) => s.missed ?? 0, sound: "tick", volume: 0.5 },
  ]);
  return { frame: (state: BurstState, running: boolean) => { base.frame(state, running); features(state, running); }, stop: base.stop };
}
import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: the player, one large ball mid-bounce and a shot line. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 168 130" width={168} height={130} aria-hidden="true" style={{ background: BURST_BG, borderRadius: 10 }}>
        <line x1={0} y1={116} x2={168} y2={116} stroke={BURST_TEAL} strokeWidth={2} />
        <circle cx={104} cy={46} r={18} fill={BURST_COLOURS[0]} fillOpacity={.12} stroke={BURST_COLOURS[0]} strokeWidth={1} />
        <ellipse cx={104} cy={46} rx={16.5} ry={7} transform="rotate(-30 104 46)" fill="none" stroke={BURST_COLOURS[0]} strokeWidth={1} />
        <ellipse cx={104} cy={46} rx={16.5} ry={7} transform="rotate(45 104 46)" fill="none" stroke={BURST_COLOURS[0]} strokeWidth={1} />
        <circle cx={104} cy={46} r={5} fill={BURST_COLOURS[0]} />
        <path d="M60 50 Q84 0 104 28" fill="none" stroke={BURST_COLOURS[0]} strokeOpacity={0.3} strokeDasharray="3 4" />
        <line x1={96} y1={116} x2={96} y2={70} stroke={BURST_GOLD} strokeWidth={2} />
        <path d="M96 70 L99 74" stroke={BURST_GOLD} strokeWidth={2} />
        <rect x={90} y={102} width={12} height={14} rx={5} fill={BURST_GOLD} />
        <circle cx={96} cy={98} r={3} fill={BURST_GOLD} />
        {/* burstRev 8: a golden atom with its countdown ring, and the clean counter. */}
        <circle cx={34} cy={30} r={6} fill="#FFD84A" stroke="#FFF2B0" strokeWidth={1} />
        <path d="M34 20 A10 10 0 1 1 24 30" fill="none" stroke="#FFD84A" strokeWidth={1.5} strokeDasharray="2 2" />
        <text x={162} y={10} textAnchor="end" fontSize={8} fontFamily="monospace" fill="#7CFFB0">CLEAN 3/3</text>
      </svg>
       <p className="text-center text-xs text-muted-foreground">Fire straight up to split the atoms; clear a wave without a miss for a bonus.</p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: BurstPuzzleData | null = puzzle.type === "burst" ? puzzle : null;
  const fireFlip = useRef(0);
  /** Arrow press/release waiting to be sent: −1/1 = head for a wall, 0 = stop here. */
  const arrowEdge = useRef<number | null>(null);
  const keyMove = useRef(heldHorizontal());

  const tickInput = (state: BurstState): PointerPayload | null => {
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
      game={burstArtGameFor(data?.burstRev)}
      sounds={burstAllSounds}
      checkpoint={burstCheckpoint}
      interval={BURST_CHECKPOINT_INTERVAL}
      encodeRun={encodeBurstRun}
      tickInput={tickInput}
      pointer={(kind) => kind === "down" ? fire() : null}
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
    {/* Polish A1: the same 76 px row and boxes; the arrows larger (36 px for 30) with a soft gold glow (shadows only, so nothing moves). */}
    <div data-game-controls="pad" className="grid h-[76px] shrink-0 touch-none select-none grid-cols-2 items-start gap-4">
      <ArcadeControlButton type="button" aria-label="Move left" disabled={locked} className="h-[76px] w-full border-2 border-primary/80 bg-background/40 p-0 text-[36px] leading-none text-primary shadow-[0_0_14px_rgba(245,184,46,0.28),inset_0_0_12px_rgba(245,184,46,0.12)] [text-shadow:0_0_10px_rgba(245,184,46,0.55)] active:bg-primary/30 active:shadow-[0_0_20px_rgba(245,184,46,0.45),inset_0_0_14px_rgba(245,184,46,0.2)] before:content-['◀']" onPressStart={holdStart(-1)} onPressEnd={holdEnd} />
      <ArcadeControlButton type="button" aria-label="Move right" disabled={locked} className="h-[76px] w-full border-2 border-primary/80 bg-background/40 p-0 text-[36px] leading-none text-primary shadow-[0_0_14px_rgba(245,184,46,0.28),inset_0_0_12px_rgba(245,184,46,0.12)] [text-shadow:0_0_10px_rgba(245,184,46,0.55)] active:bg-primary/30 active:shadow-[0_0_20px_rgba(245,184,46,0.45),inset_0_0_14px_rgba(245,184,46,0.2)] before:content-['▶']" onPressStart={holdStart(1)} onPressEnd={holdEnd} />
    </div>
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
      {result.state.exp ? (
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
  generate: () => ({ type: "burst", seed: 1, burstRev: BURST_REV_CLEAN }) satisfies BurstPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
