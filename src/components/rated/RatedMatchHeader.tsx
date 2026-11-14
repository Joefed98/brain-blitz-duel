/**
 * The rated match header (phase 2 step 3, rooms and rated; docs/design/style-guide/phone/arcade.png and puzzle.png):
 * both players, each as their mini card (the shared identity piece, never a bare avatar) with their name and rating
 * (or "Placement" / "Guest"), and in the middle "Game N of M" over the games won, "1–0". Under it one quiet line: the
 * match's pick and format. Display only: every figure is handed in (the room's own round outcomes, W3a's ranks).
 *
 * `RatedRoomMatchHeader` is the room route's: a rated 1v1 between games (the room's own round result and standings
 * play, W3c's rule), the two players from W3b's match.
 */
import { useEffect, useState } from "react";

import { MiniCard, type CardLook } from "@/design/identity";
import type { RatedMatch, RatedPlayer } from "@/lib/rated/backend";
import { backendNow } from "@/lib/rated/ratedApi";
import { bestOfLabel, pickLabel } from "@/lib/rated/rules";
import { ratingText } from "@/lib/rated/tierDisplay";

export interface HeaderSide {
  name: string;
  look: CardLook;
  /** "1,482", "Placement" or "Guest". */
  sub: string;
}

/** What a rated player's second line says: their rating once placed, else Placement, Guest or nothing. */
export function headerSub(p: RatedPlayer): string {
  if (p.deleted) return "";
  if (p.guest) return "Guest";
  return p.rank ? ratingText(p.rank.rating) : "Placement";
}

export function RatedMatchHeader({
  me,
  them,
  game,
  games,
  myWins,
  theirWins,
  line,
}: {
  me: HeaderSide;
  them: HeaderSide;
  /** The game just played or about to be played (1-based), and the most the match can take. */
  game: number;
  games: number;
  myWins: number;
  theirWins: number;
  /** "Rated · Mixed · Best of 3". */
  line?: string;
}) {
  return (
    <div className="rt-mh" data-rated-match-header>
      <div className="rt-mh-row">
        <Side side={me} you />
        <div className="rt-mh-mid">
          <span className="rt-mh-game" data-one-line data-mh-game>
            Game {game} of {games}
          </span>
          <span className="rt-mh-score" data-mh-score aria-label={`You ${myWins}, ${them.name} ${theirWins}`}>
            {myWins}–{theirWins}
          </span>
        </div>
        <Side side={them} />
      </div>
      {line ? (
        <p className="rt-mh-line" data-one-line data-mh-line>
          {line}
        </p>
      ) : null}
    </div>
  );
}

function Side({ side, you = false }: { side: HeaderSide; you?: boolean }) {
  return (
    <div className="rt-mh-side" data-mh-side={you ? "me" : "them"}>
      <MiniCard look={side.look} size={52} />
      <span className="rt-mh-text">
        <span className="rt-mh-name" data-ellipsis>
          {you ? "You" : side.name}
        </span>
        {side.sub ? <span className="rt-mh-sub">{side.sub}</span> : null}
      </span>
    </div>
  );
}

/** "Rated · Mixed · Best of 3". */
export function matchLine(match: Pick<RatedMatch, "pick" | "bestOf">): string {
  return `Rated · ${pickLabel(match.pick)} · ${bestOfLabel(match.bestOf)}`;
}

/** The room route's header for a rated 1v1 between games: W3b's match for the two players, the room's own outcomes. */
export function RatedRoomMatchHeader({
  matchId,
  game,
  myWins,
  theirWins,
}: {
  matchId: string;
  game: number;
  myWins: number;
  theirWins: number;
}) {
  const [match, setMatch] = useState<RatedMatch | null>(null);
  useEffect(() => {
    let on = true;
    void backendNow().then(async (b) => {
      const m = b ? await b.match(matchId).catch(() => null) : null;
      if (on) setMatch(m);
    });
    return () => {
      on = false;
    };
  }, [matchId]);
  if (!match) return null;
  return (
    <RatedMatchHeader
      me={{ name: match.me.username, look: match.me.look, sub: headerSub(match.me) }}
      them={{ name: match.them.username, look: match.them.look, sub: headerSub(match.them) }}
      game={game}
      games={match.bestOf}
      myWins={myWins}
      theirWins={theirWins}
      line={matchLine(match)}
    />
  );
}
