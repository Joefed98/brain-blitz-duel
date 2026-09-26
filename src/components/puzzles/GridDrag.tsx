import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The shared grid drag-and-snap behaviour used by Unblock and Block Party.
 * Pointer events, so a finger and a mouse behave the same; the dragged piece
 * lifts above the pointer with a soft shadow, a legal drop snaps with the
 * standard pop and a quick haptic tick, an illegal drop shakes and returns.
 */

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const listener = () => setReduced(query.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);
  return reduced;
}

export function hapticTick(): void {
  try {
    navigator.vibrate?.(15);
  } catch {
    // Vibration is a nicety; never let it break a drag.
  }
}

/**
 * Reads an indexed hit from the actual interactive element under a pointer.
 * Scattered-node games use this instead of estimating a hit from their parent.
 */
export function pointerElementIndex(element: HTMLElement | null): number | null {
  if (!element || element.style.pointerEvents === "none") return null;
  const raw = element.dataset["pointerIndex"];
  if (raw === undefined) return null;
  const index = Number.parseInt(raw, 10);
  return Number.isInteger(index) && index >= 0 ? index : null;
}

/* -------------------------------------------------------------------------- */
/*  Shared pointer-to-cell mapping — every grid game uses this and nothing     */
/*  else, so a tap always lands on the square under the finger.                */
/* -------------------------------------------------------------------------- */

export interface GridGeometry {
  /** Content-box size in layout pixels (padding removed, CSS scale removed). */
  width: number;
  height: number;
  cellW: number;
  cellH: number;
  gapX: number;
  gapY: number;
  /** Pointer position inside the content box, in layout pixels. */
  x: number;
  y: number;
}

function number(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Measures the grid at the moment of the event — never a cached size — and puts
 * the pointer into the grid's own content-box coordinates, undoing any CSS
 * scale and the element's padding.
 */
export function gridGeometry(
  element: HTMLElement | null,
  clientX: number,
  clientY: number,
  cols: number,
  rows: number,
): GridGeometry | null {
  if (!element || cols <= 0 || rows <= 0) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const style = window.getComputedStyle(element);
  // A CSS transform scales the rect but not the computed padding or gap.
  const scaleX = element.offsetWidth ? rect.width / element.offsetWidth : 1;
  const scaleY = element.offsetHeight ? rect.height / element.offsetHeight : 1;
  const padLeft = number(style.paddingLeft);
  const padTop = number(style.paddingTop);
  const padRight = number(style.paddingRight);
  const padBottom = number(style.paddingBottom);
  const borderLeft = number(style.borderLeftWidth);
  const borderTop = number(style.borderTopWidth);
  const width = element.clientWidth - padLeft - padRight;
  const height = element.clientHeight - padTop - padBottom;
  if (width <= 0 || height <= 0) return null;

  const gapX = cols > 1 ? number(style.columnGap) : 0;
  const gapY = rows > 1 ? number(style.rowGap) : 0;
  return {
    width,
    height,
    cellW: (width - gapX * (cols - 1)) / cols,
    cellH: (height - gapY * (rows - 1)) / rows,
    gapX,
    gapY,
    x: (clientX - rect.left) / (scaleX || 1) - borderLeft - padLeft,
    y: (clientY - rect.top) / (scaleY || 1) - borderTop - padTop,
  };
}

/** The live size of one cell, measured from the grid element itself. */
export function gridCellSize(
  element: HTMLElement | null,
  cols: number,
  rows: number,
): { cellW: number; cellH: number } | null {
  const geometry = gridGeometry(element, 0, 0, cols, rows);
  return geometry ? { cellW: geometry.cellW, cellH: geometry.cellH } : null;
}

export interface GridMetrics {
  /** Content-box size of the grid in layout pixels. */
  width: number;
  height: number;
  cellW: number;
  cellH: number;
  gapX: number;
  gapY: number;
  /** Where the grid's content box starts inside the element. */
  offsetX: number;
  offsetY: number;
}

/**
 * The grid's own measurements, taken on mount and again whenever it resizes.
 * Anything drawn over a grid — a path overlay, a beam — reads its cell centres
 * from here, never from pointer coordinates.
 */
export function useGridMetrics(
  ref: React.RefObject<HTMLElement | null>,
  cols: number,
  rows: number,
): GridMetrics | null {
  const [metrics, setMetrics] = useState<GridMetrics | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => {
      const geometry = gridGeometry(element, 0, 0, cols, rows);
      if (!geometry) return;
      const style = window.getComputedStyle(element);
      const next: GridMetrics = {
        width: geometry.width,
        height: geometry.height,
        cellW: geometry.cellW,
        cellH: geometry.cellH,
        gapX: geometry.gapX,
        gapY: geometry.gapY,
        offsetX: number(style.paddingLeft) + number(style.borderLeftWidth),
        offsetY: number(style.paddingTop) + number(style.borderTopWidth),
      };
      setMetrics((current) =>
        current &&
        current.width === next.width &&
        current.height === next.height &&
        current.cellW === next.cellW &&
        current.cellH === next.cellH
          ? current
          : next,
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ref, cols, rows]);

  return metrics;
}

/** The pixel centre of a cell, from the grid's measured geometry. */
export function gridCellCentre(
  metrics: GridMetrics,
  cell: number,
  cols: number,
): { x: number; y: number } {
  const col = cell % cols;
  const row = Math.floor(cell / cols);
  return {
    x: metrics.offsetX + col * (metrics.cellW + metrics.gapX) + metrics.cellW / 2,
    y: metrics.offsetY + row * (metrics.cellH + metrics.gapY) + metrics.cellH / 2,
  };
}

/** Which track the position falls in: the containing cell, or the nearer one when in a gap. */
function trackAt(position: number, cell: number, gap: number, count: number): number | null {
  const pitch = cell + gap;
  if (position < -cell * 0.35 || position > count * pitch - gap + cell * 0.35) return null;
  const index = Math.floor(position / pitch);
  const inside = position - index * pitch;
  // Past the cell means the pointer is in the gap: take whichever centre is nearer.
  const chosen = inside <= cell + gap / 2 ? index : index + 1;
  return Math.max(0, Math.min(count - 1, chosen));
}

/** The column and row under the pointer, or null when it is off the grid. */
export function gridColRowAt(
  element: HTMLElement | null,
  clientX: number,
  clientY: number,
  cols: number,
  rows: number,
): { col: number; row: number } | null {
  const geometry = gridGeometry(element, clientX, clientY, cols, rows);
  if (!geometry) return null;
  const col = trackAt(geometry.x, geometry.cellW, geometry.gapX, cols);
  const row = trackAt(geometry.y, geometry.cellH, geometry.gapY, rows);
  if (col === null || row === null) return null;
  return { col, row };
}

/** The cell index under the pointer, using the grid's live measurements. */
export function gridCellAt(
  element: HTMLElement | null,
  clientX: number,
  clientY: number,
  cols: number,
  rows: number,
): number | null {
  const at = gridColRowAt(element, clientX, clientY, cols, rows);
  return at === null ? null : at.row * cols + at.col;
}

/**
 * Nearest adjacent cell centre for path drawing. A small corner dead-zone
 * prevents a diagonal gesture from jumping sideways when it only grazes a
 * corner; non-adjacent cells are never returned.
 */
export function adjacentGridCellAt(
  element: HTMLElement | null,
  clientX: number,
  clientY: number,
  cols: number,
  rows: number,
  from: number,
): number | null {
  const geometry = gridGeometry(element, clientX, clientY, cols, rows);
  if (!geometry) return null;
  const fromCol = from % cols;
  const fromRow = Math.floor(from / cols);
  let best: { cell: number; distance: number } | null = null;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const col = fromCol + dc;
      const row = fromRow + dr;
      if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
      const cx = col * (geometry.cellW + geometry.gapX) + geometry.cellW / 2;
      const cy = row * (geometry.cellH + geometry.gapY) + geometry.cellH / 2;
      const distance = Math.hypot(geometry.x - cx, geometry.y - cy);
      if (!best || distance < best.distance) best = { cell: row * cols + col, distance };
    }
  }
  if (!best) return null;
  const radius = Math.min(geometry.cellW, geometry.cellH) * 0.68;
  return best.distance <= radius ? best.cell : null;
}

/**
 * The one pointer handler every grid game uses: a tap or a drag reports the cell
 * under the finger, the pointer is captured so a drag never scrolls or drops,
 * and the same mapping serves the first touch and every move after it.
 */
export function useGridPointer(options: {
  cols: number;
  rows: number;
  onCell: ((cell: number) => void) | undefined;
  onRelease?: (() => void) | undefined;
}): {
  ref: React.RefObject<HTMLDivElement | null>;
  handlers: {
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
    style: React.CSSProperties;
  };
} {
  const { cols, rows, onCell, onRelease } = options;
  const ref = useRef<HTMLDivElement | null>(null);
  const down = useRef(false);

  const report = useCallback(
    (clientX: number, clientY: number) => {
      if (!onCell) return;
      const cell = gridCellAt(ref.current, clientX, clientY, cols, rows);
      if (cell !== null) onCell(cell);
    },
    [cols, rows, onCell],
  );

  const finish = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!down.current) return;
      down.current = false;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // The capture may already be gone; that is fine.
      }
      onRelease?.();
    },
    [onRelease],
  );

  return {
    ref,
    handlers: {
      style: { touchAction: "none", overscrollBehavior: "none" },
      onPointerDown: (event) => {
        if (!onCell) return;
        event.preventDefault();
        down.current = true;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Capture is a nicety; the move handler still works without it.
        }
        report(event.clientX, event.clientY);
      },
      onPointerMove: (event) => {
        if (!down.current) return;
        report(event.clientX, event.clientY);
      },
      onPointerUp: finish,
      onPointerCancel: finish,
    },
  };
}

export interface DragInfo<T> {
  item: T;
  /** Pixels moved since the drag began. */
  dx: number;
  dy: number;
  /** Current pointer position, in client coordinates. */
  x: number;
  y: number;
}

export interface DragSnap<T> {
  drag: DragInfo<T> | null;
  /** The item currently shaking after an illegal drop. */
  rejected: T | null;
  /** Bumps on every legal snap, so a piece can replay the pop. */
  snapped: number;
  /** Attach to a draggable element's onPointerDown. */
  start: (item: T) => (event: React.PointerEvent) => void;
  cancel: () => void;
}

export function useDragSnap<T>(options: {
  /** Return true when the drop is legal. */
  onDrop: (info: DragInfo<T>) => boolean;
  onStart?: (item: T) => void;
  onMove?: (info: DragInfo<T>) => void;
  disabled?: boolean;
}): DragSnap<T> {
  const { onDrop, onStart, onMove, disabled } = options;
  const [drag, setDrag] = useState<DragInfo<T> | null>(null);
  const [rejected, setRejected] = useState<T | null>(null);
  const [snapped, setSnapped] = useState(0);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const live = useRef<DragInfo<T> | null>(null);

  const cancel = useCallback(() => {
    origin.current = null;
    live.current = null;
    setDrag(null);
  }, []);

  const start = useCallback(
    (item: T) => (event: React.PointerEvent) => {
      if (disabled) return;
      event.preventDefault();
      origin.current = { x: event.clientX, y: event.clientY };
      const info: DragInfo<T> = { item, dx: 0, dy: 0, x: event.clientX, y: event.clientY };
      live.current = info;
      setDrag(info);
      setRejected(null);
      onStart?.(item);
    },
    [disabled, onStart],
  );

  useEffect(() => {
    if (!drag) return;

    const move = (event: PointerEvent) => {
      const from = origin.current;
      const current = live.current;
      if (!from || !current) return;
      const info: DragInfo<T> = {
        item: current.item,
        dx: event.clientX - from.x,
        dy: event.clientY - from.y,
        x: event.clientX,
        y: event.clientY,
      };
      live.current = info;
      setDrag(info);
      onMove?.(info);
    };

    const finish = () => {
      const info = live.current;
      origin.current = null;
      live.current = null;
      setDrag(null);
      if (!info) return;
      if (onDrop(info)) {
        hapticTick();
        setSnapped((value) => value + 1);
      } else {
        setRejected(info.item);
        setTimeout(() => setRejected(null), 320);
      }
    };

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
    // The listeners read the live drag through refs, so this only needs to run
    // when a drag starts or ends.
  }, [drag !== null, onDrop, onMove]); // eslint-disable-line react-hooks/exhaustive-deps

  return { drag, rejected, snapped, start, cancel };
}

/** Style for the piece under the finger: lifted, shadowed and above the grid. */
export function liftStyle(dx: number, dy: number, reducedMotion: boolean): React.CSSProperties {
  return {
    transform: `translate3d(${dx}px, ${dy - (reducedMotion ? 0 : 6)}px, 0) scale(${reducedMotion ? 1 : 1.06})`,
    boxShadow: reducedMotion ? undefined : "0 12px 22px rgba(0,0,0,0.45)",
    zIndex: 40,
    touchAction: "none",
    overscrollBehavior: "none",
    pointerEvents: "none",
  };
}

/** The dashed outline showing where a dragged piece will land. */
export function GhostOutline({ style }: { style: React.CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute rounded-lg border-2 border-dashed border-primary/70 bg-primary/10"
      style={style}
    />
  );
}

/**
 * The shared swipe behaviour used by Ice Slide and Push: one flick anywhere on
 * the board resolves to up, down, left or right once it clears the threshold.
 */
export function useSwipe(
  onSwipe: (dir: "U" | "D" | "L" | "R") => void,
  options: { disabled?: boolean; threshold?: number } = {},
): { onPointerDown: (event: React.PointerEvent) => void } {
  const { disabled = false, threshold = 24 } = options;
  const from = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const handler = useRef(onSwipe);
  handler.current = onSwipe;

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (disabled) return;
      from.current = { x: event.clientX, y: event.clientY };
      fired.current = false;
      // Capture the pointer so a flick never scrolls the page or drops mid-way.
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Capture is a nicety; the window listeners still finish the swipe.
      }

      const move = (moveEvent: PointerEvent) => {
        const origin = from.current;
        if (!origin || fired.current) return;
        const dx = moveEvent.clientX - origin.x;
        const dy = moveEvent.clientY - origin.y;
        if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
        fired.current = true;
        hapticTick();
        if (Math.abs(dx) > Math.abs(dy)) handler.current(dx > 0 ? "R" : "L");
        else handler.current(dy > 0 ? "D" : "U");
      };
      const finish = () => {
        from.current = null;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
      };
      window.addEventListener("pointermove", move, { passive: true });
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    },
    [disabled, threshold],
  );

  return { onPointerDown };
}

/**
 * The four arrow buttons in a diamond, within thumb reach. With `repeatMs` the
 * direction keeps firing while the button is held down.
 */
export function ArrowPad({
  onPress,
  disabled = false,
  repeatMs,
  size = 200,
  buttonSize = 60,
}: {
  onPress: (dir: "U" | "D" | "L" | "R") => void;
  disabled?: boolean;
  repeatMs?: number | undefined;
  size?: number;
  buttonSize?: number;
}) {
  const press = useRef(onPress);
  press.current = onPress;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(
    (dir: "U" | "D" | "L" | "R") => {
      if (disabled) return;
      press.current(dir);
      if (!repeatMs) return;
      stop();
      timer.current = setInterval(() => press.current(dir), repeatMs);
    },
    [disabled, repeatMs, stop],
  );

  const button = (dir: "U" | "D" | "L" | "R", glyph: string, label: string, className: string) => (
    <button
      key={dir}
      type="button"
      disabled={disabled}
      onPointerDown={(event) => {
        event.preventDefault();
        start(dir);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      aria-label={label}
      style={{ width: buttonSize, height: buttonSize }}
      className={`absolute flex items-center justify-center rounded-xl border border-border bg-card text-xl text-foreground transition-colors select-none touch-none active:bg-primary/20 disabled:opacity-40 ${className}`}
    >
      {glyph}
    </button>
  );
  return (
    <div className="relative mx-auto shrink-0" style={{ height: size, width: size }}>
      {button("U", "▲", "Up", "left-1/2 top-0 -translate-x-1/2")}
      {button("L", "◀", "Left", "left-0 top-1/2 -translate-y-1/2")}
      {button("R", "▶", "Right", "right-0 top-1/2 -translate-y-1/2")}
      {button("D", "▼", "Down", "bottom-0 left-1/2 -translate-x-1/2")}
    </div>
  );
}
