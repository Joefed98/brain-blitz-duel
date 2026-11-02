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
import { ORBIT_HOLE_BANK } from "./orbitHoleBank.server";
import type { OrbitExtrasRow, OrbitHoleRow, OrbitRev3CompactPlanet } from "@/lib/arcade/orbitRev3";
import { ORBIT_XP_BANK } from "./orbitXpBank.server";
import { ORBIT_FUEL_BANK } from "./orbitFuelBank.server";

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

/** Proved black holes (rev 4) for a bank course, or null when it has none (it then stays rev 3). */
export function orbitHolesForBankSeed(bankSeed: number): OrbitHoleRow[] | null {
  return ORBIT_HOLE_BY_SEED.get(bankSeed) ?? null;
}
const ORBIT_HOLE_BY_SEED = new Map(ORBIT_HOLE_BANK.map((entry) => [entry.seed, entry.holes]));

/**
 * orbitRev 12 (world expansion): the course for a room seed from the feature bank (index = seed mod length):
 * its proved planets, black holes and features, or null if the bank is empty.
 */
export function orbitXpCourseForSeed(seed: number): { planets: OrbitRev3CompactPlanet[]; holes: OrbitHoleRow[]; extras: OrbitExtrasRow } | null {
  if (ORBIT_XP_BANK.length === 0) return null;
  const entry = ORBIT_XP_BANK[((seed % ORBIT_XP_BANK.length) + ORBIT_XP_BANK.length) % ORBIT_XP_BANK.length]!;
  const course = ORBIT_REV3_BY_SEED.get(entry.seed);
  const holes = ORBIT_HOLE_BY_SEED.get(entry.seed);
  if (!course || !holes) return null;
  return { planets: course.planets, holes, extras: entry.extras };
}
const ORBIT_REV3_BY_SEED = new Map(ORBIT_REV3_BANK.map((entry) => [entry.seed, entry]));

/**
 * orbitRev 14 (the fuel meter): the course for a room seed from the fuel bank (index = seed mod length): its
 * zigzag planets, black holes and features, proved on rev 14's rules (scripts/orbit-fuel-bank.ts), or null
 * if the bank is empty.
 */
export function orbitFuelCourseForSeed(seed: number): { planets: OrbitRev3CompactPlanet[]; holes: OrbitHoleRow[]; extras: OrbitExtrasRow } | null {
  if (ORBIT_FUEL_BANK.length === 0) return null;
  const entry = ORBIT_FUEL_BANK[((seed % ORBIT_FUEL_BANK.length) + ORBIT_FUEL_BANK.length) % ORBIT_FUEL_BANK.length]!;
  return { planets: entry.planets, holes: entry.holes, extras: entry.extras };
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
