/**
 * Racing's ghost cars (display only; docs/arcade-standard/racing.md): during a room's Racing round each phone
 * broadcasts its car's track distance `s` and lateral position `x` (the racing sim's own units) a few times a second
 * on the room's ephemeral broadcast channel, and draws the other players as translucent ghost cars with name tags.
 * Nothing here reaches the sim, the input log, the server or the score: no collisions and no points for overtaking.
 * Practice (no room) has no ghosts. The room screen starts it (`startRaceGhosts`) only while a Racing round plays.
 */
import { useSyncExternalStore } from "react";

import { supabase } from "@/integrations/supabase/client";

export interface RaceGhost {
  name: string;
  colour: string;
  s: number;
  x: number;
}

interface Me {
  key: string;
  name: string;
  colour: string;
}

/** Sends at most this often (ms); a ghost not heard from for GHOST_STALE_MS disappears. */
export const GHOST_SEND_MS = 150;
export const GHOST_STALE_MS = 2_500;

type Channel = ReturnType<typeof supabase.channel>;
let channel: Channel | null = null;
let me: Me | null = null;
let sentAt = 0;
const seen = new Map<string, RaceGhost & { at: number }>();
let list: RaceGhost[] = [];
const listeners = new Set<() => void>();

function publish(): void {
  const now = Date.now();
  list = [...seen.entries()].filter(([, g]) => now - g.at < GHOST_STALE_MS).map(([, g]) => ({ name: g.name, colour: g.colour, s: g.s, x: g.x }));
  for (const l of listeners) l();
}

/** Joins a room's ghost channel for one round (`round` keeps an earlier round's stray messages out). Returns the stop. */
export function startRaceGhosts(roomId: string, round: number, player: Me): () => void {
  stopRaceGhosts();
  me = player;
  const tag = `${roomId}:${round}`;
  try {
    channel = supabase
      .channel(`race-ghosts-${tag}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "car" }, ({ payload }) => {
        const p = payload as Partial<RaceGhost> & { key?: string } | undefined;
        if (!p || typeof p.key !== "string" || p.key === me?.key) return;
        if (!Number.isFinite(p.s) || !Number.isFinite(p.x)) return;
        seen.set(p.key, { name: String(p.name ?? "").slice(0, 24), colour: String(p.colour ?? "#C9CCD6").slice(0, 16), s: Number(p.s), x: Number(p.x), at: Date.now() });
        publish();
      });
    channel.subscribe();
  } catch {
    channel = null;
  }
  return stopRaceGhosts;
}

export function stopRaceGhosts(): void {
  if (channel) {
    try {
      void supabase.removeChannel(channel);
    } catch {
      /* display only */
    }
  }
  channel = null;
  me = null;
  seen.clear();
  if (list.length) publish();
}

/** The stage calls this as its car moves (throttled here); a no-op outside a room's Racing round. */
export function publishRaceGhost(s: number, x: number): void {
  if (!channel || !me) return;
  const now = Date.now();
  if (now - sentAt < GHOST_SEND_MS) return;
  sentAt = now;
  void channel.send({ type: "broadcast", event: "car", payload: { key: me.key, name: me.name, colour: me.colour, s: Math.round(s), x: Math.round(x) } }).catch(() => undefined);
  // Drop ghosts that went quiet (left, or finished their run).
  if ([...seen.values()].some((g) => now - g.at >= GHOST_STALE_MS)) publish();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const snapshot = () => list;
const empty: RaceGhost[] = [];

/** The other players' latest positions (display only). */
export function useRaceGhosts(): RaceGhost[] {
  return useSyncExternalStore(subscribe, snapshot, () => empty);
}
