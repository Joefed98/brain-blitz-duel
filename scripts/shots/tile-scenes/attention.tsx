/** Attention games' tile scenes (scene.ts has the rules). */
import { CLASH_COLOURS } from "@/lib/arcade/colourClash";
import { paintGate, paintLaneGlow } from "@/lib/arcade/colourClash.renderer";
import { MAZE_E, MAZE_N, MAZE_S, MAZE_W } from "@/lib/duel/maze";
import type { SpotShape } from "@/lib/duel/types";
import { TallyDefs, TallyGlyph } from "@/puzzles/countUp";
import { MazeBoard } from "@/puzzles/mazeDash";
import { Board as PairBoard } from "@/puzzles/pairMatch";
import { CellBox as EagleCell } from "@/puzzles/symbolScan";
import { Panel as SpotPanel } from "@/puzzles/spotTheDifference";

import { Scaled, at, canvasScene, domScene, type SceneSet } from "./scene";

/** The live round's polish hooks (the in-play look of every attention board). */
const PLAY = { "data-puzzle-play": "", "data-category": "attention" };

/* Mixed Signals' renderer constants (colourClash.renderer.ts: the gate's glow margin and wash). */
const CLASH_GLOW = 14;
const CLASH_WASH = 34;
const CLASH_BG = "#07070D";

/** The falling word on its lifted plate, exactly as colourClash's draw paints a plain word (world px). */
function clashWord(c: CanvasRenderingContext2D, word: string, ink: string, x: number, y: number): void {
  c.font = "bold 30px ui-sans-serif, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "alphabetic";
  const w = c.measureText(word).width + 18;
  const plateAt = () => {
    c.beginPath();
    c.roundRect(x - w / 2, y - 28, w, 36, 9);
  };
  c.save();
  c.shadowColor = "rgba(255,255,255,0.28)";
  c.shadowBlur = 12;
  c.fillStyle = "rgba(14,14,22,0.92)";
  plateAt();
  c.fill();
  c.restore();
  c.fillStyle = "rgba(0,0,0,0.45)";
  c.beginPath();
  c.roundRect(x - w / 2 + 1, y + 8, w - 2, 4, 3);
  c.fill();
  const plate = c.createLinearGradient(0, y - 28, 0, y + 8);
  plate.addColorStop(0, "#2A2A36");
  plate.addColorStop(1, "#111119");
  c.fillStyle = plate;
  plateAt();
  c.fill();
  c.strokeStyle = "rgba(255,255,255,0.16)";
  c.lineWidth = 1;
  c.stroke();
  c.fillStyle = "rgba(255,255,255,0.3)";
  c.fillRect(x - w / 2 + 8, y - 28, w - 16, 1);
  c.lineJoin = "round";
  c.lineWidth = 4;
  c.strokeStyle = CLASH_BG;
  c.strokeText(word, x, y);
  c.fillStyle = ink;
  c.fillText(word, x, y);
}

const spotRow = (colours: SpotShape["colour"][]): SpotShape[] =>
  (["circle", "star", "triangle"] as const).map((kind, cell) => ({ cell, kind, colour: colours[cell]! }));

export const ATTENTION_SCENES: SceneSet = {
  // Tally: a heap of its bevelled shapes, three gold stars among them.
  countup: domScene(() => {
    const items = [
      { shape: "circle", colour: "BLUE", x: 26, y: 28, size: 40, rot: 0 },
      { shape: "star", colour: "GOLD", x: 70, y: 24, size: 40, rot: 12 },
      { shape: "square", colour: "PURPLE", x: 74, y: 70, size: 38, rot: 24 },
      { shape: "star", colour: "GOLD", x: 30, y: 72, size: 42, rot: -8 },
      { shape: "triangle", colour: "GREEN", x: 50, y: 50, size: 36, rot: 14 },
      { shape: "star", colour: "GOLD", x: 84, y: 46, size: 30, rot: 30 },
    ] as const;
    return (
      <Scaled attrs={PLAY}>
        <div style={{ position: "relative", width: 104, height: 104 }}>
          <TallyDefs />
          {items.map((it, i) => (
            <span key={i} className="absolute flex items-center justify-center" style={{ left: `${it.x}%`, top: `${it.y}%`, zIndex: i, transform: `translate(-50%,-50%) rotate(${it.rot}deg)` }}>
              <TallyGlyph shape={it.shape} colour={it.colour} size={it.size} />
            </span>
          ))}
        </div>
      </Scaled>
    );
  }),

  // Labyrinth: a small stone maze, the gold route drawn most of the way, the ball at its head, the star exit.
  maze: domScene(() => (
    <Scaled x={6} y={6} scale={1} attrs={PLAY}>
      <div data-polish="maze" style={{ width: 92, height: 92 }}>
        <MazeBoard
          cells={[MAZE_E | MAZE_S, MAZE_W | MAZE_E, MAZE_W | MAZE_S, MAZE_N | MAZE_E, MAZE_W | MAZE_S, MAZE_N | MAZE_S, MAZE_E, MAZE_W | MAZE_N, MAZE_N]}
          cols={3}
          start={0}
          exit={8}
          path={[0, 1, 2, 5]}
        />
      </div>
    </Scaled>
  )),

  // Matchmaker: four cards, a matched pair of red circles, a blue square turned up, one still face down.
  pairmatch: domScene(() => (
    <Scaled x={6} y={6} scale={1} attrs={PLAY}>
      <div data-polish="pairmatch" style={{ width: 92 }}>
        <PairBoard
          cards={[
            { shape: "circle", colour: "RED" },
            { shape: "square", colour: "BLUE" },
            { shape: "triangle", colour: "GREEN" },
            { shape: "circle", colour: "RED" },
          ]}
          faceUp={new Set([1])}
          matched={new Set([0, 3])}
          cols={2}
          glyph={30}
        />
      </div>
    </Scaled>
  )),

  // Eagle Eye: four of its sky cells, the two eagles facing the target picked out in gold.
  symscan: domScene(() => (
    <Scaled x={1} y={1} scale={1} attrs={PLAY}>
      <div data-polish="symscan" className="grid grid-cols-2 gap-1.5" style={{ width: 102 }}>
        <EagleCell dir="N" state="selected" size={48} index={0} />
        <EagleCell dir="SE" state="plain" size={48} index={1} />
        <EagleCell dir="W" state="plain" size={48} index={2} />
        <EagleCell dir="N" state="selected" size={48} index={3} />
      </div>
    </Scaled>
  )),

  // Double Take: the same three sweets on two shelves, the one that changed colour ringed in gold on both.
  spotdiff: domScene(() => (
    <Scaled x={0} y={12} scale={104 / 144} attrs={PLAY}>
      <div data-polish="spotdiff" className="flex flex-col gap-2" style={{ width: 384 }}>
        <SpotPanel shapes={spotRow(["RED", "PINK", "GREEN"])} found={[1]} rows={1} />
        <SpotPanel shapes={spotRow(["RED", "BLUE", "GREEN"])} found={[1]} rows={1} />
      </div>
    </Scaled>
  )),

  // Mixed Signals: the word RED in blue ink falling towards its three lit gates (red, blue, green).
  stroop: canvasScene((c) => {
    const s = 0.55;
    const laneW = 104 / s / 3;
    const gateY = 150;
    const top = 30;
    const lanes = [0, 1, 2];
    at(c, 0, 0, s, () => {
      for (const lane of lanes) paintLaneGlowAt(c, lane * laneW, top, laneW, gateY - top, CLASH_COLOURS[lane]!);
      for (const lane of lanes) {
        const w = laneW - 10;
        at(c, lane * laneW + 5 - CLASH_GLOW, gateY - CLASH_WASH, 1, () => paintGate(c, CLASH_COLOURS[lane]!, w));
      }
    });
    at(c, 0, 0, 0.75, () => clashWord(c, "RED", CLASH_COLOURS[1]!, 104 / 0.75 / 2, 62));
  }),
};

function paintLaneGlowAt(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, colour: string): void {
  at(c, x, y, 1, () => paintLaneGlow(c, colour, w, h));
}
