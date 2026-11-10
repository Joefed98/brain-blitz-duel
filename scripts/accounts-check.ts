/**
 * accounts-check (10 Nov 2026; docs/accounts/README.md): the accounts backend, through the real server functions,
 * the real supabase-js Auth calls (src/lib/account/auth.ts) and the real migrations on a local PostgreSQL 16, with the
 * server-function harness's PostgREST / GoTrue stand-in (scripts/server-fn-harness.ts).
 *
 * What it proves:
 * - keeping everything: a guest plays rooms, a Daily, a challenge and practice, then makes an account by linking an
 *   email (the code typed in); the user id is the same, every row stays on it and reads as theirs;
 * - signing in to an existing account from a phone with guest progress leaves the guest's rows where they were and
 *   reports them (guestProgressFn); an unknown email creates nobody;
 * - usernames: length, characters, case-insensitive uniqueness, the filter, reserved names, look-alikes, the free
 *   change within 7 days, the 90-day limit, the 30-day hold, forced renames not counting;
 * - guest room names refused by the same checks on room create and join, with three suggestions;
 * - the age rules: under 13 refused with nothing stored, 13–17 flagged, the flag lifting on the 18th birthday, the
 *   phone's refusal memory;
 * - player numbers from 2, unique, #1 only by the admin function; founding by the cut-off;
 * - row level security: no other player's date of birth or country, no self-edit of date of birth, number or flag;
 * - delete account: hidden at once, signed out, cancel within 30 days, the purge removing personal data and keeping
 *   other players' histories adding up; guests removed 13 months after their last game, accounts never;
 * - the analytics events, and the Google and Apple switches off.
 *
 * Needs the PostgreSQL 16 binaries (preinstalled on GitHub's runners). Without them it fails on CI and prints a NOTE
 * locally. No browser.
 */

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
async function rejects(promise: Promise<unknown>, pattern: RegExp): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return pattern.test(message) ? message : null;
  }
}

const quietLog = console.log;
const quietWarn = console.warn;
const quietError = console.error;
console.log = (...args: unknown[]) => {
  const line = args.map(String).join(" ");
  if (/^\s*(FAIL|NOTE)|^accounts-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};
const restore = () => {
  console.log = quietLog;
  console.warn = quietWarn;
  console.error = quietError;
};

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const GIA = uid(11); // the guest who makes an account
const BO = uid(12); // a friend in her rooms
const HAL = uid(13); // a second account
const IVY = uid(14); // a guest phone that signs in to Gia's account
const JO = uid(15); // a teenager
const KIM = uid(16); // a guest who stopped playing 14 months ago
const LEE = uid(17); // an account whose last game was 14 months ago
const DAY = 24 * 60 * 60 * 1000;

let db: LocalDb | null = null;
let rest: RestServer | null = null;

// The pure rules run anywhere; the database part needs PostgreSQL.
await pureChecks();

if (!postgresBin()) {
  restore();
  if (process.env["CI"]) {
    console.log(`accounts-check: ${passes} passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL`);
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: the database part not run (CI runs it)");
  console.log(`accounts-check: ${passes} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
}

try {
  db = startLocalDb("accounts-check-");
  check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
  rest = await startRestServer(db.socketDir);
  process.env["SUPABASE_URL"] = rest.url;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
  db.psql(`INSERT INTO auth.users (id) VALUES ('${GIA}'), ('${BO}'), ('${HAL}'), ('${IVY}'), ('${JO}'), ('${KIM}'), ('${LEE}')`);
  await installServerFnPlugin();
  await databaseChecks(db, rest);
} catch (err) {
  check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await rest?.stop();
  db?.stop();
}

restore();
console.log(`accounts-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: accounts keep every guest row, usernames, ages, numbers, RLS, deletion and the clean-up hold.");
process.exit(0);

/* =================================================================== pure rules */

async function pureChecks(): Promise<void> {
  await section("names", async () => {
    const names = await import("../src/lib/names/names.server");
    const { ENERGY_ADJECTIVES, ENERGY_NOUNS } = await import("../src/lib/names/energyWords");
    const { RESERVED_WORDS, RESERVED_ANYWHERE } = await import("../src/lib/names/reserved");
    const { checkUsernameRules: rules, checkGuestName } = names;
    const reason = (n: string) => {
      const r = rules(n);
      return r.ok ? "ok" : r.reason;
    };
    check(reason("ab") === "length" && reason("abc") === "ok" && reason("a".repeat(16)) === "ok" && reason("a".repeat(17)) === "length", "username: 3–16 characters");
    check(["Ali Bo", "Zoë_1", "a-b-c", "dot.name", "Ｓａｍ", "emoji😀"].every((n) => reason(n) === "characters"), "username: letters, numbers and underscores only (no spaces, accents, hyphens, full-width or emoji)");
    check(reason("") === "empty" && reason("   ") === "empty" && reason(42 as unknown as string) === "empty", "username: an empty or non-string name is refused as empty");
    const typed = rules("CamelCase_9");
    check(typed.ok && typed.username === "CamelCase_9" && typed.key === "camelcase_9", "username: stored as typed, keyed in lower case");
    const offensive = ["fuck_off", "FuCkEr", "sh1t", "5hit", "Fuuuuck", "B1tch_99", "c0ck", "Pr1ck", "fυck", "wanker1", "sl4g"];
    check(offensive.every((n) => !rules(n).ok && (rules(n) as { reason: string }).reason !== "characters" ? reason(n) === "offensive" : reason(n) === "offensive" || reason(n) === "characters"), `username: the word filter, look-alikes and repeated letters (${offensive.filter((n) => reason(n) !== "offensive" && reason(n) !== "characters").join(", ") || "all refused"})`);
    const reserved = ["Joulz", "J0ULZ", "Captain_Joulz", "captainjoulz", "TheJoulzTeam", "Jooouulz", "Duelz", "admin", "Adm1n", "4dmin", "Admiiin", "admin_99", "Staff", "5taff", "Support", "Moderator", "M0d", "mod", "Mod_Squad", "Official", "System", "5y5tem", "Deleted_Player"];
    const reservedMissed = reserved.filter((n) => reason(n) !== "reserved");
    check(reservedMissed.length === 0, `username: reserved names with look-alikes (0→o, 1→i/l, 3→e, 4→a, 5→s, 7→t, repeated letters) (${reservedMissed.join(", ") || "all refused"})`);
    const ordinary = ["Cassie", "Dickens", "Scunthorpe", "Hancock", "Mood", "Modest", "Badminton", "Supportive", "Teamster", "Staffy", "Sam", "Jo_Bloggs", "Penistone", "Systematic", "Bo1", "Ali_2009"];
    const wrongRefused = ordinary.filter((n) => reason(n) !== "ok");
    check(wrongRefused.length === 0, `username: ordinary names pass (${wrongRefused.join(", ") || "all"})`);
    check(names.nameProblem("Admin") === "reserved" && names.nameProblem("Joulz fan") === "reserved" && names.nameProblem("Ali") === null, "nameProblem: the shared verdict");

    // Guest room names: the same checks, 16 code points, spaces allowed.
    check(checkGuestName("Ali Bo Cy").ok && checkGuestName("Zoë 😀").ok && checkGuestName("").ok, "guest name: spaces, accents and emoji allowed; empty allowed (rooms say Player)");
    const long = checkGuestName("A".repeat(20));
    check(long.ok && long.name.length === 16, "guest name: cut to 16 code points");
    const guestRefused = ["Joulz Official", "Captain Joulz", "Adm1n", "f u c k", "fuuuck", "Sh1t Head", "J0ulz", "Mod"].filter((n) => checkGuestName(n).ok);
    check(guestRefused.length === 0, `guest name: the filter, reserved names and look-alikes refused (${guestRefused.join(", ") || "all"})`);

    // Suggestions and the energy words.
    check(ENERGY_ADJECTIVES.length === 60 && ENERGY_NOUNS.length === 60, `energy words: 60 adjectives and 60 nouns (${ENERGY_ADJECTIVES.length}, ${ENERGY_NOUNS.length})`);
    check(new Set(ENERGY_ADJECTIVES).size === 60 && new Set(ENERGY_NOUNS).size === 60 && [...ENERGY_ADJECTIVES, ...ENERGY_NOUNS].every((w) => /^[A-Z][a-z]+$/.test(w)), "energy words: no duplicates, capitalised letters only");
    const badPairs: string[] = [];
    for (const a of ENERGY_ADJECTIVES)
      for (const n of ENERGY_NOUNS) {
        if (names.nameProblem(`${a} ${n}`) || names.nameProblem(`${a}${n}`) || names.nameProblem(`${a} ${n} 48`)) badPairs.push(`${a} ${n}`);
      }
    check(badPairs.length === 0, `energy words: all 3,600 pairings pass the filter and the reserved list (${badPairs.slice(0, 5).join(", ") || "all"})`);
    check([...ENERGY_ADJECTIVES, ...ENERGY_NOUNS].every((w) => !names.nameProblem(w)), "energy words: every word passes on its own");
    let seed = 7;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    const userSuggest = await names.suggestNames("username", { rand });
    const guestSuggest = await names.suggestNames("guest", { rand });
    check(userSuggest.length === 3 && userSuggest.every((s) => rules(s).ok), `suggestions: three usernames, each passing every rule (${userSuggest.join(", ")})`);
    check(guestSuggest.length === 3 && guestSuggest.every((s) => checkGuestName(s).ok && s.length <= 16 && / \d+$/.test(s)), `suggestions: three guest names like "Swift Volt 48" (${guestSuggest.join(", ")})`);
    const takenSuggest = await names.suggestNames("username", { base: "Ali_Bo", rand, free: (n) => n !== "Ali_Bo_10" });
    check(takenSuggest.length === 3 && takenSuggest[0]!.startsWith("Ali_Bo") && takenSuggest.every((s) => rules(s).ok), `suggestions: a taken name is offered with a number first (${takenSuggest.join(", ")})`);
    const refusal = await names.refusalWithSuggestions("guest", "reserved", { rand });
    const error = new names.NameRefusedError(refusal);
    check(error.suggestions.length === 3 && error.message.startsWith(names.NAME_MESSAGES.reserved) && error.suggestions.every((s) => error.message.includes(s)), `refusal: a plain reason and three suggestions (${error.message})`);
    check(RESERVED_ANYWHERE.includes("joulz") && ["admin", "staff", "support", "moderator", "official", "mod", "system"].every((w) => RESERVED_WORDS.includes(w)), "reserved: the asked-for names are in the one list");
  });

  await section("age", async () => {
    const age = await import("../src/lib/account/age");
    const at = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
    check(age.parseDateOfBirth("2001-02-29", at("2026-11-10")) === null && age.parseDateOfBirth("2000-02-29", at("2026-11-10")) === "2000-02-29", "age: real calendar dates only (29 Feb in leap years)");
    check(age.parseDateOfBirth("2027-01-01", at("2026-11-10")) === null && age.parseDateOfBirth("1899-12-31", at("2026-11-10")) === null && age.parseDateOfBirth("10/11/2000", at("2026-11-10")) === null, "age: no future dates, nothing before 1900, YYYY-MM-DD only");
    check(age.ageBand("2013-11-11", at("2026-11-10")) === "under13" && age.ageBand("2013-11-10", at("2026-11-10")) === "teen", "age: 13 on the 13th birthday itself, under 13 the day before");
    check(age.isUnder18("2008-11-10", at("2026-11-09")) && !age.isUnder18("2008-11-10", at("2026-11-10")), "age: the under-18 flag lifts on the 18th birthday");
    check(age.isUnder18("2008-02-29", at("2026-02-28")) && !age.isUnder18("2008-02-29", at("2026-03-01")), "age: a 29 February birthday counts from 1 March");
    check(age.ukToday(Date.parse("2026-06-30T23:30:00Z")) === "2026-07-01" && age.ukToday(Date.parse("2026-12-31T23:30:00Z")) === "2026-12-31", "age: the UK calendar day (BST and GMT)");

    // The phone's memory of a refusal.
    const store = new Map<string, string>();
    (globalThis as { window?: unknown }).window = {
      localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
    };
    const gate = await import("../src/lib/account/ageGate");
    const now = Date.parse("2026-11-10T10:00:00Z");
    check(!gate.ageRefusalActive(now), "age gate: nothing remembered at first");
    gate.rememberAgeRefusal(now);
    check(gate.ageRefusalActive(now + DAY) && gate.ageRefusalActive(now + 6 * DAY), "age gate: a refusal holds on the phone, so a different date can't be tried straight away");
    check(!gate.ageRefusalActive(now + 7 * DAY + 1), "age gate: it ends after 7 days");
    check(!/\d{4}-\d{2}-\d{2}/.test(store.get(gate.AGE_REFUSAL_KEY) ?? ""), "age gate: the date typed is never kept");
    const auth = await import("../src/lib/account/auth");
    auth.rememberLeftGuest(IVY, now);
    check(auth.leftGuests().length === 1 && auth.leftGuests()[0]!.id === IVY, "sign-in: the phone remembers the guest id it left behind");
    delete (globalThis as { window?: unknown }).window;
  });

  await section("country and switches", async () => {
    const country = await import("../src/lib/account/country");
    check(country.COUNTRY_CODES.size === 249, "country: the 249 ISO 3166-1 alpha-2 codes");
    check(country.regionCountry(["en-GB"]) === "GB" && country.regionCountry(["fr-CA", "en-US"]) === "CA", "country: from the region setting's first tag that names one");
    check(country.regionCountry(["en"]) === null && country.regionCountry(["es-419"]) === null && country.regionCountry([]) === null, "country: never guessed from a language alone; a non-country region gives none");
    check(country.countryCode("gb") === "GB" && country.countryCode("XX") === null && country.countryCode("UK") === null, "country: codes checked against the list (UK is GB)");
    const config = await import("../src/config/accountConfig");
    check(config.GOOGLE_SIGN_IN_ENABLED === false && config.APPLE_SIGN_IN_ENABLED === false, "switches: Google and Apple sign-in are off by default");
    const auth = await import("../src/lib/account/auth");
    const google = await auth.startGoogle("sign-up", {} as never);
    const apple = await auth.startApple("sign-in", {} as never);
    check(!google.ok && google.reason === "off" && !apple.ok && apple.reason === "off", "switches: the phone's Google and Apple calls do nothing while off");
    const rules = await import("../src/lib/account/usernameRules");
    const t0 = Date.parse("2026-11-10T10:00:00Z");
    const fresh = { created_at: new Date(t0).toISOString(), username_changed_at: null, free_change_used: false };
    check(rules.renameAllowance(fresh, t0 + 6 * DAY).kind === "free" && rules.renameAllowance(fresh, t0 + 7 * DAY).kind === "wait", "rename rule: free within 7 days of sign-up, not after");
    check(rules.renameAllowance(fresh, t0 + 90 * DAY).kind === "limited", "rename rule: then once 90 days from sign-up");
    const used = { ...fresh, free_change_used: true, username_changed_at: new Date(t0 + 3 * DAY).toISOString() };
    const wait = rules.renameAllowance(used, t0 + 4 * DAY);
    check(wait.kind === "wait" && wait.nextAt === new Date(t0 + 93 * DAY).toISOString() && rules.renameAllowance(used, t0 + 93 * DAY).kind === "limited", "rename rule: after the free change, 90 days from it");
  });
}

/* =================================================================== the database */

async function databaseChecks(db: LocalDb, rest: RestServer): Promise<void> {
  const duel = await import("../src/lib/duel/duel.functions");
  const chat = await import("../src/lib/duel/chat.functions");
  const daily = await import("../src/lib/duel/daily.functions");
  const asyncFns = await import("../src/lib/duel/asyncRoom.functions");
  const challenge = await import("../src/lib/duel/challenge.functions");
  const practice = await import("../src/lib/duel/practice.functions");
  const account = await import("../src/lib/account/account.functions");
  const accountServer = await import("../src/lib/account/account.server");
  const auth = await import("../src/lib/account/auth");
  const { flushAnalytics } = await import("../src/lib/data/events.server");
  const { adminDb } = await import("../src/lib/data/db.server");
  const { createClient } = await import("@supabase/supabase-js");
  const { checkGuestName } = await import("../src/lib/names/names.server");
  const call = callServerFn;
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out;
  };
  /** A phone's supabase-js client holding a session for `token` (RLS and grants apply; Auth calls reach the stand-in). */
  const phone = async (token: string) => {
    const client = createClient(rest.url, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    await client.auth.setSession({ access_token: token, refresh_token: "refresh-harness" });
    return client;
  };
  const deviceDb = (token: string) =>
    createClient(rest.url, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
  const events = async (event: string, player?: string) => {
    await flushAnalytics();
    return Number(q(`SELECT count(*) FROM analytics.events WHERE event = '${event}'${player ? ` AND player_id = '${player}'` : ""}`));
  };
  const lastMail = (to: string) => [...rest.mail].reverse().find((m) => m.to === to);
  const adultDob = "1995-06-15";

  /** Every row naming a user id, table by table (the tables the clean-up rewrites). */
  const rowsOf = (id: string) =>
    q(`SELECT concat_ws(',',
        (SELECT count(*) FROM public.duel_players WHERE user_id = '${id}'),
        (SELECT count(*) FROM public.room_joins WHERE user_id = '${id}'),
        (SELECT count(*) FROM public.duels WHERE host_user_id = '${id}'),
        (SELECT count(*) FROM public.async_attempts WHERE user_id = '${id}'),
        (SELECT count(*) FROM public.async_results WHERE user_id = '${id}'),
        (SELECT count(*) FROM public.challenges WHERE created_by = '${id}'),
        (SELECT count(*) FROM public.practice_plays WHERE user_id = '${id}'),
        (SELECT count(*) FROM public.room_messages WHERE sender_user_id = '${id}'),
        (SELECT count(*) FROM analytics.events WHERE player_id = '${id}'))`);

  const tok = { gia: userToken(GIA), bo: userToken(BO), hal: userToken(HAL), ivy: userToken(IVY), jo: userToken(JO), kim: userToken(KIM), lee: userToken(LEE) };

  /* ------------------------------------------------------------- a guest plays everything */
  let roomId = "";
  let dailyRoomId = "";
  let challengeRoomId = "";
  let challengeCode = "";
  let giaBefore = "";
  const playAsync = async (asyncRoomId: string, token: string) => {
    const rounds = Number(q(`SELECT round_count FROM public.async_rooms WHERE id = '${asyncRoomId}'`));
    for (let round = 1; round <= rounds; round++) {
      await call(asyncFns.asyncRoundStartFn, { roomId: asyncRoomId, roundNumber: round }, token);
      await call(asyncFns.asyncSubmitFn, { roomId: asyncRoomId, roundNumber: round, answer: "", msRemaining: 1000, inputType: "touch" }, token);
      await call(asyncFns.asyncRevealFn, { roomId: asyncRoomId, roundNumber: round }, token);
    }
  };
  const playPractice = async (token: string) => {
    const dealt = await call(practice.practiceGenerateFn, { type: "reaction" }, token);
    await call(practice.practiceGradeFn, { puzzle: dealt.puzzle, sealed: dealt.sealed, answer: "", msRemaining: 0, inputType: "touch" }, token);
  };
  await section("guest plays", async () => {
    const made = await call(duel.createRoomFn, { displayName: "Gia" }, tok.gia);
    roomId = made.roomId;
    const joined = await call(duel.joinRoomFn, { roomCode: made.roomCode, displayName: "Bo" }, tok.bo);
    check(joined.ok === true, "guest: a friend joins her room");
    await call(duel.setRoomModesFn, { roomId, categories: ["word"] }, tok.gia);
    const started = await call(duel.startRoomFn, { roomId }, tok.gia);
    check(started.ok === true, "guest: she starts the room");
    const sent = await call(chat.sendRoomMessageFn, { roomId, text: "good luck" }, tok.gia);
    check(sent.ok === true, `guest: she sends a chat message (${JSON.stringify(sent).slice(0, 120)})`);
    const day = await call(daily.dailyStartFn, { kind: "puzzle", displayName: "Gia" }, tok.gia);
    check(day.ok === true, "guest: she starts today's Daily");
    if (day.ok) {
      dailyRoomId = day.roomId;
      await playAsync(dailyRoomId, tok.gia);
    }
    const chal = await call(challenge.createChallengeFn, { categories: ["word", "number", "pattern"], rounds: 3, displayName: "Gia" }, tok.gia);
    check(chal.ok === true, "guest: she makes a challenge");
    if (chal.ok) {
      challengeRoomId = chal.roomId as string;
      challengeCode = q(`SELECT code FROM public.challenges WHERE room_id = '${challengeRoomId}'`);
      await playAsync(challengeRoomId, tok.gia);
      const friend = await call(challenge.startChallengeFn, { code: challengeCode, displayName: "Bo" }, tok.bo);
      if (friend.ok) await playAsync(challengeRoomId, tok.bo);
    }
    await playPractice(tok.gia);
    await flushAnalytics();
    giaBefore = rowsOf(GIA);
    const [players, joins, hosted, attempts, results, challenges, plays, messages, analytics] = giaBefore.split(",").map(Number);
    check(players === 1 && joins! >= 1 && hosted === 1 && attempts === 2 && results! >= 4 && challenges === 1 && plays === 1 && messages === 1 && analytics! > 0, `guest: rows under her guest id (players, joins, hosted, attempts, results, challenges, practice, chat, events: ${giaBefore})`);
  });

  /* ------------------------------------------------------------- sign-up: the age gate */
  await section("age gate", async () => {
    const before = await events("under_thirteen_refused");
    const young = await call(account.startSignUpFn, { method: "email", dateOfBirth: "2015-03-01", username: "Gia_One" }, tok.gia);
    check(young.ok === false && young.reason === "under13" && /keep playing as a guest/.test(young.message), `under 13: refused kindly (${young.message})`);
    check(await events("under_thirteen_refused") === before + 1, "under 13: under_thirteen_refused recorded");
    check(q(`SELECT coalesce(props::text, 'null') FROM analytics.events WHERE event = 'under_thirteen_refused' ORDER BY id DESC LIMIT 1`) === "null", "under 13: the event carries no date of birth and no age");
    check(q(`SELECT count(*) FROM public.profiles`) === "0" && !/2015-03-01/.test(q(`SELECT coalesce(string_agg(props::text, ''), '') FROM analytics.events`)), "under 13: nothing stored");
    const google = await call(account.startSignUpFn, { method: "google", dateOfBirth: adultDob }, tok.gia);
    check(google.ok === false && google.reason === "method", "switches: the server refuses Google while it is off");
    const badDate = await call(account.startSignUpFn, { method: "email", dateOfBirth: "1995-02-30" }, tok.gia);
    check(badDate.ok === false && badDate.reason === "date", "sign-up: an impossible date is refused");
    const ok = await call(account.startSignUpFn, { method: "email", dateOfBirth: adultDob, username: "Gia_One" }, tok.gia);
    check(ok.ok === true && ok.isUnder18 === false, "sign-up: an adult's first step passes");
    check(await events("sign_up_started", GIA) === 1 && q(`SELECT props->>'method' FROM analytics.events WHERE event = 'sign_up_started'`) === "email", "events: sign_up_started with its method");
    const notYet = await call(account.completeSignUpFn, { username: "Gia_One", dateOfBirth: adultDob, colour: 3, country: "GB" }, tok.gia);
    check(notYet.ok === false && notYet.reason === "guest" && q(`SELECT count(*) FROM public.profiles`) === "0", "sign-up: a guest can't complete without confirming an email");
  });

  /* ------------------------------------------------------------- linking the email: same id, everything kept */
  let giaToken = "";
  await section("keep everything", async () => {
    const giaPhone = await phone(tok.gia);
    const sent = await auth.sendSignUpEmail("gia@example.com", giaPhone);
    const mail = lastMail("gia@example.com");
    check(sent.ok === true && mail?.template === "email_change" && /^\d{6}$/.test(mail.token), "link: one email with a 6-digit code to type");
    const wrong = await auth.verifyEmailCode("gia@example.com", "000000", "sign-up", giaPhone);
    check(!wrong.ok, "link: a wrong code is refused");
    const verified = await auth.verifyEmailCode("gia@example.com", mail!.token, "sign-up", giaPhone);
    check(verified.ok === true && verified.userId === GIA, `link: the code confirms the email on the same user id (${verified.userId})`);
    check(q(`SELECT is_anonymous::text || ',' || email FROM auth.users WHERE id = '${GIA}'`) === "false,gia@example.com", "link: the auth user is no longer anonymous");
    giaToken = (await giaPhone.auth.getSession()).data.session?.access_token ?? "";
    check(!!giaToken && giaToken !== tok.gia, "link: the phone holds the account's new session");
    const status = await call(account.accountStatusFn, undefined, giaToken);
    check(status.kind === "incomplete", "status: signed in but not signed up yet");
    const made = await call(account.completeSignUpFn, { username: "Gia_One", dateOfBirth: adultDob, colour: 3, country: "gb" }, giaToken);
    check(made.kind === "account" && made.userId === GIA && made.username === "Gia_One" && made.playerNumber === 2 && made.founding === true && made.country === "GB" && made.isUnder18 === false, `sign-up: the account is made on her id, #2, founding (${JSON.stringify(made).slice(0, 220)})`);
    check(!JSON.stringify(made).includes(adultDob), "sign-up: the account view never carries the date of birth");
    const again = await call(account.completeSignUpFn, { username: "Other_Name", dateOfBirth: adultDob, colour: 4 }, giaToken);
    check(again.kind === "account" && again.username === "Gia_One" && q(`SELECT count(*) FROM public.profiles`) === "1", "sign-up: completing twice changes nothing");
    check(await events("sign_up_completed", GIA) === 1 && q(`SELECT props->>'method' FROM analytics.events WHERE event = 'sign_up_completed'`) === "email", "events: sign_up_completed with its method");
    // Every row stayed, uncopied, and reads as hers.
    const after = rowsOf(GIA).split(",").map(Number);
    const before = giaBefore.split(",").map(Number);
    check(after.slice(0, 8).join() === before.slice(0, 8).join() && after[8]! >= before[8]!, `keep: every row is still under her id (${giaBefore} → ${after.join()})`);
    check(q(`SELECT count(*) FROM auth.users`) === "7", "keep: no new user was made");
    const attempt = await call(asyncFns.asyncAttemptFn, { roomId: dailyRoomId }, giaToken);
    check(attempt.ok === true, "keep: her Daily attempt opens with the account's token");
    const mine = await call(challenge.myChallengesFn, { codes: [challengeCode] }, giaToken);
    check(JSON.stringify(mine).includes(challengeCode), "keep: her challenge lists as hers");
    const players = await deviceDb(giaToken).from("duel_players").select("user_id").eq("duel_id", roomId);
    check((players.data ?? []).some((p) => p.user_id === GIA), "keep: her room's players read as hers through RLS");
    const msg = await call(chat.sendRoomMessageFn, { roomId, text: "still me" }, giaToken);
    check(msg.ok === true || /wait|slow|second/i.test(JSON.stringify(msg)), "keep: she is still a member of her room");
  });

  /* ------------------------------------------------------------- another account; uniqueness */
  let halToken = "";
  const signUp = async (id: string, guestToken: string, email: string, username: string, dob: string, colour = 5) => {
    const p = await phone(guestToken);
    await auth.sendSignUpEmail(email, p);
    const v = await auth.verifyEmailCode(email, lastMail(email)!.token, "sign-up", p);
    const token = (await p.auth.getSession()).data.session?.access_token ?? "";
    const made = await call(account.completeSignUpFn, { username, dateOfBirth: dob, colour, country: "FR" }, token);
    return { ok: v.ok && v.userId === id, token, made };
  };
  await section("usernames", async () => {
    const taken = await call(account.checkUsernameFn, { username: "GIA_ONE" }, tok.hal);
    check(taken.ok === false && taken.reason === "taken" && taken.suggestions?.length === 3, `unique: GIA_ONE is taken ignoring capitals, three suggestions (${JSON.stringify(taken).slice(0, 160)})`);
    const suggestionsFree = await Promise.all((taken.suggestions ?? []).map((s: string) => call(account.checkUsernameFn, { username: s }, tok.hal)));
    check(suggestionsFree.every((r) => r.ok === true), "unique: every suggestion is free and passes");
    const reserved = await call(account.checkUsernameFn, { username: "Adm1n" }, tok.hal);
    check(reserved.ok === false && reserved.reason === "reserved" && reserved.suggestions?.length === 3, "check: a reserved look-alike is refused with suggestions");
    const hal = await signUp(HAL, tok.hal, "hal@example.com", "gia_one", adultDob);
    check(hal.made.ok === false && hal.made.reason === "taken", "unique: the database refuses gia_one too");
    const hal2 = await call(account.completeSignUpFn, { username: "Hal_9", dateOfBirth: adultDob, colour: 5, country: "FR" }, hal.token);
    halToken = hal.token;
    check(hal2.kind === "account" && hal2.playerNumber === 3, `numbers: the second account is #3 (${JSON.stringify(hal2).slice(0, 120)})`);
    const dbTaken = q(`SELECT public.create_profile('${uid(90)}', 'GIA_ONE', 1::smallint, DATE '1990-01-01', NULL)`);
    check(dbTaken === "guest", "database: a user who isn't a permanent auth user gets no profile");

    // The free change, the limit, the hold, forced renames.
    const free = await call(account.changeUsernameFn, { username: "GiaVolt" }, giaToken);
    check(free.kind === "account" && free.username === "GiaVolt" && q(`SELECT free_change_used::text || ',' || (username_changed_at IS NOT NULL) FROM public.profiles WHERE user_id = '${GIA}'`) === "true,true", "rename: the free change within 7 days");
    check(await events("username_changed", GIA) === 1, "events: username_changed");
    const second = await call(account.changeUsernameFn, { username: "GiaTwo" }, giaToken);
    check(second.ok === false && second.reason === "wait" && /again on/.test(second.message), `rename: then not again for 90 days (${second.message})`);
    const held = await call(account.checkUsernameFn, { username: "gia_one" }, halToken);
    check(held.ok === false && held.reason === "held", "hold: a released name is held from other players");
    const heldRename = await call(account.changeUsernameFn, { username: "Gia_One" }, halToken);
    check(heldRename.ok === false && (heldRename.reason === "held" || heldRename.reason === "wait"), "hold: nobody else can take it");
    const admin = await adminDb();
    const forced = await accountServer.forceRename(admin, GIA, "GiaForced", "moderation test");
    check(forced.ok === true && q(`SELECT username || ',' || free_change_used FROM public.profiles WHERE user_id = '${GIA}'`) === "GiaForced,true", "forced: moderation renames at any time");
    const stillWait = await call(account.changeUsernameFn, { username: "GiaTwo" }, giaToken);
    check(stillWait.ok === false && stillWait.reason === "wait" && q(`SELECT count(*) FROM accounts.admin_log WHERE action = 'forced_rename'`) === "1", "forced: it doesn't count (the 90 days still run from her own change), and it is logged");
    const forcedBad = await accountServer.forceRename(admin, GIA, "Joulz_Staff", "bad");
    check(forcedBad.ok === false, "forced: the name rules still apply");
    // Ninety days on, she may change again, and may take back her own held name.
    q(`UPDATE public.profiles SET username_changed_at = now() - interval '91 days' WHERE user_id = '${GIA}'`);
    const back = await call(account.changeUsernameFn, { username: "Gia_One" }, giaToken);
    check(back.kind === "account" && back.username === "Gia_One", "rename: after 90 days, and her own held name comes back to her");
    // The 30-day hold ends.
    const heldOther = await call(account.checkUsernameFn, { username: "GiaForced" }, halToken);
    check(heldOther.ok === false && heldOther.reason === "held", "hold: GiaForced is held after she left it");
    q(`UPDATE accounts.username_holds SET held_until = now() - interval '1 second' WHERE username_key = 'giaforced'`);
    q(`SELECT accounts.run_daily_cleanup()`);
    const freeNow = await call(account.checkUsernameFn, { username: "GiaForced" }, halToken);
    check(freeNow.ok === true, "hold: after 30 days anyone may take it");
    // Hal: no free change after 7 days, and no counted change until 90 days from sign-up.
    q(`SET session_replication_role = replica; UPDATE public.profiles SET created_at = now() - interval '8 days' WHERE user_id = '${HAL}'`);
    const late = await call(account.changeUsernameFn, { username: "Hal_X" }, halToken);
    check(late.ok === false && late.reason === "wait", "rename: no free change after 7 days");
    q(`SET session_replication_role = replica; UPDATE public.profiles SET created_at = now() - interval '91 days' WHERE user_id = '${HAL}'`);
    const limited = await call(account.changeUsernameFn, { username: "Hal_X" }, halToken);
    check(limited.kind === "account" && limited.username === "Hal_X" && q(`SELECT free_change_used FROM public.profiles WHERE user_id = '${HAL}'`) === "f", "rename: 90 days after sign-up, a limited change");
    const raced = q(`SELECT public.rename_profile('${HAL}', 'Hal_Y', 'limited', now() - interval '1 year')`);
    check(raced === "stale", "rename: a change racing another (a stale read) is refused by the database");
  });

  /* ------------------------------------------------------------- sign-in from a phone with guest progress */
  await section("sign in elsewhere", async () => {
    await playPractice(tok.ivy);
    const day = await call(daily.dailyStartFn, { kind: "puzzle", displayName: "Ivy" }, tok.ivy);
    if (day.ok) await playAsync(day.roomId, tok.ivy);
    await flushAnalytics();
    const ivyBefore = rowsOf(IVY);
    const giaRows = rowsOf(GIA);
    const progress = await call(account.guestProgressFn, undefined, tok.ivy);
    check(progress.ok === true && progress.hasProgress === true && progress.progress.practice === 1 && progress.progress.dailies === 1 && progress.progress.account === false, `warning: what stays behind on the guest id (${JSON.stringify(progress).slice(0, 160)})`);
    const ivyPhone = await phone(tok.ivy);
    const asSignUp = await auth.sendSignUpEmail("gia@example.com", ivyPhone);
    check(!asSignUp.ok && asSignUp.reason === "existing-account", "sign-in: an email that has an account can't be linked to another guest");
    const sent = await auth.sendSignInEmail("gia@example.com", ivyPhone);
    const mail = lastMail("gia@example.com");
    check(sent.ok === true && mail?.template === "magic_link", "sign-in: the magic link and code go to the account's email");
    const verified = await auth.verifyEmailCode("gia@example.com", mail!.token, "sign-in", ivyPhone);
    check(verified.ok === true && verified.userId === GIA, "sign-in: the phone is now Gia's account");
    const token = (await ivyPhone.auth.getSession()).data.session?.access_token ?? "";
    const noted = await call(account.noteSignInFn, { method: "email" }, token);
    check(noted.ok === true && (await events("sign_in", GIA)) === 1 && q(`SELECT props->>'method' FROM analytics.events WHERE event = 'sign_in'`) === "email", "events: sign_in with its method");
    await flushAnalytics();
    check(rowsOf(IVY) === ivyBefore, `sign-in: the guest's rows stay on the guest id, nothing moved (${ivyBefore})`);
    const giaAfter = rowsOf(GIA).split(",");
    check(giaAfter.slice(0, 8).join() === giaRows.split(",").slice(0, 8).join(), "sign-in: the account gained none of the guest's rows");
    check(q(`SELECT is_anonymous FROM auth.users WHERE id = '${IVY}'`) === "t", "sign-in: the guest user is left as it was");
    const unknown = await auth.sendSignInEmail("nobody@example.com", ivyPhone);
    check(!unknown.ok && unknown.reason === "no-account" && q(`SELECT count(*) FROM auth.users`) === "7", "sign-in: an unknown email makes nobody");
    const out = await call(account.noteSignOutFn, undefined, token);
    const signedOut = await auth.signOutDevice(ivyPhone);
    check(out.ok === true && signedOut.ok && (await events("sign_out", GIA)) === 1, "events: sign_out");
  });

  /* ------------------------------------------------------------- age rules for 13–17 */
  await section("teen", async () => {
    const now = Date.now();
    const dob = (() => {
      const d = new Date(now);
      return `${d.getUTCFullYear() - 16}-01-15`;
    })();
    const teen = await signUp(JO, tok.jo, "jo@example.com", "Jo_Teen", dob, 7);
    check(teen.made.kind === "account" && teen.made.isUnder18 === true, "13–17: the account is flagged under 18");
    const admin = await adminDb();
    const flags = await accountServer.accountAgeFlags(admin, JO, now);
    const year = Number(dob.slice(0, 4));
    const before = await accountServer.accountAgeFlags(admin, JO, Date.parse(`${year + 18}-01-14T12:00:00Z`));
    const birthday = await accountServer.accountAgeFlags(admin, JO, Date.parse(`${year + 18}-01-15T00:30:00Z`));
    check(flags.isUnder18 === true && before.isUnder18 === true && birthday.isUnder18 === false, "13–17: is_under_18 for the server, lifting on the 18th birthday by itself");
    const guest = await accountServer.accountAgeFlags(admin, KIM, now);
    check(guest.account === false && guest.isUnder18 === null, "age flags: a guest has none");
  });

  /* ------------------------------------------------------------- player numbers and founding */
  await section("numbers", async () => {
    check(q(`SELECT string_agg(player_number::text, ',' ORDER BY player_number) FROM public.profiles`) === "2,3,4", "numbers: 2, 3, 4 in order; #1 never handed out");
    check(q(`SELECT accounts.is_founding(TIMESTAMPTZ '2027-01-25 23:59:59 Europe/London')::text || accounts.is_founding(TIMESTAMPTZ '2027-01-26 00:00:00 Europe/London')::text`) === "truefalse", "founding: before 26 Jan 2027 00:00 UK time only");
    check(q(`SELECT bool_and(founding) FROM public.profiles`) === "t", "founding: today's accounts are founding");
    const one = q(`SELECT accounts.admin_assign_player_one('gia_one')`);
    check(/now #1 \(was #2/.test(one) && q(`SELECT player_number FROM public.profiles WHERE user_id = '${GIA}'`) === "1", `admin: #1 given by the admin function (${one})`);
    const twice = db.psql(`SELECT accounts.admin_assign_player_one('hal_x')`);
    check(!twice.ok && /already belongs/.test(twice.err), "admin: #1 can't be given twice");
    check(q(`SELECT count(*) FROM accounts.admin_log WHERE action = 'assign_player_one'`) === "1", "admin: logged");
    const lee = await signUp(LEE, tok.lee, "lee@example.com", "Lee_Old", adultDob, 9);
    check(lee.made.kind === "account" && lee.made.playerNumber === 5, "numbers: the next account is #5 (#2 is never reused)");
    const dob = q(`SELECT accounts.admin_set_date_of_birth('Hal_X', DATE '1992-03-04', 'support ticket 1')`);
    check(/date of birth set/.test(dob) && q(`SELECT date_of_birth FROM public.profiles WHERE user_id = '${HAL}'`) === "1992-03-04" && q(`SELECT detail->>'note' FROM accounts.admin_log WHERE action = 'set_date_of_birth'`) === "support ticket 1", "admin: a date of birth corrected after a support request, logged");
    const child = db.psql(`SELECT accounts.admin_set_date_of_birth('Hal_X', (now() - interval '5 years')::date, 'x')`);
    check(!child.ok && /under 13/.test(child.err), "admin: a date making the player under 13 is refused");
    q(`UPDATE public.profiles SET date_of_birth = DATE '2001-01-01', player_number = 99, founding = false WHERE user_id = '${HAL}'`);
    check(q(`SELECT date_of_birth || ',' || player_number || ',' || founding FROM public.profiles WHERE user_id = '${HAL}'`) === "1992-03-04,3,true", "guard: even the service role can't change a date of birth, number or flag outside the admin functions");
    for (const role of ["anon", "authenticated", "service_role"])
      check(q(`SELECT has_function_privilege('${role}', 'accounts.admin_set_date_of_birth(text,date,text)', 'EXECUTE')::text || has_function_privilege('${role}', 'accounts.admin_assign_player_one(text)', 'EXECUTE')::text || has_function_privilege('${role}', 'accounts.run_daily_cleanup(boolean)', 'EXECUTE')::text`) === "falsefalsefalse", `admin: ${role} can't run the admin functions or the clean-up`);
    for (const role of ["anon", "authenticated", "service_role"])
      check(q(`SELECT has_function_privilege('${role}', 'accounts.forget_user(uuid)', 'EXECUTE')::text || has_function_privilege('${role}', 'accounts.accounts_due(integer)', 'EXECUTE')::text || has_function_privilege('${role}', 'accounts.guests_due(integer)', 'EXECUTE')::text`) === "falsefalsefalse", `admin: ${role} can't run the clean-up's parts (forget_user, accounts_due, guests_due)`);
  });

  /* ------------------------------------------------------------- row level security */
  await section("rls", async () => {
    const hal = deviceDb(halToken);
    const other = await hal.from("profiles").select("*").eq("user_id", GIA);
    check(!other.error && (other.data ?? []).length === 0, "rls: another player can't read Gia's row (date of birth, country)");
    const own = await hal.from("profiles").select("date_of_birth, country").eq("user_id", HAL).maybeSingle();
    check(own.data?.country === "FR", "rls: a player reads their own row");
    const pub = await hal.rpc("public_profiles", { p_user_ids: [GIA, HAL] });
    const row = (pub.data ?? []).find((r: { user_id: string }) => r.user_id === GIA) as Record<string, unknown> | undefined;
    check(!!row && row["username"] === "Gia_One" && row["player_number"] === 1 && row["founding"] === true && Object.keys(row).sort().join() === "colour,founding,player_number,user_id,username", `public: only username, colour, player number and founding (${JSON.stringify(row)})`);
    const anon = createClient(rest.url, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } });
    const anonRead = await anon.from("profiles").select("*");
    check(!!anonRead.error || (anonRead.data ?? []).length === 0, "rls: a signed-out caller reads nothing");
    const anonPub = await anon.rpc("public_profiles", { p_user_ids: [GIA] });
    check(!!anonPub.error, "rls: a signed-out caller can't list public profiles either");
    for (const [field, value] of [["date_of_birth", "1990-01-01"], ["player_number", 77], ["founding", false], ["username", "Sneaky"], ["status", "active"], ["deletion_requested_at", null]] as const) {
      const out = await hal.from("profiles").update({ [field]: value }).eq("user_id", HAL).select("user_id");
      check(!!out.error, `rls: a player can't change their own ${field} (${out.error?.code ?? "no error"})`);
    }
    const colour = await hal.from("profiles").update({ colour: 12, country: "DE" }).eq("user_id", HAL).select("colour, country");
    check(!colour.error && q(`SELECT colour || ',' || country FROM public.profiles WHERE user_id = '${HAL}'`) === "12,DE", "rls: a player changes their own colour and country");
    const badCountry = await hal.from("profiles").update({ country: "XX" }).eq("user_id", HAL).select("country");
    check(!!badCountry.error, "rls: only real ISO country codes are stored");
    const giaChange = await hal.from("profiles").update({ colour: 1 }).eq("user_id", GIA).select("user_id");
    check(!giaChange.error && (giaChange.data ?? []).length === 0 && q(`SELECT colour FROM public.profiles WHERE user_id = '${GIA}'`) === "3", "rls: nobody changes another player's row");
    const { readOwnProfile, updateOwnProfileSettings } = await import("../src/lib/data/profileReads");
    const mine = await readOwnProfile(hal as never, HAL);
    const set = await updateOwnProfileSettings(hal as never, HAL, { country: null });
    check(mine.data?.username === "Hal_X" && !set.error && q(`SELECT coalesce(country, 'none') FROM public.profiles WHERE user_id = '${HAL}'`) === "none", "phone: profileReads reads and updates the own row");
    for (const table of ["accounts.username_holds", "accounts.admin_log"])
      check(q(`SELECT has_table_privilege('authenticated', '${table}', 'SELECT')::text || has_table_privilege('anon', '${table}', 'SELECT')::text`) === "falsefalse", `rls: ${table} is closed to clients`);
  });

  /* ------------------------------------------------------------- room names on create and join */
  await section("room names", async () => {
    const refused = await rejects(call(duel.createRoomFn, { displayName: "Adm1n" }, tok.bo), /kept for Joulz/);
    check(!!refused && /Try .+, .+ or .+\./.test(refused), `create: a reserved look-alike is refused with three suggestions (${refused})`);
    const filthy = await rejects(call(duel.createRoomFn, { displayName: "Fuuuck" }, tok.bo), /can’t be used/);
    check(!!filthy, "create: repeated letters don't get past the filter");
    const code = q(`SELECT room_code FROM public.duels WHERE id = '${roomId}'`);
    q(`UPDATE public.duels SET status = 'waiting' WHERE id = '${roomId}'`);
    const join = await call(duel.joinRoomFn, { roomCode: code, displayName: "Captain J0ulz" }, tok.kim);
    check(join.ok === false && Array.isArray(join.suggestions) && join.suggestions.length === 3 && join.suggestions.every((s: string) => checkGuestName(s).ok), `join: refused with three suggestions that pass (${JSON.stringify(join).slice(0, 200)})`);
    const made = await call(duel.createRoomFn, { displayName: "Sixteen Chars Ok!" }, tok.kim);
    check(q(`SELECT display_name FROM public.duel_players WHERE duel_id = '${made.roomId}'`) === "Sixteen Chars Ok", "create: guest names keep up to 16 characters");
    await call(duel.leaveRoomFn, { roomId: made.roomId }, tok.kim);
  });

  /* ------------------------------------------------------------- delete account */
  await section("delete", async () => {
    const giaPhone = await phone(giaToken);
    const status = await call(account.accountStatusFn, undefined, giaToken);
    check(status.kind === "account" && status.deletion === null, "delete: not pending at first");
    const asked = await call(account.requestAccountDeletionFn, undefined, giaToken);
    check(asked.ok === true && Date.parse(asked.purgeAt) - Date.now() > 29 * DAY, "delete: asked for, removal in 30 days");
    check(await events("account_deletion_requested", GIA) === 1, "events: account_deletion_requested");
    const pub = await deviceDb(halToken).rpc("public_profiles", { p_user_ids: [GIA] });
    const row = (pub.data ?? [])[0] as Record<string, unknown> | undefined;
    check(row?.["username"] === "Deleted player" && row?.["player_number"] === null && row?.["colour"] === null, "delete: hidden from other players at once (Deleted player)");
    const out = await rejects(call(account.accountStatusFn, undefined, giaToken), /Invalid token|Unauthorized/);
    check(!!out, "delete: signed out everywhere (her session is refused)");
    // (Direct table reads with an old access token still pass until it lapses within the hour: PostgREST checks the
    // token's signature only, as on Supabase. The refresh tokens are gone, so no new access token is ever issued.)
    // Signing back in within 30 days offers to cancel.
    await auth.sendSignInEmail("gia@example.com", giaPhone);
    await auth.verifyEmailCode("gia@example.com", lastMail("gia@example.com")!.token, "sign-in", giaPhone);
    let token = (await giaPhone.auth.getSession()).data.session?.access_token ?? "";
    const pending = await call(account.accountStatusFn, undefined, token);
    check(pending.kind === "account" && !!pending.deletion, "delete: signing back in shows the pending deletion (to offer cancelling)");
    const cancelled = await call(account.cancelAccountDeletionFn, undefined, token);
    check(cancelled.kind === "account" && cancelled.deletion === null, "delete: cancelled within the 30 days");
    const back = await deviceDb(halToken).rpc("public_profiles", { p_user_ids: [GIA] });
    check(((back.data ?? [])[0] as Record<string, unknown> | undefined)?.["username"] === "Gia_One", "delete: after cancelling she shows again");
    q(`SELECT accounts.run_daily_cleanup()`);
    check(q(`SELECT count(*) FROM public.profiles WHERE user_id = '${GIA}'`) === "1", "clean-up: a cancelled deletion is kept");
    // Ask again, then 30 days pass.
    const again = await call(account.requestAccountDeletionFn, undefined, token);
    check(again.ok === true, "delete: asked again");
    const roomTotals = () =>
      q(`SELECT concat_ws(',', (SELECT count(*) FROM public.duel_players WHERE duel_id = '${roomId}'),
          (SELECT count(*) FROM public.round_results WHERE duel_id = '${roomId}'),
          (SELECT count(*) || ':' || coalesce(sum(total_score), 0) FROM public.async_attempts WHERE room_id = '${challengeRoomId}'),
          (SELECT count(*) || ':' || coalesce(sum(score), 0) FROM public.async_results WHERE room_id = '${challengeRoomId}'),
          (SELECT count(*) FROM public.async_attempts WHERE room_id = '${dailyRoomId}'))`);
    await flushAnalytics();
    const eventsBefore = Number(q(`SELECT count(*) FROM analytics.events`));
    const totalsBefore = roomTotals();
    const boardBefore = await call(challenge.challengeFinalFn, { roomId: challengeRoomId }, tok.bo);
    // Rooms' stored winners: her exact username is scrubbed; guests' typed names (even "Gia", or another casing) stay.
    q(`UPDATE public.duels SET tournament_history = '[{"winner":"Gia_One","score":120},{"winner":"Gia","score":90},{"winner":"gia_one","score":80},{"winner":"Bo","score":70}]'::jsonb WHERE id = '${roomId}'`);
    q(`UPDATE public.duels SET tournament_history = '[{"winner":"Gia_One","score":50}]'::jsonb WHERE id <> '${roomId}' AND host_user_id = '${BO}'`);
    q(`UPDATE public.profiles SET deletion_requested_at = now() - interval '29 days' WHERE user_id = '${GIA}'`);
    q(`SELECT accounts.run_daily_cleanup()`);
    check(q(`SELECT count(*) FROM public.profiles WHERE user_id = '${GIA}'`) === "1", "clean-up: not before 30 days");
    q(`UPDATE public.profiles SET deletion_requested_at = now() - interval '31 days' WHERE user_id = '${GIA}'`);
    const ran = JSON.parse(q(`SELECT accounts.run_daily_cleanup()`));
    check(ran.accounts === 1, `clean-up: the account is removed after 30 days (${JSON.stringify(ran)})`);
    check(q(`SELECT count(*) FROM auth.users WHERE id = '${GIA}'`) === "0" && q(`SELECT count(*) FROM public.profiles WHERE user_id = '${GIA}'`) === "0", "purge: the auth user and profile are gone");
    check(rowsOf(GIA) === "0,0,0,0,0,0,0,0,0", `purge: nothing names her id any more (${rowsOf(GIA)})`);
    check(q(`SELECT count(*) FROM public.room_messages WHERE duel_id = '${roomId}'`) === "0", "purge: her chat messages are deleted");
    check(roomTotals() === totalsBefore, `purge: other players' histories still add up (${totalsBefore} → ${roomTotals()})`);
    await flushAnalytics();
    check(Number(q(`SELECT count(*) FROM analytics.events`)) >= eventsBefore, "purge: her analytics events are kept, without her player id");
    check(q(`SELECT string_agg(display_name, ',' ORDER BY player_slot) FROM public.duel_players WHERE duel_id = '${roomId}'`) === "Deleted player,Bo", "purge: her name in the room shows as Deleted player");
    const boardAfter = await call(challenge.challengeFinalFn, { roomId: challengeRoomId }, tok.bo);
    const parsed = (b: { ok: boolean; json?: string }) =>
      (b.ok && b.json ? JSON.parse(b.json) : { players: [], results: [] }) as { players: { name: string }[]; results: { player_slot: number; score: number }[] };
    const [pb, pa] = [parsed(boardBefore), parsed(boardAfter)];
    const scoresOf = (p: typeof pb) => p.results.map((r) => `${r.player_slot}:${r.score}`).sort().join();
    check(
      pa.results.length > 0 && scoresOf(pa) === scoresOf(pb) && pa.players.map((p) => p.name).join() === "Deleted player,Bo" && pb.players.map((p) => p.name).join() === "Gia,Bo",
      `purge: Bo's challenge board keeps every score, Gia shown as Deleted player (${pa.players.map((p) => p.name).join()})`,
    );
    check(
      q(`SELECT tournament_history::text FROM public.duels WHERE id = '${roomId}'`) ===
        '[{"score": 120, "winner": "Deleted player"}, {"score": 90, "winner": "Gia"}, {"score": 80, "winner": "gia_one"}, {"score": 70, "winner": "Bo"}]',
      `purge: her exact username is scrubbed from the room's stored winners, typed guest names left (${q(`SELECT tournament_history::text FROM public.duels WHERE id = '${roomId}'`)})`,
    );
    check(
      q(`SELECT count(*) FROM public.duels WHERE tournament_history @> '[{"winner":"Gia_One"}]'::jsonb`) === "0",
      "purge: no room anywhere keeps her username as a winner",
    );
    check(q(`SELECT user_id IS NULL FROM accounts.username_holds WHERE username_key = 'gia_one'`) === "t", "purge: her username is held 30 days for nobody");
    const retake = await call(account.checkUsernameFn, { username: "Gia_One" }, halToken);
    check(retake.ok === false && retake.reason === "held", "purge: nobody takes her name for 30 days");
  });

  /* ------------------------------------------------------------- guests: 13 months after their last game */
  await section("guest clean-up", async () => {
    await playPractice(tok.kim);
    q(`SET session_replication_role = replica;
       UPDATE auth.users SET created_at = now() - interval '15 months', last_sign_in_at = now() - interval '14 months' WHERE id IN ('${KIM}', '${LEE}');
       UPDATE public.duel_players SET joined_at = now() - interval '14 months', last_seen_at = now() - interval '14 months', created_at = now() - interval '14 months' WHERE user_id IN ('${KIM}', '${LEE}');
       UPDATE public.room_joins SET joined_at = now() - interval '14 months' WHERE user_id IN ('${KIM}', '${LEE}');
       UPDATE public.practice_plays SET created_at = now() - interval '14 months' WHERE user_id IN ('${KIM}', '${LEE}');
       DELETE FROM public.duel_presence WHERE user_id IN ('${KIM}', '${LEE}');`);
    q(`UPDATE auth.users SET created_at = now() - interval '15 months' WHERE id = '${IVY}'`);
    // Half-finished sign-ups: a confirmed email, no profile. One last active 14 months ago, one last week.
    const OLD_HALF = uid(18);
    const NEW_HALF = uid(19);
    q(`INSERT INTO auth.users (id, is_anonymous, email, created_at, last_sign_in_at) VALUES
         ('${OLD_HALF}', false, 'old-half@example.com', now() - interval '15 months', now() - interval '14 months'),
         ('${NEW_HALF}', false, 'new-half@example.com', now() - interval '15 months', now() - interval '7 days')`);
    const ran = JSON.parse(q(`SELECT accounts.run_daily_cleanup()`));
    check(ran.guests === 2 && q(`SELECT count(*) FROM auth.users WHERE id = '${KIM}'`) === "0", `guests: removed 13 months after their last game (${JSON.stringify(ran)})`);
    check(q(`SELECT count(*) FROM auth.users WHERE id = '${OLD_HALF}'`) === "0", "half-finished: a confirmed email with no profile, 13 months idle, is removed");
    check(q(`SELECT count(*) FROM auth.users WHERE id = '${NEW_HALF}'`) === "1", "half-finished: one signed in last week stays (the same last-activity rule)");
    check(q(`SELECT count(*) FROM public.practice_plays WHERE user_id = '${KIM}'`) === "0" && Number(q(`SELECT count(*) FROM public.practice_plays WHERE user_id IS NULL`)) >= 2, "guests: their results detached, not deleted");
    check(q(`SELECT count(*) FROM auth.users WHERE id = '${IVY}'`) === "1", "guests: one who played recently stays (an old sign-up date alone doesn't count)");
    check(q(`SELECT count(*) FROM auth.users WHERE id = '${LEE}'`) === "1" && q(`SELECT count(*) FROM public.profiles WHERE user_id = '${LEE}'`) === "1", "guests: an account is never touched, however long since its last game");
    check(q(`SELECT count(*) FROM auth.users WHERE id = '${BO}'`) === "1", "guests: an active guest stays");
  });

  /* ------------------------------------------------------------- the brake and the run log */
  await section("brake", async () => {
    const logLines = () => Number(q(`SELECT count(*) FROM accounts.admin_log WHERE action IN ('cleanup', 'cleanup_braked')`));
    const lastLine = () => q(`SELECT action || '|' || detail::text FROM accounts.admin_log WHERE action IN ('cleanup', 'cleanup_braked') ORDER BY id DESC LIMIT 1`);
    const users = () => Number(q(`SELECT count(*) FROM auth.users`));
    // A run with nothing due still writes its line, with zeros.
    let before = logLines();
    const idle = JSON.parse(q(`SELECT accounts.run_daily_cleanup()`));
    const idleLine = lastLine();
    check(idle.accounts === 0 && idle.guests === 0 && logLines() === before + 1 && idleLine.startsWith("cleanup|") && /"accounts": 0/.test(idleLine) && /"guests": 0/.test(idleLine), `log: a run with nothing due writes one line with zero counts (${idleLine})`);

    // 26 accounts due: the brake.
    q(`INSERT INTO auth.users (id, is_anonymous, email) SELECT ('00000000-0000-4000-9000-' || lpad(n::text, 12, '0'))::uuid, false, 'bulk' || n || '@example.com' FROM generate_series(1, 26) n;
       INSERT INTO public.profiles (user_id, username, username_key, colour, date_of_birth) SELECT ('00000000-0000-4000-9000-' || lpad(n::text, 12, '0'))::uuid, 'Bulk_' || n, 'bulk_' || n, 0, DATE '1990-01-01' FROM generate_series(1, 26) n;
       UPDATE public.profiles SET deletion_requested_at = now() - interval '31 days' WHERE username_key LIKE 'bulk\_%';`);
    let n = users();
    before = logLines();
    const braked = JSON.parse(q(`SELECT accounts.run_daily_cleanup()`));
    const brakeLine = lastLine();
    check(braked.braked === true && braked.accounts === 0 && braked.due_accounts === 26 && users() === n, `brake: 26 accounts due removes nothing (${JSON.stringify(braked)})`);
    check(logLines() === before + 1 && brakeLine.startsWith("cleanup_braked|") && /braked: more than 25 accounts/.test(brakeLine), `brake: one warning line in admin_log (${brakeLine.slice(0, 160)})`);
    // 25 due: the run goes ahead.
    q(`UPDATE public.profiles SET deletion_requested_at = NULL WHERE username_key = 'bulk_26'`);
    before = logLines();
    const ran25 = JSON.parse(q(`SELECT accounts.run_daily_cleanup()`));
    check(ran25.braked === false && ran25.accounts === 25 && users() === n - 25 && logLines() === before + 1 && lastLine().startsWith("cleanup|") && /"accounts": 25/.test(lastLine()), `brake: 25 accounts due are removed, logged with the count (${JSON.stringify(ran25)})`);
    check(q(`SELECT count(*) FROM public.profiles WHERE username_key = 'bulk_26'`) === "1", "brake: an account not due stays");

    // 501 guests due: the brake; 500: removed.
    q(`INSERT INTO auth.users (id, created_at, last_sign_in_at) SELECT ('00000000-0000-4000-a000-' || lpad(n::text, 12, '0'))::uuid, now() - interval '15 months', now() - interval '14 months' FROM generate_series(1, 501) n`);
    n = users();
    before = logLines();
    const brakedGuests = JSON.parse(q(`SELECT accounts.run_daily_cleanup()`));
    check(brakedGuests.braked === true && brakedGuests.due_guests === 501 && users() === n && logLines() === before + 1 && lastLine().startsWith("cleanup_braked|"), `brake: 501 guests due removes nothing, one warning line (${JSON.stringify(brakedGuests)})`);
    q(`UPDATE auth.users SET last_sign_in_at = now() WHERE id = '00000000-0000-4000-a000-000000000501'`);
    before = logLines();
    const ran500 = JSON.parse(q(`SELECT accounts.run_daily_cleanup()`));
    check(ran500.braked === false && ran500.guests === 500 && users() === n - 500 && logLines() === before + 1 && /"guests": 500/.test(lastLine()), `brake: 500 guests due are removed, logged with the count (${JSON.stringify(ran500)})`);
    // Joe's hand override lifts the brake for one run.
    q(`INSERT INTO auth.users (id, created_at, last_sign_in_at) SELECT ('00000000-0000-4000-b000-' || lpad(n::text, 12, '0'))::uuid, now() - interval '15 months', now() - interval '14 months' FROM generate_series(1, 501) n`);
    const override = JSON.parse(q(`SELECT accounts.run_daily_cleanup(true)`));
    check(override.braked === false && override.guests === 501 && /"override": true/.test(lastLine()), "brake: run_daily_cleanup(true) by hand lifts it for one run, logged");
    check(q(`SELECT count(*) FROM accounts.admin_log WHERE action IN ('cleanup', 'cleanup_braked') AND user_id IS NOT NULL`) === "0", "log: run lines name nobody");
  });
}
