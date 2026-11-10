import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { staleSubmissionNote } from "@/lib/appVersion";

import { type SubmitExtra } from "./grade";
import { normaliseCategories, STANDARD_CATEGORIES } from "./categories";
import { dealRoomRounds } from "./roomDeal";
import { resultColumns } from "@/lib/round/result";
import { encodeRoomSettings, readRoomSettings } from "./roomSettings";
import type { ScoringMode } from "./scoringMode";
import { puzzleRevealMs, typesInCategory } from "./catalogue";
import { puzzleCloseReason } from "./roomClose";
import { generateRoomCode } from "./puzzles";
import { linkRoomState } from "./roomLink";
import { mergePuzzle, splitPuzzle } from "./secrets";
import { allContinued, allIntroReady, betweenScreenDue, isContinuePhase } from "./roomFlow";
import {
  finishGame,
  forfeitRecord,
  leaveBetweenRoundScreen,
  recordContinue,
  recordForfeitInHistory,
  setPhase,
} from "./roomPhase.server";
import { recordTieWinnerInHistory, tieWinnerRecord } from "./historyWinner.server";
import {
  gameIndexOf,
  joinViaFrom,
  recordJoin,
  recordRoomEvent,
  recordRoundRecords,
  roundRecords,
} from "./betaRecord.server";
import { loadRoundReveal } from "./reveal.server";
import { finishedBeforeBuzzer } from "./buzzer";
import { clearSubmitted, markSubmitted } from "./finishedPing.server";
import { recordHeartbeat, withPresence } from "./presence.server";
import {
  changePlayerLook,
  hasLookColumns,
  insertPlayerWithLook,
  persistAutoColours,
  RoomSeatsError,
  type LookPreference,
} from "./playerLook.server";
import { acceptsAnswers } from "./answerWindow";
import { seatFor } from "./roomSeats";
import { DUEL_START_MS, ROUND_TITLE_MS, WINNER_REVEAL_MS } from "./startPresentation";
import {
  INACTIVE_AFTER_MISSED,
  INTRO_MS,
  INTRO_WAIT_MS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  NEXT_ROUND_AUTO_MS,
  roomCapacity,
  roomFullMessage,
  STANDINGS_MS,
  TOTAL_ROUNDS,
  MAX_ROUNDS,
  type DuelPhase,
  type DuelPlayerRow,
  type DuelRow,
  type PuzzleData,
  type PuzzleType,
  type StoredPuzzleType,
  type PuzzleCategory,
  type RoundResultRow,
} from "./types";
import { dbError, isUuid } from "./dbError";
import { adminDb, asJson, UNIQUE_VIOLATION, type Db } from "@/lib/data/db.server";
import { playedMs, recordEvents } from "@/lib/data/events.server";
import {
  claimRoomStart,
  disbandRoom,
  disbandStaleRoom,
  finishAfterWinnerReveal,
  insertRoom,
  moveTimedPhase,
  pullIntroStart,
  readHostLastCategories,
  readHostRecentOrders,
  readHostRecentPuzzles,
  readPrivatePuzzles,
  readRoom,
  readRoomByCode,
  readRoomPreview,
  restartRoom,
  writePrivatePuzzles,
  writeRoomCategories,
} from "@/lib/data/rooms.server";
import {
  deletePlayerAtSlot,
  markIntroReady,
  readPlayer,
  readPlayers,
  setPlayerStatus,
  setPlayerStatusInRoom,
} from "@/lib/data/players.server";
import {
  insertRoundResult,
  readAnsweredSlots,
  readRoomResults,
  readStoredResultId,
} from "@/lib/data/results.server";

/** How many of the host's recent rooms feed the repeat-avoiding draw. */
const RECENT_ROOMS = 3;
/** How many of the host's recent rooms' banked boards a new room avoids. */
const RECENT_BANK_ROOMS = 20;

/* -------------------------------------------------------------------------- */
/*  Server-only helpers                                                        */
/*                                                                             */
/*  The tables are still named duels / duel_players / duel_secrets — a room is  */
/*  simply a duel with two to ten players.                                      */
/* -------------------------------------------------------------------------- */

/** The service-role client, typed on the generated schema (src/lib/data/db.server.ts). */
const db = adminDb;

/** A signed-in player's username, or null for a guest (src/lib/names/playerName.server.ts). */
async function accountNameOf(client: Db, userId: string): Promise<string | null> {
  const { accountNameOf: lookup } = await import("@/lib/names/playerName.server");
  return lookup(client, userId);
}

/** M2: the shared name cleaner (displayName.server.ts): NFKC, no control / bidi / zero-width characters, 16 code points. */
async function cleanName(name: unknown): Promise<string> {
  const { cleanDisplayName } = await import("./displayName.server");
  const cleaned = cleanDisplayName(name);
  return cleaned.length > 0 ? cleaned : "Player";
}

/**
 * Why a name a player typed can't be used in a room (offensive or reserved: the shared guest-name check,
 * src/lib/names/names.server.ts, on the name cleanDisplayName(name) stores), with three suggestions, or null.
 */
async function roomNameRefusal(
  name: unknown,
): Promise<import("@/lib/names/names.server").NameRefusalInfo | null> {
  const { cleanDisplayName } = await import("./displayName.server");
  const { checkGuestName, refusalWithSuggestions } = await import("@/lib/names/names.server");
  const checked = checkGuestName(cleanDisplayName(name));
  if (checked.ok) return null;
  return refusalWithSuggestions("guest", checked.reason);
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function nowIso(): string {
  return new Date().toISOString();
}

async function getRoom(client: Db, roomId: string): Promise<DuelRow> {
  // L1: an id that can't be a room never reaches the database (whose error text would name the column type).
  if (!isUuid(roomId)) throw new Error("That room no longer exists.");
  const { data, error } = await readRoom(client, roomId);
  if (error) throw dbError(error, "duel");
  if (!data) throw new Error("That room no longer exists.");
  return data;
}

async function getPlayers(client: Db, roomId: string): Promise<DuelPlayerRow[]> {
  const { data, error } = await readPlayers(client, roomId);
  if (error) throw dbError(error, "duel");
  return data ?? [];
}

/**
 * The players with each one's last seen from the heartbeat table as well (presence.server.ts, Speed fix 3): for the
 * calls whose rules ask who is still connected (advance, READY, Continue, Finish now).
 */
async function getPlayersSeen(client: Db, roomId: string): Promise<DuelPlayerRow[]> {
  return withPresence(client, roomId, await getPlayers(client, roomId));
}

/** Players still in the room (anyone who has not tapped Leave). */
function present(players: DuelPlayerRow[]): DuelPlayerRow[] {
  return players.filter((p) => p.status !== "left");
}

/** Players whose answers the room waits for. */
function activePlayers(players: DuelPlayerRow[]): DuelPlayerRow[] {
  return players.filter((p) => p.status === "active");
}

/** Throws unless the caller has a player row in this room. */
async function requireParticipant(
  client: Db,
  roomId: string,
  userId: string,
): Promise<DuelPlayerRow> {
  if (!isUuid(roomId)) throw new Error("You are not part of this room.");
  const { data } = await readPlayer(client, roomId, userId);
  if (!data) throw new Error("You are not part of this room.");
  return data;
}

/**
 * Security fix M6 (Nov 2026 audit): the paths that play or change a room (answers, READY, word and move checks, the
 * lobby look) refuse a player who left or was removed. Rejoining a room still waiting stays joinRoomFn's job; a
 * player who only went quiet ("inactive") keeps being brought back by answering.
 */
export const LEFT_PLAYER_MESSAGE = "You left this game.";
export function playerHasLeft(player: Pick<DuelPlayerRow, "status">): boolean {
  return player.status === "left";
}

async function privatePuzzles(client: Db, roomId: string): Promise<Record<string, unknown>[]> {
  return (await readPrivatePuzzles(client, roomId)).data;
}

async function insertPlayer(
  client: Db,
  roomId: string,
  slot: number,
  userId: string,
  displayName: string,
  look: LookPreference = {},
): Promise<void> {
  // With the colour/icon columns, a free colour (the remembered one when it can) and the icon.
  await insertPlayerWithLook(
    client,
    {
      duel_id: roomId,
      player_slot: slot,
      user_id: userId,
      // A signed-in player is seated under their username whatever was typed (playerName.server.ts); a guest
      // under the name they typed. Lobby, standings, results, chat and share cards read this one stored name.
      display_name: (await accountNameOf(client, userId)) ?? (await cleanName(displayName)),
      status: "active",
    },
    look,
  );
}

/**
 * Everyone active has tapped READY: pull the intro's start stamp back so only
 * the 3-2-1 countdown is left. Guarded on the stamp itself, so a burst of taps
 * shifts the round forward exactly once.
 */
async function startIntroCountdown(client: Db, room: DuelRow, round: number): Promise<void> {
  const cutoff = new Date(Date.now() - INTRO_WAIT_MS).toISOString();
  await pullIntroStart(client, room.id, round, cutoff);
}

async function createRoomRow(
  client: Db,
  userId: string,
  displayName: string,
  /** The room's stored settings (roomSettings.ts: picks then `rounds:N`), or a legacy category list. */
  categories: readonly string[] = STANDARD_CATEGORIES,
  look: LookPreference = {},
  /** The host's last room's scoring (scoringMode.ts); only Placings is written (the column defaults to 'total'). */
  scoring: ScoringMode = "total",
): Promise<DuelRow> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await insertRoom(client, {
      room_code: generateRoomCode(),
      status: "waiting",
      host_user_id: userId,
      max_players: MAX_PLAYERS,
      round_count: TOTAL_ROUNDS,
      round_order: [],
      selected_categories: categories,
      ...(scoring === "placings" ? { scoring_mode: scoring } : {}),

      puzzles_public: [],
      current_round: 0,
    });

    if (error) {
      if (error.code === UNIQUE_VIOLATION) continue; // room code collision
      throw dbError(error, "duel");
    }

    const room = data as DuelRow;
    await insertPlayer(client, room.id, 1, userId, displayName, look);
    await recordJoin(client, { duel_id: room.id, user_id: userId, player_slot: 1, game_index: 0, via: "host" });
    return room;
  }
  throw new Error("Couldn’t make a room just now. Give it another go.");
}

/**
 * How many active players have answered a round. A player who answered and then left still has a
 * row, so counting every row could end the round while an active player was still playing.
 */
async function activeAnsweredCount(client: Db, roomId: string, round: number, players: DuelPlayerRow[]): Promise<number> {
  const slots = await answeredSlots(client, roomId, round);
  return activePlayers(players).filter((p) => slots.has(p.player_slot)).length;
}

/** Slots that answered a round. */
async function answeredSlots(client: Db, roomId: string, round: number): Promise<Set<number>> {
  const { data } = await readAnsweredSlots(client, roomId, round);
  return new Set((data ?? []).map((r) => r.player_slot));
}

/**
 * A player who has answered nothing for two rounds in a row stops holding the
 * room up. Any later answer puts them straight back to active.
 */
async function markInactivity(client: Db, roomId: string, round: number): Promise<void> {
  if (round < INACTIVE_AFTER_MISSED) return;
  const players = activePlayers(await getPlayers(client, roomId));
  if (players.length === 0) return;
  const recent = await Promise.all(
    Array.from({ length: INACTIVE_AFTER_MISSED }, (_, i) =>
      answeredSlots(client, roomId, round - i),
    ),
  );
  const missing = players.filter((p) => recent.every((slots) => !slots.has(p.player_slot)));
  for (const player of missing) {
    await setPlayerStatus(client, player.id, "inactive");
  }
}

/**
 * The round orders of the host's last three tournaments, including this room.
 */
async function recentRoundOrders(
  client: Db,
  room: DuelRow,
  hostUserId: string | null,
): Promise<StoredPuzzleType[][]> {
  const orders: StoredPuzzleType[][] = [];

  if (hostUserId) {
    const { data } = await readHostRecentOrders(client, hostUserId);
    const tournaments: { date: string; order: StoredPuzzleType[] }[] = [];
    for (const row of data ?? []) {
      if (row.status === "finished" && row.round_order?.length && !row.disbanded_at)
        tournaments.push({ date: row.phase_started_at ?? row.created_at, order: row.round_order });
      for (const entry of row.tournament_history ?? [])
        if (entry.round_order?.length)
          tournaments.push({ date: entry.date, order: entry.round_order });
    }
    tournaments.sort((a, b) => b.date.localeCompare(a.date));
    orders.push(...tournaments.map((entry) => entry.order));
  }

  // Repeated orders represent separate tournaments and still count toward recency.
  return orders.slice(0, RECENT_ROOMS);
}

/** Banked boards (puzzleBank.server.ts) from the host's recent rooms, so a new room skips them. */
async function recentBankKeys(client: Db, hostUserId: string | null): Promise<Set<string>> {
  const keys = new Set<string>();
  if (!hostUserId) return keys;
  const { data } = await readHostRecentPuzzles(client, hostUserId, RECENT_BANK_ROOMS);
  const { bankKey } = await import("./puzzleBank.server");
  for (const row of data ?? []) {
    if (!Array.isArray(row.puzzles_public)) continue;
    for (const puzzle of row.puzzles_public) {
      const key = bankKey(puzzle);
      if (key) keys.add(key);
    }
  }
  return keys;
}

/* -------------------------------------------------------------------------- */
/*  Server functions — the only way any of the tables is written               */
/* -------------------------------------------------------------------------- */

export const createRoomFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { displayName: string; look?: LookPreference }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    // A signed-in player's rooms show their username (insertPlayer); only a guest's typed name is checked.
    const accountName = await accountNameOf(client, context.userId);
    const refused = accountName ? null : await roomNameRefusal(data.displayName);
    if (refused) {
      const { NameRefusedError } = await import("@/lib/names/names.server");
      throw new NameRefusedError(refused);
    }
    const { CREATE_ROOM_LIMIT, IP_CREATE_ROOM_LIMIT, withinIpRateLimit, withinRateLimit } = await import("./rateLimit.server");
    if (!(await withinRateLimit(client, context.userId, CREATE_ROOM_LIMIT)))
      throw new Error("You’ve made a lot of rooms. Try again later.");
    if (!(await withinIpRateLimit(IP_CREATE_ROOM_LIMIT, client)))
      throw new Error("You’ve made a lot of rooms. Try again later.");
    // Remember the host's room settings from their last room (roomSettings.server.ts: a room from before
    // settings is read as settings, Arcade as its five groups; a first room gets Mixed, 6 rounds).
    const { data: previous } = await readHostLastCategories(client, context.userId);
    const { rememberedScoring, rememberedSettings } = await import("./roomSettings.server");
    const room = await createRoomRow(
      client,
      context.userId,
      data.displayName,
      rememberedSettings(previous?.selected_categories),
      data.look ?? {},
      await rememberedScoring(client, context.userId),
    );
    recordEvents({ event: "room_created", playerId: context.userId, mode: "room", roomId: room.id });
    return { roomId: room.id, roomCode: room.room_code };
  });

/**
 * What a visitor who is not (yet) in a room may know about it from its link:
 * whether it can be joined, and nothing else (no puzzles, answers or names).
 */
export const roomPreviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomCode: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const { ROOM_LOOKUP_LIMIT, withinRateLimit } = await import("./rateLimit.server");
    if (!(await withinRateLimit(client, context.userId, ROOM_LOOKUP_LIMIT)))
      throw new Error("That’s a lot of codes. Give it a few minutes.");
    const code = String(data.roomCode ?? "").trim().toUpperCase().slice(0, 8);
    const { data: found } = await readRoomPreview(client, code);
    if (!found) return { found: false as const };
    const room = found;
    const players = present(await getPlayers(client, room.id));
    return {
      found: true as const,
      roomCode: code,
      state: linkRoomState(room),
      playerCount: players.length,
      maxPlayers: roomCapacity(room),
    };
  });

export const joinRoomFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      roomCode: string;
      displayName: string;
      /** How the phone reached this join (beta recording only); older copies send nothing. */
      via?: "code" | "link";
      /** The colour and icon this phone last chose; older copies send nothing. */
      look?: LookPreference;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const client = await db();
    const { ROOM_LOOKUP_LIMIT, withinRateLimit } = await import("./rateLimit.server");
    if (!(await withinRateLimit(client, context.userId, ROOM_LOOKUP_LIMIT)))
      return { ok: false as const, message: "That’s a lot of tries. Give it a few minutes." };
    const accountName = await accountNameOf(client, context.userId);
    const refused = accountName ? null : await roomNameRefusal(data.displayName);
    if (refused) {
      const { NameRefusedError } = await import("@/lib/names/names.server");
      return { ok: false as const, message: new NameRefusedError(refused).message, suggestions: refused.suggestions };
    }
    const via = joinViaFrom(data.via);
    const code = String(data.roomCode ?? "").trim().toUpperCase().slice(0, 8);
    const { data: found } = await readRoomByCode(client, code);
    if (!found) return { ok: false as const, message: "No room with that code. Check it with the host." };

    const room = found;
    if (room.disbanded_at) return { ok: false as const, message: "This room has been disbanded." };
    const players = await getPlayers(client, room.id);
    const mine = players.find((p) => p.user_id === context.userId);

    if (mine) {
      if (mine.status === "left") {
        if (room.status !== "waiting")
          return { ok: false as const, message: "This game’s already started." };
        await setPlayerStatus(client, mine.id, "active");
        await recordJoin(client, {
          duel_id: room.id,
          user_id: context.userId,
          player_slot: mine.player_slot,
          game_index: gameIndexOf(room),
          via,
          rejoin: true,
        });
        recordEvents({ event: "room_joined", playerId: context.userId, mode: "room", roomId: room.id, props: { via, rejoin: true } });
      }
      return { ok: true as const, roomId: room.id, roomCode: room.room_code };
    }

    if (room.status !== "waiting") {
      return { ok: false as const, message: "This game’s already started." };
    }
    const seat = seatFor(players, room);
    if (!seat.ok) return { ok: false as const, message: seat.message };
    const slot = seat.slot;
    try {
      await insertPlayer(client, room.id, slot, context.userId, data.displayName, data.look ?? {});
      await recordJoin(client, {
        duel_id: room.id,
        user_id: context.userId,
        player_slot: slot,
        game_index: gameIndexOf(room),
        via,
      });
      recordEvents({ event: "room_joined", playerId: context.userId, mode: "room", roomId: room.id, props: { via } });
    } catch (error) {
      // Before the 16-player migration the database still refuses slots past 10 (seatsBefore16). Only insertPlayer
      // throws RoomSeatsError; anything else, recordJoin's included, is rethrown as before.
      if (error instanceof RoomSeatsError) return { ok: false as const, message: roomFullMessage(error.seats) };
      throw error;
    }
    return { ok: true as const, roomId: room.id, roomCode: room.room_code };
  });

/** Host only: generates the rounds and opens the shared, unskippable start screen. */
export const startRoomFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    await requireParticipant(client, data.roomId, context.userId);
    const room = await getRoom(client, data.roomId);
    if (room.host_user_id !== context.userId) {
      return { ok: false as const, message: "Only the host can start the game." };
    }
    if (room.status !== "waiting") return { ok: true as const };
    {
      const { START_ROOM_LIMIT, withinRateLimit } = await import("./rateLimit.server");
      if (!(await withinRateLimit(client, context.userId, START_ROOM_LIMIT)))
        return { ok: false as const, message: "That’s a lot of starts. Give it a few minutes." };
    }
    const players = present(await getPlayers(client, room.id));
    if (players.length < MIN_PLAYERS) {
      return { ok: false as const, message: "You need at least two players. Rope someone in." };
    }

    const { buildRoomPuzzles } = await import("./generate.server");
    const { drawUnblockRow } = await import("./unblock.server");
    const unblockRow = await drawUnblockRow(client);
    const recent = await recentRoundOrders(client, room, room.host_user_id);
    const recentBanked = await recentBankKeys(client, room.host_user_id);
    // A room saved with settings (roomSettings.ts) deals from them (roomDeal.ts); an older room keeps its
    // category rule exactly (roomRoundCount rounds shared between the selected categories).
    const stored = readRoomSettings(room.selected_categories);
    const categories = stored.legacy ? normaliseCategories(room.selected_categories) : stored.categories;
    if (!categories.some((category) => typesInCategory(category).length > 0))
      return {
        ok: false as const,
        message: "Pick at least one category with games in it.",
      };
    const { newRoomSeed } = await import("./selection");
    const roomSeed = newRoomSeed();
    const dealt = stored.legacy ? undefined : dealRoomRounds(stored.settings, { seed: roomSeed, recent }).types;
    const { roundOrder, puzzles } = buildRoomPuzzles({
      seed: roomSeed,
      recent,
      categories,
      unblockRow,
      recentBankKeys: recentBanked,
      roundOrder: dealt,
    });
    console.log(
      `[room-selection] room=${room.room_code} ${stored.legacy ? `categories=${categories.join(",")}` : `settings=${encodeRoomSettings(stored.settings).join(",")}`} recentRooms=${recent.length} order=${roundOrder.join(",")}`,
    );

    const split = puzzles.map(splitPuzzle);
    const startedAt = nowIso();

    const { data: claimed } = await claimRoomStart(client, room.id, {
      round_order: roundOrder,
      round_count: roundOrder.length,
      puzzles_public: JSON.parse(JSON.stringify(split.map((s) => s.pub))),
      status: "in_progress",
      current_round: 1,
      phase: "starting",
      phase_started_at: startedAt,
      round_started_at: startedAt,
    });

    if (claimed) {
      const { error } = await writePrivatePuzzles(
        client,
        room.id,
        JSON.parse(JSON.stringify(split.map((s) => s.priv))),
      );
      if (error) throw dbError(error, "duel");
      // Beta recording (G1 archive): each round's effective limit and stamps, best-effort.
      const { puzzleTimeLimitMs } = await import("./catalogue");
      await recordRoundRecords(
        client,
        room.id,
        roundRecords(puzzles as unknown as (Record<string, unknown> & { type: string })[], (p) =>
          puzzleTimeLimitMs(p as unknown as PuzzleData),
        ),
      );
      await recordRoomEvent(client, {
        duel_id: room.id,
        game_index: gameIndexOf(room),
        round_number: 0,
        event: "game_started",
        at: startedAt,
      });
      recordEvents({
        event: "room_started",
        playerId: context.userId,
        mode: "room",
        roomId: room.id,
        props: { players: players.length, rounds: roundOrder.length, game_index: gameIndexOf(room) },
      });
    }
    return { ok: true as const };
  });

/** Host only, in the lobby: chooses the round categories. */
export const setRoomModesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; categories: PuzzleCategory[] }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    await requireParticipant(client, data.roomId, context.userId);
    const room = await getRoom(client, data.roomId);
    if (room.host_user_id !== context.userId) {
      return { ok: false as const, message: "Only the host can change this." };
    }
    if (room.status !== "waiting") {
      return { ok: false as const, message: "This game’s already started." };
    }
    if (
      !Array.isArray(data.categories) ||
      data.categories.length === 0 ||
      normaliseCategories(data.categories).length !== new Set(data.categories).size
    )
      return { ok: false as const, message: "Pick at least one category." };
    const categories = normaliseCategories(data.categories);
    await writeRoomCategories(client, room.id, categories);
    console.log(`[room-selection] room=${room.room_code} categories=${categories.join(",")}`);

    return { ok: true as const };
  });

/**
 * Host only, in the lobby: the room settings sheet's categories, round count (roomSettings.ts) and scoring
 * (scoringMode.ts, only when the sheet sends it),
 * validated and stored by changeRoomSettings; a guest's or a started room's change is refused.
 */
export const setRoomSettingsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; picks: string[]; rounds: number; scoring?: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    await requireParticipant(client, data.roomId, context.userId);
    const { changeRoomSettings } = await import("./roomSettings.server");
    const result = await changeRoomSettings(client, data.roomId, context.userId, {
      picks: data.picks,
      rounds: data.rounds,
      ...(data.scoring !== undefined ? { scoring: data.scoring } : {}),
    });
    return result.ok ? { ok: true as const } : result;
  });

/**
 * In the lobby: the caller changes their own colour (any one no one else holds) and/or icon (one of
 * PLAYER_ICON_IDS, or null for their initial). Display data only, written here like every other
 * player field; clients still have no write access to the table.
 */
export const setPlayerLookFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; colour?: number; icon?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const me = await requireParticipant(client, data.roomId, context.userId);
    if (playerHasLeft(me)) return { ok: false as const, message: LEFT_PLAYER_MESSAGE };
    const room = await getRoom(client, data.roomId);
    if (room.status !== "waiting" || room.disbanded_at)
      return { ok: false as const, message: "Colours can only change in the lobby." };
    const { PLAYER_LOOK_LIMIT, withinRateLimit } = await import("./rateLimit.server");
    if (!(await withinRateLimit(client, context.userId, PLAYER_LOOK_LIMIT)))
      return { ok: false as const, message: "That’s a lot of changes. Give it a minute." };
    return changePlayerLook(client, me, data);
  });

/** Host only, in the lobby: takes a player out of the room. */
export const removePlayerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; slot: number }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const room = await getRoom(client, data.roomId);
    if (room.host_user_id !== context.userId) {
      return { ok: false as const, message: "Only the host can remove players." };
    }
    if (room.status !== "waiting") {
      return { ok: false as const, message: "This game’s already started." };
    }
    await deletePlayerAtSlot(client, room.id, data.slot, context.userId);
    return { ok: true as const };
  });

/** Leaving the room. A departing host closes the room. */
export const leaveRoomFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const room = await getRoom(client, data.roomId);
    await setPlayerStatusInRoom(client, room.id, context.userId, "left");

    if (room.host_user_id === context.userId) {
      await disbandRoom(client, room.id, nowIso());
      if (room.status === "in_progress")
        await recordRoomEvent(client, {
          duel_id: room.id,
          game_index: gameIndexOf(room),
          round_number: 0,
          event: "game_ended",
          reason: "host_left",
        });
      if (room.status === "in_progress") recordEvents({ event: "room_finished", mode: "room", roomId: room.id, props: { reason: "host_left", game_index: gameIndexOf(room) } });
    }
    return { ok: true as const };
  });

export const disbandRoomFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const room = await getRoom(client, data.roomId);
    if (room.host_user_id !== context.userId)
      return { ok: false as const, message: "Only the host can disband this room." };
    await disbandRoom(client, room.id, nowIso());
    if (room.status === "in_progress")
      await recordRoomEvent(client, {
        duel_id: room.id,
        game_index: gameIndexOf(room),
        round_number: 0,
        event: "game_ended",
        reason: "disbanded",
      });
    if (room.status === "in_progress") recordEvents({ event: "room_finished", mode: "room", roomId: room.id, props: { reason: "disbanded", game_index: gameIndexOf(room) } });
    return { ok: true as const };
  });

export const checkHostPresenceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    await requireParticipant(client, data.roomId, context.userId);
    await disbandStaleRoom(client, data.roomId);
    return { ok: true as const };
  });

/**
 * The single place the room's phase, round and status change. Idempotent: it
 * decides from the stored timestamps what (if anything) is due next, and every
 * write is guarded on the round and phase it is moving away from.
 */
export const advancePhaseFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; hostNext?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    await requireParticipant(client, data.roomId, context.userId);
    const room = await getRoom(client, data.roomId);

    if (room.status !== "in_progress") return { ok: true };

    const round = room.current_round;
    if (round < 1) return { ok: true };

    const stamp = room.phase_started_at ?? room.round_started_at;
    const phaseStart = stamp ? Date.parse(stamp) : Date.now();
    const elapsed = Date.now() - phaseStart;
    const puzzle = room.puzzles_public[round - 1];
    const players = await getPlayersSeen(client, room.id);
    const waitingOn = activePlayers(players);

    if (room.phase === "starting") {
      if (elapsed < DUEL_START_MS) return { ok: true };
      // Fixed deadlines preserve the same title position after reconnects.
      const titleAt = new Date(phaseStart + DUEL_START_MS).toISOString();
      const { error } = await moveTimedPhase(client, room.id, round, "starting", stamp, "round_title", titleAt);
      if (error) throw dbError(error, "duel");
      return { ok: true };
    }

    if (room.phase === "round_title") {
      if (elapsed < ROUND_TITLE_MS) return { ok: true };
      const introAt = new Date(phaseStart + ROUND_TITLE_MS).toISOString();
      const { error } = await moveTimedPhase(client, room.id, round, "round_title", stamp, "intro", introAt);
      if (error) throw dbError(error, "duel");
      return { ok: true };
    }

    if (room.phase === "intro") {
      if (elapsed < INTRO_WAIT_MS && allIntroReady(players, round, Date.now())) {
        await startIntroCountdown(client, room, round);
        return { ok: true };
      }
      if (elapsed >= INTRO_MS) {
        const at = await setPhase(client, room.id, round, "intro", "puzzle");
        if (at)
          await recordRoomEvent(client, {
            duel_id: room.id,
            game_index: gameIndexOf(room),
            round_number: round,
            event: "round_started",
            at,
          });
        if (at)
          recordEvents(
            waitingOn.map((p) => ({
              event: "game_started" as const,
              playerId: p.user_id,
              game: puzzle?.type ?? null,
              mode: "room" as const,
              roomId: room.id,
              props: { round },
            })),
          );
      }
      return { ok: true };
    }

    if (room.phase === "puzzle") {
      const answered = await activeAnsweredCount(client, room.id, round, players);
      // Everyone in, or the clock (arcade rounds wait a little longer for a late run): roomClose.ts.
      const reason = puzzleCloseReason(puzzle, elapsed, answered, waitingOn.length);
      if (reason) {
        const at = await setPhase(client, room.id, round, "puzzle", "reveal");
        if (at)
          await recordRoomEvent(client, {
            duel_id: room.id,
            game_index: gameIndexOf(room),
            round_number: round,
            event: "round_ended",
            reason,
            at,
          });
      }
      return { ok: true };
    }

    if (room.phase === "reveal") {
      if (elapsed >= puzzleRevealMs(puzzle)) {
        await setPhase(client, room.id, round, "reveal", "result");
        await markInactivity(client, room.id, round);
      }
      return { ok: true };
    }

    if (room.phase === "winner_reveal") {
      // Timer-driven only: the host cannot skip the reveal.
      if (elapsed < WINNER_REVEAL_MS) return { ok: true };
      await finishAfterWinnerReveal(client, room.id, round);
      return { ok: true };
    }

    const hostNext = data.hostNext === true && context.userId === room.host_user_id;

    if (!isContinuePhase(room.phase)) return { ok: true };
    // The timer is the most a between-round screen waits; it ends early once
    // every connected active player has tapped Continue.
    if (!betweenScreenDue(room.phase, elapsed, players, round, Date.now(), hostNext))
      return { ok: true };
    await leaveBetweenRoundScreen(client, room, round);
    return { ok: true };
  });

export type { SubmitExtra };

/**
 * Checks the answer against the stored puzzle content and scores it on the
 * server. Clients never send `is_correct` or `score`.
 */
export const submitAnswerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      roomId: string;
      roundNumber: number;
      answer: string;
      msRemaining: number;
      extra?: SubmitExtra;
      /** The phone's build id (appVersion.ts); missing from copies older than it. */
      clientVersion?: string;
      /** How the round was played (lib/inputType.ts); stored beside the result, never graded. */
      inputType?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const client = await db();
    const player = await requireParticipant(client, data.roomId, context.userId);
    if (playerHasLeft(player)) return { ok: false as const, message: LEFT_PLAYER_MESSAGE };
    const room = await getRoom(client, data.roomId);

    // Log only: grading never depends on the client's version.
    const staleNote = staleSubmissionNote(
      "submit_answer",
      data.clientVersion,
      `room ${room.id}, round ${data.roundNumber}, slot ${player.player_slot}`,
    );
    if (staleNote) console.warn(staleNote);

    // Late answers are taken through the reveal phase, never once others' answers are readable.
    if (!acceptsAnswers(room, data.roundNumber)) {
      return { ok: false as const, message: "That round is over." };
    }

    const existing = await readStoredResultId(client, room.id, player.player_slot, data.roundNumber);
    if (existing.data) return { ok: true as const, alreadySubmitted: true };

    const pub = room.puzzles_public[data.roundNumber - 1];
    if (!pub) return { ok: false as const, message: "That round is over." };
    const priv = (await privatePuzzles(client, room.id))[data.roundNumber - 1];
    const puzzle: PuzzleData = mergePuzzle(pub, priv);

    // The same grade practice gives, timed by the server's receipt (roomGrade.server.ts).
    const { gradeRoomAnswer } = await import("./roomGrade.server");
    const { graded, clamped, serverMs, msLeft } = gradeRoomAnswer(
      puzzle,
      { phase: room.phase, phaseStartedAt: room.phase_started_at ?? room.round_started_at, nowMs: Date.now() },
      data.answer,
      data.msRemaining,
      data.extra,
    );
    if (clamped) {
      console.warn(
        `submit_answer: time claim ${data.msRemaining}ms beyond server ${Math.round(serverMs)}ms (room ${room.id}, round ${data.roundNumber})`,
      );
    }
    // The stored result's columns come from the round engine (src/lib/round/result.ts), the same as an async round's.
    const { error } = await insertRoundResult(client, {
      duel_id: room.id,
      player_slot: player.player_slot,
      round_number: data.roundNumber,
      ...resultColumns(graded),
      extra: asJson(graded.extra),
    });
    if (error && error.code !== UNIQUE_VIOLATION) throw dbError(error, "duel");
    // How it was played (touch, mouse, keyboard), beside the stored result; best effort, never graded.
    if (!error) {
      const { recordInputType } = await import("./inputType.server");
      await recordInputType(client, "round_results", { duel_id: room.id, player_slot: player.player_slot, round_number: data.roundNumber }, data.inputType);
      const { puzzleTimeLimitMs } = await import("./catalogue");
      recordEvents({
        event: "game_finished",
        playerId: context.userId,
        game: puzzle.type,
        mode: "room",
        score: graded.score,
        completed: graded.isCorrect,
        durationMs: playedMs(puzzleTimeLimitMs(puzzle), msLeft, graded.extra as Record<string, unknown> | null | undefined),
        roomId: room.id,
        inputType: data.inputType,
        props: { round: data.roundNumber },
      });
    }
    // The live "finished" ping: only the round number, after the result is stored, and only for a
    // finish before the buzzer (finishedPing.server.ts, buzzer.ts): never a time-out or a late answer.
    if (finishedBeforeBuzzer(puzzle, room.phase, msLeft)) await markSubmitted(client, player.id, data.roundNumber);

    // Answering again brings a player who had gone quiet back into the room.
    if (player.status !== "active") {
      await setPlayerStatus(client, player.id, "active");
    }

    /**
     * The round is over the moment the last active player's answer lands — no
     * waiting for the clock. `setPhase` is guarded on the round and the phase it
     * moves away from, so this and a timer expiry arriving together cannot
     * double-advance.
     */
    const players = await getPlayers(client, room.id);
    const waitingOn = activePlayers(players).length || 1;
    const answered = await activeAnsweredCount(client, room.id, data.roundNumber, players);
    if (answered >= waitingOn) {
      const at = await setPhase(client, room.id, data.roundNumber, "puzzle", "reveal");
      if (at)
        await recordRoomEvent(client, {
          duel_id: room.id,
          game_index: gameIndexOf(room),
          round_number: data.roundNumber,
          event: "round_ended",
          reason: "all_answered",
          at,
        });
    }
    return { ok: true as const };
  });

/**
 * "READY" on the round intro. Stored per player per round so a refresh comes
 * back with the right state, and the round starts as soon as every active
 * player is in.
 */
export const readyUpFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; roundNumber: number }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const player = await requireParticipant(client, data.roomId, context.userId);
    if (playerHasLeft(player)) return { ok: true as const };
    const room = await getRoom(client, data.roomId);
    const round = clamp(data.roundNumber, 1, MAX_ROUNDS);
    if (room.status !== "in_progress" || room.current_round !== round || room.phase !== "intro") {
      return { ok: true as const };
    }

    await markIntroReady(client, player.id, round);

    const players = await getPlayersSeen(client, room.id);
    if (allIntroReady(players, round, Date.now())) await startIntroCountdown(client, room, round);
    return { ok: true as const };
  });

/**
 * "Continue" on the round results or standings. Stored per player as a rising
 * mark (roomFlow.continueMark) so a refresh comes back with the right state;
 * the screen moves on as soon as every connected active player is in, and
 * never later than its timer.
 */
export const continueFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; roundNumber: number; phase: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const player = await requireParticipant(client, data.roomId, context.userId);
    const room = await getRoom(client, data.roomId);
    const round = clamp(data.roundNumber, 1, MAX_ROUNDS);
    if (
      room.status !== "in_progress" ||
      room.current_round !== round ||
      !isContinuePhase(room.phase) ||
      room.phase !== data.phase
    ) {
      return { ok: true as const };
    }
    await recordContinue(client, player.id, round, room.phase);

    const players = await getPlayersSeen(client, room.id);
    if (allContinued(players, round, room.phase, Date.now()))
      await leaveBetweenRoundScreen(client, room, round);
    return { ok: true as const };
  });

/**
 * "Finish now": the last player still here ends the game. Everyone who had
 * left or dropped out is stored as left, and the room finishes outside the
 * winner reveal, which is how screens recognise a forfeit (roomFlow.endedByForfeit).
 * Stored rounds and scores are untouched.
 */
export const finishNowFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    await requireParticipant(client, data.roomId, context.userId);
    const room = await getRoom(client, data.roomId);
    const players = await getPlayersSeen(client, room.id);
    const result = await finishGame(client, room, players, context.userId, Date.now());
    if (!result.ok) return { ok: false as const, message: result.message };
    return { ok: true as const };
  });

export const heartbeatFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => input)
  .handler(async ({ data, context }) => {
    // Speed fix 3: the heartbeat no longer reaches every phone through realtime; its reply carries the room's
    // last-seen times instead (presence.server.ts), and only to a player of the room.
    if (!isUuid(data.roomId)) return { ok: true as const };
    const client = await db();
    const seen = await recordHeartbeat(client, data.roomId, context.userId, nowIso());
    return seen ? { ok: true as const, seen } : { ok: true as const };
  });

/**
 * The answer for one round — only ever returned once that round has ended.
 * Other players' answers only once late answers stop (reveal.server.ts).
 */
export const revealAnswerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; roundNumber: number }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const me = await requireParticipant(client, data.roomId, context.userId);
    const room = await getRoom(client, data.roomId);
    return loadRoundReveal(client, room, data.roundNumber, me.player_slot);
  });

/**
 * "Play again": atomically reset this room; keep the code and archive its winner.
 */
export const rematchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const me = await requireParticipant(client, data.roomId, context.userId);
    const room = await getRoom(client, data.roomId);

    if (room.host_user_id !== context.userId) {
      return { ok: false as const, message: "Waiting for the host to play again." };
    }
    // A host who left (and forfeited) can't restart: the reset removes left players.
    if (me.status === "left") return { ok: false as const, message: "You left this game." };
    // Read a forfeit's outcome before the reset clears statuses and results.
    const { data: resultRows } = await readRoomResults(client, room.id);
    const roomPlayers = await getPlayers(client, room.id);
    const forfeit = forfeitRecord(room, roomPlayers, (resultRows ?? []) as RoundResultRow[]);
    // tieRev 1 rooms: the saved winner is the standings' winner (tie-break time, not slot).
    const tieWinner = forfeit
      ? null
      : tieWinnerRecord(room, roomPlayers, (resultRows ?? []) as RoundResultRow[]);
    // Play again keeps everyone's colour: store the ones still shown from the slot first (resolved
    // with the players who left, as every phone shows them; those rows go with the reset).
    if (await hasLookColumns(client)) await persistAutoColours(client, roomPlayers);
    const { data: restarted, error } = await restartRoom(client, room.id, context.userId);
    if (error || !restarted) return { ok: false as const, message: "Can’t play again just yet." };
    await clearSubmitted(client, room.id);
    if (forfeit && !(await recordForfeitInHistory(client, room.id, forfeit)))
      console.warn(`[rematch] room=${room.room_code}: forfeit winner not recorded in history`);
    if (tieWinner && !(await recordTieWinnerInHistory(client, room.id, tieWinner)))
      console.warn(`[rematch] room=${room.room_code}: standings winner not recorded in history`);
    return { ok: true as const, roomId: room.id, roomCode: room.room_code };
  });

/**
 * Word puzzles: checks one submitted word or rung while the round is running. The
 * dictionary stays on the server; only the verdict travels back.
 */
export const checkWordFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      roomId: string;
      roundNumber: number;
      word: string;
      found: string[];
      path?: number[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const client = await db();
    const me = await requireParticipant(client, data.roomId, context.userId);
    if (playerHasLeft(me)) return { valid: false as const, points: 0, word: "", reason: LEFT_PLAYER_MESSAGE };
    const room = await getRoom(client, data.roomId);

    // Only while the puzzle is live: during the reveal a lagging player could
    // otherwise keep probing the private solution before sending a late answer.
    if (
      room.status !== "in_progress" ||
      room.current_round !== data.roundNumber ||
      room.phase !== "puzzle"
    ) {
      return { valid: false as const, points: 0, word: "", reason: "That round is over." };
    }
    const pub = room.puzzles_public[data.roundNumber - 1];
    const found = Array.isArray(data.found) ? data.found.slice(0, 200).map(String) : [];

    if (pub?.type === "letterwheel") {
      const priv = (await privatePuzzles(client, room.id))[data.roundNumber - 1];
      const puzzle = mergePuzzle(pub, priv);
      if (puzzle.type !== "letterwheel") return { valid: false as const, points: 0, word: "" };
      const { checkLetterWheelWord } = await import("./letterWheel");
      const { isWord } = await import("./dictionary.server");
      const word = String(data.word ?? "").trim().toLowerCase();
      return checkLetterWheelWord(puzzle.words ?? [], word, found, word.length >= 3 && isWord(word));
    }
    if (pub?.type === "wordsearch") {
      // Matched against the private placements; only the verdict goes back.
      const priv = (await privatePuzzles(client, room.id))[data.roundNumber - 1];
      const puzzle = mergePuzzle(pub, priv);
      if (puzzle.type !== "wordsearch") return { valid: false as const, points: 0, word: "" };
      const { checkWordSearchPath } = await import("./wordSearch");
      const path = Array.isArray(data.path) ? data.path.slice(0, 16).map(Number) : [];
      return checkWordSearchPath(puzzle.placements ?? [], puzzle.size, path, found, puzzle.bonus);
    }
    if (pub?.type === "wordhunt") {
      const { checkWordHuntPath } = await import("./wordHunt.server");
      const path = Array.isArray(data.path) ? data.path.slice(0, 16).map(Number) : [];
      return checkWordHuntPath(pub.grid, path, found);
    }
    if (pub?.type === "tilegrid") {
      const { checkTileGridWord } = await import("./tileGrid.server");
      return checkTileGridWord(String(data.word ?? ""));
    }
    if (pub?.type === "wordslide") {
      const { checkWordSlideRow } = await import("./wordSlide.server");
      return checkWordSlideRow(String(data.word ?? ""));
    }
    if (!pub || pub.type !== "wordsmith") {
      return { valid: false as const, points: 0, word: "", reason: "Not this round." };
    }

    const { checkWordsmithWord } = await import("./wordsmith.server");
    return checkWordsmithWord(pub.letters, String(data.word ?? ""), found);
  });

/**
 * Strikeout, Cryptogrid and Swapword: replays the player's moves so far against
 * the private puzzle and returns only what the board may show next.
 */
export const checkMovesFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { roomId: string; roundNumber: number; moves: string }) => input)
  .handler(async ({ data, context }) => {
    const client = await db();
    const me = await requireParticipant(client, data.roomId, context.userId);
    if (playerHasLeft(me)) return null;
    const room = await getRoom(client, data.roomId);
    if (
      room.status !== "in_progress" ||
      room.current_round !== data.roundNumber ||
      room.phase !== "puzzle"
    )
      return null;
    const pub = room.puzzles_public[data.roundNumber - 1];
    if (!pub || (pub.type !== "strikeout" && pub.type !== "codeword" && pub.type !== "swapword")) return null;
    const priv = (await privatePuzzles(client, room.id))[data.roundNumber - 1];
    const { checkPuzzleMoves } = await import("./moves.server");
    return checkPuzzleMoves(mergePuzzle(pub, priv), data.moves);
  });

