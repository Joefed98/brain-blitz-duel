/**
 * Rainbow Bridge x200 bands (a tool, not a check): the skill-band bot (scripts/arcade-skill-bands/bots/inkbridge.ts)
 * plays the skill-band tool's room seeds (seed index n → roomSeed(n)) on inkRev 8 (the band-3 revision rooms dealt
 * before) and inkRev 10, every run scored through the server's encode + replay, and writes one row per run with
 * what the score is made of (levels, the features' raw points, the finish tick). `--fit` re-scores saved rows on
 * today's curves (INK_V10_BAND_CURVE, INK_V10_SKILL_PAY) without playing again, so a curve change is measured on
 * the same runs; the bot never sees the curves.
 *
 *   bun scripts/ink-x200-bands.ts --from=0 --seeds=60 --revs=8,10 --levels=weak,average,good,great,near,elite --out=<json>
 *   bun scripts/ink-x200-bands.ts --fit=<json>[,<json>…] [--from=60]
 *   bun scripts/ink-x200-bands.ts --random --seeds=60     # uniformly random inputs at a human-ish rate
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  inkBridgeGameFor,
  inkCheckpoint,
  inkFeaturePaid,
  inkFeatureRaw,
  INK_EXPAND_MAX,
  INK_INPUT_LIFT,
  INK_INPUT_RELEASE,
  INK_INPUT_STROKE,
  INK_INPUT_UNDO,
  INK_LEVELS,
  INK_REV_EXPAND,
  INK_REV_STRICT,
  INK_RUN_TICKS,
  INK_TALL_H,
  INK_V10_BAND_CURVE,
  INK_V10_SPEED_PAR,
  INK_WORLD_W,
  type InkState,
} from "../src/lib/arcade/inkBridge";
import { bandPoints, BAND_FINISH_BONUS } from "../src/lib/arcade/scoreBands";
import { encodeInkBridgeRun, replayInkBridgeRun } from "../src/lib/duel/inkBridge";
import { roomSeed } from "./arcade-skill-bands/games";
import { Human, ALL_LEVELS as BAND_LEVELS, type SkillLevel as BandLevel } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/inkbridge";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const FROM = Number(opt("from") ?? 0);
const SEEDS = Number(opt("seeds") ?? 60);
const REVS = (opt("revs") ?? `${INK_REV_STRICT},${INK_REV_EXPAND}`).split(",").map(Number);
const LEVELS = (opt("levels")?.split(",") ?? [...BAND_LEVELS]) as BandLevel[];

export interface InkRow {
  rev: number;
  level: BandLevel | "random";
  n: number;
  score: number;
  levels: number;
  raw: number;
  ended: number;
  stars: number;
  tricks: number;
  silver: number;
  shamrocks: number;
}

/** Scores a log through the server's encode + replay (and checks the sim agrees). */
function replayed(rev: number, seed: number, events: ArcadeInputEvent[]): { state: InkState; score: number } {
  const game = inkBridgeGameFor(rev);
  let state = game.init(seed) as InkState;
  const byTick = new Map(events.map((e) => [e.t, e]));
  const checkpoints: unknown[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    state = game.step(state, byTick.get(state.tick + 1) ?? null);
    if (state.tick % 300 === 0) checkpoints.push(inkCheckpoint(state));
  }
  const raw = encodeInkBridgeRun({ seed, claimedScore: game.score(state), events, endTick: state.tick, checkpoints } as never);
  const r = replayInkBridgeRun(seed, raw, rev);
  if (r.flagged || r.score !== game.score(state)) throw new Error(`replay disagreed on seed ${seed} (rev ${rev})`);
  return { state: r.state, score: r.score };
}

function row(rev: number, level: InkRow["level"], n: number, state: InkState, score: number): InkRow {
  return { rev, level, n, score, levels: state.levels, raw: inkFeatureRaw(state), ended: state.endedTick || state.tick, stars: state.stars ?? 0, tricks: state.tricks ?? 0, silver: state.silver ?? 0, shamrocks: state.shamrocks ?? 0 };
}

/** Uniformly random inputs at a human-ish rate: a random stroke of 2–6 points, RELEASE, now and then an UNDO; live drops get random strokes. */
function randomRun(rev: number, n: number): InkRow {
  const seed = roomSeed(n);
  const r = replayed(rev, seed, randomInkLog(rev, seed));
  return row(rev, "random", n, r.state, r.score);
}

/** The random-input log for a seed (see randomRun). */
export function randomInkLog(rev: number, seed: number): ArcadeInputEvent[] {
  const game = inkBridgeGameFor(rev);
  let h = (seed ^ 0x5eed) >>> 0;
  const rnd = () => {
    h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    return h / 4294967296;
  };
  const events: ArcadeInputEvent[] = [];
  let state = game.init(seed) as InkState;
  let next = 30;
  let pts = 0;
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    let ev: Omit<ArcadeInputEvent, "t"> | null = null;
    if (t >= next) {
      const x = Math.floor(rnd() * INK_WORLD_W);
      const y = Math.floor(rnd() * INK_TALL_H);
      if (pts > 0) {
        ev = { k: INK_INPUT_STROKE, a: x, b: y, c: 0, d: 0 };
        pts--;
        next = t + 3 + Math.floor(rnd() * 5);
        if (pts === 0 && state.dropping) pts = -1;
      } else if (pts === -1) {
        ev = { k: INK_INPUT_LIFT, a: 1 + Math.floor(rnd() * 200), b: 0, c: 0, d: 0 };
        pts = 0;
        next = t + 10 + Math.floor(rnd() * 40);
      } else if (!state.dropping && state.segs.length > 0 && rnd() < 0.5) {
        ev = { k: rnd() < 0.15 ? INK_INPUT_UNDO : INK_INPUT_RELEASE, a: 1 + Math.floor(rnd() * 200), b: 0, c: 0, d: 0 };
        next = t + 20 + Math.floor(rnd() * 60);
      } else {
        ev = { k: INK_INPUT_STROKE, a: x, b: y, c: 1, d: 0 };
        pts = 1 + Math.floor(rnd() * 5);
        next = t + 3 + Math.floor(rnd() * 5);
      }
    }
    if (ev) recordInput(events, { ...ev, t }, game.inputRanges);
    const last = events[events.length - 1];
    state = game.step(state, last && last.t === t ? last : null);
  }
  return events;
}

/** Today's inkRev 10 score for a saved row (the curves as they are now). */
export function inkRescore(r: InkRow): number {
  if (r.rev !== INK_REV_EXPAND) return r.score;
  const finished = r.levels >= INK_LEVELS;
  const speed = finished ? Math.min(BAND_FINISH_BONUS, Math.round((BAND_FINISH_BONUS * (INK_RUN_TICKS - Math.max(0, Math.min(INK_RUN_TICKS, r.ended)))) / INK_V10_SPEED_PAR)) : 0;
  if (r.score === 0 && r.levels === 0 && r.raw === 0) return 0;
  return Math.max(0, Math.min(INK_EXPAND_MAX, bandPoints(INK_V10_BAND_CURVE, 10 * r.levels) + speed + inkFeaturePaid(r.raw)));
}

const q = (v: readonly number[], p: number) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
};
const med = (v: readonly number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

function table(rows: InkRow[]): void {
  const order: InkRow["level"][] = [...BAND_LEVELS, "random"];
  for (const rev of [...new Set(rows.map((r) => r.rev))].sort()) {
    for (const lv of order) {
      const rs = rows.filter((r) => r.rev === rev && r.level === lv);
      if (!rs.length) continue;
      const sc = rs.map(inkRescore);
      console.log(
        `inkRev ${rev} ${String(lv).padEnd(8)} n=${rs.length} median ${med(sc)} p10 ${q(sc, 0.1)} p90 ${q(sc, 0.9)} max ${Math.max(...sc)} zeros ${sc.filter((s) => s === 0).length}` +
          ` | levels median ${med(rs.map((r) => r.levels))} (all ten ${rs.filter((r) => r.levels >= INK_LEVELS).length}) raw median ${med(rs.map((r) => r.raw))} p90 ${q(rs.map((r) => r.raw), 0.9)}`,
      );
    }
  }
}

if (import.meta.main) {
  const fit = opt("fit");
  if (fit) {
    const rows = fit.split(",").flatMap((p) => JSON.parse(readFileSync(p, "utf8")) as InkRow[]);
    table(rows);
  } else {
    const out = opt("out");
    const rows: InkRow[] = out && existsSync(out) && args.includes("--append") ? JSON.parse(readFileSync(out, "utf8")) : [];
    for (let n = FROM; n < FROM + SEEDS; n++) {
      if (args.includes("--random")) {
        for (const rev of REVS) rows.push(randomRun(rev, n));
      } else
        for (const rev of REVS)
          for (const level of LEVELS) {
            const seed = roomSeed(n);
            const game = inkBridgeGameFor(rev);
            const res = bot({ game, seed, rev, human: new Human("inkbridge", seed, level), fixes: !process.argv.includes("--bots=v1") });
            const r = replayed(rev, seed, res.events ?? []);
            rows.push(row(rev, level, n, r.state, r.score));
          }
      if (out) writeFileSync(out, JSON.stringify(rows));
      if ((n - FROM) % 10 === 9) console.error(`… ${n - FROM + 1} seeds`);
    }
    table(rows);
  }
}
