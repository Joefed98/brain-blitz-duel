/**
 * Top Bins' footballs (wave 2, E1; docs/art/wave-2/items/game-skin/top-bins--*.html). Display only: the player's
 * ball is painted in its skin (ballArt.ts) at exactly the default ball's projected size and spin; the wall, keeper,
 * goal and pitch are unchanged. Top Bins has no world theme.
 */
import { BALL_ART_COLOURS, type BallArt } from "./ballArt";
import type { ContrastPair, GameLook } from "./look";

const BALLS: Readonly<Record<string, BallArt>> = {
  "game-skin.top-bins.comet": "comet",
  "game-skin.top-bins.retro-leather": "retro-leather",
  "game-skin.top-bins.neon-football": "neon-football",
};

export function freekickBallArt(look: GameLook): BallArt | null {
  return (look.skin && BALLS[look.skin]) || null;
}

/** What each Top Bins look must keep visible: the ball on the grass and against the night stands behind the goal. */
export function freekickContrast(look: GameLook): ContrastPair[] {
  const art = freekickBallArt(look);
  return [{ object: "ball", colours: art ? BALL_ART_COLOURS[art] : ["#FFFFFF", "#E4E7EC"], backgrounds: ["#2D7A3A", "#1E5A2C", "#0B0F18"] }];
}
