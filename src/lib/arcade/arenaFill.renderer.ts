import type { ArcadeFxGame, EngineFxGame } from "./arcadeFxGames.renderer";

/** No fill: the spare space below the arena stays the page colour. */
export const ARENA_NO_FILL = "transparent";

/**
 * The colour below each arcade arena when the screen is taller than the fitted
 * world (ArcadeArenaSlot): the colour the game's art paints along its bottom edge,
 * so the spare space reads as part of the arena, not empty page. Presentation only.
 * Tuning B: Hover, Tilt, Roofbound, Rainbow Bridge, Junction and High Rise have
 * none (ARENA_NO_FILL); their spare space goes back to the page colour.
 */
export const ARCADE_ARENA_FILL: Record<ArcadeFxGame, string> = {
  hover: ARENA_NO_FILL,
  breaker: "#000000",
  rally: "#061821",
  beat: "#0B0A10",
  snake: "#000000",
  burst: "#000000",
  wavefront: "#07070C",
  orbit: "#06060F",
  skyline: ARENA_NO_FILL,
  cross: "#6FA851",
  junction: ARENA_NO_FILL,
  inkbridge: ARENA_NO_FILL,
  slice: "#70492F",
  bintoss: "#B37A41",
  bullseye: "#BB8044",
  bubble: "#06172E",
  flip: ARENA_NO_FILL,
  swing: "#4F0C08",
  snip: "#408B37",
  tilt: ARENA_NO_FILL,
  balltrack: "#7E5C38",
  matchup: "#0B0B0F",
  pinball: "#000000",
};

/** The same for engine games outside the Arcade category (ENGINE_GAME_WORLDS). */
export const ENGINE_ARENA_FILL: Record<EngineFxGame, string> = {
  // Letterfall: the toybox tabletop's edge colour.
  wordfall: "#2A1C14",
};
