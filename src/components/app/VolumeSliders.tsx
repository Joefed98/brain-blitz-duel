import { useEffect, useState } from "react";

import { Slider } from "@/components/ui/slider";
import { effectsVolume, musicVolume, onSoundSettingsChange, setEffectsVolume, setMusicVolume } from "@/lib/sound";
import { DEFAULT_VOLUME, type SoundChannel } from "@/lib/soundSettings";

const CHANNELS: { channel: SoundChannel; label: string }[] = [
  { channel: "effects", label: "Sound effects" },
  { channel: "music", label: "Music" },
];

/**
 * The two volume rows (8 Nov 2026, Joe's phone test; in place of the one Volume slider that set both channels):
 * "Sound effects" and "Music", each 0–100 % on the shared Slider (44 px, 26 px thumb), saved on the device per
 * channel (lib/soundSettings.ts, the same values the single slider wrote, so a device's setting carries over to
 * both). The settings sheet and the game menu draw them under their on/off switches, which stay as they were.
 */
export function VolumeSliders() {
  const volumes = useChannelVolumes();
  return (
    <>
      {CHANNELS.map(({ channel, label }) => {
        const percent = Math.round(volumes[channel] * 100);
        return (
          <div key={channel} className="jz-row" data-volume-slider={channel}>
            <span className="jz-row-title w-28 shrink-0">{label}</span>
            <Slider
              aria-label={`${label} volume`}
              min={0}
              max={100}
              step={5}
              value={[percent]}
              onValueChange={([value]) => {
                if (value === undefined) return;
                if (channel === "effects") setEffectsVolume(value / 100);
                else setMusicVolume(value / 100);
              }}
              className="min-w-0 flex-1"
            />
            <span className="ap-meta w-10 text-right tabular-nums">{percent}%</span>
          </div>
        );
      })}
    </>
  );
}

/** Both channels' volumes, kept current from the sound settings. */
function useChannelVolumes(): Record<SoundChannel, number> {
  const [volumes, setVolumes] = useState<Record<SoundChannel, number>>({ ...DEFAULT_VOLUME });
  useEffect(() => {
    const read = () => setVolumes({ effects: effectsVolume(), music: musicVolume() });
    read();
    return onSoundSettingsChange(read);
  }, []);
  return volumes;
}
