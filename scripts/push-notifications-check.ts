/**
 * push-notifications-check (wave 2 train B, session B2, 11 Nov 2026; docs/push-notifications.md): phone notifications,
 * through the real rules, the real web-push code, the real service worker text, the real server functions and the real
 * migrations on a local PostgreSQL 16 with the server-function harness's PostgREST / GoTrue stand-in. No browser.
 *
 * What it proves:
 * - delivery: the aes128gcm encryption reproduces RFC 8291 appendix A byte for byte; every message the server sends
 *   decrypts (node:crypto, written independently) on a stand-in push service to the right payload, and carries a VAPID
 *   JWT that verifies against the public key for the push service's origin; only known push services are used;
 * - the six events: each sends only when the player's master switch and its own switch are on; the daily cap (3) holds
 *   and room invites are outside it; quiet hours (22:00–08:00 on the device's clock) hold, except a room invite a
 *   friend has just sent; the tournament event exists and is settable, and nothing sends it;
 * - the streak reminder: only in the UK evening window, only to accounts with a live streak who haven't played that
 *   day's Daily, once a UK day, never in their quiet hours;
 * - subscriptions: accounts only (a guest is refused, nothing stored); sign-out removes the device's row; a subscription
 *   the push service says has gone is removed; an account deletion request removes every device;
 * - with the switch off (no keys): nothing sends, the server refuses subscriptions, and the phone neither asks nor
 *   marks an ask due; the ask respects 30 days after a decline;
 * - RLS: anon and authenticated can manage only their own subscriptions and settings, never the log or the functions;
 * - the service worker: the push listeners show the payload and open same-site links with ?notif=, and the offline
 *   worker's own listeners are the same as without them;
 * - analytics: notification_opt_in, notification_sent and notification_opened are recorded.
 *
 * Needs the PostgreSQL 16 binaries (preinstalled on GitHub's runners). Without them it fails on CI and prints a NOTE
 * locally (the pure parts still run).
 */

import { createDecipheriv, createECDH, createHmac, createPublicKey, randomBytes, verify as nodeVerify } from "node:crypto";

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
  if (/^\s*(FAIL|NOTE)|^push-notifications-check|^PASS/.test(line)) quietLog(...args);
};
console.warn = () => {};
console.error = () => {};
const restore = () => {
  console.log = quietLog;
  console.warn = quietWarn;
  console.error = quietError;
};

const b64u = (b: Uint8Array | Buffer) => Buffer.from(b).toString("base64url");
const unb64u = (s: string) => new Uint8Array(Buffer.from(s, "base64url"));

/* =================================================================== a stand-in device and push service */

interface Device {
  endpoint: string;
  p256dh: string;
  auth: string;
  ecdh: ReturnType<typeof createECDH>;
}
function makeDevice(name: string, host = "https://fcm.googleapis.com/fcm/send/"): Device {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return { endpoint: `${host}${name}-${randomBytes(6).toString("hex")}`, p256dh: b64u(ecdh.getPublicKey()), auth: b64u(randomBytes(16)), ecdh };
}

/** RFC 8291 decryption with node:crypto (written apart from the app's WebCrypto encryption). */
function decrypt(device: Device, body: Uint8Array): unknown {
  const buf = Buffer.from(body);
  const salt = buf.subarray(0, 16);
  const idlen = buf[20]!;
  const asPublic = buf.subarray(21, 21 + idlen);
  const cipher = buf.subarray(21 + idlen);
  const ecdhSecret = device.ecdh.computeSecret(asPublic);
  const uaPublic = device.ecdh.getPublicKey();
  const hmac = (key: Buffer, data: Buffer) => createHmac("sha256", key).update(data).digest();
  const prkKey = hmac(Buffer.from(unb64u(device.auth)), ecdhSecret);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: aes128gcm\0"), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: nonce\0"), Buffer.from([1])])).subarray(0, 12);
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(cipher.subarray(cipher.length - 16));
  const plain = Buffer.concat([decipher.update(cipher.subarray(0, cipher.length - 16)), decipher.final()]);
  if (plain[plain.length - 1] !== 2) throw new Error("no last-record delimiter");
  return JSON.parse(plain.subarray(0, plain.length - 1).toString("utf8"));
}

/** Verifies a VAPID Authorization header against the public key and the push service's origin. */
function vapidValid(header: string, publicKey: string, endpoint: string, nowMs: number): boolean {
  const m = /^vapid t=([^,]+), k=(.+)$/.exec(header);
  if (!m || m[2] !== publicKey) return false;
  const [h, c, s] = m[1]!.split(".");
  const point = unb64u(publicKey);
  const key = createPublicKey({ key: { kty: "EC", crv: "P-256", x: b64u(point.slice(1, 33)), y: b64u(point.slice(33)) }, format: "jwk" });
  const ok = nodeVerify("sha256", Buffer.from(`${h}.${c}`), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(unb64u(s!)));
  const head = JSON.parse(Buffer.from(h!, "base64url").toString()) as { alg?: string };
  const claims = JSON.parse(Buffer.from(c!, "base64url").toString()) as { aud?: string; exp?: number; sub?: string };
  return (
    ok &&
    head.alg === "ES256" &&
    claims.aud === new URL(endpoint).origin &&
    typeof claims.exp === "number" &&
    claims.exp > nowMs / 1000 &&
    claims.exp <= nowMs / 1000 + 24 * 3600 &&
    typeof claims.sub === "string" &&
    /^(https:|mailto:)/.test(claims.sub)
  );
}

interface Delivery {
  endpoint: string;
  payload: { event?: string; title?: string; body?: string; url?: string } | null;
  vapidOk: boolean;
  ttl: string | null;
}
function pushService(devices: () => Device[], keys: { publicKey: string }, nowMs: () => number) {
  const delivered: Delivery[] = [];
  const status = new Map<string, number>();
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const endpoint = String(input);
    const headers = new Headers(init?.headers);
    const device = devices().find((d) => d.endpoint === endpoint);
    let payload: Delivery["payload"] = null;
    try {
      if (device) payload = decrypt(device, new Uint8Array(init!.body as ArrayBuffer)) as Delivery["payload"];
    } catch {
      payload = null;
    }
    delivered.push({
      endpoint,
      payload,
      vapidOk: headers.get("content-encoding") === "aes128gcm" && vapidValid(headers.get("authorization") ?? "", keys.publicKey, endpoint, nowMs()),
      ttl: headers.get("ttl"),
    });
    return new Response(null, { status: status.get(endpoint) ?? 201 });
  }) as typeof fetch;
  return { delivered, status, fetchImpl };
}

/* =================================================================== pure parts */

async function pureChecks(): Promise<void> {
  const web = await import("../src/lib/push/webPush.server");
  const rules = await import("../src/lib/push/rules");
  const messages = await import("../src/lib/push/messages");

  await section("RFC 8291", async () => {
    const out = await web.encryptPayload({
      plaintext: new TextEncoder().encode("When I grow up, I want to be a watermelon"),
      p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
      auth: "BTBZMqHH6r4Tts7J_aSIgg",
      sender: {
        d: web.b64urlDecode("yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw"),
        publicPoint: web.b64urlDecode("BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8"),
      },
      salt: web.b64urlDecode("DGv6ra1nlYgDCS1FRnbzlw"),
    });
    check(
      web.b64urlEncode(out) ===
        "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
      "encryption: RFC 8291 appendix A's message, byte for byte",
    );
    const device = makeDevice("rt");
    const body = await web.encryptPayload({ plaintext: new TextEncoder().encode(JSON.stringify({ hi: "there" })), p256dh: device.p256dh, auth: device.auth });
    check((decrypt(device, body) as { hi?: string }).hi === "there", "encryption: a fresh message decrypts with node:crypto");
    const pair = await web.generateP256();
    const keys = { publicKey: web.b64urlEncode(pair.publicPoint), privateKey: web.b64urlEncode(pair.d) };
    const now = Date.UTC(2026, 10, 11, 12);
    const header = await web.vapidAuthorization("https://fcm.googleapis.com/fcm/send/abc", keys, now);
    check(vapidValid(header, keys.publicKey, "https://fcm.googleapis.com/fcm/send/abc", now), "VAPID: the JWT verifies, for the push service's origin, under 24 h, with a subject");
    check(!vapidValid(header, keys.publicKey, "https://web.push.apple.com/x", now), "VAPID: a JWT for one push service doesn't pass for another");
    check(web.vapidKeys({ publicKey: "", privateKey: keys.privateKey }) === null && web.vapidKeys({ publicKey: keys.publicKey, privateKey: "" }) === null, "the switch: either key missing → off");
    check(web.vapidKeys({ publicKey: "bad", privateKey: "bad" }) === null && web.vapidKeys(keys) !== null, "the switch: malformed keys → off; both well formed → on");
  });

  await section("endpoints", async () => {
    const ok = ["https://fcm.googleapis.com/fcm/send/x", "https://web.push.apple.com/QF", "https://updates.push.services.mozilla.com/wpush/v2/x", "https://wns2-db5p.notify.windows.com/w/?token=x"];
    const bad = ["http://fcm.googleapis.com/x", "https://evil.example/fcm.googleapis.com", "https://fcm.googleapis.com.evil.example/x", "https://localhost/x", "https://127.0.0.1/x", "https://user:pw@fcm.googleapis.com/x", "https://fcm.googleapis.com:8443/x", "javascript:alert(1)"];
    check(ok.every(web.isPushEndpoint), "known push services are accepted (Google, Apple, Mozilla, Microsoft)");
    check(bad.every((e) => !web.isPushEndpoint(e)), "anything else is refused (no http, other hosts, look-alikes, ports, credentials)");
    check(web.outcomeOf(201) === "sent" && web.outcomeOf(410) === "gone" && web.outcomeOf(404) === "gone" && web.outcomeOf(429) === "failed", "answers: 2xx sent, 404/410 gone, others failed");
  });

  await section("rules", async () => {
    const on = rules.DEFAULT_PUSH_SETTINGS;
    const noon = Date.UTC(2026, 10, 11, 12); // 12:00 UK (GMT)
    const late = Date.UTC(2026, 10, 11, 23); // 23:00 UK
    const d = (o: Partial<Parameters<typeof rules.decideSend>[0]>) =>
      rules.decideSend({ event: "friend_request", settings: on, sentToday: 0, nowMs: noon, timeZone: "Europe/London", ...o });
    check(rules.PUSH_EVENTS.length === 6 && rules.PUSH_EVENTS.join() === "friend_request,friend_accepted,friend_challenge,room_invite,tournament_starting,daily_streak", "the six events of the master plan");
    check(d({}) === "send", "a switched-on event in the day sends");
    check(d({ settings: { ...on, enabled: false } }) === "off", "the master switch off: nothing sends");
    for (const e of rules.PUSH_EVENTS)
      check(d({ event: e, settings: { ...on, [e]: false } }) === "off" && d({ event: e, settings: { ...on, enabled: false } }) === "off", `${e}: off with its own switch or the master switch off`);
    check(d({ sentToday: 2 }) === "send" && d({ sentToday: 3 }) === "capped", "the cap: a third is sent, a fourth isn't");
    check(d({ event: "room_invite", sentToday: 10 }) === "send", "room invites are outside the cap");
    check(d({ nowMs: late }) === "quiet" && d({ nowMs: Date.UTC(2026, 10, 11, 7, 59) }) === "quiet" && d({ nowMs: Date.UTC(2026, 10, 11, 8) }) === "send", "quiet hours 22:00–08:00");
    check(d({ event: "room_invite", nowMs: late, causedAtMs: late - 20_000 }) === "send", "quiet hours: a room invite a friend has just sent goes through");
    check(d({ event: "room_invite", nowMs: late, causedAtMs: late - 10 * 60_000 }) === "quiet" && d({ event: "room_invite", nowMs: late }) === "quiet", "quiet hours: an invite that isn't fresh waits (dropped)");
    check(d({ event: "daily_streak", nowMs: late, causedAtMs: late }) === "quiet", "quiet hours: only invites are excepted");
    check(rules.inQuietHours(Date.UTC(2026, 10, 11, 14), "Asia/Tokyo") && !rules.inQuietHours(Date.UTC(2026, 10, 11, 14), "Europe/London"), "quiet hours: 23:00 in Tokyo is 14:00 in London");
    check(rules.localDayStartMs(Date.UTC(2026, 10, 11, 15, 30, 12, 345), "Europe/London") === Date.UTC(2026, 10, 11), "the day starts at local midnight (London, GMT)");
    check(rules.localDayStartMs(Date.UTC(2026, 6, 11, 15), "Europe/London") === Date.UTC(2026, 6, 10, 23), "the day starts at local midnight (London, BST)");
    check(rules.localDayStartMs(Date.UTC(2026, 10, 11, 2), "Asia/Tokyo") === Date.UTC(2026, 10, 10, 15), "the day starts at local midnight (Tokyo)");
    check(rules.safeTimeZone("Not/AZone") === "Europe/London" && rules.safeTimeZone("America/New_York") === "America/New_York", "unknown time zones read as London");
    const day = 24 * 3600_000;
    check(rules.mayAskAgain(null, noon) && !rules.mayAskAgain(noon - 29 * day, noon) && rules.mayAskAgain(noon - 30 * day, noon), "a decline holds the ask off 30 days");
    check(JSON.stringify(rules.normaliseSettings({ enabled: false, room_invite: "no", daily_streak: false, junk: true })) === JSON.stringify({ ...on, enabled: false, daily_streak: false }), "settings: only booleans for known fields are taken");
  });

  await section("messages", async () => {
    for (const e of rules.PUSH_EVENTS) {
      const m = messages.messageFor(e, { from: "Ana_Push", code: "AB2C", title: "Friday Cup" });
      check(m.event === e && m.title.length > 0 && m.title.length <= 80 && m.body.length <= 160 && m.url.startsWith("/") && !m.url.startsWith("//"), `${e}: a short message with a same-site link`);
    }
    check(messages.messageFor("room_invite", { from: "Ana", code: "AB2C" }).url === "/duel/AB2C" && messages.messageFor("friend_challenge", { code: "x/../y" }).url === "/", "links take only well-formed codes");
    check(messages.openedUrl({ url: "/daily", event: "daily_streak" }) === "/daily?notif=daily_streak", "a tap's link carries ?notif=<event>");
  });
}

/* =================================================================== the service worker */

async function workerChecks(): Promise<void> {
  await section("service worker", async () => {
    const { offlineWorkerSource } = await import("../src/lib/offline/swPlugin");
    const { readFileSync } = await import("node:fs");
    const src = offlineWorkerSource({ version: "v1", bundleFiles: ["assets/a-12345678.js"], publicFiles: [] });
    const template = readFileSync("src/lib/offline/sw.template.js", "utf8");
    check(src.startsWith(template.slice(0, template.indexOf("__OFFLINE_CONFIG__"))), "the offline worker comes first, as written");
    const listeners = new Map<string, ((e: unknown) => void)[]>();
    const shown: { title: string; opts: { body?: string; tag?: string; data?: { link?: string } } }[] = [];
    const opened: string[] = [];
    const navigated: string[] = [];
    let windows: { url: string; focus: () => Promise<void>; navigate: (u: string) => Promise<void> }[] = [];
    const self = {
      location: { origin: "https://joulz.test", search: "" },
      addEventListener: (type: string, fn: (e: unknown) => void) => listeners.set(type, [...(listeners.get(type) ?? []), fn]),
      registration: { showNotification: async (title: string, opts: never) => void shown.push({ title, opts }) },
      clients: {
        matchAll: async () => windows,
        openWindow: async (u: string) => void opened.push(u),
        claim: async () => {},
      },
      skipWaiting: async () => {},
    };
    new Function("self", "caches", "fetch", "Request", "Response", "crypto", "URL", src)(self, {}, fetch, Request, Response, globalThis.crypto, URL);
    const types = [...listeners.keys()].sort().join();
    check(types === "activate,fetch,install,message,notificationclick,push", `listeners: the offline four plus push and notificationclick (${types})`);
    check(["install", "activate", "fetch", "message"].every((t) => listeners.get(t)!.length === 1), "the offline listeners are registered once each, as before");
    const wait: Promise<unknown>[] = [];
    const push = (data: unknown) =>
      listeners.get("push")![0]!({ data: data === undefined ? null : { json: () => (typeof data === "string" ? JSON.parse(data) : data) }, waitUntil: (p: Promise<unknown>) => wait.push(p) });
    push({ event: "room_invite", title: "Ana invited you to a room", body: "Room AB2C is waiting.", url: "/duel/AB2C", tag: "invite-AB2C" });
    push({ event: "friend_request", title: "x", url: "https://evil.example/" });
    push(undefined);
    push("not json{");
    await Promise.all(wait);
    check(shown.length === 2 && shown[0]!.title === "Ana invited you to a room" && shown[0]!.opts.data?.link === "/duel/AB2C?notif=room_invite" && shown[0]!.opts.tag === "invite-AB2C", "push: the payload is shown, its link carrying ?notif=<event>");
    check(shown[1]!.opts.data?.link === "/?notif=friend_request", "push: a link off the site becomes the home page");
    const click = async (link: string) => {
      const w: Promise<unknown>[] = [];
      listeners.get("notificationclick")![0]!({ notification: { close() {}, data: { link } }, waitUntil: (p: Promise<unknown>) => w.push(p) });
      await Promise.all(w);
    };
    await click("/duel/AB2C?notif=room_invite");
    check(opened.join() === "https://joulz.test/duel/AB2C?notif=room_invite", "click: with no window open, one is opened on the link");
    windows = [{ url: "https://joulz.test/practice", focus: async () => {}, navigate: async (u) => void navigated.push(u) }];
    await click("/daily?notif=daily_streak");
    check(navigated.join() === "https://joulz.test/daily?notif=daily_streak" && opened.length === 1, "click: an open Joulz window is focused and taken to the link");
    await click("https://evil.example/x");
    check(opened.length === 1 && navigated.length === 1, "click: a link off the site is never opened");
  });
}

/* =================================================================== the phone, switch off */

async function phoneChecks(): Promise<void> {
  await section("phone (switch off)", async () => {
    const store = new Map<string, string>();
    const g = globalThis as unknown as Record<string, unknown>;
    g["window"] = {
      localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
      navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/130", serviceWorker: {} },
      PushManager: function PushManager() {},
      Notification: { permission: "default" },
      matchMedia: () => ({ matches: false }),
    };
    g["Notification"] = (g["window"] as Record<string, unknown>)["Notification"];
    const { PUSH_PUBLIC_KEY } = await import("../src/config/pushConfig");
    const client = await import("../src/lib/push/pushClient");
    check(PUSH_PUBLIC_KEY === "", "the switch ships off (PUSH_PUBLIC_KEY empty until Joe adds the key)");
    check(!client.pushOn() && client.askKind() === null, "switch off: the phone has nothing to ask");
    client.notePushMoment("friend_request_sent", true);
    client.notePushMoment("daily_finished", true);
    check(store.size === 0 && client.pendingAsk() === null, "switch off: a useful moment marks nothing and stores nothing");
    await client.syncPushOnOpen(true);
    await client.forgetPushOnSignOut();
    check(store.size === 0, "switch off: opening and signing out touch nothing");

    (g["window"] as Record<string, unknown>)["__DUELZ_PUSH_PUBLIC_KEY__"] = "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
    check(client.pushOn() && client.askKind() === "ask", "switch on (a check's override): an Android phone may be asked");
    client.notePushMoment("friend_request_sent", false);
    check(client.pendingAsk() === null, "a guest is never asked");
    client.notePushMoment("friend_request_sent", true);
    check(client.pendingAsk() === "friend_request_sent", "an account's first useful moment marks the ask due (for the next tab page)");
    store.set("duelz-push:v1", JSON.stringify({ declinedAt: Date.now() - 29 * 24 * 3600_000 }));
    client.notePushMoment("daily_finished", true);
    check(client.pendingAsk() === null, "29 days after a decline: not asked");
    store.set("duelz-push:v1", JSON.stringify({ declinedAt: Date.now() - 31 * 24 * 3600_000 }));
    client.notePushMoment("daily_finished", true);
    check(client.pendingAsk() === "daily_finished", "31 days after a decline: asked again");
    (g["window"] as Record<string, Record<string, unknown>>)["navigator"]!["userAgent"] =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
    check(client.askKind() === "home-screen", "iPhone Safari (not the Home Screen app): the how-to instead of the opt-in");
    (g["window"] as Record<string, Record<string, unknown>>)["navigator"]!["standalone"] = true;
    check(client.askKind() === "ask", "iPhone Home Screen app: the opt-in");
    delete g["window"];
    delete g["Notification"];
  });

  await section("no game code from sign-out or friends", async () => {
    // economy-neutral-check walks imports (static, dynamic, re-exports) and fails when the pass's or the economy's code
    // reaches grading, scoring, ranking or dealing. accountApi (sign-out) and B1's friend calls load push code, so the
    // push modules they reach must reach none of it: the same walk, from those modules.
    const { existsSync, readFileSync, statSync } = await import("node:fs");
    const { dirname, join, relative, resolve } = await import("node:path");
    const SRC = resolve("src");
    const RE = /(?:import|export)\s[^'"`;]*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
    const resolveSpec = (from: string, spec: string) => {
      const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
      if (!base) return null;
      for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) if (existsSync(base + ext) && statSync(base + ext).isFile()) return base + ext;
      return null;
    };
    const GAME = /src\/lib\/duel\/(grade|scoring|ranking|generate)/;
    const roots = ["src/lib/account/accountApi.ts", "src/lib/push/pushDevice.ts", "src/lib/push/pushClient.ts", "src/lib/push/notify.server.ts", "src/lib/push/push.functions.ts", "src/lib/friends/friendsApi.ts"];
    for (const root of roots.filter((r) => existsSync(r))) {
      const from = new Map<string, string | null>([[resolve(root), null]]);
      const queue = [resolve(root)];
      let hit: string | null = null;
      while (queue.length && !hit) {
        const file = queue.shift()!;
        for (const m of readFileSync(file, "utf8").matchAll(RE)) {
          const next = resolveSpec(file, m[1] ?? m[2] ?? m[3]!);
          if (!next || from.has(next)) continue;
          from.set(next, file);
          if (GAME.test(relative(".", next))) { hit = next; break; }
          queue.push(next);
        }
      }
      const chain: string[] = [];
      for (let c: string | null | undefined = hit; c; c = from.get(c)) chain.unshift(relative(".", c));
      check(!hit, `${root} reaches no grading, scoring, ranking or dealing code${hit ? ` (${chain.join(" → ")})` : ""}`);
    }
    const account = readFileSync("src/lib/account/accountApi.ts", "utf8");
    check(account.includes('import("@/lib/push/pushDevice")') && !account.includes("push/pushClient"), "sign-out loads pushDevice (forgetPushOnSignOut), never the push client");
  });

  await section("override ignored in production", async () => {
    const { readFileSync } = await import("node:fs");
    // The function's first statement returns the setting when Vite's PROD is true (a production build), before the
    // window override is read; the built bundle then holds no override code at all.
    const src = readFileSync("src/config/pushConfig.ts", "utf8");
    const body = src.slice(src.indexOf("export function pushPublicKey"));
    const first = body.slice(body.indexOf("{") + 1).split("\n").map((l) => l.trim()).find((l) => l && !l.startsWith("//"));
    check(first === "if (import.meta.env.PROD) return PUSH_PUBLIC_KEY;", `pushPublicKey returns the setting in a production build before reading any override (${first})`);
    const reads = body.slice(0, body.indexOf("\n}\n") + 3);
    check(reads.indexOf("import.meta.env.PROD") < reads.indexOf("__DUELZ_PUSH_PUBLIC_KEY__"), "the production guard comes before the override is named");
    const other = src.replace(body.slice(0, body.indexOf("\n}\n") + 3), "");
    const codeLines = other.split("\n").filter((l) => l.includes("__DUELZ_PUSH_PUBLIC_KEY__") && !/^\s*(\*|\/\/|\/\*)/.test(l));
    check(codeLines.length === 0, `the override is read nowhere else in pushConfig.ts (only comments name it) (${codeLines.join(" | ")})`);
    const { execSync } = await import("node:child_process");
    const readers = execSync(`grep -rln "__DUELZ_PUSH_PUBLIC_KEY__" src`).toString().trim().split("\n");
    check(readers.join() === "src/config/pushConfig.ts", `only pushConfig.ts reads the override (${readers.join(" ")})`);
  });
}

/* =================================================================== the database */

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ANA = uid(41);
const BEN = uid(42);
const CAT = uid(43); // a guest
const DAN = uid(44); // cap and quiet hours
const ELI = uid(45); // no streak
const FAY = uid(46); // played today
const GUS = uid(47); // Tokyo (quiet at the UK evening)
const HAL = uid(48); // reminder switched off
const IVY = uid(49); // deletion
const JAY = uid(50); // a Daily five days ago: no live streak
const KIM = uid(51); // receives a real friend request (B1)
const LEO = uid(52); // sends it

const ACCOUNTS = { ANA, BEN, DAN, ELI, FAY, GUS, HAL, IVY, JAY, KIM, LEO };

async function databaseChecks(db: LocalDb, rest: RestServer): Promise<void> {
  const fns = await import("../src/lib/push/push.functions");
  const notify = { ...(await import("../src/lib/push/notify.server")), ...(await import("../src/lib/push/streakReminder.server")) };
  const web = await import("../src/lib/push/webPush.server");
  const account = await import("../src/lib/account/account.functions");
  const { flushAnalytics } = await import("../src/lib/data/events.server");
  const { adminDb } = await import("../src/lib/data/db.server");
  const { createClient } = await import("@supabase/supabase-js");
  const admin = await adminDb();
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
  const events = async (event: string, player?: string, prop?: string) => {
    await flushAnalytics();
    return Number(q(`SELECT count(*) FROM analytics.events WHERE event = '${event}'${player ? ` AND player_id = '${player}'` : ""}${prop ? ` AND ${prop}` : ""}`));
  };
  const subs = (id: string) => Number(q(`SELECT count(*) FROM push_subscriptions WHERE user_id = '${id}'`));
  const tok: Record<string, string> = {};
  for (const [name, id] of Object.entries(ACCOUNTS)) tok[name] = accountToken(id);
  tok["CAT"] = userToken(CAT);

  // The keys, as the Worker would have them (the public setting stands in through VAPID_PUBLIC_KEY).
  const pair = await web.generateP256();
  const keys = { publicKey: web.b64urlEncode(pair.publicPoint), privateKey: web.b64urlEncode(pair.d) };
  const keysOn = () => {
    process.env["VAPID_PUBLIC_KEY"] = keys.publicKey;
    process.env["VAPID_PRIVATE_KEY"] = keys.privateKey;
  };
  const keysOff = () => {
    delete process.env["VAPID_PUBLIC_KEY"];
    delete process.env["VAPID_PRIVATE_KEY"];
  };
  const devices: Device[] = [];
  let clock = Date.UTC(2026, 10, 11, 12); // 12:00 UK
  const service = pushService(() => devices, keys, () => clock);
  const opts = () => ({ nowMs: clock, fetchImpl: service.fetchImpl });
  const register = async (who: string, device: Device, timeZone = "Europe/London") => {
    devices.push(device);
    return call(fns.savePushSubscriptionFn, { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth }, timeZone }, tok[who]!);
  };

  for (const [name, id] of Object.entries(ACCOUNTS))
    q(`SELECT public.create_profile('${id}', '${name.charAt(0)}${name.slice(1).toLowerCase()}_Push', 3::smallint, DATE '1990-01-01', NULL)`);
  check(Number(q(`SELECT count(*) FROM profiles WHERE user_id IN (${Object.values(ACCOUNTS).map((id) => `'${id}'`).join(",")})`)) === 11, "eleven accounts made");

  /* ------------------------------------------------------------- switch off */
  await section("switch off", async () => {
    keysOff();
    const d = makeDevice("off");
    const saved = await register("ANA", d);
    check(saved?.ok === false && saved.reason === "disabled" && subs(ANA) === 0, "no keys: the server refuses a subscription, nothing stored");
    q(`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ('${ANA}', '${d.endpoint}', '${d.p256dh}', '${d.auth}')`);
    const before = service.delivered.length;
    const out = await notify.notifyFriendRequest(admin, ANA, "Ben_Push", opts());
    clock = Date.UTC(2026, 10, 11, 19, 30);
    const run = await notify.runDailyStreakReminders(admin, opts());
    clock = Date.UTC(2026, 10, 11, 12);
    check(out === "disabled" && service.delivered.length === before && run.outcomes.disabled === 1 && run.candidates === 0, "no keys: nothing sends (an event, the reminder)");
    check(Number(q(`SELECT count(*) FROM notification_log`)) === 0, "no keys: nothing logged");
    q(`DELETE FROM push_subscriptions WHERE user_id = '${ANA}'`);
    devices.length = 0;
    keysOn();
  });

  /* ------------------------------------------------------------- subscriptions */
  const anaPhone = makeDevice("ana-phone");
  const anaLaptop = makeDevice("ana-laptop", "https://updates.push.services.mozilla.com/wpush/v2/");
  await section("subscriptions", async () => {
    const guest = await register("CAT", makeDevice("cat"));
    check(guest?.ok === false && guest.reason === "no_account" && Number(q(`SELECT count(*) FROM push_subscriptions WHERE user_id = '${CAT}'`)) === 0, "a guest is refused; nothing stored");
    const evil = await call(fns.savePushSubscriptionFn, { endpoint: "https://evil.example/hook", keys: { p256dh: anaPhone.p256dh, auth: anaPhone.auth } }, tok["ANA"]!);
    const badKey = await call(fns.savePushSubscriptionFn, { endpoint: anaPhone.endpoint, keys: { p256dh: "short", auth: anaPhone.auth } }, tok["ANA"]!);
    check(evil?.reason === "bad_subscription" && badKey?.reason === "bad_subscription" && subs(ANA) === 0, "an unknown push service or a malformed key is refused");
    check((await register("ANA", anaPhone))?.ok === true && (await register("ANA", anaLaptop, "Europe/Paris"))?.ok === true && subs(ANA) === 2, "an account saves two devices");
    check((await register("ANA", anaPhone))?.ok === true && subs(ANA) === 2, "saving the same device again keeps one row");
    check(q(`SELECT time_zone FROM push_subscriptions WHERE endpoint = '${anaLaptop.endpoint}'`) === "Europe/Paris", "each device keeps its time zone");
    const view = await call(fns.pushSettingsFn, undefined, tok["ANA"]!);
    check(view?.ok === true && Object.values(view.settings).every((v) => v === true) && view.mayAsk === true, "a new account's settings: everything on, may be asked");
    check((await call(fns.pushSettingsFn, undefined, tok["CAT"]!))?.reason === "no_account", "a guest has no settings");
  });

  /* ------------------------------------------------------------- the six events */
  await section("events and switches", async () => {
    let n = service.delivered.length;
    const sent = await notify.notifyFriendRequest(admin, ANA, "Ben_Push", opts());
    const got = service.delivered.slice(n);
    check(sent === "sent" && got.length === 2 && new Set(got.map((g) => g.endpoint)).size === 2, "friend request: sent to both of Ana's devices");
    check(got.every((g) => g.vapidOk && g.payload?.event === "friend_request" && g.payload.body?.includes("Ben_Push") && g.payload.url === "/profile" && g.ttl === "86400"), "each message decrypts on the device to the right payload, VAPID-signed");
    q(`DELETE FROM notification_log`);

    const off = await call(fns.setPushSettingsFn, { friend_accepted: false, bogus: false }, tok["ANA"]!);
    check(off?.ok === true && off.settings.friend_accepted === false && off.settings.friend_request === true, "settings: one event switched off, the rest kept");
    n = service.delivered.length;
    check((await notify.notifyFriendAccepted(admin, ANA, "Ben_Push", opts())) === "off" && service.delivered.length === n, "friend accepted, switched off: not sent");
    check((await notify.notifyFriendChallenge(admin, ANA, "Ben_Push", "QW3RTY", opts())) === "sent", "friend challenge, switched on: sent");
    check(service.delivered.at(-1)?.payload?.url === "/challenge?code=QW3RTY", "the challenge opens its link");
    await call(fns.setPushSettingsFn, { enabled: false }, tok["ANA"]!);
    n = service.delivered.length;
    const allOff = await Promise.all([
      notify.notifyFriendRequest(admin, ANA, "Ben_Push", opts()),
      notify.notifyFriendChallenge(admin, ANA, "Ben_Push", "QW3RTY", opts()),
      notify.notifyRoomInvite(admin, ANA, "Ben_Push", "AB2C", opts()),
      notify.notifyTournamentStarting(admin, ANA, "Friday Cup", "t1", opts()),
    ]);
    check(allOff.every((o) => o === "off") && service.delivered.length === n, "the master switch off: no event sends, invites included");
    await call(fns.setPushSettingsFn, { enabled: true, friend_accepted: true }, tok["ANA"]!);
    check(q(`SELECT enabled AND friend_accepted FROM notification_settings WHERE user_id = '${ANA}'`) === "t", "settings: turned back on");
    q(`DELETE FROM notification_log`);
    check((await notify.notifyTournamentStarting(admin, ANA, "Friday Cup", "t1", opts())) === "sent", "tournament starting: the type exists and sends when called");
    const callers = (await import("node:child_process")).execSync(`grep -rln "notifyTournamentStarting\\|\\"tournament_starting\\"" src --include=*.ts --include=*.tsx`).toString().trim().split("\n").sort();
    check(callers.join() === "src/lib/push/messages.ts,src/lib/push/notify.server.ts,src/lib/push/rules.ts", `tournament starting: nothing in the app calls it yet (wave 4) (${callers.join(" ")})`);
    q(`DELETE FROM notification_log`);
  });

  await section("cap and quiet hours", async () => {
    const dan = makeDevice("dan");
    await register("DAN", dan);
    const outs: string[] = [];
    for (let i = 0; i < 4; i++) outs.push(await notify.notifyFriendRequest(admin, DAN, `F${i}`, opts()));
    check(outs.join() === "sent,sent,sent,capped", `the daily cap: three sent, the fourth not (${outs.join()})`);
    check((await notify.notifyRoomInvite(admin, DAN, "Ana_Push", "AB2C", opts())) === "sent" && (await notify.notifyRoomInvite(admin, DAN, "Ana_Push", "CD3E", opts())) === "sent", "room invites still send past the cap");
    check(service.delivered.at(-1)?.payload?.url === "/duel/CD3E", "an invite opens its room");
    const concurrent = await Promise.all([0, 1, 2, 3, 4].map((i) => notify.notifyFriendRequest(admin, BEN, `C${i}`, opts())));
    check(concurrent.filter((o) => o === "no_device").length === 5, "a player with no device: nothing sent or logged");
    const ben = makeDevice("ben");
    await register("BEN", ben);
    const race = await Promise.all([0, 1, 2, 3, 4, 5].map((i) => notify.notifyFriendRequest(admin, BEN, `R${i}`, opts())));
    check(race.filter((o) => o === "sent").length === 3 && race.filter((o) => o === "capped").length === 3, "six at once: exactly three sent (the cap is atomic)");
    clock = Date.UTC(2026, 10, 12, 0, 30); // the next UK day, 00:30
    check((await notify.notifyFriendRequest(admin, ELI, "x", opts())) === "no_device", "(Eli has no device yet)");
    const dan2 = await notify.notifyFriendRequest(admin, DAN, "Next_Day", opts());
    check(dan2 === "quiet", "00:30: quiet hours");
    check((await notify.notifyRoomInvite(admin, DAN, "Ana_Push", "AB2C", { ...opts(), causedAtMs: clock - 5_000 })) === "sent", "00:30: a room invite a friend has just sent goes through");
    check((await notify.notifyRoomInvite(admin, DAN, "Ana_Push", "AB2C", { ...opts(), causedAtMs: clock - 15 * 60_000 })) === "quiet", "00:30: an invite from 15 minutes ago doesn't");
    clock = Date.UTC(2026, 10, 12, 9);
    check((await notify.notifyFriendRequest(admin, DAN, "Next_Day", opts())) === "sent", "the next day at 09:00: the cap has reset");
    const gusDevice = makeDevice("gus");
    await register("GUS", gusDevice, "Asia/Tokyo");
    check((await notify.notifyFriendRequest(admin, GUS, "x", { ...opts(), nowMs: Date.UTC(2026, 10, 12, 14) })) === "quiet", "quiet hours on the device's clock: 23:00 in Tokyo");
    clock = Date.UTC(2026, 10, 11, 12);
    q(`DELETE FROM notification_log`);
  });

  /* ------------------------------------------------------------- gone, sign-out, deletion */
  await section("gone subscriptions", async () => {
    service.status.set(anaLaptop.endpoint, 410);
    const out = await notify.notifyFriendRequest(admin, ANA, "Ben_Push", opts());
    check(out === "sent" && subs(ANA) === 1 && Number(q(`SELECT count(*) FROM push_subscriptions WHERE endpoint = '${anaLaptop.endpoint}'`)) === 0, "a subscription the push service says has gone (410) is removed; the other device still gets it");
    service.status.set(anaPhone.endpoint, 404);
    check((await notify.notifyFriendRequest(admin, ANA, "Ben_Push", opts())) === "failed" && subs(ANA) === 0, "404 also removes it");
    service.status.clear();
    await register("ANA", anaPhone);
    q(`DELETE FROM notification_log`);
  });

  await section("sign-out", async () => {
    const other = await call(fns.removePushSubscriptionFn, { endpoint: anaPhone.endpoint }, tok["BEN"]!);
    check(other?.ok === true && other.removed === 0 && subs(ANA) === 1, "another player can't remove Ana's device");
    const mine = await call(fns.removePushSubscriptionFn, { endpoint: anaPhone.endpoint }, tok["ANA"]!);
    check(mine?.ok === true && mine.removed === 1 && subs(ANA) === 0, "sign-out: the device's subscription is removed");
    const ivy1 = makeDevice("ivy1");
    const ivy2 = makeDevice("ivy2");
    await register("IVY", ivy1);
    await register("IVY", ivy2);
    const del = await call(account.requestAccountDeletionFn, {}, tok["IVY"]!);
    check(!!del && subs(IVY) === 0, `an account deletion request removes every device (${JSON.stringify(del).slice(0, 80)})`);
    const moved = makeDevice("moved");
    await register("BEN", moved);
    devices.push(moved);
    await call(fns.savePushSubscriptionFn, { endpoint: moved.endpoint, keys: { p256dh: moved.p256dh, auth: moved.auth } }, tok["ELI"]!);
    check(q(`SELECT user_id FROM push_subscriptions WHERE endpoint = '${moved.endpoint}'`) === ELI, "a phone signed in to another account moves its row to that account");
    q(`DELETE FROM push_subscriptions WHERE endpoint = '${moved.endpoint}'`);
    await register("ANA", anaPhone);
  });

  /* ------------------------------------------------------------- the streak reminder */
  await section("streak reminder (C2's Daily streak)", async () => {
    const { dailyStreakFor } = await import("../src/lib/duel/dailyStreak.server");
    const day = "2026-11-11";
    const room = (kind: string, d: string) =>
      q(`INSERT INTO async_rooms (kind, room_key, day, seed, round_count, opens_at, closes_at) VALUES ('${kind}', '${kind}:${d}', DATE '${d}', 1, 3, TIMESTAMPTZ '${d} 00:00Z', TIMESTAMPTZ '${d} 00:00Z' + interval '1 day') RETURNING id`).split("\n")[0]!.trim();
    const d9 = room("daily_puzzle", "2026-11-09");
    const yPuzzle = room("daily_puzzle", "2026-11-10");
    const yArcade = room("daily_arcade", "2026-11-10");
    const tPuzzle = room("daily_puzzle", day);
    const d6 = room("daily_puzzle", "2026-11-06");
    const attempt = (roomId: string, user: string) => q(`INSERT INTO async_attempts (room_id, user_id, display_name) VALUES ('${roomId}', '${user}', 'P')`);
    for (const who of ["ELI", "FAY", "HAL", "JAY"]) await register(who, makeDevice(who.toLowerCase()));
    attempt(d9, ANA);
    attempt(yPuzzle, ANA); // a two-day streak, not played today → reminded
    attempt(yArcade, FAY);
    attempt(tPuzzle, FAY); // played today → not
    attempt(yPuzzle, GUS); // Tokyo: quiet at the UK evening
    attempt(yPuzzle, HAL); // reminder switched off
    attempt(yPuzzle, CAT); // a guest → never
    attempt(d6, JAY); // five days ago only: C2's streak is 0 → not reminded
    // ELI: no Daily at all → not a candidate.
    await call(fns.setPushSettingsFn, { daily_streak: false }, tok["HAL"]!);

    clock = Date.UTC(2026, 10, 11, 19, 41);
    const anaStreak = await dailyStreakFor(admin, ANA, clock);
    const jayStreak = await dailyStreakFor(admin, JAY, clock);
    const fayStreak = await dailyStreakFor(admin, FAY, clock);
    check(anaStreak.streak === 2 && !anaStreak.playedToday && jayStreak.streak === 0 && fayStreak.playedToday, `C2's streak on the account: Ana 2 not played today, Jay 0, Fay played today (${JSON.stringify([anaStreak, jayStreak, fayStreak])})`);

    clock = Date.UTC(2026, 10, 11, 17, 41); // 17:41 UK: outside the window
    const early = await notify.runDailyStreakReminders(admin, opts());
    check(!early.inWindow && early.candidates === 0 && Number(q(`SELECT count(*) FROM notification_log`)) === 0, "outside 19:00–20:59 UK: nothing looked at, nothing sent");
    clock = Date.UTC(2026, 10, 11, 19, 41); // 19:41 UK (GMT)
    const n = service.delivered.length;
    const run = await notify.runDailyStreakReminders(admin, opts());
    const reminded = q(`SELECT string_agg(user_id::text, ',' ORDER BY user_id) FROM notification_log WHERE event = 'daily_streak'`);
    check(run.inWindow && run.day === day && reminded === ANA, `in the window: only the live streak with today's Daily not played is reminded (${reminded})`);
    check(run.outcomes.sent === 1 && run.outcomes.quiet === 1 && run.outcomes.off === 1 && run.candidates === 3, `candidates Ana, Gus and Jay; Gus (Tokyo, 04:41) quiet, Jay's streak 0; Fay, Hal, Eli and the guest not candidates (${JSON.stringify(run)})`);
    const got = service.delivered.slice(n);
    check(got.length === 1 && got[0]!.endpoint === devices.find((d) => d.endpoint.includes("ana-phone"))!.endpoint, "a real streak leads to a notification on the player's device");
    check(got.every((g) => g.payload?.event === "daily_streak" && g.payload.url === "/daily" && g.vapidOk && g.payload.body?.includes(`${anaStreak.streak} days`)), `the reminder opens the Daily and states C2's streak (${got[0]?.payload?.body})`);
    const again = await notify.runDailyStreakReminders(admin, opts());
    check((again.outcomes.sent ?? 0) === 0 && Number(q(`SELECT count(*) FROM notification_log WHERE event = 'daily_streak'`)) === 1, "the next hourly run in the window: nobody reminded twice");
    q(`DELETE FROM notification_log WHERE event = 'daily_streak'`);
    attempt(tPuzzle, ANA);
    const afterPlay = await notify.runDailyStreakReminders(admin, opts());
    check((afterPlay.outcomes.sent ?? 0) === 0 && afterPlay.candidates === 2, "once Ana starts today's Daily: no reminder");
    // The hourly Cron Trigger (:41 UTC) lands in the 19:00–20:59 UK window twice a day in GMT and in BST.
    const inWindow = (y: number, m: number, d: number) =>
      Array.from({ length: 24 }, (_, h) => Date.UTC(y, m, d, h, 41)).filter((t) => [19, 20].includes(Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" }).format(t)))).length;
    check(inWindow(2026, 10, 11) === 2 && inWindow(2026, 6, 15) === 2, "the hourly :41 Cron Trigger lands in the window twice a day (GMT and BST)");
    clock = Date.UTC(2026, 6, 15, 18, 41); // a BST evening: 19:41 UK
    const bst = await notify.runDailyStreakReminders(admin, opts());
    check(bst.inWindow && bst.day === "2026-07-15", "in BST the 18:41 UTC run is in the window");
    clock = Date.UTC(2026, 10, 11, 12);
    q(`DELETE FROM notification_log`);
  });

  /* ------------------------------------------------------------- B1's friend events */
  await section("friend events (B1)", async () => {
    const friends = await import("../src/lib/friends/friends.functions");
    const { rules } = { rules: await import("../src/lib/push/rules") };
    web.setPushFetchForChecks(service.fetchImpl);
    // B1's own calls dispatch at the real time: give the devices a time zone where it's daytime now.
    const zones = ["Europe/London", "America/New_York", "America/Los_Angeles", "Pacific/Honolulu", "Asia/Tokyo", "Australia/Sydney", "Asia/Kolkata", "Asia/Dubai", "Pacific/Auckland", "America/Sao_Paulo"];
    const zone = zones.find((z) => { const h = rules.localHour(Date.now(), z); return h >= 9 && h <= 19; }) ?? "Europe/London";
    const kim = makeDevice("kim");
    const leo = makeDevice("leo");
    await register("KIM", kim, zone);
    await register("LEO", leo, zone);
    const waitFor = async (pred: (d: Delivery) => boolean) => {
      for (let i = 0; i < 60; i++) {
        const hit = service.delivered.find(pred);
        if (hit) return hit;
        await new Promise((r) => setTimeout(r, 50));
      }
      return null;
    };
    const count = (endpoint: string, event: string) => service.delivered.filter((d) => d.endpoint === endpoint && d.payload?.event === event).length;

    const sent = await call(friends.friendRequestFn, { playerId: KIM }, tok["LEO"]!);
    check(sent?.ok === true && sent.outcome === "sent", `B1: Leo sends Kim a real friend request (${JSON.stringify(sent).slice(0, 80)})`);
    check(q(`SELECT count(*) FROM friend_events WHERE recipient_id = '${KIM}' AND kind = 'friend_request_received'`) === "1", "B1 recorded friend_request_received");
    const req = await waitFor((d) => d.endpoint === kim.endpoint && d.payload?.event === "friend_request");
    check(!!req && req.vapidOk && req.payload!.body === "Leo_Push wants to be friends on Joulz.", `a real friend request leads to a notification on Kim's phone, at once (${req?.payload?.body})`);
    const requestId = q(`SELECT id FROM friend_requests WHERE from_user_id = '${LEO}' AND to_user_id = '${KIM}'`);
    const accepted = await call(friends.friendRespondFn, { requestId, accept: true }, tok["KIM"]!);
    const acc = await waitFor((d) => d.endpoint === leo.endpoint && d.payload?.event === "friend_accepted");
    check(accepted?.ok === true && !!acc && acc.payload!.body === "You and Kim_Push are now friends.", `Kim accepts: Leo's phone gets friend accepted (${acc?.payload?.body})`);

    const nowIso = new Date().toISOString();
    q(`INSERT INTO friend_events (recipient_id, actor_id, kind, payload, created_at) VALUES
      ('${KIM}', '${LEO}', 'room_invite_received', '{"code":"AB2C","roomId":"00000000-0000-4000-8000-000000000999"}', '${nowIso}'),
      ('${KIM}', '${LEO}', 'friend_challenge_received', '{"code":"QW3RTY"}', '${nowIso}'),
      ('${KIM}', '${LEO}', 'room_invite_received', '{"code":"OLD2"}', now() - interval '20 minutes')`);
    const swept = await notify.dispatchFriendEvents(admin, { fetchImpl: service.fetchImpl });
    check(swept.claimed === 3 && swept.outcomes.sent === 2 && swept.outcomes.stale === 1, `the sweep sends B1's room invite and challenge; a 20-minute-old invite isn't sent (${JSON.stringify(swept)})`);
    check(service.delivered.some((d) => d.endpoint === kim.endpoint && d.payload?.url === "/duel/AB2C") && service.delivered.some((d) => d.endpoint === kim.endpoint && d.payload?.url === "/challenge?code=QW3RTY"), "room_invite_received opens the room, friend_challenge_received the challenge");
    const twice = await notify.dispatchFriendEvents(admin, { fetchImpl: service.fetchImpl });
    check(twice.claimed === 0 && count(kim.endpoint, "friend_request") === 1 && count(leo.endpoint, "friend_accepted") === 1 && count(kim.endpoint, "room_invite") === 1, "each friend event is sent once (the request's dispatch and the sweep never both)");

    keysOff();
    q(`INSERT INTO friend_events (recipient_id, actor_id, kind, payload) VALUES ('${KIM}', '${LEO}', 'friend_challenge_received', '{"code":"ZX9PLM"}')`);
    const off = await notify.dispatchFriendEvents(admin, { fetchImpl: service.fetchImpl });
    check(off.claimed === 0 && off.outcomes.disabled === 1 && q(`SELECT count(*) FROM push_friend_deliveries d JOIN friend_events e ON e.id = d.event_id WHERE e.payload->>'code' = 'ZX9PLM'`) === "0", "keys off: nothing is claimed or sent");
    keysOn();
    const on = await notify.dispatchFriendEvents(admin, { fetchImpl: service.fetchImpl });
    check(on.claimed === 1 && on.outcomes.sent === 1, "keys back on: the waiting event is sent");

    await call(fns.setPushSettingsFn, { friend_request: false }, tok["KIM"]!);
    const before = count(kim.endpoint, "friend_request");
    const fromEli = await call(friends.friendRequestFn, { playerId: KIM }, tok["ELI"]!);
    await new Promise((r) => setTimeout(r, 400));
    const late = await notify.dispatchFriendEvents(admin, { fetchImpl: service.fetchImpl });
    check(fromEli?.ok === true && count(kim.endpoint, "friend_request") === before && late.claimed === 0, "Kim's friend-request switch off: Eli's real request sends nothing (claimed, not sent)");
    web.setPushFetchForChecks(null);
    q(`DELETE FROM notification_log`);
  });

  /* ------------------------------------------------------------- the Cron Triggers */
  await section("Cron Triggers", async () => {
    const { readFileSync, existsSync } = await import("node:fs");
    const { PUSH_CRONS } = await import("../src/lib/push/tasks/pushTasks.server");
    const vite = readFileSync("vite.config.ts", "utf8");
    check(vite.includes(`"${PUSH_CRONS.friendSweep}": ["push:friend-sweep"]`) && vite.includes(`"${PUSH_CRONS.dailyReminder}": ["push:daily-reminder"]`) && /experimental: \{ tasks: true \}/.test(vite), "vite.config.ts schedules both push tasks (nitro writes them into wrangler.json's triggers.crons)");
    check(existsSync("src/lib/push/tasks/friendSweep.task.ts") && existsSync("src/lib/push/tasks/dailyReminder.task.ts"), "both task files exist");
    check(!existsSync(".github/workflows/push-reminder.yml") && !existsSync("src/routes/api/push/daily-reminder.ts") && !readFileSync(".github/workflows/deploy-cloudflare.yml", "utf8").includes("PUSH_CRON_SECRET"), "no GitHub schedule, HTTP route or scheduler secret");
  });

  /* ------------------------------------------------------------- the ask and opened */
  await section("ask and opened", async () => {
    const declined = await call(fns.notePushAnswerFn, { answer: "declined", moment: "friend_request_sent" }, tok["BEN"]!);
    const view = await call(fns.pushSettingsFn, undefined, tok["BEN"]!);
    check(declined?.ok === true && view?.mayAsk === false, "a decline: the server says don't ask (30 days)");
    q(`UPDATE notification_settings SET declined_at = now() - interval '31 days' WHERE user_id = '${BEN}'`);
    check((await call(fns.pushSettingsFn, undefined, tok["BEN"]!))?.mayAsk === true, "31 days later: may ask again");
    check((await call(fns.notePushAnswerFn, { answer: "accepted", moment: "daily_finished" }, tok["ANA"]!))?.ok === true, "an accept is noted");
    check((await call(fns.notePushAnswerFn, { answer: "accepted" }, tok["CAT"]!))?.reason === "no_account", "a guest can't answer (never asked)");
    check((await call(fns.notePushOpenedFn, { event: "room_invite" }, tok["ANA"]!))?.ok === true && (await call(fns.notePushOpenedFn, { event: "spam" }, tok["ANA"]!))?.ok === false, "opened: known events only");
    check((await events("notification_opt_in", BEN, "props->>'answer' = 'declined' AND props->>'moment' = 'friend_request_sent'")) === 1 && (await events("notification_opt_in", ANA, "props->>'answer' = 'accepted'")) === 1, "notification_opt_in recorded (accepted or declined, with the moment)");
    check((await events("notification_opened", ANA, "props->>'event' = 'room_invite'")) === 1 && (await events("notification_opened")) === 1, "notification_opened recorded (the event)");
    check((await events("notification_sent", DAN, "props->>'event' = 'room_invite'")) >= 2 && (await events("notification_sent", ANA, "props->>'event' = 'friend_request' AND (props->>'devices')::int = 2")) >= 1, "notification_sent recorded (the event, the devices)");
    check((await events("notification_sent", HAL)) === 0 && (await events("notification_sent", CAT)) === 0, "nothing recorded as sent for a switched-off player or a guest");
  });

  /* ------------------------------------------------------------- RLS */
  await section("RLS", async () => {
    const ana = deviceDb(tok["ANA"]!);
    const anon = deviceDb(null);
    const own = await ana.from("push_subscriptions").select("user_id");
    check(!own.error && (own.data ?? []).length === subs(ANA) && (own.data ?? []).every((r) => r.user_id === ANA), "a player reads only their own subscriptions");
    const delOther = await ana.from("push_subscriptions").delete().eq("user_id", BEN).select("id");
    check((delOther.data ?? []).length === 0 && subs(BEN) >= 1, "a player can't delete another's subscription");
    const ins = await ana.from("push_subscriptions").insert({ user_id: ANA, endpoint: "https://fcm.googleapis.com/fcm/send/x", p256dh: anaPhone.p256dh, auth: anaPhone.auth }).select("id");
    check(!!ins.error, "a player can't write subscriptions directly (the server checks them)");
    const setOwn = await ana.from("notification_settings").update({ friend_request: false }).eq("user_id", ANA).select("user_id");
    check(!setOwn.error && (setOwn.data ?? []).length === 1, "a player changes their own switches");
    const setOther = await ana.from("notification_settings").update({ friend_request: false }).eq("user_id", BEN).select("user_id");
    check((setOther.data ?? []).length === 0 && q(`SELECT friend_request FROM notification_settings WHERE user_id = '${BEN}'`) !== "f", "a player can't change another's switches");
    const declinedEdit = await ana.from("notification_settings").update({ declined_at: null }).eq("user_id", ANA).select("user_id");
    check(!!declinedEdit.error, "the ask's record is the server's (declined_at isn't writable)");
    const insOther = await ana.from("notification_settings").insert({ user_id: ELI }).select("user_id");
    check(!!insOther.error, "a player can't make another's settings row");
    const anonRead = await anon.from("push_subscriptions").select("id");
    const anonSet = await anon.from("notification_settings").select("user_id");
    check((!!anonRead.error || (anonRead.data ?? []).length === 0) && (!!anonSet.error || (anonSet.data ?? []).length === 0), "anon reads nothing");
    const logRead = await ana.from("notification_log").select("id");
    check(!!logRead.error || (logRead.data ?? []).length === 0, "the log is the server's only");
    const reachable: string[] = [];
    for (const role of ["anon", "authenticated"]) {
      for (const f of ["push_reserve(uuid,text,boolean,timestamp with time zone,integer,text)", "push_streak_candidates(date)", "push_claim_friend_events(timestamp with time zone,integer)", "push_log_retention()"])
        if (q(`SELECT has_function_privilege('${role}', 'public.${f}', 'EXECUTE')`) === "t") reachable.push(`${role} ${f}`);
      for (const t of ["notification_log", "push_friend_deliveries"]) if (q(`SELECT has_table_privilege('${role}', 'public.${t}', 'SELECT')`) === "t") reachable.push(`${role} ${t}`);
      if (q(`SELECT has_table_privilege('${role}', 'public.push_subscriptions', 'INSERT')`) === "t") reachable.push(`${role} insert subscriptions`);
    }
    check(reachable.length === 0, `functions and the log are for the service role only${reachable.length ? ` (${reachable.join("; ")})` : ""}`);
    check(refused(`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ('${CAT}', 'https://fcm.googleapis.com/x', '${anaPhone.p256dh}', '${anaPhone.auth}')`) !== "", "the table itself refuses a guest's subscription (no profile)");
    const r = db.psql(`SELECT accounts.forget_user('${DAN}')`);
    check(r.ok && !/ERROR/.test(r.err) && subs(DAN) === 0 && q(`SELECT count(*) FROM notification_log WHERE user_id = '${DAN}'`) === "0", "an account's removal takes its subscriptions and log with it");
  });
}

/* =================================================================== run */

await pureChecks();
await workerChecks();
await phoneChecks();

let db: LocalDb | null = null;
let rest: RestServer | null = null;
if (!postgresBin()) {
  restore();
  if (process.env["CI"]) {
    console.log(`push-notifications-check: ${passes} passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL`);
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: the database part not run (CI runs it)");
  console.log(`push-notifications-check: ${passes} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
}
try {
  db = startLocalDb("push-check-");
  check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
  rest = await startRestServer(db.socketDir);
  process.env["SUPABASE_URL"] = rest.url;
  process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
  process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
  const people = Object.values(ACCOUNTS).map((id) => `('${id}', false, '${id.slice(-4)}@example.com')`).join(", ");
  db.psql(`INSERT INTO auth.users (id, is_anonymous, email) VALUES ${people}, ('${CAT}', true, NULL)`);
  await installServerFnPlugin();
  await databaseChecks(db, rest);
} catch (err) {
  check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  await rest?.stop();
  db?.stop();
}

restore();
console.log(`push-notifications-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: delivery, the six events, the cap and quiet hours, the reminder, subscriptions, the switch and RLS hold.");
process.exit(0);
