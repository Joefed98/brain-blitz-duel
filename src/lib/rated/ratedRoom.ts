/**
 * Which room is a rated match (wave 3, session W3c). W3b plays a rated match as an ordinary room on the existing room
 * route. The rated screens note the room's code and match id here (sessionStorage, this tab) as they open it; any
 * other tab, device or reload asks W3b's ratedRoomFn with the room's id (answered for the match's own players only,
 * null for an ordinary room), so the room route draws the rated header score and hands the finished room to the rated
 * result wherever it is opened. The room itself, its grading and its phases are W3b's and the room's own, unchanged.
 *
 * The live arcade score for the header is its own import-free module (liveScore.ts), so game code that publishes it
 * reaches nothing rated, economic or pass-related (economy-neutral-check).
 */
import { useEffect, useState } from "react";

const KEY = "duelz-rated-room:v1:";

function store(): Storage | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** Notes that the room `code` plays rated match `matchId` (before opening it). */
export function noteRatedRoom(code: string, matchId: string): void {
  try {
    store()?.setItem(KEY + code.toUpperCase(), matchId);
  } catch {
    /* storage blocked */
  }
}

/** The rated match the room `code` plays, if this tab opened it as one. */
export function ratedMatchForRoom(code: string | null | undefined): string | null {
  if (!code) return null;
  try {
    return store()?.getItem(KEY + code.toUpperCase()) ?? null;
  } catch {
    return null;
  }
}

/**
 * The room's rated match id (null for every ordinary room: nothing changes there). This tab's note first; else, once
 * the room's id is known, W3b's answer (asked once per room id, remembered in this tab).
 */
export function useRatedRoom(code: string | null | undefined, roomId?: string | null): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const noted = ratedMatchForRoom(code);
    setId(noted);
    if (noted || !code || !roomId) return;
    let live = true;
    void (async () => {
      const { ratedBackend } = await import("./backend");
      const backend = await ratedBackend();
      const found = backend ? await backend.roomMatch(roomId).catch(() => null) : null;
      if (!live || !found) return;
      noteRatedRoom(code, found.matchId);
      setId(found.matchId);
    })();
    return () => {
      live = false;
    };
  }, [code, roomId]);
  return id;
}
