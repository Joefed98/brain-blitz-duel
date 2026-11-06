import { useRef } from "react";
import { heldHorizontal } from "@/lib/desktop";
import { wavefrontFill } from "@/lib/arcade/arenaFills.renderer";
import { gameDisplayName } from "@/lib/duel/gameNames";
import {
  wavCheckpoint,
  WAV_BG,
  WAV_CHECKPOINT_INTERVAL,
  WAV_REV_STD,
  wavDragZoneTop,
  wavefrontWorldHFor,
  WAV_WORLD_W,
} from "@/lib/arcade/wavefront";
import { encodeWavefrontRun, replayWavefrontRun } from "@/lib/duel/wavefront";
import { WAVEFRONT_TIME_MS, type WavefrontPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";
import { ArtStill } from "@/components/puzzles/ArtStill";
import { wavefrontArtGameFor } from "@/lib/arcade/wavefront.renderer";
import { wavefrontSounds } from "@/lib/fx/gameSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/**
 * The intro still (3 Nov 2026): the dealt revision's own art a few seconds into a fixed seed's run, so the intro shows
 * the real ships rather than placeholder shapes.
 */
function IntroExample() {
  return (
    <ArtStill
      game={wavefrontArtGameFor(WAV_REV_STD)}
      worldW={WAV_WORLD_W}
      worldH={wavefrontWorldHFor(WAV_REV_STD)}
      ticks={150}
      input={null}
      caption="Your ship fires on its own. Shoot the glowing carriers for power-ups, hit the bosses’ weak points."
    />
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: WavefrontPuzzleData | null = puzzle.type === "wavefront" ? puzzle : null;
  // wavRev 6: the taller world; drags start in the bottom quarter of the stored revision's world.
  const worldH = wavefrontWorldHFor(data?.wavRev);
  const held = useRef(heldHorizontal());
  return (
    <ArcadeCanvasStage
      diagKey="wavefront"
      scene={wavefrontFill}
      label={gameDisplayName("wavefront")}
      background={WAV_BG}
      fitWorld
      seed={data?.seed ?? 1}
      enabled={data !== null}
      locked={locked}
      worldW={WAV_WORLD_W}
      worldH={worldH}
      game={wavefrontArtGameFor(data?.wavRev)}
      sounds={wavefrontSounds}
      checkpoint={wavCheckpoint}
      interval={WAV_CHECKPOINT_INTERVAL}
      encodeRun={encodeWavefrontRun}
      pointer={(kind, x, y) => {
        if (kind === "down" && y < wavDragZoneTop(worldH)) return null;
        return { a: x, b: 0, c: 0 };
      }}
      // Desktop keys: ←/→ (A/D) slide the aim, the same absolute x a drag sets, 6 px a tick.
      tickInput={(state) => {
        const dir = held.current.dir();
        if (dir === 0) return null;
        const x = Math.max(0, Math.min(WAV_WORLD_W, state.aimX + dir * 6));
        return { a: x, b: 0, c: 0 };
      }}
      keys={(kind, key) => held.current.key(kind, key)}
      onSubmit={(answer) => onSubmit(answer)}
      onDraftAnswer={onDraftAnswer}
    />
  );
}

export function wavefrontLine(r: {
  wave: number;
  shapesDown: number;
  saucers: number;
  survived: boolean;
  endedSeconds: number;
  bossKilled?: number;
}): string {
  if (r.bossKilled) return `Boss destroyed at ${r.endedSeconds.toFixed(1)}s · ${r.shapesDown} ships · ${r.saucers} saucer${r.saucers === 1 ? "" : "s"}`;
  const head = `Wave ${r.wave} · ${r.shapesDown} ship${r.shapesDown === 1 ? "" : "s"} · ${r.saucers} saucer${r.saucers === 1 ? "" : "s"}`;
  return r.survived ? `${head} · survived` : `${head} · destroyed at ${r.endedSeconds.toFixed(1)}s`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "wavefront") return null;
  const result = replayWavefrontRun(puzzle.seed, myAnswer ?? "", puzzle.wavRev);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {wavefrontLine(result)}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">
        {result.wavesCleared} wave{result.wavesCleared === 1 ? "" : "s"} cleared · {result.armourHits} armour
        hit{result.armourHits === 1 ? "" : "s"}
        {puzzle.wavRev ? ` · boss ${result.bossHits} hit${result.bossHits === 1 ? "" : "s"}` : ""} · same waves for everyone
      </p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const wavefrontPuzzle: PuzzleDefinition = {
  key: "wavefront",
  name: gameDisplayName("wavefront"),
  category: "arcade",
  timeLimitMs: WAVEFRONT_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "wavefront", seed: 1, wavRev: WAV_REV_STD }) satisfies WavefrontPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
