import { withArcadeFx } from "@/lib/arcade/arcadeFx.renderer";
import { POOL_FX } from "@/lib/arcade/sportsFx.renderer";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import type { ArcadeGame, ArcadeInputEvent } from "@/lib/arcade/engine";
import {
  poolCheckpoint,
  poolGameFor,
  poolIsSpot,
  poolPenalty,
  poolRevOf,
  poolShot2,
  poolShotC,
  poolSpinClamp,
  poolSpinCode,
  poolStdParts,
  POOL_AIM,
  POOL_BLACK,
  POOL_CUE,
  POOL_H,
  POOL_INPUT_SHOT,
  POOL_REV,
  POOL_RUN_TICKS,
  POOL_SPIN_SAFE,
  POOL_W,
  type PoolState,
} from "@/lib/arcade/pool";
import { drawPool, drawPoolPowerPanel, poolBallColour, poolScene, POOL_BG, type PoolAim } from "@/lib/arcade/pool.renderer";
import { SPORTS_CHECKPOINT_INTERVAL } from "@/lib/arcade/sportsKit";
import { expansionSounds } from "@/lib/fx/expansionSounds";
import { encodePoolRun, replayPoolRun } from "@/lib/duel/pool";
import type { PoolPuzzleData } from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** A pull shorter than this share of the meter is a cancel. */
const MIN_PULL = 0.04;
/** Aim rotation (world px): within this of the ball a drag turns the cue one-for-one; further out, finer. */
const FINE_FROM = 110;
const FINE_MIN = 0.3;
/** A touch nearer the ball than this does not turn the cue (the angle there is unsteady). */
const DEAD_R = 12;
/** A tap (moved less than this, world px, and quicker than TAP_MS) points the cue straight at the tapped spot. */
const TAP_MOVE = 6;
const TAP_MS = 300;

interface Spin {
  /** Side (right +) and top (+) or back (−), each −100…100 inside the safe circle. */
  x: number;
  y: number;
}

/** Fixed intro still: a corner of the table, the cue behind the cue ball lined up through the ghost ball, the meter. */
function IntroExample() {
  const segs = Array.from({ length: 12 }, (_, i) => i);
  const segColour = (k: number) => ["#3FB25A", "#8FC93E", "#E9D23A", "#EFA52C", "#E8692A", "#D8322E"][Math.min(5, Math.floor((k / 12) * 6))]!;
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
        <circle cx={96} cy={36} r={6} fill="#F4F1E8" />
        <rect x={90} y={33} width={12} height={6} fill={poolBallColour(10)} />
        <circle cx={120} cy={60} r={6} fill="#111114" />
        {/* The cue behind the cue ball, along the aim. */}
        <g transform="translate(146 86) rotate(16.4)">
          <rect x={10} y={-1.4} width={60} height={2.8} fill="#E6D1A8" />
          <rect x={70} y={-1.8} width={2} height={3.6} fill="#E3B341" />
          <rect x={72} y={-2} width={40} height={4} fill="#3B1D0E" />
          <rect x={8.6} y={-1.4} width={1.4} height={2.8} fill="#2E6FD8" />
        </g>
        <circle cx={146} cy={86} r={6} fill="#F4F1E8" />
      </svg>
      <svg viewBox="0 0 196 26" width={196} height={26} aria-hidden="true">
        <rect x={0} y={0} width={160} height={26} rx={8} fill="#7D838A" />
        <rect x={1.5} y={1.5} width={157} height={23} rx={7} fill="#121217" />
        {segs.map((k) => (
          <rect key={k} x={148 - (k + 1) * 11.5 + 1} y={7} width={9.5} height={12} fill={segColour(k)} opacity={k < 8 ? 1 : 0.22} />
        ))}
        <rect x={6} y={11.5} width={50} height={3} fill="#E6D1A8" />
        <rect x={56} y={11.5} width={1.4} height={3} fill="#2E6FD8" />
        <circle cx={180} cy={13} r={11} fill="#F4F1E8" />
        <circle cx={180} cy={13} r={8} fill="none" stroke="rgba(0,0,0,0.25)" strokeDasharray="2 2" />
        <circle cx={183} cy={8} r={2.6} fill="#D22B2B" />
      </svg>
    </div>
  );
}

/** The large cue ball: place the tip's contact (the red dot) anywhere inside the safe circle. */
function SpinPicker({ value, onChange, onClose }: { value: Spin; onChange: (s: Spin) => void; onClose: () => void }) {
  const face = useRef<SVGSVGElement | null>(null);
  const dragging = useRef<number | null>(null);
  // The ball's radius in the 240 viewBox, and the safe circle inside it.
  const BALL = 110;
  const SAFE = 82;
  const place = (clientX: number, clientY: number) => {
    const box = face.current?.getBoundingClientRect();
    if (!box || box.width <= 0) return;
    const fx = ((clientX - box.left) / box.width) * 240 - 120;
    const fy = ((clientY - box.top) / box.height) * 240 - 120;
    const p = poolSpinClamp(Math.round((fx / SAFE) * POOL_SPIN_SAFE), Math.round((-fy / SAFE) * POOL_SPIN_SAFE));
    onChange(p);
  };
  const dotX = 120 + (value.x / POOL_SPIN_SAFE) * SAFE;
  const dotY = 120 - (value.y / POOL_SPIN_SAFE) * SAFE;
  const words = [value.y > 8 ? "top" : value.y < -8 ? "back" : "", Math.abs(value.x) > 8 ? `${value.x > 0 ? "right" : "left"} side` : ""].filter(Boolean).join(" and ");
  const label = words ? words[0]!.toUpperCase() + words.slice(1) : "Centre";
  const node = (
    <div
      data-pool-spin-picker
      role="dialog"
      aria-label="Spin"
      className="fixed inset-0 z-50 flex touch-none select-none flex-col items-center justify-center gap-4 bg-black/75 px-4"
      style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))", paddingTop: "max(16px, env(safe-area-inset-top))" }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <p className="text-center text-[15px] font-bold text-[#F3F1EC]">Spin: {label}</p>
      <svg
        ref={face}
        viewBox="0 0 240 240"
        className="h-auto w-[min(72vw,280px)]"
        style={{ touchAction: "none" }}
        aria-label="Place the dot where the cue strikes the ball"
        onPointerDown={(event) => {
          event.preventDefault();
          dragging.current = event.pointerId;
          event.currentTarget.setPointerCapture(event.pointerId);
          place(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (dragging.current === event.pointerId) place(event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          if (dragging.current === event.pointerId) dragging.current = null;
        }}
        onPointerCancel={() => {
          dragging.current = null;
        }}
      >
        <defs>
          <radialGradient id="pool-spin-big" cx="38%" cy="32%" r="72%">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="0.55" stopColor="#ECE8DD" />
            <stop offset="1" stopColor="#8F8A7E" />
          </radialGradient>
        </defs>
        <circle cx={120} cy={124} r={BALL} fill="rgba(0,0,0,0.45)" />
        <circle cx={120} cy={120} r={BALL} fill="url(#pool-spin-big)" />
        <circle cx={120} cy={120} r={SAFE} fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth={1.5} strokeDasharray="5 5" />
        <line x1={120} y1={120 - SAFE} x2={120} y2={120 + SAFE} stroke="rgba(0,0,0,0.14)" />
        <line x1={120 - SAFE} y1={120} x2={120 + SAFE} y2={120} stroke="rgba(0,0,0,0.14)" />
        <circle cx={dotX} cy={dotY} r={11} fill="#D22B2B" stroke="#FFFFFF" strokeWidth={2} />
      </svg>
      <p className="text-center text-[13px] font-semibold text-[#BDBDCC]">Top follows through, back draws back, side bends off the cushions.</p>
      <div className="flex gap-3">
        <button type="button" className="press h-12 min-w-[112px] rounded-xl border border-white/15 bg-[#16161C] px-4 text-[15px] font-bold text-[#F3F1EC]" onClick={() => onChange({ x: 0, y: 0 })}>
          Centre
        </button>
        <button type="button" className="press h-12 min-w-[112px] rounded-xl border border-white/25 bg-[#24242C] px-4 text-[15px] font-bold text-[#F3F1EC]" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
  return typeof document !== "undefined" ? createPortal(node, document.body) : node;
}

/** The angle (radians) from the cue ball to the nearest ball still to play, or null. */
function defaultAim(s: PoolState): number | null {
  const cue = s.balls.find((b) => b.id === POOL_CUE && !b.down);
  if (!cue) return null;
  const spotsUp = s.balls.some((b) => !b.down && poolIsSpot(b.id));
  let best: number | null = null;
  let bestD = Infinity;
  for (const b of s.balls) {
    if (b.down || (spotsUp ? !poolIsSpot(b.id) : b.id !== POOL_BLACK)) continue;
    const dx = (b.x - cue.x) / 256;
    const dy = (b.y - cue.y) / 256;
    const d = Math.hypot(dx, dy);
    if (d < bestD) {
      bestD = d;
      best = Math.atan2(dy, dx);
    }
  }
  return best;
}

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: PoolPuzzleData | null = puzzle.type === "pool" ? puzzle : null;
  const rev = poolRevOf(data?.poolRev);
  /** The cue's angle round the ball for the shot it was set on (presentation until a shot is sent). */
  const aim = useRef<{ shots: number; angle: number } | null>(null);
  const drag = useRef<{ angle: number; x: number; y: number; moved: number; at: number } | null>(null);
  const pull = useRef(0);
  const [spin, setSpin] = useState<Spin>({ x: 0, y: 0 });
  const spinRef = useRef<Spin>(spin);
  spinRef.current = spin;
  const [picking, setPicking] = useState(false);
  const last = useRef<PoolState | null>(null);
  const panel = useRef<HTMLCanvasElement | null>(null);
  const pullStart = useRef<{ id: number; x: number } | null>(null);

  /** The cue's angle this shot: the player's, else straight at the nearest ball still to play. */
  const currentAngle = (s: PoolState): number | null => {
    if (aim.current && aim.current.shots === s.shots) return aim.current.angle;
    const a = defaultAim(s);
    if (a !== null) aim.current = { shots: s.shots, angle: a };
    return a;
  };

  // The sim, with a draw that paints the table, the cue and the aim the player is lining up (presentation only).
  const game = useMemo<ArcadeGame<PoolState, ArcadeInputEvent | null>>(() => {
    const base = poolGameFor(data?.poolRev);
    return {
      ...base,
      draw: (ctx, s) => {
        last.current = s;
        const a = s.phase === POOL_AIM && !s.over ? currentAngle(s) : null;
        const sp = spinRef.current;
        const view: PoolAim | null = a !== null ? { dx: Math.cos(a), dy: Math.sin(a), power: pull.current, spinX: sp.x, spinY: sp.y } : null;
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
    drawPoolPowerPanel(ctx, w, h, pull.current);
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

  /** The shot's payload on the round's revision: poolRev 2 sends the dot as it is; poolRev 1 its nearest of 5 × 5. */
  const shotPayload = (angle: number, power: number): PointerPayload => {
    const a = Math.round(Math.cos(angle) * 4000);
    const b = Math.round(Math.sin(angle) * 4000);
    const p = Math.max(1, Math.round(power * 1000));
    const sp = spinRef.current;
    if (rev === 2) return { k: POOL_INPUT_SHOT, a, b, ...poolShot2(p, sp.x, sp.y) };
    return { k: POOL_INPUT_SHOT, a, b, c: poolShotC(p, poolSpinCode(Math.round(sp.y / 50), Math.round(sp.x / 50))) };
  };

  const footer = (send: (payload: PointerPayload) => void) => (
    <div data-game-controls="power" className="flex h-[76px] w-full shrink-0 touch-none select-none items-stretch gap-3 px-1">
      <canvas
        ref={panel}
        className="h-full min-w-0 flex-1"
        style={{ touchAction: "none" }}
        aria-label="Power: pull the cue back to the left, let go to shoot"
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
          const angle = currentAngle(s);
          if (angle === null) return;
          send(shotPayload(angle, power));
        }}
        onPointerCancel={() => {
          pullStart.current = null;
          pull.current = 0;
          paintPanel();
        }}
      />
      <button
        type="button"
        data-pool-spin
        aria-label={`Spin: ${spin.x === 0 && spin.y === 0 ? "centre" : "set"}`}
        className="press flex h-[64px] w-[64px] shrink-0 items-center justify-center self-center rounded-full border border-white/15 bg-[#0E0E12]"
        onClick={() => setPicking(true)}
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
          <circle cx={20 + (spin.x / POOL_SPIN_SAFE) * 11} cy={20 - (spin.y / POOL_SPIN_SAFE) * 11} r={4} fill="#D22B2B" />
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
          // Dragging anywhere on the table turns the cue round the cue ball by the finger's own turn round it, scaled
          // down further out (finer); a quick tap points it straight at the tapped spot. Nothing is sent.
          const s = last.current;
          if (!s || s.phase !== POOL_AIM || s.over) {
            drag.current = null;
            return null;
          }
          const cue = s.balls.find((b) => b.id === POOL_CUE && !b.down);
          if (!cue) return null;
          const dx = x - cue.x / 256;
          const dy = y - cue.y / 256;
          const dist = Math.hypot(dx, dy);
          const at = Math.atan2(dy, dx);
          const now = typeof performance !== "undefined" ? performance.now() : 0;
          if (kind === "down") {
            drag.current = { angle: at, x, y, moved: 0, at: now };
            currentAngle(s);
            return null;
          }
          const d = drag.current;
          if (!d) return null;
          d.moved += Math.hypot(x - d.x, y - d.y);
          d.x = x;
          d.y = y;
          if (kind === "move") {
            const base = currentAngle(s);
            if (base !== null && dist > DEAD_R && d.moved >= TAP_MOVE) {
              const gain = Math.max(FINE_MIN, Math.min(1, FINE_FROM / dist));
              aim.current = { shots: s.shots, angle: wrapAngle(base + wrapAngle(at - d.angle) * gain) };
            }
            d.angle = at;
            return null;
          }
          // Up: a tap points the cue at the spot.
          if (d.moved < TAP_MOVE && now - d.at < TAP_MS && dist > DEAD_R) aim.current = { shots: s.shots, angle: at };
          drag.current = null;
          return null;
        }}
        footer={footer}
        onSubmit={(answer) => onSubmit(answer)}
        onDraftAnswer={onDraftAnswer}
      />
      {picking ? <SpinPicker value={spin} onChange={setSpin} onClose={() => setPicking(false)} /> : null}
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "pool") return null;
  const result = replayPoolRun(puzzle.seed, myAnswer ?? "", puzzle.poolRev);
  const parts = poolStdParts(result.state);
  const lines = parts ? parts.map((part) => `${part.label}: ${part.detail}`) : [];
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
