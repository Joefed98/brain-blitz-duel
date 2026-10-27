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
import { orbitRev3Game, orbitRev3Extra, orbitStartForPuzzle, orbitXpCounts, type OrbitExtrasRow, initRev3From, initRev4From, initBandFrom, initTunedFrom, initSweptFrom, initTallFrom, initTargetFrom, initStrictFrom, decodeOrbitHoles, decodeRev3Planets, buildCourse3, ORBIT_REV3_WORLD_W, type OrbitRev3State } from "@/lib/arcade/orbitRev3";
import { ORBIT_REV_XP, ORBIT_REV3, ORBIT_REV4, ORBIT_REV_BAND, ORBIT_REV_SWEPT, ORBIT_REV_TALL, ORBIT_REV_TARGET, ORBIT_REV_STRICT, ORBIT_REV_TUNED } from "@/lib/arcade/orbit";
import type { OrbitHoleRow, OrbitRev3CompactPlanet } from "@/lib/arcade/orbitRev3";
import type { ArcadeGame, ArcadeInputEvent } from "@/lib/arcade/engine";

const run = makeArcadeRun<OrbitState, OrbitCheckpoint>({
  tag: "orbit",
  game: orbitGame,
  checkpoint: orbitCheckpoint,
  keys: ORBIT_CHECKPOINT_KEYS,
  interval: ORBIT_CHECKPOINT_INTERVAL,
});

export type OrbitResult = FlatReplay<OrbitState | OrbitRev3State, OrbitCheckpoint> & ReturnType<typeof orbitExtra> & {
  /** orbitRev 12 only: the features taken (orbitXpCounts). */
  xp?: ReturnType<typeof orbitXpCounts>;
};

export const encodeOrbitRun = run.encode;
export const decodeOrbitRun = run.decode;

/** The single place a Orbit score is worked out; rev3 replays against the stamped puzzle's own proved planets, never re-proving the course. */
export function replayOrbitRun(seed: number, raw: string, orbitRev?: number, planets?: OrbitRev3CompactPlanet[], holes?: OrbitHoleRow[], extras?: OrbitExtrasRow): OrbitResult {
  // orbitRev 12 (world expansion): the stamped bank course, holes and features; every earlier revision below is untouched.
  if (orbitRev === ORBIT_REV_XP) {
    const start = orbitStartForPuzzle({ orbitRev, planets, holes, extras });
    const xpRun = makeArcadeRun<OrbitRev3State, OrbitCheckpoint>({
      tag: "orbit",
      game: { ...orbitRev3Game, init: start ?? (() => orbitRev3Game.init(seed)) },
      checkpoint: (s) => orbitCheckpoint(s as unknown as OrbitState),
      keys: ORBIT_CHECKPOINT_KEYS,
      interval: ORBIT_CHECKPOINT_INTERVAL,
    });
    const result = xpRun.replay(seed, raw);
    return { ...result, ...orbitRev3Extra(result.state), xp: orbitXpCounts(result.state) };
  }
  if (orbitRev === ORBIT_REV3 || orbitRev === ORBIT_REV4 || orbitRev === ORBIT_REV_BAND || orbitRev === ORBIT_REV_TUNED || orbitRev === ORBIT_REV_SWEPT || orbitRev === ORBIT_REV_TALL || orbitRev === ORBIT_REV_TARGET || orbitRev === ORBIT_REV_STRICT) {
    const decoded = planets && planets.length > 0 ? decodeRev3Planets(planets) : buildCourse3(seed, ORBIT_REV3_WORLD_W).planets;
    // Rev 4 replays against the stamped puzzle's own proved black holes.
    // Rev 5 (score bands) is rev 4 with the stamp.
    // Rev 6 (Tuning A) adds the black-hole fly-in and the earlier end to a missed hop.
    // Rev 7 (Tuning F) makes black holes swept: every hole ahead, the rocket's whole body, ordered against belts.
    // Rev 8 (taller worlds) is rev 7 play framed in a taller view; its height rides in the state.
    const start = () =>
      orbitRev === ORBIT_REV_STRICT
        ? initStrictFrom(decoded, ORBIT_REV3_WORLD_W, decodeOrbitHoles(holes ?? []))
        : orbitRev === ORBIT_REV_TARGET
        ? initTargetFrom(decoded, ORBIT_REV3_WORLD_W, decodeOrbitHoles(holes ?? []))
        : orbitRev === ORBIT_REV_TALL
        ? initTallFrom(decoded, ORBIT_REV3_WORLD_W, decodeOrbitHoles(holes ?? []))
        : orbitRev === ORBIT_REV_SWEPT
        ? initSweptFrom(decoded, ORBIT_REV3_WORLD_W, decodeOrbitHoles(holes ?? []))
        : orbitRev === ORBIT_REV_TUNED
        ? initTunedFrom(decoded, ORBIT_REV3_WORLD_W, decodeOrbitHoles(holes ?? []))
        : orbitRev === ORBIT_REV_BAND
        ? initBandFrom(decoded, ORBIT_REV3_WORLD_W, decodeOrbitHoles(holes ?? []))
        : orbitRev === ORBIT_REV4 ? initRev4From(decoded, ORBIT_REV3_WORLD_W, decodeOrbitHoles(holes ?? [])) : initRev3From(decoded, ORBIT_REV3_WORLD_W);
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
