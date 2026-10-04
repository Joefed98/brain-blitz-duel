import { useEffect, useRef, type PointerEvent, type ReactNode, type RefObject } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ArcadeControlButtonProps = Omit<ButtonProps, "onPointerDown" | "onPointerUp" | "onPointerCancel"> & {
  children?: ReactNode;
  onPressStart?: (event: PointerEvent<HTMLButtonElement>) => void;
  onPressEnd?: (event: PointerEvent<HTMLButtonElement>) => void;
};

export function usePressSafeElement(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const block = (event: Event) => {
      if (event.cancelable) event.preventDefault();
    };
    element.addEventListener("touchstart", block, { passive: false });
    element.addEventListener("contextmenu", block);
    return () => {
      element.removeEventListener("touchstart", block);
      element.removeEventListener("contextmenu", block);
    };
  }, [ref]);
}

/** Directional arcade control with native iOS selection/callout suppression. */
export function ArcadeControlButton({
  children,
  className,
  onPressStart,
  onPressEnd,
  ...props
}: ArcadeControlButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);

  usePressSafeElement(ref);

  const finish = (event: PointerEvent<HTMLButtonElement>) => {
    onPressEnd?.(event);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <Button
      {...props}
      ref={ref}
      className={cn("touch-none select-none [-webkit-touch-callout:none] [-webkit-user-select:none]", className)}
      style={{ ...props.style, userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent", touchAction: "none" }}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        onPressStart?.(event);
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={(event) => onPressEnd?.(event)}
    >
      <span aria-hidden="true" className="pointer-events-none select-none [-webkit-user-select:none]">{children}</span>
    </Button>
  );
}