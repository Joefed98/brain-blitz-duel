/**
 * home-music-check (1 Nov 2026, Joe: the home music restarted on every page change): the app-wide home bed
 * (`holdHomeBed` / `useHomeBed`, src/lib/sound.ts and src/lib/useScreenMusic.ts; docs/sound-cues/music.md).
 *
 * On a fake Web Audio context (no browser), with the real sound.ts and manifest, it proves:
 *  1. a screen holding the bed starts it once (music_home's file, looping);
 *  2. moving from one holder to the next (Play → Practice → Profile → Tournaments → Play, each page's release
 *     before the next page's hold, as React unmounts and mounts) never stops or restarts it;
 *  3. Practice's own slot, while it shares the home bed's file, holds the same bed (no second start);
 *  4. leaving a room (releaseRoomMusic) keeps the home bed playing and its file loaded;
 *  5. a game's music taking over stops it, and holding it again resumes from where it was left (not from the top);
 *  6. with no holder for longer than the grace it stops (fading), and nothing restarts it;
 *  7. the screens hold it: Play, Practice's list, Tournaments and Profile (source);
 *  8. the lobby plays its own lobby_loop again (follow-up, 1 Nov 2026): entering it from Play crossfades the home bed out
 *     over 400 ms (FADE_MS) while the room loads and the lobby's file decodes; leaving it for a tab page crossfades
 *     lobby_loop out over 400 ms and the home bed resumes at the place it was left; a lobby → game → home trip hands
 *     lobby_loop to the round intro's bed exactly as before and ends on the home bed (source: the room route asks for
 *     lobby_loop and holds the home bed only while it loads).
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
/** Each source's stop time (context seconds), by file: a fade-out stops it at its fade's end. */
const stopAt: { url: string; when: number }[] = [];
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
      stop(when?: number) {
        if (source.buffer?.url) {
          stopped.push(source.buffer.url);
          stopAt.push({ url: source.buffer.url, when: when ?? 0 });
        }
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
const room = src("src/routes/duel.$code.tsx");
check(/duel\?\.status === "waiting"\s*\? "lobby_loop"/.test(room), "the room lobby asks for lobby_loop");
check(/useHomeBed\(!duel\);/.test(room) && (room.match(/useHomeBed\(/g) ?? []).length === 1, "the room page holds the home bed only while it loads");
check(!/useScreenMusic\("music_(home|practice)"/.test(src("src/routes/index.tsx") + src("src/routes/practice.tsx")), "no page starts and stops its own copy of the menu music");

// 8. The lobby's own bed.
const LOBBY = SOUND_MANIFEST.lobby_loop.url!;
const INTRO = SOUND_MANIFEST.intro_loop.url!;
const FADE_S = 0.4;
const startsOf = (url: string) => started.filter((s) => s.url === url);
/** Play → a room's lobby, as the app does it: Play lets go, the room page holds the home bed while it loads, then the lobby asks for its bed. */
async function playToLobby(): Promise<() => void> {
  release();
  const loading = sound.holdHomeBed();
  await wait(5);
  loading();
  sound.startMusic("lobby_loop");
  for (let i = 0; i < 100 && sound.homeBedState().playing; i++) await wait(10);
  return () => {};
}
release = sound.holdHomeBed(sound.screenMusic("music_home"));
await wait(20);
check(sound.homeBedState().playing, "lobby: the home bed plays on Play first");
take();
stopped.length = 0;
stopAt.length = 0;
fake!.currentTime = 100;
const before = sound.homeBedState();
await playToLobby();
check(startsOf(LOBBY).length === 1 && startsOf(LOBBY)[0]!.loop, `the lobby plays lobby_loop, looping (${startsOf(LOBBY).length} starts)`);
check(!sound.homeBedState().playing && sound.isMusicPlaying("lobby_loop"), "lobby_loop takes over from the home bed");
const homeOut = stopAt.find((s) => s.url === HOME);
check(!!homeOut && Math.abs(homeOut.when - (100 + FADE_S + 0.02)) < 0.001, `the home bed crossfades out over 400 ms (stops at ${homeOut?.when})`);
const leftAt = sound.homeBedState().offset;
check(before.playing && leftAt !== null && leftAt > 0, `the home bed's place is kept on entering the lobby (${leftAt})`);
await wait(sound.HOME_BED_GRACE_MS + 100);
check(sound.isMusicPlaying("lobby_loop"), "the lobby's bed stays after the room page's loading hold lets go");

// Lobby → Play: lobby_loop crossfades out, the home bed resumes where it was.
take();
stopAt.length = 0;
fake!.currentTime = 130;
sound.releaseRoomMusic();
release = sound.holdHomeBed(sound.screenMusic("music_home"));
await wait(20);
const lobbyOut = stopAt.find((s) => s.url === LOBBY);
check(!!lobbyOut && Math.abs(lobbyOut.when - (130 + FADE_S + 0.02)) < 0.001, `leaving the lobby crossfades lobby_loop out over 400 ms (stops at ${lobbyOut?.when})`);
const resumed = homeStarts();
check(sound.homeBedState().playing && resumed.length === 1 && leftAt !== null && Math.abs(resumed[0]!.offset - leftAt) < 0.01, `back on Play the home bed resumes at ${leftAt} s, not the top (${resumed.map((r) => r.offset).join(",")})`);

// Lobby → game → home: lobby_loop hands over to the round intro's bed as before, and the trip ends on the home bed.
fake!.currentTime = 200;
await playToLobby();
take();
// The room leaves the lobby (Prepare to Duel: its slot has no file, so the room stops the bed), then RoundIntro's bed.
sound.stopMusic(0);
sound.stopMusic(0);
sound.startMusic("intro_loop", { fadeMs: 0 });
for (let i = 0; i < 100 && !sound.isMusicPlaying("intro_loop"); i++) await wait(10);
check(sound.isMusicPlaying("intro_loop") && startsOf(INTRO).length === 1 && !sound.isMusicPlaying("lobby_loop"), "lobby → game: the round intro's bed takes over from lobby_loop");
sound.stopMusic(0);
fake!.currentTime = 260;
sound.releaseRoomMusic();
take();
release = sound.holdHomeBed(sound.screenMusic("music_home"));
await wait(30);
check(sound.homeBedState().playing && homeStarts().length === 1, "lobby → game → home ends on the home bed");
release();
await wait(sound.HOME_BED_GRACE_MS + 100);

if (failures) {
  console.log(`FAIL home-music-check: ${failures} failure(s)`);
  process.exit(1);
}
console.log("PASS home-music-check: one home bed across Play, Practice, Profile and Tournaments; no restart between pages; the lobby plays lobby_loop (400 ms crossfades both ways) and the home bed resumes where it was; lobby → game → home ends on it; kept on leaving a room; a game takes over and it resumes where it was; stops after the grace with no holder");
