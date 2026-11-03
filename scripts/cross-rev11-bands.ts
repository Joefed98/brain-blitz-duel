/**
 * Jaywalk crossRev 11 (docs/arcade-standard/cross.md "crossRev 11"): what each skill level does on the no-stop rules,
 * the inputs the scoring parts read (units, no-stop crossings, the streak, close calls, lives), played by the skill-band
 * bots on crossRev 11 and scored through the server replay. Not a check; the scores are arcade-skill-bands.ts's.
 *
 *   bun scripts/cross-rev11-bands.ts [--from=10000] [--seeds=40] [--levels=weak,good] [--rev=11] [--json=<path>]
 */
import { writeFileSync } from "node:fs";
import { crossCheckpoint, crossGameFor, CROSS_REV_FLOW, CROSS_X_ISLAND, type CrossState } from "../src/lib/arcade/cross";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { encodeCrossRun, replayCrossRun } from "../src/lib/duel/cross";
import { roomSeed } from "./arcade-skill-bands/games";
import { ALL_LEVELS, Human, type SkillLevel } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/cross";

const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const FROM = Number(opt("from") ?? 10000);
const SEEDS = Number(opt("seeds") ?? 40);
const REV = Number(opt("rev") ?? CROSS_REV_FLOW);
const LEVELS = (opt("levels")?.split(",") ?? ALL_LEVELS) as SkillLevel[];

export interface FlowRow {
  level: string;
  n: number;
  seed: number;
  score: number;
  flagged: boolean;
  units: number;
  crossings: number;
  lives: number;
  close: number;
  streakPts: number;
  /** Crossings made without a hit or a stop, and the longest kerb stand of each finished crossing. */
  noStop: number;
  stands: number[];
  /** Each finished crossing: N no-stop, S stopped on a kerb, H hit. */
  seq: string;
}

const rows: FlowRow[] = [];
for (const level of LEVELS) {
  for (let n = FROM; n < FROM + SEEDS; n++) {
    const seed = roomSeed(n);
    const game = crossGameFor(REV);
    const human = new Human("cross", seed, level);
    const res = bot({ game, seed, rev: REV, human, fixes: true });
    const events = (res.events ?? []) as ArcadeInputEvent[];
    const byTick = new Map(events.map((e) => [e.t, e]));
    let state = game.init(seed) as CrossState;
    const checkpoints = [];
    const stands: number[] = [];
    let stand = 0;
    let longest = 0;
    let noStop = 0;
    let seq = "";
    while (!game.isOver(state)) {
      const before = state;
      state = game.step(state, byTick.get(state.tick + 1) ?? null);
      if (state.tick % 300 === 0) checkpoints.push(crossCheckpoint(state));
      if (state.tick >= state.pauseUntil && state.hop === 0 && (state.lane === 0 || state.lane === CROSS_X_ISLAND)) stand += 1;
      else stand = 0;
      longest = Math.max(longest, stand);
      if (state.crossings > before.crossings) {
        stands.push(longest);
        if (!before.hitThisCrossing && longest <= 30) noStop += 1;
        seq += before.hitThisCrossing ? "H" : longest <= 30 ? "N" : "S";
        longest = 0;
        stand = 0;
      }
    }
    const raw = encodeCrossRun({ seed, claimedScore: game.score(state), events, endTick: state.tick, checkpoints });
    const server = replayCrossRun(seed, raw, REV);
    rows.push({
      level, n, seed, score: server.score, flagged: server.flagged, units: state.crossings * 14 + Math.min(state.reached, 14) + 2 * state.crossings, crossings: state.crossings,
      lives: state.lives, close: state.closeCalls ?? 0, streakPts: state.streakPts ?? 0, noStop, stands, seq,
    });
  }
  const r = rows.filter((x) => x.level === level);
  const med = (k: (x: FlowRow) => number) => {
    const v = r.map(k).sort((a, b) => a - b);
    return v.length % 2 ? v[v.length >> 1]! : (v[v.length / 2 - 1]! + v[v.length / 2]!) / 2;
  };
  console.log(
    `${level.padEnd(8)} score ${med((x) => x.score)} · units ${med((x) => x.units)} · crossings ${med((x) => x.crossings)} · no-stop ${med((x) => x.noStop)} · streak ${med((x) => x.streakPts)} · close ${med((x) => x.close)} · lives ${med((x) => x.lives)} · flagged ${r.filter((x) => x.flagged).length}`,
  );
}
const json = opt("json");
if (json) writeFileSync(json, JSON.stringify(rows));
