import { useId, useMemo } from "react";

import { avatarKey, avatarMarkup, type AvatarLook } from "./avatars";
import { ensureCosmeticStyles, hasCosmetics } from "./cosmetics";

/** One game avatar on its own (Customise's picker), drawn at `size` px, with its equipped cosmetics (wave 2 E2). */
export function Avatar({ look, size, label }: { look: AvatarLook; size: number; label?: string }) {
  const prefix = `av${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-`;
  const key = avatarKey(look);
  const html = useMemo(() => ({ __html: avatarMarkup(look, prefix) }), [key, prefix]); // eslint-disable-line react-hooks/exhaustive-deps
  const dressed = hasCosmetics(look);
  if (dressed) ensureCosmeticStyles();
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-avatar-art={look.id}
      className={dressed ? "jzc" : undefined}
      style={{ display: "inline-block", width: size, height: size, flex: "none" }}
      dangerouslySetInnerHTML={html}
    />
  );
}
