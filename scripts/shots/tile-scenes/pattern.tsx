/** Pattern games' tile scenes, built from each game's own boards, art components and CSS (scene.tsx has the rules). */
import type { ReactNode } from "react";

import { BlockBoard } from "@/components/puzzles/BlockPartyPuzzle";
import { UnblockBoard } from "@/components/puzzles/UnblockPuzzle";
import { GradientBoard } from "@/components/puzzles/pattern/gradientBoard";
import { IceBoard, IceTrail } from "@/components/puzzles/pattern/iceSlideBoard";
import { WarehouseBoard } from "@/components/puzzles/pattern/pushArt";
import { RingsDeck } from "@/components/puzzles/pattern/ringsDeck";
import { TopsyBoardView } from "@/components/puzzles/pattern/topsyBoard";
import { jumbledSlide, solvedJumbled } from "@/lib/duel/jumbled";
import { PIPE_E, PIPE_N, PIPE_S, PIPE_W } from "@/lib/duel/logic";
import type { MirrorPlacement } from "@/lib/duel/types";
import { FlowBoard } from "@/puzzles/flow";
import { LaserBoard } from "@/puzzles/laser";
import { PipesBoard } from "@/puzzles/pipes";

import { Scaled, TILE, domScene, type SceneSet } from "./scene";

/** A square box of `size` px at (x, y) for boards that fill their parent. */
function Box({ x, y, size, attrs, children }: { x: number; y: number; size: number; attrs?: Record<string, string>; children: ReactNode }) {
  return (
    <Scaled x={x} y={y} attrs={attrs}>
      <div style={{ width: size, height: size }}>{children}</div>
    </Scaled>
  );
}

// Pipeline: the red pump feeding water through four pipes, three tiles still dry and turned the wrong way.
const PIPE_TILES = [
  { sides: PIPE_E | PIPE_S },
  { sides: PIPE_W | PIPE_E | PIPE_S },
  { sides: PIPE_W },
  { sides: PIPE_N | PIPE_S },
  { sides: PIPE_N },
  { sides: PIPE_N | PIPE_S },
  { sides: PIPE_N | PIPE_E },
  { sides: PIPE_E | PIPE_S },
  { sides: PIPE_N | PIPE_E },
];
const PIPE_WET = new Set([0, 1, 2, 3, 4, 6]);

// Lightbender: the emitter's beam turned down by a mirror onto a lit gem.
const LASER_MIRRORS: MirrorPlacement[] = [{ cell: 2, kind: "\\" }];
const LASER_GEMS = [8];
/** The beam's path on the 3 × 3 board (traceBeam steps on the 10-column board, so the path is laid by hand). */
const LASER_BEAM = [[0, 1, 2, 5, 8]];

// Jumbled: the solved gradient with its middle row slid out of line.
const JUMBLED_FRAME = jumbledSlide(solvedJumbled(), { kind: "R", index: 2, shift: 2 });

// Turntable: five rings of colour, the second ring a step out of line.
const RING_ROW = [0, 1, 2, 3, 0, 1, 2, 3];
const RING_SEGMENTS = [0, 1, 0, 0, 0].map((offset) => RING_ROW.map((_c, i) => RING_ROW[(i + offset) % 8]!));

export const PATTERN_SCENES: SceneSet = {
  pipes: domScene(() => (
    <Box x={4} y={4} size={TILE - 8} attrs={{ "data-polish": "pipes" }}>
      <PipesBoard tiles={PIPE_TILES} source={4} connected={PIPE_WET} cols={3} gap={3} />
    </Box>
  )),

  // Tessellate: the pegboard with three bevelled pieces in and an L-shaped gap left to fill.
  blockparty: domScene(() => (
    <Box x={4} y={4} size={TILE - 8} attrs={{ "data-polish": "blockparty" }}>
      <BlockBoard
        cols={4}
        blockers={[5]}
        placements={[
          { piece: 0, cells: [0, 1, 4] },
          { piece: 1, cells: [2, 3, 7] },
          { piece: 3, cells: [8, 12, 13] },
          { piece: 2, cells: [11, 15, 14] },
        ]}
      />
    </Box>
  )),

  // Chroma Lines: two pairs joined by their tubes, a third pair's dots waiting.
  flow: domScene(() => (
    <Box x={4} y={4} size={TILE - 8} attrs={{ "data-polish": "flow" }}>
      <FlowBoard
        cols={4}
        cells={16}
        pairs={[
          { colour: "RED", a: 0, b: 12 },
          { colour: "BLUE", a: 1, b: 11 },
          { colour: "ORANGE", a: 5, b: 14 },
        ]}
        paths={[[0, 4, 8, 12], [1, 2, 3, 7, 11], [5]]}
      />
    </Box>
  )),

  laser: domScene(() => (
    <Box x={4} y={4} size={TILE - 8} attrs={{ "data-polish": "laser" }}>
      <LaserBoard
        cols={3}
        cells={9}
        source={0}
        dir="R"
        gems={LASER_GEMS}
        bombs={[]}
        blocks={[]}
        placed={LASER_MIRRORS}
        beam={LASER_BEAM}
        litGems={LASER_GEMS}
      />
    </Box>
  )),

  // Heave: the hard-hat worker pushing a crate towards its hatched mark.
  push: domScene(() => (
    <Box x={4} y={4} size={TILE - 8} attrs={{ "data-polish": "push" }}>
      <WarehouseBoard cols={3} cells={9} walls={[0, 1, 2]} targets={[5]} crates={[4]} pusher={3} facing="R" />
    </Box>
  )),

  tiles: domScene(() => (
    <Scaled x={4} y={4} attrs={{ "data-polish": "tiles-gradient" }}>
      <GradientBoard frame={JUMBLED_FRAME} size={TILE - 8} />
    </Scaled>
  )),

  // Skid: the puck slid across the ice with its frost trail, a rock, a hole and the gold exit.
  iceslide: domScene(() => (
    <Box x={4} y={4} size={TILE - 8} attrs={{ "data-polish": "iceslide" }}>
      <IceBoard cols={3} cells={9} walls={[2]} holes={[6]} start={3} exit={8} ball={5}>
        <IceTrail cells={[3, 4, 5]} cols={3} rows={3} fading={false} />
      </IceBoard>
    </Box>
  )),

  // Gridlock: the gold car with a lorry across its row to the exit.
  unblock: domScene(() => (
    <Scaled x={-62} y={-8} attrs={{ "data-polish": "unblock" }}>
      <UnblockBoard
        size={176}
        vehicles={[
          { id: 0, axis: "h", len: 2, row: 2, col: 3 },
          { id: 1, axis: "v", len: 3, row: 1, col: 5 },
          { id: 2, axis: "h", len: 2, row: 0, col: 4 },
        ]}
      />
    </Scaled>
  )),

  // Topsy-Turvy: two shaded balls on the felt beside their own marked holes, a block and a star.
  gravity: domScene(() => (
    <Scaled x={0} y={0} attrs={{ "data-polish": "gravity", "data-topsy": "" }}>
      <TopsyBoardView
        board={{ walls: [11], starts: [1, 20], holes: [3, 22], stars: [2] }}
        state={{ balls: [1, 20], starMask: 0 }}
        size={240}
      />
    </Scaled>
  )),

  rings: domScene(() => (
    <Scaled x={-10} y={-10} attrs={{ "data-polish": "rings" }}>
      <RingsDeck segments={RING_SEGMENTS} offsets={[0, 0, 0, 0, 0]} size={TILE + 20} />
    </Scaled>
  )),
};
