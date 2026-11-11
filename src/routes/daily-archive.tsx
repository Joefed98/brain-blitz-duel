import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { AsyncResults } from "@/components/async/AsyncResults";
import { AsyncRun } from "@/components/async/AsyncRun";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { OnlineOnly } from "@/components/offline/OnlineOnly";
import { Button, EmptyState, Icon, Segmented, SkeletonPage } from "@/design/components";
import { useAccount } from "@/lib/account/accountApi";
import { APP_NAME } from "@/lib/brand";
import { asyncAttempt } from "@/lib/duel/asyncApi";
import type { AsyncAttemptView } from "@/lib/duel/asyncRoom";
import { DAILY_KINDS, DAILY_TITLE, type DailyKind } from "@/lib/duel/daily";
import { dailyArchive, startDailyArchive, type ArchiveDay } from "@/lib/plus/plusApi";

/**
 * The Daily archive (wave 2, session E2; a Joulz Plus perk): every past Daily Puzzle and Daily Arcade of the last 30
 * days, played again unrated. A replay is its own async room with that day's stored rounds, played and graded like a
 * Daily; it never reaches a board, the streak, badges or Joules (src/lib/plus/archive.server.ts). Members only; the
 * server refuses anyone else and this screen says Plus is needed.
 */
export const Route = createFileRoute("/daily-archive")({
  ssr: false,
  head: () => ({
    meta: [{ title: `${APP_NAME} Daily archive` }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <OnlineOnly body="The Daily archive needs a connection. Practice games are saved on this phone, so they still work.">
      <ArchiveScreen />
    </OnlineOnly>
  ),
});

type Mode = { kind: "list" } | { kind: "run"; roomId: string; title: string } | { kind: "results"; roomId: string; title: string; view: AsyncAttemptView };

/** "Mon 9 Nov" for a YYYY-MM-DD day. */
function dayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

function ArchiveScreen() {
  const router = useRouter();
  const account = useAccount();
  const [kind, setKind] = useState<DailyKind>("puzzle");
  const [days, setDays] = useState<ArchiveDay[] | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const answer = await dailyArchive();
    if (answer.ok) setDays(answer.days);
    else setRefused(answer.message);
  }, []);
  useEffect(() => {
    if (account.kind === "account") void load();
    else if (account.kind !== "unknown") setRefused("The Daily archive is part of Joulz Plus.");
  }, [account.kind, load]);

  const open = async (d: ArchiveDay) => {
    const title = `${DAILY_TITLE[d.kind]}, ${dayLabel(d.day)}`;
    setBusy(`${d.kind}:${d.day}`);
    setError(null);
    try {
      const started = await startDailyArchive(d.kind, d.day);
      if (!started.ok) return setError(started.message);
      if (d.replay?.finished) {
        const view = await asyncAttempt(started.roomId);
        if (view) return setMode({ kind: "results", roomId: started.roomId, title, view });
      }
      setMode({ kind: "run", roomId: started.roomId, title });
    } finally {
      setBusy(null);
    }
  };

  const back = (
    <button type="button" onClick={() => setMode({ kind: "list" })} className="press tap-target -ml-2 flex items-center gap-1 px-2 text-[15px] font-semibold text-[var(--ap-link)]">
      <Icon name="back" size={18} className="-m-px" /> Archive
    </button>
  );

  if (mode.kind === "run")
    return (
      <AsyncRun
        roomId={mode.roomId}
        title={mode.title}
        leave={back}
        onDone={(view) => {
          setMode({ kind: "results", roomId: mode.roomId, title: mode.title, view });
          void load();
        }}
      />
    );
  if (mode.kind === "results")
    return (
      <AsyncResults
        roomId={mode.roomId}
        view={mode.view}
        title={mode.title}
        placeLine="Unrated: not on the leaderboard"
        onBoard={() => setMode({ kind: "list" })}
        boardLabel="Archive"
      />
    );

  return (
    <PhoneShell skin="play">
      <div data-daily-archive className="flex flex-1 flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => router.history.back()} className="press tap-target -ml-2 flex items-center gap-1 px-2 text-[15px] font-semibold text-[var(--ap-link)]">
            <Icon name="back" size={18} className="-m-px" /> Plus
          </button>
        </div>
        <div>
          <h1 className="ap-title text-[28px]">Daily archive</h1>
          <p className="mt-1 text-sm text-muted-foreground">Play any past Daily, just for fun. Unrated: never on a board or your streak.</p>
        </div>
        {refused ? (
          <EmptyState layout="card" tone="cool" title="Part of Joulz Plus" body={refused} />
        ) : !days ? (
          <SkeletonPage label="Loading the archive" rows={4} />
        ) : (
          <>
            <Segmented
              label="Daily"
              value={kind}
              onChange={setKind}
              options={DAILY_KINDS.map((k) => ({ value: k, label: DAILY_TITLE[k], data: { "data-archive-tab": k } }))}
            />
            {error ? (
              <p role="alert" className="cz-message">
                {error}
              </p>
            ) : null}
            <ul className="jz-panel" data-archive-days>
              {days
                .filter((d) => d.kind === kind)
                .map((d) => (
                  <li key={`${d.kind}:${d.day}`} className="jz-row" data-archive-day={d.day}>
                    <span className="jz-row-text">
                      <span className="jz-row-title">{dayLabel(d.day)}</span>
                      <span className="jz-row-sub">
                        {!d.available ? "No Daily that day" : d.replay?.finished ? `Replayed · ${d.replay.total}` : d.replay ? "Started" : DAILY_TITLE[d.kind]}
                      </span>
                    </span>
                    {d.available ? (
                      <Button variant={d.replay?.finished ? "secondary" : "gold"} size={44} disabled={busy !== null} onClick={() => void open(d)} data-archive-play={d.day}>
                        {d.replay?.finished ? "Results" : d.replay ? "Continue" : "Play"}
                      </Button>
                    ) : null}
                  </li>
                ))}
            </ul>
          </>
        )}
      </div>
    </PhoneShell>
  );
}
