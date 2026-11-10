import type { ReactNode } from "react";

import { Captain, type CaptainPose } from "@/design/art";

import { Button, ButtonLink, type ButtonSize } from "./Button";

/**
 * The empty and error state (wave 1, first impressions, 10 Nov 2026; docs/mockups/wave-1/ E1–E3, X1–X3):
 * Captain Joulz, one plain line and the action, on any screen with nothing to show yet or that couldn't
 * show what was asked for. Built once for today's lists, the not-found, offline and error screens, and the
 * later Friends ("No friends yet", wave 2) and Tournaments (with the schedule, wave 4) screens.
 *
 * - `layout="page"` (E1, E3, X1–X3): centred in the space it is given, the figure over a soft halo, a
 *   screen title, the line, then the buttons full width (gold first).
 * - `layout="card"` (E2): a panel inside a list's section, the figure small on the left, the title, the
 *   line and the action beside it.
 * - `tone`: the halo's colour, cool for an empty list or a missing page, red when something is wrong.
 *
 * `action` is the one thing to do (gold on a page, secondary in a card unless `gold` is set); `secondary`
 * an optional second, quieter way out (a page's "Back home"). `children` go between the line and the
 * buttons (the room-not-found code box). Any `data-*` attribute passes through to the outer element.
 */
export type EmptyStateAction = {
  label: string;
  onClick?: () => void;
  /** A link instead of a button (an outside page opens in a new tab). */
  href?: string;
  external?: boolean;
  /** Marks for checks (`{ "data-offline-practice": "" }`). */
  data?: Record<string, string>;
};

export type EmptyStateProps = {
  title: string;
  body: ReactNode;
  pose?: CaptainPose;
  tone?: "cool" | "alert";
  layout?: "page" | "card";
  action?: EmptyStateAction | undefined;
  /** Draw the action gold in a card (a page's action is always gold). */
  gold?: boolean;
  secondary?: EmptyStateAction | undefined;
  /** The title's heading level: 1 on a page that is only this state, 2 inside a page. */
  heading?: 1 | 2;
  children?: ReactNode;
  className?: string;
} & { [key: `data-${string}`]: string | boolean | undefined };

function ActionButton({
  action,
  variant,
  size,
  block = true,
}: {
  action: EmptyStateAction;
  variant: "gold" | "secondary";
  size: ButtonSize;
  block?: boolean;
}) {
  if (action.href)
    return (
      <ButtonLink
        href={action.href}
        variant={variant}
        size={size}
        block={block}
        {...(action.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        {...action.data}
      >
        {action.label}
      </ButtonLink>
    );
  return (
    <Button variant={variant} size={size} block={block} onClick={action.onClick} {...action.data}>
      {action.label}
    </Button>
  );
}

export function EmptyState({
  title,
  body,
  pose = "ready",
  tone = "cool",
  layout = "page",
  action,
  gold = false,
  secondary,
  heading = 2,
  children,
  className,
  ...data
}: EmptyStateProps) {
  const Heading = heading === 1 ? "h1" : "h2";
  if (layout === "card")
    return (
      <div data-empty-state="card" data-tone={tone} className={`jz-panel jz-empty-card${className ? ` ${className}` : ""}`} {...data}>
        <span aria-hidden="true" className="jz-empty-card-art">
          <Captain pose={pose} size={72} />
        </span>
        <div className="jz-empty-card-text">
          <Heading data-wrap-ok className="jz-empty-card-title">{title}</Heading>
          <p data-wrap-ok className="jz-empty-card-body">
            {body}
          </p>
          {children}
          {action || secondary ? (
            <div className="jz-empty-card-actions">
              {action ? <ActionButton action={action} variant={gold ? "gold" : "secondary"} size={44} block={false} /> : null}
              {secondary ? <ActionButton action={secondary} variant="secondary" size={44} block={false} /> : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  return (
    <div data-empty-state="page" data-tone={tone} className={`jz-empty${className ? ` ${className}` : ""}`} {...data}>
      <span aria-hidden="true" className="jz-empty-art">
        <Captain pose={pose} size={120} />
      </span>
      <div className="jz-empty-text">
        <Heading data-wrap-ok className="jz-empty-title">
          {title}
        </Heading>
        <p data-wrap-ok className="jz-empty-body">
          {body}
        </p>
      </div>
      {children}
      {action || secondary ? (
        <div className="jz-empty-actions">
          {action ? <ActionButton action={action} variant="gold" size={52} /> : null}
          {secondary ? <ActionButton action={secondary} variant="secondary" size={50} /> : null}
        </div>
      ) : null}
    </div>
  );
}
