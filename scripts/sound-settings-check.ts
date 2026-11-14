import assert from "node:assert/strict";

const cases = [
  // Changed with Joe's approval, 14 Nov 2026 (new music default 80%).
  { old: {}, music: 0.8, effects: 1, muted: false },
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
// The volume defaults (the components step, 14 Nov 2026): sound effects 100 % and music 80 % for a player who hasn't set
// their own; a saved setting is kept; the old untouched default (written by every first read before the marker) moves to
// the new default; a choice made now is remembered as one.
function fresh(stored: Record<string, string>, tag: string) {
  const storage = new Map<string, string>(Object.entries(stored));
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
  return { storage, load: () => import(`../src/lib/soundSettings.ts?defaults=${tag}`) };
}
const KEY = "duelz_sound_settings_v2";
const record = (music: object, effects: object) => ({ [KEY]: JSON.stringify({ music, effects }) });
{
  const { storage, load } = fresh({}, "unset");
  const s = await load();
  assert.deepEqual(s.DEFAULT_VOLUME, { effects: 1, music: 0.8 }, "defaults: effects 100 %, music 80 %");
  const first = s.readSoundSettings();
  assert.equal(first.effects.volume, 1, "unset: effects 100 %");
  assert.equal(first.music.volume, 0.8, "unset: music 80 %");
  assert.equal(first.music.muted, false);
  assert.equal(JSON.parse(storage.get(KEY) ?? "{}").music.set, false, "the stored default is not a choice");
  s.changeChannelVolume("music", 1);
  assert.equal(JSON.parse(storage.get(KEY) ?? "{}").music.set, true, "a slider move is a choice");
}
{
  // The default the store wrote itself stays the default on the next open (it never turns into a choice).
  const { storage, load } = fresh({}, "reopen-a");
  (await load()).readSoundSettings();
  const again = fresh(Object.fromEntries(storage), "reopen-b");
  assert.equal((await again.load()).readSoundSettings().music.volume, 0.8, "reopened: still the default");
}
{
  const { load } = fresh(record({ muted: false, volume: 1, lastVolume: 1, set: true }, { muted: false, volume: 1, lastVolume: 1, set: true }), "chose-100");
  assert.equal((await load()).readSoundSettings().music.volume, 1, "a player who chose 100 % keeps it");
}
{
  const { load } = fresh(record({ muted: false, volume: 0.4, lastVolume: 0.4 }, { muted: false, volume: 0.55, lastVolume: 0.55 }), "old-choice");
  const s = (await load()).readSoundSettings();
  assert.equal(s.music.volume, 0.4, "an older saved music volume is kept");
  assert.equal(s.effects.volume, 0.55, "an older saved effects volume is kept");
}
{
  const { load } = fresh(record({ muted: true, volume: 1, lastVolume: 1 }, { muted: false, volume: 1, lastVolume: 1 }), "old-muted");
  const s = (await load()).readSoundSettings();
  assert.equal(s.music.muted, true, "an older muted music stays muted");
  assert.equal(s.effects.volume, 1, "effects at 100 % either way");
}
{
  const { load } = fresh(record({ muted: false, volume: 1, lastVolume: 1 }, { muted: false, volume: 1, lastVolume: 1 }), "old-untouched");
  assert.equal((await load()).readSoundSettings().music.volume, 0.8, "the old untouched default moves to 80 %");
}
console.log(
  "PASS volume defaults (effects 100 %, music 80 % unset; saved settings kept), fresh defaults, old mute/volume migration, puzzle-key deletion, zero/off equivalence, last-volume restore and persistence.",
);
