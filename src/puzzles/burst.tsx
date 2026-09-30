import { useEffect, useRef, useState, type PointerEvent } from "react";

import { Button } from "@/components/ui/button";

import {
  burstCheckpoint,
  burstGame,
  BURST_BG,
  BURST_CHECKPOINT_INTERVAL,
  BURST_COLOURS,
  BURST_GOLD,
  BURST_INPUT_FIRE,
  BURST_INPUT_MOVE,
  BURST_TEAL,
  BURST_WORLD_H,
  BURST_WORLD_W,
  type BurstState,
} from "@/lib/arcade/burst";
import { encodeBurstRun, replayBurstRun } from "@/lib/duel/burst";
import { BURST_TIME_MS, type BurstPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: the player, one large ball mid-bounce and a shot line. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 168 130" width={168} height={130} aria-hidden="true" style={{ background: BURST_BG, borderRadius: 10 }}>
        <line x1={0} y1={116} x2={168} y2={116} stroke={BURST_TEAL} strokeWidth={2} />
        <circle cx={104} cy={46} r={18} fill="none" stroke={BURST_COLOURS[0]} strokeWidth={5} />
        <path d="M60 50 Q84 0 104 28" fill="none" stroke={BURST_COLOURS[0]} strokeOpacity={0.3} strokeDasharray="3 4" />
        <line x1={96} y1={116} x2={96} y2={70} stroke={BURST_GOLD} strokeWidth={2} />
        <path d="M96 70 L99 74" stroke={BURST_GOLD} strokeWidth={2} />
        <rect x={90} y={102} width={12} height={14} rx={5} fill={BURST_GOLD} />
        <circle cx={96} cy={98} r={3} fill={BURST_GOLD} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">Fire straight up to split the ball.</p>
    </div>
  );
}

/** Same device setting as Bastion's arrows. */
const ARROWS_KEY = "duelz-bastion-arrows";

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: BurstPuzzleData | null = puzzle.type === "burst" ? puzzle : null;
  const [arrows, setArrows] = useState(false);
  const arrowsRef = useRef(false);
  arrowsRef.current = arrows;
  const dragging = useRef(false);
  const fireFlip = useRef(0);
  /** Arrow press/release waiting to be sent: −1/1 = head for a wall, 0 = stop here. */
  const arrowEdge = useRef<number | null>(null);

  useEffect(() => {
    setArrows(window.localStorage.getItem(ARROWS_KEY) === "1");
  }, []);

  const toggle = () => {
    const next = !arrows;
    setArrows(next);
    window.localStorage.setItem(ARROWS_KEY, next ? "1" : "0");
  };

  const tickInput = (state: BurstState): PointerPayload | null => {
    const edge = arrowEdge.current;
    if (edge === null) return null;
    arrowEdge.current = null;
    const a = edge < 0 ? 0 : edge > 0 ? BURST_WORLD_W : Math.round(state.x / 256);
    return { k: BURST_INPUT_MOVE, a, b: 0, c: 0 };
  };

  const hold = (dir: -1 | 1) => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      arrowEdge.current = dir;
    },
    onPointerUp: () => (arrowEdge.current = 0),
    onPointerCancel: () => (arrowEdge.current = 0),
  });

  const fire = (): PointerPayload => {
    fireFlip.current ^= 1;
    return { k: BURST_INPUT_FIRE, a: 0, b: fireFlip.current, c: 0 };
  };

  const arrowBtn =
    "flex h-12 w-12 select-none items-center justify-center rounded-xl border-2 border-primary/70 bg-background/40 text-2xl text-primary active:bg-primary/30";
  /** FIRE presses wait here and go out on the next tick. */
  const firePending = useRef(false);
  const tickAll = (state: BurstState): PointerPayload | null => {
    if (firePending.current) {
      firePending.current = false;
      return fire();
    }
    return tickInput(state);
  };

  const bar = useRef<HTMLDivElement | null>(null);
  const dragBar = (e: PointerEvent<HTMLDivElement>) => {
    const rect = bar.current?.getBoundingClientRect();
    if (!rect || arrowsRef.current) return;
    arrowEdge.current = null;
    const x = Math.max(0, Math.min(BURST_WORLD_W, Math.round(((e.clientX - rect.left) / rect.width) * BURST_WORLD_W)));
    // The same world-unit movement event used by the arena.
    barMove.current = { k: BURST_INPUT_MOVE, a: x, b: 0, c: 0 };
  };
  const barMove = useRef<PointerPayload | null>(null);
  const tickWithBar = (state: BurstState) => {
    const move = barMove.current;
    barMove.current = null;
    return tickAll(state) ?? move;
  };
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-2">
    <ArcadeCanvasStage
      diagKey="burst"
      label="Burst"
      background={BURST_BG}
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={BURST_WORLD_W}
      worldH={BURST_WORLD_H}
      game={burstGame}
      checkpoint={burstCheckpoint}
      interval={BURST_CHECKPOINT_INTERVAL}
      encodeRun={encodeBurstRun}
      tickInput={tickWithBar}
      pointer={(kind, x, y) => {
        if (kind === "down") {
          dragging.current = false;
          return fire();
        }
        if (!dragging.current) return null;
        if (kind === "up") dragging.current = false;
        return { k: BURST_INPUT_MOVE, a: x, b: 0, c: 0 };
      }}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
      overlay={
        <>
          <Button
            type="button"
            onClick={toggle}
            className={`absolute right-2 top-12 rounded-full border px-3 py-1 text-xs font-semibold ${arrows ? "border-primary bg-primary text-primary-foreground" : "border-primary/60 bg-background/50 text-primary"}`}
            aria-pressed={arrows}
          >
            Arrows
          </Button>
        </>
      }
    />
    <div ref={bar} className="flex h-[60px] shrink-0 touch-none select-none items-center justify-center gap-4 bg-background/60" onPointerDown={(e) => { if (e.target === e.currentTarget && !locked) { e.currentTarget.setPointerCapture(e.pointerId); dragBar(e); } }} onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId) && !locked) dragBar(e); }}>
      <Button type="button" aria-label="Move left" disabled={locked} className="h-11 w-11 border-2 border-primary/70 bg-background/40 p-0 text-xl text-primary active:bg-primary/30" style={{ touchAction: "none" }} {...hold(-1)}>◀</Button>
      <Button type="button" aria-label="Fire" disabled={locked} className="h-[52px] w-[52px] rounded-full p-0 text-xs font-bold" style={{ touchAction: "none" }} onPointerDown={(e) => { e.preventDefault(); firePending.current = true; }}>FIRE</Button>
      <Button type="button" aria-label="Move right" disabled={locked} className="h-11 w-11 border-2 border-primary/70 bg-background/40 p-0 text-xl text-primary active:bg-primary/30" style={{ touchAction: "none" }} {...hold(1)}>▶</Button>
    </div>
    </div>
  );
}

export function burstLine(r: { wave: number; score: number; hits: number; livesLost: number }): string {
  return `Wave ${Math.max(1, r.wave)} · ${r.hits} popped · ${r.livesLost} ${r.livesLost === 1 ? "life" : "lives"} lost · ${r.score}`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "burst") return null;
  const result = replayBurstRun(puzzle.seed, myAnswer ?? "");
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {burstLine(result)}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same waves for everyone</p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const burstPuzzle: PuzzleDefinition = {
  key: "burst",
  name: "Burst",
  category: "arcade",
  timeLimitMs: BURST_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "burst", seed: 1 }) satisfies BurstPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
