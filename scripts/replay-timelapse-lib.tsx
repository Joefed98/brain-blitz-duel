/**
 * Time-lapse boards for scripts/replay-flow-check.tsx: for each puzzle the
 * time-lapse supports, the game's own Reveal (as polished on main) is rendered
 * with growing prefixes of a stored move list, and its board must change from
 * frame to frame (move counters stripped, so only the drawn board counts). A board that renders the same for every prefix has stopped
 * being driven by the answer and is reported by name.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { renderToStaticMarkup } from "react-dom/server";

import { generatePuzzle } from "../src/lib/duel/generate.server";
import { puzzleDef, puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { planTimelapse, TIMELAPSE } from "../src/lib/replay/timelapse";
import { encodeActionLog } from "../src/lib/duel/actionLog";
import { laserAction } from "../src/lib/duel/laserLog";

/** A move list each puzzle could store: its own minimum solution where it keeps one. */
export function answerFor(type: string, p: any): string {
  switch (type) {
    case "unblock":
    case "tower":
    case "tubes":
    case "gravity":
      return String(p.solution);
    case "maze":
    case "flood":
    case "rings":
      return (p.solution as number[]).join(",");
    case "strikeout":
      // strikeoutRev 2: one word at a time, so solve each in turn (every frame reveals a word).
      return p.strikeoutRev >= 2 ? (p.words ?? []).map((w: string, i: number) => `${i}${w}`).join(",") : "E,A,R,S,T,O,I,N";
    case "wordslide":
      return "r0+,r1+,c2-,r3+,c0+,r4-";
    case "push":
      return "LLUURRDDLURD";
    case "wordsearch":
      // Each placed word selected start to end, in placement order.
      return (p.placements ?? []).map((w: { cells: number[] }) => `${w.cells[0]}.${w.cells[w.cells.length - 1]}`).join(",");
    case "letterwheel":
      return (p.words ?? []).join(",");
    case "laser":
      // Lightbender's action log (alogRev 1): each solution piece placed, a turn, then FIRE, at uneven times.
      return encodeActionLog([
        ...(p.solution ?? []).map((m: { cell: number; kind: string }, i: number) => ({ a: laserAction.place(m.cell, m.kind as never), t: 1500 + i * 1300 + (i % 2) * 2200 })),
        { a: laserAction.fire(), t: 30_000 },
      ]);
    default:
      return "";
  }
}

/**
 * Two views of a frame that a move counter can't change: the markup without its
 * text (positions, colours, classes) and the markup without its digits (letters
 * moved on a board, as on Slider). A board is driven when either view changes.
 */
const board = (html: string) =>
  `${html.replace(/>[^<]*</g, "><")}\u0000${html.replace(/\d+/g, "#")}`;

export function runTimelapseChecks(): {
  checks: number;
  failures: string[];
  driven: string[];
  stopped: string[];
} {
  const failures: string[] = [];
  const driven: string[] = [];
  const stopped: string[] = [];
  let checks = 0;
  const error = console.error;
  for (const type of Object.keys(TIMELAPSE)) {
    checks++;
    const puzzle = generatePuzzle(type as PuzzleType) as PuzzleData;
    const plan = planTimelapse(puzzle, answerFor(type, puzzle), true);
    if (!plan) {
      failures.push(`${type}: no time-lapse plan for a stored move list`);
      continue;
    }
    const Reveal = puzzleDef(puzzle.type).Reveal;
    const render = (answer: string) => {
      console.error = () => {};
      try {
        return board(
          renderToStaticMarkup(
            <Reveal
              puzzle={puzzle}
              myAnswer={answer}
              myCorrect={true}
              myReactionAvgMs={null}
              timeLimitMs={puzzleTimeLimitMs(puzzle)}
            />,
          ),
        );
      } finally {
        console.error = error;
      }
    };
    let frames: string[];
    try {
      frames = plan.frames.map(render);
    } catch (err) {
      failures.push(`${type}: the reveal board throws on a prefix (${(err as Error).message})`);
      stopped.push(type);
      continue;
    }
    const distinct = new Set(frames).size;
    // Driven: the board changes along the moves (several distinct boards, and the first differs from the last).
    if (distinct >= 2 && frames[0] !== frames[frames.length - 1])
      driven.push(`${type} (${distinct} boards / ${frames.length} frames)`);
    else {
      stopped.push(type);
      failures.push(
        `${type}: the polished reveal board no longer changes with the move list (${distinct} distinct boards)`,
      );
    }
  }
  return { checks, failures, driven, stopped };
}
