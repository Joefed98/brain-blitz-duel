/**
 * Puzzle intro demos (non-engine games): an action list played over the
 * game's fixed intro example by driving its real Stage component.
 *
 * Positions are fractions (0–1) of the play area recorded with the demo, so
 * the same list lands on the same cells at any scale.
 */

/** Which fixed intro example a demo belongs to. Bump to re-roll every example. */
export const INTRO_EXAMPLE_ID = "intro-1";
export const INTRO_EXAMPLE_SEED = 0x1d7e0001;
/** The solved state holds this long before the loop restarts. */
export const PUZZLE_DEMO_HOLD_MS = 1500;
export const PUZZLE_DEMO_MAX_CHARS = 400_000;

export type DemoPoint = { x: number; y: number };

export type DemoAction =
  | { t: number; action: "tap"; args: { at: DemoPoint } }
  | { t: number; action: "hold"; args: { at: DemoPoint; ms: number } }
  /** path: [x, y, msSinceDown] samples between from and to. */
  | { t: number; action: "drag"; args: { from: DemoPoint; to: DemoPoint; ms: number; path?: [number, number, number][] } }
  | { t: number; action: "type"; args: { text: string } }
  | { t: number; action: "select"; args: { option: string } };

export interface DemoVerdict {
  valid: boolean;
  points?: number;
  word?: string;
  reason?: string;
  groupIndex?: number;
  theme?: string;
}

export interface PuzzleDemoLog {
  actions: DemoAction[];
  /** Play-area size (CSS px) the positions were recorded against. */
  w: number;
  h: number;
  /** Server word/group verdicts in the order the run asked for them. */
  verdicts?: DemoVerdict[];
  /** ArrowPad mode the run used (true = joystick). */
  joystick?: boolean;
}

const round3 = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 1000;
const TAP_SPAN = 0.025;
const TAP_MS = 400;

/** Captures one practice run's real touches inside the play area. */
export class DemoRecorder {
  private actions: DemoAction[] = [];
  private verdicts: DemoVerdict[] = [];
  private down: { id: number; t0: number; pts: [number, number, number][] } | null = null;
  private typing: { t: number; text: string } | null = null;
  private detach: (() => void) | null = null;
  private w = 0;
  private h = 0;

  constructor(private readonly startedAt: number) {}

  attach(el: HTMLElement): void {
    this.detach?.();
    const rect = () => el.getBoundingClientRect();
    const r0 = rect();
    this.w = Math.round(r0.width);
    this.h = Math.round(r0.height);
    const norm = (e: PointerEvent): [number, number] => {
      const r = rect();
      return [round3((e.clientX - r.left) / r.width), round3((e.clientY - r.top) / r.height)];
    };
    const onDown = (e: PointerEvent) => {
      if (!e.isTrusted || this.down) return;
      this.flushTyping();
      const [x, y] = norm(e);
      this.down = { id: e.pointerId, t0: Date.now(), pts: [[x, y, 0]] };
    };
    const onMove = (e: PointerEvent) => {
      const d = this.down;
      if (!e.isTrusted || !d || e.pointerId !== d.id) return;
      const dt = Date.now() - d.t0;
      const last = d.pts[d.pts.length - 1]!;
      if (dt - last[2] < 30) return;
      const [x, y] = norm(e);
      d.pts.push([x, y, dt]);
    };
    const onUp = (e: PointerEvent) => {
      const d = this.down;
      if (!e.isTrusted || !d || e.pointerId !== d.id) return;
      const [x, y] = norm(e);
      d.pts.push([x, y, Date.now() - d.t0]);
      this.down = null;
      this.finishPress(d);
    };
    const onKey = (e: KeyboardEvent) => {
      if (!e.isTrusted) return;
      const key = e.key === "Enter" ? "\n" : e.key === "Backspace" ? "\b" : e.key.length === 1 ? e.key : null;
      if (key === null) return;
      if (!this.typing) this.typing = { t: Date.now() - this.startedAt, text: "" };
      this.typing.text += key;
    };
    el.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    el.addEventListener("keydown", onKey, true);
    this.detach = () => {
      el.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      el.removeEventListener("keydown", onKey, true);
    };
  }

  verdict(value: DemoVerdict): void {
    this.verdicts.push(JSON.parse(JSON.stringify(value)) as DemoVerdict);
  }

  private flushTyping(): void {
    if (this.typing?.text) this.actions.push({ t: this.typing.t, action: "type", args: { text: this.typing.text } });
    this.typing = null;
  }

  private finishPress(d: { t0: number; pts: [number, number, number][] }): void {
    const t = d.t0 - this.startedAt;
    const first = d.pts[0]!;
    const last = d.pts[d.pts.length - 1]!;
    const ms = last[2];
    const span = Math.max(...d.pts.map((p) => Math.hypot(p[0] - first[0], p[1] - first[1])));
    const at = { x: first[0], y: first[1] };
    if (span < TAP_SPAN) {
      this.actions.push(ms < TAP_MS ? { t, action: "tap", args: { at } } : { t, action: "hold", args: { at, ms } });
      return;
    }
    this.actions.push({
      t,
      action: "drag",
      args: { from: at, to: { x: last[0], y: last[1] }, ms, path: d.pts.slice(1, -1).slice(0, 120) },
    });
  }

  finish(): PuzzleDemoLog {
    this.flushTyping();
    this.detach?.();
    this.detach = null;
    let joystick: boolean | undefined;
    try {
      joystick = window.localStorage.getItem("duelz-arrow-control") === "joystick";
    } catch {
      joystick = undefined;
    }
    return {
      actions: [...this.actions].sort((a, b) => a.t - b.t),
      w: this.w,
      h: this.h,
      verdicts: this.verdicts,
      ...(joystick === undefined ? {} : { joystick }),
    };
  }
}

/** Low-level events the player dispatches, in time order. */
export type DemoEvent =
  | { t: number; kind: "down" | "move" | "up"; x: number; y: number; tap?: boolean }
  | { t: number; kind: "type"; text: string }
  | { t: number; kind: "select"; option: string };

export function expandActions(actions: DemoAction[]): DemoEvent[] {
  const out: DemoEvent[] = [];
  for (const a of actions) {
    if (a.action === "tap") {
      out.push({ t: a.t, kind: "down", ...a.args.at }, { t: a.t + 90, kind: "up", ...a.args.at, tap: true });
    } else if (a.action === "hold") {
      out.push({ t: a.t, kind: "down", ...a.args.at }, { t: a.t + a.args.ms, kind: "up", ...a.args.at });
    } else if (a.action === "drag") {
      out.push({ t: a.t, kind: "down", ...a.args.from });
      const path = a.args.path?.length
        ? a.args.path
        : Array.from({ length: 8 }, (_, i): [number, number, number] => {
            const f = (i + 1) / 9;
            return [
              a.args.from.x + (a.args.to.x - a.args.from.x) * f,
              a.args.from.y + (a.args.to.y - a.args.from.y) * f,
              a.args.ms * f,
            ];
          });
      for (const [x, y, dt] of path) out.push({ t: a.t + dt, kind: "move", x, y });
      out.push({ t: a.t + a.args.ms, kind: "move", ...a.args.to }, { t: a.t + a.args.ms, kind: "up", ...a.args.to });
    } else if (a.action === "type") {
      out.push({ t: a.t, kind: "type", text: a.args.text });
    } else {
      out.push({ t: a.t, kind: "select", option: a.args.option });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

export function isPuzzleDemoLog(value: unknown): value is PuzzleDemoLog {
  const v = value as PuzzleDemoLog | null;
  return Boolean(v && Array.isArray(v.actions) && v.actions.length > 0 && v.w > 0 && v.h > 0);
}
