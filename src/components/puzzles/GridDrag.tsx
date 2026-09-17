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

/** The four arrow buttons in a diamond, within thumb reach. */
export function ArrowPad({
  onPress,
  disabled = false,
}: {
  onPress: (dir: "U" | "D" | "L" | "R") => void;
  disabled?: boolean;
}) {
  const button = (dir: "U" | "D" | "L" | "R", glyph: string, label: string, className: string) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPress(dir)}
      aria-label={label}
      className={`absolute flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-lg text-foreground transition-colors active:bg-primary/20 disabled:opacity-40 ${className}`}
    >
      {glyph}
    </button>
  );
  return (
    <div className="relative mx-auto h-[132px] w-[132px] shrink-0">
      {button("U", "▲", "Up", "left-1/2 top-0 -translate-x-1/2")}
      {button("L", "◀", "Left", "left-0 top-1/2 -translate-y-1/2")}
      {button("R", "▶", "Right", "right-0 top-1/2 -translate-y-1/2")}
      {button("D", "▼", "Down", "bottom-0 left-1/2 -translate-x-1/2")}
    </div>
  );
}
