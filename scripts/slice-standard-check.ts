/**
 * slice-standard-check (29 Oct 2026, the arcade scoring standard, docs/arcade-standard/slice.md): Slice
 * sliceRev 11 scores sliceRev 10's play in straight-line parts that add up to 200.
 *
 *  1. Older stamps are untouched: runs recorded on unmodified main on every revision rooms ever stamped (unstamped,
 *     sliceRev 2–10; scripts/fixtures/slice-standard-legacy.json.gz, scripts/slice-standard-legacy.ts) replay
 *     unflagged to their stored score and to the same final state; sliceRev 10's game and states carry nothing new.
 *  2. Rooms deal sliceRev 11; LIVE_BANDS, ROUND_MAX (200), the "?" help, the intro and playRevOf (11 → 10) follow.
 *  3. The same play as sliceRev 10: the same schedule, and the same log cuts the same objects on the same ticks with the
 *     same chillies, bottles and combos on both stamps, for every player (the schedule is the seed's alone; a bottle's
 *     batch is fixed at init).
 *  4. The rules, re-derived tick by tick from the sim's own positions on oracle, bot and scripted runs: foods cut and
 *     thrown, bread tickets (three breads in a row, other food between them allowed, a missed bread resets), golden
 *     fruit, dodges (a food cut within 60 px of a chilli's skin, by a segment that cuts no chilli), the combo foods;
 *     each part's formula and cap, the chilli's −10, 0 with no input, at least 1 with any, at most 200.
 *  5. A perfect run scores 200 (the oracle's log, replayed by the server) on 24 room seeds, every part at its
 *     maximum; STANDARD (scripts/arcade-standard/slice.ts) agrees.
 *
 *   bun scripts/slice-standard-check.ts      # ~30 s
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { hasScorePart } from "../src/lib/duel/scoreList";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, ALL_LEVELS } from "./arcade-skill-bands/human";
import { bot as sliceBot } from "./arcade-skill-bands/bots/slice";
import { fnv } from "./arcade-tuning-a-legacy";
import { playRevOf } from "./scoring-targets-revs";
import { SLICE_BEFORE, type SliceLegacyRecord } from "./slice-standard-legacy";
import { sliceOracleEvents, sliceOracleRun } from "./slice-standard-oracle";
import { entry } from "./arcade-standard/slice";
import type { StdRun } from "./arcade-standard/entry";
import { BAND_STRICT_MARK, bandPoints } from "../src/lib/arcade/scoreBands";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  sliceBandParts,
  sliceGameFor,
  sliceObjectAt,
  sliceRadius,
  sliceSuppressed,
  sliceTicketsDone,
  sliceV11Parts,
  sliceWorldH,
  sliceWorldHFor,
  sliceWorldW,
  sliceWorldWFor,
  SLICE_HUD_H,
  SLICE_INPUT_BEGIN,
  SLICE_INPUT_SWIPE,
  SLICE_REV_BIG,
  SLICE_REV_STANDARD,
  SLICE_RUN_TICKS,
  SLICE_V11,
  SLICE_V11_BAND_CURVE,
  SLICE_V11_BREAD,
  SLICE_V11_CLOSE,
  SLICE_V11_COMBO_CAP,
  SLICE_V11_CORE,
  SLICE_V11_DODGE_CAP,
  SLICE_V11_GOLD_CAP,
  SLICE_V11_TICKET_BEFORE,
  SLICE_V11_TICKET_CAP,
  SLICE_V9_GOLD,
  SLICE_V9_GOLDS,
  SLICE_V9_H,
  SLICE_V9_W,
  type SliceState,
} from "../src/lib/arcade/slice";
import { replaySliceRun } from "../src/lib/duel/slice";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { ROUND_MAX, fillMax } from "../src/lib/duel/roundMax";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";

/** The game's arcade-standard-check entry, read as this check always has (the first perfect run, split into parts). */
const STANDARD = {
  id: entry.type,
  stampKey: entry.field,
  stamp: entry.rev,
  parts: entry.parts,
  perfect: () => {
    const r = (entry.perfect() as StdRun[])[0]!;
    return { score: r.score, parts: r.parts! };
  },
};

const failures: string[] = [];
let passes = 0;
function ok(cond: unknown, message: string): void {
  if (cond) passes++;
  else if (failures.length < 80) failures.push(message);
}
const section = (name: string) => console.log(`— ${name}`);
const spec = GAME_BY_TYPE.get("slice")!;
const g10 = sliceGameFor(SLICE_REV_BIG);
const g11 = sliceGameFor(SLICE_REV_STANDARD);

/** Plays a log on a game, returning every state (index = tick). */
function playStates(game: typeof g11, seed: number, events: readonly ArcadeInputEvent[]): SliceState[] {
  const by = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as SliceState;
  const states = [s];
  while (!game.isOver(s) && s.tick < SLICE_RUN_TICKS) {
    s = game.step(s, by.get(s.tick + 1) ?? null) as SliceState;
    states.push(s);
  }
  return states;
}

function botEvents(seed: number, level: (typeof ALL_LEVELS)[number]): ArcadeInputEvent[] {
  return sliceBot({ game: g11, seed, rev: SLICE_REV_STANDARD, human: new Human("slice", seed, level), fixes: true } as any).events ?? [];
}

/**
 * A scripted player: each tick `pick` names an object to cut (a short segment on its centre, kept clear of the
 * chillies) or asks for a new path; anything else is no input.
 */
function scripted(seed: number, pick: (s: SliceState, t: number) => number | "begin" | null): ArcadeInputEvent[] {
  let s = g11.init(seed) as SliceState;
  const events: ArcadeInputEvent[] = [];
  const W = sliceWorldW(s);
  const H = sliceWorldH(s);
  while (!g11.isOver(s)) {
    const t = s.tick + 1;
    const choice = pick(s, t);
    let event: ArcadeInputEvent | null = null;
    if (choice === "begin") event = { t, k: SLICE_INPUT_BEGIN, a: W >> 1, b: H >> 1, c: 0, d: 0 };
    else if (choice !== null) {
      const p = sliceObjectAt(s.objects[choice]!, t, s.slowFrom, s.mayo);
      if (p) {
        const x = Math.max(1, Math.min(W - 1, Math.trunc(p.x / 256)));
        const y = Math.max(0, Math.min(H, Math.trunc(p.y / 256)));
        event = { t, k: SLICE_INPUT_SWIPE, a: x - 1, b: y, c: x + 1, d: y };
      }
    }
    if (event) events.push(event);
    s = g11.step(s, event) as SliceState;
  }
  return events;
}

/** On the board (cuttable) at a tick: the sim's own position, inside the board's width and below the HUD. */
function onBoard(s: SliceState, i: number, tick: number): { x: number; y: number; r: number } | null {
  const o = s.objects[i]!;
  const p = sliceObjectAt(o, tick, s.slowFrom, s.mayo);
  if (!p) return null;
  const x = Math.trunc(p.x / 256);
  const y = Math.trunc(p.y / 256);
  const r = sliceRadius(o);
  if (y - r > sliceWorldH(s) || y + r < SLICE_HUD_H || x - r > sliceWorldW(s) || x + r < 0) return null;
  return { x, y, r };
}

/* ============================== 1. Older stamps ============================== */
section("Older stamps replay exactly as recorded on main");
{
  const runs = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/slice-standard-legacy.json.gz")).toString()) as SliceLegacyRecord[];
  ok(runs.length === 22, `22 legacy runs (got ${runs.length})`);
  ok(SLICE_BEFORE.every((rev) => runs.some((r) => r.rev === rev)), "every older revision covered (unstamped, 2–10)");
  for (const run of runs) {
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const replay = replaySliceRun(run.seed, raw, run.rev);
    const tag = `rev ${run.rev} ${run.level} ${run.seed}`;
    ok(!replay.flagged && replay.desyncTick === null, `${tag}: replays unflagged (${replay.reason ?? ""})`);
    ok(replay.score === run.score, `${tag}: replays to its stored ${run.score} (got ${replay.score})`);
    ok(fnv(JSON.stringify(replay.state)) === run.stateHash, `${tag}: final state identical to main's`);
    ok((replay.state as SliceState).v11 === undefined, `${tag}: no sliceRev 11 marker`);
  }
  ok(g10 !== g11 && g10.init !== g11.init && g10.step === g11.step && g10.score === g11.score, "sliceRev 11 has its own init; sliceRev 10 keeps its game");
}

/* ============================== 2. Stamps and texts ============================== */
section("Rooms deal sliceRev 11; the help, intro and maximum say so");
{
  const dealt = (generatePuzzle("slice") as unknown as Record<string, unknown>).sliceRev;
  // Rooms deal sliceRev 12 since 3 Nov 2026 (bigger food, the core from half the food; slice-food-check), after 11.
  ok(dealt === SLICE_REV_STANDARD + 1 && SLICE_REV_STANDARD === 11, `rooms deal sliceRev 12, after 11 (got ${String(dealt)})`);
  ok(LIVE_BANDS.slice.rev === SLICE_REV_STANDARD + 1 && bandPoints(SLICE_V11_BAND_CURVE, 1000) === 120, "LIVE_BANDS reads sliceRev 12 (after 11, whose core line is unchanged)");
  ok(JSON.stringify(SLICE_V11_BAND_CURVE) === JSON.stringify({ units: [0, 1000], points: [0, 120] }), "the core is one straight line, 0 → 120 over the share in thousandths");
  ok(playRevOf("slice", SLICE_REV_STANDARD) === SLICE_REV_BIG, "playRevOf maps sliceRev 11 to sliceRev 10's play");
  ok(ROUND_MAX.slice === 200, "ROUND_MAX is 200");
  const sum = STANDARD.parts.reduce((a, p) => a + p.max, 0);
  ok(sum === 200 && SLICE_V11_CORE === 120 && SLICE_V11_COMBO_CAP === 40 && SLICE_V11_GOLD_CAP === 20 && SLICE_V11_TICKET_CAP === 10 && SLICE_V11_DODGE_CAP === 10, `the parts are 120 + 40 + 20 + 10 + 10 = 200 (got ${sum})`);
  const help = PUZZLE_INSTRUCTIONS.slice.score;
  // Text pass (4 Nov 2026): one line a part, the chilli's cost, then the total.
  for (const [label, max] of [["Food", 120], ["Combos", 40], ["Golden fruit", 20], ["Bread tickets", 10], ["Dodges", 10]] as const)
    ok(hasScorePart(help, label, max), `the help states "${label}: …, up to ${max}.": ${help}`);
  for (const part of ["costs 10", "Total 200."]) ok(help.includes(part), `the help states "${part}": ${help}`);
  const intro = fillMax(INTRO_SCORE.slice, "slice");
  // Text pass (4 Nov 2026): the intro names the bonuses in one plain sentence (no internal figures).
  ok(["combos", "gold fruit", "bread", "dodges", "chillies cost", "Up to 200."].every((n) => intro.includes(n)), `the intro names the parts and 200: ${intro}`);
  ok(sliceWorldWFor(SLICE_REV_STANDARD) === SLICE_V9_W && sliceWorldHFor(SLICE_REV_STANDARD) === SLICE_V9_H, "sliceRev 11 plays on the 430 × 805 board");
  const init = g11.init(spec.seedFor(0)) as SliceState;
  ok(init.band === BAND_STRICT_MARK && init.v11 === SLICE_V11 && init.v10 === 1 && init.v9 === 1, "band 3, v9, v10 and v11 from the first tick");
  ok(init.tickets?.length === 0 && sliceTicketsDone(init) === 0, "no order tickets on sliceRev 11");
}

/* ============================== 3. The same play ============================== */
section("The same play as sliceRev 10, the same run for every player");
{
  const strip = (s: SliceState) => s.objects.map((o) => JSON.stringify(o));
  for (let n = 0; n < 40; n++) {
    const seed = spec.seedFor(n);
    const a = g10.init(seed) as SliceState;
    const b = g11.init(seed) as SliceState;
    ok(JSON.stringify(strip(a)) === JSON.stringify(strip(b)), `seed ${seed}: the same schedule as sliceRev 10`);
    ok(JSON.stringify(g11.init(seed)) === JSON.stringify(b), `seed ${seed}: init is the seed's alone`);
    const breads = b.objects.filter((o) => !o.bomb && !o.special && o.colour === SLICE_V11_BREAD && o.launchTick <= SLICE_RUN_TICKS - SLICE_V11_TICKET_BEFORE).length;
    ok(b.breadMax === Math.max(1, Math.floor(breads / 3)) && b.goldDealt === SLICE_V9_GOLDS, `seed ${seed}: tickets' maximum from the schedule's breads, six golden fruit`);
  }
  for (let n = 0; n < 6; n++) {
    const seed = spec.seedFor(100 + n);
    for (const events of [botEvents(seed, n % 2 ? "good" : "near"), sliceOracleEvents(seed)]) {
      const s10 = playStates(g10, seed, events);
      const s11 = playStates(g11, seed, events);
      let same = s10.length === s11.length;
      for (let t = 0; same && t < s10.length; t++) {
        const p = s10[t]!;
        const q = s11[t]!;
        same = p.tick === q.tick && JSON.stringify(p.slicedAt) === JSON.stringify(q.slicedAt) && p.objects.length === q.objects.length &&
          p.bombsHit === q.bombsHit && p.slices === q.slices && p.comboLive === q.comboLive && p.comboUntil === q.comboUntil &&
          JSON.stringify(p.frenzyFrom) === JSON.stringify(q.frenzyFrom) && JSON.stringify(p.slowFrom) === JSON.stringify(q.slowFrom) && JSON.stringify(p.mayo) === JSON.stringify(q.mayo);
      }
      ok(same, `seed ${seed}: one log cuts the same objects on the same ticks on sliceRev 10 and 11`);
      // Whatever a player does, the objects are the seed's (a bottle's batch, fixed at init, joins when it is cut).
      const last = s11.at(-1)!;
      const init = s11[0]!;
      ok(JSON.stringify(last.objects.slice(0, init.objects.length)) === JSON.stringify(init.objects), `seed ${seed}: the schedule never changes in play`);
    }
  }
}

/* ============================== 4. The rules ============================== */
section("The rules, re-derived tick by tick");
function audit(seed: number, events: readonly ArcadeInputEvent[], tag: string): SliceState {
  const states = playStates(g11, seed, events);
  let bad = "";
  for (let t = 1; t < states.length && !bad; t++) {
    const p = states[t - 1]!;
    const q = states[t]!;
    const newly = q.slicedAt.map((v, i) => (v === q.tick && !(p.slicedAt[i] ?? 0) ? i : -1)).filter((i) => i >= 0);
    const foods = newly.filter((i) => !q.objects[i]!.bomb && !q.objects[i]!.special);
    const chilliCut = newly.some((i) => q.objects[i]!.bomb);
    // Foods that left the board uncut this tick (natural flight over).
    const left = q.objects
      .map((o, i) => ({ o, i }))
      .filter(({ o, i }) => !o.bomb && !o.special && !q.slicedAt[i] && i < p.objects.length && sliceObjectAt(o, q.tick - 1, q.slowFrom) && !sliceObjectAt(o, q.tick, q.slowFrom))
      .map(({ i }) => i);
    if ((q.foodCut ?? 0) !== (p.foodCut ?? 0) + foods.length) bad = `tick ${q.tick}: foods cut ${q.foodCut} (expected ${(p.foodCut ?? 0) + foods.length})`;
    if ((q.foodMissed ?? 0) !== (p.foodMissed ?? 0) + left.length) bad ||= `tick ${q.tick}: foods missed ${q.foodMissed} (expected ${(p.foodMissed ?? 0) + left.length})`;
    let run = p.breadRun ?? 0;
    let tickets = p.breadTickets ?? 0;
    for (const i of foods)
      if (q.objects[i]!.colour === SLICE_V11_BREAD && ++run === 3) {
        tickets++;
        run = 0;
      }
    if (left.some((i) => q.objects[i]!.colour === SLICE_V11_BREAD)) run = 0;
    if (q.breadRun !== run || q.breadTickets !== tickets) bad ||= `tick ${q.tick}: bread run ${q.breadRun}/${q.breadTickets} (expected ${run}/${tickets})`;
    const golds = (p.golds ?? 0) + foods.filter((i) => q.objects[i]!.colour === SLICE_V9_GOLD).length;
    if (q.golds !== golds) bad ||= `tick ${q.tick}: golden fruit ${q.golds} (expected ${golds})`;
    let dodges = p.dodges ?? 0;
    if (!chilliCut)
      for (const i of foods) {
        // Positions as the sim cuts: the tick's own, from the state before the cut.
        const fa = sliceObjectAt(q.objects[i]!, q.tick, p.slowFrom, p.mayo)!;
        const fx = Math.trunc(fa.x / 256);
        const fy = Math.trunc(fa.y / 256);
        const near = p.objects.some((o, j) => {
          if (!o.bomb || p.slicedAt[j] || sliceSuppressed(p, o)) return false;
          const at = sliceObjectAt(o, q.tick, p.slowFrom, p.mayo);
          if (!at) return false;
          const cx = Math.trunc(at.x / 256);
          const cy = Math.trunc(at.y / 256);
          const r = sliceRadius(o);
          if (cy - r > sliceWorldH(p) || cy + r < SLICE_HUD_H) return false;
          return Math.hypot(cx - fx, cy - fy) <= r + sliceRadius(q.objects[i]!) + SLICE_V11_CLOSE;
        });
        if (near) dodges++;
      }
    if ((q.dodges ?? 0) !== dodges) bad ||= `tick ${q.tick}: dodges ${q.dodges} (expected ${dodges})`;
    const dc = (q.comboFoods ?? 0) - (p.comboFoods ?? 0);
    if (dc < 0 || dc > (q.strokeFood ?? 0) || (chilliCut && dc !== 0)) bad ||= `tick ${q.tick}: combo foods ${p.comboFoods} → ${q.comboFoods}`;
    if (dc > 0 && !q.comboLive) bad ||= `tick ${q.tick}: combo foods counted with no combo live`;
    if (q.bombsHit < p.bombsHit || (chilliCut && q.comboLive)) bad ||= `tick ${q.tick}: a chilli must end the combo`;
  }
  ok(!bad, `${tag}: ${bad}`);
  const s = states.at(-1)!;
  // The score from the counters, independently.
  const thrown = (s.foodCut ?? 0) + (s.foodMissed ?? 0);
  const units = thrown ? Math.floor((1000 * (s.foodCut ?? 0)) / thrown) : 0;
  const core = Math.floor((120 * units) / 1000);
  const combo = Math.min(40, Math.floor((2 * (s.comboFoods ?? 0)) / 5));
  const gold = Math.floor((20 * Math.min(6, s.golds ?? 0)) / 6);
  const tk = Math.min(10, Math.floor((10 * (s.breadTickets ?? 0)) / (s.breadMax ?? 1)));
  const dg = Math.min(10, 2 * (s.dodges ?? 0));
  const want = s.acted ? Math.max(1, Math.min(200, core + combo + gold + tk + dg - 10 * s.bombsHit)) : 0;
  const parts = sliceV11Parts(s);
  ok(g11.score(s) === want && parts.core === core && parts.combo === combo && parts.gold === gold && parts.tickets === tk && parts.dodges === dg, `${tag}: the score ${g11.score(s)} is the parts' (${want})`);
  const band = sliceBandParts(s);
  ok(band.points === core && band.bonus === combo + gold + tk + dg && band.penalty === 10 * s.bombsHit, `${tag}: the reveal breakdown adds up`);
  return s;
}
{
  // Bots at every level and the oracle.
  for (let n = 0; n < 3; n++) {
    const seed = spec.seedFor(200 + n);
    for (const level of ALL_LEVELS) audit(seed, botEvents(seed, level), `${level} bot, seed ${seed}`);
  }
  // Three breads in a row (other food between is fine); a missed bread resets the run.
  const seed = spec.seedFor(7);
  const init = g11.init(seed) as SliceState;
  const breads = init.objects.map((o, i) => ({ o, i })).filter(({ o }) => !o.bomb && !o.special && o.colour === SLICE_V11_BREAD).map(({ i }) => i);
  const firstOnBoard = (s: SliceState, t: number, skip: Set<number>) => {
    for (let i = 0; i < s.objects.length; i++) {
      const o = s.objects[i]!;
      if (s.slicedAt[i] || o.bomb || o.special || skip.has(i) || sliceSuppressed(s, o) || !onBoard(s, i, t)) continue;
      // Kept well clear of the chillies.
      const p = onBoard(s, i, t)!;
      if (s.objects.some((c, j) => c.bomb && !s.slicedAt[j] && onBoard(s, j, t) && Math.hypot(onBoard(s, j, t)!.x - p.x, onBoard(s, j, t)!.y - p.y) < 60)) continue;
      return i;
    }
    return null;
  };
  // The third bread is let go; no later bread is cut before it has left (other foods are).
  const b3end = init.objects[breads[2]!]!.lastTick;
  const skipThird = (t: number) => new Set(t <= b3end + 1 ? breads.slice(2) : [breads[2]!]);
  const missing = audit(seed, scripted(seed, (s, t) => (t === 1 ? "begin" : firstOnBoard(s, t, skipThird(t)))), `seed ${seed}: every food but the third bread`);
  const all = audit(seed, scripted(seed, (s, t) => (t === 1 ? "begin" : firstOnBoard(s, t, new Set()))), `seed ${seed}: every food it can reach`);
  // In the run that lets the third bread go: the run stood at 2 when it left, then 0.
  {
    const states = playStates(g11, seed, scripted(seed, (s, t) => (t === 1 ? "begin" : firstOnBoard(s, t, skipThird(t)))));
    const b3 = breads[2]!;
    const exit = states.findIndex((s, t) => t > 0 && !s.slicedAt[b3] && sliceObjectAt(s.objects[b3]!, t - 1, s.slowFrom) && !sliceObjectAt(s.objects[b3]!, t, s.slowFrom));
    const before = states[exit - 1]!;
    const cutBetween = states[exit]!.slicedAt.filter((v, i) => v > 0 && v < exit && !states[exit]!.objects[i]!.bomb && states[exit]!.objects[i]!.colour !== SLICE_V11_BREAD).length;
    ok(exit > 0 && (before.breadRun ?? 0) === 2 && states[exit]!.breadRun === 0 && (before.breadTickets ?? 0) === 0, `the third bread missed: the run of 2 goes to 0, no ticket (exit tick ${exit}, run ${before.breadRun} → ${states[exit]!.breadRun}, tickets ${before.breadTickets})`);
    ok(cutBetween > 0, "other foods were cut between the breads without breaking the run");
    ok((all.breadTickets ?? 0) > (missing.breadTickets ?? 0) || (all.breadTickets ?? 0) >= 1, "cutting every bread fills tickets");
  }
  // Combos: single foods in their own paths never start one; a combo counts every food of the path that starts it.
  {
    const s = audit(seed, scripted(seed, (st, t) => (st.strokeCuts >= 1 ? "begin" : firstOnBoard(st, t, new Set()))), `seed ${seed}: one food a path`);
    ok((s.comboFoods ?? 0) === 0 && SLICE_V11_COMBO_CAP > 0 && sliceV11Parts(s).combo === 0, "one food a path: no combo foods, no combo points");
    ok((all.comboFoods ?? 0) > 0 && (all.comboFoods ?? 0) <= (all.foodCut ?? 0), "one long path: combo foods counted");
  }
  // No input scores 0; any input at least 1; a lone chilli costs 10 but leaves 1.
  {
    const idle = playStates(g11, seed, []).at(-1)!;
    ok(g11.score(idle) === 0, "no input scores 0");
    const one = playStates(g11, seed, [{ t: 5, k: SLICE_INPUT_BEGIN, a: 10, b: 400, c: 0, d: 0 }]).at(-1)!;
    ok(one.acted === 1 && g11.score(one) === 1, `one touch, nothing cut: 1 (got ${g11.score(one)})`);
    const chilli = init.objects.findIndex((o) => o.bomb);
    const hit = audit(seed, scripted(seed, (s, t) => (!s.slicedAt[chilli] && onBoard(s, chilli, t) ? chilli : null)), `seed ${seed}: one chilli`);
    ok(hit.bombsHit === 1 && sliceV11Parts(hit).chillies === 10 && g11.score(hit) === 1, `a lone chilli: −10, scored 1 (got ${g11.score(hit)})`);
  }
  // The caps and lines on made-up counters.
  {
    const base = { ...(g11.init(seed) as SliceState), acted: 1 };
    const at = (x: Partial<SliceState>) => sliceV11Parts({ ...base, ...x });
    ok(at({ foodCut: 50, foodMissed: 50 }).core === 60 && at({ foodCut: 100, foodMissed: 0 }).core === 120 && at({ foodCut: 1, foodMissed: 99 }).core === 1, "core: 120 × cut ÷ thrown");
    ok(at({ comboFoods: 5 }).combo === 2 && at({ comboFoods: 99 }).combo === 39 && at({ comboFoods: 100 }).combo === 40 && at({ comboFoods: 300 }).combo === 40, "combo: 2 per 5 foods, up to 40");
    ok([0, 1, 2, 3, 4, 5, 6].map((g) => at({ golds: g, goldDealt: 6 }).gold).join() === "0,3,6,10,13,16,20", "golden fruit: 20 shared by the six");
    ok(at({ breadTickets: 4, breadMax: 8 }).tickets === 5 && at({ breadTickets: 8, breadMax: 8 }).tickets === 10 && at({ breadTickets: 11, breadMax: 8 }).tickets === 10, "tickets: 10 shared by the most the schedule allows, capped");
    ok(at({ dodges: 3 }).dodges === 6 && at({ dodges: 5 }).dodges === 10 && at({ dodges: 9 }).dodges === 10, "dodges: 2 each, up to 10");
    ok(at({ bombsHit: 2 }).chillies === 20, "each chilli costs 10");
    const full = { ...base, foodCut: 100, foodMissed: 0, comboFoods: 100, golds: 6, goldDealt: 6, breadTickets: 9, breadMax: 9, dodges: 5 };
    ok(g11.score(full as SliceState) === 200 && g11.score({ ...full, bombsHit: 1 } as SliceState) === 190, "every part full: 200; a chilli takes it to 190");
  }
}

/* ============================== 5. A perfect run ============================== */
section("A perfect run scores 200 through the server's replay");
{
  let perfect = 0;
  const seeds = 24;
  for (let n = 0; n < seeds; n++) {
    const seed = spec.seedFor(300 + n);
    const { result } = sliceOracleRun(seed);
    const s = result.state as SliceState;
    ok(!result.flagged && result.desyncTick === null, `seed ${seed}: the oracle's run replays unflagged`);
    const p = sliceV11Parts(s);
    if (result.score === 200 && p.core === 120 && p.combo === 40 && p.gold === 20 && p.tickets === 10 && p.dodges === 10) perfect++;
    else ok(false, `seed ${seed}: oracle ${result.score} ${JSON.stringify(p)}`);
  }
  ok(perfect === seeds, `${perfect} of ${seeds} oracle runs score 200 with every part full`);
  if (perfect > 0) audit(spec.seedFor(300), sliceOracleEvents(spec.seedFor(300)), "the oracle");
  const st = STANDARD.perfect();
  ok(STANDARD.id === "slice" && STANDARD.stampKey === "sliceRev" && STANDARD.stamp === 12, "STANDARD names sliceRev 12 (since 3 Nov 2026; slice-food-check proves it)");
  ok(st.score === 200 && STANDARD.parts.every((part) => st.parts[part.key] === part.max), `STANDARD.perfect(): 200 with every part at its maximum (${JSON.stringify(st)})`);
}

console.log(
  failures.length === 0
    ? `PASS slice-standard-check: ${passes} checks — older stamps replay as on main; rooms deal sliceRev 11 (sliceRev 10's play) scored 120 + 40 + 20 + 10 + 10; the rules re-derived tick by tick; a perfect run scores 200`
    : `FAIL slice-standard-check: ${failures.length} of ${passes + failures.length} checks failed\n${failures.map((f) => `  ✗ ${f}`).join("\n")}`,
);
if (failures.length > 0) process.exit(1);
