import { Link } from "@tanstack/react-router";

import { useAccount } from "@/lib/account/accountApi";
import { cachedPass, usePass } from "@/lib/pass/passApi";

import { JoulesBolt } from "./JoulesBolt";

/**
 * The pass progress card on Home (the Play tab; wave 2, session D2): the season, the level and its Joules bar, rewards
 * waiting to be claimed and this week's challenges done; a tap opens the Shop tab's Pass part. Asked only where this
 * device has seen a pass for the account before or the shop's tester answer says so (testers until Season 1), and
 * placed last on the page, so nothing above it ever moves.
 */
export function PassHomeCard({ eligible }: { eligible: boolean }) {
  const account = useAccount();
  const playerNumber = account.kind === "account" ? account.playerNumber : null;
  const ask = eligible || cachedPass(playerNumber);
  const pass = usePass(ask);
  if (!ask || pass.state !== "open") return null;
  const v = pass.view;
  const pct = Math.round((v.into / v.of) * 100);
  const weekDone = v.weekly ? v.weekly.challenges.filter((c) => c.completed).length : null;
  return (
    <Link to="/shop" search={{ part: "pass" }} className="pass-home press" data-pass-home={v.level}>
      <span className="pass-home-top">
        <span className="pass-home-title">{v.season.test ? "Test season" : `Season pass · ${v.season.name}`}</span>
        <span className="pass-home-level">Level {v.level}</span>
      </span>
      <span className="pass-bar" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </span>
      <span className="pass-home-bottom">
        <span className="pass-joules">
          <JoulesBolt size={14} />
          {v.level >= 60 ? "Max level" : `${v.into.toLocaleString("en-GB")} / ${v.of.toLocaleString("en-GB")}`}
        </span>
        <span className="pass-home-meta">
          {v.claimable > 0 ? `${v.claimable} to claim` : weekDone !== null ? `This week ${weekDone} / 3` : ""}
        </span>
      </span>
    </Link>
  );
}
