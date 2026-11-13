import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo } from "react";

import { PhoneShell } from "@/components/duel/PhoneShell";
import { DailyBoardScreen } from "@/components/leaderboards/LeaderboardScreens";
import { OnlineOnly } from "@/components/offline/OnlineOnly";
import { SkeletonPage } from "@/design/components";
import { useAccount } from "@/lib/account/accountApi";
import { APP_NAME } from "@/lib/brand";
import { ukDayKey } from "@/lib/duel/daily";
import { isDailyKind, isDayKey, type DailyBoardKind } from "@/lib/leaderboards/boards";

/**
 * /daily-board (wave 4, session W4a; docs/leaderboards.md, mockup 02): the Daily Puzzle's and Daily Arcade's top 100,
 * today's and every earlier day's, with your own place pinned. Only accounts count (each account's first attempt that
 * day, accounts at least 24 hours old, never a flagged run); everyone may look.
 */
type Search = { kind?: DailyBoardKind; day?: string };

export const Route = createFileRoute("/daily-board")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): Search => ({
    ...(isDailyKind(search["kind"]) ? { kind: search["kind"] } : {}),
    ...(isDayKey(search["day"]) ? { day: search["day"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: `${APP_NAME} Daily leaderboard` },
      { name: "description", content: `The Daily’s top 100 on ${APP_NAME}.` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DailyBoardPage,
});

function DailyBoardPage() {
  return (
    <OnlineOnly body="Leaderboards need a connection. Practice games are saved on this phone, so they still work.">
      <DailyBoardRoute />
    </OnlineOnly>
  );
}

function DailyBoardRoute() {
  const router = useRouter();
  const search = Route.useSearch() as Search;
  const account = useAccount();
  const today = useMemo(() => ukDayKey(Date.now()), []);
  const back = () => {
    if (window.history.length > 1) router.history.back();
    else void router.navigate({ to: "/daily", replace: true });
  };
  return (
    <PhoneShell skin="profile" bare>
      {account.kind === "unknown" ? (
        <SkeletonPage label="Loading the board" rows={6} />
      ) : (
        <DailyBoardScreen
          onBack={back}
          isAccount={account.kind === "account"}
          kind={search.kind ?? "puzzle"}
          day={search.day ?? null}
          today={today}
          onKindDay={(kind, day) =>
            void router.navigate({ to: "/daily-board", search: { kind, day } as never, replace: true })
          }
        />
      )}
    </PhoneShell>
  );
}
