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

import { PLAYER_COLOURS } from "@/lib/duel/playerLook";
import { ratingText, tierColour, type RankView } from "@/lib/rated/tierDisplay";

import { avatarMarkup, DEFAULT_AVATAR } from "./avatars";
import { CARD_ARTS, CARD_CHROME_CSS, CARD_MOTION_CSS, FRAMES, NAME_COLOURS } from "./playerCardArt.data";

export const DEFAULT_CARD_ART = "card-art.joulz-navy";
export const DEFAULT_FRAME = "frame.plain";

export interface CardLook {
  cardArt: string | null;
  frame: string | null;
  nameColour: string | null;
  avatar: { id: string; colour: number; gem: string | null } | null;
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
  const avatarHtml = useMemo(() => ({ __html: avatarMarkup(avatar, `${prefix}v-`) }), [avatar.id, avatar.colour, avatar.gem, prefix]);
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
            <span className="pcard-av" dangerouslySetInnerHTML={avatarHtml} />
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
