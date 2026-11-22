import { createFileRoute, useRouter } from "@tanstack/react-router";

import { PhoneShell } from "@/components/duel/PhoneShell";
import { RatingBoardsScreen } from "@/components/leaderboards/LeaderboardScreens";
import { OnlineOnly } from "@/components/offline/OnlineOnly";
import { SkeletonPage } from "@/design/components";
import { useAccount } from "@/lib/account/accountApi";
import { APP_NAME } from "@/lib/brand";
import { isPeriod, isRatingBoard, isScope, type BoardPeriod, type BoardScope, type RatingBoard } from "@/lib/leaderboards/boards";

/**
 * /leaderboards (wave 4, session W4a; docs/leaderboards.md, mockup 01): the Joulz Rating, Puzzles and Arcade boards,
 * global, by country and among friends, this season or all-time peak; the category boards and the Daily top 100 are
 * in the board picker (phase 2 step 3). Everyone may
 * look; friends boards and your own pinned row need an account.
 */
type Search = { board?: RatingBoard; scope?: BoardScope; period?: BoardPeriod };

export const Route = createFileRoute("/leaderboards")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search => ({
    ...(isRatingBoard(search["board"]) ? { board: search["board"] } : {}),
    ...(isScope(search["scope"]) ? { scope: search["scope"] } : {}),
    ...(isPeriod(search["period"]) ? { period: search["period"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: `${APP_NAME} leaderboards` },
      { name: "description", content: `Where you stand on ${APP_NAME}.` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LeaderboardsPage,
});

function LeaderboardsPage() {
  return (
    <OnlineOnly body="Leaderboards need a connection. Practice still works.">
      <LeaderboardsScreen />
    </OnlineOnly>
  );
}

function LeaderboardsScreen() {
  const router = useRouter();
  const search = Route.useSearch() as Search;
  const account = useAccount();
  const back = () => {
    if (window.history.length > 1) router.history.back();
    else void router.navigate({ to: "/profile", replace: true });
  };
  return (
    <PhoneShell skin="profile" bare>
      {account.kind === "unknown" ? (
        <SkeletonPage label="Loading the leaderboards" rows={6} />
      ) : (
        <RatingBoardsScreen
          onBack={back}
          isAccount={account.kind === "account"}
          initial={search}
          onDaily={() => void router.navigate({ to: "/daily-board" })}
        />
      )}
    </PhoneShell>
  );
}
