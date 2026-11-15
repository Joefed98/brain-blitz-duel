/**
 * Crazy Golf golfRev 3's level measurement (the Crazy Golf overhaul, 15 Nov 2026): the golfRev 3 bot
 * (scripts/arcade-skill-bands/bots/minigolfV3.ts, human limits from scripts/arcade-skill-bands/human.ts) plays
 * courses dealt from the hole bank exactly as the server deals them (one hole per slot, each level's pars), every run
 * scored through the server's replay. Prints, per level and skill, the median and mean score, how many runs hole all
 * five and the median time to finish them (what Speed's "full by" is set from).
 *
 *   bun scripts/crazy-golf-levels.ts [--levels=easy,normal,hard,expert] [--skills=good,great,near,elite] [--courses=40] [--jobs=4] [--json=<path>]
 *
 * A tool, not a check; docs/arcade-standard/minigolf.md "golfRev 3" holds the numbers it printed.
 */
import { writeFileSync } from "node:fs";
import { minigolfCheckpoint, minigolfGameFor, MG_LEVEL_NAMES, MINIGOLF_REV_COURSE, type MgLevel } from "../src/lib/arcade/minigolf";
import { encodeSportsRun, SPORTS_CHECKPOINT_INTERVAL } from "../src/lib/arcade/sportsKit";
import { replayMinigolfRun } from "../src/lib/duel/minigolf";
import { MINIGOLF_HOLES_BANK } from "../src/lib/duel/minigolfHolesBank.server";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";
import { botV3 } from "./arcade-skill-bands/bots/minigolfV3";

const args = process.argv.slice(2);
const arg = (k: string, d: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const LEVELS = arg("levels", "easy,normal,hard,expert").split(",") as MgLevel[];
const SKILLS = arg("skills", "good,great,near,elite").split(",") as SkillLevel[];
const COURSES = Number(arg("courses", "40"));
const JOBS = Number(arg("jobs", "4"));
const FROM = Number(arg("from", "0"));

/** A fixed course for index n: one hole per slot, picked by a fixed spread (the server picks by its CSPRNG). */
export function courseFor(n: number): number[] {
  return MINIGOLF_HOLES_BANK.map((slot, i) => {
    let x = Math.imul((n + 1) * 2654435761 + i * 40503, 0x7feb352d) >>> 0;
    x ^= x >>> 15;
    return slot[(x >>> 0) % slot.length]!.id;
  });
}
export function parsFor(holes: readonly number[], level: MgLevel): number[] {
  const at = MG_LEVEL_NAMES.indexOf(level);
  return holes.map((id, i) => MINIGOLF_HOLES_BANK[i]!.find((e) => e.id === id)!.pars[at]!);
}

interface Row {
  level: MgLevel;
  skill: SkillLevel;
  n: number;
  score: number;
  holed: number;
  finish: number;
  chips: number;
}

function play(level: MgLevel, skill: SkillLevel, n: number): Row {
  const holes = courseFor(n);
  const pars = parsFor(holes, level);
  const game = minigolfGameFor(pars, MINIGOLF_REV_COURSE, { holes, level });
  const seed = 1000 + n;
  const human = new Human("minigolf", seed * 7 + MG_LEVEL_NAMES.indexOf(level), skill);
  const { events, state } = botV3({ game, seed, rev: MINIGOLF_REV_COURSE, human }) as { events: never[]; state: never };
  // Score through the server's replay (checkpoints as the phone makes them).
  let s = game.init(seed);
  const cps = [];
  const byT = new Map((events as { t: number }[]).map((e) => [e.t, e]));
  while (!game.isOver(s)) {
    s = game.step(s, (byT.get(s.tick + 1) as never) ?? null);
    if (s.tick % SPORTS_CHECKPOINT_INTERVAL === 0) cps.push(minigolfCheckpoint(s));
  }
  void state;
  const raw = encodeSportsRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints: cps });
  const r = replayMinigolfRun(seed, raw, pars, MINIGOLF_REV_COURSE, { holes, level });
  return { level, skill, n, score: r.flagged ? -1 : r.score, holed: r.holed, finish: r.state.finishTick, chips: r.state.chips };
}

const median = (v: number[]) => {
  const a = [...v].sort((x, y) => x - y);
  return a.length ? (a.length % 2 ? a[(a.length - 1) / 2]! : (a[a.length / 2 - 1]! + a[a.length / 2]!) / 2) : NaN;
};

if (import.meta.main && args.includes("--child")) {
  const part = Number(arg("part", "0"));
  let k = 0;
  for (const level of LEVELS) for (const skill of SKILLS) for (let n = FROM; n < FROM + COURSES; n++) if (k++ % JOBS === part) console.log(JSON.stringify(play(level, skill, n)));
} else if (import.meta.main) {
  const started = Date.now();
  const outs = await Promise.all(
    Array.from({ length: JOBS }, async (_, part) => {
      const proc = Bun.spawn(["bun", new URL(import.meta.url).pathname, "--child", `--part=${part}`, ...args.filter((a) => !a.startsWith("--json"))], { stdout: "pipe", stderr: "inherit" });
      return await new Response(proc.stdout).text();
    }),
  );
  const rows = outs.flatMap((o) => o.split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l) as Row));
  console.log(`level    skill   median  mean   all-holed  finish(median s)  chips/run  flagged`);
  for (const level of LEVELS)
    for (const skill of SKILLS) {
      const r = rows.filter((x) => x.level === level && x.skill === skill);
      const sc = r.map((x) => x.score);
      const fin = r.filter((x) => x.holed === 5 && x.finish > 0).map((x) => x.finish / 60);
      console.log(
        `${level.padEnd(8)} ${skill.padEnd(7)} ${String(median(sc)).padStart(6)} ${(sc.reduce((a, b) => a + b, 0) / sc.length).toFixed(1).padStart(6)}   ${String(r.filter((x) => x.holed === 5).length).padStart(3)}/${r.length}      ${median(fin).toFixed(1).padStart(6)}           ${(r.reduce((a, x) => a + x.chips, 0) / r.length).toFixed(1).padStart(4)}     ${r.filter((x) => x.score < 0).length}`,
      );
    }
  const json = args.find((a) => a.startsWith("--json="))?.slice(7);
  if (json) writeFileSync(json, JSON.stringify(rows));
  console.log(`${rows.length} runs in ${((Date.now() - started) / 1000).toFixed(0)} s`);
}
