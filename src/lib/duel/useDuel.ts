import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { batched, usePageHidden } from "@/lib/battery";
import { useArcadeScreenTickMs } from "@/lib/fx/useArcadeScreenTick";
import { supabase } from "@/integrations/supabase/client";

import { checkHostPresence, fetchDuelByCode, fetchPlayers, fetchReleasedRounds, fetchResults, heartbeat } from "./api";
import { calibrateServerClock, initServerClock, serverNow } from "./clock";
import { roomTickMs } from "./roomTick";
import { applyPlayerUpdate, noteSeen, withSeen, type SeenMap } from "./roomSeen";
import { isSeat, hostKey, myKeyAmong, myPublicId, seatKey } from "./seatKey";
import { ensureSession } from "./session";
import { type DuelPlayerRow, type DuelRow, type PuzzleData, type RoundResultRow } from "./types";

export interface DuelState {
  loading: boolean;
  notFound: boolean;
  duel: DuelRow | null;
  players: DuelPlayerRow[];
  results: RoundResultRow[];
  me: DuelPlayerRow | null;
  /**
   * This phone's key among the room's players (Security C1b, seatKey.ts): its public id, compared with seatKey(row),
   * hostKey(duel) and senderKey(message). Null until known.
   */
  myKey: string | null;
  /** Only meaningful in a two-player room. */
  opponent: DuelPlayerRow | null;
  /** Everyone who has not tapped Leave, in slot order. */
  roomPlayers: DuelPlayerRow[];
  isHost: boolean;
  /** True for a room of three or more: standings and podium replace the VS screens. */
  isMulti: boolean;
  now: number;
  refresh: () => Promise<void>;
}

/** Ticking clock so timers and deadlines re-render smoothly. */
export function useNow(intervalMs = 100): number {
  const [now, setNow] = useState(() => serverNow());
  // Low-end performance (16 Oct 2026): 4 Hz instead of 10 while reduced effects are on in a live arena (lib/fx/lowEnd.ts).
  const tickMs = useArcadeScreenTickMs(intervalMs);
  useEffect(() => {
    const id = window.setInterval(() => setNow(serverNow()), tickMs);
    return () => window.clearInterval(id);
  }, [tickMs]);
  return now;
}

/** Whether a room's puzzles come round by round (a new room playing: its stored list is empty until it finishes). */
function needsReleased(room: DuelRow | null): boolean {
  return !!room && room.status === "in_progress" && (!Array.isArray(room.puzzles_public) || room.puzzles_public.length === 0);
}

/** The game a room is on (Play again's count): released rounds belong to it alone. */
function gameKey(room: DuelRow | null): string {
  return room ? `${room.id}:${room.tournament_history?.length ?? 0}` : "";
}

export function useDuel(roomCode: string): DuelState {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [row, setDuel] = useState<DuelRow | null>(null);
  // Security C1a: a new room's rounds are readable one at a time, from each round's intro (duel_round_puzzles). They
  // stand in for the room's stored list while it plays, so every screen reads `duel.puzzles_public` as before; a room
  // started earlier, or a finished one, carries its full list itself.
  const [released, setReleased] = useState<{ key: string; list: PuzzleData[] }>({ key: "", list: [] });
  const noteReleased = useCallback((room: DuelRow | null, list: PuzzleData[]) => {
    const key = gameKey(room);
    setReleased((prev) => (prev.key === key && prev.list.length >= list.length ? prev : { key, list }));
  }, []);
  const duel = useMemo(() => {
    if (!row || !needsReleased(row) || released.key !== gameKey(row) || released.list.length === 0) return row;
    return { ...row, puzzles_public: released.list };
  }, [row, released]);
  const duelRef = useRef<DuelRow | null>(null);
  duelRef.current = row;
  const [rows, setPlayers] = useState<DuelPlayerRow[]>([]);
  // Speed fix 3 (9 Nov 2026): when each player was last seen, from this phone's heartbeat replies (and, on a database
  // without duel_presence, the player rows' realtime updates); laid over the rows below (roomSeen.ts).
  const seenRef = useRef<SeenMap>(new Map());
  const [seenTick, setSeenTick] = useState(0);
  const noteRoomSeen = useCallback((record: Record<string, string> | null | undefined) => {
    if (noteSeen(seenRef.current, record)) setSeenTick((n) => n + 1);
  }, []);
  const players = useMemo(() => withSeen(rows, seenRef.current), [rows, seenTick]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    seenRef.current = new Map();
  }, [roomCode]);
  const playersRef = useRef<DuelPlayerRow[]>(rows);
  playersRef.current = rows;
  const [results, setResults] = useState<RoundResultRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const duelIdRef = useRef<string | null>(null);
  // This device's id and slot: the results refetch fetches only this slot's stored answers (roomResults.ts).
  const userIdRef = useRef<string | null>(null);
  // Its public id (Security C1b): how it finds its own seat among rows that carry no account ids.
  const publicIdRef = useRef<string | null>(null);
  const keyAmong = useCallback(
    (list: readonly DuelPlayerRow[]) => myKeyAmong(list, { publicId: publicIdRef.current, userId: userIdRef.current }),
    [],
  );
  const mySlotRef = useRef<number | null>(null);
  const notePlayers = useCallback((list: DuelPlayerRow[]) => {
    const key = keyAmong(list);
    mySlotRef.current = key ? (list.find((p) => isSeat(p, key))?.player_slot ?? null) : null;
    return list;
  }, [keyAmong]);
  // Battery (31 Oct 2026): 10 a second during a round's phases, 4 between rounds (roomTick.ts).
  const now = useNow(roomTickMs(duel));

  const load = useCallback(async () => {
    const found = await fetchDuelByCode(roomCode);
    if (!found) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    duelIdRef.current = found.id;
    // The room's last-seen times come with a heartbeat (no longer with every player row's realtime change), so one is
    // sent with each full read: back from the background, the rows and the times arrive together.
    const beat = heartbeat(found.id).catch(() => null);
    // Both at once when this device's slot is known; otherwise the players first, since the results carry
    // only this slot's own answers (roomResults.ts).
    let nextPlayers: DuelPlayerRow[];
    let nextResults: RoundResultRow[];
    if (mySlotRef.current !== null) {
      [nextPlayers, nextResults] = await Promise.all([fetchPlayers(found.id), fetchResults(found.id, mySlotRef.current)]);
      notePlayers(nextPlayers);
    } else {
      nextPlayers = notePlayers(await fetchPlayers(found.id));
      nextResults = await fetchResults(found.id, mySlotRef.current);
    }
    noteRoomSeen(await beat);
    if (needsReleased(found)) noteReleased(found, await fetchReleasedRounds(found.id));
    setDuel(found);
    setPlayers(nextPlayers);
    setResults(nextResults);
    setNotFound(false);
    setLoading(false);
  }, [roomCode, notePlayers, noteRoomSeen, noteReleased]);

  // This device's anonymous identity has to exist before anything is readable.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    void (async () => {
      try {
        const id = await ensureSession();
        if (cancelled) return;
        userIdRef.current = id;
        publicIdRef.current = await myPublicId(id);
        if (cancelled) return;
        setUserId(id);
        await initServerClock();
        if (!cancelled) await load();
      } catch {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Realtime: every phone reacts to room, player and result changes instantly. Battery (31 Oct 2026): player and
  // result refetches are batched to at most one a second; the first change still fetches at once.
  // Speed fix 3 (9 Nov 2026; docs/audit-nov-2026/performance.md item 3): the channel is opened once
  // the room's id is known and subscribes to this room's rows only (`filter`), so Realtime no longer checks every
  // change in every room against every phone. A player row's update is applied in place (a heartbeat's time alone
  // redraws nothing); only a new row, or one that can't be applied, reads the list afresh.
  const [live, setLive] = useState(false);
  const roomId = duel?.id ?? null;
  useEffect(() => {
    if (!userId || !roomId) return;
    const players = batched(() => {
      const id = duelIdRef.current;
      if (id) void fetchPlayers(id).then((list) => setPlayers(notePlayers(list)));
    });
    const results = batched(() => {
      const id = duelIdRef.current;
      if (id) void fetchResults(id, mySlotRef.current).then(setResults);
    });
    const channel = supabase
      // A private channel (13 Nov 2026): only the room's players may join it (RLS on realtime.messages).
      .channel(`duel-${roomCode}`, { config: { private: true } })
      .on("postgres_changes", { event: "*", schema: "public", table: "duels", filter: `id=eq.${roomId}` }, (payload) => {
        const row = payload.new as DuelRow | undefined;
        if (row?.id && row.id === duelIdRef.current) setDuel(row);
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "duel_players", filter: `duel_id=eq.${roomId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as DuelPlayerRow | undefined;
          if (!row || row.duel_id !== duelIdRef.current) return;
          if (payload.eventType === "UPDATE") {
            const next = applyPlayerUpdate(playersRef.current, payload.new as Partial<DuelPlayerRow>);
            if (next === "seen") {
              const key = seatKey(row);
              if (key) noteRoomSeen({ [key]: row.last_seen_at });
              return;
            }
            if (next !== "refetch") {
              playersRef.current = next;
              setPlayers(notePlayers(next));
              return;
            }
          }
          players.call();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "duel_round_puzzles", filter: `duel_id=eq.${roomId}` },
        () => {
          // A round released: read the room's released rounds (row level security decides which).
          const room = duelRef.current;
          if (room && needsReleased(room)) void fetchReleasedRounds(room.id).then((list) => noteReleased(room, list));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "round_results", filter: `duel_id=eq.${roomId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as RoundResultRow | undefined;
          if (!row || row.duel_id !== duelIdRef.current) return;
          results.call();
        },
      )
      .subscribe((status: string) => {
        const up = status === "SUBSCRIBED";
        setLive(up);
        // (Re)connected: catch up on anything sent while the channel was down.
        if (up) void load();
      });

    return () => {
      players.cancel();
      results.cancel();
      setLive(false);
      void supabase.removeChannel(channel);
    };
  }, [roomCode, userId, roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Other players' answers become readable when a round closes (results screen),
  // with no round_results event to announce them: fetch on every phase change.
  useEffect(() => {
    const duelId = duelIdRef.current;
    if (!userId || !duelId || duel?.status !== "in_progress") return;
    let cancelled = false;
    void fetchResults(duelId, mySlotRef.current).then((rows) => {
      if (!cancelled) setResults(rows);
    });
    // The round's puzzle is released as its intro begins (Security C1a): ask for it with each phase change.
    const room = duelRef.current;
    if (room && needsReleased(room) && room.phase !== "starting" && room.phase !== "round_title")
      void fetchReleasedRounds(room.id).then((list) => {
        if (!cancelled) noteReleased(room, list);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, duel?.status, duel?.current_round, duel?.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-measure the shared clock the moment the room starts playing, and again at every round, so a
  // device clock that moved since (lib/duel/clock.ts) never carries into a round's taps.
  useEffect(() => {
    if (duel?.status !== "in_progress") return;
    void calibrateServerClock();
  }, [duel?.id, duel?.status, duel?.current_round]);

  // And whenever the app comes back to the foreground (a phone asleep, the app switched away), with
  // the room read afresh (battery: nothing is fetched while hidden).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void calibrateServerClock();
      if (document.visibilityState === "visible" && duelIdRef.current) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  const myKey = userId ? keyAmong(players) : null;
  const me = myKey ? (players.find((p) => isSeat(p, myKey)) ?? null) : null;
  const roomPlayers = players.filter((p) => p.status !== "left");
  const opponent = me ? (roomPlayers.find((p) => p.player_slot !== me.player_slot) ?? null) : null;
  const isMulti = roomPlayers.length > 2;
  const isHost = !!me && !!duel && !!myKey && hostKey(duel) === myKey;

  // Battery (31 Oct 2026): nothing below runs while the app is hidden (an iPhone freezes a hidden app
  // anyway); each starts again, at once, on return.
  const hidden = usePageHidden();

  // Heartbeat so the opponent can tell we are still here.
  useEffect(() => {
    if (!me || hidden) return;
    const duelId = me.duel_id;
    // Its reply carries the room's last-seen times (Speed fix 3), which is how this phone sees the others.
    const beat = () => void heartbeat(duelId).then(noteRoomSeen, () => {});
    beat();
    const id = window.setInterval(beat, 4000);
    return () => window.clearInterval(id);
  }, [me?.id, hidden]); // eslint-disable-line react-hooks/exhaustive-deps

  // Safety net against a missed realtime event, only while the live channel is down (it reloads the
  // room each time it (re)connects, and the phase-change and foreground reads above catch the rest).
  useEffect(() => {
    if (!userId || live || hidden) return;
    const id = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(id);
  }, [load, userId, live, hidden]);

  useEffect(() => {
    if (!duel || duel.status !== "waiting" || !me || isHost || hidden) return;
    const id = window.setInterval(() => void checkHostPresence(duel.id), 8000);
    return () => window.clearInterval(id);
  }, [duel?.id, duel?.status, me?.id, isHost, hidden]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    loading,
    notFound,
    duel,
    players,
    results,
    me,
    myKey,
    opponent,
    roomPlayers,
    isHost,
    isMulti,
    now,
    refresh: load,
  };
}
