import { gameDisplayName } from "@/lib/duel/gameNames";
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
import { playLock } from "@/lib/sound";

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
  solved = false,
}: {
  segments: number[][];
  offsets: number[];
  size: number;
  selectedRing?: number | undefined;
  onSelect?: ((ring: number) => void) | undefined;
  /** Render-only celebration once the solve has been recorded. */
  solved?: boolean;
}) {
  const centre = size / 2;
  const half = size / 2;
  // The record sits on a platter inside the deck, leaving the corner free for the tonearm base.
  const record = half * 0.86;
  const aligned = new Set(alignedSpokes(segments, offsets));
  const step = (Math.PI * 2) / RINGS_SEGMENTS;
  // Ring 0 is the innermost ring, drawn with the smallest radius.
  const radiusOf = (ring: number) => record * RADII[RINGS_COUNT - 1 - ring]!;
  const innerOf = (ring: number) =>
    ring === 0 ? record * INNER_HOLE : record * RADII[RINGS_COUNT - ring]! + 1.5;

  // Presentation only: each turned ring eases in from its previous angle.
  const previous = useRef<number[] | null>(null);
  const turnCount = useRef<number[]>(Array.from({ length: RINGS_COUNT }, () => 0));
  const turnFrom = useRef<number[]>(Array.from({ length: RINGS_COUNT }, () => 0));
  if (previous.current && previous.current.join() !== offsets.join()) {
    for (let ring = 0; ring < RINGS_COUNT; ring += 1) {
      let delta = ((((offsets[ring] ?? 0) - (previous.current[ring] ?? 0)) % RINGS_SEGMENTS) + RINGS_SEGMENTS) % RINGS_SEGMENTS;
      if (delta > RINGS_SEGMENTS / 2) delta -= RINGS_SEGMENTS;
      if (delta !== 0) {
        turnCount.current[ring] = (turnCount.current[ring] ?? 0) + 1;
        turnFrom.current[ring] = delta * (360 / RINGS_SEGMENTS);
      }
    }
  }
  previous.current = [...offsets];

  const strobe = half * 0.91;
  const origin = `${centre}px ${centre}px`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 touch-none"
      aria-label={`${gameDisplayName("rings")} deck`}
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
      <defs>
        <radialGradient id="vinyl-sheen" cx="35%" cy="25%" r="75%">
          <stop offset="0%" stopColor="var(--tally-white)" stopOpacity="0.18" />
          <stop offset="55%" stopColor="var(--tally-white)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="platter-metal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--platter)" />
          <stop offset="50%" stopColor="var(--platter-dark)" />
          <stop offset="100%" stopColor="var(--platter)" />
        </linearGradient>
      </defs>
      <rect x={0.5} y={0.5} width={size - 1} height={size - 1} rx={size * 0.06} fill="var(--plinth)" stroke="var(--plinth-edge)" strokeWidth={1} />
      {/* Brushed-metal platter with a glossy rim. */}
      <circle cx={centre} cy={centre} r={half * 0.955} fill="url(#platter-metal)" />
      {Array.from({ length: 10 }, (_v, g) => (
        <circle key={`brush-${g}`} cx={centre} cy={centre} r={half * (0.875 + g * 0.0075)} fill="none" stroke="var(--tally-white)" strokeOpacity={0.08} strokeWidth={0.6} />
      ))}
      <circle cx={centre} cy={centre} r={half * 0.955} fill="none" stroke="var(--tally-white)" strokeOpacity={0.35} strokeWidth={1.2} />
      {/* Strobe dots, one per spoke, lit when that spoke is solved. */}
      {Array.from({ length: RINGS_SEGMENTS }, (_v, spoke) => {
        const angle = (spoke + 0.5) * step - Math.PI / 2;
        return (
          <circle
            key={`strobe-${spoke}`}
            cx={centre + strobe * Math.cos(angle)}
            cy={centre + strobe * Math.sin(angle)}
            r={Math.max(2.4, size * 0.011)}
            fill={aligned.has(spoke) ? GLYPH_COLOURS.GOLD : "var(--strobe-off)"}
            className={aligned.has(spoke) ? "ring-glow" : undefined}
          />
        );
      })}
      <g className={solved ? "record-solved" : undefined} style={{ transformOrigin: origin }}>
        <circle cx={centre} cy={centre} r={record * 0.995} fill="var(--vinyl)" />
        {Array.from({ length: RINGS_COUNT }, (_v, ring) => (
          <g
            key={`ring-${ring}-${turnCount.current[ring]}`}
            className={turnCount.current[ring] ? "ring-turn" : undefined}
            style={{ transformOrigin: origin, ["--turn-from" as string]: `${turnFrom.current[ring]}deg`, ["--turn-ms" as string]: `${RINGS_TURN_MS}ms` }}
          >
            {Array.from({ length: RINGS_SEGMENTS }, (_s, spoke) => (
              <path
                key={`${ring}-${spoke}`}
                d={arc(
                  centre,
                  centre,
                  radiusOf(ring) - 0.75,
                  innerOf(ring) + 0.75,
                  spoke * step - Math.PI / 2 + 0.05,
                  (spoke + 1) * step - Math.PI / 2 - 0.05,
                )}
                fill={colourOf(ringColour(segments, offsets, ring, spoke))}
              />
            ))}
            {/* Groove shimmer: two faint grooves across each band. */}
            {[0.33, 0.66].map((t) => (
              <circle key={t} cx={centre} cy={centre} r={innerOf(ring) + (radiusOf(ring) - innerOf(ring)) * t} fill="none" stroke="var(--guest-ink)" strokeOpacity={0.22} strokeWidth={0.7} />
            ))}
          </g>
        ))}
        {/* Gloss: one soft sheen over the whole record, never hiding colours. */}
        <circle cx={centre} cy={centre} r={record} fill="url(#vinyl-sheen)" pointerEvents="none" />
        <circle cx={centre} cy={centre} r={record * INNER_HOLE} fill="var(--vinyl-label)" stroke={GLYPH_COLOURS.GOLD} strokeOpacity={0.6} strokeWidth={1} />
        <circle cx={centre} cy={centre} r={Math.max(1.5, half * 0.02)} fill="var(--vinyl)" />
      </g>
      {selectedRing === undefined ? null : (
        <g pointerEvents="none" className="ring-glow">
          <circle cx={centre} cy={centre} r={radiusOf(selectedRing) - 0.5} fill="none" stroke={GLYPH_COLOURS.GOLD} strokeWidth={2.2} />
          <circle cx={centre} cy={centre} r={innerOf(selectedRing) + 0.5} fill="none" stroke={GLYPH_COLOURS.GOLD} strokeWidth={2.2} />
        </g>
      )}
      {selectedRing === undefined ? null : (() => {
        // Tonearm base in the deck's top-right corner. The arm runs down the spoke gap on the
        // diagonal, so only the needle tip touches the selected ring's outer edge.
        const angle = -Math.PI / 4;
        const tip = radiusOf(selectedRing);
        const hx = centre + tip * Math.cos(angle);
        const hy = centre + tip * Math.sin(angle);
        const px = size * 0.93;
        const py = size * 0.07;
        const w = Math.max(1, size * 0.004);
        return (
          <g pointerEvents="none" className="ring-tonearm">
            <line x1={px} y1={py} x2={hx} y2={hy} stroke="var(--tonearm)" strokeWidth={w} strokeLinecap="round" />
            <circle cx={px} cy={py} r={size * 0.04} fill="var(--platter-dark)" stroke="var(--tonearm)" strokeWidth={1} />
            <circle cx={px} cy={py} r={size * 0.015} fill="var(--tonearm)" />
            <circle cx={hx} cy={hy} r={w * 1.6} fill={GLYPH_COLOURS.GOLD} />
          </g>
        );
      })()}
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
        One turn of ring 2 also turns ring 4 the other way - every spoke is one colour and every strobe dot lights.
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
          solved={replay.solved}
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
  name: gameDisplayName("rings"),
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
