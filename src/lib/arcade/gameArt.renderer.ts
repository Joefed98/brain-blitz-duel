/**
 * Preloads a game's world art by puzzle type. Presentation only: never
 * imported by a sim or the server.
 */
import { preloadSceneImages } from "./skins/sceneImages";
import { COURSE_IMAGES } from "./skins/minigolfCourse";
/** Captain Joulz on the Crazy Golf course (minigolf.renderer.ts drawCaptain). */
const CAPTAIN_IMAGES = ["mg.captain-address", "mg.captain-putt", "mg.captain-chip"] as const;
import { arcadeWorldOf } from "./arcadeFxGames.renderer";
import { isArtWorld, preloadArtWorld } from "./sprites.renderer";

/**
 * Starts loading the art for a game's world and resolves once every sprite is
 * ready or has failed. Resolves at once for games with no art world; never rejects.
 */
export function preloadGameArt(type: string): Promise<void> {
  loadGameArtFonts();
  const world = arcadeWorldOf(type);
  const art = isArtWorld(world) ? preloadArtWorld(world) : Promise.resolve();
  // Crazy Golf's rendered course and Captain Joulz's sprites (Blender WebPs, ~100 KB in all).
  if (type === "minigolf") return Promise.all([art, preloadSceneImages([...COURSE_IMAGES, ...CAPTAIN_IMAGES])]).then(() => undefined);
  return art;
}

/** The face several games' canvas art names (gameArtFonts.css); asked for once, so it is ready before the round. */
export const GAME_ART_MONO = "JetBrains Mono";
let artFontsAsked = false;
function loadGameArtFonts(): void {
  if (artFontsAsked || typeof document === "undefined" || !document.fonts) return;
  artFontsAsked = true;
  for (const weight of [600, 700]) void document.fonts.load(`${weight} 16px "${GAME_ART_MONO}"`).catch(() => undefined);
}
