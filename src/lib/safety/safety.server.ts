/**
 * A player's own safety notices (safety, 10 Nov 2026; docs/moderation.md): what the phone shows on open (a ban, a
 * warning once, a forced rename) and the two steps a player takes (seeing the warning, picking the new name). Server
 * only. Every name goes through the one names module (src/lib/names/names.server.ts); an account's forced rename is
 * accounts' `forceRename` (kind 'forced': it never counts towards the change limit).
 */

import { forceRename } from "@/lib/account/account.server";
import type { Db } from "@/lib/data/db.server";
import { ackModeration } from "@/lib/data/moderation.server";
import { readProfile } from "@/lib/data/profiles.server";
import { cleanDisplayName } from "@/lib/duel/displayName.server";
import { checkGuestName, energyName, type Rand } from "@/lib/names/names.server";

import { playerSafety } from "./moderation.server";
import type { SafetyNotices } from "./notices";
import { BANNED_MESSAGE } from "./reports";

export type { SafetyNotices } from "./notices";

const RENAME_NOTE = "moderation: temporary name";

/**
 * The notices for the player's open. A forced rename gets its temporary energy name here, once: an account is renamed
 * to it at once (a forced rename), a guest is given one for the phone to use as their room name.
 */
export async function safetyNotices(client: Db, userId: string, rand?: Rand): Promise<SafetyNotices> {
  const status = await playerSafety(client, userId);
  let rename: SafetyNotices["rename"] = null;
  if (status.rename) {
    const { data: profile } = await readProfile(client, userId);
    const kind = profile ? "account" : "guest";
    let tempName: string | null = profile?.username ?? null;
    if (!status.renameTempApplied) {
      if (profile) {
        for (let tries = 0; tries < 5; tries++) {
          const renamed = await forceRename(client, userId, energyName("username", rand), RENAME_NOTE);
          if (renamed.ok) {
            tempName = renamed.username;
            break;
          }
        }
      } else {
        tempName = energyName("guest", rand);
      }
      if (tempName) await ackModeration(client, userId, "rename_temp", { name: tempName });
    }
    rename = { kind, tempName: kind === "guest" && status.renameTempApplied ? null : tempName };
  }
  return {
    ok: true,
    banned: status.banned,
    bannedMessage: status.banned ? BANNED_MESSAGE : null,
    bannedUntil: status.bannedUntil,
    mutedUntil: status.mutedUntil,
    warning: status.warning,
    rename,
  };
}

/** The player has seen their warning. */
export async function ackWarning(client: Db, userId: string): Promise<{ ok: boolean }> {
  const { data } = await ackModeration(client, userId, "warning");
  return { ok: data === true };
}

export type PickNameResult =
  | { ok: true; name: string; kind: "account" | "guest" }
  | { ok: false; message: string; suggestions?: string[] | undefined };

/** The player's new name after a forced rename, through the names module; the rename is then done. */
export async function pickForcedName(client: Db, userId: string, raw: unknown): Promise<PickNameResult> {
  const status = await playerSafety(client, userId);
  if (!status.rename) return { ok: false, message: "There’s no name to change." };
  const { data: profile } = await readProfile(client, userId);
  if (profile) {
    const renamed = await forceRename(client, userId, raw, "moderation: player's new name");
    if (!renamed.ok) return { ok: false, message: renamed.message, suggestions: renamed.suggestions };
    await ackModeration(client, userId, "rename", { name: renamed.username });
    return { ok: true, name: renamed.username, kind: "account" };
  }
  const checked = checkGuestName(cleanDisplayName(raw));
  if (!checked.ok) return { ok: false, message: checked.message };
  if (!checked.name) return { ok: false, message: "Type a name." };
  await ackModeration(client, userId, "rename", { name: checked.name });
  return { ok: true, name: checked.name, kind: "guest" };
}
