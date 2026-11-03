import { gameDisplayName } from "@/lib/duel/gameNames";
import { solvedMovesText } from "@/lib/duel/scoring";
import { useEffect, useMemo, useRef } from "react";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { ArrowPad, useGridMetrics } from "@/components/puzzles/GridDrag";
import { GravityBoard, type GravityBoardProps } from "@/components/puzzles/pattern/gravityBoard";
import { TopsyIntroExample, TopsyReveal, TopsyStage } from "@/components/puzzles/pattern/topsyBoard";
import { isTopsy } from "@/lib/duel/topsy";
import { Button } from "@/components/ui/button";
import {
  decodeGravityTilts,
  encodeGravityTilts,
  replayGravity,
} from "@/lib/duel/gravity";
import { useGameKeys } from "@/lib/desktop";
import { useStageState } from "@/lib/duel/stageState";
import { gravityTiltLimit, limitText } from "@/lib/duel/moveLimits";
import { GRAV_TIME_MS, type GravityDir, type GravityPuzzleData } from "@/lib/duel/types";
import { playCorrect, playLock, playSound } from "@/lib/sound";
import { LiveSummary, SummaryItem, useFrameProgress } from "@/components/puzzles/batchP/LiveSummary";
import { soundCue, useSolveMoment } from "@/lib/fx/patternFx";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

/** Ball colours in fixed order: gold, teal, purple, pink. */
const BALL_COLOURS = [GLYPH_COLOURS.GOLD, "#2FD4C4", GLYPH_COLOURS.PURPLE, GLYPH_COLOURS.PINK];
const ARROWS: Record<GravityDir, string> = { U: "▲", D: "▼", L: "◀", R: "▶", X: "↔", Y: "↕" };

/** The board: a tilting tray with raised blocks, four target sockets and four balls. */
function Board(props: Omit<GravityBoardProps, "colours">) {
  return <GravityBoard {...props} colours={BALL_COLOURS} />;
}

/** The old rounds' intro example (stored gravityRev 0–2 rounds; the intro now shows the remodel's still). */
export function ClassicIntroExample() {
  const example = { walls: [12], targets: [20, 21, 7, 24] };
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-3">
        <Board data={example} balls={[0, 1, 2, 4]} size={104} cols={5} />
        <span className="font-mono text-xs text-muted-foreground">▼</span>
        <Board data={example} balls={[20, 21, 7, 24]} size={104} cols={5} />
      </div>
      <p className="text-center text-xs text-muted-foreground">
        One tilt down: gold, teal and pink lock on their rings; purple stops on the block - and
        it's locked too.
      </p>
    </div>
  );
}

/** gravityRev 3 rounds play the remodel (topsyBoard.tsx); stored older rounds keep the four-ball board. */
function Stage(props: PuzzleStageProps) {
  return isTopsy(props.puzzle) ? <TopsyStage {...props} /> : <ClassicStage {...props} />;
}

function ClassicStage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey = "gravity" }: PuzzleStageProps) {
  const data = puzzle.type === "gravity" ? puzzle : null;
  const [tilts, setTilts] = useStageState<GravityDir[]>(stateKey, "gravityTilts", () => []);
  const [lean, setLean] = useStageState<GravityDir | null>(stateKey, "gravityLean", () => null);
  const submitted = useRef(false);
  const lockSeen = useRef(0);
  const boardSpaceRef = useRef<HTMLDivElement | null>(null);
  const boardSpace = useGridMetrics(boardSpaceRef, 1, 1);

  // gravityRev 1 (moveLimits.ts): a visible tilt limit; the last allowed tilt ends the board.
  const tiltLimit = data ? gravityTiltLimit(data) : null;
  const replay = useMemo(
    () => (data ? replayGravity(data.walls, data.starts, data.targets, tilts, tiltLimit) : null),
    [data, tilts, tiltLimit],
  );

  useEffect(() => {
    onDraftAnswer?.(encodeGravityTilts(tilts));
  }, [tilts, onDraftAnswer]);

  useEffect(() => {
    if (!replay) return;
    if (replay.locked > lockSeen.current && !replay.solved) {
      playLock();
      soundCue("gravity.lock");
    }
    lockSeen.current = replay.locked;
  }, [replay]);

  useEffect(() => {
    if (locked || submitted.current || !(replay?.solved || replay?.outOfTilts)) return;
    submitted.current = true;
    if (replay.solved) playCorrect();
    // Out of tilts: the board ends unfinished and goes in now.
    onSubmit(encodeGravityTilts(tilts));
  }, [replay?.solved, replay?.outOfTilts, tilts, locked, onSubmit]);

  const solving = useSolveMoment(Boolean(replay?.solved), "gravity.solve");
  const inFrame = useFrameProgress(replay?.locked ?? 0, 4, "locked");

  const undo = () => setTilts((current) => [...current, "X"]);
  const reset = () => setTilts((current) => [...current, "Y"]);

  // Desktop keys: Z or Backspace = Undo, R = Reset (the arrows and WASD tilt through ArrowPad).
  useGameKeys((kind, key, event) => {
    const used = key === "z" || key === "Backspace" || key === "r";
    if (!used || kind !== "down" || event.repeat) return used;
    if (locked || !tilts.length) return true;
    if (key === "r") reset();
    else undo();
    return true;
  });

  if (!data || !replay) return null;

  const press = (dir: GravityDir) => {
    if (locked || submitted.current || replay.solved || replay.outOfTilts) return;
    // A new tilt cuts the previous pull, so long pulls never overlap.
    playSound("pz_gravity_pull");
    soundCue("gravity.tilt");
    setLean(dir);
    setTimeout(() => setLean(null), 200);
    setTilts((current) => [...current, dir]);
  };

  return (
    <div data-stage-column="2" data-polish="gravity" className="flex min-h-0 flex-1 flex-col gap-2">
      {inFrame ? null : (
        <p className="shrink-0 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
          tilts <span className={replay.outOfTilts ? "text-warn" : "text-primary"} data-move-limit={tiltLimit ?? undefined}>{tiltLimit !== null ? limitText(replay.tilts, tiltLimit) : replay.tilts}</span> · locked{" "}
          <span className="text-primary">{replay.locked} / 4</span>
        </p>
      )}

      <div ref={boardSpaceRef} data-game-arena="board" className="flex min-h-0 flex-1 items-center justify-center">
        {boardSpace ? (
          <Board
            data={data}
            balls={replay.balls}
            lean={lean}
            size={Math.max(0, Math.floor(Math.min(boardSpace.width, boardSpace.height)))}
            solving={solving}
          />
        ) : null}
      </div>

      <LiveSummary
        items={[
          <SummaryItem
            key="tilts"
            label="Tilts"
            value={<span data-move-limit={tiltLimit ?? undefined}>{tiltLimit !== null ? limitText(replay.tilts, tiltLimit) : replay.tilts}</span>}
            warn={replay.outOfTilts}
          />,
        ]}
      />
      <div data-game-controls="pad" className="flex shrink-0 flex-col items-center gap-3">
        <ArrowPad onPress={press} disabled={locked || replay.solved || replay.outOfTilts} />
        <div data-game-controls="actions" className="flex gap-3 px-2">
          <Button
            type="button"
            variant="outline"
            disabled={locked || !tilts.length}
            onClick={undo}
            className="h-11 min-w-11 rounded-xl px-4 font-mono text-xs uppercase tracking-widest text-muted-foreground"
          >
            Undo
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={locked || !tilts.length}
            onClick={reset}
            className="h-11 min-w-11 rounded-xl px-4 font-mono text-xs uppercase tracking-widest text-muted-foreground"
          >
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}

function Reveal(props: PuzzleRevealProps) {
  return isTopsy(props.puzzle) ? <TopsyReveal {...props} /> : <ClassicReveal {...props} />;
}

function ClassicReveal({ timeLimitMs, puzzle, myAnswer, myCorrect, myMsRemaining, scoreParts }: PuzzleRevealProps) {
  if (puzzle.type !== "gravity") return null;
  const tiltLimit = gravityTiltLimit(puzzle);
  const mine = replayGravity(puzzle.walls, puzzle.starts, puzzle.targets, decodeGravityTilts(myAnswer ?? ""), tiltLimit);
  const best = decodeGravityTilts(puzzle.solution ?? "");
  return (
    <div className="grav-reveal flex min-h-0 w-full flex-1 flex-col items-center gap-3">
      <div className="grav-reveal-space">
        <div className="grav-reveal-square">
          <Board data={puzzle} balls={mine.balls} />
        </div>
      </div>
      {best.length ? (
        <p className="text-center font-display text-lg font-bold tracking-widest text-primary">
          {best.map((dir) => ARROWS[dir]).join(" ")}
        </p>
      ) : null}
      <p className="font-display text-2xl font-bold">
        <span className={myCorrect ? "text-primary" : "text-warn"}>
          {mine.tilts} {myCorrect ? "✓" : "✗"}
        </span>
        <span className="ml-2 font-mono text-base uppercase tracking-widest text-muted-foreground">
          {tiltLimit !== null ? `of ${tiltLimit} tilts` : "tilts"}{puzzle.minMoves ? ` · min ${puzzle.minMoves}` : ""}
        </span>
      </p>
      <p className="font-mono text-base text-muted-foreground">{mine.locked} / 4 balls locked{mine.outOfTilts ? " · out of tilts" : ""}</p>
      {myCorrect ? (
        <p className="font-mono text-base text-primary">
          {solvedMovesText(mine.tilts, puzzle.minMoves ?? 0, myMsRemaining, timeLimitMs, "B", scoreParts)}
        </p>
      ) : null}
    </div>
  );
}

/** Walls, starts, targets, the searched minimum and one shortest route come from the server. */
export const gravityMazePuzzle: PuzzleDefinition = {
  key: "gravity",
  name: gameDisplayName("gravity"),
  category: "pattern",
  // gravityRev 3 stores its own 120 s clock on the puzzle; this is stored older rounds' clock.
  timeLimitMs: GRAV_TIME_MS,
  revealMs: 8_000,
  generate: () =>
    ({ type: "gravity", walls: [], starts: [0, 8, 72, 80], targets: [40, 41, 39, 31] }) satisfies GravityPuzzleData,
  check: () => false,
  revealHeading: "Shortest routes",
  IntroExample: TopsyIntroExample,
  Stage,
  Reveal,
};
