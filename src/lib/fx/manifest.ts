/** Swap URLs here when the final files arrive; null music is intentionally silent. */
interface SoundEntry { channel: "effects" | "voice" | "music"; frequency: number; ms: number; url: string | null; }
const ENTRIES = {
  player_joined: { channel: "effects", frequency: 520, ms: 110, url: null },
  round_start: { channel: "effects", frequency: 440, ms: 180, url: null },
  tick: { channel: "effects", frequency: 660, ms: 55, url: null },
  place: { channel: "effects", frequency: 360, ms: 50, url: null },
  move: { channel: "effects", frequency: 280, ms: 40, url: null },
  correct: { channel: "effects", frequency: 740, ms: 120, url: null },
  wrong: { channel: "effects", frequency: 140, ms: 140, url: null },
  lock: { channel: "effects", frequency: 390, ms: 90, url: null },
  round_won: { channel: "effects", frequency: 880, ms: 220, url: null },
  podium_fanfare: { channel: "effects", frequency: 990, ms: 350, url: null },
  stage_complete: { channel: "effects", frequency: 800, ms: 160, url: null },
  complete: { channel: "effects", frequency: 920, ms: 200, url: null },
  combo: { channel: "effects", frequency: 840, ms: 90, url: null },
  warning_10: { channel: "effects", frequency: 500, ms: 100, url: null },
  warning_5: { channel: "effects", frequency: 250, ms: 130, url: null },
  time_up: { channel: "effects", frequency: 160, ms: 250, url: null },
  submit: { channel: "effects", frequency: 390, ms: 90, url: null },
  reveal_score: { channel: "effects", frequency: 760, ms: 140, url: null },
  reaction: { channel: "effects", frequency: 600, ms: 100, url: null },
  prepareToDuel: { channel: "voice", frequency: 440, ms: 180, url: null },
  finalRound: { channel: "voice", frequency: 520, ms: 180, url: null },
  gg: { channel: "voice", frequency: 660, ms: 220, url: null },
  lobby_loop: { channel: "music", frequency: 0, ms: 0, url: null },
  standings_loop: { channel: "music", frequency: 0, ms: 0, url: null },
  podium_loop: { channel: "music", frequency: 0, ms: 0, url: null },
  tension_loop: { channel: "music", frequency: 0, ms: 0, url: null },
} satisfies Record<string, { channel: "effects" | "voice" | "music"; frequency: number; ms: number; url: string | null }>;
export type SoundId = keyof typeof ENTRIES;
export const SOUND_MANIFEST: Record<SoundId, SoundEntry> = ENTRIES;