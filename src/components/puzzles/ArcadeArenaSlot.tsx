import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

import type { ArenaAmbient, ArenaScenePainter, ArenaSceneView } from "@/lib/arcade/arenaScene.renderer";
import { reducedMotion } from "@/lib/arcade/art.renderer";
import { arcadeReducedEffects, watchArcadeFrames } from "@/lib/fx/lowEnd";
import { arenaFrame, cancelArenaFrame, canvasRatio } from "@/lib/battery";

/** useLayoutEffect in the browser (before the first paint), a no-op on the server. */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** A moving fill repaints at most this often (ms): slow, gentle motion needs no more. */
const AMBIENT_MS = 50;

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
 * painted behind the world out to the screen's edges (17 Oct 2026: under the header, the
 * controls, the 16px bottom strip and the home bar too), once per integer canvas size,
 * and takes no touches. An `ambient` layer adds the few moving fills (lights, drifting
 * notes, walkers) over the scene, at most every AMBIENT_MS, still under reduced motion
 * or reduced effects.
 *
 * Presentation only: games keep mapping pointers through the arena element's own
 * box, so world coordinates, input logs and replays are unchanged.
 */
export function ArcadeArenaSlot({ width, height, centre = false, playCentre = false, scene, sceneKey, ambient, sceneUnderHeader = false, children }: {
  /** World (view) size the game draws, in world units. */
  width: number;
  height: number;
  /** Centre the world vertically in the slot (its spare height split above and below) instead of top-anchoring it. */
  centre?: boolean | undefined;
  /** As `centre`, on the arcade play screen only (intros, demos and reveals keep the world top-anchored). */
  playCentre?: boolean | undefined;
  /** The game's own scenery beyond the world (display only); see arenaScene.renderer.ts. */
  scene?: ArenaScenePainter | undefined;
  /** Repaints the scene when it changes (e.g. a new level's ground line). */
  sceneKey?: string | number | undefined;
  /** The game's moving fill beyond the world (display only), over its scene. */
  ambient?: ArenaAmbient | undefined;
  /** The scene runs on behind the play header too (Gemstone); otherwise the header row stays black. */
  sceneUnderHeader?: boolean | undefined;
  children: ReactNode;
}) {
  const slot = useRef<HTMLDivElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const moving = useRef<HTMLCanvasElement | null>(null);
  const painter = useRef(scene);
  painter.current = scene;
  const mover = useRef(ambient);
  mover.current = ambient;
  const underHeader = useRef(sceneUnderHeader);
  underHeader.current = sceneUnderHeader;
  /** The arcade play screen the scene paints across (null anywhere else: intros, demos, reveals). */
  const [host, setHost] = useState<HTMLElement | null>(null);

  // Low-end performance (16 Oct 2026, presentation only): every arena watches its frame gaps and
  // steps into reduced effects when frames run long (lib/fx/lowEnd.ts); a fast phone never does.
  useEffect(() => watchArcadeFrames(), []);

  useIsoLayoutEffect(() => {
    const found = scene ? (slot.current?.closest<HTMLElement>("[data-arcade-play]") ?? null) : null;
    if (found !== host) setHost(found);
  });

  useEffect(() => {
    const node = canvas.current;
    const box = slot.current;
    if (!node || !box || !host || typeof ResizeObserver === "undefined") return;
    // Painted from the ResizeObserver callback (after layout, before the frame is drawn) and
    // only when the integer canvas size or the world's place in it changes (16 Oct 2026):
    // a callback that finds the same geometry repaints nothing, so no size echo can redraw
    // the scene frame after frame. A new sceneKey re-runs this effect and paints afresh.
    let painted = "";
    let view: ArenaSceneView | null = null;
    let raf = 0;
    let last = -Infinity;
    let still = false;
    const ratioNow = canvasRatio;
    const paint = () => {
      const draw = painter.current;
      const world = box.querySelector<HTMLElement>(":scope > [data-game-arena]");
      if (!draw || !world) return;
      const s = host.getBoundingClientRect();
      const w = world.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      if (s.width < 1 || s.height < 1 || w.width < 1) return;
      const ratio = ratioNow();
      const pw = Math.round(s.width * ratio);
      const ph = Math.round(s.height * ratio);
      const at = `${pw}x${ph}:${Math.round((w.left - s.left) * ratio)},${Math.round((w.top - s.top) * ratio)},${Math.round(w.width * ratio)}`;
      if (at === painted) return;
      painted = at;
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
      view = {
        worldW: width,
        worldH: height,
        left: -ox / scale,
        top: -oy / scale,
        right: (s.width - ox) / scale,
        bottom: (s.height - oy) / scale,
        scale,
        boxTop: (b.top - w.top) / scale,
      };
      ctx.save();
      // The header row stays the screen edge's black unless the game's scene runs under it (Gemstone).
      if (!underHeader.current) {
        ctx.beginPath();
        ctx.rect(view.left, view.boxTop ?? 0, view.right - view.left, view.bottom - (view.boxTop ?? 0));
        ctx.clip();
      }
      draw(ctx, view);
      ctx.restore();
      last = -Infinity;
      still = false;
      if (mover.current) frame(performance.now());
    };
    /** The moving layer: its own canvas over the region it moves in, repainted at most every AMBIENT_MS. */
    const frame = (now: number) => {
      raf = 0;
      const amb = mover.current;
      const layer = moving.current;
      if (!amb || !layer || !view) return;
      const hold = reducedMotion() || arcadeReducedEffects();
      if (!(hold && still) && now - last >= AMBIENT_MS) {
        last = now;
        still = hold;
        const ratio = ratioNow();
        const top = amb.region === "below" ? Math.max(view.top, view.worldH) : view.top;
        const cssTop = (top - view.top) * view.scale;
        const cssW = (view.right - view.left) * view.scale;
        const cssH = Math.max(0, (view.bottom - top) * view.scale);
        const pw = Math.round(cssW * ratio);
        const ph = Math.round(cssH * ratio);
        if (layer.width !== pw || layer.height !== ph) {
          layer.width = pw;
          layer.height = ph;
        }
        const placed = `${cssTop}px`;
        if (layer.style.top !== placed) layer.style.top = placed;
        const hpx = `${cssH}px`;
        if (layer.style.height !== hpx) layer.style.height = hpx;
        const ctx = layer.getContext("2d");
        if (ctx && pw > 0 && ph > 0) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, pw, ph);
          const k = ratio * view.scale;
          ctx.setTransform(k, 0, 0, k, -view.left * k, -top * k);
          ctx.save();
          ctx.beginPath();
          ctx.rect(view.left, Math.max(top, view.boxTop ?? 0), view.right - view.left, view.bottom - top);
          ctx.clip();
          amb.draw(ctx, view, hold ? 0 : now, hold);
          ctx.restore();
        }
      }
      // Battery (31 Oct 2026): a held layer (reduced motion or effects) is painted once and stops until a
      // resize repaints it; a moving one parks with the arena (lib/battery.ts arenaFrame).
      raf = hold && still ? 0 : arenaFrame(frame);
    };
    const observer = new ResizeObserver(paint);
    observer.observe(host);
    observer.observe(box);
    const world = box.querySelector(":scope > [data-game-arena]");
    if (world) observer.observe(world);
    paint();
    return () => {
      observer.disconnect();
      cancelArenaFrame(frame, raf);
    };
  }, [width, height, sceneKey, host, ambient !== undefined]);

  return (
    <div
      ref={slot}
      data-arena-slot=""
      data-arena-centred={centre ? "" : undefined}
      data-arena-play-centred={playCentre ? "" : undefined}
      data-scene={scene ? "" : undefined}
      style={{ "--arena-w": width, "--arena-h": height } as CSSProperties}
    >
      {children}
      {host && scene
        ? createPortal(
            <>
              <canvas ref={canvas} data-arena-scene="" aria-hidden="true" />
              {ambient ? <canvas ref={moving} data-arena-ambient="" aria-hidden="true" /> : null}
            </>,
            host,
          )
        : null}
    </div>
  );
}
