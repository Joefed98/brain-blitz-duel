import { gameDisplayName } from "@/lib/duel/gameNames";
import { solvedMovesText } from "@/lib/duel/scoring";
import { useEffect, useMemo, useRef, useState } from "react";

import { RingsDeck as Rings } from "@/components/puzzles/pattern/ringsDeck";
import { Button } from "@/components/ui/button";
import {
  decodeRingTaps,
  encodeRingTap,
  encodeRingTaps,
  freshOffsets,
  replayRings,
  ringPattern,
} from "@/lib/duel/rings";
import { useStageState } from "@/lib/duel/stageState";
import {
  RINGS_COLOURS,
  RINGS_COUNT,
  RINGS_SEGMENTS,
  RINGS_TIME_MS,
  type RingsPuzzleData,
} from "@/lib/duel/types";
import { useSolveMoment } from "@/lib/fx/patternFx";
import { parItems } from "@/components/puzzles/depth4/ParMeter";
import { LiveSummary, SummaryItem, useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import { playLock } from "@/lib/sound";
import { directionOf, useGameKeys } from "@/lib/desktop";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

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
  const celebrate = useSolveMoment(replay?.solved ?? false, "rings.solve");
  const inFrame = useFrameProgress(replay?.aligned ?? 0, RINGS_SEGMENTS, "spokes");

  useEffect(() => {
    onDraftAnswer?.(encodeRingTaps(taps));
  }, [taps, onDraftAnswer]);

  useEffect(() => {
    if (!data || locked || submitted.current) return;
    if (now < phaseStartedAt + RINGS_TIME_MS - 400) return;
    submitted.current = true;
    onSubmit(encodeRingTaps(taps));
  }, [now, phaseStartedAt, locked, data, taps, onSubmit]);

  // Desktop keys: ↑ ↓ (W/S) select the next ring out / in, ← → (A/D) turn it anticlockwise / clockwise (↺ ↻).
  useGameKeys((kind, key) => {
    if (!data || !replay) return false;
    const dir = directionOf(key);
    if (dir === null) return false;
    if (kind !== "down") return true;
    if (dir === "up") setSelectedRing((ring) => Math.min(RINGS_COUNT - 1, ring + 1));
    else if (dir === "down") setSelectedRing((ring) => Math.max(0, ring - 1));
    else turn(selectedRing, dir === "right");
    return true;
  });

  if (!data || !replay) return null;

  const turn = (ring: number, clockwise: boolean) => {
    if (locked || submitted.current || replay.solved) return;
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
    <div data-stage-column="2" data-polish="rings" className="flex min-h-0 w-full flex-1 flex-col items-center gap-2 pt-1">
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
          celebrate={celebrate}
        />
        </div>
      </div>
      {inFrame ? (
        <LiveSummary
          items={[
            <SummaryItem key="ring" label="Ring" value={selectedRing + 1} after="selected" />,
            // ringsRev 1 (depth batch 4): "Turns n · Par p" with the par meter.
            ...((data.ringsRev ?? 0) >= 1 && (data.par ?? 0) > 0
              ? parItems("Turns", replay.moves, data.par!)
              : [<SummaryItem key="turns" label="Turns" value={replay.moves} />]),
          ]}
        />
      ) : (
        <p data-game-controls="status" className="shrink-0 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          ring {selectedRing + 1} selected · turns{" "}
          <span className="text-primary">{replay.moves}</span> · spokes{" "}
          <span className="text-primary">
            {replay.aligned} / {RINGS_SEGMENTS}
          </span>
        </p>
      )}
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

function Reveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining, scoreParts }: PuzzleRevealProps) {
  if (puzzle.type !== "rings") return null;
  const replay = replayRings(puzzle.segments, puzzle.pattern, decodeRingTaps(myAnswer ?? ""));
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((timeLimitMs - myMsRemaining) / 100) / 10;
  const min = puzzle.minMoves ?? 0;
  const solvedOffsets = replay.solved
    ? replay.offsets
    : replayRings(puzzle.segments, puzzle.pattern, puzzle.solution ?? []).offsets;

  return (
    <div className="rings-reveal flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <div className="rings-reveal-space">
        <Rings
          segments={puzzle.segments}
          offsets={puzzle.solution || replay.solved ? solvedOffsets : freshOffsets()}
          size={200}
          solved={replay.solved}
        />
      </div>
       <p className="font-mono text-base text-muted-foreground">Solved rings</p>
       {!replay.solved && (
         <>
           <div className="rings-reveal-space rings-reveal-mine">
             <Rings segments={puzzle.segments} offsets={replay.offsets} size={160} />
           </div>
           <p className="font-mono text-base text-muted-foreground">Your result</p>
         </>
       )}
      <p
        className={`whitespace-normal break-words text-center font-mono text-base font-bold ${myCorrect ? "text-primary" : "text-foreground"}`}
      >
        {replay.solved
          ? solvedMovesText(replay.moves, min, myMsRemaining, timeLimitMs, "B", scoreParts)
          : `${replay.aligned} / ${RINGS_SEGMENTS} spokes`}
      </p>
       {!replay.solved && <p className="font-mono text-base text-muted-foreground">{replay.moves} moves · {(puzzle.ringsRev ?? 0) >= 1 ? "par" : "min"} {min}</p>}
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
