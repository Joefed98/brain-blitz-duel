import { useEffect, useRef } from "react";
import { canvasRatio } from "@/lib/battery";

/**
 * A Cards & Board intro still: the game's own renderer draws one frame of a deal into a small canvas (display only),
 * with a one-line caption under it.
 */
export function CardStill({ width, height, draw, caption }: { width: number; height: number; draw: (ctx: CanvasRenderingContext2D, size: { width: number; height: number }) => void; caption: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const shownW = 150;
  const shownH = Math.round((shownW * height) / width);
  useEffect(() => {
    const node = ref.current;
    const ctx = node?.getContext("2d");
    if (!node || !ctx) return;
    const ratio = canvasRatio();
    node.width = Math.round(shownW * ratio);
    node.height = Math.round(shownH * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw(ctx, { width: shownW, height: shownH });
    // Faces use Archivo; draw again once it has loaded.
    void document.fonts?.ready.then(() => {
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(ctx, { width: shownW, height: shownH });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <canvas ref={ref} width={shownW} height={shownH} aria-hidden="true" style={{ width: shownW, height: shownH, borderRadius: 10 }} />
      <p className="text-center text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}
