import type { ArcadeFxGame, EngineFxGame } from "./arcadeFxGames.renderer";

/**
 * The colour below each arcade arena when the screen is taller than the fitted
 * world (ArcadeArenaSlot): the colour the game's art paints along its bottom edge,
 * so the spare space reads as part of the arena, not empty page. Presentation only.
 */
export const ARCADE_ARENA_FILL: Record<ArcadeFxGame, string> = {
  hover: "#2C0A0F",
  breaker: "#000000",
  rally: "#061821",
  beat: "#0B0A10",
  snake: "#000000",
  burst: "#000000",
  wavefront: "#07070C",
  orbit: "#06060F",
  skyline: "#1C2839",
  cross: "#0B0B0F",
  junction: "#86BF63",
  inkbridge: "#65B94B",
  slice: "#70492F",
  bintoss: "#B37A41",
  bullseye: "#BB8044",
  bubble: "#06172E",
  flip: "#2A2A32",
  swing: "#4F0C08",
  snip: "#408B37",
  tilt: "#AC8353",
  balltrack: "#7E5C38",
  matchup: "#0B0B0F",
};

/** The same for engine games outside the Arcade category (ENGINE_GAME_WORLDS). */
export const ENGINE_ARENA_FILL: Record<EngineFxGame, string> = {
  // Letterfall: the toybox tabletop's edge colour.
  wordfall: "#2A1C14",
};
