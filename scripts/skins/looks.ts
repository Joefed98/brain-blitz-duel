/** Every look the skins checks draw for a game: the default first, each skin, each world theme, a skin with its theme,
 * and on Full House each card back alone and with a felt. */
import { CARD_BACK_GAMES, CARD_BACK_IDS, GAME_SKIN_IDS, isSkinnableGame, NO_LOOK, WORLD_THEME_IDS, type GameLook } from "../../src/lib/arcade/skins/look";

export function looksFor(game: string, withDefault = true): GameLook[] {
  if (!isSkinnableGame(game)) return withDefault ? [NO_LOOK] : [];
  const skins = GAME_SKIN_IDS[game];
  const worlds = WORLD_THEME_IDS[game];
  const backs = CARD_BACK_GAMES.includes(game) ? CARD_BACK_IDS : [];
  return [
    ...(withDefault ? [NO_LOOK] : []),
    ...skins.map((skin) => ({ skin, world: null, back: null })),
    ...worlds.map((world) => ({ skin: null, world, back: null })),
    ...worlds.flatMap((world) => skins.slice(0, 1).map((skin) => ({ skin, world, back: null }))),
    ...backs.map((back) => ({ skin: null, world: null, back })),
    ...backs.flatMap((back) => skins.slice(0, 1).map((skin) => ({ skin, world: null, back }))),
  ];
}

export const lookName = (l: GameLook): string => [l.skin, l.world, l.back].filter(Boolean).join(" + ") || "default";
