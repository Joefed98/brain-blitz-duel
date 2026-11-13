/**
 * The one way to draw a player in a list row (Joe's rule, 11 Nov 2026: a player's card, avatar and frame show wherever
 * they appear). Leaderboards (W4a) use it; W4b's tournament boards and W4c's brackets switch to it. How to use it:
 * docs/nameplate.md.
 *
 * - `NameplateStrip` draws the name area only (cosmetics never behind places, scores or times): a visible account's
 *   nameplate strip (card art band, frame, avatar, name colour, tier emblem, badges), a guest's colour and initial, or a
 *   hidden player's plain neutral disc and "Hidden player". It is never a button: the row decides what a tap does,
 *   with `nameplateOpens(player)` saying whether it may open the card.
 * - `NameplateSheet` is the tap-to-open full card (A2's PlayerCard with title and badges); it draws nothing for a
 *   player who may not be opened. `useNameplateSheet()` holds the one open at a time.
 */
import { useState, type ReactNode } from "react";

import { PlayerBadge } from "@/components/duel/PlayerBadge";
import { Sheet } from "@/design/components";
import { titleName } from "@/lib/badges/catalogue";

import { nameplateLook, nameplateName, nameplateOpens, type NameplatePlayer } from "./nameplate";
import { CardStrip, PlayerCard } from "./PlayerCard";

/** A player's name area in a row. `label` overrides the written name (e.g. "Nova (you)"); never for a hidden player. */
export function NameplateStrip({ player, label }: { player: NameplatePlayer; label?: string }) {
  if (player.kind === "hidden") {
    return (
      <span className="nameplate" data-nameplate="hidden" data-hidden-player="">
        <span className="nameplate-disc" aria-hidden="true" data-hidden-disc="" />
        <span className="nameplate-name th-name" data-ellipsis="" data-plain-hidden="">
          {nameplateName(player)}
        </span>
      </span>
    );
  }
  const name = label ?? player.name;
  if (player.kind === "plain") {
    return (
      <span className="nameplate" data-nameplate="plain">
        {player.colour === null ? (
          <span className="nameplate-disc" aria-hidden="true" data-initial="">
            {player.name.slice(0, 1).toUpperCase()}
          </span>
        ) : (
          <PlayerBadge look={{ colour: player.colour, icon: player.icon ?? null }} name={player.name} size={36} />
        )}
        <span className="nameplate-name th-name" data-ellipsis="">
          {name}
        </span>
      </span>
    );
  }
  return (
    <span className="nameplate" data-nameplate="card">
      <CardStrip
        look={nameplateLook(player.card)}
        name={name}
        playerNumber={player.playerNumber ?? null}
        tier={player.tier ?? null}
        badges={player.card.badges}
      />
    </span>
  );
}

/**
 * A player's full card in a sheet, opened from their row. `children` is the line under the card (a place and score,
 * "Seed 3"…). Draws nothing unless `nameplateOpens(player)`: a hidden or plain player has no card to open.
 */
export function NameplateSheet({
  player,
  onClose,
  children,
}: {
  player: NameplatePlayer | null;
  onClose: () => void;
  children?: ReactNode;
}) {
  if (!nameplateOpens(player)) return null;
  return (
    <Sheet onClose={onClose} title={player.name} closeLabel="Close card" data={{ "data-card-sheet": "" }}>
      <div className="nameplate-sheet" data-names="">
        <NameplateFullCard player={player} />
        {children ? <p className="nameplate-sheet-line">{children}</p> : null}
      </div>
    </Sheet>
  );
}

/**
 * A player's full card as their row opens it (A2's PlayerCard with title and badges), for a sheet that holds more than
 * the card (the lobby's report reasons). Nothing for a player who may not be opened.
 */
export function NameplateFullCard({ player }: { player: NameplatePlayer | null | undefined }) {
  if (!nameplateOpens(player)) return null;
  return (
    <PlayerCard
      look={nameplateLook(player.card)}
      name={player.name}
      playerNumber={player.playerNumber ?? null}
      title={titleName(player.card.title)}
      badges={player.card.badges}
      label={`${player.name}’s card`}
    />
  );
}

/** The row whose card is open (one at a time): `[open, openRow, close]`. */
export function useNameplateSheet<T>(): [T | null, (row: T) => void, () => void] {
  const [open, setOpen] = useState<T | null>(null);
  return [open, setOpen, () => setOpen(null)];
}
