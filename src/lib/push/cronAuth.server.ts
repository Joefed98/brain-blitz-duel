/**
 * The scheduler's key for the Daily reminder route (wave 2 train B, session B2): `Authorization: Bearer <PUSH_CRON_SECRET>`
 * (the Worker secret; GitHub's push-reminder workflow sends the same value). No secret set: the route refuses every
 * call. Compared as SHA-256 digests in constant time.
 */

const enc = new TextEncoder();

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(value)));
}

export async function cronAuthorised(header: string | null, secret: string | undefined = process.env["PUSH_CRON_SECRET"]): Promise<boolean> {
  if (!secret || secret.length < 32) return false;
  const match = /^Bearer ([^\s,]+)$/.exec(header ?? "");
  if (!match) return false;
  const [a, b] = await Promise.all([digest(match[1]!), digest(secret)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}
