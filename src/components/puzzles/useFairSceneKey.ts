import { useEffect, useState } from "react";

import { artReady, preloadArtWorld } from "@/lib/arcade/sprites.renderer";

/**
 * The fairground arena scene's repaint key (display only): it changes once the stall
 * counter's art is ready, so the scene's counter matches the world's (tiled art, or
 * the code art while it is still loading or where it failed).
 */
export function useFairSceneKey(): number {
  const [ready, setReady] = useState(() => (artReady("fairground", "counter") ? 1 : 0));
  useEffect(() => {
    let live = true;
    void preloadArtWorld("fairground").then(() => {
      if (live && artReady("fairground", "counter")) setReady(1);
    });
    return () => {
      live = false;
    };
  }, []);
  return ready;
}
