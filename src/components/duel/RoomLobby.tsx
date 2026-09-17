import { MAX_PLAYERS, MIN_PLAYERS, type DuelPlayerRow } from "@/lib/duel/types";

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
  noMaths: boolean;
  onNoMathsChange: (value: boolean) => void;
  players: DuelPlayerRow[];
  hostUserId: string | null;
  meUserId: string;
  isHost: boolean;
  starting: boolean;
  onStart: () => void;
  onRemove: (slot: number) => void;
}

/** The waiting room for two to ten players. */
export function RoomLobby({
  players,
  noMaths,
  onNoMathsChange,
  hostUserId,
  meUserId,
  isHost,
  starting,
  onStart,
  onRemove,
}: RoomLobbyProps) {
  const canStart = players.length >= MIN_PLAYERS;

  return (
    <div className="flex w-full flex-col gap-4">
      <p className="text-center font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
        {players.length} of {MAX_PLAYERS} players
      </p>

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
              {isMe && (
                <span className="text-[10px] uppercase tracking-widest text-primary">You</span>
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

      {isHost ? (
        <button
          type="button"
          role="switch"
          aria-checked={noMaths}
          onClick={() => onNoMathsChange(!noMaths)}
          className="press tap-target flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
        >
          <span className="font-display text-sm text-foreground">No maths</span>
          <span
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              noMaths ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-all ${
                noMaths ? "left-[22px]" : "left-0.5"
              }`}
            />
          </span>
        </button>
      ) : (
        noMaths && (
          <p className="text-center font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            no maths
          </p>
        )
      )}

      {isHost && noMaths && (
        <p className="text-center font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
          no maths
        </p>
      )}

      {isHost ? (
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
            "Need 2 players"
          )}
        </button>
      ) : (
        <WaitingLine label="Waiting for host to start" />
      )}
    </div>
  );
}
