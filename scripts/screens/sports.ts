/**
 * The Sports overhaul's screens (phase 2 step 4; docs/design/pages-review/sports/GALLERY.md) for theme-check and
 * no-wrap-check: for Cue Ball, Curl Champ and Apex, the game's page (its new intro and how-to lines, its challenges) and
 * the room's answer reveal with the game's new run summary drawn from a real stored run (the game's own skill-band bot,
 * scripts/screens/sports-fixture.ts) beside five other players, at every size. Drawn after the core list
 * (scripts/area-screens.ts finds this file).
 */
import { room, ALL_SIZES, type ThemeScreen } from "../theme-screens";
import { openYourRun } from "./reveals";
import { SPORTS_OVERHAUL_GAMES, sportsRunFor, type SportsOverhaulGame } from "./sports-fixture";

const NAMES: Record<SportsOverhaulGame, string> = { pool: "Cue Ball", curling: "Curl Champ", racing: "Apex" };

/** The reveal phase with every player's result stored (the room fixture stores none in "reveal" unless asked). */
function revealRoomScored(type: SportsOverhaulGame) {
  const base = room("in_progress", "reveal", { arcade: true, arcadeType: type, players: 6, revealParts: true });
  return () => {
    const r = base();
    const puzzle = r.duel.puzzles_public[0] as unknown as Record<string, unknown>;
    const run = sportsRunFor(type, puzzle, "good");
    return {
      ...r,
      results: r.results.map((row) => (row.player_slot === 1 ? { ...row, answer: run.answer, score: run.score, extra: null } : row)),
    };
  };
}

export default function sportsScreens(): ThemeScreen[] {
  return SPORTS_OVERHAUL_GAMES.flatMap((type): ThemeScreen[] => [
    { name: `sports, ${NAMES[type]}'s game page`, mode: "practice", search: { page: type }, plain: true, waitMs: 800, sizes: ALL_SIZES },
    // Changed with Joe's approval, 21 Nov 2026: opens "Your run" (a room's reveal opens on the Room view), so the run summary is what is judged.
    { name: `sports, ${NAMES[type]}'s answer reveal with the run summary`, mode: "room", room: revealRoomScored(type), waitMs: 2500, plain: true, sizes: ALL_SIZES, go: openYourRun },
  ]);
}
