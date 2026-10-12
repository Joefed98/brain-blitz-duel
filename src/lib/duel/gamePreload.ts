/**
 * Data a game needs on the phone before it can play, started with its intro.
 * Letterfall's dictionary is its own chunk, so it never weighs on the main
 * bundle and downloads only when a Letterfall round or practice begins.
 * Never rejects: the game screen retries on its own.
 */
import { loadWordfallDict } from "@/lib/arcade/wordfallDict";

export function preloadGameData(type: string): Promise<void> {
  if (type === "wordfall") return loadWordfallDict().catch(() => undefined);
  return Promise.resolve();
}
