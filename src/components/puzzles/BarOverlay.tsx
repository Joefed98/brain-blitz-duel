import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A controls bar pinned over the bottom `barH` world px of a letterboxed arcade
 * canvas (the strip below the play floor), so it never shrinks the arena.
 */
export function BarOverlay({ worldW, worldH, barH, children }: { worldW: number; worldH: number; barH: number; children: ReactNode }) {
  const box = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const measure = () => {
      const w = node.clientWidth;
      const h = node.clientHeight;
      const scale = Math.min(w / worldW, h / worldH);
      const left = (w - worldW * scale) / 2;
      const top = (h - worldH * scale) / 2 + (worldH - barH) * scale;
      setRect({ left, top, width: worldW * scale, height: barH * scale });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [worldW, worldH, barH]);
  return (
    <div ref={box} className="pointer-events-none absolute inset-0">
      {rect && (
        <div
          className="pointer-events-auto absolute flex items-center justify-center gap-4"
          style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
