import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { SaveProgressOffer } from "@/components/account/SaveProgress";
import { SettingsSheet } from "@/components/app/SettingsSheet";
import { Onboarding } from "@/components/duel/Onboarding";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { NavArt } from "@/components/nav/NavArt";
import type { NavArtName } from "@/components/nav/navArt.data";
import { Icon } from "@/design/components";
import { useAccount } from "@/lib/account/accountApi";
import { betaValue } from "@/lib/beta/betaValues";
import { feedbackBase, feedbackUrl } from "@/lib/beta/feedback";
import { AppWordmark } from "@/components/brand/AppWordmark";
import { APP_NAME } from "@/lib/brand";
import { useWaitingRequests } from "@/lib/friends/friendsApi";
import { useShopOn } from "@/lib/identity/shopSwitch";
import { useHomeBed } from "@/lib/useScreenMusic";
import { unlockAudio } from "@/lib/sound";

/**
 * More (phase 2 step 1, 14 Nov 2026; docs/design/style-guide/phone/more.png): the one home for everything that isn't a
 * main destination, as a grouped list with the art kit's icons. Each row opens its existing screen (pushed, so Back
 * returns here); a row is drawn only for something that exists today for this player.
 *
 * - Friends and rivals: Profile, Friends (accounts; a guest gets the save-your-progress sheet, as Profile's Friends
 *   button does), Leaderboards.
 * - Compete: Challenges (the full list, on Games), Daily.
 * - Joulz: Joulz Plus (only where the Shop is on), Settings (the settings sheet), Support (the support address, else
 *   the feedback form; no row while neither is set).
 */
export const Route = createFileRoute("/more")({
  head: () => ({
    meta: [
      { title: `${APP_NAME}: more` },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MoreScreen,
});

/** Where Challenges' row lands on Games: the full challenges list (PracticeChallenges). */
export const CHALLENGES_SECTION = "[data-practice-challenges]";

function MoreScreen() {
  useHomeBed();
  const router = useRouter();
  const account = useAccount();
  const shop = useShopOn();
  const signedIn = account.kind === "account";
  const waiting = useWaitingRequests(signedIn);
  const [offer, setOffer] = useState(false);
  const [settings, setSettings] = useState(false);
  const [intro, setIntro] = useState(false);
  const contact = betaValue("CONTACT_EMAIL");
  const feedback = feedbackUrl(feedbackBase(), null);
  const support = contact ? `mailto:${contact}` : feedback;

  const push = (to: string, extra: Record<string, unknown> = {}) => () => {
    unlockAudio();
    void router.navigate({ to, ...extra, state: { fromPlayTab: true, ...((extra["state"] as object) ?? {}) } as never } as never);
  };

  if (intro) return <Onboarding onDone={() => setIntro(false)} />;

  return (
    <PhoneShell tabs="more" title="More">
      <div className="jz-nav jz-nav-page" data-more-page>

        <Group title="Friends and rivals">
          <Row art="profile" title="Profile" data="profile" onClick={push("/profile")} />
          <Row
            art="friends"
            title="Friends"
            data="friends"
            badge={signedIn && waiting > 0 ? waiting : undefined}
            badgeLabel={waiting === 1 ? "1 friend request waiting" : `${waiting} friend requests waiting`}
            onClick={() => {
              if (signedIn) push("/friends")();
              else setOffer(true);
            }}
          />
          <Row art="leaderboards" title="Leaderboards" data="leaderboards" onClick={push("/leaderboards")} />
        </Group>

        <Group title="Compete">
          <Row art="challenges" title="Challenges" data="challenges" onClick={push("/practice", { state: { navScroll: CHALLENGES_SECTION } })} />
          <Row art="daily" title="Daily" detail="Puzzle and Arcade" data="daily" onClick={push("/daily", { search: { kind: "puzzle" } })} />
        </Group>

        <Group title={APP_NAME}>
          {shop ? <Row art="plus" title={`${APP_NAME} Plus`} data="plus" onClick={push("/shop", { search: { part: "plus" } })} /> : null}
          <Row art="settings" title="Settings" data="settings" onClick={() => setSettings(true)} />
          {support ? <Row art="support" title="Support" data="support" href={support} external={!contact} /> : null}
        </Group>
        {/* The brand (Joe, 14 Nov 2026): out of every page header; it stays here and on the launch screen. */}
        <div data-more-brand className="jz-more-brand">
          <AppWordmark still />
        </div>
      </div>
      {offer ? <SaveProgressOffer onClose={() => setOffer(false)} /> : null}
      {settings ? (
        <SettingsSheet
          onClose={() => setSettings(false)}
          onHowItWorks={() => {
            setSettings(false);
            setIntro(true);
          }}
          onTerms={() => {
            setSettings(false);
            void router.navigate({ to: "/terms", state: { fromPlayTab: true } as never });
          }}
        />
      ) : null}
    </PhoneShell>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const id = `more-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="jz-nav-group">
      <h2 id={id} className="jz-nav-group-title">
        {title}
      </h2>
      <ul className="jz-nav-list">{children}</ul>
    </section>
  );
}

function Row({
  art,
  title,
  detail,
  badge,
  badgeLabel,
  data,
  onClick,
  href,
  external = false,
}: {
  art: NavArtName;
  title: string;
  detail?: string;
  badge?: number | undefined;
  badgeLabel?: string;
  data: string;
  onClick?: () => void;
  href?: string;
  external?: boolean;
}) {
  const inside = (
    <>
      <NavArt name={art} size={40} />
      <span className="jz-nav-row-title">{title}</span>
      {detail ? <span className="jz-nav-row-detail">{detail}</span> : null}
      {badge ? (
        <span className="jz-nav-row-badge" aria-label={badgeLabel}>
          {badge}
        </span>
      ) : null}
      <Icon name={external ? "external" : "chevron-right"} size={20} className="jz-nav-chevron" />
    </>
  );
  return (
    <li>
      {href ? (
        <a href={href} data-more-row={data} className="jz-nav-row" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {inside}
        </a>
      ) : (
        <button type="button" data-more-row={data} onClick={onClick} className="jz-nav-row">
          {inside}
        </button>
      )}
    </li>
  );
}
