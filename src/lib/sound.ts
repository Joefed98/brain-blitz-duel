/**
 * Tiny Web Audio synth — no audio files. Four cues: a soft tick for the last
 * three seconds of the timer, a rising chime for a correct answer, a low buzz
 * for a wrong one, and a short fanfare on a win.
 *
 * Nothing plays until the user has interacted with the page (autoplay rules);
 * the first tap on Create / Join unlocks it.
 */

const MUTE_KEY = "duelz_muted";
const EVENT = "duelz-mute-change";

let ctx: AudioContext | null = null;
let unlocked = false;

export function isMuted(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

export function setMuted(next: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  window.dispatchEvent(new Event(EVENT));
  if (!next) unlockAudio();
}

export function onMuteChange(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

/** Call from a real user gesture. */
export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx ??= new Ctor();
    void ctx.resume();
    unlocked = true;
  } catch {
    /* audio is a nicety, never a failure */
  }
}

function tone(
  freq: number,
  startOffset: number,
  duration: number,
  peak: number,
  type: OscillatorType = "sine",
): void {
  if (!ctx) return;
  const start = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function ready(): boolean {
  if (isMuted()) return false;
  if (!unlocked) return false;
  if (!ctx) return false;
  if (ctx.state === "suspended") void ctx.resume();
  return true;
}

export function playTick(): void {
  if (!ready()) return;
  tone(1180, 0, 0.06, 0.06, "triangle");
}

export function playCorrect(): void {
  if (!ready()) return;
  tone(660, 0, 0.12, 0.09);
  tone(990, 0.1, 0.16, 0.09);
}

export function playWrong(): void {
  if (!ready()) return;
  tone(150, 0, 0.24, 0.1, "sawtooth");
}

export function playWin(): void {
  if (!ready()) return;
  tone(523, 0, 0.14, 0.09);
  tone(659, 0.13, 0.14, 0.09);
  tone(880, 0.26, 0.26, 0.1);
}
