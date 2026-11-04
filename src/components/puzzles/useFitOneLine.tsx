import { useRef, type CSSProperties, type ReactNode, type RefObject } from "react";

import { useBeforePaint } from "@/components/puzzles/useBeforePaint";

/**
 * One line, always (Operator, 19 Oct 2026; shared since 3 Nov 2026): a line drawn at its design size and, when that is
 * wider than its box, its font size (`--fit-fs`, and everything sized in em with it) cut just enough to fit. Measured
 * before paint and again when the box's width changes, so it never shows a wrapped or jumping frame. Display only.
 */
export function useFitOneLine(box: RefObject<HTMLElement | null>, line: RefObject<HTMLElement | null>, basePx: number, minPx: number, key: unknown) {
  useBeforePaint(() => {
    const el = box.current;
    const inner = line.current;
    if (!el || !inner) return;
    const fit = () => {
      el.style.setProperty("--fit-fs", `${basePx}px`);
      const style = getComputedStyle(el);
      const avail = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const need = inner.scrollWidth;
      if (!(avail > 0) || !(need > avail)) return;
      // Half-pixel steps, a pixel's slack for rounding in the glyph widths.
      const px = Math.max(minPx, Math.floor(((basePx * (avail - 1)) / need) * 2) / 2);
      el.style.setProperty("--fit-fs", `${px}px`);
      // A second pass: em-sized slots and gaps don't scale exactly with the glyphs (borders, minimum widths).
      const again = inner.scrollWidth;
      if (again > avail && px > minPx) el.style.setProperty("--fit-fs", `${Math.max(minPx, Math.floor(((px * (avail - 1)) / again) * 2) / 2)}px`);
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    let width = el.clientWidth;
    const watch = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit();
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, [key, basePx, minPx]);
}

/** A line kept on one line (useFitOneLine), its font cut only as far as it must be. */
export function FitLine({ className, basePx, minPx = 11, fitKey, children }: { className: string; basePx: number; minPx?: number; fitKey: string; children: ReactNode }) {
  const box = useRef<HTMLParagraphElement>(null);
  const line = useRef<HTMLSpanElement>(null);
  useFitOneLine(box, line, basePx, minPx, fitKey);
  return (
    <p ref={box} className={className} style={{ "--fit-base": `${basePx}px` } as CSSProperties}>
      <span ref={line} className="op-fit-line">{children}</span>
    </p>
  );
}
