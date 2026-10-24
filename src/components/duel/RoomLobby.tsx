import { useEffect, useState } from "react";

import { PLAYER_ICONS_ENABLED } from "@/lib/brand";
import {
  PLAYER_COLOURS,
  PLAYER_ICON_IDS,
  playerInitial,
  takenColours,
  takenIcons,
  type PlayerIconId,
  type PlayerLook,
  type PlayerLooks,
} from "@/lib/duel/playerLook";

import { MAX_PLAYERS, MIN_PLAYERS, type DuelPlayerRow } from "@/lib/duel/types";
import type { PuzzleCategory } from "@/lib/duel/types";
import { CATEGORY_ORDER, PUZZLE_CATEGORIES, STANDARD_CATEGORIES } from "@/lib/duel/categories";
import { CHAT_BAR_HEIGHT } from "@/lib/duel/chatConstants";
import { typesInCategory } from "@/lib/duel/registry";
import { roomRoundCount } from "@/lib/duel/selection";

import { ChargeMeter } from "@/components/fx/ChargeMeter";
import { useCelebrationsOn } from "@/components/fx/useCelebration";

import { Dots, WaitingLine } from "./Dots";
import { PlayerBadge } from "./PlayerBadge";
import { PLAYER_ICON_ART } from "./playerIcons";

function Crown() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0 fill-primary"
      focusable="false"
    >
      <path d="M3 8l4 3 5-6 5 6 4-3-2 10H5L3 8z" />
    </svg>
  );
}

interface RoomLobbyProps {
  categories: PuzzleCategory[];
  onCategoriesChange: (categories: PuzzleCategory[]) => void;

  players: DuelPlayerRow[];
  hostUserId: string | null;
  meUserId: string;
  isHost: boolean;
  starting: boolean;
  onStart: () => void;
  onRemove: (slot: number) => void;
  /** Host only: mute or unmute a player's chat and reactions for everyone. */
  onMuteForEveryone: (slot: number, muted: boolean) => void;
  onDisband: () => void;
  /** Guests only: leave the lobby (the caller confirms first). */
  onLeave: () => void;
  tournamentHistory: { winner: string; date: string; forfeit?: boolean }[];
  /** Everyone's colour and icon (resolvePlayerLooks over every row, left players included). */
  looks: PlayerLooks;
  /** Every player row in the room, left players included (who holds which colour). */
  allPlayers: DuelPlayerRow[];
  /** False until the colour/icon migration is applied: rows show slot colours, no picker. */
  canChooseLook: boolean;
  /** Stores my new colour and/or icon; rejects with a message when it can't. */
  onLookChange: (look: Partial<PlayerLook>) => Promise<void>;
}

/** My colour and icon choices, under my own row (tap my row to open it). */
export function LookPicker({
  look,
  name,
  taken,
  takenIconSlots,
  takenBy,
  onChange,
}: {
  look: PlayerLook;
  name: string;
  taken: ReadonlyMap<number, number>;
  /** Icons another player holds (greyed out, not tappable, like their colours). */
  takenIconSlots: ReadonlyMap<PlayerIconId, number>;
  takenBy: (slot: number) => string;
  onChange: (look: Partial<PlayerLook>) => void;
}) {
  return (
    <div data-look-picker className="th-card flex flex-col gap-2 rounded-xl border border-border bg-card px-3 py-3 text-left">
      <p className="font-display text-xs font-semibold text-foreground">Your colour</p>
      <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label="Your colour">
        {PLAYER_COLOURS.map((colour, index) => {
          const holder = taken.get(index);
          const selected = look.colour === index;
          return (
            <button
              key={colour.hex}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={holder !== undefined}
              aria-label={holder !== undefined ? `${colour.name}, taken by ${takenBy(holder)}` : colour.name}
              onClick={() => onChange({ colour: index })}
              className="press flex h-11 items-center justify-center rounded-lg disabled:cursor-not-allowed"
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""
                } ${holder !== undefined ? "opacity-40" : ""}`}
                style={{ background: colour.hex, color: "#0B0B0F" }}
                aria-hidden="true"
              >
                {/* A taken colour carries its holder's initial (and stays dimmed, not tappable). */}
                {holder !== undefined && (
                  <span className="font-display text-sm font-bold leading-none">{playerInitial(takenBy(holder))}</span>
                )}
                {selected && (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="#0B0B0F" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                )}
              </span>
            </button>
          );
        })}
      </div>
      {PLAYER_ICONS_ENABLED && (
        <>
          <p className="mt-1 font-display text-xs font-semibold text-foreground">Your icon</p>
          <div className="grid grid-cols-6 gap-1" role="radiogroup" aria-label="Your icon">
            {[null, ...PLAYER_ICON_IDS].map((icon) => {
              const selected = look.icon === icon;
              const holder = icon ? takenIconSlots.get(icon) : undefined;
              const label = icon ? PLAYER_ICON_ART[icon].label : "Your initial";
              return (
                <button
                  key={icon ?? "initial"}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={holder !== undefined}
                  aria-label={holder !== undefined ? `${label}, taken by ${takenBy(holder)}` : label}
                  data-look-icon={icon ?? "initial"}
                  onClick={() => onChange({ icon })}
                  className="press flex h-11 items-center justify-center rounded-lg disabled:cursor-not-allowed"
                >
                  <span
                    className={`rounded-full ${selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""} ${
                      holder !== undefined ? "opacity-40 grayscale" : ""
                    }`}
                  >
                    <PlayerBadge look={{ colour: look.colour, icon }} name={name} size={32} />
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** Host presets, each with the one-line description shown under them. */
const PRESETS: { label: string; values: readonly PuzzleCategory[]; description: string }[] = [
  { label: "Standard", values: STANDARD_CATEGORIES, description: "Standard: a mix of puzzles and arcade, one game per category." },
  { label: "Arcade only", values: ["arcade"], description: "Arcade only: six different arcade games." },
  { label: "Puzzles only", values: PUZZLE_CATEGORIES, description: "Puzzles only: six puzzles across five categories, no arcade." },
];

/** How the dealt rounds relate to the chosen categories, for the lobby line. */
function roundsLine(categories: readonly PuzzleCategory[]): string {
  const rounds = roomRoundCount(categories);
  const shape =
    categories.length === rounds
      ? "one game per category"
      : categories.length === 1
        ? "all different games from one category"
        : "shared evenly between the categories";
  return `${rounds} ${rounds === 1 ? "round" : "rounds"}, ${shape} · about ${rounds * 2} min`;
}

/** The waiting room for two to ten players. */
export function RoomLobby({
  players,
  categories,
  onCategoriesChange,
  hostUserId,
  meUserId,
  isHost,
  starting,
  onStart,
  onRemove,
  onMuteForEveryone,
  onDisband,
  onLeave,
  tournamentHistory,
  looks,
  allPlayers,
  canChooseLook,
  onLookChange,
}: RoomLobbyProps) {
  const canStart = players.length >= MIN_PLAYERS;
  const celebrate = useCelebrationsOn();
  const playersNeeded = MIN_PLAYERS - players.length;
  const hostName = players.find((player) => player.user_id === hostUserId)?.display_name;
  const hasEmptyCategory = CATEGORY_ORDER.some((category) => !typesInCategory(category).length);
  const [removing, setRemoving] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  /** My choice while it is on its way to the server (shown at once). */
  const [pending, setPending] = useState<Partial<PlayerLook> | null>(null);
  const [lookError, setLookError] = useState<string | null>(null);
  const me = players.find((player) => player.user_id === meUserId);
  const storedLook = me ? looks.get(me.player_slot) : undefined;
  const myLook = storedLook ? { ...storedLook, ...pending } : undefined;
  const lookFor = (slot: number) => (me && slot === me.player_slot ? myLook : looks.get(slot));
  const nameOf = (slot: number) => allPlayers.find((p) => p.player_slot === slot)?.display_name ?? "another player";
  const changeLook = (look: Partial<PlayerLook>) => {
    setLookError(null);
    setPending((current) => ({ ...current, ...look }));
    onLookChange(look).catch((error: unknown) => {
      setPending(null);
      setLookError(error instanceof Error ? error.message : "Couldn't change that. Try again.");
    });
  };
  // The choice stays shown until the room's own row carries it (or a few seconds pass).
  useEffect(() => {
    if (!pending) return;
    if (
      storedLook &&
      (pending.colour === undefined || pending.colour === storedLook.colour) &&
      (pending.icon === undefined || pending.icon === storedLook.icon)
    ) {
      setPending(null);
      return;
    }
    const timer = window.setTimeout(() => setPending(null), 4000);
    return () => window.clearTimeout(timer);
  }, [pending, storedLook?.colour, storedLook?.icon]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex w-full flex-col gap-4">
      {isHost && (
        <div className="flex flex-col items-center gap-1 text-center" data-host-label>
          <span className="th-btn-outline-gold whitespace-nowrap rounded-full border border-primary/70 bg-primary/10 px-3 py-1 font-display text-xs font-bold uppercase tracking-widest text-primary">
            You're the host
          </span>
          <p className="text-sm text-muted-foreground">
            {canStart
              ? "Choose categories, then start."
              : "Send this link to friends. Start when everyone's in."}
          </p>
        </div>
      )}
      {celebrate ? (
        // Celebrations' charge meter (lib/fx/celebrations.ts) directly under the count it fills to; its
        // 20 px are there from the first frame.
        <div className="flex flex-col gap-1.5">
          <p className="th-kicker text-center text-muted-foreground">
            {players.length} of {MAX_PLAYERS} players
          </p>
          <ChargeMeter players={players.length} />
        </div>
      ) : (
        <p className="th-kicker text-center text-muted-foreground">
          {players.length} of {MAX_PLAYERS} players
        </p>
      )}
      {canChooseLook && me && (
        <p className="-mt-2 text-center text-xs font-semibold text-primary" data-look-hint>
          Tap your name to choose your colour{PLAYER_ICONS_ENABLED ? " and icon" : ""}
        </p>
      )}
      {isHost && players.length > 1 && (
        <p className="text-center text-[11px] text-muted-foreground">
          🔊 Chat: mute that player's chat for everyone · ×: remove them
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {players.map((player) => {
          const isMe = player.user_id === meUserId;
          const nameLine = (
            <>
              <PlayerBadge look={lookFor(player.player_slot)} name={player.display_name} size={24} />
              {player.user_id === hostUserId && <Crown />}
              <span className="th-name flex-1 truncate text-sm text-foreground">
                {player.display_name}
              </span>
            </>
          );
          return (
            <li key={player.id} className="flex flex-col gap-2">
            <div
              data-tint={isMe ? "me" : undefined}
              className={`th-card flex animate-pop-in items-center gap-3 rounded-xl border px-4 py-3 text-left ${
                isMe ? "border-primary/70 bg-primary/10" : "border-border bg-card"
              }`}
            >
              {isMe && canChooseLook ? (
                <button
                  type="button"
                  data-look-toggle
                  aria-expanded={picking}
                  aria-label={`${player.display_name}: change your colour${PLAYER_ICONS_ENABLED ? " and icon" : ""}`}
                  onClick={() => setPicking((open) => !open)}
                  className="press -my-3 -ml-4 flex min-h-11 min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left"
                >
                  {nameLine}
                  <span
                    aria-hidden="true"
                    className="shrink-0 whitespace-nowrap rounded-full border border-primary/60 px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-wide text-primary"
                  >
                    {picking ? "Done ▴" : "Change ▾"}
                  </span>
                </button>
              ) : (
                nameLine
              )}
              {player.user_id === hostUserId && (
                <span className="th-kicker text-[10px] tracking-[0.1em] text-muted-foreground">Host</span>
              )}
              {isMe && (
                <span className="th-kicker text-[10px] tracking-[0.1em] text-primary">You</span>
              )}
              {isHost && !isMe && (
                <button
                  type="button"
                  aria-label={
                    player.muted_by_host
                      ? `Unmute ${player.display_name} for everyone`
                      : `Mute ${player.display_name} for everyone`
                  }
                  onClick={() => onMuteForEveryone(player.player_slot, !player.muted_by_host)}
                  className={`press flex h-11 w-12 flex-col items-center justify-center rounded-lg leading-none ${
                    player.muted_by_host ? "text-warn" : "text-muted-foreground"
                  }`}
                >
                  <span className="text-sm" aria-hidden="true">{player.muted_by_host ? "🔇" : "🔊"}</span>
                  <span className="mt-0.5 text-[9px] uppercase tracking-wide" aria-hidden="true">
                    {player.muted_by_host ? "Muted" : "Chat"}
                  </span>
                </button>
              )}
              {isHost && !isMe && (
                <button
                  type="button"
                  aria-label={
                    removing === player.player_slot
                      ? `Confirm removing ${player.display_name}`
                      : `Remove ${player.display_name}`
                  }
                  onClick={() => {
                    if (removing === player.player_slot) {
                      setRemoving(null);
                      onRemove(player.player_slot);
                    } else setRemoving(player.player_slot);
                  }}
                  onBlur={() => setRemoving((slot) => (slot === player.player_slot ? null : slot))}
                  className={`press flex h-11 items-center justify-center rounded-lg ${
                    removing === player.player_slot
                      ? "w-auto bg-warn/15 px-2 font-display text-xs font-bold uppercase text-warn"
                      : "w-11 text-lg text-muted-foreground"
                  }`}
                >
                  {removing === player.player_slot ? "Remove?" : "×"}
                </button>
              )}
            </div>
            {isMe && picking && canChooseLook && myLook && (
              <LookPicker
                look={myLook}
                name={player.display_name}
                taken={takenColours(allPlayers, player.player_slot)}
                takenIconSlots={takenIcons(allPlayers, player.player_slot)}
                takenBy={nameOf}
                onChange={changeLook}
              />
            )}
            {isMe && lookError && (
              <p role="alert" className="text-center text-xs text-warn">
                {lookError}
              </p>
            )}
            </li>
          );
        })}
      </ul>

      <div className="w-full space-y-3 text-left">
        <p className="th-kicker text-foreground">Categories</p>
        {isHost && (
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(({ label, values }) => (
              <button
                key={label}
                type="button"
                onClick={() => onCategoriesChange([...values])}
                aria-pressed={
                  categories.length === values.length &&
                  categories.every((category) => values.includes(category))
                }
                className="th-chip press min-h-11 whitespace-nowrap rounded-md border border-border bg-card px-3 py-2 font-display text-xs font-bold uppercase text-foreground aria-pressed:border-primary aria-pressed:text-primary"
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {isHost && (
          <p className="text-xs text-muted-foreground">
            {PRESETS.find(
              ({ values }) =>
                categories.length === values.length &&
                categories.every((category) => values.includes(category)),
            )?.description ?? "Custom: at least six rounds, shared between the categories you pick."}
          </p>
        )}
        {isHost ? (
          <div className="flex flex-wrap gap-2">
            {CATEGORY_ORDER.map((category) => (
              <button
                key={category}
                type="button"
                aria-pressed={categories.includes(category)}
                title={
                  typesInCategory(category).length
                    ? undefined
                    : "No active games in this category yet"
                }
                disabled={
                  (!typesInCategory(category).length && !categories.includes(category)) ||
                  (categories.length === 1 && categories.includes(category))
                }
                onClick={() =>
                  onCategoriesChange(
                    categories.includes(category)
                      ? categories.filter((item) => item !== category)
                      : CATEGORY_ORDER.filter(
                          (item) => categories.includes(item) || item === category,
                        ),
                  )
                }
                data-cat={category}
                className="th-chip press inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-card px-3 py-2 font-display text-xs font-bold uppercase text-muted-foreground aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary disabled:opacity-70"
              >
                <span aria-hidden="true" className="th-chip-dot" />
                {category}
              </button>
            ))}
          </div>
        ) : null}
        {isHost && (
          <p className="text-xs text-muted-foreground">
            {hasEmptyCategory ? "Faded categories have no games yet. " : ""}Keep at least one category.
          </p>
        )}
        {isHost ? null : (
          <p className="text-sm text-muted-foreground">
            Categories:{" "}
            {categories
              .map((category) => category.charAt(0).toUpperCase() + category.slice(1))
              .join(" · ")}
          </p>
        )}
        <p className="text-xs text-muted-foreground" data-lobby-rounds>
          {roundsLine(categories)}
        </p>
      </div>

      {tournamentHistory.length > 0 && (
        <div className="space-y-1 border-t border-border pt-3">
          <p className="th-kicker text-muted-foreground">Previous games</p>
          {tournamentHistory
            .slice(-3)
            .reverse()
            .map((entry, index) => (
              <p key={`${entry.date}-${index}`} className="text-xs text-muted-foreground">
                {entry.winner} won{entry.forfeit ? " (others left)" : ""} ·{" "}
                {new Date(entry.date).toLocaleDateString()}
              </p>
            ))}
        </div>
      )}

      {/* Pinned flush on the chat bar, solid, so Start / Waiting stay on screen with ten players
          and nothing shows through or between the two bars. */}
      <div
        data-lobby-footer
        className="room-sticky-footer sticky z-30 -mx-1 flex flex-col gap-2 bg-background px-1 pb-2 pt-2"
        style={{ bottom: `calc(${CHAT_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))` }}
      >
        {isHost ? (
          <>
            {canStart || starting ? (
              <button
                type="button"
                onClick={onStart}
                disabled={starting}
                className="th-btn-gold press tap-target flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-display text-lg font-extrabold uppercase tracking-wide text-primary-foreground disabled:opacity-40"
              >
                {starting ? (
                  <>
                    <span>Starting</span>
                    <Dots className="bg-primary-foreground" />
                  </>
                ) : (
                  "Start game"
                )}
              </button>
            ) : (
              // Not a disabled button: a status line, so the share link above is the call to action.
              <p data-lobby-waiting className="flex min-h-11 items-center justify-center text-center text-sm text-foreground" role="status">
                Waiting for {playersNeeded} more {playersNeeded === 1 ? "player" : "players"} to join
              </p>
            )}
            <button
              type="button"
              onClick={onDisband}
              className="press min-h-11 text-sm text-muted-foreground underline decoration-border underline-offset-4"
            >
              Disband room
            </button>
          </>
        ) : (
          <>
            <WaitingLine
              className="min-h-11"
              label={hostName ? `Waiting for ${hostName} (host) to start` : "Waiting for the host to start"}
            />
            <button
              type="button"
              onClick={onLeave}
              className="th-btn-ghost press tap-target w-full rounded-xl border border-border font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Leave room
            </button>
          </>
        )}
      </div>
    </div>
  );
}
