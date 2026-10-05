/** Swap URLs here when the final files arrive; null music is intentionally silent. */
interface SoundEntry { channel: "effects" | "voice" | "music"; frequency: number; ms: number; url: string | null; }
const ENTRIES = {
  player_joined: { channel: "effects", frequency: 520, ms: 110, url: "/__l5e/assets-v1/4598b2e1-7e9f-43ce-a663-6ade3058dfb4/player_joined.mp3" },
  round_start: { channel: "effects", frequency: 440, ms: 180, url: "/__l5e/assets-v1/7ef5d069-61fd-4fc9-b25a-9e2a881945aa/round_start.mp3" },
  tick: { channel: "effects", frequency: 660, ms: 55, url: "/__l5e/assets-v1/0ff7cf10-ad3d-4824-99b6-e7aa97643235/tick.mp3" },
  place: { channel: "effects", frequency: 360, ms: 50, url: "/__l5e/assets-v1/5c0965ae-3953-4be1-a904-ec2a9a343748/place.mp3" },
  move: { channel: "effects", frequency: 280, ms: 40, url: "/__l5e/assets-v1/9a55367e-6a1b-41e2-827b-7cf552c9dd7c/move.mp3" },
  correct: { channel: "effects", frequency: 740, ms: 120, url: "/__l5e/assets-v1/7e845447-b698-4728-915d-f935cdbf3703/correct.mp3" },
  wrong: { channel: "effects", frequency: 140, ms: 140, url: "/__l5e/assets-v1/13ea6b6f-3857-437c-b483-416d3191e0b7/wrong.mp3" },
  lock: { channel: "effects", frequency: 390, ms: 90, url: "/__l5e/assets-v1/2d1f9967-bca7-4e87-8a2d-8b10d4a6c01e/lock.mp3" },
  round_won: { channel: "effects", frequency: 880, ms: 220, url: "/__l5e/assets-v1/fab62e01-dd7a-4874-a3d7-1b28496ada3e/round_won.mp3" },
  podium_fanfare: { channel: "effects", frequency: 990, ms: 350, url: "/__l5e/assets-v1/052e5249-1317-498e-8daa-f55af7cb8123/podium_fanfare.mp3" },
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
