/**
 * The Sports group's moments on the shared success layer (arcadeFx.renderer.ts; display only, 30 Oct 2026: Home Run
 * Derby, Free Kick, Racing, Minigolf, Speed Pool, Curling): which sim counters fire a burst, a banner or the miss
 * pulse. Each count is a counter its sim already keeps; nothing here writes to a sim.
 */
import type { ArcadeFxSpec } from "./arcadeFx.renderer";
import { homerunSignCount, HOMERUN_WORLD_H, HOMERUN_WORLD_W, OUT_FOUL, OUT_TAKEN, OUT_WHIFF, type HomerunState } from "./homerun";
import { freekickFxCounts, FREEKICK_WORLD_H, FREEKICK_WORLD_W, type FreekickState } from "./freekick";
import { racingFxCounts, RACING_WORLD_H, RACING_WORLD_W, type RacingState } from "./racing";
import { px } from "./engine";
import { MINIGOLF_H, MINIGOLF_HOLES, MINIGOLF_W, type MinigolfState } from "./minigolf";
import { POOL_H, POOL_SPOTS, POOL_W, type PoolState } from "./pool";
import { curlShotTeam, curlTakeouts, CURL_STONE_PTS, CURLING_H, CURLING_STONES, CURLING_W, TEAM_MINE, type CurlingState } from "./curling";
import { curlProject } from "./curling.renderer";

const homerunMisses = (s: HomerunState) => s.hits.filter((h) => h.out === OUT_WHIFF || h.out === OUT_TAKEN || h.out === OUT_FOUL).length;

export const HOMERUN_FX: ArcadeFxSpec<HomerunState> = {
  game: "homerun",
  world: "realworld",
  width: HOMERUN_WORLD_W,
  height: HOMERUN_WORLD_H,
  shake: false,
  textInset: 40,
  events: [
    // The renderer writes the call ("HOME RUN", the distance); the layer adds the burst over the stands (31 Oct 2026:
    // the stands sit higher with the camera behind the batter).
    { kind: "perfect", count: (s) => s.homers, at: () => ({ x: HOMERUN_WORLD_W / 2, y: 120 }), label: () => null, lights: ["#F2C75C", "#FFF1C2", "#FFFFFF"] },
    { kind: "streak", count: (s) => homerunSignCount(s), at: () => ({ x: HOMERUN_WORLD_W / 2, y: 140 }), label: () => null, neon: true },
  ],
  misses: [{ count: homerunMisses }],
};

export const FREEKICK_FX: ArcadeFxSpec<FreekickState> = {
  game: "freekick",
  world: "realworld",
  width: FREEKICK_WORLD_W,
  height: FREEKICK_WORLD_H,
  shake: false,
  textInset: 40,
  events: [
    { kind: "perfect", count: (s) => freekickFxCounts(s).goals, at: (s) => freekickFxCounts(s).at, label: () => null, lights: ["#F2C75C", "#FFFFFF"] },
    { kind: "streak", count: (s) => freekickFxCounts(s).targets, at: (s) => freekickFxCounts(s).at, label: () => "TARGET!", neon: true },
  ],
  misses: [{ count: (s) => freekickFxCounts(s).misses }],
};

export const RACING_FX: ArcadeFxSpec<RacingState> = {
  game: "racing",
  world: "realworld",
  width: RACING_WORLD_W,
  height: RACING_WORLD_H,
  shake: false,
  textInset: 40,
  events: [
    { kind: "pop", count: (s) => racingFxCounts(s).cleanSectors, at: () => ({ x: RACING_WORLD_W - 70, y: 90 }), label: () => "CLEAN", textOnly: true },
    { kind: "clear", count: (s) => racingFxCounts(s).laps, at: () => ({ x: RACING_WORLD_W / 2, y: 160 }), label: (_s, n) => (n >= 2 ? "FINISH!" : "LAP 2"), sweep: true },
  ],
  misses: [{ count: (s) => racingFxCounts(s).contacts }],
};

const holedCount = (s: MinigolfState) => s.holed.reduce((a, v) => a + v, 0);
const lastHole = (s: MinigolfState) => Math.max(0, Math.min(s.hole, MINIGOLF_HOLES - 1));
const cupAt = (s: MinigolfState) => {
  const h = s.course[lastHole(s)]!;
  return { x: px(h.cup.x), y: px(h.cup.y) };
};

/** Minigolf: every hole holed pops at the cup (named by its score to par), all five holed is the finale; water is a miss. */
export const MINIGOLF_FX: ArcadeFxSpec<MinigolfState> = {
  game: "minigolf",
  world: "realworld",
  width: MINIGOLF_W,
  height: MINIGOLF_H,
  fit: "world",
  shake: false,
  events: [
    {
      kind: "pop",
      count: holedCount,
      at: cupAt,
      label: (s) => {
        const i = lastHole(s);
        const diff = (s.taken[i] ?? 0) - (s.pars[i] ?? 0);
        if (s.taken[i] === 1) return "HOLE IN ONE!";
        return diff <= -2 ? "EAGLE!" : diff === -1 ? "BIRDIE!" : diff === 0 ? "PAR" : `+${diff}`;
      },
      when: (s) => (s.taken[lastHole(s)] ?? 9) >= (s.pars[lastHole(s)] ?? 0),
    },
    {
      kind: "perfect",
      count: holedCount,
      at: cupAt,
      label: (s) => (s.taken[lastHole(s)] === 1 ? "HOLE IN ONE!" : "BIRDIE!"),
      when: (s) => (s.taken[lastHole(s)] ?? 9) < (s.pars[lastHole(s)] ?? 0),
      lights: ["#F2C75C", "#FFFFFF", "#7FD58A"],
    },
    { kind: "final", count: (s) => (holedCount(s) === MINIGOLF_HOLES ? 1 : 0), label: () => "ALL FIVE HOLED!" },
  ],
  misses: [{ count: (s) => s.waters, at: (s) => ({ x: px(s.x), y: px(s.y) }) }],
};

/** Speed Pool: a run of pots pops its count, the spots cleared and the black are banners; a foul or a scratch is a miss. */
export const POOL_FX: ArcadeFxSpec<PoolState> = {
  game: "pool",
  world: "realworld",
  width: POOL_W,
  height: POOL_H,
  fit: "world",
  shake: false,
  events: [
    { kind: "combo", count: (s) => s.follows, at: () => ({ x: POOL_W / 2, y: 120 }), label: (s) => `${s.streak} IN A ROW` },
    { kind: "clear", count: (s) => (s.spotsDown >= POOL_SPOTS ? 1 : 0), label: () => "NOW THE BLACK" },
    { kind: "final", count: (s) => (s.black === 1 ? 1 : 0), label: () => "CLEARED!" },
  ],
  misses: [{ count: (s) => s.fouls + s.scratches }],
};

const houseAt = () => {
  const p = curlProject(0, 0);
  return { x: p.sx, y: p.sy };
};

/** Curling: a stone on the button, a takeout and the shot stone at the end; a stone that stops outside the house is a miss. */
export const CURLING_FX: ArcadeFxSpec<CurlingState> = {
  game: "curling",
  world: "realworld",
  width: CURLING_W,
  height: CURLING_H,
  fit: "world",
  shake: false,
  events: [
    { kind: "perfect", count: (s) => s.pts.filter((p) => p === CURL_STONE_PTS).length, at: houseAt, label: () => "ON THE BUTTON!" },
    { kind: "pop", count: curlTakeouts, at: houseAt, label: () => "TAKEOUT!" },
    { kind: "final", count: (s) => (s.thrown >= CURLING_STONES && s.over && curlShotTeam(s) === TEAM_MINE ? 1 : 0), label: () => "SHOT STONE!" },
  ],
  misses: [{ count: (s) => s.pts.filter((p, i) => i < s.thrown && p === 0).length }],
};
