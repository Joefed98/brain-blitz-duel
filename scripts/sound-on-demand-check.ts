/**
 * sound-on-demand-check (speed fix 5, Nov 2026; docs/speed-fixes-nov-2026.md). Proves, on src/lib/sound.ts with a
 * stubbed Web Audio context and a simulated slow network (1.6 Mbit/s, one shared pipe, 300 ms a request, decoding
 * at 2 KB a millisecond, all on a fake clock):
 *  1. the first tap fetches and decodes only the shared `core` set: no game's own slot, no room, voice, arcade or
 *     puzzle group;
 *  2. a slot asked for before its file is here plays nothing (never a placeholder tone) and is fetched then;
 *  3. every game's own sounds (with the voices and its kind's shared sounds) finish decoding inside its round intro,
 *     before play can start: cold (nothing of its kind decoded yet) within the intro's length before the 3-2-1, and
 *     within the shortest round's clock, so a room, which decodes the next round's sounds during the round before,
 *     always has them before that round's intro;
 *  4. a room of three rounds: the lobby decodes round 1's and 2's sounds, each round's are ready the moment its
 *     intro opens, and only the last two games' own sounds stay decoded;
 *  5. once ready, every slot of the game plays its own file (no first sound is silent);
 *  6. the wiring: the intro's Ready waits for gameSoundsReady (useGameSoundsReady) and the intro and stage call
 *     loadGameSounds; rooms and the Daily / challenges call it for the current and the next round.
 */
import { readFileSync, statSync } from "node:fs";

import { SOUND_MANIFEST, type SoundId } from "../src/lib/fx/manifest";
import { ACTIVE_PUZZLE_TYPES, puzzleInfo, typeTimeLimitMs, usesArcadeClock, ARCADE_PHASE_SLACK_MS } from "../src/lib/duel/catalogue";
import { INTRO_COUNTDOWN_MS, INTRO_MS, type PuzzleType } from "../src/lib/duel/types";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}

/* A fake clock: sound.ts's timers and the simulated network both follow it. */
let now = 0;
let timerId = 0;
const timers = new Map<number, { at: number; fn: () => void }>();
const realSetTimeout = globalThis.setTimeout;
Object.assign(globalThis, {
  setTimeout: (fn: () => void, ms = 0) => {
    timers.set(++timerId, { at: now + ms, fn });
    return timerId;
  },
  clearTimeout: (id: number) => void timers.delete(id),
});
const flush = () => new Promise<void>((resolve) => realSetTimeout(resolve, 0));
async function advance(ms: number): Promise<void> {
  const end = now + ms;
  for (;;) {
    for (let i = 0; i < 4; i++) await flush();
    const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
    if (!due) break;
    timers.delete(due[0]);
    now = due[1].at;
    due[1].fn();
  }
  now = end;
  for (let i = 0; i < 4; i++) await flush();
}
/** Advances until `done()` or `limit` ms, returning the ms it took (Infinity if never). */
async function until(done: () => boolean, limit: number, step = 50): Promise<number> {
  const start = now;
  for (;;) {
    if (done()) return now - start;
    if (now - start >= limit) return Infinity;
    await advance(step);
  }
}

/* The simulated network: one 1.6 Mbit/s pipe (200 bytes a ms), 300 ms a request; decode 2 KB a ms. */
const BYTES_PER_MS = 200;
const REQUEST_MS = 300;
const DECODE_BYTES_PER_MS = 2048;
let pipeFreeAt = 0;
const fetched: string[] = [];
const sizeOf = (url: string) => {
  try {
    return statSync(`public${url}`).size;
  } catch {
    return 1000;
  }
};
function slowFetch(url: string): Promise<{ ok: boolean; status: number; arrayBuffer: () => Promise<ArrayBuffer> }> {
  fetched.push(url);
  const start = Math.max(now, pipeFreeAt);
  pipeFreeAt = start + sizeOf(url) / BYTES_PER_MS;
  const at = pipeFreeAt + REQUEST_MS;
  return new Promise((resolve) => {
    globalThis.setTimeout(() => resolve({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(url).buffer }), at - now);
  });
}

interface FakeSource {
  url: string;
  started: boolean;
}
const sources: FakeSource[] = [];
let tones = 0;
const param = () => ({ value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} });
const node = () => ({ connect: (next: unknown) => next ?? node(), disconnect() {} });
class FakeAudioContext {
  state = "running";
  get currentTime() {
    return now / 1000;
  }
  sampleRate = 44100;
  destination = node();
  createGain() {
    return { ...node(), gain: param() };
  }
  createBiquadFilter() {
    return { ...node(), frequency: param(), type: "" };
  }
  createOscillator() {
    tones++;
    return { ...node(), frequency: param(), type: "", start() {}, stop() {}, addEventListener() {} };
  }
  createBuffer(_c: number, length: number, sampleRate: number) {
    return { duration: length / sampleRate, length, numberOfChannels: 1, sampleRate, getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    const ended: (() => void)[] = [];
    const record: FakeSource = { url: "", started: false };
    const source = {
      ...node(),
      buffer: null as { url: string } | null,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      playbackRate: param(),
      onended: null,
      addEventListener: (type: string, fn: () => void) => void (type === "ended" && ended.push(fn)),
      start() {
        record.url = source.buffer?.url ?? "";
        record.started = true;
        sources.push(record);
        if (!source.loop) void Promise.resolve().then(() => ended.forEach((fn) => fn()));
      },
      stop() {
        void Promise.resolve().then(() => ended.forEach((fn) => fn()));
      },
    };
    return source;
  }
  decodeAudioData(bytes: ArrayBuffer) {
    const url = new TextDecoder().decode(bytes);
    const length = 44100;
    const data = new Float32Array(length).fill(0.5);
    return new Promise((resolve) =>
      globalThis.setTimeout(() => resolve({ duration: 1, length, numberOfChannels: 1, sampleRate: 44100, url, getChannelData: () => data }), Math.ceil(sizeOf(url) / DECODE_BYTES_PER_MS)),
    );
  }
  suspend() {
    this.state = "suspended";
    return Promise.resolve();
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
  addEventListener() {}
}
const store = new Map<string, string>();
const fakeWin = Object.assign(new EventTarget(), {
  AudioContext: FakeAudioContext,
  location: { search: "" },
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) },
  setTimeout: (fn: () => void, ms?: number) => (globalThis.setTimeout as (f: () => void, m?: number) => number)(fn, ms),
  clearTimeout: (id: number) => globalThis.clearTimeout(id),
  devicePixelRatio: 2,
});
Object.assign(globalThis, {
  window: fakeWin,
  document: { visibilityState: "visible", addEventListener() {}, removeEventListener() {} },
  fetch: slowFetch,
});

const sound = await import("../src/lib/sound");
const loaded = () => new Set(sound.soundDiagnostics().loaded);

/* 1. The first tap: the shared core set only. */
const core = sound.groupSoundSlots("core");
sound.unlockAudio();
const coreMs = await until(() => core.every((id) => loaded().has(id)), 60_000);
check(Number.isFinite(coreMs), "the first tap decodes the whole core set");
{
  const have = loaded();
  const extra = [...have].filter((id) => SOUND_MANIFEST[id as SoundId].channel !== "music" && !core.includes(id as SoundId));
  check(extra.length === 0, `the first tap decodes nothing outside the core set (${extra.slice(0, 8).join(", ")})`);
  const groups = (["room", "voice", "arcade", "puzzle"] as const).filter((g) => sound.groupSoundSlots(g).some((id) => have.has(id)));
  check(groups.length === 0, `no room, voice, arcade or puzzle sound at the first tap (${groups.join(", ")})`);
  check(new Set(fetched).size === sound.firstTapSoundUrls().length && fetched.length === new Set(fetched).size, `the first tap fetches each core file once (${fetched.length} requests, ${sound.firstTapSoundUrls().length} files)`);
  check(core.length > 0 && core.every((id) => sound.soundSlotGame(id) === null), "the core set belongs to no one game");
}

/* 2. Asked for before it is here: silent, then fetched. */
const games = ACTIVE_PUZZLE_TYPES.filter((t) => sound.gameSoundSlots(t).length > 0);
const playable = (type: string) => sound.gameSoundSlots(type).filter((id) => SOUND_MANIFEST[id].channel === "effects" && !SOUND_MANIFEST[id].loop);
{
  const type = games.find((t) => playable(t).length > 0)!;
  const slot = playable(type)[0]!;
  const tonesBefore = tones;
  const startsBefore = sources.length;
  const played = sound.playSound(slot);
  check(played === 0 && tones === tonesBefore && sources.length === startsBefore, `${slot} before its file: silent, no placeholder tone`);
  check(!sound.gameSoundsReady(type), `${type}: not ready before its sounds are asked for`);
  const askedMs = await until(() => sound.gameSoundsReady(type), 60_000);
  check(Number.isFinite(askedMs), `${slot} asked for early: ${type}'s whole set is fetched then`);
}

/* 3. Every game's sounds decode inside its intro, and inside the shortest round. */
const introWindow = INTRO_MS - INTRO_COUNTDOWN_MS;
const shortestRound = Math.min(
  ...ACTIVE_PUZZLE_TYPES.map((t) => typeTimeLimitMs(t) - (usesArcadeClock(t) ? ARCADE_PHASE_SLACK_MS : 0)),
);
let worst = { type: "", ms: 0 };
for (const type of games) {
  sound.loadGameSounds(type);
  const ms = await until(() => sound.gameSoundsReady(type), introWindow + 1);
  check(ms <= introWindow, `${type}: its sounds decode within the intro (${ms} ms of ${introWindow})`);
  check(ms <= shortestRound, `${type}: its sounds decode within the shortest round (${ms} ms of ${shortestRound}), so a room has them before its intro`);
  if (ms > worst.ms) worst = { type, ms };
}
{
  // Cold: the biggest game set with every shared group of its kind too, as if nothing had been decoded but the core.
  const bytes = (ids: readonly SoundId[]) => [...new Set(ids.map((id) => SOUND_MANIFEST[id].url!))].reduce((n, url) => n + sizeOf(url), 0);
  const coldFor = (type: PuzzleType) => {
    const info = puzzleInfo(type);
    const ids = [
      ...sound.gameSoundSlots(type),
      ...sound.groupSoundSlots("voice"),
      ...(info.category === "arcade" || info.arcadeRun ? sound.groupSoundSlots("arcade") : []),
      ...(info.category !== "arcade" ? sound.groupSoundSlots("puzzle") : []),
    ];
    const files = new Set(ids.map((id) => SOUND_MANIFEST[id].url!)).size;
    return bytes(ids) / BYTES_PER_MS + files * (REQUEST_MS / 5) + bytes(ids) / DECODE_BYTES_PER_MS;
  };
  const cold = Math.max(...games.map(coldFor));
  check(cold <= introWindow, `cold (no shared sounds of its kind yet), the biggest game's sounds decode within the intro (≈${Math.round(cold)} ms of ${introWindow})`);
}

/* 4. A room of three rounds (the room screen's own calls, in its order). */
{
  const rounds = (["swing", "wavefront", "flip"] as PuzzleType[]).filter((t) => games.includes(t));
  check(rounds.length === 3, "three games with their own sounds for the room");
  const roomLoads = (round: number) => {
    const at = Math.max(0, round - 1);
    sound.loadGameSounds(rounds[at]);
    sound.loadGameSounds(rounds[at + 1]);
  };
  sound.loadSoundGroup("room");
  sound.loadSoundGroup("voice");
  roomLoads(0); // the lobby
  await advance(15_000);
  for (let round = 1; round <= 3; round++) {
    roomLoads(round);
    const type = rounds[round - 1]!;
    sound.loadGameSounds(type); // its intro
    check(sound.gameSoundsReady(type), `room round ${round} (${type}): its sounds are ready the moment its intro opens`);
    await advance(shortestRound);
  }
  const have = loaded();
  const resident = games.filter((t) => sound.gameSoundSlots(t).some((id) => have.has(id)));
  check(resident.length <= 2 && !resident.includes(rounds[0]!), `only the last two games' own sounds stay decoded (${resident.join(", ")})`);
  check(sound.groupSoundSlots("room").every((id) => have.has(id)), "the room's own moments are decoded");
}

/* 5. Once ready, no first sound is silent. */
for (const type of games) {
  sound.loadGameSounds(type);
  await until(() => sound.gameSoundsReady(type), introWindow + 1);
  for (const id of playable(type)) {
    const before = sources.length;
    sound.playSound(id, 1, 1, true);
    const started = sources.slice(before).some((s) => s.url === SOUND_MANIFEST[id].url);
    check(started, `${id}: plays its own file the first time it is asked for once ${type} is ready`);
  }
}

/* 6. The wiring. */
{
  const intro = readFileSync("src/components/duel/RoundIntro.tsx", "utf8");
  check(/const soundsReady = useGameSoundsReady\(type\);/.test(intro) && /disabled=\{ready \|\| !dataReady \|\| !soundsReady\}/.test(intro), "the intro's Ready waits for the game's sounds");
  check(/loadGameSounds\(type\);/.test(intro), "the intro asks for the game's sounds as it opens");
  const parts = readFileSync("src/components/duel/GameParts.tsx", "utf8");
  check(/useEffect\(\(\) => loadGameSounds\(props\.puzzle\.type\), \[props\.puzzle\.type\]\)/.test(parts), "the stage asks for them too (a reload mid-round)");
  const room = readFileSync("src/routes/duel.$code.tsx", "utf8");
  check(/loadGameSounds\(order\[at\]\);\s*loadGameSounds\(order\[at \+ 1\]\);/.test(room), "a room decodes the current and the next round's sounds");
  const run = readFileSync("src/components/async/AsyncRun.tsx", "utf8");
  check(/loadGameSounds\(types\[at\]\);\s*loadGameSounds\(types\[at \+ 1\]\);/.test(run), "the Daily and challenges decode the current and the next round's sounds");
  const hook = readFileSync("src/lib/useGameSoundsReady.ts", "utf8");
  check(/onSoundsLoaded\(/.test(hook) && /gameSoundsReady\(type\)/.test(hook), "useGameSoundsReady follows gameSoundsReady");
}

if (failures.length) {
  for (const f of failures.slice(0, 60)) console.log(`FAIL ${f}`);
  console.log(`FAIL sound-on-demand-check: ${failures.length} failure(s), ${passes} passes`);
  process.exit(1);
}
console.log(
  `PASS sound-on-demand-check: ${passes} checks; first tap ${core.length} slots in ${coreMs} ms; ${games.length} games, slowest warm ${worst.type} ${worst.ms} ms (intro window ${introWindow} ms, shortest round ${shortestRound} ms)`,
);
