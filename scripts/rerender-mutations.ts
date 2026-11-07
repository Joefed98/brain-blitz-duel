/**
 * How many DOM mutations re-rendering an unchanged element causes (happy-dom). Pieces drawn through
 * dangerouslySetInnerHTML must keep one {__html} object per markup: React 19 rewrites the markup whenever
 * the object changes, so a fresh one each render redraws it on every room or game clock tick
 * (battery-check, 7 Nov 2026). icons-check (Icon) and art-check (ArtSvg) require 0.
 */
import type { ReactElement } from "react";

export async function rerenderMutations(make: (tick: number) => ReactElement, renders = 4): Promise<number> {
  const { Window } = await import("happy-dom");
  const win = new Window();
  const g = globalThis as Record<string, unknown>;
  for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "MutationObserver"] as const) {
    Object.defineProperty(g, key, { configurable: true, writable: true, value: (win as unknown as Record<string, unknown>)[key] });
  }
  g.IS_REACT_ACT_ENVIRONMENT = true;
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const host = win.document.createElement("div");
  win.document.body.appendChild(host);
  const root = createRoot(host as unknown as HTMLElement);
  await React.act(async () => root.render(make(0)));
  let count = 0;
  const observer = new win.MutationObserver((records) => (count += records.length));
  observer.observe(host, { subtree: true, childList: true, attributes: true, characterData: true });
  for (let tick = 1; tick <= renders; tick++) await React.act(async () => root.render(make(tick)));
  await new Promise((resolve) => setTimeout(resolve, 20));
  observer.disconnect();
  await React.act(async () => root.unmount());
  return count;
}
