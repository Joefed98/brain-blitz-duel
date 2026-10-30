/**
 * Browser side of `bun scripts/shots/tile-scenes.ts` (served by the Vite dev server, imported from
 * Playwright over a page that already carries the app's CSS): mounts every game's tile scene in its
 * own TILE × TILE black box, laid out in a grid, so the script can photograph each box. Never
 * imported by the app.
 */
import { useLayoutEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

import { preloadGameArt } from "@/lib/arcade/gameArt.renderer";

import { TILE, type SceneSet, type TileScene } from "./scene";
import { ARCADE_SCENES } from "./arcade";
import { ARCADE2_SCENES } from "./arcade2";
import { ATTENTION_SCENES } from "./attention";
import { LOGIC_SCENES } from "./logic";
import { NUMBER_SCENES } from "./number";
import { PATTERN_SCENES } from "./pattern";
import { SPEED_SCENES } from "./speed";
import { WORD_SCENES } from "./word";
import { SPORTS_SCENES } from "./sports";

export const ALL_SCENES: SceneSet = {
  ...WORD_SCENES,
  ...NUMBER_SCENES,
  ...SPEED_SCENES,
  ...ATTENTION_SCENES,
  ...PATTERN_SCENES,
  ...LOGIC_SCENES,
  ...ARCADE_SCENES,
  ...ARCADE2_SCENES,
  ...SPORTS_SCENES,
};

function CanvasBox({ scene }: { scene: Extract<TileScene, { kind: "canvas" }> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    const c = canvas?.getContext("2d");
    if (!canvas || !c) return;
    const k = 2;
    canvas.width = TILE * k;
    canvas.height = TILE * k;
    c.setTransform(k, 0, 0, k, 0, 0);
    c.imageSmoothingEnabled = true;
    scene.paint(c, k);
  }, [scene]);
  return <canvas ref={ref} style={{ width: TILE, height: TILE, display: "block" }} />;
}

/** Mounts the scenes for `types` (all when empty); resolves with the types mounted once art and fonts have loaded. */
export async function mountScenes(types: string[]): Promise<string[]> {
  const wanted = (types.length ? types : Object.keys(ALL_SCENES)).filter((t) => ALL_SCENES[t as keyof SceneSet]);
  await Promise.all(wanted.map((t) => preloadGameArt(t).catch(() => undefined)));
  await document.fonts.ready;
  document.getElementById("tile-scenes-host")?.remove();
  const host = document.createElement("div");
  host.id = "tile-scenes-host";
  host.style.cssText = `position:absolute;left:0;top:0;z-index:99999;display:grid;grid-template-columns:repeat(3,${TILE}px);gap:16px;padding:16px;background:#222`;
  document.body.appendChild(host);
  document.documentElement.style.overflow = "visible";
  document.body.style.overflow = "visible";
  const root = createRoot(host);
  flushSync(() =>
    root.render(
      <>
        {wanted.map((type) => {
          const scene = ALL_SCENES[type as keyof SceneSet]!;
          return (
            <div
              key={type}
              data-tile-scene={type}
              style={{ position: "relative", width: TILE, height: TILE, overflow: "hidden", background: "#000", contain: "strict" }}
            >
              {scene.kind === "canvas" ? <CanvasBox scene={scene} /> : scene.render()}
            </div>
          );
        })}
      </>,
    ),
  );
  for (let i = 0; i < 3; i++) await new Promise((r) => requestAnimationFrame(() => r(null)));
  // Freeze every CSS animation and transition at its end state so the picture never depends on timing.
  for (const a of document.getAnimations()) {
    try {
      a.finish();
    } catch {
      a.cancel();
    }
  }
  await new Promise((r) => setTimeout(r, 300));
  return wanted;
}
