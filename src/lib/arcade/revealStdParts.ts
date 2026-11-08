/**
 * The arcade answer reveal's breakdown parts for the games whose live stamps score on the arcade scoring standard but
 * are not listed in ARCADE_STANDARD (standard/index.ts; that map also drives the "?" help and arcade-standard-check's
 * roster, so these stay out of it): Roofbound, Grappler, Gemstone, Rainbow Bridge, Tilt, Ball Tracker and Orbit.
 *
 * `revealStdParts(type, state)` gives one StdPart a part (stdLines draws "Part: detail → n of max", then the total),
 * each part's points taken from the sim's own scoring, so they add up to what the sim stores (stdLines writes any
 * gap, the at-least-1 floor, as its own row). It returns null for any other game and for a state on an older revision,
 * whose reveal keeps its band lines exactly. Display only: nothing here scores.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { stdPart, type StdPart, type StdSpec } from "./arcadeStandard";
import { flipFlowScore, flipFlowUnits, flipSweetsTaken, FLIP_V11, FLIP_V8_SWEETS, type FlipState } from "./flip";
import {
  swingAssaultCounts,
  swingReworkParts,
  swingSlideParts,
  SWING_V15_CORE,
  SWING_V15_PAR_POINTS,
  SWING_V15_PICKUP_POINTS,
  SWING_V15_GATES,
  SWING_V15_GEMS,
  SWING_V15_STARS,
  SWING_V17_CORE,
  SWING_V17_GATES,
  SWING_V17_GATE_POINTS,
  SWING_V17_PAR_POINTS,
  SWING_V17_STREAK_BLOCK,
  SWING_V17_STREAK_MAX,
  type SwingState,
} from "./swing";
import {
  matchupGoalsMet,
  matchupSixParts,
  MATCHUP_V12_BIG_MAX,
  MATCHUP_V12_CORE_MAX,
  MATCHUP_V12_GOALS,
  MATCHUP_V12_GOALS_MAX,
  MATCHUP_V12_ICE_MAX,
  MATCHUP_V12_TREASURES,
  MATCHUP_V12_TREASURE_MAX,
  type MatchupState,
} from "./matchup";
import { inkClover, inkStdSpecFor, inkV13Score, INK_CLOUD_LEVELS, INK_LEVELS, INK_RUN_TICKS, INK_V13_CLOVERS, type InkState } from "./inkBridge";
import { tiltParParts, TILT_P_CLEAN_POINTS, TILT_P_CORE_MAX, TILT_P_PAR_MAX, TILT_P_SPEED_POINTS, TILT_RUN_TICKS, TILT_S_MAZES, TILT_S_PROGRESS_SCALE, type TiltState } from "./tilt";
import { btStdScore, BT_STD, BT_V7_BALLS, BT_V7_GOLDS, type BtState } from "./ballTrack";
import { orbitStdScore, orbitXpCounts, ORBIT_REV3_RUN_TICKS, ORBIT_STD, ORBIT_XP_FIELDS, ORBIT_XP_MOONS, ORBIT_XP_MOTES, ORBIT_XP_TRAILS, type OrbitRev3State } from "./orbitRev3";
import { ORBIT_TOTAL } from "./orbit";

/** "1 gate" / "3 gates" (or the plural given). */
const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
/** "3 of 5 gates" (the plural unless the total is one). */
const of = (got: number, total: number, many: string) => `${got} of ${total} ${many}`;
/** Ticks as seconds, one decimal, "45.2 s". */
const secs = (ticks: number) => `${(Math.max(0, ticks) / 60).toFixed(1)} s`;

/* ---- Roofbound: flipRev 11 and 12 (states carry `flow`) ---- */

function flipParts(s: FlipState): StdPart[] | null {
  if (!s.flow) return null;
  const b = flipFlowScore(s);
  const clean = flipFlowUnits(s) / 2;
  const saves = s.saves ?? 0;
  const sweets = flipSweetsTaken(s);
  return [
    stdPart(FLIP_V11, "core", b.core, `${clean % 1 ? clean.toFixed(1) : clean} s clean${saves ? ` · ${n(saves, "crash", "crashes")} saved` : ""}`),
    stdPart(FLIP_V11, "sweets", b.features["sweets"] ?? 0, of(sweets, FLIP_V8_SWEETS, "perfect landings")),
    stdPart(FLIP_V11, "doubles", b.features["doubles"] ?? 0, n(s.combos ?? 0, "double flip")),
    stdPart(FLIP_V11, "flow", b.features["flow"] ?? 0, n(s.bestStreak ?? 0, "clean jump", "clean jumps") + " in a row"),
  ];
}

/* ---- Grappler: swingRev 17 (`slide`), and swingRev 15 and 16 (`rework`) ---- */

const SWING_V17_SPEC: StdSpec = {
  field: "swingRev",
  rev: 17,
  parts: [
    { key: "core", label: "Course", max: SWING_V17_CORE },
    { key: "par", label: "Pars", max: SWING_V17_PAR_POINTS },
    { key: "gates", label: "Gates", max: SWING_V17_GATE_POINTS * SWING_V17_GATES },
    { key: "streak", label: "Clean-swing streak", max: SWING_V17_STREAK_MAX },
  ],
};
const SWING_V15_SPEC: StdSpec = {
  field: "swingRev",
  rev: 15,
  parts: [
    { key: "core", label: "Course", max: SWING_V15_CORE },
    { key: "par", label: "Pars", max: SWING_V15_PAR_POINTS },
    { key: "pickups", label: "Pickups", max: SWING_V15_PICKUP_POINTS * (SWING_V15_GATES + SWING_V15_GEMS + SWING_V15_STARS) },
  ],
};

function swingParts(s: SwingState): StdPart[] | null {
  if (!s.slide && !s.rework) return null;
  const c = swingAssaultCounts(s);
  const pars = `${n(c.parsBeaten, "stretch", "stretches")} under par`;
  if (s.slide) {
    const p = swingSlideParts(s);
    const paid = s.streakPaid ?? 0;
    return [
      stdPart(SWING_V17_SPEC, "core", p.core, `${Math.trunc(p.permille / 10)} % of the course`),
      stdPart(SWING_V17_SPEC, "par", p.par, pars),
      stdPart(SWING_V17_SPEC, "gates", p.gates, of(c.gates, SWING_V17_GATES, "gates")),
      stdPart(SWING_V17_SPEC, "streak", p.streak, `${n(paid, "run", "runs")} of ${SWING_V17_STREAK_BLOCK} clean grabs`),
    ];
  }
  const p = swingReworkParts(s);
  return [
    stdPart(SWING_V15_SPEC, "core", p.core, `${Math.trunc(p.permille / 10)} % of the course`),
    stdPart(SWING_V15_SPEC, "par", p.par, pars),
    stdPart(SWING_V15_SPEC, "pickups", p.pickups, `${n(c.gates, "gate")}, ${n(c.gems, "gem")} and ${n(c.starsBanked, "star")}`),
  ];
}

/* ---- Gemstone: matchupRev 12 (`six`) ---- */

const MATCHUP_V12_SPEC: StdSpec = {
  field: "matchupRev",
  rev: 12,
  parts: [
    { key: "core", label: "Gems cleared", max: MATCHUP_V12_CORE_MAX },
    { key: "treasure", label: "Treasure", max: MATCHUP_V12_TREASURE_MAX },
    { key: "goals", label: "Colour goals", max: MATCHUP_V12_GOALS_MAX },
    { key: "ice", label: "Ice", max: MATCHUP_V12_ICE_MAX },
    { key: "big", label: "Big lines", max: MATCHUP_V12_BIG_MAX },
  ],
};

function matchupParts(s: MatchupState): StdPart[] | null {
  if (!s.six) return null;
  const p = matchupSixParts(s);
  const gems = s.gemsCleared ?? 0;
  return [
    stdPart(MATCHUP_V12_SPEC, "core", p.core, `${gems.toLocaleString("en-GB")} ${gems === 1 ? "gem" : "gems"}`),
    stdPart(MATCHUP_V12_SPEC, "treasure", p.treasure, `${of(s.treasures ?? 0, MATCHUP_V12_TREASURES, "treasures")} brought down`),
    stdPart(MATCHUP_V12_SPEC, "goals", p.goals, of(matchupGoalsMet(s), MATCHUP_V12_GOALS, "colours done")),
    stdPart(MATCHUP_V12_SPEC, "ice", p.ice, `${n(s.iceBroken ?? 0, "frozen cell")} broken`),
    stdPart(MATCHUP_V12_SPEC, "big", p.big, `${n(s.bigLines ?? 0, "line")} of 4 or 5`),
  ];
}

/* ---- Rainbow Bridge: inkRev 13 and 14 ---- */

function inkParts(s: InkState): StdPart[] | null {
  if (!inkClover(s.rev)) return null;
  const spec = inkStdSpecFor(s.rev);
  const b = inkV13Score(s);
  const levels = Math.max(0, Math.min(INK_LEVELS, s.levels));
  const left = INK_RUN_TICKS - Math.max(0, Math.min(INK_RUN_TICKS, s.endedTick || s.tick));
  return [
    stdPart(spec, "core", b.core, of(levels, INK_LEVELS, "levels")),
    stdPart(spec, "par", b.features["par"] ?? 0, `${n(s.parLevels ?? 0, "level")} within par`),
    stdPart(spec, "tricks", b.features["tricks"] ?? 0, of(s.tricks ?? 0, INK_CLOUD_LEVELS, "trick shots")),
    stdPart(spec, "clovers", b.features["clovers"] ?? 0, of(s.shamrocks ?? 0, INK_V13_CLOVERS, "clovers")),
    stdPart(spec, "speed", b.features["speed"] ?? 0, levels >= INK_LEVELS ? `${secs(left)} left` : "not every level"),
  ];
}

/* ---- Tilt: tiltRev 11 and 12 (`parClean`) ---- */

const TILT_V11_SPEC: StdSpec = {
  field: "tiltRev",
  rev: 11,
  parts: [
    { key: "core", label: "Mazes", max: TILT_P_CORE_MAX },
    { key: "par", label: "Par", max: TILT_P_PAR_MAX },
    { key: "clean", label: "Clean run", max: TILT_P_CLEAN_POINTS },
    { key: "speed", label: "Speed", max: TILT_P_SPEED_POINTS },
  ],
};

function tiltParts(s: TiltState): StdPart[] | null {
  if (!s.parClean) return null;
  const p = tiltParParts(s);
  const finished = p.mazes >= TILT_S_MAZES;
  const prog = !finished && s.progMaze === p.mazes ? Math.max(0, Math.min(TILT_S_PROGRESS_SCALE, s.prog ?? 0)) : 0;
  const pct = Math.trunc((100 * prog) / TILT_S_PROGRESS_SCALE);
  const end = Math.max(0, Math.min(TILT_RUN_TICKS, s.endedTick));
  return [
    stdPart(TILT_V11_SPEC, "core", p.core, `${of(p.mazes, TILT_S_MAZES, "mazes")}${pct > 0 ? ` · ${pct} % of the next` : ""}`),
    stdPart(TILT_V11_SPEC, "par", p.par, `${n(p.parsMet, "maze")} within par`),
    stdPart(TILT_V11_SPEC, "clean", p.clean, (s.falls ?? 0) === 0 ? (p.mazes ? `no fall in ${n(p.mazes, "maze")}` : "no maze yet") : `${n(p.cleanMazes, "maze")} before the first fall`),
    stdPart(TILT_V11_SPEC, "speed", p.speed, finished ? `all ${TILT_S_MAZES} in ${secs(end)}` : "not every maze"),
  ];
}

/* ---- Ball Tracker: btRev 8 (`std`) ---- */

function btParts(s: BtState): StdPart[] | null {
  if (!s.std) return null;
  const b = btStdScore(s);
  return [
    stdPart(BT_STD, "core", b.core, of(s.home, BT_V7_BALLS, "marbles")),
    stdPart(BT_STD, "gold", b.features["gold"] ?? 0, of(s.golds ?? 0, BT_V7_GOLDS, "gold marbles")),
    stdPart(BT_STD, "combo", b.features["combo"] ?? 0, n(s.combos ?? 0, "combo landing")),
    stdPart(BT_STD, "boost", b.features["boost"] ?? 0, n(s.boosts ?? 0, "boosted marble")),
  ];
}

/* ---- Orbit: orbitRev 13 and 14 (`std`) ---- */

function orbitParts(s: OrbitRev3State): StdPart[] | null {
  if (!s.std) return null;
  const b = orbitStdScore(s);
  const c = orbitXpCounts(s);
  const finished = Boolean(s.finished);
  const best = Math.max(0, Math.min(ORBIT_TOTAL, s.best));
  const left = ORBIT_REV3_RUN_TICKS - Math.max(0, Math.min(ORBIT_REV3_RUN_TICKS, s.endedTick));
  const f = (key: string) => b.features[key] ?? 0;
  return [
    stdPart(ORBIT_STD, "core", b.core, finished || best >= ORBIT_TOTAL ? "sun reached" : of(best, ORBIT_TOTAL, "planets")),
    stdPart(ORBIT_STD, "speed", f("speed"), finished ? `${secs(left)} left` : "sun not reached"),
    stdPart(ORBIT_STD, "dust", f("dust"), of(c.dust, ORBIT_XP_TRAILS * ORBIT_XP_MOTES, "motes")),
    stdPart(ORBIT_STD, "slings", f("slings"), of(c.slings, ORBIT_XP_MOONS, "slingshots")),
    stdPart(ORBIT_STD, "fields", f("fields"), of(c.threads, ORBIT_XP_FIELDS, "fields")),
    stdPart(ORBIT_STD, "perfect", f("perfect"), n(c.perfect, "perfect orbit")),
  ];
}

const BY_TYPE: Readonly<Record<string, (state: any) => StdPart[] | null>> = {
  flip: flipParts,
  swing: swingParts,
  matchup: matchupParts,
  inkbridge: inkParts,
  tilt: tiltParts,
  balltrack: btParts,
  orbit: orbitParts,
};

/** The reveal's standard parts of a final state for the seven games above, or null (another game, or an older revision). */
export function revealStdParts(type: string, state: unknown): StdPart[] | null {
  if (!state || typeof state !== "object") return null;
  return BY_TYPE[type]?.(state) ?? null;
}
