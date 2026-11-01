/**
 * home-music-check (1 Nov 2026, Joe: the home music restarted on every page change): the app-wide home bed
 * (`holdHomeBed` / `useHomeBed`, src/lib/sound.ts and src/lib/useScreenMusic.ts; docs/sound-cues/music.md).
 *
 * On a fake Web Audio context (no browser), with the real sound.ts and manifest, it proves:
 *  1. a screen holding the bed starts it once (music_home's file, looping);
 *  2. moving from one holder to the next (Play → Practice → Profile → Tournaments → the lobby, each page's release
 *     before the next page's hold, as React unmounts and mounts) never stops or restarts it;
 *  3. Practice's own slot, while it shares the home bed's file, holds the same bed (no second start);
 *  4. leaving a room (releaseRoomMusic) keeps the home bed playing and its file loaded;
 *  5. a game's music taking over stops it, and holding it again resumes from where it was left (not from the top);
 *  6. with no holder for longer than the grace it stops (fading), and nothing restarts it;
 *  7. the screens hold it: Play, Practice's list, Tournaments, Profile and the room lobby (source).
 */
import { readFileSync } from "node:fs";

let failures = 0;
const check = (ok: boolean, what: string) => {
  if (!ok) {
    failures++;
    console.log(`FAIL ${what}`);
  }
};

interface Started { url: string; offset: number; loop: boolean }
const started: Started[] = [];
const stopped: string[] = [];
const param = () => ({ value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
const node = () => ({ connect(next: unknown) { return next ?? node(); }, disconnect() {} });
interface FakeBuffer { duration: number; length: number; numberOfChannels: number; sampleRate: number; url: string; getChannelData: () => Float32Array }
let fake: FakeContext | null = null;
class FakeContext {
  state = "running";
  currentTime = 0;
  sampleRate = 48000;
  destination = node();
  constructor() {
    fake = this;
  }
  createGain() {
    return { ...node(), gain: param() };
  }
  createBiquadFilter() {
    return { ...node(), frequency: param(), type: "" };
  }
  createOscillator() {
    return { ...node(), frequency: param(), type: "", start() {}, stop() {} };
  }
  createBuffer(_c: number, length: number, sampleRate: number) {
    return { duration: length / sampleRate, length, numberOfChannels: 1, sampleRate, url: "", getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    const source = {
      ...node(),
      buffer: null as FakeBuffer | null,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      playbackRate: param(),
      onended: null,
      start(_when?: number, offset?: number) {
        if (source.buffer?.url) started.push({ url: source.buffer.url, offset: offset ?? 0, loop: source.loop });
      },
      stop() {
        if (source.buffer?.url) stopped.push(source.buffer.url);
      },
    };
    return source;
  }
  decodeAudioData(bytes: ArrayBuffer): Promise<FakeBuffer> {
    const url = new TextDecoder().decode(bytes);
    // Every file stands in as 60 s long (the home bed's real length).
    const length = 60 * 48000;
    const data = new Float32Array(length).fill(0.5);
    return Promise.resolve({ duration: 60, length, numberOfChannels: 1, sampleRate: 48000, url, getChannelData: () => data });
  }
  resume() {
    return Promise.resolve();
  }
  suspend() {
    return Promise.resolve();
  }
  addEventListener() {}
}
const target = new EventTarget();
const storage = new Map<string, string>();
Object.assign(globalThis, {
  window: Object.assign(target, {
    AudioContext: FakeContext,
    location: { search: "" },
    localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) },
    setTimeout,
    clearTimeout,
  }),
  document: { visibilityState: "visible", addEventListener() {}, removeEventListener() {} },
  fetch: async (url: string) => ({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(url).buffer }),
});
console.warn = () => {};

const { SOUND_MANIFEST } = await import("../src/lib/fx/manifest");
const sound = await import("../src/lib/sound");
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const HOME = SOUND_MANIFEST.music_home.url!;
const homeStarts = () => started.filter((s) => s.url === HOME);
const take = () => started.splice(0, started.length);

check(!!HOME && SOUND_MANIFEST.music_practice.url === HOME, "music_home and music_practice share the menu file (practice's slot holds the home bed)");
sound.unlockAudio();
await wait(30);
take();

// 1. Play holds it.
let release = sound.holdHomeBed(sound.screenMusic("music_home"));
for (let i = 0; i < 100 && !sound.homeBedState().playing; i++) await wait(10);
check(sound.homeBedState().playing, "the Play tab starts the home bed");
check(homeStarts().length === 1 && homeStarts()[0]!.loop, `the home bed starts once, looping (${homeStarts().length} starts)`);
take();
stopped.length = 0;

// 2–3. Page to page: each release comes before the next hold, as React unmounts the old page first.
const holders: [string, () => () => void][] = [
  ["Practice", () => sound.holdHomeBed(sound.screenMusic("music_practice"))],
  ["Profile", () => sound.holdHomeBed()],
  ["Tournaments", () => sound.holdHomeBed()],
  ["the lobby", () => sound.holdHomeBed()],
  ["Play", () => sound.holdHomeBed(sound.screenMusic("music_home"))],
];
for (const [page, hold] of holders) {
  fake!.currentTime += 3;
  release();
  await wait(5);
  release = hold();
  await wait(sound.HOME_BED_GRACE_MS + 100);
  check(sound.homeBedState().playing && started.length === 0 && stopped.length === 0, `to ${page}: the home bed plays on without a restart (${started.length} starts, ${stopped.length} stops)`);
}

// 4. Leaving a room keeps it (and its file).
sound.releaseRoomMusic();
check(sound.homeBedState().playing && stopped.length === 0, "leaving a room keeps the home bed playing");

// 5. A game takes over at 15 s in, then the home bed comes back from there.
fake!.currentTime = 15;
const playedFor = 15;
// As RoundIntro does: the bed before stops, then the intro's starts.
sound.stopMusic(0);
sound.startMusic("intro_loop", { fadeMs: 0 });
for (let i = 0; i < 100 && sound.homeBedState().playing; i++) await wait(10);
check(!sound.homeBedState().playing, "a round's intro takes over from the home bed");
const at = sound.homeBedState().offset;
check(at !== null && Math.abs(at - playedFor) < 0.01, `the home bed's place is kept (${at})`);
release();
await wait(sound.HOME_BED_GRACE_MS + 100);
take();
fake!.currentTime = 40;
release = sound.holdHomeBed(sound.screenMusic("music_practice"));
await wait(20);
const back = homeStarts();
check(back.length === 1 && Math.abs(back[0]!.offset - playedFor) < 0.01, `back on Practice's list it resumes at ${playedFor} s, not the top (${back.map((s) => s.offset).join(",")})`);
take();

// 6. No holder: it stops after the grace, and stays stopped.
stopped.length = 0;
release();
await wait(sound.HOME_BED_GRACE_MS / 2);
check(sound.homeBedState().playing, "still playing within the grace");
await wait(sound.HOME_BED_GRACE_MS);
check(!sound.homeBedState().playing && stopped.includes(HOME), "stopped once nothing holds it");
await wait(100);
check(started.length === 0, "nothing restarts it");

// 7. The screens hold it.
const src = (f: string) => readFileSync(f, "utf8");
check(/useHomeBed\(true, screenMusic\("music_home"\)\)/.test(src("src/routes/index.tsx")), "Play holds the home bed");
check(/useHomeBed\(stage === "list", screenMusic\("music_practice"\)\)/.test(src("src/routes/practice.tsx")), "Practice's list holds the home bed");
check(/useHomeBed\(\);/.test(src("src/routes/profile.tsx")), "Profile holds the home bed");
check(/useHomeBed\(\);/.test(src("src/routes/tournaments.tsx")), "Tournaments holds the home bed");
check(/useHomeBed\(inLobby \|\| !duel\);/.test(src("src/routes/duel.$code.tsx")) && !/\? "lobby_loop"/.test(src("src/routes/duel.$code.tsx")), "the room lobby holds the home bed (not lobby_loop)");
check(!/useScreenMusic\("music_(home|practice)"/.test(src("src/routes/index.tsx") + src("src/routes/practice.tsx")), "no page starts and stops its own copy of the menu music");

if (failures) {
  console.log(`FAIL home-music-check: ${failures} failure(s)`);
  process.exit(1);
}
console.log("PASS home-music-check: one home bed across Play, Practice, Profile, Tournaments and the lobby; no restart between pages; kept on leaving a room; a game takes over and it resumes where it was; stops after the grace with no holder");
