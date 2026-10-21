import { Swords } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ShareResultButton } from "@/components/share/ShareResultButton";
import { Dots } from "@/components/duel/Dots";
import { APP_NAME } from "@/lib/brand";
import { challengeLink, challengeShareLines } from "@/lib/duel/challenge";
import { challengeFromRoom, challengeStatus } from "@/lib/duel/challengeApi";
import { noteMyChallenge } from "@/lib/duel/challengeRecord";
import type { StoredPuzzleType } from "@/lib/duel/types";
import { resultCardFile } from "@/lib/share/resultCard";
import type { RoomShareData, RoomShareTop } from "@/lib/share/roomShare";
import { buzz } from "@/lib/motion";
import { sendShareEvent, type ShareRecorder } from "@/lib/share/shareRef";

const origin = () => (typeof window === "undefined" ? "" : window.location.origin);

/** Whether friend challenges are available (the migration applied); null until the server answers. */
export function useChallengeStatus(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    void challengeStatus().then(
      (yes) => live && setAvailable(yes),
      () => live && setAvailable(false),
    );
    return () => {
      live = false;
    };
  }, []);
  return available;
}

/** Whether friend challenges are available; false while unknown. */
export function useChallengesAvailable(): boolean {
  return useChallengeStatus() === true;
}

/** The results card for a challenge (the room's card, "CHALLENGE <code>" at its foot), drawn when the screen opens. */
function useChallengeCard(
  card: Omit<RoomShareData, "link" | "duelId" | "gameIndex" | "title" | "lines"> | null,
  link: string,
): File | null {
  const [image, setImage] = useState<File | null>(null);
  const key = JSON.stringify(card);
  useEffect(() => {
    if (!card) return;
    let live = true;
    void (async () => {
      try {
        const { gameIconImages } = await import("@/components/share/gameIconImages");
        const icons = await gameIconImages(card.games);
        const file = await resultCardFile(
          { ...card, title: "", lines: [], link, duelId: "", gameIndex: 0 },
          icons,
        );
        if (live) setImage(file);
      } catch {
        /* text and link only */
      }
    })();
    return () => {
      live = false;
    };
    // Redrawn only when what the card shows changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return image;
}

/**
 * A challenge's Share (shareResult): the challenge's own link with the result or invite line, and on
 * the final screen the results card. `label` names the button ("Share", "Challenge someone else").
 */
export function ChallengeShareButton({
  code,
  kind,
  total,
  rounds,
  place = null,
  players = 1,
  top = [],
  games = [],
  label = "Share",
  className,
  record = sendShareEvent,
}: {
  code: string;
  kind: "invite" | "result";
  total: number;
  rounds: number;
  place?: number | null;
  players?: number;
  top?: RoomShareTop[];
  games?: StoredPuzzleType[];
  label?: string;
  className?: string;
  record?: ShareRecorder;
}) {
  const link = challengeLink(origin(), code);
  const card = useMemo(
    () =>
      kind === "result"
        ? { place, total, players, rounds, top, games, roomCode: code, codeLabel: "CHALLENGE" }
        : null,
    [kind, place, total, players, rounds, top, games, code],
  );
  const image = useChallengeCard(card, link);
  return (
    <ShareResultButton
      className={className}
      label={label}
      input={{
        title: `${APP_NAME} challenge`,
        lines: challengeShareLines({ kind, total, rounds, place, players }),
        link,
        image,
      }}
      onTap={(method) => {
        noteMyChallenge(code);
        // Beta: every Share tap with its source (share_events; a result share carries its place).
        record({
          event: "share_tap",
          source: "challenge",
          challengeCode: code,
          place: kind === "result" ? place : null,
          players: kind === "result" ? players : null,
          rounds,
          method,
        });
      }}
    />
  );
}

/**
 * A finished room's "Challenge a friend" (the podium and the two-player final screen): the first tap
 * makes (or finds) the challenge for this game, with every player of the room on it, then the button
 * becomes the challenge's Share, so the share sheet opens straight from the second tap (iOS needs a
 * tap for it). Hidden until challenges are available.
 */
export function RoomChallengeButton({
  duelId,
  total,
  rounds,
}: {
  duelId: string;
  total: number;
  rounds: number;
}) {
  const available = useChallengesAvailable();
  const [state, setState] = useState<
    { kind: "idle" | "busy" } | { kind: "ready"; code: string } | { kind: "error"; message: string }
  >({ kind: "idle" });
  if (!available) return null;
  if (state.kind === "ready")
    return (
      <div data-room-challenge="ready" className="flex">
        <ChallengeShareButton
          code={state.code}
          kind="invite"
          total={total}
          rounds={rounds}
          label="Send the challenge"
        />
      </div>
    );
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        data-room-challenge={state.kind}
        disabled={state.kind === "busy"}
        onClick={() => {
          setState({ kind: "busy" });
          void challengeFromRoom(duelId).then(
            (made) => {
              if (!made.ok) {
                buzz([10, 50, 10]);
                return setState({ kind: "error", message: made.message });
              }
              noteMyChallenge(made.code);
              setState({ kind: "ready", code: made.code });
            },
            () => setState({ kind: "error", message: "Couldn't reach the server. Try again." }),
          );
        }}
        className="th-btn-outline-gold press tap-target flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-primary/70 bg-primary/10 font-display text-base font-bold uppercase tracking-wide text-primary"
      >
        {state.kind === "busy" ? (
          <Dots className="bg-primary" />
        ) : (
          <>
            <Swords aria-hidden="true" className="h-[18px] w-[18px] shrink-0" /> Challenge a friend
          </>
        )}
      </button>
      {state.kind === "error" ? (
        <p role="alert" className="text-center text-xs text-warn">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
