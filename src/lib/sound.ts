/**
 * Sound manager. Ten MP3 cues served from /sounds, decoded once on the first
 * real user gesture, played through two channels: music (looping beds) and
 * effects (everything else).
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

const MUTE_KEY = "duelz_muted";
const MUSIC_KEY = "duelz_music_volume";
const FX_KEY = "duelz_effects_volume";
const EVENT = "duelz-sound-change";

export const DEFAULT_MUSIC_VOLUME = 0.35;
export const DEFAULT_EFFECTS_VOLUME = 0.8;
/** The fanfare sits slightly above the other effects. */
const FANFARE_GAIN = 0.9 / DEFAULT_EFFECTS_VOLUME;

export type Cue =
  | "player_joined"
  | "round_start"
  | "tick"
  | "correct"
  | "wrong"
  | "lock"
  | "round_won"
  | "podium_fanfare";

export type Track = "lobby_loop" | "tension_loop";

const FILES: Record<Cue | Track, string> = {
  lobby_loop: "/sounds/lobby_loop.mp3",
  tension_loop: "/sounds/tension_loop.mp3",
  player_joined: "/sounds/player_joined.mp3",
  round_start: "/sounds/round_start.mp3",
  tick: "/sounds/tick.mp3",
  correct: "/sounds/correct.mp3",
  wrong: "/sounds/wrong.mp3",
  lock: "/sounds/lock.mp3",
  round_won: "/sounds/round_won.mp3",
  podium_fanfare: "/sounds/podium_fanfare.mp3",
};

export const SOUND_NAMES = Object.keys(FILES) as (Cue | Track)[];

const FADE_MS = 400;

type AnyContextState = AudioContextState | "interrupted";

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let effectsGain: GainNode | null = null;
let unlocked = false;
let loading: Promise<void> | null = null;
let lifecycleBound = false;
let loggedFailure = false;
const buffers = new Map<string, AudioBuffer>();
const failedFiles = new Set<string>();
const playingEffects = new Map<Cue, AudioBufferSourceNode>();
let currentTrack: { name: Track; source: AudioBufferSourceNode; gain: GainNode } | null = null;
/** What music should be playing, so we can restart it after an interruption. */
let desiredTrack: { name: Track; options: MusicOptions } | null = null;

function warnOnce(message: string, error?: unknown): void {
  if (loggedFailure) return;
  loggedFailure = true;
  console.warn(`[sound] ${message}`, error ?? "");
}

/* ---------------------------------------------------------------- settings */

function readNumber(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw === null) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

export function musicVolume(): number {
  return readNumber(MUSIC_KEY, DEFAULT_MUSIC_VOLUME);
}

export function effectsVolume(): number {
  return readNumber(FX_KEY, DEFAULT_EFFECTS_VOLUME);
}

function applySettings(): void {
  if (!ctx || !masterGain || !musicGain || !effectsGain) return;
  const t = ctx.currentTime;
  masterGain.gain.setValueAtTime(isMuted() ? 0 : 1, t);
  musicGain.gain.setValueAtTime(musicVolume(), t);
  effectsGain.gain.setValueAtTime(effectsVolume(), t);
}

function announce(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
}

export function setMuted(next: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  if (!next) unlockAudio();
  applySettings();
  announce();
}

export function setMusicVolume(value: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUSIC_KEY, String(Math.min(1, Math.max(0, value))));
  applySettings();
  announce();
}

export function setEffectsVolume(value: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FX_KEY, String(Math.min(1, Math.max(0, value))));
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
  await Promise.all(
    Object.entries(FILES).map(async ([name, url]) => {
      if (buffers.has(name)) return;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${response.status}`);
        const bytes = await response.arrayBuffer();
        const decoded = await ctx!.decodeAudioData(bytes);
        buffers.set(name, decoded);
        failedFiles.delete(name);
      } catch (error) {
        failedFiles.add(name);
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
      musicGain.connect(masterGain);
      effectsGain.connect(masterGain);
      masterGain.connect(ctx.destination);
      applySettings();
      bindLifecycle();
    }
    playSilentSample();
    void ctx.resume().catch((error) => warnOnce("initial resume failed", error));
    resumeContext();
    unlocked = true;
    loading ??= preload();
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
  if (isMuted()) return false;
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
    pending: SOUND_NAMES.filter((name) => !buffers.has(name) && !failedFiles.has(name)),
  };
}

/* ----------------------------------------------------------------- effects */

/** Plays a one-shot effect. Retriggering a cue restarts it rather than stacking. */
export function playCue(cue: Cue): void {
  if (!ready() || !ctx || !effectsGain) return;
  const buffer = buffers.get(cue);
  if (!buffer) return;
  const previous = playingEffects.get(cue);
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
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(cue === "podium_fanfare" ? FANFARE_GAIN : 1, ctx.currentTime);
    source.connect(gain).connect(effectsGain);
    source.onended = () => {
      if (playingEffects.get(cue) === source) playingEffects.delete(cue);
    };
    playingEffects.set(cue, source);
    source.start();
  } catch (error) {
    warnOnce("effect playback failed", error);
  }
}

export const playTick = () => playCue("tick");
export const playCorrect = () => playCue("correct");
export const playWrong = () => playCue("wrong");
export const playLock = () => playCue("lock");
export const playPlayerJoined = () => playCue("player_joined");
export const playRoundStart = () => playCue("round_start");
export const playRoundWon = () => playCue("round_won");
export const playFanfare = () => playCue("podium_fanfare");

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
  if (currentTrack?.name === name) return;
  // Remembered so an interruption (call, app switch) can restart it on resume.
  desiredTrack = { name, options };
  if (!ready() || !ctx || !musicGain) return;
  const buffer = buffers.get(name);
  if (!buffer) return;
  const fade = options.fadeMs ?? FADE_MS;
  if (currentTrack) {
    fadeOut(currentTrack, fade);
    currentTrack = null;
  }
  try {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(1, t + fade / 1000);
    if (options.rate) source.playbackRate.setValueAtTime(options.rate, t);
    if (options.rampToRate && options.rampMs) {
      source.playbackRate.linearRampToValueAtTime(options.rampToRate, t + options.rampMs / 1000);
    }
    source.connect(gain).connect(musicGain);
    source.start();
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

export function isMusicPlaying(name: Track): boolean {
  return currentTrack?.name === name;
}
