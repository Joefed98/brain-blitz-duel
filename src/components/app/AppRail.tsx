import { useRouter } from "@tanstack/react-router";
import { useState, type FormEvent, type MouseEvent } from "react";

import { AppWordmark } from "@/components/brand/AppWordmark";
import { LogoMark } from "@/components/brand/LogoMark";
import { AvatarButton } from "@/components/nav/AvatarButton";
import { PlayBar } from "@/components/nav/PlayBar";
import { SettingsSheet } from "@/components/app/SettingsSheet";
import { CoinCounter } from "@/components/app/CoinCounter";
import { goToTab, TAB_PATHS, type AppTab } from "@/components/app/AppTabBar";
import { useShopOn } from "@/lib/identity/shopSwitch";
import { shopDotFor, useShopStatus } from "@/lib/shop/shopStatus";
import { unlockAudio } from "@/lib/sound";
import { Icon, Input, TabBar } from "@/design/components";

/**
 * The left navigation rail (31 Oct 2026, presentation only; docs/desktop-layout.md; rebuilt in the navigation step,
 * 14 Nov 2026). Drawn by PhoneShell where the rail is the navigation (navigation.ts useNavPlacement: a computer, or a
 * tablet turned sideways on its main screens), never on a phone or an upright tablet.
 *
 * - `full` (240 px, the main screens): the Joulz logo, the player's avatar and name (Profile, or the save-your-progress
 *   sheet for a guest), the gold Play button, then Home, Games, Tournaments, Shop (with its switch) and More with their
 *   3D icons and labels; at the bottom a search (it opens Games with the words typed), the coin counter and settings
 *   (sound and music live there since the components step, 14 Nov 2026). It replaces the bottom tab bar.
 * - `compact` (76 px, rooms and games on a computer): the logo mark, the avatar, Play and the icons with their names
 *   as tooltips. Every item is a link or button in order, so it works by keyboard, with a visible focus ring (the gold
 *   Play button's is a cut frame, polish-layout/nav.css).
 */
export function AppRail({
  current,
  compact = false,
}: {
  current?: AppTab | undefined;
  compact?: boolean;
}) {
  const router = useRouter();
  const shop = useShopOn();
  const shopDot = shopDotFor(useShopStatus()) && shop && current !== "shop";
  const [settings, setSettings] = useState(false);

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
    <nav aria-label="Main" data-app-rail={compact ? "compact" : "full"} className="dk-rail jz-nav jz-nav-rail">
      <a
        href="/"
        onClick={open("play")}
        aria-label="Joulz home"
        data-rail-logo
        className="dk-rail-logo press"
      >
        {compact ? <LogoMark width={26} height={34} /> : <AppWordmark />}
      </a>
      <AvatarButton size={compact ? 32 : 30} showName={!compact} data={{ "data-rail-account": "" }} className="dk-rail-account" />
      <PlayBar from={current} variant="rail" compact={compact} />
      <div className="dk-rail-tabs">
        <TabBar variant="rail" current={current === "profile" ? undefined : current} compact={compact} shop={shop} shopDot={shopDot} onOpen={open} />
      </div>
      <div className="dk-rail-foot">
        {compact ? null : (
          <form role="search" onSubmit={search} className="dk-rail-search">
            <Icon name="search" size={18} className="dk-rail-search-icon" />
            <Input
              name="q"
              type="search"
              placeholder="Search games"
              aria-label="Search games"
              autoComplete="off"
              spellCheck={false}
            />
          </form>
        )}
        {compact ? null : <CoinCounter place="rail" />}
        <div className="dk-rail-tools">
          <button
            type="button"
            data-rail-settings
            aria-label="Settings"
            title="Settings"
            onClick={() => setSettings(true)}
            className="dk-rail-icon press"
          >
            <Icon name="settings" size={20} />
          </button>
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
