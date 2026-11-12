/**
 * The 32 game avatars (docs/art/avatars; free for everyone) in any of the 32 player colours. The drawing is the
 * approved svg; only its main-colour gradient changes, with the three stops the source's own `paint` makes
 * (avatars.py: 38 % lighter, the colour, 28 % darker). A gem colour (locked until C1 adds the unlocks) takes the
 * gem's own three stops.
 */
import { PLAYER_COLOURS } from "@/lib/duel/playerLook";

import { dressAvatar, hasCosmetics, type AvatarCosmetics } from "./cosmetics";
import { AVATARS, GEMS } from "./playerCardArt.data";

export interface AvatarLook extends AvatarCosmetics {
  id: string;
  /** An index into the player colours; out of range draws the avatar's own default colour. */
  colour: number;
  gem: string | null;
}

export const DEFAULT_AVATAR_ID = "captain-joulz";
/** Captain Joulz in his own approved colours (colour -1: the drawing's default). */
export const DEFAULT_AVATAR: AvatarLook = { id: DEFAULT_AVATAR_ID, colour: -1, gem: null };

const BY_ID = new Map(AVATARS.map((a) => [a.id, a]));
const GEM_BY_ID = new Map(GEMS.map((g) => [g.id, g]));

/** avatars.py `_shade`: f > 0 lightens towards white, f < 0 darkens. */
export function shade(hex: string, f: number): string {
  const h = hex.replace("#", "");
  let [r, g, b] = [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16)) as [number, number, number];
  if (f > 0) [r, g, b] = [r, g, b].map((c) => Math.trunc(c + (255 - c) * f)) as [number, number, number];
  else [r, g, b] = [r, g, b].map((c) => Math.trunc(c * (1 + f))) as [number, number, number];
  return `#${[r, g, b].map((c) => c.toString(16).toUpperCase().padStart(2, "0")).join("")}`;
}

export function avatarExists(id: string): boolean {
  return BY_ID.has(id);
}

/** The three stops of an avatar's main colour. */
export function avatarStops(look: AvatarLook): [string, string, string] {
  const gem = look.gem ? GEM_BY_ID.get(look.gem) : undefined;
  if (gem) return [gem.stops[0]!, gem.stops[1]!, gem.stops[2]!];
  const art = BY_ID.get(look.id) ?? BY_ID.get(DEFAULT_AVATAR_ID)!;
  const main = PLAYER_COLOURS[look.colour]?.hex ?? art.defaultMain;
  return [shade(main, 0.38), main, shade(main, -0.28)];
}

/** An avatar's svg markup with its ids prefixed (one prefix per drawing on the page). */
export function avatarMarkup(look: AvatarLook, prefix: string): string {
  const art = BY_ID.get(look.id) ?? BY_ID.get(DEFAULT_AVATAR_ID)!;
  const [m0, m1, m2] = avatarStops(look);
  const svg = art.svg.replaceAll("{{p}}", prefix).replace("{{m0}}", m0).replace("{{m1}}", m1).replace("{{m2}}", m2);
  // Wave 2 E2: the finish, accessory and special edition the player equipped (cosmetics.ts); none: exactly as before.
  return hasCosmetics(look) ? dressAvatar(svg, look, prefix, m1) : svg;
}

/** A key for a look's memo (every field that changes its drawing). */
export function avatarKey(look: AvatarLook): string {
  return `${look.id}|${look.colour}|${look.gem ?? ""}|${look.finish ?? ""}|${look.accessory ?? ""}|${look.special ?? ""}`;
}

export { AVATARS, GEMS };
