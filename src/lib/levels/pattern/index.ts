/**
 * The eight Pattern games' level entries (the Pattern overhaul, stage 3), one plain-data file each, so each game's
 * levels are edited in its own file. A game whose entry has no levels offers Normal only.
 */
import type { PuzzleType } from "@/lib/duel/types";
import type { GameLevels } from "../gameLevels";
import { LEVELS_BLOCKPARTY } from "./blockparty.levels";
import { LEVELS_FLOW } from "./flow.levels";
import { LEVELS_GRAVITY } from "./gravity.levels";
import { LEVELS_ICESLIDE } from "./iceslide.levels";
import { LEVELS_LASER } from "./laser.levels";
import { LEVELS_PIPES } from "./pipes.levels";
import { LEVELS_PUSH } from "./push.levels";
import { LEVELS_UNBLOCK } from "./unblock.levels";

export const PATTERN_LEVELS: Partial<Record<PuzzleType, GameLevels>> = {
  unblock: LEVELS_UNBLOCK,
  blockparty: LEVELS_BLOCKPARTY,
  pipes: LEVELS_PIPES,
  flow: LEVELS_FLOW,
  iceslide: LEVELS_ICESLIDE,
  push: LEVELS_PUSH,
  laser: LEVELS_LASER,
  gravity: LEVELS_GRAVITY,
};
