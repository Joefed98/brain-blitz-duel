/* -------------------------------------------------------------------------- */
/*  The practice seal: the private half of a practice deal (live practice and  */
/*  offline packs) travels to the phone encrypted (AES-GCM) with a key only    */
/*  the server holds, and comes back to be graded here.                        */
/*                                                                             */
/*  The key (decision D5, docs/supabase-move/investigation.md):                */
/*   - PRACTICE_SEAL_KEY when it is set: its own secret, so moving or rotating */
/*     the Supabase service-role key no longer breaks packs on phones;         */
/*   - else SUPABASE_SERVICE_ROLE_KEY, today's key, so nothing changes until   */
/*     PRACTICE_SEAL_KEY is set;                                               */
/*   - else, on a dev server only (practice in checks), the public URL.        */
/*  New seals always use the first. Unsealing tries the first, then the       */
/*  service-role key, so packs and in-flight deals sealed before              */
/*  PRACTICE_SEAL_KEY was set still verify while that key is unchanged.        */
/*  AES-GCM's tag rejects a wrong key, so trying both is safe.                 */
/*                                                                             */
/*  Server only in use: every caller is a server function's handler.          */
/* -------------------------------------------------------------------------- */

type Loose = Record<string, unknown>;
type Env = Record<string, string | undefined>;

export interface SealOptions {
  /** Defaults to process.env. */
  env?: Env;
  /** Defaults to the build's production flag. */
  prod?: boolean;
}

const SEAL_DOWN = "Practice is down for a moment. Try again shortly.";

function isProd(): boolean {
  return Boolean(import.meta.env.PROD);
}

function value(env: Env, name: string): string | undefined {
  const v = env[name];
  return v && v.trim() !== "" ? v : undefined;
}

/**
 * The key materials in order: the one new seals use first, then the ones unsealing also accepts.
 * Throws in production when there is no secret at all.
 */
export function sealMaterials(options: SealOptions = {}): string[] {
  const env = options.env ?? (process.env as Env);
  const prod = options.prod ?? isProd();
  const own = value(env, "PRACTICE_SEAL_KEY");
  const legacySecret = value(env, "SUPABASE_SERVICE_ROLE_KEY");
  // The public URL is no secret: only a dev server (practice in checks) may seal with it.
  const legacy = legacySecret ?? (prod ? undefined : (env["SUPABASE_URL"] ?? ""));
  const out: string[] = [];
  if (own !== undefined) out.push(own);
  if (legacy !== undefined && legacy !== own) out.push(legacy);
  if (out.length === 0) throw new Error(SEAL_DOWN);
  return out;
}

const keyCache = new Map<string, Promise<CryptoKey>>();

function keyFor(material: string): Promise<CryptoKey> {
  let key = keyCache.get(material);
  if (!key) {
    key = crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(material))
      .then((digest) => crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]));
    keyCache.set(material, key);
  }
  return key;
}

export function toBase64(bytes: Uint8Array): string {
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

/** Seals a payload with the current key ("iv.cipher", both base64). */
export async function sealPractice(payload: unknown, options: SealOptions = {}): Promise<string> {
  const [material] = sealMaterials(options);
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await keyFor(material!), data));
  return `${toBase64(iv)}.${toBase64(cipher)}`;
}

/** Opens a sealed payload with the current key, else the fallback key; throws when neither opens it. */
export async function unsealPractice(sealed: string, options: SealOptions = {}): Promise<Loose> {
  const [ivPart, cipherPart] = sealed.split(".");
  if (!ivPart || !cipherPart) throw new Error("That puzzle didn’t load. Try another.");
  const iv = fromBase64(ivPart);
  const cipher = fromBase64(cipherPart);
  let failure: unknown;
  for (const material of sealMaterials(options)) {
    try {
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await keyFor(material), cipher);
      return JSON.parse(new TextDecoder().decode(plain)) as Loose;
    } catch (error) {
      failure = error;
    }
  }
  throw failure;
}
