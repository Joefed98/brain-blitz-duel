import { useEffect, useRef } from "react";

import { prefersReducedMotion } from "@/lib/motion";

/** A single short confetti burst behind a win headline. Skipped when the
 *  device asks for reduced motion. */
export function WinBurst() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || prefersReducedMotion()) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const colors = ["#e8b23a", "#4fd1c5", "#f5f5f5"];
    const bits = Array.from({ length: 46 }, () => ({
      x: w / 2,
      y: h / 2,
      vx: (Math.random() - 0.5) * 7,
      vy: -Math.random() * 7 - 1.5,
      size: 3 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)]!,
      life: 1,
    }));

    let frame = 0;
    let start = 0;
    const step = (time: number) => {
      if (!start) start = time;
      const elapsed = time - start;
      ctx.clearRect(0, 0, w, h);
      for (const b of bits) {
        b.x += b.vx;
        b.y += b.vy;
        b.vy += 0.24;
        b.life = Math.max(0, 1 - elapsed / 1400);
        ctx.globalAlpha = b.life;
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, b.size, b.size);
      }
      ctx.globalAlpha = 1;
      if (elapsed < 1400) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-48 w-full"
    />
  );
}
