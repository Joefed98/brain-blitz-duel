/**
 * A guest's name in rated play (wave 3, W3b; wave 1's decision, docs/accounts/README.md): rated play is where strangers
 * meet, so a guest never types a name there. They play under a generated energy name such as "Swift Volt 48" with a
 * Guest tag (the view's `guest`), the same name every match, worked out from their player id. Typed guest names stay
 * for rooms only. Server only.
 */
import { energyName, type Rand } from "@/lib/names/names.server";

/** A small seeded generator (FNV-1a of the id, then xorshift): the same id always gives the same name. */
function seededRand(id: string): Rand {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let x = h || 1;
  return (n: number) => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x % n;
  };
}

/** The guest's energy name ("Swift Volt 48"): fits a guest name, never refused by the name checks. */
export function guestEnergyName(userId: string): string {
  return energyName("guest", seededRand(userId));
}

/** An account's username, else the player's guest energy name (never a typed name). */
export async function ratedNameOf(
  client: import("@/lib/data/db.server").Db,
  userId: string,
): Promise<{ name: string; guest: boolean }> {
  const { accountNameOf } = await import("@/lib/names/playerName.server");
  const account = await accountNameOf(client, userId);
  return account ? { name: account, guest: false } : { name: guestEnergyName(userId), guest: true };
}
