/**
 * Home Run's skill bands (not a check): every level, weak → flawless, plays the room seeds n = 0…59 (each the
 * proved deal's seed for the n-th room seed, scripts/arcade-skill-bands/games.ts roomSeed) through the server's own
 * encode + replay path; prints each level's median score and parts. `--from=10000` plays fresh seeds; `--rev=1` / `--rev=2`
 * measure homerunRev 1 / 2 on their own deals (default: rev 3, what rooms deal).
 *
 *   bun scripts/homerun-bands.ts [--seeds=60] [--from=0] [--rev=3]
 */
import { homerunCheckpoint, homerunGameFor, homerunStdParts, HOMERUN_REV_DEALT } from "../src/lib/arcade/homerun";
import { encodeHomerunRun, replayHomerunRun } from "../src/lib/duel/homerun";
import { homerunDealSeed } from "../src/lib/duel/homerunDeal.server";
import { homerunDealSeedV2 } from "../src/lib/duel/homerunDealV2.server";
import { homerunDealSeedV3 } from "../src/lib/duel/homerunDealV3.server";
import { ALL_LEVELS, Human, LEVEL_LABEL } from "./arcade-skill-bands/human";
import { bot, randomBot } from "./arcade-skill-bands/bots/homerun";

const opt = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const SEEDS = Number(opt("seeds") ?? 60);
const FROM = Number(opt("from") ?? 0);
const REV = Number(opt("rev") ?? HOMERUN_REV_DEALT);
const homerunGame = homerunGameFor(REV);

function roomSeed(n: number): number {
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

export function playLevel(level: (typeof ALL_LEVELS)[number] | "random", n: number) {
  const seed = REV >= 3 ? homerunDealSeedV3(roomSeed(n)) : REV >= 2 ? homerunDealSeedV2(roomSeed(n)) : homerunDealSeed(roomSeed(n));
  const human = new Human("homerun", seed, level === "random" ? "weak" : level);
  const out = (level === "random" ? randomBot : bot)({ game: homerunGame, seed, rev: REV, human, fixes: true });
  const events = out.events ?? [];
  const at = new Map(events.map((e) => [e.t, e]));
  let s = homerunGame.init(seed);
  const cps = [];
  while (!homerunGame.isOver(s)) {
    s = homerunGame.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 60 === 0) cps.push(homerunCheckpoint(s));
  }
  const raw = encodeHomerunRun({ seed, claimedScore: homerunGame.score(s), events, endTick: s.tick, checkpoints: cps });
  const r = replayHomerunRun(seed, raw, REV);
  if (r.flagged) throw new Error(`flagged replay at ${level} n=${n}: ${r.reason}`);
  return { score: r.score, parts: Object.fromEntries((homerunStdParts(r.state) ?? []).map((p) => [p.key, p.points])), feet: r.feet, homers: r.homers, signs: r.signs };
}

if (import.meta.main) {
  console.log(`Home Run, homerunRev ${REV}, ${SEEDS} seeds from n=${FROM}: medians`);
  console.log("| Level | Score | Distance (130) | Home runs (50) | Signs (20) | Avg ft / pitch | HR | Signs |");
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const level of ["random", ...ALL_LEVELS] as const) {
    const runs = Array.from({ length: SEEDS }, (_, i) => playLevel(level, FROM + i));
    const m = (f: (r: (typeof runs)[number]) => number) => median(runs.map(f));
    console.log(`| ${level === "random" ? "Random" : LEVEL_LABEL[level]} | ${m((r) => r.score)} | ${m((r) => r.parts["core"] ?? 0)} | ${m((r) => r.parts["homers"] ?? 0)} | ${m((r) => r.parts["signs"] ?? 0)} | ${Math.round(m((r) => r.feet) / 10)} | ${m((r) => r.homers)} | ${m((r) => r.signs)} |`);
  }
}
