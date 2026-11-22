/**
 * D3's Normal scoring stamps (the polish plan's difficulty session D3, 22 Nov 2026; plan section 8.2 and Joe's answers
 * of 22 Nov 2026): the Speed games' Normal scoring moved so a realistic elite under the human limits (about 0.25 s to
 * react, 0.15 s to move) can reach 200, each under its own new stamp, before the levels were tuned on it.
 *
 *   - Flash `tapRev 8` (TAP_REV_FLASH_FAST, depth/flash.ts FLASH_REV8_CURVE): 200 by 240 ms, 188 at 260, 150 at 320.
 *   - Bonk `whackRev 5` (WHACK_REV_QUICK, arcade/whack.ts): the combo's quick window full to 0.4 s, none from 0.6 s.
 *   - Don't Break the Chain `chainDepthRev 4` (standard/attention.ts CHAIN_V4_FULL_BY_S): speed full by 33 s (was 30).
 *   - Tenfall `tenRev 7` (TEN_DROP_REACH_REV, arcade/tenDrop.ts): speed full by 70 s (was 60), gold in full at 3 gold
 *     tens of ten (was 2 a gold ten up to 20).
 *   - Pull! `clayRev 11` (CLAY_REV_FULL, arcade/clayShoot.ts): the quick credit counts in full from 85 % of a run's most.
 *
 * Every older stamp deals, grades and reads exactly as before (scripts/fixtures/d3-speed-legacy.json.gz, recorded on
 * the stamps before). Checks written for the stamps before pin new deals to them with `pinPreD3Speed(true)`. Shared by
 * phone and server, pure.
 */
import { dealPinned, setDealPin } from "./dealEra";
import { TAP_REV_FLASH_FAST, TAP_REV_PER_ITEM } from "./tapLog";
import { WHACK_REV_NOTES, WHACK_REV_QUICK } from "@/lib/arcade/whack";
import { CLAY_REV_FULL, CLAY_REV_WIDE } from "@/lib/arcade/clayShoot";
import { CHAIN_DEPTH_REV_D3 } from "./standard/attention";
import { TEN_DROP_REACH_REV, TEN_DROP_RESET_REV } from "@/lib/arcade/tenDrop";

/** Checks written for the stamps before D3's Normal stamps deal them; returns the previous setting. */
export function pinPreD3Speed(on: boolean): boolean {
  return setDealPin("preD3Speed", on);
}

/** True while the stamps before D3 are dealt (a check pinned them). */
export function preD3SpeedPinned(): boolean {
  return dealPinned("preD3Speed");
}

/** Each Speed game's D3 stamp over the one dealt before it (any other stamp, or with the pin, unchanged). */
export function dealD3Speed<T extends { type: string }>(puzzle: T): T {
  if (dealPinned("preD3Speed")) return puzzle;
  if (puzzle.type === "reaction") {
    const p = puzzle as { tapRev?: number };
    return p.tapRev === TAP_REV_PER_ITEM ? { ...puzzle, tapRev: TAP_REV_FLASH_FAST } : puzzle;
  }
  if (puzzle.type === "whack") {
    const p = puzzle as { whackRev?: number };
    return p.whackRev === WHACK_REV_NOTES ? { ...puzzle, whackRev: WHACK_REV_QUICK } : puzzle;
  }
  if (puzzle.type === "chain") {
    const p = puzzle as { chainDepthRev?: number };
    return p.chainDepthRev === CHAIN_DEPTH_REV_D3 - 1 ? { ...puzzle, chainDepthRev: CHAIN_DEPTH_REV_D3 } : puzzle;
  }
  if (puzzle.type === "tendrop") {
    const p = puzzle as { tenRev?: number };
    return p.tenRev === TEN_DROP_RESET_REV ? { ...puzzle, tenRev: TEN_DROP_REACH_REV } : puzzle;
  }
  if (puzzle.type === "clayshoot") {
    const p = puzzle as { clayRev?: number };
    return p.clayRev === CLAY_REV_WIDE ? { ...puzzle, clayRev: CLAY_REV_FULL } : puzzle;
  }
  return puzzle;
}

/** Bonk's combo line in the help: whackRev 5's window, or (pinned) the older one's ("none slower than about N ms"). */
export function bonkComboText(olderZeroMs: number): string {
  return preD3SpeedPinned() ? `long unbroken runs of very quick hits (none slower than about ${olderZeroMs} ms)` : "long unbroken runs of quick hits (each within 0.4 s of its pop for all of it, none after 0.6 s)";
}

/** Pull!'s quick-hit line in the help: clayRev 11 counts the part in full once most hits are quick. */
export function clayQuickHitsText(window: { full: string; none: string }): string {
  return preD3SpeedPinned() ? `hit each clay within ${window.full} of its launch (none after ${window.none})` : `hit clays within ${window.full} of their launch (none after ${window.none}); most of them quick earns all of it`;
}
