/**
 * The intro's Ready waits for the game's own sounds (speed fix 5, lib/sound.ts gameSoundsReady), so its first
 * sound is never silent. Rooms decode the next round's sounds during the round before, and an intro lasts far
 * longer than the decode, so this is normally true from the first frame. A file that never answers stops
 * holding Ready after SOUND_WAIT_MS.
 */
import { useEffect, useState } from "react";

import { gameSoundsReady, onSoundsLoaded } from "./sound";

export const SOUND_WAIT_MS = 4000;

export function useGameSoundsReady(type: string | null | undefined): boolean {
  const [ready, setReady] = useState(() => gameSoundsReady(type));
  useEffect(() => {
    if (gameSoundsReady(type)) {
      setReady(true);
      return;
    }
    setReady(false);
    const off = onSoundsLoaded(() => {
      if (gameSoundsReady(type)) setReady(true);
    });
    const timer = window.setTimeout(() => setReady(true), SOUND_WAIT_MS);
    return () => {
      off();
      window.clearTimeout(timer);
    };
  }, [type]);
  return ready;
}
