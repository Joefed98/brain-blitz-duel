/**
 * Manifest-driven audio with separate effects, music and voice channels.
 * Effects use synthesized placeholders; music remains silent without files.
 *
 * Mobile rules that drive the shape of this file:
 *  - iOS only counts a gesture inside `touchend` / `click` / `pointerup`, so
 *    the context is created *synchronously* in those handlers and immediately
 *    given a one-sample silent buffer to play.
 *  - iOS suspends ("suspended") or interrupts ("interrupted") the context when
 *    the app is backgrounded or a call comes in, so we resume on
 *    visibilitychange, pageshow and every later touch.
 *  - Everything is decoded into AudioBuffers; no <audio>/new Audio() anywhere.
 *
 * Nothing plays and nothing errors before that first gesture, and every
 * failure is swallowed: sound is a nicety, never a failure.
 */

import { SOUND_MANIFEST, type SoundId } from "./fx/manifest";
import { SOUND_CUE_EVENT, type SoundCueDetail } from "./fx/soundCues";
import { devDisplayAllowed } from "./devDisplay";
import {
  changeChannelMuted,
  changeChannelVolume,
  readSoundSettings,
  roundMusicRamp,
  SOUND_SETTINGS_EVENT,
} from "./soundSettings";

const EVENT = SOUND_SETTINGS_EVENT;
export const DEFAULT_MUSIC_VOLUME = 1;
export const DEFAULT_EFFECTS_VOLUME = 1;
/** Preserve the existing music-bed bus level independently of its slider. */
const MUSIC_BED_LEVEL = 0.35;
const FANFARE_GAIN = 0.9 / 0.8;

export type Cue =
  | "player_joined"
  | "round_start"
  | "tick"
  | "correct"
  | "wrong"
  | "lock"
  | "round_won"
  | "podium_fanfare";

export type Track =
  | "lobby_loop"
  | "tension_loop"
  | "standings_loop"
  | "podium_loop"
  | "intro_loop"
  // Screen slots with no file yet (docs/sound-cues/music.md); screenMusic() skips them until they get one.
  | "music_home"
  | "music_practice"
  | "music_prepare"
  | "music_round_title"
  | "music_reveal"
  | "music_winner";

/** First-tap preload: effects and voice only; music loads on demand per screen/round. */
function preloadFiles(): [string, string][] {
  return Object.entries(SOUND_MANIFEST).flatMap(([id, entry]) =>
    entry.url && entry.channel !== "music" ? [[id, entry.url] as [string, string]] : [],
  );
}
export const SOUND_NAMES = Object.keys(SOUND_MANIFEST) as SoundId[];

const FADE_MS = 400;
/** Effects played through ensureLoop (plus any slot marked `loop` in the manifest). */
const EFFECT_LOOPS = new Set<SoundId>([
  "arc_space_ambience",
  "arc_marble_roll",
  "arc_sea_waves",
  ...SOUND_NAMES.filter((id) => SOUND_MANIFEST[id].loop),
]);

/** A file's own level from the manifest (1 unless the entry sets `volume`). */
function entryVolume(id: SoundId): number {
  const level = SOUND_MANIFEST[id]?.volume;
  return typeof level === "number" ? Math.max(0, Math.min(1, level)) : 1;
}

type AnyContextState = AudioContextState | "interrupted";

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let effectsGain: GainNode | null = null;
let voiceGain: GainNode | null = null;
let unlocked = false;
let loading: Promise<void> | null = null;
let lifecycleBound = false;
let loggedFailure = false;
const buffers = new Map<string, AudioBuffer>();
const failedFiles = new Set<string>();
const playingEffects = new Map<SoundId, AudioBufferSourceNode>();
let currentTrack: { name: Track; source: AudioBufferSourceNode; gain: GainNode } | null = null;
/** What music should be playing, so we can restart it after an interruption. */
let desiredTrack: { name: Track; options: MusicOptions } | null = null;

function warnOnce(message: string, error?: unknown): void {
  if (loggedFailure) return;
  loggedFailure = true;
  console.warn(`[sound] ${message}`, error ?? "");
}

/* ---------------------------------------------------------------- settings */

export function isMuted(): boolean {
  return readSoundSettings().effects.muted;
}
export function isMusicMuted(): boolean {
  return readSoundSettings().music.muted;
}
export function musicVolume(): number {
  return readSoundSettings().music.volume;
}
export function effectsVolume(): number {
  return readSoundSettings().effects.volume;
}
export function setMusicMuted(next: boolean): void {
  if (typeof window === "undefined") return;
  changeChannelMuted("music", next);
  if (!next) unlockAudio();
  applySettings();
  announce();
}

function applySettings(): void {
  if (!ctx || !masterGain || !musicGain || !effectsGain) return;
  const t = ctx.currentTime;
  masterGain.gain.setValueAtTime(1, t);
  musicGain.gain.setValueAtTime(isMusicMuted() ? 0 : MUSIC_BED_LEVEL * musicVolume(), t);
  effectsGain.gain.setValueAtTime(isMuted() ? 0 : effectsVolume(), t);
  voiceGain?.gain.setValueAtTime(isMuted() ? 0 : effectsVolume(), t);
  applyRoundLevel(0);
}

function announce(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
}

export function setMuted(next: boolean): void {
  if (typeof window === "undefined") return;
  changeChannelMuted("effects", next);
  if (!next) unlockAudio();
  applySettings();
  announce();
}
export function setMusicVolume(value: number): void {
  if (typeof window === "undefined") return;
  changeChannelVolume("music", value);
  if (value > 0) unlockAudio();
  applySettings();
  announce();
}
export function setEffectsVolume(value: number): void {
  if (typeof window === "undefined") return;
  changeChannelVolume("effects", value);
  if (value > 0) unlockAudio();
  applySettings();
  announce();
}

export function onSoundSettingsChange(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

/** Kept for existing call sites; the mute toggle listens through this. */
export const onMuteChange = onSoundSettingsChange;

/* ------------------------------------------------------------------ unlock */

async function preload(): Promise<void> {
  if (!ctx) return;
  // Several slots may share one recording: fetch and decode each URL once, then give
  // every slot that names it the same buffer.
  const byUrl = new Map<string, string[]>();
  for (const [name, url] of preloadFiles()) {
    if (buffers.has(name)) continue;
    byUrl.set(url, [...(byUrl.get(url) ?? []), name]);
  }
  await Promise.all(
    [...byUrl].map(async ([url, names]) => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${response.status}`);
        const bytes = await response.arrayBuffer();
        const context = ctx;
        if (!context) return;
        const decoded = await context.decodeAudioData(bytes);
        for (const name of names) {
          buffers.set(name, decoded);
          // Looping effects trim MP3 padding at the same -60 dB edges as music.
          if (EFFECT_LOOPS.has(name as SoundId) && /\.mp3$/i.test(url))
            loopPoints.set(name as SoundId, detectLoopPoints(decoded));
          failedFiles.delete(name);
        }
      } catch (error) {
        for (const name of names) failedFiles.add(name);
        warnOnce(`could not load ${url}`, error);
      }
    }),
  );
}

/** One sample of silence: the canonical iOS unlock, must run inside a gesture. */
function playSilentSample(): void {
  if (!ctx) return;
  try {
    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch (error) {
    warnOnce("silent unlock sample failed", error);
  }
}

function contextState(): AnyContextState | "none" {
  return (ctx?.state as AnyContextState | undefined) ?? "none";
}

/** Resume a suspended/interrupted context and restart the music that was on. */
function resumeContext(): void {
  if (!ctx) return;
  const state = contextState();
  if (state !== "suspended" && state !== "interrupted") return;
  try {
    void ctx
      .resume()
      .then(() => {
        if (desiredTrack && !currentTrack) {
          const { name, options } = desiredTrack;
          desiredTrack = null;
          startMusic(name, options);
        }
      })
      .catch((error) => warnOnce("resume failed", error));
  } catch (error) {
    warnOnce("resume threw", error);
  }
}

function bindLifecycle(): void {
  if (lifecycleBound || typeof window === "undefined") return;
  lifecycleBound = true;
  const onVisible = () => {
    if (document.visibilityState === "visible") resumeContext();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("pageshow", resumeContext);
  window.addEventListener("focus", resumeContext);
  ctx?.addEventListener?.("statechange", () => {
    const state = contextState();
    if (state === "suspended" || state === "interrupted") resumeContext();
  });
}

/** Call from a real user gesture. Safe to call as often as you like. */
export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      warnOnce("Web Audio is unavailable on this device");
      return;
    }
    if (!ctx) {
      ctx = new Ctor();
      masterGain = ctx.createGain();
      musicGain = ctx.createGain();
      effectsGain = ctx.createGain();
      voiceGain = ctx.createGain();
      musicGain.connect(masterGain);
      effectsGain.connect(masterGain);
      voiceGain.connect(masterGain);
      masterGain.connect(ctx.destination);
      applySettings();
      bindLifecycle();
    }
    playSilentSample();
    void ctx.resume().catch((error) => warnOnce("initial resume failed", error));
    resumeContext();
    unlocked = true;
    if (pendingRoundMusic) prepareRoundMusic(pendingRoundMusic);
    loading ??= preload();
    if (desiredTrack && !currentTrack) startMusic(desiredTrack.name, desiredTrack.options);
  } catch (error) {
    warnOnce("could not create the audio context", error);
  }
}

/**
 * Attaches the first-gesture unlock to the document. iOS only honours
 * touchend/click/pointerup, so all three are listened for and the listeners
 * come off as soon as audio is running.
 */
export function installSoundUnlock(): () => void {
  if (typeof window === "undefined") return () => {};
  const events = ["touchend", "pointerup", "click", "keydown"] as const;
  const handler = () => {
    unlockAudio();
    if (unlocked && ctx && contextState() === "running") detach();
  };
  const detach = () => {
    for (const name of events) document.removeEventListener(name, handler, true);
  };
  for (const name of events) document.addEventListener(name, handler, true);
  bindLifecycle();
  return detach;
}

function ready(): boolean {
  if (!unlocked || !ctx) return false;
  const state = contextState();
  if (state === "suspended" || state === "interrupted") {
    resumeContext();
    return false;
  }
  return true;
}

/* --------------------------------------------------------------- diagnostics */

export interface SoundDiagnostics {
  unlocked: boolean;
  state: AnyContextState | "none";
  muted: boolean;
  musicVolume: number;
  effectsVolume: number;
  currentTrack: Track | null;
  loaded: string[];
  failed: string[];
  pending: string[];
}

export function soundDiagnostics(): SoundDiagnostics {
  return {
    unlocked,
    state: contextState(),
    muted: isMuted(),
    musicVolume: musicVolume(),
    effectsVolume: effectsVolume(),
    currentTrack: currentTrack?.name ?? null,
    loaded: SOUND_NAMES.filter((name) => buffers.has(name)),
    failed: SOUND_NAMES.filter((name) => failedFiles.has(name)),
    // Empty slots (no file yet) are never pending.
    pending: SOUND_NAMES.filter(
      (name) => !!SOUND_MANIFEST[name].url && !buffers.has(name) && !failedFiles.has(name),
    ),
  };
}

/* ----------------------------------------------------------------- effects */

/* Intro demos drive real puzzle screens; they must stay silent. A real tap
   lifts the hush briefly so the player's own Ready/Back sounds still play. */
let demoHush = 0;
let lastRealInput = 0;
export function hushForDemo(on: boolean): void {
  demoHush = Math.max(0, demoHush + (on ? 1 : -1));
}
export function noteRealInput(): void {
  lastRealInput = Date.now();
}
export function demoHushed(): boolean {
  return demoHush > 0 && Date.now() - lastRealInput > 600;
}

/** Plays a one-shot effect. Retriggering a cue restarts it rather than stacking. */
export function playSound(cue: SoundId, volume = 1, rate = 1, overlap = false): void {
  if (demoHushed()) return;
  if (isMuted() || !ready() || !ctx || !effectsGain) return;
  const entry = SOUND_MANIFEST[cue];
  if (entry.channel === "music") return;
  // A cue without its own file plays its registered fallback instead.
  if (!entry.url && entry.fallback) {
    playSound(entry.fallback as SoundId, volume, rate, overlap);
    return;
  }
  const buffer = buffers.get(cue);
  // Voice lines without a loaded file are skipped silently: never a placeholder beep.
  if (!buffer && entry.channel === "voice") return;
  duckMusic(buffer ? buffer.duration * 1000 : entry.ms);
  if (!buffer) {
    if (entry.frequency > 0) playTone(entry.frequency * rate, entry.ms, "sine", 0.18 * volume);
    return;
  }
  const previous = overlap ? undefined : playingEffects.get(cue);
  if (previous) {
    try {
      previous.stop();
    } catch {
      /* already finished */
    }
  }
  try {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    if (rate !== 1) source.playbackRate.setValueAtTime(rate, ctx.currentTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(
      (cue === "podium_fanfare" ? FANFARE_GAIN : 1) *
        Math.max(0, Math.min(1, volume)) *
        entryVolume(cue),
      ctx.currentTime,
    );
    source.connect(gain).connect(entry.channel === "voice" && voiceGain ? voiceGain : effectsGain);
    source.onended = () => {
      if (playingEffects.get(cue) === source) playingEffects.delete(cue);
    };
    if (!overlap) playingEffects.set(cue, source);
    source.start();
  } catch (error) {
    warnOnce("effect playback failed", error);
  }
}

const loops = new Map<SoundId, { source: AudioBufferSourceNode; gain: GainNode }>();

/* ----------------------------------------------------------- warning_10 */

/** The single 10 s countdown instance; never retriggered while playing. */
let warning10: AudioBufferSourceNode | null = null;

/**
 * Plays the 10 s round-end countdown. `offsetSeconds` lets a player who
 * joins the last 10 s mid-way (e.g. after a rejoin) start part-way through
 * so the cue still ends exactly at 0. Ducks music like any other effect.
 */
export function startWarning10(offsetSeconds = 0): void {
  if (demoHushed()) return;
  if (isMuted() || !ready() || !ctx || !effectsGain) return;
  if (warning10) return;
  const buffer = buffers.get("warning_10");
  if (!buffer) return;
  const offset = Math.max(0, Math.min(offsetSeconds, buffer.duration - 0.05));
  duckMusic((buffer.duration - offset) * 1000);
  try {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(effectsGain);
    source.onended = () => {
      if (warning10 === source) warning10 = null;
    };
    source.start(0, offset);
    warning10 = source;
  } catch (error) {
    warnOnce("warning playback failed", error);
  }
}

/** Final-seconds ticks; tracked so an early end cuts them with warning_10. */
const warningTicks = new Set<AudioBufferSourceNode>();
export function playWarningTick(id: "warning_tick" | "warning_tick_final"): void {
  if (demoHushed()) return;
  if (isMuted() || !ready() || !ctx || !effectsGain) return;
  const buffer = buffers.get(id);
  if (!buffer) return;
  try {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(effectsGain);
    source.onended = () => warningTicks.delete(source);
    source.start();
    warningTicks.add(source);
  } catch (error) {
    warnOnce("warning tick failed", error);
  }
}

/** Stops the countdown immediately (round ended early: submit, all submitted, game over). */
export function stopWarning10(): void {
  for (const tick of warningTicks) {
    try {
      tick.stop();
    } catch {
      /* already finished */
    }
  }
  warningTicks.clear();
  const current = warning10;
  warning10 = null;
  if (!current) return;
  try {
    current.stop();
  } catch {
    /* already finished */
  }
}

/**
 * Keeps a looping effect running on the effects channel. Call every frame while
 * it should play; it starts once the file is decoded and stops when muted.
 */
export function ensureLoop(id: SoundId, volume = 0.3): void {
  if (isMuted() || demoHushed()) {
    stopLoop(id, 120);
    return;
  }
  if (loops.has(id) || !ready() || !ctx || !effectsGain) return;
  const buffer = buffers.get(id);
  if (!buffer) return;
  try {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const points = loopPoints.get(id);
    if (points) {
      source.loopStart = points.start;
      source.loopEnd = points.end;
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(
      Math.max(0, Math.min(1, volume)) * entryVolume(id),
      ctx.currentTime + 0.4,
    );
    source.connect(gain).connect(effectsGain);
    source.start(0, points?.start ?? 0);
    loops.set(id, { source, gain });
  } catch (error) {
    warnOnce("loop playback failed", error);
  }
}

/** Fades out and stops a looping effect started by ensureLoop. */
export function stopLoop(id: SoundId, fadeMs = 300): void {
  const loop = loops.get(id);
  if (!loop) return;
  loops.delete(id);
  try {
    const now = ctx?.currentTime ?? 0;
    loop.gain.gain.cancelScheduledValues(now);
    loop.gain.gain.setValueAtTime(loop.gain.gain.value, now);
    loop.gain.gain.linearRampToValueAtTime(0.0001, now + fadeMs / 1000);
    loop.source.stop(now + fadeMs / 1000 + 0.02);
  } catch {
    /* already stopped */
  }
}

function duckMusic(durationMs: number): void {
  if (!ctx || !musicGain || !currentTrack || isMusicMuted()) return;
  const time = ctx.currentTime;
  const gain = musicGain.gain;
  gain.cancelScheduledValues(time);
  gain.setValueAtTime(gain.value, time);
  gain.linearRampToValueAtTime(MUSIC_BED_LEVEL * musicVolume() * 0.3, time + 0.03);
  gain.linearRampToValueAtTime(
    MUSIC_BED_LEVEL * musicVolume(),
    time + Math.max(0.25, durationMs / 1000) + 0.2,
  );
}
/** Stops a playing one-shot effect (e.g. the winner drumroll at its cut-off). */
export function stopSound(id: SoundId): void {
  const src = playingEffects.get(id);
  if (!src) return;
  playingEffects.delete(id);
  try {
    src.stop();
  } catch {
    /* finished */
  }
}
/** True once the slot's own file is set and decoded; a missing or failed file is false. */
function slotReady(id: string): boolean {
  return (
    !!(SOUND_MANIFEST as Record<string, { url: string | null } | undefined>)[id]?.url &&
    buffers.has(id)
  );
}

/** True once a named cue's own file is set and decoded (the moment will play it, not silence). */
export function cueHasFile(cue: string): boolean {
  return slotReady(cue);
}

/**
 * Plays a named cue's own file (`duelz-sound` cues, docs/sound-cues/README.md).
 * A cue whose slot has no file (or whose file failed to load) plays nothing and
 * returns false, so callers keep whatever they did before. Replay cues such as
 * `<gameId>.final-second` share one `*.<event>` slot unless the game has its own.
 */
export function playCueSlot(cue: string, volume = 1, rate = 1): boolean {
  const dot = cue.indexOf(".");
  const id = slotReady(cue)
    ? cue
    : dot > 0 && slotReady(`*${cue.slice(dot)}`)
      ? `*${cue.slice(dot)}`
      : null;
  if (!id || SOUND_MANIFEST[id as SoundId].channel === "music") return false;
  playSound(id as SoundId, volume, rate, true);
  return true;
}

/** Plays a cue's own file when its slot has a loaded one, else the shared sound it played before. */
export function playSlotOr(
  cue: SoundId,
  fallback: SoundId,
  volume = 1,
  rate = 1,
  overlap = false,
  keepRate = false,
): void {
  if (slotReady(cue)) playSound(cue, volume, keepRate ? rate : 1, overlap);
  else playSound(fallback, volume, rate, overlap);
}

/** The looping counterpart of playSlotOr: the slot's own loop once its file is loaded. */
export function ensureSlotLoop(cue: SoundId, fallback: SoundId, volume = 0.3): void {
  if (slotReady(cue)) {
    stopLoop(fallback, 120);
    ensureLoop(cue, volume);
  } else ensureLoop(fallback, volume);
}
export function stopSlotLoop(cue: SoundId, fallback: SoundId, fadeMs = 300): void {
  stopLoop(cue, fadeMs);
  stopLoop(fallback, fadeMs);
}

let cueBridge = false;
/**
 * Listens for every named cue and plays the file in its manifest slot, if any.
 * Installed once from the root; cues without a file stay silent as before.
 */
export function installSoundCueBridge(): void {
  if (cueBridge || typeof window === "undefined") return;
  cueBridge = true;
  window.addEventListener(SOUND_CUE_EVENT, (event) => {
    const cue = (event as CustomEvent<SoundCueDetail>).detail?.cue;
    if (typeof cue === "string") playCueSlot(cue);
  });
}

export function playCue(cue: Cue, volume = 1): void {
  if (demoHushed()) return;
  playSound(cue, volume);
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("duelz-cue", { detail: cue }));
}
export type VoiceId =
  | "prepareToDuel"
  | "winnerIs"
  | "finalRound"
  | "gg"
  | "roundTaken"
  | "roundLost"
  | "round1"
  | "round2"
  | "round3"
  | "round4"
  | "round5"
  | "round6"
  | "round7";
const VOICE_IDS: VoiceId[] = [
  "prepareToDuel",
  "winnerIs",
  "finalRound",
  "gg",
  "roundTaken",
  "roundLost",
  "round1",
  "round2",
  "round3",
  "round4",
  "round5",
  "round6",
  "round7",
];
let voiceTimer: number | undefined;
/** One voice line at a time: a new line (or a pending delayed one) replaces the current line. */
export function playVoice(id: VoiceId, delayMs = 0): void {
  if (typeof window === "undefined") return;
  if (voiceTimer !== undefined) {
    window.clearTimeout(voiceTimer);
    voiceTimer = undefined;
  }
  const run = () => {
    voiceTimer = undefined;
    for (const other of VOICE_IDS) {
      const src = playingEffects.get(other);
      if (src) {
        try {
          src.stop();
        } catch {
          /* finished */
        }
        playingEffects.delete(other);
      }
    }
    playSound(id);
  };
  if (delayMs > 0) voiceTimer = window.setTimeout(run, delayMs);
  else run();
}
/** Length of a voice line in ms: decoded file when loaded, else the manifest figure. */
export function voiceDurationMs(id: VoiceId): number {
  const buffer = buffers.get(id);
  return buffer ? buffer.duration * 1000 : SOUND_MANIFEST[id].ms;
}
/** Length of an effect cue in ms (decoded file when loaded). */
export function cueDurationMs(id: SoundId): number {
  const buffer = buffers.get(id);
  return buffer ? buffer.duration * 1000 : SOUND_MANIFEST[id].ms;
}

/** A short synthesised tone (e.g. rising chain-link pitch); silent when audio is off. */
export function playTone(
  frequency: number,
  durationMs = 120,
  type: OscillatorType = "sine",
  volume = 0.25,
  endFrequency?: number,
  voice = false,
): void {
  if (demoHushed()) return;
  if (isMuted() || !ready() || !ctx || !effectsGain) return;
  try {
    const now = ctx.currentTime;
    const end = now + durationMs / 1000;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, end);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain).connect(voice && voiceGain ? voiceGain : effectsGain);
    osc.start(now);
    osc.stop(end + 0.02);
  } catch (error) {
    warnOnce("tone playback failed", error);
  }
}

export const playTick = (volume = 1) => playCue("tick", volume);
export const playCorrect = () => playCue("correct");
export const playWrong = () => playCue("wrong");
export const playLock = () => playCue("lock");
/** Incoming chat message: a short blip on the effects channel. */
export const playBlip = () => playCue("lock");
export const playPlayerJoined = () => playCue("player_joined");
export const playRoundStart = () => playCue("round_start");
export const playRoundWon = () => playCue("round_won");
export const playFanfare = () => playCue("podium_fanfare");

/* ------------------------------------------------------------- beat loop */

/** Bass roots per bar of the 4-bar loop (Hz): A, F, C, G. */
const BEAT_BASS = [55, 43.65, 65.41, 49];

/**
 * One eighth-note step of Beat's synthesised 120 BPM loop: a closed hat on
 * every eighth, a plucked bass on beats 1 and 3 (and the "and" of 4), over a
 * four-bar A–F–C–G progression. `step` counts eighths from the first beat.
 */
export function playBeatStep(step: number): void {
  if (isMuted()) return;
  if (demoHushed()) return;
  if (!ready() || !ctx || !effectsGain) return;
  try {
    const t = ctx.currentTime;
    const inBar = ((step % 8) + 8) % 8;
    const bar = Math.floor(step / 8) % 4;
    // Hat: a short burst of high-passed noise, accented on the off-beat.
    const length = Math.floor(ctx.sampleRate * 0.04);
    const noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const hat = ctx.createBufferSource();
    hat.buffer = noise;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const hatGain = ctx.createGain();
    hatGain.gain.value = inBar % 2 === 1 ? 0.22 : 0.12;
    hat.connect(hp).connect(hatGain).connect(effectsGain);
    hat.start(t);
    if (inBar === 0 || inBar === 4 || inBar === 7) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = (BEAT_BASS[bar] ?? 55) * (inBar === 7 ? 2 : 1);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(g).connect(effectsGain);
      osc.start(t);
      osc.stop(t + 0.4);
    }
  } catch (error) {
    warnOnce("beat loop failed", error);
  }
}

/* ------------------------------------------------------------------- music */

function fadeOut(track: { source: AudioBufferSourceNode; gain: GainNode }, ms: number): void {
  if (!ctx) return;
  const t = ctx.currentTime;
  try {
    track.gain.gain.cancelScheduledValues(t);
    track.gain.gain.setValueAtTime(track.gain.gain.value, t);
    track.gain.gain.linearRampToValueAtTime(0, t + ms / 1000);
    track.source.stop(t + ms / 1000 + 0.02);
  } catch {
    /* already stopped */
  }
}

interface MusicOptions {
  /** Starting playback rate. */
  rate?: number;
  /** Ramp the rate to this value over rampMs. */
  rampToRate?: number;
  rampMs?: number;
  fadeMs?: number;
}

/**
 * Starts a looping music bed, cross-fading out whatever was playing. Only ever
 * one track at a time. Re-calling with the track already playing does nothing.
 */
export function startMusic(name: Track, options: MusicOptions = {}): void {
  if (name === "tension_loop") return;
  if (currentTrack?.name === name) return;
  // Remembered so an interruption (call, app switch) can restart it on resume.
  desiredTrack = { name, options };
  if (!ready() || !ctx || !musicGain) return;
  const buffer = musicBuffers.get(name);
  if (!buffer) {
    // Loaded the first time a screen needs it; starts once decoded if still wanted.
    // A file that failed to load is not retried here (the screen stays silent).
    void loadMusicBuffer(name).then(() => {
      if (musicBuffers.has(name) && desiredTrack?.name === name && !currentTrack)
        startMusic(name, desiredTrack.options);
    });
    return;
  }
  bedBuffers.add(name);
  const fade = options.fadeMs ?? FADE_MS;
  if (currentTrack) {
    fadeOut(currentTrack, fade);
    currentTrack = null;
  }
  try {
    const source = loopingSource(name, buffer);
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(entryVolume(name), t + fade / 1000);
    if (options.rate) source.playbackRate.setValueAtTime(options.rate, t);
    if (options.rampToRate && options.rampMs) {
      source.playbackRate.linearRampToValueAtTime(options.rampToRate, t + options.rampMs / 1000);
    }
    source.connect(gain).connect(musicGain);
    source.start(0, source.loopStart);
    currentTrack = { name, source, gain };
    desiredTrack = null;
  } catch (error) {
    warnOnce("music playback failed", error);
  }
}

export function stopMusic(fadeMs: number = FADE_MS): void {
  desiredTrack = null;
  if (!currentTrack) return;
  fadeOut(currentTrack, fadeMs);
  currentTrack = null;
}

/** Stops whatever bed is on unless it is (or is about to be) `name`. */
export function stopMusicExcept(name: Track, fadeMs: number = FADE_MS): void {
  if (currentTrack?.name === name || desiredTrack?.name === name) return;
  stopMusic(fadeMs);
}

/** A screen's bed if its slot has a file, else null (the screen stays as it is today). */
export function screenMusic(name: Track): Track | null {
  return SOUND_MANIFEST[name]?.url ? name : null;
}

/** Stops the bed only if it is (or is about to be) `name`; other beds are untouched. */
export function stopMusicIf(name: Track, fadeMs: number = FADE_MS): void {
  if (currentTrack?.name === name || desiredTrack?.name === name) stopMusic(fadeMs);
}

/** Loads a bed now and holds it with the room/practice beds until releaseRoomMusic. */
export function holdMusicBed(name: Track): void {
  if (!ctx) return;
  bedBuffers.add(name);
  void loadMusicBuffer(name);
}

export function isMusicPlaying(name: Track): boolean {
  return currentTrack?.name === name;
}

/* ------------------------------------------------------- music buffers */

/** Decoded music, loaded on demand (never in the first-tap preload). */
const musicBuffers = new Map<SoundId, AudioBuffer>();
const musicLoads = new Map<SoundId, Promise<void>>();
const musicTokens = new Map<SoundId, object>();
/** Lobby/standings/podium beds held for the room. */
const bedBuffers = new Set<SoundId>();
/** Detected audible start/end (seconds) for MP3 loops; WAV loops play whole. */
const loopPoints = new Map<SoundId, { start: number; end: number }>();
/** -60 dB: anything quieter at the edges is encoder padding/silence. */
const LOOP_THRESHOLD = 0.001;

function detectLoopPoints(buffer: AudioBuffer): { start: number; end: number } {
  let first = buffer.length;
  let last = -1;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < first; i++)
      if (Math.abs(data[i] ?? 0) > LOOP_THRESHOLD) {
        first = i;
        break;
      }
    for (let i = data.length - 1; i > last; i--)
      if (Math.abs(data[i] ?? 0) > LOOP_THRESHOLD) {
        last = i;
        break;
      }
  }
  if (last <= first) return { start: 0, end: buffer.duration };
  return { start: first / buffer.sampleRate, end: (last + 1) / buffer.sampleRate };
}

function loadMusicBuffer(id: SoundId): Promise<void> {
  if (musicBuffers.has(id) || failedFiles.has(id)) return Promise.resolve();
  const existing = musicLoads.get(id);
  if (existing) return existing;
  const url = SOUND_MANIFEST[id]?.url;
  const context = ctx;
  if (!url || !context) return Promise.resolve();
  const token = {};
  musicTokens.set(id, token);
  const load = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status}`);
      const decoded = await context.decodeAudioData(await response.arrayBuffer());
      // Released while decoding (round moved on): drop it.
      if (musicTokens.get(id) !== token) return;
      if (/\.mp3$/i.test(url)) loopPoints.set(id, detectLoopPoints(decoded));
      musicBuffers.set(id, decoded);
    } catch (error) {
      // Remembered so a missing bed is not fetched again and again; a new round retries once.
      failedFiles.add(id);
      warnOnce(`could not load ${url}`, error);
    } finally {
      if (musicTokens.get(id) === token) musicLoads.delete(id);
    }
  })();
  musicLoads.set(id, load);
  return load;
}

function releaseMusicBuffer(id: SoundId): void {
  // Released beds may be fetched again later (a file that failed gets one more try).
  failedFiles.delete(id);
  musicBuffers.delete(id);
  musicLoads.delete(id);
  musicTokens.delete(id);
  loopPoints.delete(id);
}

function loopingSource(id: SoundId, buffer: AudioBuffer): AudioBufferSourceNode {
  if (!ctx) throw new Error("no audio context");
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const points = loopPoints.get(id);
  if (points) {
    source.loopStart = points.start;
    source.loopEnd = points.end;
  }
  return source;
}

/** Leaving the room: stop and release the lobby/standings/podium beds. */
export function releaseRoomMusic(): void {
  stopMusic(0);
  for (const id of bedBuffers) releaseMusicBuffer(id);
  bedBuffers.clear();
}

/* ------------------------------------------------------------- round music */

/* In-round beds have independent ramp × music-slider gain.
   Tracks prepare even when muted; at most two are held and released on stop. */
let roundTrack: { id: SoundId; source: AudioBufferSourceNode; gain: GainNode } | null = null;
let roundLevel = 0.2;
let roundArcade = false;
/** Round tracks decoded or decoding, oldest first; never more than two. */
const roundBuffers: SoundId[] = [];
let pendingRoundMusic: SoundId | null = null;

function applyRoundLevel(rampSeconds: number): void {
  if (!ctx || !roundTrack) return;
  const target = isMusicMuted() ? 0 : roundLevel * musicVolume() * entryVolume(roundTrack.id);
  const g = roundTrack.gain.gain;
  const t = ctx.currentTime;
  try {
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    if (rampSeconds > 0) g.linearRampToValueAtTime(target, t + rampSeconds);
    else g.setValueAtTime(target, t);
  } catch {
    /* closed */
  }
}

function releaseRoundBuffer(id: SoundId): void {
  const i = roundBuffers.indexOf(id);
  if (i >= 0) roundBuffers.splice(i, 1);
  releaseMusicBuffer(id);
}

/** Rooms prepare in starting/title; practice prepares in intro, even while muted. */
export function prepareRoundMusic(id: SoundId | null | undefined): void {
  pendingRoundMusic = id ?? null;
  if (!id || SOUND_MANIFEST[id]?.channel !== "music" || !ctx) return;
  pendingRoundMusic = null;
  if (!roundBuffers.includes(id)) {
    // Keep only the playing track (if any) alongside the new one.
    for (const other of [...roundBuffers]) if (other !== roundTrack?.id) releaseRoundBuffer(other);
    while (roundBuffers.length >= 2) {
      const oldest = roundBuffers[0];
      if (oldest) releaseRoundBuffer(oldest);
    }
    roundBuffers.push(id);
  }
  if (!musicBuffers.has(id) && !musicLoads.has(id)) {
    const log = logFor(id);
    log.loadStart = stamp();
    void loadMusicBuffer(id).then(() => {
      if (musicBuffers.has(id)) logFor(id).loadEnd = stamp();
    });
  } else void loadMusicBuffer(id);
}

/* Dev audio log (accepted key only): one line per round track. */
interface RoundLog {
  id: SoundId;
  loadStart: number | null;
  loadEnd: number | null;
  start: number | null;
  stop: number | null;
  reason: string | null;
}
const roundLogs = new Map<SoundId, RoundLog>();
function logFor(id: SoundId): RoundLog {
  let log = roundLogs.get(id);
  if (!log)
    roundLogs.set(
      id,
      (log = { id, loadStart: null, loadEnd: null, start: null, stop: null, reason: null }),
    );
  return log;
}
function stamp(): number {
  return Math.round(performance.now());
}
function flushRoundLog(id: SoundId, reason: string): void {
  const log = roundLogs.get(id);
  roundLogs.delete(id);
  if (!log || !devDisplayAllowed()) return;
  log.stop = stamp();
  log.reason = reason;
  const f = (n: number | null) => (n === null ? "-" : `${n}ms`);
  console.info(
    `[audio] round ${log.id} load ${f(log.loadStart)}→${f(log.loadEnd)} start ${f(log.start)} stop ${f(log.stop)} reason=${reason}`,
  );
}

/*
 * Round music has ONE owner: the room's / practice's round-phase state, fed in
 * through syncRoundMusic (via useRoundMusic) and leaveRoundMusic. No screen
 * component (intro, countdown, timer bar, game frame, arena) starts or stops it.
 * Per round key the track starts at most once and stops at most once, so
 * mounting, unmounting or re-rendering can never start, stop or restart it.
 */
export interface RoundMusicPlan {
  /** Round identity; a new key ends whatever the previous round left playing. */
  key: string;
  track: SoundId | null;
  /** True from the start of the 3-2-1 until the round ends. */
  on: boolean;
  /** Round clock reading (ms remaining) once the round runs; null before. */
  remainingMs: number | null;
  /** Logged stop reason used when `on` turns false. */
  reason: string;
}

const LATE_START_MIN_MS = 10_000;
let plan: RoundMusicPlan = { key: "", track: null, on: false, remainingMs: null, reason: "" };
/** The track was started (or skipped) for this key: never started again. */
let roundBegan = false;
/** This key's music has stopped or been skipped: nothing more happens. */
let roundDone = false;
/** Wanted but not decoded/ready yet; started on arrival with >10 s left. */
let wantedRound: SoundId | null = null;
const awaitingLoad = new Set<SoundId>();

export function syncRoundMusic(next: RoundMusicPlan): void {
  if (next.key !== plan.key) {
    haltRoundMusic("next-round");
    roundBegan = false;
    roundDone = false;
    if (next.track) failedFiles.delete(next.track);
  }
  if (next.track && next.track !== plan.track) {
    roundArcade = !/^music_(word|number|speed|attention|pattern|logic)_/.test(next.track);
  }
  plan = next;
  applyRoundPlan();
}

/** The room or practice screen itself went away (left room, left practice). */
export function leaveRoundMusic(reason: string): void {
  haltRoundMusic(reason);
  plan = { key: "", track: null, on: false, remainingMs: null, reason: "" };
  roundBegan = false;
  roundDone = false;
}

function applyRoundPlan(): void {
  const { track, on, remainingMs, reason } = plan;
  if (remainingMs !== null) setRoundMusicLevel(roundMusicRamp(roundArcade, remainingMs));
  if (roundDone || !track) return;
  if (!on) {
    if (roundTrack || wantedRound) {
      roundDone = true;
      haltRoundMusic(reason);
    }
    return;
  }
  if (roundTrack || roundBegan) return;
  // Not playing yet with 10 s or less left: skip it for this round.
  if (remainingMs !== null && remainingMs <= LATE_START_MIN_MS) {
    roundDone = true;
    if (wantedRound) flushRoundLog(wantedRound, "skipped-late");
    wantedRound = null;
    return;
  }
  startRoundTrack(track);
}

function startRoundTrack(id: SoundId): void {
  if (SOUND_MANIFEST[id]?.channel !== "music") return;
  if (!ctx || !masterGain) {
    // No audio yet (before the first tap): remember it for when audio unlocks.
    pendingRoundMusic = id;
    return;
  }
  if (!roundBuffers.includes(id)) prepareRoundMusic(id);
  const buffer = musicBuffers.get(id);
  if (!buffer || !ready()) {
    wantedRound = id;
    if (!buffer) {
      if (!musicLoads.has(id)) void loadMusicBuffer(id);
      const load = musicLoads.get(id);
      if (load && !awaitingLoad.has(id)) {
        awaitingLoad.add(id);
        void load.then(() => {
          awaitingLoad.delete(id);
          // The moment it is ready: same rules (still wanted, >10 s left). A failed load waits.
          if (musicBuffers.has(id) && wantedRound === id && plan.track === id) applyRoundPlan();
        });
      }
    }
    return;
  }
  wantedRound = null;
  roundBegan = true;
  const level = roundMusicRamp(roundArcade, plan.remainingMs ?? Infinity);
  roundLevel = level;
  // Only the intro bed is faded; the round track has its own node and gain.
  if (currentTrack) {
    fadeOut(currentTrack, 150);
    currentTrack = null;
  }
  desiredTrack = null;
  try {
    const source = loopingSource(id, buffer);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(
      isMusicMuted() ? 0 : roundLevel * musicVolume() * entryVolume(id),
      ctx.currentTime,
    );
    source.connect(gain).connect(masterGain);
    source.start(0, source.loopStart);
    roundTrack = { id, source, gain };
    logFor(id).start = stamp();
  } catch (error) {
    warnOnce("round music failed", error);
  }
}

/** Normalized level before the device music slider. */
function setRoundMusicLevel(level: number): void {
  const next = Math.max(0, Math.min(1, level));
  if (Math.abs(next - roundLevel) < 0.002) return;
  roundLevel = next;
  applyRoundLevel(0.12);
}

/** Stops round music dead (no fade) and releases its decoded buffer. Internal only. */
function haltRoundMusic(reason: string): void {
  if (wantedRound) {
    flushRoundLog(wantedRound, `${reason}-before-ready`);
    wantedRound = null;
  }
  const track = roundTrack;
  roundTrack = null;
  if (!track) return;
  try {
    track.source.stop();
    track.source.disconnect();
  } catch {
    /* already stopped */
  }
  track.source.buffer = null;
  flushRoundLog(track.id, reason);
  releaseRoundBuffer(track.id);
}
