/**
 * Phase 2 step 3, rooms and rated (14 Nov 2026): the screens this area redesigned, drawn by theme-check and
 * no-wrap-check at every size (VIEWPORTS, then ALL_SIZES); LIGHT_SCREENS draws each again in the light theme. Kept in
 * its own file so the page sessions' screen lists merge without touching each other (scripts/area-screens.ts finds it
 * and draws it after the core list, 14 Nov 2026).
 */
import { ALL_SIZES, room, type ThemeScreen, type ThemeViewport } from "../theme-screens";

type RoomFn = (status: "waiting" | "in_progress" | "finished", phase: string, opts?: Record<string, unknown>) => ThemeScreen["room"];

export function roomsRatedScreens({ room, sizes }: { room: RoomFn; sizes: ThemeViewport[] }): ThemeScreen[] {
  const rooms: ThemeScreen[] = [
    { name: "rooms: lobby, 2 players", mode: "room", room: room("waiting", "starting") },
    { name: "rooms: lobby, 10 players", mode: "room", room: room("waiting", "starting", { players: 10 }) },
    { name: "rooms: round leaderboard, 2 players", mode: "room", room: room("in_progress", "result"), waitMs: 1500 },
    { name: "rooms: standings, 10 players", mode: "room", room: room("in_progress", "standings", { players: 10, rounds: 2 }), waitMs: 2500 },
    { name: "rooms: final results, 2 players", mode: "room", room: room("finished", "result"), waitMs: 2500 },
    { name: "rooms: podium, 10 players", mode: "room", room: room("finished", "result", { players: 10, rounds: 6 }), waitMs: 3000 },
  ];
  const rated = (
    [
      "searching",
      "vs-live",
      "match-header",
      "match-header-placement",
      "result-won",
      "result-placement",
      "tiers",
      "dropout-rated",
      "multi-standings",
      "multi-final",
    ] as const
  ).map((screen): ThemeScreen => ({ name: `rated: ${screen.replaceAll("-", " ")}`, mode: "rated", plain: true, globals: { __harnessRated: { screen } } }));
  return [...rooms, ...rated].map((s) => ({ ...s, sizes }));
}

/** This area's screens for theme-check and no-wrap-check (the area-file shape, scripts/area-screens.ts). */
export default (): ThemeScreen[] => roomsRatedScreens({ room, sizes: ALL_SIZES });
