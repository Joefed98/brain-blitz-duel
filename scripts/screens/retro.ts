/**
 * The Retro overhaul's screens (phase 2 step 4, 15 Nov 2026; docs/design/retro-overhaul.md): each Retro game's page in
 * the Games catalogue (its art, name, the intro's goal and how-to lines, its challenges and Play), so the reworded
 * intros (Rally's lives and spin shots, Tempo's and Fission's scoring) are drawn by theme-check and no-wrap-check at the
 * core sizes. Drawn after the core list (scripts/area-screens.ts finds this file).
 */
import { gamesChallengesFixture, gamesProgressFixture } from "./games";
import type { ThemeScreen } from "../theme-screens";

/** The ten Retro games, in the review's order (docs/design/game-reviews/retro.md). */
export const RETRO_GAMES = ["hover", "breaker", "rally", "wavefront", "burst", "beat", "snake", "cross", "pinball", "blockfall"] as const;

export default function retroScreens(): ThemeScreen[] {
  const globals = { __harnessProgress: gamesProgressFixture(), __DUELZ_CHALLENGES__: gamesChallengesFixture() };
  return RETRO_GAMES.map((type) => ({ name: `retro: game page, ${type}`, mode: "practice", plain: true, search: { page: type }, globals, waitMs: 900 }));
}
