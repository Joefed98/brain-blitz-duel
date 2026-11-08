import { Chip } from "@/design/components/Chip";

/**
 * "Left" after the name of a player who left the room (status "inactive"; 7 Nov 2026, accessibility audit #3).
 * The row used to be dimmed to 40 % alone (its text 2.1–3.5:1, nothing said why, nothing for a screen reader):
 * now it stays at full strength, the name in secondary text (room-screens.css, `[data-left]`) and this tag says it.
 */
export function LeftTag() {
  return <Chip variant="status" value="Left" data-left-tag="" className="shrink-0 self-center" />;
}
