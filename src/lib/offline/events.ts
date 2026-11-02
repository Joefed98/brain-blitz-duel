/** One signal for "the offline store changed" (a pack topped up, a run queued or confirmed): screens re-read it. */
import { useEffect, useState } from "react";

const listeners = new Set<() => void>();
let version = 0;

export function emitOfflineChange(): void {
  version += 1;
  for (const listener of listeners) listener();
}

export function onOfflineChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A number that changes every time the offline store does (an effect's dependency). */
export function useOfflineVersion(): number {
  const [seen, setSeen] = useState(version);
  useEffect(() => onOfflineChange(() => setSeen(version)), []);
  return seen;
}
