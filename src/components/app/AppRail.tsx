import { useRouter } from "@tanstack/react-router";
import { Search, Settings, Target, Trophy, UserRound, Zap, type LucideIcon } from "lucide-react";
import { useEffect, useState, type FormEvent, type MouseEvent } from "react";

import { AppWordmark } from "@/components/brand/AppWordmark";
import { LogoMark } from "@/components/brand/LogoMark";
import { MuteToggle } from "@/components/duel/MuteToggle";
import { PlayerBadge } from "@/components/duel/PlayerBadge";
import { SettingsSheet } from "@/components/app/SettingsSheet";
import { goToTab, TAB_PATHS, type AppTab } from "@/components/app/AppTabBar";
import { getStoredName } from "@/lib/duel/session";
import { rememberedLook, type PlayerLook } from "@/lib/duel/playerLook";
import { unlockAudio } from "@/lib/sound";

/**
 * The computer layout's left navigation rail (31 Oct 2026, presentation only; docs/desktop-layout.md).
 * Drawn by PhoneShell on screens 1024 px wide and up (lib/layoutMode.ts), never on a phone or tablet.
 *
 * - `full` (240 px, the four tab pages): the Joulz logo, Play, Practice, Tournaments and Profile; at the
 *   bottom a search (it opens Practice with the words typed), the account (this device's name and badge,
 *   to Profile), settings (Profile's sheet) and sound. It replaces the bottom tab bar.
 * - `compact` (76 px, rooms and games): the logo mark and the four icons with their names as tooltips.
 */
const TABS: { tab: AppTab; label: string; Icon: LucideIcon }[] = [
  { tab: "play", label: "Play", Icon: Zap },
  { tab: "practice", label: "Practice", Icon: Target },
  { tab: "tournaments", label: "Tournaments", Icon: Trophy },
  { tab: "profile", label: "Profile", Icon: UserRound },
];

export function AppRail({ current, compact = false }: { current?: AppTab | undefined; compact?: boolean }) {
  const router = useRouter();
  const [settings, setSettings] = useState(false);
  const [name, setName] = useState("");
  const [look, setLook] = useState<PlayerLook>({ colour: 0, icon: null });
  useEffect(() => {
    setName(getStoredName());
    const remembered = rememberedLook();
    setLook({ colour: remembered.colour ?? 0, icon: remembered.icon ?? null });
  }, []);

  const open = (tab: AppTab) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    unlockAudio();
    if (tab === current) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (current) goToTab(router, current, tab);
    else void router.navigate({ to: TAB_PATHS[tab] });
  };

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    void router.navigate({ to: "/practice", search: (q ? { q } : {}) as never });
  };

  return (
    <nav aria-label="Main" data-app-rail={compact ? "compact" : "full"} className="dk-rail">
      <a
        href="/"
        onClick={open("play")}
        aria-label="Joulz home"
        data-rail-logo
        className="dk-rail-logo press"
      >
        {compact ? <LogoMark width={26} height={34} /> : <AppWordmark />}
      </a>
      <div className="dk-rail-tabs">
        {TABS.map(({ tab, label, Icon }) => {
          const here = tab === current;
          return (
            <a
              key={tab}
              href={TAB_PATHS[tab]}
              onClick={open(tab)}
              aria-current={here ? "page" : undefined}
              aria-label={compact ? label : undefined}
              title={compact ? label : undefined}
              data-rail-tab={tab}
              className="dk-rail-tab press"
            >
              <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={1.9} />
              {compact ? null : <span>{label}</span>}
            </a>
          );
        })}
      </div>
      <div className="dk-rail-foot">
        {compact ? null : (
          <form role="search" onSubmit={search} className="dk-rail-search">
            <Search aria-hidden="true" className="dk-rail-search-icon" />
            <input name="q" type="search" placeholder="Search games" aria-label="Search games" autoComplete="off" spellCheck={false} className="ap-input" />
          </form>
        )}
        <a
          href="/profile"
          onClick={open("profile")}
          data-rail-account
          aria-label={compact ? "Your profile" : undefined}
          title={compact ? "Your profile" : undefined}
          className="dk-rail-account press"
        >
          <PlayerBadge look={look} name={name || "You"} size={compact ? 32 : 30} />
          {compact ? null : <span data-ellipsis className="dk-rail-name">{name || "Your profile"}</span>}
        </a>
        <div className="dk-rail-tools">
          <button type="button" data-rail-settings aria-label="Settings" title="Settings" onClick={() => setSettings(true)} className="dk-rail-icon press">
            <Settings aria-hidden="true" className="h-5 w-5" />
          </button>
          {compact ? null : <MuteToggle />}
        </div>
      </div>
      {settings ? (
        <SettingsSheet
          onClose={() => setSettings(false)}
          onHowItWorks={() => {
            setSettings(false);
            void router.navigate({ to: "/" });
          }}
          onTerms={() => {
            setSettings(false);
            void router.navigate({ to: "/terms" });
          }}
        />
      ) : null}
    </nav>
  );
}
