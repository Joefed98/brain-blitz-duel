/** Lean orbitRev 3 stats: fallback hops, >120-unit sideways hops, bot completion ticks (rev3 proof bot vs classic careful bot).
 * Usage: bun scripts/orbit-rev3-quick-stats.ts <bank|random> <start> <end> */
import { buildCourse3, runRev3BotWithTaps, ORBIT_REV3_WORLD_W } from "../src/lib/arcade/orbitRev3";
import { orbitGame } from "../src/lib/arcade/orbit";
import { ORBIT_REV3_BANK } from "../src/lib/duel/orbitRev3Bank.server";

const [mode, a, b] = [process.argv[2], Number(process.argv[3]), Number(process.argv[4])];
const FP = 256;
const seeds =
  mode === "bank"
    ? ORBIT_REV3_BANK.slice(a, b).map((e) => e.seed)
    : Array.from({ length: b - a }, (_, i) => Number((BigInt(a + i + 1) * 2654435761n) % 2147483647n));
const ev = (t: number) => ({ t, k: 0, a: 0, b: 0, c: 0, d: 0 });
function classic(seed: number) {
  let s: any = orbitGame.init(seed);
  let g = 0;
  while (!orbitGame.isOver(s) && g++ < 20000) {
    let tap = false;
    if (s.flying === 0) {
      let p = orbitGame.step(s, ev(s.tick + 1) as any);
      while (p.flying > 0 && !orbitGame.isOver(p)) p = orbitGame.step(p, null);
      tap = p.cur > s.cur && p.ended === 0;
    }
    s = orbitGame.step(s, tap ? (ev(s.tick + 1) as any) : null);
  }
  return { ticks: s.tick, cur: s.cur };
}
const out: unknown[] = [];
for (const seed of seeds) {
  const { planets } = buildCourse3(seed, ORBIT_REV3_WORLD_W);
  const fb = (planets as any).__fallbacks ?? 0;
  let lat = 0;
  for (let i = 1; i < planets.length; i++) if (Math.abs(planets[i]!.x - planets[i - 1]!.x) / FP > 120) lat++;
  const bot = runRev3BotWithTaps(planets, ORBIT_REV3_WORLD_W);
  out.push({ seed, hops: planets.length - 1, fb, lat, r3: (bot.proof as any).ticks, r3ok: bot.proof.ok, old: classic(seed) });
}
console.log(JSON.stringify(out));
