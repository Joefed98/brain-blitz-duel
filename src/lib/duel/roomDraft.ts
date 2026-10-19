/**
 * The live round's draft, kept on the device (19 Oct 2026, room flow only; nothing here grades).
 *
 * A stage's inputs live in memory (stageState.ts), so a reload, or iOS evicting the home-screen app
 * mid-round, lost the round's draft: if the round ended before the phone was back, the time-out (or
 * the reveal) sent "" and the round scored 0 (#115's audit, item 5). Every draft is now also written
 * to localStorage under its round's state key (`${room id}-${game}-${round}`), and a reloaded page
 * reads it back, so the answer sent if the round ends first is the one the player had made.
 *
 * After a reload the stage starts again from the round's opening board and sends that board as its
 * first draft. The restored draft stands over that untouched board; the first draft that differs
 * from it (the player has played again) replaces it, as any newer draft does: a reload never keeps
 * the better of two attempts. localStorage, not sessionStorage: iOS relaunches an evicted home-screen
 * app as a new session. Entries for other rounds and anything older than DRAFT_TTL_MS are removed.
 *
 * room-draft-check drives it with a stand-in storage.
 */

export const ROOM_DRAFT_PREFIX = "duelz.roomDraft.v1:";
/** A stored draft older than this is never restored (no round lasts anywhere near it). */
export const DRAFT_TTL_MS = 2 * 60 * 60 * 1000;

export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

export interface DraftKeeper {
  /** The round's draft ("" when none), from memory or, after a reload, from storage. */
  current(stateKey: string): string;
  /** A draft from the stage; `final` (the stage's own submit) always replaces a restored draft. */
  push(stateKey: string, answer: string, final?: boolean): void;
  /** Whether the round's draft came back from storage and still stands (checks). */
  restored(stateKey: string): boolean;
  /** Forgets every stored draft but this round's. */
  prune(keepStateKey: string): void;
}

function browserStorage(): DraftStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function createDraftKeeper(
  storage: () => DraftStorage | null = browserStorage,
  clock: () => number = () => Date.now(),
): DraftKeeper {
  let memory: {
    key: string;
    answer: string;
    /** Came back from storage and no differing draft has replaced it yet. */
    restored: boolean;
    /** With restored: the stage's untouched opening board (its first draft after the reload). */
    opening: string | null;
  } = { key: "", answer: "", restored: false, opening: null };

  const read = (stateKey: string): string | null => {
    try {
      const raw = storage()?.getItem(ROOM_DRAFT_PREFIX + stateKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { answer?: unknown; at?: unknown };
      if (typeof parsed.answer !== "string" || typeof parsed.at !== "number") return null;
      if (clock() - parsed.at > DRAFT_TTL_MS) return null;
      return parsed.answer;
    } catch {
      return null;
    }
  };

  const write = (stateKey: string, answer: string) => {
    try {
      storage()?.setItem(ROOM_DRAFT_PREFIX + stateKey, JSON.stringify({ answer, at: clock() }));
    } catch {
      // Storage full or blocked: the draft still stands in memory.
    }
  };

  const load = (stateKey: string) => {
    if (memory.key === stateKey) return;
    const stored = stateKey ? read(stateKey) : null;
    memory =
      stored === null
        ? { key: stateKey, answer: "", restored: false, opening: null }
        : { key: stateKey, answer: stored, restored: true, opening: null };
  };

  return {
    current(stateKey) {
      if (!stateKey) return "";
      load(stateKey);
      return memory.answer;
    },
    push(stateKey, answer, final = false) {
      if (!stateKey) return;
      load(stateKey);
      if (memory.restored && !final) {
        if (memory.opening === null) {
          memory.opening = answer;
          return;
        }
        if (answer === memory.opening) return;
      }
      memory = { key: stateKey, answer, restored: false, opening: null };
      write(stateKey, answer);
    },
    restored(stateKey) {
      return memory.key === stateKey && memory.restored;
    },
    prune(keepStateKey) {
      try {
        const store = storage();
        if (!store) return;
        const drop: string[] = [];
        for (let i = 0; i < store.length; i++) {
          const key = store.key(i);
          if (key?.startsWith(ROOM_DRAFT_PREFIX) && key !== ROOM_DRAFT_PREFIX + keepStateKey) drop.push(key);
        }
        for (const key of drop) store.removeItem(key);
      } catch {
        // Nothing to tidy.
      }
    },
  };
}
