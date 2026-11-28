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

import { withArcadeFxInset } from "@/lib/arcade/arcadeFx.renderer";
import { takeHud, withHudInWorld } from "@/lib/arcade/hudPlacement";
import { clearLiveHud, offerLiveHud } from "@/lib/rated/liveHud";

import { ARENA_HUD_IN_PANEL, useArenaMount } from "./arena";
import { useDesktopPresentation } from "@/lib/desktopPresentation";

import { hudCut } from "./hudBands";
import { arenaPanelsHidden } from "./screenMode";

/** Returns `hudDraw(draw)`: runs one frame's draw with the HUD placed for this screen, then offers its values. */
export function useArenaHudDraw(): <T>(draw: () => T) => T {
  const { arena, hudBand } = useArenaMount();
  const arenaRef = useRef(arena);
  arenaRef.current = arena;
  const hudBandRef = useRef(hudBand);
  hudBandRef.current = hudBand;
  // A turned board (the landscape board, P4 desktop size PR 2) never draws its HUD in the world, even with the panels
  // hidden: its text would lie on its side there. Its values stay in the panel, or the corner tools when hidden.
  const turned = useDesktopPresentation().rotate;
  const turnedRef = useRef(turned);
  turnedRef.current = turned;
  useEffect(() => () => clearLiveHud(), []);
  return useCallback(<T,>(draw: () => T): T => {
    const onArena = arenaRef.current;
    // With the panels hidden (screenMode.ts) the HUD is drawn in the world again, as the panel listing it is gone.
    // With the HUD band cut (hudBands.ts), the success layer's frame effects follow the visible edge.
    const cut = hudCut(Boolean(onArena && ARENA_HUD_IN_PANEL) && !arenaPanelsHidden(), hudBandRef.current);
    const result = withHudInWorld(!(onArena && ARENA_HUD_IN_PANEL) || (arenaPanelsHidden() && !turnedRef.current), () => withArcadeFxInset(cut.top, cut.bottom, draw));
    if (onArena) offerLiveHud(takeHud(), performance.now());
    return result;
  }, []);
}
