import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Check, ChevronRight, Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { FeedbackLink } from "@/components/beta/FeedbackLink";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { useHomeBed } from "@/lib/useScreenMusic";
import { PageAside } from "@/components/app/PageAside";
import { PlayerBadge } from "@/components/duel/PlayerBadge";
import { LookPicker } from "@/components/duel/RoomLobby";
import { Onboarding } from "@/components/duel/Onboarding";
import { goToTab } from "@/components/app/AppTabBar";
import { GameIcon } from "@/components/app/GameIcon";
import { PlaceDisc } from "@/components/app/TabIcons";
import { SettingsSheet } from "@/components/app/SettingsSheet";
import { YourChallenges } from "@/components/challenge/YourChallenges";
import { readRoomHistory, roomStats, type RoomRecord } from "@/lib/duel/deviceHistory";
import { dailyStreak, readDailyRecord, type DailyRecord } from "@/lib/duel/dailyRecord";
import { ukDayKey } from "@/lib/duel/daily";
import { rememberLook, rememberedLook, type PlayerLook } from "@/lib/duel/playerLook";
import { readPracticeBest } from "@/lib/duel/practiceBest";
import { currentPracticeStamp } from "@/lib/duel/practiceStamps";
import { ACTIVE_PUZZLE_TYPES, PUZZLE_REGISTRY, gameCounts } from "@/lib/duel/registry";
import { getStoredName, setStoredName } from "@/lib/duel/session";
import { ordinal } from "@/lib/duel/ordinal";
import type { PuzzleType } from "@/lib/duel/types";
import { ukDay } from "@/lib/publicSchedule";
import { APP_NAME } from "@/lib/brand";
import { Button, Input } from "@/design/components";

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

/** Every game rooms deal ("Any of the 72 games"). */
const ACTIVE_GAMES = (() => {
  const counts = gameCounts();
  return counts.puzzle + counts.arcade;
})();

function ProfileScreen() {
  // The app-wide home bed carries on here from the other tabs (docs/sound-cues/music.md).
  useHomeBed();
  const router = useRouter();
  const [name, setName] = useState("");
  const [look, setLook] = useState<PlayerLook>({ colour: 0, icon: null });
  const [picking, setPicking] = useState(false);
  const [settings, setSettings] = useState(false);
  const [intro, setIntro] = useState(false);
  const [history, setHistory] = useState<RoomRecord[]>([]);
  const [bests, setBests] = useState<{ type: PuzzleType; best: number }[]>([]);
  const [daily, setDaily] = useState<DailyRecord | null>(null);
  const [loaded, setLoaded] = useState(false);

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
    setLoaded(true);
  }, []);
  const stats = useMemo(() => roomStats(history), [history]);
  const shownName = name.trim() || "Player";
  // What this device has done (its own records): the Get started steps tick off from these, and a
  // section with nothing in it yet isn't drawn (a new player sees no zeros).
  const steps = [
    { id: "room", title: "Play your first room", sub: "Rooms, wins and podiums start counting", done: history.length > 0 },
    { id: "daily", title: "Do today’s daily", sub: "Starts your streak", done: (daily?.days.length ?? 0) > 0 },
    { id: "practice", title: "Set a practice best", sub: `Any of the ${ACTIVE_GAMES} games`, done: bests.length > 0 },
  ] as const;
  const fresh = loaded && steps.every((step) => !step.done);
  const doneCount = steps.filter((step) => step.done).length;

  if (intro) return <Onboarding onDone={() => setIntro(false)} />;

  const picker = picking ? (
    <div className="flex flex-col gap-3 px-4 pb-4 text-left">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-name" className="text-[13px] font-semibold text-muted-foreground">
          Display name
        </label>
        <Input
          id="profile-name"
          value={name}
          maxLength={14}
          placeholder="Your name"
          onChange={(e) => {
            setName(e.target.value);
            setStoredName(e.target.value.trim());
          }}
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
      <p className="text-[13px] text-muted-foreground">
        Your default for every room. If someone there already has it, you get the nearest free colour, and you can change it in the lobby.
      </p>
    </div>
  ) : null;

  const openStep = (id: (typeof steps)[number]["id"]) => {
    if (id === "room") goToTab(router, "profile", "play");
    else if (id === "practice") goToTab(router, "profile", "practice");
    else void router.navigate({ to: "/daily", search: { kind: "puzzle" }, state: { fromPlayTab: true } as never } as never);
  };

  return (
    <PhoneShell tabs="profile" aside={<PageAside panels={["public", "daily", "week"]} />}>
      <div className="ap-stack">
        <div className="flex items-center justify-between gap-2">
          <h1 className="ap-title">Profile</h1>
          <Button variant="icon" aria-label="Settings" data-open-settings onClick={() => setSettings(true)} className="-mr-2.5">
            <Settings aria-hidden="true" strokeWidth={1.9} />
          </Button>
        </div>

        {fresh ? (
          // A new player (T-ProfileNew): the badge in their colour, what it is, and Choose your look.
          <section aria-label="Your look" data-profile-new className="jz-panel">
            <div className="ap-profile-new">
              <PlayerBadge look={look} name={shownName} size={72} />
              <span className="th-name mt-1 max-w-full truncate text-[20px] font-bold text-foreground">{shownName}</span>
              <p data-wrap-ok className="max-w-[280px] text-[14px] leading-[1.4] text-[var(--ap-text-2)]">
                This is your badge in rooms. Pick a name, colour and icon so friends know it’s you.
              </p>
              <Button variant="secondary" size={46} block aria-expanded={picking} onClick={() => setPicking((v) => !v)} className="mt-1">
                {picking ? "Done" : "Choose your look"}
              </Button>
            </div>
            {picker}
          </section>
        ) : (
          // The badge in the player's own colour, name, Beta player, Change look; the room stats beneath.
          <section aria-label="Your look" className="jz-panel">
            <div className="ap-profile-head">
              <PlayerBadge look={look} name={shownName} size={56} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="th-name truncate text-[19px] font-bold text-foreground">{shownName}</span>
                  <span className="jz-chip-quiet">Beta player</span>
                </span>
                <span data-ellipsis className="truncate text-[13px] text-muted-foreground">
                  How you look in rooms
                </span>
              </div>
              <Button
                variant="secondary"
                size={44}
                aria-expanded={picking}
                // Drawn "Change" (the mockup); named in full for screen readers.
                aria-label={picking ? "Done" : "Change look"}
                onClick={() => setPicking((v) => !v)}
                className="shrink-0"
              >
                {picking ? "Done" : "Change"}
              </Button>
            </div>
            {picker}
            {history.length > 0 ? (
              <div className="ap-stats">
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
              </div>
            ) : null}
          </section>
        )}

        {/* Get started (T-ProfileNew): three steps that tick off from this device's own records. */}
        {loaded && doneCount < steps.length ? (
          <section aria-label="Get started" data-get-started className="ap-section">
            <div className="ap-section-head">
              <h2 className="ap-section-title">Get started</h2>
              <span className="ap-meta">
                {doneCount} of {steps.length}
              </span>
            </div>
            <div className="jz-panel">
              {steps.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  data-step={step.id}
                  data-done={step.done || undefined}
                  aria-label={step.done ? `${step.title}, done` : step.title}
                  data-icon="check"
                  onClick={() => openStep(step.id)}
                  className="jz-row press"
                >
                  <span aria-hidden="true" data-done={step.done || undefined} className="ap-check">
                    {step.done ? <Check strokeWidth={3} /> : null}
                  </span>
                  <span className="jz-row-text">
                    <span className="jz-row-title">{step.title}</span>
                    <span data-ellipsis className="jz-row-sub">
                      {step.sub}
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" className="ap-chevron" />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* The daily challenge on this device (dailyRecord.ts): the streak of UK days played and best totals. */}
        {daily && daily.days.length > 0 ? (
          <section aria-label="Daily" data-profile-daily className="ap-section">
            <div className="ap-section-head">
              <h2 className="ap-section-title">Daily</h2>
            </div>
            <div className="jz-panel ap-stats">
              {[
                { label: "Day streak", value: dailyStreak(daily.days, ukDayKey(Date.now())) },
                { label: "Best puzzle", value: daily.best.puzzle ?? null },
                { label: "Best arcade", value: daily.best.arcade ?? null },
              ].map((stat) => (
                <span key={stat.label} data-profile-daily-stat={stat.label} className="ap-stat">
                  <span className="ap-stat-value">{stat.value === null ? "–" : stat.value.toLocaleString("en-GB")}</span>
                  <span className="ap-stat-label">{stat.label}</span>
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <YourChallenges
          onOpen={(code) =>
            void router.navigate({ to: "/challenge", search: { code }, state: { fromPlayTab: true } as never } as never)
          }
        />

        {bests.length > 0 ? (
          <section aria-label="Practice bests" className="ap-section">
            <div className="ap-section-head">
              <h2 className="ap-section-title">Practice bests</h2>
              <button
                type="button"
                onClick={() => goToTab(router, "profile", "practice")}
                className="ap-link press -my-2.5 -mr-1 h-11 min-w-11 px-1"
              >
                All {bests.length}
              </button>
            </div>
            <ul className="jz-panel">
              {bests.slice(0, 3).map(({ type, best }) => (
                <li key={type} data-icon="game" className="jz-row">
                  <GameIcon type={type} size={40} />
                  <span data-ellipsis className="jz-row-title min-w-0 flex-1">
                    {PUZZLE_REGISTRY[type].name}
                  </span>
                  <span className="ap-best">{best}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {history.length > 0 ? (
          <section aria-label="Recent rooms" className="ap-section">
            <div className="ap-section-head">
              <h2 className="ap-section-title">Recent rooms</h2>
            </div>
            <ul className="jz-panel">
              {history.slice(0, 5).map((r) => (
                <li key={r.key} data-recent-room={r.code} data-icon="place" className="jz-row">
                  {r.place === null ? (
                    <span role="img" aria-label="Left before the end" data-place-disc="n" className="ap-place">
                      <span aria-hidden="true">–</span>
                    </span>
                  ) : (
                    <PlaceDisc place={r.place} label={`${ordinal(r.place)} place`} />
                  )}
                  <span className="jz-row-text">
                    <span data-ellipsis className="jz-row-title">
                      Room {r.code}
                    </span>
                    <span data-ellipsis className="jz-row-sub">
                      {ukDay(r.at, Date.now())} · {r.players} {r.players === 1 ? "player" : "players"}
                      {r.place === null ? " · left" : ""}
                    </span>
                  </span>
                  <span className="ap-points">{r.points.toLocaleString("en-GB")}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

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
