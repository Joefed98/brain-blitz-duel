import { useRef } from "react";
import { heldHorizontal } from "@/lib/desktop";
import { wavefrontFill } from "@/lib/arcade/arenaFills.renderer";
import { gameDisplayName } from "@/lib/duel/gameNames";
import {
  wavCheckpoint,
  WAV_BG,
  WAV_CHECKPOINT_INTERVAL,
  WAV_COLOURS,
  WAV_GOLD,
  WAV_REV_PHONE,
  wavDragZoneTop,
  wavefrontWorldHFor,
  WAV_WORLD_W,
} from "@/lib/arcade/wavefront";
import { encodeWavefrontRun, replayWavefrontRun } from "@/lib/duel/wavefront";
import { WAVEFRONT_TIME_MS, type WavefrontPuzzleData } from "@/lib/duel/types";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";
import { wavefrontArtGameFor } from "@/lib/arcade/wavefront.renderer";
import { wavefrontSounds } from "@/lib/fx/gameSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro still: a 2×3 formation over the ship, with one bolt in flight. */
function IntroExample() {
  const shapes = [
    { kind: "ring", c: 0 },
    { kind: "tri", c: 1 },
    { kind: "hex", c: 2 },
    { kind: "tri", c: 2 },
    { kind: "hex", c: 0 },
    { kind: "ring", c: 1 },
  ];
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <svg
        viewBox="0 0 168 130"
        width={168}
        height={130}
        aria-hidden="true"
        style={{ background: WAV_BG, borderRadius: 10 }}
      >
        {shapes.map((shape, i) => {
          const cx = 44 + (i % 3) * 40;
          const cy = 24 + Math.trunc(i / 3) * 30;
          // The enemy craft in silver, steel grey and black chrome (phone notes, 27 Oct 2026).
          const colour = ["#E6E9EE", "#9AA1AB", "#5A606A"][shape.c] ?? WAV_COLOURS[shape.c];
          if (shape.kind === "ring")
            return <circle key={i} cx={cx} cy={cy} r={10} fill="none" stroke={colour} strokeWidth={3} />;
          const n = shape.kind === "tri" ? 3 : 6;
          const pts = Array.from({ length: n }, (_, p) => {
            const a = -Math.PI / 2 + (p * Math.PI * 2) / n;
            return `${cx + Math.cos(a) * 11},${cy + Math.sin(a) * 11 + (n === 3 ? 2 : 0)}`;
          }).join(" ");
          return (
            <polygon key={i} points={pts} fill={colour} fillOpacity={0.25} stroke={colour} strokeWidth={3} />
          );
        })}
        <rect x={82} y={78} width={4} height={12} fill={WAV_GOLD} />
        <polygon points="84,100 104,118 84,112 64,118" fill={WAV_GOLD} />
      </svg>
      <p className="text-center text-xs text-muted-foreground">Your ship fires on its own. Shoot the glowing carriers for power-ups, hit the bosses' weak points.</p>
    </div>
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
  generate: () => ({ type: "wavefront", seed: 1, wavRev: WAV_REV_PHONE }) satisfies WavefrontPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
