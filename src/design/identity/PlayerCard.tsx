/**
 * The player card (wave 2, session A2): one component, used everywhere a card shows (Profile, Customise's preview,
 * later the Shop's previews and other players' cards through getPublicCard).
 *
 * Built from the approved item sources (docs/art/wave-2/items, cut into playerCardArt.data.ts by
 * scripts/player-card-art.ts): the card art and the frame drawn in one svg exactly as the sources draw them, the
 * avatar from docs/art/avatars in the player's colour, the name in its name colour. The sample player on the art
 * (SkyRacer, Logician, Storm II, 2,046) is not part of any item.
 *
 * Card rules (docs/art/wave-2/README.md): the tier and rating always sit in a dark pill: once a player has placed in
 * rated play (wave 3, `rank`) the tier and division in the tier's colour and the rating in bold white even-width
 * digits; before placement the player number, "#0001", or "Guest"; every name colour keeps a dark edge (the
 * sources' own shadows and strokes); nothing decorative sits over scores or places (the card is never drawn in
 * standings). Legendaries, the Neon Circuit frame, Founding and Top 500 animate; every motion stops under
 * prefers-reduced-motion (the sources' own rules, scoped to `.pcard`).
 *
 * The card scales to its width (card units: `--pc-u`, one source pixel), 300 × 112 at 300 px wide.
 */
import { useId, useMemo } from "react";

import { Emblem, type Tier } from "@/design/art";
import { PLAYER_COLOURS } from "@/lib/duel/playerLook";
import { ratingText, tierColour, type RankView } from "@/lib/rated/tierDisplay";

import { avatarKey, avatarMarkup, DEFAULT_AVATAR } from "./avatars";
import { ensureCosmeticStyles, hasCosmetics, type AvatarCosmetics } from "./cosmetics";
import { CARD_ARTS, CARD_CHROME_CSS, CARD_MOTION_CSS, FRAMES, NAME_COLOURS } from "./playerCardArt.data";

export const DEFAULT_CARD_ART = "card-art.joulz-navy";
export const DEFAULT_FRAME = "frame.plain";

export interface CardLook {
  cardArt: string | null;
  frame: string | null;
  nameColour: string | null;
  avatar: ({ id: string; colour: number; gem: string | null } & AvatarCosmetics) | null;
}

const NO_BADGES: readonly string[] = [];

export const DEFAULT_LOOK: CardLook = { cardArt: DEFAULT_CARD_ART, frame: DEFAULT_FRAME, nameColour: null, avatar: null };

/* One <style> for every card on the page (the chrome and the items' motion), added once. */
const STYLE_ID = "jz-player-card-css";
function ensureCardStyles(): void {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `${CARD_CHROME_CSS}\n${CARD_MOTION_CSS}`;
  document.head.appendChild(el);
}

/** "#0042" (four digits at least). */
export function playerNumberLabel(n: number): string {
  return `#${String(Math.max(0, Math.floor(n))).padStart(4, "0")}`;
}

/** Fills a piece's id prefix (and the Founding frame's number) for one card. */
function fill(markup: string, prefix: string, founder: string): string {
  return markup.replaceAll("{{p}}", prefix).replaceAll("{{founder}}", founder);
}

/** Whether every piece of a look has art here (an unknown id draws the default, never nothing). */
export function knownLook(look: CardLook): { cardArt: string; frame: string; nameColour: string | null } {
  return {
    cardArt: look.cardArt && CARD_ARTS[look.cardArt] ? look.cardArt : DEFAULT_CARD_ART,
    frame: look.frame && FRAMES[look.frame] ? look.frame : DEFAULT_FRAME,
    nameColour: look.nameColour && NAME_COLOURS[look.nameColour] ? look.nameColour : null,
  };
}

export function PlayerCard({
  look,
  name,
  playerNumber,
  guest = false,
  guestColour = 0,
  title = null,
  badges = NO_BADGES,
  rank = null,
  label,
  className,
}: {
  look: CardLook;
  name: string;
  /** The account's player number (the pill until wave 3), or null. */
  playerNumber: number | null;
  /**
   * A guest's card: "Guest" in the pill and, in the avatar's place, their colour and initial (guests keep the room
   * badge's look; avatars come with an account). `guestColour` is the room look's colour index.
   */
  guest?: boolean;
  guestColour?: number;
  /** The title under the name (C2: the equipped title's name, Rookie by default); null draws none. */
  title?: string | null;
  /** Up to three badges on the card (C2: their slugs, in order); drawn bottom right from docs/art/badges. */
  badges?: readonly string[] | undefined;
  /**
   * The player's rated standing once placed (wave 3): the pill then shows the tier and division in the tier colour and
   * the rating. Null (before placement, or no rated play): the player number as before. Never for a guest.
   */
  rank?: Pick<RankView, "tier" | "label" | "rating"> | null;
  /** The card's accessible name (defaults to "{name}'s card"). */
  label?: string | undefined;
  className?: string;
}) {
  ensureCardStyles();
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const prefix = `pc${id}-`;
  const known = knownLook(look);
  const founder = playerNumberLabel(playerNumber ?? 0);
  // One { __html } object per markup (CLAUDE.md working rule 6): rebuilt only when the look changes.
  const svgHtml = useMemo(
    () => ({ __html: fill(CARD_ARTS[known.cardArt]!, `${prefix}a-`, founder) + fill(FRAMES[known.frame]!.markup, `${prefix}f-`, founder) }),
    [known.cardArt, known.frame, prefix, founder],
  );
  const avatar = look.avatar ?? DEFAULT_AVATAR;
  const avatarHtml = useMemo(() => ({ __html: avatarMarkup(avatar, `${prefix}v-`) }), [avatarKey(avatar), prefix]); // eslint-disable-line react-hooks/exhaustive-deps
  // Wave 2 E2: an avatar wearing a finish, accessory or special edition (its motion scoped to .jzc).
  const dressed = !guest && hasCosmetics(avatar);
  if (dressed) ensureCosmeticStyles();
  const nameStyle = known.nameColour ? NAME_COLOURS[known.nameColour]! : null;
  const ranked = !guest && rank ? rank : null;
  const pill = guest ? "Guest" : playerNumber && playerNumber > 0 ? playerNumberLabel(playerNumber) : null;
  return (
    <div
      role="img"
      aria-label={label ?? `${name}’s card`}
      data-player-card=""
      data-card-art={known.cardArt}
      data-frame={known.frame}
      data-name-colour={known.nameColour ?? "plain"}
      data-avatar={guest ? "initial" : avatar.id}
      className={`pcard${className ? ` ${className}` : ""}`}
    >
      <div className="pcard-in" aria-hidden="true">
        <svg
          className="pcard-svg"
          viewBox="0 0 300 112"
          preserveAspectRatio="none"
          style={FRAMES[known.frame]!.style}
          dangerouslySetInnerHTML={svgHtml}
        />
        <div className="pcard-row">
          {guest ? (
            <span
              className="pcard-av pcard-initial"
              data-card-initial=""
              style={{ ["--pc-badge" as string]: `var(--jz-player-${PLAYER_COLOURS[guestColour] ? guestColour : 0})` }}
            >
              {(Array.from(name.trim())[0] ?? "?").toLocaleUpperCase()}
            </span>
          ) : (
            <span className={dressed ? "pcard-av jzc" : "pcard-av"} dangerouslySetInnerHTML={avatarHtml} />
          )}
          <span className="pcard-text">
            {nameStyle ? (
              <span data-card-name="" className={`pcard-name ${nameStyle.className}`} style={nameStyle.style}>
                {name}
              </span>
            ) : (
              <span data-card-name="" data-plain="" className="pcard-name">
                {name}
              </span>
            )}
            {title ? (
              <span data-card-title="" className="pcard-title">
                {title}
              </span>
            ) : null}
            {ranked ? (
              <span data-card-pill="" data-card-rank={ranked.tier} className="pcard-pill">
                <span className="pcard-pill-label" style={{ color: tierColour(ranked.tier) }}>
                  {ranked.label}
                </span>
                <span className="pcard-pill-value">{ratingText(ranked.rating)}</span>
              </span>
            ) : pill ? (
              <span data-card-pill="" className="pcard-pill">
                <span className="pcard-pill-value">{pill}</span>
              </span>
            ) : null}
          </span>
        </div>
        {badges.length ? (
          <span className="pcard-badges" data-card-badges={badges.join(" ")}>
            {badges.slice(0, 3).map((slug) => (
              <img key={slug} src={`/art/badges/${slug}.svg`} alt="" data-card-badge={slug} draggable={false} />
            ))}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * One piece of a card on its own (Customise's tiles): a card art, or a frame over the Joulz Navy card art, with no
 * avatar or name, at the tile's width.
 */
export function CardPiece({ id }: { id: string }) {
  ensureCardStyles();
  const prefix = `pp${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-`;
  const frame = FRAMES[id];
  const n = playerNumberLabel(0);
  const html = useMemo(
    () => ({
      __html: frame
        ? fill(CARD_ARTS[DEFAULT_CARD_ART]!, `${prefix}a-`, n) + fill(frame.markup, `${prefix}f-`, n)
        : fill(CARD_ARTS[id] ?? CARD_ARTS[DEFAULT_CARD_ART]!, `${prefix}a-`, n) + fill(FRAMES[DEFAULT_FRAME]!.markup, `${prefix}f-`, n),
    }),
    [id, prefix, frame, n],
  );
  return (
    <span className="pcard cz-item-preview" aria-hidden="true" data-piece={id}>
      <svg className="pcard-svg" viewBox="0 0 300 112" preserveAspectRatio="none" style={frame?.style} dangerouslySetInnerHTML={html} />
    </span>
  );
}

/** A name tile draws the name at the card's own size (one card unit = 1 px), whatever the tile's width. */
const NAME_PIECE_UNITS = { ["--pc-u" as string]: "0.85px" } as const;

/** A name colour on its own (Customise's tiles): the player's name drawn in it, on the card's dark. */
export function NamePiece({ id, name }: { id: string | null; name: string }) {
  ensureCardStyles();
  const style = id ? NAME_COLOURS[id] : undefined;
  return (
    <span className="pcard cz-name-preview" aria-hidden="true" data-piece={id ?? "plain"}>
      <span className="pcard-in" style={NAME_PIECE_UNITS}>
        <span className="pcard-row">
          {style ? (
            <span className={`pcard-name ${style.className}`} style={style.style}>
              {name}
            </span>
          ) : (
            <span data-plain="" className="pcard-name">
              {name}
            </span>
          )}
        </span>
      </span>
    </span>
  );
}

/**
 * A player's card as a small square (lists: Friends, requests, search; Joe, 11 Nov 2026: a player's card, avatar and
 * frame show wherever they appear). The two ends of their card (card art and frame, the left 56 and right 56 card
 * units of the same sources, side by side, so the frame closes round the tile) with their avatar in the middle, in
 * its colour. No name, title or badges (the row writes the name). `size` is the tile's side in px.
 */
export function MiniCard({ look, size = 48, label }: { look: CardLook; size?: number; label?: string }) {
  ensureCardStyles();
  const prefix = `pm${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-`;
  const known = knownLook(look);
  const n = playerNumberLabel(0);
  const art = CARD_ARTS[known.cardArt]!;
  const frame = FRAMES[known.frame]!;
  // One { __html } object per markup (CLAUDE.md working rule 6).
  const ends = useMemo(
    () => ({
      __html:
        `<svg x="0" y="0" width="56" height="112" viewBox="0 0 56 112" preserveAspectRatio="none">` +
        fill(art, `${prefix}la-`, n) +
        fill(frame.markup, `${prefix}lf-`, n) +
        `</svg><svg x="56" y="0" width="56" height="112" viewBox="244 0 56 112" preserveAspectRatio="none">` +
        fill(art, `${prefix}ra-`, n) +
        fill(frame.markup, `${prefix}rf-`, n) +
        `</svg>`,
    }),
    [art, frame, prefix, n],
  );
  const avatar = look.avatar ?? DEFAULT_AVATAR;
  const avatarHtml = useMemo(() => ({ __html: avatarMarkup(avatar, `${prefix}v-`) }), [avatar.id, avatar.colour, avatar.gem, prefix]);
  const box = useMemo(() => ({ width: `${size}px`, height: `${size}px` }), [size]);
  return (
    <span
      className="pcard pcard-mini"
      style={box}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-mini-card=""
      data-card-art={known.cardArt}
      data-frame={known.frame}
      data-avatar={avatar.id}
      data-avatar-colour={avatar.colour}
    >
      <svg className="pcard-svg" viewBox="0 0 112 112" preserveAspectRatio="none" style={frame.style} dangerouslySetInnerHTML={ends} />
      <span className="pcard-mini-av" dangerouslySetInnerHTML={avatarHtml} />
    </span>
  );
}

/** The strip draws the card's own pieces at a fixed unit, so the name reads at ~15 px whatever the strip's width. */
const STRIP_UNITS = { ["--pc-u" as string]: "0.85px" } as const;

/**
 * A player's nameplate strip (Joe's rule, 11 Nov 2026: a player's card, avatar and frame show wherever they appear): the
 * player card's art and frame across a 44 px strip, the avatar and the username in its name colour. It sits in a list
 * row's name area only; places, scores and times stay outside it on the plain row. No title, pill or badges.
 */
export function CardStrip({
  look,
  name,
  label,
  playerNumber = null,
  tier = null,
  badges = NO_BADGES,
}: {
  look: CardLook;
  name: string;
  label?: string;
  /** For the Founding frame's number. */
  playerNumber?: number | null;
  /** W3a's shown tier id ("volt", "top500"…): its emblem after the name. */
  tier?: string | null;
  /** C2's badges on the card (up to three slugs). */
  badges?: readonly string[];
}) {
  ensureCardStyles();
  const prefix = `ps${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-`;
  const known = knownLook(look);
  const founder = playerNumberLabel(playerNumber ?? 0);
  // One { __html } object per markup (CLAUDE.md working rule 6).
  const svgHtml = useMemo(
    () => ({ __html: fill(CARD_ARTS[known.cardArt]!, `${prefix}a-`, founder) + fill(FRAMES[known.frame]!.markup, `${prefix}f-`, founder) }),
    [known.cardArt, known.frame, prefix, founder],
  );
  const avatar = look.avatar ?? DEFAULT_AVATAR;
  const avatarHtml = useMemo(() => ({ __html: avatarMarkup(avatar, `${prefix}v-`) }), [avatar.id, avatar.colour, avatar.gem, prefix]);
  const nameStyle = known.nameColour ? NAME_COLOURS[known.nameColour]! : null;
  return (
    <span
      role="img"
      aria-label={label ?? name}
      data-card-strip=""
      data-card-art={known.cardArt}
      data-frame={known.frame}
      data-name-colour={known.nameColour ?? "plain"}
      data-avatar={avatar.id}
      // The card's approved art (A2's items, judged against their pictures by identity-motion-check) is cosmetic art,
      // not the page skin, as a game's own art is: data-skin-off.
      data-skin-off=""
      className="pcard pcard-strip"
    >
      <span className="pcard-in" style={STRIP_UNITS} aria-hidden="true">
        <svg className="pcard-svg" viewBox="0 0 300 112" preserveAspectRatio="none" style={FRAMES[known.frame]!.style} dangerouslySetInnerHTML={svgHtml} />
        <span className="pcard-row">
          <span className="pcard-av" dangerouslySetInnerHTML={avatarHtml} />
          {nameStyle ? (
            <span data-card-name="" data-ellipsis="" className={`pcard-name ${nameStyle.className}`} style={nameStyle.style}>
              {name}
            </span>
          ) : (
            <span data-card-name="" data-ellipsis="" data-plain="" className="pcard-name">
              {name}
            </span>
          )}
          {tier ? <StripTier tier={tier} /> : null}
          {badges.length ? (
            <span className="pcard-strip-badges" data-card-badges={badges.slice(0, 3).join(" ")}>
              {badges.slice(0, 3).map((slug) => (
                <img key={slug} src={`/art/badges/${slug}.svg`} alt="" data-card-badge={slug} draggable={false} />
              ))}
            </span>
          ) : null}
        </span>
      </span>
    </span>
  );
}

const STRIP_TIERS: readonly Tier[] = ["spark", "charge", "volt", "surge", "storm", "lightning"];

/** A tier's emblem at nameplate size (the Top 500's own emblem, mockup 03's art, for the Top 500). */
function StripTier({ tier }: { tier: string }) {
  if (tier === "top500")
    return <img className="pcard-strip-tier" data-card-tier="top500" src="/art/emblems/top-500.svg" alt="" width={16} height={20} draggable={false} />;
  if (!(STRIP_TIERS as readonly string[]).includes(tier)) return null;
  return (
    <span className="pcard-strip-tier" data-card-tier={tier}>
      <Emblem tier={tier as Tier} size={18} marker={false} />
    </span>
  );
}
