/**
 * Named sound cues (docs/sound-cues/README.md). Every new effect, animation or
 * feature moment announces itself as `window` event "duelz-sound" with
 * `{ cue: "<gameId>.<event>" }` ("shared.<event>" for shared moments). No audio
 * is attached yet: a later sound pass listens for these names. Presentation only;
 * nothing here reads or writes game state.
 */
export const SOUND_CUE_EVENT = "duelz-sound";

export interface SoundCueDetail {
  cue: string;
}

/** Dispatches one named cue. Safe on the server (no window) and in checks. */
export function soundCue(cue: string): void {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  if (typeof CustomEvent === "undefined") return;
  window.dispatchEvent(new CustomEvent<SoundCueDetail>(SOUND_CUE_EVENT, { detail: { cue } }));
}

let logging = false;

/**
 * Dev only: with `?dev=1` in the address, logs every cue to the console with
 * the time since the page loaded. Installed once per page; a no-op otherwise.
 */
export function installSoundCueLogger(): void {
  if (logging || typeof window === "undefined") return;
  let dev = false;
  try {
    dev = new URLSearchParams(window.location.search).get("dev") === "1";
  } catch {
    dev = false;
  }
  if (!dev) return;
  logging = true;
  window.addEventListener(SOUND_CUE_EVENT, (event) => {
    const cue = (event as CustomEvent<SoundCueDetail>).detail?.cue;
    console.info(`[duelz-sound] ${cue} @ ${Math.round(performance.now())} ms`);
  });
}
