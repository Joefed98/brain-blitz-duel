/**
 * moderation-check (safety, 10 Nov 2026; docs/moderation.md): bots, chat rules, reports, the automatic chat mute,
 * Joe's review list and its functions, retention, through the real server functions and the real migrations on a
 * local PostgreSQL 16 with the server-function harness's PostgREST / GoTrue stand-in (scripts/server-fn-harness.ts).
 * The two-tap report screens are moderation-ui-check.
 *
 * What it proves:
 * - Turnstile: Cloudflare's always-fail test secret refuses guest creation (Supabase's captcha, emulated by the
 *   stand-in as siteverify answers for the test secrets) and account sign-up (our server's check), always-pass allows
 *   both, and with the switch off both behave as today (no token asked for); the real siteverify is asked too when
 *   it can be reached (a NOTE otherwise);
 * - the new-guest limit: 200 an hour from one network through take_rate_limit (Auth's Before User Created hook), the
 *   201st refused, another network unaffected; the key is the server's addressKey hash, never the address, and kept
 *   only for the window;
 * - chat rules: the server's word filter on every message; chatPolicy gives rooms "type" for everyone and quick
 *   phrases to guests and under-18s where strangers meet; the quick phrases pass the filter;
 * - reports from a message and from a name, with their context, the reporter never revealed, duplicates stored but not
 *   counted, self-reports, outsiders and bad reasons refused;
 * - the automatic mute after three different players within 24 hours (not one player three times, not cheating
 *   reports), enforced on send and reactions with the plain notice, lifting after 24 hours or by unmute;
 * - each of Joe's functions does what it says and is logged (moderation.actions and a moderation_action event);
 *   banned players can't make or join rooms or chat, still practise;
 * - the moderation schema and the server-only functions are unreachable for anon and authenticated;
 * - retention: chat after 90 days unless reported, reports and actions after 2 years; a removed user's reports
 *   re-keyed;
 * - analytics: report_sent (reason only), chat_muted, moderation_action (type only).
 *
 * Needs the PostgreSQL 16 binaries (preinstalled on GitHub's runners). Without them it fails on CI and prints a NOTE
 * locally. No browser.
 */

import { readFileSync } from "node:fs";

import {
  accountToken,
  ANON_KEY,
  callServerFn,
  installServerFnPlugin,
  postgresBin,
  SERVICE_KEY,
  startLocalDb,
  startRestServer,
  TURNSTILE_TEST_SECRETS,
  turnstileTestVerify,
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
async function rejects(promise: Promise<unknown>, pattern: RegExp): Promise<boolean> {
  try {
    await promise;
    return false;
  } catch (err) {
    return pattern.test(err instanceof Error ? err.message : String(err));
  }
}

const realLog = console.log;
const realWarn = console.warn;
const realError = console.error;
console.log = (...args: unknown[]) => {
  const line = args.map(String).join(" ");
  if (/^\s*(FAIL|NOTE)|^moderation-check|^PASS/.test(line)) realLog(...args);
};
console.warn = () => {};
console.error = () => {};
const restore = () => {
  console.log = realLog;
  console.warn = realWarn;
  console.error = realError;
};

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ANA = uid(21); // the host
const BEN = uid(22); // reported for chat, muted
const CAT = uid(23);
const DAN = uid(24);
const EVE = uid(25);
const FIN = uid(26); // muted, then unmuted early
const GUS = uid(27); // reported only for cheating
const HAZ = uid(28); // an account: warned, force-renamed
const IAN = uid(29); // outside the room
const JAY = uid(30); // banned
const KAY = uid(31); // sign-up with Turnstile
const LOU = uid(32); // sign-up with Turnstile off
const MIA = uid(33); // a guest, force-renamed

let db: LocalDb | null = null;
let rest: RestServer | null = null;

await pureChecks();

if (!postgresBin()) {
  restore();
  if (process.env["CI"]) {
    console.log(`moderation-check: ${passes} passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL`);
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: the database part not run (CI runs it)");
  console.log(`moderation-check: ${passes} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
}

const verifyServer = Bun.serve({
  port: 0,
  hostname: "127.0.0.1",
  async fetch(request) {
    const form = new URLSearchParams(await request.text());
    return Response.json(turnstileTestVerify(form.get("secret") ?? "", form.get("response") ?? ""));
  },
});

try {
  db = startLocalDb("moderation-check-");
  check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
  rest = await startRestServer(db.socketDir);
  process.env["SUPABASE_URL"] = rest.url;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
  process.env["TURNSTILE_VERIFY_URL"] = `http://127.0.0.1:${verifyServer.port}/siteverify`;
  const ids = [ANA, BEN, CAT, DAN, EVE, FIN, GUS, HAZ, IAN, JAY, KAY, LOU, MIA];
  db.psql(`INSERT INTO auth.users (id) VALUES ${ids.map((id) => `('${id}')`).join(", ")}`);
  await installServerFnPlugin();
  await databaseChecks(db, rest);
} catch (err) {
  check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await rest?.stop();
  db?.stop();
  verifyServer.stop(true);
}

restore();
console.log(`moderation-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: Turnstile, the new-guest limit, chat rules, reports, the automatic mute, Joe's tools, bans and retention hold.");
process.exit(0);

/* =================================================================== pure rules */

async function pureChecks(): Promise<void> {
  await section("chat policy", async () => {
    const { chatPolicy, chatPolicies } = await import("../src/lib/safety/chatPolicy");
    const guest = { isGuest: true, isUnder18: null };
    const teen = { isGuest: false, isUnder18: true };
    const adult = { isGuest: false, isUnder18: false };
    const unknown = { isGuest: false, isUnder18: null };
    check([guest, teen, adult, unknown].every((p) => chatPolicy("room", p) === "type"), "chat policy: rooms always type (guests and under-18s included)");
    for (const context of ["rated", "tournament"] as const) {
      check(chatPolicy(context, guest) === "quick_phrases", `chat policy: ${context}: a guest gets quick phrases`);
      check(chatPolicy(context, teen) === "quick_phrases", `chat policy: ${context}: an under-18 gets quick phrases`);
      check(chatPolicy(context, unknown) === "quick_phrases", `chat policy: ${context}: an unknown age gets quick phrases`);
      check(chatPolicy(context, adult) === "type", `chat policy: ${context}: an adult account types`);
    }
    check(JSON.stringify(chatPolicies("rated", [adult, guest])) === '["type","quick_phrases"]', "chat policy: each player of a match gets their own answer");
  });

  await section("quick phrases", async () => {
    const { QUICK_PHRASES, QUICK_REACTIONS, quickPhraseText } = await import("../src/lib/safety/quickPhrases");
    const { ROOM_EMOJI } = await import("../src/lib/duel/chatConstants");
    const { censorChat } = await import("../src/lib/duel/displayName.server");
    check(QUICK_PHRASES.length >= 18 && QUICK_PHRASES.length <= 24, `quick phrases: about 20 (${QUICK_PHRASES.length})`);
    check(new Set(QUICK_PHRASES.map((p) => p.id)).size === QUICK_PHRASES.length, "quick phrases: ids unique");
    check(QUICK_PHRASES.every((p) => p.text.length <= 30 && censorChat(p.text) === p.text), "quick phrases: short, and pass the chat filter unchanged");
    check(["Good game!", "Nice one!", "Rematch?"].every((t) => QUICK_PHRASES.some((p) => p.text === t)), "quick phrases: Good game!, Nice one!, Rematch?");
    const JOES_LIST = [
      "Good game!", "Rematch?", "Nice one!", "Unlucky!", "Jeeez!", "How?!", "So close!", "Sheesh!", "That was clutch!",
      "My thumbs slipped", "Too fast for me!", "I’ll get you next time!", "One more?", "Good luck!", "Let’s go!",
      "Well played!", "Brain hurts", "Oops!", "Hello!", "Bye!",
    ];
    check(
      JSON.stringify(QUICK_PHRASES.map((p) => p.text)) === JSON.stringify(JOES_LIST),
      "quick phrases: exactly Joe's 20 (10 Nov 2026), in his order",
    );
    check(QUICK_REACTIONS === ROOM_EMOJI && ROOM_EMOJI.length === 6, "quick phrases: the six existing reactions");
    check(quickPhraseText("gg") === "Good game!" && quickPhraseText("hello there") === null, "quick phrases: looked up by id only");
    const room = readFileSync("src/components/duel/RoomChat.tsx", "utf8");
    check(!/quickPhrases/.test(room), "quick phrases: not shown in rooms");
  });

  await section("new-guest limit numbers", async () => {
    const { NEW_GUEST_LIMIT } = await import("../src/lib/duel/rateLimit.server");
    const sql = readFileSync("supabase/migrations/20261110150200_new_guest_limit.sql", "utf8");
    check(NEW_GUEST_LIMIT.max === 200 && NEW_GUEST_LIMIT.windowSeconds === 3600 && NEW_GUEST_LIMIT.bucket === "new-guest", "new guests: 200 an hour in the 'new-guest' bucket");
    check(/c_max constant integer := 200;/.test(sql) && /c_window constant integer := 3600;/.test(sql) && /'new-guest'/.test(sql), "new guests: the hook's numbers are NEW_GUEST_LIMIT's");
  });

  await section("turnstile (server)", async () => {
    const { verifyTurnstile, turnstileOn, TURNSTILE_VERIFY_URL } = await import("../src/lib/safety/turnstile.server");
    const { TURNSTILE_SITE_KEY, isTurnstileTestSiteKey } = await import("../src/config/safetyConfig");
    check(
      TURNSTILE_SITE_KEY === "0x4AAAAAAF7p4429yWwcQSDR" && !isTurnstileTestSiteKey(TURNSTILE_SITE_KEY),
      "turnstile: the site key is Joe's widget key, not one of Cloudflare's test keys",
    );
    check(
      ["1x00000000000000000000AA", "2x00000000000000000000AB", "1x00000000000000000000BB", "2x00000000000000000000BB", "3x00000000000000000000FF"].every(isTurnstileTestSiteKey) &&
        !isTurnstileTestSiteKey("") && !isTurnstileTestSiteKey("0x4AAAAAAF7p4429yWwcQSDR"),
      "turnstile: Cloudflare's published test site keys are recognised as test keys, the live key is not",
    );
    let asked = 0;
    const stand: typeof fetch = (async (_url: unknown, init?: RequestInit) => {
      asked++;
      const form = new URLSearchParams(String(init?.body ?? ""));
      return Response.json(turnstileTestVerify(form.get("secret") ?? "", form.get("response") ?? ""));
    }) as typeof fetch;
    const siteKey = "1x00000000000000000000BB";
    check((await verifyTurnstile(undefined, { siteKey: "", secret: TURNSTILE_TEST_SECRETS.fail, fetchImpl: stand })) && asked === 0, "turnstile: off (no site key): allowed without asking Cloudflare");
    check(!turnstileOn({ siteKey, secret: "" }) && (await verifyTurnstile(undefined, { siteKey, secret: "", fetchImpl: stand })), "turnstile: no secret: off, allowed");
    check(await verifyTurnstile("XXXX.DUMMY.TOKEN.XXXX", { siteKey, secret: TURNSTILE_TEST_SECRETS.pass, fetchImpl: stand }), "turnstile: always-pass secret passes");
    check(!(await verifyTurnstile("XXXX.DUMMY.TOKEN.XXXX", { siteKey, secret: TURNSTILE_TEST_SECRETS.fail, fetchImpl: stand })), "turnstile: always-fail secret refuses");
    check(!(await verifyTurnstile("XXXX.DUMMY.TOKEN.XXXX", { siteKey, secret: TURNSTILE_TEST_SECRETS.spent, fetchImpl: stand })), "turnstile: a spent token refuses");
    check(!(await verifyTurnstile(null, { siteKey, secret: TURNSTILE_TEST_SECRETS.pass, fetchImpl: stand })), "turnstile: on, no token: refused");
    const broken = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    check(!(await verifyTurnstile("t", { siteKey, secret: TURNSTILE_TEST_SECRETS.pass, fetchImpl: broken })), "turnstile: Cloudflare unreachable: refused");
    // Cloudflare's own siteverify with the test secrets, when this machine can reach it.
    try {
      const ask = async (secret: string) => {
        const res = await fetch(TURNSTILE_VERIFY_URL, {
          method: "POST",
          body: new URLSearchParams({ secret, response: "XXXX.DUMMY.TOKEN.XXXX" }),
          signal: AbortSignal.timeout(5000),
        });
        return ((await res.json()) as { success?: boolean }).success === true;
      };
      const [pass, fail] = [await ask(TURNSTILE_TEST_SECRETS.pass), await ask(TURNSTILE_TEST_SECRETS.fail)];
      check(pass && !fail, "turnstile: Cloudflare's siteverify answers the test secrets as the stand-in does");
    } catch {
      console.log("  NOTE Cloudflare's siteverify is not reachable from here: the test secrets were checked on the stand-in only");
    }
    const session = readFileSync("src/lib/duel/session.ts", "utf8");
    check(/signInAnonymously\(\{ options: \{ captchaToken \} \}\)/.test(session) && /turnstileEnabled\(\) \? await getTurnstileToken\("guest"\) : null/.test(session), "turnstile: guest creation sends the token only while on");
    const auth = readFileSync("src/lib/account/auth.ts", "utf8");
    check(/captchaToken \? \{ captchaToken \} : \{\}/.test(auth), "turnstile: sign-in emails send the token only while on");
  });

  await section("turnstile (phone)", async () => {
    const { getTurnstileToken, turnstileEnabled } = await import("../src/lib/safety/turnstile");
    const { Window } = await import("happy-dom");
    const keys = ["window", "document", "navigator"] as const;
    const saved = keys.map((k) => Object.getOwnPropertyDescriptor(globalThis, k));
    /** Runs `body` on a phone page: `webdriver` as automation reports it, `override` the check's stand-in key. */
    const onPhone = async <T,>(webdriver: boolean, override: string | undefined, body: (rendered: string[]) => Promise<T>) => {
      const win = new Window({ url: "https://joulz.uk/" });
      Object.defineProperty(win.navigator, "webdriver", { configurable: true, get: () => webdriver });
      if (override !== undefined) (win as unknown as Record<string, unknown>)["__DUELZ_TURNSTILE_SITE_KEY__"] = override;
      const rendered: string[] = [];
      // A stand-in for Cloudflare's script (already loaded): renders hand back a token for the key asked.
      (win as unknown as Record<string, unknown>)["turnstile"] = {
        render: (_el: unknown, o: { sitekey: string; callback: (t: string) => void }) => {
          rendered.push(o.sitekey);
          setTimeout(() => o.callback(`token-for-${o.sitekey}`), 0);
          return "w1";
        },
        remove: () => {},
      };
      for (const k of keys) Object.defineProperty(globalThis, k, { configurable: true, writable: true, value: (win as unknown as Record<string, unknown>)[k] });
      try {
        return await body(rendered);
      } finally {
        keys.forEach((k, i) => (saved[i] ? Object.defineProperty(globalThis, k, saved[i]!) : delete (globalThis as Record<string, unknown>)[k]));
        await win.happyDOM.close();
      }
    };
    await onPhone(true, undefined, async (rendered) => {
      const token = await getTurnstileToken("guest");
      check(!turnstileEnabled() && token === null && rendered.length === 0, "turnstile: under automation with no test key: off on the phone, no token, no widget");
    });
    await onPhone(true, "0x4AAAAAAF7p4429yWwcQSDR", async (rendered) => {
      const token = await getTurnstileToken("guest");
      check(!turnstileEnabled() && token === null && rendered.length === 0, "turnstile: under automation a live-key override is ignored (test keys only)");
    });
    await onPhone(true, "1x00000000000000000000BB", async (rendered) => {
      const token = await getTurnstileToken("sign-in");
      check(turnstileEnabled() && token === "token-for-1x00000000000000000000BB" && rendered.join() === "1x00000000000000000000BB", "turnstile: under automation a check's test key turns it on with that key");
    });
    await onPhone(false, undefined, async (rendered) => {
      const token = await getTurnstileToken("guest");
      check(
        turnstileEnabled() && token === "token-for-0x4AAAAAAF7p4429yWwcQSDR" && rendered.join() === "0x4AAAAAAF7p4429yWwcQSDR",
        "turnstile: a real (non-automated) phone with the key set requests a token from the live widget",
      );
    });
  });

  await section("report words", async () => {
    const r = await import("../src/lib/safety/reports");
    check(r.REPORT_REASONS.join() === "offensive_name,abusive_chat,cheating", "reports: three reasons");
    check(r.CHAT_MUTED_MESSAGE === "Chat is paused for 24 hours after reports from other players.", "mute: the plain notice");
    check(r.BANNED_MESSAGE.includes("support@joulz.uk") && /Practice still works/.test(r.BANNED_MESSAGE), "ban: the notice names support@joulz.uk and Practice");
  });
}

/* =================================================================== database */

async function databaseChecks(db: LocalDb, rest: RestServer): Promise<void> {
  const duel = await import("../src/lib/duel/duel.functions");
  const chat = await import("../src/lib/duel/chat.functions");
  const safety = await import("../src/lib/safety/safety.functions");
  const accountFns = await import("../src/lib/account/account.functions");
  const practice = await import("../src/lib/duel/practice.functions");
  const { flushAnalytics } = await import("../src/lib/data/events.server");
  const { adminDb } = await import("../src/lib/data/db.server");
  const { addressKey, withinNewGuestLimit } = await import("../src/lib/duel/rateLimit.server");
  const { CHAT_MUTED_MESSAGE, BANNED_MESSAGE } = await import("../src/lib/safety/reports");
  const { createClient } = await import("@supabase/supabase-js");
  const call = callServerFn;
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out;
  };
  /** Runs SQL as a role (anon, authenticated, service_role): answers the error text, or "" when it worked. */
  const asRole = (role: string, sql: string) => {
    const out = db.psql(`SET ROLE ${role}; ${sql}`);
    return out.ok ? "" : out.err;
  };
  const events = async (event: string) => {
    await flushAnalytics();
    return q(`SELECT coalesce(string_agg(coalesce(props::text, '') || '|' || coalesce(player_id::text, ''), ';' ORDER BY id), '') FROM analytics.events WHERE event = '${event}'`);
  };
  const tok = Object.fromEntries(
    Object.entries({ ana: ANA, ben: BEN, cat: CAT, dan: DAN, eve: EVE, fin: FIN, gus: GUS, haz: HAZ, ian: IAN, jay: JAY, mia: MIA }).map(([k, id]) => [k, userToken(id)]),
  ) as Record<string, string>;
  /** Moves every message back past the chat gap, so the next send isn't "Slow down". */
  const pastGap = () => {
    q(`UPDATE public.room_messages SET created_at = created_at - interval '1 minute' WHERE true`);
    q(`DELETE FROM public.rate_limit_hits WHERE bucket = 'chat-gap'`);
  };

  /* ---------------------------------------------------------------- bots: guest creation */
  const anonClient = (ip: string) =>
    createClient(rest.url, ANON_KEY, {
      global: { headers: { "x-forwarded-for": ip } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

  await section("turnstile: guest creation", async () => {
    const off = await anonClient("198.51.100.1").auth.signInAnonymously();
    check(!off.error && !!off.data.user?.id, "guests: captcha off: made as today, no token");
    rest.auth.captchaSecret = TURNSTILE_TEST_SECRETS.fail;
    const failed = await anonClient("198.51.100.1").auth.signInAnonymously({ options: { captchaToken: "XXXX.DUMMY.TOKEN.XXXX" } });
    check(!!failed.error && /captcha/i.test(failed.error.message) && !failed.data.user, "guests: always-fail secret: refused, nobody made");
    rest.auth.captchaSecret = TURNSTILE_TEST_SECRETS.pass;
    const passed = await anonClient("198.51.100.1").auth.signInAnonymously({ options: { captchaToken: "XXXX.DUMMY.TOKEN.XXXX" } });
    check(!passed.error && !!passed.data.user?.id, "guests: always-pass secret: made");
    const none = await anonClient("198.51.100.1").auth.signInAnonymously();
    check(!!none.error && /captcha/i.test(none.error.message), "guests: captcha on, no token: refused");
    rest.auth.captchaSecret = null;
  });

  await section("new-guest limit", async () => {
    rest.auth.beforeUserCreated = "before_user_created_guest_limit";
    const ip = "203.0.113.7";
    let made = 0;
    for (let i = 0; i < 200; i++) {
      const r = await anonClient(ip).auth.signInAnonymously();
      if (!r.error) made++;
    }
    check(made === 200, `new guests: 200 from one network in an hour allowed (${made})`);
    const over = await anonClient(ip).auth.signInAnonymously();
    check(!!over.error && over.error.status === 429 && /new players from this network/.test(over.error.message), "new guests: the 201st refused (429, plain message)");
    const other = await anonClient("203.0.113.8").auth.signInAnonymously();
    check(!other.error, "new guests: another network unaffected");
    const key = await addressKey(ip);
    check(q(`SELECT public.network_key('${ip}')`) === key, "new guests: the database's network key is the server's addressKey hash");
    check(q(`SELECT hits FROM public.rate_limit_hits WHERE user_id = '${key}' AND bucket = 'new-guest'`) === "201", "new guests: counted in take_rate_limit's table under the hashed key");
    check(!(await withinNewGuestLimit(await adminDb(), ip)), "new guests: the server's takeRateLimit path reads the same count");
    check(q(`SELECT count(*) FROM public.rate_limit_hits WHERE user_id::text LIKE '%203.0.113%'`) === "0" && !/203\.0\.113/.test(q(`SELECT coalesce(string_agg(t::text, ''), '') FROM public.rate_limit_hits t`)), "new guests: the address itself is never stored");
    check(!/203\.0\.113/.test(q(`SELECT coalesce(string_agg(t::text, ''), '') FROM analytics.events t`)) && q(`SELECT count(*) FROM public.profiles WHERE user_id = '${key}'`) === "0", "new guests: the key is never stored with events or profiles");
    q(`UPDATE public.rate_limit_hits SET window_start = now() - interval '61 minutes' WHERE user_id = '${key}' AND bucket = 'new-guest'`);
    const fresh = await anonClient("203.0.113.9").auth.signInAnonymously();
    check(!fresh.error && q(`SELECT count(*) FROM public.rate_limit_hits WHERE user_id = '${key}'`) === "0", "new guests: a key is deleted once its hour is over");
    const again = await anonClient(ip).auth.signInAnonymously();
    check(!again.error, "new guests: the network may make guests again after the hour");
    check(q(`SELECT public.before_user_created_guest_limit('{"metadata":{"ip_address":"${ip}"},"user":{"is_anonymous":false}}'::jsonb)::text`) === "{}", "new guests: a user that isn't a guest isn't counted");

    // Fail open (Joe, 10 Nov 2026): no address, or a count that can't be taken, allows the sign-up with a warning line.
    const warnings = () => q(`SELECT coalesce(string_agg(concat_ws('|', detail::text, user_id IS NULL, report_id IS NULL, by_role), ';' ORDER BY id), '') FROM moderation.actions WHERE action = 'guest_limit_warning'`);
    const rowsBefore = q(`SELECT count(*) FROM public.rate_limit_hits WHERE bucket = 'new-guest'`);
    const noAddress = await createClient(rest.url, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }).auth.signInAnonymously();
    check(!noAddress.error && !!noAddress.data.user?.id, "new guests: no address in the hook's payload: the sign-up is allowed");
    check(warnings() === '{"reason": "no_address"}|t|t|system', `new guests: no address writes one warning line, reason only (${warnings()})`);
    check(q(`SELECT count(*) FROM public.rate_limit_hits WHERE bucket = 'new-guest'`) === rowsBefore, "new guests: no address counts nothing");
    q(`ALTER TABLE public.rate_limit_hits ADD CONSTRAINT moderation_check_fail CHECK (bucket <> 'new-guest') NOT VALID`);
    const broken = await anonClient("203.0.113.50").auth.signInAnonymously();
    q(`ALTER TABLE public.rate_limit_hits DROP CONSTRAINT moderation_check_fail`);
    check(!broken.error && !!broken.data.user?.id, "new guests: the limit's count failing: the sign-up is allowed");
    const lines = warnings().split(";");
    check(lines.length === 2 && lines[1] === '{"reason": "limit_error", "sqlstate": "23514"}|t|t|system', `new guests: a failing count writes a warning line, reason and error code only (${lines[1]})`);
    check(!/203\.0\.113|198\.51\.100/.test(warnings()) && !warnings().includes(await addressKey("203.0.113.50")), "new guests: the warning lines hold no address or key");
    const stillOver = await anonClient(ip).auth.signInAnonymously();
    check(!stillOver.error, "new guests: after a failure the limit carries on counting (that network's hour started again above)");
    rest.auth.beforeUserCreated = null;
  });

  await section("turnstile: account sign-up", async () => {
    q(`UPDATE auth.users SET is_anonymous = false, email = 'kay@example.com' WHERE id = '${KAY}'`);
    q(`UPDATE auth.users SET is_anonymous = false, email = 'lou@example.com' WHERE id = '${LOU}'`);
    const input = { username: "KayPlays", dateOfBirth: "1990-02-03", colour: 3, country: "GB", turnstileToken: "XXXX.DUMMY.TOKEN.XXXX" };
    process.env["TURNSTILE_SITE_KEY"] = "1x00000000000000000000BB";
    process.env["TURNSTILE_SECRET_KEY"] = TURNSTILE_TEST_SECRETS.fail;
    const refused = await call(accountFns.completeSignUpFn, input, accountToken(KAY));
    check(refused.ok === false && refused.reason === "turnstile" && q(`SELECT count(*) FROM public.profiles WHERE user_id = '${KAY}'`) === "0", "sign-up: always-fail secret refuses, no account made");
    process.env["TURNSTILE_SECRET_KEY"] = TURNSTILE_TEST_SECRETS.pass;
    const noToken = await call(accountFns.completeSignUpFn, { ...input, turnstileToken: null }, accountToken(KAY));
    check(noToken.ok === false && noToken.reason === "turnstile", "sign-up: on, no token: refused");
    const made = await call(accountFns.completeSignUpFn, input, accountToken(KAY));
    check(made.username === "KayPlays" && q(`SELECT count(*) FROM public.profiles WHERE user_id = '${KAY}'`) === "1", "sign-up: always-pass secret: the account is made");
    delete process.env["TURNSTILE_SITE_KEY"];
    delete process.env["TURNSTILE_SECRET_KEY"];
    const offMade = await call(accountFns.completeSignUpFn, { username: "LouPlays", dateOfBirth: "1990-02-03", colour: 4 }, accountToken(LOU));
    check(offMade.username === "LouPlays", "sign-up: switch off: made without a token, as today");
  });

  await section("events check after every migration", async () => {
    // The moderation migration rewrites events_event_check after the save-progress one: it must keep every event.
    const { ANALYTICS_EVENTS } = await import("../src/lib/analytics/events");
    const def = q(`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'events_event_check' AND conrelid = 'analytics.events'::regclass`);
    const missing = ANALYTICS_EVENTS.filter((e) => !def.includes(`'${e}'`));
    check(missing.length === 0, `events: the final events_event_check allows every ANALYTICS_EVENTS entry (missing: ${missing.join(", ") || "none"})`);
  });

  await section("turnstile: sign-in email (server-sent)", async () => {
    // The sign-up screens send the sign-in email from the server (requestSignInEmailFn → POST /otp), so the phone's
    // token must reach Auth's captcha check through it.
    const mailTo = () => rest.mail.filter((m) => m.to === "kay@example.com").length;
    const send = (captchaToken: string | null, ip: string) =>
      call(accountFns.requestSignInEmailFn, { email: "kay@example.com", captchaToken }, tok["ian"]!, { "cf-connecting-ip": ip });
    const before = mailTo();
    const off = await send(null, "203.0.113.71");
    check(off.ok === true && mailTo() === before + 1, `sign-in: captcha off: sent without a token, as today (${JSON.stringify(off)})`);
    rest.auth.captchaSecret = TURNSTILE_TEST_SECRETS.pass;
    const none = await send(null, "203.0.113.72");
    check(none.ok === false && mailTo() === before + 1, "sign-in: captcha on, no token: Auth refuses, no email");
    const passed = await send("XXXX.DUMMY.TOKEN.XXXX", "203.0.113.73");
    check(passed.ok === true && mailTo() === before + 2, `sign-in: always-pass secret: the token reaches Auth, the email is sent (${JSON.stringify(passed)})`);
    rest.auth.captchaSecret = TURNSTILE_TEST_SECRETS.fail;
    const failed = await send("XXXX.DUMMY.TOKEN.XXXX", "203.0.113.74");
    check(failed.ok === false && mailTo() === before + 2, "sign-in: always-fail secret: refused, no email");
    rest.auth.captchaSecret = null;
  });

  /* ---------------------------------------------------------------- a room */
  const made = await call(duel.createRoomFn, { displayName: "Ana" }, tok["ana"]!);
  const roomId = made.roomId as string;
  const roomCode = made.roomCode as string;
  const players: [string, string][] = [["ben", "Ben"], ["cat", "Cat"], ["dan", "Dan"], ["eve", "Eve"], ["fin", "Fin"], ["gus", "Gus"], ["haz", "Haz"], ["mia", "Mia"]];
  for (const [key, name] of players) {
    const joined = await call(duel.joinRoomFn, { roomCode, displayName: name }, tok[key]!);
    check(joined.ok === true, `room: ${name} joins`);
  }
  const slotOf = (id: string) => Number(q(`SELECT player_slot FROM public.duel_players WHERE duel_id = '${roomId}' AND user_id = '${id}'`));

  await section("chat filter", async () => {
    const sent = await call(chat.sendRoomMessageFn, { roomId, text: "you bastard" }, tok["ben"]!);
    const stored = q(`SELECT text FROM public.room_messages WHERE duel_id = '${roomId}' AND sender_user_id = '${BEN}' ORDER BY created_at DESC LIMIT 1`);
    check(sent.ok === true && !/bastard/i.test(stored) && stored.startsWith("you "), `chat: the server's word filter runs on the message (${stored})`);
    check(/censorChat\(text\)/.test(readFileSync("src/lib/duel/chat.functions.ts", "utf8")) && (q(`SELECT count(*) FROM pg_policies WHERE tablename = 'room_messages' AND cmd IN ('INSERT', 'ALL') AND permissive = 'PERMISSIVE'`) === "0"), "chat: messages are written only by the server function, which filters every one");
  });

  /* ---------------------------------------------------------------- reports */
  const benMessage = q(`SELECT id FROM public.room_messages WHERE duel_id = '${roomId}' AND sender_user_id = '${BEN}' LIMIT 1`);
  await section("reports", async () => {
    const byMessage = await call(chat.reportMessageFn, { roomId, messageId: benMessage, reason: "abusive_chat" }, tok["cat"]!);
    check(byMessage.ok === true, "reports: a message report is filed");
    const row = q(`SELECT concat_ws('|', reported_user_id, reason, message_text, reported_name, counts, message_id) FROM public.room_reports WHERE reporter_user_id = '${CAT}'`);
    check(row === `${BEN}|abusive_chat|you *******|Ben|t|${benMessage}` || (row.startsWith(`${BEN}|abusive_chat|you `) && row.endsWith(`|Ben|t|${benMessage}`)), `reports: stored with its context (${row})`);
    check(!JSON.stringify(byMessage).includes(CAT) && !JSON.stringify(byMessage).includes(BEN), "reports: the answer names nobody");
    const byName = await call(chat.reportPlayerFn, { roomId, slot: slotOf(BEN), reason: "offensive_name" }, tok["dan"]!);
    check(byName.ok === true && q(`SELECT concat_ws('|', reported_user_id, reason, reported_name, counts, message_id IS NULL) FROM public.room_reports WHERE reporter_user_id = '${DAN}'`) === `${BEN}|offensive_name|Ben|t|t`, "reports: a name report is filed with the name at the time");
    const repeat = await call(chat.reportMessageFn, { roomId, messageId: benMessage, reason: "abusive_chat" }, tok["cat"]!);
    check(repeat.ok === true && q(`SELECT string_agg(counts::text, ',' ORDER BY created_at) FROM public.room_reports WHERE reporter_user_id = '${CAT}'`) === "true,false", "reports: a repeat the same day is stored but doesn't count");
    check(q(`SELECT count(*) FROM moderation.player_state WHERE user_id = '${BEN}' AND muted_until > now()`) === "0", "mute: two players aren't enough");
    const self = await call(chat.reportPlayerFn, { roomId, slot: slotOf(BEN), reason: "cheating" }, tok["ben"]!);
    check(self.ok === false && /yourself/.test(self.message), "reports: nobody reports themselves");
    const outsider = await call(chat.reportPlayerFn, { roomId, slot: slotOf(BEN), reason: "cheating" }, tok["ian"]!);
    check(outsider.ok === false && /not in this room/.test(outsider.message), "reports: an outsider can't report");
    const badReason = await call(chat.reportPlayerFn, { roomId, slot: slotOf(BEN), reason: "rude" }, tok["cat"]!);
    check(badReason.ok === false && /reason/.test(badReason.message), "reports: an unknown reason is refused");
    const noSlot = await call(chat.reportPlayerFn, { roomId, slot: 99, reason: "cheating" }, tok["cat"]!);
    check(noSlot.ok === false, "reports: a seat nobody holds can't be reported");
    // The reported player can't see reports, by any route.
    const benDb = createClient(rest.url, ANON_KEY, { global: { headers: { Authorization: `Bearer ${tok["ben"]}` } }, auth: { persistSession: false, autoRefreshToken: false, storage: undefined } });
    const peek = await benDb.from("room_reports").select("*");
    check(!!peek.error || (peek.data ?? []).length === 0, "reports: the reported player can't read reports");
    const notices = await call(safety.safetyStatusFn, null, tok["ben"]!);
    check(notices.ok === true && ![CAT, DAN].some((id) => JSON.stringify(notices).includes(id)), "reports: the reported player's notices never name a reporter");
    // Report events: the reason only.
    const sent = await events("report_sent");
    check(sent.split(";").length === 3 && sent.split(";").every((e) => /^\{"reason": "(abusive_chat|offensive_name)"\}\|/.test(e)) && !/bastard|\*\*\*/.test(sent), `analytics: report_sent carries the reason only (${sent})`);
  });

  await section("automatic mute", async () => {
    const third = await call(chat.reportPlayerFn, { roomId, slot: slotOf(BEN), reason: "abusive_chat" }, tok["eve"]!);
    check(third.ok === true && q(`SELECT muted_until > now() + interval '23 hours 59 minutes' FROM moderation.player_state WHERE user_id = '${BEN}'`) === "t", "mute: three different players within 24 hours mute for 24 hours");
    check(q(`SELECT concat_ws('|', action, by_role) FROM moderation.actions WHERE user_id = '${BEN}' AND action = 'auto_mute'`) === "auto_mute|system", "mute: logged as the system's");
    check((await events("chat_muted")).endsWith(`|${BEN}`), "analytics: chat_muted recorded");
    pastGap();
    const blocked = await call(chat.sendRoomMessageFn, { roomId, text: "hello again" }, tok["ben"]!);
    check(blocked.ok === false && blocked.message === CHAT_MUTED_MESSAGE, "mute: the muted player's message refused with the plain notice");
    const { ROOM_EMOJI } = await import("../src/lib/duel/chatConstants");
    const reaction = await call(chat.allowReactionFn, { roomId, emoji: ROOM_EMOJI[0] }, tok["ben"]!);
    check(reaction.ok === false && reaction.message === CHAT_MUTED_MESSAGE, "mute: reactions refused too");
    const others = await call(chat.sendRoomMessageFn, { roomId, text: "hi all" }, tok["cat"]!);
    check(others.ok === true, "mute: other players chat as before");
    // 24 hours later.
    q(`UPDATE moderation.player_state SET muted_until = now() - interval '1 second', muted_at = now() - interval '24 hours 1 second' WHERE user_id = '${BEN}'`);
    pastGap();
    const after = await call(chat.sendRoomMessageFn, { roomId, text: "back" }, tok["ben"]!);
    check(after.ok === true, "mute: lifts after 24 hours");

    // One player three times: no mute.
    for (let i = 0; i < 3; i++) await call(chat.reportPlayerFn, { roomId, slot: slotOf(EVE), reason: "abusive_chat" }, tok["cat"]!);
    check(q(`SELECT count(*) FROM moderation.player_state WHERE user_id = '${EVE}' AND muted_until > now()`) === "0" && q(`SELECT count(*) FILTER (WHERE counts) FROM public.room_reports WHERE reported_user_id = '${EVE}'`) === "1", "mute: one player three times isn't a mute (one counts)");
    // Reports older than 24 hours don't add up.
    q(`UPDATE public.room_reports SET created_at = now() - interval '25 hours' WHERE reported_user_id = '${EVE}'`);
    await call(chat.reportPlayerFn, { roomId, slot: slotOf(EVE), reason: "abusive_chat" }, tok["dan"]!);
    await call(chat.reportPlayerFn, { roomId, slot: slotOf(EVE), reason: "abusive_chat" }, tok["fin"]!);
    check(q(`SELECT count(*) FROM moderation.player_state WHERE user_id = '${EVE}' AND muted_until > now()`) === "0", "mute: three players, but not within 24 hours: no mute");
    // Cheating reports never mute.
    for (const key of ["cat", "dan", "eve"]) await call(chat.reportPlayerFn, { roomId, slot: slotOf(GUS), reason: "cheating" }, tok[key]!);
    check(q(`SELECT count(*) FROM moderation.player_state WHERE user_id = '${GUS}' AND muted_until > now()`) === "0", "mute: cheating reports don't mute chat");
    // Unmute early.
    for (const key of ["ana", "cat", "dan"]) await call(chat.reportPlayerFn, { roomId, slot: slotOf(FIN), reason: "offensive_name" }, tok[key]!);
    check(q(`SELECT muted_until > now() FROM moderation.player_state WHERE user_id = '${FIN}'`) === "t", "mute: offensive-name reports from three players mute too");
    q(`SELECT moderation.unmute('${FIN}')`);
    pastGap();
    const unmuted = await call(chat.sendRoomMessageFn, { roomId, text: "sorry" }, tok["fin"]!);
    check(unmuted.ok === true && q(`SELECT count(*) FROM moderation.actions WHERE user_id = '${FIN}' AND action = 'unmute'`) === "1", "unmute: lifts the mute early, logged");
    await call(chat.reportPlayerFn, { roomId, slot: slotOf(FIN), reason: "offensive_name" }, tok["eve"]!);
    check(q(`SELECT muted_until IS NULL FROM moderation.player_state WHERE user_id = '${FIN}'`) === "t", "unmute: reports from before the lift don't re-mute with one more");
  });

  await section("report queue", async () => {
    const top = q(`SELECT concat_ws('|', user_id, name, has_account, players_reporting, reports, status, muted_until IS NOT NULL) FROM moderation.report_queue LIMIT 1`);
    check(top.startsWith(`${FIN}|Fin|f|4|4|open|f`), `queue: newest first, grouped by player, the name, reporters, open (${top})`);
    const ben = q(`SELECT concat_ws('|', array_to_string(reasons, ','), players_reporting, reports, array_length(messages, 1)) FROM moderation.report_queue WHERE user_id = '${BEN}'`);
    check(ben === "abusive_chat,offensive_name|3|4|2", `queue: reasons, players, reports and the message text (${ben})`);
    check(q(`SELECT count(*) FROM moderation.report_queue`) === "4", "queue: one row per reported player");
  });

  /* ---------------------------------------------------------------- Joe's functions */
  q(`UPDATE auth.users SET is_anonymous = false, email = 'haz@example.com' WHERE id = '${HAZ}'`);
  const hazMade = await call(accountFns.completeSignUpFn, { username: "HazHaz", dateOfBirth: "1990-02-03", colour: 5 }, accountToken(HAZ));
  check(hazMade.username === "HazHaz", "setup: Haz has an account");
  const hazTok = accountToken(HAZ);

  await section("warn", async () => {
    check(/next open/.test(q(`SELECT moderation.warn('hazhaz', 'Keep chat friendly, please.')`)), "warn: by username, any capitals");
    const first = await call(safety.safetyStatusFn, null, hazTok);
    check(first.warning === "Keep chat friendly, please.", "warn: shown on the next open");
    check(q(`SELECT status FROM public.profiles WHERE user_id = '${HAZ}'`) === "warned", "warn: the account's status reads warned");
    const ack = await call(safety.ackWarningFn, null, hazTok);
    const second = await call(safety.safetyStatusFn, null, hazTok);
    check(ack.ok === true && second.warning === null, "warn: once only");
    check(q(`SELECT string_agg(action, ',' ORDER BY id) FROM moderation.actions WHERE user_id = '${HAZ}'`) === "warn,warning_seen", "warn: logged, and its being seen");
  });

  await section("force rename", async () => {
    q(`SELECT moderation.force_rename('HazHaz')`);
    const before = q(`SELECT concat_ws('|', username_changed_at IS NULL, free_change_used) FROM public.profiles WHERE user_id = '${HAZ}'`);
    const opened = await call(safety.safetyStatusFn, null, hazTok);
    const temp = q(`SELECT username FROM public.profiles WHERE user_id = '${HAZ}'`);
    const { ENERGY_ADJECTIVES, ENERGY_NOUNS } = await import("../src/lib/names/energyWords");
    check(opened.rename?.kind === "account" && opened.rename.tempName === temp && temp !== "HazHaz" && ENERGY_ADJECTIVES.some((a) => temp.startsWith(a)) && ENERGY_NOUNS.some((n) => temp.includes(n)), `force rename: a temporary energy name at once on open (${temp})`);
    check(q(`SELECT concat_ws('|', username_changed_at IS NULL, free_change_used) FROM public.profiles WHERE user_id = '${HAZ}'`) === before, "force rename: doesn't count towards the change limit");
    const again = await call(safety.safetyStatusFn, null, hazTok);
    check(again.rename?.tempName === temp && q(`SELECT username FROM public.profiles WHERE user_id = '${HAZ}'`) === temp, "force rename: the temporary name is given once; the pick stays pending");
    const rude = await call(safety.pickForcedNameFn, { name: "bastard99" }, hazTok);
    check(rude.ok === false, "force rename: the new name goes through the names module (an offensive one refused)");
    const reserved = await call(safety.pickForcedNameFn, { name: "JoulzAdmin" }, hazTok);
    check(reserved.ok === false, "force rename: reserved names refused");
    const picked = await call(safety.pickForcedNameFn, { name: "HazelNut" }, hazTok);
    check(picked.ok === true && q(`SELECT username FROM public.profiles WHERE user_id = '${HAZ}'`) === "HazelNut", "force rename: the player's pick is their username");
    check(q(`SELECT concat_ws('|', username_changed_at IS NULL, free_change_used) FROM public.profiles WHERE user_id = '${HAZ}'`) === before, "force rename: the pick doesn't count towards the change limit either");
    const done = await call(safety.safetyStatusFn, null, hazTok);
    check(done.rename === null, "force rename: done once picked");
    check(q(`SELECT string_agg(action, ',' ORDER BY id) FROM moderation.actions WHERE user_id = '${HAZ}' AND action LIKE '%rename%'`) === "force_rename,rename_temp_name,rename_done", "force rename: logged");
    // A guest.
    q(`SELECT moderation.force_rename('${MIA}')`);
    const guest = await call(safety.safetyStatusFn, null, tok["mia"]!);
    check(guest.rename?.kind === "guest" && typeof guest.rename.tempName === "string" && / \d+$/.test(guest.rename.tempName), "force rename: a guest gets a temporary energy room name");
    const guestPick = await call(safety.pickForcedNameFn, { name: "Mia M" }, tok["mia"]!);
    check(guestPick.ok === true && guestPick.name === "Mia M" && (await call(safety.safetyStatusFn, null, tok["mia"]!)).rename === null, "force rename: a guest picks a new room name, checked by the names module");
  });

  await section("ban", async () => {
    check(/banned until/.test(q(`SELECT moderation.ban('${JAY}', 7)`)), "ban: for 7 days");
    const create = await rejects(call(duel.createRoomFn, { displayName: "Jay" }, tok["jay"]!), /support@joulz\.uk/);
    check(create, "ban: can't make a room (the notice names support@joulz.uk)");
    const join = await call(duel.joinRoomFn, { roomCode, displayName: "Jay" }, tok["jay"]!);
    check(join.ok === false && join.message === BANNED_MESSAGE, "ban: can't join a room");
    const notices = await call(safety.safetyStatusFn, null, tok["jay"]!);
    check(notices.banned === true && notices.bannedMessage === BANNED_MESSAGE && !!notices.bannedUntil, "ban: the notice on open");
    const deal = await call(practice.practiceGenerateFn, { type: "reaction" }, tok["jay"]!);
    check(!!deal?.puzzle && !!deal.sealed, "ban: Practice still deals");
    // A banned player already in a room can't chat.
    q(`SELECT moderation.ban('${GUS}', NULL)`);
    pastGap();
    const gusChat = await call(chat.sendRoomMessageFn, { roomId, text: "hi" }, tok["gus"]!);
    check(gusChat.ok === false && gusChat.message === BANNED_MESSAGE, "ban: can't chat");
    check(q(`SELECT banned_until = 'infinity' FROM moderation.player_state WHERE user_id = '${GUS}'`) === "t" && (await call(safety.safetyStatusFn, null, tok["gus"]!)).banned === true, "ban: NULL is permanent");
    const banProfile = q(`SELECT moderation.ban('HazelNut', 1)`);
    check(/banned/.test(banProfile) && q(`SELECT status FROM public.profiles WHERE user_id = '${HAZ}'`) === "banned", "ban: an account's status reads banned");
    check(/no longer banned/.test(q(`SELECT moderation.unban('HazelNut')`)) && q(`SELECT status FROM public.profiles WHERE user_id = '${HAZ}'`) === "active", "unban: by username, the status active again");
    q(`SELECT moderation.unban('${JAY}')`);
    const rejoin = await call(duel.joinRoomFn, { roomCode, displayName: "Jay" }, tok["jay"]!);
    check(rejoin.ok === true, "unban: can join again");
    check(db.psql(`SELECT moderation.ban('${JAY}', 0)`).ok === false && db.psql(`SELECT moderation.ban('nobody_at_all', 3)`).ok === false, "ban: bad days and unknown players refused");
  });

  await section("resolve", async () => {
    const reportId = q(`SELECT id FROM public.room_reports WHERE reported_user_id = '${GUS}' ORDER BY created_at LIMIT 1`);
    check(q(`SELECT moderation.resolve('${reportId}')`) === "report resolved" && q(`SELECT resolved_at IS NOT NULL FROM public.room_reports WHERE id = '${reportId}'`) === "t", "resolve: one report by its id");
    check(q(`SELECT status FROM moderation.report_queue WHERE user_id = '${GUS}'`) === "open", "resolve: the player's other reports stay open");
    check(/2 open report/.test(q(`SELECT moderation.resolve('${GUS}', 'banned')`)) && q(`SELECT status FROM moderation.report_queue WHERE user_id = '${GUS}'`) === "resolved", "resolve: every open report about a player");
  });

  await section("action log", async () => {
    const actions = q(`SELECT string_agg(DISTINCT action, ',' ORDER BY action) FROM moderation.actions`);
    check(["auto_mute", "ban", "force_rename", "rename_done", "rename_temp_name", "resolve", "unban", "unmute", "warn", "warning_seen"].every((a) => actions.split(",").includes(a)), `log: every action (${actions})`);
    check(q(`SELECT count(*) FROM moderation.actions WHERE at IS NULL OR by_role IS NULL OR action IS NULL`) === "0" && q(`SELECT DISTINCT by_role FROM moderation.actions WHERE action = 'ban'`) === "postgres", "log: who, what and when (Joe's calls as the dashboard's role)");
    const ev = await events("moderation_action");
    // The new-guest hook's warning lines are not moderation actions (no event).
    const logged = Number(q(`SELECT count(*) FROM moderation.actions WHERE action <> 'guest_limit_warning'`));
    check(ev.split(";").length === logged && ev.split(";").every((e) => /^\{"type": "[a-z_]+"\}\|$/.test(e)), `analytics: moderation_action, the type only, one per action (${ev.split(";").length} of ${logged})`);
  });

  /* ---------------------------------------------------------------- reachability */
  await section("unreachable", async () => {
    for (const role of ["anon", "authenticated"]) {
      check(/permission denied/.test(asRole(role, `SELECT * FROM moderation.player_state`)), `schema: ${role} can't read moderation.player_state`);
      check(/permission denied/.test(asRole(role, `SELECT * FROM moderation.actions`)), `schema: ${role} can't read moderation.actions`);
      check(/permission denied/.test(asRole(role, `SELECT * FROM moderation.report_queue`)), `schema: ${role} can't read the report queue`);
      check(/permission denied/.test(asRole(role, `SELECT moderation.ban('${BEN}', 1)`)), `schema: ${role} can't ban`);
      check(/permission denied/.test(asRole(role, `SELECT public.moderation_status('${BEN}')`)), `functions: ${role} can't read a player's status`);
      check(/permission denied/.test(asRole(role, `SELECT public.file_room_report('${roomId}', NULL, '${BEN}', '${CAT}', 'cheating', NULL, NULL)`)), `functions: ${role} can't file reports directly`);
      check(/permission denied/.test(asRole(role, `SELECT public.moderation_ack('${BEN}', 'warning')`)), `functions: ${role} can't clear a notice`);
      check(/permission denied/.test(asRole(role, `SELECT * FROM public.room_reports`)), `reports: ${role} can't read reports`);
      check(/permission denied/.test(asRole(role, `SELECT public.before_user_created_guest_limit('{}'::jsonb)`)), `hook: ${role} can't call it`);
    }
    check(/permission denied/.test(asRole("service_role", `SELECT * FROM moderation.player_state`)) && /permission denied/.test(asRole("service_role", `SELECT moderation.unban('${GUS}')`)), "schema: even the service role has nothing in moderation (only the three public functions)");
    const api = await createClient(rest.url, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } }).rpc("moderation_status", { p_user_id: BEN });
    check(!!api.error, "API: anon's rpc to moderation_status refused");
  });

  /* ---------------------------------------------------------------- retention */
  await section("retention", async () => {
    const oldPlain = q(`INSERT INTO public.room_messages (duel_id, sender_user_id, sender_name, text, created_at) VALUES ('${roomId}', '${CAT}', 'Cat', 'old', now() - interval '91 days') RETURNING id`).split("\n")[0]!;
    const oldReported = q(`INSERT INTO public.room_messages (duel_id, sender_user_id, sender_name, text, created_at) VALUES ('${roomId}', '${BEN}', 'Ben', 'old rude', now() - interval '91 days') RETURNING id`).split("\n")[0]!;
    const recent = q(`INSERT INTO public.room_messages (duel_id, sender_user_id, sender_name, text, created_at) VALUES ('${roomId}', '${CAT}', 'Cat', 'recent', now() - interval '89 days') RETURNING id`).split("\n")[0]!;
    q(`SELECT public.file_room_report('${roomId}', '${oldReported}', '${DAN}', '${BEN}', 'abusive_chat', 'old rude', 'Ben')`);
    const oldReport = q(`SELECT (public.file_room_report('${roomId}', NULL, '${ANA}', '${CAT}', 'cheating', NULL, 'Cat') ->> 'id')`);
    q(`UPDATE public.room_reports SET created_at = now() - interval '2 years 1 day' WHERE id = '${oldReport}'`);
    q(`INSERT INTO moderation.actions (action, at, by_role) VALUES ('old_line', now() - interval '2 years 1 day', 'postgres')`);
    const out = q(`SELECT moderation.run_retention()::text`);
    const exists = (id: string) => q(`SELECT count(*) FROM public.room_messages WHERE id = '${id}'`) === "1";
    check(!exists(oldPlain) && exists(oldReported) && exists(recent), `retention: chat older than 90 days deleted, a reported one kept (${out})`);
    check(q(`SELECT count(*) FROM public.room_reports WHERE id = '${oldReport}'`) === "0" && q(`SELECT count(*) FROM moderation.actions WHERE action = 'old_line'`) === "0", "retention: reports and actions deleted after 2 years");
    check(q(`SELECT count(*) FROM moderation.actions WHERE action = 'retention' AND by_role = 'system'`) === "1", "retention: one log line a run");
    check(q(`SELECT detail::text FROM moderation.actions WHERE action = 'retention'`) === out, "retention: the line holds the run's counts");
    const quiet = q(`SELECT moderation.run_retention()::text`);
    check(
      quiet === '{"actions": 0, "reports": 0, "messages": 0}' &&
        q(`SELECT count(*) FROM moderation.actions WHERE action = 'retention'`) === "2" &&
        q(`SELECT detail::text FROM moderation.actions WHERE action = 'retention' ORDER BY id DESC LIMIT 1`) === quiet,
      `retention: a run with nothing to delete still writes its line, zeros included (${quiet})`,
    );
    const sql = readFileSync("supabase/migrations/20261110150100_chat_retention.sql", "utf8");
    check(/cron\.schedule\('chat-retention', '17 4 \* \* \*'/.test(sql) && /migration_log\.note\('warning'/.test(sql), "retention: scheduled daily by pg_cron, warnings through migration_log.note");
  });

  await section("a removed user", async () => {
    q(`SELECT accounts.forget_user('${BEN}')`);
    check(q(`SELECT count(*) FROM public.room_reports WHERE reported_user_id = '${BEN}'`) === "0" && q(`SELECT count(*) FROM public.room_reports WHERE message_text LIKE 'old rude'`) === "1", "forget: reports about a removed user keep their content on a fresh id");
    check(q(`SELECT count(*) FROM moderation.player_state WHERE user_id = '${BEN}'`) === "0" && q(`SELECT count(*) FROM moderation.actions WHERE user_id = '${BEN}'`) === "0", "forget: their state row goes, their action lines re-keyed");
  });
}
