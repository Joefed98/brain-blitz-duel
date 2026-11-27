/**
 * The live arcade HUD for the arena's panel (P4's "The canvas HUD in the panel", docs/desktop-support.md): an arcade
 * stage on the arena offers the values its canvas HUD showed in the last draw (hudPlacement.ts's `takeHud()`), and this
 * store keeps them for the panel's "This run" card. Published at most 4 times a second and only when the list changed;
 * a change held back by the limit is published on a later offer. Display only: read, never written back to a sim.
 * Imports nothing, so the game code that publishes it reaches no rated, economy or pass module.
 */

/** One HUD value (the shape of hudPlacement.ts's HudItem). */
export interface LiveHudItem {
  label: string;
  value: string;
  gold?: boolean | undefined;
  main?: boolean | undefined;
}

/** The fastest the panel is updated. */
export const LIVE_HUD_MIN_GAP_MS = 250;

let live: readonly LiveHudItem[] = [];
let publishedAt = -Infinity;
const listeners = new Set<() => void>();

function same(a: readonly LiveHudItem[], b: readonly LiveHudItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x.label !== y.label || x.value !== y.value || !x.gold !== !y.gold || !x.main !== !y.main) return false;
  }
  return true;
}

/** The stage's offer after a draw; `nowMs` is the frame's clock (performance.now()). */
export function offerLiveHud(items: readonly LiveHudItem[], nowMs: number): void {
  if (same(items, live)) return;
  if (nowMs - publishedAt < LIVE_HUD_MIN_GAP_MS) return;
  live = items.slice();
  publishedAt = nowMs;
  for (const fn of listeners) fn();
}

/** The stage has gone (or left the arena): the panel shows no HUD values. */
export function clearLiveHud(): void {
  publishedAt = -Infinity;
  if (!live.length) return;
  live = [];
  for (const fn of listeners) fn();
}

/** The last published list (the same array until the next publish, for useSyncExternalStore). */
export function readLiveHud(): readonly LiveHudItem[] {
  return live;
}

/** Calls `fn` on every publish; returns the unsubscribe. */
export function subscribeLiveHud(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
