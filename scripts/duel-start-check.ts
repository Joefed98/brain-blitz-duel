import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DUEL_START_MS,
  DUEL_START_VOICE_MS,
  ROUND_TITLE_MS,
  ROUND_TITLE_VOICE_MS,
  ROUND_TITLE_VOICE_CUTOFF_MS,
  duelStartFrame,
  roundTitleFrame,
} from "../src/lib/duel/startPresentation";

const server = readFileSync("src/lib/duel/duel.functions.ts", "utf8");
const roomSource = readFileSync("src/routes/duel.$code.tsx", "utf8");
const screen = readFileSync("src/components/duel/DuelStart.tsx", "utf8");
const intro = readFileSync("src/components/duel/RoundIntro.tsx", "utf8");
const css = readFileSync("src/styles.css", "utf8");
const title = readFileSync("src/components/duel/RoundTitle.tsx", "utf8");
assert.equal(DUEL_START_MS, 6000);
assert.equal(DUEL_START_VOICE_MS, 2000);
assert.equal(duelStartFrame(0, false).scale, 0.04);
assert.equal(duelStartFrame(6000, false).scale, 1);
assert.equal(duelStartFrame(3000, false).scale, 0.16);
assert.deepEqual(duelStartFrame(125, true), { scale: 1, opacity: 0.5 });
assert.deepEqual(duelStartFrame(3000, true), { scale: 1, opacity: 1 });
for (let ms = 100; ms < 6000; ms += 100) {
  assert(duelStartFrame(ms, false).scale > duelStartFrame(ms - 100, false).scale);
}

// Exercise the exact server transition block against guarded in-memory writes.
const start = server.indexOf(
  '    if (room.phase === "starting") {',
  server.indexOf("export const advancePhaseFn"),
);
const end = server.indexOf('    if (room.phase === "round_title")', start);
assert(start > 0 && end > start);
const body = server.slice(start, end);
const transition = new Function(
  "client",
  "room",
  "round",
  "elapsed",
  "phaseStart",
  "stamp",
  "DUEL_START_MS",
  `return (async () => { ${body} })();`,
);
const base = {
  id: "test",
  status: "in_progress",
  current_round: 1,
  phase: "starting",
  phase_started_at: new Date(10000).toISOString(),
};
let stored = { ...base };
let writes = 0;
const client = {
  from: () => ({
    update: (values: object) => {
      const conditions: [string, unknown][] = [];
      const query = {
        eq: (key: string, value: unknown) => {
          conditions.push([key, value]);
          return query;
        },
        then: (resolve: (result: { error: null }) => void) => {
          if (conditions.every(([key, value]) => stored[key as keyof typeof stored] === value)) {
            stored = { ...stored, ...values };
            writes++;
          }
          resolve({ error: null });
        },
      };
      return query;
    },
  }),
};
await transition(client, base, 1, 5999, 10000, base.phase_started_at, DUEL_START_MS);
assert.equal(writes, 0);
await Promise.all(
  [0, 1, 2].map(() =>
    transition(client, base, 1, 6000, 10000, base.phase_started_at, DUEL_START_MS),
  ),
);
assert.equal(writes, 1);
assert.equal(stored.phase, "round_title");
assert.equal(stored.phase_started_at, new Date(16000).toISOString());
stored = { ...base };
await transition(client, base, 1, 14000, 10000, base.phase_started_at, DUEL_START_MS);
assert.equal(stored.phase_started_at, new Date(16000).toISOString());
assert.doesNotMatch(body, /hostNext|allIntroReady/);
assert.match(
  server.slice(
    server.indexOf("export const startRoomFn"),
    server.indexOf("export const setRoomModesFn"),
  ),
  /phase: "starting"/,
);
assert.match(roomSource, /phase !== "starting" &&\s+phase !== "round_title" &&/);
assert.match(roomSource, /now < phaseStart \+ DUEL_START_MS/);
assert.match(screen, /requestAnimationFrame\(paint\)/);
assert.match(screen, /serverNow\(\) - startedAt/);
assert.match(screen, /elapsed >= DUEL_START_VOICE_MS\) return/);
assert.match(screen, /prepareRoundMusic/);
assert.doesNotMatch(screen, /<PhoneShell|<RoomChat|<TimerBar|<button|fx\./);
assert.doesNotMatch(intro, /prepareToDuel/);
assert.doesNotMatch(intro, /playVoice|finalRound|`round\$\{round\}`/);
assert.match(intro, /if \(practice\) prepareRoundMusic/);
assert.equal(ROUND_TITLE_MS, 3000);
assert.equal(ROUND_TITLE_VOICE_MS, 200);
assert.equal(ROUND_TITLE_VOICE_CUTOFF_MS, 1000);
assert.deepEqual(roundTitleFrame(0, false), { titleOpacity: 0, categoryOpacity: 0, scale: 0.96 });
assert.equal(roundTitleFrame(200, false).categoryOpacity, 0);
assert.deepEqual(roundTitleFrame(500, false), { titleOpacity: 1, categoryOpacity: 1, scale: 1 });
assert.equal(roundTitleFrame(2850, false).titleOpacity, 0.5);
assert.equal(roundTitleFrame(2850, false).categoryOpacity, 0.5);
assert.equal(roundTitleFrame(100, true).scale, 1);
assert.equal(roundTitleFrame(3000, true).titleOpacity, 0);
const titleBody = server.slice(end, server.indexOf('    if (room.phase === "intro")', end));
const titleTransition = new Function(
  "client",
  "room",
  "round",
  "elapsed",
  "phaseStart",
  "stamp",
  "ROUND_TITLE_MS",
  `return (async () => { ${titleBody} })();`,
);
const titleBase = {
  ...base,
  phase: "round_title",
  phase_started_at: new Date(16000).toISOString(),
};
stored = { ...titleBase };
writes = 0;
await titleTransition(
  client,
  titleBase,
  1,
  2999,
  16000,
  titleBase.phase_started_at,
  ROUND_TITLE_MS,
);
assert.equal(writes, 0);
await Promise.all(
  [0, 1, 2].map(() =>
    titleTransition(client, titleBase, 1, 3000, 16000, titleBase.phase_started_at, ROUND_TITLE_MS),
  ),
);
assert.equal(writes, 1);
assert.equal(stored.phase, "intro");
assert.equal(stored.phase_started_at, new Date(19000).toISOString());
stored = { ...titleBase };
await titleTransition(
  client,
  titleBase,
  1,
  15000,
  16000,
  titleBase.phase_started_at,
  ROUND_TITLE_MS,
);
assert.equal(stored.phase_started_at, new Date(19000).toISOString());
assert.doesNotMatch(titleBody, /hostNext|allIntroReady/);
assert.match(server, /current_round: round \+ 1,\s+phase: "round_title"/);
assert.match(title, /puzzleDef\(type\)\.category/);
assert.match(title, /elapsed > ROUND_TITLE_VOICE_CUTOFF_MS\) return/);
assert.match(title, /prepareRoundMusic/);
assert.doesNotMatch(title, /<PhoneShell|<RoomChat|<TimerBar|<button|puzzleName/);
assert.match(css, /--background: #0B0B0F/);
assert.match(css, /--primary: #F5B82E/);
for (const [width, height] of [
  [390, 700],
  [375, 667],
]) {
  const boltWidth = width * 0.96;
  const boltHeight = Math.min(height * 0.96, (boltWidth * 20) / 14);
  assert(boltWidth <= width && boltHeight <= height);
  console.log(
    `${width}×${height}: fixed clipped screen; bolt ${boltWidth.toFixed(1)}×${boltHeight.toFixed(1)} fits`,
  );
}
console.log(
  "PASS: six-second start and three-second title gates, concurrent/idempotent transitions, late rejoin deadlines, shared frames, reduced motion, cue/preload placement; no browsers or gameplay proof.",
);
