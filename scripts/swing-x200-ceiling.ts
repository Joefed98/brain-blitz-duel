/**
 * Records every room-bank course's perfect-play ceiling on Grappler swingRev 13 (scripts/swing-x200-lib.ts) to
 * scripts/fixtures/swing-x200-ceiling.json; swing-x200-check recomputes a sample (all with CHECKS_FULL=1) and needs
 * the lowest to be 200.
 *
 *   bun scripts/swing-x200-ceiling.ts > scripts/fixtures/swing-x200-ceiling.json
 */
import { SWING_V13_BANK } from "../src/lib/duel/swingBankV13.server";
import { swingCeiling } from "./swing-x200-lib";

const courses = SWING_V13_BANK.map((e) => swingCeiling(e.seed));
console.log(JSON.stringify({ recorded: "scripts/swing-x200-ceiling.ts on the swingRev 13 code", lowest: Math.min(...courses.map((c) => c.ceiling)), courses }));
