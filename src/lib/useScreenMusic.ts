import { useEffect } from "react";
import { holdHomeBed, screenMusic, startMusic, stopMusicIf, type Track } from "@/lib/sound";

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

/**
 * Holds the app-wide home bed while `active` (sound.ts `holdHomeBed`): the Play, Practice, Tournaments and
 * Profile tabs and the room lobby. Moving between holders never stops or restarts it.
 */
export function useHomeBed(active = true, screen: Track | null = null): void {
  useEffect(() => {
    if (!active) return;
    return holdHomeBed(screen);
  }, [active, screen]);
}
