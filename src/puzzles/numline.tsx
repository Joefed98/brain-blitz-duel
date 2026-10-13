import { gameDisplayName } from "@/lib/duel/gameNames";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { hapticTick } from "@/components/puzzles/GridDrag";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";
import { PolishStyle, soundCue, useSolveFx } from "@/components/puzzles/numberPolish";
import { StageProgress } from "@/components/puzzles/StageProgress";
import { fx } from "@/lib/fx";
import {
  decodeNumline,
  encodeNumline,
  gradeNumlineItems,
  numlineErrorLabel,
  numlineTicks,
  NUMLINE_FULL_ERROR,
  NUMLINE_ITEMS,
  NUMLINE_SCALE,
  NUMLINE_STAGES,
  NUMLINE_TOTAL,
} from "@/lib/duel/numline";
import { useStageState } from "@/lib/duel/stageState";
import { NUMLINE_TIME_MS, type NumlinePuzzleData, type NumlineStageData } from "@/lib/duel/types";
import { buzz, useReducedMotion } from "@/lib/motion";
import { playTick } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

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
const MONO = "'JetBrains Mono', ui-monospace, monospace";
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
@media (prefers-reduced-motion: reduce) {
  .numline-line-in, .numline-item-in, .numline-drop, .numline-tick, .numline-ring { animation: none; }
  .numline-glint { display: none; }
}
`;

const fmt = (n: number) =>
  Math.abs(n) >= 1000 ? n.toLocaleString("en-GB") : n < 0 ? `−${-n}` : String(n);

/** End labels, plus 0 when it sits inside the line. */
function tickLabels(
  stage: Pick<NumlineStageData, "lo" | "hi">,
): { share: number; label: string }[] {
  const ticks = numlineTicks(stage);
  return ticks
    .map((share) => ({ share, label: fmt(Math.round(stage.lo + share * (stage.hi - stage.lo))) }))
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
function labelLevels(xs: readonly number[], items: readonly string[]): number[] {
  const order = xs.map((_, i) => i).sort((a, b) => xs[a]! - xs[b]!);
  const ends: number[] = [-Infinity, -Infinity, -Infinity];
  const out: number[] = xs.map(() => 0);
  for (const i of order) {
    const half = ((items[i] ?? "").length * 7.2) / 2 + 3;
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
function Line({
  stage,
  width,
  height,
  t = 14,
  label = 16,
  yShare = 0.55,
  svgStyle,
  children,
}: {
  stage: Pick<NumlineStageData, "lo" | "hi">;
  width: number;
  height: number;
  t?: number;
  label?: number;
  yShare?: number;
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
      {/* Drop shadow, body, sheen and edges of the tape. */}
      <rect
        x={left + 1}
        y={y - t / 2 + 3}
        width={right - left}
        height={t}
        rx={t / 3}
        fill="#000"
        opacity={0.4}
      />
      <rect
        x={left}
        y={y - t / 2}
        width={right - left}
        height={t}
        rx={t / 3}
        fill={`url(#${id}-steel)`}
      />
      <rect
        x={left}
        y={y - t / 2}
        width={right - left}
        height={t}
        rx={t / 3}
        fill={`url(#${id}-sheen)`}
      />
      <line
        x1={left + 3}
        y1={y - t / 2 + 1}
        x2={right - 3}
        y2={y - t / 2 + 1}
        stroke="#ffffff"
        strokeOpacity={0.75}
        strokeWidth={1}
      />
      <line
        x1={left + 3}
        y1={y + t / 2 - 0.5}
        x2={right - 3}
        y2={y + t / 2 - 0.5}
        stroke="#30323b"
        strokeOpacity={0.7}
        strokeWidth={1}
      />
      {tickLabels(stage).map((tick) => (
        <g key={tick.share}>
          {/* A crisp notch across the tape, continued below it to the label. */}
          <line
            x1={x(tick.share)}
            y1={y - t / 2 - 3}
            x2={x(tick.share)}
            y2={y + t / 2 + 6}
            stroke="#14151a"
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
            x={labelX(x(tick.share), tick.label.length * label * 0.6, width)}
            y={y + t / 2 + 8 + label}
            textAnchor="middle"
            fontSize={label}
            fontWeight={700}
            fill="var(--foreground)"
            fontFamily={MONO}
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
function Pin({
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
      <circle cx={cx + 1.5} cy={head + 2.5} r={r} fill="#000" opacity={0.35} />
      <circle cx={cx} cy={head} r={r} fill={fill} stroke="#1a1b21" strokeWidth={1.5} />
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
        {step === 3 ? "Placed: 0.5% off → 8 points" : "Drag, then Place"}
      </p>
      <p className="max-w-[270px] text-center text-xs text-muted-foreground">
        Only the ends are labelled. Within 2% of the line scores all 8; 8% off scores 0.
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
  useEffect(() => {
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

  /* A new line slides in: one cue per line after the first. */
  const lastStage = useRef(stageIndex);
  useEffect(() => {
    if (stageIndex > lastStage.current) soundCue("numline.line");
    lastStage.current = stageIndex;
  }, [stageIndex]);

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

  if (!data) return null;
  const stage = data.stages[stageIndex]!;
  const item = stage.items[index % NUMLINE_ITEMS] ?? "";
  const busy = locked || submitted.current || placements.length >= NUMLINE_TOTAL;
  const span = size.width - 2 * SIDE;

  const shareAt = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    const left = rect?.left ?? size.left;
    return Math.max(0, Math.min(1, (clientX - left - SIDE) / Math.max(1, span)));
  };
  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (busy) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setMarker(Math.round(shareAt(event.clientX) * NUMLINE_SCALE));
    setDragging({ x: event.clientX, y: event.clientY });
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (busy || !dragging) return;
    setMarker(Math.round(shareAt(event.clientX) * NUMLINE_SCALE));
    setDragging({ x: event.clientX, y: event.clientY });
  };
  const up = () => setDragging(null);
  const place = () => {
    if (busy || marker === null) return;
    const next = [...placements, marker];
    setPlacements(next);
    setMarker(null);
    hapticTick();
    buzz(10);
    playTick();
    fx.onPlace();
    soundCue("numline.place");
    if (next.length >= NUMLINE_TOTAL) {
      submitted.current = true;
      setJustSolved(true);
      onSubmit(encodeNumline(next));
    }
  };

  const placedHere = placements.slice(
    stageIndex * NUMLINE_ITEMS,
    stageIndex * NUMLINE_ITEMS + NUMLINE_ITEMS,
  );
  const lineH = 140;
  /* The tape sits low in its box: markers and labels above, end labels just below. */
  const lineY = (lineH - 40) / lineH;
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
          <p className="h-5 w-full shrink-0 text-center font-mono text-xs uppercase text-muted-foreground">
            Line {stageIndex + 1} of {NUMLINE_STAGES} · number {(index % NUMLINE_ITEMS) + 1} of{" "}
            {NUMLINE_ITEMS}
          </p>
          <div
            className="numline-card flex w-full shrink-0 items-center justify-center rounded-xl border border-border"
            data-numline-item
          >
            <span
              key={`${stageIndex}-${index}`}
              className="numline-item-in font-display font-bold text-foreground"
            >
              {item}
            </span>
          </div>
          <div ref={lineBox} key={stageIndex} className="numline-line-in w-full">
            <Line stage={stage} width={size.width} height={lineH} t={16} label={17} yShare={lineY}>
              {(x, y, geom) => (
                <>
                  {placedHere.map((p, i) => (
                    <g key={i} data-puzzle-cell={i} className="numline-drop">
                      <Pin
                        cx={x(p / NUMLINE_SCALE)}
                        geom={geom}
                        r={5.5}
                        rise={12 + levels[i]! * 24}
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
                      y={y - geom.t / 2 - 12 - levels[i]! * 24 - 10}
                      textAnchor="middle"
                      fontSize={12}
                      fontWeight={600}
                      fill="var(--muted-foreground)"
                      stroke="var(--background)"
                      strokeWidth={4}
                      strokeLinejoin="round"
                      paintOrder="stroke"
                      fontFamily={MONO}
                    >
                      {stage.items[i]}
                    </text>
                  ))}
                  {share !== null ? (
                    <g data-numline-marker>
                      <Pin
                        cx={x(share)}
                        geom={geom}
                        r={11}
                        rise={38}
                        fill={`url(#${geom.id}-pin)`}
                        needle="var(--primary)"
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
          </div>
        </div>
      </div>
      {dragging && share !== null ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 overflow-hidden rounded-full border-2 border-primary bg-background shadow-lg"
          style={{ width: LENS, height: LENS, left: dragging.x - LENS / 2, top: lensTop }}
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
              stroke="var(--primary)"
              strokeWidth={2.5}
            />
          </svg>
        </div>
      ) : null}
      <div data-game-controls="actions" className="flex w-full shrink-0 justify-center">
        <button
          type="button"
          disabled={busy || marker === null}
          onClick={place}
          className="h-12 w-full max-w-[280px] rounded-xl border border-primary bg-primary font-mono text-sm font-bold uppercase tracking-widest text-primary-foreground disabled:opacity-40"
        >
          Place
        </button>
      </div>
    </div>
  );
}

const REVEAL_W = 340;

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "numline") return null;
  const results = gradeNumlineItems(puzzle.stages, puzzle.values ?? [], myAnswer);
  const placed = decodeNumline(myAnswer).length;
  return (
    <div className="flex w-full flex-col items-stretch gap-1.5 px-1">
      <PolishStyle id="numline" css={NUMLINE_CSS} />
      {puzzle.stages.map((stage, s) => {
        const rows = results.slice(s * NUMLINE_ITEMS, s * NUMLINE_ITEMS + NUMLINE_ITEMS);
        return (
          <div key={s} className="flex flex-col items-center gap-0.5">
            <Line
              stage={stage}
              width={REVEAL_W}
              height={56}
              t={10}
              label={12}
              yShare={0.46}
              svgStyle={{ width: "100%", maxWidth: 400, height: "auto" }}
            >
              {(x, y) => (
                <>
                  {rows.map((r, i) => (
                    <g key={i}>
                      {r.placement !== null ? (
                        <line
                          x1={x(r.placement / NUMLINE_SCALE)}
                          y1={y}
                          x2={x(r.truth / NUMLINE_SCALE)}
                          y2={y}
                          stroke="var(--warn)"
                          strokeWidth={4}
                          strokeOpacity={0.85}
                        />
                      ) : null}
                      <line
                        x1={x(r.truth / NUMLINE_SCALE)}
                        y1={y - 9}
                        x2={x(r.truth / NUMLINE_SCALE)}
                        y2={y + 9}
                        stroke="var(--ok, #3DDC84)"
                        strokeWidth={3}
                      />
                      {r.placement !== null ? (
                        <circle
                          cx={x(r.placement / NUMLINE_SCALE)}
                          cy={y}
                          r={5}
                          fill="var(--primary)"
                          stroke="#1a1b21"
                          strokeWidth={1.25}
                        />
                      ) : null}
                      <text
                        x={x(r.truth / NUMLINE_SCALE)}
                        y={y - 12}
                        textAnchor="middle"
                        fontSize={12}
                        fontWeight={700}
                        fill="var(--foreground)"
                        fontFamily={MONO}
                      >
                        {i + 1}
                      </text>
                    </g>
                  ))}
                </>
              )}
            </Line>
            <div className="grid w-full grid-cols-5 gap-1">
              {rows.map((r, i) => (
                <div
                  key={i}
                  data-puzzle-cell={s * NUMLINE_ITEMS + i}
                  className="flex flex-col items-center justify-between rounded-md border border-border bg-card px-0.5 py-0.5 leading-tight"
                >
                  <span className="max-w-full break-words text-center text-[12px] leading-tight text-foreground">
                    {`${i + 1}. ${stage.items[i]}`}
                  </span>
                  <span
                    className={`font-mono text-[14px] font-bold ${r.error === null ? "text-muted-foreground" : r.error <= NUMLINE_FULL_ERROR ? "text-primary" : "text-warn"}`}
                    style={
                      r.error !== null && r.error > NUMLINE_FULL_ERROR
                        ? { color: "color-mix(in oklab, var(--warn) 80%, white)" }
                        : undefined
                    }
                  >
                    {numlineErrorLabel(r.error)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <p className="text-center font-mono text-[13px] text-muted-foreground">
        {placed} / {NUMLINE_TOTAL} placed · tick = true spot, dot = yours
      </p>
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
