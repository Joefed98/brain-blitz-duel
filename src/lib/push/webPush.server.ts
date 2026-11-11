/**
 * Standard web push with Joulz's own VAPID keys (wave 2 train B, session B2; docs/push-notifications.md). No package and
 * no third-party notification service: the message is encrypted for the device with RFC 8291 (aes128gcm) and signed
 * with RFC 8292 (VAPID, an ES256 JWT), all in WebCrypto, which the Worker, Bun and Node share; then POSTed to the push
 * service the browser named in its subscription (Apple, Google, Mozilla, Microsoft). Server only.
 *
 * The private key is the Worker secret VAPID_PRIVATE_KEY (base64url, the 32-byte P-256 scalar); the public key is the
 * public setting PUSH_PUBLIC_KEY (src/config/pushConfig.ts). Both must be set or nothing sends.
 */

import { PUSH_PUBLIC_KEY, PUSH_SUBJECT } from "@/config/pushConfig";

const enc = new TextEncoder();

export function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(text: string): Uint8Array {
  const s = text.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "===".slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** A plain ArrayBuffer copy (WebCrypto's BufferSource, whatever buffer the bytes sit in). */
const buf = (bytes: Uint8Array): ArrayBuffer => bytes.slice().buffer as ArrayBuffer;

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", buf(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, buf(data)));
}

/** A P-256 public key as the 65-byte uncompressed point (0x04 || x || y): its x and y as JWK fields. */
function pointToJwkXY(point: Uint8Array): { x: string; y: string } {
  if (point.length !== 65 || point[0] !== 4) throw new Error("not an uncompressed P-256 point");
  return { x: b64urlEncode(point.slice(1, 33)), y: b64urlEncode(point.slice(33, 65)) };
}

/** Imports a P-256 key pair from its raw scalar and public point (for ECDH or ECDSA). */
async function importPrivate(d: Uint8Array, publicPoint: Uint8Array, use: "ECDH" | "ECDSA"): Promise<CryptoKey> {
  const jwk: JsonWebKey = { kty: "EC", crv: "P-256", d: b64urlEncode(d), ...pointToJwkXY(publicPoint), ext: true };
  return use === "ECDH"
    ? crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"])
    : crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function importPublicEcdh(point: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", buf(point), { name: "ECDH", namedCurve: "P-256" }, false, []);
}

/** A fresh P-256 key pair as raw bytes (the VAPID key script and each message's one-off sender key). */
export async function generateP256(): Promise<{ d: Uint8Array; publicPoint: Uint8Array }> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const publicPoint = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  return { d: b64urlDecode(jwk.d ?? ""), publicPoint };
}

/** The record size written in the header; a notification is far smaller, so one record. */
const RECORD_SIZE = 4096;

/**
 * RFC 8291 section 3 and RFC 8188: the aes128gcm body for one message to one device. `sender` and `salt` are fixed only
 * by the checks (RFC 8291 appendix A's example); normally both are fresh for every message.
 */
export async function encryptPayload(input: {
  plaintext: Uint8Array;
  /** The subscription's p256dh (65 bytes, base64url). */
  p256dh: string;
  /** The subscription's auth secret (16 bytes, base64url). */
  auth: string;
  sender?: { d: Uint8Array; publicPoint: Uint8Array };
  salt?: Uint8Array;
}): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(input.p256dh);
  const authSecret = b64urlDecode(input.auth);
  if (uaPublic.length !== 65 || authSecret.length < 16) throw new Error("bad subscription keys");
  const sender = input.sender ?? (await generateP256());
  const salt = input.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const senderKey = await importPrivate(sender.d, sender.publicPoint, "ECDH");
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: await importPublicEcdh(uaPublic) }, senderKey, 256),
  );
  // HKDF (SHA-256) by hand: one block of output is all any step needs.
  const prkKey = await hmac(authSecret, ecdhSecret);
  const keyInfo = concat(enc.encode("WebPush: info\0"), uaPublic, sender.publicPoint);
  const ikm = await hmac(prkKey, concat(keyInfo, new Uint8Array([1])));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
  const key = await crypto.subtle.importKey("raw", buf(cek), { name: "AES-GCM" }, false, ["encrypt"]);
  // The last (only) record: the plaintext then the 0x02 delimiter, no padding.
  const padded = concat(input.plaintext, new Uint8Array([2]));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: buf(nonce) }, key, buf(padded)));
  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, RECORD_SIZE);
  header[20] = sender.publicPoint.length;
  return concat(header, sender.publicPoint, cipher);
}

/**
 * The VAPID keys: the public setting and the Worker secret. Null while either is missing (nothing sends). The checks,
 * which can't change the public setting, give the public key as the environment's VAPID_PUBLIC_KEY (used only while the
 * setting is empty; a phone can't subscribe without the setting, so the live app is unchanged by it).
 */
export function vapidKeys(env: { publicKey?: string; privateKey?: string } = {}): { publicKey: string; privateKey: string } | null {
  const publicKey = (env.publicKey ?? (PUSH_PUBLIC_KEY || process.env["VAPID_PUBLIC_KEY"] || "")).trim();
  const privateKey = (env.privateKey ?? process.env["VAPID_PRIVATE_KEY"] ?? "").trim();
  if (!publicKey || !privateKey) return null;
  try {
    if (b64urlDecode(publicKey).length !== 65 || b64urlDecode(privateKey).length !== 32) return null;
  } catch {
    return null;
  }
  return { publicKey, privateKey };
}

/** RFC 8292: the Authorization header for a push service's origin, a JWT valid 12 hours. */
export async function vapidAuthorization(
  endpoint: string,
  keys: { publicKey: string; privateKey: string },
  nowMs: number,
  subject: string = PUSH_SUBJECT,
): Promise<string> {
  const audience = new URL(endpoint).origin;
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64urlEncode(
    enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(nowMs / 1000) + 12 * 3600, sub: subject })),
  );
  const signingKey = await importPrivate(b64urlDecode(keys.privateKey), b64urlDecode(keys.publicKey), "ECDSA");
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signingKey, buf(enc.encode(`${header}.${claims}`))),
  );
  return `vapid t=${header}.${claims}.${b64urlEncode(signature)}, k=${keys.publicKey}`;
}

/**
 * The push services browsers use (by host). A subscription naming anywhere else is refused when it is saved and never
 * sent to, so the Worker never POSTs to an address a caller chose.
 */
const PUSH_HOST_SUFFIXES = [
  ".push.apple.com",
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
  ".notify.windows.com",
];

export function isPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 1024) return false;
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOST_SUFFIXES.some((s) => (s.startsWith(".") ? host.endsWith(s) : host === s));
}

export type PushOutcome = "sent" | "gone" | "failed";

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** How a push service's answer reads: 201/202 sent, 404/410 the subscription is gone, anything else failed. */
export function outcomeOf(status: number): PushOutcome {
  if (status >= 200 && status < 300) return "sent";
  if (status === 404 || status === 410) return "gone";
  return "failed";
}

/** Checks only: the push service every send uses when its caller gives none (a stand-in, never the network). */
let fetchForChecks: typeof fetch | null = null;
export function setPushFetchForChecks(stand: typeof fetch | null): void {
  fetchForChecks = stand;
}

/** Sends one encrypted message. Never throws: a network error or a refusal is "failed". */
export async function sendPush(
  target: PushTarget,
  payload: unknown,
  opts: {
    keys: { publicKey: string; privateKey: string };
    nowMs: number;
    /** How long the push service may hold it for an offline phone (seconds). */
    ttlSeconds: number;
    urgency?: "normal" | "high";
    /** A push service replaces an undelivered message with the same topic (≤ 32 URL-safe characters). */
    topic?: string;
    fetchImpl?: typeof fetch | undefined;
  },
): Promise<{ outcome: PushOutcome; status: number }> {
  if (!isPushEndpoint(target.endpoint)) return { outcome: "gone", status: 0 };
  try {
    const body = await encryptPayload({ plaintext: enc.encode(JSON.stringify(payload)), p256dh: target.p256dh, auth: target.auth });
    const headers: Record<string, string> = {
      authorization: await vapidAuthorization(target.endpoint, opts.keys, opts.nowMs),
      "content-encoding": "aes128gcm",
      "content-type": "application/octet-stream",
      ttl: String(Math.max(0, Math.floor(opts.ttlSeconds))),
      urgency: opts.urgency ?? "normal",
    };
    if (opts.topic && /^[A-Za-z0-9_-]{1,32}$/.test(opts.topic)) headers["topic"] = opts.topic;
    const response = await (opts.fetchImpl ?? fetchForChecks ?? fetch)(target.endpoint, { method: "POST", headers, body: buf(body) });
    return { outcome: outcomeOf(response.status), status: response.status };
  } catch {
    return { outcome: "failed", status: 0 };
  }
}
