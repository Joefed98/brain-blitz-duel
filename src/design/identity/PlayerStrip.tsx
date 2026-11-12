/**
 * The nameplate strip from A2's player card (Joe, 11 Nov 2026: a player's card, avatar and frame show wherever they
 * appear): the avatar in the player's colour, then the name in its name colour, with the card art and frame drawn
 * behind that name area only. Rows draw places, scores, records and points outside the strip, so no cosmetic ever
 * sits behind them. A guest gets colour and initial; a hidden player a plain neutral disc and "Hidden player"; a
 * deleted player the plain name, nothing else.
 * One { __html } object per markup (CLAUDE.md working rule 6).
 */
import { useId, useMemo } from "react";

import type { PlayerStripLook } from "@/lib/identity/playerStrip";
import { PLAYER_COLOURS } from "@/lib/duel/playerLook";

import { avatarMarkup } from "./avatars";
import { CARD_ARTS, CARD_CHROME_CSS, CARD_MOTION_CSS, FRAMES, NAME_COLOURS } from "./playerCardArt.data";
import { knownLook } from "./PlayerCard";

const STYLE_ID = "jz-player-card-css";
function ensureCardStyles(): void {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `${CARD_CHROME_CSS}\n${CARD_MOTION_CSS}`;
  document.head.appendChild(el);
}

const fill = (markup: string, prefix: string) => markup.replaceAll("{{p}}", prefix).replaceAll("{{founder}}", "");

export function PlayerStrip({ player, you = false }: { player: PlayerStripLook; you?: boolean }) {
  ensureCardStyles();
  const prefix = `ps${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-`;
  const account = player.kind === "account";
  const known = knownLook({ cardArt: player.cardArt, frame: player.frame, nameColour: player.nameColour, avatar: null });
  const artHtml = useMemo(() => (account ? { __html: fill(CARD_ARTS[known.cardArt]!, `${prefix}a-`) } : null), [account, known.cardArt, prefix]);
  const frameHtml = useMemo(() => (account ? { __html: fill(FRAMES[known.frame]!.markup, `${prefix}f-`) } : null), [account, known.frame, prefix]);
  const avatarId = player.avatar?.id ?? null;
  const gem = player.avatar?.gem ?? null;
  const avatarHtml = useMemo(
    () => (account && avatarId ? { __html: avatarMarkup({ id: avatarId, colour: player.colour, gem }, `${prefix}v-`) } : null),
    [account, avatarId, player.colour, gem, prefix],
  );
  const nameStyle = account && known.nameColour ? NAME_COLOURS[known.nameColour]! : null;
  const label = `${player.name}${you ? " (you)" : ""}`;
  return (
    <span
      className={`pcard pstrip${account ? "" : " pstrip-plain"}`}
      data-player-strip={player.kind}
      data-card-art={account ? known.cardArt : undefined}
      data-frame={account ? known.frame : undefined}
      data-name-colour={account ? (known.nameColour ?? "plain") : undefined}
      data-avatar={account ? (avatarId ?? undefined) : player.kind === "guest" ? "initial" : undefined}
      aria-label={label}
      role="img"
    >
      <span className="pcard-in" aria-hidden="true">
        {artHtml ? <svg className="pcard-svg pstrip-art" viewBox="0 0 300 112" preserveAspectRatio="xMidYMid slice" dangerouslySetInnerHTML={artHtml} /> : null}
        {frameHtml ? (
          <svg className="pcard-svg pstrip-frame" viewBox="0 0 300 112" preserveAspectRatio="none" style={FRAMES[known.frame]!.style} dangerouslySetInnerHTML={frameHtml} />
        ) : null}
        <span className="pcard-row">
          {avatarHtml ? (
            <span className="pcard-av" dangerouslySetInnerHTML={avatarHtml} />
          ) : player.kind === "guest" ? (
            <span
              className="pcard-av pcard-initial"
              data-strip-initial=""
              style={{ ["--pc-badge" as string]: `var(--jz-player-${PLAYER_COLOURS[player.colour] ? player.colour : 0})` }}
            >
              {(Array.from(player.name.trim())[0] ?? "?").toLocaleUpperCase()}
            </span>
          ) : player.kind === "hidden" ? (
            <span className="pcard-av pstrip-disc" data-strip-disc="" />
          ) : null}
          {nameStyle ? (
            <span data-strip-name="" className={`pcard-name ${nameStyle.className}`} style={nameStyle.style}>
              {label}
            </span>
          ) : (
            <span data-strip-name="" data-plain="" className="pcard-name">
              {label}
            </span>
          )}
        </span>
      </span>
    </span>
  );
}
