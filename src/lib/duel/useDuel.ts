import { useCallback, useEffect, useRef, useState } from "react";

import { batched, usePageHidden } from "@/lib/battery";
import { useArcadeScreenTickMs } from "@/lib/fx/useArcadeScreenTick";
import { supabase } from "@/integrations/supabase/client";

import { checkHostPresence, fetchDuelByCode, fetchPlayers, fetchResults, heartbeat } from "./api";
import { calibrateServerClock, initServerClock, serverNow } from "./clock";
import { roomTickMs } from "./roomTick";
import { ensureSession } from "./session";
import { type DuelPlayerRow, type DuelRow, type RoundResultRow } from "./types";

export interface DuelState {
  loading: boolean;
  notFound: boolean;
  duel: DuelRow | null;
  players: DuelPlayerRow[];
  results: RoundResultRow[];
  me: DuelPlayerRow | null;
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

export function useDuel(roomCode: string): DuelState {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [duel, setDuel] = useState<DuelRow | null>(null);
  const [players, setPlayers] = useState<DuelPlayerRow[]>([]);
  const [results, setResults] = useState<RoundResultRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const duelIdRef = useRef<string | null>(null);
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
    const [nextPlayers, nextResults] = await Promise.all([
      fetchPlayers(found.id),
      fetchResults(found.id),
    ]);
    setDuel(found);
    setPlayers(nextPlayers);
    setResults(nextResults);
    setNotFound(false);
    setLoading(false);
  }, [roomCode]);

  // This device's anonymous identity has to exist before anything is readable.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    void (async () => {
      try {
        const id = await ensureSession();
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

  // Realtime: both phones react to duel, player and result changes instantly. Battery (31 Oct 2026):
  // player and result refetches are batched to at most one a second (every player's 4 s heartbeat is a
  // duel_players change, so a full room sent several a second); the first change still fetches at once.
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!userId) return;
    const players = batched(() => {
      const id = duelIdRef.current;
      if (id) void fetchPlayers(id).then(setPlayers);
    });
    const results = batched(() => {
      const id = duelIdRef.current;
      if (id) void fetchResults(id).then(setResults);
    });
    const channel = supabase
      .channel(`duel-${roomCode}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "duels" }, (payload) => {
        const row = payload.new as DuelRow | undefined;
        if (row?.id && row.id === duelIdRef.current) setDuel(row);
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "duel_players" },
        (payload) => {
          const row = (payload.new ?? payload.old) as DuelPlayerRow | undefined;
          if (!row || row.duel_id !== duelIdRef.current) return;
          players.call();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "round_results" },
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
  }, [roomCode, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Other players' answers become readable when a round closes (results screen),
  // with no round_results event to announce them: fetch on every phase change.
  useEffect(() => {
    const duelId = duelIdRef.current;
    if (!userId || !duelId || duel?.status !== "in_progress") return;
    let cancelled = false;
    void fetchResults(duelId).then((rows) => {
      if (!cancelled) setResults(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, duel?.status, duel?.current_round, duel?.phase]);

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
      if (document.visibilityState !== "visible") return;
      void calibrateServerClock();
      if (duelIdRef.current) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  const me = userId ? (players.find((p) => p.user_id === userId) ?? null) : null;
  const roomPlayers = players.filter((p) => p.status !== "left");
  const opponent = me ? (roomPlayers.find((p) => p.player_slot !== me.player_slot) ?? null) : null;
  const isMulti = roomPlayers.length > 2;
  const isHost = !!me && !!duel && duel.host_user_id === me.user_id;

  // Battery (31 Oct 2026): nothing below runs while the app is hidden (an iPhone freezes a hidden app
  // anyway); each starts again, at once, on return.
  const hidden = usePageHidden();

  // Heartbeat so the opponent can tell we are still here.
  useEffect(() => {
    if (!me || hidden) return;
    const duelId = me.duel_id;
    void heartbeat(duelId);
    const id = window.setInterval(() => void heartbeat(duelId), 4000);
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
    opponent,
    roomPlayers,
    isHost,
    isMulti,
    now,
    refresh: load,
  };
}
