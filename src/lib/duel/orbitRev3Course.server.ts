/**
 * Server-only helpers for the Orbit rev3 course bank: compact planet
 * encode/decode (shared by scripts/orbit-bank.ts and the bank lookup below)
 * and the room-seed -> planets accessor. Never imported by client code —
 * the full 40-planet layout is only revealed to clients as they capture it
 * (same trust model as the other arcade banks).
 */
import { ORBIT_TOTAL, planetShape, type Planet } from "@/lib/arcade/orbit";
import { ORBIT_REV3_WORLD_W, initRev3From, type OrbitRev3State } from "@/lib/arcade/orbitRev3";
import { ORBIT_REV3_BANK, type OrbitRev3BankEntry } from "./orbitRev3Bank.server";

export { encodeRev3Planets, decodeRev3Planets, type OrbitRev3CompactPlanet } from "@/lib/arcade/orbitRev3";
import { decodeRev3Planets } from "@/lib/arcade/orbitRev3";

/** Bank entry's planets decoded back into the full 41-planet (0..ORBIT_TOTAL) layout. */
export function orbitRev3PlanetsFromEntry(entry: OrbitRev3BankEntry): Planet[] {
  return decodeRev3Planets(entry.planets);
}

/** Selects a proved bank entry for a room seed (index = seed mod length). */
export function orbitRev3BankEntryForSeed(seed: number): OrbitRev3BankEntry | null {
  if (ORBIT_REV3_BANK.length === 0) return null;
  const index = ((seed % ORBIT_REV3_BANK.length) + ORBIT_REV3_BANK.length) % ORBIT_REV3_BANK.length;
  return ORBIT_REV3_BANK[index]!;
}

/** Proved planets for a room seed, straight from the bank (null if the bank is empty). */
export function orbitRev3PlanetsForSeed(seed: number): Planet[] | null {
  const entry = orbitRev3BankEntryForSeed(seed);
  return entry ? orbitRev3PlanetsFromEntry(entry) : null;
}

/** Spawns an OrbitRev3State from a bank entry's decoded planets (initRev3From, not buildCourse3). */
export function orbitRev3InitFromEntry(entry: OrbitRev3BankEntry, worldW = ORBIT_REV3_WORLD_W): OrbitRev3State {
  return initRev3From(orbitRev3PlanetsFromEntry(entry), worldW);
}
