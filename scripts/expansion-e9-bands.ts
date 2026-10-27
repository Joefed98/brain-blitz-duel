/**
 * Expansion E9 (26 Oct 2026, docs/expansions/e9.md): the tuning numbers for Rally rallyRev 10, Fission
 * burstRev 8 and Flightpath bullRev 8, from the skill-band bots (scripts/arcade-skill-bands/) through the
 * server's own encode + replay path. Every level plays the SAME seeds on the old revision (the band-3 one
 * rooms dealt before) and the new one, so the comparisons are paired.
 *
 *   bun scripts/expansion-e9-bands.ts [rally burst bullseye] [--set=tune|fresh|both] [--levels=weak,…,elite]
 *       [--jobs=4] [--json=out.json] [--off] [--random]
 *
 * Seed sets: "tune" is room seeds 0–59 (the ones the knots were fitted on), "fresh" is 10000–10199 (never seen
 * by the tuning). Reported per game and set: each level's median / top 10 % (90th percentile) on the new
 * revision with the old median in brackets; each feature's median payout per level (the skill check);
 * with --off, the new revision with the bots ignoring the features (what the features add on the same
 * seeds); with --random, random play on the new revision. The perfect-play ceiling per seed is
 * scripts/expansion-e9-ceiling.ts.
 *
 * A tuning tool, not a check (no pass/fail; CI never runs it).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { UNITS } from "./arcade-skill-bands/units";
import { ALL_LEVELS, Human, LEVEL_LABEL, type SkillLevel } from "./arcade-skill-bands/human";
import type { SkillBot } from "./arcade-skill-bands/bot";
import { ARCADE_INPUT_DRAG } from "../src/lib/arcade/engine";
import { rallyBonusPoints, RALLY_REV_BONUS, RALLY_REV_STRICT, RALLY_V10_W, type RallyState } from "../src/lib/arcade/rally";
import { burstCleanBonus, BURST_INPUT_FIRE, BURST_INPUT_MOVE, BURST_REV_CLEAN, BURST_REV_STRICT, BURST_WORLD_W, type BurstState } from "../src/lib/arcade/burst";
import { bullseyeBoard, bullseyeDeadPoints, bullseyeRingValues, bullseyeStreakPoints, BULLSEYE_CX, BULLSEYE_OUTER_R, BULLSEYE_RINGS, BULLSEYE_INPUT_SHOT, BULLSEYE_REV_EXPAND, BULLSEYE_REV_STRICT, BULLSEYE_V_MAX, type BullseyeState } from "../src/lib/arcade/bullseye";
import { rallyBotOptions } from "./arcade-skill-bands/bots/rally";
import { burstBotOptions } from "./arcade-skill-bands/bots/burst";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SET = (opt("set") ?? "both") as "tune" | "fresh" | "both";
const LEVEL_LIST = (opt("levels")?.split(",") ?? [...ALL_LEVELS]) as SkillLevel[];
const JOBS = Number(opt("jobs") ?? Math.max(1, cpus().length - 1));
const JSON_PATH = opt("json");
const OFF = args.includes("--off");
const RANDOM = args.includes("--random");
const CHILD = args.includes("--child");
const ONLY = args.filter((a) => !a.startsWith("--"));

export const TUNE_SEEDS = Array.from({ length: 60 }, (_, i) => i);
/** Fresh seeds: the band tool's (docs/arcade-bands-elite.md), n = 10000–10199, never used for tuning by anyone. */
export const FRESH_SEEDS = Array.from({ length: 200 }, (_, i) => 10000 + i);

interface Feature {
  name: string;
  pay: (s: any) => number;
}
export interface E9Game {
  type: "rally" | "burst" | "bullseye";
  old: number;
  rev: number;
  features: (on: boolean) => void;
  /** Each feature's payout (the base is the score less these). */
  feats: Feature[];
  random: (seed: number) => SkillBot;
}

/** Flightpath's features are where a dart lands, not a choice of play: nothing to switch off. */
const bullseyeFeatures = { on: true };

/** Plain pseudo-random numbers for the random player (script only). */
function rand(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const E9_GAMES: E9Game[] = [
  {
    type: "rally",
    old: RALLY_REV_STRICT,
    rev: RALLY_REV_BONUS,
    features: (on) => (rallyBotOptions.features = on),
    feats: [{ name: "gold target", pay: (s: RallyState) => rallyBonusPoints(s) }],
    // A random finger: a new spot every half second or so.
    random: (seed) => ({ game }) => {
      const r = rand(seed ^ 0x1234);
      const events: any[] = [];
      for (let t = 1; t < game.runTicks; t += 10 + Math.floor(r() * 40)) events.push({ t, k: ARCADE_INPUT_DRAG, a: Math.floor(r() * RALLY_V10_W), b: 0, c: 0, d: 0 });
      return { events };
    },
  },
  {
    type: "burst",
    old: BURST_REV_STRICT,
    rev: BURST_REV_CLEAN,
    features: (on) => (burstBotOptions.features = on),
    feats: [
      { name: "clean wave", pay: (s: BurstState) => burstCleanBonus(s).clean },
      { name: "fast wave", pay: (s: BurstState) => burstCleanBonus(s).clear },
      { name: "golden atom", pay: (s: BurstState) => burstCleanBonus(s).gold },
    ],
    // Random arrows and random taps.
    random: (seed) => ({ game }) => {
      const r = rand(seed ^ 0x5678);
      const events: any[] = [];
      let flip = 0;
      for (let t = 1; t < game.runTicks; t += 5 + Math.floor(r() * 30)) {
        if (r() < 0.5) events.push({ t, k: BURST_INPUT_FIRE, a: 0, b: (flip ^= 1), c: 0, d: 0 });
        else events.push({ t, k: BURST_INPUT_MOVE, a: Math.floor(r() * BURST_WORLD_W), b: 0, c: 0, d: 0 });
      }
      return { events };
    },
  },
  {
    type: "bullseye",
    old: BULLSEYE_REV_STRICT,
    rev: BULLSEYE_REV_EXPAND,
    features: (on) => (bullseyeFeatures.on = on),
    feats: [
      { name: "bull streak", pay: (s: BullseyeState) => bullseyeStreakPoints(s) },
      { name: "dead-centre", pay: (s: BullseyeState) => bullseyeDeadPoints(s) },
    ],
    // Random flicks at random moments.
    random: (seed) => ({ game }) => {
      const r = rand(seed ^ 0x9abc);
      const events: any[] = [];
      for (let t = 30; t < game.runTicks; t += 40 + Math.floor(r() * 150)) events.push({ t, k: BULLSEYE_INPUT_SHOT, a: Math.floor((r() * 2 - 1) * BULLSEYE_V_MAX), b: -Math.floor(r() * BULLSEYE_V_MAX), c: 0, d: 0 });
      return { events };
    },
  },
];

async function loadBot(type: string): Promise<SkillBot> {
  return (await import(new URL(`./arcade-skill-bands/bots/${type}.ts`, import.meta.url).href)).bot as SkillBot;
}

export interface E9Run {
  type: string;
  which: "old" | "new" | "off" | "random";
  level: SkillLevel | "random";
  n: number;
  seed: number;
  score: number;
  base: number;
  /** The run's curve units (scripts/arcade-skill-bands/units.ts) and a few raw counts for tuning. */
  units: number;
  raw: Record<string, number>;
  feats: Record<string, number>;
  /** Flightpath only: each bull's distance from the board's centre in bull radii (on darts whose centre is the 10). */
  bullR?: number[];
  mismatch: boolean;
}

/** One run through the server's encode + replay path; only the replayed score counts. */
export function playE9(g: E9Game, bot: SkillBot, which: E9Run["which"], level: SkillLevel | "random", n: number): E9Run {
  const spec = GAME_BY_TYPE.get(g.type)!;
  const seed = spec.seedFor(n);
  const rev = which === "old" ? g.old : g.rev;
  const game = spec.gameFor(rev, seed);
  const human = new Human(g.type, seed, level === "random" ? "average" : level);
  // The band tool's fixed bots (BotCtx.fixes, docs/arcade-bands-elite.md) on both revisions, so "before" is like for like.
  const out = bot({ game, seed, rev, human, fixes: true });
  let state = game.init(seed);
  const byTick = new Map((out.events ?? []).map((e) => [e.t, e]));
  const checkpoints: unknown[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    state = game.step(state, byTick.get(state.tick + 1) ?? null);
    if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
  }
  const score = game.score(state);
  const encoded = spec.encode({ seed, claimedScore: score, events: out.events ?? [], endTick: state.tick, checkpoints }, rev, seed);
  const result = spec.replay(seed, encoded, rev);
  const feats: Record<string, number> = {};
  if (which !== "old") for (const f of g.feats) feats[f.name] = f.pay(result.state);
  const st = result.state;
  const raw: Record<string, number> =
    g.type === "rally" ? { gold: st.goldHits, pads: st.targetHits ?? 0, hits: st.hits, dead: st.dead ? 1 : 0, end: st.endedTick }
    : g.type === "burst" ? { hits: st.hits, lost: 3 - st.lives, cleared: st.cleared, wave: st.wave, clean: st.cleanWaves ?? 0, ended: st.ended }
    : { total: st.total, bulls: st.hits.filter((h: any) => h.ring >= 0 && h.value - (h.bal ?? 0) >= 10).length, darts: st.arrowIndex, dead: st.dead ?? 0, streakPts: st.streakPts ?? 0 };
  const bullR =
    g.type === "bullseye" && which !== "old"
      ? st.hits
          .filter((h: any) => h.ring === 0 && bullseyeRingValues(st, h.arrow)[0] === 10)
          .map((h: any) => {
            const b = bullseyeBoard(st, h.arrow);
            const bullR = (BULLSEYE_OUTER_R * b.scalePct) / 100 / BULLSEYE_RINGS;
            return Math.round((Math.hypot(h.x - h.tdx - BULLSEYE_CX, h.y - b.cy) / bullR) * 1000) / 1000;
          })
      : undefined;
  return { type: g.type, which, level, n, seed, score: result.score, bullR, base: which === "old" ? result.score : result.score - Object.values(feats).reduce((a, b) => a + b, 0), units: UNITS[g.type]?.(st).u ?? 0, raw, feats, mismatch: result.score !== score || Boolean(result.flagged) };
}

const seedsFor = (set: string) => (set === "tune" ? TUNE_SEEDS : set === "fresh" ? FRESH_SEEDS : [...TUNE_SEEDS, ...FRESH_SEEDS]);

async function childMain(type: string, level: string): Promise<void> {
  const g = E9_GAMES.find((x) => x.type === type)!;
  const bot = await loadBot(type);
  const runs: E9Run[] = [];
  const seeds = seedsFor(SET);
  if (level === "random") {
    for (const n of seeds) {
      const seed = GAME_BY_TYPE.get(g.type)!.seedFor(n);
      runs.push(playE9(g, g.random(seed), "random", "random", n));
    }
  } else {
    for (const n of seeds) {
      g.features(true);
      runs.push(playE9(g, bot, "old", level as SkillLevel, n));
      runs.push(playE9(g, bot, "new", level as SkillLevel, n));
      if (OFF) {
        g.features(false);
        runs.push(playE9(g, bot, "off", level as SkillLevel, n));
        g.features(true);
      }
    }
  }
  process.stdout.write(`@@RESULT${JSON.stringify(runs)}\n`);
}

const pct = (xs: number[], p: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))]!;
};

export function summariseE9(runs: E9Run[]): string[] {
  const lines: string[] = [];
  const sets: [string, number[]][] = SET === "both" ? [["tune", TUNE_SEEDS], ["fresh", FRESH_SEEDS]] : [[SET, seedsFor(SET)]];
  for (const g of E9_GAMES) {
    const mine = runs.filter((r) => r.type === g.type);
    if (!mine.length) continue;
    for (const [set, seeds] of sets) {
      const inSet = mine.filter((r) => seeds.includes(r.n));
      lines.push(`\n${g.type} · ${set} seeds (${seeds.length})`);
      lines.push(`| Level | New median / top 10 % (old median) | Change | Base | ${g.feats.map((f) => f.name).join(" | ")} |${OFF ? " Features off |" : ""}`);
      lines.push(`|---|---|---|---|${g.feats.map(() => "---|").join("")}${OFF ? "---|" : ""}`);
      for (const level of LEVEL_LIST) {
        const of = (which: string) => inSet.filter((r) => r.level === level && r.which === which);
        const nw = of("new").map((r) => r.score);
        const old = of("old").map((r) => r.score);
        if (!nw.length) continue;
        const change = Math.round(((pct(nw, 50) - pct(old, 50)) / Math.max(1, pct(old, 50))) * 100);
        const feats = g.feats.map((f) => String(pct(of("new").map((r) => r.feats[f.name] ?? 0), 50)));
        const off = OFF ? ` ${pct(of("off").map((r) => r.score), 50)} |` : "";
        lines.push(`| ${LEVEL_LABEL[level]} | ${pct(nw, 50)} / ${pct(nw, 90)} (${pct(old, 50)}) | ${change >= 0 ? "+" : ""}${change} % | ${pct(of("new").map((r) => r.base), 50)} | ${feats.join(" | ")} |${off}`);
      }
      const rnd = inSet.filter((r) => r.which === "random").map((r) => r.score);
      if (rnd.length) lines.push(`Random play: median ${pct(rnd, 50)}, top 10 % ${pct(rnd, 90)}, best ${Math.max(...rnd)}`);
      const zero = inSet.filter((r) => (r.level === "weak" || r.level === "average") && r.which === "new" && r.score === 0).length;
      lines.push(`Weak and average runs scoring 0: ${zero}`);
      const bad = inSet.filter((r) => r.mismatch).length;
      if (bad) lines.push(`WARNING: ${bad} runs disagree with the server replay or were flagged`);
    }
  }
  return lines;
}

async function main(): Promise<void> {
  if (CHILD) return childMain(opt("game")!, opt("level")!);
  const jobs: [string, string][] = [];
  for (const g of E9_GAMES) {
    if (ONLY.length && !ONLY.includes(g.type)) continue;
    for (const level of LEVEL_LIST) jobs.push([g.type, level]);
    if (RANDOM) jobs.push([g.type, "random"]);
  }
  const runs: E9Run[] = [];
  const queue = [...jobs];
  const pass = args.filter((a) => a.startsWith("--set=") || a === "--off");
  const worker = async () => {
    while (queue.length) {
      const [type, level] = queue.shift()!;
      const t0 = performance.now();
      const got = await new Promise<E9Run[]>((resolve) => {
        const child = spawn("bun", [process.argv[1]!, "--child", `--game=${type}`, `--level=${level}`, ...pass], { stdio: ["ignore", "pipe", "inherit"] });
        let out = "";
        child.stdout.on("data", (d) => (out += d));
        child.on("close", () => {
          const line = out.split("\n").find((l) => l.startsWith("@@RESULT"));
          resolve(line ? (JSON.parse(line.slice(8)) as E9Run[]) : []);
        });
      });
      runs.push(...got);
      console.error(`${type} ${level}: ${got.length} runs in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(JOBS, jobs.length) }, worker));
  const lines = summariseE9(runs);
  console.log(lines.join("\n"));
  if (JSON_PATH) writeFileSync(JSON_PATH, JSON.stringify({ set: SET, runs }, null, 0));
}

if (import.meta.main) await main();
