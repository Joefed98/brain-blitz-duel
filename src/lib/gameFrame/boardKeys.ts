/**
 * Keyboard play for the games whose board takes only taps and drags (the polish plan's section 7, Joe 20 Nov 2026:
 * every game playable from the keyboard on a computer). Input mapping only: a key never reaches a game directly. The
 * keys move a cursor over the board's own tappable pieces, and Space presses there with the same pointer and click
 * events a mouse sends at that spot, so the board's own handlers run on the same path as a click (the same ticks, the
 * same receipts, the same scoring). Nothing here is imported by a sim, a replay or a grader (desktop-fairness-check).
 *
 * The board is read from the page each time (the live round's `[data-game-stage]`), never stored: boards re-render
 * and move their pieces, so a target is always found afresh.
 */

/** How a game's board takes its keys (desktopKeys.ts BOARD_KEYS). */
export type BoardKeySpec =
  | {
      /** A cursor moved between the board's pieces by the arrows (WASD); Space presses, held Space drags. */
      kind: "cursor";
      /** The pieces the cursor visits (inside the live stage). */
      targets: string;
      /** Where inside a piece a press lands (its first match's centre), when the piece's centre isn't a hit area. */
      hit?: string;
      /** Shift+Space presses with the other mouse button (Pipeline's anticlockwise turn). */
      secondary?: boolean;
      /** Other keys that click one of the stage's buttons (Lookout's Done, Tessellate's Undo and Reset). */
      buttons?: Readonly<Record<string, string>>;
    }
  | {
      /** One key a cell of an evenly divided board (Bonk's 4 × 4 holes): the key presses that cell's centre. */
      kind: "grid";
      board: string;
      /** Rows of keys, top row first, one key a column (gameKey names: letters lower-case). */
      keys: readonly (readonly string[])[];
    }
  | {
      /** A crosshair moved over the board by the arrows (held keys speed up); Space presses at it (Pull!). */
      kind: "aim";
      board: string;
    }
  | {
      /** The keys press one target (Flash's reaction area). */
      kind: "press";
      target: string;
      keys: readonly string[];
    };

export type Dir = "up" | "down" | "left" | "right";
export interface Point {
  x: number;
  y: number;
}

/** The live round's stage on the page (one at a time; never an intro demo's or a reveal's board). */
export function liveStage(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.querySelector<HTMLElement>("[data-round-layout] [data-game-stage]");
}

const visible = (el: Element): boolean => {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== "hidden" && style.display !== "none" && !(el as HTMLButtonElement).disabled;
};

/** The pieces a cursor can visit now, in page order. */
export function boardTargets(stage: ParentNode, selector: string): HTMLElement[] {
  return [...stage.querySelectorAll<HTMLElement>(selector)].filter(visible);
}

/** Where a press on a piece lands: the centre of its hit area (spec `hit`) or of the piece. */
export function hotPoint(el: Element, hit?: string): Point {
  const inner = hit ? [...el.querySelectorAll(hit)].find(visible) : null;
  const r = (inner ?? el).getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

const centre = (el: Element): Point => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

/**
 * Spatial navigation: the piece nearest `from` in direction `dir`. Only pieces at least a few pixels that way count;
 * among them the nearest along the direction wins, a piece off the line paying three times its offset (so a grid
 * moves along its row or column, and scattered pieces, Ascend's discs, go to the one that is most nearly that way).
 */
export function nextTarget(from: Point, dir: Dir, targets: readonly Element[], current: Element | null): Element | null {
  let best: Element | null = null;
  let score = Infinity;
  for (const el of targets) {
    if (el === current) continue;
    const c = centre(el);
    const dx = c.x - from.x;
    const dy = c.y - from.y;
    const along = dir === "left" ? -dx : dir === "right" ? dx : dir === "up" ? -dy : dy;
    const across = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
    if (along < 4) continue;
    const s = along + 3 * across;
    if (s < score) {
      score = s;
      best = el;
    }
  }
  return best;
}

/** The piece nearest a point (where the cursor starts, or where it was when its piece left the board). */
export function nearestTarget(from: Point, targets: readonly Element[]): Element | null {
  let best: Element | null = null;
  let d = Infinity;
  for (const el of targets) {
    const c = centre(el);
    const dist = Math.hypot(c.x - from.x, c.y - from.y);
    if (dist < d) {
      d = dist;
      best = el;
    }
  }
  return best;
}

/** The first piece in reading order (top row, then left), where the cursor first shows. */
export function firstTarget(targets: readonly Element[]): Element | null {
  let best: Element | null = null;
  let key = Infinity;
  for (const el of targets) {
    const r = el.getBoundingClientRect();
    const k = Math.round(r.top / 8) * 1e5 + r.left;
    if (k < key) {
      key = k;
      best = el;
    }
  }
  return best;
}

/** The mouse's own pointer (Chromium's mouse is pointer 1): a press made here is a mouse press. */
const MOUSE_POINTER = 1;

function pointerInit(at: Point, button: number, buttons: number): PointerEventInit {
  return {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: MOUSE_POINTER,
    pointerType: "mouse",
    isPrimary: true,
    clientX: at.x,
    clientY: at.y,
    screenX: at.x,
    screenY: at.y,
    button,
    buttons,
    width: 1,
    height: 1,
    pressure: buttons ? 0.5 : 0,
  };
}

/** What a mouse at this point would press, only inside the live stage (a locked board takes no pointer, so nothing). */
const elementAt = (at: Point): Element | null => {
  if (typeof document === "undefined") return null;
  const el = document.elementFromPoint(at.x, at.y);
  return el && liveStage()?.contains(el) ? el : null;
};

/**
 * A press held at a point, as a mouse button sends it: pointerdown and mousedown on the element there, pointermove
 * as it moves, and on release pointerup, mouseup and (the main button, released on the element it went down on) a
 * click. The board's own handlers do the rest.
 */
export class HeldPress {
  private downOn: Element | null;
  private at: Point;
  private readonly button: number;
  private readonly buttons: number;

  constructor(at: Point, secondary = false) {
    this.at = at;
    this.button = secondary ? 2 : 0;
    this.buttons = secondary ? 2 : 1;
    this.downOn = elementAt(at);
    const target = this.downOn;
    if (!target) return;
    target.dispatchEvent(new PointerEvent("pointerdown", pointerInit(at, this.button, this.buttons)));
    target.dispatchEvent(new MouseEvent("mousedown", pointerInit(at, this.button, this.buttons)));
  }

  /** The held press moves to a point (a drag). */
  move(to: Point): void {
    this.at = to;
    const target = elementAt(to);
    target?.dispatchEvent(new PointerEvent("pointermove", pointerInit(to, -1, this.buttons)));
    target?.dispatchEvent(new MouseEvent("mousemove", pointerInit(to, 0, this.buttons)));
  }

  /** Let go where it is now. */
  release(): void {
    const target = elementAt(this.at);
    if (!target) return;
    target.dispatchEvent(new PointerEvent("pointerup", pointerInit(this.at, this.button, 0)));
    target.dispatchEvent(new MouseEvent("mouseup", pointerInit(this.at, this.button, 0)));
    if (this.button !== 0) {
      target.dispatchEvent(new MouseEvent("contextmenu", pointerInit(this.at, this.button, 0)));
      return;
    }
    if (this.downOn && (this.downOn === target || this.downOn.contains(target) || target.contains(this.downOn))) {
      const on = this.downOn.contains(target) ? target : this.downOn;
      on.dispatchEvent(new MouseEvent("click", pointerInit(this.at, 0, 0)));
    }
  }
}

/** One quick press and release at a point (a click, or a tap on a board that acts on pointerdown). */
export function pressAt(at: Point, secondary = false): void {
  new HeldPress(at, secondary).release();
}

/** The centre of cell (row, col) of a board divided evenly into `rows` × `cols`. */
export function gridCellCentre(board: Element, rows: number, cols: number, row: number, col: number): Point {
  const r = board.getBoundingClientRect();
  return { x: r.left + ((col + 0.5) * r.width) / cols, y: r.top + ((row + 0.5) * r.height) / rows };
}
