import assert from "node:assert/strict";

const cases = [
  { old: {}, music: 1, effects: 1, muted: false },
  {
    old: {
      duelz_puzzle_round_music: "0",
      duelz_muted: "1",
      duelz_music_volume: "0.35",
      duelz_effects_volume: "0.8",
    },
    music: 1,
    effects: 1,
    muted: true,
  },
  {
    old: { duelz_music_volume: "0.175", duelz_effects_volume: "0.4" },
    music: 0.5,
    effects: 0.5,
    muted: false,
  },
];
for (const [index, test] of cases.entries()) {
  const storage = new Map<string, string>(Object.entries(test.old));
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    },
  });
  const settings = await import(`../src/lib/soundSettings.ts?case=${index}`);
  const initial = settings.readSoundSettings();
  assert.equal(initial.music.volume, test.music);
  assert.equal(initial.effects.volume, test.effects);
  assert.equal(initial.effects.muted, test.muted);
  assert.equal(storage.has("duelz_puzzle_round_music"), false);
  settings.changeChannelVolume("music", 0.63);
  settings.changeChannelVolume("music", 0);
  assert.equal(settings.readSoundSettings().music.muted, true);
  settings.changeChannelMuted("music", false);
  assert.equal(settings.readSoundSettings().music.volume, 0.63);
  settings.changeChannelMuted("music", true);
  settings.changeChannelMuted("music", false);
  assert.equal(settings.readSoundSettings().music.volume, 0.63);
  assert.equal(JSON.parse(storage.get("duelz_sound_settings_v2") ?? "{}").music.volume, 0.63);
}
console.log(
  "PASS fresh defaults, old mute/volume migration, puzzle-key deletion, zero/off equivalence, last-volume restore and persistence.",
);
