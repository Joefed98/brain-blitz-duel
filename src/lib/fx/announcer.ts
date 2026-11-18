/**
 * The announcer (18 Nov 2026, Joe's sound wiring): one voice line on a player's own round result, chosen by the
 * round's stored, graded score (never a live or estimated score): presentation only.
 *
 *   175–184 great, brilliant, superb
 *   185–194 amazing, outstanding, incredible
 *   195–199 sensational, unbelievable, phenomenal
 *   200     perfect, legendary, flawless
 *   below 175: no line.
 *
 * When: once per round, at that player's own result moment (AnswerReveal, the reveal of Practice, rooms, rated play,
 * the Daily, challenges and tournaments), ANNOUNCER_AFTER_STING_MS after the round-end sting (the reveal's
 * `onRevealScore` cue) begins. Never during play, never on a replay or a reveal reopened later (AnswerReveal's
 * `heroRun` false), never twice for the same round (a claimed key, kept for the tab's session so a reload never
 * repeats it). Each device plays only its own player's line: the reveal is the device's own result.
 * The line is picked at random from its tier, never the line this device played last.
 * Silent with the Announcer voice switch off (Settings → Sound) or with sound off; the game's volume applies (the
 * voice bus follows the sound-effects volume).
 */
import { isAnnouncerOn, isMuted, playVoice, type VoiceId } from "@/lib/sound";

export const ANNOUNCER_MIN_SCORE = 175;
/** After the sting begins: the sting (reveal_score, 140 ms) has finished, so the voice is always clear. */
export const ANNOUNCER_AFTER_STING_MS = 150;

export const ANNOUNCER_TIERS: readonly { from: number; to: number; lines: readonly VoiceId[] }[] = [
  { from: 175, to: 184, lines: ["voice.great", "voice.brilliant", "voice.superb"] },
  { from: 185, to: 194, lines: ["voice.amazing", "voice.outstanding", "voice.incredible"] },
  { from: 195, to: 199, lines: ["voice.sensational", "voice.unbelievable", "voice.phenomenal"] },
  { from: 200, to: 200, lines: ["voice.perfect", "voice.legendary", "voice.flawless"] },
];
export const ANNOUNCER_LINES: readonly VoiceId[] = ANNOUNCER_TIERS.flatMap((t) => t.lines);

/** The tier's lines for a stored score (a whole number; 200 is the most any round scores), or null below 175. */
export function announcerTier(score: number | null | undefined): readonly VoiceId[] | null {
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  const s = Math.min(200, Math.floor(score));
  return ANNOUNCER_TIERS.find((t) => s >= t.from && s <= t.to)?.lines ?? null;
}

const LAST_KEY = "duelz-announcer-last:v1";
const CLAIMS_KEY = "duelz-announcer-rounds:v1";
const CLAIMS_KEPT = 64;
let lastLine: string | null = null;
const claims = new Set<string>();

function storage(kind: "local" | "session"): Storage | null {
  try {
    return typeof window === "undefined" ? null : kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function readLast(): string | null {
  if (lastLine !== null) return lastLine;
  try {
    lastLine = storage("local")?.getItem(LAST_KEY) ?? null;
  } catch {
    /* none */
  }
  return lastLine;
}

/** A line from the tier, at random, never the one this device played last. */
export function pickAnnouncerLine(lines: readonly VoiceId[], random: () => number = Math.random): VoiceId {
  const last = readLast();
  const choices = lines.length > 1 ? lines.filter((l) => l !== last) : lines;
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))]!;
}

function claimed(key: string): boolean {
  if (claims.has(key)) return true;
  try {
    const kept = JSON.parse(storage("session")?.getItem(CLAIMS_KEY) ?? "[]") as string[];
    if (Array.isArray(kept) && kept.includes(key)) {
      claims.add(key);
      return true;
    }
  } catch {
    /* none kept */
  }
  return false;
}

function claim(key: string): void {
  claims.add(key);
  try {
    const s = storage("session");
    const kept = (JSON.parse(s?.getItem(CLAIMS_KEY) ?? "[]") as string[]).filter((k) => k !== key);
    kept.push(key);
    s?.setItem(CLAIMS_KEY, JSON.stringify(kept.slice(-CLAIMS_KEPT)));
  } catch {
    /* memory only */
  }
}

/**
 * The announcer's line for one round's result, if any: the stored score, a key naming the round (mode, game, round
 * and when it was shown, so Practice's Play again is a new round), and `firstShowing` false for a reveal reopened
 * from a results list. Plays `delayMs` from now (the reveal's sting time plus ANNOUNCER_AFTER_STING_MS); returns the
 * line chosen, or null. The round is claimed when it plays (a reveal that unmounts first never claims it).
 */
export function announceRoundResult(
  key: string,
  score: number | null | undefined,
  firstShowing: boolean,
  delayMs: number,
  random: () => number = Math.random,
): { line: VoiceId; cancel: () => void } | null {
  if (!firstShowing || typeof window === "undefined") return null;
  const lines = announcerTier(score);
  if (!lines || claimed(key)) return null;
  const line = pickAnnouncerLine(lines, random);
  const timer = window.setTimeout(() => {
    if (claimed(key)) return;
    claim(key);
    if (!isAnnouncerOn() || isMuted()) return;
    lastLine = line;
    try {
      storage("local")?.setItem(LAST_KEY, line);
    } catch {
      /* memory only */
    }
    playVoice(line);
  }, Math.max(0, delayMs));
  return { line, cancel: () => window.clearTimeout(timer) };
}

/** Checks only: forget the claimed rounds and the last line. */
export function resetAnnouncerMemory(): void {
  claims.clear();
  lastLine = null;
  try {
    storage("session")?.removeItem(CLAIMS_KEY);
    storage("local")?.removeItem(LAST_KEY);
  } catch {
    /* none */
  }
}
