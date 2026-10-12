/**
 * Shared stub 2D context for drawing checks that run without a real canvas.
 *
 * Every method the arcade renderers call returns a value of the right shape:
 * gradients accept colour stops, measureText has a width, getTransform is a
 * full matrix, getImageData has pixels, getLineDash is an array. Any other
 * method is a no-op. Property writes are kept, so a renderer that reads back
 * what it set (globalAlpha, lineWidth, globalCompositeOperation…) gets that
 * value, and unset properties read as the browser defaults.
 *
 * When a renderer starts calling a canvas method that returns something, add
 * it to CANVAS_STUB_METHODS here, not to one check, so every stub keeps up.
 * Not a check itself (no `-check` suffix); imported by the drawing checks.
 */

const gradient = () => ({ addColorStop() {} });

/** Methods whose return value a renderer uses. */
export const CANVAS_STUB_METHODS: Record<string, (...args: never[]) => unknown> = {
  createLinearGradient: gradient,
  createRadialGradient: gradient,
  createConicGradient: gradient,
  createPattern: () => null,
  measureText: () => ({
    width: 40,
    actualBoundingBoxLeft: 0,
    actualBoundingBoxRight: 40,
    actualBoundingBoxAscent: 8,
    actualBoundingBoxDescent: 2,
  }),
  getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  getImageData: (_x: number, _y: number, w: number, h: number) => ({
    width: Math.max(1, w | 0),
    height: Math.max(1, h | 0),
    data: new Uint8ClampedArray(Math.max(1, w | 0) * Math.max(1, h | 0) * 4),
  }),
  createImageData: (w: number, h: number) => ({
    width: Math.max(1, w | 0),
    height: Math.max(1, h | 0),
    data: new Uint8ClampedArray(Math.max(1, w | 0) * Math.max(1, h | 0) * 4),
  }),
  getLineDash: () => [],
  isPointInPath: () => false,
  isPointInStroke: () => false,
  getContextAttributes: () => ({ alpha: true }),
};

/** Browser defaults for properties a renderer may read before writing. */
const DEFAULTS: Record<string, unknown> = {
  canvas: { width: 390, height: 620 },
  globalAlpha: 1,
  globalCompositeOperation: "source-over",
  fillStyle: "#000000",
  strokeStyle: "#000000",
  lineWidth: 1,
  lineCap: "butt",
  lineJoin: "miter",
  miterLimit: 10,
  lineDashOffset: 0,
  font: "10px sans-serif",
  textAlign: "start",
  textBaseline: "alphabetic",
  direction: "inherit",
  shadowBlur: 0,
  shadowColor: "rgba(0, 0, 0, 0)",
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  imageSmoothingEnabled: true,
  imageSmoothingQuality: "low",
  filter: "none",
};

const noop = () => {};

/**
 * A stub context. `overrides` replace any method or property (to count or
 * record calls); `onSet` sees every property write before it is stored.
 */
export function canvasStub(
  overrides: Record<string, unknown> = {},
  onSet?: (key: string, value: unknown) => void,
): CanvasRenderingContext2D {
  const props: Record<string, unknown> = {};
  return new Proxy(props, {
    get(_t, key) {
      if (typeof key !== "string") return undefined;
      // Never thenable: an awaited context must not look like a promise.
      if (key === "then") return undefined;
      if (key in overrides) return overrides[key];
      if (key in props) return props[key];
      if (key in CANVAS_STUB_METHODS) return CANVAS_STUB_METHODS[key];
      if (key in DEFAULTS) return DEFAULTS[key];
      return noop;
    },
    set(_t, key, value) {
      if (typeof key !== "string") return true;
      onSet?.(key, value);
      props[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}
