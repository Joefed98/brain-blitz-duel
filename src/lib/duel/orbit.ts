/** Orbit round plumbing: the server replays with the STORED seed and keeps its own score. */

import {
  orbitCheckpoint,
  orbitGame,
  ORBIT_CHECKPOINT_INTERVAL,
  ORBIT_CHECKPOINT_KEYS,
  orbitExtra,
  type OrbitCheckpoint,
  type OrbitState,
} from "@/lib/arcade/orbit";
import { makeArcadeRun, type FlatReplay } from "./arcadeRun";
import { orbitRev3Game, orbitRev3Extra, initRev3From, initRev4From, decodeOrbitHoles, decodeRev3Planets, buildCourse3, ORBIT_REV3_WORLD_W, type OrbitRev3State } from "@/lib/arcade/orbitRev3";
import { ORBIT_REV3, ORBIT_REV4 } from "@/lib/arcade/orbit";
import type { OrbitHoleRow, OrbitRev3CompactPlanet } from "@/lib/arcade/orbitRev3";
import type { ArcadeGame, ArcadeInputEvent } from "@/lib/arcade/engine";

const run = makeArcadeRun<OrbitState, OrbitCheckpoint>({
  tag: "orbit",
  game: orbitGame,
  checkpoint: orbitCheckpoint,
  keys: ORBIT_CHECKPOINT_KEYS,
  interval: ORBIT_CHECKPOINT_INTERVAL,
});

export type OrbitResult = FlatReplay<OrbitState | OrbitRev3State, OrbitCheckpoint> & ReturnType<typeof orbitExtra>;

export const encodeOrbitRun = run.encode;
export const decodeOrbitRun = run.decode;

/** The single place a Orbit score is worked out; rev3 replays against the stamped puzzle's own proved planets, never re-proving the course. */
export function replayOrbitRun(seed: number, raw: string, orbitRev?: number, planets?: OrbitRev3CompactPlanet[], holes?: OrbitHoleRow[]): OrbitResult {
  if (orbitRev === ORBIT_REV3 || orbitRev === ORBIT_REV4) {
    const decoded = planets && planets.length > 0 ? decodeRev3Planets(planets) : buildCourse3(seed, ORBIT_REV3_WORLD_W).planets;
    // Rev 4 replays against the stamped puzzle's own proved black holes.
    const start = () =>
      orbitRev === ORBIT_REV4 ? initRev4From(decoded, ORBIT_REV3_WORLD_W, decodeOrbitHoles(holes ?? [])) : initRev3From(decoded, ORBIT_REV3_WORLD_W);
    const game: ArcadeGame<OrbitRev3State, ArcadeInputEvent | null> = { ...orbitRev3Game, init: start };
    const rev3Run = makeArcadeRun<OrbitRev3State, OrbitCheckpoint>({
      tag: "orbit",
      game,
      checkpoint: (s) => orbitCheckpoint(s as unknown as OrbitState),
      keys: ORBIT_CHECKPOINT_KEYS,
      interval: ORBIT_CHECKPOINT_INTERVAL,
    });
    const result = rev3Run.replay(seed, raw);
    return { ...result, ...orbitRev3Extra(result.state) };
  }
  const result = run.replay(seed, raw);
  return { ...result, ...orbitExtra(result.state) };
}
