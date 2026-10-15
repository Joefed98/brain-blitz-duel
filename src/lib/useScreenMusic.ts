import { useEffect } from "react";
import { screenMusic, startMusic, stopMusicIf, type Track } from "@/lib/sound";

/**
 * Plays a screen's music slot while `active` (docs/sound-cues/music.md). A slot
 * with no file does nothing, so the screen stays exactly as it is today.
 */
export function useScreenMusic(name: Track, active = true): void {
  const track = active ? screenMusic(name) : null;
  useEffect(() => {
    if (!track) return;
    startMusic(track);
    return () => stopMusicIf(track, 300);
  }, [track]);
}
