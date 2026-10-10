import { useEffect, type RefObject } from "react";

/**
 * Styles every puzzle board that takes drag input carries: the browser must not
 * pan, zoom or rubber-band the page while a finger is on the board.
 */
export const NO_SCROLL_STYLE = {
  touchAction: "none",
  overscrollBehavior: "none",
  WebkitUserSelect: "none",
  userSelect: "none",
  WebkitTouchCallout: "none",
  WebkitTapHighlightColor: "transparent",
} as const;

/**
 * Swallows touch scrolling inside a board. `touch-action` alone is ignored by
 * some mobile browsers once a gesture has started, so the move event is
 * cancelled directly — which needs a non-passive listener, hence the effect.
 */
export function useNoTouchScroll(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const stop = (event: TouchEvent) => {
      if (event.target instanceof Element && event.target.closest("[data-scrollable]")) return;
      if (event.cancelable) event.preventDefault();
    };
    node.addEventListener("touchmove", stop, { passive: false });
    return () => {
      node.removeEventListener("touchmove", stop);
    };
  }, [ref]);
}
