import { useEffect, useMemo, useRef, useState } from "react";

import { APP_URL } from "@/config/appUrl";
import { roomShareData, type RoomShareData } from "@/lib/share/roomShare";
import { resultCardFile } from "@/lib/share/resultCard";
import {
  shareMethod,
  shareResult,
  type ShareOutcome,
  type ShareResultInput,
} from "@/lib/share/shareResult";
import { noteShareFinish, sendShareEvent, type ShareRecorder } from "@/lib/share/shareRef";
import type { DuelPlayerRow, DuelRow, RoundResultRow } from "@/lib/duel/types";
import { Button } from "@/design/components";

/** How long "Copied" shows after the clipboard fallback. */
export const COPIED_MS = 2000;

function ShareGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">
      <path
        d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * A Share button for any result (shareResult): the share sheet, or "Copied" after the clipboard
 * fallback. The skin's teal button, uppercase, one line, 48 px tall. `onTap` is told which route the
 * share takes before it opens (the beta count).
 */
export function ShareResultButton({
  input,
  onTap,
  className = "",
  label = "Share",
  linkPrefix,
}: {
  input: ShareResultInput;
  onTap?: (method: "native" | "copy") => void;
  className?: string | undefined;
  /** The button's word ("Share"; a friend challenge's "Challenge someone else"). */
  label?: string;
  /** What goes before the link in the text (shareText's "Play: " when absent). */
  linkPrefix?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onClick = () => {
    onTap?.(shareMethod());
    // No await before shareResult: iOS opens the sheet only straight from the tap.
    void shareResult(linkPrefix === undefined ? input : { ...input, linkPrefix }).then((outcome: ShareOutcome) => {
      if (outcome !== "copied") return;
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_MS);
    });
  };
  return (
    <Button
      variant="secondary"
      data-share-button
      data-share-image={input.image ? "ready" : "none"}
      onClick={onClick}
      className={`min-w-0 flex-1 ${className}`}
    >
      <ShareGlyph />
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </Button>
  );
}

/**
 * The final screen's Share (Podium and FinalResult): the room's text, link and results card
 * (roomShare.ts), the card drawn as soon as the screen opens so a tap can attach it. It also
 * records the beta counts: the tap (room, place) and, for a device that came from a shared link,
 * its first finished room (shareRef.ts).
 */
export function RoomShareButton({
  duel,
  players,
  results,
  me,
  record = sendShareEvent,
  className,
}: {
  duel: DuelRow;
  players: readonly DuelPlayerRow[];
  results: RoundResultRow[];
  me: DuelPlayerRow;
  record?: ShareRecorder;
  className?: string | undefined;
}) {
  const data: RoomShareData = useMemo(
    () =>
      roomShareData({
        duel,
        players,
        results,
        me,
        origin: APP_URL,
      }),
    [duel, players, results, me],
  );
  const [image, setImage] = useState<File | null>(null);
  const cardKey = JSON.stringify([
    data.place,
    data.total,
    data.top,
    data.games,
    data.roomCode,
    data.rounds,
    data.players,
  ]);

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const { gameIconImages } = await import("./gameIconImages");
        const icons = await gameIconImages(data.games);
        const file = await resultCardFile(data, icons);
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
  }, [cardKey]);

  const finishKey = `${data.duelId}:${data.gameIndex}`;
  useEffect(() => {
    noteShareFinish(data, record);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishKey]);

  return (
    <ShareResultButton
      className={className}
      input={{ title: data.title, lines: data.lines, link: data.link, image }}
      onTap={(method) =>
        record({
          event: "share_tap",
          source: "room",
          duelId: data.duelId,
          gameIndex: data.gameIndex,
          roomCode: data.roomCode,
          place: data.place,
          players: data.players,
          rounds: data.rounds,
          method,
        })
      }
    />
  );
}
