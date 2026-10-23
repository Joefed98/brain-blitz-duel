import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { FeedbackLink } from "@/components/beta/FeedbackLink";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { PlayerBadge } from "@/components/duel/PlayerBadge";
import { LookPicker } from "@/components/duel/RoomLobby";
import { Onboarding } from "@/components/duel/Onboarding";
import { goToTab } from "@/components/app/AppTabBar";
import { GameIcon } from "@/components/app/GameIcon";
import { SettingsSheet } from "@/components/app/SettingsSheet";
import { YourChallenges } from "@/components/challenge/YourChallenges";
import { readRoomHistory, roomStats, type RoomRecord } from "@/lib/duel/deviceHistory";
import { dailyStreak, readDailyRecord, type DailyRecord } from "@/lib/duel/dailyRecord";
import { ukDayKey } from "@/lib/duel/daily";
import { playerInitial, rememberLook, rememberedLook, type PlayerLook } from "@/lib/duel/playerLook";
import { readPracticeBest } from "@/lib/duel/practiceBest";
import { currentPracticeStamp } from "@/lib/duel/practiceStamps";
import { ACTIVE_PUZZLE_TYPES, PUZZLE_REGISTRY } from "@/lib/duel/registry";
import { getStoredName, setStoredName } from "@/lib/duel/session";
import { ordinal } from "@/lib/duel/ordinal";
import type { PuzzleType } from "@/lib/duel/types";
import { ukDay } from "@/lib/publicSchedule";
import { APP_NAME } from "@/lib/brand";

export const Route = createFileRoute("/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: `${APP_NAME} profile` },
      {
        name: "description",
        content: `Your ${APP_NAME} look, rooms and practice bests on this device.`,
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfileScreen,
});

/** No taken colours or icons outside a room: the look is this device's preference for new rooms. */
const NONE_TAKEN = new Map<never, number>();

function ProfileScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [look, setLook] = useState<PlayerLook>({ colour: 0, icon: null });
  // Whether this device has picked a colour or icon (the default avatar is the plain initial until then).
  const [lookChosen, setLookChosen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [settings, setSettings] = useState(false);
  const [intro, setIntro] = useState(false);
  const [history, setHistory] = useState<RoomRecord[]>([]);
  const [bests, setBests] = useState<{ type: PuzzleType; best: number }[]>([]);
  const [daily, setDaily] = useState<DailyRecord | null>(null);

  useEffect(() => {
    setName(getStoredName());
    const remembered = rememberedLook();
    setLook({ colour: remembered.colour ?? 0, icon: remembered.icon ?? null });
    setLookChosen(remembered.colour !== undefined || !!remembered.icon);
    setHistory(readRoomHistory());
    setDaily(readDailyRecord());
    setBests(
      ACTIVE_PUZZLE_TYPES.map((type) => ({
        type,
        best: readPracticeBest(type, currentPracticeStamp(type)),
      }))
        .filter((row): row is { type: PuzzleType; best: number } => row.best !== null)
        .sort(
          (a, b) =>
            b.best - a.best ||
            PUZZLE_REGISTRY[a.type].name.localeCompare(PUZZLE_REGISTRY[b.type].name),
        ),
    );
  }, []);
  const stats = useMemo(() => roomStats(history), [history]);
  const shownName = name.trim() || "Player";

  if (intro) return <Onboarding onDone={() => setIntro(false)} />;

  return (
    <PhoneShell tabs="profile">
      <div className="ap-stack">
        <div className="flex items-center justify-between gap-2">
          <h1 className="ap-title">Profile</h1>
          <button
            type="button"
            aria-label="Settings"
            data-open-settings
            onClick={() => setSettings(true)}
            className="press -mr-2.5 flex h-11 w-11 items-center justify-center text-muted-foreground"
          >
            <Settings aria-hidden="true" className="h-6 w-6" strokeWidth={1.9} />
          </button>
        </div>

        <section aria-label="Your look" className="ap-panel ap-pad flex flex-col gap-4">
          <div className="flex items-center gap-3">
            {/* No colour or icon chosen yet: the initial on a quiet disc; else the player's own badge. */}
            {!lookChosen && look.icon === null ? (
              <span aria-hidden="true" data-default-look className="ap-avatar-default">
                {playerInitial(shownName)}
              </span>
            ) : (
              <PlayerBadge look={look} name={shownName} size={52} />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="th-name truncate text-[18px] font-bold text-foreground">{shownName}</span>
              <span className="text-[13.5px] text-muted-foreground">Your colour and icon in rooms</span>
            </div>
          </div>
          <button
            type="button"
            aria-expanded={picking}
            onClick={() => setPicking((v) => !v)}
            className="ap-btn-outline press h-11 w-full text-[15px]"
          >
            {picking ? "Done" : "Change look"}
          </button>
          {picking ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="profile-name" className="text-[13px] font-semibold text-muted-foreground">
                  Display name
                </label>
                <input
                  id="profile-name"
                  value={name}
                  maxLength={14}
                  placeholder="Your name"
                  onChange={(e) => {
                    setName(e.target.value);
                    setStoredName(e.target.value.trim());
                  }}
                  className="ap-input tap-target"
                />
              </div>
              <LookPicker
                look={look}
                name={shownName}
                taken={NONE_TAKEN}
                takenIconSlots={NONE_TAKEN}
                takenBy={() => ""}
                onChange={(change) => {
                  setLook((current) => ({ ...current, ...change }));
                  setLookChosen(true);
                  rememberLook(change);
                }}
              />
              <p className="text-[13px] text-muted-foreground">
                Used when you create or join a room, if no one there has it yet.
              </p>
            </div>
          ) : null}
        </section>

        <section aria-label="Rooms" className="ap-panel ap-stats">
          {[
            { label: "Rooms played", value: stats.played },
            { label: "Wins", value: stats.wins },
            { label: "Podiums", value: stats.podiums },
          ].map((stat) => (
            <div key={stat.label} data-profile-stat={stat.label} className="ap-stat">
              <span className="ap-stat-value">{stat.value}</span>
              <span className="ap-stat-label">{stat.label}</span>
            </div>
          ))}
        </section>

        {/* The daily challenge on this device (dailyRecord.ts): the streak of UK days played and best totals. */}
        <section aria-label="Daily" data-profile-daily className="ap-section">
          <div className="ap-section-head">
            <h2 className="ap-section-title">Daily</h2>
          </div>
          <div className="ap-panel ap-stats">
            {[
              {
                label: "Streak",
                value: (() => {
                  const days = daily ? dailyStreak(daily.days, ukDayKey(Date.now())) : 0;
                  return `${days} ${days === 1 ? "day" : "days"}`;
                })(),
              },
              { label: "Best puzzle", value: daily?.best.puzzle ?? null },
              { label: "Best arcade", value: daily?.best.arcade ?? null },
            ].map((stat) => (
              <span key={stat.label} data-profile-daily-stat={stat.label} className="ap-stat">
                <span className="ap-stat-value">{stat.value === null ? "–" : stat.value}</span>
                <span className="ap-stat-label">{stat.label}</span>
              </span>
            ))}
          </div>
        </section>

        <YourChallenges
          onOpen={(code) =>
            void router.navigate({ to: "/challenge", search: { code }, state: { fromPlayTab: true } as never } as never)
          }
        />

        <section aria-label="Practice bests" className="ap-section">
          <div className="ap-section-head">
            <h2 className="ap-section-title">Practice bests</h2>
            <button
              type="button"
              onClick={() => goToTab(router, "profile", "practice")}
              className="ap-link press -my-2.5 -mr-1 h-11 px-1"
            >
              See all
            </button>
          </div>
          <div className="ap-panel">
            {bests.length === 0 ? (
              <p className="ap-empty">Your best scores will show here</p>
            ) : (
              <ul>
                {bests.slice(0, 3).map(({ type, best }) => (
                  <li key={type} data-icon="44" className="ap-row">
                    <GameIcon type={type} size={44} />
                    <span className="ap-row-title min-w-0 flex-1">{PUZZLE_REGISTRY[type].name}</span>
                    <span className="ap-score shrink-0 text-[18px]">{best}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section aria-label="Recent rooms" className="ap-section">
          <div className="ap-section-head">
            <h2 className="ap-section-title">Recent rooms</h2>
          </div>
          <div className="ap-panel">
            {history.length === 0 ? (
              <p className="ap-empty">Finished rooms will show here</p>
            ) : (
              <ul>
                {history.slice(0, 5).map((r) => (
                  <li key={r.key} data-recent-room={r.code} className="ap-row">
                    <span className="ap-row-text">
                      <span className="ap-row-title tracking-[0.12em]">{r.code}</span>
                      <span data-ellipsis className="ap-row-sub">
                        {ukDay(r.at, Date.now())} · {r.players} players · {r.points} pts
                      </span>
                    </span>
                    <span
                      className="ap-score shrink-0 text-[18px]"
                    >
                      {r.place === null ? "Left" : ordinal(r.place)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* The note, and the beta's Send feedback link on its right (nothing while TALLY_URL is empty). */}
        <div data-profile-footer className="flex min-h-11 items-center justify-between gap-3">
          <p className="ap-faint min-w-0 text-[13px] leading-snug">
            Saved on this phone. Sign-in after the beta will keep it all.
          </p>
          <FeedbackLink />
        </div>
      </div>
      {settings ? (
        <SettingsSheet
          onClose={() => setSettings(false)}
          onHowItWorks={() => {
            setSettings(false);
            setIntro(true);
          }}
          onTerms={() => {
            setSettings(false);
            void router.navigate({ to: "/terms" });
          }}
        />
      ) : null}
    </PhoneShell>
  );
}
