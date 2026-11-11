/**
 * One player on a tournament board, standings or bracket row: the nameplate strip from A2's player card (Joe's rule of
 * 11 Nov 2026). Inside the name area only, never behind a place or a score: the card art as a band with the frame over
 * it, the avatar, the name in its name colour, the rated emblem and the card's badges, all from the plate the server
 * sent with the board (plates.ts; one call per page). A guest and a hidden under-18 keep the colour and initial, with no
 * cosmetics. The strip is a button: a tap opens the player's full card (PlayerCard) in a sheet, from the same plate.
 */
import { useId, useMemo, useState } from "react";

import { Emblem } from "@/design/art";
import { Sheet } from "@/design/components";
import { PlayerCard, DEFAULT_CARD_ART, DEFAULT_FRAME, playerNumberLabel } from "@/design/identity/PlayerCard";
import { avatarMarkup } from "@/design/identity/avatars";
import { CARD_ARTS, CARD_CHROME_CSS, CARD_MOTION_CSS, FRAMES, NAME_COLOURS } from "@/design/identity/playerCardArt.data";
import { PLAYER_COLOURS } from "@/lib/duel/playerLook";
import { plateInitial, type PlateView } from "@/lib/identity/plates";

/* The card's chrome and motion CSS, added once per page under PlayerCard's own id (a page with both adds it once). */
const STYLE_ID = "jz-player-card-css";
function ensureCardStyles(): void {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `${CARD_CHROME_CSS}\n${CARD_MOTION_CSS}`;
  document.head.appendChild(el);
}

const fill = (markup: string, prefix: string, founder: string) => markup.replaceAll("{{p}}", prefix).replaceAll("{{founder}}", founder);

const colourIndex = (n: number) => (PLAYER_COLOURS[n] ? n : 0);

export function TournamentPlate({ plate, you = false }: { plate: PlateView; you?: boolean }) {
  ensureCardStyles();
  const [open, setOpen] = useState(false);
  const prefix = `tp${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-`;
  const look = plate.kind === "card" ? plate.look : null;
  const cardArt = look && CARD_ARTS[look.cardArt] ? look.cardArt : DEFAULT_CARD_ART;
  const frame = look && FRAMES[look.frame] ? look.frame : DEFAULT_FRAME;
  const founder = playerNumberLabel(look?.playerNumber ?? 0);
  // One { __html } object per markup (CLAUDE.md working rule 6).
  const hasLook = look !== null;
  const bandHtml = useMemo(
    () => (hasLook ? { __html: fill(CARD_ARTS[cardArt]!, `${prefix}a-`, founder) + fill(FRAMES[frame]!.markup, `${prefix}f-`, founder) } : null),
    [hasLook, cardArt, frame, prefix, founder],
  );
  const avatarHtml = useMemo(
    () => (look ? { __html: avatarMarkup({ id: look.avatarId, colour: look.colour, gem: look.gem }, `${prefix}v-`) } : null),
    [look?.avatarId, look?.colour, look?.gem, prefix],
  );
  const nameStyle = look?.nameColour ? (NAME_COLOURS[look.nameColour] ?? null) : null;
  const discColour = plate.kind === "card" ? 0 : colourIndex(plate.colour);
  return (
    <>
      <button
        type="button"
        className="tn-plate"
        data-tn-plate={plate.kind}
        data-frame={look ? frame : undefined}
        data-card-art={look ? cardArt : undefined}
        aria-label={`${plate.name}${you ? " (you)" : ""}: open card`}
        onClick={() => setOpen(true)}
      >
        <span className={look ? "pcard tn-plate-area" : "tn-plate-area"} data-plate-area="">
          {bandHtml ? (
            <svg
              className="pcard-svg tn-plate-band"
              data-plate-band=""
              viewBox="0 0 300 112"
              preserveAspectRatio="none"
              aria-hidden="true"
              style={FRAMES[frame]!.style}
              dangerouslySetInnerHTML={bandHtml}
            />
          ) : null}
          <span className="tn-plate-row">
            {avatarHtml ? (
              <span className="tn-plate-disc tn-plate-framed" aria-hidden="true" data-plate-avatar={look!.avatarId} dangerouslySetInnerHTML={avatarHtml} />
            ) : (
              <span
                className="tn-plate-disc tn-plate-initial"
                aria-hidden="true"
                data-plate-initial=""
                style={{ ["--tn-plate-badge" as string]: `var(--jz-player-${discColour})` }}
              >
                {plateInitial(plate)}
              </span>
            )}
            {nameStyle ? (
              <span data-plate-name="" data-name-colour={look!.nameColour!} className={`pcard-name tn-plate-name ${nameStyle.className}`} style={nameStyle.style}>
                {plate.name}
              </span>
            ) : (
              <span data-plate-name="" className="tn-plate-name tn-plate-plain">
                {plate.name}
              </span>
            )}
            {look?.emblem ? (
              <Emblem tier={look.emblem.tier} division={look.emblem.division} rank={look.emblem.rank} size={22} marker={false} label={look.emblem.label} className="tn-plate-emblem" />
            ) : null}
            {look && look.badges.length ? (
              <span className="tn-plate-badges" data-plate-badges={look.badges.join(" ")} aria-hidden="true">
                {look.badges.map((slug) => (
                  <img key={slug} src={`/art/badges/${slug}.svg`} alt="" draggable={false} />
                ))}
              </span>
            ) : null}
          </span>
        </span>
        {you ? <span className="tn-plate-you">(you)</span> : null}
      </button>
      {open ? (
        <Sheet open onClose={() => setOpen(false)} title={plate.name} closeLabel="Close card" data={{ "data-plate-card": plate.kind }}>
          <PlayerCard
            look={
              look
                ? { cardArt, frame, nameColour: look.nameColour, avatar: { id: look.avatarId, colour: look.colour, gem: look.gem } }
                : { cardArt: DEFAULT_CARD_ART, frame: DEFAULT_FRAME, nameColour: null, avatar: null }
            }
            name={plate.name}
            playerNumber={look?.playerNumber ?? null}
            guest={!look}
            guestColour={discColour}
            title={look?.title ?? null}
            badges={look?.badges ?? []}
          />
        </Sheet>
      ) : null}
    </>
  );
}
