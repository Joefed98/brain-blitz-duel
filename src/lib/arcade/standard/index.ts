/**
 * The arcade games on the scoring standard (arcadeStandard.ts, docs/arcade-standard/README.md): each game's spec (its parts
 * and their maximums, summing to 200) and its parts for a final state (null for a state on an older revision).
 * Read by the arcade reveal (breakdown lines), the "?" help and arcade-standard-check.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { StdPart, StdSpec } from "../arcadeStandard";
import * as skyline from "./skyline";
import * as bintoss from "./bintoss";
import * as bullseye from "./bullseye";
import * as pinball from "./pinball";
import * as rally from "./rally";
import * as bubble from "./bubble";
import * as beat from "./beat";
import * as minesweeper from "./minesweeper";
import * as mahjong from "./mahjong";
import * as homerun from "./homerun";
import * as freekick from "./freekick";
import * as racing from "./racing";
import * as freecell from "./freecell";
import * as tripeaks from "./tripeaks";
import * as pokersquares from "./pokersquares";
import * as fivehands from "./fivehands";
import * as minigolf from "./minigolf";
import * as pool from "./pool";
import * as curling from "./curling";
import * as blockfall from "./blockfall";
import * as alleyroll from "./alleyroll";

export interface ArcadeStdEntry {
  spec: StdSpec | null;
  parts: (state: any) => StdPart[] | null;
}

export const ARCADE_STANDARD: Readonly<Record<string, ArcadeStdEntry>> = {
  skyline,
  bintoss,
  bullseye,
  pinball,
  rally,
  bubble,
  beat,
  minesweeper,
  mahjong,
  homerun,
  freekick,
  racing,
  freecell,
  tripeaks,
  pokersquares,
  fivehands,
  minigolf,
  pool,
  curling,
  blockfall,
  alleyroll,
};

/** The standard parts of a final state, or null when the game or the state's revision is not on the standard. */
export function arcadeStdParts(type: string, state: unknown): StdPart[] | null {
  if (!state || typeof state !== "object") return null;
  return ARCADE_STANDARD[type]?.parts(state) ?? null;
}
