import { useRef } from "react";

import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import { ArcadeControlButton } from "@/components/puzzles/ArcadeControlButton";
import { mahjongFill } from "@/lib/arcade/arenaFills.renderer";
import {
  mahjongCheckpoint,
  mahjongSlotAt,
  MAHJONG_BUTTON_RESET,
  MAHJONG_BUTTON_SHUFFLE,
  MAHJONG_BUTTON_UNDO,
  MAHJONG_CHECKPOINT_INTERVAL,
  MAHJONG_INPUT_BUTTON,
  MAHJONG_INPUT_SHUFFLE,
  MAHJONG_INPUT_TAP,
  MAHJONG_PAIRS,
  MAHJONG_REV_DEALT,
  MAHJONG_REV_UNDO,
  MAHJONG_RUN_TICKS,
  MAHJONG_SHUFFLE_COST,
  MAHJONG_WORLD_H,
  MAHJONG_WORLD_W,
  type MahjongState,
} from "@/lib/arcade/mahjong";
import { MAHJONG_ART, mahjongArtGameFor, mahjongMovesShown, paintMahjongFace, paintMahjongTable, paintMahjongTile } from "@/lib/arcade/mahjong.renderer";
import { TICKS_PER_SECOND } from "@/lib/arcade/engine";
import { encodeMahjongRun, replayMahjongRun } from "@/lib/duel/mahjong";
import { gameDisplayName } from "@/lib/duel/gameNames";
import type { MahjongPuzzleData } from "@/lib/duel/types";
import { expansionSounds } from "@/lib/fx/expansionSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { canvasRatio } from "@/lib/battery";

/** Fixed intro still: two stacked tiles and a free matching pair, one of them selected. */
function IntroExample() {
  const draw = (canvas: HTMLCanvasElement | null) => {
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const ratio = canvasRatio();
    canvas.width = 180 * ratio;
    canvas.height = 120 * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    paintMahjongTable(ctx, 180, 120, false);
    const tiles: [number, number, number][] = [
      [14, 26, 4],
      [50, 26, 31],
      [86, 26, 15],
      [56, 18, 4],
      [126, 26, 22],
    ];
    tiles.forEach(([x, y, face], i) => {
      const z = i === 3 ? 1 : 0;
      paintMahjongTile(ctx, x - z * 4, y - z * 5, 34, 46, 4);
      paintMahjongFace(ctx, face, x - z * 4, y - z * 5, 34, 46);
    });
    ctx.strokeStyle = MAHJONG_ART.gold;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(13, 25, 36, 48);
  };
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <canvas ref={draw} aria-hidden="true" style={{ width: 180, height: 120, borderRadius: 10 }} />
    </div>
  );
}

function mahjongSounds(onState: (s: MahjongState) => void) {
  return () => {
    const watch = expansionSounds<MahjongState>([
      { count: (s) => s.pairs, sound: "ding", volume: 0.7 },
      { count: (s) => s.shuffles, sound: "zap" },
      { count: (s) => s.blocked, sound: "tick", volume: 0.4 },
      { count: (s) => s.undos ?? 0, sound: "tick", volume: 0.6 },
      { count: (s) => s.resets ?? 0, sound: "zap", volume: 0.6 },
      { count: (s) => (s.clearedTick > 0 ? 1 : 0), sound: "chime" },
    ]);
    return {
      frame: (state: MahjongState, running: boolean) => {
        onState(state);
        watch(state, running || state.clearedTick === state.tick);
      },
      stop: () => {},
    };
  };
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: MahjongPuzzleData | null = puzzle.type === "mahjong" ? puzzle : null;
  const game = mahjongArtGameFor(data?.mahjongRev);
  /** mahjongRev 2: Undo and Reset beside Shuffle. */
  const undo = (data?.mahjongRev ?? 1) >= MAHJONG_REV_UNDO;
  /** The board the player is looking at (the last drawn frame), so a tap picks the tile they saw on top. */
  const shown = useRef<MahjongState | null>(null);
  const sounds = useRef(mahjongSounds((s) => (shown.current = s)));

  const pointer = (kind: "down" | "move" | "up", x: number, y: number): PointerPayload | null => {
    if (kind !== "down") return null;
    const state = shown.current;
    if (!state) return null;
    const slot = mahjongSlotAt(state.face, x, y);
    return slot < 0 ? null : { k: MAHJONG_INPUT_TAP, a: slot, b: 0, c: 0 };
  };

  return (
    <div data-stage-column="2" className="flex min-h-0 w-full flex-1 flex-col gap-2">
      <ArcadeCanvasStage
        diagKey="mahjong"
        scene={mahjongFill}
        label={`${gameDisplayName("mahjong")}: tap two matching free tiles`}
        background={MAHJONG_ART.wood}
        fitWorld
        seed={data?.seed ?? 1}
        enabled={data !== null}
        locked={locked}
        worldW={MAHJONG_WORLD_W}
        worldH={MAHJONG_WORLD_H}
        game={game}
        sounds={sounds.current}
        checkpoint={mahjongCheckpoint}
        interval={MAHJONG_CHECKPOINT_INTERVAL}
        encodeRun={encodeMahjongRun}
        inputKind={MAHJONG_INPUT_TAP}
        discrete
        pointer={pointer}
        keys={(kind, key, send) => {
          // S shuffles; on rev 2, Z (or U) undoes and R resets.
          if (key === "s" || key === "S") {
            if (kind === "down") send({ k: MAHJONG_INPUT_SHUFFLE, a: MAHJONG_BUTTON_SHUFFLE, b: 0, c: 0 });
            return true;
          }
          if (undo && (key === "z" || key === "Z" || key === "u" || key === "U")) {
            if (kind === "down") send({ k: MAHJONG_INPUT_BUTTON, a: MAHJONG_BUTTON_UNDO, b: 0, c: 0 });
            return true;
          }
          if (undo && (key === "r" || key === "R")) {
            if (kind === "down") send({ k: MAHJONG_INPUT_BUTTON, a: MAHJONG_BUTTON_RESET, b: 0, c: 0 });
            return true;
          }
          return false;
        }}
        footer={(send) => (
          // The Shuffle button in the bottom corner, within thumb reach (rev 2: Undo and Reset, smaller, beside it); its row
          // ends 16 px above the bottom like every arcade control row.
          <div data-game-controls="shuffle" className="flex h-[52px] shrink-0 items-center justify-end gap-2">
            {undo ? (
              <>
                <ArcadeControlButton
                  type="button"
                  aria-label="Undo"
                  disabled={locked}
                  className="h-[44px] rounded-xl border-2 border-foreground/30 bg-background/40 px-3.5 text-[14px] font-bold text-foreground hover:bg-background/40 active:bg-foreground/15"
                  onPressStart={() => send({ k: MAHJONG_INPUT_BUTTON, a: MAHJONG_BUTTON_UNDO, b: 0, c: 0 })}
                >
                  ↶ Undo
                </ArcadeControlButton>
                <ArcadeControlButton
                  type="button"
                  aria-label="Reset"
                  disabled={locked}
                  className="h-[44px] rounded-xl border-2 border-foreground/30 bg-background/40 px-3.5 text-[14px] font-bold text-foreground hover:bg-background/40 active:bg-foreground/15"
                  onPressStart={() => send({ k: MAHJONG_INPUT_BUTTON, a: MAHJONG_BUTTON_RESET, b: 0, c: 0 })}
                >
                  ⤺ Reset
                </ArcadeControlButton>
              </>
            ) : null}
            <ArcadeControlButton
              type="button"
              aria-label={`Shuffle (−${MAHJONG_SHUFFLE_COST})`}
              disabled={locked}
              className="h-[52px] rounded-xl border-2 border-primary/70 bg-background/40 px-5 text-[15px] font-extrabold text-primary hover:bg-background/40 shadow-[0_0_12px_rgba(245,184,46,0.22)] active:bg-primary/25"
              onPressStart={() => send({ k: MAHJONG_INPUT_SHUFFLE, a: MAHJONG_BUTTON_SHUFFLE, b: 0, c: 0 })}
            >
              {`⟳ Shuffle −${MAHJONG_SHUFFLE_COST}`}
            </ArcadeControlButton>
          </div>
        )}
        onSubmit={(answer) => onSubmit(answer)}
        onDraftAnswer={onDraftAnswer}
      />
    </div>
  );
}

export function mahjongLine(r: { pairs: number; shuffles: number; cleared: boolean; clearedSeconds: number }): string {
  const head = `${r.pairs} of ${MAHJONG_PAIRS} pairs`;
  const shuffles = r.shuffles === 0 ? "no shuffle" : `${r.shuffles} ${r.shuffles === 1 ? "shuffle" : "shuffles"}`;
  return r.cleared ? `${head} · cleared in ${r.clearedSeconds.toFixed(1)}s · ${shuffles}` : `${head} · ${shuffles}`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "mahjong") return null;
  const result = replayMahjongRun(puzzle.seed, myAnswer ?? "", puzzle.mahjongRev);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">{mahjongLine(result)}</p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same stack for everyone · {mahjongMovesShown(result.state.face)} moves left</p>
    </div>
  );
}

/** The faces are dealt in the sim from the stored seed; every run is replayed on the server for scoring. */
export const mahjongPuzzle: PuzzleDefinition = {
  key: "mahjong",
  name: gameDisplayName("mahjong"),
  category: "arcade",
  timeLimitMs: (MAHJONG_RUN_TICKS / TICKS_PER_SECOND) * 1000 + 3000,
  revealMs: 6_000,
  generate: () => ({ type: "mahjong", seed: 1, mahjongRev: MAHJONG_REV_DEALT }) satisfies MahjongPuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
