import { gameDisplayName } from "@/lib/duel/gameNames";
import { useEffect, useRef, useState } from "react";

import {
  inkCheckpoint,
  inkIsLive,
  INK_CHECKPOINT_INTERVAL,
  INK_INPUT_RELEASE,
  INK_INPUT_UNDO,
  INK_INPUT_RESET,
  INK_INPUT_DROP_AGAIN,
  INK_INPUT_STROKE,
  INK_STEP_PX,
  INK_WORLD_H,
  INK_WORLD_W,
} from "@/lib/arcade/inkBridge";
import { encodeInkBridgeRun, replayInkBridgeRun } from "@/lib/duel/inkBridge";
import { INKBRIDGE_TIME_MS, type InkBridgePuzzleData } from "@/lib/duel/types";
import { drawInkRainbowExample, inkArenaScene, inkBridgeArtGameFor, inkSceneGround, INK_ART_BG } from "@/lib/arcade/inkBridge.renderer";
import { inkBridgeSounds } from "@/lib/fx/gameSounds";
import { ArcadeCanvasStage } from "@/components/puzzles/ArcadeCanvasStage";
import { Button } from "@/components/ui/button";
import { InkInputQueue, type InkPayload } from "@/lib/arcade/inkInputQueue";
import { useReducedMotion } from "@/lib/motion";
import { liveCue } from "@/lib/fx/momentCues";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Fixed intro shares the rainbow sprites without changing demo inputs. */
function IntroExample() {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    drawInkRainbowExample(ctx);
  }, []);
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <canvas ref={canvas} width={336} height={260} className="h-[130px] w-[168px] rounded-lg" aria-hidden="true" />
      <p className="text-center text-xs text-muted-foreground">Draw lines around the white birds, then RELEASE. Rounds 5-8 move; 9-10 are live!</p>
    </div>
  );
}

const artGames = new Map<number, ReturnType<typeof inkBridgeArtGameFor>>();
function inkBirdsArt(rev?: number) {
  const k = rev ?? 0;
  let g = artGames.get(k);
  if (!g) { g = inkBridgeArtGameFor(rev); artGames.set(k, g); }
  return g;
}

const LIVE_HINT_KEY = "duelz-inkbridge-live-hint";

function Stage({ puzzle, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const data: InkBridgePuzzleData | null = puzzle.type === "inkbridge" ? puzzle : null;
  // Stroke points and button presses waiting to be sent, one a tick (see InkInputQueue).
  const input = useRef(new InkInputQueue());
  // Live drops: what the last sent event was, to explain a stroke the sim refused.
  const lastSent = useRef<{ payload: InkPayload; penDown: number; lifts: number } | null>(null);
  const [reject, setReject] = useState<{ label: string; at: number } | null>(null);
  const reduced = useReducedMotion();
  // Levels 9–10 only: whether the current level is live (drawing continues while the ball falls).
  const liveLevelRef = useRef(false);
  const liveDroppingRef = useRef(false);
  const [liveLevel, setLiveLevel] = useState(false);
  const [liveDropping, setLiveDropping] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const hintSeen = useRef(false);
  useEffect(() => {
    if (!reject) return;
    const timer = window.setTimeout(() => setReject(null), 700);
    return () => window.clearTimeout(timer);
  }, [reject]);
  useEffect(() => {
    hintSeen.current = window.localStorage.getItem(LIVE_HINT_KEY) === "1";
  }, []);
  return (
    <div data-stage-column="2" className="flex min-h-0 w-full flex-1 flex-col gap-2">
      <ArcadeCanvasStage
        diagKey="inkbridge"
        label={gameDisplayName("inkbridge")}
        background={INK_ART_BG}
        fitWorld
        scene={(ctx, view, state) => inkArenaScene(ctx, view, inkSceneGround(state))}
        sceneKey={inkSceneGround}
        seed={data?.seed ?? 1}
        enabled={data !== null}
        locked={locked}
        worldW={INK_WORLD_W}
        worldH={INK_WORLD_H}
        game={inkBirdsArt(data?.inkRev)}
        sounds={inkBridgeSounds}
        checkpoint={inkCheckpoint}
        interval={INK_CHECKPOINT_INTERVAL}
        encodeRun={encodeInkBridgeRun}
        inputKind={INK_INPUT_STROKE}
        tickInput={(state) => {
          const live = inkIsLive(state.level, data?.inkRev);
          liveLevelRef.current = live;
          liveDroppingRef.current = live && state.dropping === 1;
          if (live !== liveLevel) setLiveLevel(live);
          if (liveDroppingRef.current !== liveDropping) setLiveDropping(liveDroppingRef.current);
          if (live && !hintSeen.current && !showHint) {
            hintSeen.current = true;
            window.localStorage.setItem(LIVE_HINT_KEY, "1");
            setShowHint(true);
          }
          // Explain the previous live event if the sim refused it (never a silent fade).
          const sent = lastSent.current;
          lastSent.current = null;
          if (sent && liveDroppingRef.current) {
            const p = sent.payload;
            if (p.k === INK_INPUT_STROKE && state.draftPenDown === 0 && (p.c === 1 || sent.penDown === 1)) {
              setReject({ label: state.ink < 2 * 256 ? "No ink" : "Too close", at: Date.now() });
              liveCue("inkbridge.reject", 300);
            }
          }
          const next = input.current.next(liveDroppingRef.current);
          if (next && liveDroppingRef.current) lastSent.current = { payload: next, penDown: state.draftPenDown, lifts: state.liveLifts };
          return next;
        }}
        pointer={(kind, x, y) => input.current.pointer(kind, x, y, liveDroppingRef.current)}
        onSubmit={(answer) => onSubmit(answer)}
        onDraftAnswer={onDraftAnswer}
        overlay={
          <>
            {liveLevel && (
              <span className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full border border-primary bg-primary/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-foreground">
                Live
              </span>
            )}
            {reject && (
              <>
                <span
                  key={`flash-${reject.at}`}
                  className={`pointer-events-none absolute inset-0 rounded-xl border-2 border-destructive ${reduced ? "" : "animate-ink-reject"}`}
                  aria-hidden="true"
                />
                <span
                  role="status"
                  className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2 rounded-full bg-destructive px-3 py-1 text-xs font-bold uppercase tracking-wide text-destructive-foreground"
                >
                  {reject.label}
                </span>
              </>
            )}
            {showHint && (
              <p className="pointer-events-none absolute bottom-2 left-1/2 w-[90%] -translate-x-1/2 rounded-md bg-background/80 px-2 py-1 text-center text-xs text-foreground">
                Draw one line, release, then keep drawing as it falls.
              </p>
            )}
          </>
        }
      />
      <div data-game-controls="tools" className="flex h-12 shrink-0 gap-1.5">
        {([ [INK_INPUT_UNDO, "UNDO"], [INK_INPUT_RESET, "RESET"], [INK_INPUT_RELEASE, "RELEASE"], [INK_INPUT_DROP_AGAIN, "DROP AGAIN"] ] as const).map(([k, label]) => (
          <Button key={k} type="button" disabled={locked || (k === INK_INPUT_UNDO && liveDropping)} variant={k === INK_INPUT_RELEASE ? "default" : "outline"} className="h-12 min-w-0 flex-1 px-1 text-xs font-bold" style={{ touchAction: "none" }} onPointerDown={(e) => {
            e.preventDefault();
            input.current.press(k);
          }}>{label}</Button>
        ))}
      </div>
    </div>
  );
}

export function inkBridgeLine(r: { levels: number; total: number; score: number; stars?: number; starLevels?: number }, rev?: number): string {
  const stars = r.starLevels ? ` · ${r.stars ?? 0} / ${r.starLevels} gold stars` : "";
  if (r.levels >= r.total) return `All ${r.total} levels${stars}`;
  if (rev === undefined || rev < 3) return `Level ${r.levels}${stars}`;
  // Which kind of level the run stopped on, in plain words.
  const kind = r.levels < 4 ? "the pot stands still" : r.levels < 8 ? "the pot moves" : "live drawing";
  return `Stopped on level ${r.levels + 1} (${kind})${stars}`;
}

function Reveal({ puzzle, myAnswer }: PuzzleRevealProps) {
  if (puzzle.type !== "inkbridge") return null;
  const result = replayInkBridgeRun(puzzle.seed, myAnswer ?? "", puzzle.inkRev);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-start gap-3 overflow-y-auto">
      <p className="whitespace-normal break-words text-center font-mono text-base font-bold text-foreground">
        {inkBridgeLine(result, puzzle.inkRev)}
      </p>
      <p className="shrink-0 text-center font-mono text-base text-muted-foreground">Same levels for everyone</p>
    </div>
  );
}

/** The seed is generated on the server; every run is replayed there for scoring. */
export const inkBridgePuzzle: PuzzleDefinition = {
  key: "inkbridge",
  name: gameDisplayName("inkbridge"),
  category: "arcade",
  timeLimitMs: INKBRIDGE_TIME_MS,
  revealMs: 6_000,
  generate: () => ({ type: "inkbridge", seed: 1 }) satisfies InkBridgePuzzleData,
  check: () => false,
  revealHeading: "Your run",
  IntroExample,
  Stage,
  Reveal,
};
