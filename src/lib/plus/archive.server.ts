/**
 * The Daily archive (wave 2 E2, a Joulz Plus perk): a member plays any past Daily Puzzle or Daily Arcade, unrated.
 *
 * Each replay is an async room of its own (kind 'daily_archive', key 'daily_archive:<user>:<kind>:<day>'), its rounds
 * copied exactly from that day's stored Daily (never dealt again), played through the async-room calls like any Daily
 * and graded the same way. Because it is a room of its own it is never on that day's board (boards read the day's own
 * room), never in the streak (daily_history reads daily_puzzle / daily_arcade only), never a badge (badge_facts leaves
 * the kind out, 20261113200000_joulz_plus.sql) and never Joules; its solutions are never locked (the day is over).
 * A day can be replayed once (the room is kept; opening it again shows the replay's results).
 */
import { DAILY_ARCHIVE_DAYS } from "@/config/plusConfig";
import type { Db } from "@/lib/data/db.server";
import { readAsyncPrivate } from "@/lib/data/async.server";
import { recordEvents } from "@/lib/data/events.server";
import { DAILY_ARCHIVE_KIND } from "@/lib/duel/asyncRoom";
import { attemptFor, createAsyncRoom, roomByKey, startAttempt } from "@/lib/duel/asyncRoom.server";
import { DAILY_KINDS, DAILY_ROOM_KIND, dailyRoomKey, isDailyKind, shiftDayKey, ukDayKey, type DailyKind } from "@/lib/duel/daily";
import { mergePuzzle } from "@/lib/duel/secrets";
import type { PuzzleData } from "@/lib/duel/types";

import { memberFor, plusRefusal } from "./plus.server";

/** How long a replay stays open once started (a player can leave between rounds and come back). */
export const ARCHIVE_WINDOW_MS = 7 * 86_400_000;

export function archiveRoomKey(userId: string, kind: DailyKind, day: string): string {
  return `${DAILY_ARCHIVE_KIND}:${userId}:${kind}:${day}`;
}

/** Whether `day` (YYYY-MM-DD) is an archive day today: yesterday back to DAILY_ARCHIVE_DAYS ago. */
export function isArchiveDay(day: string, nowMs: number): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const today = ukDayKey(nowMs);
  return day < today && day >= shiftDayKey(today, -DAILY_ARCHIVE_DAYS);
}

export interface ArchiveDay {
  day: string;
  kind: DailyKind;
  /** The day's Daily exists (somebody played it that day). */
  available: boolean;
  /** This member's replay: none yet, started, or finished with its total. */
  replay: { finished: boolean; total: number } | null;
}

/** The archive's days for a member (newest first), or a refusal. */
export async function archiveDays(client: Db, userId: string, nowMs: number): Promise<{ ok: true; days: ArchiveDay[] } | ReturnType<typeof plusRefusal>> {
  if (!(await memberFor(client, userId))) return plusRefusal("not_member");
  const today = ukDayKey(nowMs);
  const out: ArchiveDay[] = [];
  for (let back = 1; back <= DAILY_ARCHIVE_DAYS; back++) {
    const day = shiftDayKey(today, -back);
    for (const kind of DAILY_KINDS) {
      const source = await roomByKey(client, dailyRoomKey(kind, day));
      let replay: ArchiveDay["replay"] = null;
      if (source) {
        const room = await roomByKey(client, archiveRoomKey(userId, kind, day));
        const mine = room ? await attemptFor(client, room.id, userId) : null;
        if (mine) replay = { finished: mine.finished_at !== null, total: mine.total_score };
      }
      out.push({ day, kind, available: !!source, replay });
    }
  }
  return { ok: true, days: out };
}

/**
 * Starts (or continues) a member's replay of a past Daily: the archive room is made once from the day's stored rounds,
 * then the attempt is started as a Daily's is. Records daily_archive_played on a new replay.
 */
export async function startArchive(
  client: Db,
  input: { userId: string; kind: unknown; day: unknown; name: string },
  nowMs: number,
): Promise<{ ok: true; roomId: string; created: boolean } | { ok: false; message: string }> {
  if (!isDailyKind(input.kind)) return { ok: false, message: "That daily doesn’t exist." };
  if (typeof input.day !== "string" || !isArchiveDay(input.day, nowMs)) return { ok: false, message: "That day isn’t in the archive." };
  if (!(await memberFor(client, input.userId))) return plusRefusal("not_member");
  const kind = input.kind;
  const day = input.day;
  const key = archiveRoomKey(input.userId, kind, day);
  let room = await roomByKey(client, key);
  if (!room) {
    const source = await roomByKey(client, dailyRoomKey(kind, day));
    if (!source) return { ok: false, message: "Nobody played that Daily." };
    const { data: privates, error } = await readAsyncPrivate(client, source.id);
    if (error || !privates) return { ok: false, message: "Couldn’t load that Daily. Try again." };
    // The day's own rounds, exactly as stored (rule 5: dealt once, never per device).
    const puzzles: PuzzleData[] = source.puzzles_public.map((pub, i) => mergePuzzle(pub, privates[i]));
    room = await createAsyncRoom(client, {
      kind: DAILY_ARCHIVE_KIND,
      key,
      day: null,
      seed: source.seed,
      puzzles,
      opensAt: nowMs,
      closesAt: nowMs + ARCHIVE_WINDOW_MS,
      createdBy: input.userId,
    });
  }
  const existing = await attemptFor(client, room.id, input.userId);
  if (existing) return { ok: true, roomId: room.id, created: false };
  const started = await startAttempt(client, room, input.userId, { name: input.name, colour: null, icon: null }, nowMs);
  if (!started.ok) return started;
  if (started.created)
    recordEvents({ event: "daily_archive_played", playerId: input.userId, props: { kind: DAILY_ROOM_KIND[kind], day } });
  return { ok: true, roomId: room.id, created: started.created };
}
