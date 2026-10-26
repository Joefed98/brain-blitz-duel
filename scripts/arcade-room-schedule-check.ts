/**
 * arcade-room-schedule-check (26 Oct 2026, the arcade rule): two players in the same room get identical spawns,
 * pickups, par times and schedules whatever they do. For every 200-point expansion module in scripts/x200/
 * (Hover, Grappler and Roofbound), each room deal is played with every input style (idle, random, the
 * weak, good and elite skill-band players) through the real sim; at every tick each scheduled item a run shows
 * is compared with the same item in every other run, and the deal's guaranteed opportunity counts must agree.
 * ~1 min.
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
// The expansions shipped (Scrumper is left out; docs/expansions/x200.md).
const EXPECTED = ["flip", "hover", "swing"];
for (const type of EXPECTED) if (!mods.includes(`${type}.ts`)) fail(`${type}: no scripts/x200/${type}.ts room module`);

for (const file of mods) {
  const mod = await import(new URL(`./x200/${file}`, import.meta.url).href);
  const room = mod.x200Room as X200Room | undefined;
  if (!room) continue;
  const t0 = performance.now();
  let items = 0;
  for (let n = 0; n < (room.deals ?? 8); n++) {
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
  console.log(`${room.type} (rev ${room.rev}): ${room.deals ?? 8} deals × ${ROOM_STYLES.length} styles, ${items} scheduled items identical (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
}

if (failures.length) {
  console.log(`\nFAIL arcade-room-schedule-check: ${failures.length} problem(s)`);
  process.exit(1);
}
console.log("\nPASS arcade-room-schedule-check");
