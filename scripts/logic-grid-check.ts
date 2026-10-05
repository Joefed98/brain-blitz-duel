/** Routine Colour Flood check: quick tests on all 400 boards, full par proof on a seeded sample of 40. */
import { generateFlood, FLOOD_BANK, FLOOD_BANK_SIZE } from "../src/lib/duel/flood.server";
import { quickFloodChecks, floodParProof, seededSample } from "./flood-checks";

const SAMPLE = 40;
let failures = 0;
const check = (label: string, ok: boolean) => { if (!ok) { failures++; console.error(label); } };
check("full bank", FLOOD_BANK.length === FLOOD_BANK_SIZE);
check("distinct boards", new Set(FLOOD_BANK.map((p) => p.grid.join(","))).size === FLOOD_BANK_SIZE);
const selected = generateFlood();
check("selection uses bank", FLOOD_BANK.some((p) => p.grid.join(",") === selected.grid.join(",")));
quickFloodChecks(FLOOD_BANK, check);
floodParProof(seededSample(FLOOD_BANK, SAMPLE), check);
const pars = FLOOD_BANK.map((p) => p.par);
console.log(`Colour Flood: ${FLOOD_BANK.length} boards quick-checked · par proof on ${SAMPLE} seeded · par ${Math.min(...pars)}–${Math.max(...pars)} · ${failures} failures`);
if (failures) process.exit(1);
