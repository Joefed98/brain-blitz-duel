import { useEffect, useMemo, useRef, useState } from "react";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { hapticTick } from "@/components/puzzles/GridDrag";
import { Button } from "@/components/ui/button";
import {
  alignedSpokes,
  decodeRingTaps,
  encodeRingTap,
  encodeRingTaps,
  freshOffsets,
  replayRings,
  ringColour,
} from "@/lib/duel/rings";
import { useStageState } from "@/lib/duel/stageState";
import {
  RINGS_COLOURS,
  RINGS_COUNT,
  RINGS_SEGMENTS,
  RINGS_TIME_MS,
  RINGS_TURN_MS,
  type RingsPuzzleData,
  type StroopColour,
} from "@/lib/duel/types";
import { playCorrect, playLock } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const RING_PALETTE: StroopColour[] = ["RED", "BLUE", "GREEN", "ORANGE"];

function colourOf(index: number): string {
  return GLYPH_COLOURS[RING_PALETTE[((index % RINGS_COLOURS) + RINGS_COLOURS) % RINGS_COLOURS]!];
}

/** Radii, from the outer rim inwards, as a share of the board. */
const RADII = [0.98, 0.78, 0.58, 0.38];
const INNER_HOLE = 0.15;

function arc(cx: number, cy: number, outer: number, inner: number, from: number, to: number) {
  const point = (radius: number, angle: number) => [
    cx + radius * Math.cos(angle),
    cy + radius * Math.sin(angle),
  ];
  const [x1, y1] = point(outer, from);
  const [x2, y2] = point(outer, to);
  const [x3, y3] = point(inner, to);
  const [x4, y4] = point(inner, from);
  return `M ${x1} ${y1} A ${outer} ${outer} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 0 0 ${x4} ${y4} Z`;
}

function Rings({
  segments,
  offsets,
  size,
  selectedRing,
  onSelect,
}: {
  segments: number[][];
  offsets: number[];
  size: number;
  selectedRing?: number | undefined;
  onSelect?: ((ring: number) => void) | undefined;
}) {
  const centre = size / 2;
  const half = size / 2;
  const aligned = new Set(alignedSpokes(segments, offsets));
  const step = (Math.PI * 2) / RINGS_SEGMENTS;
  // Ring 0 is the innermost ring, drawn with the smallest radius.
  const radiusOf = (ring: number) => half * RADII[RINGS_COUNT - 1 - ring]!;
  const innerOf = (ring: number) =>
    ring === 0 ? half * INNER_HOLE : half * RADII[RINGS_COUNT - ring]! + 4;

  return (
    <svg
      width={size}
      height={size}
      className="shrink-0 touch-none"
      aria-label="Rotating Rings board"
      onPointerDown={(event) => {
        if (!onSelect) return;
        event.preventDefault();
        const box = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - box.left - centre;
        const y = event.clientY - box.top - centre;
        const distance = Math.hypot(x, y);
        let ring: number | null = null;
        for (let candidate = 0; candidate < RINGS_COUNT; candidate += 1) {
          if (distance <= radiusOf(candidate) && distance >= innerOf(candidate)) ring = candidate;
        }
        if (ring === null) return;
        onSelect(ring);
      }}
    >
      {Array.from({ length: RINGS_COUNT }, (_v, ring) =>
        Array.from({ length: RINGS_SEGMENTS }, (_s, spoke) => (
          <path
            key={`${ring}-${spoke}`}
            d={arc(
              centre,
              centre,
              radiusOf(ring) - 2,
              innerOf(ring) + 2,
              spoke * step - Math.PI / 2 + 0.05,
              (spoke + 1) * step - Math.PI / 2 - 0.05,
            )}
            fill={colourOf(ringColour(segments, offsets, ring, spoke))}
            style={{ transition: `fill ${RINGS_TURN_MS}ms linear` }}
          />
        )),
      )}
      {Array.from({ length: RINGS_SEGMENTS }, (_v, spoke) => {
        const angle = (spoke + 0.5) * step - Math.PI / 2;
        const rim = half * RADII[0]!;
        return (
          <g key={`spoke-${spoke}`}>
            <line
              x1={centre + half * INNER_HOLE * Math.cos(angle)}
              y1={centre + half * INNER_HOLE * Math.sin(angle)}
              x2={centre + rim * Math.cos(angle)}
              y2={centre + rim * Math.sin(angle)}
              stroke="var(--color-background)"
              strokeOpacity={0.35}
              strokeWidth={1.5}
            />
            {aligned.has(spoke) ? (
              <circle
                cx={centre + (rim + 5) * Math.cos(angle)}
                cy={centre + (rim + 5) * Math.sin(angle)}
                r={3.2}
                fill={GLYPH_COLOURS.GOLD}
              />
            ) : null}
          </g>
        );
      })}
      {selectedRing === undefined ? null : (
        <g pointerEvents="none">
          <circle
            cx={centre}
            cy={centre}
            r={radiusOf(selectedRing) - 1}
            fill="none"
            stroke={GLYPH_COLOURS.GOLD}
            strokeWidth={3}
          />
          <circle
            cx={centre}
            cy={centre}
            r={innerOf(selectedRing) + 1}
            fill="none"
            stroke={GLYPH_COLOURS.GOLD}
            strokeWidth={3}
          />
        </g>
      )}
      {[1, 2].map((ring) => {
        const y = centre - (radiusOf(ring) + innerOf(ring)) / 2;
        return (
          <g key={`link-${ring}`} pointerEvents="none">
            <ellipse
              cx={centre - 4}
              cy={y}
              rx={5}
              ry={3.5}
              fill="var(--color-card)"
              stroke={GLYPH_COLOURS.GOLD}
              strokeWidth={1.5}
            />
            <ellipse
              cx={centre + 4}
              cy={y}
              rx={5}
              ry={3.5}
              fill="var(--color-card)"
              stroke={GLYPH_COLOURS.GOLD}
              strokeWidth={1.5}
            />
          </g>
        );
      })}
      <circle cx={centre} cy={centre} r={half * INNER_HOLE} fill="var(--color-card)" />
    </svg>
  );
}

const EXAMPLE_SEGMENTS = [
  [0, 1, 2, 3, 0, 1, 2, 3],
  [1, 2, 3, 0, 1, 2, 3, 0],
  [1, 2, 3, 0, 1, 2, 3, 0],
  [1, 2, 3, 0, 1, 2, 3, 0],
];

/** Fixed intro example — one turn brings the rings into line. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex items-center gap-3">
        <Rings segments={EXAMPLE_SEGMENTS} offsets={[0, 0, 0, 0]} size={82} />
        <span className="font-mono text-xs text-muted-foreground">→</span>
        <Rings segments={EXAMPLE_SEGMENTS} offsets={[1, 0, 0, 0]} size={82} />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        One turn of the inner ring and every spoke is a single colour.
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
  stateKey = "rings",
}: PuzzleStageProps) {
  const data: RingsPuzzleData | null = puzzle.type === "rings" ? puzzle : null;
  const [taps, setTaps] = useStageState<number[]>(stateKey, "ringTaps", () => []);
  const [selectedRing, setSelectedRing] = useState(0);
  const submitted = useRef(false);
  const replay = useMemo(() => (data ? replayRings(data.segments, taps) : null), [data, taps]);

  useEffect(() => {
    onDraftAnswer?.(encodeRingTaps(taps));
  }, [taps, onDraftAnswer]);

  useEffect(() => {
    if (!data || locked || submitted.current) return;
    if (now < phaseStartedAt + RINGS_TIME_MS - 400) return;
    submitted.current = true;
    onSubmit(encodeRingTaps(taps));
  }, [now, phaseStartedAt, locked, data, taps, onSubmit]);

  if (!data || !replay) return null;

  const turn = (ring: number, clockwise: boolean) => {
    if (locked || submitted.current || replay.solved) return;
    hapticTick();
    const next = [...taps, encodeRingTap(ring, clockwise)];
    setTaps(next);
    const after = replayRings(data.segments, next);
    if (after.solved) {
      submitted.current = true;
      playLock();
      onSubmit(encodeRingTaps(next));
      return;
    }
    playCorrect();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
      {/* Sized to leave the timer, counters and hint clear at 375 × 667. */}
      <Rings
        segments={data.segments}
        offsets={replay.offsets}
        size={248}
        selectedRing={selectedRing}
        onSelect={setSelectedRing}
      />
      <p className="shrink-0 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        turns <span className="text-primary">{replay.moves}</span> · spokes{" "}
        <span className="text-primary">
          {replay.aligned} / {RINGS_SEGMENTS}
        </span>
      </p>
      <div className="grid w-full max-w-64 shrink-0 grid-cols-2 gap-3">
        <Button
          type="button"
          variant="outline"
          aria-label="Rotate selected ring anticlockwise"
          className="h-14 text-3xl"
          onClick={() => turn(selectedRing, false)}
        >
          ↺
        </Button>
        <Button
          type="button"
          variant="outline"
          aria-label="Rotate selected ring clockwise"
          className="h-14 text-3xl"
          onClick={() => turn(selectedRing, true)}
        >
          ↻
        </Button>
      </div>
      <p className="shrink-0 text-center text-xs text-muted-foreground">
        Select a ring, then turn it with the arrows.
      </p>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "rings") return null;
  const replay = replayRings(puzzle.segments, decodeRingTaps(myAnswer ?? ""));
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((RINGS_TIME_MS - myMsRemaining) / 100) / 10;
  const min = puzzle.minMoves ?? 0;
  const solvedOffsets = replay.solved
    ? replay.offsets
    : replayRings(puzzle.segments, puzzle.solution ?? []).offsets;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-3 overflow-hidden">
      <Rings
        segments={puzzle.segments}
        offsets={puzzle.solution || replay.solved ? solvedOffsets : freshOffsets()}
        size={200}
      />
      <p
        className={`shrink-0 whitespace-nowrap text-center font-mono text-sm font-bold ${myCorrect ? "text-primary" : "text-foreground"}`}
      >
        {replay.solved
          ? `Solved · ${replay.moves} turns${min ? ` (min ${min})` : ""}${
              elapsed !== null ? ` · ${elapsed.toFixed(1)}s` : ""
            }`
          : `${replay.aligned} / ${RINGS_SEGMENTS} spokes`}
      </p>
    </div>
  );
}

/** The rings are public; the minimum and one shortest turn order stay private. */
export const rotatingRingsPuzzle: PuzzleDefinition = {
  key: "rings",
  name: "Rotating Rings",
  category: "pattern",
  timeLimitMs: RINGS_TIME_MS,
  revealMs: 5_000,
  generate: () =>
    ({
      type: "rings",
      segments: Array.from({ length: RINGS_COUNT }, () =>
        Array.from({ length: RINGS_SEGMENTS }, (_v, index) => index % RINGS_COLOURS),
      ),
    }) satisfies RingsPuzzleData,
  check: () => false,
  revealHeading: "In line",
  IntroExample,
  Stage,
  Reveal,
};
