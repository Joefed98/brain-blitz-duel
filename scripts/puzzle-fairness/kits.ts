/** Every player kit, by puzzle type (scripts/puzzle-fairness/kit.ts). */
import type { PuzzleType } from "../../src/lib/duel/types";
import type { PuzzleKit } from "./kit";
import { KITS_WORD } from "./kits-word";
import { KITS_NUMBER } from "./kits-number";
import { KITS_SPEED } from "./kits-speed";
import { KITS_PATTERN } from "./kits-pattern";
import { KITS_LOGIC } from "./kits-logic";
import { KITS_ENGINE } from "./kits-engine";

export const KITS: Partial<Record<PuzzleType, PuzzleKit>> = Object.fromEntries(
  [...KITS_WORD, ...KITS_NUMBER, ...KITS_SPEED, ...KITS_PATTERN, ...KITS_LOGIC, ...KITS_ENGINE].map((k) => [k.type, k]),
);
