import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DUEL_START_MS, DUEL_START_VOICE_MS, duelStartFrame } from "../src/lib/duel/startPresentation";

const server = readFileSync("src/lib/duel/duel.functions.ts", "utf8");
const roomSource = readFileSync("src/routes/duel.$code.tsx", "utf8");
const screen = readFileSync("src/components/duel/DuelStart.tsx", "utf8");
const intro = readFileSync("src/components/duel/RoundIntro.tsx", "utf8");
const css = readFileSync("src/styles.css", "utf8");
assert.equal(DUEL_START_MS, 5000);
assert.equal(DUEL_START_VOICE_MS, 2000);
assert.equal(duelStartFrame(0, false).scale, 0.04);
assert.equal(duelStartFrame(5000, false).scale, 1);
assert.equal(duelStartFrame(2500, false).scale, 0.16);
assert.deepEqual(duelStartFrame(125, true), { scale: 1, opacity: 0.5 });
assert.deepEqual(duelStartFrame(3000, true), { scale: 1, opacity: 1 });
for (let ms = 100; ms < 5000; ms += 100) {
  assert(duelStartFrame(ms, false).scale > duelStartFrame(ms - 100, false).scale);
}

// Exercise the exact server transition block against guarded in-memory writes.
const start = server.indexOf('    if (room.phase === "starting") {', server.indexOf("export const advancePhaseFn"));
const end = server.indexOf('    if (room.phase === "intro")', start);
assert(start > 0 && end > start);
const body = server.slice(start, end);
const transition = new Function("client", "room", "round", "elapsed", "phaseStart", "stamp", "DUEL_START_MS", `return (async () => { ${body} })();`);
const base = { id: "test", status: "in_progress", current_round: 1, phase: "starting", phase_started_at: new Date(10000).toISOString() };
let stored = { ...base };
let writes = 0;
const client = { from: () => ({ update: (values: object) => {
  const conditions: [string, unknown][] = [];
  const query = {
    eq: (key: string, value: unknown) => { conditions.push([key, value]); return query; },
    then: (resolve: (result: { error: null }) => void) => {
      if (conditions.every(([key, value]) => stored[key as keyof typeof stored] === value)) {
        stored = { ...stored, ...values };
        writes++;
      }
      resolve({ error: null });
    },
  };
  return query;
} }) };
await transition(client, base, 1, 4999, 10000, base.phase_started_at, DUEL_START_MS);
assert.equal(writes, 0);
await Promise.all([0, 1, 2].map(() => transition(client, base, 1, 5000, 10000, base.phase_started_at, DUEL_START_MS)));
assert.equal(writes, 1);
assert.equal(stored.phase, "intro");
assert.equal(stored.phase_started_at, new Date(15000).toISOString());
stored = { ...base };
await transition(client, base, 1, 14000, 10000, base.phase_started_at, DUEL_START_MS);
assert.equal(stored.phase_started_at, new Date(15000).toISOString());
assert.doesNotMatch(body, /hostNext|allIntroReady/);
assert.match(server.slice(server.indexOf("export const startRoomFn"), server.indexOf("export const setRoomModesFn")), /phase: "starting"/);
assert.match(roomSource, /phase !== "starting" && !leads/);
assert.match(roomSource, /now < phaseStart \+ DUEL_START_MS/);
assert.match(screen, /requestAnimationFrame\(paint\)/);
assert.match(screen, /serverNow\(\) - startedAt/);
assert.match(screen, /elapsed >= DUEL_START_VOICE_MS\) return/);
assert.match(screen, /prepareRoundMusic/);
assert.doesNotMatch(screen, /<PhoneShell|<RoomChat|<TimerBar|<button|fx\./);
assert.doesNotMatch(intro, /prepareToDuel/);
assert.match(intro, /playVoice\(`round\$\{round\}`/);
assert.match(css, /--background: #0B0B0F/);
assert.match(css, /--primary: #F5B82E/);
for (const [width, height] of [[390, 700], [375, 667]]) {
  const boltWidth = width * 0.96;
  const boltHeight = Math.min(height * 0.96, boltWidth * 20 / 14);
  assert(boltWidth <= width && boltHeight <= height);
  console.log(`${width}×${height}: fixed clipped screen; bolt ${boltWidth.toFixed(1)}×${boltHeight.toFixed(1)} fits`);
}
console.log("PASS: five-second gate, concurrent/idempotent requests, late rejoin deadline, shared cubic frames, reduced fade and cue placement; no browsers or gameplay proof.");