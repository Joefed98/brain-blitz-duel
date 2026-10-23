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
import { rememberLook, rememberedLook, type PlayerLook } from "@/lib/duel/playerLook";
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
      <div className="flex flex-1 flex-col gap-5">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-bold">Profile</h1>
          <button
            type="button"
            aria-label="Settings"
            data-open-settings
            onClick={() => setSettings(true)}
            className="press tap-target -mr-2 flex w-11 items-center justify-center text-muted-foreground"
          >
            <Settings aria-hidden="true" className="h-6 w-6" />
          </button>
        </div>

        <section
          aria-label="Your look"
          data-tint="teal"
          className="th-card flex flex-col gap-3 rounded-2xl border border-border bg-card/80 p-4"
        >
          <div className="flex items-center gap-3">
            <PlayerBadge look={look} name={shownName} size={56} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="th-name truncate text-xl font-extrabold text-foreground">
                {shownName}
              </span>
              <span className="text-xs text-muted-foreground">
                Your colour and icon in new rooms
              </span>
            </div>
            <button
              type="button"
              aria-expanded={picking}
              onClick={() => setPicking((v) => !v)}
              className="th-btn-outline-gold press tap-target shrink-0 whitespace-nowrap rounded-full border border-primary/70 bg-primary/10 px-3 font-display text-xs font-bold uppercase tracking-wide text-primary"
            >
              {picking ? "Done" : "Change look"}
            </button>
          </div>
          {picking ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="profile-name" className="th-kicker text-muted-foreground">
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
                  className="th-input tap-target w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
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
                  rememberLook(change);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Used when you create or join a room, if no one there has it yet.
              </p>
            </div>
          ) : null}
        </section>

        <section aria-label="Rooms" className="grid grid-cols-3 gap-2">
          {[
            { label: "Rooms played", value: stats.played },
            { label: "Wins", value: stats.wins },
            { label: "Podiums", value: stats.podiums },
          ].map((stat) => (
            <div
              key={stat.label}
              data-profile-stat={stat.label}
              className="th-card flex flex-col items-center gap-1 rounded-2xl border border-border bg-card/80 px-2 py-3"
            >
              <span className="th-score font-mono text-2xl font-bold tabular-nums text-foreground">
                {stat.value}
              </span>
              <span className="th-kicker whitespace-nowrap text-center tracking-[0.06em] text-muted-foreground">
                {stat.label}
              </span>
            </div>
          ))}
        </section>

        {/* The daily challenge on this device (dailyRecord.ts): the streak of UK days played and best totals. */}
        <section
          aria-label="Daily"
          data-profile-daily
          className="th-card flex items-center gap-3 rounded-2xl border border-border bg-card/80 px-4 py-3"
        >
          <span className="th-kicker shrink-0 text-primary">Daily</span>
          <span className="grid min-w-0 flex-1 grid-cols-3 gap-2">
            {[
              {
                label: "Streak",
                value: daily ? dailyStreak(daily.days, ukDayKey(Date.now())) : 0,
                unit: "d",
              },
              { label: "Best puzzle", value: daily?.best.puzzle ?? null, unit: "" },
              { label: "Best arcade", value: daily?.best.arcade ?? null, unit: "" },
            ].map((stat) => (
              <span
                key={stat.label}
                data-profile-daily-stat={stat.label}
                className="flex min-w-0 flex-col items-center"
              >
                <span className="th-score font-mono text-xl font-bold tabular-nums text-foreground">
                  {stat.value === null ? "—" : `${stat.value}${stat.unit}`}
                </span>
                <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
                  {stat.label}
                </span>
              </span>
            ))}
          </span>
        </section>

        <YourChallenges
          onOpen={(code) =>
            void router.navigate({ to: "/challenge", search: { code }, state: { fromPlayTab: true } as never } as never)
          }
        />

        <section aria-label="Practice bests" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-bold">Practice bests</h2>
            <button
              type="button"
              onClick={() => goToTab(router, "profile", "practice")}
              className="press tap-target -mr-2 px-2 font-display text-xs font-semibold uppercase tracking-widest text-primary"
            >
              See all
            </button>
          </div>
          {bests.length === 0 ? (
            <p className="th-empty rounded-xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
              No practice runs yet
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {bests.slice(0, 3).map(({ type, best }) => (
                <li
                  key={type}
                  className="th-card flex items-center gap-3 rounded-xl border border-border bg-card/80 px-3 py-2"
                >
                  <GameIcon type={type} size={40} />
                  <span className="min-w-0 flex-1 truncate font-display text-sm font-semibold">
                    {PUZZLE_REGISTRY[type].name}
                  </span>
                  <span className="th-score th-score-top shrink-0 font-mono text-lg font-bold tabular-nums text-primary">
                    {best}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Recent rooms" className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-bold">Recent rooms</h2>
          {history.length === 0 ? (
            <p className="th-empty rounded-xl border border-dashed border-border px-4 py-4 text-sm text-muted-foreground">
              No rooms finished yet
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {history.slice(0, 5).map((r) => (
                <li
                  key={r.key}
                  data-recent-room={r.code}
                  className="th-card flex items-center gap-3 rounded-xl border border-border bg-card/80 px-4 py-3"
                >
                  <span className="font-mono text-sm font-bold tracking-widest text-foreground">
                    {r.code}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {ukDay(r.at, Date.now())} · {r.players} players ·{" "}
                    <span className="font-mono tabular-nums">{r.points}</span> pts
                  </span>
                  <span
                    className={`th-score shrink-0 font-mono text-base font-bold tabular-nums ${r.place === 1 ? "th-score-top text-primary" : "text-foreground"}`}
                  >
                    {r.place === null ? "Left" : ordinal(r.place)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* SEND FEEDBACK (the beta's form; nothing while TALLY_URL is empty). */}
        <FeedbackLink />

        <p className="text-center text-xs text-muted-foreground">
          Saved on this phone. Sign-in arrives after the beta and will keep all of this.
        </p>
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
