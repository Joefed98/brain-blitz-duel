/**
 * Room moments (13 Oct 2026): the visual effects on the room's big screens,
 * "Prepare to Duel", each "Round N" title, "Final Round" and "And the winner
 * is…". Display only: every effect runs inside the existing phase durations
 * (startPresentation.ts, the same lengths the server uses), never changes the
 * phase timing, round order, scoring or what the screens say, and never takes
 * taps.
 *
 * Each moment is a table of parts (one element each, or `count` of them),
 * drawn as CSS keyframe animations in styles.css (`rfx-*`) that move only
 * transform and opacity over static fills: cheap on low-end Android. The
 * component (RoomMomentFx) starts every animation at the shared-clock elapsed
 * time, so a player who arrives late or reloads sees the same frame as
 * everyone else. prefers-reduced-motion swaps every part for a calm fade
 * (rfx-calm) and hides the parts marked `motionOnly`.
 *
 * Prepare to Duel, Final Round and the winner reveal are emphatic; the round
 * titles 1–6 each get their own quiet effect in the round's category colour.
 *
 * Sound: each moment dispatches named cues (room.*) through soundCue at the
 * frame its effect starts; no audio is attached yet (docs/sound-cues/room.md).
 */
import {
  DUEL_START_MS,
  ROUND_TITLE_MS,
  WINNER_REVEAL_MS,
  WINNER_ROLL_END_MS,
} from "@/lib/duel/startPresentation";

export type RoomMoment = "prepare" | "round" | "final" | "winner";

export interface MomentPart {
  /** `data-part` name; styles.css draws it under the moment's `data-effect`. */
  part: string;
  delayMs: number;
  durationMs: number;
  /** Copies of the part (each gets `--i` and `--n`), started `staggerMs` apart. */
  count?: number;
  staggerMs?: number;
  /** Static child marks inside the part (dial ticks, wheel spokes). */
  marks?: number;
  /** Drawn above the screen's text (the Prepare flash). */
  over?: boolean;
  /** Hidden under prefers-reduced-motion (it only reads as movement). */
  motionOnly?: boolean;
}

export interface MomentCue {
  cue: string;
  atMs: number;
}

export interface MomentSpec {
  moment: RoomMoment;
  /** `data-effect`: the look styles.css draws. */
  effect: string;
  /** The phase this moment sits in (ms); every part ends inside it. */
  phaseMs: number;
  parts: MomentPart[];
  cues: MomentCue[];
}

/** A cue this late (shared clock) on arrival is skipped, never played out of time. */
export const ROOM_CUE_LATE_MS = 400;

/** Prepare to Duel: gold rings on the voice, converging light streaks, a flash as the bolt lands. */
export const PREPARE_FLASH_MS = 5_550;
export const PREPARE_SPEC: MomentSpec = {
  moment: "prepare",
  effect: "prepare",
  phaseMs: DUEL_START_MS,
  parts: [
    { part: "glow", delayMs: 0, durationMs: DUEL_START_MS },
    {
      part: "ring",
      delayMs: 2_000,
      durationMs: 1_400,
      count: 3,
      staggerMs: 1_200,
      motionOnly: true,
    },
    {
      part: "streak",
      delayMs: 3_800,
      durationMs: 1_600,
      count: 12,
      staggerMs: 15,
      motionOnly: true,
    },
    {
      part: "flash",
      delayMs: PREPARE_FLASH_MS,
      durationMs: DUEL_START_MS - PREPARE_FLASH_MS,
      over: true,
      motionOnly: true,
    },
  ],
  cues: [
    { cue: "room.prepare", atMs: 0 },
    { cue: "room.prepare.flash", atMs: PREPARE_FLASH_MS },
  ],
};

/**
 * Rounds 1–6 (never the last round, which is Final Round): one quiet effect
 * each, in the category colour, all inside the 3 s title.
 */
export const ROUND_EFFECTS: readonly Omit<MomentSpec, "cues" | "moment" | "phaseMs">[] = [
  // 1 · Hairline: a single rule draws out under the title.
  { effect: "hairline", parts: [{ part: "line", delayMs: 150, durationMs: 2_700 }] },
  // 2 · Sheen: a soft light passes across the title; a short rule settles under it.
  {
    effect: "sheen",
    parts: [
      { part: "band", delayMs: 350, durationMs: 1_200, motionOnly: true },
      { part: "rule", delayMs: 500, durationMs: 2_350 },
    ],
  },
  // 3 · Brackets: four corners close in to frame the title.
  {
    effect: "brackets",
    parts: ["c-tl", "c-tr", "c-bl", "c-br"].map((part) => ({
      part,
      delayMs: 150,
      durationMs: 2_700,
    })),
  },
  // 4 · Halo: two thin rings breathe out behind the title.
  {
    effect: "halo",
    parts: [{ part: "halo", delayMs: 100, durationMs: 2_200, count: 2, staggerMs: 450 }],
  },
  // 5 · Rails: two hairlines slide in from opposite edges, above and below.
  {
    effect: "rails",
    parts: [
      { part: "rail-a", delayMs: 120, durationMs: 2_730 },
      { part: "rail-b", delayMs: 220, durationMs: 2_630 },
    ],
  },
  // 6 · Dial: a ring of fine ticks turns into place around the title.
  { effect: "dial", parts: [{ part: "dial", delayMs: 100, durationMs: 2_750, marks: 36 }] },
];

/** Final Round: gold edge glow, shock rings, bars shooting in, a punch on the title. */
export const FINAL_PUNCH_MS = 520;
export const FINAL_SPEC: MomentSpec = {
  moment: "final",
  effect: "final",
  phaseMs: ROUND_TITLE_MS,
  parts: [
    { part: "edge", delayMs: 0, durationMs: 2_900 },
    { part: "ring", delayMs: 120, durationMs: 1_300, count: 2, staggerMs: 380, motionOnly: true },
    { part: "rail-a", delayMs: 80, durationMs: 2_780 },
    { part: "rail-b", delayMs: 160, durationMs: 2_700 },
  ],
  cues: [{ cue: "room.finalRound", atMs: 0 }],
};

/**
 * The winner reveal: a slow ray wheel behind the line, two spotlights sweeping
 * through the drum roll that lock onto the text at the cut (WINNER_ROLL_END_MS),
 * the edges dimming and a gold spot holding through the silence.
 */
export const WINNER_SPEC: MomentSpec = {
  moment: "winner",
  effect: "winner",
  phaseMs: WINNER_REVEAL_MS,
  parts: [
    { part: "wheel", delayMs: 300, durationMs: 5_900, marks: 16 },
    { part: "beam-l", delayMs: 1_500, durationMs: 4_700, motionOnly: true },
    { part: "beam-r", delayMs: 1_500, durationMs: 4_700, motionOnly: true },
    { part: "spot", delayMs: 1_800, durationMs: 4_450 },
    { part: "dim", delayMs: 1_800, durationMs: 4_450 },
  ],
  cues: [
    { cue: "room.winner", atMs: 0 },
    { cue: "room.winner.lock", atMs: WINNER_ROLL_END_MS },
  ],
};

/** The title moment for a round: Final Round on the last round, else that round's effect. */
export function roundMomentSpec(round: number, totalRounds: number): MomentSpec {
  if (round >= totalRounds) return FINAL_SPEC;
  const index = Math.max(0, round - 1) % ROUND_EFFECTS.length;
  const look = ROUND_EFFECTS[index]!;
  return {
    moment: "round",
    effect: look.effect,
    phaseMs: ROUND_TITLE_MS,
    parts: look.parts,
    cues: [{ cue: `room.round.${round}`, atMs: 0 }],
  };
}

/** When the last part of a moment finishes (ms from the phase start). */
export function momentEndMs(spec: MomentSpec): number {
  return Math.max(
    ...spec.parts.map((p) => p.delayMs + ((p.count ?? 1) - 1) * (p.staggerMs ?? 0) + p.durationMs),
  );
}
