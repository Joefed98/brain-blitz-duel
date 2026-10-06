import { solvedMovesText } from "@/lib/duel/scoring";
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
  ringPattern,
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
const RADII = [0.98, 0.82, 0.66, 0.5, 0.34];
const INNER_HOLE = 0.16;

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
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 touch-none"
      aria-label="Rotating Rings board"
      onPointerDown={(event) => {
        if (!onSelect) return;
        event.preventDefault();
        const box = event.currentTarget.getBoundingClientRect();
         const x = (event.clientX - box.left) * size / box.width - centre;
         const y = (event.clientY - box.top) * size / box.height - centre;
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
      <circle cx={centre} cy={centre} r={half * INNER_HOLE} fill="var(--color-card)" />
    </svg>
  );
}

/** The link legend shown beside the rings. */
function Legend({ pattern }: { pattern: number }) {
  return (
    <ul className="flex flex-col gap-0.5 text-center font-mono text-sm leading-tight text-muted-foreground">
      {ringPattern(pattern).legend.map((line) => (
        <li key={line}>
          {line}
        </li>
      ))}
    </ul>
  );
}

const EXAMPLE_ROW = [0, 1, 2, 3, 0, 1, 2, 3];
const EXAMPLE_PATTERN = 0;
/** Ring 2 is a turn behind, so is ring 4 (in the other direction) — one tap on ring 2 fixes both. */
const EXAMPLE_SEGMENTS = [0, 1, 0, 7, 0].map((offset) =>
  EXAMPLE_ROW.map((_c, index) => EXAMPLE_ROW[(index + offset) % 8]!),
);

/** Fixed intro example — one linked turn brings the rings into line. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex items-center gap-3">
        <Rings segments={EXAMPLE_SEGMENTS} offsets={[0, 0, 0, 0, 0]} size={86} />
        <span className="font-mono text-xs text-muted-foreground">→</span>
        <Rings segments={EXAMPLE_SEGMENTS} offsets={[0, 7, 0, 1, 0]} size={86} />
      </div>
      <Legend pattern={EXAMPLE_PATTERN} />
      <p className="text-center text-xs text-muted-foreground">
        One turn of ring 2 also turns ring 4 the other way - and every spoke is one colour.
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
  const replay = useMemo(() => (data ? replayRings(data.segments, data.pattern, taps) : null), [data, taps]);

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
    const after = replayRings(data.segments, data.pattern, next);
    if (after.solved) {
      submitted.current = true;
      playLock();
      onSubmit(encodeRingTaps(next));
      return;
    }
    playCorrect();
  };

  return (
    <div data-stage-column="2" className="flex min-h-0 w-full flex-1 flex-col items-center gap-2 pt-1">
      <div className="flex min-h-10 shrink-0 items-center justify-center py-1 [&>*]:scale-90"><Legend pattern={data.pattern} /></div>
      <div data-game-arena="board" className="puzzle-square-space flex min-h-0 w-full flex-1 items-center justify-center">
        <div className="puzzle-square-board aspect-square [&>svg]:h-full [&>svg]:w-full">
        <Rings
          segments={data.segments}
          offsets={replay.offsets}
          size={351}
          selectedRing={selectedRing}
          onSelect={setSelectedRing}
        />
        </div>
      </div>
      <p data-game-controls="status" className="shrink-0 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        ring {selectedRing + 1} selected · turns{" "}
        <span className="text-primary">{replay.moves}</span> · spokes{" "}
        <span className="text-primary">
          {replay.aligned} / {RINGS_SEGMENTS}
        </span>
      </p>
      <div data-game-controls="actions" className="grid h-[52px] w-full shrink-0 grid-cols-2 gap-3 px-2">
        <Button
          type="button"
          variant="outline"
          aria-label="Rotate selected ring anticlockwise"
          className="h-[52px] text-2xl"
          onClick={() => turn(selectedRing, false)}
        >
          ↺
        </Button>
        <Button
          type="button"
          variant="outline"
          aria-label="Rotate selected ring clockwise"
          className="h-[52px] text-2xl"
          onClick={() => turn(selectedRing, true)}
        >
          ↻
        </Button>
      </div>
    </div>
  );
}

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "rings") return null;
  const replay = replayRings(puzzle.segments, puzzle.pattern, decodeRingTaps(myAnswer ?? ""));
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((timeLimitMs - myMsRemaining) / 100) / 10;
  const min = puzzle.minMoves ?? 0;
  const solvedOffsets = replay.solved
    ? replay.offsets
    : replayRings(puzzle.segments, puzzle.pattern, puzzle.solution ?? []).offsets;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <Rings
        segments={puzzle.segments}
        offsets={puzzle.solution || replay.solved ? solvedOffsets : freshOffsets()}
        size={200}
      />
       <p className="font-mono text-base text-muted-foreground">Solved rings</p>
       {!replay.solved && (
         <>
           <Rings segments={puzzle.segments} offsets={replay.offsets} size={160} />
           <p className="font-mono text-base text-muted-foreground">Your result</p>
         </>
       )}
      <p
        className={`whitespace-normal break-words text-center font-mono text-base font-bold ${myCorrect ? "text-primary" : "text-foreground"}`}
      >
        {replay.solved
          ? solvedMovesText(replay.moves, min, myMsRemaining, timeLimitMs)
          : `${replay.aligned} / ${RINGS_SEGMENTS} spokes`}
      </p>
       {!replay.solved && <p className="font-mono text-base text-muted-foreground">{replay.moves} moves · min {min}</p>}
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
      pattern: 0,
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
