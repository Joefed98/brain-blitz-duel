import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { fetchRoomPreview, joinRoomByCode, type RoomPreview } from "@/lib/duel/api";
import { getStoredName, setStoredName } from "@/lib/duel/session";
import { buzz } from "@/lib/motion";
import { unlockAudio } from "@/lib/sound";

import { Dots, WaitingLine } from "./Dots";

/**
 * Someone opened a room link but isn't in the room. While the room is in its
 * lobby they only give a display name (remembered on this device) and join
 * through the same joinRoomByCode server function as the home screen. Once
 * the game has started, the page says so and offers Home.
 */
export function JoinFromLink({
  roomCode,
  onJoined,
}: {
  roomCode: string;
  onJoined: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [preview, setPreview] = useState<RoomPreview | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setName(getStoredName()), []);
  useEffect(() => {
    let cancelled = false;
    void fetchRoomPreview(roomCode)
      .then((found) => !cancelled && setPreview(found))
      .catch(() => !cancelled && setPreview({ found: false }));
    return () => {
      cancelled = true;
    };
  }, [roomCode]);

  const join = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a display name.");
      buzz([10, 50, 10]);
      return;
    }
    unlockAudio();
    setBusy(true);
    setError(null);
    try {
      setStoredName(trimmed);
      await joinRoomByCode(roomCode, trimmed, "link");
      await onJoined();
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      buzz([10, 50, 10]);
    }
  };

  const home = (
    <button
      type="button"
      onClick={() => void navigate({ to: "/" })}
      className="th-btn-gold press tap-target w-full max-w-xs rounded-xl bg-primary px-6 font-display text-base font-bold uppercase tracking-wide text-primary-foreground"
    >
      Home
    </button>
  );

  if (!preview) return <WaitingLine label="Loading room" />;

  if (!preview.found) {
    return (
      <>
        <h1 className="font-display text-2xl">Room not found</h1>
        <p className="text-sm text-muted-foreground">No room exists with the code {roomCode}.</p>
        {home}
      </>
    );
  }

  if (preview.state !== "lobby") {
    const [title, line] =
      preview.state === "playing"
        ? [
            "This game has already started",
            "You can join the next one if the host plays again from the lobby.",
          ]
        : preview.state === "finished"
          ? ["This game has finished", "Ask the host to play again, then open the link again."]
          : ["This room is closed", "The host closed it."];
    return (
      <>
        <p className="font-mono text-4xl font-bold tracking-[0.2em] text-primary">{roomCode}</p>
        <h1 className="font-display text-2xl">{title}</h1>
        <p className="text-sm text-muted-foreground">{line}</p>
        {home}
      </>
    );
  }

  const full = preview.playerCount >= preview.maxPlayers;
  return (
    <form
      className="flex w-full max-w-xs flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void join();
      }}
    >
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          You're invited to room
        </p>
        <p className="th-score th-score-top mt-2 font-mono text-5xl font-bold tracking-[0.2em] text-primary">
          {roomCode}
        </p>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
          {preview.playerCount} of {preview.maxPlayers} players
        </p>
      </div>
      <div className="flex flex-col gap-2 text-left">
        <label
          htmlFor="link-name"
          className="text-xs uppercase tracking-widest text-muted-foreground"
        >
          Display name
        </label>
        <input
          id="link-name"
          value={name}
          autoFocus
          maxLength={14}
          placeholder="Your name"
          onChange={(event) => setName(event.target.value)}
          className="th-input tap-target w-full rounded-xl border border-border bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      </div>
      {error && <p className="text-sm text-warn">{error}</p>}
      <button
        type="submit"
        disabled={busy || full}
        className="th-btn-gold press tap-target flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-display text-lg font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-40"
      >
        {busy ? (
          <>
            <span>Joining</span>
            <Dots className="bg-primary-foreground" />
          </>
        ) : full ? (
          "Room is full"
        ) : (
          "Join room"
        )}
      </button>
      <button
        type="button"
        onClick={() => void navigate({ to: "/" })}
        className="press tap-target w-full font-display text-sm uppercase tracking-widest text-muted-foreground"
      >
        Home
      </button>
    </form>
  );
}
