/**
 * In-progress puzzle input lives here, outside the React tree, in a bucket
 * keyed by room + round. Room updates arriving mid-round (another player's
 * answer, a ready flag, a heartbeat) re-render the screen but can never wipe
 * what a player has typed, placed or tapped.
 */

import { useCallback, useRef, useState } from "react";

const buckets = new Map<string, Map<string, unknown>>();

function bucketFor(stateKey: string): Map<string, unknown> {
  const found = buckets.get(stateKey);
  if (found) return found;
  const made = new Map<string, unknown>();
  buckets.set(stateKey, made);
  return made;
}

/** Forgets one round's inputs — used when a room ends or practice restarts. */
export function clearStageState(stateKey: string): void {
  buckets.delete(stateKey);
}

/**
 * Like `useState`, but the value belongs to `stateKey` rather than to the
 * component instance, so it survives any re-render or re-mount within a round.
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
      const target = bucketFor(keyRef.current);
      const previous = target.get(name) as T;
      target.set(name, typeof next === "function" ? (next as (previous: T) => T)(previous) : next);
      bump((count) => count + 1);
    },
    [name],
  );

  return [value, set] as const;
}
