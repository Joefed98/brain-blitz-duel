import { forwardRef, type ReactNode, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type HTMLAttributes } from "react";

/**
 * A row inside a Panel (DESIGN.md section 5): 62 px tall at least, the divider above every row but the
 * first, starting after its icon (`icon` names the icon's width: "sq" 40, "44", "date", or any data-icon
 * the stylesheet knows). As a button or link it is interactive (hover, pressed and focus states).
 * `title` / `sub` draw the usual two lines after `leading` (an icon) and before the children (a value,
 * a chevron, a switch).
 */
type Common = { icon?: string; leading?: ReactNode; title?: ReactNode; sub?: ReactNode; children?: ReactNode };
type AsDiv = Common & Omit<HTMLAttributes<HTMLDivElement>, "title"> & { as?: "div" | "li" };
type AsButton = Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> & { as: "button" };
type AsLink = Common & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "title"> & { as: "a" };
export type RowProps = AsDiv | AsButton | AsLink;

export const Row = forwardRef<HTMLElement, RowProps>(function Row(props, ref) {
  const { as: Tag = "div", icon, leading, title, sub, children, className, ...rest } = props as Common & {
    as?: "div" | "li" | "button" | "a";
    className?: string;
  } & Record<string, unknown>;
  const interactive = Tag === "button" || Tag === "a";
  return (
    <Tag
      ref={ref as never}
      {...(Tag === "button" ? { type: "button" } : {})}
      data-jz="row"
      data-icon={icon}
      data-interactive={interactive ? "" : undefined}
      className={`jz-row${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {leading}
      {title !== undefined || sub !== undefined ? <RowText title={title} sub={sub} /> : null}
      {children}
    </Tag>
  );
});

/** A row's two lines (title over sub), each one line with an ellipsis. */
export function RowText({ title, sub }: { title?: ReactNode; sub?: ReactNode }) {
  return (
    <span className="jz-row-text">
      {title !== undefined ? <span className="jz-row-title">{title}</span> : null}
      {sub !== undefined ? (
        <span data-ellipsis className="jz-row-sub">
          {sub}
        </span>
      ) : null}
    </span>
  );
}
