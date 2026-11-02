import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, Megaphone } from "lucide-react";
import { useEffect, useState } from "react";

import { PublicGameNext } from "@/components/app/PublicGameCard";
import { DailyCard, useDailyStatus } from "@/components/daily/DailyCard";
import { useClock } from "@/components/app/useClock";
import type { BannerPage, HouseBanner } from "@/config/banners";
import { bannerFor } from "@/lib/banners";
import { ukDayKey } from "@/lib/duel/daily";
import { dailyStreak, readDailyRecord } from "@/lib/duel/dailyRecord";
import { readRoomHistory } from "@/lib/duel/deviceHistory";
import { practiceThisWeek } from "@/lib/duel/practiceRecent";
import { scheduledGames, upcomingGames } from "@/lib/publicSchedule";

/**
 * The computer layout's page extras (31 Oct 2026, presentation only; docs/desktop-layout.md): the banner
 * slot over Play, Practice and Tournaments, and the 320 px right column beside the four tab pages (on a
 * tablet, the side column under the 700–1023 px layout). Drawn by PhoneShell only off the phone layout.
 */

/** The 112 px house-promotion strip (config/banners.ts); nothing at all when there is nothing to show. */
export function BannerSlot({ page }: { page: BannerPage }) {
  const navigate = useNavigate();
  const [banner, setBanner] = useState<HouseBanner | null>(null);
  useEffect(() => setBanner(bannerFor(page, Date.now())), [page]);
  if (!banner) return null;
  const go = () => {
    if (/^https?:\/\//.test(banner.to)) window.open(banner.to, "_blank", "noopener");
    else {
      const [path, query] = banner.to.split("?");
      void navigate({
        to: path as never,
        search: Object.fromEntries(new URLSearchParams(query ?? "")) as never,
      });
    }
  };
  return (
    <aside aria-label="Promotion" data-banner-slot={banner.id} className="dk-banner">
      <Megaphone aria-hidden="true" className="dk-banner-icon" />
      <span className="dk-banner-text">
        <span data-ellipsis className="dk-banner-title">
          {banner.title}
        </span>
        <span data-ellipsis className="dk-banner-line">
          {banner.line}
        </span>
      </span>
      <button type="button" onClick={go} className="ap-btn-outline press dk-banner-action">
        {banner.action} <ChevronRight aria-hidden="true" className="h-4 w-4" />
      </button>
    </aside>
  );
}

export type AsidePanel = "public" | "daily" | "week";

function NextPublicPanel() {
  const navigate = useNavigate();
  const first = upcomingGames(Date.now(), scheduledGames())[0];
  const now = useClock(first ? [first.lobbyAt, first.startsAt] : []);
  const next = upcomingGames(now, scheduledGames())[0] ?? null;
  return (
    <section aria-label="Next public room" data-aside-panel="public" className="ap-section">
      <h2 className="ap-section-title">Next public room</h2>
      {next ? (
        <div className="ap-panel">
          <PublicGameNext
            game={next}
            now={now}
            onJoin={(code) => void navigate({ to: "/duel/$code", params: { code } })}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void navigate({ to: "/tournaments" })}
          className="ap-panel ap-row press"
        >
          <span className="ap-row-text">
            <span className="ap-row-title">None scheduled yet</span>
            <span data-ellipsis className="ap-row-sub">
              Public games show here and in Tournaments
            </span>
          </span>
          <ChevronRight aria-hidden="true" className="ap-chevron" />
        </button>
      )}
    </section>
  );
}

function DailyPanel() {
  const navigate = useNavigate();
  const { status } = useDailyStatus();
  const [streak, setStreak] = useState(0);
  useEffect(() => setStreak(dailyStreak(readDailyRecord().days, ukDayKey(Date.now()))), []);
  if (!status?.available) return null;
  return (
    <div data-aside-panel="daily">
      <DailyCard
        status={status}
        streak={streak}
        onOpen={(kind) => void navigate({ to: "/daily", search: { kind } as never })}
      />
    </div>
  );
}

function WeekPanel() {
  const [week, setWeek] = useState<{
    rooms: number;
    wins: number;
    practice: number;
    streak: number;
  } | null>(null);
  useEffect(() => {
    const since = Date.now() - 7 * 86_400_000;
    const rooms = readRoomHistory().filter((r) => r.at >= since);
    setWeek({
      rooms: rooms.length,
      wins: rooms.filter((r) => r.place === 1).length,
      practice: practiceThisWeek(),
      streak: dailyStreak(readDailyRecord().days, ukDayKey(Date.now())),
    });
  }, []);
  const cells: [string, number | null][] = [
    ["Rooms", week?.rooms ?? null],
    ["Wins", week?.wins ?? null],
    ["Practice", week?.practice ?? null],
    ["Daily streak", week?.streak ?? null],
  ];
  return (
    <section aria-label="Your week" data-aside-panel="week" className="ap-section">
      <div className="ap-section-head">
        <h2 className="ap-section-title">Your week</h2>
        <span className="ap-meta">Last 7 days</span>
      </div>
      <div className="ap-panel dk-week">
        {cells.map(([label, value]) => (
          <div key={label} className="dk-week-cell">
            <span className="dk-week-value">{value ?? "–"}</span>
            <span className="dk-week-label">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The right column: the panels asked for, in order. */
export function PageAside({ panels }: { panels: readonly AsidePanel[] }) {
  return (
    <aside aria-label="More" data-page-aside className="dk-aside">
      {panels.map((p) =>
        p === "public" ? (
          <NextPublicPanel key={p} />
        ) : p === "daily" ? (
          <DailyPanel key={p} />
        ) : (
          <WeekPanel key={p} />
        ),
      )}
    </aside>
  );
}
