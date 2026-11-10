import { useId, useMemo } from "react";

import { avatarMarkup, type AvatarLook } from "./avatars";

/** One game avatar on its own (Customise's picker), drawn at `size` px. */
export function Avatar({ look, size, label }: { look: AvatarLook; size: number; label?: string }) {
  const prefix = `av${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-`;
  const html = useMemo(() => ({ __html: avatarMarkup(look, prefix) }), [look.id, look.colour, look.gem, prefix]);
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-avatar-art={look.id}
      style={{ display: "inline-block", width: size, height: size, flex: "none" }}
      dangerouslySetInnerHTML={html}
    />
  );
}
