/**
 * A rated match's room, finished (wave 3, session W3c): W3b's room has played its games and its winner reveal (the
 * deciding game's result goes straight to it: W3b stops a best of 3 at 2–0), so the room hands over to the rated
 * result on /rated?match=<id>, which waits for W3b's settlement and W3a's answer. Nothing of the room's own podium is
 * drawn for a rated match (Play again is refused in one anyway).
 */
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { PhoneShell } from "@/components/duel/PhoneShell";
import { SkeletonPage } from "@/design/components";

export function RatedRoomHandOff({ matchId }: { matchId: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate({ to: "/rated" as never, search: { match: matchId } as never, replace: true });
  }, [matchId, navigate]);
  return (
    <PhoneShell skin="room" bare>
      <div data-rated-hand-off={matchId}>
        <SkeletonPage label="Your result" />
      </div>
    </PhoneShell>
  );
}
