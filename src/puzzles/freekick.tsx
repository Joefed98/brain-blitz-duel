import { useMemo, useRef } from "react";

import { gameDisplayName } from "@/lib/duel/gameNames";
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
  FREEKICK_REV_DEALT,
  FREEKICK_REV_3,
  FREEKICK_REV_4,
  FREEKICK_INPUT_SHOT,
  FREEKICK_INPUT_AIM,
  FREEKICK_INPUT_CURL,
  FREEKICK_INPUT_POWER,
  FREEKICK_INPUT_STRIKE,
  FREEKICK_WORLD_H,
  FREEKICK_WORLD_W,
  fkCamSpace,
  fkCamera,
  fkKickOf,
  fkProject,
  freekickCheckpoint,
  type FreekickState,
} from "@/lib/arcade/freekick";
import {
  FK_V3_PRESS_Y,
  freekickAimAt,
  freekickArtGameFor,
  freekickCurlFromDrag,
  freekickScene,
  freekickSceneKey,
  freekickDrawnShot,
  freekickStroke,
  freekickV3Ui,
  freekickV4Ui,
  freekickViewOn,
  freekickViewToWorld,
} from "@/lib/arcade/freekick.renderer";
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
        <path d="M96 122 Q78 84 120 44" fill="none" stroke="#FFECBE" strokeOpacity={0.55} strokeWidth={2} strokeDasharray="3 3" />
        <path d="M92 128 Q86 112 104 100" fill="none" stroke="#FFFFFF" strokeOpacity={0.8} strokeWidth={3} strokeLinecap="round" />
        <circle cx={96} cy={118} r={5.5} fill="#F4F6F8" />
      </svg>
      <p className="text-center text-xs text-muted-foreground">Draw the shot from the ball (bend it to curl), then hold the bar and release in the gold.</p>
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

/** A pointer that moved less than this (world px) is a tap (freekickRev 3: aim), further a drag (curl). */
const TAP_SLOP = 12;

/**
 * freekickRev 3's pointer: a tap on the goal aims (AIM, the goal-plane point in cm), a sideways drag sets the curl
 * (CURL, previewed live), a press on the power bar starts the meter (POWER) and its release strikes (STRIKE). Aim and
 * curl can be redone until the meter starts.
 */
function v3Pointer(
  gesture: { current: { x: number; y: number; power: boolean; drag: boolean } | null },
  state: FreekickState | null,
  kind: "down" | "move" | "up",
  x: number,
  y: number,
): PointerPayload | null {
  const aiming = state !== null && state.phase === FK_AIM;
  const metering = (state?.meterAt ?? -1) >= 0;
  if (kind === "down") {
    const power = aiming && y >= FK_V3_PRESS_Y && state.aimed === 1 && !metering;
    gesture.current = { x, y, power, drag: false };
    freekickV3Ui.curl = null;
    return power ? { k: FREEKICK_INPUT_POWER, a: 0, b: 0, c: 0 } : null;
  }
  const g = gesture.current;
  if (!g) return null;
  if (!g.power && Math.hypot(x - g.x, y - g.y) > TAP_SLOP) g.drag = true;
  if (kind === "move") {
    if (g.drag && aiming && !metering) freekickV3Ui.curl = freekickCurlFromDrag(x - g.x);
    return null;
  }
  gesture.current = null;
  freekickV3Ui.curl = null;
  if (g.power) return { k: FREEKICK_INPUT_STRIKE, a: 0, b: 0, c: 0 };
  if (!aiming || metering) return null;
  if (g.drag) return { k: FREEKICK_INPUT_CURL, a: 0, b: freekickCurlFromDrag(x - g.x), c: 0 };
  const at = freekickAimAt(state, x, y);
  return at ? { k: FREEKICK_INPUT_AIM, a: at.x, b: at.y, c: 0 } : null;
}

/**
 * freekickRev 4's pointer: a stroke drawn out from the ball sets the shot (SHOT: where it ends is the target, how it
 * bends is the curl; freekickDrawnShot), redrawn freely until the meter starts; a press on the power bar starts the
 * meter (POWER) and its release strikes (STRIKE). The drawn line stays faintly on screen until the strike.
 */
function v4Pointer(
  gesture: { current: { x: number; y: number; power: boolean; drag: boolean } | null },
  stroke: { current: { x: number; y: number }[] },
  state: FreekickState | null,
  kind: "down" | "move" | "up",
  x: number,
  y: number,
): PointerPayload | null {
  const aiming = state !== null && state.phase === FK_AIM;
  const metering = (state?.meterAt ?? -1) >= 0;
  // The stroke in the camera's world px: freekickRev 4's view is zoomed (display only), the power bar is not.
  const at = state && freekickViewOn(state) ? freekickViewToWorld(x, y) : { x, y };
  if (kind === "down") {
    const power = aiming && y >= FK_V3_PRESS_Y && state.aimed === 1 && !metering;
    gesture.current = { x, y, power, drag: false };
    if (power) return { k: FREEKICK_INPUT_POWER, a: 0, b: 0, c: 0 };
    if (aiming && !metering && y < FK_V3_PRESS_Y) {
      stroke.current = [at];
      freekickV4Ui.live = [at];
    }
    return null;
  }
  const g = gesture.current;
  if (!g) return null;
  if (!g.power && stroke.current.length > 0) {
    const last = stroke.current[stroke.current.length - 1]!;
    if (Math.hypot(at.x - last.x, at.y - last.y) >= 2) stroke.current.push(at);
    if (stroke.current.length > 160) stroke.current.splice(1, 1);
    freekickV4Ui.live = stroke.current.slice();
  }
  if (kind === "move") return null;
  gesture.current = null;
  if (g.power) return { k: FREEKICK_INPUT_STRIKE, a: 0, b: 0, c: 0 };
  const pts = stroke.current;
  stroke.current = [];
  freekickV4Ui.live = null;
  if (!aiming || metering || !state) return null;
  const shot = freekickDrawnShot(state, pts);
  if (!shot) return null;
  freekickV4Ui.line = { k: state.k, pts: pts.slice() };
  return { k: FREEKICK_INPUT_SHOT, a: shot.x, b: shot.y, c: shot.b };
}

/**
 * freekickRev 4's keys (computer layout): the mouse draws the shot as a finger; ← → ↑ ↓ nudge the drawn shot's target
 * (20 cm, Shift 5 cm; with nothing drawn the first press aims at the goal's centre), A / D its bend (10 a press), Space
 * held starts the meter and its release strikes.
 */
function v4Key(kind: "down" | "up", key: string, send: (p: PointerPayload) => void, state: FreekickState, event: KeyboardEvent): boolean {
  const k = key.length === 1 ? key.toLowerCase() : key;
  const handled = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "a", "d", " "].includes(k);
  if (!handled) return false;
  if (state.phase !== FK_AIM) return true;
  const metering = (state.meterAt ?? -1) >= 0;
  if (k === " ") {
    if (kind === "down" && !event.repeat && !metering && state.aimed === 1) send({ k: FREEKICK_INPUT_POWER, a: 0, b: 0, c: 0 });
    else if (kind === "up" && metering) send({ k: FREEKICK_INPUT_STRIKE, a: 0, b: 0, c: 0 });
    return true;
  }
  if (kind !== "down" || metering) return true;
  const first = state.aimed !== 1;
  let x = first ? 0 : (state.aimX ?? 0);
  let y = first ? 120 : (state.aimY ?? 120);
  let b = state.curl ?? 0;
  const step = event.shiftKey ? 5 : 20;
  if (k === "a" || k === "d") b = Math.max(-100, Math.min(100, b + (k === "a" ? -10 : 10)));
  else if (!first) {
    x += k === "ArrowLeft" ? -step : k === "ArrowRight" ? step : 0;
    y += k === "ArrowUp" ? step : k === "ArrowDown" ? -step : 0;
  }
  freekickV4Ui.line = null;
  send({ k: FREEKICK_INPUT_SHOT, a: Math.max(-372, Math.min(372, x)), b: Math.max(11, Math.min(250, y)), c: b });
  return true;
}

/**
 * freekickRev 3's keys (computer layout): ← → ↑ ↓ move the aim (20 cm, Shift 5 cm; the first press aims at the goal's
 * centre), A / D bend the curl left / right (10 a press), Space held starts the meter and its release strikes.
 */
function v3Key(kind: "down" | "up", key: string, send: (p: PointerPayload) => void, state: FreekickState, event: KeyboardEvent): boolean {
  const k = key.length === 1 ? key.toLowerCase() : key;
  const handled = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "a", "d", " "].includes(k);
  if (!handled) return false;
  if (state.phase !== FK_AIM) return true;
  const metering = (state.meterAt ?? -1) >= 0;
  if (k === " ") {
    if (kind === "down" && !event.repeat && !metering && state.aimed === 1) send({ k: FREEKICK_INPUT_POWER, a: 0, b: 0, c: 0 });
    else if (kind === "up" && metering) send({ k: FREEKICK_INPUT_STRIKE, a: 0, b: 0, c: 0 });
    return true;
  }
  if (kind !== "down" || metering) return true;
  if (k === "a" || k === "d") {
    send({ k: FREEKICK_INPUT_CURL, a: 0, b: Math.max(-100, Math.min(100, (state.curl ?? 0) + (k === "a" ? -10 : 10))), c: 0 });
    return true;
  }
  const step = event.shiftKey ? 5 : 20;
  const x0 = state.aimed === 1 ? (state.aimX ?? 0) : 0;
  const y0 = state.aimed === 1 ? (state.aimY ?? 120) : 120;
  const first = state.aimed !== 1;
  const nx = first ? x0 : x0 + (k === "ArrowLeft" ? -step : k === "ArrowRight" ? step : 0);
  const ny = first ? y0 : y0 + (k === "ArrowUp" ? step : k === "ArrowDown" ? -step : 0);
  send({ k: FREEKICK_INPUT_AIM, a: Math.max(-372, Math.min(372, nx)), b: Math.max(11, Math.min(250, ny)), c: 0 });
  return true;
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: FreekickPuzzleData | null = puzzle.type === "freekick" ? puzzle : null;
  const latest = useRef<FreekickState | null>(null);
  const game = useMemo(() => freekickArtGameFor(data?.freekickRev), [data?.freekickRev]);
  const stroke = useRef<StrokePoint[]>([]);
  const gesture = useRef<{ x: number; y: number; power: boolean; drag: boolean } | null>(null);
  const v3 = (data?.freekickRev ?? 1) >= FREEKICK_REV_3;
  const v4 = (data?.freekickRev ?? 1) >= FREEKICK_REV_4;
  const drawn = useRef<{ x: number; y: number }[]>([]);
  const now = () => (typeof performance === "undefined" ? 0 : performance.now());
  return (
    <ArcadeCanvasStage
      diagKey="freekick"
      label={gameDisplayName("freekick")}
      background={FREEKICK_BG}
      fitWorld
      scene={freekickScene}
      sceneKey={freekickSceneKey}
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={FREEKICK_WORLD_W}
      worldH={FREEKICK_WORLD_H}
      game={game}
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
      {...(v3 ? { keys: (kind: "down" | "up", key: string, send: (p: PointerPayload) => void, state: FreekickState, event: KeyboardEvent) => (v4 ? v4Key : v3Key)(kind, key, send, state, event) } : {})}
      pointer={(kind, x, y) => {
        const state = latest.current;
        if (v4) return v4Pointer(gesture, drawn, state, kind, x, y);
        if (v3) return v3Pointer(gesture, state, kind, x, y);
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
  // What the run did, part by part (the points are the stored score's, shown by the arcade reveal above).
  const lines = result.parts.map((part) => `${part.label}: ${part.detail}`);
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
  generate: () => ({ type: "freekick", seed: 1, freekickRev: FREEKICK_REV_DEALT }) satisfies FreekickPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
