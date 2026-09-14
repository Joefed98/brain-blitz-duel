import { useEffect, useState } from "react";

import {
  SEQUENCE_FLASH_MS,
  SEQUENCE_GAP_MS,
  SEQUENCE_LEAD_IN_MS,
  type SequencePuzzleData,
} from "@/lib/duel/types";

interface SequencePuzzleProps {
  puzzle: SequencePuzzleData;
  /** Server-synced timestamp (ms) at which playback begins on both phones. */
  playbackStartAt: number;
  now: number;
  locked: boolean;
  onSubmit: (answer: string) => void;
  reverse?: boolean;
}

/** Which tile is lit during playback, or null once playback has finished. */
function litTile(puzzle: SequencePuzzleData, elapsed: number): number | null {
  const offset = elapsed - SEQUENCE_LEAD_IN_MS;
  if (offset < 0) return null;
  const step = SEQUENCE_FLASH_MS + SEQUENCE_GAP_MS;
  const index = Math.floor(offset / step);
  if (index >= puzzle.tiles.length) return null;
  return offset % step < SEQUENCE_FLASH_MS ? puzzle.tiles[index]! : null;
}

export function SequencePuzzle({
  puzzle,
  playbackStartAt,
  now,
  locked,
  onSubmit,
  reverse = false,
}: SequencePuzzleProps) {
  const [taps, setTaps] = useState<number[]>([]);
  const [flash, setFlash] = useState<number | null>(null);

  useEffect(() => {
    setTaps([]);
  }, [puzzle.tiles.join(",")]);

  const elapsed = now - playbackStartAt;
  const playbackEnd =
    SEQUENCE_LEAD_IN_MS +
    puzzle.tiles.length * SEQUENCE_FLASH_MS +
    (puzzle.tiles.length - 1) * SEQUENCE_GAP_MS;
  const playing = elapsed < playbackEnd;
  const lit = playing ? litTile(puzzle, elapsed) : null;

  const handleTap = (index: number) => {
    if (playing || locked || taps.length >= puzzle.tiles.length) return;
    setFlash(index);
    window.setTimeout(() => setFlash(null), 200);
    const next = [...taps, index];
    setTaps(next);
    if (next.length === puzzle.tiles.length) onSubmit(next.join(","));
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-7">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {playing ? "Watch the sequence" : reverse ? "Repeat it in reverse" : "Repeat the sequence"}
      </p>

      <div className="flex gap-2">
        {puzzle.tiles.map((_, index) => (
          <span
            key={index}
            className={`h-2.5 w-2.5 rounded-full ${
              index < taps.length ? "bg-primary" : "bg-border"
            }`}
          />
        ))}
      </div>

      <div
        className="grid gap-2.5"
        style={{ gridTemplateColumns: `repeat(${SEQUENCE_COLS}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: SEQUENCE_COLS * SEQUENCE_COLS }, (_, index) => {
          const isLit = lit === index;
          const isFlash = flash === index;
          return (
            <button
              key={index}
              type="button"
              aria-label={`Tile ${index + 1}`}
              onClick={() => handleTap(index)}
              disabled={playing || locked}
              className={`h-[86px] w-[86px] rounded-xl border transition-colors ${
                isLit
                  ? "border-primary bg-primary"
                  : isFlash
                    ? "border-primary bg-primary/40 animate-tile-flash"
                    : "border-border bg-card"
              } ${playing || locked ? "cursor-default" : ""}`}
            />
          );
        })}
      </div>
    </div>
  );
}
