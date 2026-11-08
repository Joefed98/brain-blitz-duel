/**
 * Practice tokens (server-only): the sealed private half of a practice deal, with a digest of the public half it was
 * dealt with. Moved out of practice.functions.ts (Nov 2026 security fixes) so security-fixes-check can prove it.
 */
import { splitPuzzle } from "./secrets";
import { PUZZLE_TYPES } from "./catalogue";
import type { PuzzleData } from "./types";

type Loose = Record<string, unknown>;

/**
 * Security fix L8 (Nov 2026 audit): practice tokens are sealed with their own key, PRACTICE_SEAL_KEY, when the server
 * has one, and say so with a key id (`k2.` before the token), so rotating the service-role key no longer breaks every
 * offline pack. Tokens without the id (every token before this, or a server without PRACTICE_SEAL_KEY) open with the
 * key derived from the service-role key as before.
 */
const SEAL_KEY_ID = "k2";

async function keyFrom(material: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** The key tokens without a key id use (the service-role key's digest). */
async function sealKey(): Promise<CryptoKey> {
  const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  // The public URL is no secret: only a dev server (practice in checks) may seal with it.
  if (!secret && import.meta.env.PROD) throw new Error("Practice is down for a moment. Try again shortly.");
  const material = secret ?? process.env["SUPABASE_URL"] ?? "";
  return keyFrom(material);
}

/** The dedicated practice key, or null when the server has none. */
async function dedicatedSealKey(): Promise<CryptoKey | null> {
  const secret = process.env["PRACTICE_SEAL_KEY"];
  if (!secret) return null;
  return keyFrom(`practice-seal:${secret}`);
}

function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += String.fromCharCode(byte);
  return btoa(out);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const raw = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function seal(payload: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const dedicated = await dedicatedSealKey();
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, dedicated ?? (await sealKey()), data),
  );
  const token = `${toBase64(iv)}.${toBase64(cipher)}`;
  return dedicated ? `${SEAL_KEY_ID}.${token}` : token;
}

/**
 * Security fix H1 (Nov 2026 audit): every practice token seals a digest of the public half it was dealt with
 * (`__pub`), and every function that merges a client's public half with a sealed half opens it through `openDeal`,
 * which refuses a token without the digest or a public half that differs from the one dealt. So a signed-out caller
 * can't grade, check or save a board (Hanoi's disc count, a link pattern, a seed, a stamp, a clock) the server never
 * dealt. The digest is taken over the public fields of whatever the phone sends (`publicHalf`), so a phone that sends
 * the full puzzle back (the reveal's demo save) still matches, and secret fields it sends are never merged.
 */
export interface OpenedDeal {
  /** The sealed half with every tag removed: what mergePuzzle takes. */
  priv: Loose;
  /** The public half the digest was checked on (the phone's, secret fields dropped). */
  pub: PuzzleData;
  example: unknown;
  pack: unknown;
  /** The server's time when the deal was sealed (practiceReceipt.ts), or undefined for a token sealed without one. */
  dealtAt: number | undefined;
}

/** The phone's puzzle with every secret field of its type dropped (null for an unknown type). */
export function publicHalf(puzzle: unknown): PuzzleData | null {
  if (!puzzle || typeof puzzle !== "object") return null;
  const type = (puzzle as Loose)["type"];
  if (typeof type !== "string" || !(PUZZLE_TYPES as string[]).includes(type)) return null;
  return splitPuzzle(puzzle as PuzzleData).pub;
}

/** Seals a deal's private half with its tags and the public half's digest. */
export async function sealDeal(pub: PuzzleData, priv: Loose, tags: Loose = {}): Promise<string> {
  return seal({ ...priv, ...tags, __pub: await pubDigest(pub) });
}

/** Opens a token for the public half the phone sent; null when the seal, the type or the digest doesn't hold. */
export async function openDeal(sealed: unknown, puzzle: unknown): Promise<OpenedDeal | null> {
  let raw: Loose;
  try {
    raw = await unsealRaw(String(sealed ?? ""));
  } catch {
    return null;
  }
  const { __example: example, __pack: pack, __pub: digest, __dealtAt: at, ...priv } = raw;
  const pub = publicHalf(puzzle);
  if (!pub || priv["type"] !== pub.type) return null;
  if (typeof digest !== "string" || digest !== (await pubDigest(pub))) return null;
  const dealtAt = typeof at === "number" && Number.isFinite(at) ? at : undefined;
  return { priv, pub, example, pack, dealtAt };
}

/** A short digest naming one sealed deal, so a start token can't be carried over to another (practiceReceipt.ts). */
async function tokenDigest(sealed: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sealed));
  return toBase64(new Uint8Array(digest));
}

/** The round's start token for a deal (practiceReceipt.ts): the server's time, sealed and tied to that deal's token. */
export async function sealStart(sealed: string): Promise<string> {
  await unsealRaw(sealed);
  return seal({ __start: Date.now(), __for: await tokenDigest(sealed) });
}

/** A start token's time when it is valid for this deal's token, else undefined. */
export async function startAtFor(token: unknown, sealed: string): Promise<number | undefined> {
  if (typeof token !== "string" || !token) return undefined;
  try {
    const raw = await unsealRaw(token);
    if (raw["__for"] !== (await tokenDigest(sealed))) return undefined;
    const at = raw["__start"];
    return typeof at === "number" && Number.isFinite(at) ? at : undefined;
  } catch {
    return undefined;
  }
}

/** openDeal for the live calls: a refused token is the usual "didn't load" error. */
export async function openDealOrThrow(sealed: unknown, puzzle: unknown): Promise<OpenedDeal> {
  const opened = await openDeal(sealed, puzzle);
  if (!opened) throw new Error("That puzzle didn’t load. Try another.");
  return opened;
}

export async function unsealRaw(sealed: string): Promise<Loose> {
  const parts = sealed.split(".");
  const withId = parts.length === 3 && parts[0] === SEAL_KEY_ID;
  const [ivPart, cipherPart] = withId ? parts.slice(1) : parts;
  if (!ivPart || !cipherPart || parts.length > (withId ? 3 : 2)) throw new Error("That puzzle didn’t load. Try another.");
  const key = withId ? await dedicatedSealKey() : await sealKey();
  if (!key) throw new Error("That puzzle didn’t load. Try another.");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(ivPart) },
    key,
    fromBase64(cipherPart),
  );
  return JSON.parse(new TextDecoder().decode(plain)) as Loose;
}


/** Keys sorted, undefined dropped: the same text on the server that dealt and the server that grades. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? "null" : canonical(v))).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Loose)
      .filter(([, v]) => v !== undefined && typeof v !== "function")
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export async function pubDigest(pub: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(pub)));
  return toBase64(new Uint8Array(digest));
}

