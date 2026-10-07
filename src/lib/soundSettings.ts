/** Device settings are separate from audio gains: sliders always mean 0–100%. */
export type SoundChannel = "effects" | "music";
export interface ChannelSettings {
  muted: boolean;
  volume: number;
  lastVolume: number;
}
export interface SoundSettings {
  effects: ChannelSettings;
  music: ChannelSettings;
}
const KEY = "duelz_sound_settings_v2";
export const SOUND_SETTINGS_EVENT = "duelz-sound-change";
const defaults = (): SoundSettings => ({
  effects: { muted: false, volume: 1, lastVolume: 1 },
  music: { muted: false, volume: 1, lastVolume: 1 },
});
const clamp = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1);
let cached: SoundSettings | undefined;
export function readSoundSettings(): SoundSettings {
  if (typeof window === "undefined") return defaults();
  if (cached) return cached;
  const next = defaults();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SoundSettings;
      for (const channel of ["effects", "music"] as const) {
        const value = parsed[channel];
        if (!value) continue;
        const volume = clamp(Number(value.volume));
        next[channel] = {
          volume,
          muted: Boolean(value.muted) || volume === 0,
          lastVolume: clamp(Number(value.lastVolume)) || 1,
        };
      }
    } else {
      // Old sliders represented absolute bus gains; preserve their relative setting.
      for (const [channel, muteKey, volumeKey, oldDefault] of [
        ["effects", "duelz_muted", "duelz_effects_volume", 0.8],
        ["music", "duelz_music_muted", "duelz_music_volume", 0.35],
      ] as const) {
        const oldVolume = window.localStorage.getItem(volumeKey);
        const volume = oldVolume === null ? 1 : clamp(Number(oldVolume) / oldDefault);
        next[channel] = {
          muted: window.localStorage.getItem(muteKey) === "1" || volume === 0,
          volume,
          lastVolume: volume || 1,
        };
      }
    }
    window.localStorage.setItem(KEY, JSON.stringify(next));
    for (const old of [
      "duelz_muted",
      "duelz_music_muted",
      "duelz_music_volume",
      "duelz_effects_volume",
      "duelz_puzzle_round_music",
    ])
      window.localStorage.removeItem(old);
  } catch {
    /* Private-mode storage still works for this session. */
  }
  cached = next;
  return next;
}
export function writeChannelSettings(channel: SoundChannel, patch: Partial<ChannelSettings>): void {
  const settings = readSoundSettings();
  cached = { ...settings, [channel]: { ...settings[channel], ...patch } };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cached));
  } catch {
    /* session only */
  }
}
export function changeChannelVolume(channel: SoundChannel, value: number): void {
  const volume = clamp(value);
  writeChannelSettings(channel, {
    volume,
    muted: volume === 0,
    ...(volume > 0 ? { lastVolume: volume } : {}),
  });
}
export function changeChannelMuted(channel: SoundChannel, muted: boolean): void {
  const previous = readSoundSettings()[channel];
  writeChannelSettings(channel, {
    muted,
    ...(!muted && previous.volume === 0 ? { volume: previous.lastVolume || 1 } : {}),
  });
}
export function roundMusicRamp(arcade: boolean, remainingMs: number): number {
  const windowMs = arcade ? 15_000 : 10_000;
  const progress = Math.max(0, Math.min(1, 1 - remainingMs / windowMs));
  return (arcade ? 0.5 : 0.2) + (arcade ? 0.4 : 0.3) * progress;
}
