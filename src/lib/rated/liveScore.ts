/**
 * The live arcade score for the rated header (wave 3, session W3c): an arcade stage publishes its sim's own running
 * score here once a second while a rated room's header asks for it (display only; read, never written back to the sim).
 * Imports nothing, so the game code that publishes it reaches no rated, economy or pass module.
 */


let wanted = 0;
let live: number | null = null;

/** A rated header is up: arcade stages should publish their running score. Returns the release. */
export function wantLiveScore(): () => void {
  wanted += 1;
  live = null;
  return () => {
    wanted = Math.max(0, wanted - 1);
    if (!wanted) live = null;
  };
}

export function liveScoreWanted(): boolean {
  return wanted > 0;
}

export function publishLiveScore(score: number | null): void {
  live = score !== null && Number.isFinite(score) ? Math.max(0, Math.round(score)) : null;
}

export function readLiveScore(): number | null {
  return live;
}
