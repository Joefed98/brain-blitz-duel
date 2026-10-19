/**
 * In-progress puzzle input lives here, outside the React tree, in a bucket
 * keyed by room + round. Room updates arriving mid-round (another player's
 * answer, a ready flag, a heartbeat) re-render the screen but can never wipe
 * what a player has typed, placed or tapped.
 *
 * Reloads (19 Oct 2026, room flow only; nothing here grades): the room page marks its live puzzle
 * round with `persistStageState(stateKey)`. That round's bucket is then also written to localStorage
 * on every change (`duelz.roomStage.v1:<stateKey>`, with the time it was written), and a reloaded
 * page (or iOS relaunching an evicted home-screen app) fills the bucket back from storage before the
 * stage first reads it, so the stage continues the same board and its first draft is the restored
 * draft (roomDraft.ts), which the next action then extends. Values go through a tagged encoding that
 * keeps Set, Map, arrays (undefined entries included), plain objects, NaN, ±Infinity and -0; a value
 * that cannot round-trip (a function, a class instance, a DOM node, a cycle) is not stored for that
 * name, so after a reload that name starts from the stage's initial value. Only one round is kept:
 * marking a round drops every other round's entry, and an entry older than STAGE_STATE_TTL_MS is
 * never restored. Practice, intro demos and arcade runs never mark a round, so they never persist.
 * stage-state-reload-check proves it.
 */

import { useCallback, useRef, useState } from "react";

import { DRAFT_TTL_MS, type DraftStorage } from "./roomDraft";

const buckets = new Map<string, Map<string, unknown>>();

export const STAGE_STATE_PREFIX = "duelz.roomStage.v1:";
/** A stored bucket older than this is never restored (the draft keeper's limit). */
export const STAGE_STATE_TTL_MS = DRAFT_TTL_MS;

export interface StageStatePersistence {
  storage?: () => DraftStorage | null;
  clock?: () => number;
}

function browserStorage(): DraftStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

let persisted: {
  key: string;
  storage: () => DraftStorage | null;
  clock: () => number;
  /** Whether this key's bucket came back from storage (checks). */
  restored: boolean;
} = { key: "", storage: browserStorage, clock: () => Date.now(), restored: false };

/* ------------------------------------------------------------------ encoding */

class Unsupported extends Error {}

const TAG = "$t";

function encodeValue(value: unknown, seen: Set<object>): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (value === undefined) return { [TAG]: "u" };
  if (typeof value === "number") {
    if (Number.isNaN(value)) return { [TAG]: "n", v: "NaN" };
    if (value === Infinity) return { [TAG]: "n", v: "Infinity" };
    if (value === -Infinity) return { [TAG]: "n", v: "-Infinity" };
    if (Object.is(value, -0)) return { [TAG]: "n", v: "-0" };
    return value;
  }
  if (typeof value !== "object") throw new Unsupported(typeof value);
  if (seen.has(value)) throw new Unsupported("cycle");
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const out: unknown[] = [];
      for (let i = 0; i < value.length; i++) out.push(encodeValue(value[i], seen));
      return out;
    }
    if (value instanceof Set) return { [TAG]: "set", v: [...value].map((entry) => encodeValue(entry, seen)) };
    if (value instanceof Map) {
      return { [TAG]: "map", v: [...value].map(([k, v]) => [encodeValue(k, seen), encodeValue(v, seen)]) };
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new Unsupported("instance");
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = encodeValue(v, seen);
    // A plain object that itself has a "$t" key is wrapped, so it is never read as a tag.
    return TAG in out ? { [TAG]: "o", v: out } : out;
  } finally {
    seen.delete(value);
  }
}

function decodeValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(decodeValue);
  const record = value as Record<string, unknown>;
  if (TAG in record) {
    const v = record["v"];
    switch (record[TAG]) {
      case "u":
        return undefined;
      case "n":
        return v === "NaN" ? NaN : v === "Infinity" ? Infinity : v === "-Infinity" ? -Infinity : -0;
      case "set":
        return new Set((v as unknown[]).map(decodeValue));
      case "map":
        return new Map((v as [unknown, unknown][]).map(([k, x]) => [decodeValue(k), decodeValue(x)]));
      case "o": {
        const out: Record<string, unknown> = {};
        for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = decodeValue(x);
        return out;
      }
      default:
        throw new Error("unknown tag");
    }
  }
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(record)) out[k] = decodeValue(x);
  return out;
}

/** The tagged JSON form of one stage value, or null when it cannot round-trip (exported for checks). */
export function encodeStageValue(value: unknown): string | null {
  try {
    return JSON.stringify(encodeValue(value, new Set()));
  } catch {
    return null;
  }
}

/** The value back from `encodeStageValue` (exported for checks). */
export function decodeStageValue(text: string): unknown {
  return decodeValue(JSON.parse(text));
}

/* ------------------------------------------------------------------ storage */

function writeBucket(stateKey: string, bucket: Map<string, unknown>): void {
  try {
    const store = persisted.storage();
    if (!store) return;
    const values: Record<string, unknown> = {};
    for (const [name, value] of bucket) {
      try {
        values[name] = encodeValue(value, new Set());
      } catch {
        // Can't round-trip: this name starts from the stage's initial value after a reload.
      }
    }
    store.setItem(STAGE_STATE_PREFIX + stateKey, JSON.stringify({ at: persisted.clock(), values }));
  } catch {
    // Storage full or blocked: the inputs still stand in memory.
  }
}

function readBucket(stateKey: string): Map<string, unknown> | null {
  try {
    const raw = persisted.storage()?.getItem(STAGE_STATE_PREFIX + stateKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: unknown; values?: unknown };
    if (typeof parsed.at !== "number" || !parsed.values || typeof parsed.values !== "object") return null;
    if (persisted.clock() - parsed.at > STAGE_STATE_TTL_MS) return null;
    const bucket = new Map<string, unknown>();
    for (const [name, value] of Object.entries(parsed.values as Record<string, unknown>)) {
      try {
        bucket.set(name, decodeValue(value));
      } catch {
        // A corrupt value: that name starts from the stage's initial value.
      }
    }
    return bucket.size ? bucket : null;
  } catch {
    return null;
  }
}

function pruneStored(keepStateKey: string): void {
  try {
    const store = persisted.storage();
    if (!store) return;
    const drop: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith(STAGE_STATE_PREFIX) && key !== STAGE_STATE_PREFIX + keepStateKey) drop.push(key);
    }
    for (const key of drop) store.removeItem(key);
  } catch {
    // Nothing to tidy.
  }
}

/**
 * Marks the room's live puzzle round ("" for none): its stage inputs are kept on the device and,
 * after a reload, restored before the stage first reads them. Every other round's stored inputs are
 * dropped. Call it during render, before the stage renders; repeated calls with the same key do nothing.
 */
export function persistStageState(stateKey: string, options: StageStatePersistence = {}): void {
  const storage = options.storage ?? browserStorage;
  const clock = options.clock ?? (() => Date.now());
  if (persisted.key === stateKey && !options.storage && !options.clock) return;
  persisted = { key: stateKey, storage, clock, restored: false };
  pruneStored(stateKey);
}

/** Whether the round's stage inputs came back from storage (checks). */
export function stageStateRestored(stateKey: string): boolean {
  return persisted.key === stateKey && persisted.restored;
}

/* ------------------------------------------------------------------ buckets */

function bucketFor(stateKey: string): Map<string, unknown> {
  const found = buckets.get(stateKey);
  if (found) return found;
  const stored = stateKey && persisted.key === stateKey ? readBucket(stateKey) : null;
  if (stored) persisted.restored = true;
  const made = stored ?? new Map<string, unknown>();
  buckets.set(stateKey, made);
  return made;
}

/** Forgets one round's inputs — used when a room ends or practice restarts. */
export function clearStageState(stateKey: string): void {
  buckets.delete(stateKey);
}

/** Forgets every round's inputs held in memory (checks: a stand-in for a reload). */
export function clearAllStageStateForReload(): void {
  buckets.clear();
}

/**
 * Like `useState`, but the value belongs to `stateKey` rather than to the
 * component instance, so it survives any re-render or re-mount within a round
 * (and, for the room's marked round, a reload).
 */
export function useStageState<T>(
  stateKey: string,
  name: string,
  initial: () => T,
): readonly [T, (next: T | ((previous: T) => T)) => void] {
  const [, bump] = useState(0);
  const keyRef = useRef(stateKey);
  keyRef.current = stateKey;

  const bucket = bucketFor(stateKey);
  if (!bucket.has(name)) bucket.set(name, initial());
  const value = bucket.get(name) as T;

  const set = useCallback(
    (next: T | ((previous: T) => T)) => {
      const key = keyRef.current;
      const target = bucketFor(key);
      const previous = target.get(name) as T;
      target.set(name, typeof next === "function" ? (next as (previous: T) => T)(previous) : next);
      if (key && persisted.key === key) writeBucket(key, target);
      bump((count) => count + 1);
    },
    [name],
  );

  return [value, set] as const;
}
