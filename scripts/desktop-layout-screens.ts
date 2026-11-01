/**
 * The computer layout's screens (31 Oct 2026): what desktop-layout-check judges and
 * scripts/shots/desktop-layout-shots.ts draws, through the safe-area harness (scripts/theme-screens.ts).
 */
import { room, THEME_SCREENS, type ThemeScreen } from "./theme-screens";

const named = (name: string) => THEME_SCREENS.find((s) => s.name === name)!;

/** A room's live round of `type` with 16 players (round 3 of 3; the room panel's statuses show). */
export const roomRound = (type: string, arcade: boolean): ThemeScreen => ({
  name: `room mid-round, ${type}`,
  mode: "room",
  room: room("in_progress", "puzzle", arcade ? { players: 16, arcade: true, arcadeType: type, rounds: 3 } : { players: 16, rounds: 1 }),
  waitMs: 4500,
  plain: true,
});

export const DESKTOP_LAYOUT_SCREENS: ThemeScreen[] = [
  { ...named("practice list"), name: "practice" },
  { ...named("play"), name: "play" },
  { name: "room lobby, 16 players", mode: "room", room: room("waiting", "starting", { players: 16 }) },
  { name: "room standings, 16 players", mode: "room", room: room("in_progress", "standings", { players: 16, rounds: 2, meAt: 12 }), waitMs: 2500 },
  roomRound("racing", true),
  roomRound("pool", true),
  { ...roomRound("sudoku", false), name: "room mid-round, sudoku" },
  roomRound("freecell", true),
  // Joe (31 Oct 2026): only Cue Ball rotates; these top-down games are tall.
  roomRound("minigolf", true),
  roomRound("curling", true),
  roomRound("cross", true),
  roomRound("orbit", true),
  roomRound("tilt", true),
];
