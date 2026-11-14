/**
 * public-ids-check (14 Nov 2026, Security C1b): room-mates see each other by public id, never by account id
 * (supabase/migrations/20261117500300_public_player_ids.sql). Through the real room functions, triggers, grants and
 * row level security on a local PostgreSQL, read from a device's own client:
 *
 * - grants: phones may read every column of duel_players, duels and room_messages but the account ids (user_id,
 *   host_user_id, sender_user_id), so a column added later must be granted too; the column privileges are what
 *   Realtime's postgres_changes check per column (realtime.apply_rls), so live changes leave the account ids out;
 * - a device's reads: the account id columns and `select *` are refused; the named columns the app reads
 *   (roomReads.ts, chatReads.ts) answer, every row with its public id;
 * - the ids: every seat, host and message gets one from the trigger; one player keeps one id across rooms; two players
 *   never share one; my_public_id() answers the caller's own; the mapping and public_id_of are server only; existing
 *   rows get theirs from the migration's backfill; a deleted account's rows get a fresh id and its mapping goes;
 * - the sweep: a room played through its lobby, start, round, chat, a reaction, heartbeats, the reveal, replays, room
 *   cards, looks and cosmetics, finish and Play again: no answer a phone gets, no row it reads and no broadcast it
 *   receives holds an account id of anyone in the room;
 * - functions that take a room-mate's id take the public id (cosmetics); an account id names nobody.
 * - beyond rooms (Security C3, supabase/migrations/20261117600000_public_ids_beyond_rooms.sql): friends lists, player
 *   cards and badges, ratings, head-to-head and the rated settle answer name players by public id; every id-taking
 *   function finds the right player by public id and nobody by account id; public_ids_of is server only; phones can't
 *   call public_profiles, economy_public_cards or badge_public_cards, nor read friendships, friend_requests or
 *   player_blocks; tournament rows and the Arena opponent, and the rated match view, convert through publicIds.server.
 *
 * Needs the PostgreSQL 16 binaries (preinstalled on GitHub's ubuntu runners). No browser.
 */
import { readFileSync } from "node:fs";

import { advanceAfter, lobby, phaseOf, roomCheck, uid, withRoomHarness } from "./room-checks-lib";

const t = roomCheck(
  "public-ids-check",
  "phones read room-mates by public id only: grants, device reads, one id per player for life, and a whole room's answers, rows and broadcasts free of account ids.",
);
const { check, section } = t;
const ALI = uid(1);
const BO = uid(2);
const CY = uid(3);
const OUT = uid(4);
const GONE = uid(5);
const HIDDEN: Record<string, string> = { duel_players: "user_id", duels: "host_user_id", room_messages: "sender_user_id" };

await withRoomHarness(t, "public-ids-check", [ALI, BO, CY, OUT, GONE], async (h) => {
  const { q, call, token, duel } = h;
  const { PHONE_DUEL_COLUMNS, PHONE_PLAYER_COLUMNS } = await import("../src/lib/data/roomReads");
  const { PHONE_MESSAGE_COLUMNS } = await import("../src/lib/data/chatReads");
  const chat = await import("../src/lib/duel/chat.functions");
  const accounts = [ALI, BO, CY];
  const leaks = (label: string, value: unknown) => {
    const text = JSON.stringify(value ?? null);
    const found = accounts.filter((a) => text.includes(a));
    check(found.length === 0, `${label}: no account id (${found.length ? `found ${found.join(", ")} in ${text.slice(0, 160)}` : "none"})`);
  };

  await section("grants", async () => {
    for (const [table, hidden] of Object.entries(HIDDEN)) {
      const all = q(`SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}'`).split(",");
      const readable = all.filter((c) => q(`SELECT has_column_privilege('authenticated', 'public.${table}', '${c}', 'SELECT')::text`) === "true");
      check(!readable.includes(hidden), `${table}: phones can't read ${hidden}`);
      check(readable.length === all.length - 1, `${table}: phones can read every other column (${all.filter((c) => c !== hidden && !readable.includes(c)).join(", ") || "all"})`);
      check(q(`SELECT has_table_privilege('authenticated', 'public.${table}', 'SELECT')::text`) === "false", `${table}: no table-wide SELECT for phones`);
      check(q(`SELECT has_column_privilege('anon', 'public.${table}', '${hidden}', 'SELECT')::text`) === "false", `${table}: nor for anon`);
    }
    const phone = (cols: string) => cols.split(",").map((c) => c.trim()).sort();
    const granted = (table: string) =>
      q(`SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}' AND column_name <> '${HIDDEN[table]}'`).split(",");
    check(JSON.stringify(phone(PHONE_PLAYER_COLUMNS)) === JSON.stringify(granted("duel_players")), "the app reads exactly the players' granted columns (PHONE_PLAYER_COLUMNS)");
    check(JSON.stringify(phone(PHONE_DUEL_COLUMNS)) === JSON.stringify(granted("duels")), "the app reads exactly the room's granted columns (PHONE_DUEL_COLUMNS)");
    check(JSON.stringify(phone(PHONE_MESSAGE_COLUMNS)) === JSON.stringify(granted("room_messages")), "the app reads exactly the chat's granted columns (PHONE_MESSAGE_COLUMNS)");
    check(q(`SELECT has_table_privilege('authenticated', 'public.player_public_ids', 'SELECT')::text`) === "false", "phones can't read the id mapping");
    check(q(`SELECT has_function_privilege('authenticated', 'public.public_id_of(uuid)', 'EXECUTE')::text`) === "false", "phones can't call public_id_of");
    check(q(`SELECT has_function_privilege('authenticated', 'public.my_public_id()', 'EXECUTE')::text`) === "true", "phones may ask for their own public id");
  });

  let roomId = "";
  let roomCode = "";
  const sweep: { label: string; value: unknown }[] = [];
  const keep = (label: string, value: unknown) => {
    sweep.push({ label, value });
    return value;
  };

  await section("a device's reads", async () => {
    const room = await lobby(h, ALI, [BO]);
    roomId = room.roomId;
    roomCode = room.roomCode;
    for (const [table, hidden] of Object.entries(HIDDEN)) {
      const key = table === "duels" ? "id" : "duel_id";
      const one = await h.device(BO).from(table as "duels").select(hidden).eq(key, roomId);
      const star = await h.device(BO).from(table as "duels").select("*").eq(key, roomId);
      check(!!one.error && !!star.error, `${table}: a device's read of ${hidden}, or of every column, is refused (${one.error?.code}, ${star.error?.code})`);
    }
    const players = await h.device(BO).from("duel_players").select(PHONE_PLAYER_COLUMNS).eq("duel_id", roomId);
    const rows = (players.data ?? []) as unknown as { public_id: string | null }[];
    check(!players.error && rows.length === 2 && rows.every((r) => !!r.public_id), "the app's player read answers, every row with its public id");
    const room1 = await h.device(BO).from("duels").select(PHONE_DUEL_COLUMNS).eq("id", roomId).maybeSingle();
    check(!room1.error && !!(room1.data as { host_public_id?: string } | null)?.host_public_id, "the app's room read answers, with the host's public id");
    keep("the room's players (device read)", players.data);
    keep("the room (device read)", room1.data);
  });

  await section("the ids", async () => {
    const pid = (u: string, room = roomId) => q(`SELECT coalesce(public_id::text, '') FROM public.duel_players WHERE duel_id = '${room}' AND user_id = '${u}'`);
    check(pid(ALI) !== "" && pid(BO) !== "" && pid(ALI) !== pid(BO), "every seat has its own public id");
    check(pid(ALI) === q(`SELECT public_id::text FROM public.player_public_ids WHERE user_id = '${ALI}'`), "a seat's public id is its player's, from the mapping");
    check(q(`SELECT host_public_id::text FROM public.duels WHERE id = '${roomId}'`) === pid(ALI), "the room's host_public_id is the host's public id");
    const other = await lobby(h, BO, [ALI]);
    check(pid(ALI, other.roomId) === pid(ALI) && pid(BO, other.roomId) === pid(BO), "one public id per player, the same in every room");
    const mine = await h.device(BO).rpc("my_public_id");
    check(!mine.error && mine.data === pid(BO), "my_public_id() answers the caller's own public id");
    check(!!(await h.device(BO).rpc("public_id_of", { p_user_id: ALI })).error, "a device can't look up anyone else's");
    check(!!(await h.device(BO).from("player_public_ids").select("public_id")).error, "nor read the mapping");
    // The backfill: rows from before (no public id) get theirs from the migration's own statements.
    q(`ALTER TABLE public.duel_players DISABLE TRIGGER duel_players_public_id`);
    q(`ALTER TABLE public.duels DISABLE TRIGGER duels_host_public_id`);
    q(`UPDATE public.duel_players SET public_id = NULL WHERE duel_id = '${other.roomId}'`);
    q(`UPDATE public.duels SET host_public_id = NULL WHERE id = '${other.roomId}'`);
    q(`ALTER TABLE public.duel_players ENABLE TRIGGER duel_players_public_id`);
    q(`ALTER TABLE public.duels ENABLE TRIGGER duels_host_public_id`);
    const migration = readFileSync("supabase/migrations/20261117500300_public_player_ids.sql", "utf8");
    for (const stmt of migration.split("\n").filter((l) => /^UPDATE public\.(duel_players|duels|room_messages) SET /.test(l))) q(stmt);
    check(pid(ALI, other.roomId) === pid(ALI) && pid(BO, other.roomId) === pid(BO) && q(`SELECT host_public_id::text FROM public.duels WHERE id = '${other.roomId}'`) === pid(BO),
      "the migration's backfill gives existing rows their players' public ids");
    check(q(`SELECT count(*) FROM public.duel_players WHERE public_id IS NULL`) === "0" && q(`SELECT count(*) FROM public.duels WHERE host_user_id IS NOT NULL AND host_public_id IS NULL`) === "0",
      "no seat or room is left without one");
    // A deleted account: its rows are re-keyed to a stand-in with a fresh id, and its mapping goes.
    const gone = await lobby(h, GONE, [OUT]);
    const before = pid(GONE, gone.roomId);
    q(`SELECT accounts.forget_user('${GONE}')`);
    const after = q(`SELECT coalesce(public_id::text, '') FROM public.duel_players WHERE duel_id = '${gone.roomId}' AND display_name = 'Deleted player'`);
    check(before !== "" && after !== "" && after !== before, "a deleted player's seat gets a fresh public id");
    check(q(`SELECT count(*) FROM public.player_public_ids WHERE user_id = '${GONE}' OR public_id = '${before}'`) === "0", "and their public id goes with their account");
  });

  await section("the sweep", async () => {
    // Ali is an account with a reaction pack equipped, so cards and cosmetics answer something real.
    q(`UPDATE auth.users SET is_anonymous = false, email = 'ali@example.invalid' WHERE id = '${ALI}'`);
    check(q(`SELECT public.create_profile('${ALI}', 'Ali_Card', 3::smallint, DATE '1990-01-01', NULL)`) === "created", "Ali's account is made");
    q(`SELECT economy.grant_item('Ali_Card', 'reaction.banter', 'check: public ids')`);
    const { adminDb } = await import("../src/lib/data/db.server");
    const equipped = (await (await adminDb()).rpc("economy_equip", { p_user_id: ALI, p_slot: "reaction-1", p_item_id: "reaction.banter" })).data;
    check(equipped === "equipped", `Ali equips a reaction pack (${equipped})`);
    const say = await call(chat.sendRoomMessageFn, { roomId, text: "good luck" }, token(BO));
    check(say.ok === true, "a chat message is sent");
    const messages = await h.device(ALI).from("room_messages").select("id, duel_id, sender_name, text, created_at, sender_public_id").eq("duel_id", roomId);
    check(!messages.error && (messages.data ?? []).length === 1 && !!(messages.data?.[0] as { sender_public_id?: string })?.sender_public_id, "the chat read answers with the sender's public id");
    keep("the chat (device read)", messages.data);
    keep("a reaction", await call(chat.sendReactionFn, { roomId, emoji: "👍" }, token(ALI)));
    keep("the reaction broadcast", q(`SELECT coalesce(json_agg(payload)::text, '[]') FROM realtime.messages WHERE topic = 'room-chat-${roomId}'`));
    keep("a heartbeat (Bo)", await call(duel.heartbeatFn, { roomId }, token(BO)));
    keep("a heartbeat (Ali)", await call(duel.heartbeatFn, { roomId }, token(ALI)));
    keep("the room preview", await call(duel.roomPreviewFn, { roomCode }, token(OUT)));
    const join = keep("a third player joins", await call(duel.joinRoomFn, { roomCode, displayName: "Cy", via: "code" }, token(CY)));
    check((join as { ok?: boolean }).ok === true, "a third player joins");
    keep("a look change", await call(duel.setPlayerLookFn, { roomId, colour: 5 }, token(CY)));
    const { roomCardsFn } = await import("../src/lib/identity/roomCards.functions");
    const cards = keep("the room's cards", await call(roomCardsFn, { roomId }, token(BO))) as { cards?: Record<string, unknown> };
    check(Object.keys(cards.cards ?? {}).length >= 1, "the room's cards answer Ali's card (by seat)");
    const { roomGameLooksFn } = await import("../src/lib/identity/roomLooks.functions");
    keep("the room's looks", await call(roomGameLooksFn, { roomId, game: "racing" }, token(BO)));
    const players = (await h.device(BO).from("duel_players").select(PHONE_PLAYER_COLUMNS).eq("duel_id", roomId)).data as unknown as { public_id: string }[];
    const { getPublicCosmeticsFn } = await import("../src/lib/cosmetics/cosmetics.functions");
    const byPublic = (await call(getPublicCosmeticsFn, { playerIds: players.map((p) => p.public_id) }, token(BO))) as { userId: string }[];
    keep("cosmetics by public id", byPublic);
    const aliPublic = q(`SELECT public_id::text FROM public.duel_players WHERE duel_id = '${roomId}' AND user_id = '${ALI}'`);
    check(Array.isArray(byPublic) && byPublic.length === 1 && byPublic[0]!.userId === aliPublic && JSON.stringify(byPublic[0]).includes("reaction.banter"),
      "cosmetics are asked for and answered by public id (Ali's reaction pack)");
    const byAccount = (await call(getPublicCosmeticsFn, { playerIds: accounts }, token(BO))) as unknown[];
    check(Array.isArray(byAccount) && byAccount.length === 0, "an account id names nobody (cosmetics)");
    keep("the start", await call(duel.startRoomFn, { roomId }, token(ALI)));
    await advanceAfter(h, roomId, BO, 60_000);
    await advanceAfter(h, roomId, BO, 60_000);
    check(phaseOf(h, roomId) === "in_progress:1:intro", "round 1's intro");
    for (const u of [ALI, BO, CY]) keep("ready", await call(duel.readyUpFn, { roomId, roundNumber: 1 }, token(u)));
    await advanceAfter(h, roomId, BO, 60_000);
    keep("a move check", await call(duel.checkMovesFn, { roomId, roundNumber: 1, moves: "" }, token(BO)));
    for (const u of [ALI, BO, CY]) keep("an answer", await call(duel.submitAnswerFn, { roomId, roundNumber: 1, answer: "", msRemaining: 1000 }, token(u)));
    for (let i = 0; i < 3 && phaseOf(h, roomId).startsWith("in_progress:1:puzzle"); i++) await advanceAfter(h, roomId, BO, 400_000);
    keep("the reveal", await call(duel.revealAnswerFn, { roomId, roundNumber: 1 }, token(BO)));
    keep("results (device read)", (await h.device(BO).from("round_results").select("player_slot, round_number, score, extra").eq("duel_id", roomId)).data);
    keep("the room after round 1 (device read)", (await h.device(BO).from("duels").select(PHONE_DUEL_COLUMNS).eq("id", roomId)).data);
    q(`UPDATE public.duels SET status = 'finished', phase = 'finished', current_round = round_count, phase_started_at = now() WHERE id = '${roomId}'`);
    keep("the finished room (device read)", (await h.device(BO).from("duels").select(PHONE_DUEL_COLUMNS).eq("id", roomId)).data);
    const replay = await import("../src/lib/replay/replay.functions");
    const one = keep("a round's replay", await call(replay.roundReplayFn, { roomId, roundNumber: 1 }, token(BO))) as { ok?: boolean };
    const all = keep("the game's replays", await call(replay.gameReplaysFn, { roomId }, token(BO))) as { ok?: boolean };
    check(one.ok !== false && all.ok !== false, `the finished room's replays answer (${JSON.stringify([one, all]).slice(0, 120)})`);
    keep("Play again", await call(duel.rematchFn, { roomId }, token(ALI)));
    keep("the room again (device read)", (await h.device(BO).from("duels").select(PHONE_DUEL_COLUMNS).eq("id", roomId)).data);
    keep("the players again (device read)", (await h.device(BO).from("duel_players").select(PHONE_PLAYER_COLUMNS).eq("duel_id", roomId)).data);
    keep("a removal", await call(duel.removePlayerFn, { roomId, slot: 3 }, token(ALI)));
    keep("a leave", await call(duel.leaveRoomFn, { roomId }, token(BO)));
    if (process.env["PUBLIC_IDS_DEBUG"]) for (const s of sweep) process.stdout.write(`  ${s.label}: ${JSON.stringify(s.value ?? null).slice(0, 110)}\n`);
    for (const s of sweep) leaks(s.label, s.value);
    check(sweep.length >= 25, `the sweep reads every step (${sweep.length})`);
  });

  await section("beyond rooms (Security C3)", async () => {
    const { adminDb } = await import("../src/lib/data/db.server");
    const admin = await adminDb();
    // Bo is an adult account too, so the friends functions answer (Ali's account is made in the sweep above).
    q(`UPDATE auth.users SET is_anonymous = false, email = 'bo@example.invalid' WHERE id = '${BO}'`);
    check(q(`SELECT public.create_profile('${BO}', 'Bo_Friend', 5::smallint, DATE '1990-01-01', NULL)`) === "created", "Bo's account is made");
    const pubOf = (u: string) => q(`SELECT public.public_id_of('${u}')`);
    const [aliPub, boPub] = [pubOf(ALI), pubOf(BO)];
    const c3: { label: string; value: unknown }[] = [];
    const seen = (label: string, value: unknown) => {
      c3.push({ label, value });
      return value as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    };

    // Grants.
    check(q(`SELECT has_function_privilege('authenticated', 'public.public_ids_of(uuid[])', 'EXECUTE')::text || has_function_privilege('anon', 'public.public_ids_of(uuid[])', 'EXECUTE')::text`) === "falsefalse", "phones can't call public_ids_of");
    for (const fn of ["public_profiles", "economy_public_cards", "badge_public_cards"])
      check(q(`SELECT has_function_privilege('authenticated', 'public.${fn}(uuid[])', 'EXECUTE')::text || has_function_privilege('anon', 'public.${fn}(uuid[])', 'EXECUTE')::text`) === "falsefalse", `phones can't call ${fn} (it takes and answers account ids)`);
    for (const table of ["friendships", "friend_requests", "player_blocks"])
      check(q(`SELECT (has_table_privilege('authenticated', 'public.${table}', 'SELECT') OR has_any_column_privilege('authenticated', 'public.${table}', 'SELECT') OR has_any_column_privilege('anon', 'public.${table}', 'SELECT'))::text`) === "false", `phones can't read ${table}`);
    const many = (await admin.rpc("public_ids_of" as never, { p_user_ids: [ALI, BO, ALI, GONE] } as never)).data as unknown as { user_id: string; public_id: string }[];
    check(many.length === 3 && many.find((r) => r.user_id === ALI)?.public_id === aliPub && many.find((r) => r.user_id === BO)?.public_id === boPub, "public_ids_of answers each account's public id once, in one call");
    const goneId = many.find((r) => r.user_id === GONE)?.public_id;
    check(!!goneId && q(`SELECT count(*) FROM public.player_public_ids WHERE public_id = '${goneId}'`) === "0", "an id with no account behind it gets a fresh id that is kept nowhere");

    // Friends: Bo finds Ali, asks by public id, Ali accepts; every answer names them by public id.
    const friends = await import("../src/lib/friends/friends.functions");
    const found = seen("a search", await call(friends.friendSearchFn, { query: "ali" }, token(BO)));
    check(found.ok === true && found.results?.[0]?.id === aliPub, "search names the player by public id");
    check(seen("a request by account id", await call(friends.friendRequestFn, { playerId: ALI }, token(BO))).ok === false, "an account id names nobody (a friend request)");
    check(q(`SELECT count(*) FROM public.friend_requests WHERE from_user_id = '${BO}'`) === "0", "and nothing was asked of anyone");
    check(seen("a request by public id", await call(friends.friendRequestFn, { playerId: aliPub }, token(BO))).outcome === "sent", "a request by public id reaches Ali");
    const aliView = seen("Ali's list", await call(friends.friendsOverviewFn, undefined, token(ALI)));
    const incoming = aliView.overview?.incoming?.[0];
    check(incoming?.id === boPub, "the request is listed by the sender's public id");
    const boView = seen("Bo's list", await call(friends.friendsOverviewFn, undefined, token(BO)));
    check(JSON.stringify(boView.overview?.outgoing) === JSON.stringify([aliPub]), "the sent request is listed by the recipient's public id");
    seen("the accept", await call(friends.friendRespondFn, { requestId: incoming?.requestId, accept: true }, token(ALI)));
    const both = seen("Bo's list after", await call(friends.friendsOverviewFn, undefined, token(BO)));
    check(both.overview?.friends?.[0]?.id === aliPub, "friends are listed by public id");
    const prof = seen("a profile", await call(friends.friendProfileFn, { playerId: aliPub }, token(BO)));
    check(prof.ok === true && prof.profile?.card?.id === aliPub && prof.profile?.relation === "friends", "a profile asked for by public id names the player by it");
    check(seen("a profile by account id", await call(friends.friendProfileFn, { playerId: ALI }, token(BO))).reason === "not_found", "an account id names nobody (a profile)");
    seen("a block", await call(friends.friendBlockFn, { playerId: aliPub }, token(BO)));
    const blocked = seen("Bo's blocked list", await call(friends.friendsOverviewFn, undefined, token(BO)));
    check(blocked.overview?.blocked?.[0]?.id === aliPub, "a blocked player is listed by public id");
    seen("an unblock", await call(friends.friendUnblockFn, { playerId: aliPub }, token(BO)));
    const link = seen("Ali's link", await call(friends.friendLinkFn, { reset: false }, token(ALI)));
    const owner = seen("the link's owner", await call(friends.friendLinkOwnerFn, { token: link.token }, token(OUT)));
    check(owner.owner?.id === aliPub, "an invite link's owner is named by public id");

    // Cards and badges.
    const { getPublicCard } = await import("../src/lib/economy/economy.functions");
    const card = seen("Ali's card", await call(getPublicCard, { playerId: aliPub }, token(BO)));
    check(card.account === true && card.username === "Ali_Card" && card.playerId === aliPub, "a card asked for by public id is the player's, named by it");
    // (Not swept: the answer names the player by the id it was asked for, which the caller sent.)
    const byAccount = (await call(getPublicCard, { playerId: ALI }, token(BO))) as Record<string, unknown>;
    check(byAccount.account === false && byAccount.username === null, "an account id names nobody (the default card)");
    const { getCardBadges } = await import("../src/lib/badges/badges.functions");
    const badges = seen("badges", await call(getCardBadges, { playerIds: [aliPub, ALI] }, token(BO))) as unknown as { playerId: string }[];
    check(Array.isArray(badges) && badges.length === 1 && badges[0]!.playerId === aliPub, "card badges answer by public id; an account id names nobody");

    // Ratings and head-to-head.
    const ratings = await import("../src/lib/rated/ratings.functions");
    const mine = seen("my ratings", await call(ratings.getMyRatingsFn, undefined, token(ALI)));
    check(mine.playerId === aliPub, "a player's own ratings name them by public id");
    const theirs = seen("another's ratings", await call(ratings.getRatingsForFn, { playerId: aliPub }, token(BO)));
    check(theirs?.playerId === aliPub, "another player's ratings are asked for and named by public id");
    const rated = await import("../src/lib/rated/rated.functions");
    seen("a head-to-head", await call(rated.ratedHeadToHeadFn, { opponentId: aliPub }, token(BO)));
    check(seen("a head-to-head by account id", await call(rated.ratedHeadToHeadFn, { opponentId: ALI }, token(BO))).played === 0, "an account id names nobody (head-to-head)");

    // The rated settle answer: a stored settlement (account ids, as the server keeps it) reaches a phone by public id.
    const ratedServer = await import("../src/lib/rated/rated.server");
    const stored = {
      matchId: "m", format: "ffa4", choice: "mixed", gameMode: "classic", kind: "recorded", rematchOf: null, finishedAt: "now",
      players: [ALI, BO].map((u, i) => ({ userId: u, slot: i + 1, ratingBefore: 1000, placement: false, scores: [1], timesMs: [1], extras: [null], gamesWon: 0, total: 1 })),
      games: [{ type: "sudoku", signature: "x", winner: "a" }], winner: "a",
      recorded: { ownerId: CY, key: `rated:m:${CY}`, source: "rated", fallback: false, scores: [1], timesMs: [1], extras: [null] },
      placings: { [ALI]: 1, [BO]: 2 },
      ending: { kind: "forfeit", leavers: [BO] },
      ratings: { ok: true, status: "recorded", matchId: "m", players: [{ playerId: ALI }, { playerId: BO }] },
    };
    const phone = seen("a settled match", await ratedServer.publicSettleOutcome(admin, { state: "settled", result: stored } as never));
    const r = phone.result;
    check(r.players.map((p: { playerId: string }) => p.playerId).join() === `${aliPub},${boPub}` && r.placings[aliPub] === 1 && r.placings[boPub] === 2 &&
      r.ending.leavers.join() === boPub && r.recorded.ownerId === pubOf(CY) && !("key" in r.recorded) && r.ratings.players.map((p: { playerId: string }) => p.playerId).join() === `${aliPub},${boPub}`,
      "the settle answer names its players, placings, leavers, recorded owner and rating changes by public id, without the run's key");
    const aborted = seen("an aborted match", await ratedServer.publicSettleOutcome(admin, { state: "aborted", leavers: [{ userId: BO, at: "now", step: "vs" }] } as never));
    check(aborted.leavers?.[0]?.playerId === boPub && !("userId" in aborted.leavers[0]), "an abort names its leavers by public id");

    // The tournament rows, the Arena opponent and the rated match view convert through the same module.
    const src = (f: string) => readFileSync(f, "utf8");
    const tourney = src("src/lib/tournaments/tournaments.server.ts");
    check(/playerId: \(await publicIdOf\(client, other\)\)/.test(tourney) && /toPublic\(client, \[\.\.\.shown/.test(tourney) && /playerId: publicIds\.get\(p\.userId\)/.test(tourney), "the Arena board and duel opponent name players by public id");
    const view = src("src/lib/rated/rated.server.ts");
    check(/playerId: ids\.get\(p\.user_id\)/.test(view) && /ownerId: ids\.get\(match\.recorded_owner\)/.test(view) && !/\buserId: p\.user_id,\n\s+slot: p\.slot,\n\s+displayName/.test(view), "the rated match view names players and the run's owner by public id");

    for (const s of c3) {
      const text = JSON.stringify(s.value ?? null);
      const found = [ALI, BO, CY].filter((a) => text.includes(a));
      check(found.length === 0, `${s.label}: no account id (${found.length ? `found ${found.join(", ")} in ${text.slice(0, 160)}` : "none"})`);
    }
    check(c3.length >= 20, `the C3 sweep reads every step (${c3.length})`);
  });
});

t.finish();
