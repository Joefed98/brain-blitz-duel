import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * The round intro's demo box (23 Oct 2026, Prompt D; display only). One fixed box per intro layout:
 * it takes whatever height GOAL, HOW and SCORE leave above READY (flex), so its size never depends
 * on what is inside it, and nothing on the screen moves when a demo loads or starts. Until the demo
 * has drawn its first frame the box shows the game's still (its fixed IntroExample, scaled down to
 * fit, centred); a game with no demo keeps the still for good, so every intro has the same layout.
 *
 * The demo is laid out at the largest size of its own aspect that fits the box (contain, centred),
 * so its canvas or stage is drawn at that size rather than scaled afterwards. Real input never
 * reaches it (the players block it themselves), and READY sits outside the box.
 */
export function IntroStage({
  still,
  demo,
  aspect,
}: {
  still: ReactNode;
  /** Renders the demo; it calls onReady once its first frame is on screen. Null: no demo (the still stays). */
  demo: ((onReady: () => void) => ReactNode) | null;
  /** The demo's width / height, for its contained box. */
  aspect: number | null;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  useLayoutEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    const measure = () =>
      setBox((b) =>
        b.w === node.clientWidth && b.h === node.clientHeight
          ? b
          : { w: node.clientWidth, h: node.clientHeight },
      );
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(node);
    return () => watch.disconnect();
  }, []);

  const showDemo = demo !== null && aspect !== null && aspect > 0 && box.w > 0 && box.h > 0;
  const demoW = showDemo ? Math.min(box.w, box.h * aspect!) : 0;
  const demoH = showDemo ? demoW / aspect! : 0;
  const playing = showDemo && ready;
  // The tray (Polish batch R) hugs what shows: the still's scaled content, or the demo's box once it plays;
  // the two cross-fade (opacity only), so nothing in the layout moves.
  const [stillSize, setStillSize] = useState({ w: 0, h: 0 });
  const tray = (w: number, h: number) => {
    const pad = 10;
    const tw = Math.min(box.w, w + pad * 2);
    const th = Math.min(box.h, h + pad * 2);
    return { left: (box.w - tw) / 2, top: (box.h - th) / 2, width: tw, height: th };
  };

  return (
    <div
      ref={boxRef}
      data-intro-stage=""
      data-intro-demo={playing ? "playing" : demo ? "loading" : "none"}
      className="intro-stage relative min-h-0 w-full flex-1 overflow-hidden"
    >
      {stillSize.w > 0 && box.w > 0 ? (
        <div aria-hidden="true" data-intro-tray="still" className="intro-tray" style={{ ...tray(stillSize.w, stillSize.h), opacity: playing ? 0 : 1 }} />
      ) : null}
      {showDemo ? (
        <div aria-hidden="true" data-intro-tray="demo" className="intro-tray" style={{ ...tray(demoW, demoH), opacity: playing ? 1 : 0 }} />
      ) : null}
      <IntroStill box={box} hidden={playing} onSize={setStillSize}>
        {still}
      </IntroStill>
      {showDemo ? (
        <div
          data-intro-demo-slot=""
          className="absolute"
          style={{
            left: (box.w - demoW) / 2,
            top: (box.h - demoH) / 2,
            width: demoW,
            height: demoH,
            visibility: playing ? "visible" : "hidden",
          }}
        >
          {demo!(onReady)}
        </div>
      ) : null}
    </div>
  );
}

/** The still: laid out at the box's width, scaled down (never up) to fit its height, centred. */
function IntroStill({
  box,
  hidden,
  onSize,
  children,
}: {
  box: { w: number; h: number };
  hidden: boolean;
  /** The still's drawn size (its content, scaled), for the tray behind it. */
  onSize?: (size: { w: number; h: number }) => void;
  children: ReactNode;
}) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0, content: 0 });
  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const measure = () => {
      // The widest child: what the still really draws inside its full-width column.
      const content = Math.max(0, ...[...inner.children].map((c) => (c as HTMLElement).offsetWidth));
      setNatural((n) =>
        n.w === inner.scrollWidth && n.h === inner.offsetHeight && n.content === content
          ? n
          : { w: inner.scrollWidth, h: inner.offsetHeight, content },
      );
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(inner);
    return () => watch.disconnect();
  }, []);
  const scale =
    natural.h > 0 && box.h > 0
      ? Math.max(0, Math.min(1, box.h / natural.h, natural.w > 0 ? box.w / natural.w : 1))
      : 1;
  const drawnW = Math.round((natural.content || natural.w) * scale);
  const drawnH = Math.round(natural.h * scale);
  useLayoutEffect(() => {
    onSize?.({ w: drawnW, h: drawnH });
  }, [drawnW, drawnH]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div
      data-intro-still=""
      aria-hidden={hidden || undefined}
      className="intro-still absolute inset-0"
      style={{ visibility: hidden ? "hidden" : "visible" }}
    >
      <div
        ref={innerRef}
        className="absolute left-1/2 top-1/2 flex flex-col items-center justify-center"
        style={{
          width: box.w || "100%",
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "50% 50%",
        }}
      >
        {children}
      </div>
    </div>
  );
}
