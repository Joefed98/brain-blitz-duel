import { useSyncExternalStore } from "react";

/**
 * The computer layout's breakpoints (31 Oct 2026, presentation only; docs/desktop-layout.md).
 *
 * - desktop: 1024 px wide and up: the left navigation rail, pages with a right column, the room panel
 *   and each game's desktop mode (desktopModes.ts).
 * - tablet: 700–1023 px wide (or any width from 700 px on a touch screen): a simpler two-column layout
 *   (the page and its side column; the bottom tab bar stays; game screens exactly as on a phone).
 * - phone: under 700 px: exactly as before.
 *
 * Both wider layouts also need a window at least 500 px tall, so a phone turned to landscape (932×430 at
 * most) keeps the phone layout. The desktop layout also needs a mouse or trackpad (hover and a fine
 * pointer), as the 17 Oct desktop rules did: a touch screen of any width (an iPad, a touch-screen laptop
 * used by touch) gets the tablet layout, whose game screens are exactly the phone's (arcade-play-check's
 * touch laptop and desktop-geometry-check's touch screen prove it). The same queries are written in CSS
 * (polish-layout/desktop.css, desktop-layout.css), every computer-layout rule also scoped to the
 * `data-layout` PhoneShell sets from this hook.
 */
export const DESKTOP_LAYOUT_QUERY = "(min-width: 1024px) and (min-height: 500px) and (hover: hover) and (pointer: fine)";
/** 700 px wide and up when not the desktop layout (a touch screen of any width from 700 px). */
export const TABLET_LAYOUT_QUERY = "(min-width: 700px) and (min-height: 500px)";

export type LayoutMode = "phone" | "tablet" | "desktop";

function read(): LayoutMode {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "phone";
  if (window.matchMedia(DESKTOP_LAYOUT_QUERY).matches) return "desktop";
  if (window.matchMedia(TABLET_LAYOUT_QUERY).matches) return "tablet";
  return "phone";
}

function subscribe(change: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const lists = [window.matchMedia(DESKTOP_LAYOUT_QUERY), window.matchMedia(TABLET_LAYOUT_QUERY)];
  for (const l of lists) l.addEventListener?.("change", change);
  return () => {
    for (const l of lists) l.removeEventListener?.("change", change);
  };
}

/** The layout now and on every change ("phone" on the server and while hydrating). */
export function useLayoutMode(): LayoutMode {
  return useSyncExternalStore(subscribe, read, () => "phone");
}

export function layoutModeNow(): LayoutMode {
  return read();
}
