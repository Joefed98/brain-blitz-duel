import { X } from "lucide-react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { Drawer } from "vaul";

import { Button } from "./Button";

/**
 * A bottom sheet (DESIGN.md section 5) on vaul: it follows the finger and a drag down past the
 * threshold dismisses it; a tap on the scrim, the ✕ or Escape closes it too. One shadow
 * (--jz-shadow-sheet), 20 px top corners, the grab handle on top.
 *
 * `skin` marks the sheet's own page skin (data-skin, theme.css / room-screens.css); `data` carries the
 * sheet's markers for checks (data-settings-sheet…), set on the dialog element itself.
 */
export function Sheet({
  open = true,
  onClose,
  title,
  closeLabel,
  skin,
  data,
  className,
  style,
  children,
  footer,
  header,
  repositionInputs,
  onKeyDown,
}: {
  open?: boolean;
  onClose: () => void;
  /** The visible heading (also the dialog's name). */
  title: string;
  /** The ✕'s accessible name, e.g. "Close settings". */
  closeLabel?: string;
  skin?: string;
  data?: Record<`data-${string}`, string>;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  /** Pinned under the scrolling body (a Save button). */
  footer?: ReactNode;
  /** A sheet's own header in place of the title and ✕ (the chat's expand toggle); the title stays the dialog's name. */
  header?: ReactNode;
  /** vaul's keyboard handling; off where the sheet places itself over the keyboard (the chat). */
  repositionInputs?: boolean;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={(next) => (next ? undefined : onClose())} repositionInputs={repositionInputs ?? true}>
      <Drawer.Portal>
        <Drawer.Overlay data-skin={skin} className="jz-sheet-scrim" />
        <Drawer.Content
          aria-label={title}
          aria-describedby={undefined}
          data-jz="sheet"
          data-skin={skin}
          {...data}
          className={`jz-sheet${className ? ` ${className}` : ""}`}
          style={style}
          onKeyDown={onKeyDown}
        >
          <div aria-hidden="true" className="jz-sheet-grab" />
          {header ? (
            <>
              <Drawer.Title className="jz-sr-only">{title}</Drawer.Title>
              {header}
            </>
          ) : (
            <div className="jz-sheet-head">
              <Drawer.Title asChild>
                <h2>{title}</h2>
              </Drawer.Title>
              <Button variant="icon" onClick={onClose} aria-label={closeLabel ?? `Close ${title.toLowerCase()}`}>
                <X aria-hidden="true" />
              </Button>
            </div>
          )}
          {children}
          {footer}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
