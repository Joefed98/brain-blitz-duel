import { useCallback, useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

import { fetchDuelByCode, fetchPlayers, fetchResults, heartbeat } from "./api";
import { initServerClock, serverNow } from "./clock";
import { getSessionToken } from "./session";
import { DISCONNECT_MS, type DuelPlayerRow, type DuelRow, type RoundResultRow } from "./types";

export interface DuelState {
  loading: boolean;
  notFound: boolean;
  duel: DuelRow | null;
  players: DuelPlayerRow[];
  results: RoundResultRow[];
  me: DuelPlayerRow | null;
  opponent: DuelPlayerRow | null;
  opponentDisconnected: boolean;
  now: number;
  refresh: () => Promise<void>;
}

/** Ticking clock so timers and deadlines re-render smoothly. */
export function useNow(intervalMs = 100): number {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const id = window.setInterval(() => setNow(serverNow()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useDuel(roomCode: string): DuelState {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [duel, setDuel] = useState<DuelRow | null>(null);
  const [players, setPlayers] = useState<DuelPlayerRow[]>([]);
  const [results, setResults] = useState<RoundResultRow[]>([]);
  const duelIdRef = useRef<string | null>(null);
  const now = useNow(100);

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
    setLoading(false);
  }, [roomCode]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    void initServerClock().then(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Realtime: both phones react to duel, player and result changes instantly.
  useEffect(() => {
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
          void fetchPlayers(row.duel_id).then(setPlayers);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "round_results" },
        (payload) => {
          const row = (payload.new ?? payload.old) as RoundResultRow | undefined;
          if (!row || row.duel_id !== duelIdRef.current) return;
          void fetchResults(row.duel_id).then(setResults);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomCode]);

  const token = typeof window === "undefined" ? "" : getSessionToken();
  const me = players.find((p) => p.session_token === token) ?? null;
  const opponent = me ? (players.find((p) => p.player_slot !== me.player_slot) ?? null) : null;

  // Heartbeat so the opponent can tell we are still here.
  useEffect(() => {
    if (!me) return;
    void heartbeat(me.id);
    const id = window.setInterval(() => void heartbeat(me.id), 4000);
    return () => window.clearInterval(id);
  }, [me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Safety net against a missed realtime event.
  useEffect(() => {
    const id = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(id);
  }, [load]);

  const opponentDisconnected =
    !!opponent &&
    duel?.status === "in_progress" &&
    now - new Date(opponent.last_seen_at).getTime() > DISCONNECT_MS;

  return {
    loading,
    notFound,
    duel,
    players,
    results,
    me,
    opponent,
    opponentDisconnected,
    now,
    refresh: load,
  };
}
