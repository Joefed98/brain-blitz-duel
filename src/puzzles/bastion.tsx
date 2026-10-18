import { heldHorizontal } from "@/lib/desktop";
import {
  basCheckpoint,
  bastionGame,
  BAS_BG,
  BAS_CHECKPOINT_INTERVAL,
  BAS_COLOURS,
  BAS_GOLD,
  BAS_HEALTH,
  BAS_WORLD_H,
  BAS_WORLD_W,
} from "@/lib/arcade/bastion";
import { useEffect, useRef, useState, type PointerEvent } from "react";

import { BAS_TURRET_X, BAS_TURRET_Y, BAS_STEP_DEG_X256, type BasState } from "@/lib/arcade/bastion";
import { encodeBastionRun, replayBastionRun } from "@/lib/duel/bastion";
import { BASTION_TIME_MS, type BastionPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";
import { ArcadeControlButton } from "@/components/puzzles/ArcadeControlButton";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: the turret, a circle, a square and the base bar. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 168 130"
        width={168}
        height={130}
        aria-hidden="true"
        style={{ background: BAS_BG, borderRadius: 10 }}
      >
        <circle cx={50} cy={34} r={10} fill={BAS_COLOURS[0]} />
        <rect x={104} y={46} width={22} height={22} fill={BAS_COLOURS[1]} />
        <line x1={84} y1={104} x2={98} y2={88} stroke={BAS_GOLD} strokeWidth={6} strokeLinecap="round" />
        <path d="M68 108 A16 16 0 0 1 100 108 Z" fill={BAS_GOLD} />
        <circle cx={108} cy={77} r={2.5} fill={BAS_GOLD} />
        <rect x={8} y={97} width={152} height={1.5} fill={BAS_GOLD} />
        {Array.from({ length: BAS_HEALTH }, (_, i) => (
          <rect key={i} x={60 + i * 10} y={116} width={8} height={5} fill={BAS_GOLD} />
        ))}
      </svg>
      <p className="text-center text-xs text-muted-foreground">Touch where you want to aim - it always fires.</p>
    </div>
  );
}

const ARROWS_KEY = "duelz-bastion-arrows";
export const ARROW_DEG_PER_TICK = 3;
const AIM_RADIUS = 180;

/** Aim point on a circle round the turret; 0° = left, 90° = up, 180° = right. */
function aimPoint(deg: number) {
  const rad = (deg * Math.PI) / 180;
  return {
    a: Math.round(BAS_TURRET_X - Math.cos(rad) * AIM_RADIUS),
    b: Math.round(BAS_TURRET_Y - Math.sin(rad) * AIM_RADIUS),
    c: 1,
  };
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: BastionPuzzleData | null = puzzle.type === "bastion" ? puzzle : null;
  const [arrows, setArrows] = useState(false);
  const arrowsRef = useRef(false);
  arrowsRef.current = arrows;
  const holding = useRef<-1 | 0 | 1>(0);
  const deg = useRef<number | null>(null);
  const keyHold = useRef(heldHorizontal());

  useEffect(() => {
    setArrows(window.localStorage.getItem(ARROWS_KEY) === "1");
  }, []);

  const toggle = () => {
    const next = !arrows;
    setArrows(next);
    holding.current = 0;
    deg.current = null;
    window.localStorage.setItem(ARROWS_KEY, next ? "1" : "0");
  };

  const tickInput = (state: BasState) => {
    // Desktop keys: ←/→ (A/D) are the two rotate buttons, in either mode.
    const keyDir = keyHold.current.dir();
    const dir = arrowsRef.current && holding.current !== 0 ? holding.current : keyDir;
    if (dir === 0) {
      if (!arrowsRef.current) deg.current = null;
      return null;
    }
    const current = deg.current ?? (state.angleFp * BAS_STEP_DEG_X256) / 65536;
    const next = Math.min(180, Math.max(0, current + dir * ARROW_DEG_PER_TICK));
    deg.current = next;
    return aimPoint(next);
  };

  const startHold = (dir: -1 | 1) => (_event: PointerEvent<HTMLButtonElement>) => { holding.current = dir; };
  const stopHold = () => { holding.current = 0; };

  const arrowBtn =
    "absolute bottom-3 flex h-[72px] w-[72px] select-none items-center justify-center rounded-2xl border-2 border-primary/70 bg-background/40 text-3xl text-primary active:bg-primary/30";

  return (
    <ArcadeCanvasStage
      diagKey="bastion"
      label="Bastion"
      background={BAS_BG}
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={BAS_WORLD_W}
      worldH={BAS_WORLD_H}
      game={bastionGame}
      checkpoint={basCheckpoint}
      interval={BAS_CHECKPOINT_INTERVAL}
      encodeRun={encodeBastionRun}
      tickInput={tickInput}
      keys={(kind, key) => keyHold.current.key(kind, key)}
      pointer={(kind, x, y) => (arrowsRef.current ? null : { a: x, b: y, c: kind === "up" ? 0 : 1 })}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
      overlay={
        <>
          <button
            type="button"
            onClick={toggle}
            className={`absolute right-2 top-12 rounded-full border px-3 py-1 text-xs font-semibold ${arrows ? "border-primary bg-primary text-primary-foreground" : "border-primary/60 bg-background/50 text-primary"}`}
            aria-pressed={arrows}
          >
            Arrows
          </button>
          {arrows && (
            <>
               <ArcadeControlButton type="button" aria-label="Rotate left" className={`${arrowBtn} left-3 before:content-['◀']`} onPressStart={startHold(-1)} onPressEnd={stopHold} />
               <ArcadeControlButton type="button" aria-label="Rotate right" className={`${arrowBtn} right-3 before:content-['▶']`} onPressStart={startHold(1)} onPressEnd={stopHold} />
            </>
          )}
        </>
      }
    />
  );
}

export function bastionLine(r: {
  destroyed: number;
  health: number;
  survived: boolean;
  endedSeconds: number;
}): string {
  const head = `${r.destroyed} destroyed · base ${r.health} / ${BAS_HEALTH}`;
  return r.survived ? `${head} · survived` : `${head} · base fell at ${r.endedSeconds.toFixed(1)}s`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "bastion") return null;
  const result = replayBastionRun(puzzle.seed, myAnswer ?? "");
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {bastionLine(result)}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
        Same waves for everyone
      </p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const bastionPuzzle: PuzzleDefinition = {
  key: "bastion",
  name: "Bastion",
  category: "arcade",
  timeLimitMs: BASTION_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "bastion", seed: 1 }) satisfies BastionPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
