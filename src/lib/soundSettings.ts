/** Device settings are separate from audio gains: sliders always mean 0–100%. */
export type SoundChannel = "effects" | "music";
export interface ChannelSettings {
  muted: boolean;
  volume: number;
  lastVolume: number;
  /**
   * The player set this channel themselves (a slider, a switch; since the components step, 14 Nov 2026). Unset, the
   * channel follows DEFAULT_VOLUME, so a change of default reaches everyone who never chose.
   */
  set?: boolean;
}
export interface SoundSettings {
  effects: ChannelSettings;
  music: ChannelSettings;
}
const KEY = "duelz_sound_settings_v2";
export const SOUND_SETTINGS_EVENT = "duelz-sound-change";
/** The volumes for a player who hasn't set their own (Joe, 14 Nov 2026): sound effects 100 %, music 80 %. */
export const DEFAULT_VOLUME: Record<SoundChannel, number> = { effects: 1, music: 0.8 };
const defaults = (): SoundSettings => ({
  effects: { muted: false, volume: DEFAULT_VOLUME.effects, lastVolume: DEFAULT_VOLUME.effects, set: false },
  music: { muted: false, volume: DEFAULT_VOLUME.music, lastVolume: DEFAULT_VOLUME.music, set: false },
});
/**
 * Whether a stored channel is the player's own choice. Records from before the marker carry none: one that is still
 * exactly the old untouched default (100 %, last 100 %, on; this store wrote it on every first read) is taken as never
 * set, so it moves to today's default; anything else (muted, another volume) is a choice and is kept.
 */
function chosen(value: ChannelSettings): boolean {
  if (typeof value.set === "boolean") return value.set;
  return !(value.muted === false && Number(value.volume) === 1 && Number(value.lastVolume) === 1);
}
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
        if (!chosen(value)) continue;
        const volume = clamp(Number(value.volume));
        next[channel] = {
          volume,
          muted: Boolean(value.muted) || volume === 0,
          lastVolume: clamp(Number(value.lastVolume)) || 1,
          set: true,
        };
      }
    } else {
      // Old sliders represented absolute bus gains; preserve their relative setting.
      for (const [channel, muteKey, volumeKey, oldDefault] of [
        ["effects", "duelz_muted", "duelz_effects_volume", 0.8],
        ["music", "duelz_music_muted", "duelz_music_volume", 0.35],
      ] as const) {
        const oldVolume = window.localStorage.getItem(volumeKey);
        const muted = window.localStorage.getItem(muteKey) === "1";
        // Nothing stored for this channel: the player never set it, so today's default.
        if (oldVolume === null && !muted) continue;
        const volume = oldVolume === null ? 1 : clamp(Number(oldVolume) / oldDefault);
        next[channel] = {
          muted: muted || volume === 0,
          volume,
          lastVolume: volume || 1,
          set: true,
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
    set: true,
  });
}
export function changeChannelMuted(channel: SoundChannel, muted: boolean): void {
  const previous = readSoundSettings()[channel];
  writeChannelSettings(channel, {
    muted,
    ...(!muted && previous.volume === 0 ? { volume: previous.lastVolume || 1 } : {}),
    set: true,
  });
}
export function roundMusicRamp(arcade: boolean, remainingMs: number): number {
  const windowMs = arcade ? 15_000 : 10_000;
  const progress = Math.max(0, Math.min(1, 1 - remainingMs / windowMs));
  return (arcade ? 0.5 : 0.2) + (arcade ? 0.4 : 0.3) * progress;
}
