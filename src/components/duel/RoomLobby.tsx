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
import { roomRoundCount } from "@/lib/duel/selection";
import { readRoomSettings, roomSettingsUnlocked, settingsSummary, type RoomSettings } from "@/lib/duel/roomSettings";

import { ChargeMeter } from "@/components/fx/ChargeMeter";
import { useCelebrationsOn } from "@/components/fx/useCelebration";

import { Dots, WaitingLine } from "./Dots";
import { PlayerBadge } from "./PlayerBadge";
import { PLAYER_ICON_ART } from "./playerIcons";
import { ConfirmDialog } from "./ConfirmDialog";
import { RoomFooter, RoomMenu } from "./RoomFooter";
import { RoomSettingsSheet } from "./RoomSettingsSheet";

interface RoomLobbyProps {
  /** The room's stored settings (duels.selected_categories: roomSettings.ts, or an older room's categories). */
  storedSettings: unknown;
  /** Host only: stores new settings on the server (rejects with the server's message). */
  onSettingsChange: (settings: RoomSettings) => Promise<void>;

  players: DuelPlayerRow[];
  hostUserId: string | null;
  meUserId: string;
  isHost: boolean;
  starting: boolean;
  onStart: () => void;
  onRemove: (slot: number) => void;
  /** Host only: mute or unmute a player's chat and reactions for everyone. */
  onMuteForEveryone: (slot: number, muted: boolean) => void;
  /** Host only: disband (the header's "⋯" menu, drawn by the room route). */
  onDisband?: () => void;
  /** Guests only: leave the lobby (the caller confirms first). */
  onLeave?: () => void;
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

/**
 * The room's settings as the lobby shows them. A room saved with settings plays its own count; an older room
 * (no settings saved yet) still deals by its categories, roomRoundCount(categories) rounds, until the host saves.
 */
function lobbySettings(stored: unknown): RoomSettings {
  const read = readRoomSettings(stored);
  const categories = read.categories;
  return read.legacy ? { picks: read.settings.picks, rounds: roomRoundCount(categories) } : read.settings;
}

/** The waiting room for two to ten players. */
export function RoomLobby({
  players,
  storedSettings,
  onSettingsChange,
  hostUserId,
  meUserId,
  isHost,
  starting,
  onStart,
  onRemove,
  onMuteForEveryone,
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Settings just saved, shown until the room's own row carries them (or a few seconds pass). */
  const [savedSettings, setSavedSettings] = useState<{ settings: RoomSettings; stored: unknown } | null>(null);
  const storedKey = JSON.stringify(storedSettings ?? null);
  useEffect(() => {
    if (!savedSettings) return;
    if (JSON.stringify(savedSettings.stored ?? null) !== storedKey) {
      setSavedSettings(null);
      return;
    }
    const timer = window.setTimeout(() => setSavedSettings(null), 4000);
    return () => window.clearTimeout(timer);
  }, [savedSettings, storedKey]);
  const settings = savedSettings?.settings ?? lobbySettings(storedSettings);
  const canEditSettings = isHost && roomSettingsUnlocked();
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

  const removingPlayer = removing === null ? null : players.find((p) => p.player_slot === removing) ?? null;

  return (
    <div className="flex w-full flex-1 flex-col gap-5 text-left">
      {/* Under the room code: the room's settings in one line for everyone, the host's Room settings button. */}
      <section aria-label="Room settings" className="-mt-2 flex flex-col items-start gap-2.5">
        <p data-room-summary className="rs-summary">
          {settingsSummary(settings)}
        </p>
        {canEditSettings ? (
          <button
            type="button"
            data-room-settings
            onClick={() => setSettingsOpen(true)}
            className="rs-btn press tap-target"
          >
            Room settings
          </button>
        ) : null}
      </section>

      <section aria-label="Players" className="flex flex-col gap-2">
        {/* "Players" with "n of 10", then the neutral meter (the charge meter with celebrations on). */}
        <div className="rs-head">
          <h2 className="ap-section-title">Players</h2>
          <span className="rs-meta">
            {players.length} of {MAX_PLAYERS}
          </span>
        </div>
        {celebrate ? (
          <ChargeMeter players={players.length} />
        ) : (
          <div className="rs-meter" aria-hidden="true">
            <span style={{ width: `${(players.length / MAX_PLAYERS) * 100}%` }} />
          </div>
        )}
        <ul className="rs-list">
          {players.map((player) => {
            const isMe = player.user_id === meUserId;
            const look = lookFor(player.player_slot);
            const you = look ? PLAYER_COLOURS[look.colour]?.hex : undefined;
            const sub = isMe && canChooseLook
              ? <span className="rs-sub" data-look-hint>Tap to change your colour{PLAYER_ICONS_ENABLED ? " and icon" : ""}</span>
              : player.muted_by_host
                ? <span className="rs-sub">Chat muted</span>
                : null;
            const nameLine = (
              <>
                <PlayerBadge look={look} name={player.display_name} size={30} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex min-w-0 items-baseline gap-1">
                    <span className="rs-name th-name">{player.display_name}</span>
                    {isMe ? <span className="rs-you shrink-0 text-[14px]">(you)</span> : null}
                  </span>
                  {sub}
                </span>
              </>
            );
            return (
              <li
                key={player.id}
                data-you={isMe ? "" : undefined}
                style={isMe && you ? ({ ["--you" as string]: you }) : undefined}
                className="rs-row animate-pop-in flex-wrap"
              >
                {isMe && canChooseLook ? (
                  <button
                    type="button"
                    data-look-toggle
                    aria-expanded={picking}
                    aria-label={`${player.display_name}: change your colour${PLAYER_ICONS_ENABLED ? " and icon" : ""}`}
                    onClick={() => setPicking((open) => !open)}
                    className="press -my-1.5 flex min-h-11 min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    {nameLine}
                    <span aria-hidden="true" className="rs-pill">
                      {picking ? "Done ▴" : "Change ▾"}
                    </span>
                  </button>
                ) : (
                  <span className="flex min-w-0 flex-1 items-center gap-2.5">{nameLine}</span>
                )}
                {player.user_id === hostUserId && (
                  <span className="rs-pill" data-host-label>Host</span>
                )}
                {isHost && !isMe && (
                  <RoomMenu
                    label={`Options for ${player.display_name}`}
                    items={[
                      {
                        label: player.muted_by_host
                          ? `Unmute ${player.display_name} for everyone`
                          : `Mute ${player.display_name} for everyone`,
                        onSelect: () => onMuteForEveryone(player.player_slot, !player.muted_by_host),
                      },
                      { label: `Remove ${player.display_name}`, danger: true, onSelect: () => setRemoving(player.player_slot) },
                    ]}
                  />
                )}
                {isMe && picking && canChooseLook && myLook && (
                  <div className="w-full pb-1.5 pt-1">
                    <LookPicker
                      look={myLook}
                      name={player.display_name}
                      taken={takenColours(allPlayers, player.player_slot)}
                      takenIconSlots={takenIcons(allPlayers, player.player_slot)}
                      takenBy={nameOf}
                      onChange={changeLook}
                    />
                  </div>
                )}
                {isMe && lookError && (
                  <p role="alert" className="w-full pb-1 text-xs text-warn">
                    {lookError}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        {isHost && !canStart ? (
          <p className="text-[13px] leading-snug text-[var(--ap-text-2)]">Send the link to friends. Start when everyone's in.</p>
        ) : null}
      </section>

      {tournamentHistory.length > 0 && (
        <section aria-label="Previous games" className="flex flex-col gap-1">
          <h2 className="ap-section-title text-[15px]">Previous games</h2>
          {tournamentHistory
            .slice(-3)
            .reverse()
            .map((entry, index) => (
              <p key={`${entry.date}-${index}`} className="text-[13px] text-[var(--ap-text-2)]">
                {entry.winner} won{entry.forfeit ? " (others left)" : ""} ·{" "}
                {new Date(entry.date).toLocaleDateString()}
              </p>
            ))}
        </section>
      )}

      {settingsOpen && canEditSettings ? (
        <RoomSettingsSheet
          initial={settings}
          onClose={() => setSettingsOpen(false)}
          onSave={async (next) => {
            await onSettingsChange(next);
            setSavedSettings({ settings: next, stored: storedSettings });
          }}
        />
      ) : null}

      {removingPlayer && (
        <ConfirmDialog
          title={`Remove ${removingPlayer.display_name}?`}
          body="They leave the lobby and can join again with the link."
          confirmLabel="Remove"
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            setRemoving(null);
            onRemove(removingPlayer.player_slot);
          }}
        />
      )}

      {/* The room footer: the chat button, then Start game (gold) or the waiting line. Disband and Leave
          are in the header's "⋯" menu. */}
      <RoomFooter className="mt-auto">
        {isHost ? (
          canStart || starting ? (
            <button
              type="button"
              onClick={onStart}
              disabled={starting}
              className="th-btn-gold ap-btn-gold rs-btn-gold press tap-target"
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
            <p data-lobby-waiting className="rs-status" role="status">
              Waiting for {playersNeeded} more {playersNeeded === 1 ? "player" : "players"} to join
            </p>
          )
        ) : (
          <WaitingLine
            className="rs-status"
            label={hostName ? `Waiting for ${hostName} (host) to start` : "Waiting for the host to start"}
          />
        )}
      </RoomFooter>
    </div>
  );
}
