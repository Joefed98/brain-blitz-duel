/**
 * push-testers-check (wave 2 B2 follow-up, 11 Nov 2026; docs/push-notifications.md "Testers first"): phone
 * notifications with the real key set (PUSH_PUBLIC_KEY in src/config/pushConfig.ts) are for the testers only while
 * PUSH_FOR_EVERYONE is false (Joe, 11 Nov 2026: player numbers #0001 and #0002).
 *
 * What it proves:
 *  1. The shipped settings: the key is set and well formed, PUSH_FOR_EVERYONE is false, the testers are [1, 2], and
 *     `pushForPlayer` answers yes for #1 and #2 only, never for a guest; with everyone on, every account and still no
 *     guest.
 *  2. The phone (happy-dom, the real components): a tester gets the ask (a useful moment marks it due, the tab page's
 *     slot draws it) and Settings → Notifications; a non-tester (#3) and a guest get neither, and their useful moments
 *     store nothing; a non-tester's open touches nothing.
 *  3. The server (the real server functions and migrations on a local PostgreSQL 16 with the server-function harness):
 *     testers #1 and #2 can save a subscription; #3 is refused ("not_in_audience") and a guest ("no_account"), nothing
 *     stored; sending (each event, B1's friend events through the sweep, the evening reminder on a real Daily
 *     streak) reaches only testers' subscriptions, even a device of #3's put into the table by hand; nothing in src/
 *     calls the checks-only `setPushAudienceForChecks` or `setVapidPublicKeyForChecks`.
 *
 * The check's own key pair stands in for the push service's verification; the real private key is never read.
 * Needs the PostgreSQL 16 binaries for part 3 (preinstalled on GitHub's runners); without them it fails on CI and
 * prints a NOTE locally.
 */
import { execSync } from "node:child_process";
import { createECDH, randomBytes } from "node:crypto";

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
const quietLog = console.log;
const check = (ok: boolean, label: string): void => {
  if (ok) passes++;
  else {
    failures.push(label);
    quietLog(`  FAIL ${label}`);
  }
};
async function section(name: string, body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } catch (err) {
    check(false, `${name}: threw ${err instanceof Error ? (err.stack ?? err.message).split("\n").slice(0, 4).join(" | ") : String(err)}`);
  }
}
console.log = () => {};
console.warn = () => {};
console.error = () => {};
const restore = () => {
  console.log = quietLog;
};

// The server functions must be loaded through the harness's plugin, and the phone part's panel loads them first.
await installServerFnPlugin();

/* =================================================================== 1. the shipped settings */

const config = await import("../src/config/pushConfig");

await section("settings", async () => {
  const key = config.PUSH_PUBLIC_KEY;
  const raw = Buffer.from(key, "base64url");
  check(/^[A-Za-z0-9_-]{87}$/.test(key) && raw.length === 65 && raw[0] === 4, "the public key is set: 87 base64url characters, an uncompressed P-256 point");
  check(config.PUSH_FOR_EVERYONE === false, "notifications are for testers only (PUSH_FOR_EVERYONE false)");
  check(JSON.stringify(config.PUSH_TESTERS) === "[1,2]", `the testers are #0001 and #0002 (${JSON.stringify(config.PUSH_TESTERS)})`);
  const p = config.pushForPlayer;
  check(p(1) && p(2), "#1 and #2 are in the audience");
  check(!p(3) && !p(42) && !p(0) && !p(-1) && !p(1.5), "every other player number is not");
  check(!p(null) && !p(undefined), "a guest (no player number) is not");
  const all = { everyone: true, testers: [] as number[] };
  check(p(3, all) && p(42, all) && p(1, all), "opened to everyone: every account");
  check(!p(null, all) && !p(undefined, all), "opened to everyone: still never a guest");
  const src = execSync(`cat src/config/pushConfig.ts`).toString();
  check(/To open notifications to every account: set PUSH_FOR_EVERYONE to true/.test(src), "pushConfig.ts says how to open it to everyone");
});

/* =================================================================== 2. the phone */

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const view = (n: number) => ({
  kind: "account" as const,
  userId: uid(900 + n),
  username: `Tester_${n}`,
  colour: n % 32,
  playerNumber: n,
  founding: true,
  country: null,
  createdAt: new Date().toISOString(),
  status: "active",
  isUnder18: false,
});

await section("phone", async () => {
  const { Window } = await import("happy-dom");
  const win = new Window({ url: "https://joulz.uk/", width: 390, height: 844 });
  for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "MouseEvent", "HTMLButtonElement", "SVGElement", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame", "localStorage", "sessionStorage", "MutationObserver", "CustomEvent", "location", "history"] as const) {
    const value = (win as unknown as Record<string, unknown>)[key];
    const bind = typeof value === "function" && !/^[A-Z]/.test(key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: bind ? (value as (...a: unknown[]) => unknown).bind(win) : value });
  }
  // An Android phone that can receive: a service worker, PushManager and the browser's Notification.
  Object.defineProperty(win.navigator, "userAgent", { configurable: true, value: "Mozilla/5.0 (Linux; Android 14) Chrome/130" });
  Object.defineProperty(win.navigator, "serviceWorker", { configurable: true, value: { getRegistration: async () => undefined, ready: new Promise(() => {}) } });
  const w = win as unknown as Record<string, unknown>;
  w["PushManager"] = function PushManager() {};
  w["Notification"] = { permission: "default" };
  (globalThis as Record<string, unknown>)["Notification"] = w["Notification"];
  // Under bun the shipped key would be read as it is; set as the browser checks do, it is the same key.
  w["__DUELZ_PUSH_PUBLIC_KEY__"] = config.PUSH_PUBLIC_KEY;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  const React = await import("react");
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const accountApi = await import("../src/lib/account/accountApi");
  const client = await import("../src/lib/push/pushClient");
  const { NotificationAskSlot } = await import("../src/components/push/NotificationAskSlot");
  const { NotificationSettings } = await import("../src/components/push/NotificationSettings");

  const record = () => localStorage.getItem("duelz-push:v1");
  const draw = async () => {
    document.body.innerHTML = "";
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host as unknown as Element);
    await act(async () => {
      root.render(
        <>
          <NotificationAskSlot />
          <NotificationSettings />
        </>,
      );
    });
    await act(async () => void (await new Promise((r) => setTimeout(r, 50))));
    const out = {
      ask: document.querySelector("[data-push-ask]") !== null,
      panel: document.querySelector("[data-push-settings]") !== null,
    };
    await act(async () => root.unmount());
    return out;
  };

  // A guest: the account state answered as a guest, no player number.
  localStorage.clear();
  client.notePushMoment("friend_request_sent", null);
  client.notePushMoment("daily_finished", null);
  check(record() === null && client.pendingAsk() === null, "a guest's useful moments mark nothing and store nothing");
  await accountApi.refreshAccount(); // no session in this page: a guest
  check(accountApi.accountNow().kind === "guest", "the page is a guest's");
  localStorage.setItem("duelz-push:v1", JSON.stringify({ pending: "friend_request_sent" })); // even with an ask stored
  const guest = await draw();
  check(!guest.ask && !guest.panel, `a guest gets neither the ask nor Settings → Notifications (${JSON.stringify(guest)})`);

  // A non-tester account (#3).
  localStorage.clear();
  accountApi.setAccount(view(3), "three@example.com");
  client.notePushMoment("friend_request_sent", 3);
  client.notePushMoment("daily_finished", 3);
  check(record() === null && client.pendingAsk() === null, "a non-tester's (#3) useful moments mark nothing and store nothing");
  await client.syncPushOnOpen(3);
  check(record() === null, "a non-tester's open touches nothing");
  localStorage.setItem("duelz-push:v1", JSON.stringify({ pending: "friend_request_sent" }));
  const other = await draw();
  check(!other.ask && !other.panel, `a non-tester (#3) gets neither the ask nor Settings → Notifications, even with an ask stored (${JSON.stringify(other)})`);

  // A tester (#1, then #2).
  for (const n of [1, 2]) {
    localStorage.clear();
    accountApi.setAccount(view(n), `tester${n}@example.com`);
    client.notePushMoment("friend_request_sent", n);
    check(client.pendingAsk() === "friend_request_sent", `a tester's (#${n}) useful moment marks the ask due`);
    const tester = await draw();
    check(tester.ask && tester.panel, `a tester (#${n}) gets the ask on the tab page and Settings → Notifications (${JSON.stringify(tester)})`);
  }
  localStorage.clear();
  // The server part runs as a server: no browser globals left behind.
  for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "MouseEvent", "HTMLButtonElement", "SVGElement", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame", "localStorage", "sessionStorage", "MutationObserver", "CustomEvent", "location", "history", "Notification"])
    delete (globalThis as Record<string, unknown>)[key];
  await win.happyDOM.abort();
  win.close();
});

/* =================================================================== 3. the server */

const b64u = (b: Uint8Array | Buffer) => Buffer.from(b).toString("base64url");
interface Device {
  endpoint: string;
  p256dh: string;
  auth: string;
}
const makeDevice = (name: string): Device => {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return { endpoint: `https://fcm.googleapis.com/fcm/send/${name}-${randomBytes(6).toString("hex")}`, p256dh: b64u(ecdh.getPublicKey()), auth: b64u(randomBytes(16)) };
};

const VIC = uid(61); // becomes #1
const TOM = uid(62); // #2
const UNA = uid(63); // #3
const WES = uid(64); // #4
const GUEST = uid(65);
const ACCOUNTS = { TOM, UNA, WES, VIC };

async function serverChecks(db: LocalDb): Promise<void> {
  const fns = await import("../src/lib/push/push.functions");
  const notify = { ...(await import("../src/lib/push/notify.server")), ...(await import("../src/lib/push/streakReminder.server")) };
  const web = await import("../src/lib/push/webPush.server");
  const { adminDb } = await import("../src/lib/data/db.server");
  const admin = await adminDb();
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };

  // Profiles in this order take #2, #3, #4 and #5; then VIC is made #0001 as Joe's own account was.
  for (const [name, id] of Object.entries(ACCOUNTS))
    q(`SELECT public.create_profile('${id}', '${name.charAt(0)}${name.slice(1).toLowerCase()}_Test', 3::smallint, DATE '1990-01-01', NULL)`);
  q(`SELECT accounts.admin_assign_player_one('vic_test')`);
  const num = (id: string) => Number(q(`SELECT player_number FROM profiles WHERE user_id = '${id}'`));
  check(num(VIC) === 1 && num(TOM) === 2 && num(UNA) === 3 && num(WES) === 4, `player numbers VIC #1, TOM #2, UNA #3, WES #4 (${[VIC, TOM, UNA, WES].map(num).join(",")})`);

  // The server's switch on with this check's own pair (never the real private key): the public half comes from
  // pushConfig.ts, so the check's pair is handed to each send, and the private half in the environment only switches
  // the server on (its value is this check's).
  const pair = await web.generateP256();
  const keys = { publicKey: b64u(pair.publicPoint), privateKey: b64u(pair.d) };
  process.env["VAPID_PRIVATE_KEY"] = keys.privateKey;
  const delivered: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    delivered.push(String(input));
    return new Response(null, { status: 201 });
  }) as typeof fetch;
  const clock = Date.UTC(2026, 10, 11, 12);
  const opts = { keys, nowMs: clock, fetchImpl };
  const subs = (id: string) => Number(q(`SELECT count(*) FROM push_subscriptions WHERE user_id = '${id}'`));
  const devices: Record<string, Device> = {};
  const register = async (id: string, token: string, name: string) => {
    const d = makeDevice(name);
    devices[name] = d;
    return callServerFn(fns.savePushSubscriptionFn, { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth }, timeZone: "Europe/London" }, token);
  };

  await section("subscriptions", async () => {
    const v = await register(VIC, accountToken(VIC), "vic");
    const t = await register(TOM, accountToken(TOM), "tom");
    check(v?.ok === true && t?.ok === true && subs(VIC) === 1 && subs(TOM) === 1, "testers #1 and #2 save their phone's subscription");
    const u = await register(UNA, accountToken(UNA), "una");
    check(u?.ok === false && u.reason === "not_in_audience" && subs(UNA) === 0, `a non-tester (#3) is refused, nothing stored (${JSON.stringify(u)})`);
    const g = await register(GUEST, userToken(GUEST), "guest");
    check(g?.ok === false && g.reason === "no_account" && subs(GUEST) === 0, `a guest is refused, nothing stored (${JSON.stringify(g)})`);
  });

  await section("sending", async () => {
    // A device of #3's put into the table by hand (as if stored some other way): still never sent to.
    const una = makeDevice("una-by-hand");
    devices["una-by-hand"] = una;
    q(`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ('${UNA}', '${una.endpoint}', '${una.p256dh}', '${una.auth}')`);
    const toVic = await notify.notifyFriendRequest(admin, VIC, "Tom_Test", opts);
    const toTom = await notify.notifyFriendChallenge(admin, TOM, "Vic_Test", "ABCDEF", opts);
    const toUna = await notify.notifyFriendRequest(admin, UNA, "Vic_Test", opts);
    const toUnaInvite = await notify.notifyRoomInvite(admin, UNA, "Vic_Test", "BLTZ", opts);
    const toWes = await notify.notifyFriendAccepted(admin, WES, "Vic_Test", opts);
    check(toVic === "sent" && toTom === "sent", `the testers' notifications are sent (${toVic}, ${toTom})`);
    check(toUna === "not_in_audience" && toUnaInvite === "not_in_audience", `a non-tester's are not, even with a device stored (${toUna}, ${toUnaInvite})`);
    check(toWes === "no_device", `a non-tester with no device: nothing (${toWes})`);
    // B1's friend events through the sweep.
    // Changed with Joe's approval, 13 Nov 2026: the events are stamped with the scenario's clock, not the database's now() (this line and the AS v line).
    q(`INSERT INTO friend_events (recipient_id, actor_id, kind, payload, created_at) SELECT r::uuid, a::uuid, k, p::jsonb, to_timestamp(${clock / 1000}) FROM (VALUES
         ('${UNA}', '${VIC}', 'friend_request_received', '{}'),
         ('${TOM}', '${UNA}', 'friend_request_received', '{}'),
         ('${UNA}', '${TOM}', 'room_invite_received', '{"code":"BLTZ"}')) AS v(r, a, k, p)`);
    const sweep = await notify.dispatchFriendEvents(admin, opts);
    check(sweep.claimed === 3 && sweep.outcomes.sent === 1 && sweep.outcomes.not_in_audience === 2, `the sweep sends the tester's event only (${JSON.stringify(sweep)})`);
    // The evening reminder: #3 played yesterday's Daily (the candidates' rule), never reminded.
    const testersOnly = new Set([devices["vic"]!.endpoint, devices["tom"]!.endpoint]);
    check(delivered.length === 3 && delivered.every((e) => testersOnly.has(e)), `every push went to a tester's phone (${delivered.length} pushes)`);
    check(!delivered.includes(una.endpoint), "nothing ever reached #3's device");
    const logged = q(`SELECT string_agg(DISTINCT user_id::text, ',') FROM notification_log`);
    check(logged.split(",").every((id) => id === VIC || id === TOM), "only testers have anything in the send log");
  });

  await section("streak reminder", async () => {
    // VIC (#1) and UNA (#3, her hand-made device still in the table) both played yesterday's Daily and not today's.
    const room = q(`INSERT INTO async_rooms (kind, room_key, day, seed, round_count, opens_at, closes_at) VALUES ('daily_puzzle', 'daily_puzzle:2026-11-10', DATE '2026-11-10', 1, 3, TIMESTAMPTZ '2026-11-10 00:00Z', TIMESTAMPTZ '2026-11-11 00:00Z') RETURNING id`).split("\n")[0]!.trim();
    for (const who of [VIC, UNA]) q(`INSERT INTO async_attempts (room_id, user_id, display_name) VALUES ('${room}', '${who}', 'P')`);
    const before = delivered.length;
    const run = await notify.runDailyStreakReminders(admin, { ...opts, nowMs: Date.UTC(2026, 10, 11, 19, 41) });
    const sent = delivered.slice(before);
    const reminded = q(`SELECT coalesce(string_agg(user_id::text, ','), '') FROM notification_log WHERE event = 'daily_streak'`);
    check(run.candidates === 2 && run.outcomes.sent === 1 && run.outcomes.not_in_audience === 1, `both are candidates; only the tester is reminded (${JSON.stringify(run)})`);
    check(sent.length === 1 && sent[0] === devices["vic"]!.endpoint && reminded === VIC, `the reminder reaches only the tester's phone (${sent.length} sent, logged ${reminded})`);
  });

  await section("no override in the app", async () => {
    const callers = execSync(`grep -rln "setPushAudienceForChecks" src || true`).toString().trim().split("\n").filter(Boolean);
    check(callers.join() === "src/lib/push/audience.server.ts", `nothing in src/ but its own module names setPushAudienceForChecks (${callers.join(" ")})`);
    const keyCallers = execSync(`grep -rln "setVapidPublicKeyForChecks" src || true`).toString().trim().split("\n").filter(Boolean);
    check(keyCallers.join() === "src/lib/push/webPush.server.ts", `nothing in src/ but its own module names setVapidPublicKeyForChecks (${keyCallers.join(" ")})`);
  });
  delete process.env["VAPID_PRIVATE_KEY"];
}

let db: LocalDb | null = null;
let rest: RestServer | null = null;
if (!postgresBin()) {
  restore();
  if (process.env["CI"]) {
    console.log(`push-testers-check: ${passes} passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL`);
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: the server part not run (CI runs it)");
} else {
  try {
    db = startLocalDb("push-testers-");
    check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
    rest = await startRestServer(db.socketDir);
    process.env["SUPABASE_URL"] = rest.url;
    process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
    const people = Object.values(ACCOUNTS).map((id) => `('${id}', false, '${id.slice(-4)}@example.com')`).join(", ");
    db.psql(`INSERT INTO auth.users (id, is_anonymous, email) VALUES ${people}, ('${GUEST}', true, NULL)`);
    await serverChecks(db);
  } catch (err) {
    check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await rest?.stop();
    db?.stop();
  }
}

restore();
console.log(`push-testers-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: notifications are for testers #0001 and #0002 only: the ask, the panel, subscriptions and every send.");
process.exit(0);
