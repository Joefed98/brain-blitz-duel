import { useEffect, useRef, useState } from "react";

import {
  DEFAULT_EFFECTS_VOLUME,
  DEFAULT_MUSIC_VOLUME,
  effectsVolume,
  isMuted,
  musicVolume,
  onSoundSettingsChange,
  setEffectsVolume,
  setMusicVolume,
  setMuted,
  unlockAudio,
} from "@/lib/sound";

const LONG_PRESS_MS = 500;

export function MuteToggle() {
  const [muted, setLocal] = useState(false);
  const [open, setOpen] = useState(false);
  const [music, setMusic] = useState(DEFAULT_MUSIC_VOLUME);
  const [effects, setEffects] = useState(DEFAULT_EFFECTS_VOLUME);
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);

  useEffect(() => {
    const read = () => {
      setLocal(isMuted());
      setMusic(musicVolume());
      setEffects(effectsVolume());
    };
    read();
    return onSoundSettingsChange(read);
  }, []);

  const startPress = () => {
    longPressed.current = false;
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      unlockAudio();
      setOpen(true);
    }, LONG_PRESS_MS);
  };

  const endPress = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <>
      <button
        type="button"
        aria-label={muted ? "Turn sound on" : "Turn sound off"}
        aria-pressed={muted}
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerLeave={endPress}
        onPointerCancel={endPress}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (longPressed.current) return;
          setMuted(!muted);
        }}
        className="press flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 9v6h3l5 4V5L7 9H4Z" />
          {muted ? (
            <path d="m16 9 5 6m0-6-5 6" />
          ) : (
            <>
              <path d="M16.5 8.5a5 5 0 0 1 0 7" />
              <path d="M19 6a8.5 8.5 0 0 1 0 12" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-background/70"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full rounded-t-2xl border-t border-border bg-card p-5 animate-phase-in"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
              Sound
            </p>

            <label className="mt-4 block text-xs uppercase tracking-widest text-muted-foreground">
              Music
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={music}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setMusic(value);
                  setMusicVolume(value);
                }}
                className="mt-2 h-6 w-full accent-[var(--primary)]"
              />
            </label>

            <label className="mt-4 block text-xs uppercase tracking-widest text-muted-foreground">
              Effects
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={effects}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setEffects(value);
                  setEffectsVolume(value);
                }}
                className="mt-2 h-6 w-full accent-[var(--primary)]"
              />
            </label>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="press tap-target mt-5 w-full rounded-xl border border-border font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}
