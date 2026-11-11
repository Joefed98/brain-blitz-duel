import { useState, type ReactNode } from "react";

import { PlayerBadge } from "@/components/duel/PlayerBadge";
import { Medal, Sheet } from "@/design/components";
import { CardStrip, PlayerCard, type CardLook } from "@/design/identity";
import { titleName } from "@/lib/badges/catalogue";
import {
  boardTime,
  ordinal,
  rowName,
  top500Label,
  type BoardCard,
  type BoardRow,
} from "@/lib/leaderboards/boards";

/** A row's card as A2's card look (the avatar in the account's colour). */
export function cardLookOf(card: BoardCard): CardLook {
  return {
    cardArt: card.cardArt,
    frame: card.frame,
    nameColour: card.nameColour,
    avatar: { id: card.avatarId, colour: card.colour, gem: card.gem },
  };
}

/** The Top 500 emblem (mockup 03's small size, `public/art/emblems/top-500.svg`). */
export const TOP500_EMBLEM_URL = "/art/emblems/top-500.svg";

/** "Top 500 #37" with its emblem. */
export function Top500Line({ rank }: { rank: number }) {
  return (
    <span className="lb-top500" data-top500={rank}>
      <img src={TOP500_EMBLEM_URL} alt="" aria-hidden="true" width={16} height={20} />
      <span>{top500Label(rank)}</span>
    </span>
  );
}

/** A row's place: the medal art for 1st to 3rd, the number from 4th; shared places marked. */
function Place({ rank, shared }: { rank: number; shared: boolean }) {
  return (
    <span className="lb-place">
      <Medal place={rank} shared={shared} />
    </span>
  );
}

/** A player's disc: their colour and initial, or a plain disc for a hidden or deleted player. */
function Disc({ row }: { row: BoardRow }) {
  if (row.colour === null || !row.name)
    return <span className="lb-disc" aria-hidden="true" data-hidden-disc />;
  return <PlayerBadge look={{ colour: row.colour, icon: null }} name={row.name} size={36} />;
}

/** A row that opens a full card: a visible player with a card (never a hidden or deleted row). */
export function canOpenCard(row: BoardRow): boolean {
  return !!row.card && !row.hidden && !row.deleted && !!row.name;
}

/**
 * One board row (mockups 01 and 02): place, then the player's nameplate strip (Joe's rule of 11 Nov 2026: the card's art,
 * avatar, frame, name colour, tier emblem and badges, in the name area only) or, with no card, the plain disc and name;
 * then the Daily's time and the value, on the plain row. A visible player's row opens their full card. A hidden player
 * is "Hidden player" in their place, rank and value unchanged, no card and nothing to open.
 */
export function BoardRowView({
  row,
  shared,
  pinned = false,
  showTime = false,
  sub,
  onOpen,
}: {
  row: BoardRow;
  shared: boolean;
  pinned?: boolean;
  showTime?: boolean;
  sub?: ReactNode;
  onOpen?: ((row: BoardRow) => void) | undefined;
}) {
  const name = rowName(row);
  const open = onOpen && canOpenCard(row) ? () => onOpen(row) : undefined;
  const parts = (
    <>
      {pinned ? (
        <span className="lb-place lb-place-me">{row.rank.toLocaleString("en-GB")}</span>
      ) : (
        <Place rank={row.rank} shared={shared} />
      )}
      {row.card ? null : <Disc row={row} />}
      <span className="lb-who">
        {row.card ? (
          <CardStrip
            look={cardLookOf(row.card)}
            name={name}
            playerNumber={row.playerNumber}
            tier={row.tier ?? null}
            badges={row.card.badges}
          />
        ) : (
          <span className="lb-name" data-ellipsis>
            {name}
          </span>
        )}
        {row.top500 ? (
          <Top500Line rank={row.top500} />
        ) : sub ? (
          <span className="lb-sub" data-ellipsis>
            {sub}
          </span>
        ) : null}
      </span>
      {showTime && typeof row.timeMs === "number" ? (
        <span className="lb-time">{boardTime(row.timeMs)}</span>
      ) : null}
      <span className="lb-value">{row.value.toLocaleString("en-GB")}</span>
    </>
  );
  const label = `${row.rank}${shared ? " (shared)" : ""}, ${name}, ${row.value.toLocaleString("en-GB")}`;
  return (
    <li
      className="lb-row"
      data-board-row={row.rank}
      data-me={row.isMe ? "" : undefined}
      data-pinned={pinned ? "" : undefined}
      data-hidden-player={row.hidden ? "" : undefined}
      data-has-card={row.card ? "" : undefined}
    >
      {open ? (
        <button
          type="button"
          className="lb-row-in press"
          onClick={open}
          aria-label={`${label}. Open card`}
          data-open-card
        >
          {parts}
        </button>
      ) : (
        <span className="lb-row-in" aria-label={label}>
          {parts}
        </span>
      )}
    </li>
  );
}

/** Whether a row shares its place with the row before or after it. */
function sharedAt(rows: readonly BoardRow[], i: number): boolean {
  const r = rows[i]!;
  return (
    (i > 0 && rows[i - 1]!.rank === r.rank) || (i + 1 < rows.length && rows[i + 1]!.rank === r.rank)
  );
}

/**
 * A board: its rows, then your own row pinned below when it isn't among them (mockups 01 and 02). `footer` sits
 * between the list and the pinned row ("Scroll for the top 500", "…").
 */
export function BoardList({
  rows,
  me,
  showTime = false,
  footer,
  meSub,
  label,
  onOpen,
}: {
  rows: readonly BoardRow[];
  me: BoardRow | null | undefined;
  showTime?: boolean;
  footer?: ReactNode;
  meSub?: ReactNode;
  label: string;
  onOpen?: (row: BoardRow) => void;
}) {
  const meShown = rows.some((r) => r.isMe);
  return (
    <div className="lb-board" data-board-list>
      <ol className="lb-rows" aria-label={label}>
        {rows.map((row, i) => (
          <BoardRowView
            key={`${row.rank}-${i}`}
            row={row}
            shared={sharedAt(rows, i)}
            showTime={showTime}
            onOpen={onOpen}
          />
        ))}
      </ol>
      {footer}
      {me && !meShown ? (
        <ol className="lb-rows lb-pinned" aria-label="Your place" data-board-pinned>
          <BoardRowView
            row={me}
            shared={false}
            pinned
            showTime={showTime}
            sub={meSub}
            onOpen={onOpen}
          />
        </ol>
      ) : null}
    </div>
  );
}

/**
 * The top 3 as full cards above the rows (Joe's rule, 11 Nov 2026), podium-style: 1st in the middle on wide screens,
 * stacked 1st, 2nd, 3rd on phones. Places and scores sit under each card, never on it. A hidden player keeps "Hidden
 * player" with no card; a tap on a card opens it.
 */
export function BoardPodium({
  rows,
  showTime = false,
  onOpen,
}: {
  rows: readonly BoardRow[];
  showTime?: boolean;
  onOpen?: (row: BoardRow) => void;
}) {
  const top = rows.slice(0, 3).filter((r) => r.rank <= 3);
  if (top.length === 0) return null;
  return (
    <ol className="lb-podium" aria-label="Top 3" data-board-podium={top.length}>
      {top.map((row, i) => {
        const name = rowName(row);
        const shared = sharedAt(rows, i);
        const card =
          row.card && canOpenCard(row) ? (
            <PlayerCard
              look={cardLookOf(row.card)}
              name={row.name!}
              playerNumber={row.playerNumber}
              title={titleName(row.card.title)}
              badges={row.card.badges}
              label={`${name}’s card`}
            />
          ) : (
            <span className="lb-podium-plain" data-hidden-player={row.hidden ? "" : undefined}>
              <Disc row={row} />
              <span className="lb-name" data-ellipsis>
                {name}
              </span>
            </span>
          );
        return (
          <li
            key={`${row.rank}-${i}`}
            className="lb-podium-step"
            data-podium-place={i + 1}
            data-me={row.isMe ? "" : undefined}
          >
            {onOpen && canOpenCard(row) ? (
              <button
                type="button"
                className="lb-podium-card press"
                data-names=""
                data-skin-off=""
                onClick={() => onOpen(row)}
                aria-label={`${ordinal(row.rank)}, ${name}. Open card`}
                data-open-card
              >
                {card}
              </button>
            ) : (
              <span className="lb-podium-card" data-names="" data-skin-off="">
                {card}
              </span>
            )}
            <span className="lb-podium-foot">
              <Medal place={row.rank} shared={shared} />
              {showTime && typeof row.timeMs === "number" ? (
                <span className="lb-time">{boardTime(row.timeMs)}</span>
              ) : null}
              <span className="lb-value">{row.value.toLocaleString("en-GB")}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** A player's full card, opened from a row or the podium (only a visible player with a card). */
export function CardSheet({ row, onClose }: { row: BoardRow | null; onClose: () => void }) {
  if (!row || !row.card || !canOpenCard(row)) return null;
  const name = rowName(row);
  return (
    <Sheet
      onClose={onClose}
      title={row.name!}
      closeLabel="Close card"
      data={{ "data-card-sheet": "" }}
    >
      <div className="lb-card-sheet" data-names="">
        <PlayerCard
          look={cardLookOf(row.card)}
          name={row.name!}
          playerNumber={row.playerNumber}
          title={titleName(row.card.title)}
          badges={row.card.badges}
          label={`${name}’s card`}
        />
        <p className="lb-card-line">
          {row.top500 ? top500Label(row.top500) : ordinal(row.rank)}
          {" · "}
          {row.value.toLocaleString("en-GB")}
        </p>
      </div>
    </Sheet>
  );
}

/** The card a screen has open (one at a time). */
export function useOpenCard(): [BoardRow | null, (row: BoardRow) => void, () => void] {
  const [open, setOpen] = useState<BoardRow | null>(null);
  return [open, setOpen, () => setOpen(null)];
}
