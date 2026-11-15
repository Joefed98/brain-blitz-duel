/**
 * Crazy Golf golfRev 3's hole catalogue (15 Nov 2026, the Crazy Golf overhaul; docs/arcade-standard/minigolf.md
 * "golfRev 3"): twenty hole templates, four for each of the course's five slots, and every variant of each (which tee,
 * which cup, mirrored or not). A hole is named by one integer id (`template × 100 + variant`), built from that id and
 * the level alone (never the room seed), so a hole proven once is the same hole in every course it is dealt in. The
 * bank (src/lib/duel/minigolfHolesBank.server.ts, built by scripts/minigolf-holes-bank.ts) lists the ids whose par its
 * oracle proved, per slot and level; a course is five of them, one from each slot.
 *
 * Slots grow as golfRev 2's holes did (an opening hole, a dogleg family, a tricky middle, then two holes on uneven
 * ground). Every layout is crazy golf (Joe, 15 Nov 2026): windmills, castle gates, tunnels, ramps, loop-the-loops,
 * bridges over water, bowls round the cup, domes and banked curves, each placed in the line of play. Bunkers and ponds
 * are smooth shapes (minigolf.ts mgMetaSum: the level set of a field over their circles, never a cluster of circles),
 * and the last two slots carry swells: broad, gentle mounds and hollows that bend a rolling ball (MgSwell). Hard and
 * Expert add each template's extra hazards and make its slopes, domes and swells stronger (MG_LEVELS).
 *
 * Imports nothing from minigolf.ts but types, so minigolf.ts can import this file without a cycle at load time; the
 * few shared numbers are repeated here and pinned equal by crazy-golf-v3-check.
 *
 * Deterministic and integer: every coordinate is whole px × 256, curves and tunnels from the integer trig.
 */
import { fp } from "./engine";
import { idiv, ilen, NORM_ONE, type Seg } from "./sportsKit";
import { ANG_FULL, icos, isin, TRIG_ONE } from "./trig";
import type { MgBridge, MgCircle, MgCurve, MgGate, MgHill, MgHole, MgLevel, MgLoop, MgTunnel, MgWindmill } from "./minigolf";

/** The world every hole is laid out in (px); equal to MINIGOLF_W × MINIGOLF_H. */
const WORLD_W = 390;
const WORLD_H = 690;
/** Shared with minigolf.ts (pinned equal by crazy-golf-v3-check). */
export const V3_MILL_HALF = 42;
export const V3_GATE_R = 6;
export const V3_CURVE_R = 4;
const CURVE_PIECES = 8;
/** The windmill's spin at each level's setting (angle units a tick) and its surface speed in 4096ths of a radian. */
export const V3_MILL_SPINS = { slow: 128, normal: 256, fast: 512 } as const;
export type MillSpeed = keyof typeof V3_MILL_SPINS;
const W4096_OF: Record<MillSpeed, number> = { slow: 50, normal: 101, fast: 201 };

/**
 * A swell (golfRev 3, the last two holes): uneven ground. Inside radius r a rolling ball is pushed away from the
 * centre (k > 0, a mound) or pulled towards it (k < 0, a hollow) by 4·|k|·d·(r − d) ÷ r² units a tick² at distance d
 * from the centre: nothing at the centre and the rim, |k| at half the radius. Gentle by design (|k| 2–5, under the
 * rolling friction's 6), so a ball comes to rest on a slope but bends while it rolls.
 */
export interface MgSwell {
  x: number;
  y: number;
  r: number;
  k: number;
  /** A bowl round the cup (drawn with a rim), else uneven ground. */
  bowl?: boolean;
}

type P2 = [number, number];
type C3 = [number, number, number];

/** A hole template (px, hole space). Every list is optional; the variants are the tees × cups × mirror. */
export interface HoleTemplate {
  name: string;
  /** The course slot this template fills (0 the opening hole … 4 the finale). */
  slot: number;
  shape: MgHole["shape"];
  w: number;
  h: number;
  poly: number[];
  tees: P2[];
  cups: P2[];
  /** Low timber walls (fixed) and banks: a lofted chip carries over them. */
  walls?: [number, number, number, number][];
  rocks?: C3[];
  planters?: C3[];
  /** Ponds and bunkers: each a union of circles (a natural outline). */
  ponds?: C3[][];
  sands?: C3[][];
  slopes?: [number, number, number, number, number, number, number][];
  gates?: ["castle" | "mill", number, number, number, number, number, number][];
  tunnels?: [number, number, number, number, number][];
  hills?: [number, number, number, number][];
  curves?: [number, number, number, number, number][];
  /** Swells (slots 3 and 4 only): centre, radius (px) and k. */
  swells?: [number, number, number, number][];
  /** Loop-the-loops: end A (px), the heading into it from A (degrees) and its length (end B = A + length along it). */
  loops?: [number, number, number, number][];
  /** Bridges over water: the deck's box (px); no water on it, low rails along its long sides. */
  bridges?: [number, number, number, number][];
  /** Bowls: a hollow round the cup (centre, radius px, k < 0), the swells' push, at every level and slot. */
  bowls?: [number, number, number, number][];
  /** Hard and Expert only: more hazards. */
  extra?: { rocks?: C3[]; sands?: C3[][]; ponds?: C3[][]; walls?: [number, number, number, number][] };
}

const SLOT_SIZE: readonly P2[] = [
  [300, 520],
  [340, 580],
  [370, 620],
  [390, 650],
  [390, 690],
];

const OCT = (w: number, h: number, c: number) => [0, c, c, 0, w - c, 0, w, c, w, h - c, w - c, h, c, h, 0, h - c];

/**
 * The twenty templates, every one crazy golf. Slot 0: a windmill over a bowl, a loop-the-loop through a timber wall, a
 * pond with a bridge, a castle over a bowl. Slot 1: a dogleg with a tunnel shortcut, a zigzag with a windmill, a castle
 * behind its moat and drawbridge, a loop through a long wall. Slot 2: the S-bend, an island green on a bridge, a
 * windmill and a castle, a stream under a windmill. Slots 3 and 4 (uneven ground): a windmill on a rolling green, a
 * split round a bridged pond, a loop in a valley, a lake with a bridge and a castle; the switchback, a crater, ridges
 * with a windmill, a water finale with two bridges and a loop.
 */
export const HOLE_TEMPLATES: readonly HoleTemplate[] = [
  /* ------------------------------ slot 0 (300 × 520) ------------------------------ */
  {
    name: "Windmill bowl",
    slot: 0,
    shape: "straight",
    w: 300,
    h: 520,
    poly: OCT(300, 520, 40),
    tees: [[150, 482], [100, 478], [200, 478]],
    cups: [[150, 96], [124, 110], [178, 108]],
    gates: [["mill", 0, 260, 300, 260, 150, V3_MILL_HALF]],
    slopes: [[0, 330, 300, 410, 0, 1, 2]],
    bowls: [[150, 102, 62, -14]],
    sands: [[[54, 176, 18], [72, 190, 14], [86, 198, 10]]],
    rocks: [[236, 190, 12]],
    extra: { sands: [[[226, 420, 16], [240, 432, 12]]], rocks: [[96, 336, 11]] },
  },
  {
    name: "Loop lane",
    slot: 0,
    shape: "straight",
    w: 300,
    h: 520,
    poly: OCT(300, 520, 40),
    tees: [[150, 482], [100, 478], [200, 478]],
    cups: [[150, 82], [100, 98], [200, 96]],
    walls: [[0, 300, 137, 300], [163, 300, 300, 300]],
    loops: [[150, 356, -90, 96]],
    slopes: [[0, 384, 300, 440, 0, 1, 2]],
    bowls: [[150, 90, 56, -12]],
    sands: [[[214, 156, 16], [230, 170, 14], [242, 184, 9]]],
    rocks: [[88, 168, 12]],
    planters: [[150, 160, 11]],
    extra: { sands: [[[88, 410, 16], [104, 422, 12]]], rocks: [[210, 380, 11]] },
  },
  {
    name: "Bridge pond",
    slot: 0,
    shape: "straight",
    w: 300,
    h: 540,
    poly: OCT(300, 540, 36),
    tees: [[150, 504], [222, 500], [86, 500]],
    cups: [[150, 80], [94, 92], [210, 88]],
    ponds: [[[30, 272, 42], [88, 262, 46], [150, 270, 46], [212, 262, 46], [270, 272, 42]]],
    bridges: [[133, 204, 167, 336]],
    rocks: [[52, 150, 11]],
    sands: [[[230, 160, 15], [246, 172, 11]]],
    hills: [[150, 420, 34, 9]],
    extra: { rocks: [[118, 160, 10]], sands: [[[70, 410, 15], [84, 422, 11]]] },
  },
  {
    name: "Castle bowl",
    slot: 0,
    shape: "straight",
    w: 300,
    h: 520,
    poly: OCT(300, 520, 46),
    tees: [[150, 482], [92, 470], [208, 470]],
    cups: [[150, 112], [128, 124], [172, 122]],
    gates: [["castle", 0, 280, 300, 280, 150, 22]],
    bowls: [[150, 118, 70, -12]],
    slopes: [[0, 300, 300, 380, 0, 1, 2]],
    sands: [[[54, 152, 16], [64, 172, 12]], [[246, 152, 16], [236, 172, 12]]],
    extra: { rocks: [[150, 214, 10]], sands: [[[90, 430, 15], [104, 440, 11]]] },
  },
  /* ------------------------------ slot 1 (340 × 580) ------------------------------ */
  {
    name: "Tunnel dogleg",
    slot: 1,
    shape: "dogleg",
    w: 340,
    h: 580,
    poly: [0, 0, 300, 0, 340, 40, 340, 170, 300, 205, 150, 205, 150, 580, 0, 580],
    tees: [[75, 545], [40, 540], [110, 540]],
    cups: [[292, 72], [300, 150], [250, 60]],
    ponds: [[[196, 128, 22], [222, 146, 18], [178, 150, 14]]],
    sands: [[[60, 84, 18], [82, 72, 14]]],
    slopes: [[0, 360, 150, 470, 0, 1, 2]],
    curves: [[80, 80, 80, 180, 270]],
    tunnels: [[34, 300, 236, 48, 0]],
    bowls: [[292, 100, 46, -12]],
    extra: { rocks: [[100, 300, 11]], sands: [[[110, 150, 14], [126, 164, 10]]] },
  },
  {
    name: "Zigzag mill",
    slot: 1,
    shape: "dogleg",
    w: 340,
    h: 580,
    poly: OCT(340, 580, 36),
    tees: [[80, 540], [170, 544], [258, 540]],
    cups: [[260, 74], [80, 74], [170, 64]],
    walls: [[0, 200, 220, 200]],
    gates: [["mill", 0, 380, 340, 380, 236, V3_MILL_HALF]],
    sands: [[[268, 280, 20], [290, 294, 15]], [[60, 470, 16], [78, 482, 12]]],
    rocks: [[176, 128, 12]],
    hills: [[110, 290, 40, 9]],
    extra: { rocks: [[236, 440, 10]], sands: [[[120, 120, 14], [134, 132, 10]]] },
  },
  {
    name: "Moat castle",
    slot: 1,
    shape: "dogleg",
    w: 340,
    h: 580,
    poly: OCT(340, 580, 40),
    tees: [[170, 544], [100, 540], [240, 540]],
    cups: [[170, 80], [96, 96], [250, 92]],
    gates: [["castle", 0, 300, 340, 300, 230, 22]],
    ponds: [[[28, 352, 26], [76, 348, 28], [126, 352, 28], [176, 348, 28], [226, 352, 28], [276, 348, 28], [320, 352, 24]]],
    bridges: [[214, 316, 246, 390]],
    sands: [[[262, 196, 16], [280, 212, 12]]],
    bowls: [[170, 88, 48, -12]],
    extra: { rocks: [[120, 200, 11]], sands: [[[80, 450, 15], [96, 462, 11]]] },
  },
  {
    name: "Loop wall",
    slot: 1,
    shape: "dogleg",
    w: 340,
    h: 580,
    poly: OCT(340, 580, 36),
    tees: [[60, 540], [150, 544], [240, 540]],
    cups: [[70, 82], [170, 70], [280, 92]],
    walls: [[0, 300, 277, 300], [303, 300, 340, 300]],
    loops: [[290, 352, -90, 104]],
    tunnels: [[40, 376, 60, 226, -90]],
    sands: [[[150, 186, 18], [176, 196, 14]]],
    rocks: [[300, 210, 12]],
    extra: { rocks: [[150, 420, 11]], sands: [[[220, 110, 14], [236, 122, 10]]] },
  },
  /* ------------------------------ slot 2 (370 × 620) ------------------------------ */
  {
    name: "S-bend",
    slot: 2,
    shape: "sbend",
    w: 370,
    h: 620,
    poly: [0, 230, 220, 230, 220, 30, 250, 0, 340, 0, 370, 30, 370, 390, 150, 390, 150, 620, 0, 620],
    tees: [[75, 585], [40, 580], [110, 580]],
    cups: [[300, 60], [262, 70], [334, 86]],
    walls: [[0, 304, 74, 304], [362, 330, 318, 382]],
    rocks: [[105, 470, 14], [312, 290, 12]],
    slopes: [[220, 110, 370, 230, 0, 1, 2]],
    tunnels: [[32, 262, 296, 214, -112]],
    hills: [[180, 312, 42, 10]],
    bowls: [[298, 66, 42, -12]],
    sands: [[[288, 150, 16], [310, 162, 12]]],
    extra: { rocks: [[260, 300, 11]], sands: [[[90, 520, 14], [104, 532, 10]]] },
  },
  {
    name: "Island green",
    slot: 2,
    shape: "split",
    w: 370,
    h: 620,
    poly: OCT(370, 620, 44),
    tees: [[185, 584], [100, 576], [270, 576]],
    cups: [[185, 188], [177, 180], [193, 180]],
    ponds: [[[118, 150, 30], [146, 116, 30], [185, 104, 30], [224, 116, 30], [252, 150, 30], [260, 196, 28], [110, 196, 28], [122, 240, 27], [248, 240, 27], [160, 262, 22], [210, 262, 22], [185, 268, 20]]],
    bridges: [[171, 230, 199, 300]],
    bowls: [[185, 184, 34, -12]],
    gates: [["mill", 0, 420, 370, 420, 185, V3_MILL_HALF]],
    sands: [[[70, 470, 18], [92, 484, 14]]],
    extra: { rocks: [[260, 500, 11]], sands: [[[290, 340, 15], [306, 352, 11]]] },
  },
  {
    name: "Mill and castle",
    slot: 2,
    shape: "split",
    w: 370,
    h: 620,
    poly: OCT(370, 620, 40),
    tees: [[185, 584], [96, 578], [274, 578]],
    cups: [[185, 76], [96, 92], [280, 90]],
    gates: [
      ["mill", 0, 420, 370, 420, 185, V3_MILL_HALF],
      ["castle", 0, 220, 370, 220, 90, 22],
    ],
    slopes: [[0, 450, 370, 530, 0, 1, 2]],
    sands: [[[262, 300, 20], [290, 312, 16], [240, 318, 12]]],
    rocks: [[110, 320, 12]],
    ponds: [[[300, 140, 18], [320, 158, 14]]],
    bowls: [[185, 84, 44, -10]],
    extra: { rocks: [[200, 140, 11]], sands: [[[120, 370, 14], [134, 380, 10]]] },
  },
  {
    name: "Stream",
    slot: 2,
    shape: "sbend",
    w: 370,
    h: 620,
    poly: OCT(370, 620, 40),
    tees: [[90, 584], [185, 588], [280, 584]],
    cups: [[280, 76], [185, 66], [90, 82]],
    // A meandering stream (x every 17 px, y = 340 + 22·sin(2πx ÷ 370), written out as integers).
    ponds: [[[-4, 340, 19], [13, 346, 19], [30, 352, 19], [47, 357, 19], [64, 360, 19], [81, 362, 19], [98, 362, 19], [115, 360, 19], [132, 356, 19], [149, 351, 19], [166, 346, 19], [183, 339, 19], [200, 333, 19], [217, 327, 19], [234, 323, 19], [251, 320, 19], [268, 318, 19], [285, 318, 19], [302, 321, 19], [319, 324, 19], [336, 329, 19], [353, 335, 19], [370, 341, 19]]],
    bridges: [[169, 300, 201, 404]],
    gates: [["mill", 0, 200, 370, 200, 185, V3_MILL_HALF]],
    sands: [[[262, 470, 16], [280, 482, 12]]],
    rocks: [[110, 140, 12]],
    planters: [[290, 260, 11]],
    extra: { rocks: [[90, 450, 11]], sands: [[[240, 120, 14], [254, 132, 10]]] },
  },
  /* ------------------------------ slot 3 (390 × 650), uneven ------------------------------ */
  {
    name: "Rolling mill",
    slot: 3,
    shape: "split",
    w: 390,
    h: 650,
    poly: OCT(390, 650, 50),
    tees: [[195, 612], [110, 604], [280, 604]],
    cups: [[195, 86], [118, 106], [272, 104]],
    gates: [["mill", 0, 330, 390, 330, 195, V3_MILL_HALF]],
    sands: [[[150, 210, 20], [176, 220, 16]], [[264, 420, 20], [286, 434, 15]]],
    ponds: [[[80, 430, 20], [100, 446, 15]]],
    swells: [[120, 500, 90, 12], [270, 500, 80, -9], [120, 190, 80, -9], [280, 190, 70, 9]],
    bowls: [[195, 92, 50, -12]],
    extra: { rocks: [[300, 260, 11]], sands: [[[90, 250, 14], [104, 262, 10]]] },
  },
  {
    name: "Bridged pond",
    slot: 3,
    shape: "split",
    w: 390,
    h: 650,
    poly: OCT(390, 650, 60),
    tees: [[195, 615], [120, 606], [270, 606]],
    cups: [[195, 70], [140, 84], [250, 84]],
    walls: [[195, 160, 195, 250], [195, 444, 195, 540]],
    ponds: [[[150, 346, 46], [195, 340, 50], [240, 346, 46], [195, 386, 34], [195, 300, 34]]],
    bridges: [[181, 284, 209, 410]],
    tunnels: [[60, 560, 70, 160, -90]],
    sands: [[[96, 100, 20], [114, 112, 14]]],
    swells: [[80, 330, 110, 12], [310, 330, 110, -12], [195, 140, 90, 9]],
    extra: { rocks: [[300, 480, 11]], sands: [[[290, 150, 14], [304, 162, 10]]] },
  },
  {
    name: "Loop valley",
    slot: 3,
    shape: "grand",
    w: 390,
    h: 650,
    poly: OCT(390, 650, 44),
    tees: [[195, 612], [110, 604], [280, 604]],
    cups: [[195, 82], [110, 100], [280, 100]],
    walls: [[0, 380, 182, 380], [208, 380, 390, 380]],
    loops: [[195, 436, -90, 112]],
    bowls: [[195, 88, 48, -12]],
    hills: [[195, 250, 36, 9]],
    sands: [[[96, 200, 18], [118, 214, 14]], [[300, 520, 18], [318, 534, 13]]],
    swells: [[80, 500, 100, -12], [310, 200, 100, -12], [195, 190, 80, 9]],
    rocks: [[300, 260, 12]],
    extra: { rocks: [[110, 300, 11]], sands: [[[300, 176, 14], [312, 188, 10]]] },
  },
  {
    name: "Lake castle",
    slot: 3,
    shape: "dogleg",
    w: 390,
    h: 650,
    poly: OCT(390, 650, 44),
    tees: [[300, 612], [230, 610], [340, 590]],
    cups: [[90, 80], [150, 72], [70, 136]],
    ponds: [[[170, 330, 56], [126, 290, 42], [214, 376, 42], [110, 380, 32], [232, 270, 32]]],
    bridges: [[110, 314, 240, 346]],
    gates: [["castle", 0, 200, 390, 200, 120, 22]],
    sands: [[[300, 150, 20], [320, 166, 15]], [[60, 520, 18], [80, 534, 13]]],
    swells: [[320, 300, 80, 12], [90, 470, 80, -9], [200, 540, 90, 9]],
    extra: { rocks: [[300, 440, 11]], sands: [[[180, 120, 14], [194, 132, 10]]] },
  },
  /* ------------------------------ slot 4 (390 × 690), uneven ------------------------------ */
  {
    name: "Switchback",
    slot: 4,
    shape: "grand",
    w: 390,
    h: 690,
    poly: [0, 0, 350, 0, 390, 40, 390, 650, 350, 690, 40, 690, 0, 650],
    tees: [[55, 648], [100, 650], [150, 650]],
    cups: [[330, 100], [262, 182], [344, 186]],
    walls: [[20, 420, 66, 376]],
    planters: [[288, 64, 13], [232, 120, 11]],
    ponds: [[[318, 336, 20], [338, 352, 14]]],
    slopes: [[0, 240, 150, 450, 0, 1, 2]],
    gates: [
      ["mill", 0, 460, 390, 460, 318, V3_MILL_HALF],
      ["castle", 0, 230, 390, 230, 75, 20],
    ],
    sands: [[[178, 598, 22], [204, 610, 16]]],
    swells: [[200, 560, 90, 9], [210, 340, 70, 9]],
    bowls: [[330, 106, 40, -12]],
    curves: [[80, 80, 80, 180, 270]],
    extra: { rocks: [[250, 520, 11]], sands: [[[200, 130, 14], [214, 142, 10]]] },
  },
  {
    name: "Crater",
    slot: 4,
    shape: "grand",
    w: 390,
    h: 690,
    poly: OCT(390, 690, 52),
    tees: [[195, 652], [110, 644], [280, 644]],
    cups: [[195, 160], [174, 150], [216, 152]],
    sands: [[[120, 168, 20], [128, 200, 16]], [[270, 168, 20], [262, 200, 16]], [[176, 250, 14], [195, 254, 16], [214, 250, 14]]],
    ponds: [[[90, 400, 22], [110, 420, 16]], [[300, 420, 22], [280, 440, 16]]],
    tunnels: [[60, 560, 330, 270, -100]],
    hills: [[195, 470, 44, 10]],
    bowls: [[195, 160, 96, -14]],
    swells: [[100, 300, 80, 9], [290, 300, 80, 9], [195, 580, 100, 9]],
    extra: { rocks: [[140, 330, 11]], sands: [[[260, 560, 14], [274, 572, 10]]] },
  },
  {
    name: "Ridges mill",
    slot: 4,
    shape: "grand",
    w: 390,
    h: 690,
    poly: OCT(390, 690, 44),
    tees: [[195, 652], [80, 644], [310, 644]],
    cups: [[195, 80], [96, 96], [294, 96]],
    walls: [[0, 230, 150, 230], [240, 230, 390, 230]],
    gates: [["mill", 0, 460, 390, 460, 195, V3_MILL_HALF]],
    slopes: [[0, 480, 390, 560, 0, 1, 2]],
    sands: [[[195, 300, 18], [218, 312, 14]], [[60, 580, 16], [78, 594, 13]]],
    rocks: [[330, 360, 12], [60, 360, 12]],
    swells: [[195, 360, 120, 12], [195, 150, 100, -9]],
    bowls: [[195, 86, 44, -12]],
    extra: { rocks: [[260, 600, 11]], sands: [[[300, 140, 14], [314, 152, 10]]] },
  },
  {
    name: "Water finale",
    slot: 4,
    shape: "grand",
    w: 390,
    h: 690,
    poly: OCT(390, 690, 44),
    tees: [[195, 652], [100, 644], [290, 644]],
    cups: [[195, 76], [110, 96], [282, 96]],
    ponds: [
      [[-6, 486, 26], [40, 490, 28], [88, 494, 28], [136, 496, 26], [180, 498, 24], [224, 496, 24]],
      [[166, 290, 24], [212, 284, 26], [258, 280, 28], [306, 278, 28], [354, 276, 28], [398, 276, 26]],
    ],
    bridges: [[96, 456, 126, 534], [270, 238, 300, 318]],
    gates: [["castle", 0, 170, 390, 170, 195, 22]],
    loops: [[330, 430, -90, 90]],
    sands: [[[110, 260, 18], [132, 272, 14]], [[280, 580, 18], [300, 594, 14]]],
    swells: [[110, 360, 100, 12], [195, 590, 80, 9]],
    extra: { rocks: [[195, 380, 11]], sands: [[[300, 120, 14], [314, 132, 10]]] },
  },
];

/** A template's variant count: tees × cups × 2 (mirrored or not). */
export function variantCount(t: HoleTemplate): number {
  return t.tees.length * t.cups.length * 2;
}

/** Decodes a hole id into its template index and its tee, cup and mirror (null for an id no template has). */
export function decodeHoleId(id: number): { template: number; tee: number; cup: number; mirror: boolean } | null {
  if (!Number.isInteger(id) || id < 0) return null;
  const template = Math.floor(id / 100);
  const v = id % 100;
  const t = HOLE_TEMPLATES[template];
  if (!t || v >= variantCount(t)) return null;
  const mirror = (v & 1) === 1;
  const rest = v >> 1;
  return { template, tee: rest % t.tees.length, cup: Math.floor(rest / t.tees.length) % t.cups.length, mirror };
}

/** Every hole id in the catalogue for a slot (every variant of its templates), in order. */
export function holeIdsForSlot(slot: number): number[] {
  const out: number[] = [];
  HOLE_TEMPLATES.forEach((t, i) => {
    if (t.slot !== slot) return;
    for (let v = 0; v < variantCount(t); v++) out.push(i * 100 + v);
  });
  return out;
}

/** The windmill's starting angle for a hole id (a fixed hash, so a hole is the same wherever it is dealt). */
function millPhase(id: number, k: number): number {
  let x = Math.imul((id + 1) * 2654435761 + k * 40503, 0x7feb352d) >>> 0;
  x ^= x >>> 15;
  return x & (ANG_FULL - 1);
}

const degAng = (deg: number) => idiv(deg * ANG_FULL, 360);

/**
 * Builds hole `id` for course slot `index` (0–4), its windmills turning at `mill` speed (the level's). Throws on an id
 * the catalogue doesn't hold.
 */
/**
 * Each level's sails, extra hazards and slope strength, as MG_LEVELS in minigolf.ts states them (repeated here so this
 * file imports no values from it; crazy-golf-v3-check pins them equal).
 */
export const V3_LEVEL_BUILD: Readonly<Record<MgLevel, { mill: MillSpeed; extras: boolean; slopeScale256: number }>> = {
  easy: { mill: "slow", extras: false, slopeScale256: 256 },
  normal: { mill: "normal", extras: false, slopeScale256: 256 },
  hard: { mill: "normal", extras: true, slopeScale256: 358 },
  expert: { mill: "fast", extras: true, slopeScale256: 461 },
};
/** A loop's side rails stand MG_LOOP_LANE ÷ 2 either side of its line, 3 px thick (minigolf.ts MG_LOOP_LANE: 26). */
export const V3_LOOP_HALF = 13;
const LOOP_RAIL_R = 3;
/** A bridge's low rails (a chip flies over them). */
export const V3_BRIDGE_RAIL_R = 2;

export function buildHoleV3(
  id: number,
  index: number,
  level: MgLevel = "normal",
): MgHole & { swells: MgSwell[]; tall: Seg[]; pondGroups: number[]; sandGroups: number[]; holeId: number; loops: MgLoop[]; bridges: MgBridge[]; bowls: MgSwell[] } {
  const d = decodeHoleId(id);
  if (!d) throw new Error(`minigolf: no hole ${id}`);
  const t0 = HOLE_TEMPLATES[d.template]!;
  const lv = V3_LEVEL_BUILD[level];
  const mill = lv.mill;
  const scale = (k: number) => Math.trunc((k * lv.slopeScale256) / 256);
  // Hard and Expert: the template's extra hazards join its own.
  const t: HoleTemplate = lv.extras && t0.extra
    ? {
        ...t0,
        rocks: [...(t0.rocks ?? []), ...(t0.extra.rocks ?? [])],
        sands: [...(t0.sands ?? []), ...(t0.extra.sands ?? [])],
        ponds: [...(t0.ponds ?? []), ...(t0.extra.ponds ?? [])],
        walls: [...(t0.walls ?? []), ...(t0.extra.walls ?? [])],
      }
    : t0;
  const mirror = d.mirror;
  const ox = Math.floor((WORLD_W - t.w) / 2);
  const oy = Math.floor((WORLD_H - t.h) / 2);
  const mx = (x: number) => (mirror ? t.w - x : x);
  const P = (x: number, y: number) => ({ x: fp(ox + mx(x)), y: fp(oy + y) });
  const PU = (x: number, y: number, ux: number, uy: number) => ({ x: fp(ox) + (mirror ? fp(t.w - x) - ux : fp(x) + ux), y: fp(oy + y) + uy });
  const poly: number[] = [];
  for (let i = 0; i < t.poly.length; i += 2) {
    const p = P(t.poly[i]!, t.poly[i + 1]!);
    poly.push(p.x, p.y);
  }
  const tee = P(...t.tees[d.tee]!);
  const cup = P(...t.cups[d.cup]!);
  const logs: Seg[] = (t.walls ?? []).map(([ax, ay, bx, by]) => {
    const a = P(ax, ay);
    const b = P(bx, by);
    return { ax: a.x, ay: a.y, bx: b.x, by: b.y, r: fp(5) };
  });
  const circ = ([x, y, r]: C3): MgCircle => {
    const p = P(x, y);
    return { x: p.x, y: p.y, r: fp(r) };
  };
  const rocks = (t.rocks ?? []).map(circ);
  const planters = (t.planters ?? []).map(circ);
  const ponds: MgCircle[] = [];
  const pondGroups: number[] = [];
  (t.ponds ?? []).forEach((blob, g) => blob.forEach((c) => (ponds.push(circ(c)), pondGroups.push(g))));
  const sands: MgCircle[] = [];
  const sandGroups: number[] = [];
  (t.sands ?? []).forEach((blob, g) => blob.forEach((c) => (sands.push(circ(c)), sandGroups.push(g))));
  const hills: MgHill[] = (t.hills ?? []).map(([x, y, r, k]) => {
    const p = P(x, y);
    return { x: p.x, y: p.y, r: fp(r), k: scale(k) };
  });
  const bowls: MgSwell[] = (t.bowls ?? []).map(([x, y, r, k]) => {
    const p = P(x, y);
    return { x: p.x, y: p.y, r: fp(r), k, bowl: true };
  });
  // The swells push as the sim reads them; a bowl is a swell too (a hollow round the cup), unscaled by the level.
  const swells: MgSwell[] = [
    ...(t.swells ?? []).map(([x, y, r, k]) => {
      const p = P(x, y);
      return { x: p.x, y: p.y, r: fp(r), k: scale(k) };
    }),
    ...bowls,
  ];
  const bridges: MgBridge[] = (t.bridges ?? []).map(([x0, y0, x1, y1]) => {
    const a = P(x0, y0);
    const b = P(x1, y1);
    return { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
  });
  // A bridge's low rails along its long sides.
  const bridgeRails: Seg[] = [];
  for (const b of bridges) {
    const r = fp(V3_BRIDGE_RAIL_R);
    if (b.x1 - b.x0 >= b.y1 - b.y0) bridgeRails.push({ ax: b.x0, ay: b.y0, bx: b.x1, by: b.y0, r }, { ax: b.x0, ay: b.y1, bx: b.x1, by: b.y1, r });
    else bridgeRails.push({ ax: b.x0, ay: b.y0, bx: b.x0, by: b.y1, r }, { ax: b.x1, ay: b.y0, bx: b.x1, by: b.y1, r });
  }
  logs.push(...bridgeRails);
  const loops: MgLoop[] = (t.loops ?? []).map(([x, y, deg, len]) => {
    const a = degAng(deg);
    const ux = idiv(icos(a) * NORM_ONE, TRIG_ONE);
    const uy = idiv(isin(a) * NORM_ONE, TRIG_ONE);
    const A = P(x, y);
    const dx = mirror ? -ux : ux;
    const B = { x: A.x + idiv(dx * fp(len), NORM_ONE), y: A.y + idiv(uy * fp(len), NORM_ONE) };
    return { ax: A.x, ay: A.y, bx: B.x, by: B.y, dx, dy: uy };
  });
  // Each loop's lane is closed by two tall rails between its ends.
  const loopRails: Seg[] = [];
  for (const l of loops) {
    const nx = -l.dy;
    const ny = l.dx;
    const off = (v: number) => idiv(v * fp(V3_LOOP_HALF), NORM_ONE);
    for (const side of [-1, 1]) loopRails.push({ ax: l.ax + side * off(nx), ay: l.ay + side * off(ny), bx: l.bx + side * off(nx), by: l.by + side * off(ny), r: fp(LOOP_RAIL_R) });
  }
  const slopes = (t.slopes ?? []).map(([x0, y0, x1, y1, dx, dy, k]) => {
    const a = P(x0, y0);
    const b = P(x1, y1);
    const strength = 3 + k * 2;
    const st = scale(strength);
    return { x0: Math.min(a.x, b.x), y0: a.y, x1: Math.max(a.x, b.x), y1: b.y, ax: (mirror ? -dx : dx) * st, ay: dy * st };
  });
  const gates: MgGate[] = (t.gates ?? []).map(([kind, ax, ay, bx, by, along, half]) => {
    const across = ay === by;
    const a = P(ax, ay);
    const b = P(bx, by);
    const c = across ? P(along, ay) : P(ax, along);
    const h2 = fp(half);
    const lo = across ? { x: Math.min(a.x, b.x), y: a.y } : { x: a.x, y: Math.min(a.y, b.y) };
    const hi = across ? { x: Math.max(a.x, b.x), y: a.y } : { x: a.x, y: Math.max(a.y, b.y) };
    const r = fp(V3_GATE_R);
    const segs: Seg[] = across
      ? [
          { ax: lo.x, ay: lo.y, bx: c.x - h2, by: c.y, r },
          { ax: c.x + h2, ay: c.y, bx: hi.x, by: hi.y, r },
        ]
      : [
          { ax: lo.x, ay: lo.y, bx: c.x, by: c.y - h2, r },
          { ax: c.x, ay: c.y + h2, bx: hi.x, by: hi.y, r },
        ];
    return { kind, ax: lo.x, ay: lo.y, bx: hi.x, by: hi.y, cx: c.x, cy: c.y, half: h2, across, segs };
  });
  const spin = V3_MILL_SPINS[mill];
  const windmills: MgWindmill[] = gates
    .filter((g) => g.kind === "mill")
    .map((g, k) => ({ x: g.cx, y: g.cy, spin: mirror ? -spin : spin, phase: millPhase(id, k), w4096: mirror ? -W4096_OF[mill] : W4096_OF[mill], across: g.across }));
  const tunnels: MgTunnel[] = (t.tunnels ?? []).map(([ix, iy, ex, ey, deg]) => {
    const a = degAng(deg);
    const dx = idiv(icos(a) * NORM_ONE, TRIG_ONE);
    const dy = idiv(isin(a) * NORM_ONE, TRIG_ONE);
    const i = P(ix, iy);
    const o = P(ex, ey);
    return { x: i.x, y: i.y, ox: o.x, oy: o.y, dx: mirror ? -dx : dx, dy };
  });
  const curves: MgCurve[] = (t.curves ?? []).map(([cx, cy, r, d0, d1]) => {
    const a0 = degAng(d0);
    const a1 = degAng(d1);
    const pts: { x: number; y: number }[] = [];
    for (let k = 0; k <= CURVE_PIECES; k++) {
      const a = a0 + idiv((a1 - a0) * k, CURVE_PIECES);
      pts.push(PU(cx, cy, idiv(icos(a) * fp(r), TRIG_ONE), idiv(isin(a) * fp(r), TRIG_ONE)));
    }
    const segs: Seg[] = [];
    for (let k = 0; k < CURVE_PIECES; k++) segs.push({ ax: pts[k]!.x, ay: pts[k]!.y, bx: pts[k + 1]!.x, by: pts[k + 1]!.y, r: fp(V3_CURVE_R) });
    const c = P(cx, cy);
    return { x: c.x, y: c.y, r: fp(r), a0: mirror ? (ANG_FULL / 2 - a1) & (ANG_FULL - 1) : a0, a1: mirror ? (ANG_FULL / 2 - a0) & (ANG_FULL - 1) : a1, segs };
  });
  const rails: Seg[] = [];
  for (let i = 0; i < poly.length; i += 2) {
    const j = (i + 2) % poly.length;
    if (poly[i] === poly[j] && poly[i + 1] === poly[j + 1]) continue;
    rails.push({ ax: poly[i]!, ay: poly[i + 1]!, bx: poly[j]!, by: poly[j + 1]!, r: 0 });
  }
  // Tall things a lofted chip still meets: the fence, the gates and windmill houses, the banked curves.
  const tall: Seg[] = [...rails, ...loopRails];
  for (const g of gates) tall.push(...g.segs);
  for (const c of curves) tall.push(...c.segs);
  const segs: Seg[] = [...rails, ...logs, ...loopRails];
  for (const g of gates) segs.push(...g.segs);
  for (const c of curves) segs.push(...c.segs);
  return {
    index,
    shape: t.shape,
    poly,
    tee,
    cup,
    logs,
    rocks,
    planters,
    ponds,
    slopes,
    segs,
    reach: ilen(cup.x - tee.x, cup.y - tee.y),
    box: { x: ox, y: oy, w: t.w, h: t.h },
    rev: 3,
    gates,
    windmills,
    tunnels,
    sands,
    hills,
    curves,
    swells,
    tall,
    pondGroups,
    sandGroups,
    holeId: id,
    loops,
    bridges,
    bowls,
  };
}

/** Each slot's hole size (px), for checks. */
export const V3_SLOT_SIZE = SLOT_SIZE;
