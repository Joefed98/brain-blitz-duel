/**
 * Orbit: a person releasing the rocket. After each capture (or respawn) they
 * take a moment to see the new orbit and where the next planet is (reaction +
 * think time), then wait for the release point to come round and tap on it:
 * an anticipated moment, so the tap lands with timing error, and their idea of
 * where the release point is carries a read error that grows with how far the
 * flight has to go and when rotating belts are in play. Sometimes they hesitate
 * and take the next lap; now and then they plainly mistime it. The checkpoint
 * button gets pressed once they have made some progress and a hop looks hard.
 * Black holes are a gamble the better levels take more often.
 *
 * The "right" release ticks come from forking the real sim (each wait d, tap,
 * follow the flight) — that stands in for the player's experience of where
 * the release point is. The tap itself is then the noisy human one, and its
 * outcome is whatever the sim does; nothing here looks at the score.
 *
 * orbitRev 12 (world expansion): the features are things a player sees, so the bot may aim for them. Within the
 * window it picked, the forks also show which release ticks take stardust, a moon's slingshot or an asteroid
 * gap; a player who goes for them (more often the better they are) aims at the best of those ticks instead of
 * the window's middle (a narrower target, so the same timing error misses more), and better players more often
 * let go in the first lap (perfect orbits) rather than waiting for a comfortable later window.
 */
import { lapPhases, ORBIT_INPUT_CHECKPOINT, ORBIT_INPUT_TAP } from "../../../src/lib/arcade/orbit";
import type { OrbitRev3State } from "../../../src/lib/arcade/orbitRev3";
import { driveEvents, Plan, type SkillBot } from "../bot";

/** Chance of going for a black hole when one is on offer. */
const HOLE_TRY: Record<string, number> = { average: 0.2, good: 0.45, great: 0.7, near: 0.85 };
/** Chance per hop of hesitating and letting the release point go round once more. */
const HESITATE: Record<string, number> = { average: 0.15, good: 0.1, great: 0.06, near: 0.03 };
/** Flight sim cap (rev 3), ticks. */
const FLIGHT_MAX = 190;
/** orbitRev 12: chance of aiming for the features on a hop that has some, and of insisting on a first-lap release. */
const FEATURE_TRY: Record<string, number> = { average: 0.25, good: 0.5, great: 0.75, near: 0.9 };
const FIRST_LAP: Record<string, number> = { average: 0.35, good: 0.6, great: 0.8, near: 0.95 };

type Kind = "hop" | "hole" | "die";

export const bot: SkillBot = ({ game, seed, human }) => {
  const level = human.level;
  // The elite level (the 200-point expansions' extra level): near-perfect's tables, but always after the features and
  // the first-lap release, and its steadier hand aims a tick closer to a window's edge.
  const elite = human.band === "elite";
  const featureTry = elite ? 1 : FEATURE_TRY[level]!;
  const firstLap = elite ? 1 : FIRST_LAP[level]!;
  const room = elite ? [-1, 1] : [-2, -1, 1, 2];
  const step = (s: OrbitRev3State, tap: boolean) => game.step(s, tap ? { t: s.tick + 1, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 } : null) as OrbitRev3State;

  /** Wait d ticks in orbit, tap, follow the flight: what happens, and how long it flew. */
  /** Feature points a fork's flight took (orbitRev 12): motes, slingshots and threads, as the score counts them. */
  const gainOf = (from: OrbitRev3State, to: OrbitRev3State) => {
    const bits = (n: number) => { let c = 0; for (let b = n; b; b &= b - 1) c++; return c; };
    return (bits(to.dustGot ?? 0) - bits(from.dustGot ?? 0)) / 2 + 4 * (bits(to.slung ?? 0) - bits(from.slung ?? 0)) + 4 * (bits(to.threaded ?? 0) - bits(from.threaded ?? 0));
  };
  const fork = (from: OrbitRev3State, d: number): { kind: Kind; flight: number; gain: number } => {
    let s = from;
    for (let k = 0; k < d && !s.ended; k++) s = step(s, false);
    s = step(s, true);
    let n = 0;
    while (s.flying > 0 && s.ended === 0 && n++ < FLIGHT_MAX + 5) s = step(s, false);
    const gain = from.xp ? gainOf(from, s) : 0;
    if ((s.jumps ?? 0) > (from.jumps ?? 0)) return { kind: "hole", flight: n, gain };
    if (s.ended === 2 || s.respawns < from.respawns) return { kind: "die", flight: n, gain: 0 };
    if (s.cur > from.cur || s.finished === 1) return { kind: "hop", flight: n, gain };
    return { kind: "die", flight: n, gain: 0 };
  };

  const plan = new Plan();
  let key = "";
  let cpPlanned = false;
  /** Holes the player has gone for once already. */
  const burnt = new Set<number>();
  const init = game.init(seed) as OrbitRev3State;

  const planOrbit = (s: OrbitRev3State, t: number, first: boolean) => {
    plan.clear();
    const here = s.planets[s.cur]!;
    const lap = Math.max(1, lapPhases(here).length);
    const beltsNear = s.planets.slice(s.cur, s.cur + 4).some((p) => p.hazard >= 0);
    // Seeing the new orbit and the target: a reaction, then a short read.
    const ready = (first ? human.thinkTicks(900) : human.reactTicks() + human.thinkTicks(350)) + 2;
    const maxScan = Math.max(lap * 3, beltsNear ? 760 : 0) + ready;
    const kinds: Kind[] = [];
    const flights: number[] = [];
    const gains: number[] = [];
    /** Windows found so far: [start delay, length, kind]. */
    const windows: [number, number, Kind][] = [];
    const hasHole = (s.holes ?? []).some((h) => h.from === s.cur);
    // A hole they already died going for is left alone; with no respawn in hand they gamble half as often.
    const safety = s.checkpoint >= 0 && s.respawns > 0 ? 1 : 0.5;
    const tryHole = hasHole && !burnt.has(s.cur) && human.chance(HOLE_TRY[level]! * safety);
    if (tryHole) burnt.add(s.cur);
    let skips = human.chance(HESITATE[level]!) ? 1 : 0;
    let chosen: [number, number, Kind] | null = null;
    for (let d = 0; d <= maxScan && !chosen; d++) {
      const f = fork(s, d);
      kinds.push(f.kind);
      flights.push(f.flight);
      gains.push(f.gain);
      // Close a window when it ends.
      const prev = kinds[d - 1];
      if (d > 0 && prev !== "die" && prev !== f.kind) {
        let a = d - 1;
        while (a > 0 && kinds[a - 1] === prev) a--;
        windows.push([a, d - a, prev!]);
        const w = windows[windows.length - 1]!;
        // Usable only if its middle comes round after the player is ready.
        if (w[0] + w[1] / 2 >= ready && (w[2] === "hole") === tryHole) {
          // orbitRev 12: a first-lap release is a perfect orbit; a keen player never lets this one go round.
          if (s.xp && skips > 0 && w[0] + w[1] / 2 < lap && human.chance(firstLap)) skips = 0;
          if (skips > 0) skips--;
          else chosen = w;
        }
      }
    }
    if (!chosen) {
      // Nothing of the wanted kind came round: take any hop window seen after ready, else just guess.
      chosen = windows.find((w) => w[2] === "hop" && w[0] + w[1] / 2 >= ready) ?? windows.find((w) => w[2] === "hop") ?? [ready + lap / 2, 1, "hop"];
    }
    const [start, len] = chosen;
    let mid = start + (len - 1) / 2;
    // orbitRev 12: going for the features means aiming at the window's best tick for them (nearest the middle on a tie).
    if (s.xp && human.chance(featureTry)) {
      let best = -1, bestGain = 0;
      for (let d = start; d < start + len; d++) {
        // Only a tick with room either side (two ticks each way that still land): a player aims where a near miss is safe.
        const roomy = room.every((o) => kinds[d + o] !== undefined && kinds[d + o] !== "die");
        const g = roomy ? (gains[d] ?? 0) : 0;
        if (g > bestGain || (g === bestGain && g > 0 && Math.abs(d - mid) < Math.abs(best - mid))) {
          best = d;
          bestGain = g;
        }
      }
      if (best >= 0) mid = best;
    }
    const flight = flights[Math.round(mid)] ?? 60;
    // Read error on where the release point is: grows with the flight's length and with belts to thread.
    const readScale = flight / 150 + (beltsNear ? 0.4 : 0);
    let tapD = mid + human.timingMs(readScale) / (1000 / 60) + human.timingMs(1) / (1000 / 60);
    if (human.slip(0.3)) tapD += (human.chance(0.5) ? 1 : -1) * lap * (0.06 + 0.1 * human.u());
    tapD = Math.max(0, Math.round(tapD));
    plan.at(t + tapD, { k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 });
    // Checkpoint: once some progress is made and this hop looks hard (narrow or belted), or just felt like it.
    if (!cpPlanned && s.checkpoint < 0 && s.cur >= 4) {
      const hard = len <= 6 || beltsNear || chosen[2] === "hole";
      if (hard || human.chance(0.12)) {
        cpPlanned = true;
        const at = t + Math.min(Math.max(1, tapD - human.reactTicks()), human.thinkTicks(500));
        if (at < t + tapD) plan.at(at, { k: ORBIT_INPUT_CHECKPOINT, a: 0, b: 0, c: 0, d: 0 });
      }
    }
  };

  return driveEvents(game, (s: OrbitRev3State, t) => {
    if (s.flying === 0) {
      const k = `${s.cur}:${s.respawns}:${s.captured}`;
      if (k !== key) {
        const first = key === "";
        key = k;
        planOrbit(s, t, first);
      }
    }
    return plan.take(t);
  }, init);
};
