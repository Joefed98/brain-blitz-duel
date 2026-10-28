/**
 * Pinball pinRev 5 (27 Oct 2026, docs/phone-notes-oct-2026/pinball.md): the skill-band bots (with the Oct 2026
 * fixes, as scripts/arcade-skill-bands.ts plays them) play the 90-second table, and each run's log is replayed
 * through the server's own path twice: as pinRev 5 (the new score) and as pinRev 4 (the same log stops at
 * 60 s: pinRev 5 plays pinRev 4 tick for tick, and the bots read no clock, so this is exactly the run the bot
 * plays on pinRev 4, the "before"). Prints each level's medians, and with --json saves every run (table points
 * included, which the curve fit reads).
 *
 *   bun scripts/pinball-90-bands.ts [--seeds=60] [--from=0] [--levels=all|weak,good] [--json=out.json]
 *
 * A tool, not a check (no pass/fail; not run by run-checks or CI).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { writeFileSync } from "node:fs";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { ALL_LEVELS, Human, LEVELS, LEVEL_LABEL, type SkillLevel } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/pinball";
import { encodePinballRun, replayPinballRun } from "../src/lib/duel/pinball";
import { PIN_REV_EXPAND, PIN_REV_LONG, PIN_RUN_TICKS } from "../src/lib/arcade/pinball";
import { pin4Checkpoint, pinball5Game } from "../src/lib/arcade/pinball4";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 60);
const FROM = Number(opt("from") ?? 0);
const LEVEL_LIST = (opt("levels") === "all" ? [...ALL_LEVELS] : (opt("levels")?.split(",") ?? [...LEVELS])) as SkillLevel[];
const JSON_PATH = opt("json");

export interface Pin90Run {
  level: SkillLevel;
  n: number;
  seed: number;
  before: number;
  after: number;
  pointsBefore: number;
  pointsAfter: number;
  endedBefore: number;
  endedAfter: number;
  flagged: boolean;
}

const spec = GAME_BY_TYPE.get("pinball")!;
const quietly = <T>(fn: () => T): T => {
  const { error, log } = console;
  console.error = () => {};
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.error = error;
    console.log = log;
  }
};

function playOne(level: SkillLevel, n: number): Pin90Run {
  const seed = spec.seedFor(n);
  const game = pinball5Game as any;
  const human = new Human("pinball", seed, level);
  const out = bot({ game, seed, rev: PIN_REV_LONG, human, fixes: true });
  const events = out.events ?? [];
  const byTick = new Map(events.map((e) => [e.t, e]));
  let state = game.init(seed);
  const checkpoints: unknown[] = [];
  while (!game.isOver(state)) {
    state = game.step(state, byTick.get(state.tick + 1) ?? null);
    if (state.tick % 300 === 0) checkpoints.push(pin4Checkpoint(state));
  }
  const raw = encodePinballRun({ seed, claimedScore: game.score(state), events, endTick: state.tick, checkpoints: checkpoints as any });
  const after = quietly(() => replayPinballRun(seed, raw, PIN_REV_LONG));
  // pinRev 4 replays the log's first 60 s (only the score and state are read: its checkpoints carry pinRev 5's flag).
  // The phone's pinRev 4 log is the same log cut at 60 s.
  const raw4 = encodePinballRun({ seed, claimedScore: 0, events: events.filter((e) => e.t <= PIN_RUN_TICKS), endTick: Math.min(state.tick, PIN_RUN_TICKS), checkpoints: [] });
  const before = quietly(() => replayPinballRun(seed, raw4, PIN_REV_EXPAND));
  return {
    level,
    n,
    seed,
    before: before.score,
    after: after.score,
    pointsBefore: before.state.points,
    pointsAfter: after.state.points,
    endedBefore: before.replayTick,
    endedAfter: after.replayTick,
    flagged: after.flagged,
  };
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)]! : 0;
};
const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))]! : 0;
};

const runs: Pin90Run[] = [];
for (const level of LEVEL_LIST) {
  const started = performance.now();
  for (let n = FROM; n < FROM + SEEDS; n++) runs.push(playOne(level, n));
  const mine = runs.filter((r) => r.level === level);
  const b = mine.map((r) => r.before), a = mine.map((r) => r.after);
  console.log(
    `${LEVEL_LABEL[level].padEnd(13)} before ${median(b)} (${pct(b, 0.1)}–${pct(b, 0.9)})  after ${median(a)} (${pct(a, 0.1)}–${pct(a, 0.9)})  points ${median(mine.map((r) => r.pointsBefore))} → ${median(mine.map((r) => r.pointsAfter))}  zeros ${a.filter((x) => x === 0).length}  flagged ${mine.filter((r) => r.flagged).length}  ${((performance.now() - started) / 1000).toFixed(0)} s`,
  );
}
if (JSON_PATH) writeFileSync(JSON_PATH, JSON.stringify({ seeds: SEEDS, from: FROM, runs }));
