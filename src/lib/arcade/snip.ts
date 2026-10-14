/**
 * Snip — an arcade game on the shared deterministic engine.
 *
 * A sweet hangs from one to three ropes. Each rope is a verlet chain of
 * integer-position nodes anchored to a pin; the sweet is the chain's last
 * point. A swipe (kind 12, a/b → c/d in world px) is applied on the tick it
 * was recorded against the rope segments as they are on that tick; any rope
 * it crosses is cut. The level ends when the sweet enters the mouth, leaves
 * the arena through the top or bottom, rests on a platform for 0.5 s or
 * 12 s pass, and the next level starts at once. Ten levels in a fixed
 * rising order; the swing is undamped and the side walls are solid.
 * All physics is integer 1/256-pixel units; no floats in the sim.
 */

import { speedBonusCurve } from "../duel/speedPar";
import {
  clampInt,
  inputRange,
  isqrt,
  rngBelow,
  TICKS_PER_SECOND,
  type ArcadeGame,
  type ArcadeInputEvent,
  type CanvasSize,
  type InputRange,
} from "./engine";
import { bandCurve, bandInit, bandPoints, bandScoreOf, bandStep, bandTotal, BAND_FINISH_BONUS, type BandFields, type BandParts } from "./scoreBands";

/* ============================== Config ============================== */

export interface SnipTemplate {
  name: string;
  sweet: readonly [number, number];
  /** Pin x, pin y, extra slack in px over the start distance. */
  pins: readonly (readonly [number, number, number])[];
  /** x0, y0, x1, y1 (px). */
  platforms: readonly (readonly [number, number, number, number])[];
  mouth: readonly [number, number];
  stars: readonly (readonly [number, number])[];
  /**
   * Orchard elements (snipRev 3 templates only; older templates have none, so
   * their physics is untouched). Segments are x0, y0, x1, y1 in px.
   *  planks  — sloped planks the apple rolls along;
   *  gutters — troughs that carry it down without a bounce;
   *  springs — springy branches that bounce it off hard;
   *  nests   — wasp nests (x, y, radius) the apple must not touch;
   *  slide   — the basket slides ± amplitude px over a period in ticks.
   */
  planks?: readonly (readonly [number, number, number, number])[];
  gutters?: readonly (readonly [number, number, number, number])[];
  springs?: readonly (readonly [number, number, number, number])[];
  nests?: readonly (readonly [number, number, number])[];
  slide?: readonly [number, number];
  /**
   * Tuning E (snipRev 5 templates only): the level's height in px (SNIP_TALL_H);
   * absent = SNIP_CONFIG.worldH. The apple is lost below this.
   */
  h?: number;
  /**
   * Tuning E picker's crooks (snipRev 5 templates only): x, y and vine length
   * in px. A crook snags the apple only while it falls freely (no rope left)
   * down past the crook's hook from above, within SNIP_HOOK_REACH px across;
   * it then holds it on a new vine of the given length (a rope the player can
   * cut). Each crook catches once per level.
   */
  hooks?: readonly (readonly [number, number, number])[];
}

/** Every template as designed (x before the 360 px swing clearance is added). */
const SNIP_SOURCES: readonly SnipTemplate[] = [
    { name: "Drop", sweet: [270, 170], pins: [[270, 60, 0]], platforms: [], mouth: [270, 480], stars: [[270, 260]] },
    { name: "Swing", sweet: [160, 150], pins: [[270, 50, 0]], platforms: [], mouth: [380, 490], stars: [[270, 200]] },
    { name: "Pair", sweet: [270, 180], pins: [[160, 60, 0], [380, 60, 0]], platforms: [], mouth: [390, 490], stars: [[340, 250]] },
    { name: "Long arc", sweet: [240, 80], pins: [[410, 50, 0]], platforms: [], mouth: [320, 490], stars: [[320, 380]] },
    { name: "Ledge", sweet: [170, 170], pins: [[290, 60, 0]], platforms: [[120, 330, 240, 346]], mouth: [380, 500], stars: [[360, 330]] },
    { name: "Triple", sweet: [270, 200], pins: [[150, 80, 0], [270, 40, 0], [390, 80, 0]], platforms: [[110, 430, 210, 446]], mouth: [270, 490], stars: [[270, 330]] },
    { name: "Anchor", sweet: [310, 150], pins: [[210, 50, 0], [390, 230, 0]], platforms: [[290, 420, 430, 436]], mouth: [170, 490], stars: [[178, 440]] },
    { name: "Shelf", sweet: [200, 170], pins: [[140, 60, 0], [260, 60, 0]], platforms: [[290, 300, 430, 316], [110, 440, 230, 456]], mouth: [380, 280], stars: [[340, 240]] },
    { name: "Gap", sweet: [270, 150], pins: [[130, 100, 30], [410, 100, 30]], platforms: [[120, 400, 240, 416], [300, 400, 420, 416]], mouth: [270, 500], stars: [[270, 260]] },
    { name: "Under", sweet: [270, 170], pins: [[150, 60, 0], [390, 60, 0], [270, 320, 0]], platforms: [[110, 380, 200, 396]], mouth: [380, 470], stars: [[340, 380]] },
    // ---- Level-variety revision (snipRev 2): drawn by band, never in the fixed legacy order. ----
    { name: "Swing back", sweet: [380, 150], pins: [[270, 50, 0]], platforms: [], mouth: [160, 490], stars: [[270, 200]] },
    { name: "Pair left", sweet: [270, 180], pins: [[380, 60, 0], [160, 60, 0]], platforms: [], mouth: [150, 490], stars: [[200, 250]] },
    { name: "Long arc back", sweet: [300, 80], pins: [[130, 50, 0]], platforms: [], mouth: [220, 490], stars: [[220, 380]] },
    { name: "Low swing", sweet: [150, 230], pins: [[270, 110, 0]], platforms: [], mouth: [390, 490], stars: [[392, 319]] },
    { name: "Lean", sweet: [330, 170], pins: [[230, 60, 0]], platforms: [], mouth: [190, 490], stars: [[243, 269]] },
    { name: "Wide pair", sweet: [270, 200], pins: [[130, 70, 0], [410, 70, 0]], platforms: [], mouth: [160, 490], stars: [[322, 242]] },
    { name: "Ledge right", sweet: [370, 170], pins: [[250, 60, 0]], platforms: [[300, 330, 420, 346]], mouth: [160, 500], stars: [[180, 330]] },
    { name: "Triple left", sweet: [270, 200], pins: [[390, 80, 0], [270, 40, 0], [150, 80, 0]], platforms: [[330, 430, 430, 446]], mouth: [270, 490], stars: [[270, 330]] },
    { name: "Anchor right", sweet: [230, 150], pins: [[330, 50, 0], [150, 230, 0]], platforms: [[110, 420, 250, 436]], mouth: [370, 490], stars: [[362, 440]] },
    { name: "Shelf left", sweet: [340, 170], pins: [[400, 60, 0], [280, 60, 0]], platforms: [[110, 300, 250, 316], [310, 440, 430, 456]], mouth: [160, 280], stars: [[200, 240]] },
    { name: "Step down", sweet: [160, 150], pins: [[260, 50, 0]], platforms: [[300, 340, 430, 356]], mouth: [150, 490], stars: [[160, 213]] },
    { name: "Bridge", sweet: [270, 170], pins: [[170, 60, 0], [370, 60, 0]], platforms: [[220, 330, 320, 346]], mouth: [400, 490], stars: [[317, 213]] },
    { name: "Hook", sweet: [220, 150], pins: [[120, 60, 0], [340, 240, 0]], platforms: [], mouth: [400, 490], stars: [[231, 343]] },
    { name: "Under left", sweet: [270, 170], pins: [[390, 60, 0], [150, 60, 0], [270, 320, 0]], platforms: [[340, 380, 430, 396]], mouth: [160, 470], stars: [[200, 380]] },
    { name: "Cradle", sweet: [270, 200], pins: [[140, 80, 20], [400, 80, 20]], platforms: [[200, 380, 340, 396]], mouth: [120, 490], stars: [[188, 344]] },
    { name: "Slalom", sweet: [150, 150], pins: [[250, 50, 0], [120, 250, 0]], platforms: [[260, 320, 400, 336]], mouth: [380, 490], stars: [[136, 352]] },
    { name: "Twin gap", sweet: [270, 140], pins: [[150, 90, 20], [390, 90, 20]], platforms: [[110, 380, 230, 396], [310, 380, 430, 396]], mouth: [270, 500], stars: [[270, 203]] },
    { name: "Low anchor", sweet: [270, 150], pins: [[270, 50, 0], [150, 300, 0]], platforms: [], mouth: [390, 490], stars: [[251, 463]] },
    { name: "Off gap", sweet: [220, 150], pins: [[110, 100, 30], [350, 100, 30]], platforms: [[110, 400, 200, 416], [260, 400, 380, 416]], mouth: [230, 500], stars: [[220, 213]] },
    { name: "Perch", sweet: [300, 150], pins: [[200, 50, 0]], platforms: [[110, 360, 220, 376]], mouth: [400, 490], stars: [[330, 230]] },
    // ---- Orchard revision (snipRev 3): springy branches, planks, gutters, a sliding basket, wasp nests. ----
    // Easy (30–37).
    { name: "Spring hop", sweet: [160, 150], pins: [[160, 50, 0]], platforms: [], springs: [[110, 330, 210, 345]], mouth: [400, 490], stars: [[160, 325]] },
    { name: "Plank roll", sweet: [160, 150], pins: [[160, 50, 0]], platforms: [], planks: [[110, 300, 330, 360]], mouth: [410, 470], stars: [[301, 340]] },
    { name: "Gutter run", sweet: [380, 140], pins: [[380, 40, 0]], platforms: [], gutters: [[430, 260, 200, 330]], mouth: [110, 480], stars: [[356, 270]] },
    { name: "Wasp swing", sweet: [180, 150], pins: [[270, 50, 0]], platforms: [], nests: [[270, 330, 22]], mouth: [420, 490], stars: [[252, 191]] },
    { name: "Moving basket", sweet: [270, 170], pins: [[270, 60, 0]], platforms: [], slide: [90, 240], mouth: [220, 490], stars: [[270, 303]] },
    { name: "Twin spring", sweet: [270, 150], pins: [[200, 50, 0], [340, 50, 0]], platforms: [], springs: [[300, 330, 380, 300]], mouth: [205, 490], stars: [[333, 181]] },
    { name: "Ramp pair", sweet: [270, 180], pins: [[160, 60, 0], [380, 60, 0]], platforms: [], planks: [[220, 330, 420, 380]], mouth: [150, 500], stars: [[226, 319]] },
    { name: "Nest drop", sweet: [270, 160], pins: [[200, 60, 0], [340, 60, 0]], platforms: [], nests: [[270, 330, 24]], mouth: [365, 490], stars: [[388, 184]] },
    // Medium (38–48).
    { name: "Order matters", sweet: [270, 200], pins: [[150, 80, 0], [390, 80, 0], [270, 40, 0]], platforms: [], nests: [[200, 400, 24]], planks: [[300, 380, 430, 420]], mouth: [265, 500], stars: [[191, 245]] },
    { name: "Spring shelf", sweet: [200, 160], pins: [[120, 60, 0], [280, 60, 0]], platforms: [[330, 260, 430, 276]], springs: [[250, 350, 330, 390]], mouth: [355, 228], stars: [[249, 338]] },
    { name: "Gutter swing", sweet: [300, 150], pins: [[200, 50, 0], [400, 100, 0], [300, 40, 0]], platforms: [], gutters: [[110, 300, 260, 360]], mouth: [345, 490], stars: [[241, 339]] },
    { name: "Wasp gap", sweet: [270, 180], pins: [[150, 60, 0], [390, 60, 0]], platforms: [], nests: [[180, 360, 24], [360, 360, 24]], mouth: [190, 490], stars: [[338, 223]] },
    { name: "Rolling slide", sweet: [180, 150], pins: [[120, 60, 0], [240, 60, 0]], platforms: [], planks: [[120, 300, 300, 350]], slide: [70, 300], mouth: [430, 490], stars: [[256, 325]] },
    { name: "Bounce back", sweet: [330, 160], pins: [[230, 60, 0], [430, 90, 0]], platforms: [], springs: [[110, 360, 170, 300]], mouth: [425, 490], stars: [[255, 206]] },
    { name: "Triple ramp", sweet: [270, 170], pins: [[140, 70, 0], [270, 40, 0], [400, 70, 0]], platforms: [], planks: [[110, 320, 250, 360], [430, 400, 290, 440]], mouth: [250, 500], stars: [[222, 340]] },
    { name: "Low nest", sweet: [270, 250], pins: [[160, 120, 0], [380, 120, 0], [270, 330, 0]], platforms: [], nests: [[150, 420, 24]], mouth: [310, 490], stars: [[334, 287]] },
    { name: "Spring pair", sweet: [270, 140], pins: [[170, 50, 0], [370, 50, 0]], platforms: [], springs: [[150, 330, 230, 350], [310, 350, 390, 330]], mouth: [280, 490], stars: [[203, 331]] },
    { name: "Gutter slide", sweet: [380, 150], pins: [[300, 50, 0], [430, 60, 0]], platforms: [], gutters: [[420, 280, 240, 340]], slide: [60, 260], mouth: [130, 490], stars: [[402, 273]] },
    { name: "Leaf ledge", sweet: [200, 150], pins: [[120, 60, 0], [300, 60, 0], [200, 40, 0]], platforms: [[260, 330, 380, 346]], planks: [[380, 346, 430, 400]], mouth: [215, 490], stars: [[137, 181]] },
    // Hard (49–59).
    { name: "Four knots", sweet: [270, 200], pins: [[130, 80, 0], [410, 80, 0], [200, 40, 0], [340, 40, 0]], platforms: [], nests: [[270, 420, 26]], planks: [[110, 380, 220, 420]], mouth: [355, 490], stars: [[380, 216]] },
    { name: "Sliding orchard", sweet: [270, 170], pins: [[150, 60, 0], [390, 60, 0], [270, 40, 0]], platforms: [], nests: [[150, 380, 22], [390, 380, 22]], slide: [100, 280], mouth: [305, 490], stars: [[208, 214]] },
    { name: "Spring maze", sweet: [200, 150], pins: [[110, 60, 0], [290, 60, 0], [200, 300, 0]], platforms: [], springs: [[260, 380, 340, 350]], nests: [[380, 250, 22]], mouth: [200, 490], stars: [[248, 188]] },
    { name: "Gutter cascade", sweet: [400, 140], pins: [[330, 40, 0], [430, 60, 0], [400, 280, 0]], platforms: [], gutters: [[430, 250, 250, 300], [150, 350, 330, 410]], mouth: [430, 490], stars: [[404, 245]] },
    { name: "Wasp corridor", sweet: [270, 150], pins: [[150, 50, 0], [390, 50, 0], [270, 40, 0], [270, 300, 0]], platforms: [], nests: [[190, 330, 22], [350, 330, 22]], mouth: [280, 490], stars: [[212, 200]] },
    { name: "Bounce and roll", sweet: [160, 150], pins: [[110, 50, 0], [250, 50, 0], [160, 40, 0]], platforms: [], springs: [[140, 320, 220, 350]], planks: [[300, 300, 430, 340]], mouth: [110, 490], stars: [[215, 182]] },
    { name: "Pendulum slide", sweet: [140, 200], pins: [[270, 60, 0], [110, 100, 0], [160, 60, 0]], platforms: [], nests: [[270, 320, 22]], slide: [80, 220], mouth: [130, 490], stars: [[254, 251]] },
    { name: "Double gutter", sweet: [270, 150], pins: [[170, 50, 0], [370, 50, 0], [270, 40, 0]], platforms: [], gutters: [[110, 280, 250, 320], [430, 280, 290, 320]], nests: [[270, 420, 22]], mouth: [195, 490], stars: [[411, 273]] },
    { name: "Top shelf", sweet: [230, 200], pins: [[130, 100, 0], [330, 100, 0], [230, 330, 0]], platforms: [[330, 340, 430, 356]], springs: [[170, 440, 270, 460]], mouth: [340, 308], stars: [[281, 238]] },
    { name: "Last orchard", sweet: [270, 170], pins: [[130, 70, 0], [410, 70, 0], [200, 40, 0], [340, 40, 0]], platforms: [], planks: [[110, 330, 240, 370]], springs: [[300, 400, 380, 380]], nests: [[270, 300, 20]], slide: [70, 300], mouth: [285, 490], stars: [[222, 352]] },
    { name: "Wasp pendulum", sweet: [300, 120], pins: [[200, 40, 0], [400, 40, 0], [300, 250, 0]], platforms: [], nests: [[200, 300, 22], [400, 300, 22]], mouth: [310, 490], stars: [[239, 167]] },
];

/** Tuning E (snipRev 5): the taller levels' height (px). */
export const SNIP_TALL_H = 640;

/** An orchard template stretched to the tall height: every height × 8/7 (sizes and radii kept). */
function stretchTall(t: SnipTemplate): SnipTemplate {
  const y = (v: number) => Math.round((v * SNIP_TALL_H) / 560);
  const seg = (list: readonly (readonly [number, number, number, number])[]) => list.map(([x0, y0, x1, y1]) => [x0, y(y0), x1, y(y1)] as const);
  const out: SnipTemplate = {
    name: t.name,
    sweet: [t.sweet[0], y(t.sweet[1])],
    pins: t.pins.map(([x, py, slack]) => [x, y(py), slack] as const),
    // A ledge keeps its 16 px thickness.
    platforms: t.platforms.map(([x0, y0, x1, y1]) => [x0, y(y0), x1, y(y0) + (y1 - y0)] as const),
    mouth: [t.mouth[0], y(t.mouth[1])],
    stars: t.stars.map(([x, sy]) => [x, y(sy)] as const),
    h: SNIP_TALL_H,
  };
  if (t.planks) out.planks = seg(t.planks);
  if (t.gutters) out.gutters = seg(t.gutters);
  if (t.springs) out.springs = seg(t.springs);
  if (t.nests) out.nests = t.nests.map(([x, ny, r]) => [x, y(ny), r] as const);
  if (t.slide) out.slide = t.slide;
  return out;
}

/** Tuning E's new crook levels (index SNIP_TALL_FIRST + 30 on), in design coordinates. */
const SNIP_CROOK_SOURCES: readonly SnipTemplate[] = [
  // Medium (90–94): a cut, a catch on the crook, another cut (scripts/snip-crook-design.ts kept 92–94).
  { name: "Plank crook", sweet: [160, 150], pins: [[260, 60, 0]], platforms: [], planks: [[110, 300, 230, 340]], hooks: [[330, 400, 80]], nests: [[230, 560, 22], [420, 300, 20]], mouth: [400, 600], stars: [[346, 489]] },
  { name: "Crook gutter", sweet: [370, 150], pins: [[280, 60, 0], [420, 90, 0]], platforms: [], hooks: [[240, 330, 80]], gutters: [[110, 500, 260, 540]], nests: [[400, 520, 22]], mouth: [300, 600], stars: [[208, 163]] },
  { name: "Spring vine", sweet: [194, 149], pins: [[201, 98, 0]], platforms: [], hooks: [[213, 300, 87]], nests: [[211, 472, 21]], springs: [[339, 418, 430, 385]], mouth: [154, 584], stars: [[214, 377]] },
  { name: "Short vine", sweet: [306, 142], pins: [[327, 97, 0]], platforms: [], hooks: [[326, 302, 71]], nests: [[387, 429, 20]], mouth: [350, 592], stars: [[337, 257]] },
  { name: "Long vine", sweet: [312, 183], pins: [[381, 63, 0]], platforms: [], hooks: [[392, 379, 108]], nests: [[329, 441, 20]], mouth: [334, 564], stars: [[381, 479]] },
  // Hard (95–102): the apple must be caught and cut free again, past several obstacles (96–102 kept by snip-crook-design).
  { name: "Spring crook", sweet: [270, 160], pins: [[180, 60, 0], [360, 60, 0]], platforms: [], springs: [[200, 330, 290, 360]], hooks: [[360, 300, 90]], nests: [[150, 470, 22]], mouth: [270, 590], stars: [[364, 380]] },
  { name: "Crook over planks", sweet: [324, 196], pins: [[160, 49, 0]], platforms: [], hooks: [[215, 302, 75], [155, 422, 72]], nests: [[275, 463, 21]], planks: [[154, 414, 257, 401]], mouth: [224, 566], stars: [[239, 255]] },
  { name: "Wasp bend", sweet: [283, 172], pins: [[247, 82, 0], [134, 79, 0]], platforms: [], hooks: [[262, 280, 90]], nests: [[233, 483, 21], [336, 425, 24]], mouth: [254, 593], stars: [[262, 367]] },
  { name: "Spring ladder", sweet: [219, 218], pins: [[295, 64, 0], [217, 40, 0]], platforms: [], hooks: [[272, 338, 103]], nests: [[394, 444, 21]], springs: [[314, 412, 398, 403], [348, 459, 430, 475]], mouth: [336, 575], stars: [[263, 441]] },
  { name: "Double crook", sweet: [315, 144], pins: [[315, 60, 0]], platforms: [], hooks: [[317, 290, 100], [307, 432, 93]], nests: [[217, 468, 24], [239, 553, 23]], mouth: [338, 588], stars: [[315, 340]] },
  { name: "Nest drop crook", sweet: [308, 176], pins: [[273, 67, 0], [310, 88, 0]], platforms: [], hooks: [[329, 285, 76]], nests: [[260, 435, 21], [237, 509, 24]], mouth: [386, 590], stars: [[307, 357]] },
  { name: "Three nests", sweet: [295, 218], pins: [[403, 49, 0], [256, 76, 0]], platforms: [], hooks: [[232, 368, 95]], nests: [[345, 435, 22], [388, 514, 23], [262, 507, 20]], mouth: [243, 590], stars: [[255, 303]] },
  { name: "Crook maze", sweet: [285, 142], pins: [[294, 56, 0], [230, 86, 0], [132, 61, 0]], platforms: [], hooks: [[326, 326, 102]], nests: [[223, 391, 21]], springs: [[200, 538, 299, 508]], planks: [[229, 417, 328, 427]], mouth: [326, 566], stars: [[309, 265]] },
];

/**
 * Tuning E (snipRev 5) bank, appended after the 60 older templates: the 30
 * orchard templates stretched to the tall height (60–89, in their old bands),
 * then the crook levels (90 on).
 */
const SNIP_TALL_SOURCES: readonly SnipTemplate[] = [...SNIP_SOURCES.slice(30, 60).map(stretchTall), ...SNIP_CROOK_SOURCES.map((t) => ({ ...t, h: SNIP_TALL_H }))];

/**
 * snipRev 6 (Oct 2026 bank growth): new tall levels appended after Tuning E's
 * (index SNIP_BANK6_FIRST on), in design coordinates: mostly picker's-crook
 * levels (a cut, a catch, another cut) among springy branches, planks,
 * gutters, wasp nests and sliding baskets, from scripts/snip-crook-design.ts.
 */
const SNIP_BANK6_SOURCES: readonly SnipTemplate[] = [
  // Easy (4).
  { name: "Springy catch", sweet: [177, 199], pins: [[318, 104, 0]], platforms: [], hooks: [[205, 311, 106]], mouth: [244, 568], stars: [[374, 266]], springs: [[244, 433, 344, 401]] }, // worst fast 215 ticks, cuts 2
  { name: "Plank vine", sweet: [331, 195], pins: [[332, 48, 0]], platforms: [], hooks: [[348, 325, 106]], mouth: [317, 565], stars: [[331, 373]], planks: [[179, 520, 259, 485]] }, // worst fast 102 ticks, cuts 2
  { name: "Branch drop", sweet: [387, 179], pins: [[327, 91, 0]], platforms: [], hooks: [[273, 322, 73]], mouth: [318, 570], stars: [[251, 391]], springs: [[300, 397, 404, 425]] }, // worst fast 187 ticks, cuts 2
  { name: "First crook", sweet: [269, 183], pins: [[274, 52, 0]], platforms: [], hooks: [[283, 356, 69]], mouth: [292, 595], stars: [[282, 307]], nests: [[177, 504, 22]] }, // worst fast 119 ticks, cuts 2
  // Medium (10).
  { name: "Crook and nest", sweet: [363, 197], pins: [[316, 92, 0]], platforms: [], hooks: [[372, 314, 65]], mouth: [373, 562], stars: [[399, 351]], nests: [[354, 446, 20]] }, // worst fast 166 ticks, cuts 2
  { name: "Swinging basket", sweet: [362, 175], pins: [[256, 59, 0], [380, 59, 0]], platforms: [], hooks: [[195, 284, 91]], mouth: [198, 577], stars: [[225, 211]], slide: [45, 259], nests: [[383, 386, 21]], springs: [[201, 392, 293, 410]] }, // worst fast 235 ticks, cuts 3
  { name: "Plank basket", sweet: [153, 140], pins: [[295, 91, 0]], platforms: [], hooks: [[363, 353, 109]], mouth: [269, 595], stars: [[392, 466]], slide: [54, 254], nests: [[159, 559, 21]], planks: [[213, 418, 321, 426]] }, // worst fast 138 ticks, cuts 2
  { name: "Nest hop", sweet: [215, 214], pins: [[327, 84, 0]], platforms: [], hooks: [[277, 356, 92]], mouth: [310, 586], stars: [[395, 242]], nests: [[347, 423, 23]] }, // worst fast 177 ticks, cuts 2
  { name: "Low vine", sweet: [197, 189], pins: [[248, 70, 0]], platforms: [], hooks: [[266, 378, 81]], mouth: [251, 576], stars: [[297, 196]], nests: [[326, 501, 21]], planks: [[172, 410, 258, 397]] }, // worst fast 126 ticks, cuts 2
  { name: "Branch bounce", sweet: [304, 173], pins: [[256, 52, 0]], platforms: [], hooks: [[202, 285, 70]], mouth: [135, 581], stars: [[193, 344]], nests: [[326, 403, 20]], springs: [[316, 389, 401, 401]] }, // worst fast 157 ticks, cuts 2
  { name: "Pair over planks", sweet: [189, 180], pins: [[213, 46, 0], [162, 79, 0]], platforms: [], hooks: [[193, 380, 73]], mouth: [314, 569], stars: [[165, 449]], nests: [[245, 427, 24]], planks: [[183, 511, 278, 541]] }, // worst fast 247 ticks, cuts 3
  { name: "Two nests", sweet: [212, 180], pins: [[241, 64, 0]], platforms: [], hooks: [[251, 293, 63]], mouth: [232, 566], stars: [[251, 345]], nests: [[288, 425, 24], [208, 427, 24]] }, // worst fast 186 ticks, cuts 2
  { name: "Quick vine", sweet: [360, 207], pins: [[355, 41, 0]], platforms: [], hooks: [[364, 356, 100]], mouth: [370, 582], stars: [[360, 310]], nests: [[205, 546, 23]] }, // worst fast 82 ticks, cuts 2
  { name: "Crook gutter run", sweet: [210, 142], pins: [[198, 47, 0], [208, 64, 0]], platforms: [], hooks: [[197, 354, 81]], mouth: [149, 584], stars: [[213, 292]], gutters: [[318, 554, 215, 591]], nests: [[198, 478, 23]] }, // worst fast 269 ticks, cuts 3
  // Hard (12).
  { name: "Bough and plank", sweet: [211, 194], pins: [[337, 56, 0], [136, 55, 0]], platforms: [], hooks: [[154, 370, 109]], mouth: [228, 582], stars: [[88, 207]], nests: [[302, 426, 21]], springs: [[173, 412, 258, 396]], planks: [[227, 481, 331, 491]] }, // worst fast 304 ticks, cuts 3
  { name: "Three-rope crook", sweet: [332, 211], pins: [[229, 91, 0], [275, 80, 0], [363, 106, 0]], platforms: [], hooks: [[135, 359, 109]], mouth: [165, 578], stars: [[143, 222]], nests: [[354, 540, 20]], planks: [[131, 453, 239, 440]] }, // worst fast 303 ticks, cuts 4
  { name: "Nest ramp", sweet: [172, 141], pins: [[122, 41, 0], [217, 57, 0]], platforms: [], hooks: [[312, 356, 78]], mouth: [382, 577], stars: [[308, 436]], nests: [[169, 397, 21]], planks: [[197, 521, 294, 487]] }, // worst fast 220 ticks, cuts 3
  { name: "Gutter ladder", sweet: [326, 175], pins: [[212, 81, 0]], platforms: [], hooks: [[160, 296, 78], [146, 425, 110]], mouth: [184, 587], stars: [[172, 373]], gutters: [[206, 381, 309, 416]], nests: [[262, 394, 22]] }, // worst fast 262 ticks, cuts 3
  { name: "Twin crooks", sweet: [281, 208], pins: [[235, 79, 0]], platforms: [], hooks: [[232, 346, 88], [251, 442, 81]], mouth: [254, 573], stars: [[225, 300]], gutters: [[263, 392, 354, 434]], nests: [[159, 478, 21]] }, // worst fast 188 ticks, cuts 3
  { name: "Crook and bough", sweet: [169, 218], pins: [[207, 41, 0]], platforms: [], hooks: [[195, 312, 72], [160, 415, 95]], mouth: [151, 591], stars: [[174, 454]], nests: [[270, 533, 23]], springs: [[132, 492, 223, 480]] }, // worst fast 296 ticks, cuts 3
  { name: "Nest gap", sweet: [270, 158], pins: [[226, 70, 0]], platforms: [], hooks: [[221, 330, 83], [196, 419, 98]], mouth: [195, 568], stars: [[212, 265]], nests: [[132, 463, 21], [338, 471, 20]], planks: [[354, 549, 430, 517]] }, // worst fast 222 ticks, cuts 3
  { name: "Wasp pair", sweet: [348, 198], pins: [[351, 100, 0], [275, 96, 0]], platforms: [], hooks: [[360, 369, 79]], mouth: [360, 591], stars: [[246, 218]], nests: [[242, 394, 21], [309, 423, 23]], planks: [[175, 507, 271, 479]] }, // worst fast 229 ticks, cuts 3
  { name: "Three wasps", sweet: [240, 163], pins: [[311, 90, 0]], platforms: [], hooks: [[250, 281, 104], [217, 448, 61]], mouth: [233, 569], stars: [[354, 183]], nests: [[156, 538, 22], [285, 420, 22], [333, 478, 22]] }, // worst fast 324 ticks, cuts 3
  { name: "Sliding crooks", sweet: [295, 220], pins: [[258, 85, 0]], platforms: [], hooks: [[235, 324, 83], [247, 432, 78]], mouth: [262, 580], stars: [[248, 365]], slide: [76, 301], nests: [[142, 381, 22], [309, 391, 24]] }, // worst fast 222 ticks, cuts 3
  { name: "Branch basket", sweet: [191, 142], pins: [[223, 110, 0], [391, 53, 0]], platforms: [], hooks: [[200, 379, 78]], mouth: [152, 590], stars: [[194, 463]], slide: [42, 227], nests: [[138, 512, 21]], springs: [[266, 492, 363, 524], [211, 390, 290, 387]] }, // worst fast 367 ticks, cuts 3
  { name: "Long gutter", sweet: [283, 186], pins: [[271, 98, 0]], platforms: [], hooks: [[275, 361, 76], [297, 463, 105]], mouth: [357, 577], stars: [[271, 420]], gutters: [[211, 499, 114, 548]], nests: [[185, 470, 23]] }, // worst fast 394 ticks, cuts 3
];
/**
 * snipRev 7 (proven deals): fixed copies of snipRev 6 levels that lose at some
 * per-pin deal, appended after snipRev 6's (index SNIP_PROVEN_FIRST on); the
 * originals stay as they were for stored rounds.
 */
const SNIP_PROVEN_SOURCES: readonly SnipTemplate[] = [
  // Crook gutter run (116) with its two pins drawn apart: at pin wobble +10 / 0 the original's pins met at x 208 and no human-paced plan fed the apple.
  { name: "Crook gutter run", sweet: [210, 142], pins: [[188, 47, 0], [224, 64, 0]], platforms: [], hooks: [[197, 354, 81]], mouth: [149, 584], stars: [[213, 292]], gutters: [[318, 554, 215, 591]], nests: [[198, 478, 23]] },
];
export const SNIP_TALL_FIRST = 60;
const tallIds = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => SNIP_TALL_FIRST + from + i);
export const SNIP_BANDS_TALL = {
  // Spring hop (60) and Gutter run (62) are left out: stretched, they lose at some pin wobbles.
  easy: [...tallIds(1, 1), ...tallIds(3, 7)],
  medium: [...tallIds(8, 18), ...tallIds(30, 34)],
  hard: [...tallIds(19, 29), ...tallIds(35, 42)],
};


export const SNIP_CONFIG = {
  runSeconds: 60,
  levelSeconds: 12,
  levels: 10,
  /** Ticks resting on a platform before the level fails. */
  restTicks: 30,
  /** Per-tick speed (1/256 px) below which the sweet counts as resting. */
  restSpeed: 48,
  worldW: 1260,
  viewW: 360,
  worldH: 560,
  /** Nodes per rope including the pin; the sweet is one more segment. */
  ropeNodes: 9,
  /** Constraint passes per tick. */
  iterations: 10,
  /** 1/256 px per tick². */
  gravity: 64,
  /** Velocity kept per tick, out of 256. */
  damping: 256,
  /** Out of 256: share of a rope correction taken by the sweet (the rest by its neighbour node). */
  sweetShare: 64,
  sweetRadius: 12,
  /** Sweet centre within this distance of the mouth centre = eaten. */
  mouthRadius: 32,
  /** Sweet centre within this distance of a star = collected. */
  starReach: 24,
  /** Bounce kept off walls and platforms, out of 256. */
  bounce: 112,
  /** Side walls reflect velocity without loss. Platforms keep their existing response. */
  wallBounce: 256,
  /** Sliding speed kept along a platform each contact tick, out of 256. */
  friction: 236,
  /** Seeded pin wobble per level, ± px. */
  pinJitter: 10,
  pointsPerSweet: 10,
  pointsPerStar: 3,
  /** Bonus for clearing all ten levels, scaled by time left. */
  finishBonus: 20,
  /** Orchard elements: plank bounce and roll kept (out of 256), spring kick (1/256 px a tick). */
  plankBounce: 40,
  plankRoll: 252,
  springKick: 1_792,
  springMax: 2_560,
  maxScore: 150,
  /** Ten levels in play order, easiest first (then the banks drawn by revision; Tuning E's tall ones last). */
  templates: [...SNIP_SOURCES, ...SNIP_TALL_SOURCES, ...SNIP_BANK6_SOURCES.map((t) => ({ ...t, h: SNIP_TALL_H })), ...SNIP_PROVEN_SOURCES.map((t) => ({ ...t, h: SNIP_TALL_H }))].map(placeSnipTemplate) as readonly SnipTemplate[],
} as const;

/** A designed template placed in the wide world (exported for level-design scripts). */
export function placeSnipTemplate(template: SnipTemplate): SnipTemplate {
  return {
    // Keep each layout intact, with 360 extra px of swing clearance on each side.
    name: template.name,
    sweet: [(template.sweet[0] ?? 0) + 360, template.sweet[1] ?? 0],
    pins: template.pins.map(([x = 0, y = 0, slack = 0]) => [x + 360, y, slack]),
    platforms: template.platforms.map(([x0 = 0, y0 = 0, x1 = 0, y1 = 0]) => [x0 + 360, y0, x1 + 360, y1]),
    mouth: [(template.mouth[0] ?? 0) + 360, template.mouth[1] ?? 0],
    stars: template.stars.map(([x = 0, y = 0]) => [x + 360, y]),
    ...orchardFields(template),
  };
}

type Seg = readonly [number, number, number, number];
interface OrchardSource {
  planks?: readonly Seg[];
  gutters?: readonly Seg[];
  springs?: readonly Seg[];
  nests?: readonly (readonly [number, number, number])[];
  slide?: readonly [number, number];
  h?: number;
  hooks?: readonly (readonly [number, number, number])[];
}
/** The orchard fields of a template, shifted into the wide world like the rest of it (absent stays absent). */
function orchardFields(t: OrchardSource): OrchardSource {
  const seg = (list: readonly Seg[]) => list.map(([x0, y0, x1, y1]) => [x0 + 360, y0, x1 + 360, y1] as const);
  const out: OrchardSource = {};
  if (t.planks) out.planks = seg(t.planks);
  if (t.gutters) out.gutters = seg(t.gutters);
  if (t.springs) out.springs = seg(t.springs);
  if (t.nests) out.nests = t.nests.map(([x, y, r]) => [x + 360, y, r] as const);
  if (t.slide) out.slide = t.slide;
  if (t.h) out.h = t.h;
  if (t.hooks) out.hooks = t.hooks.map(([x, y, len]) => [x + 360, y, len] as const);
  return out;
}

export const SNIP_RUN_TICKS = SNIP_CONFIG.runSeconds * TICKS_PER_SECOND;
export const SNIP_LEVEL_TICKS = SNIP_CONFIG.levelSeconds * TICKS_PER_SECOND;
export const SNIP_W = SNIP_CONFIG.worldW;
export const SNIP_H = SNIP_CONFIG.worldH;
export const SNIP_TEMPLATES = SNIP_CONFIG.templates.length;

/** A swipe step: kind 12, a/b = from (px), c/d = to (px). */
export const SNIP_INPUT_CUT = 12;
const PAD = 40;
export const SNIP_INPUT_RANGES: readonly InputRange[] = [
  inputRange(SNIP_INPUT_CUT, [-PAD, SNIP_W + PAD], [-PAD, SNIP_H + PAD], [-PAD, SNIP_W + PAD], [-PAD, SNIP_H + PAD]),
];
/** snipRev 5 (Tuning E): the same swipe over the taller world. */
export const SNIP_TALL_INPUT_RANGES: readonly InputRange[] = [
  inputRange(SNIP_INPUT_CUT, [-PAD, SNIP_W + PAD], [-PAD, SNIP_TALL_H + PAD], [-PAD, SNIP_W + PAD], [-PAD, SNIP_TALL_H + PAD]),
];
/** A picker's crook catches an apple falling within this many px across of its hook. */
export const SNIP_HOOK_REACH = 26;

/** Level outcomes. */
export const SNIP_PLAYING = 0;
export const SNIP_EATEN = 1;
export const SNIP_LOST = 2;
export const SNIP_TIMEOUT = 3;
export const SNIP_LANDED = 4;
/** snipRev 3: the apple touched a wasp nest. */
export const SNIP_STUNG = 5;

/* ================================ State ================================ */

export interface SnipRope {
  alive: number;
  len: number; // segment length, 1/256 px
  x: number[];
  y: number[];
  ox: number[];
  oy: number[];
}

export interface SnipState extends BandFields {
  tick: number;
  rng: number;
  /** Template per level (fixed rising order). */
  order: number[];
  /** Consecutive ticks the sweet has rested on a platform. */
  rest: number;
  /** Tick the tenth level was fed (0 = not yet). */
  finishTick: number;
  level: number;
  levelTick: number;
  template: number;
  ropes: SnipRope[];
  sx: number;
  sy: number;
  sox: number;
  soy: number;
  /** Star x, y (1/256 px) and collected flags for this level. */
  starX: number[];
  starY: number[];
  starGot: number[];
  outcome: number;
  /** Tick the last level ended (for the flash). */
  endTick: number;
  lastOutcome: number;
  eaten: number;
  stars: number;
  cuts: number;
  /** Recent cuts, packed tick·64 + level·4 + rope. */
  cutLog: number[];
  /** Sweet position every 300 ticks, packed x px · 1024 + y px. */
  trail: number[];
  /** snipRev 3 only: the run's level-variety revision, springy-branch bounces and the tick of the last one. */
  rev?: number;
  springHits?: number;
  springTick?: number;
  /** snipRev 5 only (Tuning E): the run's world height in px (SNIP_TALL_H), for the arena and art. */
  worldH?: number;
  /** Levels with picker's crooks only: crooks that have caught this level (bit per crook) and the tick of the last catch. */
  hooked?: number;
  hookTick?: number;
}

/** The world height (px) a state is drawn in: Tuning E's taller levels, or the original 560. */
export function snipWorldH(state: { worldH?: number }): number {
  return state.worldH ?? SNIP_CONFIG.worldH;
}

function buildLevel(state: SnipState, level: number, fixedJitter?: number | readonly number[]): SnipState {
  const c = SNIP_CONFIG;
  let rng = state.rng;
  const t = state.order[Math.min(level, state.order.length - 1)]!;
  const tpl = c.templates[t]!;
  const ropes: SnipRope[] = [];
  const sx = tpl.sweet[0] * 256;
  const sy = tpl.sweet[1] * 256;
  tpl.pins.forEach(([px, py, slack], pin) => {
    const fixed = typeof fixedJitter === "number" ? fixedJitter : fixedJitter?.[pin];
    let wobble: number;
    if (state.rev === SNIP_REV_PROVEN) {
      // snipRev 7: each pin on its own seeded 5 px step (−10, −5, 0, +5, +10).
      const r = rngBelow(rng, SNIP_PROVEN_WOBBLES.length);
      rng = r.state;
      wobble = SNIP_PROVEN_WOBBLES[r.value]!;
    } else {
      const r = rngBelow(rng, 2 * c.pinJitter + 1);
      rng = r.state;
      wobble = r.value - c.pinJitter;
    }
    const x0 = (px + (fixed ?? wobble)) * 256;
    const y0 = py * 256;
    const n = c.ropeNodes;
    const dist = isqrt((sx - x0) * (sx - x0) + (sy - y0) * (sy - y0)) + slack * 256;
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < n; i++) {
      x.push(x0 + Math.trunc(((sx - x0) * i) / n));
      y.push(y0 + Math.trunc(((sy - y0) * i) / n));
    }
    ropes.push({ alive: 1, len: Math.trunc(dist / n), x, y, ox: [...x], oy: [...y] });
  });
  return {
    ...state,
    rng,
    level,
    levelTick: 0,
    template: t,
    ropes,
    sx,
    sy,
    sox: sx,
    soy: sy,
    starX: tpl.stars.map((s) => s[0] * 256),
    starY: tpl.stars.map((s) => s[1] * 256),
    starGot: tpl.stars.map(() => 0),
    outcome: SNIP_PLAYING,
    rest: 0,
    ...(tpl.hooks || state.hooked !== undefined ? { hooked: 0 } : {}),
  };
}

function init(seed: number): SnipState {
  let rng = seed | 0;
  const order = Array.from({ length: SNIP_CONFIG.levels }, (_, i) => i % SNIP_TEMPLATES);
  const base: SnipState = {
    tick: 0,
    rng,
    order,
    rest: 0,
    finishTick: 0,
    level: 0,
    levelTick: 0,
    template: 0,
    ropes: [],
    sx: 0,
    sy: 0,
    sox: 0,
    soy: 0,
    starX: [],
    starY: [],
    starGot: [],
    outcome: SNIP_PLAYING,
    endTick: -1000,
    lastOutcome: SNIP_PLAYING,
    eaten: 0,
    stars: 0,
    cuts: 0,
    cutLog: [],
    trail: [],
  };
  return buildLevel(base, 0);
}

/**
 * Level-variety revision (stored as puzzle.snipRev): ten distinct templates
 * drawn from the seed by band — levels 1–3 easy, 4–7 medium, 8–10 hard — then
 * the usual seeded pin wobble. The draw uses its own stream, so pin wobble is
 * drawn from the seed exactly as before. Rounds without snipRev keep the fixed
 * legacy order 0–9.
 */
export const SNIP_REV = 2;
export const SNIP_BANDS = {
  easy: [0, 1, 2, 3, 10, 11, 12, 13, 14, 15],
  medium: [4, 5, 6, 7, 16, 17, 18, 19, 20, 21, 22, 29],
  hard: [8, 9, 23, 24, 25, 26, 27, 28],
} as const;
const SNIP_BAND_PLAN = [3, 4, 3] as const;

/** The ten-level order for a snipRev-2 seed. */
export function snipLevelOrder(seed: number): number[] {
  let rng = (seed ^ 0x51ab_c0de) | 0;
  const out: number[] = [];
  [SNIP_BANDS.easy, SNIP_BANDS.medium, SNIP_BANDS.hard].forEach((band, b) => {
    const pool = [...band];
    for (let k = 0; k < SNIP_BAND_PLAN[b]!; k++) {
      const r = rngBelow(rng, pool.length);
      rng = r.state;
      out.push(pool.splice(r.value, 1)[0]!);
    }
  });
  return out;
}

function initRev2(seed: number): SnipState {
  const s = init(seed);
  return buildLevel({ ...s, rng: seed | 0, order: snipLevelOrder(seed) }, 0);
}

/**
 * Scripts only: one level of a template with every pin moved by `jitter` px, or
 * pin i by `jitter[i]` px (a tall template plays in the tall world).
 */
export function snipTestLevel(template: number, jitter: number | readonly number[]): SnipState {
  const s = init(1);
  const h = SNIP_CONFIG.templates[template]?.h;
  return buildLevel({ ...s, order: [template], ...(h ? { rev: SNIP_REV_TALL, worldH: h } : {}) }, 0, jitter);
}

function isOver(state: SnipState): boolean {
  return state.tick >= SNIP_RUN_TICKS || state.level >= SNIP_CONFIG.levels;
}

/** Sign of the cross product (b − a) × (p − a). */
function orient(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  const v = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  return v > 0 ? 1 : v < 0 ? -1 : 0;
}

/** Proper or touching intersection of two segments, integer only. */
export function segmentsCross(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const o1 = orient(ax, ay, bx, by, cx, cy);
  const o2 = orient(ax, ay, bx, by, dx, dy);
  const o3 = orient(cx, cy, dx, dy, ax, ay);
  const o4 = orient(cx, cy, dx, dy, bx, by);
  if (o1 !== o2 && o3 !== o4) return true;
  return false;
}

function ropeCut(rope: SnipRope, sx: number, sy: number, a: number, b: number, c: number, d: number): boolean {
  const n = rope.x.length;
  for (let i = 0; i < n; i++) {
    const x0 = rope.x[i]!;
    const y0 = rope.y[i]!;
    const x1 = i + 1 < n ? rope.x[i + 1]! : sx;
    const y1 = i + 1 < n ? rope.y[i + 1]! : sy;
    if (segmentsCross(x0, y0, x1, y1, a, b, c, d)) return true;
  }
  return false;
}

/** Pulls two points together to at most `len`; wa/wb are shares out of 256. */
function satisfy(
  xs: number[], ys: number[], i: number, j: number, len: number, wa: number, wb: number,
): void {
  const dx = xs[j]! - xs[i]!;
  const dy = ys[j]! - ys[i]!;
  const d = isqrt(dx * dx + dy * dy);
  if (d <= len || d === 0) return;
  const over = d - len;
  const mx = Math.trunc((dx * over) / d);
  const my = Math.trunc((dy * over) / d);
  xs[i] = xs[i]! + ((mx * wa) >> 8);
  ys[i] = ys[i]! + ((my * wa) >> 8);
  xs[j] = xs[j]! - ((mx * wb) >> 8);
  ys[j] = ys[j]! - ((my * wb) >> 8);
}

function step(state: SnipState, input: ArcadeInputEvent | null): SnipState {
  if (isOver(state)) return state;
  const c = SNIP_CONFIG;
  const tick = state.tick + 1;
  let next: SnipState = { ...state, tick, levelTick: state.levelTick + 1 };
  const ropes = state.ropes.map((r) => ({ ...r, x: [...r.x], y: [...r.y], ox: [...r.ox], oy: [...r.oy] }));
  next.ropes = ropes;
  let { sx, sy, sox, soy } = state;

  // 1. Cuts, against the rope positions as they are on this tick.
  if (input && input.k === SNIP_INPUT_CUT) {
    const a = input.a * 256;
    const b = input.b * 256;
    const cc = input.c * 256;
    const d = input.d * 256;
    for (let i = 0; i < ropes.length; i++) {
      const rope = ropes[i]!;
      if (!rope.alive || !ropeCut(rope, sx, sy, a, b, cc, d)) continue;
      rope.alive = 0;
      next.cuts += 1;
      const log = [...next.cutLog, tick * 64 + (state.level % 16) * 4 + i];
      next.cutLog = log.length > 16 ? log.slice(log.length - 16) : log;
    }
  }

  // 2. Verlet integration.
  const vx = ((sx - sox) * c.damping) >> 8;
  const vy = ((sy - soy) * c.damping) >> 8;
  sox = sx;
  soy = sy;
  sx += vx;
  sy += vy + c.gravity;
  for (const rope of ropes) {
    for (let i = 1; i < rope.x.length; i++) {
      const rx = ((rope.x[i]! - rope.ox[i]!) * c.damping) >> 8;
      const ry = ((rope.y[i]! - rope.oy[i]!) * c.damping) >> 8;
      rope.ox[i] = rope.x[i]!;
      rope.oy[i] = rope.y[i]!;
      rope.x[i] = rope.x[i]! + rx;
      rope.y[i] = rope.y[i]! + ry + c.gravity;
    }
  }

  // 3. Rope constraints (a rope only pulls; slack is free). Cut ropes dangle from their pins.
  const sxa = [sx];
  const sya = [sy];
  for (let it = 0; it < c.iterations; it++) {
    for (const rope of ropes) {
      const n = rope.x.length;
      for (let i = 0; i + 1 < n; i++) satisfy(rope.x, rope.y, i, i + 1, rope.len, i === 0 ? 0 : 128, i === 0 ? 256 : 128);
      if (rope.alive) {
        const xs = [rope.x[n - 1]!, sxa[0]!];
        const ys = [rope.y[n - 1]!, sya[0]!];
        satisfy(xs, ys, 0, 1, rope.len, 256 - c.sweetShare, c.sweetShare);
        rope.x[n - 1] = xs[0]!;
        rope.y[n - 1] = ys[0]!;
        sxa[0] = xs[1]!;
        sya[0] = ys[1]!;
      }
    }
  }
  sx = sxa[0]!;
  sy = sya[0]!;

  // 4. Walls and platforms.
  const r = c.sweetRadius * 256;
  const W = c.worldW * 256;
  if (sx < r || sx > W - r) {
    const pvx = sx - sox;
    sx = sx < r ? r : W - r;
    sox = sx + ((pvx * c.wallBounce) >> 8);
  }
  for (const rope of ropes) {
    for (let i = 1; i < rope.x.length; i++) {
      const x = rope.x[i]!;
      if (x >= 0 && x <= W) continue;
      const pvx = x - rope.ox[i]!;
      rope.x[i] = x < 0 ? 0 : W;
      rope.ox[i] = rope.x[i]! + ((pvx * c.wallBounce) >> 8);
    }
  }
  let resting = false;
  const tpl = c.templates[state.template]!;
  for (const [x0p, y0p, x1p, y1p] of tpl.platforms) {
    const x0 = x0p * 256, y0 = y0p * 256, x1 = x1p * 256, y1 = y1p * 256;
    const cx = clampInt(sx, x0, x1);
    const cy = clampInt(sy, y0, y1);
    const dx = sx - cx;
    const dy = sy - cy;
    if (dx * dx + dy * dy >= r * r) continue;
    const pvx = sx - sox;
    const pvy = sy - soy;
    const inside = dx === 0 && dy === 0;
    if (inside || (dy !== 0 && Math.abs(dy) >= Math.abs(dx))) {
      // Vertical contact: land on top (or hit the underside).
      const top = inside ? sy <= (y0 + y1) >> 1 : dy < 0;
      sy = top ? y0 - r : y1 + r;
      if (top && Math.abs(pvx) < c.restSpeed && Math.abs(pvy) < c.restSpeed * 4) resting = true;
      soy = sy + ((pvy * c.bounce) >> 8);
      sox = sx - ((pvx * c.friction) >> 8);
    } else {
      sx = dx < 0 ? x0 - r : x1 + r;
      sox = sx + ((pvx * c.bounce) >> 8);
    }
  }
  // Orchard surfaces (snipRev 3 templates): planks and gutters roll the apple, springs kick it away.
  let sprung = false;
  if (tpl.planks || tpl.gutters || tpl.springs) {
    const hit = (list: readonly Seg[] | undefined, kind: number) => {
      for (const seg of list ?? []) {
        const res = collideSegment(seg, kind, sx, sy, sox, soy, r);
        if (!res) continue;
        // A spring counts once per bounce: only when the apple was moving into it.
        if (kind === 2 && res.into) sprung = true;
        sx = res.sx;
        sy = res.sy;
        sox = res.sox;
        soy = res.soy;
        if (res.resting) resting = true;
      }
    };
    hit(tpl.planks, 0);
    hit(tpl.gutters, 1);
    hit(tpl.springs, 2);
  }
  next = { ...next, sx, sy, sox, soy, rest: resting ? state.rest + 1 : 0 };
  if (sprung) {
    // snipRev 3 only (spring templates exist only there): bounce count and tick, read by art and effects.
    next.springHits = (state.springHits ?? 0) + 1;
    next.springTick = tick;
  }
  // Picker's crooks (snipRev 5 templates): a freely falling apple dropping past a crook's hook from above is held on a new vine.
  if (tpl.hooks && !ropes.some((rope) => rope.alive)) {
    let hooked = next.hooked ?? 0;
    const reach = SNIP_HOOK_REACH * 256;
    tpl.hooks.forEach(([hxp, hyp, len], k) => {
      if (hooked & (1 << k) || ropes.some((rope) => rope.alive)) return;
      const hx = hxp * 256;
      const hy = hyp * 256;
      if (!(state.sy < hy && sy >= hy && sy > state.sy && Math.abs(sx - hx) <= reach)) return;
      const n = c.ropeNodes;
      const x: number[] = [];
      const y: number[] = [];
      for (let i = 0; i < n; i++) {
        x.push(hx + Math.trunc(((sx - hx) * i) / n));
        y.push(hy + Math.trunc(((sy - hy) * i) / n));
      }
      ropes.push({ alive: 1, len: Math.trunc((len * 256) / n), x, y, ox: [...x], oy: [...y] });
      hooked |= 1 << k;
      next.hookTick = tick;
    });
    next.hooked = hooked;
  }

  // 5. Stars, mouth, out of the arena, timeout.
  const reach = c.starReach * 256;
  if (next.starX.length) {
    const got = [...next.starGot];
    for (let i = 0; i < got.length; i++) {
      if (got[i]) continue;
      const dx = sx - next.starX[i]!;
      const dy = sy - next.starY[i]!;
      if (dx * dx + dy * dy < reach * reach) got[i] = 1;
    }
    next.starGot = got;
  }
  const mouth = snipMouthAt(tpl, next.levelTick);
  const mx = mouth.x - sx;
  const my = mouth.y - sy;
  const mr = c.mouthRadius * 256;
  let outcome = SNIP_PLAYING;
  if (mx * mx + my * my < mr * mr) outcome = SNIP_EATEN;
  else if (tpl.nests && snipTouchesNest(tpl, sx, sy)) outcome = SNIP_STUNG;
  else if (sy > ((tpl.h ?? c.worldH) + c.sweetRadius * 2) * 256 || sy < -c.sweetRadius * 2 * 256) outcome = SNIP_LOST;
  else if (next.rest >= c.restTicks) outcome = SNIP_LANDED;
  else if (next.levelTick >= SNIP_LEVEL_TICKS) outcome = SNIP_TIMEOUT;

  if (tick % 300 === 0) {
    next.trail = [...next.trail, clampInt(sx >> 8, 0, SNIP_W) * 1024 + clampInt(sy >> 8, 0, 1023)];
  }

  if (outcome !== SNIP_PLAYING) {
    next.stars += Math.min(1, next.starGot.reduce((n, g) => n + g, 0));
    if (outcome === SNIP_EATEN) {
      next.eaten += 1;
      if (next.eaten >= c.levels) next.finishTick = tick;
    }
    next.lastOutcome = outcome;
    next.endTick = tick;
    next = buildLevel(next, state.level + 1);
  }
  return next;
}

/**
 * One orchard surface against the apple (integer only). The apple is pushed out
 * along the contact normal; its velocity into the surface is replaced by a
 * small bounce (plank), none (gutter) or a kick of at least springKick
 * (spring); along the surface a plank or gutter keeps plankRoll/256 of it.
 */
function collideSegment(
  seg: Seg, kind: number, sx: number, sy: number, sox: number, soy: number, r: number,
): { sx: number; sy: number; sox: number; soy: number; resting: boolean; into: boolean } | null {
  const c = SNIP_CONFIG;
  const ax = seg[0] * 256, ay = seg[1] * 256, bx = seg[2] * 256, by = seg[3] * 256;
  const ux = bx - ax, uy = by - ay;
  const len2 = ux * ux + uy * uy;
  const along = clampInt((sx - ax) * ux + (sy - ay) * uy, 0, len2);
  const cx = ax + Math.trunc((ux * along) / len2);
  const cy = ay + Math.trunc((uy * along) / len2);
  let nx = sx - cx;
  let ny = sy - cy;
  const d2 = nx * nx + ny * ny;
  if (d2 >= r * r) return null;
  let nl = isqrt(d2);
  if (nl === 0) {
    // Centre exactly on the line: push out on the upper side.
    nx = -uy;
    ny = ux;
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    nl = isqrt(len2);
  }
  const pvx = sx - sox;
  const pvy = sy - soy;
  const nsx = cx + Math.trunc((nx * r) / nl);
  const nsy = cy + Math.trunc((ny * r) / nl);
  // Normal and tangential parts of the velocity (1/256 px a tick).
  const vn = Math.trunc((pvx * nx + pvy * ny) / nl);
  let tx = pvx - Math.trunc((vn * nx) / nl);
  let ty = pvy - Math.trunc((vn * ny) / nl);
  let out = vn;
  if (vn < 0) {
    if (kind === 2) out = Math.min(c.springMax, Math.max(-vn, c.springKick));
    else if (kind === 1) out = 0;
    else out = Math.trunc((-vn * c.plankBounce) / 256);
  }
  if (kind !== 2) {
    tx = Math.trunc((tx * c.plankRoll) / 256);
    ty = Math.trunc((ty * c.plankRoll) / 256);
  }
  const vx = tx + Math.trunc((out * nx) / nl);
  const vy = ty + Math.trunc((out * ny) / nl);
  const resting = kind !== 2 && ny < 0 && Math.abs(vx) < c.restSpeed && Math.abs(vy) < c.restSpeed * 4;
  return { sx: nsx, sy: nsy, sox: nsx - vx, soy: nsy - vy, resting, into: vn < 0 };
}

/** The basket centre on a level tick (1/256 px): fixed, or sliding on an integer triangle wave (snipRev 3). */
export function snipMouthAt(tpl: SnipTemplate, levelTick: number): { x: number; y: number } {
  const x = tpl.mouth[0] * 256;
  const y = tpl.mouth[1] * 256;
  if (!tpl.slide) return { x, y };
  const [amp, period] = tpl.slide;
  const half = period >> 1;
  const phase = levelTick % period;
  const u = phase < half ? phase : period - phase;
  return { x: x + Math.trunc(((2 * u - half) * amp * 256) / half), y };
}

/** Whether the apple touches any wasp nest of a template. */
export function snipTouchesNest(tpl: SnipTemplate, sx: number, sy: number): boolean {
  const reach = SNIP_CONFIG.sweetRadius * 256;
  for (const [x, y, rad] of tpl.nests ?? []) {
    const dx = sx - x * 256;
    const dy = sy - y * 256;
    const rr = reach + rad * 256;
    if (dx * dx + dy * dy < rr * rr) return true;
  }
  return false;
}

/** 10 per level fed + 3 per star; all ten fed adds round(20 × ms left ÷ 60 s); cap 150. */
export function snipScore(eaten: number, stars: number, finishTick = 0): number {
  const c = SNIP_CONFIG;
  const bonus = eaten >= c.levels && finishTick > 0
    ? speedBonusCurve(c.finishBonus, SNIP_RUN_TICKS - finishTick, SNIP_RUN_TICKS)
    : 0;
  return clampInt(eaten * c.pointsPerSweet + stars * c.pointsPerStar + bonus, 0, c.maxScore);
}

function score(state: SnipState): number {
  return snipScore(state.eaten, state.stars, state.finishTick);
}

export function unpackSnipCut(entry: number): { tick: number; level: number; rope: number } {
  return { tick: Math.floor(entry / 64), level: Math.floor(entry / 4) % 16, rope: entry % 4 };
}

/* ============================= Checkpoints ============================= */

export const SNIP_CHECKPOINT_INTERVAL = 300;

export interface SnipCheckpointState {
  tick: number;
  level: number;
  eaten: number;
  stars: number;
  cuts: number;
  posHash: number;
}

export interface SnipCheckpoint extends SnipCheckpointState {
  checksum: number;
}

export const SNIP_CHECKPOINT_FIELDS = ["tick", "level", "eaten", "stars", "cuts", "posHash"] as const;

export function snipCheckpoint(state: SnipState): SnipCheckpoint {
  let posHash = (Math.imul(state.sx, 31) + state.sy) | 0;
  for (const rope of state.ropes) {
    posHash = (Math.imul(posHash, 31) + rope.alive) | 0;
    for (let i = 0; i < rope.x.length; i++) posHash = (Math.imul(posHash, 31) + rope.x[i]! + Math.imul(rope.y[i]!, 3)) | 0;
  }
  const snapshot: SnipCheckpointState = {
    tick: state.tick,
    level: state.level,
    eaten: state.eaten,
    stars: state.stars,
    cuts: state.cuts,
    posHash,
  };
  let checksum = 0x811c9dc5;
  // snipRev 5 (Tuning E) folds its world height and crook catches in last; the encoded fields stay the same.
  const extra = state.worldH ? [state.worldH, state.hooked ?? 0] : [];
  for (const value of [...Object.values(snapshot), ...extra]) {
    checksum ^= value | 0;
    checksum = Math.imul(checksum, 0x01000193) >>> 0;
  }
  return { ...snapshot, checksum };
}

/* =============================== Drawing =============================== */

export const SNIP_SWEET = "#E84A7F";
export const SNIP_MOUTH = "#5FBF4A";
export const SNIP_STAR = "#F5C542";

export function snipView(size: CanvasSize, worldH: number = SNIP_H): { scaleX: number; scaleY: number } {
  return { scaleX: size.width / SNIP_CONFIG.viewW, scaleY: size.height / worldH };
}

/** Render-only camera: soft velocity lead with a hard visibility guard. */
export function snipCamera(state: SnipState, previous: number, dtSeconds = 1 / 60): number {
  const x = state.sx / 256;
  const velocity = (state.sx - state.sox) / 256;
  const viewW = SNIP_CONFIG.viewW;
  const target = clampInt(x + Math.max(-54, Math.min(54, velocity * 8)) - viewW / 2, 0, SNIP_W - viewW);
  const eased = previous + (target - previous) * (1 - Math.exp(-8 * Math.max(0, dtSeconds)));
  const safe = 36;
  return Math.max(0, Math.min(SNIP_W - viewW, Math.max(x - viewW + safe, Math.min(x - safe, eased))));
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fill();
}

export function drawSnip(
  ctx: CanvasRenderingContext2D,
  state: SnipState,
  size: CanvasSize,
  trail?: readonly (readonly [number, number])[],
  cameraX = snipCamera(state, state.sx / 256 - SNIP_CONFIG.viewW / 2, 1),
): void {
  const { scaleX, scaleY } = snipView(size);
  ctx.save();
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.beginPath();
  ctx.rect(0, 0, size.width, size.height);
  ctx.clip();
  ctx.scale(scaleX, scaleY);
  ctx.translate(-cameraX, 0);
  ctx.fillStyle = "#1E2433";
  ctx.fillRect(0, 0, SNIP_W, SNIP_H);
  ctx.strokeStyle = "#6A7280";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(1.5, 0); ctx.lineTo(1.5, SNIP_H);
  ctx.moveTo(SNIP_W - 1.5, 0); ctx.lineTo(SNIP_W - 1.5, SNIP_H);
  ctx.stroke();
  const tpl = SNIP_CONFIG.templates[state.template]!;

  ctx.fillStyle = "#6B5B4B";
  for (const [x0, y0, x1, y1] of tpl.platforms) ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

  // Mouth.
  const [mxp, myp] = tpl.mouth;
  ctx.fillStyle = SNIP_MOUTH;
  ctx.beginPath();
  ctx.arc(mxp, myp, SNIP_CONFIG.mouthRadius * 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1E2433";
  ctx.beginPath();
  ctx.ellipse(mxp, myp - SNIP_CONFIG.mouthRadius * 0.1, SNIP_CONFIG.mouthRadius * 0.55, SNIP_CONFIG.mouthRadius * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = SNIP_STAR;
  state.starX.forEach((sx, i) => {
    if (!state.starGot[i]) star(ctx, sx / 256, state.starY[i]! / 256, 12);
  });

  // Ropes.
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const rope of state.ropes) {
    ctx.strokeStyle = rope.alive ? "#C9A66B" : "rgba(201,166,107,0.45)";
    ctx.beginPath();
    ctx.moveTo(rope.x[0]! / 256, rope.y[0]! / 256);
    for (let i = 1; i < rope.x.length; i++) ctx.lineTo(rope.x[i]! / 256, rope.y[i]! / 256);
    if (rope.alive) ctx.lineTo(state.sx / 256, state.sy / 256);
    ctx.stroke();
    ctx.fillStyle = "#D9D9D9";
    ctx.beginPath();
    ctx.arc(rope.x[0]! / 256, rope.y[0]! / 256, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = SNIP_SWEET;
  ctx.beginPath();
  ctx.arc(state.sx / 256, state.sy / 256, SNIP_CONFIG.sweetRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath();
  ctx.arc(state.sx / 256 - 4, state.sy / 256 - 4, 4, 0, Math.PI * 2);
  ctx.fill();

  if (trail && trail.length > 1) {
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(trail[0]![0], trail[0]![1]);
    for (const [x, y] of trail) ctx.lineTo(x, y);
    ctx.stroke();
  }

  const age = state.tick - state.endTick;
  if (age >= 0 && age < 30) {
    ctx.globalAlpha = 1 - age / 30;
    ctx.fillStyle = state.lastOutcome === SNIP_EATEN ? SNIP_MOUTH : "#D9534F";
    ctx.fillRect(0, 0, SNIP_W, 6);
    ctx.fillRect(0, SNIP_H - 6, SNIP_W, 6);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export const snipGame: ArcadeGame<SnipState, ArcadeInputEvent | null> = {
  key: "snip",
  runTicks: SNIP_RUN_TICKS,
  init,
  step: bandStep(step),
  isOver,
  score: bandScoreOf(score, scoreBand),
  draw: (ctx, state, size) => drawSnip(ctx, state, size),
  inputRanges: SNIP_INPUT_RANGES,
};

/** Level-variety revision. */
export const snipRev2Game: ArcadeGame<SnipState, ArcadeInputEvent | null> = { ...snipGame, init: initRev2 };

/**
 * Orchard revision (snipRev 3): the bank grows to 60 templates (30 new ones
 * with springy branches, planks, gutters, a sliding basket and wasp nests;
 * medium and hard ones hang from two to four ropes, often needing the cuts in
 * the right order). Levels 1–3 easy, 4–7 medium, 8–10 hard, drawn on their own
 * stream; pin wobble is drawn from the seed as before. snipRev 2 rounds keep
 * SNIP_BANDS and its 30 templates.
 */
export const SNIP_REV3 = 3;
export const SNIP_BANDS_V3 = {
  easy: [...SNIP_BANDS.easy, 30, 31, 32, 33, 34, 35, 36, 37],
  medium: [...SNIP_BANDS.medium, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48],
  hard: [...SNIP_BANDS.hard, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59],
} as const;

/** The ten-level order for a snipRev-3 seed. */
export function snipLevelOrderV3(seed: number): number[] {
  let rng = (seed ^ 0x0c4a_7d13) | 0;
  const out: number[] = [];
  [SNIP_BANDS_V3.easy, SNIP_BANDS_V3.medium, SNIP_BANDS_V3.hard].forEach((band, b) => {
    const pool = [...band];
    for (let k = 0; k < SNIP_BAND_PLAN[b]!; k++) {
      const r = rngBelow(rng, pool.length);
      rng = r.state;
      out.push(pool.splice(r.value, 1)[0]!);
    }
  });
  return out;
}

function initRev3(seed: number): SnipState {
  const s = init(seed);
  return buildLevel({ ...s, rng: seed | 0, order: snipLevelOrderV3(seed), rev: SNIP_REV3 }, 0);
}

export const snipRev3Game: ArcadeGame<SnipState, ArcadeInputEvent | null> = { ...snipGame, init: initRev3 };
export function snipGameFor(rev?: number | null): ArcadeGame<SnipState, ArcadeInputEvent | null> {
  if (rev === SNIP_REV_PROVEN) return snipProvenGame;
  if (rev === SNIP_REV_BANK6) return snipBank6Game;
  if (rev === SNIP_REV_TALL) return snipTallGame;
  if (rev === SNIP_REV_BAND) return snipBandGame;
  return rev === SNIP_REV3 ? snipRev3Game : rev === SNIP_REV ? snipRev2Game : snipGame;
}

/* ================= Oct 2026 score bands (snipRev 4) ================= */

/** Score-band revision (puzzle.snipRev = 4): rev-3 play unchanged, scored on the shared band curve (scoreBands.ts). */
export const SNIP_REV_BAND = 4;
/** Apples count 10 and leaves 2; 140 at all ten apples and leaves; all ten apples adds up to 10 for speed. */
export const SNIP_BAND_CURVE = bandCurve([0, 62, 80, 90, 120], [0, 70, 100, 134, 140]);
export function snipBandParts(state: SnipState): BandParts {
  const units = 10 * clampInt(state.eaten, 0, SNIP_CONFIG.levels) + 2 * Math.max(0, state.stars);
  const finished = state.eaten >= SNIP_CONFIG.levels && state.finishTick > 0;
  return { units, points: bandPoints(state.worldH ? SNIP_V5_BAND_CURVE : SNIP_BAND_CURVE, units), bonus: finished ? speedBonusCurve(BAND_FINISH_BONUS, SNIP_RUN_TICKS - state.finishTick, SNIP_RUN_TICKS) : 0, penalty: 0, finished, text: `${state.eaten} / ${SNIP_CONFIG.levels} apples · ${state.stars} leaves`, bonusText: "All ten apples" };
}

function scoreBand(state: SnipState): number {
  return bandTotal(snipBandParts(state), Boolean(state.acted));
}

export const snipBandGame: ArcadeGame<SnipState, ArcadeInputEvent | null> = { ...snipRev3Game, init: (seed) => bandInit(snipRev3Game.init(seed)) };

/* ================= Tuning E (snipRev 5, Oct 2026) ================= */

/**
 * snipRev 5 (Tuning E): taller levels (view 360 × SNIP_TALL_H, the same for
 * every player) drawn from a bank of tall templates only (SNIP_TALL_SOURCES:
 * the orchard levels stretched to the new height, and new levels with
 * picker's crooks that catch the falling apple on a fresh vine, so a level can
 * need a cut, a catch and another cut). Levels 1–2 easy, 3–5 medium, 6–10
 * hard, on their own stream; pin wobble from the seed as before. Every tall
 * template keeps a stored winning plan at human cutting pace
 * (fixtures/snip-rev5-proofs.json). Scored on SNIP_V5_BAND_CURVE. States add
 * `worldH` (and `hooked` on crook levels), folded into the checksum.
 */
export const SNIP_REV_TALL = 5;
const SNIP_BAND_PLAN_TALL = [2, 3, 5] as const;
/**
 * Apples count 10 and leaves 2, as before; the lower knots move down for the
 * harder mix (re-measured with scripts/arcade-skill-bands.ts --rev=e: the same
 * players feed about one apple fewer): 54 → 70, 74 → 100; the top is unchanged.
 */
export const SNIP_V5_BAND_CURVE = bandCurve([0, 54, 74, 90, 120], [0, 70, 100, 134, 140]);

/** The ten-level order for a snipRev-5 seed. */
export function snipLevelOrderTall(seed: number): number[] {
  let rng = (seed ^ 0x7a11_5e05) | 0;
  const out: number[] = [];
  [SNIP_BANDS_TALL.easy, SNIP_BANDS_TALL.medium, SNIP_BANDS_TALL.hard].forEach((band, b) => {
    const pool = [...band];
    for (let k = 0; k < SNIP_BAND_PLAN_TALL[b]!; k++) {
      const r = rngBelow(rng, pool.length);
      rng = r.state;
      out.push(pool.splice(r.value, 1)[0]!);
    }
  });
  return out;
}

function initTall(seed: number): SnipState {
  const s = init(seed);
  return bandInit(buildLevel({ ...s, rng: seed | 0, order: snipLevelOrderTall(seed), rev: SNIP_REV_TALL, worldH: SNIP_TALL_H }, 0));
}

export const snipTallGame: ArcadeGame<SnipState, ArcadeInputEvent | null> = { ...snipBandGame, init: initTall, inputRanges: SNIP_TALL_INPUT_RANGES };

/** The world height (px) a stored round's snipRev plays in. */
export function snipWorldHFor(rev?: number | null): number {
  return rev === SNIP_REV_TALL || rev === SNIP_REV_BANK6 || rev === SNIP_REV_PROVEN ? SNIP_TALL_H : SNIP_H;
}

/* ================= Bank growth (snipRev 6, Oct 2026) ================= */

/**
 * snipRev 6: the same tall game as snipRev 5 (rules, physics, timing and
 * scoring unchanged) dealing from a bigger bank, so regular players see fewer
 * repeats: snipRev 5's tall templates plus the new levels from index
 * SNIP_BANK6_FIRST on. Still 2 easy / 3 medium / 5 hard, on a stream of its
 * own; pin wobble from the seed as before. Every template keeps a stored
 * human-paced winning plan (fixtures/snip-rev5-proofs.json and
 * fixtures/snip-rev6-proofs.json). snipRev 5 rounds keep SNIP_BANDS_TALL.
 */
export const SNIP_REV_BANK6 = 6;
export const SNIP_BANK6_FIRST = SNIP_TALL_FIRST + SNIP_TALL_SOURCES.length;
const bank6Ids = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => SNIP_BANK6_FIRST + from + i);
export const SNIP_BANDS_V6 = {
  easy: [...SNIP_BANDS_TALL.easy, ...bank6Ids(0, 3)],
  medium: [...SNIP_BANDS_TALL.medium, ...bank6Ids(4, 13)],
  hard: [...SNIP_BANDS_TALL.hard, ...bank6Ids(14, 25)],
};

/** The ten-level order for a snipRev-6 seed. */
export function snipLevelOrderV6(seed: number): number[] {
  let rng = (seed ^ 0x6b0a_17e6) | 0;
  const out: number[] = [];
  [SNIP_BANDS_V6.easy, SNIP_BANDS_V6.medium, SNIP_BANDS_V6.hard].forEach((band, b) => {
    const pool = [...band];
    for (let k = 0; k < SNIP_BAND_PLAN_TALL[b]!; k++) {
      const r = rngBelow(rng, pool.length);
      rng = r.state;
      out.push(pool.splice(r.value, 1)[0]!);
    }
  });
  return out;
}

function initBank6(seed: number): SnipState {
  const s = init(seed);
  return bandInit(buildLevel({ ...s, rng: seed | 0, order: snipLevelOrderV6(seed), rev: SNIP_REV_BANK6, worldH: SNIP_TALL_H }, 0));
}

export const snipBank6Game: ArcadeGame<SnipState, ArcadeInputEvent | null> = { ...snipTallGame, init: initBank6 };

/* ================= Proven deals (snipRev 7, Oct 2026) ================= */

/**
 * snipRev 7: snipRev 6's tall game (rules, physics, timing, scoring, world,
 * inputs and level draw unchanged) with every deal proven winnable. Each pin
 * still shifts on its own seeded wobble, but in 5 px steps
 * (−10, −5, 0, +5, +10; the same pin stream, five values instead of 21), so a
 * level with k pins has exactly 5^k deals; levels that lose at some deal are
 * dealt as fixed copies (SNIP_PROVEN_SWAPS). Every template in SNIP_BANDS_V7
 * keeps a stored human-paced winning plan for every per-pin deal
 * (fixtures/snip-rev7-proofs.json, scripts/snip-rev7-check.ts). snipRev 6
 * rounds keep SNIP_BANDS_V6 and the 1 px wobble.
 */
export const SNIP_REV_PROVEN = 7;
/** snipRev 7's per-pin wobbles (px), drawn by index from the level's pin stream. */
export const SNIP_PROVEN_WOBBLES: readonly number[] = [-10, -5, 0, 5, 10];
/** snipRev 7's fixed copies start here (after snipRev 6's 26 new levels). */
export const SNIP_PROVEN_FIRST = SNIP_BANK6_FIRST + SNIP_BANK6_SOURCES.length;
/** snipRev 6 template → its fixed snipRev 7 copy. */
export const SNIP_PROVEN_SWAPS: Readonly<Record<number, number>> = { [SNIP_BANK6_FIRST + 13]: SNIP_PROVEN_FIRST };
const provenBand = (band: readonly number[]) => band.map((t) => SNIP_PROVEN_SWAPS[t] ?? t);
/** snipRev 6's bands with each failing level swapped for its fixed copy (same band, same slot). */
export const SNIP_BANDS_V7 = {
  easy: provenBand(SNIP_BANDS_V6.easy),
  medium: provenBand(SNIP_BANDS_V6.medium),
  hard: provenBand(SNIP_BANDS_V6.hard),
};

/**
 * The ten-level order for a snipRev-7 seed: snipRev 6's draw for the same seed
 * (its stream and bands), with each swapped level dealt as its fixed copy, so
 * a seed meets the same levels on both revisions.
 */
export function snipLevelOrderV7(seed: number): number[] {
  return snipLevelOrderV6(seed).map((t) => SNIP_PROVEN_SWAPS[t] ?? t);
}

function initProven(seed: number): SnipState {
  const s = init(seed);
  return bandInit(buildLevel({ ...s, rng: seed | 0, order: snipLevelOrderV7(seed), rev: SNIP_REV_PROVEN, worldH: SNIP_TALL_H }, 0));
}

export const snipProvenGame: ArcadeGame<SnipState, ArcadeInputEvent | null> = { ...snipTallGame, init: initProven };
