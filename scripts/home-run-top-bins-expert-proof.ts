/**
 * The Expert proof for Home Run and Top Bins (16 Nov 2026, Joe: show a person-like player can score well on Expert, not
 * just finish, and list the Expert seeds to play). A measuring tool, not a check: plays the first `--seeds` seeds of each
 * game's Expert deal with the skill-band bots under human limits (about 0.25 s to react and 0.15 s to move,
 * HUMAN_LIMITS), scores every run through the server's replay, and prints a Markdown table (seed, near-perfect, elite,
 * what the elite run did) for docs/arcade-standard/homerun.md and freekick.md.
 *
 *   bun scripts/home-run-top-bins-expert-proof.ts [--seeds=10] [--game=homerun|freekick]
 */
import { homerunGameFor, HOMERUN_REV_5 } from "../src/lib/arcade/homerun";
import { freekickGameFor, FREEKICK_REV_DEALT } from "../src/lib/arcade/freekick";
import { HOMERUN_DEAL_V5 } from "../src/lib/duel/homerunDealV5.server";
import { FREEKICK_DEAL_V6 } from "../src/lib/duel/freekickDealV6.server";
import { replayHomerunRun } from "../src/lib/duel/homerun";
import { replayFreekickRun } from "../src/lib/duel/freekick";
import { Human, HUMAN_LIMITS, type SkillLevel } from "./arcade-skill-bands/human";
import { botV5 as hrBot } from "./arcade-skill-bands/bots/homerun";
import { botV5 as fkBot } from "./arcade-skill-bands/bots/freekick";
import { homerunCheckpoint } from "../src/lib/arcade/homerun";
import { freekickCheckpoint } from "../src/lib/arcade/freekick";
import { encodeHomerunRun } from "../src/lib/duel/homerun";
import { encodeFreekickRun } from "../src/lib/duel/freekick";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";

const opt = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const N = Number(opt("seeds") ?? 10);
const only = opt("game");
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function encode(game: "homerun" | "freekick", seed: number, events: ArcadeInputEvent[]): string {
  const g: any = game === "homerun" ? homerunGameFor(HOMERUN_REV_5, "expert") : freekickGameFor(FREEKICK_REV_DEALT, "expert"); // eslint-disable-line @typescript-eslint/no-explicit-any
  const at = new Map(events.map((e) => [e.t, e]));
  const checkpoints: unknown[] = [];
  let s = g.init(seed);
  while (!g.isOver(s)) {
    s = g.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 60 === 0) checkpoints.push(game === "homerun" ? homerunCheckpoint(s) : freekickCheckpoint(s));
  }
  const body = { seed, claimedScore: g.score(s), events, endTick: s.tick, checkpoints } as never;
  return game === "homerun" ? encodeHomerunRun(body) : encodeFreekickRun(body);
}

function play(game: "homerun" | "freekick", seed: number, skill: SkillLevel) {
  const human = new Human(game, seed, skill, HUMAN_LIMITS);
  if (game === "homerun") {
    const g = homerunGameFor(HOMERUN_REV_5, "expert");
    const raw = encode(game, seed, hrBot({ game: g, seed, rev: HOMERUN_REV_5, human }).events);
    const r = replayHomerunRun(seed, raw, HOMERUN_REV_5, "expert");
    const inn = r.state.inn!;
    return { score: r.score, note: `${count(inn.runs, "run")}, ${count(r.homers, "home run")}, ${count(inn.outs, "out")}` };
  }
  const g = freekickGameFor(FREEKICK_REV_DEALT, "expert");
  const raw = encode(game, seed, fkBot({ game: g, seed, rev: FREEKICK_REV_DEALT, human }).events);
  const r = replayFreekickRun(seed, raw, FREEKICK_REV_DEALT, "expert");
  return { score: r.score, note: `${r.goals} of 10 goals, ${count(r.targets, "target")}, best ${r.best} in a row` };
}

for (const game of (["homerun", "freekick"] as const).filter((g) => !only || g === only)) {
  const seeds = (game === "homerun" ? HOMERUN_DEAL_V5.expert : FREEKICK_DEAL_V6.expert).slice(0, N);
  const near: number[] = [];
  const elite: number[] = [];
  console.log(`\n${game === "homerun" ? "Home Run (homerunRev 5)" : "Top Bins (freekickRev 6)"} Expert, under human limits:\n`);
  console.log("| Seed | Near-perfect | Elite | The elite run |\n|---|---|---|---|");
  for (const seed of seeds) {
    const a = play(game, seed, "near");
    const b = play(game, seed, "elite");
    near.push(a.score);
    elite.push(b.score);
    console.log(`| ${seed} | ${a.score} | ${b.score} | ${b.note} |`);
  }
  const avg = (xs: number[]) => Math.round(xs.reduce((x, y) => x + y, 0) / xs.length);
  console.log(`| Average | ${avg(near)} | ${avg(elite)} | |`);
}
