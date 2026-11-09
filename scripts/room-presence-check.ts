/**
 * room-presence-check (9 Nov 2026; Speed fixes 3 and 7, docs/audit-nov-2026/performance.md): lighter live rooms and
 * the faster first answer. No browser, no database (server-functions-check plays the heartbeat on PostgreSQL).
 *
 * - roomSeen.ts, the phone's view of who was last seen: times only ever move later, are laid over the player rows
 *   (rows and list kept when nothing changed), and a realtime player update is applied in place: a heartbeat's time
 *   alone ("seen") redraws nothing, a changed field replaces the row, and an unknown or partial row reads the list
 *   afresh, as every update did before;
 * - isConnected (roomFlow.ts) reads the laid-over time, so a rival seen only through a heartbeat reply is connected;
 * - every room realtime subscription is filtered to its own room (security audit L6), and no migration publishes
 *   duel_presence to realtime;
 * - the room grader no longer imports generate.server (so the first answer doesn't load every generator and bank),
 *   generate.server still re-exports gradeAnswer, and the server build is minified.
 */
import { readdirSync, readFileSync } from "node:fs";

import { isConnected } from "../src/lib/duel/roomFlow";
import { applyPlayerUpdate, noteSeen, withSeen, type SeenMap } from "../src/lib/duel/roomSeen";
import { DISCONNECT_MS, type DuelPlayerRow } from "../src/lib/duel/types";

let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) passes++;
  else failures.push(label);
}

const T0 = Date.parse("2026-11-09T12:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();
function player(slot: number, extra: Partial<DuelPlayerRow> = {}): DuelPlayerRow {
  return {
    id: `p${slot}`,
    duel_id: "room",
    user_id: `u${slot}`,
    player_slot: slot,
    display_name: `P${slot}`,
    ready_round: 0,
    intro_ready_round: 0,
    muted_by_host: false,
    last_reaction_at: null,
    last_seen_at: iso(T0),
    status: "active",
    joined_at: iso(T0 - 60_000),
    created_at: iso(T0 - 60_000),
    ...extra,
  } as DuelPlayerRow;
}

/* ------------------------------------------------------------ noteSeen / withSeen */
{
  const seen: SeenMap = new Map();
  check(noteSeen(seen, { u1: iso(T0 + 4000) }) && seen.get("u1") === T0 + 4000, "noteSeen: a new time is taken");
  check(!noteSeen(seen, { u1: iso(T0 + 1000) }) && seen.get("u1") === T0 + 4000, "noteSeen: an older time is ignored");
  check(!noteSeen(seen, { u1: "not a time" }) && !noteSeen(seen, null), "noteSeen: junk and no reply change nothing");
  const rows = [player(1), player(2)];
  const laid = withSeen(rows, seen);
  check(laid !== rows && laid[0]!.last_seen_at === iso(T0 + 4000) && laid[1] === rows[1], "withSeen: the later time is laid over its row only");
  check(withSeen(rows, new Map()) === rows, "withSeen: nothing newer keeps the same list");
  const newer = [player(1, { last_seen_at: iso(T0 + 9000) })];
  check(withSeen(newer, seen) === newer, "withSeen: a row newer than the map keeps its own time");
  // A rival whose row is old (heartbeats no longer write it) but whose heartbeat came back is connected.
  const now = T0 + DISCONNECT_MS + 2000;
  const stale = [player(2)];
  check(!isConnected(stale[0]!, now), "isConnected: an old row alone reads as gone");
  const beat: SeenMap = new Map();
  noteSeen(beat, { u2: iso(now - 3000) });
  check(isConnected(withSeen(stale, beat)[0]!, now), "isConnected: the heartbeat reply's time keeps a rival connected");
}

/* ------------------------------------------------------------ applyPlayerUpdate */
{
  const rows = [player(1), player(2)];
  check(applyPlayerUpdate(rows, { ...rows[1]!, last_seen_at: iso(T0 + 4000) }) === "seen", "update: a heartbeat's time alone is 'seen'");
  const ready = applyPlayerUpdate(rows, { ...rows[1]!, ready_round: 3 });
  check(Array.isArray(ready) && ready[1]!.ready_round === 3 && ready[0] === rows[0] && rows[1]!.ready_round === 0, "update: a changed field replaces its row in a new list");
  check(applyPlayerUpdate(rows, { ...player(9) }) === "refetch", "update: an unknown row reads the list afresh");
  const partial: Partial<DuelPlayerRow> = { id: "p2", duel_id: "room", ready_round: 2 };
  check(applyPlayerUpdate(rows, partial) === "refetch", "update: a payload missing a field reads the list afresh");
  check(applyPlayerUpdate(rows, null) === "refetch" && applyPlayerUpdate(rows, {}) === "refetch", "update: no row reads the list afresh");
  check(applyPlayerUpdate(rows, { ...rows[1]!, player_slot: 7 }) === "refetch", "update: a moved slot reads the list afresh (order)");
  const extra = applyPlayerUpdate(rows, { ...rows[0]!, status: "left", session_token: "x" } as Partial<DuelPlayerRow>);
  check(Array.isArray(extra) && extra[0]!.status === "left", "update: extra payload fields don't stop an in-place update");
}

/* ------------------------------------------------------------ wiring (source) */
{
  const useDuel = readFileSync("src/lib/duel/useDuel.ts", "utf8");
  const subs = [...useDuel.matchAll(/\{ event: "\*", schema: "public", table: "(\w+)"(, filter: `[^`]*`)? \}/g)];
  const filtered = new Map(subs.map((m) => [m[1], /filter: `(?:id|duel_id)=eq\.\$\{roomId\}`/.test(m[2] ?? "")]));
  check(subs.length === 3 && ["duels", "duel_players", "round_results"].every((t) => filtered.get(t) === true), "useDuel: every postgres_changes subscription is filtered to the room");
  check(/heartbeat\(duelId\)\.then\(noteRoomSeen/.test(useDuel), "useDuel: the heartbeat's reply feeds the last-seen view");
  const chat = readFileSync("src/lib/duel/useRoomChat.ts", "utf8");
  check(/table: "room_messages", filter: `duel_id=eq\.\$\{roomId\}`/.test(chat), "useRoomChat: chat inserts are filtered to the room");
  const published = readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => /PUBLICATION\s+supabase_realtime[^;]*duel_presence/i.test(readFileSync(`supabase/migrations/${f}`, "utf8")));
  check(published.length === 0, `migrations: duel_presence is never published to realtime (${published.join(", ")})`);
  const heartbeat = readFileSync("src/lib/duel/duel.functions.ts", "utf8").match(/export const heartbeatFn[\s\S]*?\n {2}\}\);/)?.[0] ?? "";
  check(/recordHeartbeat\(/.test(heartbeat) && !/from\("duel_players"\)/.test(heartbeat), "heartbeatFn: writes through presence.server, never duel_players directly");
}

/* ------------------------------------------------------------ server build (Speed fix 7) */
{
  const roomGrade = readFileSync("src/lib/duel/roomGrade.server.ts", "utf8");
  check(/from "\.\/gradeAnswer\.server"/.test(roomGrade) && !/generate\.server/.test(roomGrade.replace(/\/\*[\s\S]*?\*\//g, "")), "roomGrade.server: grades through gradeAnswer.server, not generate.server");
  const grader = readFileSync("src/lib/duel/gradeAnswer.server.ts", "utf8");
  check(!/from "\.\/(generate|puzzleBank)\.server"/.test(grader), "gradeAnswer.server: imports no generator module or bank");
  check(/export \{ gradeAnswer, standardParts \} from "\.\/gradeAnswer\.server";/.test(readFileSync("src/lib/duel/generate.server.ts", "utf8")), "generate.server: still exports gradeAnswer and standardParts");
  const vite = readFileSync("vite.config.ts", "utf8");
  check(/\{ minify: true \}/.test(vite) && /nitro: SERVER_BUILD/.test(vite), "vite.config: the server build is minified");
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(`PASS: ${passes} checks (room last-seen view, room-only realtime, the grader apart from the generators, a minified server)`);
