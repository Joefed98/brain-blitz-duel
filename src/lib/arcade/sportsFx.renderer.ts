/**
 * The shared success and miss effects layer (arcadeFx.renderer.ts) for the Sports group (30 Oct 2026: Home Run
 * Derby, Free Kick, Racing): which sim counters fire a burst, a banner or the miss pulse. Display only; each count
 * is a counter the sim already keeps.
 */
import type { ArcadeFxSpec } from "./arcadeFx.renderer";
import { homerunSignCount, HOMERUN_WORLD_H, HOMERUN_WORLD_W, OUT_FOUL, OUT_TAKEN, OUT_WHIFF, type HomerunState } from "./homerun";
import { freekickFxCounts, FREEKICK_WORLD_H, FREEKICK_WORLD_W, type FreekickState } from "./freekick";
import { racingFxCounts, RACING_WORLD_H, RACING_WORLD_W, type RacingState } from "./racing";

const homerunMisses = (s: HomerunState) => s.hits.filter((h) => h.out === OUT_WHIFF || h.out === OUT_TAKEN || h.out === OUT_FOUL).length;

export const HOMERUN_FX: ArcadeFxSpec<HomerunState> = {
  game: "homerun",
  world: "realworld",
  width: HOMERUN_WORLD_W,
  height: HOMERUN_WORLD_H,
  shake: false,
  textInset: 40,
  events: [
    // The renderer writes the call ("HOME RUN", the distance); the layer adds the burst over the stands.
    { kind: "perfect", count: (s) => s.homers, at: () => ({ x: HOMERUN_WORLD_W / 2, y: 230 }), label: () => null, lights: ["#F2C75C", "#FFF1C2", "#FFFFFF"] },
    { kind: "streak", count: (s) => homerunSignCount(s), at: () => ({ x: HOMERUN_WORLD_W / 2, y: 250 }), label: () => null, neon: true },
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
