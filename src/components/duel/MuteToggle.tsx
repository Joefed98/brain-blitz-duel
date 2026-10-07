import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Music2, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { effectsVolume, isMuted, isMusicMuted, setMusicMuted, musicVolume,
  onSoundSettingsChange, setEffectsVolume, setMusicVolume, setMuted } from "@/lib/sound";
import type { SoundChannel } from "@/lib/soundSettings";

/** Two stable 52px channel groups replace the old three 36px mute buttons. */
export function MuteToggle() {
  const [open, setOpen] = useState<SoundChannel | null>(null);
  const [settings, setSettings] = useState({ effects: 1, music: 1, muted: false, musicMuted: false });
  useEffect(() => {
    const read = () => setSettings({ effects: effectsVolume(), music: musicVolume(), muted: isMuted(), musicMuted: isMusicMuted() });
    read();
    return onSoundSettingsChange(read);
  }, []);
  return (
    <div data-sound-controls className="flex h-9 w-[104px] shrink-0 items-center">
      {open && createPortal(
        <div data-sound-dismiss className="fixed inset-0 z-40"
          onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
          onPointerUp={(event) => { event.preventDefault(); event.stopPropagation(); }}
          onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen(null); }}
          onContextMenu={(event) => event.preventDefault()} />,
        document.body,
      )}
      {(["effects", "music"] as const).map((channel) => {
        const effects = channel === "effects";
        const muted = effects ? settings.muted : settings.musicMuted;
        const volume = muted ? 0 : settings[channel];
        const label = effects ? "Effects" : "Music";
        const Icon = effects ? (muted ? VolumeX : Volume2) : Music2;
        return (
          <Popover key={channel} open={open === channel} onOpenChange={(value) => setOpen(value ? channel : null)}>
            <div className="flex h-9 w-[52px] shrink-0 items-center">
              <Button variant="ghost" size="icon" type="button"
                className={`press relative h-9 w-9 shrink-0 ${muted ? "text-muted-foreground" : "text-foreground"}`}
                title={`${muted ? "Turn on" : "Turn off"} ${label.toLowerCase()}`}
                aria-label={`${muted ? "Turn on" : "Turn off"} ${label.toLowerCase()}`}
                aria-pressed={!muted}
                onClick={() => effects ? setMuted(!muted) : setMusicMuted(!muted)}>
                <Icon aria-hidden="true" />
                {!effects && muted && <svg aria-hidden="true" viewBox="0 0 24 24" className="absolute h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3 21 21" /></svg>}
              </Button>
              <PopoverTrigger asChild>
                <Button variant="ghost" type="button" className="press h-9 w-4 shrink-0 px-0"
                  aria-label={`${label} volume`} title={`${label} volume`}>
                  <ChevronDown aria-hidden="true" className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
            </div>
            <PopoverContent align="end" side="bottom" className="w-56 p-3"
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}>
              <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-sm">
                <span className="min-w-0 font-display">{label}</span>
                <output className="font-mono tabular-nums">{Math.round(volume * 100)}%</output>
              </div>
              <Slider aria-label={`${label} volume percentage`} min={0} max={100} step={1}
                value={[Math.round(volume * 100)]} className="h-9"
                onValueChange={([value]) => { if (value === undefined) return; effects ? setEffectsVolume(value / 100) : setMusicVolume(value / 100); }} />
            </PopoverContent>
          </Popover>
        );
      })}
    </div>
  );
}
