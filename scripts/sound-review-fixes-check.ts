/**
 * sound-review-fixes-check (15 Nov 2026, the November game reviews' sound findings; docs/sound-cues/review-nov-2026.md).
 *
 *  1. ONE sound on solve: a puzzle's own solve or finish cue (`<game>.solve` / `.finish`) that plays from its file
 *     leaves out the generic `correct` / `lock` / `complete` of the same moment, whichever comes first (Hanoi, Box Six,
 *     Colour Flood… played both); a solve cue without a file keeps the generic sound (Safe Cracker's `safe.solve`).
 *  2. Every wrong-move shake sounds the quiet `wrong`, once: puzzleReject (the shared shake, and the paint that catches
 *     every game's own `animate-shake`, which passed `sound = false` and so left Shikaku, Tents, Trail, Gridlock and
 *     Tessellate silent) plays `wrong` at REJECT_WRONG_VOLUME; with the game's own `wrong` before or after it, one
 *     plays; a shake marked `[data-quiet-shake]` stays silent; Tenfall's refused tile plays it in place of the tick.
 *  3. Missing sounds: every effect slot a live game plays that had no file of its own (url null, so a library stand-in
 *     or nothing) has a new file behind NEW_GAME_SOUNDS (src/config/soundConfig.ts), or a reason in EXEMPT. The files:
 *     mono MPEG-1 Layer III at 44.1 kHz with a readable gapless tag, small, levelled near their length's library
 *     median with true peaks at -1 dBFS or under, each slot loading with its own game (never on the first tap).
 *     With the switch off (the default) the manifest is exactly as written and the cues play what they did; with it
 *     on (applyNewGameSounds, as manifest.ts does) every new slot plays its file, puzzle cues in place of the shared
 *     sound of the moment (`move`, Ballpark's tick + place + move, Double Take's `correct`), arcade moments in place
 *     of their library sound, loops as loops; and the one-sound rule then uses the new files.
 *
 *   bun scripts/sound-review-fixes-check.ts
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { NEW_GAME_SOUNDS } from "../src/config/soundConfig";
import { SOUND_MANIFEST } from "../src/lib/fx/manifest";
import { NEW_GAME_SOUND_FILES, NEW_GAME_SOUND_RECORDINGS, NEW_GAME_SOUND_REPLACES, applyNewGameSounds } from "../src/lib/fx/newGameSounds";
import { SOUND_CUE_EVENT } from "../src/lib/fx/soundCues";
import { PUZZLE_TYPES, RETIRED_TYPES, puzzleInfo } from "../src/lib/duel/catalogue";
import { readMp3Gapless, MP3_DECODER_DELAY } from "../src/lib/mp3Gapless";
import type { PuzzleType } from "../src/lib/duel/types";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}

type Entry = { channel: string; url: string | null; ms: number; loop?: boolean; frequency: number };
const manifest = SOUND_MANIFEST as unknown as Record<string, Entry>;
const newUrls = new Set(Object.values(NEW_GAME_SOUND_FILES).map((f) => f.url));
const prefixOf = (slot: string) => /^([a-z0-9]+)[._]/.exec(slot)?.[1] ?? "";
const games = new Set<string>(PUZZLE_TYPES);
const live = (g: string) => games.has(g) && !RETIRED_TYPES.has(g as PuzzleType);
const isArcade = (slot: string) => puzzleInfo(prefixOf(slot) as PuzzleType).category === "arcade";

/* ---------------------------------------------------------------- 3a. the switch and the manifest as written */

check(NEW_GAME_SOUNDS === false, "NEW_GAME_SOUNDS must default to false (src/config/soundConfig.ts)");
for (const slot of Object.keys(NEW_GAME_SOUND_FILES)) {
  const e = manifest[slot];
  check(!!e, `${slot}: a new sound for a slot the manifest doesn't have`);
  if (!e) continue;
  // Off: the entry is exactly as manifest.ts writes it (no file); on: its new file.
  // Safe Cracker's and Gridlock's solve slots play the game's existing recording with the switch off (15 Nov 2026);
  // their new files are placeholders for when it is on.
  const LIVE_RECORDING: Record<string, string> = { "safe.solve": "/sounds/pz_safe_open.mp3", "unblock.solve": "/sounds/pz_car_escape.mp3" };
  if (!NEW_GAME_SOUNDS) check(e.url === (LIVE_RECORDING[slot] ?? null), `${slot}: with NEW_GAME_SOUNDS off the manifest must keep its entry (${LIVE_RECORDING[slot] ?? "url null"}; has ${e.url})`);
  check(e.channel === "effects" && e.frequency === 0, `${slot}: an effects slot that never beeps`);
  check(Boolean(e.loop) === NEW_GAME_SOUND_FILES[slot]!.loop, `${slot}: the recording's loop flag must match the slot's`);
  check(live(prefixOf(slot)), `${slot}: not a live (unretired) game's slot`);
}
// No manifest URL names a new file unless the switch is on (one file per recording, the slot's own).
for (const [id, e] of Object.entries(manifest))
  if (e.url && newUrls.has(e.url)) check(NEW_GAME_SOUNDS && !!NEW_GAME_SOUND_FILES[id], `${id}: points at a new file outside the switch`);

/* ---------------------------------------------------------------- 3b. the files */

const ONE_SHOT_MAX_BYTES = 15_000;
const LOOP_MAX_BYTES = 32_000;
const recordedSlots = new Set<string>();
for (const r of NEW_GAME_SOUND_RECORDINGS) {
  const path = `public/sounds/${r.file}`;
  check(existsSync(path), `${path}: missing (python3 -I scripts/sound-review-nov-2026/make.py)`);
  if (!existsSync(path)) continue;
  const bytes = new Uint8Array(readFileSync(path));
  check(bytes.length === r.bytes, `${r.file}: ${bytes.length} bytes, the data file says ${r.bytes} (re-run make.py)`);
  check(bytes.length <= (r.loop ? LOOP_MAX_BYTES : ONE_SHOT_MAX_BYTES), `${r.file}: ${bytes.length} bytes, over the size aim`);
  const tag = readMp3Gapless(bytes);
  check(!!tag && tag.sampleRate === 44100 && tag.frameSamples === 1152, `${r.file}: not a tagged 44.1 kHz MPEG-1 Layer III file`);
  // Mono: the first frame's channel mode is 3.
  let at = 0;
  while (at < bytes.length - 4 && !(bytes[at] === 0xff && (bytes[at + 1]! & 0xe0) === 0xe0)) at++;
  check(bytes[at + 3]! >> 6 === 3, `${r.file}: must be mono`);
  if (tag) {
    const exactMs = ((tag.frames * tag.frameSamples - tag.delay - tag.padding - MP3_DECODER_DELAY) / tag.sampleRate) * 1000;
    check(Math.abs(exactMs - r.ms) <= 27, `${r.file}: ms ${r.ms} is not the file's exact length (${exactMs.toFixed(0)})`);
  }
  check(r.truePeak <= -1, `${r.file}: true peak ${r.truePeak} dBFS, over -1`);
  // Levelled to the library median for its length (docs/sound-cues/levels-nov-2026.md): never over it by more than
  // 1 dB, and short of it only as the house allows for a sharp attack (at most 4.5 dB).
  check(r.lufs <= r.target + 1 && r.lufs >= r.target - 4.5, `${r.file}: ${r.lufs} LUFS against its target ${r.target}`);
  check(r.what.length > 10, `${r.file}: say what it sounds like`);
  for (const slot of r.slots) {
    check(!recordedSlots.has(slot), `${slot}: in two recordings`);
    recordedSlots.add(slot);
  }
  // One file per recording: a file for one slot is named after it.
  if (r.slots.length === 1) check(r.file === `${r.slots[0]}.mp3`, `${r.file}: a one-slot file is named after its slot`);
}
// Every new file in public/sounds is in the data (nothing made and left unlisted).
const makeSource = readFileSync("scripts/sound-review-nov-2026/make.py", "utf8");
const recipeFiles = [...makeSource.matchAll(/^@sound\("([^"]+)"/gm)].map((m) => `${m[1]}.mp3`);
check(recipeFiles.length === NEW_GAME_SOUND_RECORDINGS.length, `make.py has ${recipeFiles.length} recipes, the data ${NEW_GAME_SOUND_RECORDINGS.length} recordings`);
for (const f of recipeFiles) check(NEW_GAME_SOUND_RECORDINGS.some((r) => r.file === f), `${f}: a recipe with no recording in the data`);

/* ---------------------------------------------------------------- 3c. every played key without a file is covered */

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}
const SKIP = /fx\/manifest\.ts$|fx\/newGameSounds(\.data)?\.ts$|design\/SoundsGallery\.tsx$/;
const text = walk("src")
  .filter((f) => !SKIP.test(f))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");
const solveTemplate = new Set([...text.matchAll(/useSolveFx\(\s*"([a-z0-9]+)"/g)].map((m) => `${m[1]}.solve`));
const played = (id: string) => text.includes(`"${id}"`) || text.includes(`'${id}'`) || solveTemplate.has(id);
/** Played keys with no file of their own that keep it so, and why. */
const ATTENTION_ELEVENLABS = "waits for Joe's recording (docs/sound-cues/attention-elevenlabs.md); plays its library stand-in until then";
const EXEMPT: Record<string, string> = {
  "laser.gem": "Lightbender's gem plays its own pz_laser_gem recording on the same beam step",
  // Changed with Joe's approval, 15 Nov 2026 (routine consequence of the Pattern overhaul): gravity.tilt now has a
  // file of its own (the library's marble roll, looped while the balls move), so it no longer needs an exemption.
  "clayshoot.shatter": "Pull!'s clay plays its own pz_clay_hit recording",
  "clayshoot.goldShatter": "Pull!'s gold clay plays its own pz_clay_hit recording",
  "clayshoot.goldSparkle": "the tail of clayshoot.finalBurst is still sounding (silent by design)",
  "checkout.tick": "Checkout's dart already lands on its own checkout.thud recording",
  "spotdiff.miss": "a wrong-move shake: the quiet wrong (job 2's rule)",
  "measure.reject": "a wrong-move shake: the quiet wrong (job 2's rule)",
  "tendrop.refused": "a wrong-move shake: the quiet wrong (job 2's rule; it played the tap tick)",
  "equation.advance": "a stage moment: keeps the shared stage_complete (one sound for every stage game, a decision for Joe)",
  "numline.line": "a stage moment: keeps the shared stage_complete (one sound for every stage game, a decision for Joe)",

  // Changed with Joe's approval, 15 Nov 2026 (routine consequence of the Attention overhaul): the overhaul's new slots
  // play their library stand-in (attentionFx.ts) until Joe's ElevenLabs files land.
  "countup.mark": ATTENTION_ELEVENLABS,
  "countup.unmark": ATTENTION_ELEVENLABS,
  "countup.key": ATTENTION_ELEVENLABS,
  "countup.trayOut": ATTENTION_ELEVENLABS,
  "countup.revealTick": ATTENTION_ELEVENLABS,
  "countup.soClose": ATTENTION_ELEVENLABS,
  "symscan.gridClear": ATTENTION_ELEVENLABS,
  "symscan.cleanGrid": ATTENTION_ELEVENLABS,
  "symscan.missed": ATTENTION_ELEVENLABS,
  "spotdiff.hidden": ATTENTION_ELEVENLABS,
  "spotdiff.pictureOut": ATTENTION_ELEVENLABS,
  "maze.step": ATTENTION_ELEVENLABS,
  "maze.bump": ATTENTION_ELEVENLABS,
  "maze.back": ATTENTION_ELEVENLABS,
  "maze.deadEnd": ATTENTION_ELEVENLABS,
  "bomb.step": ATTENTION_ELEVENLABS,
  "bomb.instant": ATTENTION_ELEVENLABS,
  "pairmatch.flip": ATTENTION_ELEVENLABS,
  "pairmatch.match": ATTENTION_ELEVENLABS,
  "pairmatch.miss": ATTENTION_ELEVENLABS,
  "pairmatch.gold": ATTENTION_ELEVENLABS,
};
const needed: string[] = [];
for (const [id, e] of Object.entries(manifest)) {
  if (e.channel !== "effects") continue;
  const noFile = e.url === null || newUrls.has(e.url);
  if (!noFile || !live(prefixOf(id)) || !played(id)) continue;
  needed.push(id);
  check(!!NEW_GAME_SOUND_FILES[id] || !!EXEMPT[id], `${id}: a live game plays it and it has no file of its own (add a recipe to make.py or a reason to EXEMPT)`);
}
for (const id of Object.keys(EXEMPT)) {
  check(!!manifest[id] && manifest[id]!.url === null && played(id), `EXEMPT ${id}: no longer a played slot without a file`);
  check(!NEW_GAME_SOUND_FILES[id], `EXEMPT ${id}: also has a new file`);
}
for (const slot of Object.keys(NEW_GAME_SOUND_FILES)) check(played(slot), `${slot}: a new file for a slot nothing plays`);
check(needed.length >= 90, `only ${needed.length} played slots without a file found: the enumeration lost its way`);

/* ---------------------------------------------------------------- 3d. puzzle cues name what they replace */

const gameSounds = readFileSync("src/lib/fx/gameSounds.ts", "utf8");
for (const slot of Object.keys(NEW_GAME_SOUND_FILES)) {
  if (isArcade(slot)) {
    // Arcade moments go through their slot (sfx / ensureSlotLoop / retroStart / toy*): the file replaces the library.
    check(new RegExp(`\\("${slot.replace(".", "\\.")}"`).test(gameSounds), `${slot}: an arcade slot gameSounds.ts never plays`);
    check(!NEW_GAME_SOUND_REPLACES[slot], `${slot}: an arcade slot needs no REPLACES (its file replaces the library sound)`);
  } else check(!!NEW_GAME_SOUND_REPLACES[slot]?.length || /^[a-z0-9]+\.(solve|finish)$/.test(slot), `${slot}: a puzzle cue must say which shared sound it replaces (a solve cue replaces the generic solve sounds)`);
}
for (const slot of Object.keys(NEW_GAME_SOUND_REPLACES)) check(!!NEW_GAME_SOUND_FILES[slot], `REPLACES ${slot}: no new file`);

/* ---------------------------------------------------------------- 2 (static). the shake paths */

const rejections = readFileSync("src/components/puzzles/usePuzzleRejections.ts", "utf8");
check(/animate-shake[\s\S]*puzzleReject\(node/.test(rejections), "usePuzzleRejections no longer sends every game's own shake through puzzleReject");
const rejectSrc = readFileSync("src/lib/fx/puzzleReject.ts", "utf8");
check(/playRejectWrong\(\)/.test(rejectSrc) && !/shared\.reject/.test(rejectSrc.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "")), "puzzleReject must sound the quiet wrong, never shared.reject");
const tenDrop = readFileSync("src/puzzles/tenDrop.tsx", "utf8");
check(/seenRefused = s\.refused;[\s\S]{0,200}playRejectWrong\(\)/.test(tenDrop), "Tenfall's refused tile must play the quiet wrong");

/* ---------------------------------------------------------------- behavioural (stubbed Web Audio) */

interface FakeBuffer { duration: number; length: number; numberOfChannels: number; sampleRate: number; url: string; getChannelData: () => Float32Array }
interface Started { url: string; loop: boolean; volume: number; stopped: boolean }
const started: Started[] = [];
const param = () => {
  const p = {
    value: 1,
    setValueAtTime(v: number) { p.value = v; },
    linearRampToValueAtTime(v: number) { p.value = v; },
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
    cancelScheduledValues() {},
  };
  return p;
};
const node = () => ({ connect(next: unknown) { return next ?? node(); }, disconnect() {} });
class FakeContext {
  state = "running";
  currentTime = 0;
  sampleRate = 48000;
  destination = node();
  createGain() {
    return { ...node(), gain: param() };
  }
  createBiquadFilter() { return { ...node(), frequency: param(), type: "" }; }
  createOscillator() { return { ...node(), frequency: param(), type: "", start() {}, stop() {} }; }
  createBuffer(_c: number, length: number, sampleRate: number) {
    return { duration: length / sampleRate, length, numberOfChannels: 1, sampleRate, url: "", getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    let gainNode: { gain: { value: number } } | null = null;
    let record: Started | null = null;
    const source = {
      buffer: null as FakeBuffer | null,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      playbackRate: param(),
      onended: null,
      connect(next: { gain?: { value: number } }) { if (next?.gain) gainNode = next as { gain: { value: number } }; return next; },
      disconnect() {},
      start() {
        if (source.buffer?.url) {
          record = { url: source.buffer.url, loop: source.loop, volume: gainNode?.gain.value ?? 1, stopped: false };
          started.push(record);
        }
      },
      stop() { if (record) record.stopped = true; },
    };
    return source;
  }
  decodeAudioData(bytes: ArrayBuffer): Promise<FakeBuffer> {
    const url = new TextDecoder().decode(bytes);
    const data = new Float32Array(4800).fill(0.5);
    return Promise.resolve({ duration: 0.1, length: 4800, numberOfChannels: 1, sampleRate: 48000, url, getChannelData: () => data });
  }
  resume() { return Promise.resolve(); }
  suspend() { return Promise.resolve(); }
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
  document: { visibilityState: "visible", addEventListener() {}, removeEventListener() {}, querySelector: () => null },
  fetch: async (url: string) => ({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(url).buffer }),
});
const realWarn = console.warn;
console.warn = () => {};

const sound = await import("../src/lib/sound");
const { puzzleReject } = await import("../src/lib/fx/puzzleReject");
const settle = () => new Promise((resolve) => setTimeout(resolve, 15));
async function loadEverything(): Promise<void> {
  sound.loadAllSounds();
  const want = Object.keys(manifest).filter((id) => manifest[id]!.url && manifest[id]!.channel !== "music");
  for (let i = 0; i < 400; i++) {
    const d = sound.soundDiagnostics();
    if (want.every((id) => d.loaded.includes(id) || d.failed.includes(id))) return;
    await settle();
  }
}
sound.unlockAudio();
await loadEverything();
sound.installSoundCueBridge();
const dispatch = (cue: string) => target.dispatchEvent(new CustomEvent(SOUND_CUE_EVENT, { detail: { cue } }));
const take = () => started.splice(0, started.length);
const heard = (got: Started[]) => got.filter((s) => !s.stopped).map((s) => s.url);
const fresh = async () => {
  await new Promise((resolve) => setTimeout(resolve, sound.MOMENT_MS + 30));
  sound.resetMomentHolds();
  sound.resetPlayCaps();
  take();
};
const url = (id: string) => manifest[id]!.url;

// 1. One sound on solve (switch off: the existing solve files).
check(sound.isOwnSolveCue("tower.solve") && sound.isOwnSolveCue("codeword.finish"), "tower.solve / codeword.finish are puzzles' own solve cues");
check(!sound.isOwnSolveCue("racing.finish") && !sound.isOwnSolveCue("lightup.clear"), "an arcade finish or a cell clear is no solve cue");
for (const [cue, generic] of [["tower.solve", "correct"], ["sudoku.solve", "correct"], ["flood.solve", "lock"], ["nonogram.solve", "lock"], ["kakuro.solve", "correct"], ["safe.solve", "lock"], ["unblock.solve", "correct"]] as const) {
  check(!!url(cue), `${cue}: has a file (its own solve sound)`);
  await fresh();
  dispatch(cue);
  sound.playSound(generic as never);
  check(JSON.stringify(heard(take())) === JSON.stringify([url(cue)]), `${cue} then ${generic}: only the game's own solve sound plays`);
  await fresh();
  sound.playSound(generic as never);
  sound.playLock();
  dispatch(cue);
  check(JSON.stringify(heard(take())) === JSON.stringify([url(cue)]), `${generic} + lock then ${cue}: the generic ones are faded out, the game's own plays`);
}
// Safe Cracker's opening and Gridlock's drive-out (15 Nov 2026, Joe: one sound on opening): their recordings play through
// the solve cue's slot, never straight from the game, so they stand in for the generic sounds of that moment.
check(url("safe.solve") === "/sounds/pz_safe_open.mp3" && url("unblock.solve") === "/sounds/pz_car_escape.mp3", "safe.solve / unblock.solve play the opening and drive-out recordings (switch off)");
check(!/playSound\("pz_safe_open"\)/.test(readFileSync("src/puzzles/safeCracker.tsx", "utf8")), "Safe Cracker no longer plays pz_safe_open beside its solve cue");
check(!/playSound\("pz_car_escape"\)/.test(readFileSync("src/components/puzzles/UnblockPuzzle.tsx", "utf8")), "Gridlock no longer plays pz_car_escape beside its solve cue");
await fresh();
sound.playCorrect();
check(heard(take()).length === 1, "a correct with no solve cue around it plays as before");

// 2. Every shake sounds the quiet wrong, once.
const el = (quiet = false) => ({
  setAttribute() {},
  removeAttribute() {},
  animate() {},
  closest: (sel: string) => (quiet && sel === "[data-quiet-shake]" ? {} : null),
});
await fresh();
puzzleReject(el() as never, false);
let got = take();
check(heard(got).length === 1 && got[0]!.url === url("wrong") && Math.abs(got[0]!.volume - sound.REJECT_WRONG_VOLUME) < 1e-9,
  "a shake passed sound=false (every game's own animate-shake) plays the quiet wrong");
await fresh();
puzzleReject(el() as never);
check(JSON.stringify(heard(take())) === JSON.stringify([url("wrong")]), "puzzleReject plays wrong, never shared.reject");
await fresh();
sound.playWrong();
puzzleReject(el() as never, false);
check(heard(take()).length === 1, "the game's wrong then its shake: one wrong");
await fresh();
puzzleReject(el() as never);
sound.playWrong();
got = take();
check(heard(got).length === 1 && got[0]!.volume === sound.REJECT_WRONG_VOLUME, "the shake then the game's wrong: one (quiet) wrong");
await fresh();
puzzleReject(el(true) as never);
check(heard(take()).length === 0, "a shake inside [data-quiet-shake] stays silent");
await fresh();
sound.playWrong();
sound.playWrong();
// (A second play of a slot restarts it, as before: both start.)
check(take().length === 2, "two of a game's own wrongs are untouched");
await fresh();
sound.playRejectWrong();
await new Promise((resolve) => setTimeout(resolve, sound.WRONG_ONCE_MS + 30));
sound.playRejectWrong();
check(take().length === 2, "two shakes apart each sound");

// 2b. The paint that catches every game's own CSS shake (usePuzzleRejections, mounted by PhoneShell on puzzle screens):
// Shikaku's board, Tents' and Trail's squares and Safe Cracker's door take `animate-shake`; each new shake sounds the
// quiet wrong once (Safe Cracker's own playWrong first: still one).
{
  const { Window } = await import("happy-dom");
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { act } = await import("react");
  const { usePuzzleRejections } = await import("../src/components/puzzles/usePuzzleRejections");
  const hd = new Window();
  Object.assign(globalThis, { MutationObserver: hd.MutationObserver, IS_REACT_ACT_ENVIRONMENT: true });
  const container = hd.document.createElement("div");
  hd.document.body.appendChild(container);
  function Stage() {
    const ref = React.useRef<HTMLDivElement | null>(null);
    usePuzzleRejections(ref, true, "shikaku");
    return React.createElement("div", { ref }, React.createElement("div", { "data-game-stage": "" },
      React.createElement("div", { id: "board", className: "logic-square" }),
      React.createElement("div", { id: "cell", className: "camp-cell" })));
  }
  const root = createRoot(container as unknown as Element);
  await act(async () => root.render(React.createElement(Stage)));
  const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
  const board = container.querySelector("#board")!;
  const cell = container.querySelector("#cell")!;
  await fresh();
  board.className = "logic-square animate-shake";
  await tick();
  got = take();
  check(heard(got).length === 1 && got[0]!.url === url("wrong") && got[0]!.volume === sound.REJECT_WRONG_VOLUME,
    "a game's own CSS shake (Shikaku's board) sounds the quiet wrong");
  await fresh();
  sound.playWrong();
  cell.className = "camp-cell animate-shake";
  await tick();
  check(heard(take()).length === 1, "a game that plays wrong and shakes (Safe Cracker): one wrong");
  // (puzzleReject paints one target at most every 340 ms.)
  await new Promise((resolve) => setTimeout(resolve, 360));
  await fresh();
  cell.className = "camp-cell";
  await tick();
  cell.className = "camp-cell animate-shake";
  await tick();
  check(heard(take()).length === 1, "the next shake of the same square sounds again, once");
  await act(async () => root.unmount());
}

// 3, switch off: a new slot's cue changes nothing (no file; the move tick plays as before).
await fresh();
dispatch("sudoku.place");
sound.playSound("move");
check(JSON.stringify(heard(take())) === JSON.stringify([url("move")]), "switch off: sudoku.place plays nothing new, move as before");
await fresh();
sound.playSlotOr("hover.gate", "arc_retro_note", 1);
check(JSON.stringify(heard(take())) === JSON.stringify([url("arc_retro_note")]), "switch off: Hover's gate keeps its library note");

// 3, switch on: as manifest.ts does with NEW_GAME_SOUNDS true.
const firstTapBefore = sound.firstTapSoundUrls().sort();
applyNewGameSounds(manifest as unknown as Record<string, { url: string | null; ms: number }>);
check(JSON.stringify(sound.firstTapSoundUrls().sort()) === JSON.stringify(firstTapBefore), "switch on: the first tap's sounds are unchanged (new files load with their games)");
for (const slot of Object.keys(NEW_GAME_SOUND_FILES)) {
  check(sound.soundSlotGame(slot) === prefixOf(slot), `${slot}: loads with its game, not on the first tap`);
  check(sound.gameSoundSlots(prefixOf(slot)).includes(slot as never), `${slot}: in its game's sounds once the switch is on`);
}
await loadEverything();
for (const [slot, replaces] of Object.entries(NEW_GAME_SOUND_REPLACES)) {
  const file = NEW_GAME_SOUND_FILES[slot]!.url;
  await fresh();
  dispatch(slot);
  for (const r of replaces) sound.playSound(r as never);
  check(JSON.stringify(heard(take())) === JSON.stringify([file]), `switch on: ${slot} plays its file and leaves out ${replaces.join(" + ")}`);
  await fresh();
  for (const r of replaces) sound.playSound(r as never);
  dispatch(slot);
  check(JSON.stringify(heard(take())) === JSON.stringify([file]), `switch on: ${replaces.join(" + ")} then ${slot}: only its file is heard`);
}
for (const slot of Object.keys(NEW_GAME_SOUND_FILES).filter(isArcade)) {
  const file = NEW_GAME_SOUND_FILES[slot]!;
  await fresh();
  if (file.loop) {
    sound.ensureSlotLoop(slot as never, "arc_marble_roll", 0.3);
    got = take();
    check(got.length === 1 && got[0]!.url === file.url && got[0]!.loop, `switch on: ${slot} loops its own file`);
    sound.stopSlotLoop(slot as never, "arc_marble_roll", 0);
  } else {
    sound.playSlotOr(slot as never, "arc_retro_note", 1);
    check(JSON.stringify(heard(take())) === JSON.stringify([file.url]), `switch on: ${slot} plays its file in place of the library sound`);
  }
}
await fresh();
dispatch("sudoku.place");
sound.playSound("move");
await new Promise((resolve) => setTimeout(resolve, sound.MOMENT_MS + 40));
sound.playSound("move");
check(heard(take()).length === 2, "switch on: a move after the moment has passed plays again");

console.warn = realWarn;
if (failures.length) {
  console.log(`sound-review-fixes-check: FAIL (${failures.length} failed, ${passes} passed)`);
  for (const f of failures.slice(0, 80)) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`sound-review-fixes-check: ${passes} checks passed (${needed.length} played slots without a file: ${Object.keys(NEW_GAME_SOUND_FILES).length} new, ${Object.keys(EXEMPT).length} exempt)`);
