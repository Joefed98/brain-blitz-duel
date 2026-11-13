/**
 * Rooms draw their players with the shared identity pieces only (13 Nov 2026, one identity everywhere;
 * docs/nameplate.md "Rooms"): `NameplateStrip` on rows, `PlayerCard` (through `NameplateSheet`) when a row is tapped
 * and on the podium, `MiniCard` in chat. This file only wires a room's cards (one batched read, useRoomCards) to them:
 *
 * - `RoomCardsHost` (round the room route) holds the room's cards by seat and the one card sheet open at a time; the
 *   room screen publishes them with `usePublishRoomCards`.
 * - `useRoomNameplate()` turns a slot, name and room look into a `NameplatePlayer` (`roomNameplate`).
 * - `RoomPlayerName` is a row's name area: the strip, as a button opening the full card when there is one. Places,
 *   scores and times stay outside it on the plain row (cosmetics never behind them).
 * - `RoomMiniCard` is the chat's mini card (a guest's colour and initial or icon when there is no card).
 *
 * Outside a room's host (practice, a friend challenge's podium) every player is drawn on their room look, colour and
 * initial, exactly as before.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { MiniCard, NameplateFullCard, NameplateSheet, NameplateStrip, nameplateLook, nameplateOpens, type NameplatePlayer } from "@/design/identity";
import type { PlayerLook } from "@/lib/duel/playerLook";
import { roomNameplate, type RoomCardsAnswer, type RoomSeatCard } from "@/lib/identity/roomCards";

import { PlayerBadge } from "./PlayerBadge";

interface RoomCardsValue {
  /** The seat card for a slot (none for a guest, or before the cards arrive). */
  seatOf: (slot: number) => RoomSeatCard | undefined;
  /** The slots that read "Hidden player" on anything leaving the room (the share card). */
  hiddenOutside: ReadonlySet<number>;
  open: (player: NameplatePlayer) => void;
}

interface RoomCardsState {
  cards: RoomCardsAnswer;
  /** Seat id (duel_players.id) by slot. */
  slots: ReadonlyMap<number, string>;
}

const RoomCardsContext = createContext<RoomCardsValue | null>(null);
const PublishContext = createContext<((state: RoomCardsState | null) => void) | null>(null);

/**
 * Around the room route: holds the room's cards (published by the room screen, which reads them, `usePublishRoomCards`)
 * and the one full card open at a time, for every room screen below it.
 */
export function RoomCardsHost({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RoomCardsState | null>(null);
  const [shown, setShown] = useState<NameplatePlayer | null>(null);
  const seatOf = useCallback(
    (slot: number) => {
      const id = state?.slots.get(slot);
      return id ? state?.cards.cards[id] : undefined;
    },
    [state],
  );
  const hiddenOutside = useMemo(() => {
    const out = new Set<number>();
    if (!state) return out;
    const hidden = new Set(state.cards.hiddenOutside);
    for (const [slot, id] of state.slots) if (hidden.has(id)) out.add(slot);
    return out;
  }, [state]);
  const value = useMemo<RoomCardsValue>(() => ({ seatOf, hiddenOutside, open: setShown }), [seatOf, hiddenOutside]);
  return (
    <PublishContext.Provider value={setState}>
      <RoomCardsContext.Provider value={value}>
        {children}
        <NameplateSheet player={shown} onClose={() => setShown(null)} />
      </RoomCardsContext.Provider>
    </PublishContext.Provider>
  );
}

/** The room screen hands its cards (useRoomCards) and seats to the host; cleared when it leaves. */
export function usePublishRoomCards(cards: RoomCardsAnswer, seats: readonly { id: string; player_slot: number }[]): void {
  const publish = useContext(PublishContext);
  const key = seats.map((s) => `${s.player_slot}:${s.id}`).join(",");
  useEffect(() => {
    if (!publish) return;
    publish({ cards, slots: new Map(seats.map((s) => [s.player_slot, s.id])) });
  }, [publish, cards, key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => publish?.(null), [publish]);
}

/** `(slot, name, look) => NameplatePlayer` for this room (plain room looks outside a room). */
export function useRoomNameplate(): (slot: number, name: string, look: PlayerLook | undefined) => NameplatePlayer {
  const ctx = useContext(RoomCardsContext);
  return useCallback((slot, name, look) => roomNameplate(name, look, ctx?.seatOf(slot)), [ctx]);
}

/**
 * A room row's name area: the player's nameplate strip. With a card it is a button that opens their full card (the
 * row's tap); `after` (the "(you)" note, the Left tag) sits beside the strip, never on it.
 */
export function RoomPlayerName({
  slot,
  name,
  look,
  label,
  after,
  className,
}: {
  slot: number;
  name: string;
  look: PlayerLook | undefined;
  /** The written name when it differs from the stored one ("Nova (you)"). */
  label?: string;
  after?: ReactNode;
  className?: string;
}) {
  const ctx = useContext(RoomCardsContext);
  const player = roomNameplate(name, look, ctx?.seatOf(slot));
  const strip = <NameplateStrip player={player} {...(label ? { label } : {})} />;
  const cls = `room-player${className ? ` ${className}` : ""}`;
  if (ctx && nameplateOpens(player))
    return (
      <span className={cls} data-room-plate={slot}>
        <button type="button" className="room-player-open press" data-open-card aria-label={`${name}. Open card`} onClick={() => ctx.open(player)}>
          {strip}
        </button>
        {after}
      </span>
    );
  return (
    <span className={cls} data-room-plate={slot}>
      {strip}
      {after}
    </span>
  );
}

/** The chat's mini card for a sender (their room colour and initial or icon without a card). */
export function RoomMiniCard({ slot, name, look, size }: { slot: number | undefined; name: string; look: PlayerLook | undefined; size: number }) {
  const ctx = useContext(RoomCardsContext);
  const seat = slot === undefined ? undefined : ctx?.seatOf(slot);
  if (seat) return <MiniCard look={nameplateLook(seat.card)} size={size} />;
  return <PlayerBadge look={look} name={name} size={size} />;
}

/** The full card's player for a podium step (null without a card: the step draws the room look). */
export function useRoomCardPlayer(): (slot: number, name: string) => Extract<NameplatePlayer, { kind: "card" }> | null {
  const ctx = useContext(RoomCardsContext);
  return useCallback(
    (slot, name) => {
      const seat = ctx?.seatOf(slot);
      return seat ? { kind: "card", name, card: seat.card, playerNumber: seat.playerNumber, tier: seat.tier } : null;
    },
    [ctx],
  );
}

/** Opens a player's full card in the room's one sheet (a no-op outside a room or for a player with no card). */
export function useOpenRoomCard(): (player: NameplatePlayer) => void {
  const ctx = useContext(RoomCardsContext);
  return useCallback((player) => {
    if (ctx && nameplateOpens(player)) ctx.open(player);
  }, [ctx]);
}

/** Whether this screen is inside a room (its players' cards can be drawn), not practice or a challenge's podium. */
export function useInRoom(): boolean {
  return useContext(RoomCardsContext) !== null;
}

/**
 * The podium's full cards (13 Nov 2026, one identity everywhere): the top three as A2's full PlayerCard, 1st across the
 * width and 2nd and 3rd side by side under it; a player with no card (a guest) on their nameplate strip in a plain
 * panel. Places and totals stay on the plinths and rows under it, never on a card. A tap on a card opens it.
 */
export function PodiumCards({
  top,
  pair = false,
}: {
  top: readonly { slot: number; name: string; position: number; look: PlayerLook | undefined }[];
  /** The two-player final: both cards side by side, the same size. */
  pair?: boolean;
}) {
  const ctx = useContext(RoomCardsContext);
  if (!ctx || !top.length) return null;
  return (
    <ol className="room-podium-cards" aria-label={pair ? "Players" : "Top three"} data-podium-cards={top.length} data-pair={pair ? "" : undefined}>
      {top.map((p, i) => {
        const player = roomNameplate(p.name, p.look, ctx.seatOf(p.slot));
        return (
          <li key={p.slot} className="room-podium-card" data-podium-card={i + 1} data-place={p.position}>
            {nameplateOpens(player) ? (
              <button type="button" className="room-podium-open press" data-open-card data-skin-off="" aria-label={`${p.name}. Open card`} onClick={() => ctx.open(player)}>
                <NameplateFullCard player={player} />
              </button>
            ) : (
              <span className="room-podium-plain">
                <NameplateStrip player={player} />
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

const NO_SLOTS: ReadonlySet<number> = new Set();

/**
 * The room's slots that read "Hidden player" on anything that leaves the room (the share card's image; Joe, 13 Nov 2026).
 * Empty outside a room.
 */
export function useRoomHiddenOutside(): ReadonlySet<number> {
  return useContext(RoomCardsContext)?.hiddenOutside ?? NO_SLOTS;
}
