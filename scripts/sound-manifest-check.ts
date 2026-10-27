/**
 * sound-manifest-check: the sound manifest, the cue sheet and the players agree.
 *
 * Static: every cue in docs/sound-cues has a manifest slot and every slot a cue;
 * every cue the code dispatches or plays is documented; every file in the
 * manifest is played somewhere; every audio file in the repo is in the manifest;
 * docs/sound-cues/cue-sheet.csv matches the manifest (re-run
 * `bun scripts/sound-cue-sheet.ts` after changing either); the screen music hooks
 * are wired.
 *
 * Behavioural (stubbed Web Audio, no browser): with a file set on EVERY slot, each
 * named cue plays its own file through the duelz-sound listener, each arcade moment
 * plays its own file instead of the shared one, each placeholder slot replaces its
 * tone, each game's music slot is chosen by roundMusicFor and plays as the round bed,
 * and each screen slot plays. Then: a slot whose file is missing (404) or unset
 * falls back to today's behaviour (silence, the shared sound, the tone, the shared
 * bed) without throwing or logging an error, and never beeps.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { SOUND_MANIFEST } from "../src/lib/fx/manifest";
import { SOUND_CUE_EVENT } from "../src/lib/fx/soundCues";
import { buildRows, parseCsv, readDocRows, sortRows } from "./sound-cue-sheet";

const failures: string[] = [];
const notes: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}

type Entry = {
  channel: string;
  frequency: number;
  ms: number;
  url: string | null;
  volume?: number;
  loop?: boolean;
};
const manifest = SOUND_MANIFEST as unknown as Record<string, Entry>;
const ids = Object.keys(manifest);
const rows = sortRows(buildRows());
const rowBySlot = new Map(rows.filter((r) => r.slot).map((r) => [r.slot, r]));
const arcadeCues = rows.filter((r) => r.where.endsWith("[arcade.md]")).map((r) => r.cue);
const placeholderSlots = ["chain.linkTone", "chain.breakTone"];
const screenSlots = [
  "music_home",
  "music_practice",
  "music_prepare",
  "music_round_title",
  "music_reveal",
  "music_winner",
];

/* ------------------------------------------------------------- static */

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".git", ".shots", "dist", ".output", ".vinxi", ".tanstack"].includes(name))
      continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}
const repoFiles = walk(".");
const sourceText = repoFiles
  .filter((f) => /^src\/.*\.(ts|tsx)$/.test(relative(".", f)) && !f.endsWith("fx/manifest.ts"))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

// 1. Slots: every documented cue has one, every slot is documented.
for (const row of rows) {
  if (!row.slot) {
    check(
      row.cue === "beat.backing",
      `${row.cue}: no manifest slot (only Tempo's backing beat may lack one)`,
    );
    continue;
  }
  check(
    !!manifest[row.slot],
    `${row.cue}: slot ${row.slot} missing from src/lib/fx/manifest.ts (bun scripts/sound-cue-sheet.ts --slots)`,
  );
}
for (const id of ids) {
  check(
    rowBySlot.has(id) || rows.some((r) => r.fileToday.replace(" (shared)", "") === id),
    `manifest ${id}: on no cue-sheet row`,
  );
  const e = manifest[id]!;
  if (e.url === null && id !== "tension_loop")
    check(
      e.frequency === 0,
      `manifest ${id}: an empty slot must have frequency 0 (no placeholder beep)`,
    );
  if (e.channel === "music" && e.url)
    check(/\.mp3$/i.test(e.url), `manifest ${id}: music must be MP3`);
  if (e.volume !== undefined)
    check(e.volume >= 0 && e.volume <= 1, `manifest ${id}: volume must be 0–1`);
}

// 2. Every cue the code dispatches or plays by name is documented.
const literal = (re: RegExp) => [...sourceText.matchAll(re)].map((m) => m[1]!);
const dispatched = literal(/[A-Za-z]*[cC]ue\(\s*["']([a-z][a-zA-Z0-9]*\.[A-Za-z0-9.-]+)["']/g);
for (const cue of new Set(dispatched))
  check(
    rows.some((r) => r.cue === cue),
    `code dispatches ${cue}: not in docs/sound-cues`,
  );
// Arcade effect cues (arcade-effects.md): every success-effect row names a real moment and a
// documented, slotted cue that is not a replay cue; every documented effect cue is fired somewhere.
const { MOMENT_CUES } = await import("../src/lib/fx/momentCues");
const { MOMENT_TABLE } = await import("../src/lib/replay/moments");
const replayCues = new Set(MOMENT_TABLE.map((m) => `${m.game}.${m.id}`));
const effectRows = rows.filter((r) => r.where.endsWith("[arcade-effects.md]"));
const knownSounds = new Set([...ids, "complete", "combo", "correct"]);
for (const m of MOMENT_CUES) {
  check(
    MOMENT_TABLE.some((row) => row.game === m.game && row.id === m.moment),
    `MOMENT_CUES ${m.cue}: no moment ${m.game}.${m.moment}`,
  );
  check(m.cue.startsWith(`${m.game}.`), `MOMENT_CUES ${m.cue}: must be ${m.game}.<event>`);
  check(!replayCues.has(m.cue), `MOMENT_CUES ${m.cue}: reuses a replay cue name`);
  check(effectRows.some((r) => r.cue === m.cue), `MOMENT_CUES ${m.cue}: not in arcade-effects.md`);
  for (const r of m.replaces ?? [])
    check(knownSounds.has(r), `MOMENT_CUES ${m.cue}: replaces unknown sound ${r}`);
}
check(
  new Set(MOMENT_CUES.map((m) => m.cue)).size === MOMENT_CUES.length,
  "MOMENT_CUES: a cue is listed twice",
);
for (const row of effectRows) {
  check(!replayCues.has(row.cue), `${row.cue}: reuses a replay cue name`);
  check(!!row.looks, `${row.cue}: arcade-effects.md row has no "looks like"`);
  check(
    MOMENT_CUES.some((m) => m.cue === row.cue) || dispatched.includes(row.cue),
    `arcade-effects.md lists ${row.cue}: nothing fires it`,
  );
}
const gameSounds = readFileSync("src/lib/fx/gameSounds.ts", "utf8");
const arcadeInCode = new Set(
  [
    ...gameSounds.matchAll(
      /(?:sfx|ensureSlotLoop|stopSlotLoop|retroStart|fairPerfect|toyKnock|toyRoll)\(\s*"([a-z]+\.[a-zA-Z]+)"/g,
    ),
  ].map((m) => m[1]!),
);
for (const cue of arcadeInCode)
  check(arcadeCues.includes(cue), `gameSounds.ts plays ${cue}: not in arcade.md`);
for (const cue of arcadeCues)
  check(arcadeInCode.has(cue), `arcade.md lists ${cue}: gameSounds.ts never plays it`);
check(
  !/\bplaySound\(|\bensureLoop\(/.test(gameSounds),
  "gameSounds.ts: every arcade moment goes through its slot (sfx / ensureSlotLoop)",
);
for (const slot of placeholderSlots)
  check(sourceText.includes(`playCueSlot("${slot}"`), `${slot}: no playCueSlot hook`);
check(
  /installSoundCueBridge\(\)/.test(readFileSync("src/routes/__root.tsx", "utf8")),
  "the duelz-sound listener is installed in __root.tsx",
);
for (const slot of screenSlots)
  check(
    new RegExp(`(screenMusic|useScreenMusic|stopMusicExcept)\\("${slot}"`).test(sourceText),
    `${slot}: no screen hook-up`,
  );

// 3. Every file with a URL is played somewhere.
const NOT_PLAYED: Record<string, string> = {
  warning_5: "the 5 s mark is visual only (src/lib/fx/index.ts)",
};
for (const id of ids) {
  const e = manifest[id]!;
  if (!e.url) continue;
  if (NOT_PLAYED[id]) {
    notes.push(`NOTE ${id} has a file but is never played: ${NOT_PLAYED[id]}`);
    continue;
  }
  const bySlot = rowBySlot.has(id) && (id.includes(".") || id.startsWith("music_"));
  const byName = sourceText.includes(`"${id}"`);
  check(bySlot || byName, `manifest ${id}: has a file but nothing plays it`);
}

// 4. Audio files in the repo: each is a manifest URL; each local manifest URL exists.
const AUDIO = /\.(mp3|ogg|wav|m4a|aac|flac|opus|webm)$/i;
const audioFiles = repoFiles.map((f) => relative(".", f)).filter((f) => AUDIO.test(f));
const urls = new Set(ids.map((id) => manifest[id]!.url).filter((u): u is string => !!u));
for (const file of audioFiles) {
  const url = file.startsWith("public/") ? `/${file.slice("public/".length)}` : null;
  check(
    !!url && urls.has(url),
    `${file}: audio file not used by any manifest slot${url ? "" : " (only public/ is served)"}`,
  );
}
for (const url of urls) {
  if (url.startsWith("/__l5e/") || /^https?:/.test(url)) continue;
  check(audioFiles.includes(`public${url}`), `manifest URL ${url}: no such file under public/`);
}
notes.push(
  `NOTE ${audioFiles.length} audio files in the repo; ${[...urls].filter((u) => u.startsWith("/__l5e/")).length} Lovable-hosted files in the manifest`,
);

// 5. The committed sheet matches the manifest.
const [head, ...body] = parseCsv(readFileSync("docs/sound-cues/cue-sheet.csv", "utf8"));
const col = (name: string) => head?.indexOf(name) ?? -1;
const csv = new Map(body.filter((r) => r.length > 1).map((r) => [r[col("cue id")]!, r]));
check(
  csv.size === rows.length,
  `cue-sheet.csv has ${csv.size} rows, the docs and manifest give ${rows.length} (bun scripts/sound-cue-sheet.ts)`,
);
for (const row of rows) {
  const line = csv.get(row.cue);
  if (!line) {
    failures.push(`cue-sheet.csv: no row for ${row.cue} (bun scripts/sound-cue-sheet.ts)`);
    continue;
  }
  check(
    line[col("status")] === row.status &&
      line[col("file it uses today")] === row.fileToday &&
      line[col("manifest slot")] === row.slot,
    `cue-sheet.csv: ${row.cue} is out of date (bun scripts/sound-cue-sheet.ts)`,
  );
}
check(col("new file") >= 0, "cue-sheet.csv has a new file column");

/* ------------------------------------------------------- behavioural */

interface FakeBuffer {
  duration: number;
  length: number;
  numberOfChannels: number;
  sampleRate: number;
  url: string;
  getChannelData: () => Float32Array;
}
interface Started {
  url: string | null;
  rate: number;
  loop: boolean;
  offset?: number;
  loopStart?: number;
  loopEnd?: number;
}
const started: Started[] = [];
let tones = 0;
const errors: unknown[][] = [];
const warns: unknown[][] = [];
const MISSING = new Set<string>();

const param = () => ({
  value: 1,
  setValueAtTime() {},
  linearRampToValueAtTime() {},
  exponentialRampToValueAtTime() {},
  cancelScheduledValues() {},
});
const node = () => ({
  connect(next: unknown) {
    return next ?? node();
  },
  disconnect() {},
});
const fakeContexts: FakeContext[] = [];
class FakeContext {
  constructor() {
    fakeContexts.push(this);
  }
  state = "running";
  currentTime = 0;
  sampleRate = 48000;
  destination = node();
  createGain() {
    return { ...node(), gain: param() };
  }
  createBiquadFilter() {
    return { ...node(), frequency: param(), type: "" };
  }
  createOscillator() {
    return {
      ...node(),
      frequency: param(),
      type: "",
      start() {
        tones++;
      },
      stop() {},
    };
  }
  createBuffer(_c: number, length: number, sampleRate: number) {
    return {
      duration: length / sampleRate,
      length,
      numberOfChannels: 1,
      sampleRate,
      url: "",
      getChannelData: () => new Float32Array(length),
    };
  }
  createBufferSource() {
    const source = {
      ...node(),
      buffer: null as FakeBuffer | null,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      playbackRate: {
        ...param(),
        setValueAtTime(v: number) {
          source.rate = v;
        },
      },
      rate: 1,
      onended: null,
      start(_when?: number, offset?: number) {
        if (source.buffer?.url)
          started.push({ url: source.buffer.url, rate: source.rate, loop: source.loop, offset, loopStart: source.loopStart, loopEnd: source.loopEnd });
      },
      stop() {},
    };
    return source;
  }
  decodeAudioData(bytes: ArrayBuffer): Promise<FakeBuffer> {
    const url = new TextDecoder().decode(bytes);
    // Tempo's track stands in at its real length (60 s), so its groove loop (8–56 s) fits.
    const length = url.includes("music_beat") ? 60 * 48000 : 4800;
    const data = new Float32Array(length).fill(0.5);
    return Promise.resolve({
      duration: length / 48000,
      length,
      numberOfChannels: 1,
      sampleRate: 48000,
      url,
      getChannelData: () => data,
    });
  }
  resume() {
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
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
    },
    setTimeout,
    clearTimeout,
  }),
  document: { visibilityState: "visible", addEventListener() {}, removeEventListener() {} },
  fetch: async (url: string) =>
    MISSING.has(url)
      ? { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) }
      : { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(url).buffer },
});
const realError = console.error;
const realWarn = console.warn;
console.error = (...args: unknown[]) => errors.push(args);
console.warn = (...args: unknown[]) => warns.push(args);

// A file on every slot (the loader reads the manifest when sound.ts loads). Slots are the unset
// entries, those filled through git (public/sounds) and named cues pointed at another entry's
// recording; each gets a test file here and is unset again below.
const sharesFile = (id: string) =>
  ids.some((other) => other !== id && manifest[other]!.url === manifest[id]!.url);
const slotIds = ids.filter((id) => {
  const url = manifest[id]!.url;
  if (id === "tension_loop") return false;
  return url === null || url.startsWith("/sounds/") || (id.includes(".") && sharesFile(id));
});
const testUrl = (id: string) => `/sounds/${id}.mp3`;
for (const id of slotIds) manifest[id]!.url = testUrl(id);
const MISS_CUE = "room.finalRound";
const MISS_ARCADE = "pinball.launch";
const MISS_MUSIC = "music_word_codeword";
for (const id of [MISS_CUE, MISS_ARCADE, MISS_MUSIC]) MISSING.add(testUrl(id));

const sound = await import("../src/lib/sound");
const { roundMusicFor } = await import("../src/lib/fx/theme");
const { PUZZLE_REGISTRY } = await import("../src/lib/duel/registry");
const settle = () => new Promise((resolve) => setTimeout(resolve, 15));
sound.unlockAudio();
// Wait for the first-tap preload (effects and voice) to finish.
const preloadIds = ids.filter((id) => manifest[id]!.url && manifest[id]!.channel !== "music");
for (let i = 0; i < 400; i++) {
  const d = sound.soundDiagnostics();
  if (preloadIds.every((id) => d.loaded.includes(id) || d.failed.includes(id))) break;
  await settle();
}
sound.installSoundCueBridge();
const dispatch = (cue: string) =>
  target.dispatchEvent(new CustomEvent(SOUND_CUE_EVENT, { detail: { cue } }));
const take = () => started.splice(0, started.length);

// Named cues through the listener.
const named = rows.filter(
  (r) =>
    r.slot &&
    !r.where.endsWith("[arcade.md]") &&
    r.category !== "music" &&
    slotIds.includes(r.slot) &&
    !placeholderSlots.includes(r.slot),
);
let namedPlayed = 0;
for (const row of named) {
  take();
  const cue = row.cue.startsWith("*.") ? `hover${row.cue.slice(1)}` : row.cue;
  dispatch(cue);
  const got = take();
  if (row.slot === MISS_CUE)
    check(got.length === 0, `${cue}: a 404 file must leave the cue silent`);
  else {
    check(
      got.length === 1 && got[0]!.url === testUrl(row.slot),
      `${cue}: its file did not play through the duelz-sound listener`,
    );
    namedPlayed++;
  }
}
// A game's own replay slot wins over the shared *.final slot.
take();
dispatch("orbit.final-second");
check(
  take()[0]?.url === testUrl("*.final-second"),
  "orbit.final-second plays the shared *.final-second slot",
);

// Arcade moments: own file at normal speed instead of the shared sound. The shared sound each
// one plays without its own file is arcade.md's "plays today".
const arcadeFallback = new Map(
  readDocRows()
    .filter((r) => r.file === "arcade.md")
    .map((r) => [
      r.cells.cue!,
      (r.cells["plays today"] ?? "").replace(/`/g, "").trim().split(/\s/)[0]!,
    ]),
);
const sharedOf = (cue: string) =>
  arcadeFallback.get(cue) || rows.find((r) => r.cue === cue)!.fileToday.replace(" (shared)", "");
const fileOf = (id: string) => manifest[id]!.url!;
let arcadePlayed = 0;
for (const cue of arcadeCues) {
  const row = rows.find((r) => r.cue === cue)!;
  const shared = sharedOf(cue);
  take();
  if (row.perRound === "loop") {
    sound.ensureSlotLoop(cue as never, shared as never, 0.2);
    const got = take();
    check(
      got.length === 1 && got[0]!.url === testUrl(cue) && got[0]!.loop,
      `${cue}: its loop did not replace ${shared}`,
    );
    sound.stopSlotLoop(cue as never, shared as never, 0);
    arcadePlayed++;
    continue;
  }
  sound.playSlotOr(cue as never, shared as never, 0.8, 1.3, true);
  const got = take();
  if (cue === MISS_ARCADE)
    check(
      got.length === 1 && got[0]!.url === fileOf(shared) && got[0]!.rate === 1.3,
      `${cue}: a 404 file must fall back to ${shared} at its old speed`,
    );
  else {
    check(
      got.length === 1 && got[0]!.url === testUrl(cue) && got[0]!.rate === 1,
      `${cue}: its file did not replace ${shared} at normal speed`,
    );
    arcadePlayed++;
  }
}
take();
sound.playSlotOr("beat.note", "arc_retro_note", 0.8, 1.5, true, true);
check(take()[0]?.rate === 1.5, "beat.note keeps its lane pitch on its own file");

// Placeholders.
take();
check(
  sound.playCueSlot("chain.linkTone", 1, 2) && take()[0]?.rate === 2,
  "chain.linkTone plays its file at the climbing pitch",
);

// Music: every game's own slot is chosen and plays as the round bed; every screen slot plays.
let musicGames = 0;
for (const [type, def] of Object.entries(PUZZLE_REGISTRY)) {
  const slot = def.category === "arcade" ? `music_${type}` : `music_${def.category}_${type}`;
  // Tempo's track is tick-locked to its chart (syncBeatTrack, checked below), never the round bed.
  if (!manifest[slot] || type === "beat") continue;
  check(
    roundMusicFor(type as never, def.category) === slot,
    `${type}: roundMusicFor ignores ${slot}`,
  );
  musicGames++;
}
take();
sound.syncRoundMusic({
  key: "check",
  track: roundMusicFor("pinball", "arcade"),
  on: true,
  remainingMs: 60_000,
  reason: "",
});
await settle();
check(
  take().some((s) => s.url === testUrl("music_pinball") && s.loop),
  "Pinball's own bed plays as its round music",
);
sound.leaveRoundMusic("check");
for (const slot of screenSlots) {
  check(sound.screenMusic(slot as never) === slot, `${slot}: screenMusic ignores its file`);
  // As on the real screens, the previous bed has stopped before this one starts.
  sound.stopMusic(0);
  take();
  sound.startMusic(slot as never);
  await settle();
  check(
    take().some((s) => s.url === testUrl(slot) && s.loop),
    `${slot}: did not play`,
  );
}
sound.stopMusic(0);
// A game's own bed whose file is missing: no error, the round is silent.
take();
sound.syncRoundMusic({
  key: "check-miss",
  track: roundMusicFor("codeword", "word"),
  on: true,
  remainingMs: 60_000,
  reason: "",
});
await settle();
check(take().length === 0, "a 404 music slot leaves the round silent");
sound.leaveRoundMusic("check");

// Tempo's track (sound batch 4): tick-locked to the chart, the synth until it has decoded. Phone notes
// (27 Oct 2026): decoded during the intro, played from the run's first tick, looping its full groove
// (file seconds 8–56; the first beat on the groove's first downbeat), louder.
check(!sound.beatTrackReady(), "Tempo's track is not ready before it loads (the synth plays)");
sound.prepareBeatTrack();
await settle();
check(sound.beatTrackReady(), "Tempo's track loads during the intro (prepareBeatTrack)");
check(take().length === 0, "Preparing Tempo's track plays nothing");
const clock = fakeContexts.at(-1)!;
clock.currentTime = 10;
sound.syncBeatTrack(-2, 75_000);
let beatStarts = take();
check(
  beatStarts.length === 1 && beatStarts[0]!.url === testUrl("music_beat") && Math.abs(beatStarts[0]!.offset! - 54) < 1e-9 &&
    beatStarts[0]!.loop && beatStarts[0]!.loopStart === 8 && beatStarts[0]!.loopEnd === 56,
  "Tempo's track starts on the run's first tick on the groove's last bar, once, looping the groove (8–56 s)",
);
clock.currentTime = 10.02;
sound.syncBeatTrack(-2 + 1 / 60, 75_000);
check(take().length === 0, "Tempo's track within 40 ms of the chart is left alone");
clock.currentTime = 12;
sound.syncBeatTrack(0, 73_000);
check(take().length === 0, "Tempo's track reaches the first beat on the groove's first downbeat (wrapped, not restarted)");
clock.currentTime = 12.02;
sound.syncBeatTrack(4 / 60, 73_000);
beatStarts = take();
check(
  beatStarts.length === 1 && Math.abs(beatStarts[0]!.offset! - (8 + 4 / 60)) < 1e-9 && beatStarts[0]!.loop,
  "Tempo's track drifting past 40 ms jumps back to the chart's position",
);
clock.currentTime = 12.02 + 48;
sound.syncBeatTrack(48 + 4 / 60, 25_000);
check(take().length === 0, "Tempo's track loops past the file's groove end on the chart's clock (a 75 s song)");
check(
  sound.beatTrackLevel(75_000) === sound.BEAT_TRACK_LEVEL_FLOOR && sound.BEAT_TRACK_LEVEL_FLOOR >= 0.9 && sound.beatTrackLevel(0) === 1,
  "Tempo's track plays at 0.9 rising to 1 at the end (louder than the arcade ramp's 0.5)",
);
sound.syncBeatTrack(null, 0);
sound.syncBeatTrack(null, 0);
check(take().length === 0, "Tempo's track stops at the end of the run");
sound.stopBeatTrack(true);
check(!sound.beatTrackReady(), "Tempo's track is released when its stage goes away");
sound.syncBeatTrack(null, 75_000);
await settle();
check(sound.beatTrackReady(), "Tempo's track still loads on the stage's first frame without an intro");
check(take().length === 0, "Tempo's track stays quiet until the run starts");
sound.stopBeatTrack(true);
clock.currentTime = 0;

// Play caps (arcade-gaps-oct-2026.md section 3): a second play inside a slot's gap is dropped, the
// voices limit holds, and both apply to the shared sound a slot without a file plays.
type Capped = Entry & { gapMs?: number; voices?: number; rate?: number };
const capped = manifest as unknown as Record<string, Capped>;
for (const [cue, gap, voices] of [
  ["wavefront.fire", 120, 2],
  ["breaker.brickHit", 50, 3],
  ["burst.shot", 70, 2],
  ["burst.hit", 50, 3],
  ["cross.hop", 90, 0],
  ["whack.popUp", 120, 0],
] as const) {
  check(capped[cue]?.gapMs === gap && (capped[cue]?.voices ?? 0) === voices, `${cue}: cap is not ${gap} ms / ${voices} voices`);
}
// Sound batch 4: the soft green bolt at slot volume 0.6 (0.36 with the call's 0.6).
check(capped["wavefront.fire"]!.volume! * 0.6 > 0.35 && capped["wavefront.fire"]!.volume! * 0.6 < 0.37, "wavefront.fire plays at 0.36");
sound.resetPlayCaps();
take();
sound.playSlotOr("wavefront.fire" as never, "arc_blaster" as never, 0.6, 1, true);
sound.playSlotOr("wavefront.fire" as never, "arc_blaster" as never, 0.6, 1, true);
check(take().length === 1, "wavefront.fire: a second shot inside 120 ms is dropped");
take();
dispatch("whack.popUp");
dispatch("whack.popUp");
check(take().length === 1, "whack.popUp: a second pop-up inside 120 ms is dropped (named cue)");
await new Promise((resolve) => setTimeout(resolve, 130));
dispatch("whack.popUp");
check(take().length === 1, "whack.popUp: plays again once its gap has passed");
// A slot's own rate: the row drop plays the march recording lower.
take();
dispatch("wavefront.rowDrop");
check(take()[0]?.rate === capped["wavefront.rowDrop"]!.rate, "wavefront.rowDrop plays at its slot's rate");
// A cue's own per-play rate (Fission's floor bounce pitched by atom size).
take();
target.dispatchEvent(new CustomEvent(SOUND_CUE_EVENT, { detail: { cue: "burst.atomBounce", rate: 1.25 } }));
check(take()[0]?.rate === 1.25, "burst.atomBounce keeps its per-play pitch");
// Batch 3's loops: on their own file, looping, and stopped by stopCueLoop.
for (const cue of ["wavefront.danger", "swing.lava", "cross.traffic", "inkbridge.coinRoll"]) {
  check(!!capped[cue]?.loop, `${cue}: manifest slot must be a loop`);
  take();
  sound.ensureCueLoop(cue, 0.3);
  const got = take();
  check(got.length === 1 && got[0]!.loop && got[0]!.url === testUrl(cue), `${cue}: did not loop on its own file`);
  sound.stopCueLoop(cue, 0);
}
sound.resetPlayCaps();

// Unset slots keep today's behaviour exactly.
for (const id of slotIds) manifest[id]!.url = null;
take();
for (const row of named) dispatch(row.cue);
check(take().length === 0, "with no files, named cues stay silent");
for (const cue of arcadeCues.filter((c) => rows.find((r) => r.cue === c)!.perRound !== "loop")) {
  sound.playSlotOr(cue as never, sharedOf(cue) as never, 0.7, 1.1, true);
  const got = take();
  check(
    got.length === 1 && got[0]!.url === fileOf(sharedOf(cue)) && got[0]!.rate === 1.1,
    `${cue}: without a file it must play ${sharedOf(cue)} as before`,
  );
}
check(
  !sound.playCueSlot("chain.breakTone"),
  "chain.breakTone without a file leaves the tone to its caller",
);
check(
  roundMusicFor("pinball", "arcade") === "music_rally",
  "Pinball keeps Rally's bed without its own file",
);
check(roundMusicFor("beat", "arcade") === null, "Tempo never gets a round bed (its track is tick-locked)");
check(
  roundMusicFor("tiles", "pattern") === "music_pattern_1",
  "Jumbled keeps its shared bed without its own file",
);
for (const slot of screenSlots)
  check(sound.screenMusic(slot as never) === null, `${slot}: silent without a file`);
check(tones === 0, `slots never beep (${tones} tones)`);
check(errors.length === 0, `no console errors (${errors.map((e) => String(e[0])).join("; ")})`);
check(warns.length <= 1, "a missing file logs at most one warning");

console.error = realError;
console.warn = realWarn;
for (const note of notes) console.log(note);
console.log(
  `sound-manifest-check: ${rows.length} cue-sheet rows, ${ids.length} manifest entries (${slotIds.length} named slots); ` +
    `${namedPlayed} named cues, ${arcadePlayed} arcade moments, ${musicGames} game music slots and ${screenSlots.length} screen slots play their file; ${passes} assertions.`,
);
if (failures.length) {
  for (const f of failures.slice(0, 60)) console.log(`FAIL ${f}`);
  console.log(`FAIL sound-manifest-check: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log("PASS sound-manifest-check");
process.exit(0);
