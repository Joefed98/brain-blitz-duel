/**
 * arcade-room-schedule-check (26 Oct 2026, the arcade rule): two players in the same room get identical spawns,
 * pickups, par times and schedules whatever they do. For every 200-point expansion module in scripts/x200/
 * (Hover, Grappler, Roofbound and Scrumper), each room deal is played with every input style (idle, random, the
 * weak, good and elite skill-band players) through the real sim; at every tick each scheduled item a run shows
 * is compared with the same item in every other run, and the deal's guaranteed opportunity counts must agree.
 * ~1 min before Grappler's swingRev 16 (90 s runs on a longer course) took swing's six deals to ~3.5 min; since 1 Nov
 * 2026 --part=k/n runs one of n disjoint groups of (module, deal) pairs, dealt round robin with swing's deals first, so
 * the parts together check exactly what one whole run does (CI runs it in thirds, .github/ci/shards.ts).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readdirSync } from "node:fs";
import { ROOM_STYLES, type X200Room } from "./x200/room";

const failures: string[] = [];
const fail = (msg: string) => {
  failures.push(msg);
  console.log(`FAIL ${msg}`);
};

const mods = readdirSync(new URL("./x200/", import.meta.url))
  .filter((f) => f.endsWith(".ts") && f !== "room.ts" && !f.includes("-"))
  .sort();
// The four expansions shipped (docs/expansions/x200.md).
const EXPECTED = ["flip", "hover", "snip", "swing"];
for (const type of EXPECTED) if (!mods.includes(`${type}.ts`)) fail(`${type}: no scripts/x200/${type}.ts room module`);

const PART_ARG = process.argv.find((a) => a.startsWith("--part="))?.slice(7);
const [PART, PARTS] = PART_ARG ? PART_ARG.split("/").map(Number) : [1, 1];
if (!(Number.isInteger(PART) && Number.isInteger(PARTS) && PART >= 1 && PART <= PARTS)) {
  console.log(`FAIL: bad --part=${PART_ARG} (expected k/n with 1 <= k <= n)`);
  process.exit(1);
}
const rooms: X200Room[] = [];
for (const file of mods) {
  const mod = await import(new URL(`./x200/${file}`, import.meta.url).href);
  if (mod.x200Room) rooms.push(mod.x200Room as X200Room);
}
// Every (module, deal) pair, the slowest module (swing) first, dealt round robin to the parts.
const jobs = rooms
  .slice()
  .sort((a, b) => Number(b.type === "swing") - Number(a.type === "swing"))
  .flatMap((room) => Array.from({ length: room.deals ?? 8 }, (_, n) => ({ room, n })));
const mine = new Set(jobs.filter((_, i) => i % PARTS === PART - 1));

for (const room of rooms) {
  const t0 = performance.now();
  let items = 0;
  let dealt = 0;
  for (const job of jobs) {
    if (job.room !== room || !mine.has(job)) continue;
    const n = job.n;
    dealt++;
    const deal = room.deal(n);
    const seen = new Map<string, { json: string; style: string }>();
    let opp: { json: string; style: string } | null = null;
    const ends = new Set<string>();
    for (const style of ROOM_STYLES) {
      const log = room.play(deal, style);
      const game = deal.game;
      // The full log, looked up by tick (engine.ts's inputAt / tapAt read only the newest entry of a log being recorded).
      const tapSet = log.taps ? new Set(log.taps) : null;
      const byTick = new Map((log.events ?? []).map((e) => [e.t, e]));
      let state = game.init(deal.seed);
      const look = () => {
        for (const [id, d] of Object.entries(room.schedule(state))) {
          const json = JSON.stringify(d);
          const had = seen.get(id);
          if (!had) seen.set(id, { json, style });
          else if (had.json !== json) fail(`${room.type} deal ${n}: ${id} reads ${had.json} for ${had.style} but ${json} for ${style} (tick ${state.tick})`);
        }
      };
      look();
      while (!game.isOver(state) && state.tick < game.runTicks) {
        const t = state.tick + 1;
        state = game.step(state, tapSet ? tapSet.has(t) : (byTick.get(t) ?? null));
        look();
      }
      ends.add(`${state.tick}|${game.score(state)}|${JSON.stringify(state).length}`);
      const o = JSON.stringify(room.opportunities(state));
      if (!opp) opp = { json: o, style };
      else if (opp.json !== o) fail(`${room.type} deal ${n}: opportunities ${opp.json} for ${opp.style} but ${o} for ${style}`);
    }
    // The styles must really have played differently, or the comparison proves nothing.
    if (ends.size < 3) fail(`${room.type} deal ${n}: only ${ends.size} distinct run ends over ${ROOM_STYLES.length} styles (inputs not applied?)`);
    items += seen.size;
  }
  if (dealt) console.log(`${room.type} (rev ${room.rev}): ${dealt} of ${room.deals ?? 8} deals × ${ROOM_STYLES.length} styles, ${items} scheduled items identical (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
}

if (failures.length) {
  console.log(`\nFAIL arcade-room-schedule-check: ${failures.length} problem(s)`);
  process.exit(1);
}
console.log(`\nPASS arcade-room-schedule-check${PARTS > 1 ? ` (part ${PART}/${PARTS})` : ""}`);
