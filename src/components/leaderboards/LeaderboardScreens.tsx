import { useEffect, useRef, useState } from "react";

import {
  Button,
  Chip,
  EmptyState,
  Icon,
  Panel,
  Row,
  SectionHeader,
  Segmented,
  Sheet,
  SkeletonPage,
  SwitchKnob,
} from "@/design/components";
import { TournamentArt } from "@/components/tournaments/TournamentArt";
import type { TournamentArtName } from "@/components/tournaments/tournamentArt.data";
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
  boardLabel,
} from "@/lib/leaderboards/boards";
import { leaderboardsApi } from "@/lib/leaderboards/leaderboardsApi";

import { BoardList, BoardPodium, CardSheet, useOpenCard } from "./BoardList";

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

/* ------------------------------------------------------------------ the board picker (phase 2 step 3) */

/** Each main board's art-kit icon; the categories take their colour dot. */
const BOARD_ART: Record<MainBoard, TournamentArtName> = { joulz: "rating", puzzles: "puzzles", arcade: "arcade" };

/** What the picker can choose: a rating board, or the Daily top 100 (its own page). */
export type BoardChoice = RatingBoard | "daily";

function ChoiceMark({ choice }: { choice: BoardChoice }) {
  if (choice === "daily") return <TournamentArt name="daily" size={32} />;
  if ((MAIN_BOARDS as readonly string[]).includes(choice)) return <TournamentArt name={BOARD_ART[choice as MainBoard]} size={32} />;
  return (
    <span className="lb-cat-mark" aria-hidden="true">
      <span data-cat={choice} className="lb-cat-dot" />
    </span>
  );
}

/**
 * The boards in groups (the boards that exist today): Ratings (the Joulz Rating, Puzzles, Arcade), the Daily top 100,
 * then the eleven category boards. `attr` names each option for checks (`data-board` on the computer's list,
 * `data-board-option` in the phone's sheet).
 */
function BoardOptions({ board, onPick, attr }: { board: RatingBoard; onPick: (choice: BoardChoice) => void; attr: "data-board" | "data-board-option" }) {
  const option = (choice: BoardChoice, label: string) => (
    <Row
      key={choice}
      as="button"
      icon="44"
      role="radio"
      aria-checked={choice === board}
      data-on={choice === board ? "" : undefined}
      className="lb-option"
      onClick={() => onPick(choice)}
      leading={<ChoiceMark choice={choice} />}
      title={label}
      {...{ [attr]: choice }}
    >
      {choice === board ? <Icon name="check" size={20} tone="gold" /> : choice === "daily" ? <Icon name="chevron-right" size={20} tone="text-3" /> : null}
    </Row>
  );
  return (
    <div className="lb-options">
      <p className="lb-options-head">Ratings</p>
      <Panel role="radiogroup" aria-label="Ratings">
        {MAIN_BOARDS.map((b) => option(b, MAIN_BOARD_LABEL[b]))}
      </Panel>
      <p className="lb-options-head">Daily</p>
      <Panel>{option("daily", "Daily top 100")}</Panel>
      <p className="lb-options-head">Categories</p>
      <Panel role="radiogroup" aria-label="Categories">
        {RATED_CATEGORIES.map((c) => option(c, CATEGORY_BOARD_LABEL[c]))}
      </Panel>
    </div>
  );
}

/** The phone's picker: one button naming the board, opening the boards in a sheet. */
function BoardPickerButton({ board, onPick }: { board: RatingBoard; onPick: (choice: BoardChoice) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="lb-picker press" data-board-picker={board} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <ChoiceMark choice={board} />
        <span className="lb-picker-text">
          <span className="lb-picker-label">Board</span>
          <span className="lb-picker-name">{boardLabel(board)}</span>
        </span>
        <Icon name="chevron-down" size={20} tone="text-2" />
      </button>
      {open ? (
        <Sheet title="Boards" closeLabel="Close boards" onClose={() => setOpen(false)} data={{ "data-board-sheet": "" }}>
          <BoardOptions
            board={board}
            attr="data-board-option"
            onPick={(choice) => {
              setOpen(false);
              onPick(choice);
            }}
          />
        </Sheet>
      ) : null}
    </>
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
  onDaily,
}: {
  onBack: () => void;
  isAccount: boolean;
  initial?: { board?: RatingBoard; scope?: BoardScope; period?: BoardPeriod };
  /** The picker's Daily top 100 (its own page, /daily-board). */
  onDaily?: () => void;
}) {
  const [board, setBoard] = useState<RatingBoard>(initial?.board ?? "joulz");
  const pick = (choice: BoardChoice) => (choice === "daily" ? onDaily?.() : setBoard(choice));
  const [scope, setScope] = useState<BoardScope>(initial?.scope ?? "global");
  const [period, setPeriod] = useState<BoardPeriod>(initial?.period ?? "season");
  const [page, setPage] = useState<RatingBoardPage | null>(null);
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [failed, setFailed] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [openCard, openRow, closeCard] = useOpenCard();
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

  const canMore =
    !!page &&
    rows.length < Math.min(page.total, scope === "friends" ? rows.length : RATING_BOARD_TOP);

  return (
    <div className="lb-page" data-leaderboards-screen="ratings">
      <Head title="Leaderboards" onBack={onBack} />
      {/* The boards: a list beside the board on a computer (CSS shows it from 1024 px), a sheet behind one button elsewhere. */}
      <nav aria-label="Boards" className="lb-side" data-board-side>
        <BoardOptions board={board} attr="data-board" onPick={pick} />
      </nav>
      <BoardPickerButton board={board} onPick={pick} />
      <div className="lb-filters">
        <div className="lb-chips" role="group" aria-label="Who">
          {(["global", "country", "friends"] as const).map((s) => (
            <Chip key={s} selected={scope === s} onClick={() => setScope(s)} data-scope={s}>
              {s === "global"
                ? "Global"
                : s === "country"
                  ? countryLabel(page?.country)
                  : "Friends"}
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
        <EmptyState
          layout="card"
          heading={2}
          title="Friends boards need an account"
          body="Save your progress to add friends and see where you stand among them."
        />
      ) : failed ? (
        <Notice text={failed} />
      ) : !page ? (
        <SkeletonPage label="Loading the board" rows={6} />
      ) : page.reason === "no_country" ? (
        <EmptyState
          layout="card"
          heading={2}
          title="No country set"
          body="Set your country in Settings → Account to see your country’s board."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          layout="card"
          heading={2}
          title="No ratings yet"
          body={
            scope === "friends"
              ? "Your friends’ ratings show here once you’ve played rated matches."
              : "The board fills as rated matches are played."
          }
        />
      ) : (
        <>
          <BoardPodium rows={rows} onOpen={openRow} />
          <BoardList
            onOpen={openRow}
            label={`${boardLabel(board)}, ${period === "season" ? "this season" : "all-time peak"}`}
            rows={rows}
            me={page.me}
            meSub={page.me ? meSubLine(page.me, page.total) : undefined}
            footer={
              canMore ? (
                <Button
                  variant="quiet"
                  block
                  size={48}
                  disabled={more}
                  onClick={() => void loadMore()}
                  data-board-more
                >
                  {more ? "Loading…" : "Show more"}
                </Button>
              ) : null
            }
          />
        </>
      )}
      <CardSheet row={openCard} onClose={closeCard} />
      <p className="lb-foot">
        Updated every few minutes. Under-18s are hidden unless they choose to show.
      </p>
    </div>
  );
}

function meSubLine(me: BoardRow, total: number): string {
  return total > 0
    ? `${ordinal(me.rank)} of ${total.toLocaleString("en-GB")}, ${topShare(me.rank, total)}`
    : "";
}

/* ------------------------------------------------------------------ category boards (the profile's stats area) */

/** "Top Logic players": the top 5 of a category's rating board this season, and your own place. */
export function CategoryBoards({
  isAccount,
  initial = "logic",
}: {
  isAccount: boolean;
  initial?: RatedCategory;
}) {
  const [category, setCategory] = useState<RatedCategory>(initial);
  const [page, setPage] = useState<RatingBoardPage | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [openCard, openRow, closeCard] = useOpenCard();
  const ask = useRef(0);
  useEffect(() => {
    const n = ++ask.current;
    setPage(null);
    setFailed(null);
    void leaderboardsApi
      .rating({ board: category as RatingBoard, scope: "global", period: "season" })
      .then((a) => {
        if (n !== ask.current) return;
        if (a.ok) setPage({ ...a.page, rows: a.page.rows.slice(0, 5) });
        else setFailed(a.message);
      });
  }, [category]);
  return (
    <div className="lb-categories" data-category-boards={category}>
      <div className="lb-chips lb-chips-scroll" role="group" aria-label="Category" data-scroll-x>
        {RATED_CATEGORIES.map((c) => (
          <Chip
            key={c}
            cat={c}
            selected={category === c}
            onClick={() => setCategory(c)}
            data-category={c}
          >
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
        <p className="lb-empty-line">
          No ratings yet. The board fills as rated matches are played.
        </p>
      ) : (
        <BoardList
          label={`Top ${CATEGORY_BOARD_LABEL[category]} players`}
          rows={page.rows}
          me={isAccount ? page.me : null}
          meSub={page.me ? meSubLine(page.me, page.total) : undefined}
          onOpen={openRow}
        />
      )}
      <CardSheet row={openCard} onClose={closeCard} />
    </div>
  );
}

/* ------------------------------------------------------------------ the Daily top 100 (mockup 02) */

/** "Today, Sat 7 Nov" / "Sat 7 Nov". */
export function dayHeading(day: string, today: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const text = d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
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
  const [openCard, openRow, closeCard] = useOpenCard();
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
    <div
      className="lb-page"
      data-leaderboards-screen="daily"
      data-daily-kind={kind}
      data-daily-day={day}
    >
      <Head title="Daily leaderboard" onBack={onBack} />
      <Segmented
        label="Daily"
        radio
        value={kind}
        onChange={setKind}
        options={(["puzzle", "arcade"] as const).map((k) => ({
          value: k,
          label: DAILY_KIND_LABEL[k],
          data: { "data-kind": k },
        }))}
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
          <p className="lb-summary-side">
            {page.final ? "Final" : day === today ? "Resets at midnight" : "Updating"}
          </p>
        </div>
      ) : null}
      {meLine && scope === "top100" ? <Notice text={meLine} /> : null}

      <div className="lb-chips" role="group" aria-label="Who">
        <Chip selected={scope === "top100"} onClick={() => setScope("top100")} data-scope="top100">
          Top 100
        </Chip>
        <Chip
          selected={scope === "friends"}
          onClick={() => setScope("friends")}
          data-scope="friends"
        >
          Friends
        </Chip>
      </div>

      {scope === "friends" && !isAccount ? (
        <EmptyState
          layout="card"
          heading={2}
          title="Friends boards need an account"
          body="Save your progress to add friends and see where you stand among them."
        />
      ) : failed ? (
        <Notice text={failed} />
      ) : !page ? (
        <SkeletonPage label="Loading the board" rows={6} />
      ) : !page.exists ? (
        <EmptyState
          layout="card"
          heading={2}
          title="No board for this day"
          body="Every player gets the same Daily. Play today’s to be on its board."
        />
      ) : !page.open ? (
        <EmptyState
          layout="card"
          heading={2}
          title="Finish today’s Daily first"
          body="The board opens once you’ve played, or at midnight."
        />
      ) : (page.rows ?? []).length === 0 ? (
        <EmptyState
          layout="card"
          heading={2}
          title="Nobody on the board yet"
          body="Accounts that finish this Daily show here."
        />
      ) : (
        <>
          <BoardPodium rows={page.rows ?? []} showTime onOpen={openRow} />
          <div className="lb-board-head" aria-hidden="true">
            <span>Player</span>
            <span>Time, score</span>
          </div>
          <BoardList
            label={`${DAILY_KIND_LABEL[kind]}, ${dayHeading(day, today)}`}
            rows={page.rows ?? []}
            me={scope === "top100" ? me : null}
            showTime
            footer={
              me && !(page.rows ?? []).some((r) => r.isMe) ? (
                <p className="lb-gap" aria-hidden="true">
                  …
                </p>
              ) : null
            }
            onOpen={openRow}
          />
        </>
      )}
      <CardSheet row={openCard} onClose={closeCard} />
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
        className="lb-setting-row"
      >
        <span className="jz-row-text items-start text-left">
          <span className="jz-row-title">Show me on leaderboards</span>
          <span className="jz-row-sub" data-wrap-ok>
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
