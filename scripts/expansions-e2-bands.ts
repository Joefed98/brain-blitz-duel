/**
 * Expansion E2 (25 Oct 2026, docs/expansions/e2.md): old versus new score distributions for Meteor
 * and Tempo, from the skill-band bots (scripts/arcade-skill-bands/) through the server's own
 * encode + replay path. Three columns per game and level:
 *   - old: the revision rooms dealt before the expansion (snakeRev 8, beatRev 8);
 *   - today's play: the new revision with the bot ignoring the new features (where a solid player of
 *     today lands; the expansion aims to keep this within about ±10 % of "old");
 *   - new: the new revision with the bot using the features at its skill level.
 * Each shows the median, the top 10 % (90th percentile) and the best of the runs.
 *
 *   bun scripts/expansions-e2-bands.ts [snake beat] [--seeds=30] [--levels=average,near] [--json=out.json] [--md]
 *
 * A tuning tool, not a check (no pass/fail; CI never runs it).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { writeFileSync } from "node:fs";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, LEVELS, type SkillLevel } from "./arcade-skill-bands/human";
import type { SkillBot } from "./arcade-skill-bands/bot";
import { SNAKE_REV_STRICT, SNAKE_REV_200 } from "../src/lib/arcade/snake";
import { BEAT_REV_STRICT, BEAT_REV_200 } from "../src/lib/arcade/beat";
import { snakeBotOptions } from "./arcade-skill-bands/bots/snake";
import { beatBotOptions } from "./arcade-skill-bands/bots/beat";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 30);
const LEVEL_LIST = (opt("levels")?.split(",") ?? [...LEVELS]) as SkillLevel[];
const ONLY = args.filter((a) => !a.startsWith("--"));
const GAMES = [
  { type: "snake", old: SNAKE_REV_STRICT, rev: SNAKE_REV_200, features: (on: boolean) => (snakeBotOptions.features = on) },
  { type: "beat", old: BEAT_REV_STRICT, rev: BEAT_REV_200, features: (on: boolean) => (beatBotOptions.features = on) },
].filter((g) => ONLY.length === 0 || ONLY.includes(g.type));

function play(type: string, rev: number, level: SkillLevel, n: number, bot: SkillBot): { score: number; mismatch: boolean; state: any } {
  const spec = GAME_BY_TYPE.get(type as never)!;
  const seed = spec.seedFor(n);
  const game = spec.gameFor(rev, seed);
  const out = bot({ game, seed, rev, human: new Human(type, seed, level) });
  let state = game.init(seed);
  const byTick = new Map((out.events ?? []).map((e) => [e.t, e]));
  const checkpoints: unknown[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    state = game.step(state, byTick.get(state.tick + 1) ?? null);
    if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
  }
  const score = game.score(state);
  const raw = spec.encode({ seed, claimedScore: score, events: out.events ?? [], endTick: state.tick, checkpoints }, rev, seed);
  const result = spec.replay(seed, raw, rev);
  return { score: result.score, mismatch: result.score !== score || Boolean(result.flagged), state: result.state };
}

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))]!;
};
const stats = (xs: number[]) => ({ median: pct(xs, 50), top10: pct(xs, 90), best: Math.max(...xs) });

const report: Record<string, any> = {};
const lines: string[] = [];
for (const g of GAMES) {
  const bot = (await import(`./arcade-skill-bands/bots/${g.type}.ts`)).bot as SkillBot;
  report[g.type] = {};
  lines.push(`\n### ${g.type} (old rev ${g.old} → new rev ${g.rev}, ${SEEDS} seeds)\n`);
  lines.push("| Level | Old (median / top 10 % / best) | New, today's play | New, using the features |");
  lines.push("|---|---|---|---|");
  const all: number[] = [];
  for (const level of LEVEL_LIST) {
    const cols: Record<string, number[]> = { old: [], today: [], next: [] };
    let mismatches = 0;
    for (let n = 0; n < SEEDS; n++) {
      g.features(true);
      const o = play(g.type, g.old, level, n, bot);
      g.features(false);
      const t = play(g.type, g.rev, level, n, bot);
      g.features(true);
      const x = play(g.type, g.rev, level, n, bot);
      cols.old!.push(o.score);
      cols.today!.push(t.score);
      cols.next!.push(x.score);
      all.push(x.score);
      mismatches += Number(o.mismatch) + Number(t.mismatch) + Number(x.mismatch);
    }
    const f = (xs: number[]) => {
      const s = stats(xs);
      return `${s.median} / ${s.top10} / ${s.best}`;
    };
    report[g.type][level] = { old: stats(cols.old!), today: stats(cols.today!), next: stats(cols.next!), mismatches };
    lines.push(`| ${level} | ${f(cols.old!)} | ${f(cols.today!)} | ${f(cols.next!)} |${mismatches ? ` ${mismatches} replay mismatches!` : ""}`);
    console.error(`${g.type} ${level}: old ${f(cols.old!)} · today ${f(cols.today!)} · new ${f(cols.next!)}${mismatches ? ` · ${mismatches} MISMATCH` : ""}`);
  }
  report[g.type].allNew = stats(all);
}
console.log(lines.join("\n"));
const json = opt("json");
if (json) writeFileSync(json, JSON.stringify(report, null, 2));
