import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { PolishStyle, soundCue, useSolveFx } from "@/components/puzzles/numberPolish";
import { NumberStage, numberArt } from "@/components/puzzles/number/overhaul";
import { checkoutBust } from "@/lib/duel/numberOverhaul";
import { countUpText, gameFx, gameFxVariant } from "@/lib/fx/kit";
import { CHECKOUT_FLIGHT_MS, checkoutFlightKeyframes } from "./checkoutFx";
import {
  FAIR_BULB,
  FAIR_CHALK,
  FAIR_HORIZON,
  FAIR_SKY_MID,
  FAIR_SKY_TOP,
} from "@/lib/arcade/fairground.renderer";
import {
  checkoutBustFreeOrder,
  checkoutBustsAt,
  checkoutDartAllowed,
  checkoutDartLabel,
  checkoutDartValue,
  checkoutRemaining,
  checkoutValid,
  decodeCheckoutDarts,
  encodeCheckoutDarts,
  joinCheckoutRound,
  splitCheckoutRound,
  CHECKOUT_BULL,
  CHECKOUT_STAGES,
  CHECKOUT_STANDARD,
  type CheckoutDart,
} from "@/lib/duel/checkout";
import { checkoutBigFinish, checkoutDartTerm } from "@/lib/duel/checkout";
import { usesStandard } from "@/lib/duel/standard/stamps";
import { checkoutBigBoards } from "@/lib/duel/standard/number";
import { useGameKeys } from "@/lib/desktop";
import { useStageState } from "@/lib/duel/stageState";
import {
  CHECKOUT_TIME_MS,
  type CheckoutPuzzleData,
  type CheckoutStageData,
} from "@/lib/duel/types";
import { playCorrect } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { useBeforePaint } from "@/components/puzzles/useBeforePaint";
import "@/polish-layout/batch-w-checkout.css";
import { RevealBoards, RevealFacts, RevealView, useRevealBoard, type BoardMark, type RevealSide } from "@/components/puzzles/number/RevealParts";
import { HudPills } from "@/components/puzzles/HudPills";
// The Number overhaul's shared look (darker background, navy and champagne controls), loaded with the game.
import "@/polish-layout/number-overhaul.css";

/** iOS: no text selection or callout on long presses anywhere in the game. */
const ROOT_STYLE: CSSProperties = {
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
  WebkitTapHighlightColor: "transparent",
};

/* Flightpath's original fairground palette: gold, burgundy, blue, pink, charcoal, cream (kept here when Flightpath's
 * own board moved to lighter golds and pinks, 27 Oct 2026, so Checkout's board is unchanged). */
// The Number overhaul (15 Nov 2026): the interface gold is the champagne (--jz-gold); the board's own colours are the
// rendered bristle's. BURGUNDY, BLUE, PINK, CHARCOAL and CREAM are no longer drawn.
const GOLD = "var(--jz-gold)";
const NEGATIVE_INK = "#FF8FA3";
/** The beat between a board's right throw and the next board (the shared stage moment's length). */
const CHECKOUT_ADVANCE_MS = 1000;
/** checkoutRev 3: how long a bust shows its darts and "Bust" before they drop out. */
const CHECKOUT_BUST_MS = 750;
const WIRE = "#D5D9E0";

/* Board geometry in a 200-unit viewBox. */
const C = 100;
const R_NUMBERS = 100;
const R_DOUBLE_OUT = 78;
const R_DOUBLE_IN = 70;
const R_TREBLE_OUT = 50;
const R_TREBLE_IN = 43;
const R_QUAD_OUT = 26;
const R_QUAD_IN = 21;
const R_BULL = 14;
const R_INNER_BULL = 6.5;

/** The board's geometry in its 200-unit viewBox (the checks prove a flight lands in the chosen ring's band). */
export const CHECKOUT_BOARD_GEOMETRY = { C, R_DOUBLE_IN, R_DOUBLE_OUT, R_TREBLE_IN, R_TREBLE_OUT, R_QUAD_IN, R_QUAD_OUT, R_BULL, R_INNER_BULL } as const;

const angleOf = (wedge: number) => ((-90 + wedge * 18) * Math.PI) / 180;
const point = (r: number, a: number) =>
  `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`;

function sector(r0: number, r1: number, wedge: number): string {
  const a0 = angleOf(wedge) - (9 * Math.PI) / 180;
  const a1 = angleOf(wedge) + (9 * Math.PI) / 180;
  return `M ${point(r0, a0)} L ${point(r1, a0)} A ${r1} ${r1} 0 0 1 ${point(r1, a1)} L ${point(r0, a1)} A ${r0} ${r0} 0 0 0 ${point(r0, a0)} Z`;
}

/** The finishing ring's band: the doubles, the trebles (or the bull's 25/50 for a bull dart). */
function finishBand(finish: number): [number, number] {
  return finish === 3 ? [R_TREBLE_IN, R_TREBLE_OUT] : [R_DOUBLE_IN, R_DOUBLE_OUT];
}

/** Where a dart marker sits: the middle of its ring band in its wedge (exported for the checks: the flight ends here). */
export function dartSpot(dart: CheckoutDart, quad: boolean, nth: number): { x: number; y: number } {
  if (dart.wedge === CHECKOUT_BULL) {
    const r = dart.ring === 2 ? 2 : (R_BULL + R_INNER_BULL) / 2;
    const a = (nth * 2.1) % (Math.PI * 2);
    return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
  }
  const band =
    dart.ring === 2
      ? (R_DOUBLE_IN + R_DOUBLE_OUT) / 2
      : dart.ring === 3
        ? (R_TREBLE_IN + R_TREBLE_OUT) / 2
        : dart.ring === 4
          ? (R_QUAD_IN + R_QUAD_OUT) / 2
          : quad
            ? 36
            : 60;
  const a = angleOf(dart.wedge) + ((nth % 3) - 1) * 0.07;
  return { x: C + band * Math.cos(a), y: C + band * Math.sin(a) };
}

/* ------------------------------------------------------------------ art -- */

/** Shared defs (none since the Number overhaul's rendered board; kept for callers that draw it). */
export const BOARD_DEFS = null;

/**
 * The board (the Number overhaul, 15 Nov 2026): a Blender-rendered bristle board with its wire spider and wooden
 * surround (public/number/checkout/, docs/design/number-overhaul/source/checkout.py), drawn in this viewBox's own
 * geometry so every wedge and ring of the picture sits exactly on the hit wedges; the app draws the wedge numbers over
 * the wooden ring in bold Archivo, since they change with every board. Rebuilt only when the board changes.
 */
export function BoardArt({ wedges, quad, bare }: { wedges: readonly number[]; quad: boolean; bare: boolean }) {
  const fontSize = wedges.some((v) => Math.abs(v) >= 10) ? 14 : 15.5;
  return (
    <g pointerEvents="none">
      <image href={numberArt("checkout", quad ? "board-quad" : "board")} x={0} y={0} width={200} height={200} preserveAspectRatio="none" />
      {bare
        ? null
        : wedges.map((value, wedge) => {
            const x = C + 89 * Math.cos(angleOf(wedge));
            const y = C + 89 * Math.sin(angleOf(wedge));
            const label = value < 0 ? `−${-value}` : String(value);
            return (
              <text
                key={wedge}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={value < 0 ? fontSize - 1.5 : fontSize}
                fontWeight={800}
                fontFamily="var(--jz-font)"
                fill={value < 0 ? NEGATIVE_INK : FAIR_CHALK}
                data-checkout-wedge-number={wedge}
              >
                {label}
              </text>
            );
          })}
    </g>
  );
}

/** A steel dart stuck in the board: tip at the spot, flights up and to the right. */
export function Dart({ x, y, n, fresh, final, flying = false }: { x: number; y: number; n: number; fresh: boolean; final: boolean; flying?: boolean }) {
  const dx = Math.cos((-55 * Math.PI) / 180) * 20.5;
  const dy = Math.sin((-55 * Math.PI) / 180) * 20.5;
  // The sprite is 64 × 120 points with its tip at (12, 108) (checkout.py `dart`), drawn 0.25 units a point.
  const k = 0.25;
  return (
    <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`} pointerEvents="none">
      {fresh && !flying ? <circle r={4} className="co-impact" fill="none" stroke={FAIR_CHALK} strokeWidth={0.8} /> : null}
      {/* Stage 2: a thrown dart's flight (checkoutFx.ts) moves this group from below the board to its spot. */}
      <g data-checkout-flight={flying ? "" : undefined}>
      <g data-checkout-dart-body className={fresh && !flying ? "co-dart" : final ? "co-final-dart" : undefined}>
        <ellipse cx={0} cy={0.4} rx={2.2} ry={1.1} fill="#000" fillOpacity={0.35} />
        <image href={numberArt("checkout", "dart")} x={-12 * k} y={-108 * k} width={64 * k} height={120 * k} />
        <circle cx={dx} cy={dy} r={4.6} fill="var(--jz-gold)" stroke="var(--jz-on-gold)" strokeWidth={0.8} />
        <text
          x={dx}
          y={dy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={6.2}
          fontWeight={800}
          fontFamily="var(--jz-font)"
          fill="var(--jz-on-gold)"
        >
          {n}
        </text>
      </g>
      </g>
    </g>
  );
}

/**
 * The dartboard: wooden rim with large wedge numbers and fairground bulbs,
 * alternating charcoal and cream singles, burgundy and blue doubles and trebles,
 * a gold x4 ring where the board has one, and the bull. A whole wedge (any ring)
 * is one tap target; the selection is drawn as exactly that wedge.
 */
export function Board({
  stage,
  selected,
  darts,
  onWedge,
  size,
  fresh = -1,
  lit = null,
  finish = 2,
  bare = false,
  busted = false,
  flight = false,
  onLand,
}: {
  stage: Pick<CheckoutStageData, "wedges" | "quad">;
  selected?: number | null;
  darts?: readonly CheckoutDart[];
  onWedge?: ((wedge: number) => void) | undefined;
  size: number;
  /** Index of the dart that has just landed (thud animation), or -1. */
  fresh?: number;
  /** Finishing-ring lights: a checked-out stage, or the whole round solved. */
  lit?: "stage" | "final" | null;
  finish?: number;
  bare?: boolean;
  /** checkoutRev 3: the board just bust; its darts drop out. */
  busted?: boolean;
  /** A live round (stage 2): the fresh dart flies in from below the board in an arc, then lands. */
  flight?: boolean;
  /** Called when the fresh dart lands (at once under reduced motion). */
  onLand?: (() => void) | undefined;
}) {
  const quad = stage.quad === true;
  const wedgeKey = stage.wedges.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const art = useMemo(() => <BoardArt wedges={stage.wedges} quad={quad} bare={bare} />, [wedgeKey, quad, bare]);
  const list = darts ?? [];
  const last = list[list.length - 1];
  const fromWedge = last && last.wedge !== CHECKOUT_BULL ? last.wedge : 0;
  const [band0, band1] = finishBand(finish);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const landRef = useRef(onLand);
  landRef.current = onLand;
  const flyingDart = flight && fresh >= 0 ? fresh : -1;
  const flyingSpot = flyingDart >= 0 && list[flyingDart] ? dartSpot(list[flyingDart]!, quad, flyingDart) : null;
  // The flight (stage 2, display only): the next input is never held for it; the dart lands with the kit's drop.
  useEffect(() => {
    if (flyingDart < 0 || !flyingSpot) return undefined;
    const group = svgRef.current?.querySelector<SVGGElement>(`[data-checkout-dart="${flyingDart}"] [data-checkout-flight]`);
    let live = true;
    const land = () => {
      if (!live) return;
      gameFx("drop", svgRef.current?.querySelector(`[data-checkout-dart="${flyingDart}"] [data-checkout-dart-body]`), { silent: true });
      landRef.current?.();
    };
    if (!group || typeof group.animate !== "function" || gameFxVariant("drop") === "reduced") {
      land();
      return () => {
        live = false;
      };
    }
    const anim = group.animate(checkoutFlightKeyframes(flyingSpot), { duration: CHECKOUT_FLIGHT_MS, easing: "cubic-bezier(.3,.05,.55,1)", fill: "backwards" });
    anim.finished.then(land, () => undefined);
    return () => {
      live = false;
      anim.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyingDart, list.length, flight]);
  const selPath =
    selected === null || selected === undefined
      ? null
      : selected === CHECKOUT_BULL
        ? `M ${C - R_BULL} ${C} A ${R_BULL} ${R_BULL} 0 1 0 ${C + R_BULL} ${C} A ${R_BULL} ${R_BULL} 0 1 0 ${C - R_BULL} ${C} Z`
        : sector(R_BULL, R_NUMBERS, selected);
  return (
    <svg
      ref={svgRef}
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="group"
      aria-label="Dartboard"
      style={{ display: "block", touchAction: "manipulation" }}
    >
      {BOARD_DEFS}
      {art}
      {selPath ? (
        <g key={selected} className="co-sel" pointerEvents="none">
          <clipPath id="co-selclip">
            <path d={selPath} />
          </clipPath>
          <path
            d={selPath}
            fill={GOLD}
            fillOpacity={0.3}
            stroke={GOLD}
            strokeWidth={5}
            clipPath="url(#co-selclip)"
            data-checkout-selected
          />
        </g>
      ) : null}
      {lit ? (
        <g className={`co-lit co-lit-${lit}`} pointerEvents="none" data-checkout-lit={lit}>
          {stage.wedges.map((_, w) => {
            const order = (w - fromWedge + 20) % 20;
            return (
              <g key={w} style={{ "--i": order } as CSSProperties}>
                <path d={sector(band0, band1, w)} fill={GOLD} stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={0.4} />
              </g>
            );
          })}
        </g>
      ) : null}
      {list.map((dart, i) => {
        const spot = dartSpot(dart, quad, i);
        if (bare)
          return (
            <circle key={i} cx={spot.x} cy={spot.y} r={11} fill={GOLD} stroke="#0B0B0F" strokeWidth={3} pointerEvents="none" />
          );
        return (
          <g key={i} className={busted ? "co-dart-bust" : undefined} data-checkout-dart={i}>
          <Dart
            x={spot.x}
            y={spot.y}
            n={i + 1}
            fresh={i === fresh}
            flying={i === flyingDart}
            final={lit === "final" && i === list.length - 1}
          />
          </g>
        );
      })}
      {onWedge ? (
        <g data-checkout-hits>
          {stage.wedges.map((value, wedge) => (
            <path
              key={wedge}
              d={sector(R_BULL, R_NUMBERS, wedge)}
              fill="transparent"
              data-puzzle-cell={`w${wedge}`}
              role="button"
              aria-label={`Wedge ${value}`}
              onClick={() => onWedge(wedge)}
            />
          ))}
          <circle
            cx={C}
            cy={C}
            r={R_BULL}
            fill="transparent"
            role="button"
            aria-label="Bull"
            data-puzzle-cell="bull"
            onClick={() => onWedge(CHECKOUT_BULL)}
          />
        </g>
      ) : null}
    </svg>
  );
}

/** Undo's tug (stage 2, display only): the undone dart's copy eases back out of the board and fades (transform and
 * opacity; skipped under reduced motion), while the real dart is already gone from the state. */
export const CHECKOUT_TUG_MS = 220;
function tugOut(dart: Element | null): void {
  if (!dart || !dart.parentNode || gameFxVariant("drop") === "reduced") return;
  const ghost = dart.cloneNode(true) as SVGGElement;
  ghost.removeAttribute("data-checkout-dart");
  ghost.setAttribute("aria-hidden", "true");
  ghost.style.pointerEvents = "none";
  dart.parentNode.appendChild(ghost);
  if (typeof ghost.animate !== "function") {
    ghost.remove();
    return;
  }
  const anim = ghost.animate(
    [
      { transform: "translate(0px, 0px)", opacity: 1 },
      { transform: "translate(-1.5px, 2px)", opacity: 1, offset: 0.25 },
      { transform: "translate(7px, -9px)", opacity: 0 },
    ],
    { duration: CHECKOUT_TUG_MS, easing: "cubic-bezier(.3,.1,.5,1)" },
  );
  const done = () => ghost.remove();
  anim.finished.then(done, done);
}

/* Checkout's own stylesheet: the stall backdrop, chalk scoreboard and move animations. */
const CHECKOUT_CSS = `
/* The fairground stall behind the board is back (the polish plan's E2.1, 21 Nov 2026: 82f2f648's lamp glow, the string
   of bulbs on its wire and the dusk sky); no ring round the arena (E0.5), clipped to its own box. */
[data-checkout-root] .co-arena {
  background:
    radial-gradient(closest-side, rgba(255,214,140,0.2), rgba(255,214,140,0) 100%) center / 100% 100% no-repeat,
    radial-gradient(circle at 50% 50%, ${FAIR_BULB} 0 1.6px, rgba(255,210,122,0.35) 2.4px, transparent 4px) 0 5px / 22px 10px repeat-x,
    linear-gradient(to bottom, rgba(20,12,8,0.6), rgba(20,12,8,0.6)) 0 9.5px / 100% 1px no-repeat,
    linear-gradient(${FAIR_SKY_TOP}, ${FAIR_SKY_MID} 72%, color-mix(in srgb, ${FAIR_HORIZON} 38%, ${FAIR_SKY_MID}));
  box-shadow: none;
  overflow: hidden;
}
[data-checkout-root] .co-tabs > button {
  background: var(--jz-surface-2);
  border-color: transparent;
  color: var(--jz-text);
  font-family: var(--jz-font);
  font-weight: 800;
  font-size: 15px;
}
[data-checkout-root] .co-tabs > button[aria-selected="true"] {
  border-color: var(--jz-gold);
  color: var(--jz-gold);
  box-shadow: inset 0 0 0 1px var(--jz-gold);
}
[data-checkout-root] .co-tabs > button[data-solved="true"] {
  background: var(--jz-surface);
  color: var(--jz-gold);
}
[data-checkout-root] .co-rule { color: color-mix(in srgb, ${FAIR_CHALK} 72%, transparent); }
[data-checkout-root] .co-big { color: ${GOLD}; font-weight: 700; }
[data-checkout-root] .co-score {
  background: var(--jz-surface);
  border: 1px solid transparent;
  color: var(--jz-text);
  font-family: var(--jz-font);
}
[data-checkout-root] .co-score .co-left { font-family: var(--jz-font); font-weight: 800; font-size: 22px; }
[data-checkout-root] .co-bust-word { color: var(--jz-loss); font-weight: 800; letter-spacing: 0.04em; }
[data-checkout-root] .co-hint { color: var(--jz-text-2); }
[data-checkout-root] .co-dart-bust { animation: co-drop 520ms cubic-bezier(.5,0,.75,0) 260ms both; }
@keyframes co-drop { from { transform: none; opacity: 1; } to { transform: translateY(18px); opacity: 0; } }
[data-checkout-root] .co-score .co-from { color: color-mix(in srgb, ${FAIR_CHALK} 70%, transparent); }
[data-checkout-root] .co-ring {
  border-width: 1px;
  background: var(--jz-surface-2);
  border-color: transparent;
  color: var(--jz-text);
  font-family: var(--jz-font);
  font-weight: 800;
  font-size: 16px;
  letter-spacing: 0.02em;
}
[data-checkout-root] .co-ring[aria-disabled="true"] { opacity: 0.55; }
[data-checkout-root] .co-throw { background: var(--jz-gold); border-color: var(--jz-gold); color: var(--jz-on-gold); font-family: var(--jz-font); font-weight: 800; }
[data-checkout-root] .co-undo { background: var(--jz-surface-2); border-color: transparent; color: var(--jz-text-2); font-family: var(--jz-font); font-weight: 700; }
.co-tick, .co-term { display: inline-block; animation: co-tick 220ms cubic-bezier(.2,.8,.3,1) both; }
.co-term { animation-name: co-term; }
@keyframes co-tick { from { transform: translateY(-55%) scale(1.15); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes co-term { from { transform: translateX(10px); opacity: 0; } to { transform: none; opacity: 1; } }
.co-sel { animation: co-fade 140ms ease-out both; }
@keyframes co-fade { from { opacity: 0; } to { opacity: 1; } }
.co-dart, .co-final-dart { transform-origin: 0 0; }
.co-dart { animation: co-thud 230ms cubic-bezier(.25,.9,.35,1) both; }
@keyframes co-thud {
  0% { transform: translate(7px, -11px) scale(1.4); opacity: 0; }
  55% { transform: translate(0, 0) scale(0.92); opacity: 1; }
  78% { transform: rotate(-5deg) scale(1.03); }
  100% { transform: none; opacity: 1; }
}
.co-impact { transform-box: fill-box; transform-origin: center; animation: co-impact 260ms ease-out both; }
@keyframes co-impact { from { transform: scale(0.3); opacity: 0.95; } to { transform: scale(1.9); opacity: 0; } }
.co-final-dart { animation: co-punch 320ms cubic-bezier(.3,1.6,.5,1) both; }
@keyframes co-punch { 0% { transform: scale(1); } 45% { transform: scale(1.3); } 100% { transform: scale(1); } }
.co-lit > g { opacity: 0; animation: co-lit 760ms ease-out both; animation-delay: calc(var(--i) * 20ms); }
.co-lit-stage > g { animation-duration: 560ms; animation-delay: calc(var(--i) * 12ms); }
@keyframes co-lit { 0% { opacity: 0; } 14% { opacity: 1; } 55% { opacity: 0.8; } 100% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .co-tick, .co-term, .co-sel, .co-dart, .co-final-dart, .co-dart-bust { animation: none; }
  .co-impact { display: none; }
  .co-lit > g { animation: none; opacity: 0.6; }
}
`;

function finishWord(stage: CheckoutStageData): string {
  return stage.finish === 3 ? "treble" : "double";
}

/** checkoutRev 2's rule line: the finishing ring and the big finish, short enough for one line at 375 px. */
function bigFinishRule(stage: CheckoutStageData): string {
  // checkoutRev 4's Easy boards (anyRing): any dart checks out; a treble or the Bull is still the big finish.
  if (stage.anyRing === true) return "Any dart · ★ Bull/treble";
  return stage.finish === 3 ? "Treble · ★ Bull" : "Double · ★ Bull/treble";
}

/** True when a stored stage answer ended on a big finish (checkoutRev 2). */
function endedBig(stage: CheckoutStageData, encoded: string | undefined): boolean {
  if (!encoded) return false;
  const darts = decodeCheckoutDarts(encoded, stage.maxDarts);
  return checkoutBigFinish(stage, darts[darts.length - 1]);
}

/** Fixed example: 57 on the standard board, T15 then D6. */
const EXAMPLE_STAGE: CheckoutStageData = {
  wedges: [...CHECKOUT_STANDARD],
  target: 57,
  maxDarts: 3,
  finish: 2,
};
const EXAMPLE_DARTS: CheckoutDart[] = [
  { wedge: 7, ring: 3 },
  { wedge: 5, ring: 2 },
];

function IntroExample() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => (s + 1) % 4), 1100);
    return () => clearInterval(timer);
  }, []);
  const shown = EXAMPLE_DARTS.slice(0, Math.min(step, 2));
  const left = checkoutRemaining(EXAMPLE_STAGE, shown);
  return (
    <div className="flex flex-col items-center gap-2" style={ROOT_STYLE} data-checkout-root>
      <PolishStyle id="checkout" css={CHECKOUT_CSS} />
      <div className="co-arena rounded-xl p-1.5">
        <Board
          stage={EXAMPLE_STAGE}
          darts={shown}
          size={150}
          fresh={step >= 1 && step <= 2 ? step - 1 : -1}
          lit={left === 0 ? "stage" : null}
        />
      </div>
      <p className="h-5 font-mono text-sm text-primary">
        57 → {shown.map((d) => checkoutDartLabel(EXAMPLE_STAGE, d)).join(" + ") || "?"} → {left}
        {left === 0 ? " ✓" : ""}
      </p>
      <p className="max-w-[270px] text-center text-xs text-muted-foreground">
        Treble 15 (45), then double 6 (12): zero, finishing on a double. Each board is different.
      </p>
    </div>
  );
}

function Stage({
  puzzle,
  locked,
  onSubmit,
  onDraftAnswer,
  stateKey = "checkout",
}: PuzzleStageProps) {
  const data: CheckoutPuzzleData | null = puzzle.type === "checkout" ? puzzle : null;
  // checkoutRev 4 (levels): the round's own number of boards (Easy deals three); five on every earlier stamp.
  const boardCount = data?.stages.length || CHECKOUT_STAGES;
  const [stage, setStage] = useStageState<number>(stateKey, "checkoutStage", () => 0);
  const [solved, setSolved] = useStageState<string[]>(stateKey, "checkoutSolved", () =>
    Array.from({ length: boardCount }, () => ""),
  );
  const [inPlay, setInPlay] = useStageState<CheckoutDart[][]>(stateKey, "checkoutDarts", () =>
    Array.from({ length: boardCount }, () => []),
  );
  const [selected, setSelected] = useStageState<number | null>(
    stateKey,
    "checkoutWedge",
    () => null,
  );
  const [shake, setShake] = useState(false);
  const [correct, setCorrect] = useState(false);
  /** checkoutRev 3: the board that just bust, while its darts show before they drop out. */
  const [busted, setBusted] = useState<number | null>(null);
  /** A ring tapped with no wedge picked: the hint shows for a moment. */
  const [nudge, setNudge] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bustTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    if (bustTimer.current) clearTimeout(bustTimer.current);
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
  }, []);
  /** "stage:count" of the dart that just landed, so only that dart thuds. */
  const [landed, setLanded] = useState<string | null>(null);
  /**
   * Stage 2 (display only): the dart in the air ("stage:count"), and what its landing shows: the remaining score
   * counting down from `from` to `to`, or the bust. The state (darts, bust) changes at the throw, as before.
   */
  const [flying, setFlying] = useState<string | null>(null);
  const landPlan = useRef<{ bust: boolean; from: number; to: number } | null>(null);
  const leftRef = useRef<HTMLSpanElement | null>(null);
  const scoreRef = useRef<HTMLDivElement | null>(null);
  // While a dart is in the air the remaining score still reads what it was; it counts down when the dart lands
  // (countUpText writes only the text, ending on the number React already holds).
  useBeforePaint(() => {
    const plan = landPlan.current;
    if (flying && plan && !plan.bust && leftRef.current) leftRef.current.textContent = String(plan.from);
  }, [flying]);
  const submitted = useRef(false);
  const box = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 340, height: 320 });
  const encoded = joinCheckoutRound(solved);
  const allSolved = solved.every(Boolean);
  /** A remount after the round was already solved must not replay the finish. */
  const solvedAtMount = useRef(allSolved);
  const finale = useSolveFx(allSolved && !solvedAtMount.current, "checkout.solve", 1150);

  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);
  useBeforePaint(() => {
    const node = box.current;
    if (!node) return;
    const measure = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    measure();
    return () => ro.disconnect();
  }, []);

  // Desktop keys: Z or Backspace = Undo, Enter = Throw.
  useGameKeys((kind, key, event) => {
    if (!data) return false;
    const used = key === "z" || key === "Backspace" || key === "Enter";
    if (!used || kind !== "down" || event.repeat) return used;
    if (busy || done || !darts.length) return true;
    if (key === "Enter") throwDarts();
    else undo();
    return true;
  });

  if (!data) return null;
  const current = data.stages[stage]!;
  const bustRule = checkoutBust(data);
  // The scoring standard: the big finish pays only on a board of 100 or more a big finish can end (number.ts).
  const bigPays = !usesStandard(data) || checkoutBigBoards(data.stages)[stage] === true;
  const isSolved = (index: number) => Boolean(solved[index]);
  const darts = isSolved(stage)
    ? decodeCheckoutDarts(solved[stage]!, current.maxDarts)
    : (inPlay[stage] ?? []);
  const left = checkoutRemaining(current, darts);
  const bustShowing = busted === stage;
  const busy = locked || submitted.current || bustShowing;
  // The "Bust" word and the darts' drop wait for the busting dart to land (display only; the bust holds play at once).
  const bustSeen = bustShowing && flying === null;
  const done = isSolved(stage);
  const full = darts.length >= current.maxDarts;

  const setDarts = (next: CheckoutDart[], at = stage) => {
    const all = [...inPlay];
    all[at] = next;
    setInPlay(all);
  };
  const showNudge = () => {
    soundCue("checkout.nudge");
    setNudge(true);
    if (nudgeTimer.current) clearTimeout(nudgeTimer.current);
    nudgeTimer.current = setTimeout(() => {
      nudgeTimer.current = null;
      setNudge(false);
    }, 1400);
  };
  const addDart = (ring: number) => {
    if (busy || done || full) return;
    if (selected === null) {
      showNudge();
      return;
    }
    const dart = { wedge: selected, ring };
    if (!checkoutDartAllowed(current, dart)) return;
    const next = [...darts, dart];
    setLanded(`${stage}:${next.length}`);
    // Stage 2: the dart flies in and lands; its thud, the count-down and a bust's moment play on landing (onLand).
    setFlying(`${stage}:${next.length}`);
    const busts = bustRule && checkoutBustsAt(current, checkoutRemaining(current, next), dart, next.length);
    landPlan.current = { bust: Boolean(busts), from: left, to: checkoutRemaining(current, next) };
    setDarts(next);
    // checkoutRev 3: a bust, as in real darts. The darts show with "Bust" for a moment, then drop out and the board
    // starts again (the answer only ever holds the darts thrown since the last bust; the server re-checks every one).
    if (bustRule && checkoutBustsAt(current, checkoutRemaining(current, next), dart, next.length)) {
      const at = stage;
      setBusted(at);
      setSelected(null);
      if (bustTimer.current) clearTimeout(bustTimer.current);
      bustTimer.current = setTimeout(() => {
        bustTimer.current = null;
        setBusted(null);
        setInPlay((all) => all.map((list, i) => (i === at ? [] : list)));
      }, CHECKOUT_BUST_MS + CHECKOUT_FLIGHT_MS);
      return;
    }
  };
  /** The flying dart has landed (display only): the thud, then the count-down, or the bust. */
  const onLand = () => {
    const plan = landPlan.current;
    landPlan.current = null;
    setFlying(null);
    soundCue("checkout.thud");
    if (!plan) return;
    if (plan.bust) {
      soundCue("checkout.bust");
      gameFx("wrong", scoreRef.current, { silent: true });
      return;
    }
    soundCue("checkout.tick");
    if (leftRef.current) countUpText(leftRef.current, plan.from, plan.to, { silent: true });
  };
  const undo = () => {
    if (busy || done || !darts.length) return;
    soundCue("checkout.undo");
    // Stage 2: the dart is pulled out with a light tug (a copy of it eases back and away; the state changes at once).
    tugOut(box.current?.querySelector(`[data-checkout-dart="${darts.length - 1}"]`) ?? null);
    landPlan.current = null;
    setFlying(null);
    setDarts(darts.slice(0, -1));
  };
  const reject = () => {
    setShake(true);
    // The Number overhaul: a Throw that doesn't check out has its own sound (one sound a moment).
    soundCue("checkout.wrong");
    setTimeout(() => setShake(false), 320);
  };
  const throwDarts = () => {
    if (busy || done || !darts.length) return;
    if (!checkoutValid(current, darts, bustRule)) {
      reject();
      return;
    }
    const next = [...solved];
    next[stage] = encodeCheckoutDarts(darts);
    setSolved(next);
    setSelected(null);
    if (next.every(Boolean)) {
      playCorrect();
      requestAnimationFrame(() => gameFx("match", box.current?.querySelector("[data-checkout-lit]"), { silent: true }));
      submitted.current = true;
      onSubmit(joinCheckoutRound(next));
      return;
    }
    // A big finish on a board that pays: the crowd's "oh!" (the stage moment's chime plays with it).
    if (bigPays && checkoutBigFinish(current, darts[darts.length - 1])) soundCue("checkout.bigFinish");
    setCorrect(true);
    // Stage 2: the finishing ring lights and rings (the kit's match on the lit ring; the stage moment's chime plays).
    requestAnimationFrame(() => gameFx("match", box.current?.querySelector("[data-checkout-lit]"), { silent: true }));
    const following = Array.from({ length: boardCount }, (_, k) => k + 1)
      .map((k) => (stage + k) % boardCount)
      .find((i) => !next[i]);
    // Game review fix (15 Nov 2026): the auto-advance is cleared if the screen leaves first.
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = setTimeout(() => {
      advanceTimer.current = null;
      setCorrect(false);
      if (following !== undefined) setStage(following);
    }, CHECKOUT_ADVANCE_MS);
  };

  const boardSize = Math.max(180, Math.min(size.width - 8, size.height - 4));
  const rings = selected === CHECKOUT_BULL ? [1, 2] : current.quad ? [1, 2, 3, 4] : [1, 2, 3];
  const ringLabel = (ring: number) =>
    selected === CHECKOUT_BULL ? (ring === 2 ? "Bull 50" : "25") : ["", "Single", "Double", "Treble", "×4"][ring] ?? `×${ring}`;
  const control =
    "h-11 flex-1 rounded-xl border text-sm disabled:opacity-40";
  const fresh = landed === `${stage}:${darts.length}` && !done ? darts.length - 1 : -1;
  const lit = finale && done ? "final" : correct && done ? "stage" : null;

  return (
    <div
      data-play-area
      data-stage-column="1"
      data-checkout-root
      className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 pb-0.5 pt-1"
      style={ROOT_STYLE}
    >
      <PolishStyle id="checkout" css={CHECKOUT_CSS} />
      <div className="co-tabs flex h-9 w-full shrink-0 gap-1.5" role="tablist" aria-label="Boards">
        {data.stages.map((s, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === stage}
            data-solved={isSolved(i) ? "true" : undefined}
            disabled={busy}
            onClick={() => {
              if (i !== stage) soundCue("checkout.switch");
              setStage(i);
              setSelected(null);
            }}
            className="flex-1 rounded-lg border"
          >
            {isSolved(i) ? (endedBig(s, solved[i]) ? "★" : "✓") : s.target}
          </button>
        ))}
      </div>
      {/* Puzzle polish (3 Nov 2026): the finish rule as separate pills ("Finish Double" "★ Bull" "Darts up to 3"), not one dotted line. */}
      <div className="h-6 w-full shrink-0" data-checkout-rules>
        <HudPills
          testId="checkout"
          items={
            current.bigFinish && correct && bigPays && endedBig(current, solved[stage])
              ? [{ id: "big", value: "★ Big finish!", tone: "gold" as const }]
              : [
                  {
                    id: "finish",
                    label: "Finish",
                    value: current.bigFinish ? bigFinishRule(current).split(" · ")[0]! : current.anyRing ? "Any dart" : finishWord(current) === "treble" ? "Treble" : "Double",
                    tone: "gold" as const,
                  },
                  current.bigFinish && {
                    id: "big",
                    ...(bigPays ? { tone: "gold" as const } : {}),
                    value: bigPays ? bigFinishRule(current).split(" · ")[1]! : bigFinishRule(current).split(" · ")[1]!.replace("★ ", ""),
                  },
                  { id: "darts", label: "Darts", value: current.exactDarts ? `exactly ${current.maxDarts}` : `up to ${current.maxDarts}` },
                ]
          }
        />
      </div>
      <div
        ref={box}
        data-game-arena="board"
        className="co-arena flex min-h-0 w-full flex-1 items-center justify-center rounded-xl"
      >
        {/* The Number overhaul's shared stage moment: a board that checks out lifts and slides away. */}
        <NumberStage type="checkout" index={stage} exit={correct && done ? "clear" : null} className="items-center justify-center">
          <Board
            stage={current}
            selected={done ? null : selected}
            darts={darts}
            fresh={fresh}
            lit={lit}
            busted={bustSeen}
            finish={current.finish}
            flight
            onLand={onLand}
            onWedge={
              busy || done
                ? undefined
                : (w) => {
                    if (selected !== w) soundCue("checkout.aim");
                    setNudge(false);
                    setSelected(selected === w ? null : w);
                  }
            }
            size={boardSize}
          />
        </NumberStage>
      </div>
      <div
        ref={scoreRef}
        className={`co-score flex h-11 w-full shrink-0 items-center justify-between gap-2 rounded-lg px-2.5 ${shake ? "animate-shake" : ""}`}
        data-checkout-darts
        data-checkout-bust={bustSeen ? "" : undefined}
      >
        <span className="co-from min-w-0 truncate text-sm">
          {nudge && !bustSeen ? (
            <span className="co-hint" data-checkout-nudge>Pick a wedge first</span>
          ) : (
            <>
              {current.target}
              {darts.map((d, i) => (
                <span key={`${stage}-${i}`}>
                  {" "}
                  <span className={i === fresh ? "co-term" : undefined}>{checkoutDartTerm(current, d)}</span>
                </span>
              ))}
            </>
          )}
        </span>
        {/* Batch W: the live summary's dart count, beside what is left (display only). */}
        <span className="co-darts ml-auto shrink-0 whitespace-nowrap text-xs" data-checkout-dart-count>
          {darts.length}/{current.maxDarts} darts
        </span>
        <span
          ref={leftRef}
          key={`${stage}:${left}:${done}:${bustSeen}`}
          data-checkout-left
          className={`co-tick co-left ${bustSeen ? "co-bust-word" : left === 0 ? "text-primary" : left < 0 ? "text-warn" : ""}`}
        >
          {bustSeen ? "Bust" : done ? "✓ 0" : left}
        </span>
      </div>
      <div data-game-controls="rings" className="flex w-full shrink-0 gap-1.5">
        {rings.map((ring) => (
          <button
            key={ring}
            type="button"
            className={`${control} co-ring`}
            aria-disabled={selected === null ? true : undefined}
            aria-label={selected === null ? `${ringLabel(ring)}: pick a wedge first` : undefined}
            disabled={busy || done || full}
            onClick={() => addDart(ring)}
          >
            {ringLabel(ring)}
          </button>
        ))}
      </div>
      <div data-game-controls="actions" className="flex w-full shrink-0 gap-1.5">
        <button
          type="button"
          className={`${control} co-undo`}
          disabled={busy || done || !darts.length}
          onClick={undo}
        >
          Undo
        </button>
        <button
          type="button"
          className={`${control} co-throw`}
          disabled={busy || done || !darts.length}
          onClick={throwDarts}
        >
          Throw
        </button>
      </div>
    </div>
  );
}

/** One board's reveal (the Number overhaul, 15 Nov 2026): its verdict, the player's darts and the fewest-darts route. */
export interface CheckoutRevealBoard {
  mark: BoardMark;
  mine: CheckoutDart[];
  /** The fewest-darts route, in an order that never busts on the way (checkoutRev 3); [] without the private half. */
  best: CheckoutDart[];
  fewest: number | null;
  big: boolean;
}

/** Each board's verdict and darts from the stored answer (any stamp). Pure: the reveal and its check share it. */
export function checkoutRevealBoards(puzzle: CheckoutPuzzleData, answer: string | null): CheckoutRevealBoard[] {
  const parts = splitCheckoutRound(answer);
  const bust = checkoutBust(puzzle);
  const pays = usesStandard(puzzle) ? checkoutBigBoards(puzzle.stages) : puzzle.stages.map(() => true);
  return puzzle.stages.map((stage, index) => {
    const mine = decodeCheckoutDarts(parts[index] ?? "", stage.maxDarts);
    const ok = checkoutValid(stage, mine, bust);
    const stored = decodeCheckoutDarts(puzzle.routes?.[index] ?? "", stage.maxDarts);
    const best = bust ? checkoutBustFreeOrder(stage, stored) : stored;
    return {
      mark: ok ? "right" : mine.length ? "wrong" : "open",
      mine,
      best,
      fewest: puzzle.minDarts?.[index] ?? (best.length || null),
      big: ok && !!pays[index] && checkoutBigFinish(stage, mine[mine.length - 1]),
    };
  });
}

/** The board's finishing rule in plain words: the ring, and the big finish where the board has one. */
function revealRule(stage: CheckoutStageData): string {
  const ring = stage.anyRing === true ? "Finish on any dart" : `Finish on a ${finishWord(stage)}`;
  if (stage.bigFinish !== true) return ring;
  return stage.finish === 3 ? `${ring} or the Bull` : `${ring}, a treble or the Bull`;
}

/** The darts as chips: the ring and number in bold, the points under; the finishing dart in gold. */
function DartChips({ stage, darts, finished }: { stage: CheckoutStageData; darts: readonly CheckoutDart[]; finished: boolean }) {
  if (!darts.length) return <p className="co-rv-none">No darts thrown</p>;
  return (
    <ol className="co-rv-darts" aria-label="Darts">
      {darts.map((dart, i) => {
        const value = checkoutDartValue(stage, dart);
        const last = finished && i === darts.length - 1;
        return (
          <li key={i} className="co-rv-dart" data-finish={last ? "" : undefined}>
            <b>{checkoutDartLabel(stage, dart)}</b>
            <span>{value < 0 ? `−${-value}` : value}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining, timeLimitMs }: PuzzleRevealProps) {
  const checkout = puzzle.type === "checkout" ? puzzle : null;
  const boards = useMemo(() => (checkout ? checkoutRevealBoards(checkout, myAnswer) : []), [checkout, myAnswer]);
  const marks = boards.map((b) => b.mark);
  const [index, setIndex] = useRevealBoard(marks);
  // Chosen by the player; until then a board with darts opens on yours, one with none on the solution.
  const [picked, setPicked] = useState<RevealSide | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(300);
  // G3 (21 Nov 2026): the board sizes from the reveal template's stage (RevealScreen.tsx), never the window: as wide as
  // its box allows, up to 360, and no taller than the stage's height less the reveal's lines round it. A short stage
  // (under 520 px, e.g. 375 × 667) takes the compact layout: the target and the Yours | Solution switch on one row.
  const [short, setShort] = useState(false);
  useBeforePaint(() => {
    const el = box.current;
    if (!el) return;
    const stageEl = el.closest<HTMLElement>("[data-reveal-stage]");
    const measure = () => {
      const stageH = stageEl ? stageEl.clientHeight : 0;
      const isShort = stageH > 0 && stageH < 520;
      setShort(isShort);
      const tall = stageH > 0 ? stageH - (isShort ? 200 : 250) : 360;
      setWidth(Math.max(120, Math.min(360, Math.floor(el.clientWidth), Math.floor(tall))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (stageEl) observer.observe(stageEl);
    return () => observer.disconnect();
  }, []);
  if (!checkout) return null;
  const stage = checkout.stages[index]!;
  const board = boards[index]!;
  const hasBest = board.best.length > 0;
  const view: RevealSide = hasBest ? (picked ?? (board.mine.length ? "yours" : "solution")) : "yours";
  const darts = view === "yours" ? board.mine : board.best;
  const solved = boards.filter((b) => b.mark === "right");
  const used = solved.reduce((n, b) => n + b.mine.length, 0);
  const fewestKnown = solved.every((b) => b.fewest !== null);
  const fewest = solved.reduce((n, b) => n + (b.fewest ?? 0), 0);
  const big = boards.filter((b) => b.big).length;
  const elapsed = myCorrect && myMsRemaining !== undefined ? Math.max(0, timeLimitMs - myMsRemaining) / 1000 : null;
  return (
    <div className={`co-rv flex w-full flex-col items-center ${short ? "gap-1.5" : "gap-2.5"}`} data-checkout-root data-checkout-reveal data-short={short ? "" : undefined}>
      <PolishStyle id="checkout" css={CHECKOUT_CSS} />
      <RevealFacts
        facts={[
          { label: "Checked out", value: `${solved.length} / ${checkout.stages.length}`, tone: solved.length === checkout.stages.length ? "good" : undefined },
          solved.length > 0 && { label: "Darts", value: used },
          solved.length > 0 && fewestKnown && { label: "Fewest", value: fewest, tone: used <= fewest ? "good" : undefined },
          big > 0 && { label: "Big finishes", value: big },
          elapsed !== null && { label: "Time", value: `${elapsed.toFixed(1)} s` },
        ]}
      />
      <RevealBoards noun="Board" marks={marks} index={index} onIndex={setIndex}>
        <div className="co-rv-head">
          <span className="co-rv-target" data-checkout-reveal-target>{stage.target}</span>
          {short && hasBest ? <RevealView value={view} onChange={setPicked} /> : <span className="co-rv-rule">{revealRule(stage)}</span>}
        </div>
        {short && hasBest ? <span className="co-rv-rule">{revealRule(stage)}</span> : null}
        {!short && hasBest ? <RevealView value={view} onChange={setPicked} /> : null}
        <div ref={box} className="co-rv-board" data-checkout-reveal-side={view}>
          <Board stage={stage} darts={darts} size={width} finish={stage.finish} lit={view === "solution" || board.mark === "right" ? "stage" : null} />
        </div>
        <DartChips stage={stage} darts={darts} finished={view === "solution" || board.mark === "right"} />
        <p className="co-rv-verdict" data-mark={view === "solution" ? "right" : board.mark}>
          {view === "solution"
            ? `Fewest darts: ${board.best.length}${checkoutBigFinish(stage, board.best[board.best.length - 1]) ? " · big finish" : ""}`
            : board.mark === "right"
              ? board.big
                ? `Checked out in ${board.mine.length} · big finish`
                : `Checked out in ${board.mine.length}`
              : board.mark === "wrong"
                ? "Not checked out"
                : "Not reached"}
        </p>
      </RevealBoards>
    </div>
  );
}

export const checkoutPuzzle: PuzzleDefinition = {
  key: "checkout",
  name: gameDisplayName("checkout"),
  category: "number",
  timeLimitMs: CHECKOUT_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({
      type: "checkout",
      checkoutRev: 1,
      stages: [EXAMPLE_STAGE, EXAMPLE_STAGE, EXAMPLE_STAGE, EXAMPLE_STAGE, EXAMPLE_STAGE],
    }) satisfies CheckoutPuzzleData,
  check: (answer, puzzle) => {
    if (puzzle.type !== "checkout") return false;
    const parts = splitCheckoutRound(answer);
    return puzzle.stages.every((stage, i) =>
      checkoutValid(stage, decodeCheckoutDarts(parts[i] ?? "", stage.maxDarts), checkoutBust(puzzle)),
    );
  },
  revealHeading: "Your darts and the fewest",
  IntroExample,
  Stage,
  Reveal,
};
