/**
 * Which in-game looks draw their redrawn art (phase 2 step 4, docs/design/cosmetics-redraws/): each item's switch in
 * src/config/cosmeticRedraws.ts (every one off on 15 Nov 2026, so every look draws exactly as before). Display only:
 * no sim, grader or deal reads this.
 *
 * `setRedrawPreview` is for the review and check scripts alone (scripts/cosmetic-redraws/game-looks-shots.ts): it
 * forces the named redraws on (or every one, with "all") without touching the switches. The app never calls it.
 */
import { REDRAWN_ART_ON, redrawnArtOn } from "@/config/cosmeticRedraws";

let preview: ReadonlySet<string> | "all" | null = null;

/** Script-only: force these redraws on ("all" for every one), or null to follow the switches again. */
export function setRedrawPreview(ids: readonly string[] | "all" | null): void {
  preview = ids === null ? null : ids === "all" ? "all" : new Set(ids);
}

/** Whether this item (a skin, world theme or card back id) draws its redraw. */
export function skinRedrawn(id: string | null | undefined): boolean {
  if (!id) return false;
  if (preview === "all" ? id in REDRAWN_ART_ON : preview?.has(id)) return true;
  return redrawnArtOn(id);
}
