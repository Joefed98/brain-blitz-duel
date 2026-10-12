import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * The round intro's one flexible box: holds the demo or the worked example and
 * gives up height so GOAL, HOW and SCORE always fit above READY without
 * scrolling. It asks for its child's natural height, shrinks (flex) when the
 * text needs the room, and scales the child down uniformly to whatever height
 * it is given (never up). Presentation only: a demo canvas keeps its own
 * resolution, and the puzzle demo's synthetic touches use on-screen rects, so
 * scaling changes nothing they record or replay.
 */
export function IntroFit({ children, className = "" }: { children: ReactNode; className?: string }) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [natural, setNatural] = useState(0);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const fit = () => {
      // offsetHeight/Width ignore transforms: the child's own, unscaled size.
      const h = inner.offsetHeight;
      const w = inner.offsetWidth;
      setNatural(h);
      const byH = h > 0 ? outer.clientHeight / h : 1;
      const byW = w > 0 ? outer.clientWidth / w : 1;
      setScale(Math.max(0, Math.min(1, byH, byW)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={outerRef}
      data-intro-fit=""
      data-intro-fit-scale={scale.toFixed(3)}
      className={`intro-fit relative min-h-0 w-full shrink overflow-hidden ${className}`}
      style={{ height: natural, flexBasis: natural }}
    >
      <div
        ref={innerRef}
        className="absolute left-1/2 top-0 flex w-full flex-col items-center"
        style={{ transform: `translateX(-50%) scale(${scale})`, transformOrigin: "50% 0" }}
      >
        {children}
      </div>
    </div>
  );
}
