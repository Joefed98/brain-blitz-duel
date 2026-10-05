import { useEffect, useRef, type RefObject } from "react";
import { devDiagnosticsOn } from "@/lib/arcade/diagnostics";

type Sample = { frame: number; draw: number; work: number };
/** Presentation only: timings never enter a run, checkpoint or sim clock. */
export function useArcadeFrameTiming(canvas: RefObject<HTMLCanvasElement | null>) {
  const timing = useRef({ enabled: false, node: null as HTMLDivElement | null, samples: [] as Sample[], last: 0, raf: 0, start: 0, drawStart: 0, drawMs: 0, updated: 0 });
  useEffect(() => {
    const t = timing.current;
    const sync = () => {
      t.enabled = devDiagnosticsOn();
      t.last = 0;
      t.samples = [];
      if (!t.enabled) { t.node?.remove(); t.node = null; return; }
      if (!t.node && canvas.current?.parentElement) {
        t.node = document.createElement("div");
        t.node.className = "arcade-frame-timing";
        t.node.setAttribute("data-arcade-frame-timing", "");
        t.node.textContent = "Frame timing…";
        canvas.current.parentElement.appendChild(t.node);
      }
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => { window.removeEventListener("popstate", sync); t.enabled = false; t.node?.remove(); t.node = null; };
  }, [canvas]);
  return {
    begin(raf: number) {
      const t = timing.current;
      if (!t.enabled) return;
      t.raf = raf; t.start = performance.now(); t.drawStart = t.start;
    },
    draw() { if (timing.current.enabled) timing.current.drawStart = performance.now(); },
    rendered() { if (timing.current.enabled) timing.current.drawMs = performance.now() - timing.current.drawStart; },
    end() {
      const t = timing.current;
      if (!t.enabled) return;
      const now = performance.now();
      if (t.last && t.raf > t.last) {
        t.samples.push({ frame: t.raf - t.last, draw: t.drawMs, work: now - t.start });
        if (t.samples.length > 120) t.samples.shift();
      }
      t.last = t.raf;
      if (now - t.updated < 500 || !t.samples.length || !t.node) return;
      t.updated = now;
      const mean = (key: keyof Sample) => t.samples.reduce((sum, s) => sum + s[key], 0) / t.samples.length;
      const intervals = t.samples.map(s => s.frame).sort((a, b) => a - b);
      const p95 = intervals[Math.ceil(intervals.length * 0.95) - 1] ?? 0;
      const interval = mean("frame");
      t.node.textContent = `${(1000 / interval).toFixed(0)} FPS · frame ${interval.toFixed(1)} ms · p95 ${p95.toFixed(1)} ms\nDraw ${mean("draw").toFixed(1)} ms · work ${mean("work").toFixed(1)} ms`;
    },
  };
}