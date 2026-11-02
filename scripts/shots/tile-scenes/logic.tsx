/** Logic games' tile scenes, built from each game's own board components and CSS (scene.tsx has the rules). */
import type { ReactNode } from "react";

import { digInit, type DigBoard } from "@/lib/duel/dig";
import { Panel as BombPanel } from "@/puzzles/bombDefusal";
import { Board as FloodBoard } from "@/puzzles/colourFlood";
import { Grid as DigGrid } from "@/puzzles/dig";
import { Board as LampBoard } from "@/puzzles/lightUp";
import { LightsGrid } from "@/puzzles/lightsOut";
import { SudokuGrid } from "@/puzzles/miniSudoku";
import { Board as NonoBoard } from "@/puzzles/nonogram";
import { Dial } from "@/puzzles/safeCracker";
import { Board as ShikakuBoard } from "@/puzzles/shikaku";
import { Tubes } from "@/puzzles/sortTubes";
import { Board as CampBoard } from "@/puzzles/tents";
import { Pegs } from "@/puzzles/tower";
import { FencesBoard } from "@/puzzles/fences";
import { FillominoBoard } from "@/puzzles/fillomino";
import { BridgesBoard } from "@/puzzles/bridges";
import { bridgePairs } from "@/lib/duel/bridges";
import { cellEdges, fencesEdgeCount, FENCES_CROSS, FENCES_LINE } from "@/lib/duel/fences";

import { Scaled, domScene, type SceneSet } from "./scene";

/** The live round's polish hooks (the in-play look of every logic board). */
const PLAY = { "data-puzzle-play": "", "data-category": "logic" };

/** A piece of the board at natural size w × h (a size container, as the stage is, when `box` is given), placed and scaled. */
function Piece({ x, y, scale, w, h, box, children }: { x: number; y: number; scale: number; w: number; h?: number; box?: { w: number; h: number }; children: ReactNode }) {
  const inner = <div style={{ width: w, height: h, position: "relative" }}>{children}</div>;
  return (
    <Scaled x={x} y={y} scale={scale} attrs={PLAY}>
      {box ? <div style={{ width: box.w, height: box.h, containerType: "size", position: "relative" }}>{inner}</div> : inner}
    </Scaled>
  );
}

const noop = () => undefined;
const TENTS_X = -16;
const TENTS_Y = -26;
const TUBES_Y = 16;


/** Fences' tile: a 4 × 4 board whose loop runs round `region`, every clue its cell's count, one edge crossed. */
function fencesTile(size: number, region: readonly number[], shown: readonly number[]) {
  const count = new Map<number, number>();
  for (const cell of region) for (const e of cellEdges(size, cell)) count.set(e, (count.get(e) ?? 0) + 1);
  const states = Array.from({ length: fencesEdgeCount(size) }, (_, e) => (count.get(e) === 1 ? FENCES_LINE : 0));
  const crossed = states.findIndex((s, e) => s === 0 && e > 4);
  if (crossed >= 0) states[crossed] = FENCES_CROSS;
  const lines = new Set(states.flatMap((s, e) => (s === FENCES_LINE ? [e] : [])));
  const clues = Array.from({ length: size * size }, (_, cell) => (shown.includes(cell) ? cellEdges(size, cell).filter((e) => lines.has(e)).length : -1));
  return { states, clues };
}
const FENCES_TILE = fencesTile(4, [0, 1, 4, 5, 6, 10], [0, 5, 6, 11, 15]);
const BRIDGE_ISLANDS = [
  { cell: 0, n: 3 },
  { cell: 3, n: 3 },
  { cell: 12, n: 2 },
  { cell: 15, n: 2 },
];
const BRIDGE_COUNTS = bridgePairs(BRIDGE_ISLANDS, 4).map((p) => (p.a === 0 && p.b === 1 ? 2 : 1));

export const LOGIC_SCENES: SceneSet = {
  // Shikaku: three gold glass panes laid over the grid, two areas still open with their clues.
  shikaku: domScene(() => (
    <Piece x={6} y={6} scale={1} w={92}>
      <div className="logic-glass-frame">
        <ShikakuBoard
          size={4}
          clues={[
            { cell: 0, n: 4 },
            { cell: 2, n: 2 },
            { cell: 7, n: 3 },
            { cell: 8, n: 4 },
            { cell: 10, n: 2 },
          ]}
          rects={[
            { r0: 0, c0: 0, r1: 1, c1: 1 },
            { r0: 0, c0: 2, r1: 0, c1: 3 },
            { r0: 1, c0: 3, r1: 3, c1: 3 },
          ]}
        />
      </div>
    </Piece>
  )),

  // Bomb Defusal: the bomb plate with three wires (one cut) and a red cap.
  bomb: domScene(() => (
    <Piece x={1} y={8} scale={0.6} w={170} h={146}>
      <BombPanel
        wires={["RED", "BLUE", "YELLOW"]}
        buttons={[{ label: "A", colour: "RED" }]}
        light
        serial="317"
        switchPosition="MID"
        cutWires={[1]}
      />
    </Piece>
  )),

  // Mosaic: a 5 × 5 heart in gold cells, its clues along the top and side.
  nonogram: domScene(() => {
    const pic = ["01010", "11111", "11111", "01110", "00100"];
    const marks = pic.flatMap((row) => [...row].map((c) => (c === "1" ? 1 : 0)));
    const runs = (line: boolean[]) => {
      const out: number[] = [];
      let n = 0;
      for (const on of line) {
        if (on) n++;
        else if (n) (out.push(n), (n = 0));
      }
      if (n) out.push(n);
      return out;
    };
    const rows = pic.map((row) => runs([...row].map((c) => c === "1")));
    const cols = [0, 1, 2, 3, 4].map((c) => runs(pic.map((row) => row[c] === "1")));
    return (
      <Piece x={3} y={4} scale={0.48} w={196}>
        <NonoBoard rows={rows} cols={cols} marks={marks as never} size={5} cell={32} />
      </Piece>
    );
  }),

  // Box Six: the corner of the grid, a 2 × 3 box in its thick frame with big digits, one picked in gold.
  sudoku: domScene(() => {
    const values = [1, 2, 3, 0, 5, 0, 4, 5, 6, 0, 0, 3, 0, 3, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 0];
    const tones = values.map((_, cell) => (cell === 7 ? "entry" : "given")) as never;
    return (
      <Piece x={-2} y={-2} scale={1} w={180} h={180}>
        <SudokuGrid values={values} tones={tones} selected={7} />
      </Piece>
    );
  }),

  // Safe Cracker: the steel door with its three brass drums, two already gold.
  safe: domScene(() => (
    <Piece x={2} y={14} scale={0.5} w={200} box={{ w: 200, h: 420 }}>
      <div data-logic-stage="safe">
      <div className="safe-metal-panel logic-safe-door relative flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-border p-3">
        <span aria-hidden="true" className="logic-safe-hinge" />
        <span aria-hidden="true" className="logic-rivet" data-corner="tl" />
        <span aria-hidden="true" className="logic-rivet" data-corner="tr" />
        <span aria-hidden="true" className="logic-rivet" data-corner="bl" />
        <span aria-hidden="true" className="logic-rivet" data-corner="br" />
        <div className="flex gap-2">
          <Dial digit={4} order={0} gold />
          <Dial digit={8} order={1} gold />
          <Dial digit={2} order={2} />
        </div>
      </div>
      </div>
    </Piece>
  )),

  // Colour Flood: the wet paint spreading from the top-left over the board's colour regions.
  flood: domScene(() => (
    <Piece x={7} y={7} scale={1} w={90}>
      <FloodBoard grid={[3, 3, 1, 2, 0, 3, 3, 3, 1, 1, 2, 3, 0, 4, 1, 2, 0, 0, 4, 4, 1, 1, 2, 4, 3]} size={5} cell={18} />
    </Piece>
  )),

  // Hanoi: the three wooden posts, rings graduated, the gold-based target post.
  tower: domScene(() => (
    <Piece x={0} y={8} scale={1} w={104} h={88}>
      <Pegs pegs={[[5, 4, 3], [2], [1]]} discs={5} targetPeg={2} discHeight="12px" />
    </Piece>
  )),

  // Tents and Trees: a corner of the campsite, trees with a tent pitched beside each and a grass tuft.
  tents: domScene(() => (
    <Piece x={TENTS_X} y={TENTS_Y} scale={1} w={124}>
      <CampBoard size={3} trees={[0, 5, 7]} rowCounts={[1, 1, 1]} colCounts={[1, 1, 1]} marks={[0, 1, 0, 0, 2, 0, 1, 0, 0] as never} countSize={14} gap={3} />
    </Piece>
  )),

  // Lamplighter: two lamps in opposite corners whose beams light every square round the 0 wall.
  lightup: domScene(() => {
    const marks = new Array(9).fill(0);
    marks[0] = 1;
    marks[8] = 1;
    return (
      <Piece x={6} y={6} scale={1} w={92}>
        <LampBoard board={{ size: 3, walls: [4], wallNumbers: [0] } as never} marks={marks as never} />
      </Piece>
    );
  }),

  // Polypotions: three glass flasks of layered potions, one sorted and corked.
  tubes: domScene(() => (
    <Piece x={-2} y={TUBES_Y} scale={0.55} w={300} box={{ w: 300, h: 300 }}>
      <Tubes tubes={[[0, 1, 0, 2], [1, 1, 1, 1, 1], [2, 0, 2], [], []] as never} onTube={noop} />
    </Piece>
  )),

  // Blackout: a 3 × 3 board of bulbs, a cross of them lit.
  lightsout: domScene(() => (
    <Piece x={6} y={6} scale={1} w={92}>
      <LightsGrid lights={[false, true, false, true, true, true, false, true, false]} cols={3} gap={6} />
    </Piece>
  )),

  // Dig (retired): the pool above the sand plug and the drain below.
  dig: domScene(() => {
    const board: DigBoard = {
      cols: 6,
      rows: 6,
      tiles: "#....#" + "#....#" + "##s###" + "##ss##" + "###D##" + "######",
      water: "000000" + "044440" + "000000" + "000000" + "000000" + "000000",
      budget: 4,
      minDigs: 4,
      targets: [26],
    } as DigBoard;
    return (
      <Piece x={6} y={6} scale={1} w={92} h={92}>
        <DigGrid board={board} state={digInit(board)} />
      </Piece>
    );
  }),
  // Fences: a loop drawn round part of a 4 × 4 board, its numbers met, one edge crossed out.
  fences: domScene(() => (
    <Piece x={6} y={6} scale={1} w={92}>
      <div className="logic-glass-frame fences-frame" style={{ width: 92, height: 92 }}>
        <FencesBoard size={4} clues={FENCES_TILE.clues} states={FENCES_TILE.states} small />
      </div>
    </Piece>
  )),
  // Fillomino: a 4 × 4 grid split into numbered regions, one square still blank.
  fillomino: domScene(() => (
    <Piece x={6} y={6} scale={1} w={92}>
      <div className="logic-glass-frame" style={{ width: 92 }}>
        <FillominoBoard
          size={4}
          values={[3, 3, 2, 2, 3, 1, 4, 4, 2, 4, 4, 1, 2, 1, 0, 3]}
          tones={["given", "entry", "given", "entry", "entry", "given", "given", "entry", "given", "entry", "entry", "entry", "given", "entry", "given", "entry"]}
          small
        />
      </div>
    </Piece>
  )),
  // Bridges: four islands, a double bridge across the top and single bridges down the sides.
  bridges: domScene(() => (
    <Piece x={6} y={6} scale={1} w={92}>
      <div className="logic-glass-frame bridges-frame" style={{ width: 92, height: 92 }}>
        <BridgesBoard size={4} islands={BRIDGE_ISLANDS} counts={BRIDGE_COUNTS} small />
      </div>
    </Piece>
  )),
};
