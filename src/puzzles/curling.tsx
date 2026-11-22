import { withArcadeFx } from "@/lib/arcade/arcadeFx.renderer";
import { puzzleLevel } from "@/lib/levels/levels";
import { levelNote } from "@/lib/levels/levelNotes";
import { useGameLookRef } from "@/lib/skins/equipped";
import { lookKey } from "@/lib/arcade/skins/look";
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
  curlAidsFor,
  curlAimPath,
  curlDrawZone,
  curlWeightFromSwipeV3,
  HOG_NEAR,
  HOUSE_R,
  TEE_NEAR,
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
  drawCurlingFx,
  CURLING_BG,
  CURL_PX_PER_CM_FAR,
  CURL_VIEW_V4,
  type CurlAim,
} from "@/lib/arcade/curling.renderer";
import { devWarp } from "@/lib/arcade/devWarp";
import { TICKS_PER_SECOND, type ArcadeGame, type ArcadeInputEvent } from "@/lib/arcade/engine";
import { SPORTS_CHECKPOINT_INTERVAL } from "@/lib/arcade/sportsKit";
import { curlingSounds } from "@/lib/fx/gameSounds";
import { CurlFxTracker, curlEndHoldMs } from "@/lib/arcade/curlingFx";
import { demoHushed, playSlotOr } from "@/lib/sound";
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
 * Fixed intro still (the Sports overhaul, 15 Nov 2026: concept A's look): the stands packed with fans over the far
 * boards, the bright sheet running to the far house, the house view top right on its solid panel, Captain Joulz beside
 * the waiting stone, the faint aim line, the power bar with its gold HOUSE zone and the In / Out / Throw row with Throw
 * grey while a stone is still moving.
 */
const INTRO_FANS = Array.from({ length: 4 * 26 }, (_, i) => ({
  x: 4 + (i % 26) * 7.4 + ((Math.floor(i / 26) % 2) * 3.7),
  y: 26 - Math.floor(i / 26) * 6,
  c: ["#D8352F", "#F2C230", "#2F6FD6", "#F3F1EC", "#E8752A", "#1FA38A", "#7A55C9"][(i * 7 + Math.floor(i / 26) * 3) % 7]!,
  gap: (i * 13) % 11 === 0,
}));
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg viewBox="0 0 195 132" width={195} height={132} aria-hidden="true" style={{ background: CURLING_BG, borderRadius: 10 }}>
        <rect x="0" y="0" width="195" height="34" fill="#0A0D16" />
        {INTRO_FANS.filter((f) => !f.gap).map((f, i) => (
          <g key={i} opacity={0.55 + (f.y / 26) * 0.45}>
            <rect x={f.x - 2.2} y={f.y - 3.6} width="4.4" height="4" rx="1.2" fill={f.c} />
            <circle cx={f.x} cy={f.y - 5} r="1.5" fill="#E3BFA0" />
          </g>
        ))}
        <rect x="0" y="30" width="195" height="4" fill="#0C111C" />
        <rect x="0" y="32.5" width="195" height="0.7" fill="#7FE3FF" />
        <path d="M70 34 L125 34 L195 132 L0 132 Z" fill="#F1F6FA" />
        <path d="M92 40 L103 40 L128 132 L67 132 Z" fill="#FFFFFF" opacity="0.35" />
        <ellipse cx="97.5" cy="42" rx="26" ry="5.6" fill="#1D5BB5" />
        <ellipse cx="97.5" cy="42" rx="17" ry="3.7" fill="#F1F6FA" />
        <ellipse cx="97.5" cy="42" rx="8.6" ry="1.9" fill="#C8202E" />
        <ellipse cx="97.5" cy="42" rx="2.1" ry="0.5" fill="#F1F6FA" />
        <rect x="0" y="60" width="195" height="1" fill="#C8202E" opacity="0.8" />
        <ellipse cx="95" cy="41" rx="3" ry="1.1" fill="#6C717C" />
        <rect x="93.6" y="39.6" width="2.8" height="1.1" fill="#E8B53A" />
        <ellipse cx="107" cy="43.5" rx="3" ry="1.1" fill="#6C717C" />
        <rect x="105.6" y="42" width="2.8" height="1.1" fill="#C42A2E" />
        <path d="M100 96 Q97 76 96 58" stroke="#FFF3C4" strokeWidth="1.3" fill="none" opacity="0.65" strokeLinecap="round" />
        <rect x="0" y="99" width="195" height="1.2" fill="#C8202E" />
        <ellipse cx="100" cy="99" rx="7.5" ry="2.4" fill="#5D626C" />
        <rect x="96.5" y="94.8" width="7" height="2" rx="1" fill="#E8B53A" />
        <image href="/sports/curling/slide.webp" x="62" y="70" width="34" height="36" />
        <rect x="124" y="2" width="44" height="44" rx="5" fill="#05080F" stroke="#FFFFFF66" strokeWidth="0.8" />
        <rect x="126" y="4" width="40" height="40" rx="4" fill="#F1F6FA" />
        <circle cx="146" cy="24" r="17.8" fill="#1D5BB5" />
        <circle cx="146" cy="24" r="11.9" fill="#F1F6FA" />
        <circle cx="146" cy="24" r="6" fill="#C8202E" />
        <circle cx="146" cy="24" r="1.5" fill="#F1F6FA" />
        <circle cx="144" cy="22.5" r="1.6" fill="#E8B53A" stroke="#1B1E24" strokeWidth="0.4" />
        <circle cx="154" cy="27" r="1.6" fill="#C42A2E" stroke="#1B1E24" strokeWidth="0.4" />
        <rect x="181" y="50" width="8" height="56" rx="2" fill="#05080F" opacity="0.9" />
        <rect x="182" y="72" width="6" height="14" fill="#E8B53A" opacity="0.45" stroke="#E8B53A" strokeWidth="0.7" />
        <rect x="178.5" y="79" width="13" height="1.5" fill="#FFE29A" />
        <rect x="6" y="110" width="56" height="16" rx="4" fill="#0B1222" stroke="#E8B53A" strokeWidth="0.8" />
        <text x="34" y="121" textAnchor="middle" fontSize="8" fontWeight="700" fill="#FFE29A">In</text>
        <rect x="69" y="110" width="56" height="16" rx="4" fill="#0B1222" stroke="#FFFFFF33" strokeWidth="0.8" />
        <text x="97" y="121" textAnchor="middle" fontSize="8" fontWeight="700" fill="#FFFFFFCC">Out</text>
        <rect x="132" y="110" width="56" height="16" rx="4" fill="#2A3140" />
        <text x="160" y="121" textAnchor="middle" fontSize="8" fontWeight="700" fill="#FFFFFF66">Throw</text>
      </svg>
      <p className="text-center text-xs text-muted-foreground">Slide the stone, drag the target or tap the house view, pick In or Out, set the power bar in its gold zone, then Throw. Brush left or right of it to bend it.</p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: CurlingPuzzleData | null = puzzle.type === "curling" ? puzzle : null;
  // The stored stamp picks the rules, the world's height and the controls (curlRev 2: slide the start, side brushing).
  const rev = data?.curlRev ?? 1;
  /** The level it was dealt at (none: Normal) and that level's aids: the HOUSE zone and how much aim line shows. */
  const level = data?.level;
  const aids = curlAidsFor(rev >= 4 ? level : null);
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
  /** Whether the sim is waiting for a throw (curlRev 4's Throw is greyed out while a stone travels); set on a change only. */
  const [aiming, setAiming] = useState(true);
  const aimingRef = useRef(true);
  const gesture = useRef<{ mode: "broom" | "inset" | "pending" | "slide" | "swipe" | "sweep" | "power" | "none"; x: number; y: number; bx: number; by: number; samples: { y: number; t: number }[]; lastAt: number; lastX: number; lastY: number } | null>(null);

  // The sim as rooms deal it; its draw shows the arena, the stones and what the stage holds (broom, turn, swipe, start).
  // The player's own equipped skin and world theme (wave 2; display only, src/lib/skins/equipped.ts).
  const [, lookRef] = useGameLookRef("curling");
  /** The effects observer (stage 2, display only): contacts, strokes, verdicts and the end's count (curlingFx.ts). */
  const fxTracker = useRef(new CurlFxTracker());
  const game = useMemo<ArcadeGame<CurlingState, ArcadeInputEvent | null>>(() => {
    // devWarp: development only (review shots, scripts/shots/curling-prepare-shots.ts); production plays the game as is.
    const base = devWarp("curling", curlingGameFor(rev, level));
    const fx = curlingFxFor(rev);
    return {
      ...base,
      draw: (ctx, state) => {
        seen.current = state;
        if ((state.phase === CURL_AIM) !== aimingRef.current) {
          aimingRef.current = state.phase === CURL_AIM;
          setAiming(aimingRef.current);
        }
        if (rev >= 3 && state.phase === CURL_AIM) {
          // The meter's draw zone and the aim line, worked out again only when the sheet or the aim changes.
          const a = aim.current;
          const sx = Math.round(a.startX ?? 0);
          const bx = Math.round(a.broomX);
          const by = Math.round(a.broomY);
          const key = `${state.thrown}:${state.restTick}:${sx}:${bx}:${by}:${a.turn}`;
          if (key !== aidKey.current) {
            aidKey.current = key;
            // A level without the HOUSE zone (Expert) shows none, and its aim line only as far as the level allows
            // (Easy the whole path, Expert none); the line follows the zone's tee weight as today.
            const zone = curlDrawZone(sx, bx, by, a.turn, rev);
            a.zone = aids.houseZone ? zone : null;
            a.path = aids.aimPart ? curlAimPath(state, sx, bx, by, zone?.tee ?? 316, a.turn, aids.aimPart) : null;
          }
        }
        const now = performance.now();
        const tracker = fxTracker.current;
        tracker.observe(state, now);
        withArcadeFx(fx, (c, st: CurlingState) => {
          drawCurling(c, st, aim.current, lookRef.current);
          // The effects over the world (stage 2), under the success layer's labels.
          drawCurlingFx(c, st, tracker, now);
        })(ctx, state, { width: CURLING_W, height: worldH });
        // The end's count: a tick as each counting stone lights, a step higher each time.
        tracker.cues.forEach(() => {
          if (!demoHushed()) playSlotOr("curling.countTick", "tick", 0.7, 1 + 0.06 * (tracker.lit - 1));
        });
      },
    };
  }, [rev, worldH, level, aids]);

  const setStart = (x: number) => {
    aim.current.startX = Math.max(-CURL_START_MAX, Math.min(CURL_START_MAX, x));
  };
  const throwPayload = (weight: number): PointerPayload => {
    aim.current.lastRelease = weight;
    // curlRev 4: the power bar's marker stays where it was set.
    if (!v4) aim.current.keyWeight = null;
    return throwPayloadOf(weight);
  };
  /**
   * curlRev 4: the power marker clicks into place (stage 2): the marker's snap and the notch tone, the brighter one with
   * the marker in the gold HOUSE zone. On a tap or the end of a drag on the bar, and each − / + press.
   */
  const notch = () => {
    const a = aim.current;
    if (a.keyWeight == null) return;
    a.snapAt = performance.now();
    const inHouse = !!a.zone && a.keyWeight >= a.zone.lo && a.keyWeight <= a.zone.hi;
    if (inHouse) playSlotOr("curling.powerNotchHouse", "tick", 1, 1.25);
    else playSlotOr("curling.powerNotch", "tick", 0.55);
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
      const inInset = curlInsetToSheet(x, y, rev);
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
      const p = curlInsetToSheet(x, y, rev);
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
      if (g.mode === "power" && s.phase === CURL_AIM) notch();
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
        scene={(ctx, sceneView) => curlingScene(ctx, sceneView, rev, lookRef.current)}
        sceneKey={() => lookKey(lookRef.current)}
        seed={data?.seed ?? 1}
        enabled={data !== null}
        locked={locked}
        worldW={CURLING_W}
        worldH={worldH}
        game={game}
        sounds={curlingSounds}
        endHoldMs={curlEndHoldMs}
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
            if (v4) {
              setBar(next);
              notch();
            } else aim.current.keyWeight = next;
          } else if (key === "Enter" && state.phase === CURL_AIM) send(throwPayload(v3 ? (aim.current.keyWeight ?? aim.current.zone?.tee ?? 316) : 306));
          else if (key === "s" && state.phase === CURL_TRAVEL) send({ k: CURL_INPUT_SWEEP, a: 60, b: 0, c: 0 });
          else return false;
          return true;
        }}
        footer={v4 ? undefined : () => turnButtons(null)}
        overlay={
          v4
            ? (send) => (
                // curlRev 4: In, Out and Throw over the ice below the near hog line, drawn in the arena so the world reaches
                // the bottom. Since 3 Nov 2026 (Joe's phone note: too close to the red line) the row is centred between the
                // hog line (world y 470) and the near house's blue ring (world y 590, drawn by the scene below the 540-row
                // world): its top is CURL_TURN_ROW_MID of the world's height (the slot is a size container, the world
                // top-anchored at the slot's scale) less half the row, and never lower than the slot's bottom less the row
                // and the home-bar lift (the row ends at least 12 px above env(safe-area-inset-bottom): the arena ends 16 px
                // above the screen's bottom, so the lift is the inset less 4 px). Only the buttons take a touch; a rub beside
                // them reaches the canvas (brushing).
                <div className="pointer-events-none absolute inset-x-1" style={{ top: CURL_TURN_ROW_TOP }}>
                  {turnButtons(send)}
                </div>
              )
            : undefined
        }
        overlayBelowWorld={v4}
        onSubmit={(answer) => onSubmit(answer)}
        onDraftAnswer={onDraftAnswer}
      />
    </div>
  );

  function turnButtons(send: ((payload: PointerPayload) => void) | null) {
    return (
          // The polish plan's C4.9 (20 Nov 2026): on curlRev 4, where the row sits over the ice, a dark backing strip
          // behind it, so the buttons read off the sheet.
          <div
            data-game-controls="turn"
            className={`grid h-12 shrink-0 touch-none select-none ${v4 ? "grid-cols-3 rounded-2xl" : "grid-cols-2"} gap-3 px-1`}
            style={v4 ? { background: "color-mix(in srgb, var(--jz-bg) 58%, transparent)" } : undefined}
          >
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
                data-throw-state={curlThrowState(setWeight, aiming)}
                disabled={locked || !curlThrowLive(setWeight, aiming)}
                onPointerDown={(event) => {
                  event.preventDefault();
                  const s = seen.current;
                  const w = aim.current.keyWeight;
                  if (s && s.phase === CURL_AIM && w != null) send(throwPayload(w));
                }}
                className={`pointer-events-auto h-12 rounded-xl border text-base font-bold tracking-wide transition-colors ${
                  // Greyed out (the Sports overhaul): a flat grey face while a stone travels or before a weight is set.
                  !curlThrowLive(setWeight, aiming) ? "border-white/10 bg-[#2A3140]/90 text-white/40" : "border-[#E8B53A] bg-[#E8B53A] text-[#1A1205]"
                }`}
              >
                Throw
              </button>
            )}
          </div>
    );
  }
}

/** curlRev 4's Throw is live only with a weight set and the sim waiting for a throw (greyed out while a stone travels). */
export function curlThrowLive(setWeight: number | null, aiming: boolean): boolean {
  return setWeight !== null && aiming;
}

/** What the Throw button reads as (data-throw-state): "travel" while a stone runs, "unset" before a weight is set, else "live". */
export function curlThrowState(setWeight: number | null, aiming: boolean): "live" | "travel" | "unset" {
  if (!aiming) return "travel";
  return setWeight === null ? "unset" : "live";
}

/** curlRev 4's turn row (display only): its centre between the near hog line and the near house, as a share of the world's height. */
export const CURL_TURN_ROW_MID = (curlProject(0, HOG_NEAR, CURL_VIEW_V4).sy + curlProject(0, TEE_NEAR - HOUSE_R, CURL_VIEW_V4).sy) / 2 / CURL_VIEW_V4.h;
/** The row's top: the world's height (min(100cqh, 100cqw × h ÷ w)) at CURL_TURN_ROW_MID less half the 48 px row, clamped above the slot's bottom. */
export const CURL_TURN_ROW_TOP = `min(calc(min(100cqh, 100cqw * ${CURL_VIEW_V4.h} / ${CURL_VIEW_V4.w}) * ${CURL_TURN_ROW_MID.toFixed(4)} - 24px), calc(100cqh - 48px - max(0px, calc(env(safe-area-inset-bottom, 0px) - 4px))))`;

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "curling") return null;
  const result = replayCurlingRun(puzzle.seed, myAnswer ?? "", puzzle.curlRev, puzzle.level);
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
  // A level other than Normal says what it changes on the intro (levelNotes.ts; the "?" help shows the same line).
  introLine: (puzzle) => levelNote("curling", puzzleLevel(puzzle)),
  IntroExample,
  Stage,
  Reveal,
};
