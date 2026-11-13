/** The player card and the avatars (wave 2). Import from `@/design/identity`. */
export { PlayerCard, MiniCard, CardPiece, CardStrip, NamePiece, DEFAULT_LOOK, DEFAULT_CARD_ART, DEFAULT_FRAME, knownLook, playerNumberLabel, type CardLook } from "./PlayerCard";
export { NameplateStrip, NameplateSheet, useNameplateSheet } from "./NameplateStrip";
export {
  nameplateLook,
  nameplateName,
  nameplateOpens,
  HIDDEN_PLAYER_NAME,
  DELETED_PLAYER_NAME,
  type NameplateCard,
  type NameplatePlayer,
} from "./nameplate";
export { Avatar } from "./Avatar";
export { PlayerStrip } from "./PlayerStrip";
export { AVATARS, GEMS, DEFAULT_AVATAR, DEFAULT_AVATAR_ID, avatarMarkup, avatarStops, shade, type AvatarLook } from "./avatars";
export { avatarKey } from "./avatars";
export {
  celebrationScene,
  dressAvatar,
  emoteCode,
  emoteOf,
  ensureCosmeticStyles,
  hasCosmetics,
  reactionEmotes,
  tileStyleArt,
  type AvatarCosmetics,
} from "./cosmetics";
