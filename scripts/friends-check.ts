/**
 * friends-check (wave 2 B1, 11 Nov 2026; docs/friends.md): friends through the real server functions
 * (src/lib/friends/friends.functions.ts), the real server rules (friends.server.ts) and every migration on a local
 * PostgreSQL 16, with the server-function harness's PostgREST / GoTrue stand-in (scripts/server-fn-harness.ts).
 *
 * What it proves:
 * - search: adults find adults by a prefix of the username; it never returns an under-18 account (by prefix or exact
 *   name, server and SQL); under-18s and guests can't search; requests "via search" to an under-18 are refused;
 * - invite links work for everyone (adult → teen, teen → adult), a guest sees whose link it is and is refused until
 *   they have an account, then the same link sends the request; a reset link stops working; your own link is refused;
 * - accept, decline, remove and block do exactly what they say, both ways: a decline is never told (the sender still
 *   reads "requested" and a repeat stores nothing), remove is silent, block removes the friendship and stops
 *   requests, invites, challenges, profiles, search and status both ways; unblock doesn't make friends again;
 * - online status: on by default for adults, off for under-18s, the setting both ways, online / practice / a room's
 *   lobby with its code and seats / a room's game / last seen;
 * - Invite to room only to a friend, only from an open lobby the server finds; a challenge only the caller's own, to a
 *   friend; the head-to-head from room games (archived and latest) and finished challenges;
 * - the chat policy answers "type" for friends, under-18s included, and is unchanged for strangers;
 * - 20 requests an hour (the 21st refused) and the 200-friend cap (both players) refuse the next request; guests
 *   can't reach any friends call;
 * - anon and authenticated can only read their own friendships, requests (never a request's status), blocks, link and
 *   setting, and write nothing; presence and B2's events are server-only;
 * - B2's four events (friend_events) and the four analytics events, a report from a profile through wave 1's flow,
 *   and an account's removal taking its friends rows with it.
 *
 * Needs the PostgreSQL 16 binaries (preinstalled on GitHub's runners). Without them it fails on CI and prints a NOTE
 * locally. No browser.
 */

import {
  accountToken,
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
    console.log(`  FAIL ${label}`);
  }
}
async function section(name: string, body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } catch (err) {
    check(false, `${name}: threw ${err instanceof Error ? (err.stack ?? err.message).split("\n").slice(0, 4).join(" | ") : String(err)}`);
  }
}

const quietLog = console.log;
const quietWarn = console.warn;
const quietError = console.error;
console.log = (...args: unknown[]) => {
  const line = args.map(String).join(" ");
  if (/^\s*(FAIL|NOTE)|^friends-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};
const restore = () => {
  console.log = quietLog;
  console.warn = quietWarn;
  console.error = quietError;
};

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ADA = uid(31); // adult
const BOB = uid(32); // adult
const TEE = uid(33); // 15
const TOM = uid(34); // 16
const GUS = uid(35); // a guest, later an account
const CAP = uid(36); // an adult with 200 friends
const RAT = uid(37); // an adult who sends too many requests
const FILL = (i: number) => uid(1000 + i); // adult fillers
const FILLERS = 205;

const yearsAgo = (years: number) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCDate(d.getUTCDate() - 3);
  return d.toISOString().slice(0, 10);
};

let db: LocalDb | null = null;
let rest: RestServer | null = null;

await pureChecks();

if (!postgresBin()) {
  restore();
  if (process.env["CI"]) {
    console.log(`friends-check: ${passes} passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL`);
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: the database part not run (CI runs it)");
  console.log(`friends-check: ${passes} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
}

try {
  db = startLocalDb("friends-check-");
  check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
  db.psql("UPDATE public.catalogue_items SET withdrawn_at = NULL, withdrawn_note = NULL"); // Changed with Joe's approval, 13 Nov 2026: every item live in this check's own test database before its scenario, so its cards scenario can still equip Bolt Stripes (withdrawn by 20261116800000; the withdrawn rules are proved by cosmetics-withdrawn-check).
  rest = await startRestServer(db.socketDir);
  process.env["SUPABASE_URL"] = rest.url;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
  await installServerFnPlugin();
  await databaseChecks(db, rest);
} catch (err) {
  check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await rest?.stop();
  db?.stop();
}

restore();
console.log(`friends-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: search, links, requests, accept, decline, remove, block, status, invites, challenges, limits, RLS and events hold.");
process.exit(0);

/* =================================================================== pure rules */

async function pureChecks(): Promise<void> {
  await section("chat policy", async () => {
    const { chatPolicy, chatPolicies } = await import("../src/lib/safety/chatPolicy");
    const guest = { isGuest: true, isUnder18: null };
    const teen = { isGuest: false, isUnder18: true };
    const adult = { isGuest: false, isUnder18: false };
    const unknown = { isGuest: false, isUnder18: null };
    check([teen, adult, unknown].every((p) => chatPolicy("friends", p) === "type"), "chat policy: the friends context types for every account, under-18s included");
    for (const context of ["rated", "tournament"] as const) {
      check(chatPolicy(context, teen, { friends: true }) === "type", `chat policy: ${context}: an under-18 types to friends`);
      check(chatPolicy(context, unknown, { friends: true }) === "type", `chat policy: ${context}: an unknown age types to friends`);
      check(chatPolicy(context, adult, { friends: true }) === "type", `chat policy: ${context}: an adult types to friends`);
      // Strangers unchanged.
      check(chatPolicy(context, teen) === "quick_phrases" && chatPolicy(context, teen, { friends: false }) === "quick_phrases", `chat policy: ${context}: an under-18 with strangers still gets quick phrases`);
      check(chatPolicy(context, guest) === "quick_phrases" && chatPolicy(context, guest, { friends: true }) === "quick_phrases", `chat policy: ${context}: a guest (no friends) still gets quick phrases`);
      check(chatPolicy(context, unknown) === "quick_phrases", `chat policy: ${context}: an unknown age with strangers still gets quick phrases`);
      check(chatPolicy(context, adult) === "type", `chat policy: ${context}: an adult with strangers still types`);
    }
    check([guest, teen, adult, unknown].every((p) => chatPolicy("room", p) === "type"), "chat policy: rooms still type for everyone");
    check(JSON.stringify(chatPolicies("rated", [adult, guest])) === '["type","quick_phrases"]', "chat policy: chatPolicies unchanged");
  });

  await section("words and tokens", async () => {
    const f = await import("../src/lib/friends/friends");
    check(f.FRIENDS_CAP === 200, "the cap is 200");
    check(f.inviteTokenFrom("ABCDEFGHJKMN") === "abcdefghjkmn" && f.inviteTokenFrom("short") === null && f.inviteTokenFrom("abc/def?ghij") === null, "invite tokens: 12 letters or digits, lower-cased");
    check(f.inviteLink("abcdefghjkmn") === "https://joulz.uk/friends?invite=abcdefghjkmn", "the invite link is on APP_URL");
    check(f.searchQueryOk("pr") && !f.searchQueryOk("p") && !f.searchQueryOk("pri ya") && !f.searchQueryOk("x".repeat(17)), "search queries: 2–16 letters, numbers or underscores");
    const now = Date.parse("2026-11-11T12:00:00Z");
    check(f.lastSeenText("2026-11-11T10:00:00Z", now) === "2 h ago", "last seen: hours");
    check(f.lastSeenText("2026-11-10T08:00:00Z", now) === "Yesterday" && f.lastSeenText("2026-11-10T18:00:00Z", now) === "18 h ago", "last seen: yesterday");
    check(f.lastSeenText("2026-11-08T12:00:00Z", now) === "3 days ago", "last seen: days");
    check(f.statusText({ kind: "room", code: "BLTZ", players: 3, maxPlayers: 16 }, now) === "In room BLTZ, 3 of 16", "status: a lobby with its code and seats");
    check(f.statusText({ kind: "hidden" }, now) === "" && !f.isOnline({ kind: "hidden" }), "status: hidden shows nothing and isn't online");
    check(f.joinableRoom({ kind: "room", code: "BLTZ", players: 16, maxPlayers: 16 }) === null && f.joinableRoom({ kind: "room", code: "BLTZ", players: 3, maxPlayers: 16 }) === "BLTZ", "a full lobby can't be joined from the list");
    const limits = (await import("../src/lib/friends/friends.server")).FRIEND_LIMITS;
    check(limits.request.max === 20 && limits.request.windowSeconds === 3600 && limits.request.failClosed === true, "requests: 20 an hour, refused on a database error");
  });
}

/* =================================================================== the database */

async function databaseChecks(db: LocalDb, rest: RestServer): Promise<void> {
  const fns = await import("../src/lib/friends/friends.functions");
  const account = await import("../src/lib/account/account.functions");
  const { flushAnalytics } = await import("../src/lib/data/events.server");
  const { createClient } = await import("@supabase/supabase-js");
  const call = callServerFn;
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };
  const refused = (sql: string) => {
    const out = db.psql(`BEGIN; ${sql}; ROLLBACK;`);
    return out.ok && !/ERROR/.test(out.err) ? "" : out.err;
  };
  const deviceDb = (token: string | null) =>
    createClient(rest.url, ANON_KEY, {
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
  const events = async (event: string, player?: string) => {
    await flushAnalytics();
    return Number(q(`SELECT count(*) FROM analytics.events WHERE event = '${event}'${player ? ` AND player_id = '${player}'` : ""}`));
  };
  const friendEvents = (kind: string, recipient: string) =>
    Number(q(`SELECT count(*) FROM friend_events WHERE kind = '${kind}' AND recipient_id = '${recipient}'`));
  const areFriends = (a: string, b: string) =>
    q(`SELECT count(*) FROM friendships WHERE user_low = least('${a}'::uuid, '${b}'::uuid) AND user_high = greatest('${a}'::uuid, '${b}'::uuid)`) === "1";
  const requestRows = (from: string, to: string) => Number(q(`SELECT count(*) FROM friend_requests WHERE from_user_id = '${from}' AND to_user_id = '${to}'`));

  // Accounts as the server makes them; GUS stays a guest for now.
  const people: [string, string, string][] = [
    [ADA, "Ada_Adult", yearsAgo(30)],
    [BOB, "Bob_Adult", yearsAgo(40)],
    [TEE, "Tee_Teen", yearsAgo(15)],
    [TOM, "Tom_Teen", yearsAgo(16)],
    [CAP, "Cap_Full", yearsAgo(25)],
    [RAT, "Rat_Many", yearsAgo(25)],
  ];
  q(`INSERT INTO auth.users (id, is_anonymous, email) VALUES ${people.map(([id, n]) => `('${id}', false, '${n.toLowerCase()}@example.com')`).join(", ")}, ('${GUS}', true, NULL), ('${uid(97)}', true, NULL), ('${uid(98)}', true, NULL), ('${uid(99)}', true, NULL)`);
  for (const [id, name, dob] of people) q(`SELECT public.create_profile('${id}', '${name}', 3::smallint, DATE '${dob}', NULL)`);
  q(`INSERT INTO auth.users (id, is_anonymous, email) SELECT ('00000000-0000-4000-8000-' || lpad((1000 + i)::text, 12, '0'))::uuid, false, 'f' || i || '@example.com' FROM generate_series(0, ${FILLERS - 1}) i`);
  q(`DO $$ BEGIN FOR i IN 0..${FILLERS - 1} LOOP PERFORM public.create_profile(('00000000-0000-4000-8000-' || lpad((1000 + i)::text, 12, '0'))::uuid, 'Fill_' || i, 1::smallint, DATE '1980-01-01', NULL); END LOOP; END $$`);
  check(Number(q(`SELECT count(*) FROM profiles`)) === people.length + FILLERS, "accounts made");
  const tok = {
    ada: accountToken(ADA),
    bob: accountToken(BOB),
    tee: accountToken(TEE),
    tom: accountToken(TOM),
    gus: userToken(GUS),
    cap: accountToken(CAP),
    rat: accountToken(RAT),
  };
  // Changed with Joe's approval, 14 Nov 2026 (Security C3: phones know players by public id): every player id sent to
  // a friends function, and every player id read from one's answer, is that player's public id, `pub(X)`.
  const publicIds = new Map<string, string>();
  const pub = (account: string): string => {
    if (!publicIds.has(account)) publicIds.set(account, q(`SELECT public.public_id_of('${account}')`));
    return publicIds.get(account)!;
  };

  /* ------------------------------------------------------------- search */
  await section("search", async () => {
    const ada = await call(fns.friendSearchFn, { query: "bob" }, tok.ada);
    check(ada.ok && ada.results.length === 1 && ada.results[0].id === pub(BOB) && ada.results[0].relation === "none", `an adult finds an adult by prefix (${JSON.stringify(ada).slice(0, 160)})`);
    const ignoringCase = await call(fns.friendSearchFn, { query: "BOB_ADULT" }, tok.ada);
    check(ignoringCase.ok && ignoringCase.results[0]?.id === pub(BOB), "search ignores capitals");
    for (const query of ["tee", "Tee_Teen", "tom_t", "t"]) {
      const r = await call(fns.friendSearchFn, { query }, tok.ada);
      check(!r.ok || r.results.every((h: { id: string }) => h.id !== pub(TEE) && h.id !== pub(TOM)), `search never returns an under-18 account ("${query}")`);
    }
    const sqlTeen = JSON.parse(q(`SELECT public.friends_search('${ADA}', 'te', 20)`)) as { id: string }[];
    check(sqlTeen.every((h) => h.id !== TEE), "SQL: search never returns an under-18 account");
    const mine = await call(fns.friendSearchFn, { query: "ada" }, tok.ada);
    check(mine.ok && mine.results.length === 0, "search never returns the caller");
    const wildcard = await call(fns.friendSearchFn, { query: "__" }, tok.ada);
    check(wildcard.ok && wildcard.results.length === 0, "an underscore is a letter, not a wildcard");
    const teen = await call(fns.friendSearchFn, { query: "bob" }, tok.tee);
    check(!teen.ok && teen.reason === "under18", "an under-18 can't search");
    check(q(`SELECT public.friends_search('${TEE}', 'bob', 10)`) === "[]", "SQL: an under-18's search returns nothing");
    const guest = await call(fns.friendSearchFn, { query: "bob" }, tok.gus);
    check(!guest.ok && guest.reason === "account", "a guest can't search");
    const anonymous = await call(fns.friendSearchFn, { query: "bob" }, null).catch(() => "threw");
    check(anonymous === "threw", "signed out: refused by the auth middleware");
  });

  /* ------------------------------------------------------------- requests by search, accept */
  await section("request and accept", async () => {
    const sent = await call(fns.friendRequestFn, { playerId: pub(BOB) }, tok.ada);
    check(sent.ok && sent.outcome === "sent" && requestRows(ADA, BOB) === 1, "a request by search is stored");
    check(friendEvents("friend_request_received", BOB) === 1, "B2: friend_request_received for the recipient");
    check((await events("friend_request_sent", ADA)) === 1, "analytics: friend_request_sent");
    check(q(`SELECT props ->> 'via' FROM analytics.events WHERE event = 'friend_request_sent' AND player_id = '${ADA}'`) === "search", "analytics: friend_request_sent says via search");
    const again = await call(fns.friendRequestFn, { playerId: pub(BOB) }, tok.ada);
    check(again.ok && requestRows(ADA, BOB) === 1 && friendEvents("friend_request_received", BOB) === 1, "a repeat request stores nothing new");

    const toTeen = await call(fns.friendRequestFn, { playerId: pub(TEE) }, tok.ada);
    check(!toTeen.ok && toTeen.reason === "not_found" && requestRows(ADA, TEE) === 0, "a request 'by search' to an under-18 is refused");
    const sqlTeen = JSON.parse(q(`SELECT public.friends_send_request('${ADA}', '${TEE}', 'search', 200)`)) as { result: string };
    check(sqlTeen.result === "not_found" && requestRows(ADA, TEE) === 0, "SQL: a request 'by search' to an under-18 is refused");
    const fromTeen = await call(fns.friendRequestFn, { playerId: pub(ADA) }, tok.tee);
    check(!fromTeen.ok && fromTeen.reason === "under18", "an under-18 can't request by search");
    const fromGuest = await call(fns.friendRequestFn, { playerId: pub(ADA) }, tok.gus);
    check(!fromGuest.ok && fromGuest.reason === "account", "a guest can't request");

    const waiting = await call(fns.friendsWaitingFn, undefined, tok.bob);
    check(waiting === 1, `the badge counts one waiting request (${waiting})`);
    const bobView = await call(fns.friendsOverviewFn, undefined, tok.bob);
    const incoming = bobView.ok ? bobView.overview.incoming : [];
    check(incoming.length === 1 && incoming[0].id === pub(ADA) && incoming[0].via === "search", "Requests list the sender with how they found you");
    const accepted = await call(fns.friendRespondFn, { requestId: incoming[0].requestId, accept: true }, tok.bob);
    check(accepted.ok && accepted.outcome === "accepted" && areFriends(ADA, BOB), "accept: friends");
    check(friendEvents("friend_request_accepted", ADA) === 1, "B2: friend_request_accepted for the sender");
    check((await events("friend_added", BOB)) === 1, "analytics: friend_added");
    check((await call(fns.friendsWaitingFn, undefined, tok.bob)) === 0, "the badge clears");
    const both = [await call(fns.friendsOverviewFn, undefined, tok.ada), await call(fns.friendsOverviewFn, undefined, tok.bob)];
    check(both.every((o) => o.ok && o.overview.friends.length === 1) && both[0].overview.friends[0].id === pub(BOB) && both[1].overview.friends[0].id === pub(ADA), "accept: both lists show the friendship");
    const twice = await call(fns.friendRespondFn, { requestId: incoming[0].requestId, accept: true }, tok.bob);
    check(twice.ok && twice.outcome === "gone", "answering twice changes nothing");
    const stranger = await call(fns.friendRespondFn, { requestId: incoming[0].requestId, accept: false }, tok.tom);
    check(stranger.ok && stranger.outcome === "gone" && areFriends(ADA, BOB), "nobody else can answer someone's request");
    const found = await call(fns.friendSearchFn, { query: "bob" }, tok.ada);
    check(found.ok && found.results[0]?.relation === "friends", "search shows 'Already friends'");
  });

  /* ------------------------------------------------------------- the Friendly badge (C2's badge_award) */
  await section("friendly badge", async () => {
    const pal = (i: number) => uid(3000 + i);
    q(`INSERT INTO auth.users (id, is_anonymous, email) SELECT ('00000000-0000-4000-8000-' || lpad((3000 + i)::text, 12, '0'))::uuid, false, 'p' || i || '@example.com' FROM generate_series(0, 7) i`);
    for (let i = 0; i <= 7; i++) q(`SELECT public.create_profile('${pal(i)}', 'Pal_${i}', 2::smallint, DATE '1985-01-01', NULL)`);
    const tokOf = (i: number) => accountToken(pal(i));
    const hub = pal(0);
    const has = (id: string) => Number(q(`SELECT count(*) FROM player_badges WHERE user_id = '${id}' AND badge = 'friendly'`));
    const befriend = async (i: number) => {
      const sent = await call(fns.friendRequestFn, { playerId: pub(pal(i)) }, tokOf(0));
      const view = await call(fns.friendsOverviewFn, undefined, tokOf(i));
      const req = view.ok ? view.overview.incoming.find((r: { id: string }) => r.id === pub(hub)) : null;
      const acc = await call(fns.friendRespondFn, { requestId: req?.requestId, accept: true }, tokOf(i));
      return sent.ok && acc.ok && acc.outcome === "accepted";
    };
    let ok = true;
    for (let i = 1; i <= 4; i++) ok = (await befriend(i)) && ok;
    check(ok && q(`SELECT friends.friend_count('${hub}')`) === "4", "Friendly: four friends made");
    check(has(hub) === 0, "Friendly: not at 4 friends");
    await call(fns.friendsOverviewFn, undefined, tokOf(0));
    check(has(hub) === 0, "Friendly: opening the list at 4 friends awards nothing");
    check(await befriend(5), "Friendly: the fifth friend accepted");
    check(has(hub) === 1, "Friendly: earned at the fifth friend (accepted by the other player)");
    check([1, 2, 3, 4, 5].every((i) => has(pal(i)) === 0), "Friendly: the friends with fewer than 5 don't earn it");
    check(q(`SELECT detail ->> 'friends' FROM player_badges WHERE user_id = '${hub}' AND badge = 'friendly'`) === "5", "Friendly: stored with the count it was earned at");
    check((await events("badge_earned", hub)) === 1 && q(`SELECT props ->> 'badge' FROM analytics.events WHERE event = 'badge_earned' AND player_id = '${hub}'`) === "friendly", "Friendly: badge_earned recorded once");
    // Idempotent: a sixth friend (through a mutual request), opening the list, removing and re-adding.
    await call(fns.friendRequestFn, { playerId: pub(hub) }, tokOf(6));
    const mutual = await call(fns.friendRequestFn, { playerId: pub(pal(6)) }, tokOf(0));
    check(mutual.ok && mutual.outcome === "accepted", "Friendly: a sixth friend through a mutual request");
    await call(fns.friendsOverviewFn, undefined, tokOf(0));
    await call(fns.friendRemoveFn, { playerId: pub(pal(6)) }, tokOf(0));
    await call(fns.friendRemoveFn, { playerId: pub(pal(5)) }, tokOf(0));
    check(await befriend(5), "Friendly: back to five after removing and re-adding");
    check(has(hub) === 1 && (await events("badge_earned", hub)) === 1, "Friendly: never awarded twice (sixth friend, list opened, removed and re-added)");
    check(Number(q(`SELECT count(*) FROM coin_ledger WHERE user_id = '${hub}' AND reason = 'badge_reward'`)) === 0, "Friendly: no coins (Common)");
    // The accepting side earns it too: Pal_7 reaches five by accepting.
    for (const i of [1, 2, 3, 4]) {
      await call(fns.friendRequestFn, { playerId: pub(pal(7)) }, tokOf(i));
      const view = await call(fns.friendsOverviewFn, undefined, tokOf(7));
      const req = view.ok ? view.overview.incoming.find((r: { id: string }) => r.id === pub(pal(i))) : null;
      await call(fns.friendRespondFn, { requestId: req?.requestId, accept: true }, tokOf(7));
    }
    check(has(pal(7)) === 0 && q(`SELECT friends.friend_count('${pal(7)}')`) === "4", "Friendly: the accepting side at 4, not yet");
    await call(fns.friendRequestFn, { playerId: pub(pal(7)) }, tokOf(0));
    const v7 = await call(fns.friendsOverviewFn, undefined, tokOf(7));
    const r7 = v7.ok ? v7.overview.incoming.find((r: { id: string }) => r.id === pub(hub)) : null;
    await call(fns.friendRespondFn, { requestId: r7?.requestId, accept: true }, tokOf(7));
    check(has(pal(7)) === 1, "Friendly: the player who accepts their fifth friend earns it too");
  });

  /* ------------------------------------------------------------- invite links */
  let bobToken = "";
  await section("invite links", async () => {
    const teeLink = await call(fns.friendLinkFn, { reset: false }, tok.tee);
    check(teeLink.ok && /^[a-z0-9]{12}$/.test(teeLink.token) && teeLink.link.endsWith(`?invite=${teeLink.token}`), "an under-18 has an invite link");
    const same = await call(fns.friendLinkFn, {}, tok.tee);
    check(same.ok && same.token === teeLink.token, "the link stays the same until reset");
    const adaToTee = await call(fns.friendLinkRequestFn, { token: teeLink.token }, tok.ada);
    check(adaToTee.ok && adaToTee.outcome === "sent" && adaToTee.owner.id === pub(TEE) && requestRows(ADA, TEE) === 1, "an adult adds an under-18 through their link");
    check(q(`SELECT via FROM friend_requests WHERE from_user_id = '${ADA}' AND to_user_id = '${TEE}'`) === "link", "stored as via link");
    const teeView = await call(fns.friendsOverviewFn, undefined, tok.tee);
    const req = teeView.ok ? teeView.overview.incoming.find((r: { id: string }) => r.id === pub(ADA)) : null;
    const ok = await call(fns.friendRespondFn, { requestId: req?.requestId, accept: true }, tok.tee);
    check(ok.ok && ok.outcome === "accepted" && areFriends(ADA, TEE), "the under-18 accepts");
    await flushAnalytics();
    check(q(`SELECT props ->> 'via' FROM analytics.events WHERE event = 'friend_added' AND player_id = '${TEE}'`) === "link", "analytics: friend_added says via link");

    const bobLink = await call(fns.friendLinkFn, {}, tok.bob);
    bobToken = bobLink.token;
    const tomToBob = await call(fns.friendLinkRequestFn, { token: bobToken }, tok.tom);
    check(tomToBob.ok && tomToBob.outcome === "sent" && requestRows(TOM, BOB) === 1, "an under-18 adds an adult through their link");
    const own = await call(fns.friendLinkRequestFn, { token: bobToken }, tok.bob);
    check(!own.ok && own.reason === "self", "your own link is refused");

    // A guest: sees whose link it is, can't send until they have an account, then the same link works.
    const owner = await call(fns.friendLinkOwnerFn, { token: bobToken }, tok.gus);
    check(owner.ok && owner.owner?.username === "Bob_Adult" && owner.owner?.id === pub(BOB), "a guest sees whose link it is");
    const guestSend = await call(fns.friendLinkRequestFn, { token: bobToken }, tok.gus);
    check(!guestSend.ok && guestSend.reason === "account" && requestRows(GUS, BOB) === 0, "a guest's request waits for an account");
    q(`UPDATE auth.users SET is_anonymous = false, email = 'gus@example.com' WHERE id = '${GUS}'`);
    tok.gus = accountToken(GUS);
    const made = await call(account.completeSignUpFn, { username: "Gus_New", dateOfBirth: yearsAgo(22), colour: 5, country: "GB" }, tok.gus);
    check(made?.kind === "account", `the guest signs up (${JSON.stringify(made).slice(0, 100)})`);
    const afterSignUp = await call(fns.friendLinkRequestFn, { token: bobToken }, tok.gus);
    check(afterSignUp.ok && afterSignUp.outcome === "sent" && requestRows(GUS, BOB) === 1, "after sign-up the link sends the request");

    const reset = await call(fns.friendLinkFn, { reset: true }, tok.bob);
    check(reset.ok && reset.token !== bobToken, "reset gives a new token");
    const dead = await call(fns.friendLinkOwnerFn, { token: bobToken }, tok.ada);
    check(dead.ok && dead.owner === null, "the old token belongs to nobody");
    const deadSend = await call(fns.friendLinkRequestFn, { token: bobToken }, tok.cap);
    check(!deadSend.ok && deadSend.reason === "not_found" && requestRows(CAP, BOB) === 0, "the old link no longer sends requests");
    const newSend = await call(fns.friendLinkRequestFn, { token: reset.token }, tok.cap);
    check(newSend.ok && requestRows(CAP, BOB) === 1, "the new link works");
    const guestLink = await call(fns.friendLinkFn, {}, userToken(uid(99)));
    check(!guestLink.ok && guestLink.reason === "account", "a guest has no invite link");
    bobToken = reset.token;
  });

  /* ------------------------------------------------------------- decline */
  await section("decline", async () => {
    const before = q(`SELECT count(*) FROM friend_events`);
    const bobView = await call(fns.friendsOverviewFn, undefined, tok.bob);
    const fromTom = bobView.ok ? bobView.overview.incoming.find((r: { id: string }) => r.id === pub(TOM)) : null;
    const declined = await call(fns.friendRespondFn, { requestId: fromTom?.requestId, accept: false }, tok.bob);
    check(declined.ok && declined.outcome === "declined" && !areFriends(TOM, BOB), "decline: not friends");
    check(q(`SELECT count(*) FROM friend_events`) === before, "decline: no event for anyone (the sender isn't told)");
    const tomView = await call(fns.friendsOverviewFn, undefined, tok.tom);
    check(tomView.ok && tomView.overview.outgoing.includes(pub(BOB)), "decline: the sender's list still shows the request as sent");
    const tomProfile = await call(fns.friendProfileFn, { playerId: pub(BOB) }, tok.tom);
    check(tomProfile.ok && tomProfile.profile.relation === "requested", "decline: the sender's view of the profile still says requested");
    const repeat = await call(fns.friendLinkRequestFn, { token: bobToken }, tok.tom);
    check(repeat.ok && repeat.outcome === "sent" && requestRows(TOM, BOB) === 1 && q(`SELECT count(*) FROM friend_events`) === before, "decline: a repeat within 30 days answers sent and stores nothing");
    const bobAfter = await call(fns.friendsOverviewFn, undefined, tok.bob);
    check(bobAfter.ok && !bobAfter.overview.incoming.some((r: { id: string }) => r.id === pub(TOM)), "decline: gone from the recipient's Requests");
    check(q(`SELECT count(*) FROM information_schema.column_privileges WHERE table_name = 'friend_requests' AND grantee = 'authenticated' AND column_name IN ('status', 'responded_at')`) === "0", "a request's status is never readable by a phone");
  });

  /* ------------------------------------------------------------- remove */
  await section("remove", async () => {
    const before = q(`SELECT count(*) FROM friend_events`);
    const removed = await call(fns.friendRemoveFn, { playerId: pub(BOB) }, tok.ada);
    check(removed.ok && removed.removed && !areFriends(ADA, BOB), "remove: not friends");
    const lists = [await call(fns.friendsOverviewFn, undefined, tok.ada), await call(fns.friendsOverviewFn, undefined, tok.bob)];
    check(lists.every((o) => o.ok && !o.overview.friends.some((f: { id: string }) => f.id === pub(ADA) || f.id === pub(BOB))), "remove: gone from both lists");
    check(q(`SELECT count(*) FROM friend_events`) === before, "remove: silent (no event)");
    check((await events("friend_removed", ADA)) === 1, "analytics: friend_removed");
    const again = await call(fns.friendRemoveFn, { playerId: pub(BOB) }, tok.ada);
    check(again.ok && !again.removed && (await events("friend_removed", ADA)) === 1, "removing a non-friend changes nothing");
  });

  /* ------------------------------------------------------------- block */
  await section("block", async () => {
    // Friends again (BOB asks, ADA accepts), then ADA blocks BOB.
    await call(fns.friendRequestFn, { playerId: pub(ADA) }, tok.bob);
    const adaView = await call(fns.friendsOverviewFn, undefined, tok.ada);
    const req = adaView.ok ? adaView.overview.incoming.find((r: { id: string }) => r.id === pub(BOB)) : null;
    await call(fns.friendRespondFn, { requestId: req?.requestId, accept: true }, tok.ada);
    check(areFriends(ADA, BOB), "block: friends first");
    const adaLink = await call(fns.friendLinkFn, {}, tok.ada);
    const blocked = await call(fns.friendBlockFn, { playerId: pub(BOB) }, tok.ada);
    check(blocked.ok && blocked.removed && !areFriends(ADA, BOB), "block: the friendship goes");
    check((await events("friend_blocked", ADA)) === 1, "analytics: friend_blocked");
    const eventsBefore = q(`SELECT count(*) FROM friend_events`);
    const bobAsks = await call(fns.friendRequestFn, { playerId: pub(ADA) }, tok.bob);
    const bobLinks = await call(fns.friendLinkRequestFn, { token: adaLink.token }, tok.bob);
    check(bobAsks.ok && bobAsks.outcome === "sent" && bobLinks.ok && bobLinks.outcome === "sent", "block: the blocked player is told 'sent' (never that they're blocked)");
    check(Number(q(`SELECT count(*) FROM friend_requests WHERE from_user_id = '${BOB}' AND to_user_id = '${ADA}' AND status = 'pending'`)) === 0 && q(`SELECT count(*) FROM friend_events`) === eventsBefore, "block: the blocked player's requests store nothing and reach nobody");
    const adaAsks = await call(fns.friendRequestFn, { playerId: pub(BOB) }, tok.ada);
    check(!adaAsks.ok && adaAsks.reason === "blocked", "block: the blocker can't request until they unblock");
    const bobSeesAda = await call(fns.friendProfileFn, { playerId: pub(ADA) }, tok.bob);
    check(!bobSeesAda.ok && bobSeesAda.reason === "not_found", "block: the blocked player can't open the blocker's profile");
    const adaSeesBob = await call(fns.friendProfileFn, { playerId: pub(BOB) }, tok.ada);
    check(adaSeesBob.ok && adaSeesBob.profile.relation === "blocked" && adaSeesBob.profile.status === null && adaSeesBob.profile.headToHead === null, "block: the blocker sees no status, only Unblock");
    const s1 = await call(fns.friendSearchFn, { query: "bob" }, tok.ada);
    const s2 = await call(fns.friendSearchFn, { query: "ada" }, tok.bob);
    check(s1.ok && s1.results.length === 0 && s2.ok && s2.results.length === 0, "block: hidden from each other's search");
    const invite = await call(fns.friendInviteFn, { playerId: pub(ADA) }, tok.bob);
    check(!invite.ok && invite.reason === "not_friends", "block: no room invites");
    const status = JSON.parse(q(`SELECT public.friends_overview('${BOB}', 200)`)) as { friends: { id: string }[] };
    check(!status.friends.some((f) => f.id === ADA), "block: no status either way");
    const adaList = await call(fns.friendsOverviewFn, undefined, tok.ada);
    check(adaList.ok && adaList.overview.blocked.some((b: { id: string }) => b.id === pub(BOB)), "block: listed under the blocker's blocked players");
    const bobList = await call(fns.friendsOverviewFn, undefined, tok.bob);
    check(bobList.ok && bobList.overview.blocked.length === 0, "block: the blocked player sees no block");
    const unblocked = await call(fns.friendUnblockFn, { playerId: pub(BOB) }, tok.ada);
    check(unblocked.ok && unblocked.unblocked && !areFriends(ADA, BOB), "unblock: lifted, not friends again");
    const after = await call(fns.friendProfileFn, { playerId: pub(ADA) }, tok.bob);
    check(after.ok && after.profile.relation === "none", "unblock: the profile shows again");
  });

  /* ------------------------------------------------------------- status */
  await section("online status", async () => {
    // ADA and TEE are friends (invite links). TEE is under 18: hidden by default.
    q(`SELECT public.friends_presence_beat('${TEE}', 'app')`);
    const seen = async (viewer: string, token: string, friend: string) => {
      const o = await call(fns.friendsOverviewFn, undefined, token);
      return (o.ok ? o.overview.friends.find((f: { id: string }) => f.id === pub(friend))?.status : null) as { kind: string; code?: string; players?: number; maxPlayers?: number; lastSeen?: string } | null;
    };
    check((await seen(ADA, tok.ada, TEE))?.kind === "hidden", "status: an under-18 is hidden by default");
    const teeOwn = await call(fns.friendsOverviewFn, undefined, tok.tee);
    check(teeOwn.ok && teeOwn.overview.showOnline === false && teeOwn.overview.showOnlineSetting === null, "status: an under-18's setting starts off");
    const adaOwn = await call(fns.friendsOverviewFn, undefined, tok.ada);
    check(adaOwn.ok && adaOwn.overview.showOnline === true && adaOwn.overview.showOnlineSetting === null, "status: an adult's setting starts on");
    check((await seen(TEE, tok.tee, ADA))?.kind === "offline", "status: an adult never seen shows as offline");
    const beat = await call(fns.friendBeatFn, { activity: "app" }, tok.ada);
    check(beat.ok && (await seen(TEE, tok.tee, ADA))?.kind === "online", "status: a beat shows online");
    await call(fns.friendBeatFn, { activity: "practice" }, tok.ada);
    check((await seen(TEE, tok.tee, ADA))?.kind === "practice", "status: playing Practice");
    const guestBeat = await call(fns.friendBeatFn, { activity: "app" }, userToken(uid(98)));
    check(!guestBeat.ok && q(`SELECT count(*) FROM player_presence WHERE user_id = '${uid(98)}'`) === "0", "status: a guest's beat stores nothing");
    const on = await call(fns.friendShowOnlineFn, { show: true }, tok.tee);
    check(on.ok && on.showOnline === true && (await seen(ADA, tok.ada, TEE))?.kind === "online", "status: an under-18 who turns it on shows");
    const off = await call(fns.friendShowOnlineFn, { show: false }, tok.ada);
    check(off.ok && !off.showOnline && (await seen(TEE, tok.tee, ADA))?.kind === "hidden", "status: an adult who turns it off is hidden");
    const back = await call(fns.friendShowOnlineFn, { show: null }, tok.ada);
    check(back.ok && back.showOnline && (await seen(TEE, tok.tee, ADA))?.kind === "practice", "status: back to the default (on for adults)");
    const teeDefault = await call(fns.friendShowOnlineFn, { show: null }, tok.tee);
    check(teeDefault.ok && !teeDefault.showOnline && (await seen(ADA, tok.ada, TEE))?.kind === "hidden", "status: back to the default (off for under-18s)");
    q(`SELECT public.friends_set_show_online('${TEE}', true)`);

    // A lobby: ADA in room FRND with one other player.
    q(`INSERT INTO duels (id, room_code, round_order, status, max_players, host_user_id) VALUES ('${uid(500)}', 'FRND', '[]', 'waiting', 16, '${ADA}')`);
    q(`INSERT INTO duel_players (duel_id, player_slot, display_name, user_id, status) VALUES ('${uid(500)}', 1, 'Ada_Adult', '${ADA}', 'active'), ('${uid(500)}', 2, 'Fill_0', '${FILL(0)}', 'active')`);
    q(`INSERT INTO duel_presence (duel_id, user_id, last_seen_at) VALUES ('${uid(500)}', '${ADA}', now())`);
    const room = await seen(TEE, tok.tee, ADA);
    check(room?.kind === "room" && room.code === "FRND" && room.players === 2 && room.maxPlayers === 16, `status: in a lobby, with its code and seats (${JSON.stringify(room)})`);
    q(`UPDATE duels SET status = 'playing' WHERE id = '${uid(500)}'`);
    check((await seen(TEE, tok.tee, ADA))?.kind === "playing", "status: in a room's game");
    q(`UPDATE duels SET status = 'waiting' WHERE id = '${uid(500)}'`);
    // Long gone: last seen.
    q(`UPDATE player_presence SET last_seen_at = now() - interval '3 hours' WHERE user_id = '${TEE}'`);
    q(`UPDATE player_presence SET last_seen_at = now() - interval '3 hours' WHERE user_id = '${ADA}'`);
    q(`UPDATE duel_presence SET last_seen_at = now() - interval '2 hours' WHERE user_id = '${ADA}'`);
    q(`UPDATE duel_players SET last_seen_at = now() - interval '2 hours' WHERE user_id = '${ADA}'`);
    const gone = await seen(TEE, tok.tee, ADA);
    check(gone?.kind === "offline" && typeof gone.lastSeen === "string" && Math.abs(Date.parse(gone.lastSeen) - (Date.now() - 2 * 3600_000)) < 120_000, "status: offline with when they were last seen");
    q(`UPDATE duel_presence SET last_seen_at = now() WHERE user_id = '${ADA}'`);
  });

  /* ------------------------------------------------------------- invite to room, challenge */
  await section("invite to room", async () => {
    const profile = await call(fns.friendProfileFn, { playerId: pub(TEE) }, tok.ada);
    check(profile.ok && profile.profile.relation === "friends" && profile.profile.myRoom?.code === "FRND", "Invite to room shows when the viewer is in a lobby");
    const sent = await call(fns.friendInviteFn, { playerId: pub(TEE) }, tok.ada);
    check(sent.ok && sent.code === "FRND" && friendEvents("room_invite_received", TEE) === 1, "B2: room_invite_received, for the server's own lobby");
    check(JSON.parse(q(`SELECT payload FROM friend_events WHERE kind = 'room_invite_received'`)).code === "FRND", "the event carries the room code");
    const twice = await call(fns.friendInviteFn, { playerId: pub(TEE) }, tok.ada);
    check(twice.ok && friendEvents("room_invite_received", TEE) === 1, "the same invite within two minutes is recorded once");
    const teeView = await call(fns.friendsOverviewFn, undefined, tok.tee);
    check(teeView.ok && teeView.overview.invites.length === 1 && teeView.overview.invites[0].code === "FRND" && teeView.overview.invites[0].id === pub(ADA), "the invite shows in the friend's list");
    const stranger = await call(fns.friendInviteFn, { playerId: pub(TOM) }, tok.ada);
    check(!stranger.ok && stranger.reason === "not_friends" && friendEvents("room_invite_received", TOM) === 0, "only friends can be invited");
    const noRoom = await call(fns.friendInviteFn, { playerId: pub(ADA) }, tok.tee);
    check(!noRoom.ok && noRoom.reason === "no_room", "no lobby, no invite");
    const teeProfile = await call(fns.friendProfileFn, { playerId: pub(ADA) }, tok.tee);
    check(teeProfile.ok && teeProfile.profile.myRoom === null, "Invite to room is hidden outside a lobby");
    q(`UPDATE duels SET status = 'playing' WHERE id = '${uid(500)}'`);
    const playing = await call(fns.friendInviteFn, { playerId: pub(TEE) }, tok.ada);
    check(!playing.ok && playing.reason === "no_room", "no invites once the game has started");
    const teeLater = await call(fns.friendsOverviewFn, undefined, tok.tee);
    check(teeLater.ok && teeLater.overview.invites.length === 0, "an invite to a room that started no longer shows");
  });

  await section("challenge a friend", async () => {
    q(`INSERT INTO async_rooms (id, kind, room_key, seed, round_count, opens_at, closes_at) VALUES ('${uid(600)}', 'challenge', 'challenge:FRENDS', 1, 3, now(), now() + interval '7 days')`);
    q(`INSERT INTO challenges (room_id, code, created_by, source, round_count, expires_at) VALUES ('${uid(600)}', 'FRENDS', '${ADA}', 'play', 3, now() + interval '7 days')`);
    const sent = await call(fns.friendChallengeFn, { playerId: pub(TEE), code: "frends" }, tok.ada);
    check(sent.ok && friendEvents("friend_challenge_received", TEE) === 1, "B2: friend_challenge_received");
    const teeView = await call(fns.friendsOverviewFn, undefined, tok.tee);
    check(teeView.ok && teeView.overview.challenges.length === 1 && teeView.overview.challenges[0].code === "FRENDS", "the challenge shows in the friend's list");
    const twice = await call(fns.friendChallengeFn, { playerId: pub(TEE), code: "FRENDS" }, tok.ada);
    check(twice.ok && friendEvents("friend_challenge_received", TEE) === 1, "the same challenge is sent once");
    const notMine = await call(fns.friendChallengeFn, { playerId: pub(ADA), code: "FRENDS" }, tok.tee);
    check(!notMine.ok && notMine.reason === "not_found", "only your own challenge");
    const notFriend = await call(fns.friendChallengeFn, { playerId: pub(TOM), code: "FRENDS" }, tok.ada);
    check(!notFriend.ok && notFriend.reason === "not_friends", "only to a friend");
    q(`INSERT INTO async_attempts (room_id, user_id, display_name) VALUES ('${uid(600)}', '${TEE}', 'Tee_Teen')`);
    const played = await call(fns.friendsOverviewFn, undefined, tok.tee);
    check(played.ok && played.overview.challenges.length === 0, "once played it leaves the list");
  });

  /* ------------------------------------------------------------- head-to-head */
  await section("head-to-head", async () => {
    // The latest game of room FRND: ADA beats TEE (finished).
    q(`UPDATE duels SET status = 'finished', round_order = '["gridlock", "hover"]', tournament_history = '[{"winner": "x"}]' WHERE id = '${uid(500)}'`);
    q(`UPDATE duel_players SET user_id = '${TEE}', display_name = 'Tee_Teen' WHERE duel_id = '${uid(500)}' AND player_slot = 2`);
    q(`INSERT INTO round_results (duel_id, player_slot, round_number, score, is_correct, ms_remaining, submitted_at) VALUES
       ('${uid(500)}', 1, 1, 150, true, 0, now() - interval '1 hour'), ('${uid(500)}', 2, 1, 90, true, 0, now() - interval '1 hour'),
       ('${uid(500)}', 1, 2, 100, true, 0, now() - interval '1 hour'), ('${uid(500)}', 2, 2, 120, true, 0, now() - interval '1 hour')`);
    // An earlier game of the same room (archived by Play again): TEE beats ADA.
    q(`INSERT INTO round_results_archive (id, duel_id, game_index, game_id, player_slot, user_id, round_number, is_correct, ms_remaining, score, submitted_at) VALUES
       (gen_random_uuid(), '${uid(500)}', 0, 'gridlock', 1, '${ADA}', 1, true, 0, 50, now() - interval '2 days'),
       (gen_random_uuid(), '${uid(500)}', 0, 'gridlock', 2, '${TEE}', 1, true, 0, 160, now() - interval '2 days')`);
    // A finished friend challenge both played: level (a draw).
    q(`UPDATE async_attempts SET finished_at = now() - interval '5 minutes', total_score = 300 WHERE room_id = '${uid(600)}' AND user_id = '${TEE}'`);
    q(`INSERT INTO async_attempts (room_id, user_id, display_name, finished_at, total_score) VALUES ('${uid(600)}', '${ADA}', 'Ada_Adult', now() - interval '10 minutes', 300)`);
    const view = await call(fns.friendProfileFn, { playerId: pub(TEE) }, tok.ada);
    const h = view.ok ? view.profile.headToHead : null;
    check(!!h && h.matches === 3 && h.wins === 1 && h.losses === 1 && h.draws === 1, `three matches: a win, a loss, a draw (${JSON.stringify(h)})`);
    check(!!h && JSON.stringify(h.last) === '["draw","win","loss"]', "last results newest first");
    check(!!h && h.best?.game === "gridlock" && h.best.wins === 1 && h.best.played === 2, `the best game: rounds won of rounds played (${JSON.stringify(h?.best)})`);
    const mirror = JSON.parse(q(`SELECT public.friends_head_to_head('${TEE}', '${ADA}')`)) as { wins: number; losses: number; draws: number };
    check(mirror.wins === 1 && mirror.losses === 1 && mirror.draws === 1, "the record mirrors for the other player");
    const strangers = JSON.parse(q(`SELECT public.friends_head_to_head('${ADA}', '${TOM}')`)) as { matches: number; best: unknown };
    check(strangers.matches === 0 && strangers.best === null, "no games, an empty record");
  });

  /* ------------------------------------------------------------- report */
  await section("report", async () => {
    const reported = await call(fns.friendReportFn, { playerId: pub(ADA), reason: "offensive_name" }, tok.tee);
    check(reported.ok && /Thanks/.test(reported.message), "report: the same thank-you");
    const row = q(`SELECT concat_ws('|', duel_id IS NULL, reported_user_id, reason, reported_name, counts) FROM room_reports WHERE reporter_user_id = '${TEE}'`);
    check(row === `t|${ADA}|offensive_name|Ada_Adult|t`, `report: through wave 1's flow, with no room (${row})`);
    const queue = q(`SELECT concat_ws('|', name, array_to_string(reasons, ','), array_to_string(sources, ','), from_profile) FROM moderation.report_queue WHERE user_id = '${ADA}'`);
    check(queue === "Ada_Adult|offensive_name|profile|1", `report: Joe's review list shows who, why and that it came from a profile (${queue})`);
    const bad = await call(fns.friendReportFn, { playerId: pub(ADA), reason: "made_up" }, tok.tee);
    check(!bad.ok, "report: an unknown reason is refused");
    const self = await call(fns.friendReportFn, { playerId: pub(TEE), reason: "cheating" }, tok.tee);
    check(!self.ok, "report: not yourself");
  });

  /* ------------------------------------------------------------- limits */
  await section("rate limit", async () => {
    let refusedAt = 0;
    for (let i = 1; i <= 21; i++) {
      const r = await call(fns.friendRequestFn, { playerId: pub(FILL(10 + i)) }, tok.rat);
      if (!r.ok && refusedAt === 0) refusedAt = i;
      if (!r.ok) check(r.reason === "busy", "rate limit: refused as busy");
    }
    check(refusedAt === 21, `rate limit: 20 requests an hour, the 21st refused (${refusedAt})`);
    check(requestRows(RAT, FILL(31)) === 0 && Number(q(`SELECT count(*) FROM friend_requests WHERE from_user_id = '${RAT}'`)) === 20, "rate limit: the refused request stores nothing");
  });

  await section("cap", async () => {
    const fillFriends = (who: string, from: number, to: number, skip: number) =>
      q(`INSERT INTO friendships (user_low, user_high) SELECT least('${who}'::uuid, u), greatest('${who}'::uuid, u) FROM (SELECT ('00000000-0000-4000-8000-' || lpad((1000 + i)::text, 12, '0'))::uuid AS u FROM generate_series(${from}, ${to}) i WHERE i <> ${skip}) f ON CONFLICT DO NOTHING`);
    fillFriends(CAP, 0, 199, -1);
    check(q(`SELECT friends.friend_count('${CAP}')`) === "200", "cap: 200 friends");
    const capAsks = await call(fns.friendRequestFn, { playerId: pub(FILL(204)) }, tok.cap);
    check(!capAsks.ok && capAsks.reason === "cap" && requestRows(CAP, FILL(204)) === 0, "cap: a full list can't send a request (refused, nothing stored)");
    const asked = JSON.parse(q(`SELECT public.friends_send_request('${FILL(203)}', '${CAP}', 'search', 200)`)) as { result: string };
    check(asked.result === "sent", "cap: anyone may still ask a full player");
    const capView = await call(fns.friendsOverviewFn, undefined, tok.cap);
    const req = capView.ok ? capView.overview.incoming.find((r: { id: string }) => r.id === pub(FILL(203))) : null;
    const capAccepts = await call(fns.friendRespondFn, { requestId: req?.requestId, accept: true }, tok.cap);
    check(!capAccepts.ok && capAccepts.reason === "cap" && !areFriends(CAP, FILL(203)), "cap: a full list can't accept");
    // The other side full: FILL(201) asks FILL(202), then fills up to 200; FILL(202)'s accept is refused.
    q(`SELECT public.friends_send_request('${FILL(201)}', '${FILL(202)}', 'search', 200)`);
    fillFriends(FILL(201), 0, 199, -1);
    check(q(`SELECT friends.friend_count('${FILL(201)}')`) === "200", "cap: a second full player");
    const theirs = JSON.parse(q(`SELECT public.friends_respond('${FILL(202)}', (SELECT id FROM friend_requests WHERE from_user_id = '${FILL(201)}' AND to_user_id = '${FILL(202)}' AND status = 'pending'), true, 200)`)) as { result: string };
    check(theirs.result === "their_cap" && !areFriends(FILL(201), FILL(202)), "cap: accepting a full player's request is refused (their_cap)");
    check(Number(q(`SELECT max(c) FROM (SELECT friends.friend_count(user_id) AS c FROM profiles) x`)) <= 200, "cap: nobody over 200");
  });

  /* ------------------------------------------------------------- guests */
  await section("guests", async () => {
    const guest = userToken(uid(97));
    const calls: [unknown, unknown][] = [
      [fns.friendsOverviewFn, undefined],
      [fns.friendProfileFn, { playerId: pub(ADA) }],
      [fns.friendRespondFn, { requestId: uid(1), accept: true }],
      [fns.friendRemoveFn, { playerId: pub(ADA) }],
      [fns.friendBlockFn, { playerId: pub(ADA) }],
      [fns.friendUnblockFn, { playerId: pub(ADA) }],
      [fns.friendReportFn, { playerId: pub(ADA), reason: "cheating" }],
      [fns.friendInviteFn, { playerId: pub(ADA) }],
      [fns.friendChallengeFn, { playerId: pub(ADA), code: "FRENDS" }],
      [fns.friendShowOnlineFn, { show: true }],
      [fns.friendRequestFn, { playerId: pub(ADA) }],
    ];
    const answers = await Promise.all(calls.map(([fn, data]) => call(fn, data, guest)));
    check(answers.every((a) => a && a.ok === false && a.reason === "account"), `a guest can't reach any friends call (${answers.map((a) => a?.reason).join(",")})`);
    check((await call(fns.friendsWaitingFn, undefined, guest)) === 0, "a guest's badge is 0");
  });

  /* ------------------------------------------------------------- grants and RLS */
  await section("grants and RLS", async () => {
    const tables = ["friendships", "friend_requests", "player_blocks", "friend_invite_links", "friend_settings", "player_presence", "friend_events"];
    const leaks: string[] = [];
    for (const role of ["anon", "authenticated"])
      for (const t of tables)
        for (const priv of ["INSERT", "UPDATE", "DELETE", "TRUNCATE"])
          if (q(`SELECT has_table_privilege('${role}', 'public.${t}', '${priv}')`) === "t") leaks.push(`${role} ${priv} ${t}`);
    check(leaks.length === 0, `phones write nothing${leaks.length ? ` (${leaks.slice(0, 4).join("; ")})` : ""}`);
    for (const t of ["player_presence", "friend_events"])
      check(q(`SELECT has_table_privilege('authenticated', 'public.${t}', 'SELECT') OR has_table_privilege('anon', 'public.${t}', 'SELECT')`) === "f", `${t} is server-only`);
    for (const t of tables) check(q(`SELECT has_table_privilege('anon', 'public.${t}', 'SELECT')`) === "f", `anon reads nothing in ${t}`);
    const fnLeaks = q(`SELECT string_agg(p.proname, ',') FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname LIKE 'friends\\_%' AND (has_function_privilege('anon', p.oid, 'EXECUTE') OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))`);
    check(fnLeaks === "", `the friends functions are server-only (${fnLeaks})`);

    const tee = deviceDb(tok.tee);
    // Changed with Joe's approval, 14 Nov 2026 (Security C3's revokes: phones read no friendships, requests or blocks,
    // which carry account ids; the friends functions answer by public id): each read is now refused outright.
    const own = await tee.from("friendships").select("user_low, user_high");
    check(!!own.error && !own.data, "authenticated: friendships can't be read");
    const reqs = await tee.from("friend_requests").select("id, from_user_id, to_user_id, via, created_at");
    check(!!reqs.error && !reqs.data, "authenticated: friend requests can't be read");
    const status = await tee.from("friend_requests").select("status");
    check(!!status.error, "authenticated: a request's status can't be read");
    const tom = deviceDb(tok.tom);
    const tomReqs = await tom.from("friend_requests").select("id, from_user_id, to_user_id");
    check(!!tomReqs.error && !tomReqs.data, "authenticated: another player's requests are invisible");
    const ada = deviceDb(tok.ada);
    const blocks = await deviceDb(tok.bob).from("player_blocks").select("blocker_id, blocked_id");
    check(!!blocks.error && !blocks.data, "authenticated: blocks can't be read");
    const links = await ada.from("friend_invite_links").select("user_id, token");
    check(!links.error && ((links.data ?? []) as { user_id: string }[]).every((r) => r.user_id === ADA), "authenticated: only their own link");
    const writes = await Promise.all([
      tee.from("friendships").insert({ user_low: TEE < TOM ? TEE : TOM, user_high: TEE < TOM ? TOM : TEE }),
      tee.from("friend_requests").insert({ from_user_id: TEE, to_user_id: BOB, via: "search" }),
      tee.from("friendships").delete().eq("user_low", ADA),
      tee.from("friend_settings").update({ show_online: true }).eq("user_id", TEE),
      tee.from("player_blocks").insert({ blocker_id: TEE, blocked_id: BOB }),
      deviceDb(null).from("friendships").select("user_low"),
    ]);
    check(writes.slice(0, 5).every((w) => !!w.error) && (!!writes[5].error || ((writes[5].data ?? []) as unknown[]).length === 0), "authenticated and anon can't write friends rows");
    check(refused(`SET LOCAL ROLE authenticated; INSERT INTO friendships VALUES ('${TEE}', '${TOM}')`) !== "", "SQL: authenticated can't insert a friendship");
  });

  /* ------------------------------------------------------------- the analytics list */
  await section("analytics events list", async () => {
    const { ANALYTICS_EVENTS } = await import("../src/lib/analytics/events");
    const def = q(`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'analytics.events'::regclass AND conname = 'events_event_check'`);
    const missing = ANALYTICS_EVENTS.filter((e) => !def.includes(`'${e}'`));
    check(missing.length === 0, `every event in ANALYTICS_EVENTS is allowed after all migrations (${missing.join(",")})`);
    // Another session's event already in the list (as train C's or D1's would be): applying the friends migration again keeps it.
    const { readFileSync, readdirSync } = await import("node:fs");
    const file = readdirSync("supabase/migrations").find((f) => f.endsWith("_analytics_friend_events.sql"))!;
    q(`ALTER TABLE analytics.events DROP CONSTRAINT events_event_check; ALTER TABLE analytics.events ADD CONSTRAINT events_event_check CHECK (event IN (${[...ANALYTICS_EVENTS.filter((e) => !e.startsWith("friend_")), "zz_other_session"].map((e) => `'${e}'`).join(", ")})) NOT VALID`);
    const again = db.psql(readFileSync(`supabase/migrations/${file}`, "utf8"));
    const after = q(`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'analytics.events'::regclass AND conname = 'events_event_check'`);
    check(again.ok && after.includes("'zz_other_session'") && ANALYTICS_EVENTS.every((e) => after.includes(`'${e}'`)), "the friends analytics migration adds its four events and keeps every event already listed, whatever the order");
  });

  /* ------------------------------------------------------------- B2 events and removal */
  await section("events for B2", async () => {
    const kinds = q(`SELECT string_agg(DISTINCT kind, ',' ORDER BY kind) FROM friend_events`);
    check(kinds === "friend_challenge_received,friend_request_accepted,friend_request_received,room_invite_received", `all four kinds recorded (${kinds})`);
    check(q(`SELECT count(*) FROM friend_events WHERE recipient_id = actor_id`) === "0", "an event is never to yourself");
    check(refused(`INSERT INTO friend_events (recipient_id, actor_id, kind) VALUES ('${ADA}', '${TEE}', 'message')`) !== "", "only the four kinds");
  });

  /* ------------------------------------------------------------- cards (Joe's phone check, 11 Nov 2026) */
  await section("cards", async () => {
    // FILL(0), one of CAP's 200 friends, wears a real look: the gold frame, Bolt Stripes, an avatar in colour 7 and
    // the Friendly badge on the card.
    q(`SELECT economy.grant_item('${FILL(0)}', 'frame.gold', 'friends-check')`);
    check(q(`SELECT public.economy_equip('${FILL(0)}', 'frame', 'frame.gold')`) === "equipped", "cards: the gold frame equipped");
    check(q(`SELECT public.economy_equip('${FILL(0)}', 'card-art', 'card-art.bolt-stripes')`) === "equipped", "cards: Bolt Stripes equipped");
    const avatarSet = q(`SELECT public.economy_set_avatar('${FILL(0)}', 'pinball', 7::smallint, NULL, NULL, NULL, NULL, NULL)`);
    check(avatarSet === "set", `cards: the avatar set (${avatarSet})`);
    q(`SELECT public.badge_award('${FILL(0)}', 'friendly', '{}'::jsonb)`);
    check(q(`SELECT public.badge_set_card('${FILL(0)}', ARRAY['friendly'])`) === "set", "cards: Friendly on the card");

    // One call answers the whole list: the cards are read 100 at a time (200 friends: 2 reads each), never one a friend.
    const before = rest!.log.length;
    const view = await call(fns.friendsOverviewFn, undefined, tok.cap);
    const reads = rest!.log.slice(before).map((e) => e.path.split("?")[0]);
    const cardReads = reads.filter((p) => p.endsWith("/rpc/economy_public_cards")).length;
    const badgeReads = reads.filter((p) => p.endsWith("/rpc/badge_public_cards")).length;
    const friends = view.ok ? view.overview.friends : [];
    const listed = view.ok ? new Set([...view.overview.friends, ...view.overview.incoming, ...view.overview.invites, ...view.overview.challenges].map((f) => f.id)).size : 0;
    const batches = Math.ceil(listed / 100);
    check(listed > 200 && cardReads === batches && badgeReads === batches, `cards: ${listed} listed players' cards in ${batches} + ${batches} batched reads, not one a player (${cardReads} + ${badgeReads})`);
    check(friends.length === 200 && friends.every((f) => !!f.look), `cards: every friend on the list carries their card (${friends.filter((f) => f.look).length} of ${friends.length})`);
    const dressed = friends.find((f) => f.id === pub(FILL(0)))?.look;
    check(
      !!dressed && dressed.frame === "frame.gold" && dressed.cardArt === "card-art.bolt-stripes" && dressed.avatar.id === "pinball" && dressed.avatar.colour === 7 && JSON.stringify(dressed.badges) === '["friendly"]' && dressed.title === "rookie",
      `cards: a friend's row has their own frame, card art, avatar and colour (${JSON.stringify(dressed)})`,
    );
    const plain = friends.find((f) => f.id === pub(FILL(1)))?.look;
    check(!!plain && plain.frame === "frame.plain" && plain.avatar.id === "captain-joulz" && plain.badges.length === 0, `cards: an undressed friend has the starter card (${JSON.stringify(plain)})`);

    // A friend's profile: the full card (look, title, badges, player number).
    const prof = await call(fns.friendProfileFn, { playerId: pub(FILL(0)) }, tok.cap);
    const pc = prof.ok ? prof.profile.card : null;
    check(!!pc && pc.look?.frame === "frame.gold" && pc.look.avatar.id === "pinball" && pc.look.avatar.colour === 7 && pc.look.badges[0] === "friendly" && pc.look.title === "rookie" && pc.playerNumber > 0, `cards: a friend's profile carries the full card (${JSON.stringify(pc)})`);

    // Blocked players show no card: neither on the blocked list nor on their profile.
    await call(fns.friendBlockFn, { playerId: pub(FILL(1)) }, tok.cap);
    const blockedProf = await call(fns.friendProfileFn, { playerId: pub(FILL(1)) }, tok.cap);
    check(blockedProf.ok && blockedProf.profile.relation === "blocked" && !blockedProf.profile.card.look, "cards: a blocked player's profile has no card");
    const after = await call(fns.friendsOverviewFn, undefined, tok.cap);
    const blockedRow = after.ok ? (after.overview.blocked.find((b) => b.id === pub(FILL(1))) as Record<string, unknown> | undefined) : undefined;
    check(!!blockedRow && !("look" in blockedRow), "cards: the blocked list carries no card");
    const theirSide = await call(fns.friendProfileFn, { playerId: pub(CAP) }, accountToken(FILL(1)));
    check(!theirSide.ok, "cards: the blocked player can't open the blocker's profile (no card)");

    // Guests: the friends calls refuse them, so no card is ever sent to or for a guest.
    const guestView = await call(fns.friendsOverviewFn, undefined, userToken(uid(97)));
    check(!guestView.ok && guestView.reason === "account", "cards: a guest gets no list (and so no cards)");
    // The cards' read leaves out a guest (no profile) and an unknown id.
    const { cardLooksFor } = await import("../src/lib/friends/friends.server");
    const looks = await cardLooksFor(createClient(rest!.url, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) as never, [uid(97), "00000000-0000-4000-8000-00000000dead", FILL(0)]);
    check(looks.size === 1 && looks.has(FILL(0)), `cards: a guest and an unknown id have no card (${[...looks.keys()].join(",")})`);
  });

  await section("account removal", async () => {
    const before = Number(q(`SELECT count(*) FROM friendships WHERE user_low = '${GUS}' OR user_high = '${GUS}'`)) + Number(q(`SELECT count(*) FROM friend_requests WHERE from_user_id = '${GUS}' OR to_user_id = '${GUS}'`));
    check(before > 0, "the removed account had friends rows");
    q(`SELECT accounts.forget_user('${GUS}')`);
    const after = ["friendships WHERE user_low = '{G}' OR user_high = '{G}'", "friend_requests WHERE from_user_id = '{G}' OR to_user_id = '{G}'", "player_blocks WHERE blocker_id = '{G}' OR blocked_id = '{G}'", "friend_invite_links WHERE user_id = '{G}'", "player_presence WHERE user_id = '{G}'", "friend_events WHERE recipient_id = '{G}' OR actor_id = '{G}'"]
      .map((t) => Number(q(`SELECT count(*) FROM ${t.replaceAll("{G}", GUS)}`)))
      .reduce((a, b) => a + b, 0);
    check(after === 0, "an account's removal takes every friends row with it");
    const deleting = await call(fns.friendSearchFn, { query: "bob" }, tok.ada);
    q(`UPDATE profiles SET deletion_requested_at = now() WHERE user_id = '${BOB}'`);
    const hidden = await call(fns.friendSearchFn, { query: "bob" }, tok.ada);
    check(deleting.ok && deleting.results.length === 1 && hidden.ok && hidden.results.length === 0, "an account waiting for deletion is hidden at once");
  });
}
