import type { CSSProperties } from "react";

import { ICON_BODIES, ICON_LABELS, type IconName } from "../icons/icons.data";

export type { IconName };
export type IconSize = 18 | 20 | 22 | 24;
/** The token an icon is drawn in; `inherit` (the default) takes the text colour around it. */
export type IconTone = "inherit" | "text" | "text-2" | "text-3" | "gold" | "red" | "cyan";

export const ICON_NAMES = Object.keys(ICON_BODIES) as IconName[];

/**
 * One {__html} object per icon, made once: React 19 rewrites dangerouslySetInnerHTML whenever the object
 * changes, so a fresh one each render redrew every icon on each room or game clock tick (battery-check).
 */
const ICON_HTML = Object.fromEntries(ICON_NAMES.map((name) => [name, { __html: ICON_BODIES[name] }])) as Record<IconName, { __html: string }>;
export { ICON_LABELS };

/**
 * One Joulz icon (docs/icons/README.md; icon swap, 7 Nov 2026): the approved 24 × 24 drawing, 2 px stroke in
 * currentColor, inlined from src/design/icons/icons.data.ts (built from docs/icons/svg/ by
 * `bun scripts/icons-build.ts`), so nothing is fetched.
 *
 * - `size`: 18, 20, 22 or 24 px only (the stroke is never scaled differently); set inline, so it wins over any
 *   older `svg` size rule round it.
 * - `tone`: a colour token (`--jz-*`, components.css `.jz-icon[data-tone]`). Wrong (`cross`) is always `red`,
 *   a Done tick (`check`) marking success `cyan`, the active tab icon `gold`.
 * - Decorative (`aria-hidden`) by default; pass `label` only when the icon carries meaning of its own. An icon
 *   that is a button's only content stays decorative: the button carries the `aria-label`.
 */
export function Icon({
  name,
  size = 24,
  tone = "inherit",
  label,
  className,
  style,
}: {
  name: IconName;
  size?: IconSize;
  tone?: IconTone;
  label?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      data-icon={name}
      data-tone={tone === "inherit" ? undefined : tone}
      className={className ? `jz-icon ${className}` : "jz-icon"}
      style={{ width: size, height: size, ...style }}
      focusable="false"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      dangerouslySetInnerHTML={ICON_HTML[name]}
    />
  );
}
