import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ArcadeControlButtonProps = Omit<ButtonProps, "onPointerDown" | "onPointerUp" | "onPointerCancel"> & {
  children?: ReactNode;
  onPressStart?: (event: PointerEvent<HTMLButtonElement>) => void;
  onPressEnd?: (event: PointerEvent<HTMLButtonElement>) => void;
};

/** Directional arcade control with native iOS selection/callout suppression. */
export function ArcadeControlButton({
  children,
  className,
  onPressStart,
  onPressEnd,
  ...props
}: ArcadeControlButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const button = ref.current;
    if (!button) return;
    const block = (event: Event) => {
      if (event.cancelable) event.preventDefault();
    };
    button.addEventListener("touchstart", block, { passive: false });
    button.addEventListener("contextmenu", block);
    return () => {
      button.removeEventListener("touchstart", block);
      button.removeEventListener("contextmenu", block);
    };
  }, []);

  const finish = (event: PointerEvent<HTMLButtonElement>) => {
    onPressEnd?.(event);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <Button
      {...props}
      ref={ref}
      className={cn("touch-none select-none [-webkit-touch-callout:none] [-webkit-user-select:none]", className)}
      style={{ ...props.style, userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none", touchAction: "none" }}
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