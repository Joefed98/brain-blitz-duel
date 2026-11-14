/**
 * security-rooms-check (13 Nov 2026, Security A): rooms and rated play on a real database (every migration applied to a
 * local PostgreSQL 16, the app's real server functions through scripts/server-fn-harness.ts).
 *
 *   1. Input checks (src/lib/validate.ts): each helper's accepted and refused values.
 *   2. Private room channels: the policies on realtime.messages, read as Realtime reads them (realtime.topic() set, the
 *      player's role and claims). A player outside the room is refused on every room topic, reading and sending; the
 *      room's players read their topics and send only on the ghost topic; a player who left loses chat and ghosts; a
 *      removed player loses all three. Every room channel the phone opens is private, no phone code sends on the chat
 *      topic, and the server's reactions go out on the private topic only.
 *   3. Reactions sent by the server (sendReactionFn): the broadcast carries the sender from the server's own row; a
 *      player outside the room, one muted by the host and a second reaction within the second are refused; the
 *      receiving filter (acceptReaction) takes the server's payload.
 *   4. Chat for players still in the room: a player who left and a removed player read nothing, live or history; the
 *      players who stayed read a finished room's chat. A removed player's join is refused until Play again.
 *   5. Finish now: an ordinary room offers it only after 45 s away; a crafted call in a rated room and in an Arena duel
 *      is refused; the Arena duel still plays to its end and settles when its rival vanishes; the rated 20 s grace and
 *      forfeit are unchanged.
 *   6. The rated queue's cooldown after set-up leaves: the ladder, the refusal with its time and line, ratedStatus
 *      carrying it, the analytics event, and a stayer put back in the queue by reviewDepartures never waiting.
 *   7. Race ghosts in a rated room go quiet for the game's final 20 %.
 *
 * Times are the scenario's: every stored time is set relative to the database's clock, never to a date.
 */
import { existsSync } from "node:fs";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  ANON_KEY,
  callServerFn,
  installServerFnPlugin,
  postgresBin,
  SERVICE_KEY,
  startLocalDb,
  startRestServer,
  userToken,
  type LocalDb,
  type RestServer,
} from "./server-fn-harness";

let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) passes++;
  else {
    failures.push(label);
    quietLog(`  FAIL ${label}`);
  }
}
async function rejects(promise: Promise<unknown>, pattern: RegExp): Promise<boolean> {
  try {
    await promise;
    return false;
  } catch (err) {
    return pattern.test(err instanceof Error ? err.message : String(err));
  }
}

const quietLog = console.log;
const quietWarn = console.warn;
const quietError = console.error;
console.log = (...args: unknown[]) => {
  const line = args.map(String).join(" ");
  if (/^\s*(FAIL|NOTE)|^security-rooms-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};
const restore = () => {
  console.log = quietLog;
  console.warn = quietWarn;
  console.error = quietError;
};

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const HOST = uid(1);
const BO = uid(2);
const OUT = uid(3); // never in the room
const LEFT = uid(4); // leaves the lobby
const GONE = uid(5); // removed by the host
const R1 = uid(11); // rated players
const R2 = uid(12);
const R3 = uid(13);
const R4 = uid(14);
const A1 = uid(21); // Arena players
const A2 = uid(22);
const S1 = uid(31); // cooldown: a stayer with earlier leaves of their own
const S2 = uid(32); // cooldown: the leaver
const C1 = uid(33); // cooldown: the ladder

/* ------------------------------------------------------------------ 1. input checks (no database) */
{
  const v = await import("../src/lib/validate");
  const throws = (fn: () => unknown, field: string) => {
    try {
      fn();
      return false;
    } catch (err) {
      return err instanceof v.InvalidInput && err.field === field && !String(err.message).includes("SECRET");
    }
  };
  check(v.uuid("AAAAAAAA-0000-4000-8000-000000000001", "id") === "aaaaaaaa-0000-4000-8000-000000000001", "validate: a uuid, lower-cased");
  check(throws(() => v.uuid("not-a-uuid", "id"), "id") && throws(() => v.uuid(5, "id"), "id"), "validate: a non-uuid is refused, naming the field");
  check(v.text("abc", 3, "t") === "abc" && throws(() => v.text("abcd", 3, "t"), "t") && throws(() => v.text(4, 3, "t"), "t"), "validate: a string up to its maximum");
  check(throws(() => v.text("", 3, "t", { min: 1 }), "t"), "validate: a string's minimum");
  check(v.whole(3, 1, 16, "slot") === 3 && throws(() => v.whole(17, 1, 16, "slot"), "slot") && throws(() => v.whole(1.5, 1, 16, "slot"), "slot") && throws(() => v.whole("3", 1, 16, "slot"), "slot"), "validate: a whole number in its range (no strings, no fractions)");
  check(v.oneOf("bo3", ["bo3", "bo5"] as const, "f") === "bo3" && throws(() => v.oneOf("bo9", ["bo3"] as const, "f"), "f"), "validate: one of a set");
  check(v.listOf(["a", "b"], 2, (x, f) => v.text(x, 1, f), "l").join() === "a,b" && throws(() => v.listOf(["a", "b", "c"], 2, (x, f) => v.text(x, 1, f), "l"), "l") && throws(() => v.listOf(["a", "bb"], 2, (x, f) => v.text(x, 1, f), "l"), "l[1]"), "validate: a list up to N, each item checked");
  check(v.optional(undefined, (x) => v.text(x, 2, "o")) === undefined && throws(() => v.optional(null, (x) => v.text(x, 2, "o")), "o"), "validate: optional fields");
  check(throws(() => v.record(null), "input") && throws(() => v.record([]), "input") && v.record({ a: 1 })["a"] === 1, "validate: the input is an object");
  check(throws(() => v.text("SECRET-VALUE-xxxxxxxx", 3, "t"), "t"), "validate: the error names the field, never the value");
}

/* ------------------------------------------------------------------ 7. ghosts' quiet window (pure) */
{
  const { ghostQuietFrom } = await import("../src/lib/duel/raceGhosts");
  const { HIDDEN_FINISH_SHARE, opponentScoreHidden } = await import("../src/lib/rated/rules");
  const start = 1_000_000;
  const limit = 99_000;
  const at = ghostQuietFrom(start, limit);
  check(HIDDEN_FINISH_SHARE === 0.2 && at === start + 79_200, `ghosts go quiet at the game's final 20 % (${at - start} ms in)`);
  check(opponentScoreHidden(at - start, limit) && !opponentScoreHidden(at - start - 1, limit), "the same moment the server hides the opponent's score");
  const src = readFileSync("src/lib/duel/raceGhosts.ts", "utf8");
  check(/export function publishRaceGhost[\s\S]*?if \(ghostsQuiet\(serverNow\(\)\)\) return;/.test(src), "ghosts: nothing is sent while quiet");
  check(/\.on\("broadcast", \{ event: "car" \}, \(\{ payload \}\) => \{\s*if \(ghostsQuiet\(serverNow\(\)\)\) return;/.test(src), "ghosts: nothing received is shown while quiet");
  check(/if \(ghostsQuiet\(serverNow\(\)\)\) seen\.clear\(\);/.test(src) && /function goQuiet\(\): void \{[\s\S]*?seen\.clear\(\);[\s\S]*?publish\(\);/.test(src), "ghosts: the ones on screen clear when it goes quiet");
  const route = readFileSync("src/routes/duel.$code.tsx", "utf8");
  check(/ghostRound !== null && ratedMatchId && phase === "puzzle" && phaseStart !== null && puzzle \? ghostQuietFrom\(phaseStart, puzzleTimeLimitMs\(puzzle\)\) : null/.test(route), "ghosts: only a rated room's Racing round goes quiet, from its puzzle phase");
}

/* ------------------------------------------------------------------ 2b. every room channel is private (source) */
{
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(name)) files.push(path);
    }
  };
  walk("src");
  const opens = files.flatMap((f) => {
    const text = readFileSync(f, "utf8");
    // Each `.channel(`…`, { config })` call: the topic's template literal and its options, up to the closing paren.
    return [...text.matchAll(/\.channel\(`[^`]*`(, \{[^\n]*\})?\)/g)].map((m) => ({ f, call: m[0] }));
  });
  check(opens.length === 3, `the phone opens three Realtime channels (${opens.map((o) => o.f).join(", ")})`);
  check(opens.every((o) => /private: true/.test(o.call)), `every one is private (${opens.filter((o) => !/private: true/.test(o.call)).map((o) => o.f).join(", ") || "all"})`);
  const sends = files.filter((f) => /type: "broadcast",\s*event: "reaction"/.test(readFileSync(f, "utf8")));
  check(sends.length === 0, `no phone code sends a reaction on a channel (${sends.join(", ") || "none"})`);
  const chat = readFileSync("src/lib/duel/useRoomChat.ts", "utf8");
  check(/await sendReactionFn\(\{ data: \{ roomId, emoji \} \}\)/.test(chat) && !/allowReactionFn/.test(chat), "the phone sends reactions through the server (sendReactionFn)");
}

let db: LocalDb | null = null;
let rest: RestServer | null = null;

if (!postgresBin()) {
  restore();
  if (process.env["CI"]) {
    console.log("security-rooms-check: 0 passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL");
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: the database part didn't run (CI runs it)");
} else {
  try {
    db = startLocalDb("security-rooms-check-");
    check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
    rest = await startRestServer(db.socketDir);
    process.env["SUPABASE_URL"] = rest.url;
    process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
    await installServerFnPlugin();
    await runDb(db, rest);
  } catch (err) {
    check(false, `harness: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  } finally {
    await rest?.stop();
    db?.stop();
  }
}

restore();
console.log(`security-rooms-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: input checks, private room channels, server-sent reactions, chat for players still in the room, removals, Finish now, the rated cooldown and quiet ghosts.");
process.exit(0);

async function runDb(db: LocalDb, rest: RestServer): Promise<void> {
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };
  const duel = await import("../src/lib/duel/duel.functions");
  const chat = await import("../src/lib/duel/chat.functions");
  const rated = await import("../src/lib/rated/rated.server");
  const ratedFns = await import("../src/lib/rated/rated.functions");
  const { setRatingsBackend } = await import("../src/lib/rated/ratingsAdapter.server");
  const { adminDb } = await import("../src/lib/data/db.server");
  const { flushAnalytics } = await import("../src/lib/data/events.server");
  const { acceptReaction } = await import("../src/lib/duel/reactionRoster");
  const { ROOM_EMOJI } = await import("../src/lib/duel/chatConstants");
  const { FINISH_NOW_MATCH_MESSAGE } = await import("../src/lib/duel/roomPhase.server");
  const { RATED_ABORT_COOLDOWN } = await import("../src/config/ratedConfig");
  const { abortCooldown } = await import("../src/lib/rated/matchmaking");
  const { cooldownLine } = await import("../src/lib/rated/rules");
  const { createClient } = await import("@supabase/supabase-js");
  const client = await adminDb();
  const call = callServerFn;
  const tok = (u: string) => userToken(u);
  const userClient = (u: string) =>
    createClient(rest.url, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${tok(u)}` } } });
  const ts = (agoMs: number) => `now() - interval '${agoMs} milliseconds'`;

  const all = [HOST, BO, OUT, LEFT, GONE, R1, R2, R3, R4, A1, A2, S1, S2, C1];
  q(`INSERT INTO auth.users (id) VALUES ${all.map((u) => `('${u}')`).join(", ")}`);
  const profile = (id: string, name: string, n: number) => `('${id}', '${name}', '${name.toLowerCase()}', ${n % 32}, DATE '1990-01-01', ${n + 40})`;
  q(`SET session_replication_role = replica; INSERT INTO public.profiles (user_id, username, username_key, colour, date_of_birth, player_number) VALUES
    ${[[R1, "Rhea"], [R2, "Rory"], [R3, "Rafe"], [R4, "Remy"], [A1, "Arlo"], [A2, "Avis"], [S1, "Sage"], [S2, "Skye"], [C1, "Cleo"]].map(([id, n], i) => profile(id!, n!, i)).join(", ")}`);
  if (q(`SELECT to_regclass('shop.testers') IS NULL`) === "t")
    q(`CREATE SCHEMA IF NOT EXISTS shop; CREATE TABLE shop.testers (user_id uuid PRIMARY KEY, note text NOT NULL DEFAULT '')`);
  q(`INSERT INTO shop.testers (user_id, note) SELECT u, 'security-rooms-check' FROM unnest(ARRAY['${R1}','${R2}','${R3}','${R4}','${A1}','${A2}','${S1}','${S2}','${C1}']::uuid[]) AS u ON CONFLICT DO NOTHING`);
  setRatingsBackend({
    matchRating: async () => ({ rating: 1000, placement: true }),
    recordRatedMatch: async (result) => ({ ok: true, status: "recorded", matchId: result.matchId, players: [] }),
    startingRating: 1000,
    beginnerMax: 1000,
  });

  /* ---------------------------------------------------------- the room: host, a player, one who leaves, one removed */
  const made = await call(duel.createRoomFn, { displayName: "Host" }, tok(HOST));
  const roomId: string = made.roomId;
  const code: string = made.roomCode;
  for (const [u, n] of [[BO, "Bo"], [LEFT, "Lee"], [GONE, "Gus"]] as const) {
    const joined = await call(duel.joinRoomFn, { roomCode: code, displayName: n }, tok(u));
    check(joined.ok === true, `${n} joins the lobby`);
  }
  const slotOf = (u: string) => Number(q(`SELECT player_slot FROM public.duel_players WHERE duel_id = '${roomId}' AND user_id = '${u}'`));

  /* ---------------------------------------------------------- 3. reactions sent by the server */
  {
    const sent = await call(chat.sendReactionFn, { roomId, emoji: ROOM_EMOJI[0] }, tok(BO));
    check(sent.ok === true, "sendReactionFn: a player's reaction is sent");
    const row = q(`SELECT topic || '|' || event || '|' || private::text || '|' || payload::text FROM realtime.messages WHERE topic = 'room-chat-${roomId}' ORDER BY id DESC LIMIT 1`);
    const [topic, event, priv, payloadText] = row.split("|");
    const payload = JSON.parse(payloadText ?? "{}") as Record<string, unknown>;
    check(topic === `room-chat-${roomId}` && event === "reaction" && priv === "true", `the server broadcasts on the room's private chat topic (${topic}, ${event}, private ${priv})`);
    check(payload["userId"] === BO && payload["name"] === "Bo" && payload["slot"] === slotOf(BO) && payload["emoji"] === ROOM_EMOJI[0], `the sender comes from the server's own row (${payloadText})`);
    const roster = q(`SELECT json_agg(json_build_object('user_id', user_id, 'display_name', display_name, 'status', status, 'muted_by_host', muted_by_host)) FROM public.duel_players WHERE duel_id = '${roomId}'`);
    check(acceptReaction(payload, JSON.parse(roster))?.userId === BO, "the receiving filter (acceptReaction) takes the server's payload");
    const soon = await call(chat.sendReactionFn, { roomId, emoji: ROOM_EMOJI[0] }, tok(BO));
    check(soon.ok === false && /One reaction a second/.test(soon.message), "sendReactionFn: one a second");
    const outsider = await call(chat.sendReactionFn, { roomId, emoji: ROOM_EMOJI[0] }, tok(OUT));
    check(outsider.ok === false && /not in this room/.test(outsider.message), "sendReactionFn: a player outside the room is refused");
    await call(chat.setPlayerMutedFn, { roomId, slot: slotOf(LEFT), muted: true }, tok(HOST));
    const muted = await call(chat.sendReactionFn, { roomId, emoji: ROOM_EMOJI[0] }, tok(LEFT));
    check(muted.ok === false && /host has muted you/.test(muted.message), "sendReactionFn: a player the host muted is refused");
    await call(chat.setPlayerMutedFn, { roomId, slot: slotOf(LEFT), muted: false }, tok(HOST));
    const bad = await call(chat.sendReactionFn, { roomId, emoji: "<img src=x>" }, tok(HOST));
    check(bad.ok === false && /doesn.t exist/.test(bad.message), "sendReactionFn: only the room's emoji and equipped emotes");
    check(await rejects(call(chat.sendReactionFn, { roomId: "not-a-room", emoji: ROOM_EMOJI[0] }, tok(HOST)), /Invalid input: roomId/), "sendReactionFn: a room id that isn't a uuid is refused by the input check");
    check(q(`SELECT count(*) FROM realtime.messages WHERE topic = 'room-chat-${roomId}'`) === "1", "only the one allowed reaction was broadcast");
    check(q(`SELECT count(*) FROM realtime.messages WHERE NOT private`) === "0", "the server never broadcasts on a public topic");
  }

  /* ---------------------------------------------------------- chat history, before anyone leaves */
  await call(chat.sendRoomMessageFn, { roomId, text: "hello all" }, tok(BO));
  const reads = async (u: string) => {
    const { data } = await userClient(u).from("room_messages").select("id").eq("duel_id", roomId);
    return (data ?? []).length;
  };
  check((await reads(LEFT)) === 1 && (await reads(GONE)) === 1, "before leaving, every player reads the room's chat");

  /* ---------------------------------------------------------- 4. leave and remove */
  await call(duel.leaveRoomFn, { roomId }, tok(LEFT));
  const goneSlot = slotOf(GONE);
  const removed = await call(duel.removePlayerFn, { roomId, slot: goneSlot }, tok(HOST));
  check(removed.ok === true && q(`SELECT count(*) FROM public.duel_removed_players WHERE duel_id = '${roomId}' AND user_id = '${GONE}' AND game_index = 0`) === "1", "removePlayerFn records the removal for this game");
  check(q(`SELECT count(*) FROM public.duel_removed_players WHERE user_id = '${HOST}'`) === "0" && (await call(duel.removePlayerFn, { roomId, slot: slotOf(HOST) }, tok(HOST))).ok === true && q(`SELECT count(*) FROM public.duel_removed_players WHERE user_id = '${HOST}'`) === "0", "the host's own slot is never removed or recorded");
  check(await rejects(call(duel.removePlayerFn, { roomId, slot: 99 }, tok(HOST)), /Invalid input: slot/), "removePlayerFn: a slot outside 1–16 is refused by the input check");
  check((await reads(LEFT)) === 0, "a player who left reads none of the chat");
  check((await reads(GONE)) === 0, "a removed player reads none of the chat");
  check((await reads(BO)) === 1 && (await reads(HOST)) === 1, "the players still in the room read it");
  const rejoin = await call(duel.joinRoomFn, { roomCode: code, displayName: "Gus" }, tok(GONE));
  check(rejoin.ok === false && rejoin.message === duel.ROOM_REMOVED_MESSAGE, `a removed player's join is refused (${rejoin.message})`);
  check((await call(duel.removePlayerFn, { roomId, slot: goneSlot }, tok(HOST))).ok === true, "removing an empty slot again is harmless");

  /* ---------------------------------------------------------- 2. private topics as Realtime reads them */
  // Realtime authorises a private channel by reading (and, to send, writing) realtime.messages as the joining player,
  // with realtime.topic() set to the channel's topic. A row the read can see means the join is allowed.
  q(`INSERT INTO realtime.messages (topic, extension, payload, event, private) VALUES
      ('race-ghosts-${roomId}:1', 'broadcast', '{}', 'probe', true), ('duel-${code}', 'broadcast', '{}', 'probe', true)`);
  const asPlayer = (u: string, topic: string, sql: string) =>
    db.psql(`BEGIN; SELECT set_config('request.jwt.claims', '{"sub":"${u}","role":"authenticated"}', true); SELECT set_config('realtime.topic', '${topic}', true); SET LOCAL ROLE authenticated; ${sql}; ROLLBACK;`);
  const canRead = (u: string, topic: string) => {
    const out = asPlayer(u, topic, `SELECT count(*) FROM realtime.messages WHERE topic = '${topic}'`);
    return out.ok && Number(out.out.split("\n").filter((l) => /^\d+$/.test(l)).pop() ?? "0") > 0;
  };
  const canSend = (u: string, topic: string) =>
    asPlayer(u, topic, `INSERT INTO realtime.messages (topic, extension, payload, event, private) VALUES ('${topic}', 'broadcast', '{}', 'car', true)`).ok;
  const topics = { chat: `room-chat-${roomId}`, ghosts: `race-ghosts-${roomId}:1`, room: `duel-${code}` };
  for (const [name, topic] of Object.entries(topics)) {
    check(!canRead(OUT, topic) && !canSend(OUT, topic), `a player outside the room can neither join nor send on ${name} (${topic})`);
    check(!canRead(GONE, topic) && !canSend(GONE, topic), `a removed player can neither join nor send on ${name}`);
  }
  check(canRead(BO, topics.chat) && canRead(BO, topics.ghosts) && canRead(BO, topics.room), "a player in the room joins all three topics");
  check(!canSend(BO, topics.chat) && !canSend(BO, topics.room), "nobody sends on the chat or room topics (the server sends reactions)");
  check(canSend(BO, topics.ghosts), "a player in the room sends on the ghost topic");
  check(!canRead(LEFT, topics.chat) && !canRead(LEFT, topics.ghosts) && !canSend(LEFT, topics.ghosts), "a player who left loses the chat and ghost topics");
  check(canRead(LEFT, topics.room), "a player who left still follows the room itself (its results screen)");
  check(!canRead(BO, `room-chat-${crypto.randomUUID()}`) && !canRead(BO, "room-chat-anything") && !canRead(BO, "duel-ZZZZ") && !canRead(BO, "some-other-topic"), "another room's topics, and any other topic, are refused");
  const anonRead = db.psql(`BEGIN; SELECT set_config('realtime.topic', '${topics.chat}', true); SET LOCAL ROLE anon; SELECT count(*) FROM realtime.messages; ROLLBACK;`);
  check(!anonRead.ok || /^0$/m.test(anonRead.out), "the anonymous key alone reads nothing");
  check(q(`SELECT count(*) FROM pg_policies WHERE schemaname = 'realtime' AND tablename = 'messages'`) === "2", "two policies on realtime.messages: read room topics, send on ghost topics");
  check(q(`SELECT has_function_privilege('authenticated', 'public.room_send_reaction(uuid, jsonb)', 'execute')::text`) === "false" && q(`SELECT has_function_privilege('anon', 'public.room_send_reaction(uuid, jsonb)', 'execute')::text`) === "false", "only the service role may call the server's broadcast");

  /* ---------------------------------------------------------- 5a. Finish now in an ordinary room: 45 s */
  {
    const start = await call(duel.startRoomFn, { roomId }, tok(HOST));
    check(start.ok === true, "the ordinary room starts (host and Bo)");
    q(`UPDATE public.duel_players SET last_seen_at = ${ts(20_000)} WHERE duel_id = '${roomId}' AND user_id = '${BO}'`);
    const early = await call(duel.finishNowFn, { roomId }, tok(HOST));
    check(early.ok === false && /still here/.test(early.message), `Finish now: refused 20 s after the rival's last sign of life (${early.message})`);
    q(`UPDATE public.duel_players SET last_seen_at = ${ts(46_000)} WHERE duel_id = '${roomId}' AND user_id = '${BO}'`);
    const done = await call(duel.finishNowFn, { roomId }, tok(HOST));
    check(done.ok === true && q(`SELECT status FROM public.duels WHERE id = '${roomId}'`) === "finished", "Finish now: offered and done once the rival has been away 45 s");
    check((await reads(HOST)) === 1, "the player who stayed to the end still reads the finished room's chat");
    check((await reads(BO)) === 0, "a rival Finish now marked as left reads none of it");
    // Play again opens the next game: the removed player may join it.
    const again = await call(duel.rematchFn, { roomId }, tok(HOST));
    check(again.ok === true, `Play again (${JSON.stringify(again).slice(0, 80)})`);
    const after = await call(duel.joinRoomFn, { roomCode: code, displayName: "Gus" }, tok(GONE));
    check(after.ok === true, `after Play again the removed player can join the next game (${after.message ?? "ok"})`);
  }

  /* ---------------------------------------------------------- 5b. rated: crafted Finish now refused; the grace unchanged */
  const makeLive = async (ids: string[]) => {
    const t0 = Date.now() - 300_000;
    const matchId = crypto.randomUUID();
    await rated.createLiveMatch(client, {
      matchId, format: "bo3", choice: "mixed", rematchOf: null,
      players: ids.map((u) => ({ userId: u, format: "bo3" as const, choice: "mixed" as const, rating: 1000, joinedAtMs: t0, placement: true })),
    }, t0);
    const room = q(`SELECT duel_id FROM public.mm_matches WHERE id = '${matchId}'`);
    q(`UPDATE public.duel_players SET joined_at = ${ts(300_000)}, last_seen_at = now() WHERE duel_id = '${room}'`);
    q(`UPDATE public.duels SET current_round = 1, phase = 'puzzle', phase_started_at = now() WHERE id = '${room}'`);
    return { matchId, room };
  };
  const ended = (m: string) => q(`SELECT coalesce(ended, '-') FROM public.mm_matches WHERE id = '${m}'`);
  {
    const m = await makeLive([R1, R2]);
    q(`UPDATE public.duel_players SET last_seen_at = ${ts(46_000)} WHERE duel_id = '${m.room}' AND user_id = '${R2}'`);
    const crafted = await call(duel.finishNowFn, { roomId: m.room }, tok(R1));
    check(crafted.ok === false && crafted.message === FINISH_NOW_MATCH_MESSAGE, `a crafted Finish now in a rated room is refused (${crafted.message})`);
    check(q(`SELECT status FROM public.duels WHERE id = '${m.room}'`) === "in_progress" && ended(m.matchId) === "-", "the rated room is untouched by it");
    await call(duel.heartbeatFn, { roomId: m.room }, tok(R1));
    check(ended(m.matchId) === "forfeit", "the rated leaving rules then end it as a forfeit, on the heartbeat");
  }
  {
    const m = await makeLive([R3, R4]);
    q(`UPDATE public.duel_players SET last_seen_at = ${ts(19_000)} WHERE duel_id = '${m.room}' AND user_id = '${R4}'`);
    await call(duel.heartbeatFn, { roomId: m.room }, tok(R3));
    check(ended(m.matchId) === "-", "rated grace: away 19 s after the intro, the match carries on");
    q(`UPDATE public.duel_players SET last_seen_at = ${ts(21_000)} WHERE duel_id = '${m.room}' AND user_id = '${R4}'`);
    await call(duel.heartbeatFn, { roomId: m.room }, tok(R3));
    check(ended(m.matchId) === "forfeit" && q(`SELECT status FROM public.duels WHERE id = '${m.room}'`) === "finished", "rated grace: away 21 s, a forfeit and the room finished (unchanged)");
  }

  /* ---------------------------------------------------------- 5c. an Arena duel: refused, then played to its end */
  {
    const tRules = await import("../src/lib/tournaments/rules");
    const tData = await import("../src/lib/data/tournaments.server");
    const tServer = await import("../src/lib/tournaments/tournaments.server");
    const eventId = "arena:2026-12-10:1300";
    await tData.ensureEventRow(client, tRules.scheduledEvent(eventId)!);
    q(`SET session_replication_role = origin; UPDATE public.tournament_events SET status = 'live' WHERE id = '${eventId}'; INSERT INTO public.tournament_entries (event_id, user_id, entry) VALUES ('${eventId}', '${A1}', 'free'), ('${eventId}', '${A2}', 'free')`);
    const room = await rated.createDealtMatchRoom(client, { format: "bo3", choice: "retro", userIds: [A1, A2] }, Date.now());
    const duelRowId = crypto.randomUUID();
    q(`INSERT INTO public.tournament_arena_duels (id, event_id, a_user, b_user, duel_id) VALUES ('${duelRowId}', '${eventId}', '${A1}', '${A2}', '${room.id}')`);
    // The rival vanishes: never seen again.
    q(`UPDATE public.duel_players SET joined_at = ${ts(600_000)}, last_seen_at = ${ts(600_000)} WHERE duel_id = '${room.id}' AND user_id = '${A2}'`);
    const crafted = await call(duel.finishNowFn, { roomId: room.id }, tok(A1));
    check(crafted.ok === false && crafted.message === FINISH_NOW_MATCH_MESSAGE, `a Finish now in an Arena duel is refused (${crafted.message})`);

    const { GAMES } = await import("./arcade-skill-bands/games");
    const { Human } = await import("./arcade-skill-bands/human");
    const { LIVE_BANDS } = await import("../src/lib/arcade/liveBands");
    const { appendClientCounters, arcadeCounters } = await import("../src/lib/arcade/diagnostics");
    type SkillBot = import("./arcade-skill-bands/bot").SkillBot;
    const botAnswer = async (puzzle: Record<string, unknown>): Promise<string> => {
      const type = String(puzzle["type"]);
      const spec = GAMES.find((g) => g.type === type);
      const botFile = new URL(`./arcade-skill-bands/bots/${type}.ts`, import.meta.url);
      if (!spec || !existsSync(botFile)) return "";
      const { bot } = (await import(botFile.href)) as { bot: SkillBot };
      const seed = Number(puzzle["seed"]);
      const field = (LIVE_BANDS as Record<string, { field: string } | undefined>)[type]?.field;
      const rev = field && typeof puzzle[field] === "number" ? (puzzle[field] as number) : null;
      let game: ReturnType<typeof spec.gameFor>;
      try {
        game = spec.gameFor(rev, seed);
      } catch {
        return "";
      }
      const out = bot({ game, seed, rev, human: new Human(type, seed, "good"), fixes: true });
      const events = out.events ?? [];
      const taps = out.taps ?? [];
      const byTick = new Map(events.map((e) => [e.t, e]));
      const tapSet = new Set(taps);
      let state = game.init(seed);
      const checkpoints: unknown[] = [];
      while (!game.isOver(state) && state.tick < game.runTicks) {
        const t = state.tick + 1;
        state = game.step(state, spec.taps ? tapSet.has(t) : (byTick.get(t) ?? null));
        if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
      }
      const score = game.score(state);
      const body = { seed, claimedScore: score, events, inputs: taps, taps: [], endTick: state.tick, checkpoints };
      return appendClientCounters(spec.encode(body, rev, seed), arcadeCounters(type, state, score));
    };
    const { mergePuzzle } = await import("../src/lib/duel/secrets");
    const phaseOf = () => q(`SELECT status || ':' || current_round || ':' || coalesce(phase, '') FROM public.duels WHERE id = '${room.id}'`);
    for (let step = 0; step < 80 && !phaseOf().startsWith("finished"); step++) {
      const [, roundText, phase] = phaseOf().split(":");
      const round = Number(roundText);
      if (phase === "puzzle" && q(`SELECT count(*) FROM public.round_results WHERE duel_id = '${room.id}' AND round_number = ${round} AND player_slot = 1`) === "0") {
        // Changed with Joe's approval, 13 Nov 2026: the round's public half from the server's held copy: a new room's public halves are held in duel_secrets until each round is released (Security C1a).
        const pub = JSON.parse(q(`SELECT (puzzles_public -> ${round - 1})::text FROM public.duel_secrets WHERE duel_id = '${room.id}'`));
        const priv = JSON.parse(q(`SELECT (puzzles_private -> ${round - 1})::text FROM public.duel_secrets WHERE duel_id = '${room.id}'`));
        const answer = await botAnswer(mergePuzzle(pub, priv) as unknown as Record<string, unknown>);
        await call(duel.submitAnswerFn, { roomId: room.id, roundNumber: round, answer, msRemaining: 1000, inputType: "touch" }, tok(A1));
        continue;
      }
      q(`UPDATE public.duels SET phase_started_at = phase_started_at - interval '10 minutes', round_started_at = round_started_at - interval '10 minutes' WHERE id = '${room.id}'`);
      await call(duel.heartbeatFn, { roomId: room.id }, tok(A1));
      await call(duel.advancePhaseFn, { roomId: room.id }, tok(A1));
    }
    check(phaseOf().startsWith("finished"), `the Arena duel plays on to its end with the rival gone (${phaseOf()})`);
    const mine = Number(q(`SELECT coalesce(sum(score), 0) FROM public.round_results WHERE duel_id = '${room.id}' AND player_slot = 1`));
    const theirs = Number(q(`SELECT coalesce(sum(score), 0) FROM public.round_results WHERE duel_id = '${room.id}' AND player_slot = 2`));
    check(mine > 0 && theirs === 0, `the player who stayed scored (${mine}); the rival nothing (${theirs})`);
    const duelRow = (await tData.readArenaDuel(client, duelRowId)).data!;
    const settled = await tServer.settleArenaDuel(client, duelRow, Date.now());
    const after = q(`SELECT status || ',' || coalesce(winner::text, '-') FROM public.tournament_arena_duels WHERE id = '${duelRowId}'`);
    check(settled === "settled" && after === "settled,a", `the Arena duel settles as a win for the player who stayed (${settled}, ${after})`);
  }

  /* ---------------------------------------------------------- 6. the cooldown after set-up leaves */
  {
    const L = RATED_ABORT_COOLDOWN;
    const min = 60_000;
    const now = 10_000_000_000;
    check(L.periodMs === 24 * 60 * min && L.waitsMs.join() === [0, 2 * min, 10 * min, 30 * min].join(), "the ladder is one config value: free, 2, 10, 30 min over 24 h");
    check(abortCooldown([now - 1_000], now, L) === null, "a first leave in 24 h: no wait");
    const second = abortCooldown([now - 5 * 3600_000, now - 30_000], now, L);
    check(second?.aborts === 2 && second.untilMs === now - 30_000 + 2 * min, "a second: 2 min from the latest");
    check(abortCooldown([now - 3 * 3600_000, now - 2 * 3600_000, now - 60_000], now, L)?.untilMs === now - 60_000 + 10 * min, "a third: 10 min");
    check(abortCooldown([1, 2, 3, 4, 5].map((h) => now - h * 3600_000 + 1), now, L) === null && abortCooldown([5, 4, 3, 2].map((h) => now - h * 60_000), now, L)?.untilMs === now - 2 * min + 30 * min, "a fourth and later: 30 min (an old one passed, no wait)");
    check(abortCooldown([now - 25 * 3600_000, now - 60_000], now, L) === null, "a leave older than 24 h doesn't count");
    check(cooldownLine(2, now + 9 * min - 10_000, now) === "You left your last 2 matches before they started. You can search again in 9 min.", "the line, in Joe's words");

    // Stored leaves: C1 left two matches during set-up, the latest a minute ago.
    const stored = (u: string, agoMs: number) => {
      const m = crypto.randomUUID();
      q(`INSERT INTO public.mm_matches (id, format, choice, kind, status, ended, ended_at, ended_step, leavers, created_at)
           VALUES ('${m}', 'bo3', 'mixed', 'live', 'abandoned', 'abort', ${ts(agoMs)}, 'starting', jsonb_build_array(jsonb_build_object('userId', '${u}', 'at', now()::text, 'step', 'starting')), ${ts(agoMs + 5_000)})`);
    };
    stored(C1, 3 * 3600_000);
    stored(C1, 60_000);
    const nowMs = Date.now();
    const refused = await rated.joinQueue(client, C1, { format: "bo3", choice: "mixed" }, nowMs);
    check(refused.ok === false && refused.reason === "cooldown" && /^You left your last 2 matches before they started\. You can search again in [12] min\.$/.test(refused.message) && !!refused.retryAtMs && Math.abs(refused.retryAtMs - (nowMs + 60_000)) < 2_000, `a second leave: the search is refused until it lifts (${refused.ok ? "" : refused.message})`);
    check(q(`SELECT count(*) FROM public.mm_queue WHERE user_id = '${C1}'`) === "0", "nothing queued while the wait runs");
    const status = await rated.ratedStatus(client, C1, undefined, nowMs);
    check(status.cooldown?.aborts === 2 && Math.abs(status.cooldown.untilMs - (nowMs + 60_000)) < 2_000, "ratedStatus carries the wait, so Play shows it before a tap");
    const viaFn = await call(ratedFns.ratedQueueJoinFn, { format: "bo3", choice: "mixed" }, tok(C1));
    check(viaFn.ok === false && viaFn.reason === "cooldown", "the server function answers the same");
    const later = await rated.joinQueue(client, C1, { format: "bo3", choice: "mixed" }, nowMs + 3 * min);
    check(later.ok === true, "once it lifts, the search starts");
    await rated.leaveQueue(client, C1);
    await flushAnalytics();
    const logged = q(`SELECT count(*) FROM analytics.events WHERE event = 'rated_cooldown_applied' AND player_id = '${C1}' AND (props ->> 'aborts')::int = 2`);
    check(Number(logged) >= 1, `the refusal is logged as rated_cooldown_applied (${logged})`);

    // A stayer is put back in the queue whatever their own earlier leaves; the leaver waits.
    stored(S1, 2 * 3600_000);
    stored(S1, 3 * 60_000);
    stored(S1, 2 * 60_000);
    check((await rated.cooldownFor(client, S1, Date.now()))?.aborts === 3, "the stayer has a wait of their own running (three leaves)");
    const t0 = Date.now() - 2_000;
    const matchId = crypto.randomUUID();
    await rated.createLiveMatch(client, {
      matchId, format: "bo3", choice: "mixed", rematchOf: null,
      players: [S1, S2].map((u) => ({ userId: u, format: "bo3" as const, choice: "mixed" as const, rating: 1000, joinedAtMs: t0, placement: true })),
    }, t0);
    const m = q(`SELECT duel_id FROM public.mm_matches WHERE id = '${matchId}'`);
    await rated.leaveRatedRoom(client, m, S2, t0 + 1_000);
    check(ended(matchId) === "abort", "the leaver's Leave at VS aborts the match");
    check(q(`SELECT count(*) FROM public.mm_queue WHERE user_id = '${S1}' AND match_id IS NULL`) === "1", "the stayer is back in the queue at once, never caught by a wait");
    stored(S2, 3 * 3600_000);
    const leaver = await rated.joinQueue(client, S2, { format: "bo3", choice: "mixed" }, Date.now());
    check(leaver.ok === false && leaver.reason === "cooldown", "the leaver, with a second leave in 24 h, waits");
  }
  const route = readFileSync("src/routes/rated.tsx", "utf8");
  check(/\{a\.youLeft \? \(\s*<p className="jz-empty-body" data-rated-abort-wait data-wrap-ok>\s*\{ABORT_WAIT_LINE\}/.test(route) && (await import("../src/lib/rated/rules")).ABORT_WAIT_LINE === "Leaving before a match starts adds a short wait.", "the abort notice adds the wait line, for the leaver only");
}
