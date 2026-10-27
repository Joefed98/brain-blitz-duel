/**
 * Orbit's reserved corner (orbitRev 12, Joe's phone notes, 27 Oct 2026; docs/arcade-phone-notes-oct-2026.md), for
 * play-control-clearance-check and room-practice-parity-check: SET CHECKPOINT sits in ORBIT_XP_ZONE, the top-right corner
 * of the rows drawn above the camera's frame, where nothing in play is drawn (orbit.renderer.ts clips everything but
 * the starfield out of it) and which the rocket never enters. `zoneProof` replays every course rooms can deal (the
 * 371 bank courses, room seed mod 371) with its witness taps and with seeded random taps, both camera modes (normal
 * and reduced motion), and reports any frame whose rocket (its drawn reach, ROCKET_REACH) meets the zone.
 */
import { ORBIT_INPUT_CHECKPOINT, ORBIT_INPUT_TAP } from "../src/lib/arcade/orbit";
import { decodeOrbitExtras, decodeOrbitHoles, decodeRev3Planets, initXpFrom, orbitRev3Game, ORBIT_REV3_WORLD_W, type OrbitRev3State } from "../src/lib/arcade/orbitRev3";
import { orbitCamera, orbitCameraResetCache, orbitViewH, orbitViewW } from "../src/lib/arcade/orbitCamera";
import { ORBIT_XP_AHEAD, ORBIT_XP_DRAW_H, ORBIT_XP_ZONE } from "../src/lib/arcade/orbit.renderer";
import { ORBIT_HOLE_BANK } from "../src/lib/duel/orbitHoleBank.server";
import { ORBIT_REV3_BANK } from "../src/lib/duel/orbitRev3Bank.server";
import { ORBIT_XP_BANK } from "../src/lib/duel/orbitXpBank.server";

const FP = 256;
/** The rocket's drawn reach from its centre (px): its body, fins and flame (orbit.renderer.ts), with a margin. */
export const ROCKET_REACH = 16;
/** SET CHECKPOINT's box (CSS px) inside the world box: 4 px from the top and right, 44 px tall, at most this wide. */
export const BUTTON = { inset: 4, h: 44, maxW: 128 } as const;
export { ORBIT_XP_AHEAD, ORBIT_XP_DRAW_H, ORBIT_XP_ZONE };

/** At a world scale (CSS px per view px): the zone in CSS px and whether the button with its insets fits inside it. */
export function zoneFits(scale: number): { w: number; h: number; fits: boolean } {
  const w = ORBIT_XP_ZONE.w * scale;
  const h = ORBIT_XP_ZONE.h * scale;
  return { w, h, fits: BUTTON.inset + BUTTON.maxW <= w && BUTTON.inset + BUTTON.h <= h };
}

export interface ZoneProof { courses: number; runs: number; frames: number; hits: string[]; lowestRocketTop: number }

export function zoneProof(randomRuns = 1): ZoneProof {
  const out: ZoneProof = { courses: 0, runs: 0, frames: 0, hits: [], lowestRocketTop: Infinity };
  const holesOf = new Map(ORBIT_HOLE_BANK.map((e) => [e.seed, e.holes]));
  const planetsOf = new Map(ORBIT_REV3_BANK.map((e) => [e.seed, e.planets]));
  for (const entry of ORBIT_XP_BANK) {
    out.courses++;
    const start = () => initXpFrom(decodeRev3Planets(planetsOf.get(entry.seed)!), ORBIT_REV3_WORLD_W, decodeOrbitHoles(holesOf.get(entry.seed)!), decodeOrbitExtras(entry.extras));
    const logs: ((s: OrbitRev3State) => { t: number; k: number; a: number; b: number; c: number; d: number } | null)[] = [];
    const witness = new Set(entry.taps);
    logs.push((s) => (witness.has(s.tick + 1) ? { t: s.tick + 1, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 } : null));
    for (let r = 0; r < randomRuns; r++) {
      let v = (entry.seed * 2654435761 + r * 97) | 0;
      logs.push((s) => {
        v = (Math.imul(v, 1103515245) + 12345) | 0;
        const roll = (v >>> 8) % 1000;
        // About one tap in 1.2 s, now and then a checkpoint (as a careless player would).
        if (roll < 14) return { t: s.tick + 1, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 };
        if (roll < 16) return { t: s.tick + 1, k: ORBIT_INPUT_CHECKPOINT, a: 0, b: 0, c: 0, d: 0 };
        return null;
      });
    }
    for (const [li, log] of logs.entries()) {
      for (const reducedMotion of [false, true]) {
        out.runs++;
        orbitCameraResetCache();
        let s = start();
        const W = orbitViewW(s);
        const ahead = ORBIT_XP_DRAW_H - orbitViewH(s);
        while (!s.ended && s.tick < orbitRev3Game.runTicks) {
          s = orbitRev3Game.step(s, log(s)) as OrbitRev3State;
          const cam = orbitCamera(s, { reducedMotion });
          out.frames++;
          const x = s.x / FP - cam.x;
          const y = s.y / FP - cam.y + ahead;
          out.lowestRocketTop = Math.min(out.lowestRocketTop, y - ROCKET_REACH);
          const meets = x + ROCKET_REACH > W - ORBIT_XP_ZONE.w && y - ROCKET_REACH < ORBIT_XP_ZONE.h;
          if (meets && out.hits.length < 10) out.hits.push(`course ${entry.seed} ${li ? "random" : "witness"}${reducedMotion ? " (reduced motion)" : ""} tick ${s.tick}: rocket at ${x.toFixed(0)}, ${y.toFixed(0)}`);
        }
      }
    }
  }
  return out;
}
