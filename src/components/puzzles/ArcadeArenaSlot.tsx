import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import type { ArenaScenePainter } from "@/lib/arcade/arenaScene.renderer";

/**
 * The space an arcade arena may grow into: from the arena's fixed top edge (just under
 * the play screen's compact header) down to the controls below it, or 16px above the
 * bottom of the visible screen. Its one child carrying `data-game-arena` is sized by
 * CSS (styles.css, "Arcade arena slot") to the game's world aspect ratio at the largest
 * uniform scale that fits, top-anchored and centred across, so every phone shows
 * exactly the same world, undistorted. The slot runs edge to edge; every gap around the
 * world (beside it, below it) is the screen edge's black (--screen-edge, 15 Oct 2026),
 * the same as the rest of the arcade play screen, except where a game gives a `scene`:
 * then, on the arcade play screen only, its own scenery (arenaScene.renderer.ts) is
 * painted behind the world out to the slot's edges, once per size, and takes no touches.
 *
 * Presentation only: games keep mapping pointers through the arena element's own
 * box, so world coordinates, input logs and replays are unchanged.
 */
export function ArcadeArenaSlot({ width, height, scene, sceneKey, children }: {
  /** World (view) size the game draws, in world units. */
  width: number;
  height: number;
  /** The game's own scenery beyond the world (display only); see arenaScene.renderer.ts. */
  scene?: ArenaScenePainter | undefined;
  /** Repaints the scene when it changes (e.g. a new level's ground line). */
  sceneKey?: string | number | undefined;
  children: ReactNode;
}) {
  const slot = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const painter = useRef(scene);
  painter.current = scene;

  useEffect(() => {
    const node = canvas.current;
    const box = slot.current;
    if (!node || !box || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const paint = () => {
      frame = 0;
      const draw = painter.current;
      const world = box.querySelector<HTMLElement>(":scope > [data-game-arena]");
      if (!draw || !world || getComputedStyle(node).display === "none") return;
      const s = box.getBoundingClientRect();
      const w = world.getBoundingClientRect();
      if (s.width < 1 || s.height < 1 || w.width < 1) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const pw = Math.round(s.width * ratio);
      const ph = Math.round(s.height * ratio);
      if (node.width !== pw || node.height !== ph) {
        node.width = pw;
        node.height = ph;
      }
      const ctx = node.getContext("2d");
      if (!ctx) return;
      const scale = w.width / width;
      const ox = w.left - s.left;
      const oy = w.top - s.top;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, pw, ph);
      ctx.setTransform(ratio * scale, 0, 0, ratio * scale, ratio * ox, ratio * oy);
      ctx.save();
      draw(ctx, {
        worldW: width,
        worldH: height,
        left: -ox / scale,
        top: -oy / scale,
        right: (s.width - ox) / scale,
        bottom: (s.height - oy) / scale,
        scale,
      });
      ctx.restore();
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(box);
    observer.observe(node);
    const world = box.querySelector(":scope > [data-game-arena]");
    if (world) observer.observe(world);
    schedule();
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [width, height, sceneKey, scene !== undefined]);

  return (
    <div
      ref={slot}
      data-arena-slot=""
      data-scene={scene ? "" : undefined}
      style={{ "--arena-w": width, "--arena-h": height } as CSSProperties}
    >
      {scene ? <canvas ref={canvas} data-arena-scene="" aria-hidden="true" /> : null}
      {children}
    </div>
  );
}
