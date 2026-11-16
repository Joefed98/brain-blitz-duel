/**
 * Orbit's run summary for the answer reveal (the Action overhaul, stage 2, 15 Nov 2026; display only). The stored run is
 * replayed once through the server's own replay (replayOrbitRun, the same states and score) while this records what the
 * map draws: the flights flown, every slip (an empty tank or a crash) and where it happened, the planets reached, and the
 * stardust and slingshot moons taken. Nothing here grades or scores: the numbers are the replay's own state and the
 * standard's breakdown of it.
 */
import { ORBIT_TOTAL, type Planet } from "@/lib/arcade/orbit";
import { orbitStdScore, orbitXpCounts, type OrbitRev3State } from "@/lib/arcade/orbitRev3";
import type { StdBreakdown } from "@/lib/arcade/arcadeStandard";
import { replayOrbitRun, type OrbitResult } from "./orbit";
import type { OrbitPuzzleData } from "./types";

const FP = 256;

export interface OrbitSlip {
  /** World px. */
  x: number;
  y: number;
  kind: "fuel" | "crash";
}

export interface OrbitRunTrace {
  result: OrbitResult;
  planets: Planet[];
  /** Highest planet index reached (0–40; 40 = the sun). */
  best: number;
  finished: boolean;
  /** Each flight's path, world px, sampled every few ticks (the release to the catch or the slip). */
  flights: [number, number][][];
  slips: OrbitSlip[];
  dust: { x: number; y: number; got: boolean }[];
  moons: { x: number; y: number; got: boolean }[];
  counts: ReturnType<typeof orbitXpCounts>;
  /** The standard's parts (orbitRev 13+), or null on an older stamp. */
  parts: StdBreakdown | null;
}

/** Ticks between recorded flight points. */
const SAMPLE = 3;

/** The summary of a stored expansion-view run (orbitRev 12+), or null for an older stamp (no features to map). */
export function traceOrbitRun(puzzle: OrbitPuzzleData, answer: string): OrbitRunTrace | null {
  const flights: [number, number][][] = [];
  const slips: OrbitSlip[] = [];
  let flight: [number, number][] | null = null;
  let prev: OrbitRev3State | null = null;
  const observe = (s: OrbitRev3State) => {
    const was = prev;
    prev = s;
    if (!was) return;
    const slipped = s.respawnTick !== was.respawnTick || (s.ended === 2 && was.ended !== 2);
    if (slipped) {
      // Where the slip happened: the end of the flight (its last point, carried on to this tick on a respawn).
      const at = s.ended === 2 && s.respawnTick === was.respawnTick ? [s.x / FP, s.y / FP] : flight?.[flight.length - 1] ?? [was.x / FP, was.y / FP];
      const fuel = s.dry !== undefined && (s.dry === s.respawnTick || s.dry === s.endedTick);
      slips.push({ x: at[0]!, y: at[1]!, kind: fuel ? "fuel" : "crash" });
      if (flight && s.ended === 2) flight.push([s.x / FP, s.y / FP]);
      flight = null;
      return;
    }
    if (s.flying > 0) {
      if (!flight) {
        flight = [[was.x / FP, was.y / FP]];
        flights.push(flight);
      }
      if (s.tick % SAMPLE === 0) flight.push([s.x / FP, s.y / FP]);
    } else if (flight) {
      flight.push([s.x / FP, s.y / FP]);
      flight = null;
    }
  };
  const result = replayOrbitRun(puzzle.seed, answer, puzzle.orbitRev, puzzle.planets, puzzle.holes, puzzle.extras, observe, puzzle.level);
  const end = result.state as OrbitRev3State;
  if (!("xp" in result) || !result.xp || !end.planets) return null;
  const dustBits = end.dustGot ?? 0;
  const moonBits = end.slung ?? 0;
  return {
    result,
    planets: end.planets,
    best: end.finished ? ORBIT_TOTAL : Math.max(0, Math.min(ORBIT_TOTAL, end.best)),
    finished: Boolean(end.finished),
    flights: flights.filter((f) => f.length > 1),
    slips,
    dust: (end.dust ?? []).map((m, i) => ({ x: m.x / FP, y: m.y / FP, got: Boolean(dustBits & (1 << i)) })),
    moons: (end.moons ?? []).map((m, i) => ({ x: m.x / FP, y: m.y / FP, got: Boolean(moonBits & (1 << i)) })),
    counts: orbitXpCounts(end),
    parts: end.std ? orbitStdScore(end) : null,
  };
}
