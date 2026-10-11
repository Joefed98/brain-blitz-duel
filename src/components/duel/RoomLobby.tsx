import { MAX_PLAYERS, MIN_PLAYERS, type DuelPlayerRow } from "@/lib/duel/types";
import type { PuzzleCategory } from "@/lib/duel/types";
import { CATEGORY_ORDER, PUZZLE_CATEGORIES, STANDARD_CATEGORIES } from "@/lib/duel/categories";
import { typesInCategory } from "@/lib/duel/registry";

import { Dots, WaitingLine } from "./Dots";

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
  tournamentHistory: { winner: string; date: string }[];
}

/** Host presets, each with the one-line description shown under them. */
const PRESETS: { label: string; values: readonly PuzzleCategory[]; description: string }[] = [
  { label: "Standard", values: STANDARD_CATEGORIES, description: "Standard: a mix of puzzles and arcade, one game per category." },
  { label: "Arcade only", values: ["arcade"], description: "Arcade only: a single arcade game." },
  { label: "Puzzles only", values: PUZZLE_CATEGORIES, description: "Puzzles only: one puzzle per category, no arcade." },
];

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
  tournamentHistory,
}: RoomLobbyProps) {
  const canStart = players.length >= MIN_PLAYERS;
  const playersNeeded = MIN_PLAYERS - players.length;
  const hostName = players.find((player) => player.user_id === hostUserId)?.display_name;
  const roundCount = categories.length;
  const hasEmptyCategory = CATEGORY_ORDER.some((category) => !typesInCategory(category).length);

  return (
    <div className="flex w-full flex-col gap-4">
      <p className="text-center font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
        {players.length} of {MAX_PLAYERS} players
      </p>
      {isHost && (
        <p className="text-center text-sm text-muted-foreground">
          {canStart
            ? "You're the host: choose categories, then start."
            : "Send this code to friends. Start when everyone's in."}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {players.map((player) => {
          const isMe = player.user_id === meUserId;
          return (
            <li
              key={player.id}
              className={`flex animate-pop-in items-center gap-3 rounded-xl border px-4 py-3 text-left ${
                isMe ? "border-primary/70 bg-primary/10" : "border-border bg-card"
              }`}
            >
              {player.user_id === hostUserId && <Crown />}
              <span className="flex-1 truncate font-display text-sm text-foreground">
                {player.display_name}
              </span>
              {player.user_id === hostUserId && (
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Host</span>
              )}
              {isMe && (
                <span className="text-[10px] uppercase tracking-widest text-primary">You</span>
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
                  className={`press flex h-11 w-11 items-center justify-center rounded-lg text-sm ${
                    player.muted_by_host ? "text-warn" : "text-muted-foreground"
                  }`}
                >
                  {player.muted_by_host ? "🔇" : "🔊"}
                </button>
              )}
              {isHost && !isMe && (
                <button
                  type="button"
                  aria-label={`Remove ${player.display_name}`}
                  onClick={() => onRemove(player.player_slot)}
                  className="press flex h-11 w-11 items-center justify-center rounded-lg text-lg text-muted-foreground"
                >
                  ×
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="w-full space-y-3 text-left">
        <p className="font-display text-sm font-semibold text-foreground">Categories</p>
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
                className="press rounded-md border border-border bg-card px-3 py-2 font-display text-xs text-foreground aria-pressed:border-primary aria-pressed:text-primary"
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
            )?.description ?? "Custom: one game from each category you pick."}
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
                className="press rounded-md border border-border bg-card px-3 py-2 font-display text-xs capitalize text-muted-foreground aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary disabled:opacity-70"
              >
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
        <p className="text-xs text-muted-foreground">
          {roundCount} {roundCount === 1 ? "round" : "rounds"}, one game per category · about{" "}
          {roundCount * 2} min
        </p>
      </div>

      {tournamentHistory.length > 0 && (
        <div className="space-y-1 border-t border-border pt-3">
          <p className="font-display text-xs text-muted-foreground">Previous games</p>
          {tournamentHistory
            .slice(-3)
            .reverse()
            .map((entry, index) => (
              <p key={`${entry.date}-${index}`} className="text-xs text-muted-foreground">
                {entry.winner} won · {new Date(entry.date).toLocaleDateString()}
              </p>
            ))}
        </div>
      )}

      {isHost ? (
        <>
          <button
            type="button"
            onClick={onStart}
            disabled={!canStart || starting}
            className="press tap-target flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-display text-lg font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-40"
          >
            {starting ? (
              <>
                <span>Starting</span>
                <Dots className="bg-primary-foreground" />
              </>
            ) : canStart ? (
              "Start game"
            ) : (
              `Waiting for ${playersNeeded} more ${playersNeeded === 1 ? "player" : "players"}`
            )}
          </button>
          <button
            type="button"
            onClick={onDisband}
            className="press text-sm text-muted-foreground underline decoration-border underline-offset-4"
          >
            Disband room
          </button>
        </>
      ) : (
        <WaitingLine label={hostName ? `Waiting for ${hostName} (host) to start` : "Waiting for the host to start"} />
      )}
    </div>
  );
}
