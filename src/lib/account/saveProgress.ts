/**
 * "Save your progress" (10 Nov 2026, wave 1 sign-up screens; docs/accounts/README.md "Sign-up screens"): when the
 * phone offers a guest an account. Never before the first finished game:
 *
 * - the sheet after the player's first finished game (a finished room, Daily or challenge);
 * - if they answered "Not now" (or left the sheet unanswered), a small pop-up once more after their third finished
 *   game, then never again unprompted;
 * - nothing once they tapped a way to sign up, or once the device holds an account.
 *
 * Where (Joe's decision, 10 Nov 2026): never over a round, its intro or reveal, or any result, podium, standings or
 * share screen. A finished game's result screen only counts the game (`noteFinishedGame`), which marks the prompt it
 * calls for as due (`pending`); the prompt shows the next time the player lands on a tab page (Play, Practice,
 * Tournaments, Profile: PhoneShell's `tabs`), this visit or the next open (`takePendingPrompt`).
 *
 * Device storage only (`duelz-save-progress:v1`); a game counts once, by its key (a room's id and game, a Daily's
 * room, a challenge's code). The three analytics events go through recordSaveProgressFn
 * (saveProgress.functions.ts), whose input rules (`acceptSaveProgressEvent`) are here so a check can prove them.
 */

export const SAVE_PROGRESS_KEY = "duelz-save-progress:v1";

/** Where a finished game came from (wave 3 adds the rated match). */
export const SAVE_PROGRESS_FROM = ["room", "daily", "challenge"] as const;
export type SaveProgressFrom = (typeof SAVE_PROGRESS_FROM)[number];

export const SAVE_PROGRESS_PROMPTS = ["sheet", "popup"] as const;
export type SaveProgressPrompt = (typeof SAVE_PROGRESS_PROMPTS)[number];

export const SAVE_PROGRESS_METHODS = ["email", "google", "apple"] as const;
export type SaveProgressMethod = (typeof SAVE_PROGRESS_METHODS)[number];

/** The game after which the pop-up asks once more. */
export const SAVE_PROGRESS_POPUP_AT = 3;

export interface SaveProgressRecord {
  /** Finished games counted on this device. */
  finished: number;
  /** The last few games counted (so a re-render or a reload never counts one twice). */
  keys: string[];
  sheet: "none" | "shown" | "dismissed" | "tapped";
  popup: "none" | "shown" | "dismissed" | "tapped";
  /** A prompt due on the next tab page, and where the game that made it due was played. */
  pending: SaveProgressPrompt | null;
  pendingFrom: SaveProgressFrom | null;
}

export const EMPTY_SAVE_PROGRESS: SaveProgressRecord = { finished: 0, keys: [], sheet: "none", popup: "none", pending: null, pendingFrom: null };

const KEY_KEEP = 20;
const STATES = new Set(["none", "shown", "dismissed", "tapped"]);

function store(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readSaveProgress(): SaveProgressRecord {
  try {
    const raw = store()?.getItem(SAVE_PROGRESS_KEY);
    if (!raw) return { ...EMPTY_SAVE_PROGRESS, keys: [] };
    const p = JSON.parse(raw) as Partial<SaveProgressRecord>;
    return {
      finished: Number.isInteger(p.finished) && (p.finished as number) >= 0 ? (p.finished as number) : 0,
      keys: Array.isArray(p.keys) ? p.keys.filter((k): k is string => typeof k === "string").slice(-KEY_KEEP) : [],
      sheet: STATES.has(p.sheet as string) ? (p.sheet as SaveProgressRecord["sheet"]) : "none",
      popup: STATES.has(p.popup as string) ? (p.popup as SaveProgressRecord["popup"]) : "none",
      pending: (SAVE_PROGRESS_PROMPTS as readonly string[]).includes(p.pending as string) ? (p.pending as SaveProgressPrompt) : null,
      pendingFrom: (SAVE_PROGRESS_FROM as readonly string[]).includes(p.pendingFrom as string) ? (p.pendingFrom as SaveProgressFrom) : null,
    };
  } catch {
    return { ...EMPTY_SAVE_PROGRESS, keys: [] };
  }
}

function write(record: SaveProgressRecord): void {
  try {
    store()?.setItem(SAVE_PROGRESS_KEY, JSON.stringify(record));
  } catch {
    /* storage blocked: the prompt may ask again, never earlier */
  }
}

/** Which prompt a record calls for now (pure: the screens and the check share it). */
export function promptFor(record: SaveProgressRecord): SaveProgressPrompt | null {
  if (record.finished < 1) return null;
  if (record.sheet === "tapped" || record.popup !== "none") return null;
  if (record.sheet === "none") return "sheet";
  return record.finished >= SAVE_PROGRESS_POPUP_AT ? "popup" : null;
}

/** Counts a finished game once (by its key) and returns the record after it. */
export function countFinishedGame(record: SaveProgressRecord, gameKey: string): SaveProgressRecord {
  const key = String(gameKey).slice(0, 120);
  if (!key || record.keys.includes(key)) return record;
  return { ...record, finished: record.finished + 1, keys: [...record.keys, key].slice(-KEY_KEEP) };
}

/**
 * A finished game's result screen calls this once: it counts the game and marks the prompt it calls for as due on the
 * next tab page (null for an account, or when nothing is due). Nothing is drawn on the result screen.
 */
export function noteFinishedGame(gameKey: string, opts: { signedIn: boolean; from?: SaveProgressFrom }): SaveProgressPrompt | null {
  const counted = countFinishedGame(readSaveProgress(), gameKey);
  if (opts.signedIn) {
    write({ ...counted, pending: null, pendingFrom: null });
    return null;
  }
  const prompt = promptFor(counted);
  write(prompt ? { ...counted, pending: prompt, pendingFrom: opts.from ?? counted.pendingFrom } : counted);
  return prompt;
}

/** Whether a prompt is due (read synchronously by the tab pages' shell, which loads the prompt only then). */
export function hasPendingPrompt(): boolean {
  return readSaveProgress().pending !== null;
}

/**
 * A tab page takes the due prompt once: it is marked shown at once (so it never shows twice) and handed over with
 * where its game was played. An account clears it and gets nothing.
 */
export function takePendingPrompt(opts: { signedIn: boolean }): { prompt: SaveProgressPrompt; from: SaveProgressFrom | null } | null {
  const record = readSaveProgress();
  const prompt = record.pending;
  if (!prompt) return null;
  if (opts.signedIn || promptFor(record) !== prompt) {
    write({ ...record, pending: null, pendingFrom: null });
    return null;
  }
  write({ ...record, [prompt]: "shown", pending: null, pendingFrom: null });
  return { prompt, from: record.pendingFrom };
}

/** The player's answer to a prompt. */
export function answerPrompt(prompt: SaveProgressPrompt, answer: "dismissed" | "tapped"): void {
  write({ ...readSaveProgress(), [prompt]: answer });
}

/* ------------------------------------------------------------------ the server function's input */

export const SAVE_PROGRESS_EVENTS = ["save_progress_shown", "save_progress_tapped", "save_progress_dismissed"] as const;
export type SaveProgressEventName = (typeof SAVE_PROGRESS_EVENTS)[number];

export interface SaveProgressEvent {
  event: SaveProgressEventName;
  props: { prompt: SaveProgressPrompt; from?: SaveProgressFrom; method?: SaveProgressMethod };
}

const oneOf = <T extends string>(list: readonly T[], raw: unknown): T | undefined =>
  typeof raw === "string" && (list as readonly string[]).includes(raw) ? (raw as T) : undefined;

/**
 * recordSaveProgressFn's input rule: exactly one of the three events, with only fixed words as props (which prompt,
 * where the game was, the sign-up way tapped). Anything else (another event, free text, an unknown prop) is refused.
 */
export function acceptSaveProgressEvent(input: unknown): SaveProgressEvent | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  for (const k of Object.keys(o)) if (k !== "event" && k !== "prompt" && k !== "from" && k !== "method") return null;
  const event = oneOf(SAVE_PROGRESS_EVENTS, o["event"]);
  const prompt = oneOf(SAVE_PROGRESS_PROMPTS, o["prompt"]);
  if (!event || !prompt) return null;
  const from = o["from"] === undefined ? undefined : oneOf(SAVE_PROGRESS_FROM, o["from"]);
  if (o["from"] !== undefined && !from) return null;
  const method = o["method"] === undefined ? undefined : oneOf(SAVE_PROGRESS_METHODS, o["method"]);
  if (o["method"] !== undefined && (!method || event !== "save_progress_tapped")) return null;
  const props: SaveProgressEvent["props"] = { prompt };
  if (from) props.from = from;
  if (method) props.method = method;
  return { event, props };
}

/* ------------------------------------------------------------------ game keys */

/** A finished room game's key: the room, and how many games it has finished before (Play again keeps the room). */
export function roomGameKey(duel: { id: string; tournament_history?: unknown }): string {
  const played = Array.isArray(duel.tournament_history) ? duel.tournament_history.length : 0;
  return `room:${duel.id}:${played}`;
}
