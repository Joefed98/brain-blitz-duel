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
import { Button, Input, SkeletonPage } from "@/design/components";
import { GUEST_NAME_MAX } from "@/lib/names/username";
import { NameSuggestions, reasonFrom, suggestionsFrom } from "@/components/account/AccountParts";
import { useAccountName } from "@/lib/account/accountApi";

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

  // A refused name's three suggestions (names.server.ts); a signed-in player joins under their username.
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const accountName = useAccountName();
  const join = async () => {
    setSuggestions([]);
    const trimmed = (accountName ?? name).trim();
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
      setSuggestions(suggestionsFrom(err));
      setError(err instanceof Error ? reasonFrom(err.message) : "That didn’t work. Try again.");
    }
  };

  const home = (
    <Button
      variant="secondary"
      size={50}
      block
      onClick={() => void navigate({ to: "/" })}
      className="max-w-xs"
    >
      Home
    </Button>
  );

  if (!preview || redirect) return <SkeletonPage label="Loading room" rows={2} card />;

  if (!preview.found) {
    return (
      // The shared not-found layout (wave 1, X2): try another code, or Back home.
      <ErrorState
        title="Room not found"
        body={`No room has the code ${roomCode}. Check it with your friend, or try another.`}
        codeBox
      />
    );
  }

  if (preview.state !== "lobby") {
    const [title, line] =
      preview.state === "playing"
        ? [
            "This game’s already started.",
            "You can join the next one if the host plays again from the lobby.",
          ]
        : preview.state === "finished"
          ? ["This game has finished", "Ask the host to play again, then reopen the link."]
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
        <Input
          id="link-name"
          value={accountName ?? name}
          readOnly={accountName !== null}
          autoFocus={accountName === null}
          maxLength={GUEST_NAME_MAX}
          placeholder="Your name"
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      {error && <p className="text-sm text-warn">{error}</p>}
      <NameSuggestions
        names={suggestions}
        onPick={(picked) => {
          setName(picked);
          setError(null);
          setSuggestions([]);
        }}
      />
      <Button
        variant="gold"
        size={52}
        block
        type="submit"
        disabled={busy || full}
      >
        {busy ? (
          <>
            <span>Joining</span>
            <Dots className="bg-primary-foreground" />
          </>
        ) : full ? (
          "Room’s full"
        ) : (
          "Join room"
        )}
      </Button>
      <Button
        variant="secondary"
        size={50}
        block
        onClick={() => void navigate({ to: "/" })}
      >
        Home
      </Button>
    </form>
  );
}
