/**
 * Sound manager. Ten MP3 cues served from /sounds, decoded once on the first
 * user gesture, played through two channels: music (looping beds) and effects
 * (everything else).
 *
 * Nothing plays and nothing errors before that first gesture, and every
 * failure — blocked autoplay, a phone on silent, a missing decoder — is
 * swallowed: sound is a nicety, never a failure.
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

const FADE_MS = 400;

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let effectsGain: GainNode | null = null;
let unlocked = false;
let loading: Promise<void> | null = null;
const buffers = new Map<string, AudioBuffer>();
const playingEffects = new Map<Cue, AudioBufferSourceNode>();
let currentTrack: { name: Track; source: AudioBufferSourceNode; gain: GainNode } | null = null;

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
  const entries = Object.entries(FILES);
  await Promise.all(
    entries.map(async ([name, url]) => {
      if (buffers.has(name)) return;
      try {
        const response = await fetch(url);
        const bytes = await response.arrayBuffer();
        const decoded = await ctx!.decodeAudioData(bytes);
        buffers.set(name, decoded);
      } catch {
        /* one missing cue must never break the rest */
      }
    }),
  );
}

/** Call from a real user gesture. Safe to call as often as you like. */
export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    if (!ctx) {
      ctx = new Ctor();
      masterGain = ctx.createGain();
      musicGain = ctx.createGain();
      effectsGain = ctx.createGain();
      musicGain.connect(masterGain);
      effectsGain.connect(masterGain);
      masterGain.connect(ctx.destination);
      applySettings();
    }
    void ctx.resume();
    unlocked = true;
    loading ??= preload();
  } catch {
    /* audio is a nicety, never a failure */
  }
}

function ready(): boolean {
  if (isMuted()) return false;
  if (!unlocked || !ctx) return false;
  if (ctx.state === "suspended") void ctx.resume();
  return true;
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
  } catch {
    /* silent failure (iOS silent switch, exhausted sources) */
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
  if (!ready() || !ctx || !musicGain) return;
  if (currentTrack?.name === name) return;
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
  } catch {
    /* silent failure */
  }
}

export function stopMusic(fadeMs: number = FADE_MS): void {
  if (!currentTrack) return;
  fadeOut(currentTrack, fadeMs);
  currentTrack = null;
}

export function isMusicPlaying(name: Track): boolean {
  return currentTrack?.name === name;
}
