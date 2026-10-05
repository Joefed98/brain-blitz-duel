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