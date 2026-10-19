/**
 * Routine Colour Flood check: quick tests on all 400 boards of both banks, full par proof on a seeded
 * sample of 40 (floodRev 1 / 2 bank) and 20 (floodRev 3 bank, which deals since 19 Oct 2026;
 * its cycle proof is flood-cycle-check).
 */
import { generateFlood, FLOOD_BANK, FLOOD_BANK_SIZE, FLOOD_BANK_V3 } from "../src/lib/duel/flood.server";
import { quickFloodChecks, floodParProof, seededSample } from "./flood-checks";

const SAMPLE = 40;
const SAMPLE_V3 = 20;
let failures = 0;
const check = (label: string, ok: boolean) => { if (!ok) { failures++; console.error(label); } };
check("full bank", FLOOD_BANK.length === FLOOD_BANK_SIZE);
check("distinct boards", new Set(FLOOD_BANK.map((p) => p.grid.join(","))).size === FLOOD_BANK_SIZE);
const selected = generateFlood();
check("full v3 bank", FLOOD_BANK_V3.length === FLOOD_BANK_SIZE);
check("distinct v3 boards", new Set(FLOOD_BANK_V3.map((p) => p.grid.join(","))).size === FLOOD_BANK_SIZE);
check("selection uses the floodRev 3 bank", FLOOD_BANK_V3.some((p) => p.grid.join(",") === selected.grid.join(",")));
quickFloodChecks(FLOOD_BANK, check);
quickFloodChecks(FLOOD_BANK_V3, check);
floodParProof(seededSample(FLOOD_BANK, SAMPLE), check);
floodParProof(seededSample(FLOOD_BANK_V3, SAMPLE_V3), check);
const pars = FLOOD_BANK.map((p) => p.par);
const parsV3 = FLOOD_BANK_V3.map((p) => p.par);
console.log(`Colour Flood: ${FLOOD_BANK.length} + ${FLOOD_BANK_V3.length} (floodRev 3) boards quick-checked · par proof on ${SAMPLE} + ${SAMPLE_V3} seeded · par ${Math.min(...pars)}–${Math.max(...pars)} / ${Math.min(...parsV3)}–${Math.max(...parsV3)} · ${failures} failures`);
if (failures) process.exit(1);
