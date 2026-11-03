/**
 * Grappler's swinging course (swingRev 15, `--rev=16` for the dark ledge runs, `--rev=17` for the sliding hooks and the streak) skill bands: every skill-band level
 * (and random play) on room courses roomSeed(from … to − 1), each run through the server's own replay, with the
 * score's three parts. A measuring tool, not a check (swing-rework-check and swing-dark-check hold the stored runs).
 *
 *   bun scripts/swing-rework-bands.ts [--rev=15|16|17] [--from=0] [--to=30] [--levels=weak,average,…] [--json=<out.jsonl>]
 *   bun scripts/swing-rework-bands.ts --report=<a.jsonl,b.jsonl,…>   (medians and ranges from saved runs)
 */
import { appendFileSync, readFileSync } from "node:fs";
import { swingGameFor, swingReworkParts, swingSlideParts, swingAssaultCounts, SWING_REV_REWORK } from "../src/lib/arcade/swing";
import { encodeSwingRun, replaySwingRun } from "../src/lib/duel/swing";
import { roomSeed } from "./arcade-skill-bands/games";
import { Human, ALL_LEVELS, LEVEL_LABEL } from "./arcade-skill-bands/human";
import { bot, randomBot } from "./arcade-skill-bands/bots/swing";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
type Row = { level: string; course: number; seed: number; score: number; core: number; par: number; pickups: number; stretches: number; restarts: number; endedSeconds: number; permille?: number; gates?: number; streak?: number };

const report = arg("report");
if (report) {
  const rows: Row[] = report.split(",").flatMap((f) => readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as Row));
  const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.trunc(xs.length / 2)]!;
  console.log(`| Level | Median | Range | Core | Par | Pickups (rev 17: gates + streak) | Course ‰ | Restarts | Courses |`);
  console.log(`|---|---|---|---|---|---|---|---|---|`);
  for (const level of [...ALL_LEVELS, "random"]) {
    const r = rows.filter((x) => x.level === level);
    if (!r.length) continue;
    const s = r.map((x) => x.score);
    console.log(`| ${level === "random" ? "Random" : LEVEL_LABEL[level as keyof typeof LEVEL_LABEL]} | ${med(s)} | ${Math.min(...s)}–${Math.max(...s)} | ${med(r.map((x) => x.core))} | ${med(r.map((x) => x.par))} | ${med(r.map((x) => x.pickups))} | ${med(r.map((x) => x.permille ?? -1))} | ${med(r.map((x) => x.restarts))} | ${r.length} |`);
  }
  const courses = [...new Set(rows.map((x) => x.course))];
  const at = (level: string, c: number) => rows.find((x) => x.level === level && x.course === c)?.score ?? NaN;
  const ordered = courses.filter((c) => at("perfect", c) > at("great", c) && at("great", c) > at("good", c)).length;
  console.log(`\nflawless > great > good on ${ordered} of ${courses.length} courses`);
  process.exit(0);
}

const from = Number(arg("from") ?? 0);
const to = Number(arg("to") ?? 30);
const levels = (arg("levels") ?? [...ALL_LEVELS, "random"].join(",")).split(",");
const out = arg("json");
const rev = Number(arg("rev") ?? SWING_REV_REWORK);
const game = swingGameFor(rev);
for (let n = from; n < to; n++) {
  const seed = roomSeed(n);
  for (const level of levels) {
    const human = new Human("swing", seed, (level === "random" ? "weak" : level) as never);
    const ctx = { game, seed, rev, human };
    const res = level === "random" ? randomBot(ctx) : bot(ctx);
    const events = res.events ?? [];
    const byTick = new Map(events.map((e) => [e.t, e]));
    let s = game.init(seed);
    while (!game.isOver(s) && s.tick < game.runTicks) s = game.step(s, byTick.get(s.tick + 1) ?? null);
    const raw = encodeSwingRun({ seed, claimedScore: game.score(s), events, inputs: [], taps: [], endTick: s.tick, checkpoints: [] } as never);
    const result = replaySwingRun(seed, raw, rev);
    const c = swingAssaultCounts(result.state);
    // swingRev 17: core, pars, gates and the streak (pickups = gates + streak).
    const q = result.state.slide ? swingSlideParts(result.state) : null;
    const p = q ? { core: q.core, par: q.par, pickups: q.gates + q.streak, permille: q.permille } : swingReworkParts(result.state);
    const row: Row = { level, course: n, seed, score: result.score, core: p.core, par: p.par, pickups: p.pickups, stretches: c.sections, restarts: c.restarts, endedSeconds: result.state.endedTick / 60, permille: p.permille, ...(q ? { gates: q.gates, streak: q.streak } : {}) };
    if (out) appendFileSync(out, `${JSON.stringify(row)}\n`);
    console.log(`${level.padEnd(8)} course ${n} (${seed}): ${row.score} = ${p.core} + ${p.par} + ${p.pickups}${q ? ` (gates ${q.gates}, streak ${q.streak})` : ""} · ${p.permille} ‰ · ${c.sections}/${c.sectionTotal} stretches · ${c.restarts} restarts`);
  }
}
