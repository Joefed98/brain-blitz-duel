import { useRef } from "react";

import { gameDisplayName } from "@/lib/duel/gameNames";
import { stdLines } from "@/lib/arcade/arcadeStandard";
import {
  FK_AIM,
  FK_BALL_R,
  FK_M,
  FREEKICK_AIM_MAX,
  FREEKICK_BG,
  FREEKICK_CHECKPOINT_INTERVAL,
  FREEKICK_CURL_MAX,
  FREEKICK_FOCAL,
  FREEKICK_HORIZON,
  FREEKICK_INPUT_KICK,
  FREEKICK_POWER_MAX,
  FREEKICK_WORLD_H,
  FREEKICK_WORLD_W,
  fkCamSpace,
  fkCamera,
  fkKickOf,
  fkProject,
  freekickCheckpoint,
  type FreekickState,
} from "@/lib/arcade/freekick";
import { freekickArtGame, freekickScene, freekickStroke } from "@/lib/arcade/freekick.renderer";
import { encodeFreekickRun, replayFreekickRun } from "@/lib/duel/freekick";
import { FREEKICK_TIME_MS, type FreekickPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import { freekickSounds } from "@/lib/fx/freekickSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: the goal, the wall, the keeper, a gold hoop and a curled stroke through the ball. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 195 130" width={195} height={130} aria-hidden="true" style={{ background: FREEKICK_BG, borderRadius: 10 }}>
        <rect x={0} y={0} width={195} height={52} fill="#141925" />
        <rect x={0} y={52} width={195} height={78} fill="#245F31" />
        {[60, 76, 92, 108, 124].map((y) => (
          <rect key={y} x={0} y={y} width={195} height={7} fill="#BEFFAA" opacity={0.07} />
        ))}
        <circle cx={30} cy={12} r={8} fill="#FFFFFF" opacity={0.2} />
        <circle cx={165} cy={12} r={8} fill="#FFFFFF" opacity={0.2} />
        <g stroke="#EBF0F8" strokeOpacity={0.35} strokeWidth={0.6}>
          {[52, 60, 68, 76, 84, 92, 100, 108, 116, 124, 132, 140].map((x) => (
            <line key={x} x1={x} y1={30} x2={x} y2={55} />
          ))}
          {[34, 40, 46, 52].map((y) => (
            <line key={y} x1={50} y1={y} x2={145} y2={y} />
          ))}
        </g>
        <rect x={48} y={28} width={99} height={3} fill="#F4F6F8" />
        <rect x={48} y={28} width={3} height={28} fill="#F4F6F8" />
        <rect x={144} y={28} width={3} height={28} fill="#F4F6F8" />
        <circle cx={134} cy={38} r={7} fill="none" stroke="#FFD54B" strokeWidth={1.8} />
        <rect x={84} y={38} width={8} height={12} rx={2} fill="#C8F03C" />
        <line x1={84} y1={41} x2={76} y2={36} stroke="#B4DB2C" strokeWidth={2.2} strokeLinecap="round" />
        <line x1={92} y1={41} x2={100} y2={36} stroke="#B4DB2C" strokeWidth={2.2} strokeLinecap="round" />
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x={108 + i * 10} y={66} width={9} height={14} rx={2} fill="#C8102E" />
            <rect x={109 + i * 10} y={80} width={7} height={6} fill="#F2F2F2" />
            <circle cx={112.5 + i * 10} cy={63} r={3.2} fill="#D6A684" />
          </g>
        ))}
        <g fill="#FFFFFF" opacity={0.85}>
          {[100, 106, 112, 118, 124, 130, 136, 142, 148, 154].map((x) => (
            <rect key={x} x={x} y={92} width={3} height={1.4} />
          ))}
        </g>
        <path d="M96 122 Q78 84 120 44" fill="none" stroke="#FFECBE" strokeOpacity={0.55} strokeWidth={2} strokeDasharray="3 3" />
        <path d="M92 128 Q86 112 104 100" fill="none" stroke="#FFFFFF" strokeOpacity={0.8} strokeWidth={3} strokeLinecap="round" />
        <circle cx={96} cy={118} r={5.5} fill="#F4F6F8" />
      </svg>
      <p className="text-center text-xs text-muted-foreground">Draw through the ball: its line aims, its bend curls it, its speed is power.</p>
    </div>
  );
}

interface StrokePoint {
  x: number;
  y: number;
  t: number;
}

/** Stroke speed (world px a ms) that maps to no power and to full power. */
const SPEED_LOW = 0.35;
const SPEED_HIGH = 3.0;
/** The bow of a stroke (its widest sideways gap from the chord, as a share of the chord) that maps to full curl. */
const BOW_FULL = 0.25;

/**
 * A stroke's kick (a = aim, b = curl, c = power), or null when it does not go through the ball or up the screen.
 * Aim: the yaw a straight ball would need to cross the goal line where the stroke's first half points. Curl: the
 * ball bends the way the finger did (a stroke bowed to the right sends it out right and back left). Power: the
 * stroke's speed, measured on this phone; only the integers are recorded and replayed.
 */
export function freekickStrokeKick(state: FreekickState, pts: readonly StrokePoint[]): PointerPayload | null {
  if (pts.length < 2) return null;
  const k = fkKickOf(state);
  const cam = fkCamera(k);
  const ball = fkProject(cam, k.bx / FK_M, FK_BALL_R / FK_M, k.bz / FK_M);
  if (!ball) return null;
  const near = Math.max(30, 3 * (FK_BALL_R / FK_M) * ball.s);
  let passes = false;
  for (let i = 1; i < pts.length && !passes; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((ball.x - a.x) * dx + (ball.y - a.y) * dy) / l2));
    if (Math.hypot(a.x + dx * t - ball.x, a.y + dy * t - ball.y) <= near) passes = true;
  }
  if (!passes && Math.hypot(pts[0]!.x - ball.x, pts[0]!.y - ball.y) > near) return null;
  const s = pts[0]!;
  const e = pts[pts.length - 1]!;
  const cx = e.x - s.x;
  const cy = e.y - s.y;
  const len = Math.hypot(cx, cy);
  if (len < 30 || cy > -15) return null;
  // The first half of the stroke by length.
  let run = 0;
  let mid = e;
  for (let i = 1; i < pts.length; i++) {
    run += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
    if (run >= len / 2) {
      mid = pts[i]!;
      break;
    }
  }
  const dx = mid.x - s.x;
  const dy = mid.y - s.y;
  if (dy > -5) return null;
  // Where the direction points at the goal line's height on screen, back to camera space.
  const goal = fkCamSpace(cam, 0, 0, 0);
  const goalY = FREEKICK_HORIZON + (FREEKICK_FOCAL * 2.2) / goal.w;
  const sx = ball.x + (dx * (goalY - ball.y)) / dy;
  const u = ((sx - FREEKICK_WORLD_W / 2) * goal.w) / FREEKICK_FOCAL;
  const ballW = fkCamSpace(cam, k.bx / FK_M, 0, k.bz / FK_M).w;
  const a = Math.round(Math.atan2(u, goal.w - ballW) * 1000);
  // The bow: the widest signed gap from the chord, right of the chord positive.
  let bow = 0;
  for (const p of pts) {
    const cross = (cx * (p.y - s.y) - cy * (p.x - s.x)) / len;
    if (Math.abs(cross) > Math.abs(bow)) bow = cross;
  }
  const b = Math.round((-bow / len / BOW_FULL) * FREEKICK_CURL_MAX);
  let length = 0;
  for (let i = 1; i < pts.length; i++) length += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  const ms = Math.max(16, e.t - s.t);
  const speed = length / ms;
  const c = Math.round(((speed - SPEED_LOW) / (SPEED_HIGH - SPEED_LOW)) * FREEKICK_POWER_MAX);
  return {
    k: FREEKICK_INPUT_KICK,
    a: Math.max(-FREEKICK_AIM_MAX, Math.min(FREEKICK_AIM_MAX, a)),
    b: Math.max(-FREEKICK_CURL_MAX, Math.min(FREEKICK_CURL_MAX, b)),
    c: Math.max(0, Math.min(FREEKICK_POWER_MAX, c)),
  };
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: FreekickPuzzleData | null = puzzle.type === "freekick" ? puzzle : null;
  const latest = useRef<FreekickState | null>(null);
  const stroke = useRef<StrokePoint[]>([]);
  const now = () => (typeof performance === "undefined" ? 0 : performance.now());
  return (
    <ArcadeCanvasStage
      diagKey="freekick"
      label={gameDisplayName("freekick")}
      background={FREEKICK_BG}
      fitWorld
      scene={freekickScene}
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={FREEKICK_WORLD_W}
      worldH={FREEKICK_WORLD_H}
      game={freekickArtGame}
      sounds={freekickSounds}
      checkpoint={freekickCheckpoint}
      interval={FREEKICK_CHECKPOINT_INTERVAL}
      encodeRun={encodeFreekickRun}
      discrete
      inputKind={FREEKICK_INPUT_KICK}
      tickInput={(state) => {
        latest.current = state;
        return null;
      }}
      pointer={(kind, x, y) => {
        const state = latest.current;
        if (kind === "down") {
          stroke.current = [{ x, y, t: now() }];
          freekickStroke.pts = [{ x, y }];
          freekickStroke.releasedAt = null;
          return null;
        }
        if (stroke.current.length === 0) return null;
        stroke.current.push({ x, y, t: now() });
        if (stroke.current.length > 120) stroke.current.splice(1, 1);
        freekickStroke.pts = stroke.current.map((p) => ({ x: p.x, y: p.y }));
        if (kind === "move") return null;
        freekickStroke.releasedAt = now();
        const pts = stroke.current;
        stroke.current = [];
        if (!state || state.phase !== FK_AIM) return null;
        return freekickStrokeKick(state, pts);
      }}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "freekick") return null;
  const result = replayFreekickRun(puzzle.seed, myAnswer ?? "", puzzle.freekickRev);
  const lines = stdLines(result.parts, result.score, result.state.acted > 0);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-2 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {result.goals} of 10 scored · best {result.best} in a row
      </p>
      {lines.map((line) => (
        <p key={line} className="shrink-0 text-center font-mono text-sm text-foreground">
          {line}
        </p>
      ))}
      <p className="shrink-0 text-center font-mono text-sm text-muted-foreground">Same ten free kicks for everyone</p>
    </div>
  );
}

/** The seed is dealt on the server (freekickDeal.server.ts); every run is replayed there for scoring. */
export const freekickPuzzle: PuzzleDefinition = {
  key: "freekick",
  name: gameDisplayName("freekick"),
  category: "arcade",
  timeLimitMs: FREEKICK_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "freekick", seed: 1, freekickRev: 1 }) satisfies FreekickPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
