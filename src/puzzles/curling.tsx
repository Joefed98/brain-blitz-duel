import { withArcadeFx } from "@/lib/arcade/arcadeFx.renderer";
import { CURLING_FX } from "@/lib/arcade/sportsFx.renderer";
import { useMemo, useRef, useState } from "react";

import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import { stdLines } from "@/lib/arcade/arcadeStandard";
import {
  curlingCheckpoint,
  curlingGameFor,
  curlingStdParts,
  CURL_AIM,
  CURL_INPUT_SWEEP,
  CURL_INPUT_THROW,
  CURL_TRAVEL,
  CURL_WEIGHT_MAX,
  CU,
  CURLING_H,
  CURLING_REV,
  CURLING_RUN_TICKS,
  CURLING_W,
  type CurlingState,
} from "@/lib/arcade/curling";
import {
  curlingScene,
  curlInsetToSheet,
  curlProject,
  drawCurling,
  CURLING_BG,
  CURL_FAR_HOUSE,
  CURL_PX_PER_CM_FAR,
  type CurlAim,
} from "@/lib/arcade/curling.renderer";
import { TICKS_PER_SECOND, type ArcadeGame, type ArcadeInputEvent } from "@/lib/arcade/engine";
import { SPORTS_CHECKPOINT_INTERVAL } from "@/lib/arcade/sportsKit";
import { encodeCurlingRun, replayCurlingRun } from "@/lib/duel/curling";
import { gameDisplayName } from "@/lib/duel/gameNames";
import type { CurlingPuzzleData } from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Weight from a swipe's speed up the lane (world px a ms): about 0.95 is a draw to the button. */
export function curlWeightFromSwipe(pxPerMs: number): number {
  return Math.max(1, Math.min(CURL_WEIGHT_MAX, Math.round(((pxPerMs - 0.25) / 2.25) * CURL_WEIGHT_MAX)));
}

/** A rub's strength 1…100 from the finger's speed (world px a ms). */
function rubStrength(pxPerMs: number): number {
  return Math.max(1, Math.min(100, Math.round(pxPerMs * 45)));
}

/** Fixed intro still: the sheet running away to the far house, a gold stone on the button, a red one, the broom and a swipe. */
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
        <g stroke="#E8B53A" strokeWidth="2" fill="none" opacity="0.85">
          <line x1="97.5" y1="112" x2="97.5" y2="84" />
          <line x1="97.5" y1="84" x2="92" y2="90" />
          <line x1="97.5" y1="84" x2="103" y2="90" />
        </g>
      </svg>
      <p className="text-center text-xs text-muted-foreground">Drag the broom, pick In or Out, swipe up for the weight.</p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: CurlingPuzzleData | null = puzzle.type === "curling" ? puzzle : null;
  const aim = useRef<CurlAim>({ broomX: 0, broomY: 0, turn: 0, swipe: null });
  const [turn, setTurn] = useState(0);
  /** The sim state the last frame drew (presentation only: where the moving stone is, for sweeping). */
  const seen = useRef<CurlingState | null>(null);
  const gesture = useRef<{ mode: "broom" | "inset" | "swipe" | "sweep"; x: number; y: number; bx: number; by: number; samples: { y: number; t: number }[]; lastAt: number; lastX: number; lastY: number } | null>(null);

  // The sim as rooms deal it; its draw shows the arena, the stones and what the stage holds (broom, turn, swipe).
  const game = useMemo<ArcadeGame<CurlingState, ArcadeInputEvent | null>>(() => {
    const base = curlingGameFor();
    return {
      ...base,
      draw: (ctx, state) => {
        seen.current = state;
        withArcadeFx(CURLING_FX, (c, st: CurlingState) => drawCurling(c, st, aim.current))(ctx, state, { width: CURLING_W, height: CURLING_H });
      },
    };
  }, []);

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
      if (inInset) {
        setBroom(inInset.x, inInset.y);
        gesture.current = { mode: "inset", x, y, bx: 0, by: 0, samples: [], lastAt: now, lastX: x, lastY: y };
      } else if (y <= CURL_FAR_HOUSE.bottom) {
        // A drag near the far house moves the broom (across at the house's own scale; along it coarser).
        gesture.current = { mode: "broom", x, y, bx: aim.current.broomX, by: aim.current.broomY, samples: [], lastAt: now, lastX: x, lastY: y };
      } else {
        gesture.current = { mode: "swipe", x, y, bx: 0, by: 0, samples: [{ y, t: now }], lastAt: now, lastX: x, lastY: y };
      }
      return null;
    }
    const g = gesture.current;
    if (!g) return null;
    if (g.mode === "inset") {
      const p = curlInsetToSheet(x, y);
      if (p) setBroom(p.x, p.y);
    } else if (g.mode === "broom") {
      setBroom(g.bx + (x - g.x) / CURL_PX_PER_CM_FAR, g.by + (y - g.y) * 6);
    } else if (g.mode === "swipe") {
      g.samples.push({ y, t: now });
      while (g.samples.length > 2 && now - g.samples[0]!.t > 140) g.samples.shift();
      const first = g.samples[0]!;
      const v = (first.y - y) / Math.max(8, now - first.t);
      aim.current.swipe = g.y - y > 12 ? curlWeightFromSwipe(v) : null;
    } else if (g.mode === "sweep") {
      // Rubbing ahead of the moving stone: a stroke every 70 ms while the finger moves, its strength the finger's speed.
      const stoneY = s.active >= 0 ? curlProject(s.x[s.active]! / CU, s.y[s.active]! / CU).sy : 0;
      const dt = now - g.lastAt;
      if (s.phase === CURL_TRAVEL && y < stoneY && dt >= 70) {
        const speed = Math.hypot(x - g.lastX, y - g.lastY) / dt;
        g.lastAt = now;
        g.lastX = x;
        g.lastY = y;
        if (speed > 0.05) return { k: CURL_INPUT_SWEEP, a: rubStrength(speed), b: 0, c: 0 };
      }
    }
    if (kind === "up") {
      gesture.current = null;
      if (g.mode === "swipe") {
        const w = aim.current.swipe;
        aim.current.swipe = null;
        if (w !== null && g.y - y >= 40 && s.phase === CURL_AIM) {
          return { k: CURL_INPUT_THROW, a: Math.round(aim.current.broomX), b: Math.round(aim.current.broomY), c: w * 2 + aim.current.turn };
        }
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
        scene={curlingScene}
        seed={data?.seed ?? 1}
        enabled={data !== null}
        locked={locked}
        worldW={CURLING_W}
        worldH={CURLING_H}
        game={game}
        checkpoint={curlingCheckpoint}
        interval={SPORTS_CHECKPOINT_INTERVAL}
        encodeRun={encodeCurlingRun}
        discrete
        pointer={pointer}
        keys={(kind, key, send, state, event) => {
          // Desktop: ←/→ move the broom, I / O pick the turn, Enter throws a draw weight, S sweeps.
          if (kind !== "down") return ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "i", "o", "s"].includes(key);
          if (key === "ArrowLeft" || key === "ArrowRight") setBroom(aim.current.broomX + (key === "ArrowLeft" ? -1 : 1) * (event.shiftKey ? 10 : 2), aim.current.broomY);
          else if (key === "ArrowUp" || key === "ArrowDown") setBroom(aim.current.broomX, aim.current.broomY + (key === "ArrowUp" ? -5 : 5));
          else if (key === "i" || key === "o") pickTurn(key === "i" ? 0 : 1);
          else if (key === "Enter" && state.phase === CURL_AIM) send({ k: CURL_INPUT_THROW, a: Math.round(aim.current.broomX), b: Math.round(aim.current.broomY), c: 306 * 2 + aim.current.turn });
          else if (key === "s" && state.phase === CURL_TRAVEL) send({ k: CURL_INPUT_SWEEP, a: 60, b: 0, c: 0 });
          else return false;
          return true;
        }}
        footer={() => (
          <div data-game-controls="turn" className="grid h-12 shrink-0 touch-none select-none grid-cols-2 gap-3 px-1">
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
                className={`h-12 rounded-xl border text-base font-bold tracking-wide transition-colors ${
                  turn === t ? "border-[#E8B53A] bg-[#E8B53A]/20 text-[#FFE29A]" : "border-white/15 bg-black/40 text-white/70"
                }`}
              >
                {label === "In" ? "↻ In" : "↺ Out"}
              </button>
            ))}
          </div>
        )}
        onSubmit={(answer) => onSubmit(answer)}
        onDraftAnswer={onDraftAnswer}
      />
    </div>
  );
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "curling") return null;
  const result = replayCurlingRun(puzzle.seed, myAnswer ?? "", puzzle.curlRev);
  const parts = curlingStdParts(result.state) ?? [];
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-2 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {result.thrown} of 8 thrown · {result.onButton} on the button · {result.takeouts} of {result.opponents} taken out
      </p>
      {stdLines(parts, result.score, result.state.acted === 1).map((line) => (
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
