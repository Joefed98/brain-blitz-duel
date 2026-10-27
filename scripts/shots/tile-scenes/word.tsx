/** Word games' tile scenes, built from each game's own components and CSS (scene.tsx has the rules). */
import { WordsmithRing } from "@/components/puzzles/WordsmithRing";
import { WordHuntBoard } from "@/components/puzzles/WordHuntPuzzle";
import { TOY_BRASS, TOY_BRASS_DARK, toyBoard } from "@/lib/arcade/toybox.renderer";
import { PICK_FACE, TILE_EDGE, TILE_FACE, drawTile } from "@/lib/arcade/wordfall.renderer";
import { WF_CELL } from "@/lib/arcade/wordfall";
import { SW_TILE_CELLS } from "@/lib/duel/swapword";
import { Grid as CodewordGrid } from "@/puzzles/codeword";
import { Crossword as WheelCrossword, Wheel as LetterWheel } from "@/puzzles/letterWheel";
import { Row as StrikeoutRow, Strikes as StrikeoutStrikes } from "@/puzzles/strikeout";
import { Board as SwapwordBoard } from "@/puzzles/swapword";
import { Grid as LookoutGrid } from "@/puzzles/wordSearch";
import { Board as SliderBoard } from "@/puzzles/wordSlide";

import { Scaled, at, canvasScene, domScene, type SceneSet } from "./scene";

/** The word category's colour on the wrapper (the games' polish reads --category-accent). */
const WORD = { "data-category": "word" };

// Slider's Board: 5 columns of 52 px tiles (4 px gaps, 6 px padding, 2 px border), then the padlock column.
const SL_CELL = 52;
const SL_STEP = SL_CELL + 4;
/** The board's left edge to the gap before its third column (the scene shows columns 3–5 and the padlocks). */
const SL_CROP = 2 + 6 + 2 * SL_STEP - 2;
const SL_SCALE = 0.42;
/** Three rows of the board: border, padding, three tiles and two gaps. */
const SL_ROWS_H = 2 * 2 + 2 * 6 + 3 * SL_CELL + 2 * 4;

// Interlock: the stage's own board markup (tileGrid's Stage), a 4 × 4 corner of it: STAR down crossing TAPE across.
const IL = ["S", "", "", "", "T", "A", "P", "E", "A", "", "", "", "R", "", "", ""];
const IL_CELL = 38;

// Swapword: the top-left loop of the figure-eight board (tiles on cells 0–3, 6, 9, 12, 15, 18–21).
const SW_LETTERS: Record<number, [string, 0 | 1 | 2]> = {
  0: ["W", 2], 1: ["O", 2], 2: ["D", 1], 3: ["R", 1],
  6: ["A", 2], 9: ["E", 0],
  12: ["V", 1], 15: ["O", 2],
  18: ["E", 2], 19: ["N", 0], 20: ["T", 2], 21: ["P", 1],
};
const SW_TILE_LETTERS = SW_TILE_CELLS.map((cell) => SW_LETTERS[cell]?.[0] ?? "S").join("");
const SW_TILE_LOOKS = SW_TILE_CELLS.map((cell) => SW_LETTERS[cell]?.[1] ?? 0);
const SW_SIDE = 150;

export const WORD_SCENES: SceneSet = {
  // Nucleus: the atom board (WordsmithRing) with its blue nucleus, a word being built in gold.
  wordsmith: domScene(() => (
    <Scaled x={2} y={2} scale={0.4} attrs={{ ...WORD, "data-word-polish": "wordsmith" }}>
      <div style={{ width: 250 }}>
        <WordsmithRing letters={["P", "L", "A", "N", "E", "T", "S"]} selected={[0, 1, 2, 4]} />
      </div>
    </Scaled>
  )),

  // Interlock: lettered tiles crossing on the board (STAR down, TAPE across, both in words), the rest sunk slots.
  tilegrid: domScene(() => (
    <Scaled x={8} y={8} scale={0.52} attrs={{ ...WORD, "data-polish": "tilegrid", "data-word-polish": "tilegrid" }}>
      <div data-game-arena="board" className="relative flex items-center justify-center">
        <div className="grid shrink-0 rounded-xl border-2 border-border bg-card p-1" style={{ gridTemplateColumns: `repeat(4, ${IL_CELL}px)`, gap: 2 }}>
          {IL.map((letter, i) => (
            <span
              key={i}
              data-word-cell={letter ? "true" : undefined}
              data-bw-slot={letter ? undefined : "empty"}
              className={`word-letter-tile interlock-cell flex items-center justify-center rounded-md font-display text-xl font-bold ${letter ? "bg-primary text-primary-foreground" : "bg-background/40"}`}
              style={{ height: IL_CELL, fontSize: 24 }}
            >
              {letter}
            </span>
          ))}
        </div>
      </div>
    </Scaled>
  )),

  // Slider: three rows of its letter tiles (a locked word, a made word, one still jumbled) and their padlocks.
  wordslide: domScene(() => (
    <Scaled x={3} y={(104 - SL_ROWS_H * SL_SCALE) / 2} scale={SL_SCALE} attrs={{ ...WORD, "data-polish": "wordslide", "data-word-polish": "wordslide" }}>
      <div style={{ height: SL_ROWS_H, width: 360 - SL_CROP, overflow: "hidden" }}>
        <div style={{ marginLeft: -SL_CROP }}>
        <SliderBoard grid={[..."CRANEMOVESTPAIL"]} cell={SL_CELL} good={new Set([1])} locked={new Set([0])} onLock={() => undefined} />
        </div>
      </div>
    </Scaled>
  )),

  // Roundabout: a filled crossword word over the letter wheel, a word being traced in gold.
  letterwheel: domScene(() => (
    <Scaled x={(104 - 160 * 0.42) / 2} y={1} scale={0.42} attrs={{ ...WORD, "data-polish": "letterwheel", "data-word-polish": "letterwheel" }}>
      <div className="flex flex-col items-center" style={{ width: 160, gap: 8 }}>
        <div style={{ width: 160, height: 78 }}>
          <WheelCrossword
            cols={4}
            rows={2}
            slots={[{ row: 0, col: 0, across: true, len: 4 }, { row: 0, col: 3, across: false, len: 2 }]}
            letters={new Map([[0, "R"], [1, "A"], [2, "T"], [3, "E"]])}
            cellPx={38}
          />
        </div>
        <div style={{ width: 160, height: 160, containerType: "size" }}>
          <LetterWheel letters="STARE" path={[0, 1, 2, 3]} disabled />
        </div>
      </div>
    </Scaled>
  )),

  // Strikeout: two strikes used, a word with found gold letters and hidden wells.
  strikeout: domScene(() => (
    <Scaled x={0} y={0} attrs={{ ...WORD, "data-word-polish": "strikeout" }}>
      <div className="flex flex-col items-center justify-center" style={{ width: 104, height: 104, gap: 16 }}>
        <StrikeoutStrikes used={2} max={3} />
        <StrikeoutRow letters={["P", "", "A", ""]} looks={["shown", "hidden", "shown", "hidden"]} tile={22} tileH="26px" rowIndex={0} />
      </div>
    </Scaled>
  )),

  // Cryptogrid: the numbered grid round a black block, C A T decoded, number 4 selected.
  codeword: domScene(() => (
    <Scaled x={6} y={6} attrs={{ ...WORD, "data-word-polish": "codeword" }}>
      <div data-game-arena="codeword" style={{ width: 92, height: 92 }}>
        <CodewordGrid
          size={3}
          cells={[1, 2, 3, 4, 0, 5, 6, 2, 3]}
          letters={["C", "A", "T", "", "", ""]}
          look={(n) => (n === 1 ? "given" : n === 4 ? "selected" : n <= 3 ? "right" : "plain")}
        />
      </div>
    </Scaled>
  )),

  // Swapword: one loop of the figure-eight board, tiles gold (in place), teal (elsewhere in the word) and slate.
  swapword: domScene(() => (
    <Scaled x={3} y={3} attrs={{ ...WORD, "data-word-polish": "swapword" }}>
      <div style={{ width: 99, height: 99, overflow: "hidden" }}>
        <SwapwordBoard letters={SW_TILE_LETTERS} looks={SW_TILE_LOOKS} selected={SW_TILE_CELLS.indexOf(21)} side={SW_SIDE} />
      </div>
    </Scaled>
  )),

  // Lookout: a letter grid with LION found on the diagonal (gold run and its strike line).
  wordsearch: domScene(() => (
    <Scaled x={4} y={4} attrs={{ ...WORD, "data-polish": "wordsearch" }}>
      <div data-game-arena="board" style={{ width: 96, height: 96, containerType: "size" }}>
        <LookoutGrid grid="LTEKAIRSGBOUPWEN" size={4} gold={new Set([0, 5, 10, 15])} foundPaths={[[0, 5, 10, 15]]} />
      </div>
    </Scaled>
  )),

  // Forage: a corner of the letter board with a word being traced (lit tiles and the glowing trail) and the golden tile.
  wordhunt: domScene(() => (
    <Scaled x={2} y={2} attrs={{ ...WORD, "data-polish": "wordhunt" }}>
      <div data-game-arena="board">
        <WordHuntBoard grid={[..."CAPESROTLINDMEGKUBATOWHSY"]} path={[0, 1, 6, 7]} size={170} golden={12} />
      </div>
    </Scaled>
  )),

  // Letterfall: wooden tiles stacked in its toybox well, a word picked in brass with its trail, one tile falling.
  wordfall: canvasScene((c) => {
    const s = 0.44;
    const L = (ch: string) => ch.charCodeAt(0) - 65;
    const ox = (104 - 3 * WF_CELL * s) / 2;
    const oy = 104 - 3 * WF_CELL * s - 7;
    at(c, ox, oy, s, () => {
      toyBoard(c, 0, -WF_CELL * 0.4, 3 * WF_CELL, 3.4 * WF_CELL, 12);
      c.save();
      c.textAlign = "center";
      c.textBaseline = "middle";
      const tile = (col: number, row: number, ch: string, picked = false) =>
        drawTile(c, col * WF_CELL + 2, row * WF_CELL + 2, L(ch), picked ? PICK_FACE : TILE_FACE, picked ? TOY_BRASS_DARK : TILE_EDGE);
      tile(0, 2, "S");
      tile(0, 1, "E");
      tile(1, 2, "T", true);
      tile(1, 1, "A", true);
      tile(2, 2, "C", true);
      // The chain's trail through the picked tiles' centres (C → A → T).
      const mid = (col: number, row: number) => [col * WF_CELL + WF_CELL / 2, row * WF_CELL + WF_CELL / 2] as const;
      c.globalAlpha = 0.5;
      c.strokeStyle = TOY_BRASS;
      c.lineWidth = 9;
      c.lineCap = "round";
      c.lineJoin = "round";
      c.beginPath();
      [mid(2, 2), mid(1, 1), mid(1, 2)].forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.stroke();
      c.globalAlpha = 1;
      tile(2, 0.2, "O");
      c.restore();
    });
  }),
};
