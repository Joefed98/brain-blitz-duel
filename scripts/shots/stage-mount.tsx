/**
 * Browser-side helper for scripts/shots/level-shots.ts (served by the Vite dev server, imported from Playwright): mounts
 * one game's real Stage on a given puzzle in a phone-sized play column, with the puzzle screen's attributes (so the
 * games' own and the overhaul's stylesheets apply). For review pictures of the difficulty levels, whose live deals
 * need the database; never imported by the app.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";

import { miniSudokuPuzzle } from "@/puzzles/miniSudoku";
import { sortTubesPuzzle } from "@/puzzles/sortTubes";
import { towerPuzzle } from "@/puzzles/tower";
import { safeCrackerPuzzle } from "@/puzzles/safeCracker";
import { nonogramPuzzle } from "@/puzzles/nonogram";
import { colourFloodPuzzle } from "@/puzzles/colourFlood";
import { minesweeperPuzzle } from "@/puzzles/minesweeper";
import type { PuzzleData } from "@/lib/duel/types";

const DEFS = { sudoku: miniSudokuPuzzle, tubes: sortTubesPuzzle, tower: towerPuzzle, safe: safeCrackerPuzzle, nonogram: nonogramPuzzle, flood: colourFloodPuzzle, minesweeper: minesweeperPuzzle } as const;
let root: Root | null = null;

export function mountStage(type: keyof typeof DEFS, puzzle: PuzzleData, w: number, h: number): void {
  root?.unmount();
  document.getElementById("stage-host")?.remove();
  const host = document.createElement("div");
  host.id = "stage-host";
  host.style.cssText = `position:fixed;inset:0;width:${w}px;height:${h}px;z-index:99999;background:#07070A;display:flex;flex-direction:column`;
  host.innerHTML = `<div data-puzzle-play="" data-puzzle-screen="" data-category="logic" class="game-screen" style="flex:1;display:flex;flex-direction:column;min-height:0;padding:72px 12px 24px"><div class="game-column" style="flex:1;display:flex;flex-direction:column;min-height:0;container-type:size"><div data-game-region="" data-polish="${type}" style="flex:1;display:flex;flex-direction:column;min-height:0"><div data-game-stage="" id="stage-slot" style="flex:1;display:flex;flex-direction:column;min-height:0"></div></div></div></div>`;
  document.body.appendChild(host);
  const Stage = DEFS[type].Stage!;
  root = createRoot(host.querySelector("#stage-slot")!);
  root.render(
    <QueryClientProvider client={new QueryClient()}>
      <Stage puzzle={puzzle} locked={false} onSubmit={() => {}} onDraftAnswer={() => {}} phaseStartedAt={Date.now()} now={Date.now()} />
    </QueryClientProvider>,
  );
}
