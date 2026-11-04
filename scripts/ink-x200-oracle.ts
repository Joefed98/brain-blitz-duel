/**
 * Rainbow Bridge inkRev 10 (x200), inkRev 11 (phone notes; `bun scripts/ink-x200-oracle.ts [from] [count] 11`) and
 * inkRev 13 (clovers and ink par: `… 13`, the bonus line only on a cloud or clover level, every level within its par):
 * the perfect-play ceiling of a seed, played for real.
 *
 * A flawless player who knows every level's proved lines: on levels 1–8 the bonus line (starRef: the ink star,
 * the level's silver coins, the shamrock where it is, a cloud level's trick shot), on levels 9–10 the
 * pre-release line and the hand-drawn live stroke (liveHand). Each line goes in as a phone sends it (one point a
 * tick, inkPhoneLine), RELEASE on the first tick (a moving pot: the first tick at or after the drawing that pots
 * with everything taken, found by trying each), the live stroke from its proved start. The input log is then
 * scored by the server's own encode + replay: what the run scores is the seed's ceiling.
 *
 * Used by scripts/ink-x200-check.ts (a sample of seeds) and `bun scripts/ink-x200-oracle.ts [from] [count]`
 * (the full proof over seed indices 0–259, the 60 tuning and 200 fresh seeds of the skill-band tool).
 */
import { inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  inkBridgeGameFor,
  inkCheckpoint,
  inkFeatureRaw,
  inkPhoneLine,
  INK_INPUT_LIFT,
  INK_INPUT_RELEASE,
  INK_INPUT_STROKE,
  INK_LEVELS,
  inkClover,
  INK_REV_EXPAND,
  type InkState,
} from "../src/lib/arcade/inkBridge";
import { encodeInkBridgeRun, replayInkBridgeRun } from "../src/lib/duel/inkBridge";
import { roomSeed } from "./arcade-skill-bands/games";

type Ev = Omit<ArcadeInputEvent, "t">;

/** One level's inputs from `t0` (absolute ticks): the strokes a point a tick, RELEASE at `rel`, live strokes after it. */
function levelInputs(lines: readonly number[][], rel: number, live: readonly { start: number; pts: number[] }[], t0: number): Map<number, Ev> {
  const at = new Map<number, Ev>();
  const put = (t: number, ev: Ev) => {
    let tick = t;
    while (at.has(tick)) tick++;
    at.set(tick, ev);
    return tick;
  };
  let t = t0;
  for (const st of lines) {
    const pts = inkPhoneLine(st);
    for (let j = 0; j < pts.length; j += 2) t = put(t, { k: INK_INPUT_STROKE, a: pts[j]!, b: pts[j + 1]!, c: j === 0 ? 1 : 0, d: 0 }) + 1;
  }
  const r = put(Math.max(t, rel), { k: INK_INPUT_RELEASE, a: 1, b: 0, c: 0, d: 0 });
  let presses = 1;
  for (const lv of live) {
    const pts = inkPhoneLine(lv.pts);
    let tt = r + lv.start;
    for (let j = 0; j < pts.length; j += 2) tt = put(tt, { k: INK_INPUT_STROKE, a: pts[j]!, b: pts[j + 1]!, c: j === 0 ? 1 : 0, d: 0 }) + 1;
    put(tt, { k: INK_INPUT_LIFT, a: ++presses, b: 0, c: 0, d: 0 });
  }
  return at;
}

/** Plays one level from state `s` with the given release; returns the state when the level ends (or the run does). */
function playLevel(game: ReturnType<typeof inkBridgeGameFor>, s0: InkState, lines: readonly number[][], rel: number, live: readonly { start: number; pts: number[] }[], log?: ArcadeInputEvent[]): InkState {
  const at = levelInputs(lines, rel, live, s0.tick + 1);
  let s = s0;
  const level = s.level;
  const fails = s.fails;
  const local: ArcadeInputEvent[] = [];
  while (!game.isOver(s) && s.level === level && s.fails === fails && s.tick < game.runTicks) {
    const t = s.tick + 1;
    const ev = at.get(t);
    if (ev) recordInput(log ?? local, { ...ev, t }, game.inputRanges);
    s = game.step(s, inputAt(log ?? local, t));
  }
  return s;
}

export interface OracleRun {
  events: ArcadeInputEvent[];
  state: InkState;
  score: number;
  /** The server replay's score of the same log (must equal `score`). */
  replayed: number;
  raw: number;
  levels: number;
  endedSeconds: number;
}

/** The perfect run for a seed (see the file's head), on inkRev 10 or inkRev 11 (`rev`). */
export function inkOracleRun(seed: number, rev: number = INK_REV_EXPAND): OracleRun {
  const game = inkBridgeGameFor(rev);
  let s = game.init(seed) as InkState;
  const events: ArcadeInputEvent[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    const lvl = s.list[s.level]!;
    // inkRev 13: the bonus line only where it takes something (a cloud's trick shot or a clover), else the easy line;
    // every level within its ink par.
    const v13 = inkClover(s.rev);
    const bonus = s.level < 8 && lvl.starRef && (!v13 || Boolean(lvl.clouds?.length || lvl.shamrock));
    const lines = bonus ? lvl.starRef! : lvl.ref;
    const live = lvl.liveHand ?? [];
    const before = inkFeatureRaw(s);
    const want = v13
      ? (e: InkState) => e.levels > s.levels && (e.parLevels ?? 0) > (s.parLevels ?? 0) && (e.tricks ?? 0) - (s.tricks ?? 0) === (lvl.clouds?.length ? 1 : 0) && (e.shamrocks ?? 0) - (s.shamrocks ?? 0) === (lvl.shamrock ? 1 : 0)
      : (e: InkState) => e.levels > s.levels && (!bonus || inkFeatureRaw(e) - before >= featureOf(lvl));
    // The earliest release that pots with everything taken (a still pot: straight away).
    let rel = s.tick + 1;
    if (lvl.slideAmp) {
      const span = lvl.slidePeriod + 2;
      let found = -1;
      for (let r = s.tick + 1; r < s.tick + 80 + span && found < 0; r++) if (want(playLevel(game, s, lines, r, live))) found = r;
      if (found < 0) for (let r = s.tick + 1; r < s.tick + 80 + span && found < 0; r++) if (playLevel(game, s, lines, r, live).levels > s.levels) found = r;
      if (found >= 0) rel = found;
    }
    const next = playLevel(game, s, lines, rel, live, events);
    if (next.level === s.level && next.levels === s.levels && !game.isOver(next) && next.fails === s.fails) break;
    s = next;
  }
  // Play out the clock (nothing more happens once every level is potted, the run is over).
  while (!game.isOver(s) && s.tick < game.runTicks) s = game.step(s, null);
  const score = game.score(s);
  const checkpoints: unknown[] = [];
  const byTick = new Map(events.map((e) => [e.t, e]));
  let r = game.init(seed) as InkState;
  while (!game.isOver(r) && r.tick < game.runTicks) {
    r = game.step(r, byTick.get(r.tick + 1) ?? null);
    if (r.tick % 300 === 0) checkpoints.push(inkCheckpoint(r));
  }
  const raw = encodeInkBridgeRun({ seed, claimedScore: score, events, inputs: [], taps: [], endTick: r.tick, checkpoints } as never);
  const replayed = replayInkBridgeRun(seed, raw, rev).score;
  return { events, state: s, score, replayed, raw: inkFeatureRaw(s), levels: s.levels, endedSeconds: (s.endedTick || s.tick) / 60 };
}

/** A level's feature raw points when its bonus line takes everything on it. */
function featureOf(lvl: InkState["list"][number]): number {
  return 5 + (lvl.clouds?.length ? 5 : 0) + 2 * (lvl.silver?.length ?? 0) + (lvl.shamrock ? 20 : 0);
}

if (import.meta.main) {
  const from = Number(process.argv[2] ?? 0);
  const count = Number(process.argv[3] ?? 260);
  const rev = Number(process.argv[4] ?? INK_REV_EXPAND);
  let min = Infinity;
  let below = 0;
  const lows: string[] = [];
  for (let n = from; n < from + count; n++) {
    const o = inkOracleRun(roomSeed(n), rev);
    if (o.replayed !== o.score) throw new Error(`seed index ${n}: sim ${o.score} but the server replay ${o.replayed}`);
    min = Math.min(min, o.replayed);
    if (o.replayed < 200) {
      below++;
      lows.push(`n${n}=${o.replayed} (levels ${o.levels}/${INK_LEVELS}, raw ${o.raw}, ${o.endedSeconds.toFixed(1)} s)`);
    }
    if ((n - from) % 20 === 19) console.error(`… ${n - from + 1} seeds, lowest ${min}`);
  }
  console.log(`inkRev ${rev} perfect-play ceiling, seed indices ${from}–${from + count - 1}: lowest ${min}, ${below} below 200${lows.length ? `: ${lows.join(", ")}` : ""}`);
}
