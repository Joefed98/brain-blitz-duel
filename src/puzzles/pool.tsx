import { withArcadeFx } from "@/lib/arcade/arcadeFx.renderer";
import { POOL_FX } from "@/lib/arcade/sportsFx.renderer";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useMemo, useRef, useState } from "react";

import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import { stdLines } from "@/lib/arcade/arcadeStandard";
import type { ArcadeGame, ArcadeInputEvent } from "@/lib/arcade/engine";
import {
  poolCheckpoint,
  poolGameFor,
  poolIsSpot,
  poolPenalty,
  poolShotC,
  poolSpinCode,
  poolStdParts,
  POOL_AIM,
  POOL_BLACK,
  POOL_CUE,
  POOL_H,
  POOL_INPUT_SHOT,
  POOL_REV,
  POOL_RUN_TICKS,
  POOL_W,
  type PoolState,
} from "@/lib/arcade/pool";
import { drawPool, drawPoolPowerPanel, poolBallColour, poolScene, POOL_BG, type PoolAim } from "@/lib/arcade/pool.renderer";
import { SPORTS_CHECKPOINT_INTERVAL } from "@/lib/arcade/sportsKit";
import { expansionSounds } from "@/lib/fx/expansionSounds";
import { encodePoolRun, replayPoolRun } from "@/lib/duel/pool";
import type { PoolPuzzleData } from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** The spins the spin button steps through: centre, top, back, left side, right side. */
const SPINS: readonly { topBack: number; side: number; label: string }[] = [
  { topBack: 0, side: 0, label: "centre" },
  { topBack: 2, side: 0, label: "top" },
  { topBack: -2, side: 0, label: "back" },
  { topBack: 0, side: -2, label: "left side" },
  { topBack: 0, side: 2, label: "right side" },
];

/** A pull shorter than this share of the panel is a cancel. */
const MIN_PULL = 0.04;

/** Fixed intro still: a corner of the table, a spot lined up to the pocket, the ghost ball and the cue ball. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 196 120" width={196} height={120} aria-hidden="true" style={{ background: POOL_BG, borderRadius: 10 }}>
        <rect x={4} y={4} width={188} height={112} rx={10} fill="#4A2814" />
        <rect x={16} y={16} width={164} height={88} fill="#1F6B45" />
        <circle cx={18} cy={18} r={9} fill="#000" stroke="#C9CED3" strokeWidth={2} />
        <circle cx={178} cy={18} r={9} fill="#000" stroke="#C9CED3" strokeWidth={2} />
        <line x1={150} y1={16} x2={150} y2={104} stroke="rgba(240,240,230,0.3)" />
        <line x1={46} y1={46} x2={22} y2={22} stroke="#fff" strokeOpacity={0.8} strokeWidth={1.4} />
        <circle cx={52} cy={52} r={6} fill={poolBallColour(3)} />
        <circle cx={60} cy={60} r={6} fill="none" stroke="#fff" strokeOpacity={0.7} />
        <line x1={66} y1={66} x2={140} y2={84} stroke="#fff" strokeOpacity={0.75} strokeDasharray="2 4" strokeWidth={1.4} />
        <circle cx={146} cy={86} r={6} fill="#F4F1E8" />
        <circle cx={96} cy={36} r={6} fill="#F4F1E8" />
        <rect x={90} y={33} width={12} height={6} fill={poolBallColour(10)} />
        <circle cx={120} cy={60} r={6} fill="#111114" />
      </svg>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: PoolPuzzleData | null = puzzle.type === "pool" ? puzzle : null;
  /** The aim direction (world px from the cue ball; presentation until a shot is sent). */
  const aim = useRef<{ dx: number; dy: number } | null>(null);
  const pull = useRef(0);
  const [spinIndex, setSpinIndex] = useState(0);
  const spinRef = useRef(0);
  spinRef.current = spinIndex;
  const last = useRef<PoolState | null>(null);
  const panel = useRef<HTMLCanvasElement | null>(null);
  const pullStart = useRef<{ id: number; x: number } | null>(null);

  const spinCode = () => {
    const s = SPINS[spinRef.current]!;
    return poolSpinCode(s.topBack, s.side);
  };

  /** The aim to draw (and to shoot): the player's, else straight at the nearest ball still to play. */
  const currentAim = (s: PoolState): { dx: number; dy: number } | null => {
    if (aim.current) return aim.current;
    const cue = s.balls.find((b) => b.id === POOL_CUE && !b.down);
    if (!cue) return null;
    const spotsUp = s.balls.some((b) => !b.down && poolIsSpot(b.id));
    let best: { dx: number; dy: number } | null = null;
    let bestD = Infinity;
    for (const b of s.balls) {
      if (b.down || (spotsUp ? !poolIsSpot(b.id) : b.id !== POOL_BLACK)) continue;
      const dx = (b.x - cue.x) / 256;
      const dy = (b.y - cue.y) / 256;
      const d = Math.hypot(dx, dy);
      if (d < bestD) {
        bestD = d;
        best = { dx, dy };
      }
    }
    return best;
  };

  // The sim, with a draw that paints the table and the aim the player is lining up (presentation only).
  const game = useMemo<ArcadeGame<PoolState, ArcadeInputEvent | null>>(() => {
    const base = poolGameFor(data?.poolRev);
    return {
      ...base,
      draw: (ctx, s) => {
        last.current = s;
        const a = s.phase === POOL_AIM ? currentAim(s) : null;
        const view: PoolAim | null = a ? { dx: a.dx, dy: a.dy, power: pull.current, spin: spinCode() } : null;
        withArcadeFx(POOL_FX, (c, st: PoolState) => drawPool(c, st, view))(ctx, s, { width: POOL_W, height: POOL_H });
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.poolRev]);

  const sounds = useMemo(
    () => () => {
      const watch = expansionSounds<PoolState>([
        { count: (s) => s.pots, sound: "ding", volume: 0.9 },
        { count: (s) => s.hits, sound: "tick", volume: 0.5 },
        { count: (s) => s.fouls, sound: "zap", volume: 0.7 },
        { count: (s) => (s.black === 1 ? 1 : 0), sound: "chime" },
      ]);
      return { frame: (s: PoolState, running: boolean) => watch(s, running), stop: () => {} };
    },
    [],
  );

  const paintPanel = () => {
    const node = panel.current;
    if (!node) return;
    const box = node.getBoundingClientRect();
    const ratio = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    const w = Math.max(1, Math.round(box.width));
    const h = Math.max(1, Math.round(box.height));
    if (node.width !== Math.round(w * ratio) || node.height !== Math.round(h * ratio)) {
      node.width = Math.round(w * ratio);
      node.height = Math.round(h * ratio);
    }
    const ctx = node.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawPoolPowerPanel(ctx, w, h, pull.current, spinCode());
  };

  useEffect(() => {
    paintPanel();
    const node = panel.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => paintPanel());
    ro.observe(node);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ready = () => {
    const s = last.current;
    return !locked && s !== null && !s.over && s.phase === POOL_AIM;
  };

  const footer = (send: (payload: PointerPayload) => void) => (
    <div data-game-controls="power" className="flex h-[76px] w-full shrink-0 touch-none select-none items-stretch gap-3 px-1">
      <canvas
        ref={panel}
        className="h-full min-w-0 flex-1"
        style={{ touchAction: "none" }}
        aria-label="Power: pull the cue left, let go to shoot"
        onPointerDown={(event) => {
          event.preventDefault();
          if (!ready()) return;
          pullStart.current = { id: event.pointerId, x: event.clientX };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = pullStart.current;
          if (!start || start.id !== event.pointerId) return;
          const width = event.currentTarget.getBoundingClientRect().width * 0.85;
          pull.current = Math.max(0, Math.min(1, (start.x - event.clientX) / Math.max(40, width)));
          paintPanel();
        }}
        onPointerUp={(event) => {
          const start = pullStart.current;
          if (!start || start.id !== event.pointerId) return;
          pullStart.current = null;
          const power = pull.current;
          pull.current = 0;
          paintPanel();
          const s = last.current;
          if (!s || power < MIN_PULL || !ready()) return;
          const a = currentAim(s);
          if (!a) return;
          const l = Math.hypot(a.dx, a.dy) || 1;
          send({ k: POOL_INPUT_SHOT, a: Math.round((a.dx / l) * 4000), b: Math.round((a.dy / l) * 4000), c: poolShotC(Math.max(1, Math.round(power * 1000)), spinCode()) });
        }}
        onPointerCancel={() => {
          pullStart.current = null;
          pull.current = 0;
          paintPanel();
        }}
      />
      <button
        type="button"
        aria-label={`Spin: ${SPINS[spinIndex]!.label}`}
        className="press flex h-[64px] w-[64px] shrink-0 items-center justify-center self-center rounded-full border border-white/15 bg-[#0E0E12]"
        onClick={() => {
          setSpinIndex((i) => (i + 1) % SPINS.length);
          requestAnimationFrame(paintPanel);
        }}
      >
        <svg viewBox="0 0 40 40" width={44} height={44} aria-hidden="true">
          <defs>
            <radialGradient id="pool-spin-ball" cx="38%" cy="34%" r="70%">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="0.6" stopColor="#E9E5DA" />
              <stop offset="1" stopColor="#9F9A8E" />
            </radialGradient>
          </defs>
          <circle cx={20} cy={20} r={17} fill="url(#pool-spin-ball)" />
          <line x1={20} y1={6} x2={20} y2={34} stroke="rgba(0,0,0,0.12)" />
          <line x1={6} y1={20} x2={34} y2={20} stroke="rgba(0,0,0,0.12)" />
          <circle cx={20 + SPINS[spinIndex]!.side * 5} cy={20 - SPINS[spinIndex]!.topBack * 5} r={4} fill="#D22B2B" />
        </svg>
      </button>
    </div>
  );

  return (
    <div data-stage-column="2" className="flex min-h-0 w-full flex-1 flex-col gap-2">
      <ArcadeCanvasStage
        diagKey="pool"
        label={gameDisplayName("pool")}
        background={POOL_BG}
        fitWorld
        scene={poolScene}
        seed={data?.seed ?? 1}
        enabled={data !== null}
        locked={locked}
        worldW={POOL_W}
        worldH={POOL_H}
        game={game}
        sounds={sounds}
        checkpoint={poolCheckpoint}
        interval={SPORTS_CHECKPOINT_INTERVAL}
        encodeRun={encodePoolRun}
        discrete
        inputKind={POOL_INPUT_SHOT}
        pointer={(kind, x, y) => {
          // Dragging on the table aims: the line runs from the cue ball towards the finger. Nothing is sent.
          const s = last.current;
          if (!s || s.phase !== POOL_AIM) return null;
          const cue = s.balls.find((b) => b.id === POOL_CUE && !b.down);
          if (!cue) return null;
          const dx = x - cue.x / 256;
          const dy = y - cue.y / 256;
          if (kind !== "up" && Math.hypot(dx, dy) > 4) aim.current = { dx, dy };
          return null;
        }}
        footer={footer}
        onSubmit={(answer) => onSubmit(answer)}
        onDraftAnswer={onDraftAnswer}
      />
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "pool") return null;
  const result = replayPoolRun(puzzle.seed, myAnswer ?? "", puzzle.poolRev);
  const parts = poolStdParts(result.state);
  const lines = parts ? stdLines(parts, result.score, result.state.acted === 1) : [];
  const penalty = poolPenalty(result.state);
  if (parts && penalty > 0 && result.state.acted === 1) lines.splice(parts.length, 0, `Fouls: ${result.fouls} → −${penalty}`);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-2 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {result.spots} of 7 spots{result.black ? " · black down" : result.blackEarly ? " · black too soon" : ""}
      </p>
      {lines.map((line) => (
        <p key={line} className="shrink-0 text-center font-mono text-sm text-muted-foreground">
          {line}
        </p>
      ))}
      <p className="shrink-0 text-center font-mono text-sm text-muted-foreground">Same layout for everyone</p>
    </div>
  );
}

/** The seed is dealt on the server from the proven bank; every run is replayed there for scoring. */
export const poolPuzzle: PuzzleDefinition = {
  key: "pool",
  name: gameDisplayName("pool"),
  category: "arcade",
  timeLimitMs: (POOL_RUN_TICKS / 60) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "pool", seed: 1, poolRev: POOL_REV }) satisfies PoolPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
