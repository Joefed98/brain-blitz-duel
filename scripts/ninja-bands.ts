/**
 * Ricochet's skill bands (ricoRev 2, the ninja wall-climb; not a check): every level, weak → flawless, plus a random
 * tapper, plays room seeds n = FROM… (scripts/arcade-skill-bands/games.ts roomSeed) through the server's own encode +
 * replay path; prints each level's median score, parts and metres. `--from=10000` plays fresh seeds. The core's full
 * figure (NINJA_CORE_FULL_M) is the near-perfect level's median metres.
 *
 *   bun scripts/ninja-bands.ts [--seeds=40] [--from=0] [--levels=weak,near]
 */
import { ninjaCheckpoint, ninjaGame, ninjaStdParts, NINJA_CHECKPOINT_INTERVAL, NINJA_INPUT_TAP } from "../src/lib/arcade/ricochetNinja";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { encodeNinjaRun, replayNinjaRun } from "../src/lib/duel/ricochet";
import { ALL_LEVELS, Human, LEVEL_LABEL, type SkillLevel } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/ricochet";

const opt = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const SEEDS = Number(opt("seeds") ?? 40);
const FROM = Number(opt("from") ?? 0);
const LEVELS = (opt("levels")?.split(",") ?? ["random", ...ALL_LEVELS]) as (SkillLevel | "random")[];

export function roomSeed(n: number): number {
  let x = (n + 1) * 0x9e3779b1;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return ((x >>> 0) % 0x7ffffffe) + 1;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : Math.round((s[s.length / 2 - 1]! + s[s.length / 2]!) / 2)) : 0;
};

/** A random tapper: a tap every 10–60 ticks. */
function randomEvents(seed: number): ArcadeInputEvent[] {
  let x = seed | 1;
  const events: ArcadeInputEvent[] = [];
  for (let t = 5; t <= ninjaGame.runTicks; ) {
    events.push({ t, k: NINJA_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 });
    x = Math.imul(x ^ (x >>> 13), 0x5bd1e995) >>> 0;
    t += 10 + (x % 51);
  }
  return events;
}

export function playLevel(level: SkillLevel | "random", n: number) {
  const seed = roomSeed(n);
  const events = level === "random" ? randomEvents(seed) : (bot({ game: ninjaGame, seed, rev: 2, human: new Human("ricochet", seed, level), fixes: true }).events ?? []);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = ninjaGame.init(seed);
  const cps = [];
  while (!ninjaGame.isOver(s)) {
    s = ninjaGame.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % NINJA_CHECKPOINT_INTERVAL === 0) cps.push(ninjaCheckpoint(s));
  }
  const raw = encodeNinjaRun({ seed, claimedScore: ninjaGame.score(s), events, endTick: s.tick, checkpoints: cps });
  const r = replayNinjaRun(seed, raw);
  if (r.flagged) throw new Error(`flagged replay at ${level} n=${n}: ${r.reason}`);
  return { score: r.score, parts: Object.fromEntries((ninjaStdParts(r.state) ?? []).map((p) => [p.key, p.points])), metres: r.metres, hits: r.hits, coins: r.coins, lanterns: r.lanterns, scrolls: r.scrolls };
}

if (import.meta.main) {
  console.log(`Ricochet, ricoRev 2, ${SEEDS} seeds from n=${FROM}: medians`);
  console.log("| Level | Score | Height (130) | Coins (30) | Lanterns (20) | Scrolls (20) | Metres | Hits | Coins | Lanterns | Scrolls |");
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const level of LEVELS) {
    const t0 = performance.now();
    const runs = Array.from({ length: SEEDS }, (_, i) => playLevel(level, FROM + i));
    const m = (f: (r: (typeof runs)[number]) => number) => median(runs.map(f));
    console.log(`| ${level === "random" ? "Random" : LEVEL_LABEL[level]} | ${m((r) => r.score)} | ${m((r) => r.parts["core"] ?? 0)} | ${m((r) => r.parts["coins"] ?? 0)} | ${m((r) => r.parts["lanterns"] ?? 0)} | ${m((r) => r.parts["scrolls"] ?? 0)} | ${m((r) => r.metres)} | ${m((r) => r.hits)} | ${m((r) => r.coins)} | ${m((r) => r.lanterns)} | ${m((r) => r.scrolls)} |`);
    console.error(`${level}: ${((performance.now() - t0) / 1000).toFixed(1)} s, min score ${Math.min(...runs.map((r) => r.score))}`);
  }
}
