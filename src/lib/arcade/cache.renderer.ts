/** Browser-only raster surfaces, allocated lazily so SSR never needs a canvas. */
export type ArtCanvas = HTMLCanvasElement | OffscreenCanvas;
export function artCanvas(width: number, height: number): ArtCanvas | null {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}
export function artContext(canvas: ArtCanvas): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
  return canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
}
interface DeviceLayer {
  layer: ArtCanvas | null;
  e: number;
  f: number;
  /** Frames in a row drawn at another translation (a shake): rebuilt only once that persists. */
  misses: number;
}
const deviceLayers = new WeakMap<object, Map<string, DeviceLayer>>();

/**
 * Low-end performance (16 Oct 2026, display only): static scenery painted once into a layer the
 * size of the target canvas's backing store, under the target's current transform, and copied
 * back each frame at the identity transform (a straight blit, so the pixels are the ones direct
 * painting gives). `key` must name every input the scenery depends on; the canvas size and the
 * transform are added to it. A frame drawn at another translation (the success layer's shake)
 * blits the layer shifted by the change in translation (H1, 20 Nov 2026; it used to paint straight onto
 * `ctx`); the layer is rebuilt only if that translation lasts. Clips already set on `ctx` still apply. Where no offscreen canvas exists (SSR,
 * Node checks) or the context has no transform, it paints straight onto `ctx`. At most four
 * layers are kept per canvas. Paint with the context's default alpha and compositing. `alpha` (default 1) draws the
 * whole layer at that opacity (Iron Wall's setting cross-fades one backdrop into the next).
 */
export function deviceLayer(ctx: CanvasRenderingContext2D, key: string, paint: (c: CanvasRenderingContext2D) => void, alpha = 1): void {
  if (alpha <= 0) return;
  if (alpha < 1) {
    // The same layer, drawn at the given opacity (painted straight through a group alpha where there is no layer).
    const direct = (c: CanvasRenderingContext2D) => {
      c.save();
      c.globalAlpha = alpha;
      paint(c);
      c.restore();
    };
    return deviceLayerAt(ctx, key, paint, alpha, direct);
  }
  return deviceLayerAt(ctx, key, paint, 1, paint);
}

function deviceLayerAt(
  ctx: CanvasRenderingContext2D,
  key: string,
  paint: (c: CanvasRenderingContext2D) => void,
  alpha: number,
  direct: (c: CanvasRenderingContext2D) => void,
): void {
  const canvas = (ctx as { canvas?: { width: number; height: number } }).canvas;
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  if (!canvas || !t || !(canvas.width > 0) || !(canvas.height > 0)) {
    direct(ctx);
    return;
  }
  let layers = deviceLayers.get(ctx);
  if (!layers) deviceLayers.set(ctx, (layers = new Map()));
  const id = `${key}|${canvas.width}x${canvas.height}|${t.a},${t.b},${t.c},${t.d}`;
  let entry = layers.get(id);
  if (entry && (entry.e !== t.e || entry.f !== t.f)) {
    if (++entry.misses < 30) {
      // H1 (the polish plan, 20 Nov 2026): a frame at another translation (a shake) blits the cached layer offset by
      // the translation's change instead of painting the scenery straight onto the canvas, which cost Hover's sky
      // 16 frames of a full repaint after every star chain. Under a whole-opacity layer the unshifted copy goes first,
      // so the strip the shift uncovers shows the layer's own pixels at that edge rather than nothing.
      if (!entry.layer) {
        direct(ctx);
        return;
      }
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = alpha;
      ctx.globalCompositeOperation = "source-over";
      if (alpha >= 1) ctx.drawImage(entry.layer as CanvasImageSource, 0, 0);
      ctx.drawImage(entry.layer as CanvasImageSource, t.e - entry.e, t.f - entry.f);
      ctx.restore();
      return;
    }
    entry = undefined;
  }
  if (!entry) {
    if (layers.size >= 4) layers.clear();
    const surface = artCanvas(canvas.width, canvas.height);
    const c = surface ? artContext(surface) : null;
    if (surface && c) {
      c.setTransform(t);
      paint(c as CanvasRenderingContext2D);
    }
    entry = { layer: surface && c ? surface : null, e: t.e, f: t.f, misses: 0 };
    layers.set(id, entry);
  }
  entry.misses = 0;
  if (!entry.layer) {
    direct(ctx);
    return;
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(entry.layer as CanvasImageSource, 0, 0);
  ctx.restore();
}
