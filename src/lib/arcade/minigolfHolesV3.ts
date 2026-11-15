/**
 * Crazy Golf golfRev 3's hole catalogue (15 Nov 2026, the Crazy Golf overhaul; docs/arcade-standard/minigolf.md
 * "golfRev 3"): twenty hole templates, four for each of the course's five slots, and every variant of each (which tee,
 * which cup, mirrored or not). A hole is named by one integer id (`template × 100 + variant`), built from that id and
 * the level alone (never the room seed), so a hole proven once is the same hole in every course it is dealt in. The
 * bank (src/lib/duel/minigolfHolesBank.server.ts, built by scripts/minigolf-holes-bank.ts) lists the ids whose par its
 * oracle proved, per slot and level; a course is five of them, one from each slot.
 *
 * Slots grow as golfRev 2's holes did (an opening hole, a dogleg family, a tricky middle, then two holes on uneven
 * ground). Bunkers and ponds are unions of overlapping circles (natural shapes, the same physics as golfRev 2's
 * circles), and the last two slots carry swells: broad, gentle mounds and hollows that bend a rolling ball (MgSwell).
 *
 * Imports nothing from minigolf.ts but types, so minigolf.ts can import this file without a cycle at load time; the
 * few shared numbers are repeated here and pinned equal by crazy-golf-v3-check.
 *
 * Deterministic and integer: every coordinate is whole px × 256, curves and tunnels from the integer trig.
 */
import { fp } from "./engine";
import { idiv, ilen, NORM_ONE, type Seg } from "./sportsKit";
import { ANG_FULL, icos, isin, TRIG_ONE } from "./trig";
import type { MgCircle, MgCurve, MgGate, MgHill, MgHole, MgTunnel, MgWindmill } from "./minigolf";

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
 * The twenty templates. Slot 0: a lane past a bunker, a windmill lane, a pond to carry or walk round, a banked bowl.
 * Slot 1: a dogleg round a pond, a zigzag of timber walls, a castle gate, a tunnel past a long wall. Slot 2: the
 * S-bend, an island green on a bridge, a windmill and a castle, a stream with one bridge. Slots 3 and 4 (uneven
 * ground): a rolling green, the split round an island pond, a windmill valley, a lake; the switchback, a crater, three
 * ridges, a water finale.
 */
export const HOLE_TEMPLATES: readonly HoleTemplate[] = [
  /* ------------------------------ slot 0 ------------------------------ */
  {
    name: "Bunker lane",
    slot: 0,
    shape: "straight",
    w: 300,
    h: 520,
    poly: OCT(300, 520, 40),
    tees: [[150, 482], [96, 476], [204, 476]],
    cups: [[150, 70], [100, 92], [206, 88]],
    rocks: [[70, 180, 12], [236, 352, 13]],
    sands: [[[122, 250, 22], [150, 262, 26], [182, 246, 18], [204, 258, 12]]],
    slopes: [[0, 330, 300, 410, 0, 1, 2]],
  },
  {
    name: "Windmill lane",
    slot: 0,
    shape: "straight",
    w: 300,
    h: 520,
    poly: OCT(300, 520, 40),
    tees: [[150, 482], [100, 478], [200, 478]],
    cups: [[150, 70], [104, 96], [200, 92]],
    rocks: [[88, 176, 12]],
    planters: [[112, 40, 12], [188, 40, 12]],
    gates: [["mill", 0, 260, 300, 260, 150, V3_MILL_HALF]],
    sands: [[[214, 150, 16], [232, 166, 20], [246, 186, 12]]],
    slopes: [[0, 320, 300, 400, 0, 1, 2]],
  },
  {
    name: "Pond carry",
    slot: 0,
    shape: "straight",
    w: 300,
    h: 540,
    poly: OCT(300, 540, 36),
    tees: [[150, 504], [222, 500], [86, 500]],
    cups: [[150, 72], [94, 86], [214, 80]],
    ponds: [[[124, 278, 36], [170, 266, 42], [222, 280, 38], [262, 270, 28], [96, 292, 22]]],
    rocks: [[44, 148, 11], [250, 410, 12]],
    sands: [[[58, 404, 14], [76, 418, 18]]],
  },
  {
    name: "Banked bowl",
    slot: 0,
    shape: "straight",
    w: 300,
    h: 520,
    poly: OCT(300, 520, 46),
    tees: [[150, 482], [92, 470], [208, 470]],
    cups: [[150, 112], [112, 136], [190, 134]],
    curves: [[150, 150, 100, 200, 340]],
    sands: [[[66, 160, 18], [56, 182, 14]], [[236, 168, 16], [246, 190, 13]]],
    hills: [[150, 330, 38, 9]],
    rocks: [[236, 420, 11]],
  },
  /* ------------------------------ slot 1 ------------------------------ */
  {
    name: "Pond dogleg",
    slot: 1,
    shape: "dogleg",
    w: 340,
    h: 580,
    poly: [0, 0, 300, 0, 340, 40, 340, 170, 300, 205, 150, 205, 150, 580, 0, 580],
    tees: [[75, 545], [40, 540], [110, 540]],
    cups: [[292, 72], [300, 150], [244, 52]],
    ponds: [[[196, 132, 22], [222, 148, 18], [176, 150, 14]]],
    sands: [[[60, 84, 18], [84, 70, 14]]],
    rocks: [[60, 320, 13]],
    slopes: [[0, 380, 150, 480, 0, 1, 2]],
    curves: [[80, 80, 80, 180, 270]],
  },
  {
    name: "Zigzag",
    slot: 1,
    shape: "dogleg",
    w: 340,
    h: 580,
    poly: OCT(340, 580, 36),
    tees: [[80, 540], [170, 544], [258, 540]],
    cups: [[260, 70], [80, 70], [170, 60]],
    walls: [[0, 200, 220, 200], [120, 380, 340, 380]],
    sands: [[[262, 280, 20], [286, 294, 16]], [[60, 470, 16], [80, 482, 13]]],
    rocks: [[176, 130, 12], [108, 300, 12]],
    slopes: [[0, 210, 340, 290, 0, 1, 1]],
  },
  {
    name: "Castle gate",
    slot: 1,
    shape: "dogleg",
    w: 340,
    h: 580,
    poly: OCT(340, 580, 40),
    tees: [[170, 544], [100, 540], [240, 540]],
    cups: [[170, 70], [96, 90], [250, 86]],
    gates: [["castle", 0, 300, 340, 300, 230, 22]],
    sands: [[[132, 352, 18], [158, 366, 22], [186, 354, 14]], [[262, 196, 16], [280, 212, 13]]],
    ponds: [[[72, 190, 22], [92, 210, 16]]],
    rocks: [[230, 440, 12]],
  },
  {
    name: "Long wall",
    slot: 1,
    shape: "dogleg",
    w: 340,
    h: 580,
    poly: OCT(340, 580, 36),
    tees: [[60, 540], [140, 544], [230, 540]],
    cups: [[60, 72], [140, 66], [250, 90]],
    walls: [[0, 300, 270, 300]],
    tunnels: [[40, 360, 40, 230, -90]],
    sands: [[[150, 186, 18], [176, 196, 16]]],
    ponds: [[[250, 430, 22], [276, 446, 18]]],
    rocks: [[300, 220, 12]],
  },
  /* ------------------------------ slot 2 ------------------------------ */
  {
    name: "S-bend",
    slot: 2,
    shape: "sbend",
    w: 370,
    h: 620,
    poly: [0, 230, 220, 230, 220, 30, 250, 0, 340, 0, 370, 30, 370, 390, 150, 390, 150, 620, 0, 620],
    tees: [[75, 585], [40, 580], [110, 580]],
    cups: [[300, 52], [262, 64], [336, 80]],
    walls: [[0, 304, 74, 304], [362, 330, 318, 382]],
    rocks: [[105, 470, 14], [312, 290, 12]],
    slopes: [[220, 110, 370, 230, 0, 1, 2]],
    tunnels: [[32, 262, 296, 214, -112]],
    hills: [[180, 312, 42, 10]],
    sands: [[[290, 140, 16], [312, 152, 14]]],
  },
  {
    name: "Island green",
    slot: 2,
    shape: "split",
    w: 370,
    h: 620,
    poly: OCT(370, 620, 44),
    tees: [[185, 584], [100, 576], [270, 576]],
    cups: [[185, 196], [160, 186], [212, 188]],
    ponds: [
      [[120, 150, 30], [150, 118, 30], [185, 108, 30], [220, 118, 30], [250, 150, 30], [258, 196, 28], [112, 196, 28], [124, 242, 26], [246, 242, 26]],
    ],
    sands: [[[70, 420, 18], [92, 434, 16]], [[300, 360, 16], [318, 374, 14]]],
    rocks: [[185, 400, 13], [120, 500, 11]],
  },
  {
    name: "Mill and castle",
    slot: 2,
    shape: "split",
    w: 370,
    h: 620,
    poly: OCT(370, 620, 40),
    tees: [[185, 584], [96, 578], [274, 578]],
    cups: [[185, 70], [96, 86], [280, 84]],
    gates: [
      ["mill", 0, 420, 370, 420, 185, V3_MILL_HALF],
      ["castle", 0, 220, 370, 220, 90, 22],
    ],
    sands: [[[262, 300, 20], [290, 312, 16], [240, 318, 12]]],
    rocks: [[110, 320, 12]],
    ponds: [[[300, 140, 18], [320, 158, 14]]],
  },
  {
    name: "Stream",
    slot: 2,
    shape: "sbend",
    w: 370,
    h: 620,
    poly: OCT(370, 620, 40),
    tees: [[90, 584], [185, 588], [280, 584]],
    cups: [[280, 72], [185, 64], [90, 80]],
    ponds: [[[16, 250, 20], [48, 268, 20], [80, 286, 20], [112, 304, 20], [208, 356, 20], [240, 374, 20], [272, 392, 20], [304, 410, 20], [340, 428, 22]]],
    sands: [[[240, 210, 18], [262, 224, 16]]],
    rocks: [[110, 160, 12], [290, 520, 12]],
    planters: [[160, 330, 10]],
  },
  /* ------------------------------ slot 3 ------------------------------ */
  {
    name: "Rolling green",
    slot: 3,
    shape: "split",
    w: 390,
    h: 650,
    poly: OCT(390, 650, 50),
    tees: [[195, 612], [110, 604], [280, 604]],
    cups: [[195, 80], [112, 104], [282, 100]],
    sands: [[[150, 200, 20], [176, 212, 18]], [[260, 330, 22], [286, 346, 18], [236, 346, 12]]],
    ponds: [[[80, 380, 20], [100, 398, 16]]],
    swells: [[120, 470, 90, 4], [270, 470, 80, -3], [195, 300, 100, 3], [120, 190, 80, -3], [280, 180, 70, 3]],
  },
  {
    name: "Island pond",
    slot: 3,
    shape: "split",
    w: 390,
    h: 650,
    poly: OCT(390, 650, 60),
    tees: [[195, 615], [120, 606], [270, 606]],
    cups: [[195, 64], [140, 80], [250, 80]],
    walls: [[195, 180, 195, 262], [195, 430, 195, 530]],
    ponds: [[[195, 346, 54], [170, 312, 28], [222, 382, 28]]],
    sands: [[[96, 96, 20], [114, 110, 14]]],
    rocks: [[300, 330, 14]],
    swells: [[80, 330, 110, 4], [310, 330, 110, -4], [195, 140, 90, 3]],
  },
  {
    name: "Windmill valley",
    slot: 3,
    shape: "grand",
    w: 390,
    h: 650,
    poly: OCT(390, 650, 44),
    tees: [[195, 612], [110, 604], [280, 604]],
    cups: [[195, 76], [110, 96], [280, 96]],
    gates: [["mill", 0, 340, 390, 340, 195, V3_MILL_HALF]],
    sands: [[[96, 200, 18], [118, 214, 16]], [[290, 470, 18], [312, 486, 14]]],
    swells: [[80, 470, 100, -4], [310, 200, 100, -4], [195, 520, 70, 3], [195, 190, 80, 3]],
    rocks: [[300, 260, 12]],
  },
  {
    name: "Lake",
    slot: 3,
    shape: "dogleg",
    w: 390,
    h: 650,
    poly: OCT(390, 650, 44),
    tees: [[300, 612], [230, 610], [340, 590]],
    cups: [[90, 80], [150, 70], [70, 140]],
    ponds: [[[170, 330, 60], [130, 290, 44], [210, 380, 44], [110, 380, 34], [230, 270, 34]]],
    sands: [[[300, 180, 20], [320, 196, 16]], [[60, 520, 18], [80, 536, 14]]],
    rocks: [[300, 420, 12]],
    swells: [[320, 300, 80, 4], [90, 180, 80, -3], [190, 540, 90, 3]],
  },
  /* ------------------------------ slot 4 ------------------------------ */
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
    swells: [[200, 560, 90, 3], [220, 120, 90, -3], [210, 340, 70, 3]],
    curves: [[80, 80, 80, 180, 270]],
  },
  {
    name: "Crater",
    slot: 4,
    shape: "grand",
    w: 390,
    h: 690,
    poly: OCT(390, 690, 52),
    tees: [[195, 652], [110, 644], [280, 644]],
    cups: [[195, 160], [168, 150], [222, 152]],
    sands: [[[120, 160, 20], [130, 196, 16]], [[270, 160, 20], [262, 196, 16]], [[195, 250, 16], [172, 252, 12], [218, 252, 12]]],
    ponds: [[[90, 400, 22], [110, 420, 16]], [[300, 420, 22], [280, 440, 16]]],
    rocks: [[195, 470, 13]],
    swells: [[195, 160, 110, -4], [100, 300, 80, 3], [290, 300, 80, 3], [195, 560, 100, 3]],
  },
  {
    name: "Ridges",
    slot: 4,
    shape: "grand",
    w: 390,
    h: 690,
    poly: OCT(390, 690, 44),
    tees: [[195, 652], [80, 644], [310, 644]],
    cups: [[195, 72], [96, 90], [294, 90]],
    walls: [[0, 230, 150, 230], [240, 230, 390, 230], [100, 460, 290, 460]],
    sands: [[[195, 300, 18], [218, 312, 14]], [[60, 560, 16], [78, 574, 13]]],
    rocks: [[330, 360, 12], [60, 360, 12]],
    swells: [[195, 360, 120, 4], [195, 150, 100, -3], [195, 570, 100, 4]],
  },
  {
    name: "Water finale",
    slot: 4,
    shape: "grand",
    w: 390,
    h: 690,
    poly: OCT(390, 690, 44),
    tees: [[195, 652], [100, 644], [290, 644]],
    cups: [[195, 72], [110, 92], [282, 92]],
    ponds: [
      [[50, 470, 24], [84, 484, 24], [118, 496, 22], [152, 504, 18]],
      [[240, 300, 22], [274, 286, 24], [308, 274, 22], [342, 262, 20]],
    ],
    gates: [["castle", 0, 170, 390, 170, 195, 22]],
    sands: [[[110, 260, 18], [132, 272, 14]], [[280, 560, 18], [300, 574, 14]]],
    rocks: [[195, 380, 13]],
    swells: [[110, 360, 100, 4], [290, 420, 80, -3], [195, 560, 80, 3]],
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
export function buildHoleV3(id: number, index: number, mill: MillSpeed = "normal"): MgHole & { swells: MgSwell[]; tall: Seg[]; pondGroups: number[]; sandGroups: number[]; holeId: number } {
  const d = decodeHoleId(id);
  if (!d) throw new Error(`minigolf: no hole ${id}`);
  const t = HOLE_TEMPLATES[d.template]!;
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
    return { x: p.x, y: p.y, r: fp(r), k };
  });
  const swells: MgSwell[] = (t.swells ?? []).map(([x, y, r, k]) => {
    const p = P(x, y);
    return { x: p.x, y: p.y, r: fp(r), k };
  });
  const slopes = (t.slopes ?? []).map(([x0, y0, x1, y1, dx, dy, k]) => {
    const a = P(x0, y0);
    const b = P(x1, y1);
    const strength = 3 + k * 2;
    return { x0: Math.min(a.x, b.x), y0: a.y, x1: Math.max(a.x, b.x), y1: b.y, ax: (mirror ? -dx : dx) * strength, ay: dy * strength };
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
  const tall: Seg[] = [...rails];
  for (const g of gates) tall.push(...g.segs);
  for (const c of curves) tall.push(...c.segs);
  const segs: Seg[] = [...rails, ...logs];
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
  };
}

/** Each slot's hole size (px), for checks. */
export const V3_SLOT_SIZE = SLOT_SIZE;
