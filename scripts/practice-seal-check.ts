/**
 * practice-seal-check (7 Nov 2026, decision D5 in docs/supabase-move/investigation.md): practice's seal
 * (live practice deals and offline packs) uses its own key, PRACTICE_SEAL_KEY, when it is set, and falls back
 * to today's key (SUPABASE_SERVICE_ROLE_KEY; on a dev server only, the public URL) when it is not.
 *
 *   1. With PRACTICE_SEAL_KEY unset, seals are exactly today's: a token sealed the old way opens, and a new token
 *      opens with the old derivation (SHA-256 of the service-role key, AES-GCM).
 *   2. Packs sealed with PRACTICE_SEAL_KEY open, are not sealed with the service-role key, and keep opening after
 *      the service-role key changes (the Supabase move); packs sealed before it was set open until then.
 *   3. Production refuses to seal without a secret; an empty value counts as unset; a tampered or wrong-key
 *      token is refused; practice.functions.ts seals only through practiceSeal.ts.
 *
 *   bun scripts/practice-seal-check.ts
 */
import { readFileSync } from "node:fs";

import { generatePuzzle } from "../src/lib/duel/generate.server";
import { sealMaterials, sealPractice, unsealPractice, type SealOptions } from "../src/lib/duel/practiceSeal";
import { splitPuzzle } from "../src/lib/duel/secrets";
import type { PuzzleType } from "../src/lib/duel/types";

const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else failures.push(message);
};

async function opens(sealed: string, options: SealOptions): Promise<Record<string, unknown> | null> {
  try {
    return await unsealPractice(sealed, options);
  } catch {
    return null;
  }
}

async function throws(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/* The seal as it was on main before D5 (practice.functions.ts sealKey / seal / unsealRaw), for identity. */
async function oldKey(material: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (v: string) => Uint8Array.from(atob(v), (c) => c.charCodeAt(0));
async function oldSeal(payload: unknown, material: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await oldKey(material), data));
  return `${b64(iv)}.${b64(cipher)}`;
}
async function oldUnseal(sealed: string, material: string): Promise<unknown | null> {
  const [iv, cipher] = sealed.split(".");
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv!) }, await oldKey(material), unb64(cipher!));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    return null;
  }
}

const SERVICE = "check-service-role-key-old";
const SERVICE_NEW = "check-service-role-key-after-move";
const OWN = "check-practice-seal-key-0123456789abcdef";
const URL = "https://example.supabase.co";

const today: SealOptions = { prod: true, env: { SUPABASE_SERVICE_ROLE_KEY: SERVICE, SUPABASE_URL: URL } };
const withOwn: SealOptions = { prod: true, env: { PRACTICE_SEAL_KEY: OWN, SUPABASE_SERVICE_ROLE_KEY: SERVICE, SUPABASE_URL: URL } };
const afterMove: SealOptions = { prod: true, env: { PRACTICE_SEAL_KEY: OWN, SUPABASE_SERVICE_ROLE_KEY: SERVICE_NEW, SUPABASE_URL: URL } };
const ownOnly: SealOptions = { prod: true, env: { PRACTICE_SEAL_KEY: OWN } };

// Real pack payloads: a deal's private half plus the pack's tags, as practicePackFn seals them.
const TYPES: PuzzleType[] = ["shikaku", "sudoku", "flood", "kakuro"];
const packs = TYPES.map((type, i) => {
  const { pub, priv } = splitPuzzle(generatePuzzle(type, { bankSeed: 1000 + i }));
  return { type, payload: { ...(priv as Record<string, unknown>), __pack: 1000 + i, __pub: `digest-${type}` }, pub };
});
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// 1. The fallback: PRACTICE_SEAL_KEY unset is today's seal, byte for byte in its key.
check(same(sealMaterials(today), [SERVICE]), "with no PRACTICE_SEAL_KEY the seal key is not the service-role key alone");
for (const { type, payload } of packs) {
  const sealed = await sealPractice(payload, today);
  check(same(await oldUnseal(sealed, SERVICE), payload), `${type}: a fallback seal does not open with the old derivation`);
  const old = await oldSeal(payload, SERVICE);
  check(same(await opens(old, today), payload), `${type}: a token sealed the old way does not open on the fallback`);
}
const dev: SealOptions = { prod: false, env: { SUPABASE_URL: URL } };
check(same(sealMaterials(dev), [URL]), "a dev server without secrets does not fall back to the URL");
check(same(await opens(await oldSeal({ a: 1 }, URL), dev), { a: 1 }), "a dev-server token sealed the old way does not open");
check(same(sealMaterials({ prod: false, env: {} }), [""]), "a dev server with nothing set does not seal as before (empty material)");
const emptyOwn: SealOptions = { prod: true, env: { PRACTICE_SEAL_KEY: "  ", SUPABASE_SERVICE_ROLE_KEY: SERVICE } };
check(same(sealMaterials(emptyOwn), [SERVICE]), "an empty PRACTICE_SEAL_KEY is not treated as unset");

// 2. The new key: packs sealed with it verify, and survive the service-role key changing.
check(same(sealMaterials(withOwn), [OWN, SERVICE]), "with PRACTICE_SEAL_KEY set, seals do not use it first with the service key as fallback");
for (const { type, payload, pub } of packs) {
  const sealed = await sealPractice(payload, withOwn);
  const opened = await opens(sealed, withOwn);
  check(same(opened, payload), `${type}: a pack sealed with PRACTICE_SEAL_KEY does not verify`);
  check(opened?.["__pack"] === payload.__pack && opened?.["__pub"] === payload.__pub, `${type}: the pack's tags did not survive`);
  check(!JSON.stringify(pub).includes(sealed.slice(0, 8)), `${type}: the sealed token leaks into the public half`);
  check((await oldUnseal(sealed, SERVICE)) === null, `${type}: a new-key pack opens with the service-role key (not sealed with its own key)`);
  check(same(await oldUnseal(sealed, OWN), payload), `${type}: a new-key pack is not SHA-256(PRACTICE_SEAL_KEY) AES-GCM`);
  check(same(await opens(sealed, afterMove), payload), `${type}: a new-key pack stops verifying when the service-role key changes`);
  check(same(await opens(sealed, ownOnly), payload), `${type}: a new-key pack needs the service-role key to verify`);
  check((await opens(sealed, today)) === null, `${type}: a new-key pack opens on a server without PRACTICE_SEAL_KEY`);

  // Packs already on phones (sealed before PRACTICE_SEAL_KEY was set) keep verifying while the service key is the same.
  const before = await sealPractice(payload, today);
  check(same(await opens(before, withOwn), payload), `${type}: a pack sealed before PRACTICE_SEAL_KEY was set no longer verifies`);
  check((await opens(before, afterMove)) === null, `${type}: an old-key pack verifies after the service key changed (expected one-off loss)`);
}

// 3. Refusals.
check((await throws(() => sealPractice({ a: 1 }, { prod: true, env: { SUPABASE_URL: URL } }))) !== null, "production seals with no secret");
check(
  (await throws(() => sealPractice({ a: 1 }, { prod: true, env: { PRACTICE_SEAL_KEY: "", SUPABASE_URL: URL } }))) !== null,
  "production seals with an empty PRACTICE_SEAL_KEY and no service key",
);
check((await throws(() => sealPractice({ a: 1 }, ownOnly))) === null, "production refuses to seal with PRACTICE_SEAL_KEY alone");
const good = await sealPractice({ a: 1 }, withOwn);
const [iv, cipher] = good.split(".");
const flipped = unb64(cipher!);
flipped[0] = flipped[0]! ^ 1;
check((await opens(`${iv}.${b64(flipped)}`, withOwn)) === null, "a tampered token opens");
check((await opens(good, { prod: true, env: { PRACTICE_SEAL_KEY: "another-key", SUPABASE_SERVICE_ROLE_KEY: "another" } })) === null, "a token opens with the wrong keys");
check((await throws(() => unsealPractice("no-dot", withOwn))) !== null, "a malformed token opens");

// The server functions seal only through practiceSeal.ts.
const fns = readFileSync("src/lib/duel/practice.functions.ts", "utf8");
check(/from "\.\/practiceSeal"/.test(fns), "practice.functions.ts does not import practiceSeal.ts");
check(!/crypto\.subtle\.(encrypt|decrypt|importKey)/.test(fns), "practice.functions.ts still encrypts on its own");
check(!/function sealKey/.test(fns), "practice.functions.ts still has its own sealKey");
const sealSrc = readFileSync("src/lib/duel/practiceSeal.ts", "utf8");
check(sealSrc.includes('"PRACTICE_SEAL_KEY"') && sealSrc.includes('"SUPABASE_SERVICE_ROLE_KEY"'), "practiceSeal.ts does not read both keys");
const doc = readFileSync("docs/supabase-move/investigation.md", "utf8");
check(/\| `PRACTICE_SEAL_KEY` \|/.test(doc), "the investigation doc's secrets table has no PRACTICE_SEAL_KEY row");

if (failures.length) {
  console.log(`practice-seal-check: FAIL (${failures.length} failed, ${passes} passed)`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`practice-seal-check: ${passes} checks passed`);
