import { useEffect, useRef, useState } from "react";

import { PLAYER_ICONS_ENABLED } from "@/lib/brand";
import {
  BADGE_GLYPH,
  PLAYER_COLOURS,
  PLAYER_ICON_IDS,
  colourWheel,
  playerInitial,
  takenColours,
  takenIcons,
  type PlayerIconId,
  type PlayerLook,
  type PlayerLooks,
} from "@/lib/duel/playerLook";

import { MAX_PLAYERS, MIN_PLAYERS, type DuelPlayerRow } from "@/lib/duel/types";
import { roomRoundCount } from "@/lib/duel/selection";
import { readRoomSettings, roomSettingsUnlocked, settingsFacts, type RoomSettings } from "@/lib/duel/roomSettings";

import { ChargeMeter } from "@/components/fx/ChargeMeter";
import { useCelebrationsOn } from "@/components/fx/useCelebration";

import { Dots, WaitingLine } from "./Dots";
import { PlayerBadge } from "./PlayerBadge";
import { PLAYER_ICON_ART } from "./playerIcons";
import { ConfirmDialog } from "./ConfirmDialog";
import { RoomFooter, RoomMenu } from "./RoomFooter";
import { RoomSettingsSheet } from "./RoomSettingsSheet";
import { Button } from "@/design/components";
import { MetaChips } from "@/components/app/MetaChips";

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

/** Ring radii as a share of the wheel's radius less half a swatch, outside in. */
const WHEEL_RADII = [1, 0.62, 0.25] as const;

/**
 * The colour wheel (31 Oct 2026): the 32 swatches (playerLook.ts colourWheel) in three rings like a
 * colour picker, the most colourful outside. Each swatch is a 44 px tap target with a 34 px disc;
 * a colour another player in the room holds is dimmed with their initial and can't be tapped; the
 * chosen one has a ring and a tick. Square, up to 340 px; on a 375 px phone it reaches 14 px into the
 * card's padding each side (room-16-check proves no two tap targets overlap at 375×667).
 */
export function ColourWheel({
  selected,
  taken,
  takenBy,
  onPick,
}: {
  selected: number;
  taken: ReadonlyMap<number, number>;
  takenBy: (slot: number) => string;
  onPick: (colour: number) => void;
}) {
  return (
    <div
      data-colour-wheel
      role="radiogroup"
      aria-label="Your colour"
      // 14 px into the card's padding each side, so 18 outer swatches keep 44 px apart at 375 px phones.
      className="relative -mx-[14px] aspect-square w-[calc(100%+28px)] max-w-[340px] self-center"
    >
      {colourWheel().map(({ index, ring, angle }) => {
        const colour = PLAYER_COLOURS[index]!;
        const holder = taken.get(index);
        const isSelected = selected === index;
        const k = WHEEL_RADII[ring];
        const rad = (angle * Math.PI) / 180;
        return (
          <button
            key={index}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={holder !== undefined}
            data-swatch={index}
            data-swatch-taken={holder !== undefined ? "" : undefined}
            aria-label={holder !== undefined ? `${colour.name}, taken by ${takenBy(holder)}` : colour.name}
            onClick={() => onPick(index)}
            className="press absolute flex h-11 w-11 items-center justify-center rounded-full disabled:cursor-not-allowed"
            style={{
              left: `calc(50% + (50% - 22px) * ${(k * Math.sin(rad)).toFixed(4)} - 22px)`,
              top: `calc(50% - (50% - 22px) * ${(k * Math.cos(rad)).toFixed(4)} - 22px)`,
            }}
          >
            <span
              className={`flex h-[34px] w-[34px] items-center justify-center rounded-full ${
                isSelected ? "ring-2 ring-foreground ring-offset-2 ring-offset-card" : ""
              } ${holder !== undefined ? "opacity-30" : ""}`}
              style={{ background: colour.hex, color: BADGE_GLYPH }}
              aria-hidden="true"
            >
              {/* A taken colour carries its holder's initial (and stays dimmed, not tappable). */}
              {holder !== undefined && (
                <span className="font-display text-sm font-bold leading-none">{playerInitial(takenBy(holder))}</span>
              )}
              {isSelected && (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke={BADGE_GLYPH} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** My colour and icon choices: Profile (my default) and the lobby (this room; tap my own chip to open it). */
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
      <p className="font-display text-xs font-semibold jz-em-name">Your colour</p>
      <ColourWheel selected={look.colour} taken={taken} takenBy={takenBy} onPick={(colour) => onChange({ colour })} />
      {PLAYER_ICONS_ENABLED && (
        <>
          <p className="mt-1 font-display text-xs font-semibold jz-em-name">Your icon</p>
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

/** The waiting room for two to sixteen players. */
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
  const pickerRef = useRef<HTMLDivElement>(null);
  // The wheel opens under the two-column grid: bring it into view (16 players fill the screen above it).
  useEffect(() => {
    if (picking) pickerRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [picking]);
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
      setLookError(error instanceof Error ? error.message : "Couldn’t change that. Try again.");
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
        <MetaChips data-room-summary facts={settingsFacts(settings)} />
        {canEditSettings ? (
          <Button
            variant="secondary"
            data-room-settings
            onClick={() => setSettingsOpen(true)}
          >
            Room settings
          </Button>
        ) : null}
      </section>

      <section aria-label="Players" className="flex flex-col gap-2">
        {/* "Players" with "n of 16", then the neutral meter (the charge meter with celebrations on). */}
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
        {/* Two columns (31 Oct 2026, rooms of 16): one chip per player, badge (initial or icon) beside the name. My
            own chip opens the colour wheel for this room, under the grid. */}
        <ul className="rs-grid" data-lobby-grid>
          {players.map((player) => {
            const isMe = player.user_id === meUserId;
            const look = lookFor(player.player_slot);
            const you = look ? PLAYER_COLOURS[look.colour]?.hex : undefined;
            const isHostRow = player.user_id === hostUserId;
            const sub = isMe
              ? "You"
              : player.muted_by_host
                ? "Chat muted"
                : isHostRow
                  ? "Host"
                  : null;
            const nameLine = (
              <>
                <PlayerBadge look={look} name={player.display_name} size={28} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="rs-name th-name text-[14px] leading-tight">{player.display_name}</span>
                  {sub ? (
                    <span className="rs-sub truncate text-[12px] leading-tight" data-host-label={isHostRow && !isMe ? "" : undefined}>
                      {isMe && isHostRow ? "You, host" : sub}
                    </span>
                  ) : null}
                </span>
              </>
            );
            return (
              <li
                key={player.id}
                data-you={isMe ? "" : undefined}
                data-lobby-player={player.player_slot}
                style={isMe && you ? ({ ["--you" as string]: you }) : undefined}
                className="rs-cell animate-pop-in"
              >
                {isMe && canChooseLook ? (
                  <button
                    type="button"
                    data-look-toggle
                    aria-expanded={picking}
                    aria-label={`${player.display_name} (you): change your colour${PLAYER_ICONS_ENABLED ? " and icon" : ""} for this room`}
                    onClick={() => setPicking((open) => !open)}
                    className="press flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    {nameLine}
                    <span aria-hidden="true" className="shrink-0 text-[12px] text-[var(--ap-text-2)]">
                      {picking ? "▴" : "▾"}
                    </span>
                  </button>
                ) : (
                  <span className="flex min-h-11 min-w-0 flex-1 items-center gap-2">{nameLine}</span>
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
              </li>
            );
          })}
        </ul>
        {me && canChooseLook && !picking ? (
          <p className="rs-sub text-[13px]" data-look-hint>
            Tap your name to change your colour{PLAYER_ICONS_ENABLED ? " and icon" : ""} for this room.
          </p>
        ) : null}
        {me && picking && canChooseLook && myLook ? (
          <div ref={pickerRef} data-lobby-picker className="scroll-mb-28">
          <LookPicker
            look={myLook}
            name={me.display_name}
            taken={takenColours(allPlayers, me.player_slot)}
            takenIconSlots={takenIcons(allPlayers, me.player_slot)}
            takenBy={nameOf}
            onChange={changeLook}
          />
          </div>
        ) : null}
        {me && lookError ? (
          <p role="alert" className="text-xs text-warn">
            {lookError}
          </p>
        ) : null}
        {isHost && !canStart ? (
          <p className="text-[13px] leading-snug text-[var(--ap-text-2)]">Send the link to friends. Start when everyone’s in.{/* design-lint-ignore: styles unchanged, curly quotes only (F4) */}</p>
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
                {entry.winner} won{entry.forfeit ? " (others left)" : ""},{" "}
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
            <Button
              variant="gold"
              onClick={onStart}
              disabled={starting}
            >
              {starting ? (
                <>
                  <span>Starting</span>
                  <Dots className="bg-primary-foreground" />
                </>
              ) : (
                "Start game"
              )}
            </Button>
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
