/**
 * Compete's leaderboards (P3, 22 Nov 2026; plan section 2.1, mockup compete-mixed-phone): lower down the page, the
 * boards as four tabs, Rating · Puzzles · Arcade · Daily 100, each the board's top three and your own row pinned under
 * them when you aren't among them (the server's `me`), then a quiet link to the whole board. The Daily top 100 is one
 * of the tabs and nothing more. Everything is the server's answer (leaderboardsApi): nothing here ranks anyone.
 */
import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { Button, Panel, Segmented, SectionHeader, Skeleton } from "@/design/components";
import type { BoardRow, MainBoard } from "@/lib/leaderboards/boards";
import { leaderboardsApi } from "@/lib/leaderboards/leaderboardsApi";

import { BoardList, CardSheet, useOpenCard } from "./BoardList";

type CompeteTab = MainBoard | "daily";

const TABS: readonly { value: CompeteTab; label: string }[] = [
  { value: "joulz", label: "Rating" },
  { value: "puzzles", label: "Puzzles" },
  { value: "arcade", label: "Arcade" },
  { value: "daily", label: "Daily 100" },
];

/** How many of the board's rows Compete shows before the link to the whole board. */
export const COMPETE_BOARD_ROWS = 3;

type Loaded = { rows: BoardRow[]; me: BoardRow | null; note: string | null } | { failed: string };

export function CompeteBoards() {
  const router = useRouter();
  const [tab, setTab] = useState<CompeteTab>("joulz");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [openCard, openRow, closeCard] = useOpenCard();
  const ask = useRef(0);

  useEffect(() => {
    const n = ++ask.current;
    setLoaded(null);
    if (tab === "daily") {
      void leaderboardsApi.daily({ kind: "puzzle", scope: "top100" }).then((a) => {
        if (n !== ask.current) return;
        if (!a.ok) return setLoaded({ failed: a.message });
        const page = a.page;
        const note = !page.exists
          ? "No board yet today."
          : !page.open
            ? "The board opens once you’ve played today’s Daily Puzzle, or at midnight."
            : null;
        setLoaded({ rows: page.open ? (page.rows ?? []) : [], me: page.me ?? null, note });
      });
      return;
    }
    void leaderboardsApi.rating({ board: tab, scope: "global", period: "season" }).then((a) => {
      if (n !== ask.current) return;
      if (!a.ok) return setLoaded({ failed: a.message });
      setLoaded({ rows: a.page.rows, me: a.page.me, note: a.page.rows.length ? null : "The board fills as rated matches are played." });
    });
  }, [tab]);

  const openWhole = () => {
    if (tab === "daily")
      void router.navigate({ to: "/daily-board", search: { kind: "puzzle" } as never, state: { fromPlayTab: true } as never } as never);
    else void router.navigate({ to: "/leaderboards", search: { board: tab } as never, state: { fromPlayTab: true } as never } as never);
  };

  const label = TABS.find((t) => t.value === tab)!.label;
  return (
    <section aria-label="Leaderboards" className="cp-section" data-compete-boards={tab}>
      <SectionHeader title="Leaderboards" />
      <Segmented
        label="Board"
        radio
        value={tab}
        onChange={setTab}
        className="cp-board-tabs"
        options={TABS.map((t) => ({ value: t.value, label: t.label, data: { "data-compete-board-tab": t.value } }))}
      />
      {/* One panel for the board whatever its state (loading, a note, the rows), so nothing jumps when the board
          arrives: the skeleton draws the same rows the loaded list will, in the same place. */}
      <Panel className="cp-board-panel" data-compete-board-panel={!loaded ? "loading" : "failed" in loaded ? "failed" : "loaded"}>
        {!loaded ? (
          <div className="cp-board-skel" aria-busy="true" aria-label="Loading the board">
            {Array.from({ length: COMPETE_BOARD_ROWS + 1 }, (_, i) => (
              <div key={i} className="cp-board-skel-row" data-pinned={i === COMPETE_BOARD_ROWS ? "" : undefined}>
                <Skeleton width={28} height={28} className="cp-board-skel-medal" />
                <Skeleton height={40} className="cp-board-skel-plate" />
                <Skeleton width={52} height={20} />
              </div>
            ))}
          </div>
        ) : "failed" in loaded ? (
          <p className="cp-board-note" role="status">
            {loaded.failed}
          </p>
        ) : (
          <>
            {loaded.note ? (
              <p className="cp-board-note" data-compete-board-note>
                {loaded.note}
              </p>
            ) : null}
            {loaded.rows.length || loaded.me ? (
              <BoardList
                label={label}
                rows={loaded.rows.slice(0, COMPETE_BOARD_ROWS)}
                me={loaded.me}
                showTime={tab === "daily"}
                onOpen={openRow}
              />
            ) : null}
          </>
        )}
      </Panel>
      <Button variant="quiet" size={48} block onClick={openWhole} data-compete-board-open={tab}>
        {tab === "daily" ? "See the Daily top 100" : `See the ${label} board`}
      </Button>
      <CardSheet row={openCard} onClose={closeCard} />
    </section>
  );
}
