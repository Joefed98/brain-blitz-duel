import { withArcadeFx } from "@/lib/arcade/arcadeFx.renderer";
import { curlingFxFor } from "@/lib/arcade/sportsFx.renderer";
import { useMemo, useRef, useState } from "react";

import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import {
  curlingCheckpoint,
  curlingGameFor,
  curlingStdParts,
  CURL_AIM,
  CURL_INPUT_SWEEP,
  CURL_START_MAX,
  CURL_INPUT_THROW,
  CURL_TRAVEL,
  CURL_WEIGHT_MAX,
  CU,
  CURLING_REV,
  CURLING_RUN_TICKS,
  CURLING_W,
  curlingWorldHFor,
  curlAimPath,
  curlDrawZone,
  curlWeightFromSwipeV3,
  HOG_NEAR,
  type CurlingState,
} from "@/lib/arcade/curling";
import {
  curlingScene,
  curlFarHouse,
  curlInsetToSheet,
  curlMeterWeightAt,
  curlOnMeterV4,
  curlProject,
  curlViewFor,
  drawCurling,
  CURLING_BG,
  CURL_PX_PER_CM_FAR,
  type CurlAim,
} from "@/lib/arcade/curling.renderer";
import { devWarp } from "@/lib/arcade/devWarp";
import { TICKS_PER_SECOND, type ArcadeGame, type ArcadeInputEvent } from "@/lib/arcade/engine";
import { SPORTS_CHECKPOINT_INTERVAL } from "@/lib/arcade/sportsKit";
import { curlingSounds } from "@/lib/fx/gameSounds";
import { encodeCurlingRun, replayCurlingRun } from "@/lib/duel/curling";
import { gameDisplayName } from "@/lib/duel/gameNames";
import type { CurlingPuzzleData } from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/**
 * Weight from a swipe's speed up the lane (world px a ms; every revision, the sim's curlWeightFromSwipeV3): about 0.95
 * is a draw to the button on curlRev 1 and 2, about 0.96 to the tee on curlRev 3's gentler line.
 */
export const curlWeightFromSwipe = curlWeightFromSwipeV3;
/** The keyboard's weight step on curlRev 3's meter (Shift: five times). */
const KEY_WEIGHT_STEP = 10;

/** A rub's strength 1…100 from the finger's speed (world px a ms). */
function rubStrength(pxPerMs: number): number {
  return Math.max(1, Math.min(100, Math.round(pxPerMs * 45)));
}

/**
 * Fixed intro still: the sheet running away to the far house, a gold stone on the button, a red one, the broom, the
 * faint aim line, a swipe and (curlRev 3) the weight meter with its gold draw zone.
 */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 195 120" width={195} height={120} aria-hidden="true" style={{ background: CURLING_BG, borderRadius: 10 }}>
        <rect x="0" y="0" width="195" height="34" fill="#0C1320" />
        {[30, 60, 97, 134, 165].map((x) => (
          <circle key={x} cx={x} cy={10} r={4} fill="#FFF3C4" opacity={0.8} />
        ))}
        <rect x="0" y="26" width="195" height="8" fill="#4A3A26" />
        <rect x="0" y="33" width="195" height="1.2" fill="#3FD6FF" />
        <path d="M78 34 L117 34 L170 120 L25 120 Z" fill="#DCE7EF" />
        <ellipse cx="97.5" cy="44" rx="22" ry="6" fill="#1F5FB8" />
        <ellipse cx="97.5" cy="44" rx="14.5" ry="4" fill="#E9F1F6" />
        <ellipse cx="97.5" cy="44" rx="7.3" ry="2" fill="#C8202E" />
        <ellipse cx="97.5" cy="44" rx="1.8" ry="0.6" fill="#E9F1F6" />
        <ellipse cx="97.5" cy="42.5" rx="3" ry="1.2" fill="#6C717C" />
        <rect x="96" y="41" width="3" height="1.2" fill="#E8B53A" />
        <ellipse cx="108" cy="46.5" rx="3" ry="1.2" fill="#6C717C" />
        <rect x="106.5" y="45" width="3" height="1.2" fill="#C42A2E" />
        <ellipse cx="88" cy="44" rx="4" ry="1.4" fill="#E8B53A" />
        <line x1="88" y1="43" x2="90" y2="34.5" stroke="#FFE29A" strokeWidth="1" />
        <path d="M112 98 Q106 84 102 76" stroke="#FFF3C4" strokeWidth="1.4" fill="none" opacity="0.6" strokeLinecap="round" />
        <ellipse cx="112" cy="102" rx="7" ry="2.6" fill="#6C717C" />
        <rect x="109" y="98" width="6" height="2" fill="#E8B53A" />
        <path d="M101 101 L96 101 L101 98 Z M123 101 L128 101 L123 98 Z" fill="#FFE29A" />
        <rect x="178" y="48" width="9" height="64" rx="2" fill="#05080F" opacity="0.85" />
        <rect x="179.5" y="76" width="6" height="15" fill="#E8B53A" opacity="0.45" stroke="#E8B53A" strokeWidth="0.8" />
        <rect x="176" y="83" width="13" height="1.4" fill="#FFE29A" />
        <rect x="180.5" y="86" width="4" height="25" fill="#FFE29A" opacity="0.8" />
        <g stroke="#E8B53A" strokeWidth="2" fill="none" opacity="0.85">
          <line x1="112" y1="117" x2="112" y2="108" />
          <line x1="112" y1="108" x2="108.5" y2="111.5" />
          <line x1="112" y1="108" x2="115.5" y2="111.5" />
        </g>
      </svg>
      <p className="text-center text-xs text-muted-foreground">Slide the stone, drag the target, pick In or Out, set the power bar in its gold zone, then Throw. Brush left or right of it to bend it.</p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: CurlingPuzzleData | null = puzzle.type === "curling" ? puzzle : null;
  // The stored stamp picks the rules, the world's height and the controls (curlRev 2: slide the start, side brushing).
  const rev = data?.curlRev ?? 1;
  const v2 = rev >= 2;
  /** curlRev 3: the weight meter with the draw zone and the faint aim line. */
  const v3 = rev >= 3;
  /** curlRev 4: the weight is set on the power bar (tap or drag) and the Throw button releases it; no swipe. */
  const v4 = rev >= 4;
  /** curlRev 4: the weight set on the bar (null until the first set; it stays set from throw to throw). */
  const [setWeight, setSetWeight] = useState<number | null>(null);
  /** The last aid worked out (curlRev 3): a key for the sheet and aim it was worked out for. */
  const aidKey = useRef("");
  const view = curlViewFor(rev);
  const worldH = curlingWorldHFor(rev);
  const farHouse = useMemo(() => curlFarHouse(view), [view]);
  /** Screen px a cm across on the near hog line (the start slide's step). */
  const hogK = useMemo(() => curlProject(0, HOG_NEAR, view).k, [view]);
  const aim = useRef<CurlAim>({ broomX: 0, broomY: 0, turn: 0, swipe: null, startX: 0 });
  const [turn, setTurn] = useState(0);
  /** The sim state the last frame drew (presentation only: where the moving stone is, for sweeping). */
  const seen = useRef<CurlingState | null>(null);
  const gesture = useRef<{ mode: "broom" | "inset" | "pending" | "slide" | "swipe" | "sweep" | "power" | "none"; x: number; y: number; bx: number; by: number; samples: { y: number; t: number }[]; lastAt: number; lastX: number; lastY: number } | null>(null);

  // The sim as rooms deal it; its draw shows the arena, the stones and what the stage holds (broom, turn, swipe, start).
  const game = useMemo<ArcadeGame<CurlingState, ArcadeInputEvent | null>>(() => {
    // devWarp: development only (review shots, scripts/shots/curling-prepare-shots.ts); production plays the game as is.
    const base = devWarp("curling", curlingGameFor(rev));
    const fx = curlingFxFor(rev);
    return {
      ...base,
      draw: (ctx, state) => {
        seen.current = state;
        if (rev >= 3 && state.phase === CURL_AIM) {
          // The meter's draw zone and the aim line, worked out again only when the sheet or the aim changes.
          const a = aim.current;
          const sx = Math.round(a.startX ?? 0);
          const bx = Math.round(a.broomX);
          const by = Math.round(a.broomY);
          const key = `${state.thrown}:${state.restTick}:${sx}:${bx}:${by}:${a.turn}`;
          if (key !== aidKey.current) {
            aidKey.current = key;
            a.zone = curlDrawZone(sx, bx, by, a.turn, rev);
            a.path = curlAimPath(state, sx, bx, by, a.zone?.tee ?? 316, a.turn);
          }
        }
        withArcadeFx(fx, (c, st: CurlingState) => drawCurling(c, st, aim.current))(ctx, state, { width: CURLING_W, height: worldH });
      },
    };
  }, [rev, worldH]);

  const setStart = (x: number) => {
    aim.current.startX = Math.max(-CURL_START_MAX, Math.min(CURL_START_MAX, x));
  };
  const throwPayload = (weight: number): PointerPayload => {
    aim.current.lastRelease = weight;
    // curlRev 4: the power bar's marker stays where it was set.
    if (!v4) aim.current.keyWeight = null;
    return throwPayloadOf(weight);
  };
  /** curlRev 4: set the bar's weight (the marker, the meter's fill and the Throw button follow it). */
  const setBar = (w: number) => {
    const weight = Math.max(1, Math.min(CURL_WEIGHT_MAX, Math.round(w)));
    aim.current.keyWeight = weight;
    setSetWeight(weight);
  };
  const throwPayloadOf = (weight: number): PointerPayload => ({
    k: CURL_INPUT_THROW,
    a: Math.round(aim.current.broomX),
    b: Math.round(aim.current.broomY),
    c: weight * 2 + aim.current.turn,
    ...(v2 ? { d: Math.round(aim.current.startX ?? 0) } : {}),
  });

  const setBroom = (x: number, y: number) => {
    aim.current.broomX = Math.max(-200, Math.min(200, x));
    aim.current.broomY = Math.max(-183, Math.min(183, y));
  };

  const pointer = (kind: "down" | "move" | "up", x: number, y: number): PointerPayload | null => {
    const s = seen.current;
    const now = performance.now();
    if (!s) return null;
    if (kind === "down") {
      if (s.phase === CURL_TRAVEL) {
        gesture.current = { mode: "sweep", x, y, bx: 0, by: 0, samples: [], lastAt: now, lastX: x, lastY: y };
        return null;
      }
      if (s.phase !== CURL_AIM) return null;
      const inInset = curlInsetToSheet(x, y);
      if (v4 && curlOnMeterV4(x, y)) {
        // curlRev 4: a tap or drag on the power bar sets the weight.
        setBar(curlMeterWeightAt(y));
        gesture.current = { mode: "power", x, y, bx: 0, by: 0, samples: [], lastAt: now, lastX: x, lastY: y };
      } else if (inInset) {
        setBroom(inInset.x, inInset.y);
        gesture.current = { mode: "inset", x, y, bx: 0, by: 0, samples: [], lastAt: now, lastX: x, lastY: y };
      } else if (y <= farHouse.bottom) {
        // A drag near the far house moves the broom (across at the house's own scale; along it coarser).
        gesture.current = { mode: "broom", x, y, bx: aim.current.broomX, by: aim.current.broomY, samples: [], lastAt: now, lastX: x, lastY: y };
      } else {
        // curlRev 2: sideways first slides the stone along the hog line; upwards first is the throw's swipe.
        gesture.current = { mode: v2 ? "pending" : "swipe", x, y, bx: aim.current.startX ?? 0, by: 0, samples: [{ y, t: now }], lastAt: now, lastX: x, lastY: y };
      }
      return null;
    }
    const g = gesture.current;
    if (!g) return null;
    if (g.mode === "pending") {
      g.samples.push({ y, t: now });
      const dx = x - g.x;
      const dy = y - g.y;
      // curlRev 4 has no swipe: only a sideways drag (the start slide) does anything here.
      if (Math.hypot(dx, dy) >= 10) g.mode = Math.abs(dx) > Math.abs(dy) ? "slide" : v4 ? "none" : "swipe";
    }
    if (g.mode === "power") {
      if (s.phase === CURL_AIM) setBar(curlMeterWeightAt(y));
    } else if (g.mode === "slide") {
      setStart(g.bx + (x - g.x) / hogK);
    } else if (g.mode === "inset") {
      const p = curlInsetToSheet(x, y);
      if (p) setBroom(p.x, p.y);
    } else if (g.mode === "broom") {
      setBroom(g.bx + (x - g.x) / CURL_PX_PER_CM_FAR, g.by + (y - g.y) * 6);
    } else if (g.mode === "swipe") {
      if (g.samples[g.samples.length - 1]?.t !== now) g.samples.push({ y, t: now });
      while (g.samples.length > 2 && now - g.samples[0]!.t > 140) g.samples.shift();
      const first = g.samples[0]!;
      const v = (first.y - y) / Math.max(8, now - first.t);
      aim.current.swipe = g.y - y > 12 ? curlWeightFromSwipe(v) : null;
    } else if (g.mode === "sweep") {
      // curlRev 1: rubbing ahead of the moving stone. curlRev 2: rubbing anywhere, on its left or its right (the side
      // bends it that way). A stroke every 70 ms while the finger moves, its strength the finger's speed.
      const stone = s.active >= 0 ? curlProject(s.x[s.active]! / CU, s.y[s.active]! / CU, view) : null;
      const dt = now - g.lastAt;
      if (s.phase === CURL_TRAVEL && stone && (v2 || y < stone.sy) && dt >= 70) {
        const speed = Math.hypot(x - g.lastX, y - g.lastY) / dt;
        g.lastAt = now;
        g.lastX = x;
        g.lastY = y;
        if (speed > 0.05) return { k: CURL_INPUT_SWEEP, a: rubStrength(speed), b: v2 ? (x < stone.sx ? -1 : 1) : 0, c: 0 };
      }
    }
    if (kind === "up") {
      gesture.current = null;
      if (g.mode === "swipe") {
        const w = aim.current.swipe;
        aim.current.swipe = null;
        if (w !== null && g.y - y >= 40 && s.phase === CURL_AIM) return throwPayload(w);
      }
    }
    return null;
  };

  const pickTurn = (t: number) => {
    aim.current.turn = t;
    setTurn(t);
  };

  return (
    <div data-stage-column="2" className="flex min-h-0 w-full flex-1 flex-col gap-2">
      <ArcadeCanvasStage
        diagKey="curling"
        label={gameDisplayName("curling")}
        background={CURLING_BG}
        fitWorld
        scene={(ctx, sceneView) => curlingScene(ctx, sceneView, rev)}
        seed={data?.seed ?? 1}
        enabled={data !== null}
        locked={locked}
        worldW={CURLING_W}
        worldH={worldH}
        game={game}
        sounds={curlingSounds}
        checkpoint={curlingCheckpoint}
        interval={SPORTS_CHECKPOINT_INTERVAL}
        encodeRun={encodeCurlingRun}
        discrete
        pointer={pointer}
        keys={(kind, key, send, state, event) => {
          // Desktop: ←/→ move the broom (while a stone travels, brush its left / right side on curlRev 2), A / D slide
          // the start (curlRev 2), I / O pick the turn, Enter throws a draw weight, S sweeps.
          // curlRev 3: − / + set the weight on the meter (from the draw zone's mark), Enter throws it.
          // curlRev 4: − / + set the power bar's weight (from the draw zone's mark the first time), Enter throws it.
          if (kind !== "down") return ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "i", "o", "s", ...(v2 ? ["a", "d"] : []), ...(v3 ? ["-", "=", "+"] : [])].includes(key);
          if (v2 && (key === "ArrowLeft" || key === "ArrowRight") && state.phase === CURL_TRAVEL) send({ k: CURL_INPUT_SWEEP, a: 60, b: key === "ArrowLeft" ? -1 : 1, c: 0 });
          else if (key === "ArrowLeft" || key === "ArrowRight") setBroom(aim.current.broomX + (key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 10 : 2), aim.current.broomY);
          else if (key === "ArrowUp" || key === "ArrowDown") setBroom(aim.current.broomX, aim.current.broomY + (key === "ArrowUp" ? -5 : 5));
          else if (v2 && (key === "a" || key === "d")) setStart((aim.current.startX ?? 0) + (key === "a" ? -1 : 1) * (event.shiftKey ? 20 : 5));
          else if (key === "i" || key === "o") pickTurn(key === "i" ? 0 : 1);
          else if (v3 && (key === "-" || key === "=" || key === "+") && state.phase === CURL_AIM) {
            const from = aim.current.keyWeight ?? aim.current.zone?.tee ?? 316;
            const next = Math.max(1, Math.min(CURL_WEIGHT_MAX, from + (key === "-" ? -1 : 1) * KEY_WEIGHT_STEP * (event.shiftKey ? 5 : 1)));
            if (v4) setBar(next);
            else aim.current.keyWeight = next;
          } else if (key === "Enter" && state.phase === CURL_AIM) send(throwPayload(v3 ? (aim.current.keyWeight ?? aim.current.zone?.tee ?? 316) : 306));
          else if (key === "s" && state.phase === CURL_TRAVEL) send({ k: CURL_INPUT_SWEEP, a: 60, b: 0, c: 0 });
          else return false;
          return true;
        }}
        footer={v4 ? undefined : () => turnButtons(null)}
        overlay={
          v4
            ? (send) => (
                // curlRev 4: In, Out and Throw over the bottom of the sheet (below the near hog line), drawn in the arena so
                // the world reaches the bottom, lifted by the home bar: the row ends at least 12 px above
                // env(safe-area-inset-bottom) (the arena ends 16 px above the screen's bottom, so the lift is the inset less
                // 4 px). Only the buttons take a touch; a rub beside them reaches the canvas (brushing).
                <div className="pointer-events-none absolute inset-x-1" style={{ bottom: "max(0px, calc(env(safe-area-inset-bottom, 0px) - 4px))" }}>
                  {turnButtons(send)}
                </div>
              )
            : undefined
        }
        onSubmit={(answer) => onSubmit(answer)}
        onDraftAnswer={onDraftAnswer}
      />
    </div>
  );

  function turnButtons(send: ((payload: PointerPayload) => void) | null) {
    return (
          <div data-game-controls="turn" className={`grid h-12 shrink-0 touch-none select-none ${v4 ? "grid-cols-3" : "grid-cols-2"} gap-3 px-1`}>
            {(["In", "Out"] as const).map((label, t) => (
              <button
                key={label}
                type="button"
                aria-pressed={turn === t}
                aria-label={`${label}-turn`}
                disabled={locked}
                onPointerDown={(event) => {
                  event.preventDefault();
                  pickTurn(t);
                }}
                className={`pointer-events-auto h-12 rounded-xl border text-base font-bold tracking-wide transition-colors ${
                  // curlRev 4 draws the row over the ice: solid dark buttons so the labels read on white.
                  turn === t
                    ? v4
                      ? "border-[#E8B53A] bg-[#0B1222]/90 text-[#FFE29A]"
                      : "border-[#E8B53A] bg-[#E8B53A]/20 text-[#FFE29A]"
                    : v4
                      ? "border-white/20 bg-[#0B1222]/80 text-white/80"
                      : "border-white/15 bg-black/40 text-white/70"
                }`}
              >
                {label === "In" ? "↻ In" : "↺ Out"}
              </button>
            ))}
            {v4 && send && (
              <button
                type="button"
                aria-label="Throw"
                disabled={locked || setWeight === null}
                onPointerDown={(event) => {
                  event.preventDefault();
                  const s = seen.current;
                  const w = aim.current.keyWeight;
                  if (s && s.phase === CURL_AIM && w != null) send(throwPayload(w));
                }}
                className={`pointer-events-auto h-12 rounded-xl border text-base font-bold tracking-wide transition-colors ${
                  setWeight === null ? "border-white/20 bg-[#0B1222]/80 text-white/45" : "border-[#E8B53A] bg-[#E8B53A] text-[#1A1205]"
                }`}
              >
                Throw
              </button>
            )}
          </div>
    );
  }
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "curling") return null;
  const result = replayCurlingRun(puzzle.seed, myAnswer ?? "", puzzle.curlRev);
  const parts = curlingStdParts(result.state) ?? [];
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-2 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {result.thrown} of 8 thrown · {(puzzle.curlRev ?? 1) >= 4 ? `${result.counted} counted · ` : ""}{result.onButton} on the button · {result.takeouts} of {result.opponents} taken out
      </p>
      {parts.map((part) => `${part.label}: ${part.detail}`).map((line) => (
        <p key={line} className="shrink-0 text-center font-mono text-sm text-muted-foreground">
          {line}
        </p>
      ))}
      <p className="shrink-0 text-center font-mono text-sm text-muted-foreground">Same sheet for everyone</p>
    </div>
  );
}

/** The seed is dealt on the server from the proven bank; every run is replayed there for scoring. */
export const curlingPuzzle: PuzzleDefinition = {
  key: "curling",
  name: gameDisplayName("curling"),
  category: "arcade",
  timeLimitMs: (CURLING_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "curling", seed: 1, curlRev: CURLING_REV }) satisfies CurlingPuzzleData,
  check: () => false,
  revealHeading: "Your stones",
  IntroExample,
  Stage,
  Reveal,
};
