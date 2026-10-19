/**
 * finished-pings-check (17 Oct 2026): live "finished" pings in rooms (presentation and room data
 * only; src/lib/duel/finishedPings.ts, finishedPing.server.ts, FinishedPings.tsx, the
 * 20261017140000 migration).
 *
 *  1. Pings appear only for players whose answer is stored: random rooms of 2–10 players play
 *     rounds where some submit (through the real markSubmitted, after their round_results row, on an
 *     in-memory database); on every phone, at every step, the pings shown are exactly the other
 *     players who have a stored row this round, never the viewer, a player who left, or a
 *     submission from another round, and each is announced once.
 *  2. Pings never carry result data: a ping is { slot, name } and nothing else; the strip drawn
 *     with the real component holds no score, answer, verdict or time, even when the player rows
 *     handed in carry them; the server writes only `submitted_round`, a round number.
 *  3. Several finishing together combine: "Sam and Ali finished", "Sam, Ali and Jo finished",
 *     "Sam, Ali and 3 others finished", the badges of the first three.
 *  4. Before the migration: rows without the field never ping, and markSubmitted / clearSubmitted
 *     never throw when the update fails (submitting and Play again carry on).
 *  5. Wiring: submitAnswerFn marks only after the result row is stored (and its error checked), and
 *     only for a finish before the buzzer (18 Oct 2026: never a time-out, an answer sent at the buzzer
 *     or a late one; buzzer.ts, proved per game by round-time-check);
 *     rematchFn clears after the restart; the room shows pings only in the live puzzle phase;
 *     practice and replays never show them; no sound; the migration adds the one column with a
 *     range check and no grant or policy, and no client code writes duel_players.
 *
 *   bun scripts/finished-pings-check.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { memoryDb } from "./fixtures/memoryDb";
import { FinishedPingStrip } from "../src/components/duel/FinishedPings";
import { clearSubmitted, markSubmitted } from "../src/lib/duel/finishedPing.server";
import { finishedThisRound, newFinishers, pingText, type FinishedPing } from "../src/lib/duel/finishedPings";
import { resolvePlayerLooks } from "../src/lib/duel/playerLook";
import type { DuelPlayerRow } from "../src/lib/duel/types";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else if (failures.length < 40) failures.push(message);
}

let seed = 20261017;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const int = (n: number) => Math.floor(rand() * n);
const NAMES = ["Sam", "Ali", "Jo", "Priya", "Kwame", "Lena", "Tom", "Mia", "Zed", "Ana"];

function player(slot: number, extra: Partial<DuelPlayerRow> = {}): DuelPlayerRow {
  return {
    id: `p${slot}`,
    duel_id: "room",
    player_slot: slot,
    display_name: NAMES[slot - 1]!,
    user_id: `u${slot}`,
    ready_round: 0,
    intro_ready_round: 0,
    muted_by_host: false,
    last_reaction_at: null,
    last_seen_at: new Date(0).toISOString(),
    status: "active",
    joined_at: new Date(0).toISOString(),
    submitted_round: 0,
    ...extra,
  };
}

/* 1. Only players with a stored answer; each announced once. */
for (let room = 0; room < 300; room++) {
  const size = 2 + int(9);
  const rows = Array.from({ length: size }, (_, i) => player(i + 1));
  const results: { player_slot: number; round_number: number }[] = [];
  const { client } = memoryDb({ duel_players: rows as unknown as Record<string, unknown>[] });
  // The in-memory table updates these same row objects, as a phone's refetch would see them.
  const live = rows;
  const announced = new Map<number, Set<number>>(); // viewer → slots announced this round
  for (let round = 1; round <= 6; round++) {
    for (const viewer of live) announced.set(viewer.player_slot, new Set());
    // A player sometimes leaves mid-game.
    if (rand() < 0.1) live[int(size)]!.status = "left";
    const order = live.map((p) => p.player_slot);
    for (let i = order.length - 1; i > 0; i--) {
      const j = int(i + 1);
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    const submitting = order.filter(() => rand() < 0.75);
    for (const slot of submitting) {
      const row = live.find((p) => p.player_slot === slot)!;
      if (row.status === "left") continue;
      results.push({ player_slot: slot, round_number: round });
      await markSubmitted(client, row.id, round);
      // Every phone looks after each write.
      for (const viewer of live) {
        const pings = finishedThisRound(live, round, viewer.player_slot);
        const stored = new Set(results.filter((r) => r.round_number === round).map((r) => r.player_slot));
        const want = live
          .filter((p) => p.player_slot !== viewer.player_slot && p.status !== "left" && stored.has(p.player_slot))
          .map((p) => p.player_slot)
          .sort((a, b) => a - b);
        const got = pings.map((p) => p.slot);
        if (JSON.stringify(got) !== JSON.stringify(want)) {
          check(false, `room ${room} round ${round} viewer ${viewer.player_slot}: pings ${got} but stored ${want}`);
        }
        const seen = announced.get(viewer.player_slot)!;
        for (const p of newFinishers(pings, seen)) {
          if (seen.has(p.slot)) check(false, `room ${room}: slot ${p.slot} announced twice`);
          seen.add(p.slot);
        }
      }
    }
    // Earlier rounds never ping in later ones.
    for (const viewer of live)
      check(
        finishedThisRound(live, round + 1, viewer.player_slot).length === 0,
        `room ${room}: round ${round}'s finishers pinged in round ${round + 1}`,
      );
  }
  passes++;
}

/* 2. No result data, ever. */
{
  const leaky = [1, 2, 3].map((slot) => ({
    ...player(slot, { submitted_round: 2 }),
    // Fields a careless caller might hand in: none may reach a ping.
    score: 137,
    answer: "SECRET-ANSWER",
    is_correct: true,
    ms_remaining: 4321,
  })) as unknown as DuelPlayerRow[];
  const pings = finishedThisRound(leaky, 2, 1);
  check(pings.length === 2, "two others finished");
  for (const p of pings) check(JSON.stringify(Object.keys(p).sort()) === '["name","slot"]', `a ping holds only slot and name (${Object.keys(p)})`);
  const html = renderToStaticMarkup(createElement(FinishedPingStrip, { pings, looks: resolvePlayerLooks(leaky) }));
  check(!/137|SECRET|4321|correct|points|score/i.test(html), `the strip shows no result data: ${html}`);
  check(html.includes("Ali and Jo finished") && html.includes("✓"), `the strip reads "Ali and Jo finished ✓": ${html}`);
  check(/data-player-badge/.test(html), "the strip shows each player's badge (colour and icon)");
  check(/role="status"/.test(html) && /pointer-events-none absolute/.test(html), "the strip is a status line laid over its header area");
  check(renderToStaticMarkup(createElement(FinishedPingStrip, { pings: [], looks: new Map() })) === "", "no pings, no strip");

  const { client, writes } = memoryDb({ duel_players: [player(1), player(2)] as unknown as Record<string, unknown>[] });
  await markSubmitted(client, "p2", 3);
  await clearSubmitted(client, "room");
  for (const w of writes)
    check(
      w.table === "duel_players" && JSON.stringify(Object.keys(w.values)) === '["submitted_round"]' && Number.isInteger(w.values["submitted_round"]),
      `the server writes only a round number (${JSON.stringify(w)})`,
    );
  check(writes.length === 2, `one write each (${writes.length})`);
}

/* 3. Combined text. */
{
  const ps = (n: number): FinishedPing[] => NAMES.slice(0, n).map((name, i) => ({ slot: i + 1, name }));
  check(pingText(ps(1)) === "Sam finished", pingText(ps(1)));
  check(pingText(ps(2)) === "Sam and Ali finished", pingText(ps(2)));
  check(pingText(ps(3)) === "Sam, Ali and Jo finished", pingText(ps(3)));
  check(pingText(ps(5)) === "Sam, Ali and 3 others finished", pingText(ps(5)));
  check(pingText([]) === "", "no text without pings");
  check(pingText([{ slot: 1, name: "  " }]) === "Player finished", "a blank name reads Player");
  const html = renderToStaticMarkup(createElement(FinishedPingStrip, { pings: ps(5), looks: resolvePlayerLooks(Array.from({ length: 5 }, (_, i) => player(i + 1))) }));
  check((html.match(/data-player-badge/g) ?? []).length === 3, "at most three badges in a combined ping");
}

/* 4. Before the migration. */
{
  const old = [1, 2, 3].map((slot) => {
    const row = player(slot) as Partial<DuelPlayerRow>;
    delete row.submitted_round;
    return row as DuelPlayerRow;
  });
  check(finishedThisRound(old, 1, 1).length === 0, "rows without submitted_round never ping");
  check(finishedThisRound([player(2, { submitted_round: 1 })], 0, 1).length === 0, "no round, no pings");
  const failing = {
    from: () => ({
      update: () => ({ eq: () => Promise.resolve({ data: null, error: { code: "PGRST204", message: "column submitted_round does not exist" } }) }),
    }),
  };
  const throwing = { from: () => { throw new Error("network"); } };
  let ok = true;
  try {
    await markSubmitted(failing, "p1", 1);
    await clearSubmitted(failing, "room");
    await markSubmitted(throwing, "p1", 1);
    await clearSubmitted(throwing, "room");
  } catch {
    ok = false;
  }
  check(ok, "markSubmitted / clearSubmitted never throw before the migration or on a failed write");
}

/* 5. Wiring. */
{
  const fns = readFileSync("src/lib/duel/duel.functions.ts", "utf8");
  const submit = fns.slice(fns.indexOf("export const submitAnswerFn"), fns.indexOf("export const readyUpFn"));
  const insertAt = submit.indexOf('client.from("round_results").insert(');
  const errorAt = submit.indexOf("if (error && error.code !== UNIQUE_VIOLATION) throw");
  const markAt = submit.indexOf("await markSubmitted(client, player.id, data.roundNumber)");
  check(insertAt > 0 && errorAt > insertAt && markAt > errorAt, "submitAnswerFn marks only after the result row is stored and its error checked");
  check((fns.match(/markSubmitted\(/g) ?? []).length === 1, "only submitAnswerFn marks a player as finished");
  // 18 Oct 2026: only a finish before the buzzer pings (buzzer.ts; round-time-check proves the rule per game).
  check(/if \(finishedBeforeBuzzer\(puzzle, room\.phase, msLeft\)\) await markSubmitted\(client, player\.id, data\.roundNumber\)/.test(submit), "a time-out, buzzer or late answer can ping (the buzzer gate is missing)");
  const rematch = fns.slice(fns.indexOf("export const rematchFn"));
  check(rematch.indexOf("await clearSubmitted(client, room.id)") > rematch.indexOf('client.rpc("restart_duel_room"'), "Play again clears the marks after the restart");

  const route = readFileSync("src/routes/duel.$code.tsx", "utf8");
  check(/useFinishedPings\(players, round, mySlot, duel\?\.status === "in_progress" && phase === "puzzle", stateKey\)/.test(route), "the room pings only in its live puzzle phase");
  check(/ping=\{stackedScore \? pingStrip : undefined\}/.test(route), "arcade screens lay the ping over the header's score and round label");
  for (const file of ["src/routes/practice.tsx", "src/routes/replay-lab.tsx"])
    check(!/FinishedPing|finishedPings/.test(readFileSync(file, "utf8")), `${file} never shows pings`);
  for (const file of ["src/components/duel/FinishedPings.tsx", "src/lib/duel/finishedPings.ts"])
    check(!/playSound|soundCue|playCue|buzz\(/.test(readFileSync(file, "utf8")), `${file}: pings are silent`);
  const pings = readFileSync("src/components/duel/FinishedPings.tsx", "utf8");
  check(!/score|answer|is_correct|ms_remaining/.test(pings.replace(/\/\*\*[\s\S]*?\*\//g, "")), "the ping component never reads result fields");

  const migrations = readdirSync("supabase/migrations").filter((f) => /submitted_round/.test(f));
  check(migrations.length === 1, `one submitted_round migration (${migrations})`);
  const sql = readFileSync(`supabase/migrations/${migrations[0]}`, "utf8").replace(/--.*$/gm, "");
  check(/ADD COLUMN IF NOT EXISTS submitted_round integer NOT NULL DEFAULT 0/.test(sql), "the migration adds submitted_round (default 0)");
  check(/CHECK \(submitted_round BETWEEN 0 AND 7\)/.test(sql), "a range check (0–7, MAX_ROUNDS)");
  check(!/\bGRANT\b|\bPOLICY\b|\bround_results\b|\bscore\b/i.test(sql), "the migration adds no grant or policy and touches no results");
  for (const file of ["src/lib/duel/api.ts", "src/lib/duel/useDuel.ts"]) {
    const text = readFileSync(file, "utf8");
    check(!/from\("duel_players"\)\s*\.(update|insert|upsert|delete)/.test(text), `${file}: clients never write duel_players`);
  }
}

console.log(`finished-pings-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`FAIL: ${f}`);
  process.exit(1);
}
console.log("PASS: pings name only players whose answer is stored, carry no result data, combine, stay silent and work before the migration");
