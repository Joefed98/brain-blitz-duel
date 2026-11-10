import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { roomCodeChars } from "@/lib/duel/roomCode";
import { Button, EmptyState, Input, type EmptyStateAction } from "@/design/components";

/**
 * One layout for the not-found screens (Polish batch R, 25 Oct 2026; wave 1's first impressions, 10 Nov
 * 2026: docs/mockups/wave-1/X2-NotFound.png): the 404 page, a room link whose room is not found and a
 * challenge link that doesn't work or has ended. Captain Joulz (EmptyState), a title, one plain line, where
 * it helps a room-code box to try again, then the gold action and, under it, Back home.
 *
 * Records `error_shown` with a short code (never the address or any text): `code`, else one worked out from
 * the path (room_not_found, challenge_not_found, not_found).
 */
export function ErrorState({
  title,
  body,
  codeBox = false,
  action,
  code,
}: {
  title: string;
  body: string;
  /** A room-code box to try another code (the room's link). */
  codeBox?: boolean;
  /** The gold action; without one, Back home is the gold action. */
  action?: { label: string; onClick: () => void };
  /** The analytics code, when the path doesn't say it (an ended challenge). */
  code?: string;
}) {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");
  // Analytics (lib/analytics/clientEvents.ts): which error screen was shown, as a short code.
  useEffect(() => {
    const path = typeof window === "undefined" ? "" : window.location.pathname;
    const errorCode =
      code ?? (path.startsWith("/duel/") ? "room_not_found" : path.startsWith("/challenge") ? "challenge_not_found" : "not_found");
    void import("@/lib/analytics/clientEvents").then(({ trackClientEvent }) =>
      trackClientEvent("error_shown", { props: { code: errorCode } }),
    );
  }, [code]);
  const tryCode = () => {
    const clean = roomCode.trim().toUpperCase();
    if (clean.length < 4) return;
    void navigate({ to: "/duel/$code", params: { code: clean } });
  };
  const home: EmptyStateAction = { label: "Back home", onClick: () => void navigate({ to: "/" }), data: { "data-error-home": "" } };
  return (
    <EmptyState
      data-error-screen
      heading={1}
      pose="ready"
      tone="cool"
      title={title}
      body={body}
      action={action ?? home}
      secondary={action ? home : undefined}
    >
      {codeBox ? (
        <form
          className="jz-empty-form"
          onSubmit={(event) => {
            event.preventDefault();
            tryCode();
          }}
        >
          <Input
            value={roomCode}
            onChange={(event) => setRoomCode(roomCodeChars(event.target.value).slice(0, 6))}
            placeholder="Room code"
            aria-label="Room code"
            autoCapitalize="characters"
            autoComplete="off"
            className="min-w-0 flex-1 uppercase tracking-widest"
          />
          <Button variant="secondary" size={50} type="submit" disabled={roomCode.trim().length < 4} className="w-21">
            Join
          </Button>
        </form>
      ) : null}
    </EmptyState>
  );
}
