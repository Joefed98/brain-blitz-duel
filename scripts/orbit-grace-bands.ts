/**
 * Orbit's grace (orbitRev 15, the Action overhaul, 15 Nov 2026): the skill-band bot (scripts/arcade-skill-bands/bots/orbit.ts)
 * plays orbitRev 14 and orbitRev 15 on the same fuel-bank course for each room seed, the same human at each level (the
 * bot's competence fixes on, as the skill-band tool runs them), and reports each level's median and spread on both,
 * scored by the server's replay. A tool, not a check.
 *
 *   bun scripts/orbit-grace-bands.ts [--seeds=30] [--levels=weak,average,good,great,near,elite,perfect]
 */
import { orbitCheckpoint, ORBIT_REV_FUEL, ORBIT_REV_GRACE } from "../src/lib/arcade/orbit";
import { orbitRev3Game, type OrbitRev3State } from "../src/lib/arcade/orbitRev3";
import { encodeOrbitRun } from "../src/lib/duel/orbit";
import { bot } from "./arcade-skill-bands/bots/orbit";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";

const opt = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const SEEDS = Number(opt("seeds") ?? 30);
const LEVELS = (opt("levels") ?? "weak,average,good,great,near,elite,perfect").split(",") as SkillLevel[];
const spec = GAME_BY_TYPE.get("orbit")!;

/** One run: the bot's log re-driven as the phone records it, scored by the server's replay. */
export function orbitBotRun(n: number, level: SkillLevel, rev: number): { score: number; state: OrbitRev3State; flagged: boolean; events: unknown[] } {
  const seed = spec.seedForRev!(n, rev)!;
  const game = spec.gameFor(rev, seed);
  const out = bot({ game, seed, rev, human: new Human("orbit", seed, level), fixes: true });
  const events = out.events ?? [];
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as OrbitRev3State;
  const checkpoints: unknown[] = [];
  while (!s.ended && s.tick < orbitRev3Game.runTicks) {
    s = orbitRev3Game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 300 === 0) checkpoints.push(orbitCheckpoint(s as never));
  }
  const raw = encodeOrbitRun({ seed, claimedScore: orbitRev3Game.score(s), events, inputs: [], taps: [], endTick: s.tick, checkpoints } as never);
  const r = spec.replay(seed, raw, rev);
  return { score: r.score, state: r.state as OrbitRev3State, flagged: Boolean(r.flagged), events };
}

const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
const median = (xs: number[]) => sorted(xs)[Math.floor((xs.length - 1) / 2)] ?? 0;
const pct = (xs: number[], p: number) => sorted(xs)[Math.min(xs.length - 1, Math.floor(p * xs.length))] ?? 0;

if (import.meta.main) {
  console.log(`Orbit: ${SEEDS} room seeds a level, orbitRev 14 → orbitRev 15 (median (p10–p90); server replay)`);
  for (const level of LEVELS) {
    const old: number[] = [], now: number[] = [], slips: number[] = [], early: number[] = [];
    let flagged = 0;
    for (let n = 0; n < SEEDS; n++) {
      const a = orbitBotRun(n, level, ORBIT_REV_FUEL);
      const b = orbitBotRun(n, level, ORBIT_REV_GRACE);
      if (a.flagged || b.flagged) flagged++;
      old.push(a.score);
      now.push(b.score);
      slips.push(b.state.autoRespawns ?? 0);
      early.push(a.state.finished ? 90 : Math.round(a.state.endedTick / 60));
    }
    console.log(
      `${level.padEnd(8)} rev 14 ${median(old)} (${pct(old, 0.1)}–${pct(old, 0.9)}), ends at ${median(early)} s   ` +
        `rev 15 ${median(now)} (${pct(now, 0.1)}–${pct(now, 0.9)}), ${median(slips)} respawns${flagged ? `   ${flagged} flagged` : ""}`,
    );
  }
}
