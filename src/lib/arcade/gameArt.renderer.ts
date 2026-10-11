/**
 * Preloads a game's world art by puzzle type. Presentation only: never
 * imported by a sim or the server.
 */
import { arcadeWorldOf } from "./arcadeFxGames.renderer";
import { isArtWorld, preloadArtWorld } from "./sprites.renderer";

/**
 * Starts loading the art for a game's world and resolves once every sprite is
 * ready or has failed. Resolves at once for games with no art world; never rejects.
 */
export function preloadGameArt(type: string): Promise<void> {
  const world = arcadeWorldOf(type);
  return isArtWorld(world) ? preloadArtWorld(world) : Promise.resolve();
}
