import { useEffect, useRef, useState } from "react";

import { Button, Chip, EmptyState, Icon, Panel, Row, SectionHeader, Segmented, SkeletonPage, SwitchKnob } from "@/design/components";
import { RATED_CATEGORIES, type RatedCategory } from "@/lib/data/ratings";
import {
  CATEGORY_BOARD_LABEL,
  DAILY_KIND_LABEL,
  MAIN_BOARDS,
  MAIN_BOARD_LABEL,
  PERIOD_LABEL,
  RATING_BOARD_TOP,
  dailyMeLine,
  ordinal,
  topShare,
  type BoardPeriod,
  type BoardRow,
  type BoardScope,
  type BoardVisibility,
  type DailyBoardKind,
  type DailyBoardPage,
  type DailyBoardScope,
  type MainBoard,
  type RatingBoard,
  type RatingBoardPage,
} from "@/lib/leaderboards/boards";
import { leaderboardsApi } from "@/lib/leaderboards/leaderboardsApi";

import { BoardList } from "./BoardList";

/** The country chip's short name ("UK" for GB). */
export function countryLabel(code: string | null | undefined): string {
  if (!code) return "Country";
  if (code === "GB") return "UK";
  if (code === "US") return "US";
  try {
    return new Intl.DisplayNames(["en-GB"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function Head({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="lb-head">
      <Button variant="icon" onClick={onBack} aria-label="Back" data-board-back>
        <Icon name="back" size={22} />
      </Button>
      <h1 className="lb-title">{title}</h1>
    </header>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <p className="lb-note" role="status">
      {text}
    </p>
  );
}

/* ------------------------------------------------------------------ the rating boards (mockup 01) */

/**
 * Leaderboards (mockup 01): Joulz Rating, Puzzles and Arcade; Global, your country and Friends; this season or each
 * player's all-time peak. Pages of 50 up to the top 500; your own row pinned below when it isn't in view.
 */
export function RatingBoardsScreen({
  onBack,
  isAccount,
  initial,
}: {
  onBack: () => void;
  isAccount: boolean;
  initial?: { board?: MainBoard; scope?: BoardScope; period?: BoardPeriod };
}) {
  const [board, setBoard] = useState<MainBoard>(initial?.board ?? "joulz");
  const [scope, setScope] = useState<BoardScope>(initial?.scope ?? "global");
  const [period, setPeriod] = useState<BoardPeriod>(initial?.period ?? "season");
  const [page, setPage] = useState<RatingBoardPage | null>(null);
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const ask = useRef(0);

  useEffect(() => {
    const n = ++ask.current;
    setPage(null);
    setRows([]);
    setFailed(null);
    if (scope === "friends" && !isAccount) return;
    void leaderboardsApi.rating({ board, scope, period }).then((a) => {
      if (n !== ask.current) return;
      if (!a.ok) return setFailed(a.message);
      setPage(a.page);
      setRows(a.page.rows);
    });
  }, [board, scope, period, isAccount]);

  const loadMore = async () => {
    setMore(true);
    const a = await leaderboardsApi.rating({ board, scope, period, offset: rows.length });
    setMore(false);
    if (a.ok) setRows((r) => [...r, ...a.page.rows]);
    else setFailed(a.message);
  };

  const canMore = !!page && rows.length < Math.min(page.total, scope === "friends" ? rows.length : RATING_BOARD_TOP);

  return (
    <div className="lb-page" data-leaderboards-screen="ratings">
      <Head title="Leaderboards" onBack={onBack} />
      <Segmented
        label="Board"
        radio
        value={board}
        onChange={setBoard}
        options={MAIN_BOARDS.map((b) => ({ value: b, label: MAIN_BOARD_LABEL[b], data: { "data-board": b } }))}
      />
      <div className="lb-filters">
        <div className="lb-chips" role="group" aria-label="Who">
          {(["global", "country", "friends"] as const).map((s) => (
            <Chip key={s} selected={scope === s} onClick={() => setScope(s)} data-scope={s}>
              {s === "global" ? "Global" : s === "country" ? countryLabel(page?.country) : "Friends"}
            </Chip>
          ))}
        </div>
        <button
          type="button"
          className="lb-period press"
          data-period={period}
          aria-label={`${PERIOD_LABEL[period]}. Switch to ${PERIOD_LABEL[period === "season" ? "peak" : "season"]}`}
          onClick={() => setPeriod(period === "season" ? "peak" : "season")}
        >
          {period === "season" ? "This season" : "All-time"}
        </button>
      </div>

      {scope === "friends" && !isAccount ? (
        <EmptyState layout="card" heading={2} title="Friends boards need an account" body="Save your progress to add friends and see where you stand among them." />
      ) : failed ? (
        <Notice text={failed} />
      ) : !page ? (
        <SkeletonPage label="Loading the board" rows={6} />
      ) : page.reason === "no_country" ? (
        <EmptyState layout="card" heading={2} title="No country set" body="Set your country in Settings → Account to see your country’s board." />
      ) : rows.length === 0 ? (
        <EmptyState
          layout="card"
          heading={2}
          title="No ratings yet"
          body={scope === "friends" ? "Your friends’ ratings show here once you’ve played rated matches." : "The board fills as rated matches are played."}
        />
      ) : (
        <BoardList
          label={`${MAIN_BOARD_LABEL[board]}, ${period === "season" ? "this season" : "all-time peak"}`}
          rows={rows}
          me={page.me}
          meSub={page.me ? meSubLine(page.me, page.total) : undefined}
          footer={
            canMore ? (
              <Button variant="quiet" block size={48} disabled={more} onClick={() => void loadMore()} data-board-more>
                {more ? "Loading…" : "Show more"}
              </Button>
            ) : null
          }
        />
      )}
      <p className="lb-foot">Updated every few minutes. Under-18s are hidden unless they choose to show.</p>

      <section className="lb-section" aria-label="Top players by category">
        <SectionHeader title="Top players by category" />
        <CategoryBoards isAccount={isAccount} />
      </section>
    </div>
  );
}

function meSubLine(me: BoardRow, total: number): string {
  return total > 0 ? `${ordinal(me.rank)} of ${total.toLocaleString("en-GB")}, ${topShare(me.rank, total)}` : "";
}

/* ------------------------------------------------------------------ category boards (the profile's stats area) */

/** "Top Logic players": the top 5 of a category's rating board this season, and your own place. */
export function CategoryBoards({ isAccount, initial = "logic" }: { isAccount: boolean; initial?: RatedCategory }) {
  const [category, setCategory] = useState<RatedCategory>(initial);
  const [page, setPage] = useState<RatingBoardPage | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const ask = useRef(0);
  useEffect(() => {
    const n = ++ask.current;
    setPage(null);
    setFailed(null);
    void leaderboardsApi.rating({ board: category as RatingBoard, scope: "global", period: "season" }).then((a) => {
      if (n !== ask.current) return;
      if (a.ok) setPage({ ...a.page, rows: a.page.rows.slice(0, 5) });
      else setFailed(a.message);
    });
  }, [category]);
  return (
    <div className="lb-categories" data-category-boards={category}>
      <div className="lb-chips lb-chips-scroll" role="group" aria-label="Category" data-scroll-x>
        {RATED_CATEGORIES.map((c) => (
          <Chip key={c} cat={c} selected={category === c} onClick={() => setCategory(c)} data-category={c}>
            {CATEGORY_BOARD_LABEL[c]}
          </Chip>
        ))}
      </div>
      <p className="lb-category-title">{`Top ${CATEGORY_BOARD_LABEL[category]} players`}</p>
      {failed ? (
        <Notice text={failed} />
      ) : !page ? (
        <SkeletonPage label="Loading the board" rows={3} />
      ) : page.rows.length === 0 ? (
        <p className="lb-empty-line">No ratings yet. The board fills as rated matches are played.</p>
      ) : (
        <BoardList
          label={`Top ${CATEGORY_BOARD_LABEL[category]} players`}
          rows={page.rows}
          me={isAccount ? page.me : null}
          meSub={page.me ? meSubLine(page.me, page.total) : undefined}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ the Daily top 100 (mockup 02) */

/** "Today, Sat 7 Nov" / "Sat 7 Nov". */
export function dayHeading(day: string, today: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const text = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return day === today ? `Today, ${text}` : text;
}

export function DailyBoardScreen({
  onBack,
  isAccount,
  kind: initialKind,
  day: initialDay,
  today,
  onKindDay,
}: {
  onBack: () => void;
  isAccount: boolean;
  kind: DailyBoardKind;
  day: string | null;
  today: string;
  /** The URL follows the kind and day shown. */
  onKindDay?: (kind: DailyBoardKind, day: string) => void;
}) {
  const [kind, setKind] = useState<DailyBoardKind>(initialKind);
  const [day, setDay] = useState<string>(initialDay ?? today);
  const [scope, setScope] = useState<DailyBoardScope>("top100");
  const [page, setPage] = useState<DailyBoardPage | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const ask = useRef(0);

  useEffect(() => {
    const n = ++ask.current;
    setPage(null);
    setFailed(null);
    onKindDay?.(kind, day);
    if (scope === "friends" && !isAccount) return;
    void leaderboardsApi.daily({ kind, day, scope }).then((a) => {
      if (n !== ask.current) return;
      if (a.ok) setPage(a.page);
      else setFailed(a.message);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, day, scope, isAccount]);

  const me = page?.me ?? null;
  const players = page?.players ?? 0;
  const meLine = dailyMeLine(page?.meReason);
  return (
    <div className="lb-page" data-leaderboards-screen="daily" data-daily-kind={kind} data-daily-day={day}>
      <Head title="Daily leaderboard" onBack={onBack} />
      <Segmented
        label="Daily"
        radio
        value={kind}
        onChange={setKind}
        options={(["puzzle", "arcade"] as const).map((k) => ({ value: k, label: DAILY_KIND_LABEL[k], data: { "data-kind": k } }))}
      />
      <div className="lb-day">
        <Button
          variant="icon"
          aria-label="Previous day"
          disabled={!page?.prevDay}
          onClick={() => page?.prevDay && setDay(page.prevDay)}
          data-day-prev
        >
          <Icon name="back" size={22} />
        </Button>
        <p className="lb-day-title">{dayHeading(day, today)}</p>
        <Button
          variant="icon"
          aria-label="Next day"
          disabled={!page?.nextDay}
          onClick={() => page?.nextDay && setDay(page.nextDay)}
          data-day-next
        >
          <Icon name="chevron-right" size={22} />
        </Button>
      </div>

      {page?.exists && scope === "top100" ? (
        <div className="lb-summary" data-daily-summary>
          <div className="lb-summary-main">
            {me ? (
              <>
                <p className="lb-summary-title">{`You came ${ordinal(me.rank)} of ${players.toLocaleString("en-GB")}`}</p>
                <p className="lb-summary-sub">{`${me.value.toLocaleString("en-GB")}, ${topShare(me.rank, players)}`}</p>
              </>
            ) : (
              <p className="lb-summary-title">{`${players.toLocaleString("en-GB")} ${players === 1 ? "player" : "players"} on the board`}</p>
            )}
          </div>
          <p className="lb-summary-side">{page.final ? "Final" : day === today ? "Resets at midnight" : "Updating"}</p>
        </div>
      ) : null}
      {meLine && scope === "top100" ? <Notice text={meLine} /> : null}

      <div className="lb-chips" role="group" aria-label="Who">
        <Chip selected={scope === "top100"} onClick={() => setScope("top100")} data-scope="top100">
          Top 100
        </Chip>
        <Chip selected={scope === "friends"} onClick={() => setScope("friends")} data-scope="friends">
          Friends
        </Chip>
      </div>

      {scope === "friends" && !isAccount ? (
        <EmptyState layout="card" heading={2} title="Friends boards need an account" body="Save your progress to add friends and see where you stand among them." />
      ) : failed ? (
        <Notice text={failed} />
      ) : !page ? (
        <SkeletonPage label="Loading the board" rows={6} />
      ) : !page.exists ? (
        <EmptyState layout="card" heading={2} title="No board for this day" body="Every player gets the same Daily. Play today’s to be on its board." />
      ) : !page.open ? (
        <EmptyState layout="card" heading={2} title="Finish today’s Daily first" body="The board opens once you’ve played, or at midnight." />
      ) : (page.rows ?? []).length === 0 ? (
        <EmptyState layout="card" heading={2} title="Nobody on the board yet" body="Accounts that finish this Daily show here." />
      ) : (
        <>
          <div className="lb-board-head" aria-hidden="true">
            <span>Player</span>
            <span>Time, score</span>
          </div>
          <BoardList
            label={`${DAILY_KIND_LABEL[kind]}, ${dayHeading(day, today)}`}
            rows={page.rows ?? []}
            me={scope === "top100" ? me : null}
            showTime
            footer={me && !(page.rows ?? []).some((r) => r.isMe) ? <p className="lb-gap" aria-hidden="true">…</p> : null}
          />
        </>
      )}
      <p className="lb-foot">Every player gets the same Daily. Ties go to the faster time.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ the setting */

/** "Show me on leaderboards" (Settings → Account): adults shown by default, under-18s hidden by default. */
export function BoardVisibilitySetting() {
  const [state, setState] = useState<BoardVisibility | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    // Nothing is drawn until the server answers (and nothing if it can't: the setting is kept as it was).
    void leaderboardsApi.visibility().then((a) => (a.ok ? setState(a.visibility) : undefined));
  }, []);
  if (!state) return null;
  const toggle = async () => {
    const next = !state.show;
    setState({ ...state, show: next, setting: next });
    const a = await leaderboardsApi.setVisibility(next);
    if (a.ok) {
      setState(a.visibility);
      setFailed(null);
    } else {
      setState(state);
      setFailed(a.message);
    }
  };
  return (
    <Panel>
      <Row
        as="button"
        role="switch"
        aria-checked={state.show}
        aria-label="Show me on leaderboards"
        data-board-visibility={state.show ? "on" : "off"}
        onClick={() => void toggle()}
      >
        <span className="jz-row-text items-start text-left">
          <span className="jz-row-title">Show me on leaderboards</span>
          <span className="jz-row-sub">
            {state.adult
              ? "Off: you show as “Hidden player” on global and country boards. Friends always see you."
              : "Under-18s are hidden by default. Friends always see you."}
          </span>
        </span>
        <SwitchKnob on={state.show} />
      </Row>
      {failed ? <Notice text={failed} /> : null}
    </Panel>
  );
}
