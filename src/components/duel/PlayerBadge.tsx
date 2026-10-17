import { PLAYER_ICONS_ENABLED } from "@/lib/brand";
import { BADGE_GLYPH, PLAYER_COLOURS, playerInitial, type PlayerLook } from "@/lib/duel/playerLook";

import { PlayerIconSvg } from "./playerIcons";

/**
 * A player's badge: a disc in their colour with their icon, or their initial, in near-black on it
 * (4.5:1 or more for every palette colour). Decorative: the player's name always sits beside it,
 * so the badge is hidden from screen readers and colour never carries meaning alone.
 */
export function PlayerBadge({
  look,
  name,
  size = 20,
  className = "",
}: {
  look: PlayerLook | undefined;
  name: string;
  /** Diameter in CSS px. */
  size?: number;
  className?: string;
}) {
  if (!look) return null;
  const colour = PLAYER_COLOURS[look.colour]?.hex ?? PLAYER_COLOURS[0].hex;
  const icon = PLAYER_ICONS_ENABLED ? look.icon : null;
  return (
    <span
      aria-hidden="true"
      data-player-badge={look.colour}
      className={`shrink-0 font-display font-bold leading-none ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        width: size,
        height: size,
        background: colour,
        color: BADGE_GLYPH,
        fontSize: Math.round(size * 0.55),
        ["--badge-bg" as string]: colour,
      }}
    >
      {icon ? (
        <PlayerIconSvg icon={icon} size={Math.round(size * 0.68)} className="block" />
      ) : (
        playerInitial(name)
      )}
    </span>
  );
}
