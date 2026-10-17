import { memo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Music2, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import {
  effectsVolume,
  isMuted,
  isMusicMuted,
  setMusicMuted,
  musicVolume,
  onSoundSettingsChange,
  setEffectsVolume,
  setMusicVolume,
  setMuted,
} from "@/lib/sound";
import type { SoundChannel } from "@/lib/soundSettings";

/** Two stable 52px channel targets (each opens its mute switch and volume slider). */
/**
 * Memoised (low-end performance, 16 Oct 2026): it takes no props, so the game screens' 10 Hz clock
 * re-renders no longer reach its two popovers; its own state still updates it.
 */
export const MuteToggle = memo(function MuteToggle() {
  const [open, setOpen] = useState<SoundChannel | null>(null);
  const [settings, setSettings] = useState({
    effects: 1,
    music: 1,
    muted: false,
    musicMuted: false,
  });
  useEffect(() => {
    const read = () =>
      setSettings({
        effects: effectsVolume(),
        music: musicVolume(),
        muted: isMuted(),
        musicMuted: isMusicMuted(),
      });
    read();
    return onSoundSettingsChange(read);
  }, []);
  return (
    <div data-sound-controls className="flex h-9 w-[104px] shrink-0 items-center">
      {open &&
        createPortal(
          <div
            data-sound-dismiss
            className="fixed inset-0 z-40"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onPointerUp={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setOpen(null);
            }}
            onContextMenu={(event) => event.preventDefault()}
          />,
          document.body,
        )}
      {(["effects", "music"] as const).map((channel) => {
        const effects = channel === "effects";
        const muted = effects ? settings.muted : settings.musicMuted;
        const volume = muted ? 0 : settings[channel];
        const label = effects ? "Effects" : "Music";
        const Icon = effects ? Volume2 : Music2;
        return (
          <Popover
            key={channel}
            open={open === channel}
            onOpenChange={(value) => setOpen(value ? channel : null)}
          >
            {/*
              One 52px target per channel (Batch 4 fix-up, 17 Oct 2026): the 36px mute button
              and the 16px chevron beside it were too small to tap, and 104px holds two 44px
              targets, not four. The same icon, strike and chevron are drawn where they were;
              the tap opens the channel's popover, which holds the mute switch and the slider.
              An invisible ::before takes the hit area from 36 to 44px tall.
            */}
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                type="button"
                data-sound-channel={channel}
                className="press relative h-9 w-[52px] shrink-0 gap-0 p-0 before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']"
                aria-label={`${label}: ${muted ? "off" : `${Math.round(volume * 100)}%`}`}
                title={`${label} sound`}
              >
                <span
                  className={`relative flex h-9 w-9 shrink-0 items-center justify-center ${muted ? "text-muted-foreground" : "text-foreground"}`}
                >
                  <Icon aria-hidden="true" />
                  {muted && (
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="absolute h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M3 3 21 21" />
                    </svg>
                  )}
                </span>
                <span className="flex h-9 w-4 shrink-0 items-center justify-center">
                  <ChevronDown aria-hidden="true" className="h-3 w-3" />
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="bottom"
              className="w-56 p-3"
              onPointerDownOutside={(event) => event.preventDefault()}
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-sm">
                <span className="min-w-0 font-display">{label}</span>
                <output className="font-mono tabular-nums">{Math.round(volume * 100)}%</output>
              </div>
              <Button
                variant="outline"
                type="button"
                className={`press mb-2 h-11 w-full justify-start gap-2 ${muted ? "text-muted-foreground" : "text-foreground"}`}
                aria-label={`${muted ? "Turn on" : "Turn off"} ${label.toLowerCase()}`}
                aria-pressed={!muted}
                onClick={() => (effects ? setMuted(!muted) : setMusicMuted(!muted))}
              >
                <Icon aria-hidden="true" />
                {muted ? `Turn on ${label.toLowerCase()}` : `Turn off ${label.toLowerCase()}`}
              </Button>
              <Slider
                aria-label={`${label} volume percentage`}
                min={0}
                max={100}
                step={1}
                value={[Math.round(volume * 100)]}
                className="h-9"
                onValueChange={([value]) => {
                  if (value === undefined) return;
                  if (effects) setEffectsVolume(value / 100);
                  else setMusicVolume(value / 100);
                }}
              />
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
});
