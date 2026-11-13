/** A card look from a saved loadout (moved from ProfileCard.tsx, 13 Nov 2026, so app chrome can draw it light). */
import { DEFAULT_LOOK, type CardLook } from "@/design/identity/PlayerCard";
import type { Loadout } from "@/lib/identity/backend";

/** A card look from a saved loadout (the defaults where a slot is empty; the account's colour on Captain Joulz). */
export function lookFromLoadout(loadout: Loadout | null, colour: number | null): CardLook {
  return {
    cardArt: loadout?.slots["card-art"] ?? DEFAULT_LOOK.cardArt,
    frame: loadout?.slots["frame"] ?? DEFAULT_LOOK.frame,
    nameColour: loadout?.slots["name-colour"] ?? null,
    avatar: withAvatarItems(loadout?.avatar ?? (colour !== null ? { id: "captain-joulz", colour, gem: null } : null), loadout?.slots),
  };
}

/**
 * Wave 2 E2: the avatar's equipped finish, accessory and special edition (loadout slots) on the avatar; with none
 * equipped the avatar is returned exactly as it was.
 */
export function withAvatarItems<A extends { id: string; colour: number; gem: string | null }>(
  avatar: A | null,
  slots: Partial<Record<string, string | null>> | undefined,
): (A & { finish?: string | null; accessory?: string | null; special?: string | null }) | null {
  if (!avatar) return null;
  const finish = slots?.["avatar-finish"] ?? null;
  const accessory = slots?.["avatar-accessory"] ?? null;
  const special = slots?.["avatar-special-edition"] ?? null;
  if (!finish && !accessory && !special) return avatar;
  return { ...avatar, finish, accessory, special };
}

