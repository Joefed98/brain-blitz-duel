/**
 * W3d's row in W3c's format slot (src/components/rated/formatScreens.tsx): the 4- and 8-player screens fitted to W3c's
 * props. `MultiSearch` takes Searching's place, `MultiBetween` plays between games and `MultiResult` takes MatchResult's
 * place (no VS: the filling screen leads straight into the games). Each draws MultiScreens.tsx from the server's answer
 * (multiView.ts); nothing is worked out here.
 */
import { useEffect, useState } from "react";

import { SkeletonPage } from "@/design/components";
import { puzzleName } from "@/lib/duel/catalogue";
import type { PuzzleType } from "@/lib/duel/types";
import { FORMAT_GAMES } from "@/lib/rated/matchmaking";
import { multiViewPort, sizeOfFormat, type MultiFinalData, type MultiSeatInfo, type MultiStandingsData } from "@/lib/rated/multi/multiView";
import { pickLabel } from "@/lib/rated/rules";

import type { BetweenScreenProps, ResultScreenProps, SearchScreenProps } from "../formatScreens";
import { MultiFilling, MultiFinal, MultiStandings, type SeatView } from "./MultiScreens";

const seatView = (s: MultiSeatInfo): SeatView => ({ seatId: s.seatId, name: s.name, card: s.card, you: s.you, recorded: s.recorded, rank: s.rank });

function usePort<T>(matchId: string, read: (matchId: string) => Promise<T | null> | null, again: unknown = null): T | null {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let on = true;
    void (async () => {
      const r = await read(matchId);
      if (on) setData(r);
    })();
    return () => {
      on = false;
    };
  }, [matchId, again]); // eslint-disable-line react-hooks/exhaustive-deps
  return data;
}

/** In place of Searching: the filling screen, your seat first (the group is claimed at once, so it fills in one step). */
export function MultiSearch({ me, format, pick, pickText, progress, onCancel }: SearchScreenProps) {
  // The size from W3b's format (W3c passes it); never from the pick text.
  const size = sizeOfFormat(format) ?? 4;
  const seats: SeatView[] = [{ seatId: "me", name: me.username, card: me.look, you: true, rank: me.rank }];
  return (
    <MultiFilling
      size={size}
      picks={pick ? pickLabel(pick) : pickText}
      games={FORMAT_GAMES[format]}
      seats={seats}
      elapsedMs={progress?.elapsedMs ?? 0}
      me={me}
      onLeave={onCancel}
    />
  );
}

/** Between games: the standings so far, read again after each game, and W3c's live time to the next game. */
export function MultiBetween({ matchId, game, msUntilNext }: BetweenScreenProps) {
  const data = usePort<MultiStandingsData>(matchId, (id) => multiViewPort().then((p) => (p ? p.standings(id) : null)), game);
  if (!data) return <SkeletonPage label="Standings" />;
  return (
    <MultiStandings
      size={data.size}
      game={data.game}
      games={data.games}
      rows={data.rows}
      seats={data.seats.map(seatView)}
      headline={{ gameName: puzzleName(data.headline.gameType as PuzzleType), winnerName: data.headline.winnerName, yourPlace: data.headline.yourPlace, yourPoints: data.headline.yourPoints }}
      next={data.next ? { gameName: puzzleName(data.next.gameType as PuzzleType), ...(msUntilNext !== null ? { msLeft: msUntilNext } : {}) } : null}
    />
  );
}

/** In place of MatchResult: the final placings, your change and Joules from W3c's result, everyone's from the settlement. */
export function MultiResult({ result, onNext }: ResultScreenProps) {
  const data = usePort<MultiFinalData>(result.match.id, (id) => multiViewPort().then((p) => (p ? p.final(id) : null)));
  if (!data) return <SkeletonPage label="Your result" />;
  return (
    <MultiFinal
      size={data.size}
      picks={pickLabel(result.match.pick)}
      rows={data.rows}
      seats={data.seats.map(seatView)}
      changes={data.changes}
      yourRating={result.rating ? { rating: result.rating.after.rating, change: result.rating.change } : null}
      joules={result.joules?.amount ?? null}
      passLevel={result.joules?.passLevel ?? null}
      onNext={onNext}
    />
  );
}
