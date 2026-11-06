import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { fetchRoomPreview, joinRoomByCode, type RoomPreview } from "@/lib/duel/api";
import { getStoredName, setStoredName } from "@/lib/duel/session";
import {
  isShareRef,
  noteShareLobbyArrival,
  shareHomeSearch,
  shareLinkJoinable,
} from "@/lib/share/shareRef";
import { unlockAudio } from "@/lib/sound";

import { ErrorState } from "@/components/app/ErrorState";

import { Dots, WaitingLine } from "./Dots";

/**
 * Someone opened a room link but isn't in the room. While the room is in its
 * lobby they only give a display name (remembered on this device) and join
 * through the same joinRoomByCode server function as the home screen. Once
 * the game has started, the page says so and offers Home.
 *
 * A shared result's link (?ref=share, lib/share) is decided here, when it's opened: while the
 * newcomer can join they get the lobby's join (counted as a lobby arrival); otherwise they're sent
 * to the home, where the Play tab's welcome card greets them, never to "This game has finished".
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

  // A shared link: the lobby's join while there's a seat, else the home and its welcome card.
  const shared = typeof window !== "undefined" && isShareRef(window.location.search);
  const redirect = !!preview && shared && !shareLinkJoinable(preview);
  const decided = useRef(false);
  useEffect(() => {
    if (!preview || !shared || decided.current) return;
    decided.current = true;
    if (redirect)
      void navigate({ to: "/", search: shareHomeSearch(roomCode) as never, replace: true });
    else noteShareLobbyArrival(roomCode);
  }, [preview, shared, redirect, navigate, roomCode]);

  const join = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a display name.");
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
    }
  };

  const home = (
    <button
      type="button"
      onClick={() => void navigate({ to: "/" })}
      className="rs-btn press tap-target h-[50px] w-full max-w-xs"
    >
      Home
    </button>
  );

  if (!preview || redirect) return <WaitingLine label="Loading room" />;

  if (!preview.found) {
    return (
      // The shared error layout (Polish batch R): try another code, Back to Play, or Create a room.
      <ErrorState
        title="Room not found"
        body={`No room exists with the code ${roomCode}. Check the code, or start your own room.`}
        codeBox
        action={{ label: "Create a room", onClick: () => void navigate({ to: "/" }) }}
      />
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
        <p className="rs-code">{roomCode}</p>
        <h1 className="text-[24px] font-extrabold">{title}</h1>
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
        <p className="rs-meta">You’re invited to room</p>
        <p className="rs-code mt-2">{roomCode}</p>
        <p className="rs-meta mt-2">
          {preview.playerCount} of {preview.maxPlayers} players
        </p>
      </div>
      <div className="flex flex-col gap-2 text-left">
        <label
          htmlFor="link-name"
          className="pl-1 text-[13px] font-semibold text-muted-foreground"
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
        className="th-btn-gold ap-btn-gold press tap-target flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] text-[17px] disabled:opacity-40"
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
        className="rs-btn press tap-target h-[50px] w-full"
      >
        Home
      </button>
    </form>
  );
}
