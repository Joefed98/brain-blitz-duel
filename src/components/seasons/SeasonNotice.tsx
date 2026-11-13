/**
 * The season reward notice (wave 4, session W4d; docs/seasons/README.md): after a season's end, "Season 1 is over"
 * with the peak tier and what it earned (the emblem, the frame, the card art and the title). Drawn only by PhoneShell on the tab
 * pages, like the badge-earned moment, so it never covers a round, its intro or reveal, or any result, podium,
 * standings or share screen; it waits while a badge moment is due. One season at a time; a tap closes it, and it is
 * marked shown either way. Accounts only; nothing is drawn while there is nothing new.
 */
import { useEffect, useState } from "react";

import { Toast } from "@/design/components";
import { useMyBadges } from "@/lib/badges/badgesApi";
import { season1Reward, SEASON_TIER_NAMES } from "@/lib/seasons/rules";
import { markSeasonRewardShown, unseenSeasonReward, useMySeasons } from "@/lib/seasons/seasonsApi";
import type { SeasonHistoryEntry } from "@/lib/seasons/types";

import { SeasonEmblem } from "./SeasonSection";

export const SEASON_NOTICE_MS = 7000;

/** The notice's two lines (the frame and the title only when that season gave them). */
export function seasonNoticeLines(h: SeasonHistoryEntry): { kicker: string; body: string } {
  const name = h.mark === "S1" ? "Season 1" : h.name || h.mark;
  const parts = [`${h.mark} ${SEASON_TIER_NAMES[h.tier]} emblem`];
  if (h.frame) parts.push("frame");
  if (h.cardArt) parts.push("card art");
  if (h.title) parts.push(`the title ${season1Reward(h.tier).title.name.replace(/^S1/, h.mark)}`);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0]!;
  return { kicker: `${name} is over · Peak ${SEASON_TIER_NAMES[h.tier]}`, body: `You earned the ${list}.` };
}

export function SeasonNotice() {
  const state = useMySeasons();
  const badges = useMyBadges();
  const badgeDue = badges.live && badges.badges?.account ? badges.badges.unseen.length > 0 : false;
  const next = badgeDue ? null : unseenSeasonReward(state);
  const [shown, setShown] = useState<SeasonHistoryEntry | null>(null);

  useEffect(() => {
    if (!next || shown) return;
    setShown(next);
  }, [next, shown]);

  useEffect(() => {
    if (!shown) return;
    const t = window.setTimeout(() => close(shown), SEASON_NOTICE_MS);
    return () => window.clearTimeout(t);
  }, [shown]);

  const close = (h: SeasonHistoryEntry) => {
    setShown(null);
    void markSeasonRewardShown(h.season);
  };

  if (!shown) return null;
  const lines = seasonNoticeLines(shown);
  return (
    <Toast as="button" tone="live" className="bd-moment" data-season-notice={shown.season} onClick={() => close(shown)}>
      <SeasonEmblem tier={shown.tier} mark={shown.mark} size={36} />
      <span className="bd-moment-text">
        <span className="bd-moment-kicker">{lines.kicker}</span>
        <span className="bd-moment-name">{lines.body}</span>
      </span>
    </Toast>
  );
}
