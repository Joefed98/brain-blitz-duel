import { useEffect, useMemo, useRef, useState } from "react";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { hapticTick } from "@/components/puzzles/GridDrag";
import {
  decodeStrokeAttempts,
  encodeStrokeAttempts,
  replayStroke,
  replayStrokeAttempt,
  strokeNeighbours,
  type StrokeEdge,
} from "@/lib/duel/stroke";
import { useStageState } from "@/lib/duel/stageState";
import { STROKE_TIME_MS, type StrokeDot, type StrokePuzzleData } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect, playLock, playWrong } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** The figure: edges first, then the dots on top. */
function Figure({
  dots,
  edges,
  traced,
  current,
  dotSize = 28,
  numbers,
}: {
  dots: StrokeDot[];
  edges: StrokeEdge[];
  traced: number[];
  current?: number | null;
  dotSize?: number;
  /** Reveal only: the order the stored route walks each edge. */
  numbers?: Map<number, number>;
}) {
  const done = new Set(traced);
  return (
    <div className="relative h-full w-full">
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        {edges.map(([a, b], index) => {
          const from = dots[a];
          const to = dots[b];
          if (!from || !to) return null;
          const lit = done.has(index);
          return (
            <line
              key={index}
              x1={`${from.x}%`}
              y1={`${from.y}%`}
              x2={`${to.x}%`}
              y2={`${to.y}%`}
              stroke={lit ? GLYPH_COLOURS.GOLD : "var(--color-border)"}
              strokeWidth={6}
              strokeLinecap="round"
              style={lit ? { filter: `drop-shadow(0 0 4px ${GLYPH_COLOURS.GOLD})` } : undefined}
            />
          );
        })}
        {numbers
          ? edges.map(([a, b], index) => {
              const from = dots[a];
              const to = dots[b];
              const order = numbers.get(index);
              if (!from || !to || order === undefined) return null;
              return (
                <text
                  key={`n-${index}`}
                  x={`${(from.x + to.x) / 2}%`}
                  y={`${(from.y + to.y) / 2}%`}
                  fill="var(--color-foreground)"
                  fontSize="11"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {order}
                </text>
              );
            })
          : null}
      </svg>
      {dots.map((dot, index) => (
        <span
          key={index}
          className={`absolute rounded-full border-2 ${
            current === index ? "animate-pulse border-primary bg-primary" : "border-border bg-card"
          }`}
          style={{
            width: dotSize,
            height: dotSize,
            left: `calc(${dot.x}% - ${dotSize / 2}px)`,
            top: `calc(${dot.y}% - ${dotSize / 2}px)`,
          }}
        />
      ))}
    </div>
  );
}

const EXAMPLE_DOTS: StrokeDot[] = [
  { x: 18, y: 24 },
  { x: 82, y: 24 },
  { x: 82, y: 78 },
  { x: 18, y: 78 },
];
const EXAMPLE_EDGES: StrokeEdge[] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [0, 2],
];

/** Fixed intro example — a square with a diagonal, fully traced. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="h-24 w-full max-w-[200px]">
        <Figure
          dots={EXAMPLE_DOTS}
          edges={EXAMPLE_EDGES}
          traced={[0, 1, 2, 3, 4]}
          dotSize={18}
          current={0}
        />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        One stroke: all five lines traced without going over any of them twice.
      </p>
    </div>
  );
}

function Stage({
  puzzle,
  phaseStartedAt,
  now,
  locked,
  onSubmit,
  onDraftAnswer,
  stateKey = "stroke",
}: PuzzleStageProps) {
  const data: StrokePuzzleData | null = puzzle.type === "stroke" ? puzzle : null;
  const [attempts, setAttempts] = useStageState<number[][]>(stateKey, "strokeAttempts", () => []);
  const [path, setPath] = useState<number[]>([]);
  const board = useRef<HTMLDivElement | null>(null);
  const submitted = useRef(false);
  const live = useMemo(() => (data ? replayStrokeAttempt(data.edges, path) : null), [data, path]);

  useEffect(() => {
    onDraftAnswer?.(encodeStrokeAttempts(attempts));
  }, [attempts, onDraftAnswer]);

  useEffect(() => {
    if (!data || locked || submitted.current) return;
    if (now < phaseStartedAt + STROKE_TIME_MS - 400) return;
    submitted.current = true;
    onSubmit(encodeStrokeAttempts(attempts));
  }, [now, phaseStartedAt, locked, data, attempts, onSubmit]);

  if (!data || !live) return null;

  /** The dot under the finger, if any — measured against the real dot circles. */
  const dotAt = (clientX: number, clientY: number): number | null => {
    const box = board.current?.getBoundingClientRect();
    if (!box) return null;
    const x = ((clientX - box.left) / box.width) * 100;
    const y = ((clientY - box.top) / box.height) * 100;
    let best: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    data.dots.forEach((dot, index) => {
      const dx = ((dot.x - x) / 100) * box.width;
      const dy = ((dot.y - y) / 100) * box.height;
      const distance = Math.hypot(dx, dy);
      if (distance < 26 && distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    return best;
  };

  const finish = (walked: number[]) => {
    if (walked.length < 2) {
      setPath([]);
      return;
    }
    const replay = replayStrokeAttempt(data.edges, walked);
    const next = [...attempts, walked];
    setAttempts(next);
    setPath([]);
    if (replay.complete) {
      submitted.current = true;
      playLock();
      onSubmit(encodeStrokeAttempts(next));
      return;
    }
    playWrong();
  };

  const extend = (dot: number) => {
    const at = path[path.length - 1];
    if (at === undefined) {
      setPath([dot]);
      hapticTick();
      return;
    }
    if (dot === at) return;
    const used = new Set(live.traced);
    const step = strokeNeighbours(data.edges, at).find(
      ({ to, edge }) => to === dot && !used.has(edge),
    );
    if (!step) {
      buzz(20);
      return;
    }
    hapticTick();
    playCorrect();
    setPath([...path, dot]);
  };

  const active = !locked && !submitted.current;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="shrink-0 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        lines{" "}
        <span className="text-primary">
          {live.traced.length} / {data.edges.length}
        </span>
        {attempts.length > 0 ? ` · try ${attempts.length + 1}` : ""}
      </p>
      <div
        ref={board}
        className="relative min-h-0 w-full flex-1 touch-none"
        aria-label="One-Stroke figure"
        onPointerDown={(event) => {
          if (!active) return;
          event.preventDefault();
          const dot = dotAt(event.clientX, event.clientY);
          if (dot !== null) setPath([dot]);
        }}
        onPointerMove={(event) => {
          if (!active || path.length === 0) return;
          const dot = dotAt(event.clientX, event.clientY);
          if (dot !== null) extend(dot);
        }}
        onPointerUp={() => {
          if (!active || path.length === 0) return;
          finish(path);
        }}
        onPointerCancel={() => setPath([])}
      >
        <Figure
          dots={data.dots}
          edges={data.edges}
          traced={live.traced}
          current={path[path.length - 1] ?? null}
        />
      </div>
      <p className="shrink-0 text-center text-xs text-muted-foreground">
        Lift your finger to start again.
      </p>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "stroke") return null;
  const replay = replayStroke(puzzle.edges, decodeStrokeAttempts(myAnswer ?? ""));
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((timeLimitMs - myMsRemaining) / 100) / 10;
  // Number the edges along one valid route so the figure reads as a single line.
  const numbers = new Map<number, number>();
  const route = puzzle.solution ?? [];
  const walked = replayStrokeAttempt(puzzle.edges, route);
  walked.traced.forEach((edge, index) => numbers.set(edge, index + 1));
  const ordinal =
    replay.solvedOn === 1 ? "1st" : replay.solvedOn === 2 ? "2nd" : `${replay.solvedOn}th`;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <div className="h-[min(45vh,280px)] w-full max-w-[300px]">
        <Figure
          dots={puzzle.dots}
          edges={puzzle.edges}
          traced={puzzle.edges.map((_edge, index) => index)}
          dotSize={22}
          numbers={numbers}
        />
      </div>
      <p
        className={`whitespace-normal break-words text-center font-mono text-base font-bold ${myCorrect ? "text-primary" : "text-foreground"}`}
      >
        {replay.solved
          ? `Solved · ${ordinal} try${elapsed !== null ? ` · ${elapsed.toFixed(1)}s` : ""}`
          : `${replay.best} / ${puzzle.edges.length} lines`}
      </p>
    </div>
  );
}

/** The figure is public; one complete route stays in the secrets row. */
export const oneStrokePuzzle: PuzzleDefinition = {
  key: "stroke",
  name: "One-Stroke",
  category: "logic",
  timeLimitMs: STROKE_TIME_MS,
  revealMs: 8_000,
  generate: () => ({ type: "stroke", dots: [], edges: [] }) satisfies StrokePuzzleData,
  check: () => false,
  revealHeading: "One way through",
  IntroExample,
  Stage,
  Reveal,
};
