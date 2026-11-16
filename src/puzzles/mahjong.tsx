import { useMemo, useRef, useState } from "react";

import { ArcadeCanvasStage, type PointerPayload } from "@/components/puzzles/ArcadeCanvasStage";
import { ArcadeControlButton } from "@/components/puzzles/ArcadeControlButton";
import { mahjongFill } from "@/lib/arcade/arenaFills.renderer";
import {
  mahjongCheckpoint,
  mahjongSlotAt,
  MAHJONG_BUTTON_HINT,
  MAHJONG_BUTTON_RESET,
  MAHJONG_LEVEL_RULES,
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
import { MAHJONG_ART, mahjongArtGameFor, mahjongNewView, mahjongMovesShown, paintMahjongFace, paintMahjongTable, paintMahjongTile } from "@/lib/arcade/mahjong.renderer";
import { TICKS_PER_SECOND } from "@/lib/arcade/engine";
import { encodeMahjongRun, replayMahjongRun } from "@/lib/duel/mahjong";
import { gameDisplayName } from "@/lib/duel/gameNames";
import type { MahjongPuzzleData } from "@/lib/duel/types";
import { mahjongSounds as mahjongObserver } from "@/lib/fx/cardSounds";
import { cardConfirmCue } from "@/lib/fx/gameSounds";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import { preloadRealArt } from "@/lib/arcade/cards/realArt.renderer";
import { levelOfPuzzle } from "@/lib/levels/levels";

// The Cards & Board overhaul's real art starts loading with the game's chunk (display only).
if (typeof window !== "undefined") preloadRealArt(["tiles", "mahjongTable"]);
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

/** The game's sound observer (gameSounds.ts), which also hands each drawn frame's state to the tap mapping. */
function mahjongSounds(onState: (s: MahjongState) => void) {
  return () => {
    const inner = mahjongObserver();
    return {
      frame: (state: MahjongState, running: boolean) => {
        onState(state);
        inner.frame(state, running);
      },
      stop: () => inner.stop(),
    };
  };
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: MahjongPuzzleData | null = puzzle.type === "mahjong" ? puzzle : null;
  // The live stage's view (stage 2's effects); one game object per revision and view, so the run never restarts.
  const view = useMemo(() => mahjongNewView(), []);
  const level = data ? levelOfPuzzle(data) : null;
  const rules = level ? MAHJONG_LEVEL_RULES[level] : null;
  const shuffleCost = rules ? rules.shuffleCost : MAHJONG_SHUFFLE_COST;
  const game = useMemo(() => mahjongArtGameFor(data?.mahjongRev, view, level), [data?.mahjongRev, view, level]);
  /** mahjongRev 2: Undo and Reset beside Shuffle. */
  const undo = (data?.mahjongRev ?? 1) >= MAHJONG_REV_UNDO;
  /** The board the player is looking at (the last drawn frame), so a tap picks the tile they saw on top. */
  const shown = useRef<MahjongState | null>(null);
  const sounds = useRef(mahjongSounds((s) => (shown.current = s)));
  /** Reset's confirmation (the Cards & Board overhaul): the footer asks before the board goes back to the deal. */
  const [confirming, setConfirming] = useState(false);

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
          if (rules && (key === "h" || key === "H")) {
            if (kind === "down") send({ k: MAHJONG_INPUT_BUTTON, a: MAHJONG_BUTTON_HINT, b: 0, c: 0 });
            return true;
          }
          if (undo && (key === "z" || key === "Z" || key === "u" || key === "U")) {
            if (kind === "down") send({ k: MAHJONG_INPUT_BUTTON, a: MAHJONG_BUTTON_UNDO, b: 0, c: 0 });
            return true;
          }
          if (undo && (key === "r" || key === "R")) {
            // R asks first, like the button; Enter then resets, Escape keeps the board.
            if (kind === "down") {
              setConfirming(true);
              cardConfirmCue();
            }
            return true;
          }
          if (confirming && (key === "Enter" || key === "Escape")) {
            if (kind === "down") {
              setConfirming(false);
              if (key === "Enter") send({ k: MAHJONG_INPUT_BUTTON, a: MAHJONG_BUTTON_RESET, b: 0, c: 0 });
            }
            return true;
          }
          return false;
        }}
        footer={(send) =>
          confirming && undo ? (
            // Reset asks first (the overhaul): the thumb row becomes the question; Reset fires on release over it.
            <div data-home-bar-clear="8" data-game-controls="confirm-reset" role="group" aria-label="Reset to the deal?" className="flex h-[52px] shrink-0 items-center justify-end gap-2">
              <span className="mr-auto text-[14px] font-bold text-foreground">Reset to the deal?</span>
              <ArcadeControlButton
                type="button"
                aria-label="Cancel"
                disabled={locked}
                className="h-[44px] rounded-xl border-2 border-foreground/30 bg-background/40 px-3.5 text-[14px] font-bold text-foreground hover:bg-background/40 active:bg-foreground/15"
                onPressEnd={() => setConfirming(false)}
              >
                Cancel
              </ArcadeControlButton>
              <ArcadeControlButton
                type="button"
                aria-label="Reset"
                data-home-bar-fill=""
                disabled={locked}
                className="h-[52px] rounded-xl border-2 border-primary/70 bg-background/40 px-5 text-[15px] font-extrabold text-primary hover:bg-background/40 active:bg-primary/25"
                onPressEnd={(event) => {
                  if (mahjongReleaseInside(event)) send({ k: MAHJONG_INPUT_BUTTON, a: MAHJONG_BUTTON_RESET, b: 0, c: 0 });
                  setConfirming(false);
                }}
              >
                ⤺ Reset
              </ArcadeControlButton>
            </div>
          ) : (
          // The Shuffle button in the bottom corner, within thumb reach (rev 2: Undo and Reset, smaller, beside it); its row
          // ends 16 px above the bottom like every arcade control row.
          <div data-home-bar-clear="8" data-game-controls="shuffle" className="flex h-[52px] shrink-0 items-center justify-end gap-2">
            {rules ? (
              <ArcadeControlButton
                type="button"
                aria-label={rules.hintLimit === 1 ? "Hint (one this round)" : rules.hintCost ? `Hint (−${rules.hintCost})` : "Hint"}
                disabled={locked}
                data-mahjong-hint=""
                className="h-[44px] rounded-xl border-2 border-foreground/30 bg-background/40 px-3 text-[14px] font-bold text-foreground hover:bg-background/40 active:bg-foreground/15"
                onPressStart={() => send({ k: MAHJONG_INPUT_BUTTON, a: MAHJONG_BUTTON_HINT, b: 0, c: 0 })}
              >
                ✦ Hint
              </ArcadeControlButton>
            ) : null}
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
                  // Reset asks first (the overhaul); the question's own Reset fires on release over it.
                  onPressEnd={(event) => {
                    if (mahjongReleaseInside(event)) {
                      setConfirming(true);
                      cardConfirmCue();
                    }
                  }}
                >
                  ⤺ Reset
                </ArcadeControlButton>
              </>
            ) : null}
            <ArcadeControlButton
              type="button"
              data-home-bar-fill=""
              aria-label={`Shuffle (−${shuffleCost})`}
              disabled={locked}
              className={`h-[52px] rounded-xl border-2 border-primary/70 bg-background/40 ${rules ? "px-3.5" : "px-5"} text-[15px] font-extrabold text-primary hover:bg-background/40 shadow-[0_0_12px_rgba(245,184,46,0.22)] active:bg-primary/25`}
              onPressStart={() => send({ k: MAHJONG_INPUT_SHUFFLE, a: MAHJONG_BUTTON_SHUFFLE, b: 0, c: 0 })}
            >
              {/* A level's row holds Hint too, so its Shuffle says the cost alone (the full words are its label). */}
              {rules ? `⟳ −${shuffleCost}` : `⟳ Shuffle −${shuffleCost}`}
            </ArcadeControlButton>
          </div>
          )
        }
        onSubmit={(answer) => onSubmit(answer)}
        onDraftAnswer={onDraftAnswer}
      />
    </div>
  );
}

/** A pointer-up still over the button (Reset's trigger); a cancel, a lost capture or a release off it is not a press. */
export function mahjongReleaseInside(event: { type: string; clientX: number; clientY: number; currentTarget: { getBoundingClientRect(): { left: number; right: number; top: number; bottom: number } } }): boolean {
  if (event.type !== "pointerup") return false;
  const r = event.currentTarget.getBoundingClientRect();
  return event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
}

export function mahjongLine(r: { pairs: number; shuffles: number; cleared: boolean; clearedSeconds: number; state?: { face: readonly number[] } }): string {
  const head = `${r.pairs} of ${r.state ? r.state.face.length / 2 : MAHJONG_PAIRS} pairs`;
  const shuffles = r.shuffles === 0 ? "no shuffle" : `${r.shuffles} ${r.shuffles === 1 ? "shuffle" : "shuffles"}`;
  return r.cleared ? `${head} · cleared in ${r.clearedSeconds.toFixed(1)}s · ${shuffles}` : `${head} · ${shuffles}`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "mahjong") return null;
  const result = replayMahjongRun(puzzle.seed, myAnswer ?? "", puzzle.mahjongRev, levelOfPuzzle(puzzle));
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
