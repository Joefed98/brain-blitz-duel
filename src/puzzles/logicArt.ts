/**
 * The Logic overhaul's Blender pieces (15 Nov 2026, scripts/logic-art.ts): each sprite's hashed url, and the CSS
 * variables a board root sets so its stylesheet (src/polish-logic/logic-2.css) can draw them as backgrounds. Display
 * only: every sprite sits inside its cell's own box, so no hit area changes.
 */
import type { CSSProperties } from "react";

import { LOGIC_ART_URLS, type LogicArtName } from "./logicArt.data";

export type { LogicArtName };

export function logicArt(name: LogicArtName): string {
  return LOGIC_ART_URLS[name];
}

const varsCache = new Map<string, CSSProperties>();

/** `--la-<name>: url(...)` for each sprite, one object per set (kept, so React never sees a fresh style object). */
export function logicArtVars(names: readonly LogicArtName[]): CSSProperties {
  const key = names.join(",");
  let vars = varsCache.get(key);
  if (!vars) {
    vars = Object.fromEntries(names.map((n) => [`--la-${n}`, `url("${LOGIC_ART_URLS[n]}")`])) as CSSProperties;
    varsCache.set(key, vars);
  }
  return vars;
}
