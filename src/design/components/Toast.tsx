import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";

/**
 * A toast (DESIGN.md section 5): a surface strip with a 3 px edge in its tone, `info` (grey), `live`
 * (cyan: something happening now, a message from another player) or `error` (red). Placement is the
 * caller's (each screen already knows where its toasts go). With `as="button"` the whole toast is the
 * tap target (the chat toast opens the messages).
 */
type Tone = "info" | "live" | "error";
type AsDiv = { as?: "div"; tone?: Tone; children: ReactNode } & HTMLAttributes<HTMLDivElement>;
type AsButton = { as: "button"; tone?: Tone; children: ReactNode } & ButtonHTMLAttributes<HTMLButtonElement>;

export const Toast = forwardRef<HTMLElement, AsDiv | AsButton>(function Toast(props, ref) {
  const { as = "div", tone = "info", className, ...rest } = props as unknown as { as?: "div" | "button"; tone?: Tone; className?: string } & Record<string, unknown>;
  const shared = {
    "data-jz": "toast",
    "data-tone": tone,
    className: `jz-toast${className ? ` ${className}` : ""}`,
  };
  if (as === "button") return <button ref={ref as never} type="button" {...shared} {...rest} />;
  return <div ref={ref as never} role={tone === "error" ? "alert" : "status"} {...shared} {...rest} />;
});
