/**
 * The arena's canvas HUD for an arcade stage that runs its own frame loop (P4, 27 Nov 2026; docs/desktop-support.md
 * "The canvas HUD in the panel"): what ArcadeCanvasStage does round its draw, for the eleven active games whose stage
 * draws its world itself (Breaker, Tempo, Hover, Rally, Meteor, Pinball, Spacewalk, High Rise, Coral Pop, Gemstone,
 * Ball Tracker). On the arena (a computer or a sideways tablet) and with ARENA_HUD_IN_PANEL on, the shared HUD painters
 * skip the world for that draw (hudPlacement.ts) and the values they noted go to the panel's store (liveHud.ts, at
 * most 4 times a second); everywhere else (phones, intro demos, reveals, replays, checks) the draw is exactly as before.
 *
 * Display only: it wraps a draw call and never touches the sim, its input or its timing.
 */
import { useCallback, useEffect, useRef } from "react";

import { takeHud, withHudInWorld } from "@/lib/arcade/hudPlacement";
import { clearLiveHud, offerLiveHud } from "@/lib/rated/liveHud";

import { ARENA_HUD_IN_PANEL, useArenaMount } from "./arena";

/** Returns `hudDraw(draw)`: runs one frame's draw with the HUD placed for this screen, then offers its values. */
export function useArenaHudDraw(): <T>(draw: () => T) => T {
  const { arena } = useArenaMount();
  const arenaRef = useRef(arena);
  arenaRef.current = arena;
  useEffect(() => () => clearLiveHud(), []);
  return useCallback(<T,>(draw: () => T): T => {
    const onArena = arenaRef.current;
    const result = withHudInWorld(!(onArena && ARENA_HUD_IN_PANEL), draw);
    if (onArena) offerLiveHud(takeHud(), performance.now());
    return result;
  }, []);
}
