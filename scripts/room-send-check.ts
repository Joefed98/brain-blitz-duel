/**
 * room-send-check (19 Oct 2026, room flow only): a room answer that fails on the way is sent again
 * (src/lib/duel/roomSend.ts), #115's audit item 4.
 *
 *  1. A send that throws is retried, the same answer and time claim, after its backoff, until it
 *     lands; never sooner than the backoff, never two at once.
 *  2. One answer per round: once the stage's answer (or the time-out's draft) is on its way, no other
 *     answer for that round is sent, failed or not; a new round sends again.
 *  3. A reply from the server (stored, already stored, "That round is over") is never retried; a
 *     failed send stops being retried once the round stops taking answers.
 *  4. The room page sends every answer through the sender (the stage's own submit and the time-out),
 *     and retries on its clock tick while the round is in the puzzle or reveal phase.
 *
 *   bun scripts/room-send-check.ts
 */
import { readFileSync } from "node:fs";

import { createRoomSender, ROOM_SEND_RETRY_MS, type RoomSendPayload } from "../src/lib/duel/roomSend";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
const payload = (answer: string, msRemaining = 0): RoomSendPayload => ({ duelId: "room", roundNumber: 1, answer, msRemaining });

/* ------------------------------------------------------------ 1. retried after its backoff */
for (const failuresBefore of [0, 1, 3, 8]) {
  const sent: RoomSendPayload[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const sender = createRoomSender(async (p) => {
    sent.push(p);
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await settle();
    inFlight--;
    if (sent.length <= failuresBefore) throw new Error("network");
    return { ok: true };
  });
  let now = 10_000;
  let lastSendAt = now;
  check(sender.send("room-1", payload("FLOW:1-2-3", 41_250), now), `first send refused (${failuresBefore})`);
  await settle();
  await settle();
  for (let step = 0; step < 4000 && sender.status("room-1").status !== "landed"; step++) {
    const before = sent.length;
    now += 25;
    sender.tick("room-1", now, true);
    if (sent.length > before) {
      // The wait before this retry was at least its backoff.
      const attempt = sent.length - 1;
      const wait = ROOM_SEND_RETRY_MS[Math.min(attempt, ROOM_SEND_RETRY_MS.length) - 1]!;
      check(now - lastSendAt >= wait, `retry ${attempt} came ${now - lastSendAt} ms after the last, before its ${wait} ms backoff`);
      lastSendAt = now;
    }
    await settle();
    await settle();
  }
  check(sender.status("room-1").status === "landed", `${failuresBefore} failures: never landed (${sender.status("room-1").status})`);
  check(sent.length === failuresBefore + 1, `${failuresBefore} failures: sent ${sent.length} times`);
  check(sent.every((p) => p.answer === "FLOW:1-2-3" && p.msRemaining === 41_250), `${failuresBefore} failures: a retry changed the answer or its time`);
  check(maxInFlight === 1, `${failuresBefore} failures: ${maxInFlight} sends at once`);
}

/* ------------------------------------------------------------ 2. one answer per round */
{
  const sent: RoomSendPayload[] = [];
  const sender = createRoomSender(async (p) => {
    sent.push(p);
    await settle();
    throw new Error("down");
  });
  sender.send("room-1", payload("stage"), 0);
  check(sender.claimed("room-1"), "a sent round is not claimed");
  await settle();
  check(!sender.send("room-1", payload("draft"), 100), "a time-out draft went beside the stage's failed answer");
  sender.tick("room-1", 100_000, true);
  await settle();
  check(sent.every((p) => p.answer === "stage"), "a round sent a second answer");
  check(!sender.claimed("room-2"), "the next round is claimed before it sends");
  check(sender.send("room-2", { ...payload("next"), roundNumber: 2 }, 200), "the next round could not send");
}

/* ------------------------------------------------------------ 3. replies never retried; closed rounds stop */
for (const reply of [{ ok: true }, { ok: true, alreadySubmitted: true }, { ok: false, message: "That round is over." }]) {
  let calls = 0;
  const sender = createRoomSender(async () => {
    calls++;
    return reply;
  });
  sender.send("k", payload("a"), 0);
  await settle();
  for (let t = 0; t < 30_000; t += 100) sender.tick("k", t, true);
  await settle();
  check(calls === 1 && sender.status("k").status === "landed", `reply ${JSON.stringify(reply)} was retried (${calls})`);
}
{
  let calls = 0;
  const sender = createRoomSender(async () => {
    calls++;
    throw new Error("down");
  });
  sender.send("k", payload("a"), 0);
  await settle();
  sender.tick("k", 60_000, false);
  for (let t = 60_000; t < 120_000; t += 100) sender.tick("k", t, true);
  await settle();
  check(calls === 1 && sender.status("k").status === "given-up", `a closed round kept retrying (${calls}, ${sender.status("k").status})`);
}

/* ------------------------------------------------------------ 4. the room page uses it */
{
  const route = readFileSync(new URL("../src/routes/duel.$code.tsx", import.meta.url), "utf8");
  const direct = route.match(/submitAnswer\(/g)?.length ?? 0;
  check(direct === 1 && /createRoomSender\(\(payload\) => submitAnswer\(payload\)\)/.test(route), `the room page calls submitAnswer outside the sender (${direct})`);
  check((route.match(/sender\.send\(/g)?.length ?? 0) === 2, "the stage's submit and the time-out do not both go through the sender");
  check(/sender\.tick\(key, now, phase === "puzzle" \|\| phase === "reveal"\)/.test(route), "the room page does not retry while the round takes answers");
  check(!/\.catch\(/.test(route.slice(route.indexOf("const handleSubmit"), route.indexOf("const handleDraftAnswer"))), "the stage's submit still swallows its failure");
}

if (failures.length) {
  console.log(failures.map((f) => `FAIL ${f}`).join("\n"));
  console.log(`room-send-check: FAIL (${failures.length} failed, ${passes} passed)`);
  process.exit(1);
}
console.log(`room-send-check: PASS (${passes} checks)`);
