import { useEffect, useMemo, useRef, useState } from "react";

import { CategoryPill } from "@/components/app/CategoryPill";
import type { RevealPlayer } from "@/components/duel/ArcadeReveal";
import { useFinishedPings } from "@/components/duel/FinishedPings";
import { RoundResultsTable } from "@/components/duel/RoundResultsTable";
import { Standings } from "@/components/duel/Standings";
import { roundClockMs } from "@/lib/duel/buzzer";
import type { ChallengePlayer, ChallengeRoster, ChallengeRoundBoard } from "@/lib/duel/challenge";
import { nearMiss } from "@/lib/duel/nearMiss";
import { resolvePlayerLooks, type PlayerLooks } from "@/lib/duel/playerLook";
import { puzzleDef, puzzleName, puzzleTimeLimitMs } from "@/lib/duel/registry";
import { elapsedMs, scoreOnlyVerdict } from "@/lib/duel/resultPresentation";
import { resultFor, standings, type Standing } from "@/lib/duel/scoring";
import type { ArcadeRevealData } from "@/lib/arcade/reveal";
import {
  NEXT_ROUND_AUTO_MS,
  STANDINGS_MS,
  type DuelPlayerRow,
  type PuzzleData,
} from "@/lib/duel/types";
import { pageHidden } from "@/lib/battery";

/**
 * Earlier players in an async run (22 Oct 2026, friend challenges): what AsyncRun needs to play a
 * challenge "as if live" against them. The roster is fixed when the attempt starts; pings come from
 * the server while the round runs (slots only); a round's board only once this device's own result
 * for it is stored (challenge.server.ts).
 */
export interface AsyncRivals {
  roster: ChallengeRoster;
  pings: (round: number) => Promise<number[]>;
  board: (round: number) => Promise<ChallengeRoundBoard | null>;
}

/** How often the live round asks which earlier players have finished. */
export const PING_POLL_MS = 1000;

/** Challenge players in the room's row shape, for the room's own standings, looks and pings. */
export function rivalRows(
  players: readonly ChallengePlayer[],
  finished: ReadonlySet<number> = new Set(),
  round = 0,
): DuelPlayerRow[] {
  return players.map(
    (p) =>
      ({
        id: `p${p.slot}`,
        duel_id: "challenge",
        player_slot: p.slot,
        display_name: p.name,
        user_id: "",
        status: "active",
        colour: p.colour,
        icon: p.icon,
        submitted_round: finished.has(p.slot) ? round : 0,
      }) as DuelPlayerRow,
  );
}

export function rivalLooks(players: readonly ChallengePlayer[]): PlayerLooks {
  return resolvePlayerLooks(rivalRows(players));
}

/** The table after `round`, as a room draws it (standings with this round's summaries and near misses). */
export function rivalTable(board: ChallengeRoundBoard, puzzle: PuzzleData | undefined): Standing[] {
  const details = new Map(board.details.map((d) => [d.playerSlot, d]));
  return standings(rivalRows(board.players), board.results, board.round, details, board.tie).map(
    (row) => {
      const line = puzzle
        ? nearMiss(puzzle.type, resultFor(board.results, row.slot, board.round)?.extra)
        : null;
      return line ? { ...row, summary: `${row.summary} · ${line}` } : row;
    },
  );
}

/** The arcade reveal's chart markers: everyone's stored score for the round (placed, never drawn). */
export function rivalRevealPlayers(board: ChallengeRoundBoard, looks: PlayerLooks): RevealPlayer[] {
  return board.players.map((p) => {
    const row = resultFor(board.results, p.slot, board.round);
    const reveal = (row?.extra as Record<string, unknown> | null | undefined)?.["reveal"];
    return {
      slot: p.slot,
      name: p.name,
      isMe: p.slot === board.mySlot,
      look: looks.get(p.slot),
      score: row ? row.score : null,
      reveal: (reveal as ArcadeRevealData | undefined) ?? null,
    };
  });
}

/**
 * The live round's "finished ✓" pings: asks the server every PING_POLL_MS while the round runs and
 * there are earlier players still to finish, and feeds the room's own ping strip logic.
 */
export function useRivalPings(
  rivals: AsyncRivals | undefined,
  round: number,
  active: boolean,
  roundKey: string,
) {
  const [finished, setFinished] = useState<Set<number>>(() => new Set());
  const others = rivals
    ? rivals.roster.players.filter((p) => p.slot !== rivals.roster.mySlot).length
    : 0;
  useEffect(() => setFinished(new Set()), [roundKey]);
  const done = finished.size >= others;
  useEffect(() => {
    if (!rivals || !active || others === 0 || done) return;
    let live = true;
    const ask = () =>
      void rivals.pings(round).then(
        (slots) =>
          live &&
          slots.length &&
          setFinished((current) =>
            slots.every((s) => current.has(s)) ? current : new Set([...current, ...slots]),
          ),
        () => undefined,
      );
    ask();
    // Battery (31 Oct 2026): no polling while the app is hidden; the next poll after return catches up.
    const id = window.setInterval(() => {
      if (!pageHidden()) ask();
    }, PING_POLL_MS);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [rivals, active, round, roundKey, others, done]);
  const rows = useMemo(
    () => rivalRows(rivals?.roster.players ?? [], finished, round),
    [rivals, finished, round],
  );
  return useFinishedPings(rows, round, rivals?.roster.mySlot ?? 0, active && others > 0, roundKey);
}

/** A between-rounds screen's clock: Continue moves on at once, else it moves on by itself. */
function useAutoNext(totalMs: number, onNext: () => void) {
  const [now, setNow] = useState(() => Date.now());
  const started = useRef(Date.now());
  const fired = useRef(false);
  const next = useRef(onNext);
  next.current = onNext;
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  const left = totalMs - (now - started.current);
  useEffect(() => {
    if (left > 0 || fired.current) return;
    fired.current = true;
    next.current();
  }, [left]);
  const go = () => {
    if (fired.current) return;
    fired.current = true;
    next.current();
  };
  return { autoSeconds: Math.max(0, Math.ceil(left / 1000)), go };
}

/** The round leaderboard after a challenge round, the room's own screen with the earlier players' results. */
export function RivalRoundResults({
  board,
  puzzle,
  roundCount,
  onNext,
}: {
  board: ChallengeRoundBoard;
  puzzle: PuzzleData;
  roundCount: number;
  onNext: () => void;
}) {
  const { autoSeconds, go } = useAutoNext(NEXT_ROUND_AUTO_MS, onNext);
  const looks = useMemo(() => rivalLooks(board.players), [board]);
  const table = useMemo(() => rivalTable(board, puzzle), [board, puzzle]);
  const limit = puzzleTimeLimitMs(puzzle);
  const clock = roundClockMs(puzzle);
  const times = new Map(
    board.players.map((p) => [
      p.slot,
      elapsedMs(resultFor(board.results, p.slot, board.round), limit, clock, puzzle.type),
    ]),
  );
  const best = /^\d+ (moves|presses|pushes|pours|tilts)$/.test(board.correctAnswer ?? "")
    ? `Best: ${board.correctAnswer}`
    : null;
  return (
    <>
      <CategoryPill category={puzzleDef(puzzle.type).category} className="self-start" />
      <RoundResultsTable
        roundTitle={`Round ${board.round} · ${puzzleName(puzzle.type)}`}
        best={best}
        rows={table}
        times={times}
        clockMs={clock}
        scoreOnly={scoreOnlyVerdict(puzzle.type)}
        looks={looks}
        mySlot={board.mySlot}
        autoSeconds={autoSeconds}
        finalRound={board.round >= roundCount}
        continueState={{ continued: false, continuedCount: 0, waitingCount: 1, onContinue: go }}
      />
    </>
  );
}

/** The overall standings after a challenge round. */
export function RivalStandings({
  board,
  puzzle,
  roundCount,
  onNext,
}: {
  board: ChallengeRoundBoard;
  puzzle: PuzzleData;
  roundCount: number;
  onNext: () => void;
}) {
  const { autoSeconds, go } = useAutoNext(STANDINGS_MS, onNext);
  const looks = useMemo(() => rivalLooks(board.players), [board]);
  const table = useMemo(() => rivalTable(board, puzzle), [board, puzzle]);
  return (
    <>
      <CategoryPill category={puzzleDef(puzzle.type).category} className="self-start" />
      <Standings
        round={board.round}
        totalRounds={roundCount}
        rows={table}
        looks={looks}
        mySlot={board.mySlot}
        autoSeconds={autoSeconds}
        continueState={{ continued: false, continuedCount: 0, waitingCount: 1, onContinue: go }}
      />
    </>
  );
}
