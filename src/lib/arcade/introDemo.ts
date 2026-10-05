/**
 * Intro-screen demos: a saved practice run replayed on the intro with the
 * game's own sim and renderer. Every engine run string shares the layout
 * "seed|claimedScore|inputs|endTick|checkpoints[~diag]", so a demo frame is
 * the stored run with its endTick set to the frame's sim tick — the replay
 * stops there, on the sim clock, identically on every phone.
 */

export const DEMO_START_TICK = 0;
export const DEMO_LENGTH_TICKS = 480;
/** The existing per-run allowance. */
export const DEMO_MAX_CHARS = 400_000;

/** The same run, stopped at `tick`. Diagnostics after "~" are kept untouched. */
export function runAtTick(raw: string, tick: number): string {
  const text = String(raw ?? "");
  const cut = text.indexOf("~");
  const head = cut >= 0 ? text.slice(0, cut) : text;
  const tail = cut >= 0 ? text.slice(cut) : "";
  const parts = head.split("|");
  while (parts.length < 5) parts.push("");
  parts[3] = String(Math.max(1, Math.trunc(tick)));
  return parts.join("|") + tail;
}

/** A run with no input, stopped on its first tick: the game's start state. */
export function placeholderRun(seed: number): string {
  return `${seed}|0||1|`;
}

export function runSeed(raw: string): number {
  return Number.parseInt(String(raw ?? "").split("|")[0] ?? "", 10) || 0;
}

export interface DemoTouch {
  t: number;
  /** World position when the event carries one; null for a plain tap. */
  x: number | null;
  y: number | null;
}

/** Input events for the white touch rings. Visual only — never fed to a sim. */
export function demoTouches(raw: string, worldW: number, worldH: number): DemoTouch[] {
  const field = (String(raw ?? "").split("~")[0] ?? "").split("|")[2] ?? "";
  const out: DemoTouch[] = [];
  for (const part of field.split(",")) {
    if (!part) continue;
    const values = part.split(":").map((v) => Number.parseInt(v, 10));
    const t = values[0] ?? 0;
    if (!Number.isFinite(t) || t > DEMO_LENGTH_TICKS) continue;
    if (values.length < 6) {
      out.push({ t, x: null, y: null });
      continue;
    }
    const a = values[2] ?? 0;
    const b = values[3] ?? 0;
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x <= worldW && y <= worldH;
    if (inside(a, b)) out.push({ t, x: a, y: b });
    else if (inside(a / 256, b / 256)) out.push({ t, x: a / 256, y: b / 256 });
    else out.push({ t, x: null, y: null });
  }
  return out;
}
