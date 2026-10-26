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
 * Competence fix (ctx.fixes, Oct 2026): a player who can see the belts come round doesn't throw the
 * rocket at a release window one or two ticks wide (near-perfect's losses were almost all such
 * windows late in the course, with 40 s of the 90 s run to spare). Each window is judged by the chance
 * the player's own jitter (timing and read error at that flight) lands the tap on a losing tick; the
 * first window under the level's tolerance (RISK) is taken, else the safest one seen within the usual
 * wait (three laps, or the belts' full turn), and anything once time runs short. Perfect judges
 * windows by elite's jitter (the same choices) and then taps without error. Elite and perfect
 * (protect the base): a black hole is gone for only when its window is as safe as that, else the hop.
 */
import { lapPhases, ORBIT_INPUT_CHECKPOINT, ORBIT_INPUT_TAP } from "../../../src/lib/arcade/orbit";
import type { OrbitRev3State } from "../../../src/lib/arcade/orbitRev3";
import { PROFILES, type SkillLevel } from "../human";
import { driveEvents, Plan, type SkillBot } from "../bot";

/** Chance of going for a black hole when one is on offer. */
const HOLE_TRY: Record<SkillLevel, number> = { weak: 0, average: 0.2, good: 0.45, great: 0.7, near: 0.85, elite: 1, perfect: 1 };
/** Chance per hop of hesitating and letting the release point go round once more. */
const HESITATE: Record<SkillLevel, number> = { weak: 0.2, average: 0.15, good: 0.1, great: 0.06, near: 0.03, elite: 0.015, perfect: 0 };
/** ctx.fixes: the most loss chance a player accepts on a window before waiting for a better one. */
const RISK: Record<SkillLevel, number> = { weak: 1, average: 0.25, good: 0.15, great: 0.08, near: 0.04, elite: 0.03, perfect: 0.03 };
/** Normal CDF (Abramowitz–Stegun erf). */
const phi = (z: number) => {
  const x = Math.abs(z) / Math.SQRT2;
  const k = 1 / (1 + 0.3275911 * x);
  const e = 1 - ((((1.061405429 * k - 1.453152027) * k + 1.421413741) * k - 0.284496736) * k + 0.254829592) * k * Math.exp(-x * x);
  return z >= 0 ? (1 + e) / 2 : (1 - e) / 2;
};
/** Flight sim cap (rev 3), ticks. */
const FLIGHT_MAX = 190;

type Kind = "hop" | "hole" | "die";

export const bot: SkillBot = ({ game, seed, human, fixes }) => {
  const level = human.level;
  /** The window fix (see above): the core levels only with ctx.fixes; weak, elite and perfect always. */
  const FIX = Boolean(fixes) || level === "weak" || level === "elite" || level === "perfect";
  /** Elite and perfect protect the base: a hole only when it is no riskier than the hop they'd accept. */
  const PROTECT = level === "elite" || level === "perfect";
  const runTicks = game.runTicks;
  const step = (s: OrbitRev3State, tap: boolean) => game.step(s, tap ? { t: s.tick + 1, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 } : null) as OrbitRev3State;

  /** Wait d ticks in orbit, tap, follow the flight: what happens, and how long it flew. */
  const fork = (from: OrbitRev3State, d: number): { kind: Kind; flight: number } => {
    let s = from;
    for (let k = 0; k < d && !s.ended; k++) s = step(s, false);
    s = step(s, true);
    let n = 0;
    while (s.flying > 0 && s.ended === 0 && n++ < FLIGHT_MAX + 5) s = step(s, false);
    if ((s.jumps ?? 0) > (from.jumps ?? 0)) return { kind: "hole", flight: n };
    if (s.ended === 2 || s.respawns < from.respawns) return { kind: "die", flight: n };
    if (s.cur > from.cur || s.finished === 1) return { kind: "hop", flight: n };
    return { kind: "die", flight: n };
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
    /** Windows found so far: [start delay, length, kind]. */
    const windows: [number, number, Kind][] = [];
    const hasHole = (s.holes ?? []).some((h) => h.from === s.cur);
    // A hole they already died going for is left alone; with no respawn in hand they gamble half as often.
    const safety = s.checkpoint >= 0 && s.respawns > 0 ? 1 : 0.5;
    const tryHole = hasHole && !burnt.has(s.cur) && human.chance(HOLE_TRY[level]! * safety);
    if (tryHole) burnt.add(s.cur);
    let skips = human.chance(HESITATE[level]!) ? 1 : 0;
    let chosen: [number, number, Kind] | null = null;
    /** FIX: a window's loss chance under the player's own jitter, aimed at its middle. */
    // (perfect chooses windows as elite does, by elite's jitter, then taps without error: the same policy, no error.)
    const sdTick = (level === "perfect" ? PROFILES.elite.timingSdMs : human.p.timingSdMs) / (1000 / 60);
    const riskOf = (w: [number, number, Kind]) => {
      const mid = w[0] + (w[1] - 1) / 2;
      const flight = flights[Math.round(mid)] ?? 60;
      const sd = sdTick * Math.sqrt((flight / 150 + (beltsNear ? 0.4 : 0)) ** 2 + 1);
      if (sd < 1e-6) return kinds[Math.round(mid)] === "die" ? 1 : 0;
      let p = 0;
      const span = Math.ceil(4 * sd) + 1;
      for (let x = Math.floor(mid) - span; x <= Math.ceil(mid) + span; x++) {
        const k = x < 0 ? "die" : (kinds[Math.min(x, kinds.length - 1)] ?? "die");
        if (k === "die") p += phi((x + 0.5 - mid) / sd) - phi((x - 0.5 - mid) / sd);
      }
      return p;
    };
    // Time running short (about 1.5 s a planet left): any window will do.
    const hurry = runTicks - t < (40 - s.cur) * 90;
    const risk = hurry ? 1 : RISK[level]!;
    let fallback: [number, number, Kind] | null = null;
    let fallbackRisk = Infinity;
    for (let d = 0; d <= maxScan && !chosen; d++) {
      const f = fork(s, d);
      kinds.push(f.kind);
      flights.push(f.flight);
      // Close a window when it ends.
      const prev = kinds[d - 1];
      if (d > 0 && prev !== "die" && prev !== f.kind) {
        let a = d - 1;
        while (a > 0 && kinds[a - 1] === prev) a--;
        windows.push([a, d - a, prev!]);
        const w = windows[windows.length - 1]!;
        // Usable only if its middle comes round after the player is ready.
        if (w[0] + w[1] / 2 >= ready && (w[2] === "hole") === tryHole) {
          if (skips > 0) skips--;
          else if (!FIX) chosen = w;
          else {
            const r = riskOf(w);
            if (r <= risk) chosen = w;
            else if (r < fallbackRisk - 1e-9) {
              fallback = w;
              fallbackRisk = r;
            }
          }
        }
      }
    }
    if (FIX && PROTECT && tryHole && !chosen) {
      // Protect the base: no hole window safe enough, so the hop it would have flown (the first acceptable, else the safest).
      const hops = windows.filter((w) => w[2] === "hop" && w[0] + w[1] / 2 >= ready);
      chosen = hops.find((w) => riskOf(w) <= risk) ?? hops.sort((a, b) => riskOf(a) - riskOf(b))[0] ?? null;
    }
    if (FIX && !chosen) chosen = fallback;
    if (!chosen) {
      // Nothing of the wanted kind came round: take any hop window seen after ready, else just guess.
      chosen = windows.find((w) => w[2] === "hop" && w[0] + w[1] / 2 >= ready) ?? windows.find((w) => w[2] === "hop") ?? [ready + lap / 2, 1, "hop"];
    }
    const [start, len] = chosen;
    const mid = start + (len - 1) / 2;
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
