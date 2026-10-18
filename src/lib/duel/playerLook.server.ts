/**
 * Server side of player colours and icons (playerLook.ts): seating a player with a free colour,
 * changing one in the lobby and storing slot colours before Play again. Display data only, written
 * with the service-role client like every other player field; clients still can't write the table.
 * Everything here works before the colour/icon migration is applied: rows are then written
 * without the columns and every phone shows slot colours.
 */
import {
  isPlayerColour,
  isPlayerIcon,
  pickJoinColour,
  resolvePlayerLooks,
  takenColours,
  takenIcons,
} from "./playerLook";
import type { DuelPlayerRow } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const UNIQUE_VIOLATION = "23505";

/** What a phone sends with a create or join: the colour and icon it last chose. */
export interface LookPreference {
  colour?: number;
  icon?: string | null;
}

/**
 * Whether duel_players has the colour and icon columns (their migration applied). A "missing"
 * answer is re-checked after a minute, so applying the migration needs no redeploy.
 */
let lookColumns: { present: boolean; at: number } | null = null;
export async function hasLookColumns(client: any): Promise<boolean> {
  if (lookColumns && (lookColumns.present || Date.now() - lookColumns.at < 60_000)) return lookColumns.present;
  const { error } = await client.from("duel_players").select("colour, icon").limit(1);
  lookColumns = { present: !error, at: Date.now() };
  return lookColumns.present;
}

/** Checks only: forget the cached answer. */
export function forgetLookColumns(): void {
  lookColumns = null;
}

/** A unique-index clash on the room's colours (duel_players_duel_colour_key), not on slot or user. */
function colourClash(error: { code?: string; message?: string } | null | undefined): boolean {
  return !!error && error.code === UNIQUE_VIOLATION && /colour/.test(error.message ?? "");
}

async function roomPlayers(client: any, roomId: string): Promise<DuelPlayerRow[]> {
  const { data, error } = await client
    .from("duel_players")
    .select("*")
    .eq("duel_id", roomId)
    .order("player_slot");
  if (error) throw new Error(error.message);
  return (data ?? []) as DuelPlayerRow[];
}

/**
 * Stores the colour every phone already shows for rows that have none (seated before the columns
 * existed), so a later choice can't collide with one and Play again keeps them. Pass every row in
 * the room, left players included: that is how phones resolve them.
 */
export async function persistAutoColours(client: any, players: DuelPlayerRow[]): Promise<void> {
  const looks = resolvePlayerLooks(players);
  for (const player of players) {
    if (isPlayerColour(player.colour)) continue;
    const colour = looks.get(player.player_slot)?.colour;
    if (colour === undefined) continue;
    // A clash here means someone took that colour this instant; the row stays auto.
    await client.from("duel_players").update({ colour }).eq("id", player.id).is("colour", null);
  }
}

/**
 * Two phones joining at once can both read an icon as free: the one in the lower slot keeps it and
 * the other shows their initial, so a room never shows the same icon twice.
 */
async function dropSharedIcon(client: any, roomId: string, slot: number, icon: string): Promise<void> {
  const players = await roomPlayers(client, roomId);
  if (players.some((p) => p.player_slot < slot && p.icon === icon))
    await client.from("duel_players").update({ icon: null }).eq("duel_id", roomId).eq("player_slot", slot);
}

/**
 * Seats a player (`row` without colour or icon). With the columns, they get their remembered
 * colour when it is free, else the first free one from their slot's own: two phones joining at
 * once can pick the same colour, so the unique index refuses the second, which picks again from a
 * fresh read. A duplicate seat (slot or user) is ignored as before.
 */
export async function insertPlayerWithLook(
  client: any,
  row: Pick<DuelPlayerRow, "duel_id" | "player_slot" | "user_id" | "display_name" | "status">,
  look: LookPreference = {},
): Promise<void> {
  if (await hasLookColumns(client)) {
    let icon = isPlayerIcon(look.icon) ? look.icon : null;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt === 0) await persistAutoColours(client, await roomPlayers(client, row.duel_id));
      const players = await roomPlayers(client, row.duel_id);
      const colour = pickJoinColour(players, row.player_slot, look.colour);
      // A remembered icon someone here already has is dropped (the player shows their initial).
      if (icon && takenIcons(players, row.player_slot).has(icon)) icon = null;
      const { error } = await client.from("duel_players").insert({ ...row, colour, icon });
      if (!error) {
        if (icon) await dropSharedIcon(client, row.duel_id, row.player_slot, icon);
        return;
      }
      if (colourClash(error)) continue;
      if (error.code !== UNIQUE_VIOLATION) throw new Error(error.message);
      return;
    }
    // Still clashing: seat the player without a stored colour (shown as their slot colour).
    const { error } = await client.from("duel_players").insert({ ...row, icon });
    if (error && error.code !== UNIQUE_VIOLATION) throw new Error(error.message);
    return;
  }
  const { error } = await client.from("duel_players").insert(row);
  if (error && error.code !== UNIQUE_VIOLATION) throw new Error(error.message);
}

/**
 * The lobby change (setPlayerLookFn, after its room checks): my colour (any one no one else holds)
 * and/or icon (one of PLAYER_ICON_IDS no one else holds, or null for my initial). Icons have no
 * unique index: two taps in the same instant could share one, which is harmless (colours differ).
 */
export async function changePlayerLook(
  client: any,
  me: DuelPlayerRow,
  input: { colour?: number; icon?: string | null },
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!(await hasLookColumns(client))) return { ok: false, message: "Colours can't be changed yet." };
  const update: { colour?: number; icon?: string | null } = {};
  if (input.colour !== undefined) {
    if (!isPlayerColour(input.colour)) return { ok: false, message: "That isn't one of the colours." };
    update.colour = input.colour;
  }
  if (input.icon !== undefined) {
    if (input.icon !== null && !isPlayerIcon(input.icon)) return { ok: false, message: "That isn't one of the icons." };
    if (input.icon !== null && takenIcons(await roomPlayers(client, me.duel_id), me.player_slot).has(input.icon))
      return { ok: false, message: "Someone else has that icon." };
    update.icon = input.icon;
  }
  if (update.colour === undefined && update.icon === undefined) return { ok: true };
  if (update.colour !== undefined) {
    await persistAutoColours(client, await roomPlayers(client, me.duel_id));
    if (takenColours(await roomPlayers(client, me.duel_id), me.player_slot).has(update.colour))
      return { ok: false, message: "Someone else has that colour." };
  }
  const { error } = await client.from("duel_players").update(update).eq("id", me.id);
  if (colourClash(error)) return { ok: false, message: "Someone else has that colour." };
  if (error) throw new Error(error.message);
  return { ok: true };
}
