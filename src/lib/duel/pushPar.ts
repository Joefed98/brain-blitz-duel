/**
 * Heave's par on screen (the Pattern overhaul, 15 Nov 2026; display only, no stamp). The fewest pushes stays a
 * server-side field of the stored puzzle (`minPushes`, secrets.ts), so the phone looks it up from the layout it was
 * dealt: `PUSH_PARS` (pushPar.data.ts, written by `bun scripts/push-par-data.ts [--check]` from both Heave banks) maps
 * a short hash of the layout to its minimum. It names a count only, never a push of the route, like the par the other
 * Pattern games show. A layout the table doesn't know shows no par. Nothing here grades or deals.
 */
import { PUSH_PARS } from "./pushPar.data";

export interface PushLayout {
  walls: readonly number[];
  crates: readonly number[];
  targets: readonly number[];
  pusher: number;
}

/** The layout's key: FNV-1a (32-bit) of its cells, in base 36. */
export function pushLayoutKey(layout: PushLayout): string {
  const text = `${layout.walls.join(",")}|${layout.crates.join(",")}|${layout.targets.join(",")}|${layout.pusher}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** The fewest pushes for a dealt layout, or null when the table doesn't hold it. */
export function pushParFor(layout: PushLayout | null | undefined): number | null {
  if (!layout || !Array.isArray(layout.walls)) return null;
  const par = PUSH_PARS[pushLayoutKey(layout)];
  return typeof par === "number" && par > 0 ? par : null;
}
