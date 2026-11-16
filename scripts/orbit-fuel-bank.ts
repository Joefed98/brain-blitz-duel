/**
 * Builds the server-only Orbit fuel bank (src/lib/duel/orbitFuelBank.server.ts) for orbitRev 14 (the fuel meter,
 * 1 Nov 2026, docs/arcade-standard/orbit.md): for each bank seed (FUEL_BANK_SEED(k), fixed), a zigzag course
 * built and proved by scripts/orbit-fuel-lib.ts (buildFuelCourse: the planets, black holes and features, the witness
 * taps that take every one of them and reach the sun with half the run left, 200 on orbitRev 14, and every witness
 * flight landing with a quarter of the tank or more). Seeds whose salts all fail are left out.
 *
 * Deterministic: the same seeds always give the same bank, byte for byte.
 *
 *   bun scripts/orbit-fuel-bank.ts [count] [--dir=<cache>]       # build (or resume) and write, default FUEL_BANK_COUNT seeds
 *   bun scripts/orbit-fuel-bank.ts --merge [count] [--dir=...]   # write the longest prefix of bank seeds the cache holds
 *   bun scripts/orbit-fuel-bank.ts --check [n]                   # rebuild the first n entries (default 2) and compare, no write
 *   bun scripts/orbit-fuel-bank.ts --worker <w> <n> <count> <dir> # one worker (bank seeds k ≡ w mod n)
 *   bun scripts/orbit-fuel-bank.ts --rev=<n>                     # re-prove the bank on orbitRev n, no write (stage 3,
 *                                                                 # 15 Nov 2026: orbitRev 16 plays orbitRev 15's courses
 *                                                                 # unchanged, so its bank is this one, re-proved)
 * The bank is every bank seed k below count that built, in order of k; a seed whose salts all fail is left out.
 *
 * Levels (the Action overhaul, stage 3, 16 Nov 2026; docs/arcade-standard/orbit.md "Levels"): every mode above takes
 * `--level=easy|hard|expert` to build, check or prove that level's own bank (src/lib/duel/orbitFuelBank<Level>.server.ts,
 * LEVEL_BANK_COUNT seeds from LEVEL_BANK_SEED), its courses laid out from the level's settings in GAME_LEVELS
 * (levelCourse) and every witness proved on orbitRev 16 with the level's rules. Without it: the Normal bank, exactly.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { encodeOrbitExtras, encodeOrbitHoles, encodeRev3Planets } from "../src/lib/arcade/orbitRev3";
import { buildFuelCourse, fuelFailure, NORMAL_COURSE, setFuelCourse, type FuelCourseSpec } from "./orbit-fuel-lib";
import type { OrbitFuelBankEntry } from "../src/lib/duel/orbitFuelBank.server";
import { gameLevelSettings } from "../src/lib/levels/gameLevels";
import { ORBIT_FUEL_HOP_MAX, type OrbitLevelName } from "../src/lib/arcade/orbitRev3";

const WORKERS = 3;
export const FUEL_BANK_COUNT = 96;
/** The k-th bank seed (a fixed integer mix, so the bank never depends on a clock or Math.random). */
export const FUEL_BANK_SEED = (k: number) => (Math.imul(k + 1, 0x2545f491) ^ 0x5bd1e995) | 0;

/* ------------------------------------------- Levels ------------------------------------------- */
export const ORBIT_BANK_LEVELS: readonly OrbitLevelName[] = ["easy", "hard", "expert"];
/** Seeds tried for each level's bank (the bank is the ones that built). */
export const LEVEL_BANK_COUNT = 32;
const LEVEL_SALT: Record<OrbitLevelName, number> = { easy: 0x3c6ef372, hard: 0x7f4a7c15, expert: 0x1b873593 };
/** The k-th bank seed of a level's bank (fixed integers, distinct from the Normal bank's). */
export const LEVEL_BANK_SEED = (level: OrbitLevelName, k: number) => (Math.imul(k + 1, 0x2545f491) ^ LEVEL_SALT[level]) | 0;
/** A level's bank file. */
export const levelBankFile = (level: OrbitLevelName) => `src/lib/duel/orbitFuelBank${level[0]!.toUpperCase()}${level.slice(1)}.server.ts`;

interface OrbitCourseSettings {
  tank: number;
  latMin: number;
  latMax: number;
  liftMin: number;
  liftSpan: number;
  holesFrom: number;
  beltsFrom: number;
  window: number;
}
/** The black holes' planets for "holes from planet N" (1-based): beside N, N + 10 and N + 19, as Normal's 10, 20, 29, while a hole's target (5 or 6 on) stays short of the sun. */
export function holePlanets(holesFrom: number): number[] {
  return [holesFrom - 1, holesFrom + 9, holesFrom + 18].filter((p) => p <= 33);
}
/** A level's course spec from its GAME_LEVELS settings; the proved hop is at most a quarter short of the tank (and never past Normal's 120). */
export function levelCourse(level: OrbitLevelName): FuelCourseSpec {
  const c = gameLevelSettings<OrbitCourseSettings>("orbit", level);
  if (!c) throw new Error(`orbit has no ${level} level`);
  return {
    latMin: c.latMin,
    latMax: c.latMax,
    liftMin: c.liftMin,
    liftSpan: c.liftSpan,
    holeFrom: holePlanets(c.holesFrom),
    beltsFrom: c.beltsFrom,
    tank: c.tank,
    hopMax: Math.min(ORBIT_FUEL_HOP_MAX, Math.trunc((c.tank * 3) / 4)),
    window: c.window,
  };
}
const levelArg = process.argv.find((a) => a.startsWith("--level="))?.slice(8) as OrbitLevelName | undefined;
if (levelArg && !ORBIT_BANK_LEVELS.includes(levelArg)) throw new Error(`--level must be one of ${ORBIT_BANK_LEVELS.join(", ")}`);
/** The level this run builds (null = Normal). */
export const LEVEL: OrbitLevelName | null = levelArg ?? null;
setFuelCourse(LEVEL ? levelCourse(LEVEL) : NORMAL_COURSE, LEVEL);
const OUT = LEVEL ? levelBankFile(LEVEL) : "src/lib/duel/orbitFuelBank.server.ts";
const SEED_OF = (k: number) => (LEVEL ? LEVEL_BANK_SEED(LEVEL, k) : FUEL_BANK_SEED(k));
const DEFAULT_COUNT = LEVEL ? LEVEL_BANK_COUNT : FUEL_BANK_COUNT;
const EXPORT = LEVEL ? `ORBIT_FUEL_BANK_${LEVEL.toUpperCase()}` : "ORBIT_FUEL_BANK";

/** The Normal bank's entries, or a level's. */
async function loadBank(): Promise<OrbitFuelBankEntry[]> {
  if (!LEVEL) return (await import("../src/lib/duel/orbitFuelBank.server")).ORBIT_FUEL_BANK;
  const mod = (await import(`../${OUT}`)) as Record<string, OrbitFuelBankEntry[]>;
  return mod[EXPORT]!;
}

export function buildEntry(k: number): OrbitFuelBankEntry | null {
  const seed = SEED_OF(k);
  const c = buildFuelCourse(seed);
  if (!c) {
    console.log(`  seed ${k} (${seed}): no course — ${fuelFailure.slice(0, 400)}`);
    return null;
  }
  return { seed, build: c.build, planets: encodeRev3Planets(c.planets), holes: encodeOrbitHoles(c.holes), extras: encodeOrbitExtras(c.extras), taps: c.taps, ticks: c.ticks };
}

function source(entries: OrbitFuelBankEntry[]): string {
  if (LEVEL) {
    return `/* Generated by scripts/orbit-fuel-bank.ts --level=${LEVEL} — do not edit by hand. */
import type { OrbitFuelBankEntry } from "./orbitFuelBank.server";

/** Orbit's ${LEVEL} bank (docs/arcade-standard/orbit.md "Levels"): courses laid out from the level's settings, every witness 200 on orbitRev 16 with the level's rules. */
export const ${EXPORT}: OrbitFuelBankEntry[] = ${JSON.stringify(entries)};
`;
  }
  return `/* Generated by scripts/orbit-fuel-bank.ts — do not edit by hand. */
import type { OrbitExtrasRow, OrbitHoleRow, OrbitRev3CompactPlanet } from "@/lib/arcade/orbitRev3";

export interface OrbitFuelBankEntry {
  /** The bank seed the course was built for (scripts/orbit-fuel-bank.ts FUEL_BANK_SEED). */
  seed: number;
  /** The salted seed the course's planets were laid out from (scripts/orbit-fuel-lib.ts buildFuelCourseRaw). */
  build: number;
  /** Compact per-planet rows, index 0..40 (decodeRev3Planets). */
  planets: OrbitRev3CompactPlanet[];
  /** Proved black holes, [from, to, x, y] each. */
  holes: OrbitHoleRow[];
  /** Stardust trails, slingshot moons and asteroid fields (decodeOrbitExtras). */
  extras: OrbitExtrasRow;
  /** Witness taps: a run on orbitRev 14 that takes every feature (and the black holes it meets) and reaches the sun with half the run left (200). */
  taps: number[];
  /** The witness run's finishing tick. */
  ticks: number;
}

export const ORBIT_FUEL_BANK: OrbitFuelBankEntry[] = ${JSON.stringify(entries)};
`;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const proveRev = args.find((a) => a.startsWith("--rev="))?.slice(6);
  if (proveRev) {
    // Every entry's witness, played as the phone records it on that revision, through the server's replay: 200 with every feature.
    const ORBIT_FUEL_BANK = await loadBank();
    const { orbitCheckpoint, ORBIT_INPUT_TAP } = await import("../src/lib/arcade/orbit");
    const { decodeOrbitExtras, decodeOrbitHoles, decodeRev3Planets, orbitRev3Game, orbitRev3StartFor, orbitXpCounts, ORBIT_REV3_WORLD_W } = await import("../src/lib/arcade/orbitRev3");
    const { encodeOrbitRun, replayOrbitRun } = await import("../src/lib/duel/orbit");
    const rev = Number(proveRev);
    let good = 0;
    for (const e of ORBIT_FUEL_BANK) {
      const start = orbitRev3StartFor(rev, decodeOrbitExtras(e.extras), LEVEL);
      if (!start) throw new Error(`orbitRev ${rev} has no bank-course start`);
      const taps = new Set(e.taps);
      let st = start(decodeRev3Planets(e.planets), ORBIT_REV3_WORLD_W, decodeOrbitHoles(e.holes));
      const checkpoints: unknown[] = [];
      while (!st.ended && st.tick < orbitRev3Game.runTicks) {
        st = orbitRev3Game.step(st, taps.has(st.tick + 1) ? { t: st.tick + 1, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 } : null);
        if (st.tick % 300 === 0) checkpoints.push(orbitCheckpoint(st as never));
      }
      const events = e.taps.map((t) => ({ t, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 }));
      const raw = encodeOrbitRun({ seed: e.seed, claimedScore: orbitRev3Game.score(st), events, inputs: [], taps: [], endTick: st.tick, checkpoints } as never);
      const r = replayOrbitRun(e.seed, raw, rev, e.planets, e.holes, e.extras, undefined, LEVEL ?? undefined);
      const c = orbitXpCounts(r.state as never);
      const ok = !r.flagged && r.score === 200 && c.dust === c.dustTotal && c.slings === c.slingsTotal && c.threads === c.threadsTotal;
      if (ok) good++;
      else console.log(`FAIL bank seed ${e.seed}: ${r.score}${r.flagged ? " (flagged)" : ""}`);
    }
    const where = LEVEL ? ` (${LEVEL})` : "";
    console.log(good === ORBIT_FUEL_BANK.length ? `PASS: all ${good} bank courses' witnesses reach 200 with every feature on orbitRev ${rev}${where}` : `FAIL: ${good} / ${ORBIT_FUEL_BANK.length} on orbitRev ${rev}${where}`);
    process.exit(good === ORBIT_FUEL_BANK.length ? 0 : 1);
  }
  if (args[0] === "--check") {
    const n = Number(args.slice(1).find((a) => /^\d+$/.test(a)) ?? 2);
    const ORBIT_FUEL_BANK = await loadBank();
    let bad = 0;
    for (const want of ORBIT_FUEL_BANK.slice(0, n)) {
      let k = 0;
      while (SEED_OF(k) !== want.seed && k < 100000) k++;
      const got = buildEntry(k);
      const same = JSON.stringify(got) === JSON.stringify(want);
      if (!same) bad++;
      console.log(`${same ? "ok  " : "DIFF"} bank seed ${want.seed}`);
    }
    console.log(bad ? `FAIL: ${bad} of ${Math.min(n, ORBIT_FUEL_BANK.length)} entries differ` : `PASS: ${Math.min(n, ORBIT_FUEL_BANK.length)} entries rebuild byte for byte`);
    process.exit(bad ? 1 : 0);
  } else if (args[0] === "--worker") {
    // Worker: bank seeds k ≡ w (mod n) below count, skipping any already in the cache folder (a resumed build).
    const [w, n, count, dir] = [Number(args[1]), Number(args[2]), Number(args[3]), args[4]!];
    const done = readCache(dir);
    const file = `${dir}/orbit-fuel-w${w}-${Date.now()}.json`;
    const out: CacheRow[] = [];
    const started = Date.now();
    for (let k = w; k < count; k += n) {
      if (done.has(SEED_OF(k))) continue;
      const e = buildEntry(k);
      out.push(e ?? { seed: SEED_OF(k), failed: true });
      writeFileSync(file, JSON.stringify(out));
    }
    console.log(`worker ${w}: ${out.length} seeds in ${((Date.now() - started) / 1000).toFixed(0)} s`);
  } else {
    // Build (or resume, or with --merge only merge) the first `count` bank seeds; the bank is every one that built, in order.
    const merge = args.includes("--merge");
    const dir = args.find((a) => a.startsWith("--dir="))?.slice(6) ?? `${process.env.TMPDIR ?? "/tmp"}/orbit-fuel-cache${LEVEL ? `-${LEVEL}` : ""}`;
    mkdirSync(dir, { recursive: true });
    let count = Number(args.find((a) => /^\d+$/.test(a)) ?? DEFAULT_COUNT);
    const started = Date.now();
    if (!merge) {
      const procs = Array.from({ length: WORKERS }, (_, w) => Bun.spawn(["bun", "run", "scripts/orbit-fuel-bank.ts", "--worker", String(w), String(WORKERS), String(count), dir, ...(LEVEL ? [`--level=${LEVEL}`] : [])], { stdout: "inherit", stderr: "inherit" }));
      const codes = await Promise.all(procs.map((p) => p.exited));
      codes.forEach((code, i) => {
        if (code !== 0) throw new Error(`worker ${i} exited ${code}`);
      });
    }
    const cache = readCache(dir);
    // --merge: the longest prefix of bank seeds the cache holds (a build stopped early); else every seed must be there.
    let k = 0;
    while (k < count && cache.has(SEED_OF(k))) k++;
    if (k < count && !merge) throw new Error(`bank seed ${k} missing from the cache`);
    count = k;
    const entries: OrbitFuelBankEntry[] = [];
    for (let i = 0; i < count; i++) {
      const row = cache.get(SEED_OF(i))!;
      if (!("failed" in row)) entries.push(row);
    }
    writeFileSync(OUT, source(entries));
    console.log(`wrote ${entries.length} / ${count} bank seeds to ${OUT} (rebuild: bun scripts/orbit-fuel-bank.ts ${count}${LEVEL ? ` --level=${LEVEL}` : ""}) in ${((Date.now() - started) / 1000).toFixed(0)} s`);
  }
}

type CacheRow = OrbitFuelBankEntry | { seed: number; failed: true };
function readCache(dir: string): Map<number, CacheRow> {
  const out = new Map<number, CacheRow>();
  for (const f of readdirSync(dir)) {
    if (!/^orbit-fuel-w\d+-\d+\.json$/.test(f)) continue;
    for (const row of JSON.parse(readFileSync(`${dir}/${f}`, "utf8")) as CacheRow[]) out.set(row.seed, row);
  }
  return out;
}
