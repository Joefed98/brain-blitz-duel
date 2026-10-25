/**
 * Rainbow Bridge Expansion E1 bands (a tool, not a check): the skill-band bot
 * (scripts/arcade-skill-bands/bots/inkbridge.ts) plays the same room seeds on inkRev 8
 * (the revision rooms dealt before the expansion) and inkRev 9, with and without the new
 * features (INK_BOT_FEATURES=0 runs in a child process, so the bot's switch is read fresh),
 * every run scored through the server's replay. Prints median / top 10 % / best per level.
 *
 *   bun scripts/ink-expand-bands.ts [--seeds=80] [--which=old,new,newoff] [--json=<path>]
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { inkBridgeGameFor, inkCheckpoint, INK_REV_EXPAND, INK_REV_STRICT, type InkState } from "../src/lib/arcade/inkBridge";
import { encodeInkBridgeRun, replayInkBridgeRun } from "../src/lib/duel/inkBridge";
import { GAMES } from "./arcade-skill-bands/games";
import { Human, LEVELS, type SkillLevel } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/inkbridge";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 80);
const WHICH = (opt("which") ?? "old,new,newoff").split(",");
const spec = GAMES.find((g) => g.type === "inkbridge")!;

type Row = { which: string; level: SkillLevel; seed: number; score: number; levels: number; stars: number; tricks: number };

function play(rev: number, level: SkillLevel, seed: number): Omit<Row, "which"> {
  const game = inkBridgeGameFor(rev);
  const out = bot({ game, seed, rev, human: new Human("inkbridge", seed, level) });
  let state = game.init(seed) as InkState;
  const events = out.events ?? [];
  const byTick = new Map(events.map((e) => [e.t, e]));
  const checkpoints: unknown[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    state = game.step(state, byTick.get(state.tick + 1) ?? null);
    if (state.tick % 300 === 0) checkpoints.push(inkCheckpoint(state));
  }
  const raw = encodeInkBridgeRun({ seed, claimedScore: game.score(state), events, endTick: state.tick, checkpoints: checkpoints as never });
  const r = replayInkBridgeRun(seed, raw, rev);
  if (r.flagged || r.score !== game.score(state)) throw new Error(`replay disagreed on seed ${seed}`);
  return { level, seed, score: r.score, levels: r.levels, stars: r.stars, tricks: r.tricks };
}

const q = (v: number[], p: number) => {
  const s = [...v].sort((a, b) => a - b);
  const pos = (s.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, s.length - 1);
  return Math.round(s[lo]! + (s[hi]! - s[lo]!) * (pos - lo));
};

if (args.includes("--child")) {
  const which = opt("child-which")!;
  const rows: Row[] = [];
  for (const level of LEVELS)
    for (let n = 0; n < SEEDS; n++) rows.push({ which, ...play(which === "old" ? INK_REV_STRICT : INK_REV_EXPAND, level, spec.seedFor(n)) });
  process.stdout.write(`@@ROWS${JSON.stringify(rows)}\n`);
} else {
  const all: Row[] = [];
  const children = WHICH.map((which) => ({ which, env: { ...process.env, INK_BOT_FEATURES: which === "newoff" ? "0" : "1" } }));
  // One child per measurement, in parallel.
  const results = await Promise.all(
    children.map(
      (c) =>
        new Promise<Row[]>((resolve, reject) => {
          const child = spawn("bun", [process.argv[1]!, "--child", `--child-which=${c.which}`, `--seeds=${SEEDS}`], { env: c.env, stdio: ["ignore", "pipe", "inherit"] });
          let out = "";
          child.stdout.on("data", (d) => (out += d));
          child.on("close", () => {
            const line = out.split("\n").find((l) => l.startsWith("@@ROWS"));
            if (line) resolve(JSON.parse(line.slice(6)) as Row[]);
            else reject(new Error(`${c.which}: no result`));
          });
        }),
    ),
  );
  for (const rows of results) all.push(...rows);
  const label: Record<string, string> = { old: "inkRev 8 (before)", new: "inkRev 9, features", newoff: "inkRev 9, no features" };
  console.log(`${SEEDS} seeds per level; median / top 10 % (p90) / best; levels potted (median); stars, trick shots (mean)`);
  for (const level of LEVELS) {
    for (const which of WHICH) {
      const r = all.filter((x) => x.which === which && x.level === level);
      const sc = r.map((x) => x.score);
      const mean = (f: (x: Row) => number) => (r.reduce((a, x) => a + f(x), 0) / Math.max(1, r.length)).toFixed(2);
      console.log(`${level.padEnd(8)} ${label[which]!.padEnd(24)} ${String(q(sc, 0.5)).padStart(4)} ${String(q(sc, 0.9)).padStart(4)} ${String(Math.max(...sc)).padStart(4)}   levels ${q(r.map((x) => x.levels), 0.5)}   stars ${mean((x) => x.stars)} tricks ${mean((x) => x.tricks)}`);
    }
  }
  const json = opt("json");
  if (json) writeFileSync(json, JSON.stringify(all));
}
