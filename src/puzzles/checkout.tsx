import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import { hapticTick } from "@/components/puzzles/GridDrag";
import { PolishStyle, soundCue, useSolveFx } from "@/components/puzzles/numberPolish";
import { StageCorrect } from "@/components/puzzles/StageCorrect";
import { FLIGHTPATH_COLOURS } from "@/lib/arcade/flightpathPalette.renderer";
import {
  FAIR_BULB,
  FAIR_CHALK,
  FAIR_HORIZON,
  FAIR_SILHOUETTE,
  FAIR_SKY_MID,
  FAIR_SKY_TOP,
  FAIR_WOOD,
  FAIR_WOOD_DARK,
  FAIR_WOOD_LIGHT,
} from "@/lib/arcade/fairground.renderer";
import {
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
import { useStageState } from "@/lib/duel/stageState";
import {
  CHECKOUT_TIME_MS,
  type CheckoutPuzzleData,
  type CheckoutStageData,
} from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect, playWrong } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { useBeforePaint } from "@/components/puzzles/useBeforePaint";

/** iOS: no text selection or callout on long presses anywhere in the game. */
const ROOT_STYLE: CSSProperties = {
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
  WebkitTapHighlightColor: "transparent",
};

/* Flightpath's fairground palette: gold, burgundy, blue, pink, charcoal, cream. */
const [GOLD, BURGUNDY, BLUE, PINK, CHARCOAL, CREAM] = FLIGHTPATH_COLOURS;
const NEGATIVE_INK = "#FF8FA3";
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
/** Fairground bulbs on the wooden rim, between the wedge numbers (art only). */
const R_BULBS = 92.5;

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

/** Where a dart marker sits: the middle of its ring band in its wedge. */
function dartSpot(dart: CheckoutDart, quad: boolean, nth: number): { x: number; y: number } {
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

/** Shared gradients and textures; identical in every board, so duplicate ids are harmless. */
const BOARD_DEFS = (
  <defs>
    <radialGradient id="co-wood" cx="50%" cy="50%" r="50%">
      <stop offset="0.78" stopColor={FAIR_WOOD_DARK} />
      <stop offset="0.83" stopColor={FAIR_WOOD_LIGHT} />
      <stop offset="0.93" stopColor={FAIR_WOOD} />
      <stop offset="1" stopColor={FAIR_WOOD_DARK} />
    </radialGradient>
    <radialGradient id="co-lamp" cx="36%" cy="30%" r="72%">
      <stop offset="0" stopColor="#FFF8E1" stopOpacity="0.22" />
      <stop offset="0.5" stopColor="#FFF8E1" stopOpacity="0" />
      <stop offset="0.86" stopColor="#140A04" stopOpacity="0" />
      <stop offset="1" stopColor="#140A04" stopOpacity="0.34" />
    </radialGradient>
    <radialGradient id="co-bull" cx="40%" cy="38%" r="65%">
      <stop offset="0" stopColor="#4A93D6" />
      <stop offset="1" stopColor={BLUE} />
    </radialGradient>
    <radialGradient id="co-inner" cx="40%" cy="38%" r="65%">
      <stop offset="0" stopColor="#C23A4E" />
      <stop offset="1" stopColor={BURGUNDY} />
    </radialGradient>
    <linearGradient id="co-barrel" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stopColor="#9AA1AC" />
      <stop offset="0.45" stopColor="#3C424C" />
      <stop offset="1" stopColor="#15171B" />
    </linearGradient>
    <radialGradient id="co-glow">
      <stop offset="0" stopColor={FAIR_BULB} stopOpacity="0.9" />
      <stop offset="1" stopColor={FAIR_BULB} stopOpacity="0" />
    </radialGradient>
    {/* Sisal fibre: a fine dot weave over the painted rings. */}
    <pattern id="co-sisal" width="2.4" height="2.4" patternUnits="userSpaceOnUse">
      <circle cx="0.6" cy="0.6" r="0.32" fill="#000" fillOpacity="0.16" />
      <circle cx="1.8" cy="1.7" r="0.28" fill="#FFF" fillOpacity="0.07" />
    </pattern>
  </defs>
);

/** The painted board (rim, rings, wires, numbers, bulbs): rebuilt only when the board changes. */
function BoardArt({ wedges, quad, bare }: { wedges: readonly number[]; quad: boolean; bare: boolean }) {
  const fontSize = wedges.some((v) => Math.abs(v) >= 10) ? 13 : 14;
  const wires = quad
    ? [R_DOUBLE_OUT, R_DOUBLE_IN, R_TREBLE_OUT, R_TREBLE_IN, R_QUAD_OUT, R_QUAD_IN, R_BULL]
    : [R_DOUBLE_OUT, R_DOUBLE_IN, R_TREBLE_OUT, R_TREBLE_IN, R_BULL];
  return (
    <g pointerEvents="none">
      <circle cx={C} cy={C} r={R_NUMBERS} fill="url(#co-wood)" />
      {/* Turned-wood grain round the rim. */}
      {[81.5, 84, 88.5, 95.5].map((r) => (
        <circle
          key={r}
          cx={C}
          cy={C}
          r={r}
          fill="none"
          stroke={FAIR_WOOD_DARK}
          strokeOpacity={0.28}
          strokeWidth={0.5}
        />
      ))}
      <circle
        cx={C}
        cy={C}
        r={R_NUMBERS - 0.6}
        fill="none"
        stroke="#2A190C"
        strokeWidth={1.2}
      />
      {wedges.map((_, wedge) => {
        const even = wedge % 2 === 0;
        const single = even ? CHARCOAL : CREAM;
        const ring = even ? BURGUNDY : BLUE;
        return (
          <g key={wedge}>
            <path d={sector(R_DOUBLE_IN, R_DOUBLE_OUT, wedge)} fill={ring} />
            <path d={sector(R_TREBLE_OUT, R_DOUBLE_IN, wedge)} fill={single} />
            <path d={sector(R_TREBLE_IN, R_TREBLE_OUT, wedge)} fill={ring} />
            {quad ? (
              <>
                <path d={sector(R_QUAD_OUT, R_TREBLE_IN, wedge)} fill={single} />
                <path d={sector(R_QUAD_IN, R_QUAD_OUT, wedge)} fill={GOLD} />
                <path d={sector(R_BULL, R_QUAD_IN, wedge)} fill={single} />
              </>
            ) : (
              <path d={sector(R_BULL, R_TREBLE_IN, wedge)} fill={single} />
            )}
          </g>
        );
      })}
      <circle cx={C} cy={C} r={R_DOUBLE_OUT} fill="url(#co-sisal)" />
      <circle cx={C} cy={C} r={R_BULL} fill="url(#co-bull)" />
      <circle cx={C} cy={C} r={R_INNER_BULL} fill="url(#co-inner)" />
      {/* Spider wire, exactly on the segment edges. */}
      <g stroke={WIRE} strokeOpacity={0.6} strokeWidth={0.45} fill="none">
        {wires.map((r) => (
          <circle key={r} cx={C} cy={C} r={r} />
        ))}
        <circle cx={C} cy={C} r={R_INNER_BULL} />
        <path
          d={wedges
            .map((_, w) => {
              const a = angleOf(w) - (9 * Math.PI) / 180;
              return `M ${point(R_BULL, a)} L ${point(R_DOUBLE_OUT, a)}`;
            })
            .join(" ")}
        />
      </g>
      <circle cx={C} cy={C} r={R_NUMBERS} fill="url(#co-lamp)" />
      {bare
        ? null
        : wedges.map((value, wedge) => {
            const x = C + 89 * Math.cos(angleOf(wedge));
            const y = C + 89 * Math.sin(angleOf(wedge));
            const label = value < 0 ? `−${-value}` : String(value);
            const b = angleOf(wedge) + (9 * Math.PI) / 180;
            return (
              <g key={wedge}>
                <circle
                  cx={C + R_BULBS * Math.cos(b)}
                  cy={C + R_BULBS * Math.sin(b)}
                  r={1.7}
                  fill="#8A6A3A"
                  stroke="#2A190C"
                  strokeWidth={0.4}
                />
                <text
                  x={x + 0.6}
                  y={y + 0.8}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={fontSize}
                  fontWeight={800}
                  fontFamily="'JetBrains Mono', ui-monospace, monospace"
                  fill="#1A0E06"
                  fillOpacity={0.55}
                  aria-hidden="true"
                >
                  {label}
                </text>
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={fontSize}
                  fontWeight={800}
                  fontFamily="'JetBrains Mono', ui-monospace, monospace"
                  fill={value < 0 ? NEGATIVE_INK : FAIR_CHALK}
                >
                  {label}
                </text>
              </g>
            );
          })}
    </g>
  );
}

/** A steel dart stuck in the board: tip at the spot, flights up and to the right. */
function Dart({ x, y, n, fresh, final }: { x: number; y: number; n: number; fresh: boolean; final: boolean }) {
  const dx = Math.cos((-55 * Math.PI) / 180) * 20.5;
  const dy = Math.sin((-55 * Math.PI) / 180) * 20.5;
  return (
    <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`} pointerEvents="none">
      {fresh ? <circle r={4} className="co-impact" fill="none" stroke={FAIR_BULB} strokeWidth={1} /> : null}
      <g className={fresh ? "co-dart" : final ? "co-final-dart" : undefined}>
        <ellipse cx={0} cy={0.4} rx={2.2} ry={1.1} fill="#000" fillOpacity={0.35} />
        <g transform="rotate(-145)">
          <path d="M 0 0 L 0.75 4.2 L -0.75 4.2 Z" fill="#C9CED6" />
          <rect x={-1.3} y={4.2} width={2.6} height={6} rx={0.6} fill="url(#co-barrel)" />
          <path d="M -1.3 6 H 1.3 M -1.3 7.5 H 1.3 M -1.3 9 H 1.3" stroke="#8C939E" strokeWidth={0.35} />
          <rect x={-0.45} y={10.2} width={0.9} height={4.5} fill="#1A1C20" />
          <path
            d="M 0 12.2 L 3.7 15 L 3.3 19 L 0 17.6 L -3.3 19 L -3.7 15 Z"
            fill={PINK}
            stroke="#0B0B0F"
            strokeOpacity={0.55}
            strokeWidth={0.45}
          />
        </g>
        <circle cx={dx} cy={dy} r={4.4} fill={GOLD} stroke="#0B0B0F" strokeWidth={1} />
        <text
          x={dx}
          y={dy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={6}
          fontWeight={800}
          fill="#0B0B0F"
        >
          {n}
        </text>
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
function Board({
  stage,
  selected,
  darts,
  onWedge,
  size,
  fresh = -1,
  lit = null,
  finish = 2,
  bare = false,
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
}) {
  const quad = stage.quad === true;
  const wedgeKey = stage.wedges.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const art = useMemo(() => <BoardArt wedges={stage.wedges} quad={quad} bare={bare} />, [wedgeKey, quad, bare]);
  const list = darts ?? [];
  const last = list[list.length - 1];
  const fromWedge = last && last.wedge !== CHECKOUT_BULL ? last.wedge : 0;
  const [band0, band1] = finishBand(finish);
  const selPath =
    selected === null || selected === undefined
      ? null
      : selected === CHECKOUT_BULL
        ? `M ${C - R_BULL} ${C} A ${R_BULL} ${R_BULL} 0 1 0 ${C + R_BULL} ${C} A ${R_BULL} ${R_BULL} 0 1 0 ${C - R_BULL} ${C} Z`
        : sector(R_BULL, R_NUMBERS, selected);
  return (
    <svg
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
            const b = angleOf(w) + (9 * Math.PI) / 180;
            return (
              <g key={w} style={{ "--i": order } as CSSProperties}>
                <path d={sector(band0, band1, w)} fill={FAIR_BULB} stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={0.5} />
                {bare ? null : (
                  <>
                    <circle cx={C + R_BULBS * Math.cos(b)} cy={C + R_BULBS * Math.sin(b)} r={5} fill="url(#co-glow)" />
                    <circle cx={C + R_BULBS * Math.cos(b)} cy={C + R_BULBS * Math.sin(b)} r={1.7} fill={FAIR_BULB} />
                  </>
                )}
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
          <Dart
            key={i}
            x={spot.x}
            y={spot.y}
            n={i + 1}
            fresh={i === fresh}
            final={lit === "final" && i === list.length - 1}
          />
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

/* Checkout's own stylesheet: the stall backdrop, chalk scoreboard and move animations. */
const CHECKOUT_CSS = `
[data-checkout-root] .co-arena {
  background:
    radial-gradient(closest-side, rgba(255,214,140,0.2), rgba(255,214,140,0) 100%) center / 100% 100% no-repeat,
    radial-gradient(circle at 50% 50%, ${FAIR_BULB} 0 1.6px, rgba(255,210,122,0.35) 2.4px, transparent 4px) 0 5px / 22px 10px repeat-x,
    linear-gradient(to bottom, rgba(20,12,8,0.6), rgba(20,12,8,0.6)) 0 9.5px / 100% 1px no-repeat,
    linear-gradient(${FAIR_SKY_TOP}, ${FAIR_SKY_MID} 72%, color-mix(in srgb, ${FAIR_HORIZON} 38%, ${FAIR_SKY_MID}));
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 -18px 30px -18px rgba(0,0,0,0.5);
}
[data-checkout-root] .co-tabs > button {
  background: linear-gradient(${FAIR_SILHOUETTE}, #120D22);
  border-color: color-mix(in srgb, ${FAIR_WOOD_LIGHT} 55%, transparent);
  color: ${FAIR_CHALK};
}
[data-checkout-root] .co-tabs > button[aria-selected="true"] {
  border-color: ${GOLD};
  color: ${GOLD};
  box-shadow: inset 0 0 0 1px ${GOLD}, 0 0 10px -2px color-mix(in srgb, ${GOLD} 60%, transparent);
}
[data-checkout-root] .co-tabs > button[data-solved="true"] {
  background: linear-gradient(${GOLD}, #D99A1C);
  color: #0B0B0F;
}
[data-checkout-root] .co-rule { color: color-mix(in srgb, ${FAIR_CHALK} 72%, transparent); }
[data-checkout-root] .co-score {
  background: radial-gradient(120% 140% at 30% 0%, #2B3A33, #18221E);
  border: 2px solid ${FAIR_WOOD};
  box-shadow: inset 0 0 0 1px ${FAIR_WOOD_DARK}, inset 0 1px 0 1px rgba(255,255,255,0.05);
  color: ${FAIR_CHALK};
}
[data-checkout-root] .co-score .co-from { color: color-mix(in srgb, ${FAIR_CHALK} 70%, transparent); }
[data-checkout-root] .co-ring { border-width: 1px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -2px 0 rgba(0,0,0,0.25); }
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
  .co-tick, .co-term, .co-sel, .co-dart, .co-final-dart { animation: none; }
  .co-impact { display: none; }
  .co-lit > g { animation: none; opacity: 0.6; }
}
`;

function finishWord(stage: CheckoutStageData): string {
  return stage.finish === 3 ? "treble" : "double";
}

function dartsRule(stage: CheckoutStageData): string {
  return stage.exactDarts ? `exactly ${stage.maxDarts} darts` : `up to ${stage.maxDarts} darts`;
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

/** Ring buttons wear their ring's paint: singles charcoal, doubles burgundy, trebles blue, x4 gold. */
function ringPaint(ring: number, bull: boolean): CSSProperties {
  if (bull)
    return ring === 2
      ? { background: BURGUNDY, color: "#FFFFFF", borderColor: GOLD }
      : { background: BLUE, color: "#FFFFFF", borderColor: GOLD };
  if (ring === 2) return { background: BURGUNDY, color: "#FFFFFF", borderColor: GOLD };
  if (ring === 3) return { background: BLUE, color: "#FFFFFF", borderColor: GOLD };
  if (ring === 4) return { background: GOLD, color: "#0B0B0F", borderColor: GOLD };
  return { background: CHARCOAL, color: CREAM, borderColor: GOLD };
}

function Stage({
  puzzle,
  locked,
  onSubmit,
  onDraftAnswer,
  stateKey = "checkout",
}: PuzzleStageProps) {
  const data: CheckoutPuzzleData | null = puzzle.type === "checkout" ? puzzle : null;
  const [stage, setStage] = useStageState<number>(stateKey, "checkoutStage", () => 0);
  const [solved, setSolved] = useStageState<string[]>(stateKey, "checkoutSolved", () =>
    Array.from({ length: CHECKOUT_STAGES }, () => ""),
  );
  const [inPlay, setInPlay] = useStageState<CheckoutDart[][]>(stateKey, "checkoutDarts", () =>
    Array.from({ length: CHECKOUT_STAGES }, () => []),
  );
  const [selected, setSelected] = useStageState<number | null>(
    stateKey,
    "checkoutWedge",
    () => null,
  );
  const [shake, setShake] = useState(false);
  const [correct, setCorrect] = useState(false);
  /** "stage:count" of the dart that just landed, so only that dart thuds. */
  const [landed, setLanded] = useState<string | null>(null);
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

  if (!data) return null;
  const current = data.stages[stage]!;
  const isSolved = (index: number) => Boolean(solved[index]);
  const darts = isSolved(stage)
    ? decodeCheckoutDarts(solved[stage]!, current.maxDarts)
    : (inPlay[stage] ?? []);
  const left = checkoutRemaining(current, darts);
  const busy = locked || submitted.current;
  const done = isSolved(stage);
  const full = darts.length >= current.maxDarts;

  const setDarts = (next: CheckoutDart[]) => {
    const all = [...inPlay];
    all[stage] = next;
    setInPlay(all);
  };
  const addDart = (ring: number) => {
    if (busy || done || selected === null || full) return;
    const dart = { wedge: selected, ring };
    if (!checkoutDartAllowed(current, dart)) return;
    hapticTick();
    setLanded(`${stage}:${darts.length + 1}`);
    soundCue("checkout.thud");
    soundCue("checkout.tick");
    setDarts([...darts, dart]);
  };
  const reject = () => {
    setShake(true);
    buzz(20);
    playWrong();
    setTimeout(() => setShake(false), 320);
  };
  const throwDarts = () => {
    if (busy || done || !darts.length) return;
    if (!checkoutValid(current, darts)) {
      reject();
      return;
    }
    const next = [...solved];
    next[stage] = encodeCheckoutDarts(darts);
    setSolved(next);
    setSelected(null);
    playCorrect();
    buzz(20);
    if (next.every(Boolean)) {
      submitted.current = true;
      onSubmit(joinCheckoutRound(next));
      return;
    }
    soundCue("checkout.stage");
    setCorrect(true);
    const following = [1, 2, 3, 4, 5]
      .map((k) => (stage + k) % CHECKOUT_STAGES)
      .find((i) => !next[i]);
    setTimeout(() => {
      setCorrect(false);
      if (following !== undefined) setStage(following);
    }, 900);
  };

  const boardSize = Math.max(180, Math.min(size.width - 8, size.height - 4));
  const rings = selected === CHECKOUT_BULL ? [1, 2] : current.quad ? [1, 2, 3, 4] : [1, 2, 3];
  const ringLabel = (ring: number) =>
    selected === CHECKOUT_BULL ? (ring === 2 ? "Bull 50" : "25") : `x${ring}`;
  const control =
    "h-11 flex-1 rounded-xl border font-mono text-sm font-bold uppercase tracking-wider disabled:opacity-40";
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
              setStage(i);
              setSelected(null);
            }}
            className="flex-1 rounded-lg border font-mono text-sm font-bold"
          >
            {isSolved(i) ? "✓" : s.target}
          </button>
        ))}
      </div>
      <p
        className="co-rule h-5 w-full shrink-0 text-center font-mono text-xs uppercase tracking-wider"
        data-checkout-rule
      >
        Finish on a <span className="text-primary">{finishWord(current)}</span> ·{" "}
        {dartsRule(current)}
      </p>
      <StageCorrect visible={correct} />
      <div
        ref={box}
        data-game-arena="board"
        className="co-arena flex min-h-0 w-full flex-1 items-center justify-center rounded-xl"
      >
        <Board
          stage={current}
          selected={done ? null : selected}
          darts={darts}
          fresh={fresh}
          lit={lit}
          finish={current.finish}
          onWedge={
            busy || done
              ? undefined
              : (w) => {
                  hapticTick();
                  if (selected !== w) soundCue("checkout.aim");
                  setSelected(selected === w ? null : w);
                }
          }
          size={boardSize}
        />
      </div>
      <div
        className={`co-score flex h-10 w-full shrink-0 items-center justify-between gap-2 rounded-lg px-2.5 font-mono ${shake ? "animate-shake" : ""}`}
        data-checkout-darts
      >
        <span className="co-from truncate text-sm">
          {current.target}
          {darts.map((d, i) => (
            <span key={`${stage}-${i}`} className={i === fresh ? "co-term" : undefined} style={{ color: FAIR_CHALK }}>
              {" "}− {checkoutDartLabel(current, d)}
            </span>
          ))}
        </span>
        <span
          key={`${stage}:${left}:${done}`}
          className={`co-tick text-xl font-bold ${left === 0 ? "text-primary" : left < 0 ? "text-warn" : ""}`}
        >
          {done ? "✓ 0" : left}
        </span>
      </div>
      <div data-game-controls="rings" className="flex w-full shrink-0 gap-1.5">
        {rings.map((ring) => (
          <button
            key={ring}
            type="button"
            className={`${control} co-ring`}
            style={ringPaint(ring, selected === CHECKOUT_BULL)}
            disabled={busy || done || selected === null || full}
            onClick={() => addDart(ring)}
          >
            {ringLabel(ring)}
          </button>
        ))}
      </div>
      <div data-game-controls="actions" className="flex w-full shrink-0 gap-1.5">
        <button
          type="button"
          className={`${control} border-border text-muted-foreground`}
          disabled={busy || done || !darts.length}
          onClick={() => {
            soundCue("checkout.tick");
            setDarts(darts.slice(0, -1));
          }}
        >
          Undo
        </button>
        <button
          type="button"
          className={`${control} border-primary bg-primary text-primary-foreground`}
          disabled={busy || done || !darts.length}
          onClick={throwDarts}
        >
          Throw
        </button>
      </div>
    </div>
  );
}

const REVEAL_LABEL = "#CFC8BA";

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "checkout") return null;
  const parts = splitCheckoutRound(myAnswer);
  return (
    <div className="flex w-full flex-col items-stretch gap-1.5 px-1" data-checkout-root>
      <PolishStyle id="checkout" css={CHECKOUT_CSS} />
      {puzzle.stages.map((stage, index) => {
        const mine = decodeCheckoutDarts(parts[index] ?? "", stage.maxDarts);
        const ok = checkoutValid(stage, mine);
        const best = decodeCheckoutDarts(puzzle.routes?.[index] ?? "", stage.maxDarts);
        return (
          <div
            key={index}
            data-puzzle-cell={index}
            className="flex items-center gap-2 rounded-lg border px-1.5 py-1 font-mono"
            style={{
              borderColor: ok ? `color-mix(in srgb, ${GOLD} 55%, transparent)` : "rgba(255,255,255,0.14)",
              background: "linear-gradient(90deg, rgba(59,44,99,0.45), rgba(13,24,56,0.25))",
            }}
          >
            <div className="shrink-0 rounded-full" aria-hidden="true">
              <Board stage={stage} darts={ok ? mine : []} size={44} bare finish={stage.finish} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1 text-sm">
                <span className="text-xs" style={{ color: REVEAL_LABEL }}>
                  {index + 1}. {stage.target} · {finishWord(stage)}
                </span>
                <span className={ok ? "font-bold text-primary" : "text-warn"}>
                  {ok
                    ? `✓ ${mine.map((d) => checkoutDartLabel(stage, d)).join(" ")} (${mine.length})`
                    : "✗ not checked out"}
                </span>
              </div>
              <p className="text-sm leading-tight" style={{ color: REVEAL_LABEL }}>
                Fewest {puzzle.minDarts?.[index] ?? "?"}:{" "}
                {best
                  .map((d) => `${checkoutDartLabel(stage, d)} (${checkoutDartValue(stage, d)})`)
                  .join(" + ")}
              </p>
            </div>
          </div>
        );
      })}
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
      checkoutValid(stage, decodeCheckoutDarts(parts[i] ?? "", stage.maxDarts)),
    );
  },
  revealHeading: "Your darts and the fewest",
  IntroExample,
  Stage,
  Reveal,
};
