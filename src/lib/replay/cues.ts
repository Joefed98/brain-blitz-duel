/**
 * Named sound cues for replay moments (no audio yet): every effect, animation
 * or moment in the replay screens dispatches one, so audio can be attached
 * later without touching the screens. Cue names and lengths:
 * docs/sound-cues/replays.md. "<gameId>.<momentId>" for a game's own moment,
 * "shared.<event>" for the shared screens.
 */
export const SOUND_EVENT = "duelz-sound";

export function soundCue(cue: string): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(SOUND_EVENT, { detail: { cue } }));
  } catch {
    /* Presentation only: a cue never breaks a screen. */
  }
}

/** The shared cues (each game's own cue is `${moment.game}.${moment.id}`). */
export const SHARED_CUES = {
  highlightStart: "shared.highlight.start",
  highlightClip: "shared.highlight.clip",
  slowmo: "shared.slowmo",
  slowmoEnd: "shared.slowmo.end",
  highlightSkip: "shared.highlight.skip",
  highlightEnd: "shared.highlight.end",
  replayOpen: "shared.replay.open",
  replaySpeed: "shared.replay.speed",
  replaySeek: "shared.replay.seek",
  replayClose: "shared.replay.close",
  momentCard: "shared.momentcard",
  timelapseStart: "shared.timelapse.start",
  timelapseMove: "shared.timelapse.move",
  timelapseEnd: "shared.timelapse.end",
  playOfTheGame: "shared.playofthegame",
  playOfTheGameSkip: "shared.playofthegame.skip",
  playOfTheGameEnd: "shared.playofthegame.end",
} as const;
