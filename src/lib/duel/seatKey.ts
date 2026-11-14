/**
 * How a phone tells players apart in a room (Security C1b, supabase/migrations/20261117500300_public_player_ids.sql).
 *
 * Phones read every room column but the account ids: each player row carries `public_id`, the room `host_public_id`
 * and each chat message `sender_public_id`, one public id per player for life. These helpers answer a row's key: its
 * public id, or, for a row that carries none (a check's stand-in rows), its account id, so both compare the same way.
 * The phone's own key is its public id from public.my_public_id() (`myRoomKey`), or its account id where the room's
 * rows carry no public ids.
 */
import type { DuelPlayerRow, DuelRow } from "./types";

type SeatLike = Pick<DuelPlayerRow, "public_id"> & { user_id?: string | null };

/** A player row's key: its public id (or, on a stand-in row with none, its account id). */
export function seatKey(p: SeatLike | null | undefined): string | null {
  if (!p) return null;
  return p.public_id ?? p.user_id ?? null;
}

/**
 * Whether a player row is the player `key` names: by public id (a phone's key) or account id (the server's). The two
 * never collide, so shared rules (roomFlow.ts) read the same on both sides.
 */
export function isSeat(p: SeatLike | null | undefined, key: string | null | undefined): boolean {
  if (!p || !key) return false;
  return p.public_id === key || p.user_id === key;
}

/** The room's host's key, comparable with seatKey. */
export function hostKey(duel: Pick<DuelRow, "host_public_id"> & { host_user_id?: string | null } | null | undefined): string | null {
  if (!duel) return null;
  return duel.host_public_id ?? duel.host_user_id ?? null;
}

/** A chat message's sender's key, comparable with seatKey. */
export function senderKey(m: { sender_public_id?: string | null; sender_user_id?: string | null } | null | undefined): string | null {
  if (!m) return null;
  return m.sender_public_id ?? m.sender_user_id ?? null;
}

/**
 * This phone's key among `rows`: its public id where the rows carry public ids, else its account id (stand-in rows).
 * Null while the public id isn't known yet.
 */
export function myKeyAmong(rows: readonly SeatLike[], ids: { publicId: string | null; userId: string | null }): string | null {
  const carriesPublic = rows.some((r) => !!r.public_id);
  if (carriesPublic) return ids.publicId;
  return ids.userId ?? ids.publicId;
}

const publicIds = new Map<string, Promise<string | null>>();

/**
 * This device's public id (public.my_public_id(): made on first use, the same for life), cached per account for the
 * page's life. Null when it can't be read (a check's stand-in server); the caller then matches by account id.
 */
export function myPublicId(userId: string): Promise<string | null> {
  let pending = publicIds.get(userId);
  if (!pending) {
    pending = (async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const { data, error } = await supabase.rpc("my_public_id");
          if (!error && typeof data === "string" && data) return data;
          // A server without the function (or a stand-in): no public ids to match.
          if (error && /function|not found|404|PGRST202/i.test(`${error.code ?? ""} ${error.message ?? ""}`)) return null;
        } catch {
          /* a network blip: try again */
        }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
      publicIds.delete(userId);
      return null;
    })();
    publicIds.set(userId, pending);
  }
  return pending;
}
