/**
 * account-screens-check (wave 1 sign-up screens, 10 Nov 2026; ~10 s, no browser): the rules behind the sign-up
 * screens and the server pieces they added, through the real server functions on a local PostgreSQL 16 with every
 * migration (scripts/server-fn-harness.ts). account-flow-check plays the screens themselves in Chromium; theme-check
 * and no-wrap-check judge them (scripts/theme-screens.ts ACCOUNT_SCREENS).
 *
 * What it proves:
 * - "Save your progress": never before the first finished game; the sheet after the first; nothing on the second;
 *   after "Not now", the pop-up once after the third, then never again; nothing once a way to sign up was tapped; a
 *   game counted once by its key; nothing for an account;
 * - recordSaveProgressFn: accepts exactly save_progress_shown / _tapped / _dismissed with fixed-word props (stored in
 *   analytics.events with the player's id and nothing personal), refuses every other event name, free text and
 *   unknown fields (writing nothing), and is rate limited per user through take_rate_limit;
 * - the migration widening events_event_check: the three are allowed, CLIENT_EVENTS unchanged;
 * - names everywhere: a signed-in player's rooms (create and join), Daily board and challenge board carry their
 *   username whatever name is typed; the room's standings show it; a guest's refused name comes back with the plain
 *   reason and three suggestions (room join and create, Daily, challenge); every guest name box takes 16 characters;
 * - the Google and Apple buttons sit behind their switches, which are off;
 * - the phone's account copy never holds an email, a date of birth or a country.
 *
 * Needs the PostgreSQL 16 binaries for its database part (preinstalled on GitHub's runners); without them it fails on
 * CI and prints a NOTE locally.
 */
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
  if (/^\s*(FAIL|NOTE)|^account-screens-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};
const restore = () => {
  console.log = quietLog;
  console.warn = quietWarn;
  console.error = quietError;
};

/* ------------------------------------------------------------------ a phone's storage */
const memory = new Map<string, string>();
const storage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, String(v)),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
};
(globalThis as unknown as { window: unknown }).window = { localStorage: storage };

await pureChecks();
// The database part runs as a server (supabase-js reads window when it exists).
delete (globalThis as unknown as { window?: unknown }).window;

if (!postgresBin()) {
  restore();
  if (process.env["CI"]) {
    console.log(`account-screens-check: ${passes} passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL`);
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: the database part not run (CI runs it)");
  console.log(`account-screens-check: ${passes} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
}

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const AMY = uid(31); // a guest who makes an account
const BEN = uid(32); // a guest friend
const CAT = uid(33); // a second account
const DAN = uid(34); // a guest whose names are refused
const EVE = uid(35); // the rate limit

let db: LocalDb | null = null;
let rest: RestServer | null = null;
try {
  db = startLocalDb("account-screens-check-");
  check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
  rest = await startRestServer(db.socketDir);
  process.env["SUPABASE_URL"] = rest.url;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
  db.psql(`INSERT INTO auth.users (id) VALUES ('${AMY}'), ('${BEN}'), ('${CAT}'), ('${DAN}'), ('${EVE}')`);
  await installServerFnPlugin();
  await databaseChecks(db, rest);
} catch (err) {
  check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await rest?.stop();
  db?.stop();
}

restore();
console.log(`account-screens-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: save-your-progress timing and events, usernames in rooms, Dailies and challenges, name refusals with suggestions, 16-character name boxes, sign-in switches.");
process.exit(0);

/* =================================================================== pure rules */

async function pureChecks(): Promise<void> {
  await section("save progress: when", async () => {
    const sp = await import("../src/lib/account/saveProgress");
    const fresh = () => memory.delete(sp.SAVE_PROGRESS_KEY);
    fresh();
    check(sp.promptFor(sp.readSaveProgress()) === null, "never before the first finished game (a new phone holds no prompt)");
    check(sp.noteFinishedGame("room:a:0", { signedIn: false }) === "sheet", "the sheet after the first finished game");
    check(sp.noteFinishedGame("room:a:0", { signedIn: false }) === null && sp.readSaveProgress().finished === 1, "the same game counts once (a reload of the result)");
    sp.answerPrompt("sheet", "dismissed");
    check(sp.noteFinishedGame("daily:d1", { signedIn: false }) === null, "after Not now: nothing on the second game");
    check(sp.noteFinishedGame("challenge:K7QM2X", { signedIn: false }) === "popup", "after Not now: the pop-up after the third game");
    sp.answerPrompt("popup", "dismissed");
    const later = ["room:b:0", "room:b:1", "daily:d2", "daily:d3", "room:c:0", "challenge:X"].map((k) => sp.noteFinishedGame(k, { signedIn: false }));
    check(later.every((p) => p === null), `never again unprompted after the pop-up (${later.join(",")})`);

    fresh();
    sp.noteFinishedGame("room:a:0", { signedIn: false });
    sp.answerPrompt("sheet", "tapped");
    const afterTap = ["r1", "r2", "r3", "r4"].map((k) => sp.noteFinishedGame(k, { signedIn: false }));
    check(afterTap.every((p) => p === null), "a tap on a sign-up way: no pop-up later");

    fresh();
    sp.noteFinishedGame("room:a:0", { signedIn: false });
    const unanswered = [sp.noteFinishedGame("r2", { signedIn: false }), sp.noteFinishedGame("r3", { signedIn: false })];
    check(unanswered.join() === ",popup", "a sheet left unanswered counts as Not now: the pop-up after the third");

    fresh();
    const signedIn = ["r1", "r2", "r3"].map((k) => sp.noteFinishedGame(k, { signedIn: true }));
    check(signedIn.every((p) => p === null) && sp.readSaveProgress().finished === 3, "an account is never asked (its games still count)");
    check(
      sp.roomGameKey({ id: "d", tournament_history: [] }) !== sp.roomGameKey({ id: "d", tournament_history: [{}] }),
      "a room's Play again is a new game (its key counts the games before)",
    );
    fresh();
  });

  await section("save progress: the event rule", async () => {
    const sp = await import("../src/lib/account/saveProgress");
    const ok = (o: unknown) => sp.acceptSaveProgressEvent(o) !== null;
    check(
      ok({ event: "save_progress_shown", prompt: "sheet", from: "room" }) &&
        ok({ event: "save_progress_tapped", prompt: "popup", from: "daily", method: "email" }) &&
        ok({ event: "save_progress_dismissed", prompt: "sheet", from: "challenge" }) &&
        ok({ event: "save_progress_shown", prompt: "popup" }),
      "accepts the three events with fixed-word props",
    );
    const refused = [
      { event: "sign_in", prompt: "sheet" },
      { event: "app_opened", prompt: "sheet" },
      { event: "game_finished", prompt: "sheet" },
      { event: "save_progress_shown" },
      { event: "save_progress_shown", prompt: "banner" },
      { event: "save_progress_shown", prompt: "sheet", from: "Amy's phone" },
      { event: "save_progress_shown", prompt: "sheet", email: "amy@example.com" },
      { event: "save_progress_shown", prompt: "sheet", name: "Amy" },
      { event: "save_progress_dismissed", prompt: "sheet", method: "email" },
      { event: "save_progress_tapped", prompt: "sheet", method: "carrier pigeon" },
      null,
      "save_progress_shown",
    ];
    const let_through = refused.filter(ok);
    check(let_through.length === 0, `refuses other events, free text and unknown fields (${JSON.stringify(let_through)})`);
    const kept = sp.acceptSaveProgressEvent({ event: "save_progress_tapped", prompt: "sheet", from: "room", method: "email" });
    check(JSON.stringify(kept?.props) === JSON.stringify({ prompt: "sheet", from: "room", method: "email" }), "only the fixed words reach the props");
  });

  await section("the events list", async () => {
    const { ANALYTICS_EVENTS, CLIENT_EVENTS } = await import("../src/lib/analytics/events");
    const three = ["save_progress_shown", "save_progress_tapped", "save_progress_dismissed"];
    check(three.every((e) => (ANALYTICS_EVENTS as readonly string[]).includes(e)), "ANALYTICS_EVENTS lists the three");
    check(three.every((e) => !(CLIENT_EVENTS as readonly string[]).includes(e)) && CLIENT_EVENTS.length === 5, "CLIENT_EVENTS unchanged (the phone can't send them through the analytics queue)");
    const sql = readFileSync("supabase/migrations/20261110130000_analytics_save_progress_events.sql", "utf8");
    check(three.every((e) => sql.includes(`'${e}'`)) && /DROP CONSTRAINT IF EXISTS events_event_check/.test(sql), "the migration widens events_event_check, idempotent");
    check(!/\b(DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM|UPDATE\s)/i.test(sql), "the migration is non-destructive");
  });

  await section("names", async () => {
    const parts = await import("../src/components/account/AccountParts");
    const names = await import("../src/lib/names/names.server");
    const refusal = await names.refusalWithSuggestions("guest", "reserved");
    const err = new names.NameRefusedError(refusal);
    check(JSON.stringify(parts.suggestionsFrom(err)) === JSON.stringify(refusal.suggestions), `a refused room name's suggestions read back from its message (${err.message})`);
    check(parts.reasonFrom(err.message) === names.NAME_MESSAGES.reserved, "the plain reason without the Try … tail");
    check(JSON.stringify(parts.suggestionsFrom({ suggestions: ["A", "B", "C", "D"] })) === '["A","B","C"]', "a join's own suggestions field (three)");
    check(parts.playerNumberText(42) === "#0042" && parts.playerNumberText(1287) === "#1287", "player numbers as #0042");
    const { GUEST_NAME_MAX } = await import("../src/lib/names/username");
    check(GUEST_NAME_MAX === 16, "guest names: 16 characters, as the server");
    const files = walk("src").filter((f) => /\.(tsx|ts)$/.test(f));
    const fourteen = files.filter((f) => /maxLength=\{14\}/.test(readFileSync(f, "utf8")));
    check(fourteen.length === 0, `no name box still stops at 14 characters (${fourteen.join(", ") || "none"})`);
    const boxes = ["src/routes/index.tsx", "src/components/duel/JoinFromLink.tsx", "src/routes/daily.tsx", "src/routes/challenge.tsx", "src/components/challenge/ChallengeCreate.tsx", "src/routes/profile.tsx"];
    check(boxes.every((f) => readFileSync(f, "utf8").includes("maxLength={GUEST_NAME_MAX}")), "every guest name box takes GUEST_NAME_MAX");
    check(/slice\(0, GUEST_NAME_MAX\)/.test(readFileSync("src/lib/duel/useRoomChat.ts", "utf8")), "chat names keep 16 characters");
  });

  await section("switches and the phone's copy", async () => {
    const config = await import("../src/config/accountConfig");
    check(config.GOOGLE_SIGN_IN_ENABLED === false && config.APPLE_SIGN_IN_ENABLED === false, "Google and Apple are off");
    for (const f of ["src/components/account/SignUpFlow.tsx", "src/components/account/SaveProgress.tsx"]) {
      const src = readFileSync(f, "utf8");
      check(
        /APPLE_SIGN_IN_ENABLED \? \(\s*<Button[^]*?Continue with Apple/.test(src) && /GOOGLE_SIGN_IN_ENABLED \? \(\s*<Button[^]*?Continue with Google/.test(src),
        `${f}: the Apple and Google buttons are drawn only behind their switches`,
      );
    }
    const birthday = readFileSync("src/components/account/SignUpFlow.tsx", "utf8");
    const step = birthday.slice(birthday.indexOf('if (step === "birthday")'), birthday.indexOf('if (step === "under13")'));
    check(!/\b13\b|age limit|old enough|under/i.test(step), "the birthday screen never mentions an age limit");
    const api = readFileSync("src/lib/account/accountApi.ts", "utf8");
    const write = api.slice(api.indexOf("function publish"), api.indexOf("async function client"));
    check(/writeCache\(\{ username: next\.username, colour: next\.colour, playerNumber: next\.playerNumber, founding: next\.founding \}\)/.test(write), "the phone's account copy holds the username, colour, number and founding only");
    const art = readFileSync("public/art/badges/founding-player.svg");
    check(art.equals(readFileSync("docs/art/badges/svg/founding-player.svg")), "the Founding Player badge is the approved art byte for byte");
  });
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/* =================================================================== the database */

async function databaseChecks(db: LocalDb, rest: RestServer): Promise<void> {
  const sp = await import("../src/lib/account/saveProgress.functions");
  const account = await import("../src/lib/account/account.functions");
  const duel = await import("../src/lib/duel/duel.functions");
  const daily = await import("../src/lib/duel/daily.functions");
  const challenge = await import("../src/lib/duel/challenge.functions");
  const auth = await import("../src/lib/account/auth");
  const { flushAnalytics } = await import("../src/lib/data/events.server");
  const { SAVE_PROGRESS_LIMIT } = await import("../src/lib/duel/rateLimit.server");
  const { createClient } = await import("@supabase/supabase-js");
  const call = callServerFn;
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out;
  };
  const count = async (where: string) => {
    await flushAnalytics();
    return Number(q(`SELECT count(*) FROM analytics.events WHERE ${where}`));
  };
  const tok = { amy: userToken(AMY), ben: userToken(BEN), cat: userToken(CAT), dan: userToken(DAN), eve: userToken(EVE) };

  await section("recordSaveProgressFn", async () => {
    for (const [event, extra] of [
      ["save_progress_shown", { prompt: "sheet", from: "room" }],
      ["save_progress_dismissed", { prompt: "sheet", from: "room" }],
      ["save_progress_tapped", { prompt: "popup", from: "daily", method: "email" }],
    ] as const) {
      const res = await call(sp.recordSaveProgressFn, { event, ...extra }, tok.ben);
      check(res.ok === true, `accepts ${event} (${JSON.stringify(res)})`);
    }
    check((await count(`player_id = '${BEN}' AND event LIKE 'save_progress_%'`)) === 3, "the three are stored, with the player's id");
    const props = q(`SELECT props::text FROM analytics.events WHERE player_id = '${BEN}' AND event = 'save_progress_tapped'`);
    check(props.includes('"method": "email"') && props.includes('"prompt": "popup"') && !/@|amy|ben/i.test(props), `only fixed words in the props (${props})`);
    const before = await count(`player_id = '${BEN}'`);
    for (const bad of [
      { event: "sign_in", prompt: "sheet" },
      { event: "app_opened", prompt: "sheet" },
      { event: "room_finished", prompt: "sheet" },
      { event: "save_progress_shown", prompt: "sheet", from: "free text here" },
      { event: "save_progress_shown", prompt: "sheet", email: "ben@example.com" },
    ]) {
      const res = await call(sp.recordSaveProgressFn, bad, tok.ben);
      check(res.ok === false && res.reason === "refused", `refuses ${JSON.stringify(bad)}`);
    }
    check((await count(`player_id = '${BEN}'`)) === before, "a refused call writes nothing");
    const refusedSignedOut = await call(sp.recordSaveProgressFn, { event: "save_progress_shown", prompt: "sheet" }, null).then(
      () => false,
      () => true,
    );
    check(refusedSignedOut, "a caller with no session is refused (requireSupabaseAuth)");

    // The rate limit: SAVE_PROGRESS_LIMIT.max calls a window per user, then refused with nothing written.
    const results: string[] = [];
    for (let i = 0; i < SAVE_PROGRESS_LIMIT.max + 3; i++) {
      const res = await call(sp.recordSaveProgressFn, { event: "save_progress_shown", prompt: "sheet", from: "room" }, tok.eve);
      results.push(res.ok ? "ok" : res.reason);
    }
    check(
      results.slice(0, SAVE_PROGRESS_LIMIT.max).every((r) => r === "ok") && results.slice(SAVE_PROGRESS_LIMIT.max).every((r) => r === "rate_limited"),
      `rate limited after ${SAVE_PROGRESS_LIMIT.max} a window (${results.join(",")})`,
    );
    check((await count(`player_id = '${EVE}'`)) === SAVE_PROGRESS_LIMIT.max, "rate-limited calls write nothing");
    check(Number(q(`SELECT count(*) FROM public.rate_limit_hits WHERE user_id = '${EVE}' AND bucket = 'save-progress'`)) > 0, "counted in take_rate_limit's table under its own bucket");
  });

  /* ------------------------------------------------------------- an account plays under its username */
  const phone = async (token: string) => {
    const client = createClient(rest.url, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    await client.auth.setSession({ access_token: token, refresh_token: "refresh-harness" });
    return client;
  };
  const lastMail = (to: string) => [...rest.mail].reverse().find((m) => m.to === to);
  const signUp = async (guestToken: string, email: string, username: string, colour: number) => {
    const p = await phone(guestToken);
    const started = await call(account.startSignUpFn, { method: "email", dateOfBirth: "1995-06-15", username }, guestToken);
    await auth.sendSignUpEmail(email, p);
    const v = await auth.verifyEmailCode(email, lastMail(email)!.token, "sign-up", p);
    const token = (await p.auth.getSession()).data.session?.access_token ?? "";
    const made = await call(account.completeSignUpFn, { username, dateOfBirth: "1995-06-15", colour, country: "GB" }, token);
    return { ok: started.ok === true && v.ok && made.kind === "account", token };
  };

  const { NAME_MESSAGES } = await import("../src/lib/names/names.server");
  await section("names: rooms", async () => {
    // Amy plays a room as a guest first, then makes an account: the same id, so that room is hers.
    const early = await call(duel.createRoomFn, { displayName: "Amy G" }, tok.amy);
    const amy = await signUp(tok.amy, "amy@example.com", "Amy_Plays", 2);
    check(amy.ok, "Amy makes an account (email code)");
    check(q(`SELECT user_id FROM public.duel_players WHERE duel_id = '${early.roomId}'`).trim() === AMY, "her earlier room stays hers (same id)");
    const cat = await signUp(tok.cat, "cat@example.com", "Cat_Nap", 6);
    check(cat.ok, "Cat makes an account");
    const room = await call(duel.createRoomFn, { displayName: "Anything typed" }, amy.token);
    const name = q(`SELECT display_name FROM public.duel_players WHERE duel_id = '${room.roomId}' AND user_id = '${AMY}'`).trim();
    check(name === "Amy_Plays", `create: an account's room shows its username, not what was typed (${name})`);
    const joined = await call(duel.joinRoomFn, { roomCode: room.roomCode, displayName: "Typed too" }, cat.token);
    check(joined.ok === true, "join: an account joins");
    const catName = q(`SELECT display_name FROM public.duel_players WHERE duel_id = '${room.roomId}' AND user_id = '${CAT}'`).trim();
    check(catName === "Cat_Nap", `join: shown as the username (${catName})`);
    const benJoin = await call(duel.joinRoomFn, { roomCode: room.roomCode, displayName: "Ben B" }, tok.ben);
    const benName = q(`SELECT display_name FROM public.duel_players WHERE duel_id = '${room.roomId}' AND user_id = '${BEN}'`).trim();
    check(benJoin.ok === true && benName === "Ben B", "a guest keeps the name they typed");
    const reserved = await call(duel.joinRoomFn, { roomCode: room.roomCode, displayName: "Joulz Staff" }, tok.dan);
    check(reserved.ok === false && reserved.suggestions?.length === 3 && reserved.message.startsWith(NAME_MESSAGES.reserved), `a guest's refused name: the plain reason and three suggestions (${JSON.stringify(reserved).slice(0, 160)})`);
    const thrown = await call(duel.createRoomFn, { displayName: "Adm1n" }, tok.dan).then(
      () => null,
      (e: Error) => e,
    );
    const { suggestionsFrom } = await import("../src/components/account/AccountParts");
    check(!!thrown && suggestionsFrom(thrown).length === 3, `create: a refused name throws with three suggestions the screen reads (${thrown?.message})`);
    // Lobby, standings and results read the stored names.
    const { standings } = await import("../src/lib/duel/scoring");
    const players = JSON.parse(q(`SELECT json_agg(p ORDER BY player_slot)::text FROM public.duel_players p WHERE duel_id = '${room.roomId}'`));
    const rows = standings(players, [], 6);
    const shown = rows.map((r: { name: string }) => r.name);
    check(shown.includes("Amy_Plays") && shown.includes("Cat_Nap") && shown.includes("Ben B"), `standings and results show the usernames (${shown.join(", ")})`);
    // A username-substituted account is never checked as a guest name, and a deleted account goes back to typed names.
    q(`UPDATE public.profiles SET deletion_requested_at = now() WHERE user_id = '${CAT}'`);
    const after = await call(duel.createRoomFn, { displayName: "Cat typed" }, cat.token).catch(() => null);
    const afterName = after ? q(`SELECT display_name FROM public.duel_players WHERE duel_id = '${after.roomId}'`).trim() : "";
    check(afterName === "Cat typed", `an account waiting for deletion shows no username (${afterName})`);
    q(`UPDATE public.profiles SET deletion_requested_at = NULL WHERE user_id = '${CAT}'`);
  });

  await section("names: Daily and challenges", async () => {
    // Amy's account token comes from her sign-in: sign in by code on a fresh phone.
    const p = await phone(userToken(uid(36)));
    q(`INSERT INTO auth.users (id) VALUES ('${uid(36)}') ON CONFLICT DO NOTHING`);
    await auth.sendSignInEmail("amy@example.com", p);
    const v = await auth.verifyEmailCode("amy@example.com", lastMail("amy@example.com")!.token, "sign-in", p);
    const token = (await p.auth.getSession()).data.session?.access_token ?? "";
    check(v.ok && v.userId === AMY, "Amy signs in on another phone by code");
    const started = await call(daily.dailyStartFn, { kind: "puzzle", displayName: "Typed" }, token);
    const dailyName = started.ok ? q(`SELECT display_name FROM public.async_attempts WHERE room_id = '${started.roomId}' AND user_id = '${AMY}'`).trim() : "";
    check(dailyName === "Amy_Plays", `Daily: the board shows her username (${dailyName || JSON.stringify(started)})`);
    const refused = await call(daily.dailyStartFn, { kind: "arcade", displayName: "Adm1n" }, tok.dan);
    check(refused.ok === false && refused.nameRefused === true && refused.suggestions?.length === 3, `Daily: a guest's refused name comes back with three suggestions (${JSON.stringify(refused).slice(0, 140)})`);
    const made = await call(challenge.createChallengeFn, { categories: ["logic"], rounds: 3, displayName: "Typed" }, token);
    const chName = made.ok ? q(`SELECT display_name FROM public.async_attempts WHERE room_id = '${made.roomId}' AND user_id = '${AMY}'`).trim() : "";
    check(chName === "Amy_Plays", `challenge: the board shows her username (${chName || JSON.stringify(made)})`);
    const chRefused = await call(challenge.createChallengeFn, { categories: ["logic"], rounds: 3, displayName: "Joulz Official" }, tok.dan);
    check(chRefused.ok === false && chRefused.suggestions?.length === 3, "challenge: a guest's refused name comes back with three suggestions");
  });
}
