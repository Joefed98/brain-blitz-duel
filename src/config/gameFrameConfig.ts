/**
 * The game frame's timer (phase 2 step 4, 15 Nov 2026; docs/design/game-fx/README.md "The timer"). The header is the
 * style guide's (your avatar and the game left, the score and a one-on-one opponent's avatar right); the timer in it is
 * the player's choice, Settings → Appearance → Game timer (src/lib/gameFrame/headerStyle.ts), kept on the device. The
 * default for everyone is the one line below.
 *
 *  - "bar":  a gold time bar along the header's bottom edge, no number; in the last ten seconds it turns red and the
 *            seconds appear. Screen readers hear the time throughout (the timer's label).
 *  - "ring": a gold ring round the seconds, centred.
 *  - "chip": the seconds (0:52) on a navy chip with a gold stripe along its foot that shrinks with the time.
 *
 * The computer and sideways-tablet side panel (the arena) draws the same choice, larger.
 */
export type GameTimer = "bar" | "ring" | "chip";

export const GAME_TIMERS: readonly GameTimer[] = ["bar", "ring", "chip"];

export const GAME_TIMER_LABEL: Record<GameTimer, string> = { bar: "Bar", ring: "Ring", chip: "Chip" };

/** The default every player starts with. */
export const DEFAULT_GAME_TIMER: GameTimer = "bar";
