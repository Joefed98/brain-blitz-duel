import { gameDisplayName } from "@/lib/duel/gameNames";
import {
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";
import { PolishStyle, soundCue, useSolveFx } from "@/components/puzzles/numberPolish";
import { StageProgress } from "@/components/puzzles/StageProgress";
import { visualFx } from "@/lib/fx";
import { gameFx } from "@/lib/fx/kit";
import { FxCountUp } from "@/components/fx/GameFx";
import { numlinePayoffPlan, numlineTenthsCrossed } from "@/lib/duel/numlineFx";
import {
  decodeNumline,
  encodeNumline,
  gradeNumlineItems,
  numlineErrorLabel,
  numlineTicks,
  numlineFullError,
  NUMLINE_ITEMS,
  numlineHiddenEnd,
  NUMLINE_SCALE,
  NUMLINE_STAGES,
  NUMLINE_TOTAL,
} from "@/lib/duel/numline";
import { useStageState } from "@/lib/duel/stageState";
import { NUMLINE_TIME_MS, type NumlinePuzzleData, type NumlineStageData } from "@/lib/duel/types";
import { useReducedMotion } from "@/lib/motion";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { useBeforePaint } from "@/components/puzzles/useBeforePaint";
import { horizontalOf, useGameKeys } from "@/lib/desktop";
import { GoalLineContext } from "@/components/duel/GameFrame";
import { HudPills } from "@/components/puzzles/HudPills";
import { isBullseye, usesNumberDepth } from "@/lib/duel/numberDepth";
import { usesStandard } from "@/lib/duel/standard/stamps";
import { BALLPARK_STD_FULL, isStdBullseye } from "@/lib/duel/standard/number";
import "@/polish-layout/batch-w-numline.css";
import { NumberStage, numberArt } from "@/components/puzzles/number/overhaul";
import { RevealBoards, RevealFacts, useRevealBoard, type BoardMark } from "@/components/puzzles/number/RevealParts";
import { Button } from "@/design/components";
// The Number overhaul's shared look (darker background, navy and champagne controls), loaded with the game.
import "@/polish-layout/number-overhaul.css";

/** iOS: no text selection or callout on long presses anywhere in the game. */
const ROOT_STYLE: CSSProperties = {
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
  WebkitTapHighlightColor: "transparent",
};
const SIDE = 22;
const ZOOM = 4;
const LENS = 84;
/** The Number overhaul (15 Nov 2026): labels and numbers in the app's one font, bold. */
const ARCHIVO = "var(--jz-font)";
/** The overhaul's beat for a finished line to lift and slide away before the next one comes in (display only). */
const LINE_CLEAR_MS = 950;
/** How long an edge bump shows after a touch past an end of the line. */
const EDGE_BUMP_MS = 320;

/**
 * The Number overhaul's edge bump (15 Nov 2026, display only): which end a touch at `clientX` lies beyond, given the
 * line box's left edge and the tape's span (the marker still clamps to that end exactly as before).
 */
export function numlineEdgeOf(clientX: number, left: number, span: number): "lo" | "hi" | null {
  const raw = (clientX - left - SIDE) / Math.max(1, span);
  if (raw < 0) return "lo";
  if (raw > 1) return "hi";
  return null;
}
/** Completion sweep: the glint crosses the whole tape in this time; each marker ticks as it passes. */
const SWEEP_MS = 720;

/**
 * Number polish (13 Oct 2026): a steel-rule tape with crisp end notches and pinned markers.
 * Only the labelled ticks are drawn (ends, plus 0 inside the line): no graduations, so the
 * estimate stays as hard as before. Drawing and animation only.
 */
const NUMLINE_CSS = `
.game-column [data-polish="numline"][data-stage-column] > [data-game-arena] { flex: 1 1 auto; max-height: none; }
.numline-card {
  height: clamp(72px, 13cqh, 104px);
  font-size: clamp(36px, 7cqh, 50px);
  line-height: 1;
  background-image: linear-gradient(180deg, color-mix(in oklab, var(--card) 88%, white 6%), var(--card));
  box-shadow: inset 0 1px 0 color-mix(in oklab, white 10%, transparent), 0 6px 14px -8px rgb(0 0 0 / 0.7);
}
.numline-line-in { animation: numline-line-in 220ms ease-out both; }
@keyframes numline-line-in { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: none; } }
.numline-item-in { animation: numline-item-in 200ms ease-out both; }
@keyframes numline-item-in { from { opacity: 0; transform: translateY(6px) scale(0.96); } to { opacity: 1; transform: none; } }
.numline-drop { animation: numline-drop 220ms cubic-bezier(.3,1.4,.5,1) both; }
@keyframes numline-drop { from { opacity: 0.3; transform: translateY(-12px); } to { opacity: 1; transform: none; } }
.numline-glint { animation: numline-glint ${SWEEP_MS}ms cubic-bezier(.45,0,.4,1) both; }
@keyframes numline-glint { from { transform: translateX(0); opacity: 0.2; } 12% { opacity: 1; } 88% { opacity: 1; } to { transform: translateX(var(--numline-span)); opacity: 0; } }
.numline-tick { transform-box: fill-box; transform-origin: 50% 50%; animation: numline-tick 260ms ease-out both; }
@keyframes numline-tick { from { opacity: 0; transform: scaleY(0.2); } 60% { opacity: 1; transform: scaleY(1.25); } to { opacity: 1; transform: scaleY(1); } }
.numline-ring { transform-box: fill-box; transform-origin: 50% 50%; animation: numline-ring 380ms ease-out both; }
@keyframes numline-ring { from { opacity: 0.95; transform: scale(0.6); } to { opacity: 0; transform: scale(1.9); } }
/* The overhaul's edge bump: a touch past an end shows a short stop at that end (the marker clamps there). */
.numline-edge { position: absolute; width: 6px; height: 44px; border-radius: 3px; background: var(--jz-gold); pointer-events: none;
  animation: numline-edge ${EDGE_BUMP_MS}ms ease-out both; }
.numline-edge[data-numline-edge="lo"] { --numline-bump: -5px; }
.numline-edge[data-numline-edge="hi"] { --numline-bump: 5px; }
@keyframes numline-edge { 0% { transform: translateX(0); opacity: 1; } 35% { transform: translateX(var(--numline-bump)); opacity: 1; } 100% { transform: translateX(0); opacity: 0.6; } }
@media (prefers-reduced-motion: reduce) {
  .numline-line-in, .numline-item-in, .numline-drop, .numline-tick, .numline-ring, .numline-edge { animation: none; }
  .numline-glint { display: none; }
}
/* The reveal (the Number overhaul): the line large, then the five numbers with how far off each was. */
.nl-reveal-key { font-family: var(--jz-font); font-size: 13px; font-weight: 600; color: var(--jz-text-2); }
.nl-reveal-key .nl-key-true { color: var(--jz-gold); }
.nl-reveal-key .nl-key-yours { color: var(--jz-text); margin-left: 10px; }
.nl-reveal-rows { display: flex; width: 100%; max-width: 420px; flex-direction: column; gap: 4px; margin: 0; padding: 0; list-style: none; }
.nl-reveal-row { display: flex; min-height: 34px; align-items: center; gap: 10px; padding: 2px 12px; border-radius: 12px; background: var(--jz-surface-2); }
.nl-reveal-n { display: inline-flex; width: 26px; height: 26px; flex: none; align-items: center; justify-content: center; border-radius: 50%; background: var(--jz-gold); color: var(--jz-on-gold); font-family: var(--jz-font); font-size: 14px; font-weight: 800; }
.nl-reveal-item { min-width: 0; flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--jz-font); font-size: 19px; font-weight: 800; color: var(--jz-text); }
.nl-reveal-off { flex: none; font-family: var(--jz-font); font-size: 16px; font-weight: 700; color: var(--jz-red); font-variant-numeric: tabular-nums; }
.nl-reveal-row[data-close] .nl-reveal-off { color: var(--jz-text); }
.nl-reveal-off[data-bull] { color: var(--jz-gold); }
.nl-reveal-row:not([data-placed]) .nl-reveal-off { color: var(--jz-text-3); }
/* A short screen (375 x 667 under the shared reveal layout's stars row): tighter rows and no key, so nothing is shrunk. */
@media (max-height: 700px) { .nl-reveal-key { display: none; } .nl-reveal-row { min-height: 28px; } .nl-reveal-rows { gap: 2px; } }
`;

const fmt = (n: number) =>
  Math.abs(n) >= 1000 ? n.toLocaleString("en-GB") : n < 0 ? `−${-n}` : String(n);

/** End labels, plus 0 when it sits inside the line. */
/**
 * Game review fix (15 Nov 2026, input only): a pointer-down places the marker only on the line or below it, never on
 * the number card or the header above the line. `lineTop` is the line box's top (null before it is laid out).
 */
export function numlinePointerAllowed(target: Element | null, clientY: number, lineTop: number | null): boolean {
  if (target?.closest?.("[data-numline-item]")) return false;
  return lineTop === null || clientY >= lineTop;
}

/**
 * One sound a place (game review fix, 15 Nov 2026; was tick + place + move): the draft change already plays the shared
 * `move` (FeedbackStage), so the place adds only its pop and the game's own cue, which plays only once it has a file.
 */
export function numlinePlaceSound(): void {
  soundCue("numline.place");
  visualFx("onPlace");
}

function tickLabels(
  stage: Pick<NumlineStageData, "lo" | "hi">,
  /** Expert's hidden end (numlineLevels.ts): the share whose label shows "?". */
  hidden: number | null = null,
): { share: number; label: string }[] {
  const ticks = numlineTicks(stage);
  return ticks
    .map((share) => ({ share, label: share === hidden ? "?" : fmt(Math.round(stage.lo + share * (stage.hi - stage.lo))) }))
    .sort((a, b) => a.share - b.share);
}

/** Centres a label under its tick, nudged inwards so a long end label stays on screen. */
function labelX(cx: number, textW: number, width: number): number {
  return Math.max(textW / 2 + 1, Math.min(width - textW / 2 - 1, cx));
}

/**
 * Rises for the placed markers' labels: each takes the lowest of three levels where it
 * does not overlap a label already there (12px mono, ~7.2px a character).
 */
function labelLevels(xs: readonly number[], items: readonly string[], minWidth = 0): number[] {
  const order = xs.map((_, i) => i).sort((a, b) => xs[a]! - xs[b]!);
  const ends: number[] = [-Infinity, -Infinity, -Infinity];
  const out: number[] = xs.map(() => 0);
  for (const i of order) {
    const half = Math.max(minWidth, (items[i] ?? "").length * 7.2) / 2 + 3;
    let level = ends.findIndex((end) => xs[i]! - half >= end);
    if (level < 0) level = ends.indexOf(Math.min(...ends));
    ends[level] = xs[i]! + half;
    out[i] = level;
  }
  return out;
}

/** Gradient defs for one tape, built once per id. */
function TapeDefs({ id }: { id: string }) {
  return useMemo(
    () => (
      <defs>
        <linearGradient id={`${id}-steel`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1f3f7" />
          <stop offset="0.18" stopColor="#d9dde4" />
          <stop offset="0.82" stopColor="#c2c7d0" />
          <stop offset="1" stopColor="#959aa6" />
        </linearGradient>
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.35" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.8" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-pin`} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#fff3cf" />
          <stop offset="0.35" stopColor="var(--primary)" />
          <stop offset="1" stopColor="#a8700e" />
        </radialGradient>
        <radialGradient id={`${id}-placed`} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#f2f2f7" />
          <stop offset="0.45" stopColor="#a9abb8" />
          <stop offset="1" stopColor="#5d6070" />
        </radialGradient>
        <linearGradient id={`${id}-glint`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fffbe8" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
    ),
    [id],
  );
}

interface TapeGeom {
  x: (share: number) => number;
  y: number;
  /** Tape thickness. */
  t: number;
  /** Gradient id prefix. */
  id: string;
}

/**
 * A horizontal steel tape with its labelled notches; children draw markers in 0–1 shares
 * via `x`. `t` is the tape thickness; `label` the end-label size.
 */
/**
 * A live round's sizes (the Number overhaul's layout pass, Joe 15 Nov 2026): the line is the big element, a tall,
 * clear ruler with bold end labels and a big pin, and the number card above it small and compact. `arenaH` is the
 * arena's height; the card, the caption over it and the gaps take `NUMLINE_CARD_H` + 56 of it, the line box the rest (within
 * 250–520, so the card and line fill the arena; the group is centred). Intros and demos keep their older sizes (140 high, a 24 px tape), so recorded touches still land.
 */
export const NUMLINE_CARD_H = 56;
export function numlineLiveSizes(arenaH: number) {
  const lineH = Math.max(250, Math.min(520, Math.round(arenaH - NUMLINE_CARD_H - 56)));
  // The tape thickens with the room it has (72 to 92 px), the end labels with it.
  const t = Math.max(72, Math.min(92, Math.round(lineH * 0.24)));
  const label = t >= 84 ? 40 : 36;
  return {
    lineH,
    t,
    label,
    /**
     * The tape's centre, a share of the box: above it the pins and their labels (the live pin's head and three levels
     * of placed labels), under it the end labels; the three together sit centred in the box, so any spare height is
     * shared above the pins and below the labels.
     */
    yShare: (() => {
      const above = 88 + 2 * 24 + 24;
      const below = t / 2 + 8 + label + 12;
      const margin = Math.max(0, (lineH - (above + t / 2 + below)) / 2);
      return (lineH - below - margin) / lineH;
    })(),
    pinR: 24,
    pinRise: 88,
    placedR: 13,
    cardH: NUMLINE_CARD_H,
    cardFont: 36,
  };
}

export function Line({
  stage,
  width,
  height,
  t = 14,
  label = 16,
  yShare = 0.55,
  minor = 0,
  hidden = null,
  svgStyle,
  children,
}: {
  stage: Pick<NumlineStageData, "lo" | "hi">;
  /** Expert's hidden end label (a share of the line, shown as "?"); null shows every label. */
  hidden?: number | null;
  width: number;
  height: number;
  t?: number;
  label?: number;
  yShare?: number;
  /** Unlabelled ticks across the tape at each 1/minor of the line (a live round's tenths); 0 for none. */
  minor?: number;
  svgStyle?: CSSProperties;
  children?: (x: (share: number) => number, y: number, geom: TapeGeom) => ReactNode;
}) {
  const id = `nl${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const y = Math.round(height * yShare);
  const x = (share: number) => SIDE + share * (width - 2 * SIDE);
  const left = x(0) - 9;
  const right = x(1) + 9;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", overflow: "visible", ...svgStyle }}
    >
      <TapeDefs id={id} />
      {/* The Number overhaul: the rendered ruler (docs/design/number-overhaul/source/numline.py), a flat bar the tape's
          thickness tall: a dark enamel face between polished chrome edges and end caps. Drawn in three slices so only
          the plain middle stretches, sideways; the caps keep their shape (24 x 80 points scaled to the tape). */}
      {(() => {
        const cap = (24 * t) / 80;
        const top = y - t / 2;
        return (
          <g data-numline-ruler>
            <image href={numberArt("numline", "ruler-m")} x={left + cap - 0.5} y={top} width={Math.max(0, right - left - 2 * cap + 1)} height={t} preserveAspectRatio="none" />
            <image href={numberArt("numline", "ruler-l")} x={left} y={top} width={cap} height={t} preserveAspectRatio="none" />
            <image href={numberArt("numline", "ruler-r")} x={right - cap} y={top} width={cap} height={t} preserveAspectRatio="none" />
          </g>
        );
      })()}
      {minor > 0
        ? Array.from({ length: minor - 1 }, (_, i) => (i + 1) / minor).map((share) => (
            <line
              key={`m${share}`}
              data-numline-minor
              x1={x(share)}
              y1={y - t / 2 + t * 0.14}
              x2={x(share)}
              y2={y - t / 2 + t * (share === 0.5 ? 0.6 : 0.4)}
              stroke={share === 0.5 ? "var(--jz-gold)" : "var(--jz-white)"}
              strokeWidth={share === 0.5 ? 4 : 3}
              strokeLinecap="square"
            />
          ))
        : null}
      {tickLabels(stage, hidden).map((tick) => (
        <g key={tick.share}>
          {/* A crisp notch down the ruler's face (white, so it reads on the enamel), continued below it to the label. */}
          <line
            x1={x(tick.share)}
            y1={y - t / 2 + t * 0.14}
            x2={x(tick.share)}
            y2={y + t / 2 + 6}
            stroke="var(--jz-white)"
            strokeWidth={3}
            strokeLinecap="square"
          />
          <line
            x1={x(tick.share)}
            y1={y + t / 2}
            x2={x(tick.share)}
            y2={y + t / 2 + 6}
            stroke="var(--foreground)"
            strokeWidth={2}
          />
          <text
            x={labelX(x(tick.share), tick.label.length * label * 0.62, width)}
            y={y + t / 2 + 8 + label}
            textAnchor="middle"
            fontSize={label}
            fontWeight={800}
            fill="var(--foreground)"
            fontFamily={ARCHIVO}
          >
            {tick.label}
          </text>
        </g>
      ))}
      {children?.(x, y, { x, y, t, id })}
    </svg>
  );
}

/** A pinned marker: needle through the tape, a shaded head and its soft shadow. */
export function Pin({
  cx,
  geom,
  r,
  rise,
  fill,
  needle,
}: {
  cx: number;
  geom: TapeGeom;
  r: number;
  rise: number;
  fill: string;
  needle: string;
}) {
  const top = geom.y - geom.t / 2;
  const head = top - rise;
  return (
    <>
      <line
        x1={cx}
        y1={head}
        x2={cx}
        y2={geom.y + geom.t / 2 + 3}
        stroke={needle}
        strokeWidth={r > 8 ? 3 : 2}
        strokeLinecap="round"
      />
      <circle cx={cx + 1.5} cy={head + 2.5} r={r} fill="var(--jz-bg)" opacity={0.35} />
      {/* The Number overhaul: the rendered head (champagne for the live marker, pewter once placed); `fill` keeps
          the drawn gradient's role as which head to use. */}
      <image
        href={numberArt("numline", fill.endsWith("-placed)") ? "pin-placed" : "pin")}
        x={cx - (r * 16) / 14}
        y={head - (r * 16) / 14}
        width={(r * 32) / 14}
        height={(r * 32) / 14}
      />
    </>
  );
}

/** Fixed example: 3/8 on a 0 to 1 line. */
function IntroExample() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => (s + 1) % 4), 1000);
    return () => clearInterval(timer);
  }, []);
  const share = step === 0 ? 0.7 : step === 1 ? 0.45 : 0.38;
  return (
    <div className="flex flex-col items-center gap-2" style={ROOT_STYLE}>
      <p className="font-display text-2xl font-bold text-foreground">3/8</p>
      <Line stage={{ lo: 0, hi: 1 }} width={250} height={72} t={12} label={14}>
        {(x, y, geom) => (
          <>
            <g style={{ transform: `translateX(${x(share)}px)`, transition: "transform 600ms ease-in-out" }}>
              <Pin
                cx={0}
                geom={geom}
                r={7}
                rise={18}
                fill={`url(#${geom.id}-pin)`}
                needle="var(--primary)"
              />
            </g>
            {step === 3 ? (
              <line
                x1={x(0.375)}
                y1={y - 10}
                x2={x(0.375)}
                y2={y + 10}
                stroke="var(--ok, #3DDC84)"
                strokeWidth={3}
              />
            ) : null}
          </>
        )}
      </Line>
      <p className="h-5 font-mono text-sm text-primary">
        {step === 3 ? "Placed: 0.5% off, a bullseye" : "Drag, then Place"}
      </p>
      <p className="max-w-[270px] text-center text-xs text-muted-foreground">
        Only the ends are labelled. Within 2% scores in full, 15% off scores nothing; within 1% is a bullseye.
      </p>
    </div>
  );
}

function Stage({
  puzzle,
  locked,
  onSubmit,
  onDraftAnswer,
  stateKey = "numline",
}: PuzzleStageProps) {
  const data: NumlinePuzzleData | null = puzzle.type === "numline" ? puzzle : null;
  const framed = Boolean(useContext(GoalLineContext));
  const depth = data !== null && usesNumberDepth(data);
  // The scoring standard: bullseyes (within 1 %) pay 2 each; no streak.
  const standard = data !== null && usesStandard(data);
  const [placements, setPlacements] = useStageState<number[]>(
    stateKey,
    "numlinePlacements",
    () => [],
  );
  const [marker, setMarker] = useStageState<number | null>(stateKey, "numlineMarker", () => null);
  const [dragging, setDragging] = useState<{ x: number; y: number } | null>(null);
  /** Set in the same handler that submits the last placement: the completion sweep's trigger. */
  const [justSolved, setJustSolved] = useState(false);
  const submitted = useRef(false);
  const box = useRef<HTMLDivElement | null>(null);
  const lineBox = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 360, height: 300, left: 0 });
  const reduced = useReducedMotion();
  const sweeping = useSolveFx(justSolved, "numline.solve", 1100);
  useNoTouchScroll(box);

  const encoded = encodeNumline(placements);
  useEffect(() => {
    onDraftAnswer?.(encoded);
  }, [encoded, onDraftAnswer]);
  useBeforePaint(() => {
    const node = box.current;
    if (!node) return;
    const measure = () =>
      setSize({
        width: node.clientWidth,
        height: node.clientHeight,
        left: node.getBoundingClientRect().left,
      });
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    measure();
    return () => ro.disconnect();
  }, []);

  const index = Math.min(placements.length, NUMLINE_TOTAL - 1);
  const stageIndex = Math.floor(index / NUMLINE_ITEMS);
  const finalShares = useMemo(
    () =>
      placements
        .slice(stageIndex * NUMLINE_ITEMS, stageIndex * NUMLINE_ITEMS + NUMLINE_ITEMS)
        .map((p) => p / NUMLINE_SCALE),
    [placements, stageIndex],
  );

  /*
   * The Number overhaul's stage moment (15 Nov 2026, display only): when a line's fifth number is placed (not the last
   * line's), that line stays on screen for LINE_CLEAR_MS, lifting and sliding away with the rising two-note
   * (`numline.stageClear`, NumberStage), and only then does the next line come in. Answers and the clock never wait.
   */
  const [clearing, setClearing] = useState<number | null>(null);
  useEffect(() => {
    if (clearing === null) return;
    const timer = window.setTimeout(() => setClearing(null), LINE_CLEAR_MS);
    return () => window.clearTimeout(timer);
  }, [clearing]);
  /* A touch past an end of the line: a small bump at that edge (the marker still clamps there). */
  const [edge, setEdge] = useState<{ side: "lo" | "hi"; id: number } | null>(null);
  useEffect(() => {
    if (!edge) return;
    const timer = window.setTimeout(() => setEdge(null), EDGE_BUMP_MS);
    return () => window.clearTimeout(timer);
  }, [edge]);

  /* The sweep ticks each of the last line's markers as the glint passes it. */
  useEffect(() => {
    if (!sweeping || reduced) return;
    const timers = finalShares.map((s) =>
      window.setTimeout(() => soundCue("numline.sweepTick"), Math.round(s * SWEEP_MS)),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
    // finalShares is fixed once every number is placed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sweeping, reduced]);

  // Desktop keys: ← → (A/D) set the marker (from the middle) and nudge it 1 % of the line, 0.1 % with Shift;
  // Enter = Place.
  useGameKeys((kind, key, event) => {
    if (!data) return false;
    const dir = horizontalOf(key);
    const used = dir !== null || key === "Enter";
    if (!used || kind !== "down" || busy) return used;
    if (dir !== null) {
      const step = event.shiftKey ? NUMLINE_SCALE / 1000 : NUMLINE_SCALE / 100;
      setMarker(marker === null ? NUMLINE_SCALE / 2 : Math.max(0, Math.min(NUMLINE_SCALE, marker + dir * step)));
    } else if (!event.repeat && marker !== null) place();
    return true;
  });

  if (!data) return null;
  // While a finished line clears, it is the one drawn (with its five markers); nothing takes input meanwhile.
  const shownStage = clearing ?? stageIndex;
  const stage = data.stages[shownStage]!;
  const item = clearing !== null ? (stage.items[NUMLINE_ITEMS - 1] ?? "") : (stage.items[index % NUMLINE_ITEMS] ?? "");
  const busy = locked || submitted.current || placements.length >= NUMLINE_TOTAL || clearing !== null;
  const span = size.width - 2 * SIDE;

  // A touch in layout px from the line box's left edge. Drawn scaled (the intro's demo box shrinks the stage by a
  // transform), the screen box is smaller than the layout width, so the touch is mapped back; unscaled (every real
  // round) the rect matches the layout width and the touch is used exactly as before. Input mapping only, no stamp.
  const localX = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    const left = rect?.left ?? size.left;
    const scaled = rect && rect.width > 0 && Math.abs(rect.width - size.width) > 1;
    return scaled ? ((clientX - left) * size.width) / rect.width : clientX - left;
  };
  const shareAt = (clientX: number) => Math.max(0, Math.min(1, (localX(clientX) - SIDE) / Math.max(1, span)));
  const bumpAt = (clientX: number) => {
    const side = numlineEdgeOf(clientX, clientX - localX(clientX), span);
    if (side && side !== edge?.side) {
      setEdge({ side, id: Date.now() });
      soundCue("numline.edge");
    }
  };
  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (busy) return;
    // Game review fix (15 Nov 2026): only the line takes placement input; a touch on the number card (or anything
    // above the line) never moves the marker.
    if (!numlinePointerAllowed(event.target as Element | null, event.clientY, lineBox.current?.getBoundingClientRect().top ?? null)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setMarker(Math.round(shareAt(event.clientX) * NUMLINE_SCALE));
    bumpAt(event.clientX);
    setDragging({ x: event.clientX, y: event.clientY });
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (busy || !dragging) return;
    const nextShare = shareAt(event.clientX);
    // Stage 2 (the effects kit's rules; the game's own faint tick): a tick each time the marker crosses a tenth.
    if (marker !== null && numlineTenthsCrossed(marker / NUMLINE_SCALE, nextShare) > 0) soundCue("numline.dragTick");
    setMarker(Math.round(nextShare * NUMLINE_SCALE));
    bumpAt(event.clientX);
    setDragging({ x: event.clientX, y: event.clientY });
  };
  const up = () => setDragging(null);
  const place = () => {
    if (busy || marker === null) return;
    const next = [...placements, marker];
    setPlacements(next);
    setMarker(null);
    // Stage 2: the pin stamps in (the kit's drop, silent: the place cue below is the sound), once it is drawn.
    const placedAt = (next.length - 1) % NUMLINE_ITEMS;
    requestAnimationFrame(() =>
      gameFx("drop", lineBox.current?.querySelector(`[data-numline-placed="${placedAt}"]`) ?? null, { silent: true }),
    );
    // Game review fix (15 Nov 2026): one sound a place (was tick + place + the game's cue): the game's own cue once it
    // has a file, else the shared place sound.
    numlinePlaceSound();
    if (next.length < NUMLINE_TOTAL && next.length % NUMLINE_ITEMS === 0) setClearing(stageIndex);
    if (next.length >= NUMLINE_TOTAL) {
      submitted.current = true;
      setJustSolved(true);
      onSubmit(encodeNumline(next));
    }
  };

  const placedHere = placements.slice(
    shownStage * NUMLINE_ITEMS,
    shownStage * NUMLINE_ITEMS + NUMLINE_ITEMS,
  );
  // The overhaul: in a live round the line gets the space (taller box, a thicker rule, bigger end labels); intros
  // and demos keep 140.
  // The layout pass (Joe, 15 Nov 2026): a live round's line is the big element (numlineLiveSizes).
  const live = framed ? numlineLiveSizes(size.height) : null;
  const lineH = live ? live.lineH : 140;
  /* The tape sits low in its box: markers and labels above, end labels just below (the live round's bigger labels
     take more room under it). */
  const lineY = live ? live.yShare : (lineH - 40) / lineH;
  const levels = labelLevels(
    placedHere.map((p) => SIDE + (p / NUMLINE_SCALE) * span),
    stage.items,
  );
  const share = marker === null ? null : marker / NUMLINE_SCALE;
  const lineRect = lineBox.current?.getBoundingClientRect();
  const lensX = (s: number) => LENS / 2 + ZOOM * (s - (share ?? 0)) * span;
  const lensTop = dragging && lineRect ? Math.max(4, lineRect.top + lineH * lineY - LENS - 64) : 0;
  const fxOn = sweeping;

  return (
    <div
      data-play-area
      data-polish="numline"
      data-stage-column="1"
      className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 py-0.5"
      style={ROOT_STYLE}
    >
      <PolishStyle id="numline" css={NUMLINE_CSS} />
      <div
        ref={box}
        data-game-arena="board"
        className="relative flex min-h-0 w-full flex-1 flex-col items-center justify-center pt-3"
        style={NO_SCROLL_STYLE}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <div className="flex w-full flex-col items-center gap-1.5">
          <StageProgress stage={stageIndex} total={NUMLINE_STAGES} />
          <NumberStage type="numline" index={shownStage} exit={clearing !== null ? "clear" : null} className="gap-1.5">
          <p className="h-5 w-full shrink-0 text-center font-mono text-xs uppercase text-muted-foreground">
            {/* Batch W: in a live round the goal line already shows the line ("Stage n of 3"). */}
            {framed ? "" : `Line ${shownStage + 1} of ${NUMLINE_STAGES} · `}
            {framed ? "Number" : "number"} {clearing !== null ? NUMLINE_ITEMS : (index % NUMLINE_ITEMS) + 1} of {NUMLINE_ITEMS}
          </p>
          <div
            className="numline-card flex w-full shrink-0 items-center justify-center rounded-xl border border-border"
            data-numline-item
          >
            <span
              key={`${shownStage}-${clearing !== null ? "done" : index}`}
              className="numline-item-in font-display font-bold text-foreground"
            >
              {item}
            </span>
          </div>
          <div ref={lineBox} key={shownStage} className="numline-line-in relative w-full" data-edge-bump={edge?.side}>
            {/* Puzzle polish (3 Nov 2026, display only): a thicker tape (16 → 24) and larger pins; x mapping unchanged.
                The overhaul: 32 and bold 22 px end labels in a live round. */}
            <Line stage={stage} width={size.width} height={lineH} t={live ? live.t : 24} label={live ? live.label : 18} yShare={lineY} minor={live ? 10 : 0} hidden={numlineHiddenEnd(stage, placedHere.length)}>
              {(x, y, geom) => (
                <>
                  {placedHere.map((p, i) => (
                    <g key={i} data-puzzle-cell={i} data-numline-placed={i} style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}>
                      <Pin
                        cx={x(p / NUMLINE_SCALE)}
                        geom={geom}
                        r={live ? live.placedR : 7.5}
                        rise={(live ? 16 : 12) + levels[i]! * 28}
                        fill={`url(#${geom.id}-placed)`}
                        needle="#c9cbd6"
                      />
                    </g>
                  ))}
                  {/* Labels after every pin, haloed, so a neighbour's needle never hides one. */}
                  {placedHere.map((p, i) => (
                    <text
                      key={i}
                      className="numline-drop"
                      x={x(p / NUMLINE_SCALE)}
                      y={y - geom.t / 2 - 12 - levels[i]! * 28 - 12}
                      textAnchor="middle"
                      fontSize={14}
                      fontWeight={700}
                      fill="var(--jz-text-2)"
                      stroke="var(--background)"
                      strokeWidth={4}
                      strokeLinejoin="round"
                      paintOrder="stroke"
                      fontFamily={ARCHIVO}
                    >
                      {stage.items[i]}
                    </text>
                  ))}
                  {share !== null ? (
                    <g data-numline-marker>
                      <Pin
                        cx={x(share)}
                        geom={geom}
                        r={live ? live.pinR : 14}
                        rise={live ? live.pinRise : 40}
                        fill={`url(#${geom.id}-pin)`}
                        needle="var(--jz-gold)"
                      />
                    </g>
                  ) : busy ? null : (
                    <text
                      x={x(0.5)}
                      y={14}
                      textAnchor="middle"
                      fontSize={14}
                      fill="var(--muted-foreground)"
                    >
                      Touch the line to place a marker
                    </text>
                  )}
                  {fxOn ? (
                    <g pointerEvents="none" data-numline-sweep>
                      {reduced ? null : (
                        <rect
                          className="numline-glint"
                          x={x(0) - 22}
                          y={y - geom.t / 2 - 6}
                          width={44}
                          height={geom.t + 12}
                          rx={6}
                          fill={`url(#${geom.id}-glint)`}
                          style={{ ["--numline-span" as string]: `${x(1) - x(0)}px` }}
                        />
                      )}
                      {finalShares.map((s, i) => {
                        const delay = reduced ? undefined : `${Math.round(s * SWEEP_MS)}ms`;
                        return (
                          <g key={i}>
                            <line
                              className="numline-tick"
                              x1={x(s)}
                              y1={y - geom.t / 2 - 7}
                              x2={x(s)}
                              y2={y + geom.t / 2 + 7}
                              stroke="var(--primary)"
                              strokeWidth={3}
                              strokeLinecap="round"
                              style={{ animationDelay: delay }}
                            />
                            {reduced ? (
                              <circle
                                cx={x(s)}
                                cy={y}
                                r={11}
                                fill="none"
                                stroke="var(--primary)"
                                strokeWidth={2}
                                opacity={0.8}
                              />
                            ) : (
                              <circle
                                className="numline-ring"
                                cx={x(s)}
                                cy={y}
                                r={10}
                                fill="none"
                                stroke="var(--primary)"
                                strokeWidth={2}
                                style={{ animationDelay: delay }}
                              />
                            )}
                          </g>
                        );
                      })}
                    </g>
                  ) : null}
                </>
              )}
            </Line>
            {edge ? (
              <span key={edge.id} aria-hidden="true" data-numline-edge={edge.side} className="numline-edge" style={{ top: Math.round(lineH * lineY) - 22, [edge.side === "lo" ? "left" : "right"]: SIDE - 16 }} />
            ) : null}
          </div>
          </NumberStage>
        </div>
      </div>
      {dragging && share !== null ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 overflow-hidden rounded-full border-2 bg-background shadow-lg"
          style={{ width: LENS, height: LENS, left: dragging.x - LENS / 2, top: lensTop, borderColor: "var(--jz-gold)" }}
        >
          <svg width={LENS} height={LENS} viewBox={`0 0 ${LENS} ${LENS}`}>
            {/* The tape around the marker at four times scale; the needle stays centred. */}
            <rect
              x={lensX(0) - 4}
              y={LENS / 2 - 6}
              width={lensX(1) - lensX(0) + 8}
              height={12}
              fill="#b9bdc7"
            />
            <line
              x1={lensX(0) - 4}
              y1={LENS / 2 - 5}
              x2={lensX(1) + 4}
              y2={LENS / 2 - 5}
              stroke="#ffffff"
              strokeOpacity={0.7}
              strokeWidth={1}
            />
            {numlineTicks(stage).map((t) => (
              <line
                key={t}
                x1={lensX(t)}
                y1={LENS / 2 - 12}
                x2={lensX(t)}
                y2={LENS / 2 + 12}
                stroke="#14151a"
                strokeWidth={2.5}
              />
            ))}
            {placedHere.map((p, i) => (
              <circle
                key={i}
                cx={lensX(p / NUMLINE_SCALE)}
                cy={LENS / 2}
                r={5}
                fill="#6b6e7c"
                stroke="#1a1b21"
                strokeWidth={1}
              />
            ))}
            <line
              x1={LENS / 2}
              y1={LENS / 2 - 22}
              x2={LENS / 2}
              y2={LENS / 2 + 10}
              stroke="var(--jz-gold)"
              strokeWidth={2.5}
            />
          </svg>
        </div>
      ) : null}
      {framed ? (
        <HudPills
          testId="numline"
          items={
            placements.length >= NUMLINE_TOTAL
              ? [{ id: "placed", value: "All placed", tone: "good" }]
              : [
                  { id: "placed", label: "Placed", value: `${placedHere.length} of ${NUMLINE_ITEMS}` },
                  { id: "hint", value: marker === null ? "Touch the line" : depth ? "Drag, then Place" : "Drag to adjust, then Place" },
                  // depthRev 1: the bullseye streak (judged at the reveal; the exact values stay on the server).
                  depth && { id: "bonus", value: standard ? "◎ Bullseyes" : "◎ Streak bonus", tone: "gold" },
                ]
          }
        />
      ) : null}
      {/* Place stands 16 px clear of the bottom of the screen (in a live round the frame's dock gives that 16 px). */}
      <div data-game-controls="actions" className="flex w-full shrink-0 justify-center pb-4">
        <Button
          variant="gold"
          size={48}
          small
          disabled={busy || marker === null}
          onClick={place}
          className="w-full max-w-[280px]"
        >
          Place
        </Button>
      </div>
    </div>
  );
}

const REVEAL_W = 340;
/** The tape's end inset (Line's SIDE) and a reveal number label's width with its gap, in drawing px. */
const REVEAL_SIDE = SIDE;
const REVEAL_LABEL_W = 8;
const REVEAL_H = 128;
/** The rule's height in the reveal's drawing, and where it sits (its centre, as a share of the height). */
const REVEAL_T = 14;
const REVEAL_Y = 0.42;

/** One number on a line, for the reveal (display only; the server grades). */
export interface NumlineRevealRow {
  item: string;
  truth: number;
  placement: number | null;
  error: number | null;
  /** Within the bullseye distance the round's stamp scores (none on stamps without bullseyes). */
  bull: boolean;
  /** Within the full-accuracy distance. */
  close: boolean;
}

/**
 * Each line's numbers and verdict: right when all five are placed within the full-accuracy distance, not reached
 * when none is placed, else not right. Works on every stamp (numlineRev 1–2, before and after the standard).
 */
export function numlineRevealLines(puzzle: NumlinePuzzleData, answer: string | null): { stage: NumlineStageData; rows: NumlineRevealRow[]; mark: BoardMark }[] {
  const results = gradeNumlineItems(puzzle.stages, puzzle.values ?? [], answer, puzzle.numlineRev);
  const standard = usesStandard(puzzle);
  const full = standard ? BALLPARK_STD_FULL : numlineFullError(puzzle.numlineRev);
  const depth = usesNumberDepth(puzzle);
  const placements = decodeNumline(answer);
  return puzzle.stages.map((stage, s) => {
    const rows = stage.items.map((item, i) => {
      const r = results[s * NUMLINE_ITEMS + i]!;
      const placement = placements[s * NUMLINE_ITEMS + i] ?? null;
      return {
        item,
        truth: r.truth,
        placement,
        error: r.error,
        bull: standard ? isStdBullseye(r.error) : depth && isBullseye(r.error),
        close: r.error !== null && r.error <= full,
      };
    });
    const placed = rows.filter((r) => r.placement !== null).length;
    const mark: BoardMark = placed === 0 ? "open" : rows.every((r) => r.close) ? "right" : "wrong";
    return { stage, rows, mark };
  });
}

/** How far off a number was, in plain words. */
export function numlineOffText(row: Pick<NumlineRevealRow, "placement" | "error" | "bull">): string {
  if (row.placement === null) return "Not placed";
  if (row.error === null) return "Placed";
  if (row.bull) return "Bullseye";
  return `${(row.error * 100).toFixed(1)}% off`;
}

/**
 * The reveal (the Number overhaul, 15 Nov 2026): one line at a time with numbered tabs (each marked all close, not
 * all close or not reached), opening on the first not all close; the line drawn large, each true spot a numbered gold
 * tick above the rule and each of your markers a numbered pin below it, joined by a line (gold when close, red when
 * not), bullseyes ringed; under it the five numbers with how far off each was; above, the numbers behind the score.
 */
function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  const lines = puzzle.type === "numline" ? numlineRevealLines(puzzle, myAnswer) : [];
  const marks = lines.map((l) => l.mark);
  const [index, setIndex] = useRevealBoard(marks);
  const drawing = useRef<HTMLDivElement | null>(null);
  const played = useRef<Set<number>>(new Set());
  /*
   * Stage 2's round-end payoff (the effects kit; display only, after the round, never over a live board): the first
   * time a line is shown, each true spot flies in from your marker in the numbers' order (slide), and a bullseye's
   * ring sparkles as it lands (stars, with the game's own bullseye chime).
   */
  useEffect(() => {
    const line = lines[index];
    const root = drawing.current;
    if (!line || !root || played.current.has(index)) return undefined;
    played.current.add(index);
    const timers: number[] = [];
    for (const step of numlinePayoffPlan(line.rows)) {
      const el = root.querySelector(`[data-reveal-true="${step.index}"]`);
      const from = el?.getAttribute("data-from")?.split(",").map(Number);
      if (el && from && from.length === 2) gameFx("slide", el, { from: { x: from[0]!, y: from[1]! }, delayMs: step.delayMs, silent: true, inGame: false });
      if (step.bull) {
        const ring = root.querySelector(`[data-reveal-ring="${step.index}"]`);
        gameFx("stars", ring, { delayMs: step.delayMs + 180, silent: true, inGame: false });
        timers.push(window.setTimeout(() => soundCue("numline.bullseye"), step.delayMs + 180));
      }
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);
  if (puzzle.type !== "numline") return null;
  const all = lines.flatMap((l) => l.rows);
  const placed = all.filter((r) => r.error !== null);
  const avg = placed.length ? placed.reduce((sum, r) => sum + r.error!, 0) / placed.length : null;
  const worst = placed.reduce<NumlineRevealRow | null>((w, r) => (!w || r.error! > w.error! ? r : w), null);
  const bullseyes = usesStandard(puzzle) || usesNumberDepth(puzzle);
  const line = lines[index]!;
  const truthLevels = labelLevels(
    line.rows.map((r) => REVEAL_SIDE + (r.truth / NUMLINE_SCALE) * (REVEAL_W - 2 * REVEAL_SIDE)),
    line.rows.map(() => "0"),
    REVEAL_LABEL_W + 10,
  );
  const pinLevels = labelLevels(
    line.rows.map((r) => REVEAL_SIDE + ((r.placement ?? 0) / NUMLINE_SCALE) * (REVEAL_W - 2 * REVEAL_SIDE)),
    line.rows.map(() => "0"),
    REVEAL_LABEL_W + 10,
  );
  return (
    <div className="nl-reveal flex w-full flex-col items-center gap-3 px-1" data-number-reveal="numline">
      <PolishStyle id="numline" css={NUMLINE_CSS} />
      <RevealFacts
        facts={[
          { label: "Average off", value: avg === null ? "–" : `${(avg * 100).toFixed(1)}%` },
          bullseyes && { label: "Bullseyes", value: <FxCountUp value={all.filter((r) => r.bull).length} /> },
          worst && worst.error !== null && !worst.bull && { label: "Worst miss", value: `${worst.item}, ${(worst.error * 100).toFixed(1)}%`, tone: worst.close ? undefined : "miss" },
        ]}
      />
      <RevealBoards noun="Line" marks={marks} index={index} onIndex={setIndex}>
        <div ref={drawing} className="w-full" key={index}>
        <Line
          stage={line.stage}
          width={REVEAL_W}
          height={REVEAL_H}
          t={REVEAL_T}
          label={18}
          yShare={REVEAL_Y}
          svgStyle={{ width: "100%", maxWidth: 420, height: "auto" }}
        >
          {(x, y) => (
            <>
              {line.rows.map((r, i) => {
                const tx = x(r.truth / NUMLINE_SCALE);
                const ty = y - REVEAL_T / 2 - 18 - truthLevels[i]! * 22;
                const px = r.placement === null ? null : x(r.placement / NUMLINE_SCALE);
                const py = y + REVEAL_T / 2 + 30 + pinLevels[i]! * 22;
                const tone = r.close ? "var(--jz-gold)" : "var(--jz-red)";
                return (
                  <g key={i} data-reveal-pair={i} data-close={r.close ? "" : undefined} data-bull={r.bull ? "" : undefined}>
                    {px !== null ? <line x1={px} y1={py - 9} x2={tx} y2={y} stroke={tone} strokeWidth={2.5} strokeOpacity={0.9} /> : null}
                    <line x1={tx} y1={y - REVEAL_T / 2 - 4} x2={tx} y2={y + REVEAL_T / 2 + 2} stroke="var(--jz-gold)" strokeWidth={3} />
                    {r.bull ? <circle data-reveal-ring={i} cx={tx} cy={y} r={11} fill="none" stroke="var(--jz-gold)" strokeWidth={2.5} style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }} /> : null}
                    {/* The true spot's disc: the payoff flies it in from your marker (data-from, in drawing units). */}
                    <g data-reveal-true={i} data-from={px === null ? undefined : `${px - tx},${py - ty}`}>
                      <circle cx={tx} cy={ty} r={10} fill="var(--jz-gold)" />
                      <text x={tx} y={ty + 4.5} textAnchor="middle" fontSize={13} fontWeight={800} fill="var(--jz-on-gold)" fontFamily="var(--jz-font)">{i + 1}</text>
                    </g>
                    {px !== null ? (
                      <>
                        <circle cx={px} cy={py} r={10} fill="var(--jz-surface-2)" stroke={tone} strokeWidth={2} />
                        <text x={px} y={py + 4.5} textAnchor="middle" fontSize={13} fontWeight={800} fill="var(--jz-text)" fontFamily="var(--jz-font)">{i + 1}</text>
                      </>
                    ) : null}
                  </g>
                );
              })}
            </>
          )}
        </Line>
        </div>
        <p className="nl-reveal-key"><span className="nl-key-true">●</span> true spot <span className="nl-key-yours">●</span> your marker</p>
        <ol className="nl-reveal-rows">
          {line.rows.map((r, i) => (
            <li key={i} data-puzzle-cell={index * NUMLINE_ITEMS + i} data-close={r.close ? "" : undefined} data-placed={r.placement !== null ? "" : undefined} className="nl-reveal-row">
              <span className="nl-reveal-n">{i + 1}</span>
              <span className="nl-reveal-item">{r.item}</span>
              <span className="nl-reveal-off" data-bull={r.bull ? "" : undefined}>{numlineOffText(r)}</span>
            </li>
          ))}
        </ol>
      </RevealBoards>
    </div>
  );
}

export const numlinePuzzle: PuzzleDefinition = {
  key: "numline",
  name: gameDisplayName("numline"),
  category: "number",
  timeLimitMs: NUMLINE_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({
      type: "numline",
      numlineRev: 1,
      stages: [0, 1, 2].map(() => ({ lo: 0, hi: 1, items: ["1/2", "1/4", "3/4", "1/8", "7/8"] })),
    }) satisfies NumlinePuzzleData,
  check: (answer) => decodeNumline(answer).length >= NUMLINE_TOTAL,
  revealHeading: "Your markers and the truth",
  IntroExample,
  Stage,
  Reveal,
};
