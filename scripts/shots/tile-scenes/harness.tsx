/**
 * Browser side of `bun scripts/shots/tile-scenes.ts` (served by the Vite dev server, imported from
 * Playwright over a page that already carries the app's CSS): mounts every game's tile scene in its
 * own TILE × TILE black box, laid out in a grid, so the script can photograph each box. Never
 * imported by the app.
 */
import { useLayoutEffect, useRef } from "react";
import { strategyImage, type StrategyArtName } from "@/lib/arcade/strategyArt";
import { STRATEGY_ART } from "@/lib/arcade/strategyArt.data";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

import { preloadGameArt } from "@/lib/arcade/gameArt.renderer";

import { TILE, type SceneSet, type TileScene } from "./scene";
import { TILE_BACKGROUNDS, paintTileBackground } from "./backgrounds";
import { ARCADE_SCENES } from "./arcade";
import { ARCADE2_SCENES } from "./arcade2";
import { SPORTS_SCENES } from "./sports";
import { ATTENTION_SCENES } from "./attention";
import { LOGIC_SCENES } from "./logic";
import { NUMBER_SCENES } from "./number";
import { PATTERN_SCENES } from "./pattern";
import { SPEED_SCENES } from "./speed";
import { WORD_SCENES } from "./word";

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
  return <canvas ref={ref} style={{ position: "relative", width: TILE, height: TILE, display: "block" }} />;
}

/** The tile's in-game background (backgrounds.ts), under the scene, faded where it would compete with the picture. */
function BackgroundBox({ type }: { type: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const canvas = ref.current;
    const c = canvas?.getContext("2d");
    const bg = TILE_BACKGROUNDS[type as keyof typeof TILE_BACKGROUNDS];
    if (!canvas || !c || !bg) return;
    canvas.width = TILE * 2;
    canvas.height = TILE * 2;
    c.setTransform(2, 0, 0, 2, 0, 0);
    paintTileBackground(c, bg);
  }, [type]);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: TILE, height: TILE, display: "block" }} />;
}

/** Mounts the scenes for `types` (all when empty); resolves with the types mounted once art and fonts have loaded. */
/**
 * Loads the rendered sprites every wanted scene names (the Sports overhaul, 15 Nov 2026) and waits until the game's
 * loader hands each one back, so the tile is painted with the real art. Fails loudly if one never arrives.
 */
async function loadSceneSprites(wanted: string[]): Promise<void> {
  const need: [string, string][] = [];
  for (const t of wanted) {
    const scene = ALL_SCENES[t as keyof SceneSet];
    if (scene?.kind === "canvas") for (const [game, names] of scene.sprites ?? []) for (const n of names) need.push([game, n]);
  }
  if (need.length === 0) return;
  const { sportsSprite } = await import("@/lib/arcade/sportsSprites");
  for (let i = 0; i < 200; i++) {
    if (need.every(([g, n]) => sportsSprite(g, n) !== null)) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(`tile sprites never loaded: ${need.filter(([g, n]) => sportsSprite(g, n) === null).map(([g, n]) => `${g}/${n}`).join(", ")}`);
}

export async function mountScenes(types: string[]): Promise<string[]> {
  const wanted = (types.length ? types : Object.keys(ALL_SCENES)).filter((t) => ALL_SCENES[t as keyof SceneSet]);
  await Promise.all(wanted.map((t) => preloadGameArt(t).catch(() => undefined)));
  // The Strategy overhaul's rendered materials (stage 2): every image loaded before a scene paints, so the tiles show
  // the rendered gems, marbles, bubbles, disc and Captain (src/lib/arcade/strategyArt.ts).
  await Promise.all(
    (Object.keys(STRATEGY_ART) as StrategyArtName[]).map(
      (name) =>
        new Promise<void>((done) => {
          const started = Date.now();
          const wait = () => (strategyImage(name) || Date.now() - started > 10_000 ? done() : setTimeout(wait, 25));
          wait();
        }),
    ),
  );
  await loadSceneSprites(wanted);
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
              <BackgroundBox type={type} />
              {scene.kind === "canvas" ? (
                <CanvasBox scene={scene} />
              ) : (
                <div style={{ position: "absolute", inset: 0 }}>{scene.render()}</div>
              )}
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
