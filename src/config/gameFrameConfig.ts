/**
 * The game frame's header and timer style (phase 2 step 4 pass 2, 15 Nov 2026; docs/design/game-fx/README.md "Header
 * styles"). Joe picks one from /dev-design's "Header styles" and the gallery; switching the default is this one line.
 *
 *  - "mockup":  the style guide's header (docs/design/style-guide/phone/puzzle.png): your avatar and the game left,
 *               the opponent's avatar and the score right, a gold time bar along the bottom, the seconds centred.
 *  - "ring":    the classic layout: the name left, a gold ring timer centred, the score right.
 *  - "digital": avatars as the mockup, a gold digital countdown (0:52) in a navy chip centred, no bar.
 *  - "chip":    no avatars; a navy chip whose gold fill shrinks with the time, the seconds inside it.
 */
export type HeaderStyle = "mockup" | "ring" | "digital" | "chip";

export const HEADER_STYLES: readonly HeaderStyle[] = ["mockup", "ring", "digital", "chip"];

/** The default every game screen draws. */
export const GAME_HEADER_STYLE: HeaderStyle = "mockup";
