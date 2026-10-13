import { gameDisplayName } from "@/lib/duel/gameNames";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import { hapticTick } from "@/components/puzzles/GridDrag";
import { NO_SCROLL_STYLE, useNoTouchScroll } from "@/components/puzzles/noScroll";
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
import { buzz } from "@/lib/motion";
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

/** A horizontal line with its labelled ticks; children draw markers in 0–1 shares via `x`. */
function Line({
  stage,
  width,
  height,
  children,
}: {
  stage: Pick<NumlineStageData, "lo" | "hi">;
  width: number;
  height: number;
  children?: (x: (share: number) => number, y: number) => ReactNode;
}) {
  const y = Math.round(height * 0.55);
  const x = (share: number) => SIDE + share * (width - 2 * SIDE);
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", overflow: "visible" }}
    >
      <line
        x1={x(0)}
        y1={y}
        x2={x(1)}
        y2={y}
        stroke="var(--foreground)"
        strokeWidth={3}
        strokeLinecap="round"
      />
      {tickLabels(stage).map((tick) => (
        <g key={tick.share}>
          <line
            x1={x(tick.share)}
            y1={y - 9}
            x2={x(tick.share)}
            y2={y + 9}
            stroke="var(--foreground)"
            strokeWidth={2.5}
          />
          <text
            x={x(tick.share)}
            y={y + 24}
            textAnchor="middle"
            fontSize={14}
            fontWeight={700}
            fill="var(--muted-foreground)"
            fontFamily="'JetBrains Mono', ui-monospace, monospace"
          >
            {tick.label}
          </text>
        </g>
      ))}
      {children?.(x, y)}
    </svg>
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
      <Line stage={{ lo: 0, hi: 1 }} width={250} height={64}>
        {(x, y) => (
          <>
            <line
              x1={x(share)}
              y1={y - 22}
              x2={x(share)}
              y2={y + 6}
              stroke="var(--primary)"
              strokeWidth={3}
              style={{ transition: "all 600ms ease-in-out" }}
            />
            <circle
              cx={x(share)}
              cy={y - 24}
              r={6}
              fill="var(--primary)"
              style={{ transition: "all 600ms ease-in-out" }}
            />
            {step === 3 ? (
              <line
                x1={x(0.375)}
                y1={y - 8}
                x2={x(0.375)}
                y2={y + 8}
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
  const submitted = useRef(false);
  const box = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 360, height: 300, left: 0 });
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

  if (!data) return null;
  const index = Math.min(placements.length, NUMLINE_TOTAL - 1);
  const stageIndex = Math.floor(index / NUMLINE_ITEMS);
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
    if (next.length >= NUMLINE_TOTAL) {
      submitted.current = true;
      onSubmit(encodeNumline(next));
    }
  };

  const placedHere = placements.slice(
    stageIndex * NUMLINE_ITEMS,
    stageIndex * NUMLINE_ITEMS + NUMLINE_ITEMS,
  );
  const lineH = Math.max(120, Math.min(size.height, 220));
  const share = marker === null ? null : marker / NUMLINE_SCALE;
  const rect = box.current?.getBoundingClientRect();
  const lensX = (s: number) => LENS / 2 + ZOOM * (s - (share ?? 0)) * span;
  const lensTop = dragging && rect ? Math.max(4, rect.top + lineH * 0.55 - LENS - 46) : 0;

  return (
    <div
      data-play-area
      data-stage-column="1"
      className="flex min-h-0 w-full flex-1 flex-col items-center gap-1 py-0.5"
      style={ROOT_STYLE}
    >
      <StageProgress stage={stageIndex} total={NUMLINE_STAGES} />
      <p className="h-5 w-full shrink-0 text-center font-mono text-xs uppercase text-muted-foreground">
        Line {stageIndex + 1} of {NUMLINE_STAGES} · number {(index % NUMLINE_ITEMS) + 1} of{" "}
        {NUMLINE_ITEMS}
      </p>
      <div
        className="flex h-16 w-full shrink-0 items-center justify-center rounded-xl border border-border bg-card"
        data-numline-item
      >
        <span className="font-display text-3xl font-bold text-foreground">{item}</span>
      </div>
      <div
        ref={box}
        data-game-arena="board"
        className="relative flex min-h-0 w-full flex-1 items-center"
        style={NO_SCROLL_STYLE}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <Line stage={stage} width={size.width} height={lineH}>
          {(x, y) => (
            <>
              {placedHere.map((p, i) => (
                <g key={i} data-puzzle-cell={i}>
                  <circle cx={x(p / NUMLINE_SCALE)} cy={y} r={5} fill="var(--muted-foreground)" />
                  <text
                    x={x(p / NUMLINE_SCALE)}
                    y={y - 12 - (i % 2) * 13}
                    textAnchor="middle"
                    fontSize={11}
                    fill="var(--muted-foreground)"
                    fontFamily="'JetBrains Mono', ui-monospace, monospace"
                  >
                    {stage.items[i]}
                  </text>
                </g>
              ))}
              {share !== null ? (
                <g data-numline-marker>
                  <line
                    x1={x(share)}
                    y1={y - 34}
                    x2={x(share)}
                    y2={y + 8}
                    stroke="var(--primary)"
                    strokeWidth={3}
                  />
                  <circle cx={x(share)} cy={y - 38} r={9} fill="var(--primary)" />
                </g>
              ) : (
                <text
                  x={x(0.5)}
                  y={y - 40}
                  textAnchor="middle"
                  fontSize={13}
                  fill="var(--muted-foreground)"
                >
                  Touch the line to place a marker
                </text>
              )}
            </>
          )}
        </Line>
      </div>
      {dragging && share !== null ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 overflow-hidden rounded-full border-2 border-primary bg-background shadow-lg"
          style={{ width: LENS, height: LENS, left: dragging.x - LENS / 2, top: lensTop }}
        >
          <svg width={LENS} height={LENS} viewBox={`0 0 ${LENS} ${LENS}`}>
            {/* The line around the marker at four times scale; the needle stays centred. */}
            <line
              x1={lensX(0)}
              y1={LENS / 2}
              x2={lensX(1)}
              y2={LENS / 2}
              stroke="var(--foreground)"
              strokeWidth={3}
            />
            {numlineTicks(stage).map((t) => (
              <line
                key={t}
                x1={lensX(t)}
                y1={LENS / 2 - 12}
                x2={lensX(t)}
                y2={LENS / 2 + 12}
                stroke="var(--foreground)"
                strokeWidth={2.5}
              />
            ))}
            {placedHere.map((p, i) => (
              <circle
                key={i}
                cx={lensX(p / NUMLINE_SCALE)}
                cy={LENS / 2}
                r={5}
                fill="var(--muted-foreground)"
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

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "numline") return null;
  const results = gradeNumlineItems(puzzle.stages, puzzle.values ?? [], myAnswer);
  const placed = decodeNumline(myAnswer).length;
  return (
    <div className="flex w-full flex-col items-stretch gap-1 px-1">
      {puzzle.stages.map((stage, s) => {
        const rows = results.slice(s * NUMLINE_ITEMS, s * NUMLINE_ITEMS + NUMLINE_ITEMS);
        return (
          <div key={s} className="flex flex-col items-center">
            <Line stage={stage} width={330} height={50}>
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
                          strokeWidth={3}
                          strokeOpacity={0.6}
                        />
                      ) : null}
                      <line
                        x1={x(r.truth / NUMLINE_SCALE)}
                        y1={y - 10}
                        x2={x(r.truth / NUMLINE_SCALE)}
                        y2={y + 10}
                        stroke="var(--ok, #3DDC84)"
                        strokeWidth={2.5}
                      />
                      {r.placement !== null ? (
                        <circle
                          cx={x(r.placement / NUMLINE_SCALE)}
                          cy={y}
                          r={4.5}
                          fill="var(--primary)"
                        />
                      ) : null}
                      <text
                        x={x(r.truth / NUMLINE_SCALE)}
                        y={y - 14}
                        textAnchor="middle"
                        fontSize={9}
                        fill="var(--muted-foreground)"
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
                  className="flex flex-col items-center rounded-md border border-border px-0.5 py-0.5 font-mono leading-tight"
                >
                  <span className="max-w-full break-words text-center text-[9px] leading-tight text-foreground">
                    {i + 1}. {stage.items[i]}
                  </span>
                  <span
                    className={`text-[11px] ${r.error === null ? "text-muted-foreground" : r.error <= NUMLINE_FULL_ERROR ? "font-bold text-primary" : "text-warn"}`}
                  >
                    {numlineErrorLabel(r.error)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <p className="text-center font-mono text-xs text-muted-foreground">
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
