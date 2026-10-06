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

const MUSIC_MUTE_KEY = "duelz_music_muted";
const PUZZLE_ROUND_MUSIC_KEY = "duelz_puzzle_round_music";
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

export type Track = "lobby_loop" | "tension_loop" | "standings_loop" | "podium_loop";

const FILES = Object.fromEntries(Object.entries(SOUND_MANIFEST).flatMap(([id, entry]) => entry.url ? [[id, entry.url]] : [])) as Partial<Record<SoundId, string>>;
export const SOUND_NAMES = Object.keys(SOUND_MANIFEST) as SoundId[];

const FADE_MS = 400;

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

export function isMusicMuted(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(MUSIC_MUTE_KEY) === "1"; } catch { return false; }
}
export function setMusicMuted(next: boolean): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(MUSIC_MUTE_KEY, next ? "1" : "0"); } catch { /* unavailable */ }
  if (!next) unlockAudio();
  applySettings(); announce();
}
/** Device-persisted opt-in for music in logic, word and number rounds (default off). */
export function isPuzzleRoundMusicOn(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(PUZZLE_ROUND_MUSIC_KEY) === "1"; } catch { return false; }
}
export function setPuzzleRoundMusic(next: boolean): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(PUZZLE_ROUND_MUSIC_KEY, next ? "1" : "0"); } catch { /* unavailable */ }
  if (next) unlockAudio();
  announce();
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
  masterGain.gain.setValueAtTime(1, t);
  musicGain.gain.setValueAtTime(isMusicMuted() ? 0 : musicVolume(), t);
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
        if (!url) return;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${response.status}`);
        const bytes = await response.arrayBuffer();
        const context = ctx;
        if (!context) return;
        const decoded = await context.decodeAudioData(bytes);
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
    loading ??= preload().then(() => {
      if (desiredTrack) startMusic(desiredTrack.name, desiredTrack.options);
      if (pendingRound) startRoundMusic(pendingRound);
    });
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
    pending: SOUND_NAMES.filter((name) => !buffers.has(name) && !failedFiles.has(name)),
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
  const buffer = buffers.get(cue);
  duckMusic(buffer ? buffer.duration * 1000 : entry.ms);
  if (!buffer) { if (entry.frequency > 0) playTone(entry.frequency * rate, entry.ms, "sine", 0.18 * volume, undefined, entry.channel === "voice"); return; }
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
    gain.gain.setValueAtTime((cue === "podium_fanfare" ? FANFARE_GAIN : 1) * Math.max(0, Math.min(1, volume)), ctx.currentTime);
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

/** Stops the countdown immediately (round ended early: submit, all submitted, game over). */
export function stopWarning10(): void {
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
  if (isMuted() || demoHushed()) { stopLoop(id, 120); return; }
  if (loops.has(id) || !ready() || !ctx || !effectsGain) return;
  const buffer = buffers.get(id);
  if (!buffer) return;
  try {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, volume)), ctx.currentTime + 0.4);
    source.connect(gain).connect(effectsGain);
    source.start();
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
  gain.cancelScheduledValues(time); gain.setValueAtTime(gain.value, time);
  gain.linearRampToValueAtTime(musicVolume() * 0.3, time + 0.03);
  gain.linearRampToValueAtTime(musicVolume(), time + Math.max(0.25, durationMs / 1000) + 0.2);
}
export function playCue(cue: Cue, volume = 1): void {
  if (demoHushed()) return;
  playSound(cue, volume);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("duelz-cue", { detail: cue }));
}
export const playVoice = (id: "prepareToDuel" | "finalRound" | "gg") => playSound(id);

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

/* ------------------------------------------------------------- round music */

/* In-round beds: start at the 3-2-1, stop dead at round end. Level is a share
   of the effects level (30% → 70% over the closing stretch) on its own gain so
   lobby ducking never touches it; the persisted music mute silences it. */
let roundTrack: { id: SoundId; source: AudioBufferSourceNode; gain: GainNode } | null = null;
let pendingRound: SoundId | null = null;
let roundLevel = 0.3;
let roundClaimed = false;

function applyRoundLevel(rampSeconds: number): void {
  if (!ctx || !roundTrack) return;
  const target = isMusicMuted() ? 0 : roundLevel * effectsVolume();
  const g = roundTrack.gain.gain; const t = ctx.currentTime;
  try {
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    if (rampSeconds > 0) g.linearRampToValueAtTime(target, t + rampSeconds); else g.setValueAtTime(target, t);
  } catch { /* closed */ }
}

export function startRoundMusic(id: SoundId | null | undefined): void {
  if (!id || SOUND_MANIFEST[id]?.channel !== "music") return;
  if (roundTrack?.id === id) return;
  stopRoundMusic();
  roundLevel = 0.3; roundClaimed = false;
  pendingRound = id;
  if (currentTrack) { fadeOut(currentTrack, 150); currentTrack = null; }
  desiredTrack = null;
  if (!ready() || !ctx || !masterGain) return;
  const buffer = buffers.get(id);
  if (!buffer) return;
  try {
    const source = ctx.createBufferSource();
    source.buffer = buffer; source.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(isMusicMuted() ? 0 : roundLevel * effectsVolume(), ctx.currentTime);
    source.connect(gain).connect(masterGain);
    source.start();
    roundTrack = { id, source, gain };
    pendingRound = null;
  } catch (error) { warnOnce("round music failed", error); }
}

/** 0.3–0.7 share of the effects level, set from the round clock. */
export function setRoundMusicLevel(level: number): void {
  const next = Math.max(0, Math.min(1, level));
  if (Math.abs(next - roundLevel) < 0.002) return;
  roundLevel = next;
  applyRoundLevel(0.12);
}

/** The live round timer took over; intro teardown must not stop the music. */
export function claimRoundMusic(): void { roundClaimed = true; }
export function roundMusicClaimed(): boolean { return roundClaimed; }

/** Stops round music dead (no fade). */
export function stopRoundMusic(): void {
  pendingRound = null; roundClaimed = false;
  const track = roundTrack; roundTrack = null;
  if (!track) return;
  try { track.source.stop(); } catch { /* already stopped */ }
}
