/**
 * Rainbow Bridge inkRev 11 (Joe's phone notes, 27 Oct 2026; docs/phone-notes-oct-2026/rainbow-bridge.md): no wind
 * zones, two silver coins a level (16 a run, was 24), and the star, shamrock and silver coins spread further from the
 * easy route and from each other. Proves:
 *
 *  1. rooms deal inkRev 11 (LIVE_BANDS too); inkRev 10 and every older stamp keep their play and scores (the
 *     recorded inkRev 10 runs and the legacy fixture replay unchanged; ink-x200-check proves them in full);
 *  2. every sample seed deals the same features, each proved as a phone draws it: no wind anywhere, 4 cloud levels,
 *     2 silver coins on each of levels 1–8, one shamrock, the live levels' hand-drawn strokes;
 *  3. the spread: every pickup at least INK_V11_PICKUP_OFF_ROUTE from the easy route, a plain level's star at least
 *     INK_V11_STAR_OFF_ROUTE, the pickups INK_V11_PICKUP_GAP apart (the shamrock INK_V11_SHAMROCK_GAP from the star),
 *     and on average further from the route and from each other than inkRev 10's on the same seeds;
 *  4. the perfect-play ceiling is 200 through the server replay, and recorded inkRev 11 runs replay unchanged;
 *  5. scoring: the skill pay rises to 50 only with every bonus, a perfect run is 200, no input 0, random play low;
 *  6. room identity: different logs see the same dealt run.
 *
 *   bun scripts/ink-v11-check.ts            (~1–2 min)
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  inkBridgeGameFor,
  inkCheckpoint,
  inkFeaturePaid,
  inkPickupSpread,
  inkSilverPerLevel,
  inkWindLevels,
  inkWorldHFor,
  inkX200Proof,
  staticDrawable,
  INK_CLOUD_LEVELS,
  INK_FEATURE_MAX,
  INK_LEVELS,
  INK_REV_EXPAND,
  INK_REV_SPREAD,
  INK_REV_STRICT,
  INK_TALL_H,
  INK_V11_FEATURE_RAW_MAX,
  INK_V11_PICKUP_GAP,
  INK_V11_PICKUP_OFF_ROUTE,
  INK_V11_SHAMROCK_GAP,
  INK_V11_SILVER_PER_LEVEL,
  INK_V11_SKILL_PAY,
  INK_V11_STAR_OFF_ROUTE,
  type InkState,
} from "../src/lib/arcade/inkBridge";
import { replayInkBridgeRun } from "../src/lib/duel/inkBridge";
import { generateInkBridge } from "../src/lib/duel/arcade.server";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { roomSeed } from "./arcade-skill-bands/games";
import { inkOracleRun } from "./ink-x200-oracle";
import { randomInkLog } from "./ink-x200-bands";
import { roomIdentity } from "./room-identity/inkbridge";
import { playRevOf } from "./scoring-targets-revs";

const t0 = performance.now();
const failures: string[] = [];
let checks = 0;
const ok = (cond: unknown, msg: string) => {
  checks++;
  if (!cond) failures.push(msg);
};
const section = (name: string) => console.log(`— ${name}`);

const game = inkBridgeGameFor(INK_REV_SPREAD);
/** Sample seeds: skill-band seed indices (tuning 0–59, fresh 60–259). */
const SAMPLE = [0, 7, 141, 259].map(roomSeed);

/* 1. Dealt stamp; older stamps unchanged. */
section("Rooms deal inkRev 11; older stamps unchanged");
{
  const live = LIVE_BANDS.inkbridge as { rev: number; strictRev?: number };
  ok(playRevOf("inkbridge", generateInkBridge().inkRev) === INK_REV_SPREAD && INK_REV_SPREAD === INK_REV_EXPAND + 1 && playRevOf("inkbridge", live.rev) === INK_REV_SPREAD && live.strictRev === INK_REV_STRICT, "rooms deal inkRev 11's play (inkRev 12 re-scores it on the arcade standard); LIVE_BANDS measures it against inkRev 8");
  ok(roundMaxFor("inkbridge") === 200 && inkWorldHFor(INK_REV_SPREAD) === INK_TALL_H, "still 200 at most, in the 674-tall world");
  const s = game.init(SAMPLE[0]!);
  ok(s.rev === INK_REV_SPREAD && s.worldH === INK_TALL_H && s.silver === 0 && s.shamrocks === 0 && s.tricks === 0 && s.stars === 0, "the state carries the taller world and the counters");
  ok(inkSilverPerLevel(INK_REV_SPREAD) === 2 && inkSilverPerLevel(INK_REV_EXPAND) === 3 && inkWindLevels(INK_REV_SPREAD) === 0 && inkWindLevels(INK_REV_EXPAND) === 3, "two silver coins a level and no wind on inkRev 11; inkRev 10 keeps three and three");
  const fx = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/ink-x200-runs.json.gz")).toString()) as { runs: { who: string; seed: number; raw: string; score: number; levels: number; fails: number; tick: number; checksum: number }[] };
  for (const run of fx.runs) {
    const r = replayInkBridgeRun(run.seed, run.raw, INK_REV_EXPAND);
    ok(!r.flagged && r.score === run.score && r.levels === run.levels && r.fails === run.fails && r.state.tick === run.tick && inkCheckpoint(r.state).checksum === run.checksum, `inkRev 10 ${run.who} seed ${run.seed}: replays to ${r.score} (stored ${run.score})`);
  }
  const legacy = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/ink-expand-legacy.json.gz")).toString()) as { runs: { rev: number; level: string; seed: number; raw: string; score: number; levels: number }[] };
  for (const run of legacy.runs) {
    const r = replayInkBridgeRun(run.seed, run.raw, run.rev);
    ok(!r.flagged && r.score === run.score && r.levels === run.levels, `inkRev ${run.rev} ${run.level} seed ${run.seed}: replays to ${r.score} (stored ${run.score})`);
  }
  console.log(`  ${fx.runs.length} inkRev 10 runs and ${legacy.runs.length} older runs replay unchanged`);
}

/* 2. Fixed, proved features. */
section("Every seed deals the same features, each proved; no wind");
for (const seed of SAMPLE) {
  const s = game.init(seed);
  const bonus = s.list.slice(0, 8);
  ok(s.list.every((l) => !l.wind), `seed ${seed}: no wind zone on any level`);
  ok(bonus.every((l) => l.star && l.starRef) && s.list.slice(8).every((l) => !l.star && !l.silver && !l.clouds), `seed ${seed}: an ink star on each of levels 1–8, none on the live levels`);
  ok(bonus.filter((l) => l.clouds?.length).length === INK_CLOUD_LEVELS, `seed ${seed}: exactly ${INK_CLOUD_LEVELS} cloud levels`);
  ok(bonus.every((l) => l.silver?.length === INK_V11_SILVER_PER_LEVEL) && s.list.filter((l) => l.shamrock).length === 1, `seed ${seed}: ${INK_V11_SILVER_PER_LEVEL} silver coins on each of levels 1–8 (16 a run) and one shamrock`);
  ok(s.list.slice(8).every((l) => l.liveHand?.length === 1), `seed ${seed}: each live level has its hand-drawn live stroke`);
  for (const l of inkX200Proof(seed, INK_REV_SPREAD)) {
    const where = `seed ${seed} level ${l.level + 1} (${l.kind})`;
    ok(l.kind !== "wind", `${where}: not a wind level`);
    if (l.level < 8) ok(staticDrawable(l) && l.silver === INK_V11_SILVER_PER_LEVEL, `${where}: the reference holds, the bonus line takes the star and all ${l.silver} silver coins${l.shamrock === null ? "" : " and the shamrock"} as a phone draws it`);
    else ok(l.ref && l.hand && !l.unaided, `${where}: the hand-drawn live stroke pots (also started 5 ticks late)`);
  }
}
console.log(`  ${SAMPLE.length} seeds: every count fixed, every line proved`);

/* 3. The spread. */
section("Pickups spread out: further from the easy route and from each other");
{
  const sums = { 10: { route: 0, pair: 0, n: 0 }, 11: { route: 0, pair: 0, n: 0 } } as Record<number, { route: number; pair: number; n: number }>;
  for (const seed of SAMPLE)
    for (const rev of [INK_REV_EXPAND, INK_REV_SPREAD]) {
      const s = inkBridgeGameFor(rev).init(seed);
      s.list.slice(0, 8).forEach((lvl, i) => {
        const g = inkPickupSpread(lvl, i);
        sums[rev]!.route += g.route;
        sums[rev]!.pair += g.pair;
        sums[rev]!.n++;
        if (rev !== INK_REV_SPREAD) return;
        const where = `seed ${seed} level ${i + 1}`;
        ok(g.route >= INK_V11_PICKUP_OFF_ROUTE - 0.01, `${where}: every pickup at least ${INK_V11_PICKUP_OFF_ROUTE} px from the easy route (${g.route.toFixed(1)})`);
        if (!lvl.clouds?.length) ok(g.star >= INK_V11_STAR_OFF_ROUTE - 0.01, `${where}: the star at least ${INK_V11_STAR_OFF_ROUTE} px from the easy route (${g.star.toFixed(1)})`);
        ok(g.pair >= INK_V11_PICKUP_GAP - 0.01, `${where}: the star and pickups at least ${INK_V11_PICKUP_GAP} px apart (${g.pair.toFixed(1)})`);
        if (g.shamrockStar !== null) ok(g.shamrockStar >= INK_V11_SHAMROCK_GAP - 0.01, `${where}: the shamrock at least ${INK_V11_SHAMROCK_GAP} px from the star (${g.shamrockStar.toFixed(1)})`);
      });
    }
  const avg = (rev: number, k: "route" | "pair") => sums[rev]![k] / sums[rev]!.n;
  ok(avg(11, "route") > avg(10, "route") && avg(11, "pair") > avg(10, "pair"), `on average further from the route (${avg(10, "route").toFixed(0)} → ${avg(11, "route").toFixed(0)} px) and from each other (${avg(10, "pair").toFixed(0)} → ${avg(11, "pair").toFixed(0)} px) than inkRev 10`);
  console.log(`  nearest pickup to the route ${avg(10, "route").toFixed(1)} → ${avg(11, "route").toFixed(1)} px, nearest two pickups ${avg(10, "pair").toFixed(1)} → ${avg(11, "pair").toFixed(1)} px (inkRev 10 → 11, mean over ${sums[11]!.n} levels)`);
}

/* 4. Ceiling and recorded runs. */
section("The perfect-play ceiling is 200; recorded inkRev 11 runs replay unchanged");
for (const seed of SAMPLE.slice(1, 3)) {
  const o = inkOracleRun(seed, INK_REV_SPREAD);
  ok(o.replayed === o.score && o.score === 200 && o.levels === INK_LEVELS && o.raw === INK_V11_FEATURE_RAW_MAX, `seed ${seed}: the perfect run scores ${o.replayed} (raw ${o.raw}/${INK_V11_FEATURE_RAW_MAX}, ${o.levels} levels, ${o.endedSeconds.toFixed(1)} s)`);
}
{
  const fx = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/ink-v11-runs.json.gz")).toString()) as { rev: number; runs: { who: string; seed: number; raw: string; score: number; levels: number; fails: number; tick: number; checksum: number }[] };
  ok(fx.rev === INK_REV_SPREAD && fx.runs.length >= 14 && fx.runs.some((r) => r.who === "perfect"), "bot runs at four levels and perfect runs recorded on inkRev 11");
  for (const run of fx.runs) {
    const r = replayInkBridgeRun(run.seed, run.raw, INK_REV_SPREAD);
    ok(!r.flagged && r.score === run.score && r.levels === run.levels && r.fails === run.fails && r.state.tick === run.tick && inkCheckpoint(r.state).checksum === run.checksum, `inkRev 11 ${run.who} seed ${run.seed}: replays to ${r.score} (stored ${run.score})`);
    if (run.who === "perfect") ok(r.score === 200, `the stored perfect run on seed ${run.seed} scores 200 (${r.score})`);
  }
}

/* 5. Scoring. */
section("Scoring: the skill pay, the 200 cap, no input, random input; the help");
{
  let prev = -1;
  let rises = true;
  const top = INK_V11_SKILL_PAY.units[INK_V11_SKILL_PAY.units.length - 1]!;
  for (let raw = 0; raw <= INK_V11_FEATURE_RAW_MAX + 40; raw++) {
    const p = inkFeaturePaid(raw, INK_REV_SPREAD);
    if (p < prev || p > INK_FEATURE_MAX || (raw < top && p >= INK_FEATURE_MAX)) rises = false;
    prev = p;
  }
  ok(rises && top === INK_V11_FEATURE_RAW_MAX && inkFeaturePaid(INK_V11_FEATURE_RAW_MAX, INK_REV_SPREAD) === INK_FEATURE_MAX && inkFeaturePaid(0, INK_REV_SPREAD) === 0, `the skill pay rises, never passes 50 and pays 50 only with every bonus (raw ${INK_V11_FEATURE_RAW_MAX})`);
  const s = game.init(SAMPLE[0]!);
  ok(game.score({ ...s, acted: 1, levels: INK_LEVELS, ended: 1, endedTick: 1, tick: 1, stars: 99, tricks: 99, silver: 999, shamrocks: 9 }) === 200, "a perfect run scores exactly 200, whatever the counters say");
  ok(game.score({ ...s, acted: 0 }) === 0, "no input scores 0");
  const randoms = [0, 1, 2, 3, 4, 5].map((n) => {
    const seed = roomSeed(n);
    const ev = randomInkLog(INK_REV_SPREAD, seed);
    let r = game.init(seed) as InkState;
    const byTick = new Map(ev.map((e) => [e.t, e]));
    while (!game.isOver(r) && r.tick < game.runTicks) r = game.step(r, byTick.get(r.tick + 1) ?? null);
    return game.score(r);
  });
  ok(Math.max(...randoms) <= 60, `random input stays near 0 (${randoms.join(", ")})`);
  const help = PUZZLE_INSTRUCTIONS.inkbridge.how.map((h) => `${h.action} ${h.detail}`).join(" ");
  ok(!/wind/i.test(help) && help.includes(`${INK_V11_SILVER_PER_LEVEL} silver coins`), "the help names two silver coins a level and no wind");
}

/* 6. Room identity. */
section("Room identity: different logs see the same dealt run");
for (const seed of SAMPLE.slice(0, 1)) {
  const logs = roomIdentity.logs(seed);
  ok(roomIdentity.rev === generateInkBridge().inkRev && playRevOf("inkbridge", roomIdentity.rev) === INK_REV_SPREAD, "room identity is measured on the dealt stamp (inkRev 11's play)");
  const lists = logs.map((log) => JSON.stringify(roomIdentity.scheduleOf(seed, INK_REV_SPREAD, log)));
  ok(lists.every((l) => l === lists[0]) && lists[0]!.length > 100 && !lists[0]!.includes("wind"), `seed ${seed}: ${logs.length} logs (idle, random, weak, elite, perfect) see the same levels and features`);
  const ends = logs.map((log) => {
    let r = game.init(seed) as InkState;
    const byTick = new Map(log.map((e) => [e.t, e]));
    while (!game.isOver(r) && r.tick < game.runTicks) r = game.step(r, byTick.get(r.tick + 1) ?? null);
    return r.levels;
  });
  ok(new Set(ends).size >= 3, `seed ${seed}: the logs really differ (levels reached ${ends.join(", ")})`);
}

if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  console.log(`FAIL ink-v11-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS ink-v11-check: ${checks} checks in ${((performance.now() - t0) / 1000).toFixed(1)} s — inkRev 11 dealt, older stamps unchanged, no wind, fixed and proved features spread out, a 200 ceiling and recorded runs through the server replay, the scoring, room identity`);
