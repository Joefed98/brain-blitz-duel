/**
 * Slice under the arcade scoring standard (sliceRev 11, docs/arcade-standard-oct-2026/slice.md). The perfect run is
 * the oracle player (scripts/slice-standard-oracle.ts) on a fixed room seed, sent through the server's own encode
 * and replay (replaySliceRun); its parts come from the replayed state through the sim's own scoring
 * (sliceV11Parts), so the score is the one the server would store.
 */
import {
  SLICE_REV_STANDARD,
  SLICE_V11_COMBO_CAP,
  SLICE_V11_CORE,
  SLICE_V11_DODGE_CAP,
  SLICE_V11_GOLD_CAP,
  SLICE_V11_TICKET_CAP,
  sliceV11Parts,
  type SliceState,
} from "../../src/lib/arcade/slice";
import { sliceOracleRun } from "../slice-standard-oracle";

/** A fixed room seed for the perfect run (any seed works: slice-standard-check plays 40). */
const PERFECT_SEED = 104729;

export const STANDARD = {
  id: "slice",
  stampKey: "sliceRev",
  stamp: SLICE_REV_STANDARD,
  parts: [
    { key: "core", label: "Food sliced (share of food thrown)", max: SLICE_V11_CORE },
    { key: "combo", label: "Combo (2 per 5 foods cut while a combo is live)", max: SLICE_V11_COMBO_CAP },
    { key: "gold", label: "Golden fruit", max: SLICE_V11_GOLD_CAP },
    { key: "tickets", label: "Bread tickets (3 breads in a row)", max: SLICE_V11_TICKET_CAP },
    { key: "dodges", label: "Dodges (food cut close to a chilli)", max: SLICE_V11_DODGE_CAP },
  ],
  /** A perfect run through the real scoring path: the oracle's log replayed by the server. */
  perfect(): { score: number; parts: Record<string, number> } {
    const { result } = sliceOracleRun(PERFECT_SEED);
    const p = sliceV11Parts(result.state as SliceState);
    return { score: result.score, parts: { core: p.core, combo: p.combo, gold: p.gold, tickets: p.tickets, dodges: p.dodges } };
  },
};
