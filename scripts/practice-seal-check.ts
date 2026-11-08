/**
 * practice-seal-check (8 Nov 2026, decision D5 in docs/supabase-move/investigation.md; security fix L8): practice's
 * seal (live practice deals and offline packs, src/lib/duel/practiceSeal.server.ts) uses its own key,
 * PRACTICE_SEAL_KEY, when the server has one, and marks those tokens with the key id `k2.`; tokens without the id open
 * with the key derived from the service-role key as before.
 *
 *   1. PRACTICE_SEAL_KEY unset (or empty): tokens are exactly the old shape (iv.cipher, no id), sealed with SHA-256 of
 *      the service-role key in AES-GCM, and a token sealed that way by hand opens.
 *   2. PRACTICE_SEAL_KEY set: new tokens carry `k2.`, are not sealed with the service-role key, and keep opening after
 *      the service-role key changes (the Supabase move); tokens sealed before the key was set (no id) still open while
 *      the service-role key is unchanged.
 *   3. Refusals: a tampered token, a `k2.` token under a different or missing PRACTICE_SEAL_KEY, a pre-key token after
 *      the service-role key changed, and malformed tokens (empty, too many parts, an id with no body).
 *   4. sealDeal / openDeal (H1's digest) round-trip on dealt puzzles under both keys and refuse a changed public half;
 *      practice.functions.ts seals and opens only through practiceSeal.server.ts.
 *
 * Not covered here: production's refusal to seal without a service-role key (it reads the build's import.meta.env.PROD).
 *
 *   bun scripts/practice-seal-check.ts
 */
import { readFileSync } from "node:fs";

import { generatePuzzle } from "../src/lib/duel/generate.server";
import { openDeal, seal, sealDeal, unsealRaw } from "../src/lib/duel/practiceSeal.server";
import { splitPuzzle } from "../src/lib/duel/secrets";
import type { PuzzleType } from "../src/lib/duel/types";

const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else failures.push(message);
};

const env = process.env as Record<string, string | undefined>;
function setEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
}

async function opens(sealed: string): Promise<Record<string, unknown> | null> {
  try {
    return await unsealRaw(sealed);
  } catch {
    return null;
  }
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
async function keyFrom(material: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}
/** A token sealed by hand the old way: SHA-256 of `material`, AES-GCM, iv.cipher. */
async function oldToken(payload: unknown, material: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFrom(material), new TextEncoder().encode(JSON.stringify(payload))));
  return `${toBase64(iv)}.${toBase64(cipher)}`;
}
/** Whether a token's body (no id) decrypts with SHA-256 of `material`. */
async function decryptsWith(token: string, material: string): Promise<boolean> {
  const parts = token.split(".");
  const [iv, cipher] = parts.length === 3 ? parts.slice(1) : parts;
  try {
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv!) }, await keyFrom(material), fromBase64(cipher!));
    return true;
  } catch {
    return false;
  }
}
function tamper(token: string): string {
  const parts = token.split(".");
  const bytes = fromBase64(parts.at(-1)!);
  bytes[0] = bytes[0]! ^ 0xff;
  parts[parts.length - 1] = toBase64(bytes);
  return parts.join(".");
}

const SERVICE = "service-role-key-before-the-move";
const PAYLOAD = { type: "sudoku", answer: [1, 2, 3], nested: { a: "b" } };

// 1. No PRACTICE_SEAL_KEY: the old token, the old key.
for (const unset of [undefined, ""]) {
  setEnv({ SUPABASE_SERVICE_ROLE_KEY: SERVICE, PRACTICE_SEAL_KEY: unset });
  const label = unset === undefined ? "unset" : "empty";
  const token = await seal(PAYLOAD);
  check(token.split(".").length === 2 && !token.startsWith("k2."), `PRACTICE_SEAL_KEY ${label}: a token with a key id (${token.slice(0, 12)}…)`);
  check(await decryptsWith(token, SERVICE), `PRACTICE_SEAL_KEY ${label}: the token isn't sealed with the service-role key's digest`);
  check(JSON.stringify(await opens(token)) === JSON.stringify(PAYLOAD), `PRACTICE_SEAL_KEY ${label}: a new token doesn't open`);
  const handmade = await oldToken(PAYLOAD, SERVICE);
  check(JSON.stringify(await opens(handmade)) === JSON.stringify(PAYLOAD), `PRACTICE_SEAL_KEY ${label}: a token sealed the old way doesn't open`);
}

// 2. PRACTICE_SEAL_KEY set: k2. tokens on their own key; pre-key tokens still open.
setEnv({ SUPABASE_SERVICE_ROLE_KEY: SERVICE, PRACTICE_SEAL_KEY: undefined });
const preKey = await seal(PAYLOAD);
setEnv({ PRACTICE_SEAL_KEY: "practice-key-1" });
const withKey = await seal(PAYLOAD);
check(withKey.startsWith("k2.") && withKey.split(".").length === 3, `PRACTICE_SEAL_KEY set: the token has no k2. id (${withKey.slice(0, 12)}…)`);
check(!(await decryptsWith(withKey, SERVICE)), "PRACTICE_SEAL_KEY set: the token still opens with the service-role key");
check(await decryptsWith(withKey, "practice-seal:practice-key-1"), "PRACTICE_SEAL_KEY set: the token isn't sealed with the practice key");
check(JSON.stringify(await opens(withKey)) === JSON.stringify(PAYLOAD), "PRACTICE_SEAL_KEY set: a k2. token doesn't open");
check(JSON.stringify(await opens(preKey)) === JSON.stringify(PAYLOAD), "PRACTICE_SEAL_KEY set: a token sealed before the key was set doesn't open");
// The Supabase move: the service-role key changes; k2. tokens keep opening.
setEnv({ SUPABASE_SERVICE_ROLE_KEY: "service-role-key-after-the-move" });
check(JSON.stringify(await opens(withKey)) === JSON.stringify(PAYLOAD), "after the service-role key changed, a k2. token no longer opens");

// 3. Refusals.
check((await opens(preKey)) === null, "after the service-role key changed, a pre-key token still opens");
setEnv({ SUPABASE_SERVICE_ROLE_KEY: SERVICE, PRACTICE_SEAL_KEY: "practice-key-1" });
check((await opens(tamper(withKey))) === null, "a tampered k2. token opens");
check((await opens(tamper(preKey))) === null, "a tampered pre-key token opens");
setEnv({ PRACTICE_SEAL_KEY: "practice-key-2" });
check((await opens(withKey)) === null, "a k2. token opens under a different PRACTICE_SEAL_KEY");
setEnv({ PRACTICE_SEAL_KEY: undefined });
check((await opens(withKey)) === null, "a k2. token opens with PRACTICE_SEAL_KEY unset");
for (const bad of ["", "abc", "k2.", "k2.onlyone", "a.b.c", "k2.a.b.c", "a.b.c.d", withKey.replace(/^k2\./, "k3.")]) {
  check((await opens(bad)) === null, `a malformed token opens: ${JSON.stringify(bad.slice(0, 24))}`);
}

// 4. sealDeal / openDeal round-trip on dealt puzzles under both keys; a changed public half is refused.
const TYPES: PuzzleType[] = ["sudoku", "tower", "flood"];
for (const practiceKey of [undefined, "practice-key-1"]) {
  setEnv({ SUPABASE_SERVICE_ROLE_KEY: SERVICE, PRACTICE_SEAL_KEY: practiceKey });
  for (const type of TYPES) {
    const puzzle = await generatePuzzle(type, `practice-seal-${type}`);
    const { pub, priv } = splitPuzzle(puzzle);
    const token = await sealDeal(pub, priv as Record<string, unknown>, { __example: 1 });
    const tag = `${type}${practiceKey ? " (k2.)" : ""}`;
    check(token.startsWith("k2.") === !!practiceKey, `${tag}: sealDeal's key id doesn't follow PRACTICE_SEAL_KEY`);
    const opened = await openDeal(token, pub);
    check(!!opened && JSON.stringify(opened.priv) === JSON.stringify(priv) && opened.example === 1, `${tag}: openDeal doesn't give back the sealed half`);
    const changed = { ...pub, seed: `${String((pub as Record<string, unknown>)["seed"] ?? "")}x`, timeLimitMs: 1 };
    check((await openDeal(token, changed)) === null, `${tag}: openDeal accepts a public half that wasn't dealt`);
  }
}

// practice.functions.ts seals and opens only through practiceSeal.server.ts.
const functions = readFileSync("src/lib/duel/practice.functions.ts", "utf8");
check(!/crypto\.subtle/.test(functions), "practice.functions.ts uses crypto.subtle itself");
check(/import\("\.\/practiceSeal\.server"\)/.test(functions), "practice.functions.ts doesn't seal through practiceSeal.server.ts");

console.log(failures.length ? `FAIL: practice-seal-check, ${failures.length} of ${passes + failures.length} failed` : `PASS: practice-seal-check, ${passes} checks (old tokens on the service-role key, k2. tokens on PRACTICE_SEAL_KEY through the move, refusals, sealDeal/openDeal)`);
for (const f of failures) console.log(`  - ${f}`);
process.exit(failures.length ? 1 : 0);
